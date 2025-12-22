# Code Review: Loading Modal Race Condition

**Status:** Critical Issue Identified
**Severity:** High
**Date:** December 21, 2025
**Components Affected:** Frontend (App.tsx, LoadingModal.tsx, useReplayWebSocket.ts) and Backend (sessions.py, websocket.py)

---

## Executive Summary

The loading modal exhibits a critical **race condition** where it opens and immediately closes instead of staying visible during data processing. The root cause is a **timing gap between HTTP polling and WebSocket connectivity**, compounded by the POST endpoint returning immediately with `loading: true` before the session is properly initialized.

When data loads from cache (0.0s), the modal never visibly appears because:
1. Polling completes before WebSocket connects
2. No status messages are sent (cached data loads instantly)
3. Modal closes before progress bar can update

**Recommendation:** Implement a minimum modal display duration (500-1000ms) as a safety net while fixing the underlying synchronization issues.

---

## Issue Analysis

### The Complete Request Flow

```
1. handleSessionSelect() called
   ↓ setSessionLoading(true)
   ↓
2. POST /api/sessions
   ↓ Returns immediately with { loading: true, session_id, metadata }
   ↓ backend_tasks.add_task(session.load_data)
   ↓
3. pollSessionStatus() starts
   ↓ Polls GET /api/sessions/{sessionId} every 1000ms
   ↓ Waits for data.loading == false
   ↓
4. WebSocket connects (in parallel)
   ↓ Waits for session.is_loaded == true
   ↓ Sends status messages every 0.5s
   ↓ Sends "ready" message
   ↓
5. setLoadingProgress(progress) from WebSocket
   ↓
6. Polling completes
   ↓ setSessionLoading(false)
   ↓ Modal closes
```

**PROBLEM:** Steps 3-6 can complete before step 5 if polling is fast.

### Root Cause #1: Immediate HTTP Polling Completion

**File:** `frontend/src/App.tsx` (lines 334-365)

```typescript
const pollSessionStatus = async (sessionId: string) => {
  const maxAttempts = 120;
  let attempts = 0;

  const poll = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();

      setSession(data.session_id, data.metadata);

      if (!data.loading) {  // <-- RACE: Can return true before WebSocket ready
        setSessionLoading(false);
        navigate("/replay");
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000);
      } else {
        setSessionLoading(false);
        navigate("/replay");
      }
    } catch (err) {
      console.error("Failed to poll session status:", err);
      setSessionLoading(false);
    }
  };

  poll();
};
```

**Issue:** The polling checks `!data.loading` without considering WebSocket connection status. If the backend has already set `session.is_loaded = true`, polling will complete immediately, closing the modal.

**Scenario:** Cached data loads in 0.0s:
- POST returns at T+0ms
- Polling starts at T+10ms
- Backend completes at T+0ms, sets is_loaded = true
- GET /api/sessions returns `loading: false` at T+15ms
- Polling completes, calls `setSessionLoading(false)`
- Modal closes at T+20ms
- WebSocket hasn't had time to connect or send status

### Root Cause #2: No Status Messages for Cached Data

**File:** `backend/app/websocket.py` (lines 50-74)

```python
while not session.is_loaded:
    elapsed = asyncio.get_event_loop().time() - load_start

    # Send status update every 0.5 seconds (more frequent for progress bar)
    if elapsed - last_status_sent > 0.5:
        try:
            status_msg = session.loading_status or "Loading..."
            await websocket.send_json({
                "type": "status",
                "message": status_msg,
                "elapsed_seconds": int(elapsed)
            })
            last_status_sent = elapsed
            logger.info(f"[WS] Sent status to {session_id}: {status_msg}")
        except Exception as status_error:
            logger.warning(f"[WS] Failed to send status update to {session_id}: {status_error}")
            break

    if elapsed > load_timeout:
        logger.error(f"[WS] Session load timeout for {session_id} after {elapsed:.1f}s")
        await websocket.send_json({"error": f"Session load timeout after {elapsed:.0f}s"})
        await websocket.close()
        return

    await asyncio.sleep(load_check_interval)
```

**Issue:** This loop ONLY runs while `!session.is_loaded`. If the session loads instantly from cache before WebSocket even connects, the loop **never executes**, and **no status messages are ever sent**.

