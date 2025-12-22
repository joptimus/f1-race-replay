# Loading State Fix: Implementation Plan (Final - Revised)

**Status:** Ready for Implementation
**Date:** December 21, 2025
**Scope:** Fix the loading modal race condition once and for all
**Approach:** Single WebSocket connection per session as single source of truth

---

## ⚠️ AUTHORITATIVE SOURCE

**This file is the authoritative implementation specification.** If other documentation in this folder conflicts with this plan, follow this document as the source of truth. All code examples, architecture decisions, and implementation details here supersede earlier drafts or summary documents.

### Signature Consistency Note

**useLoadingState ALWAYS takes TWO parameters:**
```typescript
const { progress, error, shouldClose, getCloseDelayMs } =
  useLoadingState(sessionId, isOpen);  // Always pass BOTH
```

Never call it with just `sessionId`. The `isOpen` parameter is CRITICAL—it drives the `openedAt` reset that fixes the "reload same race → instant close" bug. If you see any snippet that omits `isOpen`, it's outdated.

---

## Executive Summary

The current loading modal flickers or disappears instantly because two independent systems (HTTP polling and WebSocket) try to manage the same UI state. This plan eliminates the race by:

1. Making **WebSocket the exclusive source of truth** for loading state
2. **Enforcing a single WebSocket connection** per session for both loading events AND frame streaming
3. Extending the existing `useReplayWebSocket` hook to handle both concerns
4. Removing HTTP polling entirely from the normal code path

**Key Architectural Decision:** One WebSocket endpoint (`/ws/replay/{sessionId}`) handles loading state messages (progress, complete, error) AND frame data streaming. The existing `useReplayWebSocket` hook is extended to emit loading events to the store, which `useLoadingState` subscribes to. This eliminates duplicate connections and ensures clean message flow.

**Key Behavioral Change:** POST endpoint returns only `{ sessionId }`, never determines loading status. Loading state is communicated **exclusively** through WebSocket events.

---

## Critical Architectural Decision: Single WebSocket Strategy

⚠️ **This is the most important decision in this plan. Read carefully.**

### The Question
Should we have:
- **Option A (Chosen):** One WebSocket connection handling both loading events + frame streaming
- **Option B:** Two separate WebSocket connections (one for loading, one for frames)

### Why Option A is Correct

**Option B Problems:**
- Two connections to same backend session = more server resources
- Duplicate message handling, harder to debug
- Messages can arrive out of order across two connections
- More complex state synchronization on frontend

**Option A Advantages:**
- Single connection per session = clean, efficient
- All session state flows through one channel
- Natural message ordering guaranteed
- Easier to test and debug
- Simpler mental model

### Implementation Approach

```
Backend:
  /ws/replay/{sessionId}
    ├─ Initial handshake (client connects)
    ├─ Loading phase (emit progress messages)
    ├─ Ready phase (switch to frame streaming)
    └─ Playback phase (frame data + control messages)

Frontend Hook Architecture:
  useReplayWebSocket (EXTENDED) - NOW HANDLES EVERYTHING
    ├─ Opens single WebSocket to /ws/replay/{sessionId}
    ├─ Dispatches loading_progress → store.setLoadingProgress()
    ├─ Dispatches loading_complete → store.setLoadingComplete()
    ├─ Dispatches loading_error → store.setLoadingError()
    ├─ Dispatches frame data → store.setCurrentFrame()
    ├─ Handles playback commands (play, pause, seek)
    └─ Only closes when session unmounts

  useLoadingState (NEW) - SUBSCRIBES TO STORE ONLY
    ├─ Does NOT open a WebSocket
    ├─ Reads from store: loadingProgress, loadingError, isLoadingComplete
    ├─ Calculates MIN_DISPLAY_MS logic
    ├─ Returns: progress, error, shouldClose, getCloseDelayMs
    └─ Pure state consumer, no connection logic

Resulting Data Flow:
  Backend sends loading_progress
    ↓
  useReplayWebSocket receives and dispatches to store
    ↓
  useLoadingState subscribes to store and re-renders
    ↓
  LoadingModal updates progress bar
```

**Result:** Exactly one WebSocket per session, all concerns flow through one hook.

---

## Architecture Overview

### Before (Broken)
```
User selects race
    ↓
HTTP POST /api/sessions
    ├─ Returns immediately with { sessionId, loading: true }
    ├─ Starts background job
    └─ Sets up HTTP polling
       ├─ Polls GET /api/sessions/{id}
       ├─ Waits for data.loading == false
       └─ Closes modal (RACE CONDITION!)

WebSocket /ws/replay/{sessionId} (in parallel)
    ├─ Connects (maybe)
    ├─ Sends status messages (maybe)
    └─ Sends "ready" (maybe too late)

PROBLEM: Polling can close modal before WebSocket even connects
```

### After (Fixed)
```
User selects race
    ↓
HTTP POST /api/sessions
    ├─ Registers session
    ├─ Starts loading job with progress emitter
    └─ Returns { sessionId }
       (NEVER returns loading status)

WebSocket /ws/replay/{sessionId}
    ├─ Connects immediately
    ├─ Emits: loading_started
    ├─ Emits: loading_progress (0-100)
    ├─ Emits: loading_complete or loading_error
    └─ Frontend follows state machine exactly
       ├─ Show modal on loading_started
       ├─ Update progress on loading_progress
       ├─ Close modal (respecting MIN_DISPLAY_MS) on loading_complete/error
       └─ SINGLE SOURCE OF TRUTH

SOLUTION: Only WebSocket determines when modal closes. HTTP polling removed from normal path.
```

---

## Phase 1: Backend Refactoring

### 1.1 Define Loading State Machine

**File:** `backend/app/services/replay_service.py`

Add state machine constants:
```python
class LoadingState(Enum):
    INIT = "init"           # Session created, job scheduled
    LOADING = "loading"     # Processing telemetry
    READY = "ready"         # All data loaded, ready for playback
    ERROR = "error"         # Failed during load
```

### 1.2 Add Progress Event Emitter to F1ReplaySession

