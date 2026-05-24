import uuid
from datetime import date
from sqlalchemy import Column, String, Float, Integer, Text, ForeignKey, Boolean, UniqueConstraint
from app.database import Base


def make_id():
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(String, nullable=False, default=date.today().isoformat)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at,
            "is_active": self.is_active,
        }


class FoodEntry(Base):
    __tablename__ = "food_entries"

    id = Column(String, primary_key=True, default=make_id)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String, nullable=False, index=True)
    meal = Column(String, nullable=False)
    description = Column(String, nullable=False)
    weight_g = Column(Float, default=0)
    calories = Column(Float, default=0)
    protein = Column(Float, default=0)
    fat = Column(Float, default=0)
    carbs = Column(Float, default=0)
    fiber = Column(Float, default=0)
    sugar = Column(Float, default=0)
    sodium_mg = Column(Float, default=0)
    saturated_fat = Column(Float, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "date": self.date,
            "meal": self.meal,
            "description": self.description,
            "weight_g": self.weight_g,
            "calories": self.calories,
            "protein": self.protein,
            "fat": self.fat,
            "carbs": self.carbs,
            "fiber": self.fiber,
            "sugar": self.sugar,
            "sodium_mg": self.sodium_mg,
            "saturated_fat": self.saturated_fat,
        }


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uix_user_metric_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String, nullable=False, index=True)
    weight_kg = Column(Float, nullable=True)
    waist_cm = Column(Float, nullable=True)

    def to_dict(self):
        d = {"date": self.date, "user_id": self.user_id}
        if self.weight_kg is not None:
            d["weight_kg"] = self.weight_kg
        if self.waist_cm is not None:
            d["waist_cm"] = self.waist_cm
        return d


class Profile(Base):
    __tablename__ = "profile"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    name = Column(String, default="")
    goal = Column(String, default="weight_loss")
    sex = Column(String, default="male")
    activity_factor = Column(Float, default=1.35)
    daily_calorie_target = Column(Integer, default=2200)
    protein_target_g = Column(Integer, default=140)
    fat_target_g = Column(Integer, default=73)
    carbs_target_g = Column(Integer, default=220)
    fiber_target_g = Column(Integer, default=25)
    sugar_target_g = Column(Integer, default=50)
    sodium_target_mg = Column(Integer, default=2300)
    saturated_fat_target_g = Column(Integer, default=20)
    current_weight_kg = Column(Float, default=79)
    target_weight_kg = Column(Float, default=72)
    height_cm = Column(Integer, default=172)
    age = Column(Integer, default=34)
    created_at = Column(String, default="")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "name": self.name,
            "goal": self.goal,
            "sex": self.sex,
            "activity_factor": self.activity_factor,
            "daily_calorie_target": self.daily_calorie_target,
            "protein_target_g": self.protein_target_g,
            "fat_target_g": self.fat_target_g,
            "carbs_target_g": self.carbs_target_g,
            "fiber_target_g": self.fiber_target_g,
            "sugar_target_g": self.sugar_target_g,
            "sodium_target_mg": self.sodium_target_mg,
            "saturated_fat_target_g": self.saturated_fat_target_g,
            "current_weight_kg": self.current_weight_kg,
            "target_weight_kg": self.target_weight_kg,
            "height_cm": self.height_cm,
            "age": self.age,
            "created_at": self.created_at,
        }
