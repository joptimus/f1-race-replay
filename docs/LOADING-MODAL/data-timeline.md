# Data Arrival Timeline: Loading Modal Implementation

## The Connectivity Sequence

A detailed timeline showing exactly what data the UI knows at each critical moment during session loading.

---

## T+0: POST /api/sessions (Immediate)

### What Happens
User clicks "Load Race" → Frontend sends POST with year, round, session_type

### What Backend Returns
```json
{
  "session_id": "2025_1_R"
}
```

### What UI Store Contains
```javascript
{
  session: {
    sessionId: "2025_1_R",
    metadata: {
      year: 2025,
      round: 1,
      session_type: "R"
    },
    isLoading: true,
    error: null
  },
  loadingProgress: 0,
  loadingError: null,
  isLoadingComplete: false,
  currentFrame: null,
  playback: {
    isPlaying: false,
    speed: 1.0,
    frameIndex: 0,
    currentTime: 0,
    totalFrames: 0  // 🔴 NO FRAME DATA YET
  }
}
```

### What UI Displays
- **Loading Modal**: ✅ Opens, shows "Loading Session 2025 F1 ROUND 1", 0% progress bar
- **Map Visualization**: ❌ Blank/Loading (no track geometry, no driver colors)
- **Leaderboard**: ❌ Empty (no drivers, no positions)
- **Playback Controls**: ❌ Disabled (totalFrames = 0)

### Visual State
```
┌─────────────────────────────────┐
│  Loading Session               │
│  2025 F1 ROUND 1               │
│                                 │
│  ●●● (spinning dots)            │
│  [░░░░░░░░░░░░░░░░░] 0%         │
│                                 │
│  Processing telemetry data...  │
└─────────────────────────────────┘
```

---

## T+0.5: WebSocket Connects

### What Happens
Frontend establishes WebSocket connection to `/ws/replay/2025_1_R`
Backend registers progress callback on session object
Backend is already running `load_data()` in background

### What Backend Sends (First Message)
```json
{
  "type": "loading_progress",
  "progress": 0,
  "message": "Loading session 2025 R1...",
  "elapsed_seconds": 0
}
```

### What UI Store Contains (No Change Yet)
Same as T+0 - Frontend hasn't processed first message yet

### UI Receives
✅ Timeout cleared (at least one message arrived)

### Visual State
Still shows modal with 0%

---

## T+2: Backend Loads FastF1 Session

### What Happens
Backend calls `load_session()` - loads race metadata from FastF1 API
Takes ~1-2 seconds for large races

### What Backend Sends
```json
{
  "type": "loading_progress",
  "progress": 10,
  "message": "Session loaded, fetching telemetry...",
  "elapsed_seconds": 2
}
```

### What UI Store Contains
```javascript
{
  // ... previous state ...
  loadingProgress: 10,  // 🟢 UPDATED
  playback: {
    // ... same as T+0 ...
    totalFrames: 0  // 🔴 STILL NO FRAME DATA
  }
}
```

### What UI Displays
- **Loading Modal**: Progress bar animates to 10%
- **Map**: Still blank
- **Leaderboard**: Still empty
- **Playback Controls**: Still disabled

### Visual State
```
┌─────────────────────────────────┐
│  Loading Session               │
│  2025 F1 ROUND 1               │
│                                 │
│  ●●● (spinning dots)            │
│  [██░░░░░░░░░░░░░░░] 10%        │
│                                 │
│  Session loaded, fetching...   │
└─────────────────────────────────┘
```

---

## T+5 to T+60: Telemetry Processing (Frame Generation)

### What Happens
Backend's `get_race_telemetry()` runs in background thread
Processes driver telemetry, generates frames at 25 FPS
Calls `progress_callback()` every ~250 frames processed

### What Backend Sends (Multiple Messages)
```json
// T+5
{ "type": "loading_progress", "progress": 15, "message": "Processing telemetry: 15.0%", "elapsed_seconds": 5 }

// T+15
{ "type": "loading_progress", "progress": 30, "message": "Processing telemetry: 30.5%", "elapsed_seconds": 15 }

// T+25
{ "type": "loading_progress", "progress": 45, "message": "Processing telemetry: 45.2%", "elapsed_seconds": 25 }

// T+50
{ "type": "loading_progress", "progress": 60, "message": "Generated 154173 frames", "elapsed_seconds": 50 }
```

### What UI Store Contains (Continuously Updated)
```javascript
{
  // ... previous state ...
  loadingProgress: 15,   // 🟢 CONTINUOUSLY UPDATED
  playback: {
    totalFrames: 0  // 🔴 STILL NO FRAME DATA
  }
}
```

### What UI Displays
- **Loading Modal**: Progress bar smoothly animates from 10% → 60%
- **Map**: Still blank (no track geometry yet)
- **Leaderboard**: Still empty
- **Playback Controls**: Still disabled

### Critical Detail
⚠️ **No frame data available yet** - Frames are still being generated in background thread. UI cannot show any race data.