**File:** `backend/app/services/replay_service.py`

```python
class F1ReplaySession:
    def __init__(self, ...):
        # ... existing code ...
        self.state = LoadingState.INIT
        self.loading_status = "Initializing session..."
        self.progress = 0
        self.progress_callbacks = []  # List of async callbacks for progress updates
        self.load_error = None
        self.is_loaded = False

    def register_progress_callback(self, callback):
        """Register callback to receive progress events.
        Callback will be called with: (state, progress, message)
        """
        self.progress_callbacks.append(callback)

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

    def unregister_progress_callback(self, callback):
        """Unregister a progress callback (prevents memory leak)."""
        if callback in self.progress_callbacks:
            self.progress_callbacks.remove(callback)

    async def load_data(self):
        """Load race telemetry with progress emission."""
        try:
            await self.emit_progress(LoadingState.LOADING, 0, "Starting telemetry load...")

            # Load data
            if self.session_type == "R":
                self.frames, self.metadata = await asyncio.to_thread(
                    get_race_telemetry,
                    self.year, self.round, self.refresh,
                    progress_callback=self._handle_progress  # Pass callback to telemetry loader
                )
            # ... other session types ...

            # For cache hits, emit immediate progress
            await self.emit_progress(LoadingState.LOADING, 100, "Data ready, building geometry...")

            # ... existing geometry/metadata code ...

            await self.emit_progress(LoadingState.READY, 100, "Session ready for playback")
            self.is_loaded = True

        except Exception as e:
            self.load_error = str(e)
            await self.emit_progress(LoadingState.ERROR, 0, f"Load failed: {e}")
            logger.error(f"Error loading session {self.session_id}: {e}")

    def _handle_progress(self, progress: int, message: str):
        """Sync callback from telemetry loader."""
        # Queue async emit_progress
        asyncio.create_task(self.emit_progress(LoadingState.LOADING, progress, message))
```

### 1.3 Simplify POST Endpoint

**File:** `backend/app/api/sessions.py`

```python
@router.post("")
async def create_session(background_tasks: BackgroundTasks, request: SessionRequest):
    """Create a new replay session.

    Returns immediately with sessionId only.
    Loading state is communicated exclusively through WebSocket.
    """
    year = request.year
    round_num = request.round_num
    session_type = request.session_type
    refresh = request.refresh
    session_id = f"{year}_{round_num}_{session_type}"

    # Check if session already exists and is loaded
    if session_id in active_sessions and not refresh:
        session = active_sessions[session_id]
        if session.is_loaded and not session.load_error:
            # Already loaded, but still register for WebSocket discovery
            return {"session_id": session_id}
        elif session.load_error:
            # Previous load failed, try again
            pass
        else:
            # Still loading, client will get state via WebSocket
            return {"session_id": session_id}

    # Create new session
    session = F1ReplaySession(year, round_num, session_type, refresh=refresh)
    active_sessions[session_id] = session

    # Schedule loading job
    background_tasks.add_task(session.load_data)

    # Return sessionId ONLY
    # Client uses WebSocket to discover when session is ready
    return {"session_id": session_id}
```

### 1.4 Update WebSocket Handler to Emit Structured Events

**File:** `backend/app/websocket.py`

⚠️ **Message Types (CRITICAL - keep these exact):**

The backend sends exactly these message types during loading phase:

1. `loading_progress` - Sent as data loads, includes progress (0-100) and message
2. `loading_complete` - Sent once when session is fully loaded and ready
3. `loading_error` - Sent if loading fails (replaces loading_complete)

Then during playback:
4. Binary frame data (msgpack encoded, existing behavior)
5. Control messages (existing behavior)

Do NOT send `loading_started` as a separate message type. Instead, the first `loading_progress` signal indicates loading has started.

```python
async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    """
    WebSocket handler for F1 replay. Single connection for both loading state and frame streaming.

    Loading Phase Event Sequence:
      1. Client connects
      2. Server emits: loading_progress (progress=0, "Starting telemetry load...")
      3. Server emits: loading_progress (progress=25, "Processing drivers...")
      4. Server emits: loading_progress (progress=50, "Building track geometry...")
      5. Server emits: loading_progress (progress=100, "Ready for playback")
      6. Server emits: loading_complete (frames=154173, load_time_seconds=3.2)

      OR on error:
      6. Server emits: loading_error (message="...")

    Playback Phase:
      7. Client sends play/pause/seek commands
      8. Server streams binary frame data
    """
    connection_start = time.time()

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
        async def progress_callback(state: LoadingState, progress: int, message: str):
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

        # Register callback with session (it will emit events as loading progresses)
        session.register_progress_callback(progress_callback)

        # CRITICAL FIX: Handle "late joiner" scenario where session is already loaded
        # when WebSocket connects (e.g., cached sessions, or second client connecting)
        # Send synthetic progress event to catch up the client immediately
        if session.is_loaded:
            logger.debug(f"[WS] Session {session_id} already loaded, sending catch-up events")
            # Send final progress state
            await websocket.send_json({
                "type": "loading_progress",
                "progress": session.progress or 100,
                "message": session.loading_status or "Ready for playback",
                "elapsed_seconds": int(time.time() - connection_start)
            })
            # Send completion signal
            await websocket.send_json({
                "type": "loading_complete",
                "frames": len(session.frames),
                "load_time_seconds": 0,
                "elapsed_seconds": int(time.time() - connection_start)
            })
            logger.info(f"[WS] Session {session_id} already loaded, sent catch-up complete")
            # Continue to playback loop (skip the wait loop)
        else:
            # Session is still loading, wait for it to complete
            pass  # Continue to next section

        # Wait for session to load with timeout
        load_timeout = 300  # 5 minutes
        load_start = time.time()
        load_check_interval = 0.5

        while not session.is_loaded:
            elapsed = time.time() - load_start

            if elapsed > load_timeout:
                logger.error(f"[WS] Session load timeout for {session_id} after {elapsed:.1f}s")
                await websocket.send_json({
                    "type": "loading_error",
                    "message": f"Session load timeout after {elapsed:.0f}s"
                })
                await websocket.close()
                return

            await asyncio.sleep(load_check_interval)

        if session.load_error:
            logger.error(f"[WS] Session {session_id} failed to load: {session.load_error}")
            await websocket.send_json({
                "type": "loading_error",
                "message": session.load_error
            })
            await websocket.close()
            return

        # Emit loading_complete - final confirmation that session is ready for playback
        load_time = time.time() - load_start
        await websocket.send_json({
            "type": "loading_complete",
            "frames": len(session.frames),
            "load_time_seconds": load_time,
            "elapsed_seconds": int(time.time() - connection_start)
        })
        logger.info(f"[WS] Session {session_id} loaded with {len(session.frames)} frames in {load_time:.1f}s")

        # ===== PLAYBACK PHASE BEGINS =====
        # From here on, this is the existing frame streaming logic
        # (unchanged - just documenting the phase boundary)

        playback_state = {
            "frame_index": 0.0,
            "playback_speed": 1.0,
            "is_playing": False,
            "last_frame_sent": -1,
            "frames_sent": 0,
            "send_start_time": time.time(),
        }

        # ... rest of existing playback loop ...
```

