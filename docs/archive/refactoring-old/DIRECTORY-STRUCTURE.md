# F1 Race Replay - Directory Structure

## Root Level

```
f1-race-replay/
├── .git/                          # Git repository
├── .gitignore                     # Git ignore rules
├── .gitattributes                 # Git attributes
├── .venv/                         # Python virtual environment (auto-created)
├── .fastf1-cache/                 # FastF1 API cache (auto-created)
├── .playwright-mcp/               # Playwright MCP integration
├── .claude/                       # Claude Code configuration
│   └── rules/
│       └── RULES.md               # Project coding rules
│
├── README.md                      # Main documentation (START HERE)
├── CLAUDE.md                      # Developer guide & architecture
├── package.json                   # npm scripts
├── requirements.txt               # Python dependencies (only core)
│
├── backend/                       # FastAPI backend (Python)
├── frontend/                      # React frontend (TypeScript)
├── shared/                        # Shared Python utilities
├── scripts/                       # Development scripts
├── tests/                         # Test suites
└── docs/                          # Documentation
```

## Backend (`backend/`)

```
backend/
├── main.py                        # Entry point - starts FastAPI
├── requirements.txt               # Backend-specific dependencies
├── venv/                          # Virtual environment (auto-created)
├── app/
│   ├── main.py                    # FastAPI app initialization
│   ├── api/                       # API route handlers
│   │   ├── rounds.py              # Round/race data endpoints
│   │   ├── sessions.py            # Session endpoints
│   │   └── telemetry.py           # Telemetry endpoints
│   └── websocket.py               # WebSocket frame streaming
├── core/
│   ├── logging.py                 # Logging setup
│   └── constants.py               # Configuration constants
├── models/
│   ├── frame.py                   # Frame data models
│   ├── session.py                 # Session models
│   └── telemetry.py               # Telemetry models
└── utils/
    └── helpers.py                 # Utility functions
```

## Frontend (`frontend/`)

```
frontend/
├── package.json                   # npm dependencies
├── package-lock.json              # Dependency lock file
├── node_modules/                  # Installed packages
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite bundler config
├── tailwind.config.js             # Tailwind CSS config
├── index.html                     # HTML entry point
├── src/
│   ├── main.tsx                   # React app entry
│   ├── App.tsx                    # Main app component
│   ├── index.css                  # Global styles
│   ├── components/                # React components
│   │   ├── Canvas.tsx             # Three.js 3D visualization
│   │   ├── Leaderboard.tsx        # Driver standings
│   │   ├── PlaybackControls.tsx   # Play/pause/seek controls
│   │   ├── TelemetryChart.tsx     # Speed/brake/throttle charts
│   │   └── SessionSelector.tsx    # Race/round selection
│   ├── hooks/                     # Custom React hooks
│   │   └── useReplayWebSocket.ts  # WebSocket connection
│   ├── stores/                    # Zustand state management
│   │   └── replay.ts              # Replay session state
│   └── utils/                     # Utility functions
└── dist/                          # Build output (production)
```

## Shared Utilities (`shared/`)

```
shared/
├── telemetry/
│   ├── f1_data.py                 # FastF1 API integration
│   │                              # Telemetry loading & processing
│   ├── cache.py                   # Cache management
│   └── __init__.py
├── lib/
│   ├── tyres.py                   # Tyre compound mapping
│   ├── time.py                    # Time formatting utilities
│   └── __init__.py
└── utils/
    ├── track_geometry.py          # Track boundary calculation
    └── __init__.py
```

## Scripts (`scripts/`)

```
scripts/
├── dev.js                         # Main dev server launcher
│                                  # - Clears caches
│                                  # - Frees ports
│                                  # - Starts backend & frontend
├── install.sh                     # One-click setup (macOS/Linux)
└── install.bat                    # One-click setup (Windows)
```

## Documentation (`docs/`)

```
docs/
├── archive/                       # Historical documentation
│   ├── PHASE_7_COMPLETION_SUMMARY.md
│   ├── PHASE_7_FINAL_REPORT.md
│   ├── PHASE_7_VALIDATION_REPORT.md
│   ├── VALIDATION_REPORT.md
│   └── PROJECT_STRUCTURE.md
├── plans/                         # Implementation planning docs
│   └── (various planning documents)
├── REFACTORING-SUMMARY.md         # This refactoring overview
├── DIRECTORY-STRUCTURE.md         # This file
├── DEBUG-ANALYSIS-*.md            # Debug guides
└── LEADERBOARD-DEBUG-*.md         # Leaderboard-specific guides
```

## Tests (`tests/`)

```
tests/
├── unit/                          # Unit tests
├── integration/                   # Integration tests
└── fixtures/                      # Test data
```

## Auto-Generated Directories

These are created automatically when running the app:

```
f1-race-replay/
├── .fastf1-cache/                 # FastF1 API response cache
│   └── (auto-populated with API responses)
│
├── data/                          # Processed telemetry cache
│   └── (auto-populated with computed frame data)
│
└── frontend/node_modules/         # npm dependencies
    └── (1000+ packages)
```

## Key Files Explained

| File | Purpose | Who Uses It |
|------|---------|------------|
| `README.md` | Getting started guide | Everyone |
| `CLAUDE.md` | Architecture & dev guide | Developers |
| `package.json` | npm commands | Everyone |
| `requirements.txt` | Python dependencies | Backend |
| `backend/main.py` | Start backend | Backend |
| `frontend/src/App.tsx` | React app root | Frontend |
| `scripts/dev.js` | Launch dev servers | Everyone |
| `scripts/install.sh` | Setup (Unix) | New developers |
| `scripts/install.bat` | Setup (Windows) | New developers |

## Installation & Setup Flow

```
1. Clone repo
   ↓
2. Run install script (install.sh or install.bat)
   ├─ Creates backend/venv/
   ├─ Installs backend dependencies
   └─ Installs frontend/node_modules/
   ↓
3. Run development server
   npm start
   ├─ Clears .fastf1-cache/
   ├─ Clears data/
   ├─ Frees ports 8000, 5173, 3000
   ├─ Starts backend (port 8000)
   ├─ Starts frontend (port 5173)
   └─ Opens browser
   ↓
4. Start developing
   ├─ Edit frontend/src/ files
   ├─ Edit backend/app/ files
   └─ Hot reload handles changes
```

## Data Flow

```
Frontend (React)
    ↓ WebSocket
Backend (FastAPI)
    ↓ Imports
Shared (Python)
    ├─ f1_data.py (FastF1 integration)
    ├─ Cache loading
    └─ Data processing
        ↓ Caches to:
        ├─ .fastf1-cache/ (API responses)
        └─ data/ (computed frames)
```

## Naming Conventions

- **Directories:** lowercase with hyphens (`backend/`, `src/components/`)
- **Python files:** snake_case (`f1_data.py`, `track_geometry.py`)
- **TypeScript files:** PascalCase for components (`App.tsx`, `Leaderboard.tsx`)
- **TypeScript files:** camelCase for utilities (`useReplayWebSocket.ts`)

---

For more details, see:
- `README.md` - Quick start
- `CLAUDE.md` - Architecture & guidelines
- `REFACTORING-SUMMARY.md` - Recent changes
