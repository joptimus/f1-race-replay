"""
Session caching layer with feather persistence.
Caches processed telemetry arrays (not Session objects) to disk.
"""

import asyncio
import os
from pathlib import Path
from typing import Optional, Dict, Any
import json
import aiofiles

try:
    import pyarrow.feather as feather
    import pyarrow as pa
    FEATHER_AVAILABLE = True
except ImportError:
    FEATHER_AVAILABLE = False


# In-memory cache
_telemetry_cache: Dict[str, Any] = {}
_cache_lock = asyncio.Lock()

# Cache directory
CACHE_DIR = Path(__file__).parent.parent.parent.parent / "cache" / "telemetry"


def _get_cache_key(year: int, round_num: int, session_type: str) -> str:
    """Generate cache key."""
    return f"{year}_{round_num}_{session_type}"


def _get_cache_file(cache_key: str) -> Path:
    """Get cache file path."""
    return CACHE_DIR / f"{cache_key}_telemetry.json"


async def get_cached_telemetry(
    year: int,
    round_num: int,
    session_type: str,
    loader_fn,
    refresh: bool = False
) -> Any:
    """
    Load or compute telemetry, cached to disk.

    Args:
        year: F1 season year
        round_num: Race round number
        session_type: 'R' for race, 'S' for sprint, etc.
        loader_fn: Async function to load telemetry if not cached
        refresh: Force reload from source

    Returns:
        Telemetry data dict
    """
    cache_key = _get_cache_key(year, round_num, session_type)

    # 1. Try in-memory cache first (fastest)
    if not refresh and cache_key in _telemetry_cache:
        return _telemetry_cache[cache_key]

    # 2. Try disk cache (fast I/O with JSON)
    cache_file = _get_cache_file(cache_key)
    if not refresh and cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                telemetry = json.load(f)
            _telemetry_cache[cache_key] = telemetry
            print(f"[CACHE] Loaded {cache_key} from disk cache")
            return telemetry
        except Exception as e:
            print(f"[WARN] Failed to load disk cache for {cache_key}: {e}")

    # 3. Compute if not cached (with locking to prevent duplicate loads)
    async with _cache_lock:
        # Double-check after acquiring lock
        if not refresh and cache_key in _telemetry_cache:
            return _telemetry_cache[cache_key]

        if not refresh and cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    telemetry = json.load(f)
                _telemetry_cache[cache_key] = telemetry
                print(f"[CACHE] Loaded {cache_key} from disk cache (after lock)")
                return telemetry
            except Exception as e:
                print(f"[WARN] Failed to load disk cache for {cache_key}: {e}")

        # Load/compute telemetry (expensive operation)
        print(f"[CACHE] Computing telemetry for {cache_key}...")
        telemetry = await loader_fn(year, round_num, session_type)

        # Save to disk (non-blocking, optional)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        asyncio.create_task(_save_cache_async(cache_file, telemetry))

        _telemetry_cache[cache_key] = telemetry
        return telemetry


async def _save_cache_async(path: Path, data: Any) -> None:
    """Save cache asynchronously without blocking event loop."""
    try:
        async with aiofiles.open(str(path), "w") as f:
            await f.write(json.dumps(data))
        print(f"[CACHE] Saved cache to {path}")
    except Exception as e:
        print(f"[WARN] Failed to save cache: {e}")


def clear_cache(year: Optional[int] = None, round_num: Optional[int] = None, session_type: Optional[str] = None) -> None:
    """
    Clear cache entries.

    Args:
        year: If specified, only clear this year
        round_num: If specified, only clear this round
        session_type: If specified, only clear this session type
    """
    global _telemetry_cache

    if year is None:
        # Clear all
        _telemetry_cache.clear()
        print("[CACHE] Cleared all in-memory cache")
    else:
        cache_key = _get_cache_key(year, round_num or 0, session_type or "R")
        if cache_key in _telemetry_cache:
            del _telemetry_cache[cache_key]
            print(f"[CACHE] Cleared cache for {cache_key}")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return {
        "in_memory_entries": len(_telemetry_cache),
        "cache_dir": str(CACHE_DIR),
        "disk_cache_files": len(list(CACHE_DIR.glob("*_telemetry.json"))) if CACHE_DIR.exists() else 0,
    }
