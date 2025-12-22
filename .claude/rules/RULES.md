## 🚨 CRITICAL: Rule Enforcement for Protected Files

**BEFORE you modify ANY file in this project, check if it's protected.**

👉 **READ FIRST:** [CRITICAL_FILES.md](./CRITICAL_FILES.md)

This registry lists files where rule compliance is MANDATORY before you can make changes. If the file you want to modify is listed there, you MUST:

1. **READ** the associated rule document completely
2. **UNDERSTAND** what it requires (planning, discovery, spikes, code review, etc.)
3. **FOLLOW** the rule's process before implementing
4. **VERIFY** you've met all requirements before committing

**Rules are not optional. They are blockers.** If you modify a protected file without following its rule, code review will catch it and request changes.

---

## ⚠️ CRITICAL: Code Review Rule for f1_data.py

**ANY logic changes to `shared/telemetry/f1_data.py` REQUIRE independent code review by an expert agent BEFORE committing.**

This rule exists because f1_data.py is the core telemetry processing hub - a single logic error can cause silent data corruption affecting all race replays.

👉 **See:** [F1_DATA_REVIEW_RULE.md](./F1_DATA_REVIEW_RULE.md)

**Before modifying f1_data.py logic:**
1. Make the change
2. Invoke specialized code review agent using `superpowers:requesting-code-review` skill
3. Get APPROVED status from review agent
4. Create risk assessment document
5. Reference the rule in your commit message: `Implements CRITICAL_FILES:F1_DATA_REVIEW_RULE`

This is not optional. Do not bypass this rule.

---

## Core Development Rules

1. **Documentation Minimalism** - Only write critical documentation. No unnecessary docs.
2. **No Code Comments** - Code should be self-explanatory. No comments in code.
3. **Clean Commit Messages** - No Claude Code attribution. Keep commits focused on changes only.
4. **User-Driven Docs** - Only create documents if specifically asked for by user.

## Documentation Organization Rule ⭐

**CRITICAL: All documents MUST be properly organized in the `docs/` folder structure.**

### When Creating Documentation:

1. **Always use `docs/` folder as root** for all documentation
2. **Create a feature/feature-specific subfolder** inside `docs/` for related documents
3. **Never put docs at project root** (except README.md and CLAUDE.md which are already established)
4. **Group related docs together** in same subfolder with clear naming

### Folder Structure Pattern:

```
docs/
├── README.md                    # Index of all docs (optional, if helpful)
├── FEATURE-A/
│   ├── overview.md              # Feature description
│   ├── implementation.md         # How it works
│   ├── troubleshooting.md        # Common issues
│   └── examples.md              # Usage examples
├── FEATURE-B/
│   ├── guide.md
│   └── api.md
├── DEBUG/
│   ├── leaderboard-issues.md
│   └── performance-tips.md
├── archive/
│   ├── phase-reports/
│   └── old-docs/
└── plans/
    ├── implementation-plans/
    └── design-docs/
```

### Examples of Proper Organization:

**WRONG:**
```
project-root/
├── README.md
├── LEADERBOARD-DEBUG.md ❌
├── WEBSOCKET-GUIDE.md ❌
├── PERFORMANCE-TIPS.md ❌
└── docs/
    └── (scattered, no structure)
```

**RIGHT:**
```
docs/
├── LEADERBOARD/
│   ├── debugging.md
│   ├── position-tracking.md
│   └── accuracy-issues.md
├── WEBSOCKET/
│   ├── guide.md
│   ├── frame-streaming.md
│   └── connection-issues.md
├── PERFORMANCE/
│   ├── optimization-tips.md
│   ├── caching-strategy.md
│   └── benchmarking.md
└── archive/
    └── old-reports/
```

### When to Create New Subfolders:

- **Feature Documentation** → `docs/FEATURE-NAME/`
- **Bug Analysis/Debugging** → `docs/DEBUG/feature-specific-subfolder/`
- **Implementation Plans** → `docs/plans/`
- **Historical/Archive Docs** → `docs/archive/category/`
- **API/Reference** → `docs/API/` or `docs/FEATURE-NAME/api.md`
- **Guides & Tutorials** → `docs/GUIDES/topic/`
- **Technical Specifications** → `docs/SPECS/feature/`

### Naming Conventions:

- **Folders:** UPPERCASE with hyphens if multi-word (e.g., `LEADERBOARD`, `WEBSOCKET`, `DEBUG`)
- **Files:** lowercase with hyphens (e.g., `debugging.md`, `position-tracking.md`, `api-reference.md`)
- **Index files:** Use `README.md` or `index.md` as folder entry points
- **Date-stamped docs:** Not needed (use git history), unless specifically archiving a milestone

### Before Writing Any Document:

