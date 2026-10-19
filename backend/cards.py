"""Answered cards: the couple checks a card off after answering it, and it leaves the deck
until they uncheck it (Home -> "הקלפים שעניתם").
Card reports: a flag button under the deck sends "something's wrong with this card" to the admin panel."""
import json
import os
import sqlite3
import time
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import CONTROL_RE, current_session, require_same_origin, throttle
from db import DATA_DIR, get_db

router = APIRouter(prefix="/api/cards", tags=["cards"])
REPO_FILE = Path(__file__).resolve().parent / "questions.json"  # content shipped with the code (git)
# Once the admin edits a card, the edited copy lives here (outside git, so `git pull` on the server never
# conflicts with it) and is what the game serves. Content added to REPO_FILE later must be merged into it.
EDITED_FILE = DATA_DIR / "questions.json"
BACKUP_DIR = DATA_DIR / "content-backups"
BACKUPS_KEPT = 50


def content_file() -> Path:
    return EDITED_FILE if EDITED_FILE.exists() else REPO_FILE


def repo_newer() -> bool:
    """The code's questions.json changed after the last admin edit (its changes are not being served)."""
    return EDITED_FILE.exists() and REPO_FILE.stat().st_mtime > EDITED_FILE.stat().st_mtime


@lru_cache(maxsize=1)
def content() -> dict:
    with content_file().open(encoding="utf-8") as f:
        return json.load(f)


def save_content(data: dict) -> None:
    """Atomic write of the edited content (previous version kept in content-backups/), then drop the caches."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    (BACKUP_DIR / f"questions-{stamp}.json").write_bytes(content_file().read_bytes())
    for old in sorted(BACKUP_DIR.glob("questions-*.json"))[:-BACKUPS_KEPT]:
        old.unlink()
    tmp = EDITED_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, EDITED_FILE)
    content.cache_clear()
    card_index.cache_clear()
    valid_keys.cache_clear()


@lru_cache(maxsize=1)
def card_index() -> dict[str, dict]:
    """Every card that can be reported: key -> {text, group}. Questions use the answerKey of lib/deck.js,
    power cards (all types) "pc-<id>"."""
    data = content()
    cards = {f"{c['id']}-{i}": {"text": q, "group": c["title"]} for c in data["categories"] for i, q in enumerate(c["questions"])}
    for g in data.get("games", []):
        for i, (a, b) in enumerate(g.get("questions", [])):
            cards[f"{g['id']}-{i}"] = {"text": f"{a} או {b}?", "group": g["title"]}
    for p in data["powerCards"]:
        cards[f"pc-{p['id']}"] = {"text": f"{p['title']}: {p['text']}", "group": "מה יענה?" if p.get("type") == "guess" else "קלף כוח"}
    return cards


@lru_cache(maxsize=1)
def valid_keys() -> frozenset[str]:
    """Same keys the client builds in lib/deck.js (answerKey)."""
    data = content()
    keys = {f"{c['id']}-{i}" for c in data["categories"] for i in range(len(c["questions"]))}
    keys |= {f"{g['id']}-{i}" for g in data.get("games", []) for i in range(len(g.get("questions", [])))}
    keys |= {f"pc-{p['id']}" for p in data["powerCards"] if p.get("type") == "guess"}
    return frozenset(keys)


@router.get("/answered")
def answered(session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        "SELECT card_key, answered_at FROM answered_cards WHERE user_id = ? ORDER BY answered_at DESC", (session["id"],)
    ).fetchall()
    return [{"key": r["card_key"], "at": r["answered_at"]} for r in rows]


@router.put("/answered/{key}", status_code=204, dependencies=[Depends(require_same_origin)])
def mark(key: str, session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    if key not in valid_keys():
        raise HTTPException(404, "קלף לא קיים")
    conn.execute(
        "INSERT OR IGNORE INTO answered_cards (user_id, card_key, answered_at) VALUES (?, ?, ?)",
        (session["id"], key, int(time.time())),
    )


@router.delete("/answered/{key}", status_code=204, dependencies=[Depends(require_same_origin)])
def unmark(key: str, session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("DELETE FROM answered_cards WHERE user_id = ? AND card_key = ?", (session["id"], key))


@router.delete("/answered", status_code=204, dependencies=[Depends(require_same_origin)])
def reset(session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    """Put every card back in the deck."""
    conn.execute("DELETE FROM answered_cards WHERE user_id = ?", (session["id"],))


REPORT_REASONS = ("unclear", "typo", "inappropriate", "duplicate", "other")


class ReportIn(BaseModel):
    key: str = Field(max_length=80)
    game: str | None = Field(default=None, max_length=40)
    reason: Literal[REPORT_REASONS]
    note: str = Field(default="", max_length=500)


@router.post("/reports", status_code=201, dependencies=[Depends(require_same_origin)])
def report(body: ReportIn, session: sqlite3.Row = Depends(current_session), conn: sqlite3.Connection = Depends(get_db)):
    card = card_index().get(body.key)
    if not card:
        raise HTTPException(404, "קלף לא קיים")
    throttle(conn, f"report:{session['public_id']}", limit=20, window=3600)
    note = " ".join(CONTROL_RE.sub(" ", body.note).split())  # one line, no control characters
    if body.reason == "other" and not note:
        raise HTTPException(422, "ספרו לנו בקצרה מה לא בסדר")
    game = body.game if body.game in {g["id"] for g in content().get("games", [])} else None
    conn.execute(
        "INSERT INTO card_reports (user_id, card_key, game_id, card_text, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session["id"], body.key, game, card["text"], body.reason, note, int(time.time())),
    )
