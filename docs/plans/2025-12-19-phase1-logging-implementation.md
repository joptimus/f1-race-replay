# Phase 1: Logging & Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured logging throughout the data pipeline so you can see exactly where failures happen during session loading, frame serialization, and WebSocket streaming.

**Architecture:** Add logging at 4 critical points using Python's standard logging module with structured prefix tags ([SESSION], [FRAME], [WS], [SERIALIZE]). This replaces scattered print statements with consistent, timestamped, contextual logging that makes debugging much easier.

**Tech Stack:** Python `logging` module (standard library), existing FastAPI/WebSocket infrastructure, msgpack library.

---

## Task 1: Set up Logging Configuration

**Files:**
- Create: `backend/core/logging.py`
- Modify: `backend/main.py` to import and configure logging

**Step 1: Create logging configuration module**

Create a new file `backend/core/logging.py`:

```python
import logging
import sys
from pathlib import Path

def setup_logging(log_level=logging.INFO):
    """Configure structured logging for the F1 Race Replay backend"""

    # Create formatters
    detailed_formatter = logging.Formatter(
        '[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(console_handler)

    return root_logger

def get_logger(name: str) -> logging.Logger:
    """Get a logger for a specific module"""
    return logging.getLogger(name)
```

**Step 2: Update backend/main.py to use logging**

In `backend/main.py`, add at the top after imports:

```python
from backend.core.logging import setup_logging

# Initialize logging
setup_logging()
```

And replace the existing print statements in the lifespan function:

```python
import logging

logger = logging.getLogger("backend.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("F1 Race Replay API starting...")
    yield
    logger.info("F1 Race Replay API shutting down...")
```

**Step 3: Verify logging works**

Run the backend:
```bash
python backend/main.py
```

Expected output should show timestamped log messages like:
```
[2025-12-19 10:30:45] [backend.main] [INFO] F1 Race Replay API starting...
```

**Step 4: Commit**

```bash
git add backend/core/logging.py backend/main.py
git commit -m "feat: add structured logging configuration"
```

---

## Task 2: Add Session Loading Logging

**Files:**
- Modify: `backend/app/services/replay_service.py` (F1ReplaySession class)

**Step 1: Add logging import and logger**

At the top of `replay_service.py`, add:

```python
import logging
import time

logger = logging.getLogger("backend.services.replay")
```

**Step 2: Add timing to load_data method**

Replace the `load_data` method with enhanced version:

```python
async def load_data(self):
    load_start_time = time.time()
    session_id = f"{self.year}_{self.round_num}_{self.session_type}"

    try:
        logger.info(f"[SESSION] Starting load for {session_id} (refresh={self.refresh})")
        self.loading_status = f"Loading session {self.year} R{self.round_num}..."

        session = load_session(self.year, self.round_num, self.session_type)
        logger.info(f"[SESSION] FastF1 session loaded for {session_id}")

        self.loading_status = "Session loaded, fetching telemetry..."
        telemetry_start = time.time()

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
            self.race_start_time = data.get("race_start_time", None)

        telemetry_time = time.time() - telemetry_start
        logger.info(f"[SESSION] Generated {len(self.frames)} frames in {telemetry_time:.1f}s for {session_id}")

        self.driver_numbers = self._extract_driver_numbers(session)
        self.driver_teams = self._extract_driver_teams(session)
        logger.info(f"[SESSION] Extracted {len(self.driver_numbers)} drivers for {session_id}")

        self.loading_status = f"Loaded {len(self.frames)} frames, building track geometry..."

        try:
            geometry_start = time.time()
            fastest_lap_obj = session.laps.pick_fastest()
            fastest_lap_telem = fastest_lap_obj.get_telemetry()
            track_data = build_track_from_example_lap(fastest_lap_telem, lap_obj=fastest_lap_obj)
            geometry_time = time.time() - geometry_start

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
            if track_data[10] is not None:
                self.track_geometry["sector"] = [int(s) for s in track_data[10]]

            logger.info(f"[SESSION] Track geometry built in {geometry_time:.2f}s for {session_id}")
        except Exception as e:
            logger.warning(f"[SESSION] Could not build track geometry for {session_id}: {e}")
            self.track_geometry = None

        self.loading_status = f"Pre-serializing {len(self.frames)} frames..."
        serialize_start = time.time()
        self._pre_serialize_frames()
        serialize_time = time.time() - serialize_start

        total_time = time.time() - load_start_time
        logger.info(f"[SESSION] Session {session_id} fully loaded in {total_time:.1f}s (serialize: {serialize_time:.1f}s)")
        self.is_loaded = True

    except Exception as e:
        load_time = time.time() - load_start_time
        logger.error(f"[SESSION] Failed to load {session_id} after {load_time:.1f}s: {e}", exc_info=True)
        self.load_error = str(e)
        self.is_loaded = True
```