---

## Phase 2: Frontend Refactoring

### 2.1 Update Replay Store to Track Loading State

**File:** `frontend/src/store/replayStore.ts`

Add loading state to the store. This becomes the **single source of truth** that both the WebSocket hook and the loading modal subscribe to:

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

  // ... rest of store ...
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

### 2.2 Update useReplayWebSocket to Handle Loading Events

**File:** `frontend/src/hooks/useReplayWebSocket.ts` (MAJOR REWRITE)

⚠️ **Critical Change:** This hook now opens AND MANAGES the single WebSocket connection for BOTH loading events and frame streaming.

```typescript
/**
 * WebSocket hook for F1 Race Replay.
 *
 * SINGLE RESPONSIBILITY: Opens one WebSocket per session and handles:
 * - Loading state messages (loading_progress, loading_complete, loading_error)
 * - Frame data streaming (after loading is complete)
 * - Playback commands (play, pause, seek)
 *
 * All state is dispatched to the global store.
 * Other components (LoadingModal, TrackViz) subscribe to store changes.
 */

import { useEffect, useRef, useCallback } from "react";
import { Unpackr } from "msgpackr";
import { useReplayStore } from "../store/replayStore";
import { FrameData } from "../types";

interface WebSocketMessage {
  action: "play" | "pause" | "seek";
  speed?: number;
  frame?: number;
}

export const useReplayWebSocket = (sessionId: string | null, delayPlayback: boolean = false) => {
  const wsRef = useRef<WebSocket | null>(null);
  const setCurrentFrame = useReplayStore((state) => state.setCurrentFrame);
  const setLoadingProgress = useReplayStore((state) => state.setLoadingProgress);
  const setLoadingError = useReplayStore((state) => state.setLoadingError);
  const setLoadingComplete = useReplayStore((state) => state.setLoadingComplete);
  const playback = useReplayStore((state) => state.playback);
  const lastSentCommandRef = useRef<WebSocketMessage | null>(null);
  const sendCommandRef = useRef<(message: WebSocketMessage) => void>();
  const pendingPlaybackRef = useRef<boolean>(false);
  const connectionStartRef = useRef<number>(0);

  // Create sendCommand function
  const sendCommand = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const isIdentical =
        lastSentCommandRef.current &&
        JSON.stringify(lastSentCommandRef.current) === JSON.stringify(message);

      if (!isIdentical) {
        wsRef.current.send(JSON.stringify(message));
        lastSentCommandRef.current = message;
      }
    }
  }, []);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  // Main WebSocket connection effect
  useEffect(() => {
    if (!sessionId) {
      console.log("[WS Client] No sessionId, skipping connection");
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    console.log("[WS Client] Initiating connection for session:", sessionId);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//localhost:8000/ws/replay/${sessionId}`;

    wsRef.current = new WebSocket(wsUrl);
    connectionStartRef.current = performance.now();

    wsRef.current.onopen = () => {
      console.log("[WS Client] Connection opened, session:", sessionId);
      // Request initial frame when connection opens
      if (sendCommandRef.current) {
        sendCommandRef.current({ action: "seek", frame: 0 });
      }
    };

    wsRef.current.onmessage = async (event) => {
      try {
        // Handle JSON messages (loading state + control messages)
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);

          // ===== LOADING PHASE MESSAGES =====
          if (message.type === 'loading_progress') {
            console.log("[WS Client] Loading progress:", message.progress + "%", "-", message.message);
            setLoadingProgress(message.progress || 0);
            return;
          }

          if (message.type === 'loading_complete') {
            console.log("[WS Client] Loading complete - frames:", message.frames, "load time:", message.load_time_seconds + "s");
            setLoadingProgress(100);
            setLoadingComplete(true);
            setLoadingError(null);
            return;
          }

          if (message.type === 'loading_error') {
            console.error("[WS Client] Loading error:", message.message);
            setLoadingError(message.message || "Unknown loading error");
            return;
          }

          // Unknown control message
          console.warn("[WS Client] Unknown control message:", message);
          return;
        }

        // ===== PLAYBACK PHASE: Binary frame data =====
        let data: Uint8Array;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          data = new Uint8Array(arrayBuffer);
        } else if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else {
          data = event.data;
        }

        const decoder = new Unpackr({
          mapsAsObjects: true,
        });
        const decoded = decoder.unpack(data) as FrameData;

        if (!decoded.error) {
          setCurrentFrame(decoded);
        } else {
          console.error("[WS Client] Frame has error property:", decoded.error);
        }
      } catch (error) {
        console.error("[WS Client] Failed to decode message:", error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("[WS Client] WebSocket error:", error);
      setLoadingError("WebSocket connection error");
    };

    wsRef.current.onclose = () => {
      console.log("[WS Client] WebSocket closed for session:", sessionId);
    };

    return () => {
      console.log("[WS Client] Cleanup: closing connection for session:", sessionId);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, setCurrentFrame, setLoadingProgress, setLoadingError, setLoadingComplete]);

  // Sync playback state to WebSocket
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (playback.isPlaying && delayPlayback && !pendingPlaybackRef.current) {
      pendingPlaybackRef.current = true;
      return;
    }

    if (playback.isPlaying) {
      sendCommandRef.current?.({
        action: "play",
        speed: playback.speed,
      });
    } else {
      sendCommandRef.current?.({ action: "pause" });
    }
  }, [playback.isPlaying, playback.speed, delayPlayback]);

  // Sync frame index (seeking) to WebSocket
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    sendCommandRef.current?.({ action: "seek", frame: playback.frameIndex });
  }, [playback.frameIndex]);

  const resumePlayback = () => {
    if (playback.isPlaying && pendingPlaybackRef.current) {
      pendingPlaybackRef.current = false;
      sendCommandRef.current?.({
        action: "play",
        speed: playback.speed,
      });
    }
  };

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendSeek: (frameIndex: number) => {
      if (sendCommandRef.current) {
        sendCommandRef.current({ action: "seek", frame: frameIndex });
      }
    },
    resumePlayback,
  };
};
```

### 2.3 New useLoadingState Hook (Store-Subscriber Only)

**File:** `frontend/src/hooks/useLoadingState.ts` (NEW)

⚠️ **IMPORTANT:** This hook does NOT open a WebSocket. It only subscribes to the store which is fed by useReplayWebSocket.

```typescript
/**
 * Pure UI logic for loading modal state.
 *
 * Does NOT manage WebSocket (that's useReplayWebSocket's job).
 * Subscribes to store for progress/error/complete state.
 * Computes MIN_DISPLAY_MS logic.
 */

