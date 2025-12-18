# Phase 2 Implementation Plan

## Overview

Phase 1 delivered 50-70% improvement in telemetry processing by optimizing data loading and frame building. Phase 2 focuses on reducing WebSocket latency and bandwidth usage, which are the remaining performance bottlenecks in the live replay experience.

**Phase 1 Status:** ✅ COMPLETE - All 4 critical bugs fixed and validated
**Phase 2 Status:** 🔄 PLANNING - Ready for implementation

---

## Problem Statement

While Phase 1 optimized data loading (5-30 seconds), users experience:
1. **WebSocket transmission overhead** - Frames serialized to JSON 60 times/second
2. **Bandwidth inefficiency** - JSON format is verbose (2-3 KB per frame)
3. **Frame serialization CPU** - Type conversions and JSON encoding on every frame send
4. **No request deduplication** - Same session loaded by multiple concurrent clients

These issues cause:
- **High bandwidth usage** (30-40% more than optimal)
- **WebSocket thread bottleneck** (20-30% CPU on serialization)
- **Poor network efficiency** for mobile/limited-bandwidth users

---

## Phase 2 Candidates

### Priority 1: Frame Serialization Caching (20-30% CPU gain)

**Location:** `backend/app/replay_service.py`

**Problem:** `serialize_frame()` runs 60 times/second, performing:
- Dictionary building
- Type conversions (int, float)
- JSON encoding
- String allocation

**Solution:** Pre-compute serialized frames once during initialization

```python
class ReplaySession:
    def __init__(self, ...):
        # After loading frames
        self._serialized_frames = [
            json.dumps(self._build_frame_payload(f))
            for f in self.frames
        ]

    def serialize_frame(self, frame_index: int) -> str:
        """Return pre-serialized frame (O(1) lookup)."""
        return self._serialized_frames[frame_index]

    def _build_frame_payload(self, frame):
        # Existing serialization logic
        return {
            "t": frame["t"],
            "lap": frame["lap"],
            "drivers": frame["drivers"]
        }
```

**Impact:**
- Eliminates 60 dict builds/second
- Eliminates 60 JSON encodings/second
- Reduces WebSocket thread CPU by 20-30%

**Memory Cost:** 10-20 MB for large races (negligible)
**Risk:** Low (straightforward caching)
**Effort:** 1-2 hours

---

### Priority 2: WebSocket Compression with msgpack (30-40% bandwidth)

**Location:** `backend/app/websocket.py` (backend) + `frontend/src/hooks/useReplayWebSocket.ts` (frontend)

**Problem:** JSON serialization uses UTF-8 text encoding:
- Verbose field names repeated per frame
- No compression across frames
- Typical frame 2-3 KB per frame × 60 fps = 120-180 KB/sec

**Solution:** Use msgpack binary format (more compact than JSON)

**Backend changes:**
```python
import msgpack

class ReplaySession:
    def get_frame_for_wire(self, frame_index: int) -> bytes:
        """Return msgpack-encoded frame."""
        frame = self.frames[frame_index]
        payload = {
            "t": frame["t"],
            "lap": frame["lap"],
            "drivers": frame["drivers"]
        }
        return msgpack.packb(payload, use_bin_type=True)

# In websocket.py
frame_data = session.get_frame_for_wire(current_frame)
await websocket.send_bytes(frame_data)  # Binary transmission
```

**Frontend changes:**
```typescript
// In useReplayWebSocket.ts
const handleMessage = (event: MessageEvent) => {
    const frame = msgpack.unpack(event.data);  // Unpack binary
    updateReplayState(frame);
};
```

**Impact:**
- 30-40% smaller frame payloads
- Binary transmission (more efficient than text)
- Reduced bandwidth for mobile users

**Dependencies:** msgpack (Python + TypeScript libraries)
**Risk:** Medium (requires frontend changes)
**Effort:** 2-3 hours (coordination between backend/frontend)

---

### Priority 3: Multiprocessing Tuning (10-20% improvement)

**Location:** `shared/telemetry/f1_data.py`, lines 165-189 (`_process_telemetry()`)

**Problem:** Multiprocessing chunk size not optimized for driver count:
- Default `chunksize=1` causes overhead with thread context switches
- Should scale based on driver count and data size

