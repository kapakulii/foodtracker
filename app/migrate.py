import json
import os
from sqlalchemy.orm import Session

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def migrate_from_json(db: Session):
    from app.models import FoodEntry, DailyMetric, Profile

    has_entries = db.query(FoodEntry).first() is not None
    if has_entries:
        return

    food_log_path = os.path.join(BASE_DIR, "data", "food_log.json")
    profile_path = os.path.join(BASE_DIR, "data", "profile.json")

    if os.path.exists(food_log_path):
        with open(food_log_path, "r", encoding="utf-8") as f:
            log = json.load(f)

        for entry_data in log.get("entries", []):
            entry = FoodEntry(
                id=entry_data.get("id", ""),
                date=entry_data.get("date", ""),
                meal=entry_data.get("meal", ""),
                description=entry_data.get("description", ""),
                weight_g=entry_data.get("weight_g", 0),
                calories=entry_data.get("calories", 0),
                protein=entry_data.get("protein", 0),
                fat=entry_data.get("fat", 0),
                carbs=entry_data.get("carbs", 0),
                fiber=entry_data.get("fiber", 0),
                sugar=entry_data.get("sugar", 0),
                sodium_mg=entry_data.get("sodium_mg", 0),
                saturated_fat=entry_data.get("saturated_fat", 0),
            )
            db.add(entry)

        for metric_data in log.get("daily_metrics", []):
            metric = DailyMetric(
                date=metric_data.get("date", ""),
                weight_kg=metric_data.get("weight_kg"),
                waist_cm=metric_data.get("waist_cm"),
            )
            db.add(metric)

        print(f"  Миграция: импортировано записей о еде из JSON")

    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            profile_data = json.load(f)

        existing = db.query(Profile).filter(Profile.id == 1).first()
        if not existing:
            profile = Profile(id=1)
            for key, val in profile_data.items():
                if hasattr(profile, key):
                    setattr(profile, key, val)
            db.add(profile)
            print(f"  Миграция: импортирован профиль из JSON")

    db.commit()
