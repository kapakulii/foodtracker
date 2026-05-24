from datetime import date
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FoodEntry, DailyMetric, User
from app.routes.profile import get_or_create_profile
from app.schemas import AIRequest, AIApplyRequest, AIApplyResponse
from app.services.ai_service import parse_ai_changes, apply_changes
from app.deps.auth import get_current_user, csrf_protected

router = APIRouter(prefix="/api/ai", tags=["ai"])


def build_context(db: Session, user_id: int) -> dict:
    entries = [
        e.to_dict()
        for e in db.query(FoodEntry)
        .filter(FoodEntry.user_id == user_id)
        .order_by(FoodEntry.date.desc())
        .limit(30)
        .all()
    ]
    metrics = [
        m.to_dict()
        for m in db.query(DailyMetric)
        .filter(DailyMetric.user_id == user_id)
        .order_by(DailyMetric.date.desc())
        .limit(30)
        .all()
    ]
    profile = get_or_create_profile(db, user_id).to_dict()
    return {
        "profile": profile,
        "recent_entries": entries,
        "recent_metrics": metrics,
    }


@router.post("/parse")
def ai_parse(req: AIRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(400, "AI не настроен: укажите OPENAI_API_KEY в переменных окружения.")
    today = date.today().isoformat()
    context = build_context(db, current_user.id)
    try:
        result = parse_ai_changes(req.message, today, context)
        return result
    except Exception as e:
        raise HTTPException(500, f"Ошибка AI: {str(e)}")


@router.post("/apply", response_model=AIApplyResponse)
def ai_apply(req: AIApplyRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    if not req.changes:
        raise HTTPException(400, "No changes to apply")
    result = apply_changes(req.changes, db, current_user.id)
    return AIApplyResponse(**result)
