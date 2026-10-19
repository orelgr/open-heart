"""Consistent online backup of the user DB (safe while the server runs).

    python backup_db.py [target_dir]      default: data/backups, keeps the newest 14

Run daily (cron / Task Scheduler). Copy backups off the server, but never next to secret.key:
an attacker holding both can decrypt everything. Backups contain only ciphertext + hashes.
"""
import os
import sqlite3
import sys
import time
from pathlib import Path

from db import DATA_DIR, DB_FILE

KEEP = 14


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA_DIR / "backups"
    target.mkdir(parents=True, exist_ok=True)
    out = target / f"open_heart-{time.strftime('%Y%m%d-%H%M%S')}.db"
    src = sqlite3.connect(DB_FILE)
    dst = sqlite3.connect(out)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()
    try:
        os.chmod(out, 0o600)
    except OSError:
        pass
    for old in sorted(target.glob("open_heart-*.db"))[:-KEEP]:
        old.unlink()
    print(out)


if __name__ == "__main__":
    main()