**Step 3: Add logging to _pre_serialize_frames**

Add logging to the method:

```python
def _pre_serialize_frames(self) -> None:
    if not self.frames:
        logger.debug(f"[SERIALIZE] No frames to serialize")
        self._serialized_frames = []
        self._msgpack_frames = []
        return

    frame_count = len(self.frames)
    if frame_count > 50000:
        logger.info(f"[SERIALIZE] Large session ({frame_count} frames), using lazy serialization")
        self._serialized_frames = None
        self._msgpack_frames = None
    else:
        logger.info(f"[SERIALIZE] Pre-serializing all {frame_count} frames...")
        serialize_start = time.time()

        self._serialized_frames = [
            self._build_frame_payload_json(i) for i in range(frame_count)
        ]
        self._msgpack_frames = [
            self._build_frame_payload_msgpack(i) for i in range(frame_count)
        ]

        serialize_time = time.time() - serialize_start
        total_size = sum(len(f) for f in self._msgpack_frames)
        avg_size = total_size / frame_count if frame_count > 0 else 0

        logger.info(f"[SERIALIZE] Pre-serialized {frame_count} frames in {serialize_time:.1f}s (avg {avg_size:.0f} bytes/frame, total {total_size/1024/1024:.1f}MB)")
```

**Step 4: Run and verify**

Start the backend and request a session to see logging output:

```bash
python backend/main.py
```

