"""Open Heart (לבבות פתוחים) - FastAPI backend.

Serves game content from questions.json (or its admin-edited copy in data/) and, in production, the built
frontend (frontend/dist) as a single-page app.

Local:  python App.py            builds the frontend if needed, serves everything on http://localhost:8000
PM2:    pm2 start ecosystem.config.js
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent


def load_env_file(path: Path) -> None:
    """backend/.env (gitignored, server-only secrets such as ADMIN_PASSWORD_HASH). Real env vars win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and key and not key.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_env_file(BASE_DIR / ".env")  # before the imports below read their settings

from admin import ensure_admin, router as admin_router  # noqa: E402
from auth import COOKIE_SECURE, backfill_name_lookups, purge_expired, router as auth_router  # noqa: E402
from cards import content as load_content, content_file, repo_newer, router as cards_router  # noqa: E402
from db import closing_conn, init_db  # noqa: E402
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with closing_conn() as conn:
        purge_expired(conn)
        backfill_name_lookups(conn)
        ensure_admin(conn)
    if repo_newer():
        print(f"! backend/questions.json is newer than the admin-edited {content_file()}; the edited copy is served")
    yield


app = FastAPI(title="Open Heart API", version="1.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(admin_router)

# Strict CSP for the SPA: own scripts only, Google Fonts, inline style attributes (Framer Motion).
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; "
    "worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    res = await call_next(request)
    h = res.headers
    h["X-Content-Type-Options"] = "nosniff"
    h["Referrer-Policy"] = "strict-origin-when-cross-origin"
    h["X-Frame-Options"] = "DENY"
    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    h["Cross-Origin-Opener-Policy"] = "same-origin"
    if COOKIE_SECURE:
        h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith(("/api/auth", "/api/cards", "/api/admin")):
        h["Cache-Control"] = "no-store"  # personal data never lands in browser/proxy caches
    elif h.get("content-type", "").startswith("text/html"):
        h["Content-Security-Policy"] = CSP
    return res


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


def build_frontend_if_stale() -> None:
    """One-command local run: (re)build frontend/dist when the React sources are newer than the last build."""
    import shutil
    import subprocess

    frontend = BASE_DIR.parent / "frontend"
    npm = shutil.which("npm")
    if not npm:
        print("! npm not found (install Node 20+); serving the existing build, if any.")
        return
    built = DIST_DIR / "index.html"
    sources = [frontend / "index.html", frontend / "vite.config.js", *(frontend / "src").rglob("*"), *(frontend / "public").rglob("*")]
    newest = max((p.stat().st_mtime for p in sources if p.is_file()), default=0)
    if built.exists() and built.stat().st_mtime >= newest:
        return
    if not (frontend / "node_modules").exists():
        print("> npm install")
        subprocess.run([npm, "install"], cwd=frontend, check=True)
    print("> npm run build")
    subprocess.run([npm, "run", "build"], cwd=frontend, check=True)


def port_busy(port: int) -> bool:
    import socket

    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


if __name__ == "__main__":
    import threading
    import webbrowser

    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    under_pm2 = "pm_id" in os.environ
    if port_busy(port):
        raise SystemExit(f"! Port {port} is already in use - an older server is probably still running. Stop it and retry.")
    if os.getenv("AUTO_BUILD", "0" if under_pm2 else "1") == "1":
        build_frontend_if_stale()
    url = f"http://localhost:{port}"
    print(f"\n  Open Heart -> {url}\n")
    if not under_pm2 and os.getenv("OPEN_BROWSER", "1") == "1":
        threading.Timer(1.5, webbrowser.open, [url]).start()

    uvicorn.run(
        "App:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=port,
        reload=os.getenv("RELOAD", "0") == "1",
    )
