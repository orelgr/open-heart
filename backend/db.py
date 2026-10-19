"""SQLite storage for user accounts.

One file (data/open_heart.db, outside git). Personal fields are stored encrypted
(see security.py); the DB itself only ever sees ciphertext, HMAC lookups and
Argon2id hashes. A connection is opened per request: SQLite connections are cheap
and this avoids sharing one across uvicorn's worker threads.
"""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parent / "data"))
DB_FILE = DATA_DIR / "open_heart.db"

SCHEMA_VERSION = 4

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    public_id       TEXT    NOT NULL UNIQUE,          -- random UUID, the only id exposed to clients
    email_lookup    BLOB    NOT NULL UNIQUE,          -- HMAC-SHA256(normalized email): lookup without plaintext
    email_enc       BLOB    NOT NULL,                 -- AES-256-GCM
    name_enc        BLOB    NOT NULL,                 -- AES-256-GCM (player 1)
    partner_enc     BLOB,                             -- AES-256-GCM (player 2, the partner's name)
    name_lookup     BLOB,                             -- HMAC(normalized name): sign in with either name
    partner_lookup  BLOB,                             --   (not unique: many couples share a name)
    password_hash   TEXT    NOT NULL,                 -- Argon2id (PHC string, includes salt + params)
    consent_version TEXT    NOT NULL,                 -- privacy notice version accepted at sign-up
    consent_at      INTEGER NOT NULL,
    failed_logins   INTEGER NOT NULL DEFAULT 0,
    locked_until    INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    last_login_at   INTEGER,
    is_admin        INTEGER NOT NULL DEFAULT 0        -- the env-managed admin account (see admin.ensure_admin)
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash   BLOB    PRIMARY KEY,                 -- SHA-256 of the cookie token; the token itself is never stored
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Cards the couple answered and checked off (removed from the deck until unchecked).
-- card_key = "<categoryId>-<index>" for questions, "pc-<powerCardId>" for "מה יענה?" cards.
CREATE TABLE IF NOT EXISTS answered_cards (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_key    TEXT    NOT NULL,
    answered_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, card_key)
) STRICT, WITHOUT ROWID;

-- "Something's wrong with this card" reports from players, triaged in the admin panel.
-- card_text is a snapshot, so a report still makes sense after the card is edited.
CREATE TABLE IF NOT EXISTS card_reports (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    card_key    TEXT    NOT NULL,
    game_id     TEXT,
    card_text   TEXT    NOT NULL,
    reason      TEXT    NOT NULL,
    note        TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at  INTEGER NOT NULL,
    resolved_at INTEGER
) STRICT;
CREATE INDEX IF NOT EXISTS card_reports_status ON card_reports(status, created_at);

-- Throttling buckets (per IP / per account), pruned continuously.
CREATE TABLE IF NOT EXISTS rate_events (
    bucket     TEXT    NOT NULL,
    created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS rate_events_bucket ON rate_events(bucket, created_at);

-- Security audit log (sign-in, failures, password change, deletion). No passwords, no emails.
CREATE TABLE IF NOT EXISTS auth_events (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event      TEXT    NOT NULL,
    ip         TEXT,
    created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS auth_events_time ON auth_events(created_at);
"""


def _connect() -> sqlite3.Connection:
    # check_same_thread=False: FastAPI may open and close a dependency in different pool threads;
    # the connection is still used by one request at a time.
    conn = sqlite3.connect(DB_FILE, timeout=5, isolation_level=None, check_same_thread=False)  # autocommit
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA secure_delete = ON")  # deleted rows are zeroed on disk (right to erasure)
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(DATA_DIR, 0o700)
    except OSError:
        pass
    with closing_conn() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
        if "partner_enc" not in cols:  # v1 -> v2
            conn.execute("ALTER TABLE users ADD COLUMN partner_enc BLOB")
        for col in ("name_lookup", "partner_lookup"):  # v2 -> v3 (values backfilled by auth.backfill_name_lookups)
            if col not in cols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} BLOB")
        if "is_admin" not in cols:  # v3 -> v4
            conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        conn.execute("CREATE INDEX IF NOT EXISTS users_name_lookup ON users(name_lookup)")
        conn.execute("CREATE INDEX IF NOT EXISTS users_partner_lookup ON users(partner_lookup)")
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    for f in DATA_DIR.glob("open_heart.db*"):
        try:
            os.chmod(f, 0o600)  # owner-only (no effect on Windows ACLs)
        except OSError:
            pass


@contextmanager
def closing_conn():
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaction(conn: sqlite3.Connection):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def get_db():
    """FastAPI dependency."""
    with closing_conn() as conn:
        yield conn
