"""Username + 4-digit PIN authentication.

This is deliberately simple, matching the rest of the app's scope: no
sessions, no JWTs. Login/signup return the user's id and the frontend holds
it client-side (localStorage) and sends it as `user_id` on every request —
the same parameter every endpoint already accepts and filters by. That gives
real separate accounts and real per-user data isolation (pantry, spend
mandates, orders, agent sessions all already key off user_id), but it is NOT
a hardened session system: anyone who learns another user's id could pass it
as their own. Good enough for a hackathon demo with trusted users; add real
sessions/cookies before this is ever exposed publicly.

PINs are hashed with PBKDF2-HMAC-SHA256 (stdlib, no extra dependency) and a
random per-user salt — not stored or compared in plain text.
"""

import hashlib
import hmac
import re
import secrets

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")
PIN_RE = re.compile(r"^\d{4}$")
PBKDF2_ITERATIONS = 200_000


class AuthError(ValueError):
    pass


def validate_username(username: str) -> str:
    username = (username or "").strip().lower()
    if not USERNAME_RE.match(username):
        raise AuthError("Username must be 3-20 characters: lowercase letters, numbers, underscore.")
    return username


def validate_pin(pin: str) -> str:
    pin = (pin or "").strip()
    if not PIN_RE.match(pin):
        raise AuthError("PIN must be exactly 4 digits.")
    return pin


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"{salt}${digest.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        salt, digest_hex = stored.split("$", 1)
    except (ValueError, AttributeError):
        return False
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest.hex(), digest_hex)
