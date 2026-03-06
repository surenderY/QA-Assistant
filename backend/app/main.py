from app.core.logging_config import setup_logging
setup_logging()                          # ← add these two lines at the top
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import auth, stories, testplans, scripts, executions, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist (dev convenience)
    # In production, rely on Alembic migrations instead.
    if settings.is_development:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="AI-powered test automation platform with multi-agent architecture",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router,        prefix=f"{API_PREFIX}/auth",       tags=["Auth"])
app.include_router(dashboard.router,   prefix=f"{API_PREFIX}/dashboard",  tags=["Dashboard"])
app.include_router(stories.router,     prefix=f"{API_PREFIX}/jira",       tags=["JIRA Stories"])
app.include_router(testplans.router,   prefix=f"{API_PREFIX}/testplan",   tags=["Test Plans"])
app.include_router(scripts.router,     prefix=f"{API_PREFIX}/scripts",    tags=["Test Scripts"])
app.include_router(executions.router,  prefix=f"{API_PREFIX}/execute",    tags=["Executions"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
