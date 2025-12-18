"""
FastAPI backend for F1 Race Replay
Handles data loading, caching, and real-time frame streaming via WebSocket
Force reload: v2
"""

from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import asyncio
import json
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.f1_data import (
    get_race_telemetry,
    get_quali_telemetry,
    load_session,
    enable_cache,
    list_rounds,
    list_sprints,
)
from src.track_geometry import build_track_from_example_lap

enable_cache()

# Global state for active replay sessions
active_sessions = {}


class SessionRequest(BaseModel):
    """Request model for creating a replay session"""
    year: int = 2025
    round_num: int = 1
    session_type: str = "R"
    refresh: bool = False


class F1ReplaySession:
    """Manages a single F1 replay session"""

    def __init__(self, year: int, round_num: int, session_type: str, refresh: bool = False):
        self.year = year
        self.round_num = round_num
        self.session_type = session_type
        self.refresh = refresh
        self.frames = None
        self.driver_colors = {}
        self.total_laps = 0
        self.track_statuses = []
        self.track_geometry = None
        self.is_loaded = False
        self.load_error = None

    async def load_data(self):
        """Load telemetry data asynchronously"""
        try:
            session = load_session(self.year, self.round_num, self.session_type)

            if self.session_type in ["Q", "SQ"]:
                data = get_quali_telemetry(session, session_type=self.session_type, refresh=self.refresh)
                self.frames = data.get("frames", [])
                self.driver_colors = data.get("driver_colors", {})
            else:
                data = get_race_telemetry(session, session_type=self.session_type, refresh=self.refresh)
                self.frames = data.get("frames", [])
                self.driver_colors = data.get("driver_colors", {})
                self.track_statuses = data.get("track_statuses", [])
                self.total_laps = data.get("total_laps", 0)

            # Build track geometry from fastest lap
            try:
                fastest_lap = session.laps.pick_fastest().get_telemetry()
                track_data = build_track_from_example_lap(fastest_lap)
                # Store as dict for JSON serialization
                self.track_geometry = {
                    "centerline_x": [float(x) for x in track_data[0]],
                    "centerline_y": [float(y) for y in track_data[1]],
                    "inner_x": [float(x) for x in track_data[2]],
                    "inner_y": [float(y) for y in track_data[3]],
                    "outer_x": [float(x) for x in track_data[4]],
                    "outer_y": [float(y) for y in track_data[5]],
                    "x_min": float(track_data[6]),
                    "x_max": float(track_data[7]),
                    "y_min": float(track_data[8]),
                    "y_max": float(track_data[9]),
                }
            except Exception as e:
                print(f"Warning: Could not build track geometry: {e}")
                import traceback
                traceback.print_exc()
                self.track_geometry = None

            self.is_loaded = True
        except Exception as e:
            self.load_error = str(e)
            self.is_loaded = True

    def serialize_frame(self, frame_index: int) -> str:
        """Serialize a single frame to JSON string"""
        if not self.frames or frame_index >= len(self.frames):
            return json.dumps({"error": "Invalid frame index"})

        frame = self.frames[frame_index]

        # Build optimized payload
        payload = {
            "t": frame.get("t", 0.0),
            "lap": frame.get("lap", 1),
            "drivers": {},
        }

        # Only include essential driver data to minimize payload
        for driver_code, driver_data in frame.get("drivers", {}).items():
            payload["drivers"][driver_code] = {
                "x": float(driver_data.get("x", 0)),
                "y": float(driver_data.get("y", 0)),
                "speed": float(driver_data.get("speed", 0)),
                "gear": int(driver_data.get("gear", 0)),
                "lap": int(driver_data.get("lap", 0)),
                "position": int(driver_data.get("position", 0)),
                "tyre": int(driver_data.get("tyre", 0)),
                "throttle": float(driver_data.get("throttle", 0)),
                "brake": float(driver_data.get("brake", 0)),
                "drs": int(driver_data.get("drs", 0)),
                "dist": float(driver_data.get("dist", 0)),
                "rel_dist": float(driver_data.get("rel_dist", 0)),
                "race_progress": float(driver_data.get("race_progress", 0)),
            }

        if "weather" in frame:
            payload["weather"] = frame["weather"]

        return json.dumps(payload)

    def get_metadata(self) -> dict:
        """Get session metadata"""
        return {
            "year": self.year,
            "round": self.round_num,
            "session_type": self.session_type,
            "total_frames": len(self.frames) if self.frames else 0,
            "total_laps": self.total_laps,
            "driver_colors": {
                code: list(color) if isinstance(color, tuple) else color
                for code, color in self.driver_colors.items()
            },
            "track_geometry": self.track_geometry,
            "error": self.load_error,
        }


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("F1 Race Replay API starting...")
    yield
    # Shutdown
    print("F1 Race Replay API shutting down...")


