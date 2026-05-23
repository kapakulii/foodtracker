from datetime import date
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FoodEntry, DailyMetric
from app.routes.profile import get_or_create_profile
from app.schemas import AIRequest, AIApplyRequest, AIApplyResponse
from app.services.ai_service import parse_ai_changes, apply_changes

router = APIRouter(prefix="/api/ai", tags=["ai"])


def build_context(db: Session) -> dict:
    entries = [e.to_dict() for e in db.query(FoodEntry).order_by(FoodEntry.date.desc()).limit(30).all()]
    metrics = [m.to_dict() for m in db.query(DailyMetric).order_by(DailyMetric.date.desc()).limit(30).all()]
    profile = get_or_create_profile(db).to_dict()
    return {
        "profile": profile,
        "recent_entries": entries,
        "recent_metrics": metrics,
    }


@router.post("/parse")
def ai_parse(req: AIRequest, db: Session = Depends(get_db)):
    if not os.environ.get("OPENAI_API_KEY"):
        return {"changes": [], "explanation": "AI не настроен: укажите OPENAI_API_KEY в переменных окружения."}
    today = date.today().isoformat()
    context = build_context(db)
    try:
        result = parse_ai_changes(req.message, today, context)
        return result
    except Exception as e:
        return {"changes": [], "explanation": f"Ошибка AI: {str(e)}"}


@router.post("/apply", response_model=AIApplyResponse)
def ai_apply(req: AIApplyRequest, db: Session = Depends(get_db)):
    if not req.changes:
        raise HTTPException(400, "No changes to apply")
    result = apply_changes(req.changes, db)
    return AIApplyResponse(**result)
