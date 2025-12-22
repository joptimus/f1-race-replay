# F1 Data Logic Review Rule

**Status:** Active
**Severity:** Critical
**Applies To:** `shared/telemetry/f1_data.py`
**Effective Date:** December 20, 2025

## Rule Statement

Any change to the **logic, algorithms, or critical data processing** in `shared/telemetry/f1_data.py` **MUST** be independently code reviewed by a specialized review agent before being committed. This rule exists because f1_data.py is core to all telemetry processing and timing synchronization.

## When This Rule Applies

### Changes That Require Review

✅ **REQUIRES** code review:
- Changes to timing calculations or time coordinate conversions
- Modifications to resampling logic
- Updates to frame generation algorithms
- Changes to race progress calculations
- Modifications to track status processing
- Any changes to how SessionTime or timeline is handled
- Changes to multiprocessing worker functions
- Modifications to how driver data is aggregated
- Changes to caching logic that affects data structure
- Any new variables introduced into critical data paths

### Changes That DON'T Require Review

❌ **DOES NOT REQUIRE** code review:
- Documentation/comment updates
- Logging or debug output additions
- Variable renaming with no logic change
- Formatting or style improvements
- Type annotation changes with no logic impact
- Simple data access changes (`dict["key"]` → `dict.get("key")`)

## Review Process

### Step 1: Identify the Change

Before making any logic change to f1_data.py:
1. Clearly articulate what logic is changing
2. Explain why the change is necessary
3. Document the current behavior vs. desired behavior

### Step 2: Make the Change

Apply the fix to the codebase as normal.

### Step 3: Invoke Code Review Agent

Launch a specialized code review agent with these requirements:

```
ROLE: Expert Technical Code Reviewer - Most Rigorous
EXPERTISE:
  - Timing systems and coordinate transformations
  - Telemetry data processing pipelines
  - Race timing and lap calculations
  - Frontend-backend data synchronization
  - Edge cases and failure modes

TASK: Review the following logic change to f1_data.py:
  [DESCRIBE THE CHANGE]

REQUIREMENTS:
1. Inspect the changed code for correctness
2. Identify what downstream components this affects
3. Find potential edge cases or failure scenarios
4. List all components that depend on the changed behavior
5. Assess risk severity (Critical/High/Medium/Low)
6. Either APPROVE the fix OR flag concerns

DELIVERABLES:
1. Technical analysis of the change
2. Impact analysis across the codebase
3. Risk assessment with specific scenarios
4. Document identifying any bugs found
5. Final recommendation: APPROVED or NEEDS REVISION

Do NOT approve changes lightly. Be ruthless about identifying
potential issues. This is core data processing.
```

### Step 4: Document the Review

The review agent **MUST** create a document that includes:
1. **Bug Analysis** - What was wrong in the original code?
2. **Fix Analysis** - How does the fix address it?
3. **Risk Assessment** - What could break from this change?
4. **Impact Analysis** - Which components are affected?
5. **Testing Recommendations** - How to validate the fix?

### Step 5: Decision Gate

Before committing:
- ✅ Code review must be APPROVED by the review agent
- ✅ All concerns must be addressed or documented as acceptable risks
- ✅ Risk assessment document must exist
- ✅ Commit message must reference the review document

## Code Review Checklist

The review agent must verify:

- [ ] **Correctness** - Does the fix actually solve the stated problem?
- [ ] **Timing** - Are time coordinate systems consistent (absolute vs. relative)?
- [ ] **Data Flow** - Does the change break any data pipeline assumptions?
- [ ] **Multiprocessing** - Could this affect worker function pickling?
- [ ] **Caching** - Will cached data be incompatible with the change?
- [ ] **Frontend** - Does the frontend properly handle the returned data?
- [ ] **Edge Cases** - What about qualifying, sprints, red flags, false starts?
- [ ] **Performance** - Could this impact resampling or frame generation speed?
- [ ] **Type Safety** - Are NumPy types properly converted before JSON serialization?
- [ ] **Boundary Conditions** - What happens at session start/end?
- [ ] **Historical Data** - Could old cached files cause issues?
- [ ] **Backward Compatibility** - Could this break existing replay sessions?

## Risk Levels

### Critical
- Changes that could cause silent data corruption
- Timing coordinate system changes without proper conversion
- Changes to race progress or position calculations
- Modifications to how frames are generated or indexed
- Changes that break multiprocessing compatibility

