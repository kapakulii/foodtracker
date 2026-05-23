from typing import Optional
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.services.auth_service import verify_session_token


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