**Evidence:** Backend log shows `[2025-12-21 14:18:40] ... Session 2025_1_R loaded ... in 0.0s` — this means the entire loading completed before WebSocket could send even one status message.

### Root Cause #3: Artificial Delay Doesn't Help

**File:** `backend/app/services/replay_service.py` (lines 129-131)

```python
# Delay setting is_loaded to ensure WebSocket has time to send at least initial status
await asyncio.sleep(1.5)
self.is_loaded = True
```

**Issue:** This artificial 1.5s delay was added to try to help the WebSocket send status messages, but it's **racing against the polling**, not against WebSocket connection. Here's why:

1. Polling starts immediately and checks every 1000ms
2. The 1.5s delay means WebSocket **might** have time to send status
3. But polling STILL completes because:
   - If session loads from cache (0.0s) + 1.5s delay = 1.5s total
   - First poll at T+1000ms sees `is_loaded = false` (still waiting for delay)
   - Second poll at T+2000ms sees `is_loaded = true` (delay finished)
   - Polling completes, closes modal
   - WebSocket status messages get lost

The artificial delay is **insufficient** because polling might check during it, AND it's a hack that doesn't address the real issue.

### Root Cause #4: Backend Returns Too Early

**File:** `backend/app/api/sessions.py` (lines 17-41)

```python
@router.post("")
async def create_session(background_tasks: BackgroundTasks, request: SessionRequest):
    year = request.year
    round_num = request.round_num
    session_type = request.session_type
    refresh = request.refresh
    session_id = f"{year}_{round_num}_{session_type}"

    if session_id in active_sessions and not refresh:
        session = active_sessions[session_id]
        if session.is_loaded:
            if session.load_error:
                raise HTTPException(status_code=400, detail=session.load_error)
            return {"session_id": session_id, "metadata": session.get_metadata()}

    session = F1ReplaySession(year, round_num, session_type, refresh=refresh)
    active_sessions[session_id] = session

    background_tasks.add_task(session.load_data)  # <-- ASYNC BACKGROUND TASK

    return {
        "session_id": session_id,
        "loading": True,
        "metadata": session.get_metadata(),
    }
```

**Issue:** The POST endpoint returns IMMEDIATELY with `loading: True`, but sets up `session.load_data()` as a **background task**. The frontend can't tell if the session is truly still loading or if it's already done.

**Critical Problem:** When polling calls GET `/api/sessions/{sessionId}`, it checks `!data.loading`. But `session.is_loaded` might be false while the background thread hasn't started yet, or it might be true immediately for cached data.

### Root Cause #5: No Initial Status Message

**File:** `frontend/src/hooks/useReplayWebSocket.ts` (lines 73-93)

```typescript
wsRef.current.onmessage = async (event) => {
  try {
    // Handle JSON control messages (ready, status, error)
    if (typeof event.data === 'string') {
      const message = JSON.parse(event.data);

      if (message.type === 'ready') {
        console.log("[WS Client] Session ready - frames:", message.frames, "load time:", message.load_time_seconds + "s");
        setLoadingProgress(100);
        return;
      }

      if (message.type === 'status') {
        console.log("[WS Client] Status:", message.message, `(${message.elapsed_seconds}s)`);
        // Extract progress percentage from status message
        const progressMatch = message.message?.match(/(\d+(?:\.\d+)?)\s*%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          setLoadingProgress(Math.min(progress, 99));
        }
        return;
      }
      // ...
    }
```

**Issue:** Frontend expects progress updates in the format `"Processing telemetry: 42.5% (42/100)"`. But if the session loads from cache:
1. WebSocket connects
2. WebSocket sees `session.is_loaded = true` immediately
3. Status loop never runs (because session is already loaded)
4. Frontend receives ONLY the "ready" message
5. Progress bar jumps from 0% → 100% instantly
6. Modal closes

There's no intermediate status message to show the user that data is being loaded.

---

## Timeline of Events (Cached Data Scenario)

