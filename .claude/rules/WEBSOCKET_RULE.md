# WebSocket Rule

**Status:** Active
**Severity:** CRITICAL
**Applies To:** `backend/app/websocket.py`, `frontend/src/hooks/useReplayWebSocket.ts`
**Effective Date:** December 21, 2025

## Rule Statement

Any change to WebSocket connection logic, frame streaming, or async/thread coordination **MUST** include a spike validating thread-safe handoff between background telemetry loading and the main asyncio loop. This file handles the bridge between Python's threading and async paradigms—a bug here causes silent data loss or frontend freezes.

---

## When This Rule Applies

### Changes That Require Spike Validation

✅ **REQUIRES** spike prototype:
- Changes to frame streaming logic
- Modifications to how backend sends frames to frontend
- Changes to async/await patterns
- Updates to thread-safe coordination (use of locks, queues, events)
- Changes to error handling or timeout behavior
- Modifications to how connection state is tracked
- Changes to message serialization or format
- Any new use of `asyncio.run_coroutine_threadsafe()`

### Changes That DON'T Require Spike

❌ **DOES NOT REQUIRE** spike:
- Documentation updates
- Logging additions
- Variable renaming
- Comment updates
- Type annotations (no behavior change)
- Formatting improvements

---

## Spike Requirements

**Before planning or implementing, you MUST create a minimal prototype** that proves your approach works.

### Spike 1: Thread-to-Async Handoff (if you modify coordination)

```python
# Minimal prototype demonstrating thread → asyncio communication

import asyncio
import threading
from queue import Queue

async def main():
    """
    Prove that:
    1. Background thread can safely queue frames
    2. asyncio loop can process them without blocking
    3. No race conditions on shared state
    """
    frames_queue = Queue()

    def background_worker():
        """Simulates f1_data.py processing"""
        for i in range(100):
            # Simulate frame generation
            frame = {"index": i, "data": [1, 2, 3]}
            frames_queue.put(frame)  # Thread-safe

    async def frame_processor():
        """Simulates streaming to frontend"""
        loop = asyncio.get_event_loop()
        while True:
            # Non-blocking check
            frame = await loop.run_in_executor(None, frames_queue.get)
            # Process frame
            print(f"Processing frame {frame['index']}")

    # Start background thread
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()

    # Run asyncio processor
    await frame_processor()

# Validate: No deadlocks, no race conditions, data integrity
```

**Your spike must prove:**
- [ ] Background thread can queue data without blocking asyncio loop
- [ ] asyncio loop can process queued frames without polling
- [ ] No deadlocks when thread and loop both access shared state
- [ ] Connection loss doesn't crash either thread

### Spike 2: Frame Serialization (if you change frame format)

```python
# Minimal prototype validating JSON serialization

import json
import numpy as np

def serialize_frame(frame):
    """
    Prove that:
    1. All frame fields are JSON-serializable
    2. No NumPy arrays slip through
    3. Performance is acceptable
    """
    # Frame is dict with driver data
    serializable = {
        "t": float(frame["t"]),  # Convert any numeric to float
        "lap": int(frame["lap"]),
        "drivers": {
            code: {
                "position": int(data["position"]),
                "x": float(data["x"]),
                "y": float(data["y"]),
                # ... all numeric fields converted explicitly
            }
            for code, data in frame["drivers"].items()
        }
    }

    # Validate: This must succeed
    json_str = json.dumps(serializable)

    # Validate: Frontend can parse it back
    parsed = json.loads(json_str)

    assert frame["t"] == parsed["t"]  # Data integrity
    return json_str

# Validate: No NumPy types in output, reasonable serialization time
```

**Your spike must prove:**
- [ ] All frame fields serialize to JSON
- [ ] No NumPy arrays/types in output
- [ ] Data integrity preserved (no loss of precision)
- [ ] Serialization time is acceptable (<100ms per frame)

### Spike 3: Connection Error Handling (if you change error behavior)

