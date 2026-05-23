from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FoodEntry, DailyMetric, User
from app.routes.profile import get_or_create_profile
from app.deps.auth import get_current_user

router = APIRouter(tags=["summary"])


@router.get("/api/summary")
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entries = [
        e.to_dict()
        for e in db.query(FoodEntry)
        .filter(FoodEntry.user_id == current_user.id)
        .order_by(FoodEntry.date, FoodEntry.id)
        .all()
    ]
    metrics = [
        m.to_dict()
        for m in db.query(DailyMetric)
        .filter(DailyMetric.user_id == current_user.id)
        .order_by(DailyMetric.date)
        .all()
    ]
    profile = get_or_create_profile(db, current_user.id).to_dict()
    return {
        "entries": entries,
        "daily_metrics": metrics,
        "profile": profile,
    }
