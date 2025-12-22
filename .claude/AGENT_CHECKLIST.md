# Agent Checklist: Before You Start Any Task

**Use this checklist EVERY TIME you start work on this project.**

---

## Step 1: Check Protected Files (2 minutes)

Before you plan or implement ANYTHING:

- [ ] **Open** [`.claude/rules/CRITICAL_FILES.md`](./rules/CRITICAL_FILES.md)
- [ ] **Find** the file(s) you're about to modify
- [ ] **Is it listed?**
  - **YES** → Go to Step 2
  - **NO** → Jump to Step 3

---

## Step 2: Read the Rule (5-10 minutes)

If your file is protected:

- [ ] **Open** the rule document listed in CRITICAL_FILES.md
- [ ] **Read the entire rule** - Don't skip sections
- [ ] **Understand what it requires:**
  - Code review? → You must invoke code review agent
  - Discovery phase? → You must document assumptions
  - Spikes? → You must create prototypes
  - Impact analysis? → You must map dependencies
  - Planning checklist? → Your plan must include these sections
- [ ] **Note the verification checklist** - You'll need this at the end

---

## Step 3: Plan Your Work

### If your file is NOT protected:

- [ ] Use normal planning process
- [ ] Document assumptions and constraints
- [ ] Create testing plan

### If your file IS protected:

- [ ] **Follow the rule's planning requirements exactly**
- [ ] Complete any discovery phase (document answers)
- [ ] Create any required spikes (prove approach works)
- [ ] Include all required sections in your plan
- [ ] Reference the rule in your plan
- [ ] Get project lead approval before proceeding

**Do not skip any required steps.** They exist because past mistakes happened.

---

## Step 4: During Implementation

- [ ] **Refer to the rule's implementation constraints**
- [ ] **Follow what the rule says to DO** ✅
- [ ] **Avoid what the rule says NOT to do** ❌
- [ ] **Keep the rule in mind** as you code
- [ ] **Verify against the rule** as you test

---

## Step 5: Before You Commit

- [ ] **Review the rule's verification checklist**
- [ ] **Verify every item** is complete
- [ ] **Test edge cases** the rule mentions
- [ ] **Check your code** against the rule's constraints
- [ ] **Confirm you've met all requirements**
- [ ] **If protected file:** Verify code review is complete or scheduled
- [ ] **Reference the rule in your commit message**

Example: `Implements CRITICAL_FILES:WEBSOCKET_RULE with spike validation`

---

## Step 6: Code Review

When you submit for review:

- [ ] **Include the rule** in your submission
- [ ] **Confirm you followed it** completely
- [ ] **Point out verification checklist items** you completed
- [ ] **Ask reviewer to verify** rule compliance
- [ ] **Be ready to explain** why each step was necessary

---

## Quick Reference: Which Files Need Rules?

**Check CRITICAL_FILES.md for the complete list, but here are the main ones:**

### 🔴 CRITICAL (Data/Timing)
- `shared/telemetry/f1_data.py` - Code review required
- `backend/app/services/replay_service.py` - Discovery required
- `backend/app/websocket.py` - Spike required

### 🟡 HIGH (Architecture)
- `frontend/src/store/replayStore.ts` - Architectural review required
- `backend/app/main.py` - Impact analysis required
- `frontend/src/hooks/useReplayWebSocket.ts` - Discovery required

### 🟢 MEDIUM (Features)
- `frontend/src/components/Leaderboard.tsx` - Assumptions required
- `backend/core/config.py` - Compatibility check required
- `legacy/main.py` - Testing plan required

---

## What "Rule Compliance" Means

### ✅ You ARE following the rule if:
- [ ] You read the entire rule before starting
- [ ] You completed all required sections (discovery, spike, analysis, etc.)
- [ ] Your plan includes everything the rule specifies
- [ ] Your implementation follows the rule's constraints
- [ ] You verified everything on the verification checklist
- [ ] You reference the rule in your commit message

### ❌ You are NOT following the rule if:
- [ ] You skipped reading the rule
- [ ] You skipped "optional" sections (there are none - all are required)
- [ ] Your plan is missing required sections
- [ ] You implemented without completing required discovery/spikes
- [ ] You didn't verify against the checklist
- [ ] You don't reference the rule in your commit

---

## What Happens If You Skip a Rule?

**Code review WILL catch it.** When the code reviewer checks your work:

- [ ] They will read the rule
- [ ] They will verify you followed it
- [ ] If you skipped steps, they will:
  - Request changes
  - Ask you to redo the work correctly
  - Block the commit until the rule is followed

**You cannot skip a rule and claim "it's fine." It's not.**

---

## Examples

### ✅ Good: Following a Rule

```
Task: "Add race start time detection to f1_data.py"

1. Check CRITICAL_FILES.md → f1_data.py is listed
2. Read F1_DATA_REVIEW_RULE.md → Requires code review
3. Plan: Document timing assumptions, mention code review required
4. Implement: Make the change, test carefully
5. Code Review: Invoke code review agent, get APPROVED
6. Verify: Check verification checklist
7. Commit: "fix: add race start time detection to f1_data.py

   Implements CRITICAL_FILES:F1_DATA_REVIEW_RULE
   Code review: APPROVED by review agent
   Risk assessment: Timing coordinate system preserved"
```

### ❌ Bad: Skipping a Rule

```
Task: "Improve WebSocket frame streaming"

1. Skip CRITICAL_FILES.md check (BIG MISTAKE)
2. Skip WEBSOCKET_RULE.md (BIG MISTAKE)
3. Plan: "I'll optimize frame sending" (no spike, no discovery)
4. Implement: Add frame buffering, don't test concurrency
5. Code Review: Reviewer checks CRITICAL_FILES.md
6. Reviewer finds WEBSOCKET_RULE, sees spike was skipped
7. Reviewer rejects: "This is a protected file. Rule requires spike.
   Please create minimal prototype proving your approach handles
   thread/asyncio coordination correctly."
8. You have to redo the work correctly
9. Time wasted on the wrong approach
```

---

## Helpful Links

- [CRITICAL_FILES.md](./rules/CRITICAL_FILES.md) - Registry of protected files
- [RULES.md](./rules/RULES.md) - General project rules
- [RULE_ENFORCEMENT_SYSTEM.md](../docs/DEVELOPMENT/RULE_ENFORCEMENT_SYSTEM.md) - How this system works
- [CLAUDE.md](../CLAUDE.md) - Main project guide

---

## Questions?

- **"What if I don't understand the rule?"** → Document what's unclear, ask project lead, don't skip the rule
- **"What if the rule seems wrong?"** → Document your concern, propose alternative, ask project lead
- **"Can I skip parts of the rule?"** → No. All parts are required.
- **"What if my task is small/simple?"** → Doesn't matter. If the file is protected, follow the rule.
- **"What if I've seen similar code before?"** → Still follow the rule. Past observations aren't discovery.

---

## Summary

**Every task starts here:**

1. ✅ Check CRITICAL_FILES.md
2. ✅ If protected → Read the rule
3. ✅ If protected → Follow the rule completely
4. ✅ Verify against the rule's checklist
5. ✅ Reference the rule in your commit

**Rules are not optional. They are how this project stays stable.**

**Follow them completely, every time.**