In another terminal, test session creation:

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "round_num": 1, "session_type": "R", "refresh": false}'
```

Expected logs in backend output:
```
[2025-12-19 10:35:22] [backend.services.replay] [INFO] [SESSION] Starting load for 2025_1_R (refresh=False)
[2025-12-19 10:35:25] [backend.services.replay] [INFO] [SESSION] FastF1 session loaded for 2025_1_R
[2025-12-19 10:35:30] [backend.services.replay] [INFO] [SESSION] Generated 1500 frames in 5.2s for 2025_1_R
...
```

**Step 5: Commit**

```bash
git add backend/app/services/replay_service.py
git commit -m "feat: add detailed session loading logging with timing"
```

---

## Task 3: Add Frame Serialization Logging

**Files:**
- Modify: `backend/app/services/replay_service.py` (serialization methods)

**Step 1: Add logging to _build_frame_payload_msgpack**

Wrap the method with logging:

```python
def _build_frame_payload_msgpack(self, frame_index: int) -> bytes:
    def safe_float(value, default=0.0):
        try:
            f = float(value)
            if f != f or not (-1e308 < f < 1e308):
                return default
            return f
        except (ValueError, TypeError):
            return default

    try:
        frame = self.frames[frame_index]

        payload = {
            "frame_index": frame_index,
            "t": safe_float(frame.get("t"), 0.0),
            "lap": frame.get("lap", 1),
            "drivers": {},
        }

        for driver_code, driver_data in frame.get("drivers", {}).items():
            payload["drivers"][driver_code] = {
                "x": safe_float(driver_data.get("x")),
                "y": safe_float(driver_data.get("y")),
                "speed": safe_float(driver_data.get("speed")),
                "gear": int(driver_data.get("gear", 0)),
                "lap": int(driver_data.get("lap", 0)),
                "position": int(driver_data.get("position", 0)),
                "tyre": int(driver_data.get("tyre", 0)),
                "throttle": safe_float(driver_data.get("throttle")),
                "brake": safe_float(driver_data.get("brake")),
                "drs": int(driver_data.get("drs", 0)),
                "dist": safe_float(driver_data.get("dist")),
                "rel_dist": safe_float(driver_data.get("rel_dist")),
                "race_progress": safe_float(driver_data.get("race_progress")),
                "lap_time": safe_float(driver_data.get("lap_time")) if driver_data.get("lap_time") is not None else None,
                "sector1": safe_float(driver_data.get("sector1")) if driver_data.get("sector1") is not None else None,
                "sector2": safe_float(driver_data.get("sector2")) if driver_data.get("sector2") is not None else None,
                "sector3": safe_float(driver_data.get("sector3")) if driver_data.get("sector3") is not None else None,
                "status": driver_data.get("status", "Running"),
            }

        if "weather" in frame:
            payload["weather"] = frame["weather"]

        packed = msgpack.packb(payload, use_bin_type=True)

        if frame_index % 100 == 0:  # Log every 100th frame to avoid spam
            logger.debug(f"[SERIALIZE] Frame {frame_index}: {len(packed)} bytes, {len(payload['drivers'])} drivers")

        return packed

    except Exception as e:
        logger.error(f"[SERIALIZE] Failed to serialize frame {frame_index}: {e}", exc_info=True)
        return msgpack.packb({"error": f"Serialization failed for frame {frame_index}"}, use_bin_type=True)
```

**Step 2: Add logging to serialize_frame_msgpack**

Update the public method:

```python
def serialize_frame_msgpack(self, frame_index: int) -> bytes:
    if not self.frames or frame_index < 0 or frame_index >= len(self.frames):
        logger.warning(f"[SERIALIZE] Invalid frame index: {frame_index} (total frames: {len(self.frames) if self.frames else 0})")
        return msgpack.packb({"error": "Invalid frame index"}, use_bin_type=True)

    try:
        # Use cached version if available
        if self._msgpack_frames:
            return self._msgpack_frames[frame_index]

        # Fall back to on-demand serialization for large sessions
        return self._build_frame_payload_msgpack(frame_index)
    except Exception as e:
        logger.error(f"[SERIALIZE] Unexpected error serializing frame {frame_index}: {e}", exc_info=True)
        return msgpack.packb({"error": "Serialization error"}, use_bin_type=True)
```

**Step 3: Verify with test**

Run the backend and request a few frames:

```bash
python backend/main.py
```

Create a session and wait for it to load, then in another terminal:

```bash
python tests/test_websocket_connection.py
```

Check backend logs for serialization messages.

**Step 4: Commit**

```bash
git add backend/app/services/replay_service.py
git commit -m "feat: add frame serialization logging with error handling"
```

---

## Task 4: Add WebSocket Streaming Logging

**Files:**
- Modify: `backend/app/websocket.py` (handle_replay_websocket function)

**Step 1: Add logging and timing to WebSocket handler**

Replace the entire `handle_replay_websocket` function:

```python
import asyncio
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
import sys
from pathlib import Path
import msgpack

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

logger = logging.getLogger("backend.websocket")

