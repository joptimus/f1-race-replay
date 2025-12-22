# Critical Files Registry

**Purpose:** This document lists files where rule compliance is MANDATORY before any changes. If you're about to modify a file listed below, read its associated rule FIRST.

**Status:** Active and Enforced
**Last Updated:** December 21, 2025

---

## How to Use This Document

### Before You Make Any Changes

1. **CHECK** - Is the file you want to modify listed in the table below?
2. **IF YES** → Open the associated rule document and read it completely
3. **ACKNOWLEDGE** - Understand what the rule requires before you code
4. **FOLLOW** - Execute the rule's process (planning, review, spikes, etc.)
5. **VERIFY** - Complete the rule's checklist before committing
6. **COMMIT** - Reference the rule in your commit message

### If You Try to Skip a Rule

The rule will still apply. You cannot bypass it. If you modify a protected file without following its rule, the code review will catch it and request changes.

---

## Protected Files by Severity

### 🔴 CRITICAL - Data Processing & Timing
These files control core system behavior. A single bug here breaks the entire application.

| File | Rule | Why Critical | Enforcement |
|------|------|--------------|-------------|
| `shared/telemetry/f1_data.py` | [F1_DATA_REVIEW_RULE.md](./F1_DATA_REVIEW_RULE.md) | Core telemetry processor. Controls timing, synchronization, frame generation. Previous bugs caused silent data corruption. | **MANDATORY CODE REVIEW** before commit |
| `backend/app/services/replay_service.py` | [REPLAY_SERVICE_RULE.md](./REPLAY_SERVICE_RULE.md) | Orchestrates data loading and WebSocket streaming. Timing issues cascade to frontend. | **MANDATORY DISCOVERY PHASE** in plan |
| `backend/app/websocket.py` | [WEBSOCKET_RULE.md](./WEBSOCKET_RULE.md) | Handles async/threading coordination. Frame streaming must be reliable. Thread-safe handoff critical. | **MANDATORY SPIKE** for async changes |

### 🟡 HIGH - Architecture & Global State
These files affect all components. Changes propagate system-wide.

| File | Rule | Why High Priority | Enforcement |
|------|------|-------------------|-------------|
| `frontend/src/store/replayStore.ts` | [GLOBAL_STORE_RULE.md](./GLOBAL_STORE_RULE.md) | Global state hub. Every UI component depends on it. State bugs cascade everywhere. | **MANDATORY ARCHITECTURE REVIEW** in plan |
| `backend/app/main.py` | [BACKEND_INITIALIZATION_RULE.md](./BACKEND_INITIALIZATION_RULE.md) | App setup, middleware, request routing. Affects all requests. | **MANDATORY IMPACT ANALYSIS** in plan |
| `frontend/src/hooks/useReplayWebSocket.ts` | [WEBSOCKET_HOOK_RULE.md](./WEBSOCKET_HOOK_RULE.md) | Bridges backend WebSocket to frontend state. Concurrency issues affect all sessions. | **MANDATORY DISCOVERY** of dependencies |

### 🟢 MEDIUM - Feature Components
These files implement user-visible features. Bugs affect user experience.

| File | Rule | Why Medium Priority | Enforcement |
|------|------|---------------------|-------------|
| `frontend/src/components/Leaderboard.tsx` | [LEADERBOARD_RULE.md](./LEADERBOARD_RULE.md) | Position calculations must match backend. Existing accuracy issues documented. | **ASSUMPTIONS & CONSTRAINTS** required in plan |
| `backend/core/config.py` | [CONFIG_RULE.md](./CONFIG_RULE.md) | Configuration affects all subsystems. Changes must be backward compatible. | **COMPATIBILITY CHECK** required |
| `legacy/main.py` | [LEGACY_RULE.md](./LEGACY_RULE.md) | Desktop app entry point. Must not break arcade interface. | **TESTING REQUIREMENTS** defined in rule |

---

## Rule Enforcement Process

