# Documentation Organization Rule - Implementation Guide

**Status:** ✅ Implemented December 20, 2025
**Rule Location:** `.claude/rules/RULES.md` (Documentation Organization Rule ⭐)

---

## Overview

This document explains the new documentation organization rule that ensures all future documentation is properly organized and prevents the project root from becoming cluttered with scattered markdown files.

## The Problem (Before)

The project had documentation scattered in multiple locations:

```
project-root/
├── README.md ✅ (approved)
├── CLAUDE.md ✅ (approved)
├── PHASE_7_COMPLETION_SUMMARY.md ❌
├── PHASE_7_FINAL_REPORT.md ❌
├── PHASE_7_VALIDATION_REPORT.md ❌
├── VALIDATION_REPORT.md ❌
├── PROJECT_STRUCTURE.md ❌
└── docs/
    ├── DEBUG-ANALYSIS-LEADERBOARD-DISAPPEARING-DRIVERS.md (orphaned)
    ├── LEADERBOARD-DEBUG-GUIDE.md (orphaned)
    ├── LEADERBOARD-DEBUGGING-SETUP.md (orphaned)
    ├── plans/ (random folder)
    └── archive/ (random folder)
```

**Issues:**
- 5 unorganized files at project root
- Docs scattered without clear structure
- No way to know where to put new documentation
- Hard for collaborators to find information
- Documentation sprawl over time

## The Solution (After)

Comprehensive rule with clear structure:

```
docs/                          # All documentation lives here
├── README.md                  # Navigation index
├── REFACTORING/               # Feature-specific folders
│   ├── REFACTORING-SUMMARY.md
│   ├── DIRECTORY-STRUCTURE.md
│   └── POST-REFACTORING-CHECKLIST.md
├── LEADERBOARD/
│   ├── DEBUG-ANALYSIS-LEADERBOARD-DISAPPEARING-DRIVERS.md
│   ├── LEADERBOARD-DEBUG-GUIDE.md
│   └── LEADERBOARD-DEBUGGING-SETUP.md
├── PERFORMANCE/
│   └── (future performance docs)
├── WEBSOCKET/
│   └── (future websocket docs)
├── plans/
│   ├── IMPLEMENTATION-GUIDE.md
│   ├── LEADERBOARD-SUMMARY.md
│   └── (design documents)
└── archive/
    └── (historical docs)

project-root/                  # Clean root!
├── README.md ✅
├── CLAUDE.md ✅
└── Everything else organized in docs/
```

**Benefits:**
- ✅ Only 2 files at project root
- ✅ Clear folder structure by feature
- ✅ Easy to find related documentation
- ✅ Scalable for project growth
- ✅ Consistent naming conventions
- ✅ Index file for navigation

## The Rule

Located in `.claude/rules/RULES.md` under "Documentation Organization Rule ⭐"

### Core Requirements

1. **ALWAYS use `docs/` folder** - All documentation goes in `docs/` directory
2. **CREATE feature folders** - Create subfolders for related documents
3. **NEVER put docs at project root** - Except README.md and CLAUDE.md
4. **GROUP related docs** - Keep related documentation together

### Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Folders | UPPERCASE | `LEADERBOARD`, `WEBSOCKET`, `DEBUG` |
| Files | lowercase-with-hyphens | `debugging-guide.md`, `api-reference.md` |
| Multi-word folders | UPPERCASE-WITH-HYPHENS | `FRAME-STREAMING`, `PERFORMANCE-TIPS` |

### When to Create Subfolders

- **Feature Documentation** → `docs/FEATURE-NAME/`
- **Bug Analysis** → `docs/DEBUG/feature-name/` or `docs/FEATURE/debug.md`
- **API Docs** → `docs/FEATURE/api-reference.md`
- **Implementation Plans** → `docs/plans/`
- **Historical Docs** → `docs/archive/category/`
- **Guides** → `docs/GUIDES/topic/`

## Decision Tree for Claude

Before writing ANY document:

