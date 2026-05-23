#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  🥗 FoodTracker"
echo "  ────────────────────────────"

# Проверяем, не занят ли порт
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "  ✅ Сервер уже работает"
  open "http://localhost:8080"
  exit 0
fi

echo "  🚀 Запускаю сервер..."
echo "  📊 http://localhost:8080"
echo "  ⏹  Остановить: закрой это окно (Ctrl+C)"
echo ""

# Открыть браузер через секунду
(sleep 1.2 && open "http://localhost:8080") &

# Установка зависимостей при необходимости
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "  📦 Устанавливаю зависимости..."
  pip3 install -r requirements.txt -q
fi

python3 server.py
