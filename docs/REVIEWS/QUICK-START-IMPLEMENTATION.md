# Quick Start Implementation Guide

**Status:** Ready to Code
**Date:** December 21, 2025
**Time Estimate:** ~3.5 hours total

---

## Before You Start

1. **Read this first:** [FINAL-PLAN-SUMMARY.md](./FINAL-PLAN-SUMMARY.md) (5 min)
2. **Know the bugs:** [PEER-REVIEW-FEEDBACK-INCORPORATED.md](./PEER-REVIEW-FEEDBACK-INCORPORATED.md) (10 min)
3. **Reference while coding:** [loading-state-fix-implementation-plan.md](./loading-state-fix-implementation-plan.md) (detailed spec)
4. **Watch for:** Implementation Warnings section in main plan (Double Modal Trap, WebSocket Subprotocol)

---

## Phase 1: Backend (Python) - ~70 minutes

### Step 1.1: Add LoadingState Enum to F1ReplaySession

**File:** `backend/app/services/replay_service.py`

```python
from enum import Enum

class LoadingState(Enum):
    """Session loading state machine."""
    INIT = "init"           # Initial state
    LOADING = "loading"     # Data loading in progress
    READY = "ready"         # Ready for playback
    ERROR = "error"         # Loading failed
```

### Step 1.2: Update F1ReplaySession Class

**File:** `backend/app/services/replay_service.py`

Add these fields to the `__init__` method:

```python
def __init__(self, year, round_num, session_type):
    # ... existing init code ...

    # NEW: Loading state tracking
    self.state = LoadingState.INIT
    self.progress = 0
    self.loading_status = "Initializing..."
    self.progress_callbacks = []  # List of async callbacks
    self.load_error = None
```

### Step 1.3: Add Progress Registration Methods

**File:** `backend/app/services/replay_service.py`

Add these methods to `F1ReplaySession`:

```python
def register_progress_callback(self, callback):
    """Register a callback to be called on progress updates."""
    self.progress_callbacks.append(callback)

def unregister_progress_callback(self, callback):
    """Unregister a progress callback (prevents memory leak)."""
    if callback in self.progress_callbacks:
        self.progress_callbacks.remove(callback)

async def emit_progress(self, state: LoadingState, progress: int = None, message: str = None):
    """Emit progress event to all registered callbacks."""
    self.state = state
    if message:
        self.loading_status = message
    if progress is not None:
        self.progress = progress

    # CRITICAL: Use explicit None check, not truthiness check
    # (because progress=0 is falsy and would be skipped otherwise)
    effective_progress = self.progress if progress is None else progress
    effective_message = self.loading_status if message is None else message

    # Call all registered callbacks
    for callback in self.progress_callbacks:
        try:
            await callback(state, effective_progress, effective_message)
        except Exception as e:
            logger.warning(f"Error in progress callback: {e}")
```

### Step 1.4: Update load_data() to Emit Progress

**File:** `backend/app/services/replay_service.py`

Modify the `load_data()` method to emit progress:

```python
async def load_data(self):
    """Load race telemetry with progress emission."""
    try:
        await self.emit_progress(LoadingState.LOADING, 0, "Starting telemetry load...")

        # Load data
        if self.session_type == "R":
            self.frames, self.metadata = await asyncio.to_thread(
                get_race_telemetry,
                self.session,
            )
        elif self.session_type == "Q":
            self.frames, self.metadata = await asyncio.to_thread(
                get_quali_telemetry,
                self.session,
            )
        elif self.session_type == "S":
            self.frames, self.metadata = await asyncio.to_thread(
                get_sprint_telemetry,
                self.session,
            )
        else:
            raise ValueError(f"Unknown session type: {self.session_type}")

        # Emit final progress
        await self.emit_progress(LoadingState.READY, 100, "Ready for playback")
        self.is_loaded = True

    except Exception as e:
        self.load_error = str(e)
        await self.emit_progress(LoadingState.ERROR, 0, f"Error: {e}")
        logger.error(f"Error loading session: {e}", exc_info=True)
```

### Step 1.5: Simplify POST /api/sessions Endpoint

**File:** `backend/app/api/sessions.py`

Update the POST endpoint to return ONLY the sessionId:

```python
@router.post("/sessions")
async def create_session(request: CreateSessionRequest):
    """Create a new replay session."""
    session_id = f"{request.year}_{request.round_num}_{request.session_type}"

    # Create session and start loading in background
    session = F1ReplaySession(request.year, request.round_num, request.session_type)
    active_sessions[session_id] = session

    # Start loading asynchronously (don't wait for it)
    asyncio.create_task(session.load_data())

    # Return ONLY sessionId - loading status comes via WebSocket
    return {"session_id": session_id}
```

