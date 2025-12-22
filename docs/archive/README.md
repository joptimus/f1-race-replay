# Archived Documentation

This folder contains documentation from earlier phases of the project that are no longer actively used.

## Folders

### `loading-bar-old/`

**Archived:** December 21, 2025

Old documentation about loading bar progress synchronization using HTTP polling. This approach has been replaced with a WebSocket-based loading state system that provides:
- Single WebSocket connection as the source of truth
- Proper loading state machine (INIT → LOADING → READY/ERROR)
- Progress callbacks from backend to frontend
- 700ms minimum display time to prevent flickering
- Proper error state handling

**Related Current Docs:** `docs/REVIEWS/` contains the new implementation plan and analysis.

### `refactoring-old/`

**Archived:** December 21, 2025

Documentation from an earlier refactoring phase including:
- Directory structure discussions
- Documentation organization rules (superseded by current rules)
- Post-refactoring checklists
- Refactoring summaries

**Current Rules:** The documentation organization rule is now the standard and enforced in `CLAUDE.md`.

### Other Archived Files

- `PHASE_*_*.md` - Phase completion reports and validation documents from completed implementation phases
- `PROJECT_STRUCTURE.md` - Superseded by updated project structure in `CLAUDE.md`
- `VALIDATION_REPORT.md` - Old validation report; current tests are in the implementation guides

## Policy

Documents are archived when:
- The feature/phase they document is fully implemented
- Newer, more current documentation exists
- The information is historically useful but no longer actively needed
- Implementations have moved on to new approaches

To reference archived docs, see the "Related Current Docs" section for each folder.