async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    connection_start = time.time()

    try:
        await websocket.accept(subprotocol=None)
        logger.info(f"[WS] Client connected for session {session_id}")

        if session_id not in active_sessions:
            logger.warning(f"[WS] Session {session_id} not found. Available: {list(active_sessions.keys())}")
            await websocket.send_json({"error": "Session not found"})
            await websocket.close()
            return

        session = active_sessions[session_id]

        # Wait for session to load with timeout
        load_timeout = 300  # 5 minutes max
        load_start = asyncio.get_event_loop().time()
        load_check_interval = 0.5
        last_status_sent = 0

        while not session.is_loaded:
            elapsed = asyncio.get_event_loop().time() - load_start

            # Send status update every 2 seconds
            if elapsed - last_status_sent > 2.0:
                try:
                    await websocket.send_json({
                        "type": "status",
                        "message": session.loading_status or "Loading...",
                        "elapsed_seconds": int(elapsed)
                    })
                    last_status_sent = elapsed
                    logger.debug(f"[WS] Sent status update to {session_id}: {session.loading_status}")
                except Exception as status_error:
                    logger.warning(f"[WS] Failed to send status update to {session_id}: {status_error}")
                    break

            if elapsed > load_timeout:
                logger.error(f"[WS] Session load timeout for {session_id} after {elapsed:.1f}s")
                await websocket.send_json({"error": f"Session load timeout after {elapsed:.0f}s"})
                await websocket.close()
                return

            await asyncio.sleep(load_check_interval)

        if session.load_error:
            logger.error(f"[WS] Session {session_id} has load error: {session.load_error}")
            await websocket.send_json({"error": session.load_error})
            await websocket.close()
            return

        load_time = asyncio.get_event_loop().time() - load_start
        logger.info(f"[WS] Session {session_id} loaded with {len(session.frames)} frames in {load_time:.1f}s")

        # Send ready message
        await websocket.send_json({
            "type": "ready",
            "frames": len(session.frames),
            "load_time_seconds": load_time
        })

        # Playback state
        frame_index = 0.0
        playback_speed = 1.0
        is_playing = False
        last_frame_sent = -1
        frames_sent = 0
        send_start_time = time.time()

        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)

                    if data.get("action") == "play":
                        is_playing = True
                        playback_speed = data.get("speed", 1.0)
                        logger.debug(f"[WS] Play command for {session_id}: speed={playback_speed}")
                    elif data.get("action") == "pause":
                        is_playing = False
                        logger.debug(f"[WS] Pause command for {session_id}")
                    elif data.get("action") == "seek":
                        frame_index = float(data.get("frame", 0))
                        last_frame_sent = -1
                        logger.debug(f"[WS] Seek command for {session_id}: frame={frame_index}")

                except asyncio.TimeoutError:
                    pass
                except (WebSocketDisconnect, RuntimeError) as disconnect_error:
                    if isinstance(disconnect_error, RuntimeError) and "disconnect" not in str(disconnect_error).lower():
                        logger.debug(f"[WS] Error receiving command from {session_id}: {disconnect_error}")
                        continue
                    logger.info(f"[WS] Client disconnected from {session_id}")
                    break
                except Exception as cmd_error:
                    logger.warning(f"[WS] Unexpected error receiving command from {session_id}: {cmd_error}")
                    continue

                try:
                    if is_playing:
                        frame_index += playback_speed * (1.0 / 60.0) * 25

                    current_frame = int(frame_index)
                    if current_frame != last_frame_sent and 0 <= current_frame < len(session.frames):
                        send_time_start = time.time()
                        frame_data = session.serialize_frame_msgpack(current_frame)
                        send_time = time.time() - send_time_start

                        await websocket.send_bytes(frame_data)
                        frames_sent += 1
                        last_frame_sent = current_frame

                        if frames_sent % 100 == 0:  # Log every 100 frames
                            elapsed_send = time.time() - send_start_time
                            frame_rate = frames_sent / elapsed_send if elapsed_send > 0 else 0
                            logger.debug(f"[WS] {session_id}: sent frame {current_frame} ({len(frame_data)} bytes, {send_time*1000:.1f}ms), {frames_sent} total, {frame_rate:.1f} fps")

                    if frame_index >= len(session.frames):
                        is_playing = False
                        frame_index = len(session.frames) - 1
                        logger.debug(f"[WS] Playback completed for {session_id}")

                    await asyncio.sleep(1 / 60)

                except (WebSocketDisconnect, RuntimeError) as disconnect_error:
                    if isinstance(disconnect_error, RuntimeError) and "disconnect" not in str(disconnect_error).lower():
                        logger.error(f"[WS] Error sending frame to {session_id}: {disconnect_error}")
                        break
                    logger.info(f"[WS] Client disconnected while sending frames to {session_id}")
                    break
                except Exception as send_error:
                    logger.error(f"[WS] Unexpected error sending frame to {session_id}: {send_error}", exc_info=True)
                    break

        except (WebSocketDisconnect, RuntimeError) as e:
            if isinstance(e, RuntimeError) and "disconnect" not in str(e).lower():
                logger.error(f"[WS] Unexpected error in playback loop for {session_id}: {e}")
                import traceback
                traceback.print_exc()
        except Exception as e:
            logger.error(f"[WS] Unexpected WebSocket error for {session_id}: {e}", exc_info=True)
        finally:
            total_time = time.time() - connection_start
            logger.info(f"[WS] Connection closed for {session_id} after {total_time:.1f}s ({frames_sent} frames sent)")
            try:
                await websocket.close()
            except Exception as close_error:
                logger.debug(f"[WS] Error closing WebSocket for {session_id}: {close_error}")
    except Exception as e:
        logger.error(f"[WS] Critical error handling {session_id}: {e}", exc_info=True)
