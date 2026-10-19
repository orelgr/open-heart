"""Accounts: register, login, logout, profile, data export, account deletion.

Sessions are opaque random tokens in an HttpOnly + Secure + SameSite cookie; only their SHA-256 is
stored, so a DB leak does not leak live sessions. State-changing requests must come from an allowed
Origin (CSRF). All error messages for sign-in are generic (no "user not found" vs "wrong password").
"""
import os
import re
import sqlite3
import time
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

import security as sec
from db import get_db, transaction

router = APIRouter(prefix="/api/auth", tags=["auth"])

PRIVACY_VERSION = "2026-10-19"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "1") != "0"
COOKIE_NAME = "__Host-session" if COOKIE_SECURE else "session"
SESSION_ABSOLUTE = 30 * 24 * 3600  # re-authenticate at least every 30 days (NIST AAL1)
SESSION_IDLE = 7 * 24 * 3600
PASSWORD_MIN = int(os.getenv("PASSWORD_MIN_LENGTH", "12"))
PASSWORD_MAX = 128
AUDIT_RETENTION_DAYS = int(os.getenv("AUDIT_RETENTION_DAYS", "365"))
LOCK_AFTER = 5  # failed logins before per-account backoff kicks in

ALLOWED_ORIGINS = {o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip() not in ("", "*")}
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
COMMON = {
    "123456789012", "password1234", "qwertyuiop12", "111111111111", "123123123123", "iloveyou1234",
    "aaaaaaaaaaaa", "abcdefghijkl", "qwerty123456", "123456123456", "password123!", "admin1234567",
    "openheart123", "openhearts12", "levavotptuhim",
}

GENERIC_LOGIN_ERROR = "המייל או הסיסמה שגויים"
TOO_MANY = "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות."


# ---------- models ----------
class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    name: str = Field(max_length=60)
    partner: str = Field(default="", max_length=60)
    password: str = Field(max_length=PASSWORD_MAX * 4)
    consent: bool


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=PASSWORD_MAX * 4)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    partner: str | None = Field(default=None, max_length=60)


class PasswordChangeIn(BaseModel):
    current: str = Field(max_length=PASSWORD_MAX * 4)
    new: str = Field(max_length=PASSWORD_MAX * 4)


class DeleteIn(BaseModel):
    password: str = Field(max_length=PASSWORD_MAX * 4)


# ---------- helpers ----------
def now() -> int:
    return int(time.time())


def client_ip(request: Request) -> str:
    # uvicorn applies X-Forwarded-For only from trusted proxies (forwarded_allow_ips, default 127.0.0.1)
    return request.client.host if request.client else "unknown"


def require_same_origin(request: Request) -> None:
    """CSRF defence on top of SameSite: the browser-set Origin must be ours."""
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        raise HTTPException(403, "Origin required")
    parsed = urlparse(origin)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if base not in ALLOWED_ORIGINS and parsed.netloc != request.headers.get("host"):
        raise HTTPException(403, "Cross-origin request blocked")


def throttle(conn: sqlite3.Connection, bucket: str, limit: int, window: int) -> None:
    t = now()
    conn.execute("DELETE FROM rate_events WHERE created_at < ?", (t - 86400,))
    (count,) = conn.execute(
        "SELECT COUNT(*) FROM rate_events WHERE bucket = ? AND created_at > ?", (bucket, t - window)
    ).fetchone()
    if count >= limit:
        raise HTTPException(429, TOO_MANY)
    conn.execute("INSERT INTO rate_events (bucket, created_at) VALUES (?, ?)", (bucket, t))


def audit(conn: sqlite3.Connection, event: str, user_id: int | None, request: Request) -> None:
    conn.execute(
        "INSERT INTO auth_events (user_id, event, ip, created_at) VALUES (?, ?, ?, ?)",
        (user_id, event, client_ip(request), now()),
    )


def purge_expired(conn: sqlite3.Connection) -> None:
    t = now()
    conn.execute("DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?", (t, t - SESSION_IDLE))
    conn.execute("DELETE FROM auth_events WHERE created_at < ?", (t - AUDIT_RETENTION_DAYS * 86400,))


def clean_name(name: str, required: bool = True) -> str:
    name = " ".join(name.split())
    if not (1 if required else 0) <= len(name) <= 40 or CONTROL_RE.search(name):
        raise HTTPException(422, "שם צריך להכיל 1 עד 40 תווים")
    return name


def check_email(email: str) -> str:
    email = sec.normalize_email(email)
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "כתובת מייל לא תקינה")
    return email


