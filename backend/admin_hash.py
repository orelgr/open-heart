"""Print the backend/.env line for the admin password (Argon2id hash, never the password itself).

    python admin_hash.py            asks for the password (hidden)
    python admin_hash.py --write    also saves it to backend/.env (replacing an older ADMIN_PASSWORD_HASH)

On the server, run it once (or copy the line from your local backend/.env) and restart PM2.
"""
import getpass
import sys
from pathlib import Path

from argon2 import PasswordHasher

ENV_FILE = Path(__file__).resolve().parent / ".env"

pw = getpass.getpass("Admin password: ")
if len(pw) < 10 or pw != getpass.getpass("Again: "):
    sys.exit("! Passwords differ or shorter than 10 characters")
line = f"ADMIN_PASSWORD_HASH='{PasswordHasher().hash(pw)}'"
if "--write" in sys.argv:
    kept = [l for l in (ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []) if not l.startswith("ADMIN_PASSWORD_HASH=")]
    ENV_FILE.write_text("\n".join([*kept, line]) + "\n", encoding="utf-8")
    print(f"Saved to {ENV_FILE}. Restart the server.")
else:
    print(line)