app = FastAPI(title="F1 Race Replay API", version="1.0.0", lifespan=lifespan)

# Enable CORS for React frontend
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


# ============================================================================
# REST ENDPOINTS
# ============================================================================


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/api/seasons/{year}/rounds")
async def get_rounds(year: int):
    """Get all rounds for a given year"""
    try:
        rounds = list_rounds(year)
        return {"year": year, "rounds": rounds}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/seasons/{year}/sprints")
async def get_sprint_rounds(year: int):
    """Get sprint rounds for a given year"""
    try:
        sprints = list_sprints(year)
        return {"year": year, "sprints": sprints}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sessions")
async def create_session(background_tasks: BackgroundTasks, request: SessionRequest):
    """Create and load a new replay session"""
    year = request.year
    round_num = request.round_num
    session_type = request.session_type
    refresh = request.refresh
    session_id = f"{year}_{round_num}_{session_type}"

    # Check if already loaded (skip if refresh is requested)
    if session_id in active_sessions and not refresh:
        session = active_sessions[session_id]
        if session.is_loaded:
            if session.load_error:
                raise HTTPException(status_code=400, detail=session.load_error)
            return {"session_id": session_id, "metadata": session.get_metadata()}

    # Create new session (with refresh flag)
    session = F1ReplaySession(year, round_num, session_type, refresh=refresh)
    active_sessions[session_id] = session

    # Load data asynchronously
    background_tasks.add_task(session.load_data)

    return {
        "session_id": session_id,
        "loading": True,
        "metadata": session.get_metadata(),
    }


@app.get("/api/sessions/{session_id}")
async def get_session_status(session_id: str):
    """Get session status and metadata"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]
    return {
        "session_id": session_id,
        "loading": not session.is_loaded,
        "metadata": session.get_metadata(),
    }


# ============================================================================
# WEBSOCKET ENDPOINT
# ============================================================================


@app.websocket("/ws/replay/{session_id}")
async def websocket_replay(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time frame streaming

    Protocol:
    - Client sends: {"action": "play", "speed": 1.0} or {"action": "pause"}
    - Server sends: JSON-encoded frame data
    """
    # Accept connection from any origin (for development)
    await websocket.accept(subprotocol=None)

    if session_id not in active_sessions:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    session = active_sessions[session_id]

    # Wait for session to load
    while not session.is_loaded:
        await asyncio.sleep(0.1)

    if session.load_error:
        await websocket.send_json({"error": session.load_error})
        await websocket.close()
        return

    # Streaming loop
    frame_index = 0.0
    playback_speed = 1.0
    is_playing = False
    last_frame_sent = -1

    try:
        while True:
            # Receive control commands
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)

                if data.get("action") == "play":
                    is_playing = True
                    playback_speed = data.get("speed", 1.0)
                elif data.get("action") == "pause":
                    is_playing = False
                elif data.get("action") == "seek":
                    frame_index = float(data.get("frame", 0))
                    last_frame_sent = -1
            except asyncio.TimeoutError:
                pass

            # Update playback
            if is_playing:
                # Advance frame (assuming ~60fps client)
                frame_index += playback_speed * (1.0 / 60.0) * 25  # 25 FPS base

            # Send frame if changed
            current_frame = int(frame_index)
            if current_frame != last_frame_sent and 0 <= current_frame < len(
                session.frames
            ):
                frame_data = session.serialize_frame(current_frame)
                await websocket.send_text(frame_data)
                last_frame_sent = current_frame

            # Handle end of replay
            if frame_index >= len(session.frames):
                is_playing = False
                frame_index = len(session.frames) - 1

            await asyncio.sleep(1 / 60)  # ~60 FPS streaming

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
