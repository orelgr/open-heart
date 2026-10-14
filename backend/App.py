"""Open Heart (לבבות פתוחים) - FastAPI backend.

Serves game content from questions.json and, in production, the built
frontend (frontend/dist) as a single-page app.

Local:  python App.py            (http://127.0.0.1:8000)
PM2:    pm2 start ecosystem.config.js
"""
import json
import os
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "questions.json"
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

app = FastAPI(title="Open Heart API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def load_content() -> dict:
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/content")
def content():
    """Everything the client needs in one round-trip (fast navigation)."""
    return load_content()


@app.get("/api/categories")
def categories():
    return [{k: v for k, v in c.items() if k != "questions"} for c in load_content()["categories"]]


@app.get("/api/categories/{category_id}")
def category(category_id: str):
    for c in load_content()["categories"]:
        if c["id"] == category_id:
            return c
    raise HTTPException(status_code=404, detail="Category not found")


@app.get("/api/power-cards")
def power_cards():
    return load_content()["powerCards"]


@app.get("/api/rules")
def rules():
    return load_content()["rules"]


# Production: serve the built SPA from the same origin.
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        target = (DIST_DIR / full_path).resolve()
        if full_path and target.is_relative_to(DIST_DIR.resolve()) and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "App:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "0") == "1",
    )
