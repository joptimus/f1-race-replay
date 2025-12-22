# Loading Modal Implementation

Comprehensive documentation for the WebSocket-based loading modal and session initialization system.

## Overview

The loading modal provides a visual progress indicator while the backend processes F1 race telemetry data. It serves as the single source of truth for session loading state and ensures data consistency between frontend and backend.

## Documentation

### [plan-vs-reality.md](plan-vs-reality.md)
**Plan vs Implementation Analysis**

Detailed comparison of the original design plan from the review documents versus what was actually implemented. Documents:
- 5 key architectural differences between plan and implementation
- 4 critical bugs discovered and fixed during development
- Technical trade-offs and design decisions
- Thread-safety and asyncio challenges resolved

**Use this to understand:** Engineering challenges, why the implementation diverged from the plan, critical design decisions.

### [data-timeline.md](data-timeline.md)
**Data Arrival Timeline**

Frame-by-frame breakdown of what data the UI knows at each moment during session loading. Shows:
- T+0 to T+100: 8 critical timeline moments
- Exact JSON payloads at each stage
- Complete UI store state at each moment
- What's visible on screen at each phase
- The critical T+95 moment when all data arrives

**Use this to understand:** Data flow sequence, when metadata becomes available, UI state transitions, synchronization points.

## Quick Reference

### Critical Timeline Points

| Time | Event | Data Available |
|------|-------|-----------------|
| T+0 | POST /api/sessions | session_id only |
| T+0.5 | WebSocket connects | (same) |
| T+2 | FastF1 session loaded | 10% progress |
| T+5-60 | Frame generation | 15-60% progress |
| T+70 | Track geometry built | 75% progress |
| T+85 | Frames serialized | 90% progress |
| **T+95** | **COMPLETE** | **Full metadata + all frames** |
| T+100 | Modal closes | UI fully interactive |

### Key Components

- **Backend:** `backend/app/services/replay_service.py` - Session loading logic, progress emission
- **WebSocket Handler:** `backend/app/websocket.py` - Progress callback registration, metadata streaming
- **Frontend Hook:** `frontend/src/hooks/useReplayWebSocket.ts` - WebSocket message handling, state updates
- **Frontend Component:** `frontend/src/components/LoadingModal.tsx` - Loading UI, auto-close logic
- **State Hook:** `frontend/src/hooks/useLoadingState.ts` - Modal timing, 700ms minimum display

### The Most Important Moment

**T+95** is when the backend sends `loading_complete` with full session metadata. This is the instant where:
- Backend finishes ALL processing
- Frontend receives complete metadata (track geometry, driver colors, frame count)
- UI transitions from "loading spinner" to "fully interactive race visualization"

Before T+95: Only loading modal visible
After T+95: Full race visualization available

## Implementation Details

### Progress Emission (Backend Threading Challenge)

Progress callbacks run in a background thread but need to emit async events. Solution:
```python
loop = asyncio.get_event_loop()  # Capture BEFORE spawning thread
asyncio.run_coroutine_threadsafe(emit_progress(...), loop)  # From background thread
```

### Modal Closure Logic (React Dependencies)

Prevent infinite loops by memoizing functions and excluding store values from effect dependencies:
```typescript
const shouldClose = useCallback(() => {
  // Logic based on closured values
}, [openedAt, error, isLoadingComplete]);  // Not including progress
```

### Metadata Delivery (Single Source of Truth)

Session metadata flows entirely through WebSocket `loading_complete` message:
- POST endpoint returns only `session_id`
- WebSocket streams progress updates (0-100%)
- WebSocket sends full metadata with `loading_complete`
- No HTTP polling, no competing data sources

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project architecture overview
- [docs/DEVELOPMENT/f1-data-review-rule.md](../DEVELOPMENT/f1-data-review-rule.md) - Code review requirements for telemetry changes
