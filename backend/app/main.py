"""AES Studio API — local pedagogical engine, no external crypto service."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router

NOTICE = (
    "AES Studio exécute un AES-128 écrit à la main pour l'enseignement. "
    "Ce n'est pas une implémentation de production."
)

app = FastAPI(
    title="AES Studio",
    description=NOTICE,
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

_cors = os.environ.get("AES_STUDIO_CORS_ORIGINS", "*").strip()
origins = (
    ["*"]
    if _cors == "*"
    else [origin.strip() for origin in _cors.split(",") if origin.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router, prefix="/api")


def _static_dir() -> Path | None:
    here = Path(__file__).resolve()
    candidates = (
        here.parent / "static",
        here.parents[2] / "frontend" / "dist",
    )
    for path in candidates:
        if (path / "index.html").is_file():
            return path
    return None


STATIC = _static_dir()
if STATIC is not None:
    assets = STATIC / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        root = STATIC.resolve()
        target = (STATIC / full_path).resolve()
        if full_path and target.is_file() and str(target).startswith(str(root)):
            return FileResponse(target)
        return FileResponse(STATIC / "index.html")
else:

    @app.get("/")
    def root() -> dict[str, str]:
        return {"name": "AES Studio", "docs": "/api/docs", "notice": NOTICE}
