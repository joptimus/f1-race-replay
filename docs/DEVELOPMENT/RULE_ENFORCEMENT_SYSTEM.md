# Rule Enforcement System for Claude Agents

**Created:** December 21, 2025
**Purpose:** Prevent bugs and failed implementations by making rules non-negotiable

---

## The Problem We Solved

Claude agents were:
1. **Ignoring rules** like F1_DATA_REVIEW_RULE even when they modified f1_data.py
2. **Skipping discovery phases** during planning, leading to incomplete plans
3. **Making invalid assumptions** about architecture without reading existing code
4. **Creating plans** that looked good but failed during implementation
5. **Spending time on failed implementations** instead of preventing issues upfront

**Result:** Wasted planning time, failed implementations, multiple iterations, frustrated developers.

---

## The Solution: Three-Layer Enforcement

### Layer 1: Critical Files Registry

**File:** `.claude/rules/CRITICAL_FILES.md`

A **mandatory checklist** that agents must follow before modifying any protected file.

#### How it works:
1. Agent wants to modify a file
2. Agent checks CRITICAL_FILES.md registry
3. If file is listed → Agent MUST read the associated rule
4. If file is not listed → Agent can proceed with normal development

#### Why it works:
- Registry is the first thing agents should check
- List is concise and clear
- Rules are referenced directly
- Non-compliance is caught in code review

#### Current Protected Files (by severity):

**🔴 CRITICAL** (Data/Timing)
- `shared/telemetry/f1_data.py` → [F1_DATA_REVIEW_RULE.md](../../.claude/rules/F1_DATA_REVIEW_RULE.md)
- `backend/app/services/replay_service.py` → [REPLAY_SERVICE_RULE.md](../../.claude/rules/REPLAY_SERVICE_RULE.md)
- `backend/app/websocket.py` → [WEBSOCKET_RULE.md](../../.claude/rules/WEBSOCKET_RULE.md)

**🟡 HIGH** (Architecture)
- `frontend/src/store/replayStore.ts` → [GLOBAL_STORE_RULE.md](../../.claude/rules/GLOBAL_STORE_RULE.md)
- `backend/app/main.py` → [BACKEND_INITIALIZATION_RULE.md](../../.claude/rules/BACKEND_INITIALIZATION_RULE.md)
- `frontend/src/hooks/useReplayWebSocket.ts` → [WEBSOCKET_HOOK_RULE.md](../../.claude/rules/WEBSOCKET_HOOK_RULE.md)

**🟢 MEDIUM** (Features)
- `frontend/src/components/Leaderboard.tsx` → [LEADERBOARD_RULE.md](../../.claude/rules/LEADERBOARD_RULE.md)
- `backend/core/config.py` → [CONFIG_RULE.md](../../.claude/rules/CONFIG_RULE.md)
- `legacy/main.py` → [LEGACY_RULE.md](../../.claude/rules/LEGACY_RULE.md)

### Layer 2: Rule Documents

**Files:** `.claude/rules/*.md`

Each protected file has a **detailed rule** specifying what must be done before changes.

#### Rule Structure:
1. **Rule Statement** - What is required (code review? discovery? spikes?)
2. **When It Applies** - What changes trigger the rule
3. **Discovery/Spike Requirements** - What research must be done
4. **Planning Requirements** - What the plan must include
5. **Implementation Constraints** - What you can/can't do
6. **Verification Checklist** - What to verify before commit
7. **Why This Rule Exists** - Historical context of failures

#### Examples:

**F1_DATA_REVIEW_RULE.md requires:**
- Logic change? → Mandatory independent code review
- Timing calculation change? → Expert review by code review agent
- Frame generation change? → Risk assessment document required

**REPLAY_SERVICE_RULE.md requires:**
- Discovery phase documenting data flow assumptions
- Concurrency model documented
- Dependencies on f1_data.py documented
- Impact analysis on WebSocket streaming

**WEBSOCKET_RULE.md requires:**
- Spike validating thread-safe handoff between threads and asyncio
- Spike validating JSON serialization (no NumPy arrays)
- Spike validating error handling and reconnection

**GLOBAL_STORE_RULE.md requires:**
- Architectural review of state flow
- Component dependency mapping
- Hook dependency analysis
- Memoization strategy for selectors

### Layer 3: Code Review Verification

**Process:** Before accepting a commit, code review verifies the rule was followed.

#### Code Review Checklist (per rule):

For **F1_DATA_REVIEW_RULE:**
- [ ] Logic change? Code review completed?
- [ ] Risk assessment document exists?
- [ ] All concerns addressed?

For **REPLAY_SERVICE_RULE:**
- [ ] Discovery phase answers documented?
- [ ] Data flow assumptions clear?
- [ ] Concurrency model documented?
- [ ] Impact analysis on WebSocket included?

For **WEBSOCKET_RULE:**
- [ ] Spike validated thread/async coordination?
- [ ] Spike validated JSON serialization?
- [ ] Spike validated error handling?
- [ ] No blocking operations in asyncio?

For **GLOBAL_STORE_RULE:**
- [ ] Architectural review completed?
- [ ] Component dependency map created?
- [ ] Hook dependencies verified?
- [ ] Selectors properly memoized?

---

## How Agents Should Use This System

### Before Planning Any Task

1. **Check CRITICAL_FILES.md** - Is your target file protected?
2. **If YES** → Read the associated rule completely
3. **If NO** → Proceed with normal planning

