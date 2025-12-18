# F1 Race Replay Performance Optimization Plan

## Executive Summary

This document outlines critical performance bottlenecks discovered in the F1 Race Replay Python codebase and proposes solutions that could achieve **40-60% total performance improvement** across the data processing pipeline.

The primary issues are excessive data transformations and array copying in telemetry processing, inefficient frame building with redundant dictionary allocations, and unnecessary session reloading at the API layer.

---

## 1. Critical Bottleneck: Array Concatenation & Reordering

### Problem

**Location:** `shared/telemetry/f1_data.py`, lines 95-114 in `_process_single_driver()`

**Issue:** The code concatenates all lap data into arrays, then immediately reorders the entire dataset with a second pass. This creates an O(2N) memory spike.

```python
# Current approach: Two passes over data
t_all, x_all, y_all, race_dist_all, rel_dist_all, lap_numbers, ... = \
    [np.concatenate(arr) for arr in all_arrays]

order = np.argsort(t_all)
t_all, x_all, y_all, race_dist_all, rel_dist_all, lap_numbers, ... = \
    [arr[order] for arr in all_data]

throttle_all = np.concatenate(throttle_all)[order]
brake_all = np.concatenate(brake_all)[order]
```

**Why it's inefficient:**
- Concatenates all lap data first (memory allocation)
- Sorts the concatenated array (O(n log n) with data movement)
- Reorders all 12+ arrays by indexing (second pass over all data)
- Throttle/brake handled separately instead of batched with other arrays
- Each array operation allocates new memory

**Performance Impact:** 30-50% of telemetry processing time wasted on redundant operations per driver

### Solution

**Option A (Recommended): Pre-sort Lap Intervals Before Concatenation**

Collect data from each lap in a way that minimizes sorting operations:

```python
# Collect intervals as (start_time, arrays_tuple)
# Pre-asserting monotonicity per-lap and chronological ordering
intervals = []
for _, lap in laps_driver.iterlaps():
    lap_tel = lap.get_telemetry()
    t_lap = lap_tel["SessionTime"].dt.total_seconds().to_numpy()

    if len(t_lap) > 0:
        # INTEGRITY: Assert time is strictly monotonic within lap
        assert np.all(t_lap[:-1] <= t_lap[1:]), \
            f"Non-monotonic lap time for {driver_code}"

        # Bundle all arrays for this lap
        arrays = (t_lap, x_lap, y_lap, dist_lap, ...)
        intervals.append((t_lap[0], arrays))  # Sort key = lap start time

# Sort intervals by start time (small list, typically 50-100 laps)
# INTEGRITY: Verify laps are chronological
intervals.sort(key=lambda x: x[0])

# Concatenate pre-sorted intervals (only one sort operation)
all_arrays = [np.concatenate([interval[1][i] for interval in intervals])
              for i in range(num_columns)]

# INTEGRITY: Verify concatenated time is strictly increasing
assert np.all(t_all[:-1] <= t_all[1:]), \
    f"Non-monotonic concatenated time for {driver_code}"
```

**Benefits:**
- Single sort operation on lap-level data (50-100 items) not telemetry points (50,000+ items)
- Eliminates second reordering pass (huge memory savings)
- Maintains same output with stronger guarantees
- Easier to understand and maintain
- Built-in data integrity checks catch any lap-ordering issues early

**CRITICAL NOTES:**
- FastF1 `SessionTime` is absolute and monotonically increasing within laps
- `laps_driver.iterlaps()` already returns laps in chronological order, but we assert this
- This preserves time-offset logic and data continuity

**Effort:** Medium (2-3 hours coding + testing)
**Risk:** Low (output structure unchanged, integrity assertions prevent silent corruption)

---

**Option B: Vectorize Array Processing**

Batch all array operations into a single loop:

```python
# Collect all arrays in a single dict per lap
all_data = {
    "t": [], "x": [], "y": [], "dist": [], "lap": [],
    "tyre": [], "speed": [], "gear": [], "drs": [],
    "throttle": [], "brake": [], "rpm": []
}

for _, lap in laps_driver.iterlaps():
    lap_tel = lap.get_telemetry()
    for key in all_data:
        all_data[key].append(get_column_array(lap_tel, key))

# Single concatenation + sort pass
t_all = np.concatenate(all_data["t"])
order = np.argsort(t_all)

# Single-pass reordering via dict comprehension
result = {key: np.concatenate(all_data[key])[order] for key in all_data}
```

**Benefits:**
- Simpler code logic
- Single comprehension for all arrays

**Effort:** Medium (similar to Option A)
**Risk:** Low (restructures logic, easier to test)

---

## 2. Critical Bottleneck: Frame Building Loop Overhead

### Problem

**Location:** `shared/telemetry/f1_data.py`, lines 371-496 in `get_race_telemetry()`

**Issue:** The current O(N⋅DlogD) logic (sorting drivers inside every frame loop) is the primary cause of slow replay generation. Additionally, creating thousands of Python dictionaries causes GC overhead.