### Step 1.6: Update WebSocket Handler to Emit Loading Events

**File:** `backend/app/websocket.py`

Replace the WebSocket handler to register progress callbacks and emit messages:

```python
async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    """
    WebSocket handler for F1 replay. Single connection for both loading state and frame streaming.
    """
    connection_start = time.time()
    session = None
    progress_callback = None

    try:
        await websocket.accept(subprotocol=None)
        logger.info(f"[WS] Client connected for session {session_id}")

        if session_id not in active_sessions:
            logger.warning(f"[WS] Session {session_id} not found")
            await websocket.send_json({
                "type": "loading_error",
                "message": "Session not found"
            })
            await websocket.close()
            return

        session = active_sessions[session_id]

        # Register progress callback to emit WebSocket events during loading
        async def progress_callback_fn(state: LoadingState, progress: int, message: str):
            """Called by session.load_data() as it processes telemetry."""
            try:
                await websocket.send_json({
                    "type": "loading_progress",
                    "progress": progress,
                    "message": message,
                    "elapsed_seconds": int(time.time() - connection_start)
                })
                logger.debug(f"[WS] Sent progress to {session_id}: {progress}% - {message}")
            except Exception as e:
                logger.warning(f"[WS] Failed to send progress for {session_id}: {e}")

        progress_callback = progress_callback_fn
        session.register_progress_callback(progress_callback)

        # CRITICAL FIX: Handle "late joiner" scenario where session is already loaded
        if session.is_loaded:
            logger.debug(f"[WS] Session {session_id} already loaded, sending catch-up events")
            await websocket.send_json({
                "type": "loading_progress",
                "progress": session.progress or 100,
                "message": session.loading_status or "Ready for playback",
                "elapsed_seconds": int(time.time() - connection_start)
            })
            await websocket.send_json({
                "type": "loading_complete",
                "frames": len(session.frames),
                "load_time_seconds": 0,
                "elapsed_seconds": int(time.time() - connection_start)
            })
        else:
            # Wait for session to load
            load_timeout = 300  # 5 minutes
            load_start = time.time()

            while not session.is_loaded:
                elapsed = time.time() - load_start
                if elapsed > load_timeout:
                    await websocket.send_json({
                        "type": "loading_error",
                        "message": f"Session load timeout after {elapsed:.0f}s"
                    })
                    await websocket.close()
                    return
                await asyncio.sleep(0.5)

            if session.load_error:
                await websocket.send_json({
                    "type": "loading_error",
                    "message": session.load_error
                })
                await websocket.close()
                return

            # Emit final loading_complete
            load_time = time.time() - load_start
            await websocket.send_json({
                "type": "loading_complete",
                "frames": len(session.frames),
                "load_time_seconds": load_time,
                "elapsed_seconds": int(time.time() - connection_start)
            })

        # Continue with existing playback loop...
        # (frame streaming logic)

    except Exception as e:
        logger.error(f"[WS] Error in handler for {session_id}: {e}", exc_info=True)
    finally:
        # CRITICAL: Clean up callback to prevent memory leak
        if session is not None and progress_callback is not None:
            session.unregister_progress_callback(progress_callback)
```

---

## Phase 2: Frontend (TypeScript) - ~60 minutes

### Step 2.1: Update Replay Store

**File:** `frontend/src/store/replayStore.ts`

Add loading state to the store:

```typescript
interface ReplayStore {
  // ... existing fields ...

  // NEW: Loading state (fed by useReplayWebSocket)
  loadingProgress: number;        // 0-100
  loadingError: string | null;    // null or error message
  isLoadingComplete: boolean;     // true once loading_complete received
  setLoadingProgress: (progress: number) => void;
  setLoadingError: (error: string | null) => void;
  setLoadingComplete: (complete: boolean) => void;
}

export const useReplayStore = create<ReplayStore>()(
  subscribeWithSelector((set) => ({
    // ... existing state ...

    // Loading state
    loadingProgress: 0,
    loadingError: null,
    isLoadingComplete: false,

    setLoadingProgress: (progress: number) =>
      set({ loadingProgress: progress }),

    setLoadingError: (error: string | null) =>
      set({ loadingError: error }),

    setLoadingComplete: (complete: boolean) =>
      set({ isLoadingComplete: complete }),

    // ... rest of store ...
  }))
);
```

### Step 2.2: Extend useReplayWebSocket Hook

**File:** `frontend/src/hooks/useReplayWebSocket.ts`

