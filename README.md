# F1 Race Replay

A full-stack web application for exploring Formula 1 race telemetry with interactive race replay, live leaderboards, and detailed telemetry analysis.

## Quick Start

```bash
# Full stack (frontend + backend)
node dev.js

# Or separately
python backend/main.py          # http://localhost:8000
cd frontend && npm run dev      # http://localhost:5173
```

## Features

- **3D Race Replay:** Interactive track visualization with real-time driver positions
- **Live Leaderboard:** Current standings with tyre compounds and gaps
- **Driver Telemetry:** Speed, throttle, brake, gear, and DRS status for selected drivers
- **Multi-session Support:** Race, Sprint, Qualifying, and Sprint Qualifying replays
- **WebSocket Streaming:** Real-time frame data delivery for smooth playback
- **Session Comparison:** Compare telemetry across multiple drivers and laps
- **Smart Caching:** Fast reruns with automatic FastF1 and telemetry caching

## Architecture

```
Frontend (React/TypeScript/Three.js) ←→ Backend (FastAPI/WebSocket)
                ↓ Imports
         Shared Code (Telemetry processing, caching)
```

## Setup

**Backend dependencies:**
```bash
pip install -r requirements.txt
```

**Frontend dependencies:**
```bash
cd frontend && npm install
```

## Usage

Visit `http://localhost:5173` and select a season/round to start replaying.

**To list available rounds:**
```bash
python backend/main.py --list-rounds 2025
python backend/main.py --list-sprints 2025
```

## Project Structure

- **`backend/`** - FastAPI server with REST/WebSocket APIs
- **`frontend/`** - React web UI with 3D visualization
- **`shared/`** - Telemetry processing, caching, and utilities
- **`legacy/`** - Legacy Arcade desktop app (reference)

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed architecture.

## Known Issues

- Leaderboard may be inaccurate in first few corners due to telemetry precision
- Pit stops can temporarily affect position calculations
- Final lap positions sometimes affected by final telemetry point locations

## Contributing

Contributions welcome! Please check [roadmap.md](./roadmap.md) for planned features.

## License

MIT License - See LICENSE file for details.

## Disclaimer

Formula 1 and related trademarks are property of their respective owners. All data sourced from public APIs for educational and non-commercial use only.