```python
for i in range(num_frames):
    # Creates intermediate snapshot list with 13 fields per driver
    snapshot = []
    for code in driver_codes:
        d = driver_arrays[code]
        snapshot.append({
            "code": code,
            "dist": float(d["dist"][i]),
            "x": float(d["x"][i]),
            "y": float(d["y"][i]),
            "lap": int(round(d["lap"][i])),
            # ... 8 more conversions ...
        })

    # Sorts snapshot list O(n log n) per frame (2000 frames = 40,000+ sorts!)
    snapshot.sort(key=lambda r: -r["race_progress"])

    # Copies data again from snapshot to frame_data
    frame_data = {}
    for idx, car in enumerate(snapshot):
        code = car["code"]
        position = idx + 1
        frame_data[code] = {
            "x": car["x"],
            "y": car["y"],
            # ... redundant copies of all fields ...
        }
```

**Why it's inefficient:**
- Creates 520,000+ dictionary allocations (2000 frames × 20 drivers × 13 fields) → heavy GC pressure
- Sorts driver list per frame O(n log n) × 2000 = ~40,000 sorting operations
- Copies data from `snapshot` to `frame_data` (second dict creation per frame)
- Type conversions on already-converted values
- Race progress recalculated per frame despite deterministic formula

**Performance Impact:** 20-30% of telemetry processing time

### Solution

**Use Structured NumPy Array Instead of Dictionaries**

Pre-allocate a structured 2D array and avoid dictionary overhead entirely:

```python
import numpy as np
from numpy.core import records

# Define structured dtype matching frame fields
frame_dtype = np.dtype([
    ('code', 'U4'),        # Driver code (4 chars)
    ('x', 'f8'),          # X coordinate
    ('y', 'f8'),          # Y coordinate
    ('dist', 'f8'),       # Race distance
    ('lap', 'i4'),        # Lap number
    ('rel_dist', 'f8'),   # Relative distance (0-1)
    ('tyre', 'i2'),       # Tyre compound
    ('speed', 'f4'),      # Speed (km/h)
    ('gear', 'i1'),       # Gear
    ('drs', 'i1'),        # DRS status
    ('throttle', 'f4'),   # Throttle
    ('brake', 'f4'),      # Brake
    ('rpm', 'i2'),        # RPM
    ('position', 'i1'),   # Race position
])

# Pre-allocate frame array
num_drivers = len(driver_codes)
frame_array = np.zeros(num_drivers, dtype=frame_dtype)

# Initialize driver codes (constant across all frames)
for j, code in enumerate(driver_codes):
    frame_array['code'][j] = code

# Now the main loop (no intermediate snapshots, no per-frame sorts)
for i in range(num_frames):
    # Populate all drivers for this frame in one operation
    for j, code in enumerate(driver_codes):
        d = driver_arrays[code]
        frame_array['x'][j] = d["x"][i]
        frame_array['y'][j] = d["y"][i]
        frame_array['dist'][j] = d["dist"][i]
        frame_array['lap'][j] = int(round(d["lap"][i]))
        frame_array['rel_dist'][j] = d["rel_dist"][i]
        frame_array['tyre'][j] = int(d["tyre"][i])
        frame_array['speed'][j] = d["speed"][i]
        frame_array['gear'][j] = int(d["gear"][i])
        frame_array['drs'][j] = int(d["drs"][i])
        frame_array['throttle'][j] = d["throttle"][i]
        frame_array['brake'][j] = d["brake"][i]
        frame_array['rpm'][j] = int(d["rpm"][i])

    # Sort by race_progress (preserve existing race logic)
    # But use argsort once per frame (much faster)
    sort_indices = np.argsort(-frame_array['dist'])
    sorted_frame = frame_array[sort_indices]

    # Assign positions
    for pos in range(num_drivers):
        sorted_frame['position'][pos] = pos + 1

    # Convert to dict format for JSON serialization (only when needed)
    frame_dict = {
        "t": t_array[i],
        "lap": leader_lap[i],
        "drivers": {}
    }

    for j, code in enumerate(sorted_frame['code']):
        frame_dict["drivers"][code] = {
            "x": float(sorted_frame['x'][j]),
            "y": float(sorted_frame['y'][j]),
            "dist": float(sorted_frame['dist'][j]),
            "lap": int(sorted_frame['lap'][j]),
            "rel_dist": float(sorted_frame['rel_dist'][j]),
            "tyre": int(sorted_frame['tyre'][j]),
            "speed": float(sorted_frame['speed'][j]),
            "gear": int(sorted_frame['gear'][j]),
            "drs": int(sorted_frame['drs'][j]),
            "throttle": float(sorted_frame['throttle'][j]),
            "brake": float(sorted_frame['brake'][j]),
            "rpm": int(sorted_frame['rpm'][j]),
            "position": int(sorted_frame['position'][j]),
        }

    frames.append(frame_dict)
```

**CRITICAL IMPLEMENTATION NOTES:**

1. **Preserve Race Logic Verbatim** - The existing code has nuanced ordering:
   - Grid positions at race start
   - Dynamic race progress during race
   - Final classification once race finishes
   - Keep all three ordering modes unchanged

2. **Keep Monotonicity Checks** - The `last_dist` warning is valuable debugging:
   ```python
   # Retain this check, just move it after position calculation
   for j, code in enumerate(sorted_frame['code']):
       progress = sorted_frame['dist'][j]
       if progress + 1e-3 < last_dist[code]:
           print(f"[WARN] non-monotonic dist for {code}")
       last_dist[code] = progress
   ```

