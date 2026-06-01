from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.calculate import router as calculate_router
from app.routers.chat import router as chat_router
from app.routers.pid import router as pid_router

app = FastAPI(title="The Gambler API", version="0.1.0")

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


@app.get("/health")
def health_check():
    return {"status": "ok"}