import { useState, useEffect, useRef } from "react";
import { useReplayStore } from "../store/replayStore";

const MIN_DISPLAY_MS = 700; // Modal must be visible for at least 700ms

export const useLoadingState = (sessionId: string | null, isOpen: boolean) => {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to store for loading state
  const progress = useReplayStore((state) => state.loadingProgress);
  const error = useReplayStore((state) => state.loadingError);
  const isLoadingComplete = useReplayStore((state) => state.isLoadingComplete);

  // CRITICAL FIX: Reset openedAt when modal opens/closes, not just when sessionId changes
  // This prevents the "instant close on reload same session" bug where sessionId stays the same
  useEffect(() => {
    if (isOpen) {
      setOpenedAt(performance.now());
    } else {
      setOpenedAt(null);
    }
  }, [isOpen, sessionId]);

  // Determine if modal should close (respecting MIN_DISPLAY_MS)
  const shouldClose = () => {
    if (!openedAt) return false;
    if (error) return false; // Keep open on error (user must dismiss)
    if (!isLoadingComplete) return false; // Loading not done yet

    const elapsed = performance.now() - openedAt;
    return elapsed >= MIN_DISPLAY_MS;
  };

  // Calculate delay until we can close
  const getCloseDelayMs = () => {
    if (!openedAt) return 0;
    if (error) return Infinity; // No auto-close on error
    if (!isLoadingComplete) return Infinity; // Not done yet

    const elapsed = performance.now() - openedAt;
    const remaining = MIN_DISPLAY_MS - elapsed;
    return Math.max(0, remaining);
  };

  return {
    progress,
    error,
    shouldClose,
    getCloseDelayMs,
  };
};
```

### 2.2 Refactor LoadingModal

**File:** `frontend/src/components/LoadingModal.tsx`

```typescript
/**
 * Loading modal shown during session telemetry processing.
 * Follows WebSocket loading state exclusively.
 */

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoadingState } from "../hooks/useLoadingState";