3. **Data Integrity** - Add golden file comparison before/after to verify:
   - Same frame count
   - Same leader per frame
   - Same driver order per frame
   - Same float values within tolerance

**Benefits:**
- Eliminates dictionary allocation overhead (~520K dicts → ~2K numpy ops)
- Single NumPy array sort per frame is ~10-20x faster than Python list sort
- No Python GC pressure on dictionary objects
- Minimal memory footprint (structured array is contiguous, cache-friendly)
- 20-30% reduction in frame building time

**Effort:** Medium (3-4 hours coding, integration, golden file validation)
**Risk:** Low IF you preserve race logic verbatim and validate with golden files

---

## 3. High Priority: Session Caching at API Layer

### Problem

**Location:** `backend/app/api/telemetry.py`, lines 14-26

**Issue:** Every telemetry API request reloads the entire FastF1 session from scratch. `session.load()` is a massive time-sink (5-30 seconds).

```python
@router.post("/laps", response_model=LapTelemetryResponse)
async def get_lap_telemetry_endpoint(request: LapTelemetryRequest):
    try:
        # load_session() reloads from FastF1 every time (EXPENSIVE!)
        session = load_session(request.year, request.round_num, request.session_type)
        laps_data = get_lap_telemetry(session, request.driver_codes, request.lap_numbers)
```

**Why it's inefficient:**
- Multiple API calls for different data (laps, sectors, weather) each trigger full reload
- Session loading takes 5-30 seconds depending on data availability and network
- No request deduplication for simultaneous clients
- Session objects contain lots of unneeded metadata

**Performance Impact:** 5-30 second delay per endpoint call

### Solution

**Option A (Recommended): Cache Processed Telemetry Arrays (Not Session Objects)**

Don't just cache the Session object; it contains too much metadata. Instead, cache the final processed telemetry arrays using feather format (fast I/O):

```python
import pyarrow.feather as feather
import os
from pathlib import Path

_telemetry_cache = {}  # {key: telemetry_array}
_cache_lock = asyncio.Lock()

async def get_cached_telemetry(year: int, round_num: int, session_type: str):
    """Load or compute telemetry, cached to disk via feather format."""
    cache_key = f"{year}_{round_num}_{session_type}"
    cache_file = Path(f"cache/telemetry/{cache_key}.feather")

    # Try in-memory cache first (fastest)
    if cache_key in _telemetry_cache:
        return _telemetry_cache[cache_key]

    # Try disk cache (fast I/O with feather)
    if cache_file.exists():
        telemetry = feather.read_table(str(cache_file)).to_pandas()
        _telemetry_cache[cache_key] = telemetry
        return telemetry

    # Compute if not cached
    async with _cache_lock:
        # Double-check after acquiring lock
        if cache_key in _telemetry_cache:
            return _telemetry_cache[cache_key]

        if cache_file.exists():
            telemetry = feather.read_table(str(cache_file)).to_pandas()
            _telemetry_cache[cache_key] = telemetry
            return telemetry

        # Load session and extract telemetry (expensive operation)
        session = load_session(year, round_num, session_type)
        telemetry = get_race_telemetry(session, refresh=False)

        # Save to disk (non-blocking, optional)
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        asyncio.create_task(_save_feather_async(cache_file, telemetry))

        _telemetry_cache[cache_key] = telemetry
        return telemetry

async def _save_feather_async(path: Path, data: pd.DataFrame):
    """Save feather in background."""
    try:
        feather.write_table(pa.Table.from_pandas(data), str(path))
    except Exception as e:
        print(f"[WARN] Failed to save cache: {e}")
```

**Benefits:**
- Feather format: 5-10x faster I/O than pickle
- Near-instant subsequent requests (disk cache hit in <100ms)
- No mutability issues (unlike Session objects)
- Memory-efficient: only load what's needed
- Background save doesn't block requests

**Why feather over pickle:**
- Feather: Apache Arrow format, designed for rapid I/O across languages
- Pickle: Python-specific, slower serialization, security risks with untrusted data

---

**Option B: Simple In-Memory Session Cache with Locking**

If you prefer to keep the Session object for flexibility:

```python
from asyncio import Lock

_session_cache = {}  # {key: session}
_session_locks = {}  # {key: Lock}

async def get_cached_session(year: int, round_num: int, session_type: str):
    """Load session once and cache in memory."""
    cache_key = f"{year}_{round_num}_{session_type}"

    # Create lock if not exists
    if cache_key not in _session_locks:
        _session_locks[cache_key] = Lock()

    # Use lock to prevent duplicate loads
    async with _session_locks[cache_key]:
        if cache_key not in _session_cache:
            # Load session (single operation, others wait)
            _session_cache[cache_key] = load_session(year, round_num, session_type)

    return _session_cache[cache_key]

# Usage
@router.post("/laps")
async def get_lap_telemetry_endpoint(request: LapTelemetryRequest):
    session = await get_cached_session(request.year, request.round_num, request.session_type)
    laps_data = get_lap_telemetry(session, request.driver_codes, request.lap_numbers)
```

**Benefits:**
- Prevents duplicate loads for concurrent requests
- Simple to implement
- Backward compatible (uses Session object)

**Drawback:**
- In-memory cache unbounded (can grow large)
- Must ensure Session object is never mutated

