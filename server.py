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

from app.main import main

if __name__ == "__main__":
    main()