### Step 1: Before Planning
- [ ] Check if your target file is in this registry
- [ ] If YES → Read the associated rule document
- [ ] If NO → Proceed with normal planning (but document assumptions)

### Step 2: During Planning
- [ ] Follow the rule's required planning steps
- [ ] Document assumptions and constraints (from rule)
- [ ] Identify risky areas and create spikes (from rule)
- [ ] List dependencies and impact (from rule)

### Step 3: Before Implementation
- [ ] Complete the rule's pre-implementation checklist
- [ ] Verify you understand edge cases the rule lists
- [ ] Confirm you have test/validation strategy

### Step 4: During Implementation
- [ ] Follow the rule's implementation constraints
- [ ] Do NOT skip steps the rule requires
- [ ] Verify against the rule's criteria as you code

### Step 5: Before Commit
- [ ] Complete the rule's verification checklist
- [ ] Confirm all rule requirements are met
- [ ] Reference the rule in commit message: `Implements CRITICAL_FILES:rule-name`

---

## Current Rules Status

### ✅ Active Rules (Enforced Now)
- **F1_DATA_REVIEW_RULE.md** - f1_data.py changes (MANDATORY CODE REVIEW)
- **RULES.md** - General code quality rules (ALL PROJECTS)

### 📝 Active Rules (Created, Waiting for Use)
- **REPLAY_SERVICE_RULE.md** - Backend service orchestration
- **WEBSOCKET_RULE.md** - Async/thread safety coordination
- **WEBSOCKET_HOOK_RULE.md** - Frontend-backend bridge
- **GLOBAL_STORE_RULE.md** - Frontend global state management
- **BACKEND_INITIALIZATION_RULE.md** - FastAPI app setup
- **LEADERBOARD_RULE.md** - Position calculation consistency
- **CONFIG_RULE.md** - Configuration management
- **LEGACY_RULE.md** - Arcade desktop app stability

---

## If a File Isn't Listed

You can modify it with normal development practices. But if:
- It handles timing, coordination, or concurrency
- It's a core architectural component
- Multiple files depend on it
- Past bugs in this area caused issues

Consider whether it should be added to this registry. Contact the project lead to discuss.

---

## Example: What Happens When You Follow the Rules

### Bad Path (Rule Ignored)
```
Agent: "I'll add loading progress to f1_data.py"
→ Makes changes without reading F1_DATA_REVIEW_RULE.md
→ Doesn't understand timing coordinate system
→ Introduces silent data corruption bug
→ Code review catches it, requests complete rewrite
→ Multiple iterations, delayed delivery
```

### Good Path (Rule Followed)
```
Agent: "I need to modify f1_data.py"
→ Checks CRITICAL_FILES.md
→ Reads F1_DATA_REVIEW_RULE.md completely
→ Understands timing system, multiprocessing constraints
→ Plans change carefully, documents assumptions
→ Invokes code review agent as required
→ Implementation is correct first try
→ Code review approves, merged smoothly
```

---

## How Rules Are Maintained

**Project Lead Responsibilities:**
- Review this registry quarterly
- Add new critical files as they become architectural hubs
- Update rules when architecture changes
- Remove rules for non-critical files

**Agent Responsibilities:**
- Read this registry before modifying protected files
- Follow the associated rules completely
- Report if a rule is unclear or outdated
- Suggest new rules for files that keep causing issues

---

## Escalation: What If You Disagree With a Rule?

You cannot skip a rule. Instead:

1. **Document your disagreement** in your plan
2. **Explain why you believe the rule is wrong**
3. **Propose an alternative approach**
4. **Present this to project lead** for review
5. **Await decision** before proceeding

Rules exist because past problems occurred. They can be updated, but not bypassed.

---

## Related Documents

- [RULES.md](./RULES.md) - General project rules
- [F1_DATA_REVIEW_RULE.md](./F1_DATA_REVIEW_RULE.md) - f1_data.py enforcement
- [CLAUDE.md](../../CLAUDE.md) - Main project guide

---

**This registry is law for this project. Follow it completely.**