interface LoadingModalProps {
  isOpen: boolean;
  sessionId: string | null;
  year?: number;
  round?: number;
  onClose?: () => void; // Called when modal should close
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  sessionId,
  year = 2025,
  round = 1,
  onClose,
}) => {
  const { progress, error, shouldClose, getCloseDelayMs } = useLoadingState(sessionId);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor shouldClose and trigger onClose callback with appropriate delay
  useEffect(() => {
    if (!isOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      return;
    }

    if (shouldClose() && onClose) {
      const delayMs = getCloseDelayMs();
      if (delayMs === 0) {
        onClose();
      } else {
        closeTimeoutRef.current = setTimeout(onClose, delayMs);
      }
    }

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isOpen, progress, error, shouldClose, getCloseDelayMs, onClose]);

  if (error) {
    return (
      <AnimatePresence>
        {isOpen && (
          <div style={{...baseBackdropStyle}}>
            <motion.div {...motionConfig} style={{...baseModalStyle}}>
              <h2 style={headerStyle}>Error Loading Session</h2>
              <p style={errorMessageStyle}>{error}</p>
              <button
                onClick={onClose}
                style={{
                  marginTop: "24px",
                  padding: "8px 16px",
                  background: "var(--f1-red)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{...baseBackdropStyle}}>
          <motion.div {...motionConfig} style={{...baseModalStyle}}>
            <h2 style={headerStyle}>Loading Session</h2>

            <div style={sessionInfoStyle}>
              {year} F1 ROUND {round}
            </div>

            {/* Animated Loading Spinner */}
            <div style={spinnerContainerStyle}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  style={spinnerDotStyle}
                />
              ))}
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: "16px" }}>
              <div style={progressBarBackgroundStyle}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={progressBarFillStyle}
                />
              </div>
              <div style={progressPercentStyle}>{Math.round(progress)}%</div>
            </div>

            <div style={statusMessageStyle}>
              Processing telemetry data...
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Styles (extracted for clarity)
const baseBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const baseModalStyle = {
  position: "relative",
  background: "#1f1f27",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "12px",
  padding: "48px 64px",
  textAlign: "center",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
  minWidth: "400px",
};

const motionConfig = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const headerStyle = {
  fontSize: "1.5rem",
  fontWeight: 900,
  color: "#e10600",
  marginBottom: "24px",
  marginTop: 0,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const sessionInfoStyle = {
  fontSize: "1.125rem",
  color: "#d1d5db",
  marginBottom: "32px",
  fontFamily: "monospace",
  fontWeight: 600,
};

const spinnerContainerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "8px",
  marginBottom: "24px",
};

const spinnerDotStyle = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  background: "#e10600",
};

const progressBarBackgroundStyle = {
  width: "100%",
  height: "8px",
  backgroundColor: "#374151",
  borderRadius: "4px",
  overflow: "hidden",
  marginBottom: "8px",
};

const progressBarFillStyle = {
  height: "100%",
  background: "linear-gradient(to right, #e10600, #ff4444)",
  borderRadius: "4px",
};

const progressPercentStyle = {
  fontSize: "0.875rem",
  color: "#9ca3af",
  fontFamily: "monospace",
  fontWeight: 600,
};

const errorMessageStyle = {
  fontSize: "0.875rem",
  color: "#fca5a5",
  fontFamily: "monospace",
  marginBottom: "16px",
};

const statusMessageStyle = {
  fontSize: "0.875rem",
  color: "#9ca3af",
  fontFamily: "monospace",
};

export default LoadingModal;
```

### 2.3 Refactor App.tsx to Use WebSocket-Only Loading State

**File:** `frontend/src/App.tsx`

Key changes:
1. Remove HTTP polling logic
2. Pass `sessionId` to LoadingModal
3. Use WebSocket-driven modal close

```typescript
function AppRoutes() {
  const navigate = useNavigate();
  const { session, setSession, setSessionLoading, pause } = useReplayStore();

  const handleSessionSelect = async (year: number, round: number, refresh: boolean = false) => {
    try {
      if (session.sessionId) {
        pause();
      }

      // Preload images
      const drivers = dataService.getAllDriversForYear(year);
      const driverCodes = drivers.map(d => d.Code);
      Promise.all([
        preloadDriverImages(driverCodes, year),
        preloadTeamLogos(),
        preloadTyreIcons(),
        preloadCommonImages(),
      ]).catch(err => console.warn("Image preloading failed:", err));

      // POST to create session (returns sessionId only)
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, round_num: round, session_type: "R", refresh })
      });
      const data = await response.json();

      // Set session and open loading modal
      // WebSocket will handle loading state from here
      setSession(data.session_id, {
        year,
        round,
        session_type: "R",
        total_frames: null, // Will be updated by WebSocket
      });
      setSessionLoading(true);
    } catch (err) {
      console.error("Failed to load session:", err);
      setSessionLoading(false);
    }
  };

  const handleLoadingComplete = () => {
    // Called when modal should close
    // Set up session and navigate
    setSessionLoading(false);
    navigate("/replay");
  };

  // ... rest of AppRoutes ...

  return (
    <Routes>
      <Route path="/" element={<LandingPage onSessionSelect={handleSessionSelect} isLoading={session.isLoading} />} />
      <Route
        path="/replay"
        element={session.sessionId ? <ReplayView onSessionSelect={handleSessionSelect} /> : <Navigate to="/" replace />}
      />
      {/* ... other routes ... */}
    </Routes>
  );
}

function App() {
  const { session, setSessionLoading } = useReplayStore();

  return (
    <BrowserRouter>
      <AppRoutes />
      <LoadingModal
        isOpen={session.isLoading}
        sessionId={session.sessionId}
        year={session.metadata?.year}
        round={session.metadata?.round}
        onClose={() => setSessionLoading(false)}
      />
    </BrowserRouter>
  );
}
```

### 2.4 useReplayWebSocket Already Handles Everything

**File:** `frontend/src/hooks/useReplayWebSocket.ts`

✅ **Already complete** from Step 2.2. The hook now handles:

* **Loading phase:** `loading_progress`, `loading_complete`, `loading_error` messages
* **Playback phase:** Binary frame data and control messages
* **Single responsibility:** One WebSocket per session, all state flows to store

No additional changes needed. The hook handles both loading and frame streaming in a single connection.

---

## Phase 3: Critical Edge Case Fixes

### 3.0 Memory Leak Prevention: Unregister Callbacks

**File:** `backend/app/websocket.py`

⚠️ **CRITICAL:** Progress callbacks must be unregistered when WebSocket closes, otherwise each reconnection adds another callback that tries to send to a dead WebSocket.

In the `handle_replay_websocket` function, wrap the entire handler in try/finally:

```python
async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    connection_start = time.time()
    session = None
    progress_callback = None

    try:
        await websocket.accept(subprotocol=None)
        logger.info(f"[WS] Client connected for session {session_id}")

        if session_id not in active_sessions:
            logger.warning(f"[WS] Session {session_id} not found")
            await websocket.send_json({"type": "loading_error", "message": "Session not found"})
            await websocket.close()
            return

        session = active_sessions[session_id]

        # Define and register callback
        async def progress_callback(state: LoadingState, progress: int, message: str):
            # ... existing callback code ...
            pass

        session.register_progress_callback(progress_callback)

        # ... rest of handler ...

    except Exception as e:
        logger.error(f"[WS] Error in handler for {session_id}: {e}", exc_info=True)
    finally:
        # CRITICAL: Clean up callback to prevent memory leak
        if session is not None and progress_callback is not None:
            session.unregister_progress_callback(progress_callback)
            logger.debug(f"[WS] Unregistered callback for {session_id}")
