import json
import os
from typing import List
from app.schemas import AIChange

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")
AI_APPLY_MODE = os.environ.get("AI_APPLY_MODE", "partial")

_ALLOWED_KEYS = {
    "add_entry": {"date", "meal", "description", "weight_g", "calories", "protein", "fat",
                  "carbs", "fiber", "sugar", "sodium_mg", "saturated_fat"},
    "update_entry": {"id", "date", "meal", "description", "weight_g", "calories", "protein", "fat",
                     "carbs", "fiber", "sugar", "sodium_mg", "saturated_fat"},
    "delete_entry": {"id"},
    "update_profile": {"name", "goal", "sex", "activity_factor", "daily_calorie_target",
                       "protein_target_g", "fat_target_g", "carbs_target_g", "fiber_target_g",
                       "sugar_target_g", "sodium_target_mg", "saturated_fat_target_g",
                       "current_weight_kg", "target_weight_kg", "height_cm", "age"},
    "update_metric": {"date", "weight_kg", "waist_cm"},
}

_REQUIRED_KEYS = {
    "add_entry": {"date", "meal", "description"},
    "delete_entry": {"id"},
    "update_metric": {"date"},
}


def _filter_data(change: AIChange) -> dict:
    allowed = _ALLOWED_KEYS.get(change.type, set())
    return {k: v for k, v in change.data.items() if k in allowed}


def _validate_required(change: AIChange) -> str:
    required = _REQUIRED_KEYS.get(change.type, set())
    missing = required - set(change.data.keys())
    if missing:
        return f"{change.type}: missing required keys: {', '.join(sorted(missing))}"
    return ""


SYSTEM_PROMPT = """Ты — ассистент трекера питания FoodTracker. Твоя задача — парсить команды пользователя на естественном языке и возвращать структурированные JSON-изменения.

Текущая дата: {today}

Доступные операции:
- add_entry: добавить запись о еде. data: {{"date", "meal" (breakfast/lunch/dinner/snack), "description", "weight_g", "calories", "protein", "fat", "carbs", "fiber", "sugar", "sodium_mg", "saturated_fat"}}
- update_entry: изменить запись. data: {{"id", ...поля для обновления...}}
- delete_entry: удалить запись. data: {{"id"}}
- update_profile: обновить профиль. data: {{поля профиля}}
- update_metric: обновить дневные метрики (вес/талия). data: {{"date", "weight_kg"?, "waist_cm"?}}

Контекст (текущие данные пользователя):
{context}

Правила:
1. Всегда возвращай список changes. Если команда не распознана — changes: [] с explanation.
2. Для новых записей генерируй разумные нутриенты на основе описания, если пользователь их не указал.
3. Дата по умолчанию — сегодня, если не указана.
4. Описания изменений должны быть на русском, краткие, в форме предложения (начинаться с глагола "добавить", "изменить", "удалить" и т.д.).
5. Формат ответа: {{"changes": [{{"type": "...", "data": {{...}}, "description": "..."}}], "explanation": "..."}}
6. Никогда не изменяй БД напрямую. Только возвращай изменения.
7. Для add_entry ОБЯЗАТЕЛЬНО заполняй все поля: weight_g, calories, protein, fat, carbs, fiber, sugar, sodium_mg, saturated_fat. Если значение неизвестно — оцени на основе описания блюда. Никогда не пропускай поля sugar, sodium_mg, saturated_fat."""


def build_system_prompt(today: str, context: dict) -> str:
    return SYSTEM_PROMPT.format(today=today, context=json.dumps(context, ensure_ascii=False, indent=2))


def call_ai(user_message: str, system_prompt: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)

    response = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    text = response.choices[0].message.content
    return json.loads(text)


def parse_ai_changes(user_message: str, today: str, context: dict) -> dict:
    system_prompt = build_system_prompt(today, context)
    result = call_ai(user_message, system_prompt)
    changes_data = result.get("changes", [])
    changes = []
    auto_filled = set()
    for c in changes_data:
        if isinstance(c, dict) and "type" in c:
            if c.get("type") == "add_entry":
                data = c.get("data", {})
                for field in ("sugar", "sodium_mg", "saturated_fat"):
                    if field not in data or data[field] is None:
                        data[field] = 0
                        auto_filled.add(field)
                c["data"] = data
            changes.append(AIChange(**c))
    explanation = result.get("explanation", "")
    if auto_filled:
        hint = f" (поля {', '.join(sorted(auto_filled))} не были указаны, установлены в 0)"
        explanation += hint
    return {
        "changes": changes,
        "explanation": explanation,
    }


def apply_changes(changes: List[AIChange], db_session, user_id: int):
    from app.models import FoodEntry, DailyMetric, Profile, make_id

    applied = 0
    errors = []

    for change in changes:
        try:
            err = _validate_required(change)
            if err:
                errors.append(err)
                if AI_APPLY_MODE == "atomic":
                    break
                continue

            data = _filter_data(change)

            if change.type == "add_entry":
                data.pop("id", None)
                entry = FoodEntry(id=make_id(), **data)
                entry.user_id = user_id
                db_session.add(entry)
                applied += 1

            elif change.type == "update_entry":
                entry_id = data.get("id")
                if not entry_id:
                    errors.append("update_entry: missing id")
                    if AI_APPLY_MODE == "atomic":
                        break
                    continue
                entry = db_session.query(FoodEntry).filter(
                    FoodEntry.id == entry_id, FoodEntry.user_id == user_id
                ).first()
                if not entry:
                    errors.append(f"update_entry: entry {entry_id} not found")
                    if AI_APPLY_MODE == "atomic":
                        break
                    continue
                for key, val in data.items():
                    if key != "id":
                        setattr(entry, key, val)
                applied += 1

            elif change.type == "delete_entry":
                entry_id = data.get("id")
                entry = db_session.query(FoodEntry).filter(
                    FoodEntry.id == entry_id, FoodEntry.user_id == user_id
                ).first()
                if not entry:
                    errors.append(f"delete_entry: entry {entry_id} not found")
                    if AI_APPLY_MODE == "atomic":
                        break
                    continue
                db_session.delete(entry)
                applied += 1

            elif change.type == "update_profile":
                profile = db_session.query(Profile).filter(Profile.user_id == user_id).first()
                if not profile:
                    profile = Profile(user_id=user_id)
                    db_session.add(profile)
                for key, val in data.items():
                    if hasattr(profile, key):
                        setattr(profile, key, val)
                applied += 1

            elif change.type == "update_metric":
                metric_date = data.get("date")
                metric = db_session.query(DailyMetric).filter(
                    DailyMetric.date == metric_date, DailyMetric.user_id == user_id
                ).first()
                if not metric:
                    metric = DailyMetric(date=metric_date, user_id=user_id)
                    db_session.add(metric)
                for key, val in data.items():
                    if key != "date" and hasattr(metric, key):
                        setattr(metric, key, val)
                applied += 1

            else:
                errors.append(f"unknown change type: {change.type}")
                if AI_APPLY_MODE == "atomic":
                    break

        except Exception as e:
            errors.append(f"{change.type}: {str(e)}")
            if AI_APPLY_MODE == "atomic":
                break

    if AI_APPLY_MODE == "atomic" and errors:
        db_session.rollback()
        return {"applied": 0, "errors": errors}

    db_session.commit()
    return {"applied": applied, "errors": errors}
