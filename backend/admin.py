"""Admin panel API (#/admin): overview numbers, card reports queue, card editor, users list.

The admin is a normal account with users.is_admin = 1, created/updated on every start from the server's
environment, so no credential is ever in git:
  ADMIN_PASSWORD_HASH  Argon2id hash (python backend/admin_hash.py prints it), usually in backend/.env
  ADMIN_USERNAME       sign-in name (default "admin")
  ADMIN_EMAIL          optional, the account's email (default admin@openhearts.local)
The env is the source of truth: changing the hash and restarting changes the password and signs the
admin out everywhere. Password change / account deletion from the UI are blocked for this account.
"""
import copy
import os
import sqlite3
import threading
import time
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import security as sec
from auth import ADMIN_USERNAME, CONTROL_RE, PRIVACY_VERSION, audit, current_session, require_same_origin, user_out
from cards import EDITED_FILE, card_index, content, content_file, repo_newer, save_content
from db import get_db, transaction

router = APIRouter(prefix="/api/admin", tags=["admin"])
DAY = 86400


def require_admin(session: sqlite3.Row = Depends(current_session)) -> sqlite3.Row:
    if not session["is_admin"]:
        raise HTTPException(403, "אין הרשאה")
    return session


def ensure_admin(conn: sqlite3.Connection) -> None:
    """Create or sync the admin account from the environment (called at startup)."""
    pw_hash = os.getenv("ADMIN_PASSWORD_HASH", "").strip()
    if not pw_hash:
        if not conn.execute("SELECT 1 FROM users WHERE is_admin = 1").fetchone():
            print("! No admin account: set ADMIN_PASSWORD_HASH in backend/.env (python admin_hash.py)")
        return
    if not pw_hash.startswith("$argon2id$"):
        print("! ADMIN_PASSWORD_HASH is not an Argon2id hash; admin account not changed")
        return
    email = sec.normalize_email(os.getenv("ADMIN_EMAIL", "admin@openhearts.local"))
    t = int(time.time())
    with transaction(conn):
        row = conn.execute(
            "SELECT * FROM users WHERE is_admin = 1 OR email_lookup = ? ORDER BY is_admin DESC, id LIMIT 1", (sec.email_lookup(email),)
        ).fetchone()
        if row is None:
            public_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO users (public_id, email_lookup, email_enc, name_enc, partner_enc, password_hash, consent_version, "
                "consent_at, created_at, updated_at, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
                (
                    public_id,
                    sec.email_lookup(email),
                    sec.encrypt(email, "email:" + public_id),
                    sec.encrypt("מנהל", "name:" + public_id),
                    sec.encrypt("", "partner:" + public_id),
                    pw_hash,
                    PRIVACY_VERSION,
                    t,
                    t,
                    t,
                ),
            )
            print(f"  Admin account created: sign in as '{ADMIN_USERNAME}'")
        elif row["password_hash"] != pw_hash or not row["is_admin"] or not _decrypts(row):
            pid = row["public_id"]
            # Re-encrypt with the current key: a row written under another key would otherwise break every read.
            name, partner = ("מנהל", "") if not _decrypts(row) else (user_out(row)["name"], user_out(row)["partner"])
            conn.execute(
                "UPDATE users SET is_admin = 1, password_hash = ?, failed_logins = 0, locked_until = 0, name_lookup = NULL, "
                "partner_lookup = NULL, email_lookup = ?, email_enc = ?, name_enc = ?, partner_enc = ?, updated_at = ? WHERE id = ?",
                (
                    pw_hash,
                    sec.email_lookup(email),
                    sec.encrypt(email, "email:" + pid),
                    sec.encrypt(name, "name:" + pid),
                    sec.encrypt(partner, "partner:" + pid),
                    t,
                    row["id"],
                ),
            )
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))  # new password -> sign out everywhere
            print(f"  Admin password updated from ADMIN_PASSWORD_HASH (sign in as '{ADMIN_USERNAME}')")


def _decrypts(row: sqlite3.Row) -> bool:
    try:
        user_out(row)
        return True
    except Exception:  # noqa: BLE001
        return False


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:2]}{'•' * max(1, min(len(local) - 2, 4))}@{domain}"