```

**Step 2: Run and verify**

Start the backend:

```bash
python backend/main.py
```

Run the WebSocket test:

```bash
python tests/test_websocket_connection.py
```

Check backend logs for WebSocket messages showing:
- Client connection
- Status updates during load
- Frames sent with timing
- Completion metrics

**Step 3: Commit**

```bash
git add backend/app/websocket.py
git commit -m "feat: add comprehensive WebSocket logging with metrics"
```

---

## Task 5: Test Full Pipeline and Verify Logging

**Files:**
- No new files, just testing existing code

**Step 1: Start backend with full logging**

```bash
python backend/main.py
```

Expected to see logs with prefix tags like [SESSION], [SERIALIZE], [WS]

**Step 2: Run test in another terminal**

```bash
python tests/test_websocket_connection.py
```

**Step 3: Verify log output**

Check backend logs contain (in order):
```
[SESSION] Starting load for 2025_1_R
[SERIALIZE] Pre-serializing all X frames...
[WS] Client connected
[WS] Sent status update: Loading...
[SESSION] Session fully loaded
[WS] Session loaded with X frames
[WS] Playback completed
```

**Step 4: Document logging format**

Create a simple reference in backend code:

In `backend/app/websocket.py`, add this comment at the top:

```python
"""
WebSocket frame streaming with structured logging.

Log Tags:
  [WS]        - WebSocket connection lifecycle and frame sending
  [SESSION]   - Session loading and data processing (in replay_service.py)
  [SERIALIZE] - Frame serialization and validation (in replay_service.py)

Example output:
  [WS] Client connected for session 2025_1_R
  [SESSION] Generated 1500 frames in 5.2s
  [SERIALIZE] Frame 42: 4156 bytes, 20 drivers
"""
```

**Step 5: Commit**

```bash
git add backend/app/websocket.py
git commit -m "docs: add logging format documentation"
```

---

## Phase 1 Complete

You now have:
✅ Structured logging at all critical points
✅ Timing information on session loading and serialization
✅ Frame-level serialization visibility
✅ WebSocket connection metrics
✅ Easy-to-spot log tags ([SESSION], [WS], [SERIALIZE])

This gives you immediate visibility into where failures happen. Use these logs to diagnose the reconnection loop and data streaming issues.

**Next Steps:** After reviewing these logs during a problematic session load, you'll have clear data to move to Phase 2 (Connection Stability & Error Recovery).
