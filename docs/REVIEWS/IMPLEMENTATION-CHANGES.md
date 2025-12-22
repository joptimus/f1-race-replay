# Implementation Plan Changes - Summary

**Date:** December 21, 2025
**Status:** Final Revision Incorporated

---

## What Changed From Original Plan

Based on peer feedback, the plan was significantly revised to enforce **a single WebSocket connection strategy** rather than allowing two separate WebSocket connections.

### The Critical Fix: One WebSocket, One Hook

**Original Plan (INCORRECT):**
```
useLoadingState hook
  └─ Opens WebSocket #1 to /ws/loading/{sessionId}
     └─ Handles loading state only

useReplayWebSocket hook
  └─ Opens WebSocket #2 to /ws/replay/{sessionId}
     └─ Handles frame streaming

PROBLEM: Two connections to same session = inefficient, harder to debug
```

**Revised Plan (CORRECT):**
```
useReplayWebSocket hook (EXTENDED)
  └─ Opens single WebSocket to /ws/replay/{sessionId}
     ├─ Handles loading_progress, loading_complete, loading_error
     ├─ Dispatches to store: setLoadingProgress(), setLoadingComplete(), setLoadingError()
     └─ Then handles frame streaming

useLoadingState hook (STORE SUBSCRIBER ONLY)
  └─ Does NOT open WebSocket
  └─ Subscribes to store for: loadingProgress, loadingError, isLoadingComplete
  └─ Computes MIN_DISPLAY_MS logic
  └─ Returns state for LoadingModal to use

SOLUTION: One connection, all state flows through store
```

---

## Major Changes to Code Architecture

### 1. useReplayWebSocket (MAJOR REWRITE)

**Before:** Only handled frame streaming
**After:** Handles BOTH loading state AND frame streaming

- Now dispatches `setLoadingProgress()`, `setLoadingError()`, `setLoadingComplete()` to store
- Receives `loading_progress` messages and updates store
- Receives `loading_complete` message and sets store flag
- Receives `loading_error` message and updates store
- Then continues with frame streaming as before

**Key change:** This is now the single entry point for all WebSocket communication.

### 2. New useLoadingState Hook (PURE SUBSCRIBER)

**Before:** Did not exist
**After:** Store-subscriber only (NO WebSocket logic)

- Reads `loadingProgress`, `loadingError`, `isLoadingComplete` from store
- Computes MIN_DISPLAY_MS logic (700ms minimum)
- Returns: `{ progress, error, shouldClose(), getCloseDelayMs() }`
- **Does NOT open a WebSocket**

**Key change:** Separation of concerns - UI logic separate from connection logic.

### 3. Store Extensions

Added to `replayStore.ts`:
```typescript
loadingProgress: number;        // 0-100
loadingError: string | null;    // null or error message
isLoadingComplete: boolean;     // true when loading_complete received
setLoadingProgress(progress);
setLoadingError(error);
setLoadingComplete(complete);
```

### 4. Backend Message Types (FINALIZED)

Backend emits exactly these types during loading:
1. `loading_progress` - includes progress (0-100) and message
2. `loading_complete` - final confirmation
3. `loading_error` - on failure

**Important:** Backend does NOT send `loading_started` as separate message. First `loading_progress` signals loading started.

---

## Why This Matters

### Before (Race Condition)
```
HTTP polling decides modal close
   ↓ vs ↓
WebSocket sends status messages

One usually wins, other loses = race condition
Modal closes before status arrives
```

### After (No Race)
```
Backend sends to single WebSocket
   ↓
useReplayWebSocket receives, dispatches to store
   ↓
useLoadingState subscribes to store
   ↓
LoadingModal renders based on store state
   ↓
SINGLE SOURCE OF TRUTH (store)
NO RACE CONDITIONS
```

---

## Edge Cases Fixed

### Cached Data (Instant Load)
- Backend still emits: `loading_progress(0%)` → `loading_progress(100%)` → `loading_complete`
- Frontend sees progression visually even though it's instant
- Modal stays open minimum 700ms regardless
- **Result:** No silent success, user sees activity

### Multiple Rapid Clicks
- Only one WebSocket connection at a time
- New session selection closes old WS, opens new one
- Store reset on new session selection
- **Result:** Clean transition between sessions

### WebSocket Timeout
- If no progress within 10s, emit error
- Modal shows error state with dismiss button
- User can retry loading
- **Result:** Clear feedback instead of spinning forever

### HTTP Polling Removal
- `pollSessionStatus()` completely deleted
- POST returns only `{ sessionId }`, never `{ loading: ... }`
- Frontend never checks HTTP response for loading status
- **Result:** Single flow through WebSocket only

---

## Implementation Order (Unchanged)

The implementation order remains:
1. Backend Phase 1 (4 parts, ~70 min)
2. Frontend Phase 2 (3 parts, ~60 min)
3. Phase 3 Edge cases (~30 min)
4. Testing (~45 min)

**Total:** ~3.5 hours

---

## Testing Assertions (NEW)

Before signing off, verify:

1. **Network tab has exactly ONE WebSocket**
   - Open DevTools Network tab
   - Select a race
   - Should see ONLY ONE connection to `/ws/replay/{sessionId}`
   - Should NOT see `/ws/loading/{sessionId}` or multiple connections

2. **Message flow is correct**
   - Browser console should show progression
   - No warnings about "duplicate WebSocket"
   - All messages come through single connection

3. **Modal behavior is consistent**
   - Cached load: modal visible 700-1000ms with instant progress
   - Fresh load: modal visible while progress bar updates
   - Error: modal shows error, user can dismiss

---

## Files Modified

### Backend
- `backend/app/services/replay_service.py` - Add LoadingState enum, progress emitter, update load_data()
- `backend/app/api/sessions.py` - Simplify POST endpoint
- `backend/app/websocket.py` - Update handler with structured messages

### Frontend
- `frontend/src/store/replayStore.ts` - Add loading state fields
- `frontend/src/hooks/useReplayWebSocket.ts` - MAJOR REWRITE, extend for loading events
- `frontend/src/hooks/useLoadingState.ts` - NEW, pure subscriber hook
- `frontend/src/components/LoadingModal.tsx` - Use new hooks
- `frontend/src/App.tsx` - Remove HTTP polling

---

## Documentation

All code has detailed comments explaining:
- Why one WebSocket strategy is chosen
- What each message type means
- Data flow from backend to frontend
- Edge cases and their handling
- Timeout and error semantics

See the implementation plan document for complete code examples.

---

## Sign-Off

✅ **Architecture:** Single WebSocket is the correct approach
✅ **Race Condition:** Completely eliminated by WebSocket-as-source-of-truth
✅ **UX:** MIN_DISPLAY_MS ensures visible feedback even for instant loads
✅ **Maintainability:** Clear separation (connection logic vs UI logic)
✅ **Testing:** Can verify single connection in browser DevTools
✅ **Edge Cases:** Timeout, errors, multiple clicks all handled

**Ready for implementation.**
