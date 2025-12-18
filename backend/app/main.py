from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from shared.telemetry.f1_data import enable_cache
from backend.app.api import rounds, sessions, telemetry
from backend.app.websocket import handle_replay_websocket

enable_cache()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("F1 Race Replay API starting...")
    yield
    print("F1 Race Replay API shutting down...")


app = FastAPI(title="F1 Race Replay API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rounds.router)
app.include_router(sessions.router)
app.include_router(telemetry.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.websocket("/ws/replay/{session_id}")
async def websocket_replay(websocket: WebSocket, session_id: str):
    await handle_replay_websocket(websocket, session_id, sessions.active_sessions)