def check_password(pw: str, email: str, name: str) -> None:
    pw = sec.normalize_password(pw)
    if len(pw) < PASSWORD_MIN:
        raise HTTPException(422, f"הסיסמה צריכה להכיל לפחות {PASSWORD_MIN} תווים")
    if len(pw) > PASSWORD_MAX:
        raise HTTPException(422, f"הסיסמה ארוכה מ-{PASSWORD_MAX} תווים")
    low = pw.lower()
    local = email.split("@")[0]
    if low in COMMON or len(set(low)) < 4 or (len(local) >= 4 and local in low) or (len(name) >= 4 and name.lower() in low):
        raise HTTPException(422, "הסיסמה צפויה מדי. נסו משפט קצר שרק אתם תזכרו")
    if sec.password_pwned(pw):
        raise HTTPException(422, "הסיסמה הזו הופיעה בדליפות מידע מוכרות. בחרו סיסמה אחרת")


def user_out(row: sqlite3.Row) -> dict:
    aad = row["public_id"]
    return {
        "id": row["public_id"],
        "email": sec.decrypt(row["email_enc"], "email:" + aad),
        "name": sec.decrypt(row["name_enc"], "name:" + aad),
        "partner": sec.decrypt(row["partner_enc"], "partner:" + aad) if row["partner_enc"] else "",
        "createdAt": row["created_at"],
    }


def start_session(conn: sqlite3.Connection, response: Response, user_id: int) -> None:
    token, token_hash = sec.new_session_token()
    t = now()
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (token_hash, user_id, t, t, t + SESSION_ABSOLUTE),
    )
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_ABSOLUTE, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax"
    )


def end_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")


def load_session(request: Request, conn: sqlite3.Connection) -> sqlite3.Row | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token or len(token) > 100:
        return None
    token_hash = sec.hash_token(token)
    row = conn.execute(
        "SELECT s.token_hash, s.last_seen_at, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token_hash = ?",
        (token_hash,),
    ).fetchone()
    t = now()
    if not row or row["expires_at"] < t or row["last_seen_at"] < t - SESSION_IDLE:
        if row:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        return None
    if t - row["last_seen_at"] > 300:
        conn.execute("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", (t, token_hash))
    return row


def current_session(request: Request, conn: sqlite3.Connection = Depends(get_db)) -> sqlite3.Row:
    row = load_session(request, conn)
    if not row:
        raise HTTPException(401, "לא מחובר")
    return row


# ---------- routes ----------
@router.post("/register", status_code=201, dependencies=[Depends(require_same_origin)])
def register(body: RegisterIn, request: Request, response: Response, conn: sqlite3.Connection = Depends(get_db)):
    throttle(conn, f"register:{client_ip(request)}", limit=5, window=3600)
    if not body.consent:
        raise HTTPException(422, "יש לאשר את מדיניות הפרטיות")
    email = check_email(body.email)
    name = clean_name(body.name)
    partner = clean_name(body.partner, required=False)
    check_password(body.password, email, name)
    password_hash = sec.hash_password(body.password)  # slow: outside the write lock

    public_id = str(uuid.uuid4())
    t = now()
    try:
        with transaction(conn):
            cur = conn.execute(
                "INSERT INTO users (public_id, email_lookup, email_enc, name_enc, partner_enc, password_hash, "
                "consent_version, consent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    public_id,
                    sec.email_lookup(email),
                    sec.encrypt(email, "email:" + public_id),
                    sec.encrypt(name, "name:" + public_id),
                    sec.encrypt(partner, "partner:" + public_id),
                    password_hash,
                    PRIVACY_VERSION,
                    t,
                    t,
                    t,
                ),
            )
            audit(conn, "register", cur.lastrowid, request)
            start_session(conn, response, cur.lastrowid)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "כבר קיים חשבון עם המייל הזה. נסו להתחבר")
    return {"id": public_id, "email": email, "name": name, "partner": partner, "createdAt": t}


@router.post("/login", dependencies=[Depends(require_same_origin)])
def login(body: LoginIn, request: Request, response: Response, conn: sqlite3.Connection = Depends(get_db)):
    throttle(conn, f"login:{client_ip(request)}", limit=30, window=900)
    purge_expired(conn)
    user = conn.execute("SELECT * FROM users WHERE email_lookup = ?", (sec.email_lookup(body.email),)).fetchone()
    if not user:
        sec.verify_password(sec.DUMMY_HASH, body.password)  # same cost as a real check
        audit(conn, "login_failed", None, request)
        raise HTTPException(401, GENERIC_LOGIN_ERROR)
    if user["locked_until"] > now():
        audit(conn, "login_locked", user["id"], request)
        raise HTTPException(429, TOO_MANY)

    if not sec.verify_password(user["password_hash"], body.password):
        fails = user["failed_logins"] + 1
        locked = now() + min(900, 30 * 2 ** (fails - LOCK_AFTER)) if fails >= LOCK_AFTER else 0
        conn.execute("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?", (fails, locked, user["id"]))
        audit(conn, "login_failed", user["id"], request)
        raise HTTPException(401, GENERIC_LOGIN_ERROR)

    with transaction(conn):
        new_hash = sec.hash_password(body.password) if sec.needs_rehash(user["password_hash"]) else user["password_hash"]
        conn.execute(
            "UPDATE users SET failed_logins = 0, locked_until = 0, last_login_at = ?, password_hash = ? WHERE id = ?",
            (now(), new_hash, user["id"]),
        )
        audit(conn, "login", user["id"], request)
        start_session(conn, response, user["id"])  # always a fresh token (no session fixation)
    return user_out(user)