@router.get("/overview")
def overview(_admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    t = int(time.time())
    one = lambda sql, *args: conn.execute(sql, args).fetchone()[0]  # noqa: E731
    by_key = card_index()

    def top(sql: str) -> list[dict]:
        return [
            {"key": r[0], "count": r[1], "text": by_key.get(r[0], {}).get("text", r[0]), "group": by_key.get(r[0], {}).get("group", "")}
            for r in conn.execute(sql).fetchall()
        ]

    return {
        "users": one("SELECT COUNT(*) FROM users WHERE is_admin = 0"),
        "newUsers": one("SELECT COUNT(*) FROM users WHERE is_admin = 0 AND created_at > ?", t - 7 * DAY),
        "activeUsers": one(
            "SELECT COUNT(*) FROM users u WHERE is_admin = 0 AND (last_login_at > ? OR EXISTS "
            "(SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.last_seen_at > ?))",
            t - 7 * DAY,
            t - 7 * DAY,
        ),
        "openReports": one("SELECT COUNT(*) FROM card_reports WHERE status = 'open'"),
        "answered": one("SELECT COUNT(*) FROM answered_cards"),
        "failedLogins": one("SELECT COUNT(*) FROM auth_events WHERE event LIKE 'login_failed%' AND created_at > ?", t - DAY),
        "topReported": top(
            "SELECT card_key, COUNT(*) n FROM card_reports WHERE status = 'open' GROUP BY card_key ORDER BY n DESC, MAX(created_at) DESC LIMIT 5"
        ),
        "topAnswered": top("SELECT card_key, COUNT(*) n FROM answered_cards GROUP BY card_key ORDER BY n DESC LIMIT 5"),
    }


@router.get("/reports")
def reports(
    status: Literal["open", "resolved", "all"] = "open",
    _admin: sqlite3.Row = Depends(require_admin),
    conn: sqlite3.Connection = Depends(get_db),
):
    where = "" if status == "all" else "WHERE status = ?"
    rows = conn.execute(f"SELECT * FROM card_reports {where} ORDER BY created_at DESC LIMIT 1000", () if status == "all" else (status,)).fetchall()
    by_key = card_index()
    games = {g["id"]: g["title"] for g in content().get("games", [])}
    out = []
    for r in rows:
        card = by_key.get(r["card_key"])
        out.append(
            {
                "id": r["id"],
                "key": r["card_key"],
                "text": r["card_text"],
                "current": card["text"] if card and card["text"] != r["card_text"] else None,  # card edited since
                "removed": card is None,
                "group": card["group"] if card else "",
                "game": games.get(r["game_id"], ""),
                "reason": r["reason"],
                "note": r["note"],
                "status": r["status"],
                "createdAt": r["created_at"],
                "resolvedAt": r["resolved_at"],
            }
        )
    return out


class ReportsStatusIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)
    status: Literal["open", "resolved"]


class ReportsDeleteIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)


def _marks(ids: list[int]) -> str:
    return ",".join("?" * len(ids))


@router.patch("/reports", status_code=204, dependencies=[Depends(require_same_origin)])
def set_reports_status(
    body: ReportsStatusIn, request: Request, admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)
):
    resolved_at = int(time.time()) if body.status == "resolved" else None
    with transaction(conn):
        conn.execute(
            f"UPDATE card_reports SET status = ?, resolved_at = ? WHERE id IN ({_marks(body.ids)})", (body.status, resolved_at, *body.ids)
        )
        audit(conn, f"admin_reports_{body.status}", admin["id"], request)


@router.post("/reports/delete", status_code=204, dependencies=[Depends(require_same_origin)])
def delete_reports(
    body: ReportsDeleteIn, request: Request, admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)
):
    with transaction(conn):
        conn.execute(f"DELETE FROM card_reports WHERE id IN ({_marks(body.ids)})", body.ids)
        audit(conn, "admin_reports_deleted", admin["id"], request)


