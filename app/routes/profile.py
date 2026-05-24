from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile, User
from app.schemas import ProfileUpdate
from app.deps.auth import get_current_user, csrf_protected

router = APIRouter(prefix="/api/profile", tags=["profile"])


def get_or_create_profile(db: Session, user_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("")
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_or_create_profile(db, current_user.id).to_dict()


@router.put("")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    profile = get_or_create_profile(db, current_user.id)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    return profile.to_dict()
