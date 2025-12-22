# Loading Modal Implementation - Plan vs Reality Summary

## Original Plan (from docs/REVIEWS/README.md)

The original plan designed a comprehensive WebSocket-based loading state system with these components:

1. **Backend**: LoadingState enum + progress callbacks + WebSocket event streaming
2. **Frontend**: Loading state machine (INIT → LOADING → READY/ERROR) with 700ms minimum display time
3. **Single Source of Truth**: One WebSocket connection per session managing all loading state
4. **HTTP Polling Removal**: Replace old HTTP polling with WebSocket-only updates

## What Actually Got Built (Different from Plan)

### 1. **Progress Emission Architecture**
- **Plan Expected**: Progress callbacks in replay_service would be called immediately and emit to WebSocket
- **Reality Implemented**: Progress callbacks run in background thread; required capturing event loop BEFORE spawning thread and using `asyncio.run_coroutine_threadsafe()` to schedule async emission back to main loop
- **Why Different**: Python's `asyncio.get_event_loop()` doesn't work from background threads - had to use closure pattern with pre-captured loop reference

### 2. **Session Metadata Delivery**
- **Plan Expected**: Metadata would come from POST `/api/sessions` endpoint response
- **Reality Implemented**: Metadata is sent via WebSocket `loading_complete` message instead
- **Why Different**: POST endpoint was simplified to return only `{"session_id": session_id}` per the new architecture; metadata needed to flow through WebSocket channel to maintain single source of truth, and frontend needed to receive it AFTER full loading completes (not before) so the data is guaranteed valid

### 3. **Modal Dependency Array**
- **Plan Expected**: Effect dependencies would be straightforward (isOpen, loading state)
- **Reality Implemented**: Required careful removal of `progress` and `error` from effect dependencies; relied on memoized functions (`shouldClose`, `getCloseDelayMs`) with closure dependencies to prevent infinite loops
- **Why Different**: React re-renders component when store values change; if dependencies included store values, the effect would re-run on every progress update, creating an infinite loop of setSessionLoading calls

### 4. **Event Loop Threading**
- **Plan Expected**: Async/await would naturally handle background thread coordination
- **Reality Implemented**: Required explicit thread-safe callback scheduling:
  ```python
  loop = asyncio.get_event_loop()  # Capture BEFORE spawning thread
  asyncio.run_coroutine_threadsafe(emit_progress(...), loop)  # From background thread
  ```
- **Why Different**: Background threads in asyncio don't have their own event loop; needed explicit hand-off to main loop

### 5. **Late Joiner Scenario**
- **Plan Expected**: Late joiner handling would send catch-up progress updates
- **Reality Implemented**: Late joiner handling now also sends full metadata with loading_complete message
- **Why Different**: Without metadata, late joiners (connecting after load completes) would get no session data; metadata had to be included in both code paths (fresh load + late joiner)

## Critical Bugs Fixed During Implementation

1. **Progress Stalled at 60%**: Progress callback was updating instance variables but not emitting to WebSocket callbacks
2. **"Maximum Update Depth Exceeded"**: Loading modal's effect dependency array included `progress` which changed on every update, triggering infinite re-renders
3. **Missing Session Data on Map**: POST endpoint no longer returned metadata; needed to send it via WebSocket instead
4. **Event Loop Not Available in Thread**: `asyncio.get_event_loop()` failed in background thread; required pre-capturing loop before spawning thread

## Data Flow (Actual Implementation)

```
1. User selects race
2. POST /api/sessions → Returns only {session_id}
3. Frontend opens modal, resets loading state, navigates to /replay
4. WebSocket connects with session_id
5. Backend starts async load_data()
6. Telemetry processing in background thread calls progress_callback:
   - progress_callback uses pre-captured loop
   - Schedules emit_progress via asyncio.run_coroutine_threadsafe()
   - emit_progress calls registered WebSocket callbacks
7. WebSocket sends progress messages (0%, 10%, 15-60%, 75%, 90%, 100%)
8. Frontend receives progress → updates store → modal re-renders with new progress bar
9. Backend finishes loading → sends loading_complete with full metadata
10. Frontend receives metadata → setSession updates store
11. Components re-render with track geometry, driver colors, etc.
12. Modal auto-closes after 700ms minimum display
```

## Key Implementation Differences

| Aspect | Original Plan | Actual Implementation |
|--------|---------------|----------------------|
| **Progress Source** | Explicit emit calls at milestones | Background thread callback + async scheduling |
| **Metadata Delivery** | POST response | WebSocket loading_complete message |
| **Thread Coordination** | Implicit asyncio | Explicit `asyncio.run_coroutine_threadsafe()` |
| **Effect Dependencies** | Direct store values | Memoized callback functions |
| **Late Joiner** | Progress catch-up only | Progress + metadata catch-up |

## Lessons Learned

1. **Python asyncio + Threading**: Requires explicit loop capture and thread-safe callback scheduling; `get_event_loop()` from thread is unreliable
2. **React Effect Dependencies**: Derived values (functions computing from state) must be memoized with correct dependencies to prevent infinite loops
3. **Metadata Timing**: Session metadata should flow through the same channel as loading state for consistency; sending it via POST is inconsistent with WebSocket-based architecture
4. **Progress Granularity**: Background thread callbacks provided finer-grained progress updates than the plan's explicit milestone approach

## Result

Loading modal now:
- ✅ Shows continuous progress updates during frame generation (10-60% with ~250 frame intervals)
- ✅ Displays full session data once loading complete (track geometry, driver colors)
- ✅ Maintains 700ms minimum display time to prevent jarring UX
- ✅ Auto-closes after loading completes + minimum time elapsed
- ✅ Handles both fresh loads and late joiners with complete data
- ✅ Single WebSocket as source of truth for loading state AND session data
