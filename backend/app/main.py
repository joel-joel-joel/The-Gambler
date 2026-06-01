from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.database import init_db
from app.routers.calculate import router as calculate_router
from app.routers.chat import router as chat_router
from app.routers.pid import router as pid_router
from app.routers.rounds import router as rounds_router
from app.routers.sessions import router as sessions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="The Gambler API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calculate_router)
app.include_router(chat_router)
app.include_router(pid_router)
app.include_router(rounds_router)
app.include_router(sessions_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
