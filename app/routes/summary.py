from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FoodEntry, DailyMetric
from app.routes.profile import get_or_create_profile

router = APIRouter(tags=["summary"])


@router.get("/api/summary")
def get_summary(db: Session = Depends(get_db)):
    entries = [e.to_dict() for e in db.query(FoodEntry).order_by(FoodEntry.date, FoodEntry.id).all()]
    metrics = [m.to_dict() for m in db.query(DailyMetric).order_by(DailyMetric.date).all()]
    profile = get_or_create_profile(db).to_dict()
    return {
        "entries": entries,
        "daily_metrics": metrics,
        "profile": profile,
    }
