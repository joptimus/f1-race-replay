# Global Store Rule

**Status:** Active
**Severity:** HIGH
**Applies To:** `frontend/src/store/replayStore.ts`
**Effective Date:** December 21, 2025

## Rule Statement

Any change to the global replay store logic, state structure, or derived selectors **MUST** include a documented architectural review of how that state flows through React components. This store is the single source of truth for the entire UI—changes here affect every component.

---

## When This Rule Applies

### Changes That Require Architectural Review

✅ **REQUIRES** review:
- Changes to state structure or fields
- Modifications to how state is derived (selectors)
- Changes to component subscriptions or hooks
- Updates to async state handling (loading, error states)
- Modifications to how frontend coordinates with WebSocket
- Changes to derived data (computed positions, gaps, etc.)
- Changes to effect dependencies in hooks using the store
- Any new computed properties or transformations

### Changes That DON'T Require Review

❌ **DOES NOT REQUIRE** review:
- Documentation updates
- Type annotation changes (no behavior change)
- Variable renaming (no logic change)
- Comment additions
- Logging improvements

---

## Architectural Review Requirements

**Before planning or implementing, document:**

### 1. State Flow Diagram

```
Draw (text or ASCII) how data flows:

Backend WebSocket
    ↓
useReplayWebSocket hook
    ↓
Global store (Zustand)
    ↓
Selectors (memoized derivations)
    ↓
Components subscribe and re-render

For your change, show:
- What state is added/removed?
- What components subscribe to it?
- What selectors derive from it?
- What happens when it changes?
```

### 2. Component Dependency Map

```
Question: Which components depend on this state?

For each component that uses the store:
- What fields does it subscribe to?
- When they change, how is the component affected?
- What side effects occur? (re-renders, API calls)
- What if the state is undefined or incomplete?

List potential impact:
- Which components will re-render?
- Will re-renders cascade? (parent → child → ...)
- Is the re-render cost acceptable?
```

### 3. React Hook Dependencies

```
Question: What effect dependencies change?

For any component using useEffect + store:
- What state triggers the effect?
- What happens if that state is missing?
- Could the effect run at the wrong time?
- Could there be infinite loops?

Example: If you add a new field to store,
any effect depending on it might run too often.
```

### 4. WebSocket Integration

```
Question: How does your store change integrate with WebSocket?

Document:
- What data comes from WebSocket?
- What happens if WebSocket sends data for missing state?
- What happens if store state doesn't match backend?
- How is state consistency maintained?
- What is the source of truth? (backend or frontend?)
```

### 5. Selector Memoization

```
Question: Are derived values memoized correctly?

For any selector you add:
- Does it create new objects every render?
- Should it be memoized to prevent component re-renders?
- What inputs should it depend on?
- What is the cost of recomputation?

Example: If a selector sorts the leaderboard,
it should only recompute when the leaderboard changes.
```

---

## Planning Requirements

Your plan MUST include:

### Section 1: State Changes
List every field you're adding/removing/modifying:
- What does it represent?
- Where does it come from? (WebSocket, computed, etc.)
- What are valid values?
- What happens if it's undefined?

### Section 2: Component Impact Analysis
For each component affected:
- How does it use the state?
- Will it re-render more often? Why?
- Is the re-render necessary?
- Is performance acceptable?

### Section 3: Hook Integration
List every `useEffect`, `useMemo`, `useCallback` that depends on your changes:
- Are the dependencies correct?
- Could there be infinite loops?
- Could effects run at wrong time?
- Test scenarios to validate timing

### Section 4: Edge Cases
Document what happens if:
- State is missing/undefined
- WebSocket sends conflicting data
- Multiple sessions load simultaneously
- User navigates away mid-load
- Store state doesn't match backend

For each, describe your handling.

### Section 5: Testing Strategy
Define tests for:
- Store updates correctly with new state
- Components re-render when necessary
- Components don't re-render unnecessarily
- Effects run in correct order and with correct data
- Selectors return correct derived values
- Edge cases handled gracefully

---

## Implementation Constraints

When implementing:

### ✅ DO
- Keep store data minimal (don't duplicate what's derivable)
- Use selectors for computed/filtered data
- Memoize selectors to prevent unnecessary component renders
- Document what each store field represents
- Validate data when updating store
- Keep store updates synchronous (no async in Zustand)
- Use correct hook dependencies (`useEffect` dependencies matter!)

### ❌ DON'T
- Put complex computed data directly in store (derive it)
- Assume components will re-render (verify with React DevTools Profiler)
- Create new objects in selectors (memoize them!)
- Update store from within useEffect without careful dependency management
- Use store for temporary UI state (use component state instead)
- Ignore what the backend already provides (don't duplicate)
- Create circular dependencies between selectors

---

## Code Review Checklist

When code review examines this, they verify:

- [ ] **Architectural review done** - State flow documented
- [ ] **Component impact analyzed** - All dependents identified
- [ ] **Hook dependencies correct** - No infinite loops, right timing
- [ ] **Selectors memoized** - No unnecessary component re-renders
- [ ] **Edge cases handled** - Missing/conflicting data handled
- [ ] **No duplication** - Store not duplicating derived data
- [ ] **WebSocket integration** - Store stays in sync with backend
- [ ] **Performance acceptable** - Re-render count reasonable
- [ ] **Types correct** - TypeScript catches errors
- [ ] **Tests pass** - Edge cases validated

---

## Validation Before Commit

Before submitting, verify:

- [ ] Ran React DevTools Profiler to check re-renders
- [ ] Components re-render only when necessary
- [ ] Effects run in expected order and frequency
- [ ] Selectors return consistent values
- [ ] Store state matches backend data
- [ ] No console errors or warnings
- [ ] TypeScript compilation clean
- [ ] All tests pass
- [ ] Manual testing of affected components

---

## Related Rules

- [WEBSOCKET_HOOK_RULE.md](./WEBSOCKET_HOOK_RULE.md) - If you change WebSocket integration
- [RULES.md](./RULES.md) - General code quality

---

## Why This Rule Exists

The global store is the **single source of truth** for all UI state. Every component depends on it. A bug here cascades everywhere:

- Wrong state → Components render wrong data
- Incorrect memoization → Components re-render constantly (performance)
- Missing dependencies → Effects run at wrong time (stale data)
- Circular dependencies → Infinite loops (frozen UI)

Past issues with this file include:
- Selector creating new objects every render (constant re-renders)
- Effect depending on wrong store values (stale data bugs)
- Missing error handling (store update crashes if data malformed)
- Computed data duplicated in store (sync bugs)
- No validation on store updates (bad data from WebSocket goes straight to components)

The architectural review forces understanding **before** coding, preventing these patterns.
