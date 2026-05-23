from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List


class AuthRegisterRequest(BaseModel):
    email: str
    password: str


class AuthLoginRequest(BaseModel):
    email: str
    password: str


class AuthUserResponse(BaseModel):
    id: int
    email: str
    created_at: str
    is_active: bool


class FoodEntryCreate(BaseModel):
    date: str
    meal: str
    description: str
    weight_g: float = 0
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    sugar: float = 0
    sodium_mg: float = 0
    saturated_fat: float = 0


class FoodEntryUpdate(BaseModel):
    date: Optional[str] = None
    meal: Optional[str] = None
    description: Optional[str] = None
    weight_g: Optional[float] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    fat: Optional[float] = None
    carbs: Optional[float] = None
    fiber: Optional[float] = None
    sugar: Optional[float] = None
    sodium_mg: Optional[float] = None
    saturated_fat: Optional[float] = None


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
    weight_kg: Optional[float] = None
    waist_cm: Optional[float] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    sex: Optional[str] = None
    activity_factor: Optional[float] = None
    daily_calorie_target: Optional[int] = None
    protein_target_g: Optional[int] = None
    fat_target_g: Optional[int] = None
    carbs_target_g: Optional[int] = None
    fiber_target_g: Optional[int] = None
    sugar_target_g: Optional[int] = None
    sodium_target_mg: Optional[int] = None
    saturated_fat_target_g: Optional[int] = None
    current_weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    height_cm: Optional[int] = None
    age: Optional[int] = None


class AIRequest(BaseModel):
    message: str


class AIChange(BaseModel):
    type: str = Field(..., description="add_entry / update_entry / delete_entry / update_profile / update_metric")
    data: dict = Field(default_factory=dict)
    description: str = ""


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