### During Planning

Follow the rule's requirements:
- Complete discovery phase (if required)
- Document assumptions and constraints
- Create spikes (if required)
- Complete impact analysis (if required)
- Write testing plan

### Before Implementation

Verify:
- [ ] You understand the rule completely
- [ ] You've completed all required discovery/spikes
- [ ] Your plan includes all required sections
- [ ] You're ready for code review

### During Implementation

- Follow the rule's implementation constraints
- Don't skip steps the rule requires
- Keep rule in mind as you code

### Before Commit

Verify:
- [ ] All rule requirements met
- [ ] Verification checklist completed
- [ ] Code review will find no issues
- [ ] Commit message references the rule

---

## Examples: Good vs Bad Paths

### Example 1: Modifying f1_data.py

**❌ Bad Path:**
```
Agent: "I'll add race start time logic to f1_data.py"
→ Doesn't check CRITICAL_FILES.md
→ Makes changes without reading F1_DATA_REVIEW_RULE
→ Doesn't understand timing coordinate system
→ Introduces subtle timing bug
→ Code review catches it, requests rewrite
→ 2+ iterations wasted
```

**✅ Good Path:**
```
Agent: "I need to modify f1_data.py"
→ Checks CRITICAL_FILES.md
→ Finds F1_DATA_REVIEW_RULE.md
→ Reads it completely, understands requirements
→ Makes change carefully, documents assumptions
→ Invokes code review agent as required
→ Code review approves, merged first try
```

### Example 2: Modifying WebSocket

**❌ Bad Path:**
```
Agent: "I'll improve frame streaming"
→ Doesn't check CRITICAL_FILES.md
→ Makes changes to websocket.py
→ Doesn't create spike validating thread/async coordination
→ Introduces race condition or deadlock
→ Issue only appears under load
→ Debugging takes hours
```

**✅ Good Path:**
```
Agent: "I need to change WebSocket frame streaming"
→ Checks CRITICAL_FILES.md
→ Finds WEBSOCKET_RULE.md
→ Creates minimal spike proving thread/async coordination works
→ Spike shows deadlock would occur, adjusts approach
→ Creates plan with spike evidence
→ Implementation uses proven approach
→ Code review verifies spike was done, approves
```

### Example 3: Modifying Global Store

**❌ Bad Path:**
```
Agent: "I'll add loading state to store"
→ Doesn't check CRITICAL_FILES.md
→ Adds loading state without memoizing selector
→ Components re-render constantly
→ UI becomes sluggish
→ Debugging performance regression takes time
```

**✅ Good Path:**
```
Agent: "I need to add loading state to global store"
→ Checks CRITICAL_FILES.md
→ Finds GLOBAL_STORE_RULE.md
→ Creates architectural review documenting state flow
→ Maps component dependencies
→ Plans proper memoization for selectors
→ Validates with React DevTools Profiler
→ Code review verifies memoization, approves
```

---

## Managing the Rules

### For Project Lead

**Quarterly Review:**
- Are the protected files still critical?
- Should new files be added to the registry?
- Should any rules be removed or updated?
- Have agents reported any rules are unclear?

**Adding New Rules:**
When you identify a critical file:
1. Create rule document in `.claude/rules/`
2. Add file to CRITICAL_FILES.md registry
3. Update RULES.md to reference the new rule
4. Commit all three changes

**Updating Existing Rules:**
If a rule is outdated or unclear:
1. Update the rule document
2. Note the change date
3. Consider if agents need to re-read it
4. Commit the change

### For Agents

**If a rule seems wrong:**
1. Document your concern
2. Propose an alternative
3. Include it in your plan
4. Ask project lead for decision
5. Do NOT skip the rule while awaiting response

**If a rule is unclear:**
1. Report the specific section that's unclear
2. Suggest what would make it clearer
3. Ask project lead for clarification
4. Do NOT skip the rule

---

## Measuring Success

### Before This System

- ❌ Agents modified f1_data.py without code review
- ❌ Plans were detailed but failed during implementation
- ❌ Multiple iterations on supposedly "finished" work
- ❌ Subtle bugs in critical systems discovered late
- ❌ Time wasted planning that couldn't be executed

### After This System

- ✅ All f1_data.py changes code reviewed independently
- ✅ Plans include required discovery/spikes (work proven before implementation)
- ✅ Implementation follows proven approaches (fewer iterations)
- ✅ Critical systems protected by mandatory processes
- ✅ Time saved by preventing failures instead of fixing them

### Metrics to Track

- **Rule Compliance Rate** - % of protected file changes that follow the rule
- **Plan Success Rate** - % of plans that can be executed without major changes
- **Implementation Iterations** - Average number of code review iterations needed
- **Bug Rate in Critical Systems** - Bugs per change in protected files (should decrease)
- **Planning Efficiency** - Time from plan to working implementation

---

## Summary

This enforcement system makes rules **binding**, not just guidelines:

1. **Critical Files Registry** - Agents can't miss rules
2. **Detailed Rule Documents** - Each rule specifies exactly what's required
3. **Code Review Verification** - Non-compliance caught and rejected
4. **Clear Guidance** - Agents know what to do before they start

**Result:** Protected systems, prevented bugs, efficient planning and implementation.

**Key insight:** Rules work when they're unavoidable. This system makes them unavoidable.
