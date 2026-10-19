"""Crypto primitives for accounts.

- Passwords: Argon2id (argon2-cffi defaults = RFC 9106 low-memory profile: t=3, m=64 MiB, p=4,
  above the OWASP minimum of m=19 MiB, t=2). Hashes are re-computed on login when params change.
- Personal fields (email, name): AES-256-GCM, random 96-bit nonce, AAD binds the ciphertext to its
  column + user, so a value copied to another row or column fails to decrypt.
- Email lookup: HMAC-SHA256 of the normalized email (deterministic, but useless without the key).
- Keys: one 256-bit master secret -> HKDF-SHA256 sub-keys. Source: SECRET_KEY env (base64), else
  data/secret.key (generated once, owner-only). Losing the key = losing the encrypted data, so
  back it up separately from the DB (never in the same place).
"""
import base64
import hashlib
import hmac
import os
import secrets
import unicodedata
import urllib.request

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from db import DATA_DIR

KEY_FILE = DATA_DIR / "secret.key"
ENC_VERSION = b"\x01"

_ph = PasswordHasher()


def _master_key() -> bytes:
    env = os.getenv("SECRET_KEY")
    if env:
        key = base64.urlsafe_b64decode(env.encode() + b"=" * (-len(env) % 4))
        if len(key) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 random bytes (base64)")
        return key
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    key = secrets.token_bytes(32)
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(key)
    return key


def _subkey(master: bytes, label: bytes) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"open-heart/" + label).derive(master)


_MASTER = _master_key()
_AES = AESGCM(_subkey(_MASTER, b"field-encryption/v1"))
_LOOKUP_KEY = _subkey(_MASTER, b"email-lookup/v1")
del _MASTER


# ---------- field encryption ----------
def encrypt(value: str, aad: str) -> bytes:
    nonce = secrets.token_bytes(12)
    return ENC_VERSION + nonce + _AES.encrypt(nonce, value.encode("utf-8"), aad.encode())


def decrypt(blob: bytes, aad: str) -> str:
    if blob[:1] != ENC_VERSION:
        raise ValueError("unknown ciphertext version")
    return _AES.decrypt(blob[1:13], blob[13:], aad.encode()).decode("utf-8")


def normalize_email(email: str) -> str:
    return unicodedata.normalize("NFKC", email).strip().lower()


def email_lookup(email: str) -> bytes:
    return hmac.new(_LOOKUP_KEY, normalize_email(email).encode(), hashlib.sha256).digest()


# ---------- passwords ----------
def normalize_password(pw: str) -> str:
    return unicodedata.normalize("NFKC", pw)  # NIST 800-63B: normalize Unicode before hashing


def hash_password(pw: str) -> str:
    return _ph.hash(normalize_password(pw))


def verify_password(stored: str, pw: str) -> bool:
    try:
        return _ph.verify(stored, normalize_password(pw))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(stored: str) -> bool:
    return _ph.check_needs_rehash(stored)


# Verified against when the email is unknown, so response time doesn't reveal which emails exist.
DUMMY_HASH = _ph.hash(secrets.token_urlsafe(16))


def password_pwned(pw: str) -> bool:
    """Have I Been Pwned range API (k-anonymity: only the first 5 hex chars of SHA-1 leave the server).
    Fails open: if the service is unreachable, sign-up is not blocked."""
    if os.getenv("HIBP_CHECK", "1") != "1":
        return False
    digest = hashlib.sha1(normalize_password(pw).encode()).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    req = urllib.request.Request(
        f"https://api.pwnedpasswords.com/range/{prefix}",
        headers={"Add-Padding": "true", "User-Agent": "open-heart"},
    )
    try:
        with urllib.request.urlopen(req, timeout=2.5) as res:
            body = res.read().decode()
    except Exception:
        return False
    for line in body.splitlines():
        h, _, count = line.partition(":")
        if h == suffix and count.strip() != "0":
            return True
    return False


# ---------- sessions ----------
def new_session_token() -> tuple[str, bytes]:
    token = secrets.token_urlsafe(32)  # 256 bits
    return token, hash_token(token)


def hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()