@router.get("/users")
def users(_admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    """Couples (not the admin), newest first. Emails are masked: the panel never needs them in full (data minimization)."""
    rows = conn.execute(
        "SELECT u.*, (SELECT COUNT(*) FROM answered_cards a WHERE a.user_id = u.id) answered, "
        "(SELECT COUNT(*) FROM card_reports r WHERE r.user_id = u.id) reports, "
        "(SELECT MAX(last_seen_at) FROM sessions s WHERE s.user_id = u.id) seen "
        "FROM users u WHERE u.is_admin = 0 ORDER BY u.created_at DESC LIMIT 2000"
    ).fetchall()
    out = []
    for r in rows:
        info = user_out(r)
        out.append(
            {
                "id": info["id"],
                "name": info["name"],
                "partner": info["partner"],
                "email": mask_email(info["email"]),
                "createdAt": r["created_at"],
                "lastActive": max(r["seen"] or 0, r["last_login_at"] or 0) or None,
                "answered": r["answered"],
                "reports": r["reports"],
            }
        )
    return out


# ---------- card editor ----------
# Card keys are positional ("<categoryId>-<index>", "<gameId>-<index>"; power cards "pc-<id>"), so deleting a
# card shifts the keys of the cards after it in answered_cards and card_reports, in the same transaction as
# the content write. Reports on the deleted card keep their text snapshot under "removed:<key>:<time>".
_content_lock = threading.Lock()
TEXT_MAX = 300
OPTION_MAX = 120


class CardIn(BaseModel):
    text: str | None = Field(default=None, max_length=TEXT_MAX * 2)
    title: str | None = Field(default=None, max_length=80)
    options: list[str] | None = Field(default=None, min_length=2, max_length=2)


class NewCardIn(CardIn):
    group: str = Field(max_length=40)  # category id, or the id of a game with its own questions


def clean_text(value: str | None, limit: int, label: str = "הטקסט") -> str:
    text = " ".join(CONTROL_RE.sub(" ", value or "").split())
    if not 2 <= len(text) <= limit:
        raise HTTPException(422, f"{label} צריך להכיל 2 עד {limit} תווים")
    return text


def locate(data: dict, key: str) -> tuple[str, list, int, str] | None:
    """-> (kind "question" | "pair" | "power", the list holding the card, its index, key prefix)."""
    if key.startswith("pc-"):
        for i, p in enumerate(data["powerCards"]):
            if p["id"] == key[3:]:
                return "power", data["powerCards"], i, ""
        return None
    group, _, idx = key.rpartition("-")
    if not idx.isdigit():
        return None
    i = int(idx)
    for c in data["categories"]:
        if c["id"] == group and i < len(c["questions"]):
            return "question", c["questions"], i, group
    for g in data.get("games", []):
        if g["id"] == group and i < len(g.get("questions", [])):
            return "pair", g["questions"], i, group
    return None


def card_value(kind: str, body: CardIn, current):
    if kind == "pair":
        if not body.options:
            raise HTTPException(422, "צריך שתי אפשרויות")
        return [clean_text(o, OPTION_MAX, "כל אפשרות") for o in body.options]
    text = clean_text(body.text, TEXT_MAX)
    if kind == "power":
        return {**current, "text": text, "title": clean_text(body.title, 60, "הכותרת") if body.title is not None else current["title"]}
    return text


def editor_payload() -> dict:
    return {"content": content(), "edited": content_file() == EDITED_FILE, "repoNewer": repo_newer()}


@router.get("/content")
def get_content(_admin: sqlite3.Row = Depends(require_admin)):
    return editor_payload()


@router.put("/cards/{key}", dependencies=[Depends(require_same_origin)])
def edit_card(key: str, body: CardIn, request: Request, admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    with _content_lock:
        data = copy.deepcopy(content())
        found = locate(data, key)
        if not found:
            raise HTTPException(404, "קלף לא קיים")
        kind, items, i, _ = found
        items[i] = card_value(kind, body, items[i])
        with transaction(conn):
            audit(conn, "admin_card_edited", admin["id"], request)
            save_content(data)
    return editor_payload()


@router.post("/cards", status_code=201, dependencies=[Depends(require_same_origin)])
def add_card(body: NewCardIn, request: Request, admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    """Append (never insert): existing keys stay valid."""
    with _content_lock:
        data = copy.deepcopy(content())
        group = next((c for c in data["categories"] if c["id"] == body.group), None)
        kind = "question"
        if group is None:
            group = next((g for g in data.get("games", []) if g["id"] == body.group and "questions" in g), None)
            kind = "pair"
        if group is None:
            raise HTTPException(404, "קטגוריה לא קיימת")
        group["questions"].append(card_value(kind, body, None))
        with transaction(conn):
            audit(conn, "admin_card_added", admin["id"], request)
            save_content(data)
    return {**editor_payload(), "key": f"{body.group}-{len(group['questions']) - 1}"}


@router.delete("/cards/{key}", dependencies=[Depends(require_same_origin)])
def delete_card(key: str, request: Request, admin: sqlite3.Row = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    t = int(time.time())
    with _content_lock:
        data = copy.deepcopy(content())
        found = locate(data, key)
        if not found:
            raise HTTPException(404, "קלף לא קיים")
        kind, items, i, prefix = found
        count = len(items)
        items.pop(i)
        with transaction(conn):
            conn.execute("DELETE FROM answered_cards WHERE card_key = ?", (key,))
            conn.execute(
                "UPDATE card_reports SET card_key = ?, status = 'resolved', resolved_at = COALESCE(resolved_at, ?) WHERE card_key = ?",
                (f"removed:{key}:{t}", t, key),
            )
            if kind != "power":  # the cards after it move up one place: c-(j) -> c-(j-1), in order (no PK clash)
                for j in range(i + 1, count):
                    for table in ("answered_cards", "card_reports"):
                        conn.execute(f"UPDATE {table} SET card_key = ? WHERE card_key = ?", (f"{prefix}-{j - 1}", f"{prefix}-{j}"))
            audit(conn, "admin_card_deleted", admin["id"], request)
            save_content(data)
    return editor_payload()
