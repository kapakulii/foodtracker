#!/usr/bin/env python3
"""
FoodTracker — FastAPI сервер с SQLite
Запуск: python3 server.py  или  ./start.sh
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# Load .env without external deps
dotenv_path = os.path.join(BASE_DIR, ".env")
if os.path.isfile(dotenv_path):
    with open(dotenv_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip()
            os.environ.setdefault(key, val)

from app.main import main

if __name__ == "__main__":
    main()
