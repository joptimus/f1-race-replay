# CLAUDE.md

Comprehensive development guide for F1 Race Replay. This document covers architecture, data structures, APIs, and development guidelines for both Claude Code and human contributors.

## Project Overview

F1 Race Replay is a full-stack web application for exploring Formula 1 race telemetry with interactive 3D visualization, live leaderboards, and telemetry analysis. It consists of:

- **Backend:** FastAPI server providing telemetry data via REST/WebSocket APIs
- **Frontend:** React/TypeScript web application with 3D visualization using Three.js and Zustand state management
- **Data Processing:** Python-based telemetry extraction and caching via FastF1
- **Shared Utilities:** Python telemetry processing and caching shared between backend and legacy systems

## Development Standards

**Code Quality & Contribution Guidelines:**
1. No unnecessary documentation – only document critical items
2. No comments in code – code should be self-explanatory
3. Keep commit messages focused on changes only (no tool attribution)
4. Only create documents if explicitly requested
5. Follow existing code patterns in the codebase
6. Test changes thoroughly before submitting PRs

See [.claude/rules/RULES.md](./.claude/rules/RULES.md) for detailed rules.

## Common Commands

### Running the Application (Full Stack)

**Development mode (runs both frontend and backend):**
```bash
node dev.js
```

**Or separately:**
- **Backend:** `python backend/main.py` (runs on http://localhost:8000)
- **Frontend:** `cd frontend && npm run dev` (runs on http://localhost:5173)

### Legacy Arcade Interface (Standalone Desktop)

**Race replay (default):**
```bash
python legacy/main.py --year 2025 --round 12
```

**Sprint race:**
```bash
python legacy/main.py --year 2025 --round 12 --sprint
```

**Qualifying session:**
```bash
python legacy/main.py --year 2025 --round 12 --qualifying
```

**Force data recomputation (bypass cache):**
```bash
python legacy/main.py --year 2025 --round 12 --refresh-data
```

See `legacy/README.md` for more information about the legacy application.

### Utility Commands

**List all rounds for a year:**
```bash
python main.py --year 2025 --list-rounds
```

**List sprint rounds for a year:**
```bash
python main.py --year 2025 --list-sprints
```

### Installing Dependencies

**Backend dependencies:**
```bash
pip install -r requirements.txt
```

**Frontend dependencies:**
```bash
cd frontend && npm install
```

### Building for Production

**Build frontend:**
```bash
cd frontend && npm run build
```

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│ Frontend (React/TypeScript/Three.js)            │
│ - 3D race visualization                         │
│ - Interactive leaderboard                       │
│ - Playback controls                             │
│ - WebSocket connection to backend               │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket/HTTP
┌──────────────────▼──────────────────────────────┐
│ Backend (FastAPI)                               │
│ - Session management                            │
│ - Frame streaming via WebSocket                 │
│ - Track geometry calculation                    │
│ - REST API endpoints                            │
└──────────────────┬──────────────────────────────┘
                   │ Imports
┌──────────────────▼──────────────────────────────┐
│ Data Processing (Python/src/)                   │
│ - FastF1 telemetry loading                      │
│ - Multiprocessing-based frame generation        │
│ - Caching system                                │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. **Backend Request:** Frontend requests replay session (year, round, session type)
2. **Data Loading** (`backend/app/main.py`, `shared/telemetry/f1_data.py`): Loads F1 session data via FastF1 API
3. **Telemetry Processing**: Extracts and resamples driver telemetry at 25 FPS using multiprocessing
4. **Frame Generation**: Creates timeline of driver positions, speeds, gears, DRS status, etc.
5. **Caching**: Saves computed telemetry to `data/` using pickle for fast reload
6. **WebSocket Streaming:** Backend streams frames to frontend on-demand
7. **Visualization**: React component renders track, cars, leaderboard using Three.js

### Shared Components

**Multiprocessing for Performance:**
- Driver telemetry processing uses `multiprocessing.Pool` to parallelize extraction
- Top-level functions `_process_single_driver` and `_process_quali_driver` required for pickling
- Utilizes all CPU cores for faster data processing

**Frame-based Animation:**
- All telemetry resampled to common timeline at 25 FPS (`FPS = 25, DT = 1/25`)
- Timeline starts at `global_t_min` shifted to zero for consistent playback
- Frame index uses float for smooth playback speed control

### File Structure

**Backend (Modern FastAPI):**
- **`backend/main.py`**: Entry point, imports app from backend/app/main.py
- **`backend/app/main.py`**: FastAPI application setup, middleware, routes
- **`backend/app/api/`**: API route handlers (rounds.py, sessions.py)
- **`backend/app/services/replay_service.py`**: F1ReplaySession class, data loading logic
- **`backend/app/websocket.py`**: WebSocket frame streaming handler
- **`backend/models/`**: Pydantic data models
- **`backend/core/`**: Configuration and constants
- **`backend/utils/`**: Helper utilities

**Frontend (Modern React):**
- **`frontend/src/App.tsx`**: Main React component, routing
- **`frontend/src/components/`**: React components (Leaderboard, PlaybackControls, etc.)
- **`frontend/src/hooks/useReplayWebSocket.ts`**: WebSocket connection hook
- **`frontend/src/index.css`**: Styling and Tailwind configuration

**Shared Code (Used by Backend & Legacy):**
- **`shared/telemetry/f1_data.py`**: Telemetry loading, processing, and caching logic
- **`shared/telemetry/cache.py`**: Cache management utilities (future)
- **`shared/lib/tyres.py`**: Tyre compound mapping
- **`shared/lib/time.py`**: Time formatting utilities
- **`shared/utils/track_geometry.py`**: Track boundary calculation from telemetry

**Legacy (Arcade Desktop App - Reference Only):**
- **`legacy/main.py`**: Entry point, argument parsing, session type routing
- **`legacy/src/arcade_replay.py`**: Arcade window wrapper
- **`legacy/src/interfaces/race_replay.py`**: Race replay visualization
- **`legacy/src/interfaces/qualifying.py`**: Qualifying telemetry analysis
- **`legacy/src/ui_components.py`**: Arcade UI components
- See **`legacy/README.md`** for more details

**Generated Data & Caching:**
- **`.fastf1-cache/`**: FastF1 API cache (auto-created)
- **`data/`**: Preprocessed telemetry pickle files (auto-created)

### Important Data Structures

**Frame Dictionary Structure (Race):**
```python
{
    "t": float,           # Time in seconds from race start
    "lap": int,           # Leader's current lap
    "drivers": {
        "HAM": {          # Driver code
            "x": float, "y": float,      # Track position (meters)
            "dist": float,               # Total race distance (meters)
            "rel_dist": float,           # Relative distance (0-1, 1=out/finished)
            "lap": int,                  # Current lap number
            "tyre": int,                 # Tyre compound (0-4)
            "position": int,             # Race position
            "speed": float,              # Speed (km/h)
            "gear": int,                 # Current gear (0-8)
            "drs": int,                  # DRS status (0/8/10/12/14)
            "throttle": float,           # Throttle (0-100)
            "brake": float               # Brake (0-100)
        }
    },
    "weather": {         # Optional weather data
        "track_temp": float, "air_temp": float,
        "humidity": float, "wind_speed": float,
        "wind_direction": float, "rain_state": str
    }
}
```

**DRS Status Values:**
- `0`: DRS off
- `8`: DRS available but not activated
- `10/12/14`: DRS activated

**Track Status Codes (from FastF1):**
- `"1"`: Green/All Clear
- `"2"`: Yellow Flag
- `"4"`: Safety Car
- `"5"`: Red Flag
- `"6"/"7"`: Virtual Safety Car (VSC)

### Coordinate System and Rendering

**World vs Screen Coordinates:**
- Telemetry provides world coordinates (x, y in meters)
- Circuit rotation applied via rotation matrix (`_cos_rot`, `_sin_rot`)
- Scaled to screen coordinates using `world_scale`, `tx`, `ty` translations
- Track fitting algorithm ensures full circuit visible with UI margins

**Track Geometry Construction:**
- Center line from example lap telemetry (x, y coordinates)
- Perpendicular normals computed via gradient to create track edges
- Inner/outer boundaries offset by `track_width/2`
- Interpolated to smooth polylines for rendering

### Caching Strategy

**Two-level Cache:**
1. **FastF1 Cache** (`.fastf1-cache/`): Raw F1 API responses
2. **Computed Telemetry Cache** (`computed_data/`): Processed frame data
   - Filenames: `{event_name}_{race|sprint|quali|sprintquali}_telemetry.pkl`
   - Use `--refresh-data` to bypass and recompute

**Cache Files Include:**
- Frames array with all driver positions/telemetry
- Driver colors (team colors from FastF1)
- Track statuses (flags, safety car periods)
- Total laps, speed ranges (qualifying)

### Backend API

**REST Endpoints:**
- `GET /api/rounds?year=2025`: List all rounds for a year
- `GET /api/sprints?year=2025`: List sprint rounds
- `GET /api/session-types?year={year}&round={round}`: Available session types

**WebSocket Endpoint:**
- `ws://localhost:8000/ws/replay`: Connect to receive frame stream
  - Send `{"action": "init", "year": 2025, "round": 12, "session_type": "R", "refresh": false}`
  - Receive frames as JSON objects with position, lap, tyre, and telemetry data

### Frontend Development

**When adding new UI components:**
- Use React hooks for state management (consider Zustand stores for shared state)
- Components should be responsive using Tailwind CSS
- WebSocket data comes from `useReplayWebSocket` hook
- Three.js rendering should be isolated in `Canvas` components

**When modifying replay visualization:**
- Track geometry is loaded from backend and stored in component state
- Frame data updates trigger re-renders via state updates
- Use requestAnimationFrame for smooth animation

### Known Issues

**Leaderboard Accuracy:**
- Position calculations based on race distance may be inaccurate in first few corners
- Pit stops temporarily affect leaderboard accuracy
- Final positions sometimes affected by final telemetry point locations
- These are telemetry data quality issues being addressed incrementally

**Performance:**
- First run for a session requires telemetry computation (can take minutes)
- Subsequent runs load from cache (near-instant)
- Large races (many laps) generate large frame arrays

## Development Guidelines

### Backend Development

**When modifying telemetry processing (`src/f1_data.py`):**
- Changes to `get_race_telemetry` or `get_quali_telemetry` require `--refresh-data` to see effects
- Multiprocessing worker functions must be top-level (not nested) for pickle compatibility
- Maintain 25 FPS resampling for consistent playback
- Frame structure must include "position" field for correct leaderboard ordering

**When modifying WebSocket streaming (`backend/main.py`):**
- Frame data is serialized to JSON before sending
- Ensure all numeric types are compatible with JSON (use float/int, not numpy types)
- Test WebSocket connection at `ws://localhost:8000/ws/replay`

### Frontend Development (Legacy Arcade Desktop App)

**When adding UI components:**
- Inherit from `BaseComponent` in `src/ui_components.py`
- Implement `draw(window)` at minimum
- Optional: `on_resize(window)`, `on_mouse_press(...)`, `on_mouse_motion(...)`
- Return `True` from `on_mouse_press` to consume event and stop propagation

**When working with track rendering:**
- World coordinates are in meters (FastF1 telemetry)
- Use `_project_to_reference()` to convert (x,y) to along-track distance
- Leaderboard ordering should use pre-calculated "position" field, not recalculated projections

**Testing different sessions:**
- Use `--list-rounds` to find valid round numbers
- Session types: `'R'` (Race), `'S'` (Sprint), `'Q'` (Qualifying), `'SQ'` (Sprint Qualifying)
- Not all events have sprint sessions

## Project Vision

This project aims to be the best way for data-loving F1 fans to explore race weekend data with immersive 3D visualization and detailed telemetry analysis.

For detailed roadmap and planned features, see [docs/ROADMAP.md](docs/ROADMAP.md)