```

### 3.1 Store Reset on New Session Selection

**File:** `frontend/src/App.tsx`

⚠️ **CRITICAL:** When user selects a new race (or refreshes), reset the loading state BEFORE opening the modal. Otherwise, stale state from previous session causes instant-close on second load.

```typescript
const handleSessionSelect = async (year: number, round: number, refresh: boolean = false) => {
  try {
    if (session.sessionId) {
      pause();
    }

    // Image preloading...
    const drivers = dataService.getAllDriversForYear(year);
    // ...

    // CRITICAL: Reset loading state BEFORE opening modal
    const store = useReplayStore.getState();
    store.setLoadingProgress(0);
    store.setLoadingError(null);
    store.setLoadingComplete(false);

    // NOW open modal with fresh state
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, round_num: round, session_type: "R", refresh })
    });
    const data = await response.json();

    setSession(data.session_id, {
      year,
      round,
      session_type: "R",
      total_frames: null,
    });
    setSessionLoading(true);
  } catch (err) {
    console.error("Failed to load session:", err);
    setSessionLoading(false);
  }
};
```

### 3.2 WebSocket Timeout and Connection Error Handling

Add to `useReplayWebSocket.ts`:

⚠️ **CRITICAL TIMEOUT SEMANTICS:**

* **Frontend timeout (10 seconds):** User-visible. If backend doesn't respond with any progress/complete/error within 10s, show error to user. This is the UX-critical timeout that defines "how long the user waits."
* **Backend timeout (300 seconds):** Safety timeout only. Prevents infinite loops on the server side. NOT meant to be user-visible (frontend timeout fires first).

The timeout effect must clear when ANY loading state changes (progress, complete, or error), not just progress. Otherwise timeout can fire AFTER success/error, overwriting with bogus error.

```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (!sessionId) return;

  // Set a timeout: if no progress/complete/error within 10s, emit timeout error
  timeoutRef.current = setTimeout(() => {
    if (!isLoadingComplete && !error) {
      setLoadingError("Unable to connect to telemetry (timeout). Please try again.");
    }
  }, 10000);

  // CRITICAL FIX: Subscribe to ALL three loading state changes and clear timeout
  // Don't just watch progress; also watch for complete/error to avoid timeout firing after success
  const unsubscribe = useReplayStore.subscribe(
    (state) => ({
      progress: state.loadingProgress,
      complete: state.isLoadingComplete,
      error: state.loadingError,
    }),
    ({ progress, complete, error }) => {
      // Clear timeout if ANY of these change (means backend is responding)
      if (progress > 0 || complete || error) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    }
  );

  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    unsubscribe();
  };
}, [sessionId]);
```

### 3.2 Store Reset on New Session

Add to store (`replayStore.ts`):

```typescript
// When a new session is selected, reset loading state
const setSession = (sessionId: string, metadata: SessionMetadata) =>
  set((state) => ({
    session: { sessionId, metadata, isLoading: false, error: null },
    // Reset loading state for new session
    loadingProgress: 0,
    loadingError: null,
    isLoadingComplete: false,
  }));
```

### 3.3 Error Path & Session State Alignment

**File:** `frontend/src/App.tsx`

⚠️ **Important:** When `loading_error` is received from WebSocket:

1. `loadingError` is set in store
2. Modal displays error state
3. User must dismiss the error

But `session.sessionId` is still non-null (set from the POST response). To prevent the user from accidentally navigating to `/replay` with a failed session:

**Option A: Clear the session on error (Recommended)**
```typescript
useEffect(() => {
  if (loadingError) {
    // Optional: clear session on error so /replay isn't navigable
    // setSession(null, null);
  }
}, [loadingError]);
```

**Option B: Guard the route**
```typescript
// In your route guard or Navigate:
if (loadingError && !isLoadingComplete) {
  // Don't allow navigation to /replay
  return null;
}
```

Pick one approach and document it in your App.tsx implementation.

---

### 3.4 Multiple Click Protection

Add to `App.tsx`:

```typescript
const loadingInProgressRef = useRef(false);

