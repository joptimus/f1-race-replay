# F1 Race Replay Documentation Index

This directory contains all project documentation organized by topic/feature.

## Quick Navigation

### 🔧 Project Setup & Refactoring
- [**REFACTORING/**](./REFACTORING/) - Project structure cleanup and setup improvements
  - [Refactoring Summary](./REFACTORING/REFACTORING-SUMMARY.md) - Overview of all changes
  - [Directory Structure](./REFACTORING/DIRECTORY-STRUCTURE.md) - File organization guide
  - [Post-Refactoring Checklist](./REFACTORING/POST-REFACTORING-CHECKLIST.md) - Verification checklist

### 🎬 Loading Modal System
- [**LOADING-MODAL/**](./LOADING-MODAL/) - WebSocket-based loading state and session initialization
  - [Overview](./LOADING-MODAL/README.md) - Architecture and components
  - [Plan vs Reality](./LOADING-MODAL/plan-vs-reality.md) - Design decisions and technical trade-offs
  - [Data Timeline](./LOADING-MODAL/data-timeline.md) - Detailed data flow sequence T+0 to T+100

### 🏆 Leaderboard System
- [**LEADERBOARD/**](./LEADERBOARD/) - Leaderboard debugging and implementation
  - [Debug Guide](./LEADERBOARD/LEADERBOARD-DEBUG-GUIDE.md) - Debugging leaderboard issues
  - [Debugging Setup](./LEADERBOARD/LEADERBOARD-DEBUGGING-SETUP.md) - Testing setup guide
  - [Disappearing Drivers Analysis](./LEADERBOARD/DEBUG-ANALYSIS-LEADERBOARD-DISAPPEARING-DRIVERS.md) - Specific bug analysis

### 📋 Implementation Plans
- [**plans/**](./plans/) - Design documents and implementation plans
  - Various implementation guides and design specifications

### 📦 Archive
- [**archive/**](./archive/) - Historical documentation
  - Phase completion reports
  - Validation reports
  - Old project structure docs

## Documentation Standards

When adding new documentation, follow these rules:

### Folder Organization

```
docs/
├── FEATURE-NAME/        # UPPERCASE folder for each major feature/topic
│   ├── overview.md      # lowercase filenames
│   ├── guide.md
│   └── troubleshooting.md
├── archive/             # Old/historical docs
├── plans/               # Implementation plans
└── README.md            # This file
```

### Naming Conventions

- **Folders:** UPPERCASE (e.g., `LEADERBOARD`, `WEBSOCKET`)
- **Files:** lowercase-with-hyphens (e.g., `debugging-guide.md`)
- **Multi-word folders:** UPPERCASE-WITH-HYPHENS (e.g., `FRAME-STREAMING`)

### File Location Rules

✅ **DO:**
- Put docs in appropriate feature folders inside `docs/`
- Create new subfolders for related docs
- Group similar topics together

❌ **DON'T:**
- Put docs at project root (except README.md, CLAUDE.md)
- Mix unrelated docs in same folder
- Use inconsistent naming

## Main Documentation

For core information, refer to the main project files:
- **[README.md](../README.md)** - Quick start and feature overview
- **[CLAUDE.md](../CLAUDE.md)** - Architecture, development guide, and APIs

## Current Topics

| Topic | Location | Status |
|-------|----------|--------|
| Loading Modal System | [LOADING-MODAL/](./LOADING-MODAL/) | ✅ Complete |
| Refactoring (2025-12-20) | [REFACTORING/](./REFACTORING/) | ✅ Active |
| Leaderboard Debugging | [LEADERBOARD/](./LEADERBOARD/) | 📋 In Progress |
| Implementation Plans | [plans/](./plans/) | 📝 Reference |
| Historical Reports | [archive/](./archive/) | 📦 Archived |

## Contributing to Documentation

When adding new documentation:

1. **Determine the topic** - What feature/area does this cover?
2. **Find or create folder** - Look for existing folder, or create new one
3. **Use clear filename** - Describe content (e.g., `api-reference.md`, `troubleshooting.md`)
4. **Update this index** - Add entry to appropriate section above
5. **Use standard format** - Follow existing docs as template

### Example: Adding New WebSocket Documentation

```
Would create:
  docs/WEBSOCKET/
  ├── guide.md
  ├── api-reference.md
  └── connection-issues.md

Then update this README to add:
  - [**WEBSOCKET/**](./WEBSOCKET/) - WebSocket implementation
```

## Organization Philosophy

Documentation is organized to make it:
- **Easy to find** - Grouped by feature/topic
- **Easy to maintain** - Related docs stay together
- **Easy to scale** - Clear structure for new docs
- **Easy to navigate** - This index as guide

---

Last Updated: December 20, 2025
See .claude/rules/RULES.md for documentation organization requirements