### Visual State (Example at 45%)
```
┌─────────────────────────────────┐
│  Loading Session               │
│  2025 F1 ROUND 1               │
│                                 │
│  ●●● (spinning dots)            │
│  [███████████░░░░░░░░] 45%       │
│                                 │
│  Processing telemetry: 45.2%   │
└─────────────────────────────────┘
```

---

## T+70: Track Geometry Built

### What Happens
Backend computes track geometry from fastest lap telemetry
Creates centerline, inner boundary, outer boundary
Builds coordinate system for 3D visualization

### What Backend Sends
```json
{
  "type": "loading_progress",
  "progress": 75,
  "message": "Loaded frames, building track geometry...",
  "elapsed_seconds": 70
}
```

### What UI Store Contains
```javascript
{
  // ... previous state ...
  loadingProgress: 75,  // 🟢 UPDATED
  playback: {
    totalFrames: 0  // 🔴 STILL NO FRAME DATA
  }
}
```

### What UI Displays
- **Loading Modal**: Progress bar at 75%
- **Map**: Still blank
- **Leaderboard**: Still empty

### Visual State
```
┌─────────────────────────────────┐
│  Loading Session               │
│  2025 F1 ROUND 1               │
│                                 │
│  ●●● (spinning dots)            │
│  [███████████████░░░] 75%        │
│                                 │
│  Building track geometry...    │
└─────────────────────────────────┘
```

---

## T+85: Frames Serialized

### What Happens
Backend serializes all 154,173 frames to msgpack binary format
Prepares frames for efficient WebSocket streaming

### What Backend Sends
```json
{
  "type": "loading_progress",
  "progress": 90,
  "message": "Pre-serializing 154173 frames...",
  "elapsed_seconds": 85
}
```

### What UI Store Contains
```javascript
{
  // ... previous state ...
  loadingProgress: 90,  // 🟢 UPDATED
  playback: {
    totalFrames: 0  // 🔴 STILL NO FRAME DATA
  }
}
```

### What UI Displays
- **Loading Modal**: Progress bar at 90%
- **Map**: Still blank
- **Leaderboard**: Still empty

---

## T+95: Loading Complete ⭐

### What Happens
Backend finishes all processing
Sets `is_loaded = True`
Sends COMPLETE message with ALL session metadata

### What Backend Sends
```json
{
  "type": "loading_complete",
  "frames": 154173,
  "load_time_seconds": 95,
  "elapsed_seconds": 95,
  "metadata": {
    "year": 2025,
    "round": 1,
    "session_type": "R",
    "total_frames": 154173,
    "total_laps": 58,
    "driver_colors": {
      "HAM": [255, 77, 0],      // McLaren orange
      "RUS": [255, 153, 102],   // McLaren light
      "VER": [6, 69, 255],      // RB navy blue
      // ... 18 drivers ...
    },
    "driver_numbers": {
      "HAM": 44,
      "RUS": 63,
      // ... all drivers ...
    },
    "driver_teams": {
      "HAM": "McLaren",
      "RUS": "McLaren",
      // ... all drivers ...
    },
    "track_geometry": {
      "centerline_x": [100.5, 102.3, 104.1, ...],  // 4000+ points
      "centerline_y": [-50.2, -48.5, -46.9, ...],
      "inner_x": [95.2, 97.1, 98.9, ...],
      "inner_y": [-55.5, -53.8, -52.1, ...],
      "outer_x": [105.8, 107.5, 109.3, ...],
      "outer_y": [-44.9, -43.2, -41.7, ...],
      "x_min": -200.5,
      "x_max": 400.2,
      "y_min": -300.1,
      "y_max": 250.8,
      "sector": [1, 1, 1, ..., 2, 2, 2, ..., 3, 3, 3]
    },
    "track_statuses": [
      { "t": 0.5, "status": "1" },      // Green
      { "t": 120.3, "status": "2" },    // Yellow
      { "t": 145.8, "status": "1" },    // Green again
      // ... all status changes ...
    ],
    "race_start_time": 52.3,
    "error": null
  }
}
```

### What UI Store Contains (MAJOR UPDATE)
```javascript
{
  session: {
    sessionId: "2025_1_R",
    metadata: {  // 🟢 NOW FULLY POPULATED
      year: 2025,
      round: 1,
      session_type: "R",
      total_frames: 154173,
      total_laps: 58,
      driver_colors: { HAM: [...], RUS: [...], ... },
      driver_numbers: { HAM: 44, RUS: 63, ... },
      driver_teams: { HAM: "McLaren", RUS: "McLaren", ... },
      track_geometry: { centerline_x: [...], ... },  // 🟢 TRACK GEOMETRY
      track_statuses: [{ t: 0.5, status: "1" }, ...],
      race_start_time: 52.3,
      error: null
    },
    isLoading: true,  // Still true until modal closes
    error: null
  },
  loadingProgress: 100,
  loadingError: null,
  isLoadingComplete: true,  // 🟢 COMPLETION FLAG
  currentFrame: null,  // Will be populated on first frame request
  playback: {
    isPlaying: false,
    speed: 1.0,
    frameIndex: 0,
    currentTime: 0,
    totalFrames: 154173  // 🟢 NOW SET
  }
}
```