```
Is this document necessary?
  ├─ NO  → Don't write it ❌
  └─ YES
     │
     └─ What feature/topic does it cover?
        ├─ Feature: FEATURE-NAME
        ├─ Bug: DEBUG or FEATURE/debug
        ├─ API: FEATURE/api
        ├─ Plan: plans/
        └─ Archive: archive/
           │
           └─ Does folder exist?
              ├─ NO  → Create: docs/[FOLDER]/
              └─ YES → Use existing
                 │
                 └─ Create file: docs/[FOLDER]/[clear-name].md
```

## Example Scenarios

### Scenario 1: Creating WebSocket Debugging Guide

**Before Rule:** Would create `WEBSOCKET-DEBUG.md` at root ❌

**After Rule:**
1. Create folder: `docs/WEBSOCKET/`
2. Create file: `docs/WEBSOCKET/debugging-guide.md`
3. Update: `docs/README.md` to add entry
4. Commit: `docs: add websocket debugging guide in docs/WEBSOCKET/`

### Scenario 2: Adding Performance Optimization Tips

**Before Rule:** Would create `PERFORMANCE-TIPS.md` at root ❌

**After Rule:**
1. Create folder: `docs/PERFORMANCE/`
2. Create file: `docs/PERFORMANCE/optimization-tips.md`
3. Create file: `docs/PERFORMANCE/caching-strategy.md` (related)
4. Update: `docs/README.md` to add entry
5. Commit: `docs: add performance optimization guides in docs/PERFORMANCE/`

### Scenario 3: Leaderboard Implementation Plan

**Before Rule:** Would create `LEADERBOARD-IMPLEMENTATION.md` at root ❌

**After Rule:**
1. Use existing: `docs/LEADERBOARD/` or `docs/plans/`
2. Create: `docs/LEADERBOARD/implementation-notes.md` (if feature-specific)
   OR `docs/plans/leaderboard-implementation.md` (if general plan)
3. Update: `docs/README.md` to add entry
4. Commit: `docs: add leaderboard implementation notes`

## Implementation Status

✅ **Rule Added:** `.claude/rules/RULES.md` - Comprehensive documentation standards

✅ **Existing Docs Reorganized:**
- `REFACTORING/` folder created with 3 docs
- `LEADERBOARD/` folder created with 3 docs
- `plans/` folder organized with existing plans
- `archive/` folder for historical reports
- `docs/README.md` created as navigation index

✅ **Structure Validated:** All docs properly organized by feature/topic

## Future Application

When you ask Claude to create ANY documentation:
- It will check this rule
- It will create proper folder structure
- It will use consistent naming
- It will update the index
- It will group related docs together

## Maintenance Rules

If you find docs at project root (except README.md, CLAUDE.md):
1. Move to appropriate `docs/subfolder/`
2. Update all links pointing to old location
3. Delete the root-level file
4. Commit: `docs: organize docs into proper folders`

## Git Commit Message Format

```
docs: add [feature] documentation in docs/[folder]/

- Added docs/FEATURE-NAME/file.md
- Organized related docs in subfolder

# Or for bulk reorganization:

docs: reorganize documentation into proper folders

- Moved FEATURE-DOCS.md to docs/FEATURE/
- Updated all links to new locations
- Created docs/README.md as navigation index
```

## Related Rules

This rule builds on other core rules in `.claude/rules/RULES.md`:

1. **Documentation Minimalism** - Only write critical docs
2. **No Code Comments** - Code is self-explanatory
3. **Clean Commits** - No tool attribution
4. **User-Driven Docs** - Only create if asked
5. **Documentation Organization** ⭐ - This rule

## Quick Reference

| Question | Answer |
|----------|--------|
| Where do docs go? | `docs/` folder |
| Can I put docs at root? | Only README.md and CLAUDE.md |
| How to name folders? | UPPERCASE (e.g., LEADERBOARD) |
| How to name files? | lowercase-with-hyphens (e.g., debugging.md) |
| How to organize? | By feature/topic in subfolders |
| Do I update index? | Yes, update `docs/README.md` |
| What's the index? | `docs/README.md` - lists all docs |

---

**Summary:** All future documentation will be organized automatically following this comprehensive rule. The project root stays clean, documentation is discoverable, and the structure scales with project growth.

Last Updated: December 20, 2025
