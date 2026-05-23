import json
import os
from typing import List
from app.schemas import AIChange

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")

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
4. Описания изменений должны быть на русском, краткие.
5. Формат ответа: {{"changes": [{{"type": "...", "data": {{...}}, "description": "..."}}], "explanation": "..."}}
6. Никогда не изменяй БД напрямую. Только возвращай изменения."""


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
    for c in changes_data:
        if isinstance(c, dict) and "type" in c:
            changes.append(AIChange(**c))
    return {
        "changes": changes,
        "explanation": result.get("explanation", ""),
    }


def apply_changes(changes: List[AIChange], db_session):
    from app.models import FoodEntry, DailyMetric, Profile

    applied = 0
    errors = []

    for change in changes:
        try:
            if change.type == "add_entry":
                from app.models import make_id
                data = change.data
                data.setdefault("id", make_id())
                entry = FoodEntry(**data)
                db_session.add(entry)
                applied += 1

            elif change.type == "update_entry":
                entry_id = change.data.get("id")
                if not entry_id:
                    errors.append("update_entry: missing id")
                    continue
                entry = db_session.query(FoodEntry).filter(FoodEntry.id == entry_id).first()
                if not entry:
                    errors.append(f"update_entry: entry {entry_id} not found")
                    continue
                for key, val in change.data.items():
                    if key != "id":
                        setattr(entry, key, val)
                applied += 1

            elif change.type == "delete_entry":
                entry_id = change.data.get("id")
                if not entry_id:
                    errors.append("delete_entry: missing id")
                    continue
                entry = db_session.query(FoodEntry).filter(FoodEntry.id == entry_id).first()
                if not entry:
                    errors.append(f"delete_entry: entry {entry_id} not found")
                    continue
                db_session.delete(entry)
                applied += 1

            elif change.type == "update_profile":
                profile = db_session.query(Profile).filter(Profile.id == 1).first()
                if not profile:
                    profile = Profile(id=1)
                    db_session.add(profile)
                for key, val in change.data.items():
                    if hasattr(profile, key):
                        setattr(profile, key, val)
                applied += 1

            elif change.type == "update_metric":
                date = change.data.get("date")
                if not date:
                    errors.append("update_metric: missing date")
                    continue
                metric = db_session.query(DailyMetric).filter(DailyMetric.date == date).first()
                if not metric:
                    metric = DailyMetric(date=date)
                    db_session.add(metric)
                for key, val in change.data.items():
                    if key != "date" and hasattr(metric, key):
                        setattr(metric, key, val)
                applied += 1

            else:
                errors.append(f"unknown change type: {change.type}")

        except Exception as e:
            errors.append(f"{change.type}: {str(e)}")

    db_session.commit()
    return {"applied": applied, "errors": errors}