### What UI Displays
- **Loading Modal**: Progress bar at 100%, will auto-close in 700ms
- **Map**: ✅ NOW VISIBLE - track geometry rendered, sector colors shown
- **Leaderboard**: ✅ NOW VISIBLE - 20 drivers listed with team colors
- **Playback Controls**: ✅ NOW ENABLED - can seek, play/pause
- **Track Status Lights**: ✅ NOW VISIBLE - shows green/yellow/red status

### Critical Moment
This is when **ALL session data becomes available to the UI simultaneously**. Before this point, the UI has no race data. After this point, it has everything.

### Visual State
```
┌─────────────────────────────────┐
│  Loading Session               │
│  2025 F1 ROUND 1               │
│                                 │
│  ●●● (spinning dots)            │
│  [██████████████████] 100%       │
│                                 │
│  Processing telemetry data...  │
│                                 │
│  [AUTO-CLOSING IN 700ms...]    │
└─────────────────────────────────┘

┌──────────────────────────────────────┐
│                                      │
│  [Track map with circuit visible]   │
│  [Grid with cars positioned]        │
│                                      │
│  Leaderboard:                       │
│  1. VER  Red Bull                   │
│  2. HAM  McLaren                    │
│  3. RUS  McLaren                    │
│  ...                                │
└──────────────────────────────────────┘
```

---

## T+100: Modal Auto-Closes

### What Happens
700ms has elapsed since modal opened
`useLoadingState` hook detects both conditions met:
1. `isLoadingComplete === true`
2. `elapsed >= 700ms`

Frontend calls `setSessionLoading(false)`

### What UI Store Contains
```javascript
{
  session: {
    // ... all metadata still intact ...
    isLoading: false  // 🟢 MODAL CLOSES
  },
  // ... everything else unchanged ...
}
```

### What UI Displays
- **Loading Modal**: ❌ HIDDEN (AnimatePresence animation removes it)
- **Map**: ✅ FULLY VISIBLE - no modal overlay
- **Leaderboard**: ✅ FULLY VISIBLE
- **Playback Controls**: ✅ FULLY FUNCTIONAL
- **First Frame**: ✅ Should arrive soon from WebSocket frame streaming

### Critical Detail
⚠️ **Modal stays visible minimum 700ms** - prevents jarring "instant close" on cached loads. Even if loading finishes in 50ms, modal shows for 700ms before closing.

### Visual State
```
┌──────────────────────────────────────┐
│                                      │
│  [Track map with full circuit]      │
│  [All 20 cars positioned]           │
│  [Car 44 (Hamilton) selected]       │
│                                      │
│  Leaderboard:                       │
│  1. VER  P1  Red Bull   2:45.320   │
│  2. HAM  P2  McLaren    2:45.445   │
│  3. RUS  P3  McLaren    2:45.712   │
│  ...                                │
│                                      │
│  [Play] [Pause] [Speed: 1.0x]      │
│  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                    Lap 1 / 58       │
└──────────────────────────────────────┘
```

---

## Summary: Data Availability Timeline

| Time | Event | UI Knows | Map Visible | Playable |
|------|-------|----------|------------|----------|
| T+0 | POST returns | session_id, year, round | ❌ No | ❌ No |
| T+0.5 | WS connects | (same) | ❌ No | ❌ No |
| T+2 | FastF1 loaded | progress: 10% | ❌ No | ❌ No |
| T+5-60 | Frames generate | progress: 15-60% | ❌ No | ❌ No |
| T+70 | Track built | progress: 75% | ❌ No | ❌ No |
| T+85 | Frames serialized | progress: 90% | ❌ No | ❌ No |
| **T+95** | **COMPLETE** | **Full metadata + 154173 frames** | **✅ Yes** | **✅ Yes** |
| T+100 | Modal closes | (unchanged) | ✅ Clear | ✅ Full |

---

## Key Insights

### What Data Arrives When
- **Immediately (T+0)**: Only session ID and basic metadata (year, round, type)
- **Gradually (T+2 to T+95)**: Progress updates; no playable data
- **All at Once (T+95)**: Complete track geometry, driver colors, frame count - everything needed for UI
- **Streaming (T+100+)**: Frame data arrives one frame at a time as backend streams

### Why This Sequence Matters

1. **Progress Bar UX**: Users see activity (progress bar animating) even though no race data is ready yet
2. **Lazy Data Loading**: Session metadata arrives just-in-time when loading completes (not before)
3. **Synchronized State**: Track geometry, driver colors, and frame count all arrive together - no partial state
4. **Minimum Display Time**: Modal shows for 700ms minimum, preventing flickering on cached loads
5. **Single Source of Truth**: WebSocket is the ONLY source of race data; no competing HTTP calls

### The Critical T+95 Moment
This is the most important instant in the entire flow. At T+95:
- Backend has finished ALL processing
- Frontend receives COMPLETE session metadata
- Frontend updates store → triggers re-renders
- Map becomes visible with track geometry
- Leaderboard becomes visible with driver info
- Playback controls become enabled

Before T+95, the UI can only show a loading modal.
After T+95, the UI shows a fully interactive race visualization.

