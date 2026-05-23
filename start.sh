#!/bin/bash
# ─────────────────────────────────────────────────
#  FoodTracker — запуск локального сервера
#  Использование: ./start.sh  или  bash start.sh
# ─────────────────────────────────────────────────

cd "$(dirname "$0")"

echo ""
echo "  🥗 FoodTracker"
echo "  ──────────────────────────────"

# Проверяем, не занят ли порт
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "  ✅ Сервер уже запущен"
  echo "  📊 Открываю: http://localhost:8080"
  open "http://localhost:8080"
  exit 0
fi

echo "  🚀 Запускаю сервер..."
echo "  📊 Дашборд: http://localhost:8080"
echo "  ⏹  Остановить: Ctrl+C"
echo ""

# Установка зависимостей при необходимости
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "  📦 Устанавливаю зависимости..."
  pip3 install -r requirements.txt -q
fi

python3 server.py