const handleSessionSelect = async (year: number, round: number, refresh: boolean = false) => {
  if (loadingInProgressRef.current) {
    console.log("[App] Loading already in progress, ignoring duplicate selection");
    return;
  }

  loadingInProgressRef.current = true;

  try {
    // ... existing fetch + setSession logic ...
  } catch (err) {
    console.error("Failed to load session:", err);
  } finally {
    loadingInProgressRef.current = false;
  }
};
```

---

## Testing Plan

### Unit Tests
- [ ] `useLoadingState` hook correctly tracks progress 0→100
- [ ] Modal respects `MIN_DISPLAY_MS` even when progress reaches 100
- [ ] Session mismatch detection resets state
- [ ] Multiple clicks on same session are debounced
- [ ] WebSocket timeout shows error message

### Integration Tests
- [ ] **Cached load:** Backend emits instant progress, modal shows ≥700ms
- [ ] **Slow load:** Backend emits 0→25→50→75→100 over time, modal stays open
- [ ] **Delayed connection:** WS delay doesn't cause modal to close early
- [ ] **Error handling:** Loading error shows error modal, user can dismiss
- [ ] **Session switch:** User changes selection mid-load, old WS closes, new one opens

### Manual Tests
- [ ] Load cached race: Modal visible for ~700ms with 100% progress
- [ ] Load fresh race: Modal shows progress bar updating
- [ ] Disconnect network during load: Error message appears
- [ ] Refresh data: Modal reopens with same behavior

---

## Implementation Order

1. **Backend Phase 1.1-1.2:** Add state machine + progress emitter (20 min)
2. **Backend Phase 1.3:** Simplify POST endpoint (10 min)
3. **Backend Phase 1.4:** Update WebSocket handler (30 min)
4. **Test:** Verify backend sends correct events (15 min)
5. **Frontend Phase 2.1:** New `useLoadingState` hook (25 min)
6. **Frontend Phase 2.2:** Refactor LoadingModal (20 min)
7. **Frontend Phase 2.3:** Update App.tsx (15 min)
8. **Test:** Verify modal behavior in all scenarios (30 min)
9. **Phase 3:** Edge case handling (15 min)
10. **Integration Tests:** Full end-to-end testing (45 min)

**Total Estimate:** ~3.5 hours

---

## Success Criteria

- ✅ Modal always visible for at least 700ms regardless of load speed
- ✅ Progress bar shows realistic updates (0→100 over time for fresh loads, 0→100 instant for cached)
- ✅ Cached loads emit full event sequence (started→progress→complete)
- ✅ Session mismatch handled gracefully
- ✅ Multiple clicks don't cause duplicate loads
- ✅ WebSocket timeout shows clear error message
- ✅ HTTP polling completely removed from normal code path
- ✅ No race conditions between polling and WebSocket
- ✅ Modal closes only on WebSocket signal
- ✅ All integration tests pass

---

## Critical Checklist Before Implementation

**MUST verify these before writing code:**

- [ ] **One WebSocket Only**
  - ✅ `useReplayWebSocket` opens the single WebSocket to `/ws/replay/{sessionId}`
  - ✅ `useLoadingState` does NOT open a WebSocket; it subscribes to store only
  - ✅ No other hook or component opens a WebSocket to the same endpoint
  - [ ] Verify in browser DevTools: only ONE WS connection in Network tab during loading

- [ ] **Message Types Exact Match**
  - ✅ Backend sends: `loading_progress`, `loading_complete`, `loading_error`
  - ✅ Backend does NOT send: `loading_started` as separate message
  - ✅ Frontend handles all three types in one place (useReplayWebSocket)
  - ✅ TypeScript type matches message shapes exactly

- [ ] **Store is Source of Truth**
  - ✅ `useReplayWebSocket` is the ONLY writer to loading state in store
  - ✅ `useLoadingState` only reads from store
  - ✅ `LoadingModal` subscribes via `useLoadingState`
  - ✅ Data flow: Backend → WebSocket → Store → Component

- [ ] **Cached Data Emits Full Sequence**
  - ✅ Cached session emits: `loading_progress(0)` → `loading_progress(100)` → `loading_complete`
  - ✅ Never silent success; client always sees at least initial progress message
  - ✅ Backend `emit_progress()` is called before checking `is_loaded`

- [ ] **HTTP Polling is Removed**
  - ✅ `pollSessionStatus()` function completely deleted from App.tsx
  - ✅ POST `/api/sessions` returns ONLY `{ sessionId }`
  - ✅ No code checks `data.loading` from HTTP responses
  - ✅ Frontend waits for WebSocket `loading_complete` signal, never HTTP polling

- [ ] **Modal Lifecycle is Clean**
  - ✅ `LoadingModal.onClose()` clears any pending timeouts
  - ✅ Timeout cleared on unmount or isOpen=false
  - ✅ No stale timers firing after modal closes
  - ✅ Multiple rapid session selections don't leave hanging state

- [ ] **Error Handling Works**
  - ✅ WebSocket error → `setLoadingError()`
  - ✅ Backend timeout → `type: "loading_error"` message
  - ✅ Connection timeout (10s) → `setLoadingError()` in useReplayWebSocket
  - ✅ Modal shows error state with dismiss button (not auto-close)

---

## Implementation Notes

### Backend (Python)

**Contracts to maintain:**
- Every call to `session.load_data()` must emit at least one progress message
- First progress message should have progress=0 or progress=100 (for cache hits)
- Final message is either `loading_complete` or `loading_error`, never both
- `loading_progress` messages must be JSON (not binary)
- Progress values must be integers 0-100

**Testing after implementation:**
```python
# Should see in logs:
# [WS] Sent progress to 2025_1_R: 0% - Starting telemetry load...
# [WS] Sent progress to 2025_1_R: 50% - Building track geometry...
# [WS] Sent progress to 2025_1_R: 100% - Ready for playback
# [WS] Session 2025_1_R loaded with 154173 frames in 3.2s
```

### Frontend (TypeScript)

**Contracts to maintain:**
- `useReplayWebSocket` opens exactly one WebSocket per session
- All loading events go through `setLoadingProgress()`, `setLoadingError()`, `setLoadingComplete()`
- `useLoadingState` never touches the WebSocket
- MIN_DISPLAY_MS is 700ms (hardcoded, not configurable)
- LoadingModal always respects MIN_DISPLAY_MS before closing

**Testing after implementation:**
```typescript
// Browser console should show:
// [WS Client] Initiating connection for session: 2025_1_R
// [WS Client] Connection opened, session: 2025_1_R
// [WS Client] Loading progress: 0% - Starting telemetry load...
// [WS Client] Loading progress: 100% - Ready for playback
// [WS Client] Loading complete - frames: 154173 load time: 3.2s
```

### Integration Testing

**Key assertion:** On any session load (cached or fresh), there should be exactly one WebSocket connection in the browser's Network tab.

**Command to verify:**
```javascript
// In browser console while loading a session:
Object.entries(window.__websockets || {}).forEach(([url, ws]) => {
  console.log(`WS: ${url}, ready state: ${ws.readyState}`);
});
// Should output only ONE connection
```

---

## Implementation Clarifications

### Reconnection Behavior During Loading

If the WebSocket disconnects and reconnects **while loading is in progress**:

1. New connection opens to `/ws/replay/{sessionId}`
2. New `progress_callback` is registered with session
3. If loading is still happening: callback receives subsequent real progress events
4. If loading already finished during disconnect: callback hits "late joiner" path and gets synthetic catch-up events + `loading_complete`

**Result:** Reconnections during load work seamlessly because the callback system handles both cases.

### Store Reset: DRY Principle

Loading state is reset in two places:

1. **In `handleSessionSelect`** (before opening modal): Direct store access
2. **In `setSession` method** (store definition): Zeroes all loading fields

To prevent future drift, consider extracting a helper:

```typescript
// In replayStore.ts
const resetLoadingState = () =>
  set({
    loadingProgress: 0,
    loadingError: null,
    isLoadingComplete: false,
  });

// In handleSessionSelect, call it:
const store = useReplayStore.getState();
store.resetLoadingState();
```

Then use the same helper in `setSession()` for consistency.

---

## Implementation Warnings (Watch These During Coding)

### ⚠️ The "Double Modal" Trap

In `App.tsx`, the order of operations in `handleSessionSelect` matters:

```typescript
// WRONG - can cause "0% Loading" flicker:
setSessionLoading(true);  // Opens modal
const response = await fetch("/api/sessions", ...);
const data = await response.json();
setSession(data.session_id, ...);  // Updates sessionId

// RIGHT - reset state BEFORE opening modal:
const store = useReplayStore.getState();
store.setLoadingProgress(0);
store.setLoadingError(null);
store.setLoadingComplete(false);

