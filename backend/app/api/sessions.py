from fastapi import APIRouter, HTTPException, BackgroundTasks
import asyncio
import sys
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from backend.models.session import SessionRequest
from backend.app.services.replay_service import F1ReplaySession
from backend.app.cache.session_cache import clear_cache

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

active_sessions = {}


@router.post("")
async def create_session(request: SessionRequest):
    year = request.year
    round_num = request.round_num
    session_type = request.session_type
    refresh = request.refresh
    session_id = f"{year}_{round_num}_{session_type}"

    if session_id in active_sessions and not refresh:
        session = active_sessions[session_id]
        if session.is_loaded and not session.load_error:
            return {"session_id": session_id}

    session = F1ReplaySession(year, round_num, session_type, refresh=refresh)
    active_sessions[session_id] = session

    asyncio.create_task(session.load_data())

    return {"session_id": session_id}


@router.get("/{session_id}")
async def get_session_status(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]
    return {
        "session_id": session_id,
        "loading": not session.is_loaded,
        "metadata": session.get_metadata(),
    }


def get_active_sessions():
    return active_sessions


@router.delete("/cache")
async def clear_all_cache():
    """Clear all caches (in-memory telemetry cache and FastF1 API cache)"""
    try:
        clear_cache()

        fastf1_cache_dir = Path(".fastf1-cache")
        if fastf1_cache_dir.exists():
            shutil.rmtree(fastf1_cache_dir)
            print("[CACHE] Cleared FastF1 cache directory")

        telemetry_cache_dir = Path(__file__).parent.parent.parent.parent / "cache" / "telemetry"
        if telemetry_cache_dir.exists():
            shutil.rmtree(telemetry_cache_dir)
            print("[CACHE] Cleared telemetry cache directory")

        return {"status": "success", "message": "All caches cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
