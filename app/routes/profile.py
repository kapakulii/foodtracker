from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Profile
from app.schemas import ProfileUpdate

router = APIRouter(prefix="/api/profile", tags=["profile"])


def get_or_create_profile(db: Session) -> Profile:
    profile = db.query(Profile).filter(Profile.id == 1).first()
    if not profile:
        profile = Profile(id=1)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("")
def get_profile(db: Session = Depends(get_db)):
    return get_or_create_profile(db).to_dict()


@router.put("")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    return profile.to_dict()
