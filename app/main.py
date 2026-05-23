import os
import sys
import threading
import webbrowser
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app.database import engine, Base, SessionLocal
from app.models import FoodEntry, DailyMetric, Profile, User
from app.routes import entries, profile, metrics, summary, ai, auth
from app.migrate import migrate_from_json, migrate_schema

app = FastAPI(title="FoodTracker")

cors_origins = os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:8080").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(profile.router)
app.include_router(metrics.router)
app.include_router(summary.router)
app.include_router(ai.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        migrate_schema(db)
        migrate_from_json(db)
    finally:
        db.close()


STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

index_src = os.path.join(BASE_DIR, "index.html")
index_dst = os.path.join(STATIC_DIR, "index.html")
if os.path.exists(index_src) and os.path.abspath(index_src) != os.path.abspath(index_dst):
    import shutil
    shutil.copy2(index_src, index_dst)

app.mount("/data", StaticFiles(directory=os.path.join(BASE_DIR, "data")), name="data")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


def open_browser():
    import time
    time.sleep(1.2)
    webbrowser.open("http://localhost:8080")


def main():
    import uvicorn

    print()
    print("  🥗 FoodTracker запускается...")
    print("  📊 Дашборд: http://localhost:8080")
    print("  ⏹  Остановить: Ctrl+C")
    print()

    t = threading.Thread(target=open_browser, daemon=True)
    t.start()

    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
