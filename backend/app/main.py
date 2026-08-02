from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import settings
from .constants import DEFAULT_USER_EMAIL, DEFAULT_USER_ID
from .database import AsyncSessionLocal, engine
from .models import Base, User
from .routers import tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == DEFAULT_USER_ID))
        if result.scalar_one_or_none() is None:
            db.add(User(id=DEFAULT_USER_ID, email=DEFAULT_USER_EMAIL, password_hash="unset"))
            await db.commit()

    yield


app = FastAPI(title="Task Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