**Solution:** Calculate optimal chunk size:

```python
def _process_telemetry(drivers, chunksize=None):
    """Process drivers in parallel with optimized chunk size."""

    # Auto-tune chunk size based on driver count
    if chunksize is None:
        num_drivers = len(drivers)
        # Aim for 4-8 chunks per worker for load distribution
        num_workers = min(os.cpu_count() or 1, num_drivers)
        chunksize = max(1, (num_drivers + num_workers * 4 - 1) // (num_workers * 4))

    with Pool(processes=os.cpu_count()) as pool:
        results = pool.imap_unordered(
            _process_single_driver,
            drivers,
            chunksize=chunksize
        )

        for result in results:
            yield result
```

**Typical values:**
- 20 drivers, 4 cores → chunksize=2 (better than 1)
- 30 drivers, 8 cores → chunksize=1 (already good)
- 10 drivers, 4 cores → chunksize=1 (minimal overhead)

**Impact:**
- 10-20% faster multiprocessing for 20-30 drivers
- Better load distribution across cores
- No impact on data integrity

**Risk:** Low (empirical tuning)
**Effort:** 1-2 hours (requires profiling)

---

### Priority 4: Async File I/O (Event Loop Stability)

**Location:** `backend/app/cache/session_cache.py`

**Problem:** Current implementation mixes sync/async:
- `asyncio.create_task(_save_cache_async())` with sync file I/O
- Blocks event loop during JSON encoding/file write

**Solution:** Use `aiofiles` for true async I/O:

```python
import aiofiles
import json

async def _save_cache_async(path: Path, data: Any) -> None:
    """Save cache asynchronously without blocking event loop."""
    try:
        async with aiofiles.open(path, "w") as f:
            await f.write(json.dumps(data))
        print(f"[CACHE] Saved cache to {path}")
    except Exception as e:
        print(f"[WARN] Failed to save cache: {e}")
```

**Impact:**
- Non-blocking file I/O
- Event loop remains responsive during cache writes
- Better responsiveness under high load

**Dependencies:** aiofiles
**Risk:** Low (standard async pattern)
**Effort:** 1 hour

---

## Implementation Sequence

**Phase 2 implementation order** (by priority and dependencies):

1. **Frame Serialization Caching** (Priority 1)
   - No dependencies
   - Quick win (20-30% CPU gain)
   - Effort: 1-2 hours
   - ⏱️ Start here

2. **WebSocket Compression** (Priority 2)
   - Depends on Priority 1 (slightly)
   - Significant bandwidth improvement
   - Requires frontend coordination
   - Effort: 2-3 hours

3. **Multiprocessing Tuning** (Priority 3)
   - Independent
   - Moderate improvement
   - Requires profiling and testing
   - Effort: 1-2 hours

4. **Async File I/O** (Priority 4)
   - Independent
   - Event loop stability (important for production)
   - Low effort, high reliability
   - Effort: 1 hour

---

## Testing & Validation

Each Phase 2 optimization will use:

1. **Performance Benchmarking** - Measure latency/bandwidth before/after
2. **Regression Testing** - Run golden file tests to ensure no data corruption
3. **Load Testing** - Test with multiple concurrent clients
4. **Memory Profiling** - Verify no memory leaks (especially frame caching)

---

## Success Criteria

Phase 2 is complete when:

- ✅ Frame serialization caching reduces WebSocket CPU by 20-30%
- ✅ msgpack compression reduces bandwidth by 30-40%
- ✅ Multiprocessing tuning improves load time by 10-20%
- ✅ Async I/O stabilizes event loop under load
- ✅ All changes validated with regression tests
- ✅ Combined improvement documented

**Expected Phase 2 Total Improvement:** 30-50% in WebSocket/transmission performance

---

## Future Considerations (Phase 3+)

Beyond Phase 2, consider:
- **Network compression** (gzip/brotli for WebSocket upgrade)
- **Incremental frame updates** (send only driver deltas when available)
- **Client-side interpolation** (reduce frame rate to 25 fps, interpolate smoothly)
- **Adaptive bitrate** (reduce frame detail for slow connections)
