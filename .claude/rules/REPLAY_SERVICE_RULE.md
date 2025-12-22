# Replay Service Rule

**Status:** Active
**Severity:** CRITICAL
**Applies To:** `backend/app/services/replay_service.py`
**Effective Date:** December 21, 2025

## Rule Statement

Any change to the logic, data flow, or orchestration in `replay_service.py` **MUST** include a discovery phase documenting assumptions about data loading and WebSocket coordination. This file orchestrates the entire replay session lifecycle—a bug here affects all users.

---

## When This Rule Applies

### Changes That Require Discovery Phase

✅ **REQUIRES** documented assumptions:
- Changes to session initialization logic
- Modifications to frame streaming approach
- Updates to data loading coordination
- Changes to metadata handling or caching strategy
- Modifications to error handling or retry logic
- Any changes to how the service coordinates with f1_data.py
- Changes to WebSocket frame serialization/sending logic
- Modifications to session state management

### Changes That DON'T Require Discovery Phase

❌ **DOES NOT REQUIRE** discovery:
- Documentation or comment updates
- Logging additions
- Variable renaming with no logic change
- Type annotation updates
- Simple refactoring (extract method, rename class) with no behavior change

---

## Discovery Phase Requirements

**Before you plan or implement, you MUST document:**

### 1. Data Flow Assumptions

```
Question: How does data flow from f1_data.py → replay_service → WebSocket?

Document:
- What is the contract between f1_data.py and replay_service?
  (What does get_race_telemetry() return? What fields are guaranteed?)
- How is this data transformed/filtered before streaming?
- What happens if f1_data.py returns incomplete data?
- What happens if WebSocket disconnects mid-stream?
```

### 2. Concurrency Model

```
Question: How do threads/async tasks coordinate in this service?

Document:
- Is data loading synchronous or async?
- How does the backend handle multiple simultaneous session requests?
- What happens if two users request the same session simultaneously?
- How is state thread-safe? (Are there race conditions?)
- How does error in one session affect others?
```

### 3. Metadata & State

```
Question: How is session state managed?

Document:
- What metadata is computed vs. passed from backend?
- Where is state stored? (Memory, cache, f1_data.py?)
- How is state consistency maintained?
- What happens if cache is stale or corrupted?
- How do you know if a session is "ready" to stream?
```

### 4. WebSocket Contract

```
Question: What does the frontend expect from WebSocket?

Document:
- What frame format is expected? (Fields, data types, structure)
- What if a frame is too large or malformed?
- How does the frontend handle frame drops or reordering?
- What happens if streaming falls behind playback?
- How does the frontend know when session loading is complete?
```

### 5. Dependencies on f1_data.py

```
Question: How does replay_service depend on f1_data.py?

Document:
- What functions from f1_data.py are called?
- What are the assumptions about their behavior?
  (Speed, memory usage, caching behavior)
- What happens if f1_data.py returns different data on second call?
- How do changes to f1_data.py timing affect this service?
```

---

## Planning Requirements

Your plan MUST include:

### Section 1: Documented Assumptions (from above)
Copy your discovery answers into your plan.

### Section 2: Edge Cases to Handle
For your specific change, list:
- What breaks if data loading is slow?
- What breaks if WebSocket disconnects?
- What breaks if metadata is incomplete?
- What breaks if multiple sessions load simultaneously?

### Section 3: Impact Analysis
Identify:
- What frontend components depend on this change?
- What happens if the format or timing changes?
- Which existing tests must pass?
- What new tests are needed?

### Section 4: Spike/Prototype (if needed)
If your change involves:
- New async patterns
- Different data flow
- Changed frame format
- New coordination between components

Create a minimal working prototype that proves it works.

---

## Implementation Constraints

When implementing your change:

### ✅ DO
- Keep the service as a thin orchestration layer
- Make data contracts explicit (type hints, validation)
- Log state transitions and critical decisions
- Handle errors gracefully (don't crash the whole service)
- Validate data from f1_data.py before using it

### ❌ DON'T
- Add complex business logic (belongs in f1_data.py)
- Change frame format without frontend discussion
- Assume f1_data.py will always succeed
- Serialize NumPy types directly to JSON
- Assume WebSocket is always connected

---

## Testing & Validation

Before submitting:

- [ ] Tested with a full session load
- [ ] Tested with session request while another is loading
- [ ] Tested with WebSocket disconnect mid-stream
- [ ] Tested with slow/fast playback
- [ ] Tested with different session types (race, quali, sprint)
- [ ] Verified frame format matches frontend expectations
- [ ] Confirmed no regression in existing sessions
- [ ] Load times unchanged (or documented why they changed)

---

## Code Review Checklist

When the code review agent examines this, they will verify:

- [ ] **Assumptions documented** - Discovery phase answers present
- [ ] **Data contracts explicit** - Type hints, validation present
- [ ] **Error handling** - All failure paths handled
- [ ] **WebSocket safety** - Serialization correct, no blocking
- [ ] **f1_data.py contract** - Assumptions about its behavior valid
- [ ] **Concurrency** - No race conditions on shared state
- [ ] **Frame format** - Matches what frontend expects
- [ ] **Backward compatibility** - Old clients still work (if applicable)
- [ ] **Performance** - Load times acceptable
- [ ] **Edge cases** - Handles disconnect, slow load, multiple sessions

---

## Related Rules

- [F1_DATA_REVIEW_RULE.md](./F1_DATA_REVIEW_RULE.md) - If you modify f1_data.py calls
- [WEBSOCKET_RULE.md](./WEBSOCKET_RULE.md) - If you change frame streaming
- [BACKEND_INITIALIZATION_RULE.md](./BACKEND_INITIALIZATION_RULE.md) - If you add service initialization logic

---

## Why This Rule Exists

`replay_service.py` is the **orchestrator** that:
1. Loads telemetry from f1_data.py (which is complex and timing-critical)
2. Coordinates data streaming to frontend via WebSocket
3. Manages session state for multiple concurrent users
4. Bridges backend async patterns with frontend expectations

A bug here cascades to users immediately. The discovery phase prevents bugs by forcing you to understand the contracts and concurrency model **before** you code.

Past issues with this file include:
- Assuming single-threaded execution when async is happening
- Not validating data from f1_data.py
- Serializing NumPy arrays directly to JSON
- Changing frame format without frontend coordination

This rule prevents those patterns.