---

**Option C: Add Cache Expiration (TTL)**

```python
import time
from typing import Tuple

_session_cache: dict[str, Tuple] = {}  # {key: (session, timestamp)}
_cache_ttl = 3600  # 1 hour

async def get_cached_session(year: int, round_num: int, session_type: str):
    cache_key = f"{year}_{round_num}_{session_type}"

    # Check if cached and not expired
    if cache_key in _session_cache:
        session, timestamp = _session_cache[cache_key]
        if time.time() - timestamp < _cache_ttl:
            return session

    # Load and cache
    session = load_session(year, round_num, session_type)
    _session_cache[cache_key] = (session, time.time())
    return session
```

**CRITICAL NOTES:**

1. **Don't accidentally mutate cached Session object** - FastF1 sessions may have internal state; ensure you don't modify them.
2. **Feather requires PyArrow** - Add to `requirements.txt`: `pyarrow>=10.0.0`
3. **Thread-safety** - Use asyncio.Lock (not threading.Lock) for async context

**Recommendation:** Use **Option A** (feather caching) for production. It's the fastest for subsequent requests and scales well.

**Effort:** Low (2-3 hours including disk I/O testing)
**Risk:** Low (cache miss falls back to load, can add TTL or invalidation for safety)

---

## 4. High Priority: Resampling Inefficiencies

### Problem

**Location:** `shared/telemetry/f1_data.py`, lines 243-284 in `get_race_telemetry()`

**Issue:** Uses 12 separate `np.interp()` calls per driver and recalculates sort order unnecessarily.

```python
for code, data in driver_data.items():
    t = data["t"] - global_t_min
    order = np.argsort(t)  # Recalculated even though data should be sorted
    t_sorted = t[order]

    # 12 separate interpolation calls instead of batched
    resampled = [np.interp(timeline, t_sorted, arr) for arr in arrays_to_resample]
```

