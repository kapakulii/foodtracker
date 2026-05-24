from typing import Optional
from fastapi import Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.services.auth_service import verify_session_token, generate_csrf_token


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Cookie(None, alias="foodtracker_session"),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_session_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def csrf_protected(
    request: Request,
    response: Response,
    token: Optional[str] = Cookie(None, alias="csrf_token"),
):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    # Migration: если csrf_token ещё нет, создаём и пропускаем запрос
    if not token:
        token = generate_csrf_token()
        response.set_cookie(
            key="csrf_token",
            value=token,
            max_age=14 * 86400,
            httponly=False,
            samesite="strict",
            path="/",
        )
        return
    header_token = request.headers.get("X-CSRF-Token")
    if not header_token or token != header_token:
        raise HTTPException(403, "Invalid or missing CSRF token")
