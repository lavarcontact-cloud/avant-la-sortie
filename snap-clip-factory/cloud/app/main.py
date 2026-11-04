"""Point d'entrée : `uvicorn app.main:app` (lit la config SCF_* de l'environnement)."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .db import Database
from .deps import AppContext
from .events import EventBus
from .routers import agent, auth, dashboard, devices, uploads, videos
from .storage import LocalRelayStorage


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    database = Database(settings.database_url)
    database.create_all()  # MVP ; passer à Alembic avant la mise en production
    context = AppContext(settings=settings, db=database, storage=LocalRelayStorage(settings.relay_dir), bus=EventBus())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        context.bus.bind_loop(asyncio.get_running_loop())
        yield

    app = FastAPI(title="SNAP CLIP FACTORY — Cloud Control Plane", version="0.1.0", lifespan=lifespan)
    app.state.ctx = context
    if settings.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                           allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def security_headers(request, call_next):
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp

    @app.get("/healthz", include_in_schema=False)
    def healthz():
        return {"ok": True}

    for r in (auth, devices, videos, uploads, agent, dashboard):
        app.include_router(r.router)
    return app


def __getattr__(name):  # `app` construit à la demande pour ne pas lire l'env à l'import des tests
    if name == "app":
        global app
        app = create_app()
        return app
    raise AttributeError(name)
