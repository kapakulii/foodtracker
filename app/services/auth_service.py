import os
from typing import Optional
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

_SECRET = os.environ.get("AUTH_SECRET_KEY", "dev-insecure-key-change-me")
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