Ask yourself:
1. ✅ Is this document necessary? (rule #1 - minimalism)
2. ✅ What feature/topic does it cover?
3. ✅ Which existing folder should it go in, or should I create a new one?
4. ✅ What is the clearest filename?
5. ✅ Should it be in `docs/`, root-level, or inline in code?

### Current Approved Root-Level Docs:

Only these may exist at project root:
- ✅ `README.md` - Main entry point (DO NOT MOVE)
- ✅ `CLAUDE.md` - Developer guide (DO NOT MOVE)

Everything else goes in `docs/` with proper subfolder organization.

### Cleanup & Validation Rule:

**When moving or cleaning up documents, ALWAYS validate if they're still valid or should be archived.**

#### Step-by-Step Cleanup Process:

1. **Identify docs to clean up** - Find docs at project root or scattered in docs/
2. **Validate each document:**
   - ✅ **Still relevant?** - Is this still accurate and used?
   - ✅ **Related to active features?** - Is the feature still being worked on?
   - ✅ **Up-to-date?** - Does content match current code/implementation?
   - ✅ **Referenced anywhere?** - Are other docs or code linking to it?
3. **Decide action for each:**
   - **If VALID & CURRENT:** Move to appropriate `docs/[FEATURE]/` folder
   - **If OUTDATED but HISTORICAL:** Move to `docs/archive/[category]/` with reason
   - **If NO LONGER RELEVANT:** Delete entirely (not needed)
4. **Update links:**
   - Update all internal links in other docs
   - Update README.md with new locations
   - Check for references in CLAUDE.md
5. **Document the decision:**
   - Add brief note about why archived (if applicable)
   - Or mention in commit what was removed/reorganized

#### Archive Decision Guide:

**Archive to `docs/archive/` if:**
- ✓ Document was part of a completed phase (e.g., phase reports)
- ✓ Feature was implemented but no longer actively developed
- ✓ Contains historical analysis or old decisions
- ✓ Useful for reference but not actively maintained
- ✓ Debugging a past issue (no longer relevant to current code)

**Delete if:**
- ✗ Information is now outdated and inaccurate
- ✗ Feature was completely abandoned/removed
- ✗ Duplicate of current documentation
- ✗ Instructions reference old project structure
- ✗ Contains debug info for resolved issues

**Keep in active docs if:**
- ✓ Still referenced by current features
- ✓ Instructions apply to current code
- ✓ Part of ongoing development
- ✓ Users/collaborators need this info
- ✓ Actively maintained and updated

#### Archive Naming:

When moving docs to archive, use descriptive folder names:
- `archive/phase-reports/` - Old phase completion reports
- `archive/legacy-features/` - Features that were removed
- `archive/debug-sessions/` - Past debugging sessions (archived when issue closed)
- `archive/old-designs/` - Design docs for abandoned approaches
- `archive/[FEATURE]-deprecated/` - Feature no longer in use

#### Validation Checklist for Each Doc:

Before moving/archiving a document, ask:

- [ ] Does this document apply to the current codebase?
- [ ] Would a new collaborator need this information?
- [ ] Are there any links in other docs pointing to this?
- [ ] Is the information still accurate?
- [ ] Is this feature/topic still actively being worked on?
- [ ] If outdated, is it still useful as historical reference?
- [ ] Could this be merged with other related documentation?
- [ ] Should this be updated instead of archived?

#### Adding Archive Notes:

When archiving a document, add a note at the top:

```markdown
> **📦 Archived: [Date]**
>
> This document is archived because: [reason]
>
> For current information, see: [link to current doc or feature]
```

Example:
```markdown
> **📦 Archived: December 2025**
>
> This debugging guide is archived because the position calculation issue
> was fixed in v1.2.0. The leaderboard now uses improved smoothing.
>
> For current leaderboard info, see: docs/LEADERBOARD/guide.md
```

### Git Commit Message for Docs:

```
docs: add [feature] documentation in docs/[folder]/

- Added docs/FEATURE-NAME/file.md
- Organized related docs in subfolder
```

Or for cleanup/archival:

```
docs: organize and validate documentation

- Moved FEATURE-A docs to docs/FEATURE-A/
- Archived outdated debugging guides to docs/archive/debug-sessions/
- Updated all internal links in docs/README.md
- Removed duplicate documentation

Validation: Checked each doc for relevance to current codebase
```

### Documentation Lifecycle:

```
Created → Active → Maintained → Outdated → Archived → (Deleted if truly unused)
```

- **Active:** Referenced, up-to-date, actively maintained
- **Maintained:** Accurate but not frequently changed
- **Outdated:** Information is stale but historically useful
- **Archived:** In docs/archive/, marked with reason
- **Deleted:** No longer needed, completely removed
