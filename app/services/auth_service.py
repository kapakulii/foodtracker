import os
import secrets
from typing import Optional
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

_ENV = os.environ.get("ENV", "development")
_SECRET = os.environ.get("AUTH_SECRET_KEY", "")
if not _SECRET:
    if _ENV == "production":
        raise RuntimeError("AUTH_SECRET_KEY обязателен в production")
    _SECRET = "dev-insecure-key-change-me"
    import warnings
    warnings.warn("AUTH_SECRET_KEY не задан — используется небезопасный dev-ключ", RuntimeWarning)
_SERIALIZER = URLSafeTimedSerializer(_SECRET, salt="foodtracker-auth")
_SESSION_DAYS = int(os.environ.get("AUTH_SESSION_DAYS", "14"))


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_session_token(user_id: int) -> str:
    return _SERIALIZER.dumps({"user_id": user_id})


def verify_session_token(token: str) -> Optional[int]:
    try:
        data = _SERIALIZER.loads(token, max_age=_SESSION_DAYS * 86400)
        return data.get("user_id")
    except (BadSignature, SignatureExpired):
        return None


def generate_csrf_token() -> str:
    return secrets.token_hex(32)
