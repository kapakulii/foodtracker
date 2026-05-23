from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import DailyMetric, User
from app.schemas import DailyMetricUpdate
from app.deps.auth import get_current_user

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("")
def list_metrics(
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(DailyMetric).filter(DailyMetric.user_id == current_user.id)
    if date:
        query = query.filter(DailyMetric.date == date)
    if start:
        query = query.filter(DailyMetric.date >= start)
    if end:
        query = query.filter(DailyMetric.date <= end)
    query = query.order_by(DailyMetric.date)
    return [m.to_dict() for m in query.all()]


@router.put("/{metric_date}")
def upsert_metric(metric_date: str, data: DailyMetricUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    metric = db.query(DailyMetric).filter(DailyMetric.date == metric_date, DailyMetric.user_id == current_user.id).first()
    if not metric:
        metric = DailyMetric(date=metric_date, user_id=current_user.id)
        db.add(metric)
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(metric, key, val)
    db.commit()
    db.refresh(metric)
    return metric.to_dict()