```
T+0ms:    User clicks race
          setSessionLoading(true)

T+5ms:    POST /api/sessions returns
          session.load_data() scheduled as background task
          pollSessionStatus() starts

T+10ms:   WebSocket connection initiated
          Polling iteration #1: checking /api/sessions/{id}

T+15ms:   Backend background task starts executing
          Session begins loading from cache

T+20ms:   Backend finishes loading (0.0s) in cache
          session.is_loaded = true
          (artificial 1.5s delay not yet active)

T+25ms:   GET /api/sessions returns: loading = false
          Polling sees !data.loading = true
          setSessionLoading(false) called

T+30ms:   Modal component receives isOpen = false
          AnimatePresence triggers exit animation
          Modal starts closing

T+35ms:   WebSocket finally connects
          Server sees session.is_loaded = true
          Skips status update loop
          Sends only "ready" message

T+40ms:   Frontend receives "ready"
          setLoadingProgress(100)
          But modal is already closed/closing
```

The WebSocket doesn't even get a chance to participate.

---

## Impact Assessment

### What Breaks
- Users see loading modal flicker or disappear instantly
- No progress feedback during telemetry processing
- For first-time loads (with processing), modal might stay open but show 0% progress
- For cached loads, modal is completely invisible
- Race condition timing depends on network latency and backend processing speed

### What Works
- Session data eventually loads correctly
- WebSocket eventually connects and streams frames
- Playback works fine once modal closes
- Status updates work if WebSocket connects before polling completes

### Affected Sessions
- **High Impact:** Cached data (0.0s processing) - modal invisible
- **Medium Impact:** Small races (fast processing) - brief or no modal visibility
- **Low Impact:** Large races (slow processing) - modal visible but might not show progress

---

## Risk Assessment

### Critical Risks
1. **User Confusion:** Modal appears/disappears too fast, looks like a bug
2. **Race Condition:** Timing dependent on network and CPU, not deterministic
3. **Data Loss Perception:** Users can't see if data is loading or stuck
4. **Testing Difficulty:** Hard to reproduce consistently due to timing randomness

### High Risks
1. **Polling Override:** HTTP polling can complete and close modal before WebSocket connects
2. **No Progress Visibility:** Status updates might never arrive
3. **Artificial Delay Ineffective:** The 1.5s delay doesn't guarantee WebSocket has sent anything
4. **Multiple Paths:** Different code paths (polling vs WebSocket) manage modal visibility

### Medium Risks
1. **Edge Cases:** Sprint qualifyings, red flags might have different timing
2. **Network Variance:** Fast vs slow networks show different behavior
3. **Cache Hit Rate:** Unclear whether this is cache hit or slower-than-expected data load

---

## Solutions

### Quick Fix: Minimum Display Duration (Recommended for Immediate Fix)

Add a minimum display time to prevent flickering even if logic is fast:

```typescript
// In LoadingModal.tsx or App.tsx
const [showTime, setShowTime] = useState(0);
const MIN_DISPLAY_TIME = 500; // milliseconds

useEffect(() => {
  if (isOpen) {
    setShowTime(Date.now());
  }
}, [isOpen]);

// Modify the modal close logic
const shouldClose = !isOpen && (Date.now() - showTime > MIN_DISPLAY_TIME);
```

**Pros:**
- Ensures users always see the modal for at least 500ms
- Prevents flickering
- Quick to implement

**Cons:**
- Doesn't fix underlying race condition
- Users might see modal when data is already loaded
- Artificial delay feels wrong

### Proper Fix: Sync Polling with WebSocket Ready

**Approach 1: Wait for WebSocket "ready" before closing modal**

Change polling to not close modal until WebSocket sends "ready":

```typescript
const [wsReady, setWsReady] = useState(false);

// In pollSessionStatus, only close if BOTH conditions met
if (!data.loading && wsReady) {
  setSessionLoading(false);
}

// In useReplayWebSocket, set wsReady when receiving "ready"
if (message.type === 'ready') {
  setWsReady(true);
  setLoadingProgress(100);
}
```

**Pros:**
- Fixes underlying race condition
- Modal stays open until truly ready
- Reliable and deterministic

**Cons:**
- Requires coordination between HTTP polling and WebSocket
- If WebSocket fails, modal might stay open indefinitely
- Need timeout for failure cases

**Approach 2: Move loading state management to WebSocket**

Stop using HTTP polling to determine "is loading". Let WebSocket be the source of truth:

```typescript
// In useReplayWebSocket, manage loading state
const setSessionLoading = useReplayStore((state) => state.setSessionLoading);

if (message.type === 'ready') {
  setLoadingProgress(100);
  setSessionLoading(false); // WebSocket closes modal, not polling
  navigateToReplay();
}

if (message.type === 'error') {
  setSessionLoading(false);
  showError(message.error);
}
```

