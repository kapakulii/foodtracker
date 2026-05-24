from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import FoodEntry, User
from app.schemas import FoodEntryCreate, FoodEntryUpdate
from app.deps.auth import get_current_user, csrf_protected

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.get("")
def list_entries(
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FoodEntry).filter(FoodEntry.user_id == current_user.id)
    if date:
        query = query.filter(FoodEntry.date == date)
    if start:
        query = query.filter(FoodEntry.date >= start)
    if end:
        query = query.filter(FoodEntry.date <= end)
    query = query.order_by(FoodEntry.date, FoodEntry.id)
    return [e.to_dict() for e in query.all()]


@router.get("/{entry_id}")
def get_entry(entry_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id, FoodEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    return entry.to_dict()


@router.post("", status_code=201)
def create_entry(data: FoodEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    entry = FoodEntry(**data.model_dump(), user_id=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry.to_dict()


@router.put("/{entry_id}")
def update_entry(entry_id: str, data: FoodEntryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id, FoodEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, val)
    db.commit()
    db.refresh(entry)
    return entry.to_dict()


@router.delete("/{entry_id}")
def delete_entry(entry_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), _=Depends(csrf_protected)):
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id, FoodEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
