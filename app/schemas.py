from pydantic import BaseModel, Field
from typing import Optional, List, Literal

_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
_MEAL_TYPES = Literal["breakfast", "lunch", "dinner", "snack"]


class AuthRegisterRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthLoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class AuthUserResponse(BaseModel):
    id: int
    email: str
    created_at: str
    is_active: bool


class FoodEntryCreate(BaseModel):
    date: str = Field(pattern=_DATE_PATTERN)
    meal: _MEAL_TYPES
    description: str = Field(max_length=500)
    weight_g: float = Field(default=0, ge=0)
    calories: float = Field(default=0, ge=0)
    protein: float = Field(default=0, ge=0)
    fat: float = Field(default=0, ge=0)
    carbs: float = Field(default=0, ge=0)
    fiber: float = Field(default=0, ge=0)
    sugar: float = Field(default=0, ge=0)
    sodium_mg: float = Field(default=0, ge=0)
    saturated_fat: float = Field(default=0, ge=0)


class FoodEntryUpdate(BaseModel):
    date: Optional[str] = Field(None, pattern=_DATE_PATTERN)
    meal: Optional[_MEAL_TYPES] = None
    description: Optional[str] = Field(None, max_length=500)
    weight_g: Optional[float] = Field(None, ge=0)
    calories: Optional[float] = Field(None, ge=0)
    protein: Optional[float] = Field(None, ge=0)
    fat: Optional[float] = Field(None, ge=0)
    carbs: Optional[float] = Field(None, ge=0)
    fiber: Optional[float] = Field(None, ge=0)
    sugar: Optional[float] = Field(None, ge=0)
    sodium_mg: Optional[float] = Field(None, ge=0)
    saturated_fat: Optional[float] = Field(None, ge=0)


class FoodEntryResponse(BaseModel):
    id: str
    date: str
    meal: str
    description: str
    weight_g: float
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    sugar: float
    sodium_mg: float
    saturated_fat: float


class DailyMetricUpdate(BaseModel):
    weight_kg: Optional[float] = Field(None, ge=0)
    waist_cm: Optional[float] = Field(None, ge=0)


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    goal: Optional[str] = Field(None, max_length=50)
    sex: Optional[str] = Field(None, pattern=r"^(male|female)$")
    activity_factor: Optional[float] = Field(None, ge=1.0, le=2.5)
    daily_calorie_target: Optional[int] = Field(None, ge=0)
    protein_target_g: Optional[int] = Field(None, ge=0)
    fat_target_g: Optional[int] = Field(None, ge=0)
    carbs_target_g: Optional[int] = Field(None, ge=0)
    fiber_target_g: Optional[int] = Field(None, ge=0)
    sugar_target_g: Optional[int] = Field(None, ge=0)
    sodium_target_mg: Optional[int] = Field(None, ge=0)
    saturated_fat_target_g: Optional[int] = Field(None, ge=0)
    current_weight_kg: Optional[float] = Field(None, ge=0)
    target_weight_kg: Optional[float] = Field(None, ge=0)
    height_cm: Optional[int] = Field(None, ge=50, le=300)
    age: Optional[int] = Field(None, ge=0, le=150)


class AIRequest(BaseModel):
    message: str = Field(max_length=2000)


class AIChange(BaseModel):
    type: Literal["add_entry", "update_entry", "delete_entry", "update_profile", "update_metric"]
    data: dict = Field(default_factory=dict)
    description: str = Field(default="", max_length=500)


class AIResponse(BaseModel):
    changes: List[AIChange] = Field(default_factory=list)
    explanation: str = ""


class AIApplyRequest(BaseModel):
    changes: List[AIChange]


class AIApplyResponse(BaseModel):
    applied: int
    errors: List[str] = Field(default_factory=list)


class SummaryResponse(BaseModel):
    entries: List[FoodEntryResponse]
    daily_metrics: List[dict]
    profile: dict