**Pros:**
- Single source of truth
- WebSocket is more reliable indicator than HTTP polling
- Eliminates race condition entirely

**Cons:**
- Requires removing HTTP polling logic
- Need to handle network errors differently
- WebSocket must connect first

### Comprehensive Fix: Ensure Initial Status Message

**Approach:** Backend sends initial status message before checking `is_loaded`

```python
# In websocket.py, before waiting for session to load
load_check_interval = 0.5
last_status_sent = 0

# Send initial status message immediately
await websocket.send_json({
    "type": "status",
    "message": session.loading_status or "Starting...",
    "elapsed_seconds": 0
})
last_status_sent = 0

# Then start the wait loop
while not session.is_loaded:
    elapsed = asyncio.get_event_loop().time() - load_start

    if elapsed - last_status_sent > 0.5:
        # ... send status ...
```

**Pros:**
- Guarantees at least one status message
- Works for cached data
- Minimal code change

**Cons:**
- Doesn't fix polling override issue
- Still need proper synchronization

---

## Recommended Implementation Order

**Phase 1 (Immediate):** Quick Fix
1. Add minimum display time (500ms) to LoadingModal
2. Deploy and verify flickering is gone
3. This buys time for Phase 2

**Phase 2 (Next Sprint):** Proper Fix
1. Implement "Approach 2: Move loading state management to WebSocket"
2. Remove HTTP polling logic (or keep as fallback)
3. Add error handling for WebSocket connection failures
4. Test with both cached and fresh data loads

**Phase 3 (Optional):** Polish
1. Remove artificial 1.5s delay from F1ReplaySession
2. Implement smart status messages with actual progress percentage
3. Add loading state for different stages (loading session, fetching telemetry, building geometry, serializing)

---

## Testing Recommendations

### Unit Tests
- [ ] Modal stays open for minimum duration even if data loads instantly
- [ ] Progress updates correctly from 0 to 100
- [ ] Modal closes only when WebSocket sends "ready"
- [ ] Modal closes on error regardless of duration

### Integration Tests
- [ ] Cached session loads: Modal visible for minimum time
- [ ] Fresh session loads: Modal shows progress updates
- [ ] Network latency: Modal visible regardless of polling timing
- [ ] WebSocket disconnect: Modal has fallback behavior
- [ ] Large race (154k frames): Modal doesn't timeout prematurely

### Manual Tests
- [ ] Load race with cache: Modal appears and stays for ~500ms
- [ ] Load race without cache: Modal shows progress bar updating
- [ ] Load sprint: Modal behavior consistent
- [ ] Load qualifying: Modal behavior consistent
- [ ] Refresh data: Modal reappears with progress

### Edge Cases
- [ ] Network timeout: Polling times out, WebSocket eventually succeeds
- [ ] WebSocket only: Frontend has no polling, relies on WS "ready" only
- [ ] Polling only: Frontend has no WebSocket, relies on polling timeout
- [ ] Both fail: Proper error modal appears instead

---

## Code Locations to Review

| File | Issue | Priority |
|------|-------|----------|
| `frontend/src/App.tsx:334-365` | Polling logic doesn't wait for WebSocket | High |
| `backend/app/websocket.py:50-74` | Status loop skips for cached data | High |
| `frontend/src/components/LoadingModal.tsx:42-187` | No minimum display time | Medium |
| `backend/app/services/replay_service.py:129-131` | Artificial delay is insufficient | Medium |
| `frontend/src/hooks/useReplayWebSocket.ts:73-93` | No coordination with polling | High |
| `backend/app/api/sessions.py:17-41` | POST returns before session ready | Low |

---

## Conclusion

This is a **classic race condition** where two asynchronous systems (HTTP polling and WebSocket) are trying to manage the same UI state without proper synchronization. The modal closes when polling completes, potentially before the WebSocket even connects.

**Recommended immediate action:** Implement a 500-1000ms minimum display time as a safety net, then in the next sprint, implement proper WebSocket-based loading state management.

The underlying issue is architectural: loading state should be managed by the WebSocket (which represents the actual backend session state) rather than HTTP polling (which is less reliable for this use case).
