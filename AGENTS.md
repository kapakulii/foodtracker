# FoodTracker

Локальный дашборд для отслеживания питания и веса. FastAPI + SQLite + vanilla JS SPA.

## Запуск

```bash
pip install -r requirements.txt
python3 server.py        # порт 8080, автооткрытие браузера
./start.sh                # обёртка с автоустановкой зависимостей
```

Docker:
```bash
OPENAI_API_KEY=sk-... docker compose up
```

macOS: двойной клик по `▶ Запустить FoodTracker.command`.

## Данные

- `data/foodtracker.db` — SQLite (создаётся автоматически из JSON при первом запуске)
- `data/food_log.json` / `data/profile.json` — исходные JSON, мигрируются в SQLite при первом старте

## API (FastAPI)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/summary` | Все записи + метрики + профиль |
| GET | `/api/entries?date=&start=&end=` | Список записей |
| POST | `/api/entries` | Создать запись |
| PUT | `/api/entries/{id}` | Обновить запись |
| DELETE | `/api/entries/{id}` | Удалить запись |
| GET | `/api/profile` | Профиль пользователя |
| PUT | `/api/profile` | Обновить профиль |
| GET | `/api/metrics?date=&start=&end=` | Дневные метрики |
| PUT | `/api/metrics/{date}` | Обновить метрику (upsert) |
| POST | `/api/ai/parse` | AI парсинг команды → изменения |
| POST | `/api/ai/apply` | Применить подтверждённые AI-изменения |

## Модели данных

**FoodEntry**: `id`, `date`, `meal` (breakfast/lunch/dinner/snack), `description`, `weight_g`, `calories`, `protein`, `fat`, `carbs`, `fiber`, `sugar`, `sodium_mg`, `saturated_fat`

**DailyMetric**: `date` (unique), `weight_kg`, `waist_cm`

**Profile**: name, goals, КБЖУ targets, weight/height/age, activity_factor

## AI Flow (важно)

AI **НЕ ДОЛЖЕН** напрямую изменять БД. Полный цикл:

1. Пользователь пишет команду → `POST /api/ai/parse`
2. Сервер отправляет её в OpenAI-compatible API
3. AI возвращает `{"changes": [...], "explanation": "..."}`
4. UI показывает изменения пользователю
5. Пользователь нажимает **ПРИМЕНИТЬ**
6. `POST /api/ai/apply` — сервер применяет изменения в БД

Настройки AI через переменные окружения:
- `OPENAI_API_KEY` — ключ API
- `OPENAI_BASE_URL` — базовый URL (для совместимых API)
- `AI_MODEL` — модель (по умолч. gpt-4o-mini)

## Сборка / тесты / CI

Нет пакетного менеджера, линтера, тестов и CI. Прокси `/data/` для обратной совместимости.

## Архитектура

- `app/main.py` — FastAPI + статика + точка входа
- `app/database.py` — SQLAlchemy + SQLite
- `app/models.py` — ORM-модели
- `app/schemas.py` — Pydantic-схемы
- `app/routes/` — эндпоинты (entries, profile, metrics, summary, ai)
- `app/services/ai_service.py` — интеграция с OpenAI-compatible API
- `app/migrate.py` — импорт JSON → SQLite при первом запуске
- `index.html` — SPA на ванильном JS, вся логика рендеринга в браузере
- Терминальная эстетика, русский интерфейс