Rewrite to handle BOTH loading events AND frame streaming:

```typescript
export const useReplayWebSocket = (sessionId: string | null, delayPlayback: boolean = false) => {
  const wsRef = useRef<WebSocket | null>(null);
  const setCurrentFrame = useReplayStore((state) => state.setCurrentFrame);
  const setLoadingProgress = useReplayStore((state) => state.setLoadingProgress);
  const setLoadingError = useReplayStore((state) => state.setLoadingError);
  const setLoadingComplete = useReplayStore((state) => state.setLoadingComplete);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) {
      if (wsRef.current) wsRef.current.close();
      return;
    }

    console.log("[WS Client] Initiating connection for session:", sessionId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:8000/ws/replay/${sessionId}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("[WS Client] Connection opened");
    };

    wsRef.current.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);

          // ===== LOADING PHASE MESSAGES =====
          if (message.type === 'loading_progress') {
            console.log("[WS Client] Loading progress:", message.progress + "%");
            setLoadingProgress(message.progress || 0);
            return;
          }

          if (message.type === 'loading_complete') {
            console.log("[WS Client] Loading complete");
            setLoadingProgress(100);
            setLoadingComplete(true);
            setLoadingError(null);
            return;
          }

          if (message.type === 'loading_error') {
            console.error("[WS Client] Loading error:", message.message);
            setLoadingError(message.message || "Unknown error");
            return;
          }
        }

        // ===== PLAYBACK PHASE: Binary frame data =====
        // (existing frame handling code)
      } catch (error) {
        console.error("[WS Client] Failed to decode message:", error);
      }
    };

    wsRef.current.onerror = () => {
      console.error("[WS Client] WebSocket error");
      setLoadingError("WebSocket connection error");
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId, setCurrentFrame, setLoadingProgress, setLoadingError, setLoadingComplete]);

  // Timeout: if no activity within 10s, emit error
  useEffect(() => {
    if (!sessionId) return;

    timeoutRef.current = setTimeout(() => {
      setLoadingError("Unable to connect to telemetry (timeout). Please try again.");
    }, 10000);

    // CRITICAL: Subscribe to ALL loading state changes and clear timeout
    const unsubscribe = useReplayStore.subscribe(
      (state) => ({
        progress: state.loadingProgress,
        complete: state.isLoadingComplete,
        error: state.loadingError,
      }),
      ({ progress, complete, error }) => {
        if (progress > 0 || complete || error) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      }
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [sessionId]);

  return { /* existing return */ };
};
```

### Step 2.3: Create useLoadingState Hook

**File:** `frontend/src/hooks/useLoadingState.ts` (NEW)

```typescript
import { useState, useEffect } from "react";
import { useReplayStore } from "../store/replayStore";

const MIN_DISPLAY_MS = 700; // Modal must be visible for at least 700ms

export const useLoadingState = (sessionId: string | null, isOpen: boolean) => {
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const progress = useReplayStore((state) => state.loadingProgress);
  const error = useReplayStore((state) => state.loadingError);
  const isLoadingComplete = useReplayStore((state) => state.isLoadingComplete);

  // CRITICAL FIX: Reset openedAt when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setOpenedAt(performance.now());
    } else {
      setOpenedAt(null);
    }
  }, [isOpen, sessionId]);

  const shouldClose = () => {
    if (!openedAt) return false;
    if (error) return false; // Keep open on error
    if (!isLoadingComplete) return false;
    const elapsed = performance.now() - openedAt;
    return elapsed >= MIN_DISPLAY_MS;
  };

  const getCloseDelayMs = () => {
    if (!openedAt) return 0;
    if (error) return Infinity;
    if (!isLoadingComplete) return Infinity;
    const elapsed = performance.now() - openedAt;
    return Math.max(0, MIN_DISPLAY_MS - elapsed);
  };

  return { progress, error, shouldClose, getCloseDelayMs };
};
```

### Step 2.4: Update LoadingModal Component

**File:** `frontend/src/components/LoadingModal.tsx`

