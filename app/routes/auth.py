import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Profile
from app.schemas import AuthRegisterRequest, AuthLoginRequest, AuthUserResponse
from app.services.auth_service import hash_password, verify_password, create_session_token, generate_csrf_token
from app.deps.auth import get_current_user, csrf_protected

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "foodtracker_session"
CSRF_COOKIE_NAME = "csrf_token"
SESSION_DAYS = 14
_COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "").lower() in ("1", "true", "yes")


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="strict",
        path="/",
    )


def _set_csrf_cookie(response: Response):
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=generate_csrf_token(),
        max_age=SESSION_DAYS * 86400,
        httponly=False,
        secure=_COOKIE_SECURE,
        samesite="strict",
        path="/",
    )


def _clear_csrf_cookie(response: Response):
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")


@router.post("/register", response_model=AuthUserResponse)
def register(req: AuthRegisterRequest, response: Response, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    password = req.password

    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        created_at=date.today().isoformat(),
        is_active=True,
    )
    db.add(user)
    db.flush()

    profile = Profile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_session_token(user.id)
    _set_session_cookie(response, token)
    _set_csrf_cookie(response)

    return AuthUserResponse(id=user.id, email=user.email, created_at=user.created_at, is_active=user.is_active)


@router.post("/login", response_model=AuthUserResponse)
def login(req: AuthLoginRequest, response: Response, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    token = create_session_token(user.id)
    _set_session_cookie(response, token)
    _set_csrf_cookie(response)

    return AuthUserResponse(id=user.id, email=user.email, created_at=user.created_at, is_active=user.is_active)


@router.post("/logout")
def logout(response: Response, _=Depends(csrf_protected)):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    _clear_csrf_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=AuthUserResponse)
def me(current_user: User = Depends(get_current_user)):
    return AuthUserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
        is_active=current_user.is_active,
    )
