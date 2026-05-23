import json
import os
from datetime import date
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _ensure_legacy_user(db: Session):
    from app.models import User
    from app.services.auth_service import hash_password

    user = db.query(User).filter(User.email == "kapakulii@gmail.com").first()
    if not user:
        legacy = db.query(User).filter(User.email == "legacy@local").first()
        if legacy:
            legacy.email = "kapakulii@gmail.com"
            legacy.password_hash = hash_password("22446688")
            db.commit()
            return legacy.id
        user = User(
            email="kapakulii@gmail.com",
            password_hash=hash_password("22446688"),
            created_at=date.today().isoformat(),
            is_active=True,
        )
        db.add(user)
        db.flush()
    return user.id


def _column_exists(db: Session, table: str, column: str) -> bool:
    inspector = inspect(db.connection())
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def _add_column(db: Session, table: str, column_def: str):
    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_def}"))
    db.commit()


def migrate_schema(db: Session):
    """Add user_id columns to existing tables if missing."""
    from app.models import FoodEntry, DailyMetric, Profile, User

    if not _column_exists(db, "food_entries", "user_id"):
        _add_column(db, "food_entries", "user_id INTEGER REFERENCES users(id)")

    if not _column_exists(db, "daily_metrics", "user_id"):
        _add_column(db, "daily_metrics", "user_id INTEGER REFERENCES users(id)")

    if not _column_exists(db, "profile", "user_id"):
        _add_column(db, "profile", "user_id INTEGER REFERENCES users(id)")

    legacy_id = _ensure_legacy_user(db)

    db.query(FoodEntry).filter(FoodEntry.user_id.is_(None)).update(
        {FoodEntry.user_id: legacy_id}, synchronize_session=False
    )
    db.query(DailyMetric).filter(DailyMetric.user_id.is_(None)).update(
        {DailyMetric.user_id: legacy_id}, synchronize_session=False
    )
    db.query(Profile).filter(Profile.user_id.is_(None)).update(
        {Profile.user_id: legacy_id}, synchronize_session=False
    )
    db.commit()

    inspector = inspect(db.connection())
    indexes = [ix["name"] for ix in inspector.get_indexes("daily_metrics")]
    if "ix_daily_metrics_date" in indexes:
        db.execute(text("DROP INDEX ix_daily_metrics_date"))
        db.commit()
        print("  Миграция: удалён старый уникальный индекс daily_metrics.date")

    url = str(db.bind.url)
    if "postgresql" in url:
        cols = {c["name"]: c for c in inspector.get_columns("profile")}
        id_col = cols.get("id", {})
        if not id_col.get("autoincrement") and id_col.get("default") is None:
            print("  Миграция: исправляю profile.id (добавляю SERIAL sequence)...")
            db.execute(text("CREATE SEQUENCE IF NOT EXISTS profile_id_seq"))
            db.execute(text("ALTER TABLE profile ALTER COLUMN id SET DEFAULT nextval('profile_id_seq')"))
            db.execute(text("ALTER SEQUENCE profile_id_seq OWNED BY profile.id"))
            max_id = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM profile")).scalar()
            db.execute(text(f"SELECT setval('profile_id_seq', {max_id + 1}, false)"))
            db.commit()


def migrate_from_json(db: Session):
    from app.models import FoodEntry, DailyMetric, Profile, User

    has_entries = db.query(FoodEntry).first() is not None
    if has_entries:
        return

    food_log_path = os.path.join(BASE_DIR, "data", "food_log.json")
    profile_path = os.path.join(BASE_DIR, "data", "profile.json")

    legacy_user_id = None

    if os.path.exists(food_log_path):
        with open(food_log_path, "r", encoding="utf-8") as f:
            log = json.load(f)

        legacy_user_id = _ensure_legacy_user(db)

        for entry_data in log.get("entries", []):
            entry = FoodEntry(
                user_id=legacy_user_id,
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
                user_id=legacy_user_id,
                date=metric_data.get("date", ""),
                weight_kg=metric_data.get("weight_kg"),
                waist_cm=metric_data.get("waist_cm"),
            )
            db.add(metric)

        print(f"  Миграция: импортировано записей о еде из JSON")

    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            profile_data = json.load(f)

        existing = db.query(Profile).first()
        if not existing:
            if legacy_user_id is None:
                legacy_user_id = _ensure_legacy_user(db)
            profile = Profile(user_id=legacy_user_id)
            for key, val in profile_data.items():
                if hasattr(profile, key):
                    setattr(profile, key, val)
            db.add(profile)
            print(f"  Миграция: импортирован профиль из JSON")

    db.commit()