const response = await fetch("/api/sessions", ...);
const data = await response.json();
setSession(data.session_id, ...);  // Update sessionId
setSessionLoading(true);  // NOW open modal with fresh state
```

**Why:** If the component re-renders between opening the modal and setting the new sessionId, the modal might briefly display stale loading state (0% from a previous session) before `useReplayWebSocket` connects with the new sessionId.

**Prevention:** Always reset loading state in the store BEFORE calling `setSessionLoading(true)`.

---

### ⚠️ WebSocket Subprotocol Mismatch

In `useReplayWebSocket.ts`:

```typescript
// Make sure this matches backend's accept() call:
const wsUrl = `${protocol}//localhost:8000/ws/replay/${sessionId}`;
wsRef.current = new WebSocket(wsUrl);  // No subprotocol parameter!
```

And in `backend/app/websocket.py`:

```python
await websocket.accept(subprotocol=None)  # Must match frontend
```

**Why:** Some browsers silently fail WebSocket connections if the client requests a subprotocol that the server doesn't acknowledge. This can cause the connection to hang silently with no error events.

**Prevention:** Keep both sides using `subprotocol=None`. If you later add subprotocol negotiation, ensure both client and server specify the same protocol string.

---

### ⚠️ Modal UX & Route Guard

In `LoadingModal` and `App.tsx`:

1. **Don't allow closing mid-load** unless you explicitly support "cancel" semantics. Modal should only close when:
   - `isLoadingComplete && !error` (auto-close after MIN_DISPLAY_MS)
   - User dismisses error state
   - User manually navigates away

2. **Guard against stuck modals:** If `!sessionId`, don't render a hanging "Loading…" modal. The modal should always have a valid session behind it.

3. **Prevent navigation with error:** If `loadingError && !isLoadingComplete`, don't allow the user to navigate to `/replay` (see "Error Path & Session State Alignment" section for details).

---

### 📊 Msgpack Decoder Optimization

In `useReplayWebSocket.ts`, the `onmessage` handler creates a new `Unpackr` for every frame:

```typescript
wsRef.current.onmessage = async (event) => {
  // ...
  const decoder = new Unpackr({ mapsAsObjects: true });  // NEW instance every time
  const decoded = decoder.unpack(data);
};
```

For races with 150k+ frames, reuse the decoder:

```typescript
// Outside the hook (or memoized at hook level)
const decoder = new Unpackr({ mapsAsObjects: true });

wsRef.current.onmessage = async (event) => {
  // ...
  const decoded = decoder.unpack(data);  // Reuse same instance
};
```

This saves allocation overhead on frame streaming. Not critical, but worth noting for high-frame-count races.

---

## Notes

- This is a **breaking change** to the POST endpoint (no longer returns loading status)
- HTTP polling is completely removed; if fallback is needed in future, implement as separate optional hook
- WebSocket becomes **critical infrastructure** for frontend; must handle reconnection gracefully
- Progress emitter pattern in backend can be reused for other long-running operations (data refresh, etc.)
- The 700ms MIN_DISPLAY_MS is intentional: ensures users see the modal is working even for instant cache hits

---

---

## Critical Bugs Fixed (From Peer Review)

This plan has been reviewed and **three critical issues have been corrected**:

### Bug 1: Falsy Progress Value Bug (0% Skipped)

**The Bug:**
```python
await callback(state, progress or self.progress, ...)
```
When progress=0, it's falsy, so the callback gets stale `self.progress` instead.

**The Fix:**
```python
effective_progress = self.progress if progress is None else progress
await callback(state, effective_progress, ...)
```
Use explicit None check instead of truthiness.

**Impact:** Prevented silent data corruption where progress updates could show wrong values.

---

### Bug 2: "Ghost Callback" Memory Leak (Multiple Reconnections)

**The Bug:**
Each WebSocket reconnection registered a new callback, but old ones were never unregistered. After N reconnections, the session tries to send to N dead WebSockets.

**The Fix:**
```python
def unregister_progress_callback(self, callback):
    if callback in self.progress_callbacks:
        self.progress_callbacks.remove(callback)

# In handler finally block:
session.unregister_progress_callback(progress_callback)
```

**Impact:** Prevented memory leak and server trying to send to dead connections.

---

### Bug 3: "Late Joiner" Cache Hit (No Progress for Cached Sessions)

**The Bug:**
If session was already cached/loaded before WebSocket connects, the client never saw progress events—only `loading_complete` with no intermediate updates.

**The Fix:**
```python
if session.is_loaded:
    await websocket.send_json({"type": "loading_progress", "progress": 100})
    await websocket.send_json({"type": "loading_complete", ...})
```

Send synthetic progress event to "catch up" clients that connect late.

**Impact:** Ensured consistent UX even for cache hits and second clients.

---

### Bug 4: Stale State on Refresh/Multiple Loads

**The Bug:**
When user refreshes or loads same race twice, `sessionId` stays identical. The `useLoadingState` hook only resets `openedAt` when `sessionId` changes. Second load reuses old timestamp, causing MIN_DISPLAY_MS logic to think modal has been open forever, closing instantly.

**The Fix:**
```typescript
// In handleSessionSelect BEFORE opening modal:
store.setLoadingProgress(0);
store.setLoadingError(null);
store.setLoadingComplete(false);
```

Explicitly reset state before new load.

**Impact:** Prevented "modal blinks" on second/refresh loads.

---

## Sign-Off Checklist

Before committing this implementation, verify:

- ✅ Code review passed for backend changes (state machine, progress emitter, WebSocket handler)
- ✅ Code review passed for frontend changes (store, hooks, modal)
- ✅ Integration tests pass for all scenarios (cached, slow, delayed, error)
- ✅ Manual testing confirms no race conditions
- ✅ Only ONE WebSocket connection appears in browser DevTools
- ✅ Modal always visible for minimum 700ms
- ✅ Progress bar shows realistic updates
- ✅ Cached loads emit visible progress sequence
- ✅ Error handling shows clear messages
- ✅ No console errors or warnings
- ✅ HTTP polling code completely removed
- ✅ Documentation updated (CLAUDE.md, if needed)
