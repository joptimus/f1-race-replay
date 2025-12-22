# Backend Initialization Rule

**Status:** Active
**Severity:** HIGH
**Applies To:** `backend/app/main.py`, `backend/core/config.py`
**Effective Date:** December 21, 2025

## Rule Statement

Any change to FastAPI app initialization, middleware, routing, or service configuration **MUST** include an impact analysis of how it affects all downstream requests and services. This file sets up the entire backend—a bug here breaks all API calls and WebSocket connections.

---

## When This Rule Applies

### Changes That Require Impact Analysis

✅ **REQUIRES** analysis:
- Changes to middleware (CORS, authentication, request handling)
- Modifications to route registration or request routing
- Changes to service initialization or dependency injection
- Updates to error handling or exception middleware
- Modifications to timeout, retry, or rate limiting behavior
- Changes to WebSocket route setup
- Updates to environment variable handling or configuration
- Changes to logging or monitoring setup
- Any new startup/shutdown tasks

### Changes That DON'T Require Analysis

❌ **DOES NOT REQUIRE** analysis:
- Documentation updates
- Comment additions
- Logging improvements
- Type annotations (no behavior change)
- Variable renaming

---

## Impact Analysis Requirements

**Before planning or implementing, document:**

### 1. Request Flow Mapping

```
Draw how a request flows through your system:

HTTP Request
    ↓
CORS Middleware
    ↓
Authentication (if present)
    ↓
Route Handler
    ↓
Service Layer
    ↓
Database/File I/O
    ↓
Response

For your change:
- Where in this flow does it occur?
- What requests does it affect? (all, specific routes, specific methods)
- What happens if this step fails? (error response? retry? log and continue?)
- Does it block other requests?
```

### 2. Service Dependencies

```
Question: What services depend on initialization?

For each service used in the app:
- How is it initialized? (at startup, on-demand, per-request)
- What happens if initialization fails?
- Can multiple requests use the same service instance?
- What state does the service maintain?
- Is the service thread-safe?

For your change:
- Does it affect service initialization?
- Does it change thread-safety assumptions?
- Could it cause race conditions?
```

### 3. Route Impact

```
Question: What routes are affected?

For each API route:
- Does your change affect how requests reach it?
- Could it block certain routes?
- Could it break WebSocket routes?
- What if the route handler throws an error?
- What response does the client get?
```

### 4. WebSocket Impact

```
Question: How does this affect WebSocket connections?

Document:
- WebSocket routes use the same middleware?
- Does initialization block WebSocket setup?
- What happens if a WebSocket route fails during init?
- Could middleware corruption mess with streaming?
- How are WebSocket errors handled vs. HTTP errors?
```

### 5. Configuration Impact

```
Question: What configuration changes?

Document:
- What environment variables are required?
- What are the defaults?
- What happens if a required variable is missing?
- Could this break existing deployments?
- Do clients need to update?
- Is there a migration path?
```

---

## Planning Requirements

Your plan MUST include:

### Section 1: Request Flow Impact
For your change, describe:
- Which requests are affected?
- How is the request flow modified?
- What new error cases occur?
- What's the error response to clients?

### Section 2: Service Dependencies
List:
- What services are used?
- What's the initialization order?
- What if initialization fails?
- What's the recovery/fallback?

### Section 3: Route Analysis
For each route affected:
- What's the current behavior?
- What's the new behavior?
- Is the change backward compatible?
- What breaks if you remove the change?

### Section 4: WebSocket Impact
Describe:
- Are WebSocket routes affected?
- Does initialization block streaming?
- What if a WebSocket route fails?
- Are timing assumptions changed?

### Section 5: Configuration Management
Document:
- What config variables change?
- What are defaults?
- Are there backward compatibility concerns?
- Do clients need updates?
- How is the change deployed?

### Section 6: Testing Plan
Define tests for:
- Startup/initialization sequence
- Each route works after change
- Error handling (missing config, service failure, etc.)
- WebSocket routes still work
- Concurrent requests work
- Backward compatibility (if applicable)

---

## Implementation Constraints

When implementing:

### ✅ DO
- Initialize services only once at startup (not per-request)
- Log startup sequence clearly (helps debugging)
- Handle initialization failures gracefully (warn, not crash)
- Make configuration explicit (document requirements)
- Test startup sequence thoroughly
- Keep middleware focused (one responsibility each)
- Use existing patterns from the codebase
- Document any assumptions about execution order

### ❌ DON'T
- Initialize services per-request (performance)
- Assume services are thread-safe without verification
- Change error responses (breaks client code)
- Add blocking I/O to startup (slows server startup)
- Require runtime configuration changes (need restart)
- Use global state across requests without synchronization
- Assume middleware execution order
- Break backward compatibility without migration path

---

## Code Review Checklist

When code review examines this, they verify:

- [ ] **Impact analysis complete** - All affected routes identified
- [ ] **Request flow clear** - Middleware order documented
- [ ] **Error handling** - All failure paths handled
- [ ] **Service initialization** - Order and dependencies documented
- [ ] **WebSocket impact** - No regression in streaming
- [ ] **Configuration clear** - Required vars documented, defaults set
- [ ] **Backward compatible** - Old clients still work (or migration documented)
- [ ] **Startup/shutdown clean** - Resources properly initialized/cleaned
- [ ] **No blocking I/O at startup** - Server starts quickly
- [ ] **Tests pass** - Startup sequence and routes verified

---

## Validation Before Commit

Before submitting, verify:

- [ ] Backend starts without errors
- [ ] All routes respond correctly
- [ ] WebSocket connection works
- [ ] Configuration requirements clear
- [ ] Error messages helpful (not cryptic)
- [ ] Startup time acceptable (<5 seconds ideally)
- [ ] No resource leaks (connections, file handles)
- [ ] Multiple concurrent requests work
- [ ] All tests pass
- [ ] Manual testing of affected routes

---

## Related Rules

- [REPLAY_SERVICE_RULE.md](./REPLAY_SERVICE_RULE.md) - If you modify service initialization
- [WEBSOCKET_RULE.md](./WEBSOCKET_RULE.md) - If you modify WebSocket routes
- [RULES.md](./RULES.md) - General code quality

---

## Why This Rule Exists

`main.py` sets up the entire backend infrastructure. Everything that happens in the app depends on it:

- Requests flow through middleware → if middleware is broken, all requests fail
- Services are initialized → if initialization fails, the app crashes
- Routes are registered → if route setup is wrong, endpoints disappear
- WebSocket is set up → if setup fails, streaming doesn't work

A single bug here breaks the entire system for all users. The impact analysis forces understanding of the cascade effect:

- Change middleware order → Could break authentication
- Change initialization sequence → Could cause race conditions
- Add blocking I/O → Could slow server startup
- Change error responses → Could break clients expecting specific errors
- Add required config → Could break existing deployments

Past issues include:
- CORS middleware added too late (some routes not protected)
- Service initialized per-request (performance degradation)
- Middleware assumed certain execution order (failed subtly)
- Error handling changed (clients broke because they expected different error format)
- Blocking I/O at startup (server took 2+ minutes to start)

The impact analysis prevents these patterns by forcing architectural thinking first.