@router.post("/logout", status_code=204, dependencies=[Depends(require_same_origin)])
def logout(request: Request, response: Response, conn: sqlite3.Connection = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (sec.hash_token(token),))
    end_cookie(response)


@router.get("/session")
def session_state(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    """Who is signed in, without a 401 for guests (most players never create an account)."""
    row = load_session(request, conn)
    return {"user": user_out(row) if row else None}


@router.get("/me")
def me(session: sqlite3.Row = Depends(current_session)):
    return user_out(session)


@router.patch("/me", dependencies=[Depends(require_same_origin)])
def update_profile(body: ProfileIn, session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    """Rename the couple (either name may be sent alone)."""
    out, pid = user_out(session), session["public_id"]
    if body.name is not None:
        out["name"] = clean_name(body.name)
    if body.partner is not None:
        out["partner"] = clean_name(body.partner, required=False)
    conn.execute(
        "UPDATE users SET name_enc = ?, partner_enc = ?, updated_at = ? WHERE id = ?",
        (sec.encrypt(out["name"], "name:" + pid), sec.encrypt(out["partner"], "partner:" + pid), now(), session["id"]),
    )
    return out


@router.post("/password", status_code=204, dependencies=[Depends(require_same_origin)])
def change_password(
    body: PasswordChangeIn,
    request: Request,
    response: Response,
    session: sqlite3.Row = Depends(current_session),
    conn: sqlite3.Connection = Depends(get_db),
):
    throttle(conn, f"password:{session['public_id']}", limit=10, window=3600)
    if not sec.verify_password(session["password_hash"], body.current):
        raise HTTPException(403, "הסיסמה הנוכחית שגויה")
    info = user_out(session)
    check_password(body.new, info["email"], info["name"])
    new_hash = sec.hash_password(body.new)
    with transaction(conn):
        conn.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (new_hash, now(), session["id"]))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (session["id"],))  # sign out every device
        audit(conn, "password_changed", session["id"], request)
        start_session(conn, response, session["id"])


@router.get("/export")
def export_data(session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    """Right of access (Privacy Protection Law s.13): everything stored about the user."""
    sessions = conn.execute(
        "SELECT created_at, last_seen_at, expires_at FROM sessions WHERE user_id = ?", (session["id"],)
    ).fetchall()
    answered = conn.execute(
        "SELECT card_key, answered_at FROM answered_cards WHERE user_id = ? ORDER BY answered_at", (session["id"],)
    ).fetchall()
    events = conn.execute(
        "SELECT event, ip, created_at FROM auth_events WHERE user_id = ? ORDER BY created_at", (session["id"],)
    ).fetchall()
    return {
        "account": {
            **user_out(session),
            "updatedAt": session["updated_at"],
            "lastLoginAt": session["last_login_at"],
            "privacyConsent": {"version": session["consent_version"], "at": session["consent_at"]},
        },
        "answeredCards": [dict(r) for r in answered],
        "sessions": [dict(r) for r in sessions],
        "securityLog": [dict(r) for r in events],
        "note": "הסיסמה שמורה רק כגיבוב חד-כיווני (Argon2id) ולכן אינה ניתנת לשחזור או לייצוא.",
    }


@router.delete("/me", status_code=204, dependencies=[Depends(require_same_origin)])
def delete_account(
    body: DeleteIn,
    request: Request,
    response: Response,
    session: sqlite3.Row = Depends(current_session),
    conn: sqlite3.Connection = Depends(get_db),
):
    throttle(conn, f"delete:{session['public_id']}", limit=10, window=3600)
    if not sec.verify_password(session["password_hash"], body.password):
        raise HTTPException(403, "הסיסמה שגויה")
    with transaction(conn):
        conn.execute("DELETE FROM users WHERE id = ?", (session["id"],))  # cascades sessions; secure_delete zeroes pages
        audit(conn, "account_deleted", None, request)
    end_cookie(response)