### High
- Changes to resampling algorithms
- Track status time processing modifications
- SessionTime conversions
- Changes that affect all drivers uniformly

### Medium
- Changes to individual driver data extraction
- Modifications to telemetry filtering/smoothing
- Cache file format changes
- Changes to weather data processing

### Low
- Logging or error handling improvements
- Documentation string updates
- Variable renaming without logic change

## Document Template

Review agents must create a document with this structure:

```markdown
# Code Review: [Description of Change]

## Overview
[Summary of the change being reviewed]

## Original Bug/Issue
[What was wrong in the original code?]
[Why was this a problem?]

## The Fix
[What code was changed?]
[How does it solve the problem?]
[Are there alternative approaches?]

## Risk Assessment
### Critical Risks
[Any risks that could cause data corruption or crashes?]

### High Risks
[Risks that could cause incorrect behavior?]

### Medium Risks
[Risks that could cause subtle issues?]

### Low Risks
[Minor concerns or edge cases?]

## Impact Analysis

### Direct Impact
[Components directly affected by this change]

### Indirect Impact
[Components that depend on affected components]

### Data Flow Impact
[How does this affect data flowing through the system?]

### Frontend Impact
[How does this affect what the frontend receives?]

## Edge Cases
[Specific scenarios that could be problematic]
[Unusual session types or configurations]
[Boundary conditions]

## Testing Recommendations
[How to validate this fix]
[What to check for regression]
[Edge cases to test]

## Conclusion
APPROVED / NEEDS REVISION
[Reasoning for decision]
```

## Enforcement

### For Code Review Agents

When instructed to review changes to f1_data.py:
1. ✅ DO be ruthless about finding issues
2. ✅ DO trace data flow through the entire system
3. ✅ DO consider edge cases and unusual scenarios
4. ✅ DO check for timing/coordinate system issues
5. ✅ DO verify multiprocessing compatibility
6. ✅ DO assess impact on frontend synchronization
7. ❌ DON'T approve changes without thorough analysis
8. ❌ DON'T skip edge case testing recommendations
9. ❌ DON'T overlook potential data corruption scenarios

### For Humans

- If changing f1_data.py logic, invoke code review per this rule
- Don't bypass the review process (it's there for good reason)
- Address all concerns raised by the review agent
- Update the fix if issues are found
- Document any acceptable risks in commit message

## Why This Rule Exists

`shared/telemetry/f1_data.py` is:
- **Core Processing** - Handles all telemetry extraction and transformation
- **Timing Critical** - Contains complex timing coordinate system conversions
- **Data Pipeline Hub** - Every session replay depends on its output
- **Complex Logic** - Multiprocessing, resampling, normalization, caching
- **High Impact** - Bugs here affect all users and all race replays

A single logic error can cause:
- Silent data corruption (wrong positions, wrong lap times)
- Timing synchronization failures
- Frontend crashes or incorrect visualization
- Inconsistent race progress calculations
- Cache invalidation issues

Therefore, every change must be scrutinized by an expert reviewer.

## Historical Example

The race start timing synchronization fix (December 2025) is an example of why this rule is necessary:

**Original Bug:** Race start time stored in absolute coordinates but compared to relative frame times
**Impact:** Race start detection failed for all races
**Secondary Bug:** Race progress normalization used wrong variable
**Impact:** All driver positions misaligned from race start

**If Reviewed Earlier:** Both bugs would have been caught before causing data issues

This rule prevents such issues in the future.

## Exceptions

The only exception to this rule is:
- If the change is purely adding a new helper function with no impact on existing logic
- AND the function is not called by existing code
- AND extensive unit tests accompany it

Even then, notify Claude that an exception is being made.

## Related Documentation

- [Race Start Synchronization Fix](../../docs/TIMING/race-start-synchronization.md) - Example of critical f1_data.py fix
- [CLAUDE.md - Architecture](../../CLAUDE.md#architecture-overview) - System architecture
- [CLAUDE.md - Data Structures](../../CLAUDE.md#important-data-structures) - Frame and timing formats

## Rule Maintenance

This rule should be reviewed annually or whenever:
- New major features are added to f1_data.py
- Significant refactoring occurs
- New data types are introduced
- Frontend or backend architecture changes

---

**Rule Created:** December 20, 2025
**Last Updated:** December 20, 2025
**Version:** 1.0