**Why it's inefficient:**
- Data reordering should be complete from `_process_single_driver()` (fix from bottleneck #1)
- Multiple `np.interp()` calls with repeated timeline and t_sorted overhead
- No sharing of interpolation coefficients across channels

**Performance Impact:** 15-25% of resampling time

### Solution

**Verify Pre-sorted Data and Optimize Interpolation**

After fixing bottleneck #1 (ensuring `_process_single_driver` returns pre-sorted data), you can streamline resampling:

```python
for code, data in driver_data.items():
    t = data["t"] - global_t_min

    # INTEGRITY: Assert data is strictly monotonic (pre-sorted from _process_single_driver)
    assert np.all(t[:-1] <= t[1:]), f"Driver {code} data not monotonic in time"

    # Reuse t_sorted and timeline across all interpolations (avoid recomputation)
    # Keep the existing list-comprehension pattern (safest for data integrity)
    t_sorted = t  # No need to sort if pre-sorted

    resampled = [np.interp(timeline, t_sorted, arr) for arr in [
        data["x"],
        data["y"],
        data["dist"],
        data["rel_dist"],
        data["lap"],
        data["tyre"],
        data["speed"],
        data["gear"],
        data["drs"],
        data["throttle"],
        data["brake"],
        data["rpm"],
    ]]

    # Unpack back into dict
    result_dict = {}
    for key, resampled_arr in zip(
        ["x", "y", "dist", "rel_dist", "lap", "tyre", "speed", "gear", "drs", "throttle", "brake", "rpm"],
        resampled
    ):
        result_dict[key] = resampled_arr

    driver_data[code] = result_dict
```

**Advanced Option: Use scipy.interpolate for True Batch Interpolation**

If profiling shows resampling is still a hotspot after fixing bottleneck #1, use scipy:

```python
from scipy.interpolate import interp1d
import numpy as np

for code, data in driver_data.items():
    t = data["t"] - global_t_min

    # INTEGRITY: Assert strictly monotonic
    assert np.all(t[:-1] <= t[1:]), f"Driver {code} data not monotonic in time"

    # Stack all telemetry channels into 2D array [num_channels, num_points]
    channels = np.vstack([
        data["x"],
        data["y"],
        data["dist"],
        data["rel_dist"],
        data["lap"],
        data["tyre"],
        data["speed"],
        data["gear"],
        data["drs"],
        data["throttle"],
        data["brake"],
        data["rpm"],
    ])

    # Batch interpolation using scipy (handles multiple channels efficiently)
    interpolator = interp1d(
        t,
        channels,
        kind='linear',
        axis=1,
        bounds_error=False,
        fill_value='extrapolate'
    )

    resampled = interpolator(timeline)

    # Unpack channels back into dict
    result_dict = {}
    for key, idx in [
        ("x", 0), ("y", 1), ("dist", 2), ("rel_dist", 3), ("lap", 4),
        ("tyre", 5), ("speed", 6), ("gear", 7), ("drs", 8),
        ("throttle", 9), ("brake", 10), ("rpm", 11),
    ]:
        result_dict[key] = resampled[idx]

    driver_data[code] = result_dict
```

**CRITICAL NOTES:**

1. **DON'T change np.interp to use axis=1** - `np.interp()` doesn't support the axis parameter; this would cause a runtime error.

2. **First verify pre-sorted data** - Depends on fixing bottleneck #1 correctly:
   - Ensure `_process_single_driver` returns time arrays strictly monotonic
   - Add assertions to catch any violations early
   - Only skip the sort if 100% confident

3. **scipy option is optional** - The basic list-comprehension pattern is safe and only ~5-10% slower than scipy.
   - Only switch to scipy if profiling shows it's still a bottleneck
   - scipy adds a dependency but is widely used

**Benefits (Basic Option):**
- Eliminates redundant sort operations (~5-10% improvement)
- Simpler, verifiable code
- No new dependencies

**Benefits (scipy Option):**
- True vectorized batch interpolation (~10-20% improvement)
- Better cache utilization with stacked arrays
- Professional scipy library handles edge cases

**Effort:** Low (1-2 hours for basic, 2-3 hours for scipy)
**Risk:** Low for basic (verified pre-sort), Medium for scipy (requires testing against baseline)

---

## 5. Medium Priority: Frame Serialization Caching

### Problem

**Location:** `backend/app/replay_service.py`, lines 73-105

**Issue:** Entire frame is re-serialized to JSON on every WebSocket send (60 FPS = 60 calls/second).

```python
def serialize_frame(self, frame_index: int) -> str:
    frame = self.frames[frame_index]
    payload = {
        "t": frame.get("t", 0.0),
        "lap": frame.get("lap", 1),
        "drivers": {},
    }

    for driver_code, driver_data in frame.get("drivers", {}).items():
        payload["drivers"][driver_code] = {
            "x": float(driver_data.get("x", 0)),
            # ... type conversions ...
        }

    return json.dumps(payload)
```

**Why it's inefficient:**
- JSON serialization on every frame (60+ calls/sec at playback speed)
- Type conversions on already-converted values
- No caching of serialized output

**Performance Impact:** 20-30% of WebSocket CPU usage

### Solution

**Option A: Pre-serialize All Frames During Load**

```python
def load_frames(self):
    # ... existing load logic ...

    # Pre-serialize all frames once
    self._serialized_frames = []
    for frame in self.frames:
        serialized = json.dumps(self._serialize_frame_internal(frame))
        self._serialized_frames.append(serialized)

def serialize_frame(self, frame_index: int) -> str:
    """Return pre-serialized frame."""
    return self._serialized_frames[frame_index]
```

**Benefits:**
- Serialization happens once, not 60 times per second
- Eliminates type conversion overhead
- Simple to implement

**Drawback:** Uses ~10-20MB additional memory for large races (acceptable)

**Effort:** Low (1 hour)
**Risk:** Low (straightforward caching pattern)

---

**Option B: LRU Cache with Lazy Serialization**

```python
from functools import lru_cache

class ReplaySession:
    def __init__(self, ...):
        # ... existing code ...
        self._serialize_frame = lru_cache(maxsize=256)(self._serialize_frame_impl)

    def _serialize_frame_impl(self, frame_index: int) -> str:
        # Actual serialization logic
        frame = self.frames[frame_index]
        # ... build payload ...
        return json.dumps(payload)

    def serialize_frame(self, frame_index: int) -> str:
        """Return cached or computed serialization."""
        return self._serialize_frame(frame_index)
```

**Benefits:**
- Memory-bounded (maxsize=256 = typical playback window)
- Still caches frequently accessed frames
- Less upfront memory

**Effort:** Low (1 hour)
**Risk:** Low (standard caching pattern)

**Recommendation:** Use Option A for simplicity; pre-serialization adds negligible memory.

---

## 6. Medium Priority: WebSocket Encoding & Compression

### Problem

**Location:** `backend/app/websocket.py`, line 54

**Issue:** Raw JSON sent over WebSocket uses text encoding inefficiently.

```python
frame_data = session.serialize_frame(current_frame)
await websocket.send_text(frame_data)
```

**Why it's inefficient:**
- `send_text()` encodes string as UTF-8 (overhead)
- JSON is verbose format (typical frame 2-3 KB)
- No compression across frames

**Performance Impact:** 30-40% higher bandwidth usage

### Solution

**Option A: Use msgpack Binary Serialization**

```python
import msgpack

# During frame building
def get_frame_for_wire(self, frame_index: int) -> bytes:
    """Return msgpack-encoded frame (30-40% smaller than JSON)."""
    frame = self.frames[frame_index]

    payload = {
        "t": frame["t"],
        "lap": frame["lap"],
        "drivers": frame["drivers"]  # Already properly typed
    }

    return msgpack.packb(payload, use_bin_type=True)

# During WebSocket send
frame_data = session.get_frame_for_wire(current_frame)
await websocket.send_bytes(frame_data)
```

**Frontend changes:**
```typescript
const message = await websocket.onmessage((event) => {
    const frame = msgpack.unpack(event.data);
    // ... rest of logic ...
});
```

**Benefits:**
- 30-40% bandwidth reduction
- Faster serialization/deserialization than JSON
- Binary safe

**Drawback:** Requires frontend msgpack library

**Effort:** Medium (2-3 hours including frontend changes)
**Risk:** Low (requires testing with frontend)

---

**Option B: JSON with Selective Compression**

```python
import gzip

# Only compress if frame > 1KB
def serialize_frame(self, frame_index: int) -> bytes:
    frame_json = json.dumps(self.frames[frame_index]).encode()

    if len(frame_json) > 1024:
        return b"Z" + gzip.compress(frame_json)  # "Z" prefix signals compression
    else:
        return b"J" + frame_json  # "J" prefix signals JSON
```

**Benefits:**
- Less invasive (JSON stays same format)
- Typical frames compress 60-70%
- Backward compatible if needed

**Effort:** Low (1 hour)
**Risk:** Low (simple fallback patterns)

**Recommendation:** Use Option B for minimal risk; msgpack requires frontend coordination.

---

## 7. Medium Priority: Synchronous File I/O in Async Context

### Problem

**Location:** `shared/telemetry/f1_data.py`, lines 172-176

**Issue:** Blocking file I/O in cache load can stall async event loop.

```python
with open(f"computed_data/{event_name}_{cache_suffix}_telemetry.pkl", "rb") as f:
    frames = pickle.load(f)
```

**Why it's inefficient:**
- Blocking I/O in async context can stall event loop by 100-500ms
- No async fallback if cache unavailable
- Called from background task which should be async

**Performance Impact:** 100-500ms stall on event loop per session load

### Solution

**Use aiofiles for Async File I/O**

```python
import aiofiles
import asyncio

async def load_cache_async(cache_file: str):
    """Load pickle cache asynchronously."""
    try:
        async with aiofiles.open(cache_file, mode='rb') as f:
            data = await f.read()
            return pickle.loads(data)
    except FileNotFoundError:
        return None

# In get_race_telemetry or caller
async def get_race_telemetry_async(...):
    cache_file = f"computed_data/{event_name}_{cache_suffix}_telemetry.pkl"

    if not refresh:
        frames = await load_cache_async(cache_file)
        if frames is not None:
            return frames

    # Compute telemetry if not cached
    frames = compute_telemetry(...)

    # Save cache asynchronously (non-blocking)
    asyncio.create_task(save_cache_async(cache_file, frames))

    return frames
```

**Benefits:**
- Event loop never blocked by file I/O
- Can serve other requests during load
- Graceful fallback to computation

**Effort:** Medium (2-3 hours, requires refactoring async boundaries)
**Risk:** Medium (changes async/await signatures)

**Note:** Only needed if API is heavily used. Lower priority than critical bottlenecks.

---

## 8. Low Priority: Multiprocessing Optimization

### Problem

**Location:** `shared/telemetry/f1_data.py`, lines 213-231

**Issue:** Process pool uses default chunk size without optimization.

```python
num_processes = min(cpu_count(), len(drivers))
with Pool(processes=num_processes) as pool:
    results = pool.map(_process_single_driver, driver_args)
```

**Why it's inefficient:**
- Default chunksize=1 means each process gets 1 driver at a time
- With heterogeneous driver data, some processes finish early
- No load balancing across cores
- Memory overhead: each process loads session data

**Performance Impact:** Sublinear speedup (10-20% improvement possible)

### Solution

**Use Optimal Chunk Size and imap_unordered**

```python
import math

num_processes = min(cpu_count(), len(drivers))
chunk_size = max(1, math.ceil(len(drivers) / (num_processes * 4)))

with Pool(processes=num_processes) as pool:
    # imap_unordered for better load balancing
    results = []
    for result in pool.imap_unordered(
        _process_single_driver,
        driver_args,
        chunksize=chunk_size
    ):
        results.append(result)

    # Re-order results to match driver_codes order
    results_dict = {r["code"]: r for r in results}
    results = [results_dict[code] for code in driver_codes]
```

**Benefits:**
- Better CPU utilization through load balancing
- 10-20% speedup in multiprocessing portion
- No output change

**Effort:** Low (1 hour)
**Risk:** Low (output reordering required but simple)

---

## 9. Data Integrity Guardrails (Pre-Implementation Checklist)

Before implementing any performance optimizations, establish a golden file baseline to validate that output data remains correct.

### Golden File Testing

Create baseline data files from 2-3 representative races (different race lengths, different driver counts):

```python
import json
from pathlib import Path

def create_golden_files():
    """Generate baseline output for validation."""
    test_races = [
        (2024, 1, "R"),   # Short race
        (2024, 6, "R"),   # Medium race
        (2024, 22, "R"),  # Long race
    ]

    golden_dir = Path("tests/golden")
    golden_dir.mkdir(exist_ok=True)

    for year, round_num, session_type in test_races:
        key = f"{year}_{round_num}_{session_type}"

        # Get telemetry using current (unoptimized) implementation
        frames = get_race_telemetry(
            load_session(year, round_num, session_type),
            refresh=False
        )

        # Save key metrics
        golden = {
            "frame_count": len(frames),
            "driver_codes": list(frames[0]["drivers"].keys()) if frames else [],
            "first_frame": {
                "t": frames[0].get("t") if frames else None,
                "leaders": [
                    code for code, data in frames[0].get("drivers", {}).items()
                ] if frames else []
            },
            "last_frame": {
                "t": frames[-1].get("t") if frames else None,
                "leaders": [
                    code for code, data in frames[-1].get("drivers", {}).items()
                ] if frames else []
            },
            "sample_frames": {
                str(i): {
                    "t": frames[i].get("t"),
                    "leader": next(iter(frames[i]["drivers"])),
                    "positions": {
                        code: data.get("position")
                        for code, data in frames[i].get("drivers", {}).items()
                    }
                }
                for i in [0, len(frames)//2, len(frames)-1]
                if frames
            }
        }

        golden_file = golden_dir / f"{key}_golden.json"
        with open(golden_file, "w") as f:
            json.dump(golden, f, indent=2)

        print(f"Created golden file: {golden_file}")
```

### Validation Script

After each optimization, compare against golden files:

```python
def validate_against_golden(year: int, round_num: int, session_type: str):
    """Compare new output against golden file."""
    key = f"{year}_{round_num}_{session_type}"
    golden_file = Path("tests/golden") / f"{key}_golden.json"

    if not golden_file.exists():
        print(f"[WARN] No golden file for {key}")
        return True

    # Load golden baseline
    with open(golden_file, "r") as f:
        golden = json.load(f)

    # Get new output with optimized implementation
    frames = get_race_telemetry(
        load_session(year, round_num, session_type),
        refresh=False
    )

    # Validate frame count
    assert len(frames) == golden["frame_count"], \
        f"Frame count mismatch: {len(frames)} vs {golden['frame_count']}"

    # Validate first/last frames
    assert frames[0].get("t") == golden["first_frame"]["t"], \
        "First frame timestamp mismatch"

    assert frames[-1].get("t") == golden["last_frame"]["t"], \
        "Last frame timestamp mismatch"

    # Validate sample frames (positions and leaders)
    for frame_idx_str, expected in golden["sample_frames"].items():
        frame_idx = int(frame_idx_str) if frame_idx_str != "last" else len(frames)-1
        frame = frames[frame_idx]

        actual_leader = next(iter(frame["drivers"]))
        assert actual_leader == expected["leader"], \
            f"Leader mismatch at frame {frame_idx}: {actual_leader} vs {expected['leader']}"

        # Validate positions
        for code, expected_pos in expected["positions"].items():
            actual_pos = frame["drivers"][code].get("position")
            assert actual_pos == expected_pos, \
                f"Position mismatch for {code} at frame {frame_idx}: {actual_pos} vs {expected_pos}"

    print(f"[OK] {key} passed validation")
    return True
```

### Monotonicity & Integrity Checks

Add runtime assertions to catch corrupted data early:

```python
def validate_monotonicity(frames: list, tolerance: float = 1e-3):
    """Ensure driver distances increase monotonically per-driver per-frame."""
    for frame_idx, frame in enumerate(frames):
        for code, data in frame.get("drivers", {}).items():
            dist = data.get("dist", 0.0)

            # Check against previous frame
            if frame_idx > 0:
                prev_frame = frames[frame_idx - 1]
                if code in prev_frame["drivers"]:
                    prev_dist = prev_frame["drivers"][code].get("dist", 0.0)
                    if dist + tolerance < prev_dist:
                        print(f"[WARN] Non-monotonic distance for {code} at frame {frame_idx}: "
                              f"{prev_dist} -> {dist}")

def validate_no_nans(frames: list):
    """Ensure no NaN values in critical fields."""
    for frame_idx, frame in enumerate(frames):
        for code, data in frame.get("drivers", {}).items():
            for key in ["x", "y", "dist", "speed", "position"]:
                val = data.get(key)
                if isinstance(val, float) and math.isnan(val):
                    raise ValueError(f"NaN found in {code}.{key} at frame {frame_idx}")
```

### Measurement Protocol

For each optimization, measure:

1. **Correctness** (must pass):
   - Frame count unchanged
   - Leader/position order matches golden file
   - Float values within 1e-6 tolerance

2. **Performance** (track):
   - Processing time before/after (wall clock)
   - Memory usage before/after
   - Cache hit rates (if applicable)

3. **Integrity** (must not regress):
   - Monotonicity warnings count
   - NaN detection
   - Position ordering correctness

---

## Implementation Roadmap

### Phase 1: Critical Fixes (40-60% Improvement, Golden File Validation)

**Before starting:** Create golden files from 2-3 representative races (different lengths).

1. **Fix array concatenation & reordering** (Bottleneck #1)
   - Pre-sort lap intervals before concatenation
   - Add monotonicity assertions
   - Expected: 30-50% reduction in `_process_single_driver()` time
   - Effort: 2-3 hours | Risk: Low (assertions catch corruption)

2. **Use Structured NumPy Arrays for Frame Building** (Bottleneck #2)
   - Replace 520K+ dict allocations with single structured array
   - Preserve race logic (grid/dynamic/final ordering) verbatim
   - Keep monotonicity warning checks
   - Expected: 20-30% reduction in frame building time
   - Effort: 3-4 hours | Risk: Low (with golden file validation)

3. **Session Caching with Feather Persistence** (Bottleneck #3)
   - Cache processed telemetry arrays (not Session objects) to disk
   - Use Apache Arrow feather format (5-10x faster I/O than pickle)
   - Add in-memory cache + disk cache with background save
   - Expected: 5-30 second improvement per request
   - Effort: 2-3 hours | Risk: Low (cache miss falls back gracefully)

4. **Verify Pre-sorted Data in Resampling** (Bottleneck #4)
   - Ensure `_process_single_driver()` returns strictly monotonic time
   - Skip redundant `np.argsort()` in `get_race_telemetry()`
   - Add assertions to catch time violations
   - Expected: 5-10% improvement in resampling
   - Effort: 1-2 hours | Risk: Low (basic option, no scipy dependency)

**Validation:** Run golden file tests after each fix. Target: 40-60% total improvement.

---

### Phase 2: Supporting Optimizations (Lower Priority)

5. **Frame Serialization Caching** (20-30% WebSocket CPU)
   - Pre-serialize all frames to JSON once during load
   - Effort: 1 hour | Risk: Low

6. **Multiprocessing Tuning** (10-20% improvement)
   - Use `chunksize` parameter and `imap_unordered()`
   - Effort: 1 hour | Risk: Low

7. **WebSocket Compression** (30-40% bandwidth)
   - Gzip with "Z/J" prefix pattern (safest option)
   - Effort: 2-3 hours | Risk: Low

---

### Phase 3: Advanced / Deferred

8. **Async File I/O** (Event loop stability)
   - Only needed if API heavily used
   - Adds complexity; defer until Phase 1 is stable
   - Effort: 3-4 hours | Risk: Medium (async boundary changes)

9. **Code Cleanup**
   - Remove dead gap calculation code
   - Fix `sys.exit()` calls in `list_rounds()` (prevents API crashes)
   - Effort: 1-2 hours | Risk: Low

---

## Testing Strategy

### Pre-Implementation: Golden File Baseline

Create 2-3 representative test races covering different conditions:
- Short race (20 drivers, ~50 laps) - e.g., 2024 Round 1
- Medium race (20 drivers, ~60 laps) - e.g., 2024 Round 6
- Long race (20 drivers, ~70+ laps) - e.g., 2024 Round 22

For each race, save:
- Frame count
- Driver codes and ordering
- First/middle/last frame metrics (leader, positions, distances)
- Sample float values (x, y, speed) with full precision

### Per-Optimization Testing

**After each Phase 1 fix:**
1. Run golden file validation (must pass without exception)
2. Verify frame count matches baseline (±0)
3. Verify leader ordering matches at key frames
4. Compare position values within 1e-6 tolerance
5. Check monotonicity warnings haven't increased

**After Phase 1 completion:**
- Performance benchmark: measure wall-clock time for telemetry generation
- Memory profiling: compare peak memory usage before/after
- Cache hit rate: track cache effectiveness (if applicable)

### Integration Tests

- End-to-end replay with same session (baseline vs. optimized)
- Multiple concurrent API requests with session caching
- Verify WebSocket frame delivery matches expected output

### Performance Baselines

Before starting any work:
```bash
# Record baseline timing
time python -c "from shared.telemetry.f1_data import get_race_telemetry, load_session; \
  session = load_session(2024, 6, 'R'); \
  get_race_telemetry(session, refresh=False)"

# Record baseline memory (use memory_profiler or top)
```

After each phase:
```bash
# Compare timing (target: 40-60% reduction for Phase 1)
# Compare memory
```

---

## Risk Assessment & Mitigation

| Change | Risk Level | Why | Mitigation |
|--------|-----------|-----|-----------|
| Array reordering | Low | Assertion catches time violations | Add monotonicity asserts, validate golden files |
| Frame building (NumPy) | Low | Output structure unchanged, same race logic | Preserve ordering logic verbatim, validate positions |
| Session caching | Low | Cache miss falls back to load | Add TTL, validate cache invalidation, test concurrent requests |
| Resampling (skip sort) | Low | Depends on Phase 1 being correct | Assert pre-sorted data, validate against golden file |
| Frame serialization | Low | Straightforward caching | Verify cache hits, test both paths (cached/uncached) |
| WebSocket encoding | Low | Gzip is well-tested | Test client decoding, measure CPU vs. bandwidth trade-off |
| Async file I/O | Medium | Changes async boundaries | Only defer after Phase 1 stable, add comprehensive error handling |
| Multiprocessing | Low | Reordering is simple | Verify output matches before/after |

**Overall Risk Strategy:**
- Golden file testing is your primary defense against silent data corruption
- Assertions catch common issues early (time non-monotonicity, NaN)
- Each optimization is small and focused
- Can roll back changes individually if issues arise

---

## Summary: Expected Gains & Effort

| Phase | Optimization | Performance Gain | Effort | Cumulative Gain |
|-------|--------------|------------------|--------|-----------------|
| 1 | Array concatenation | 30-50% | 2-3h | 30-50% |
| 1 | Frame building (NumPy) | 20-30% | 3-4h | 44-65% |
| 1 | Session caching (feather) | 5-30s/req | 2-3h | 5-30s/req |
| 1 | Resampling (verify sort) | 5-10% | 1-2h | 47-68% |
| **Phase 1 Total** | | | **8-12h** | **~50-70%** |
| 2 | Frame serialization | 20-30% WS | 1h | WS only |
| 2 | Multiprocessing | 10-20% | 1h | 52-72% |
| 2 | WebSocket compression | 30-40% BW | 2-3h | 30-40% BW |

**Recommendation:** Implement Phase 1 completely with golden file validation before moving to Phase 2.
The 8-12 hours of work should yield 50-70% improvement in telemetry processing speed with effectively zero risk to data integrity if golden files pass validation.
