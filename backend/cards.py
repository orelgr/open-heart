"""Answered cards: the couple checks a card off after answering it, and it leaves the deck
until they uncheck it (Home -> "הקלפים שעניתם")."""
import json
import sqlite3
import time
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from auth import current_session, require_same_origin
from db import get_db

router = APIRouter(prefix="/api/cards", tags=["cards"])
DATA_FILE = Path(__file__).resolve().parent / "questions.json"


@lru_cache(maxsize=1)
def valid_keys() -> frozenset[str]:
    """Same keys the client builds in lib/deck.js (answerKey)."""
    with DATA_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    keys = {f"{c['id']}-{i}" for c in data["categories"] for i in range(len(c["questions"]))}
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
