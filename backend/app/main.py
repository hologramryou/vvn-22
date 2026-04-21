import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import auth, students, dev, users
from app.routers import tournaments as tournaments_router
from app.routers import clubs as clubs_router
from app.routers import team_kata_registrations as team_kata_registrations_router
from app.routers import tournament_structure as tournament_structure_router
from app.core.config import settings
from app.core.redis_client import get_redis, close_redis

# ensure all models are imported so Alembic / SQLAlchemy can discover them
import app.models  # noqa: F401


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_redis()  # warm connection pool
    yield
    await close_redis()


app = FastAPI(title="Vovinam Fighting API", version="1.0.0", lifespan=lifespan)

# CORS phải add TRƯỚC khi mount static files
# Middleware được apply theo thứ tự ngược lại (LIFO), nên add_middleware trước mount
_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount sau CORS middleware — static files sẽ được wrap bởi CORS
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(tournaments_router.router)
app.include_router(clubs_router.router)
app.include_router(tournament_structure_router.router, prefix="/api")
app.include_router(team_kata_registrations_router.router)
app.include_router(dev.router)

# Sync router — for api-local use only (pull data from Railway, push results back)
if settings.railway_database_url:
    from app.routers import sync as sync_router
    app.include_router(sync_router.router)

@app.get("/")
async def root():
    return {"message": "Vovinam Fighting API", "docs": "/docs"}
