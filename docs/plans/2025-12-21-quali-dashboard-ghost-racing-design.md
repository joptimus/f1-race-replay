# QualiDashboard Ghost Racing Design

**Created:** 2025-12-21
**Status:** Approved
**Phase:** 1 of 2

## Overview

Redesign the QualiDashboard to display a "ghost race" where all drivers' fastest laps are overlaid on the track, synchronized to a common timeline. Users can highlight any driver to see their telemetry while others appear as subtle ghost markers.

## Goals

**Phase 1 (This Design):**
- Ghost racing with fastest laps per segment
- Progressive reveal: Q1 → Q2 → Q3 with eliminations
- Segment tabs for granular control
- Highlighted driver with telemetry panel
- Full playback controls

**Phase 2 (Future):**
- Full session replay with all 297 laps
- Real-time qualifying drama as it happened
- Pit lane, out laps, hot laps, in laps

## Architecture

```
Backend (f1_data.py)                    Frontend (QualiDashboard)
┌─────────────────────┐                 ┌─────────────────────────┐
│ get_quali_telemetry │                 │                         │
│ Returns per-driver: │                 │  useQualiPlayback hook  │
│  {                  │ ──── JSON ────▶ │  - Merges driver frames │
│    segments: {      │                 │  - Interpolates to sync │
│      Q1: {...}      │                 │  - Handles playback     │
│      Q2: {...}      │                 │                         │
│    }                │                 │  QualiGhostRace component│
│    duration: 85.2   │                 │  - Renders track + cars │
│  }                  │                 │  - Highlights selected  │
└─────────────────────┘                 └─────────────────────────┘
```

## Data Structure

### Backend Response (`get_quali_telemetry`)

```python
{
    "results": [...],  # Final Q1/Q2/Q3 times (existing)
    "driver_colors": {"VER": [255,0,0], ...},
    "segments": {
        "Q1": {
            "duration": 85.2,  # Longest lap in segment (seconds)
            "drivers": {
                "VER": {"frames": [...], "lap_time": 75.123},
                "HAM": {"frames": [...], "lap_time": 75.456},
                # All 20 drivers
            }
        },
        "Q2": {
            "duration": 74.8,
            "drivers": {
                # Top 15 drivers
            }
        },
        "Q3": {
            "duration": 73.5,
            "drivers": {
                # Top 10 drivers
            }
        }
    }
}
```

Each driver's `frames` array contains their fastest lap telemetry with time normalized to 0.

## Frontend Components

```
QualiDashboard.tsx (major refactor)
├── QualiHeader.tsx
│   ├── Session info (year, round, event name)
│   └── Segment tabs: [Q1] [Q2] [Q3] [Progressive]
│
├── QualiGhostRace.tsx (new)
│   ├── TrackCanvas - 2D track with driver dots
│   ├── DriverMarkers - Highlighted vs ghost styling
│   └── EliminationOverlay - Faded markers for knocked-out drivers
│
├── QualiLeaderboard.tsx (new)
│   ├── Click driver to highlight
│   ├── Shows current lap time / sector splits
│   └── Eliminated drivers greyed out
│
├── QualiTelemetryPanel.tsx (adapt existing)
│   └── Speed, throttle, brake, gear for highlighted driver
│
└── QualiPlaybackControls.tsx (new)
    ├── Play/Pause button
    ├── Speed selector: 0.5x, 1x, 2x
    ├── Scrub bar (0% to 100% of lap)
    └── Frame step buttons: [◀] [▶]
```

### Key Hook

```typescript
useQualiPlayback(segmentData, playbackSpeed)
// Returns: { currentTime, drivers: {code: {x, y, speed...}}, play, pause, seek }
```

This hook handles interpolating all drivers to the current playback time.

## Visual Design

### Driver Marker Styling

| Element | Highlighted Driver | Ghost Drivers | Eliminated |
|---------|-------------------|---------------|------------|
| Marker size | 12px | 8px | 6px |
| Opacity | 100% | 40% | 15% |
| Color | Team color (bright) | Team color (muted) | Grey |
| Label | Always visible | On hover | Hidden |
| Trail | 10-frame motion trail | None | None |

### Progressive Reveal Timing

1. Q1 plays (all 20 drivers)
2. 2-second pause, bottom 5 fade to "eliminated" style
3. Q2 plays (top 15 active, 5 eliminated visible but faded)
4. 2-second pause, next 5 fade
5. Q3 plays (top 10 active, 10 eliminated)
6. Final order revealed

### Segment Tab Behavior

- **[Q1]** - Shows only Q1 laps, all drivers active
- **[Q2]** - Shows Q2 laps, only top 15 active
- **[Q3]** - Shows Q3 laps, only top 10 active
- **[Progressive]** - Runs the full reveal sequence

### Telemetry Panel

- Slides in from right when driver selected
- Shows: speed gauge, throttle/brake bars, gear indicator, current sector times
- Close button or click elsewhere to deselect

## Edge Cases

### Data Edge Cases

| Scenario | Handling |
|----------|----------|
| Driver has no Q2/Q3 lap | Not included in that segment's `drivers` object |
| Lap telemetry missing | Skip driver for that segment, log warning |
| Deleted lap is fastest | Still show it (showing fastest, not official) |
| Sprint Qualifying (SQ) | Same structure, uses SQ1/SQ2/SQ3 naming |
| Red flag mid-session | Laps still have telemetry, no special handling needed |

### Playback Edge Cases

| Scenario | Handling |
|----------|----------|
| Scrub past lap end | Clamp to final frame, driver stays at finish position |
| Driver's lap shorter than segment duration | Driver finishes early, marker stays at finish line |
| No driver selected | Show ghost race without telemetry panel |
| Switch segment mid-playback | Reset to t=0, pause playback |

### Loading States

| State | UI |
|-------|-----|
| Initial load | Skeleton loader with "Loading qualifying data..." |
| Segment has no data | Show message "No data available for Q3" |
| WebSocket disconnect | Pause playback, show reconnecting indicator |

## Implementation Plan

### Backend Changes (f1_data.py)

1. Modify `get_quali_telemetry` to return new `segments` structure
2. Add `driver_colors` to return object
3. Include `duration` per segment (max lap time)
4. Restructure per-driver frames under segments

### Frontend Changes

| File | Change |
|------|--------|
| `QualiDashboard.tsx` | Major refactor - new layout with tabs, ghost race, controls |
| `useQualiPlayback.ts` | New hook - handles playback state, interpolation |
| `QualiGhostRace.tsx` | New component - canvas-based track with driver markers |
| `QualiLeaderboard.tsx` | New component - clickable driver list |
| `QualiPlaybackControls.tsx` | New component - play/pause, speed, scrub |
| `replayStore.ts` | Add qualifying-specific state slice |

### Estimated Effort

- Backend data restructure: ~2 hours
- Frontend playback hook: ~3 hours
- Ghost race canvas: ~4 hours
- UI components (leaderboard, controls, tabs): ~3 hours
- Integration & polish: ~2 hours
- **Total Phase 1: ~14 hours**

## Phase 2: Full Session Replay (Future)

When ready to implement full session replay:

1. Modify `get_quali_telemetry` to fetch ALL laps (not just fastest)
2. Include `LapStartTime` (absolute session time) per lap
3. Create session-wide timeline from first lap start to last lap end
4. Track lap type: out lap, hot lap, in lap
5. Show pit lane positions when drivers aren't on track
6. Reuse Phase 1 infrastructure (components, playback hook)

This builds directly on Phase 1 - same components, extended data.