```python
# Minimal prototype validating error scenarios

async def websocket_with_errors():
    """
    Prove that:
    1. Client disconnect doesn't crash server
    2. Frame streaming resumes after reconnect
    3. No orphaned threads/tasks
    """
    async with websockets.serve(handler, "localhost", 8000) as server:
        # Simulate normal streaming
        # Simulate client disconnect
        # Verify: handler completes gracefully

        # Simulate reconnect
        # Verify: new session works independently

        # Simulate frame processing error
        # Verify: error is logged, stream continues
        # Verify: no thread left hanging

# Validate: Server stays healthy after errors
```

**Your spike must prove:**
- [ ] Client disconnect doesn't crash server
- [ ] Error in one session doesn't affect others
- [ ] Reconnect works without side effects
- [ ] No resource leaks (threads, connections, memory)

---

## Planning Requirements

Your plan MUST include:

### Section 1: Spike Results
Paste the output of your spike validation. Show it works.

### Section 2: Concurrency Model
Document:
- How does your code coordinate between threads and asyncio?
- What synchronization primitives are used? (locks, queues, events)
- What state is shared? How is it protected?
- What happens if frame processing falls behind?
- What happens if the frontend is slower than frame generation?

### Section 3: Frame Contract
Document:
- What fields must every frame have?
- What are the types? (int, float, string, etc.)
- What are the constraints? (ranges, allowed values)
- How does the frontend use each field?
- What happens if a field is missing or invalid?

### Section 4: Error Scenarios
List and plan for:
- Client disconnect mid-stream
- Server-side exception during streaming
- Frame processing too slow
- Frontend doesn't keep up with stream
- Memory fills with buffered frames
- Connection timeout

For each, describe your handling.

### Section 5: Testing Plan
Define tests for:
- Normal frame streaming (100+ frames)
- Client disconnect and reconnect
- Concurrent sessions
- Server error during streaming
- Frame with missing/invalid data
- Slow client (frontend lags backend)

---

## Implementation Constraints

When implementing:

### ✅ DO
- Use `asyncio.run_in_executor()` for blocking operations
- Use `Queue` or `asyncio.Queue` for thread-safe communication
- Validate all data before sending to frontend
- Convert NumPy types to Python types before JSON
- Handle disconnect gracefully (close cleanly, cleanup resources)
- Log state transitions and errors
- Use timeouts to prevent hanging

### ❌ DON'T
- Block the asyncio loop with synchronous operations
- Use `while True` with `sleep()` for polling (use async events)
- Send NumPy arrays or objects directly in JSON
- Assume frontend is always ready to receive
- Share mutable state between threads without locks
- Keep frames in memory indefinitely
- Assume connection is always healthy

---

## Code Review Checklist

When code review examines this, they verify:

- [ ] **Spike validated** - Concurrency model proven in prototype
- [ ] **No blocking** - asyncio loop never blocks on I/O or computation
- [ ] **Thread-safe** - Shared state protected with locks/queues
- [ ] **JSON serialization** - No NumPy types, explicit conversion
- [ ] **Error handling** - All failure modes handled
- [ ] **Resource cleanup** - No leaks on disconnect/error
- [ ] **Frame contract** - Clear data structure documented
- [ ] **Performance** - Streaming latency acceptable
- [ ] **Testing** - Edge cases tested (disconnect, slow client, etc.)
- [ ] **Backward compatibility** - Old clients still work

---

## Related Rules

- [REPLAY_SERVICE_RULE.md](./REPLAY_SERVICE_RULE.md) - If you change session orchestration
- [F1_DATA_REVIEW_RULE.md](./F1_DATA_REVIEW_RULE.md) - If you change data loading
- [WEBSOCKET_HOOK_RULE.md](./WEBSOCKET_HOOK_RULE.md) - If you change frontend connection handling

---

## Why This Rule Exists

`websocket.py` is where Python's threading model (used by f1_data.py) meets asyncio (used by FastAPI). This is a dangerous boundary where subtle bugs occur:

- Background thread queues frame → Main loop processes it
- If not coordinated properly: deadlocks, data loss, frozen frontend

Past issues include:
- Blocking the asyncio loop while waiting for frames
- Using `time.sleep()` instead of `asyncio.sleep()`
- Serializing NumPy arrays directly (crashes on JSON)
- Not cleaning up connections on error (resource leak)
- Assuming frames arrive in order (they don't if buffered)

The spike requirement forces you to prove the concurrency model works **before** integrating into the full system. This catches problems early.