```typescript
export const LoadingModal = ({ isOpen, sessionId, onClose }) => {
  // CRITICAL: Pass isOpen to useLoadingState to drive openedAt reset
  // This fixes the "reload same race → instant close" bug
  const { progress, error, shouldClose, getCloseDelayMs } = useLoadingState(sessionId, isOpen);

  useEffect(() => {
    if (shouldClose()) {
      const delay = getCloseDelayMs();
      if (delay <= 0) {
        onClose();
      } else {
        const timer = setTimeout(onClose, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [progress, error, shouldClose, getCloseDelayMs, onClose]);

  if (!isOpen) return null;

  return (
    <div className="loading-modal">
      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

### Step 2.5: Update App.tsx

**File:** `frontend/src/App.tsx`

1. Reset loading state BEFORE opening modal:

```typescript
const handleSessionSelect = async (year: number, round: number) => {
  try {
    // CRITICAL: Reset loading state BEFORE opening modal
    const store = useReplayStore.getState();
    store.setLoadingProgress(0);
    store.setLoadingError(null);
    store.setLoadingComplete(false);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, round_num: round, session_type: "R" })
    });
    const data = await response.json();

    setSession(data.session_id, { year, round, session_type: "R" });
    setSessionLoading(true);  // NOW open modal
  } catch (err) {
    console.error("Failed to load session:", err);
    setSessionLoading(false);
  }
};
```

2. Remove HTTP polling entirely
3. Update LoadingModal props to pass `isOpen`

---

## Phase 3: Testing & Verification - ~45 minutes

### Step 3.1: Test Fresh Load

1. Select a race
2. Watch modal appear and progress bar 0→100
3. Verify exactly ONE WebSocket in DevTools Network tab
4. Modal should stay visible for at least 700ms

### Step 3.2: Test Cached Load

1. Load same race again (sessionId identical)
2. Watch progress 0→100 even though data loads instantly
3. No instant-close flicker
4. Still only ONE WebSocket connection

### Step 3.3: Test Error Handling

1. Break backend, trigger load
2. Error message displays
3. Modal stays open (no auto-close on error)

### Step 3.4: Test Timeout

1. Disable backend, start load
2. After 10 seconds: timeout error appears
3. Modal shows error state

### Step 3.5: DevTools Verification

```javascript
// Run in browser console while loading:
// Should show exactly 1 connection to ws://localhost:8000/ws/replay/{sessionId}
```

---

## Final Pre-Implementation Checklist

**Before you write a single line of code, verify these items:**

### Backend Cleanup
- [ ] Remove `pollSessionStatus()` function entirely from App.tsx (it doesn't exist on backend anyway)
- [ ] Strip any old artificial delays or polling hacks from backend
- [ ] POST `/api/sessions` returns ONLY `{ "session_id": "..." }` (no loading status)
- [ ] No legacy polling endpoints remain

### Frontend Cleanup
- [ ] Confirm `useLoadingState` is **always** called with TWO parameters: `useLoadingState(sessionId, isOpen)`
- [ ] All snippets showing `useLoadingState(sessionId)` with no `isOpen` are replaced or deleted
- [ ] `handleSessionSelect` resets loading state BEFORE opening modal:
  ```typescript
  store.setLoadingProgress(0);
  store.setLoadingError(null);
  store.setLoadingComplete(false);
  ```
- [ ] LoadingModal passes `isOpen` to `useLoadingState`:
  ```typescript
  useLoadingState(sessionId, isOpen)  // Always pass isOpen
  ```

### Timeout & Error UX
- [ ] Frontend timeout: 10 seconds (user-visible, shows error, modal stays open)
- [ ] Backend timeout: 300 seconds (safety only, frontend timeout fires first)
- [ ] Error state: modal displays error message, user must dismiss manually
- [ ] No auto-close on error
- [ ] No navigation to `/replay` allowed while `loadingError && !isLoadingComplete`

### WebSocket Single Source of Truth
- [ ] No HTTP polling in normal code path
- [ ] One WebSocket per session: `useReplayWebSocket` opens it, `useLoadingState` subscribes to store only
- [ ] Store is authoritative: Backend → WebSocket → Store → Components
- [ ] No duplicate connections

---

## Success Criteria

- ✅ Modal visible for minimum 700ms
- ✅ Progress bar shows 0→100 realistically
- ✅ Only ONE WebSocket per session (check DevTools)
- ✅ No HTTP polling in code
- ✅ Cached loads show progress
- ✅ Errors display clearly
- ✅ No console errors

---

## If You Get Stuck

1. **Architecture unclear?** → Read [FINAL-PLAN-SUMMARY.md](./FINAL-PLAN-SUMMARY.md)
2. **What bugs to avoid?** → Read [PEER-REVIEW-FEEDBACK-INCORPORATED.md](./PEER-REVIEW-FEEDBACK-INCORPORATED.md)
3. **Full code examples?** → Reference [loading-state-fix-implementation-plan.md](./loading-state-fix-implementation-plan.md)
4. **Implementation traps?** → See "Implementation Warnings" section in main plan

---

**Ready? Start with Phase 1 Step 1.1 above. Good luck! 🚀**
