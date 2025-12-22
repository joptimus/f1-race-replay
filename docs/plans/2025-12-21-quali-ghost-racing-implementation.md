# QualiDashboard Ghost Racing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform QualiDashboard from broken state to ghost racing visualization where all drivers' fastest laps are overlaid and synchronized.

**Architecture:** Backend restructures qualifying data into segment-based format with per-driver frames. Frontend creates playback hook that interpolates all drivers to current time, rendering them on a 2D track canvas with highlighting support.

**Tech Stack:** Python/FastF1 (backend), React/TypeScript/Zustand/Canvas API (frontend)

---

## Task 1: Backend - Restructure get_quali_telemetry Return Format

**Files:**
- Modify: `shared/telemetry/f1_data.py:1545-1637`

**Step 1: Update the return structure**

Change `get_quali_telemetry` to return the new segment-based structure. The current return is:
```python
{
    "results": qualifying_results,
    "telemetry": telemetry_data,  # {driver: {Q1: {...}, Q2: {...}, Q3: {...}}}
    "max_speed": max_speed,
    "min_speed": min_speed,
}
```

Change to:
```python
{
    "results": qualifying_results,
    "driver_colors": get_driver_colors(session),
    "segments": {
        "Q1": {
            "duration": max_duration_q1,
            "drivers": {
                "VER": {"frames": [...], "lap_time": 75.123},
                ...
            }
        },
        "Q2": {...},
        "Q3": {...}
    },
    "max_speed": max_speed,
    "min_speed": min_speed,
}
```

Replace lines 1581-1637 in `f1_data.py` with:

```python
    qualifying_results = get_qualifying_results(session)
    driver_colors = get_driver_colors(session)

    driver_codes = {
        num: session.get_driver(num)["Abbreviation"]
        for num in session.drivers
    }

    driver_args = [(session, driver_codes[driver_no]) for driver_no in session.drivers]

    print(f"Processing {len(session.drivers)} drivers in parallel...")

    num_processes = min(cpu_count(), len(session.drivers))
    num_drivers = len(session.drivers)
    chunksize = max(1, (num_drivers + num_processes * 4 - 1) // (num_processes * 4))

    raw_telemetry = {}
    max_speed = 0.0
    min_speed = 0.0

    with Pool(processes=num_processes) as pool:
        results = pool.imap_unordered(_process_quali_driver, driver_args, chunksize=chunksize)
        for result in results:
            driver_code = result["driver_code"]
            raw_telemetry[driver_code] = result["driver_telemetry_data"]
            if result["max_speed"] > max_speed:
                max_speed = result["max_speed"]
            if result["min_speed"] < min_speed or min_speed == 0.0:
                min_speed = result["min_speed"]

    segments = {"Q1": {"duration": 0, "drivers": {}}, "Q2": {"duration": 0, "drivers": {}}, "Q3": {"duration": 0, "drivers": {}}}

    for driver_code, driver_data in raw_telemetry.items():
        for segment_name in ["Q1", "Q2", "Q3"]:
            if segment_name in driver_data and driver_data[segment_name].get("frames"):
                frames = driver_data[segment_name]["frames"]
                if frames:
                    lap_duration = frames[-1]["t"] if frames else 0
                    lap_time_ms = lap_duration * 1000
                    segments[segment_name]["drivers"][driver_code] = {
                        "frames": frames,
                        "lap_time": lap_time_ms,
                    }
                    if lap_duration > segments[segment_name]["duration"]:
                        segments[segment_name]["duration"] = lap_duration

    cache_dir.mkdir(parents=True, exist_ok=True)
    output_data = {
        "results": qualifying_results,
        "driver_colors": driver_colors,
        "segments": segments,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }

    with open(cache_file, "wb") as f:
        pickle.dump(output_data, f, protocol=pickle.HIGHEST_PROTOCOL)

    return output_data
```

**Step 2: Test the backend change**

Run: `python3 -c "
import sys
sys.path.insert(0, '.')
from shared.telemetry.f1_data import load_session, get_quali_telemetry
session = load_session(2025, 1, 'Q')
data = get_quali_telemetry(session, refresh=True)
print('Keys:', list(data.keys()))
print('Segments:', list(data['segments'].keys()))
print('Q1 drivers:', len(data['segments']['Q1']['drivers']))
print('Q1 duration:', data['segments']['Q1']['duration'])
print('Driver colors:', len(data['driver_colors']))
"`

Expected: Shows segments with Q1 having ~20 drivers, Q2 ~15, Q3 ~10

**Step 3: Commit**

```bash
git add shared/telemetry/f1_data.py
git commit -m "refactor: restructure get_quali_telemetry to segment-based format

- Add driver_colors to return object
- Reorganize telemetry into segments.Q1/Q2/Q3 structure
- Include duration per segment (max lap time)
- Each driver has frames array and lap_time"
```

---

## Task 2: Backend - Update replay_service to Handle New Qualifying Format

**Files:**
- Modify: `backend/app/services/replay_service.py:128-134`

**Step 1: Update qualifying data handling**

The current code tries to get `frames` from qualifying data but they don't exist at top level. Change lines 128-134:

```python
            if self.session_type in ["Q", "SQ"]:
                data = await loop.run_in_executor(
                    executor,
                    lambda: get_quali_telemetry(session, session_type=self.session_type, refresh=self.refresh, progress_callback=progress_callback)
                )
                # Qualifying uses segment-based structure, not frame-based
                self.quali_segments = data.get("segments", {})
                self.driver_colors = data.get("driver_colors", {})
                self.quali_results = data.get("results", [])
                self.frames = []  # No unified frames for qualifying
```

**Step 2: Add quali_segments to get_metadata**

Find `get_metadata` method (around line 392) and add qualifying fields:

```python
    def get_metadata(self) -> dict:
        metadata = {
            "year": self.year,
            "round": self.round_num,
            "session_type": self.session_type,
            "total_frames": len(self.frames) if self.frames else 0,
            "total_laps": self.total_laps,
            "driver_colors": {
                code: list(color) if isinstance(color, tuple) else color
                for code, color in self.driver_colors.items()
            },
            "driver_numbers": self.driver_numbers,
            "driver_teams": self.driver_teams,
            "track_geometry": self.track_geometry,
            "track_statuses": self.track_statuses,
            "race_start_time": self.race_start_time,
            "error": self.load_error,
        }

        # Add qualifying-specific data
        if self.session_type in ["Q", "SQ"]:
            metadata["quali_segments"] = getattr(self, "quali_segments", {})
            metadata["quali_results"] = getattr(self, "quali_results", [])

        return metadata
```

**Step 3: Initialize new attributes in __init__**

Add to `__init__` method (around line 32-48):

```python
        self.quali_segments = {}
        self.quali_results = []
```

**Step 4: Verify backend loads without error**

Run: `python backend/main.py`

Then in another terminal:
```bash
curl -s "http://localhost:8000/api/session-types?year=2025&round=1" | python3 -m json.tool
```

Expected: Returns list of session types without errors

**Step 5: Commit**

```bash
git add backend/app/services/replay_service.py
git commit -m "fix: handle segment-based qualifying data in replay_service

- Store quali_segments and quali_results from new format
- Add qualifying fields to metadata response
- Initialize new attributes in constructor"
```

---

## Task 3: Frontend - Add Qualifying Types

**Files:**
- Modify: `frontend/src/types.ts`

**Step 1: Add qualifying type definitions**

Add to `types.ts`:

```typescript
export interface QualiDriverFrame {
  t: number;
  x: number;
  y: number;
  dist: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number;
}

export interface QualiDriverData {
  frames: QualiDriverFrame[];
  lap_time: number; // milliseconds
}

export interface QualiSegment {
  duration: number; // seconds
  drivers: Record<string, QualiDriverData>;
}

export interface QualiSegments {
  Q1: QualiSegment;
  Q2: QualiSegment;
  Q3: QualiSegment;
}

export interface QualiResult {
  code: string;
  position: number;
  color: [number, number, number];
  Q1: string | null;
  Q2: string | null;
  Q3: string | null;
}

export type QualiSegmentName = "Q1" | "Q2" | "Q3" | "Progressive";
```

**Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add TypeScript types for qualifying ghost racing"
```

---

## Task 4: Frontend - Create useQualiPlayback Hook

**Files:**
- Create: `frontend/src/hooks/useQualiPlayback.ts`

**Step 1: Create the playback hook**

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { QualiSegment, QualiDriverFrame, QualiSegmentName } from "../types";

interface InterpolatedDriver {
  code: string;
  x: number;
  y: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number;
  lapTime: number;
  finished: boolean;
}

interface UseQualiPlaybackReturn {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  drivers: InterpolatedDriver[];
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (time: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

function interpolateDriver(
  frames: QualiDriverFrame[],
  time: number,
  lapTime: number
): Omit<InterpolatedDriver, "code" | "lapTime"> {
  if (!frames || frames.length === 0) {
    return { x: 0, y: 0, speed: 0, gear: 0, throttle: 0, brake: 0, drs: 0, finished: true };
  }

  const lastFrame = frames[frames.length - 1];
  if (time >= lastFrame.t) {
    return {
      x: lastFrame.x,
      y: lastFrame.y,
      speed: lastFrame.speed,
      gear: lastFrame.gear,
      throttle: lastFrame.throttle,
      brake: lastFrame.brake,
      drs: lastFrame.drs,
      finished: true,
    };
  }

  if (time <= 0) {
    const first = frames[0];
    return {
      x: first.x,
      y: first.y,
      speed: first.speed,
      gear: first.gear,
      throttle: first.throttle,
      brake: first.brake,
      drs: first.drs,
      finished: false,
    };
  }

  let low = 0;
  let high = frames.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t <= time) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const f0 = frames[low];
  const f1 = frames[high];
  const t = (time - f0.t) / (f1.t - f0.t);

  return {
    x: f0.x + (f1.x - f0.x) * t,
    y: f0.y + (f1.y - f0.y) * t,
    speed: f0.speed + (f1.speed - f0.speed) * t,
    gear: Math.round(f0.gear + (f1.gear - f0.gear) * t),
    throttle: f0.throttle + (f1.throttle - f0.throttle) * t,
    brake: f0.brake + (f1.brake - f0.brake) * t,
    drs: f0.drs,
    finished: false,
  };
}

export function useQualiPlayback(
  segment: QualiSegment | null
): UseQualiPlaybackReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const duration = segment?.duration ?? 0;

  const interpolateAllDrivers = useCallback(
    (time: number): InterpolatedDriver[] => {
      if (!segment) return [];
      return Object.entries(segment.drivers).map(([code, data]) => {
        const interpolated = interpolateDriver(data.frames, time, data.lap_time);
        return {
          code,
          lapTime: data.lap_time,
          ...interpolated,
        };
      });
    },
    [segment]
  );

  const [drivers, setDrivers] = useState<InterpolatedDriver[]>([]);

  useEffect(() => {
    setDrivers(interpolateAllDrivers(currentTime));
  }, [currentTime, interpolateAllDrivers]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + delta * speed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed, duration]);

  const play = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying(true);
  }, [currentTime, duration]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const setSpeed = useCallback((s: number) => setSpeedState(s), []);

  const seek = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(0, Math.min(time, duration)));
    },
    [duration]
  );

  const stepForward = useCallback(() => {
    setCurrentTime((prev) => Math.min(prev + 1 / 25, duration));
  }, [duration]);

  const stepBackward = useCallback(() => {
    setCurrentTime((prev) => Math.max(prev - 1 / 25, 0));
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [segment]);

  return {
    currentTime,
    duration,
    isPlaying,
    speed,
    drivers,
    play,
    pause,
    setSpeed,
    seek,
    stepForward,
    stepBackward,
  };
}
```

**Step 2: Verify hook compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useQualiPlayback.ts
git commit -m "feat: add useQualiPlayback hook for ghost racing

- Interpolates all drivers to current playback time
- Handles play/pause/seek/speed controls
- Binary search for frame interpolation"
```

---

## Task 5: Frontend - Create QualiGhostRace Component

**Files:**
- Create: `frontend/src/components/QualiGhostRace.tsx`

**Step 1: Create the ghost race canvas component**

```typescript
import React, { useRef, useEffect } from "react";

interface Driver {
  code: string;
  x: number;
  y: number;
  speed: number;
  finished: boolean;
  lapTime: number;
}

interface TrackGeometry {
  centerline_x: number[];
  centerline_y: number[];
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

interface QualiGhostRaceProps {
  trackGeometry: TrackGeometry | null;
  drivers: Driver[];
  driverColors: Record<string, number[]>;
  selectedDriver: string | null;
  eliminatedDrivers: string[];
  onDriverClick: (code: string) => void;
}

export const QualiGhostRace: React.FC<QualiGhostRaceProps> = ({
  trackGeometry,
  drivers,
  driverColors,
  selectedDriver,
  eliminatedDrivers,
  onDriverClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trackGeometry) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    const xRange = trackGeometry.x_max - trackGeometry.x_min;
    const yRange = trackGeometry.y_max - trackGeometry.y_min;
    const scale = Math.min(
      (width - padding * 2) / xRange,
      (height - padding * 2) / yRange
    );

    const offsetX = (width - xRange * scale) / 2;
    const offsetY = (height - yRange * scale) / 2;

    const toCanvasX = (x: number) =>
      (x - trackGeometry.x_min) * scale + offsetX;
    const toCanvasY = (y: number) =>
      height - ((y - trackGeometry.y_min) * scale + offsetY);

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < trackGeometry.centerline_x.length; i++) {
      const x = toCanvasX(trackGeometry.centerline_x[i]);
      const y = toCanvasY(trackGeometry.centerline_y[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = "#555";
    ctx.lineWidth = 10;
    ctx.stroke();

    const sortedDrivers = [...drivers].sort((a, b) => {
      if (a.code === selectedDriver) return 1;
      if (b.code === selectedDriver) return -1;
      return 0;
    });

    for (const driver of sortedDrivers) {
      const isSelected = driver.code === selectedDriver;
      const isEliminated = eliminatedDrivers.includes(driver.code);
      const color = driverColors[driver.code] || [128, 128, 128];

      let opacity = 0.4;
      let size = 8;

      if (isSelected) {
        opacity = 1;
        size = 12;
      } else if (isEliminated) {
        opacity = 0.15;
        size = 6;
      }

      const x = toCanvasX(driver.x);
      const y = toCanvasY(driver.y);

      ctx.globalAlpha = opacity;
      ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(driver.code, x, y - size - 6);
      }
    }

    ctx.globalAlpha = 1;
  }, [trackGeometry, drivers, driverColors, selectedDriver, eliminatedDrivers]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !trackGeometry) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const padding = 40;
    const xRange = trackGeometry.x_max - trackGeometry.x_min;
    const yRange = trackGeometry.y_max - trackGeometry.y_min;
    const scale = Math.min(
      (rect.width - padding * 2) / xRange,
      (rect.height - padding * 2) / yRange
    );
    const offsetX = (rect.width - xRange * scale) / 2;
    const offsetY = (rect.height - yRange * scale) / 2;

    const toCanvasX = (x: number) =>
      (x - trackGeometry.x_min) * scale + offsetX;
    const toCanvasY = (y: number) =>
      rect.height - ((y - trackGeometry.y_min) * scale + offsetY);

    for (const driver of drivers) {
      const dx = toCanvasX(driver.x) - clickX;
      const dy = toCanvasY(driver.y) - clickY;
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        onDriverClick(driver.code);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        cursor: "pointer",
      }}
    />
  );
};
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/QualiGhostRace.tsx
git commit -m "feat: add QualiGhostRace canvas component

- Renders 2D track with driver markers
- Highlighted driver is brighter/larger
- Eliminated drivers are faded
- Click detection for driver selection"
```

---

## Task 6: Frontend - Create QualiPlaybackControls Component

**Files:**
- Create: `frontend/src/components/QualiPlaybackControls.tsx`

**Step 1: Create the playback controls component**

```typescript
import React from "react";

interface QualiPlaybackControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
}

export const QualiPlaybackControls: React.FC<QualiPlaybackControlsProps> = ({
  currentTime,
  duration,
  isPlaying,
  speed,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onStepForward,
  onStepBackward,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-black/50 border-t border-white/10">
      <button
        onClick={onStepBackward}
        className="p-2 text-white/70 hover:text-white transition-colors"
        title="Step backward"
      >
        ◀◀
      </button>

      <button
        onClick={isPlaying ? onPause : onPlay}
        className="p-3 bg-f1-red rounded-full text-white hover:bg-red-700 transition-colors"
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <button
        onClick={onStepForward}
        className="p-2 text-white/70 hover:text-white transition-colors"
        title="Step forward"
      >
        ▶▶
      </button>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-white/60 font-mono w-12">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration}
          step={0.04}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-f1-red
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #e10600 0%, #e10600 ${progress}%, rgba(255,255,255,0.2) ${progress}%, rgba(255,255,255,0.2) 100%)`,
          }}
        />

        <span className="text-xs text-white/60 font-mono w-12">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
              speed === s
                ? "bg-f1-red text-white"
                : "bg-white/10 text-white/60 hover:text-white"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/QualiPlaybackControls.tsx
git commit -m "feat: add QualiPlaybackControls component

- Play/pause button
- Speed selector (0.5x, 1x, 2x)
- Scrub bar with time display
- Frame step buttons"
```

---

## Task 7: Frontend - Create QualiLeaderboard Component

**Files:**
- Create: `frontend/src/components/QualiLeaderboard.tsx`

**Step 1: Create the leaderboard component**

```typescript
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Driver {
  code: string;
  lapTime: number;
  finished: boolean;
}

interface QualiLeaderboardProps {
  drivers: Driver[];
  driverColors: Record<string, number[]>;
  selectedDriver: string | null;
  eliminatedDrivers: string[];
  onDriverClick: (code: string) => void;
}

export const QualiLeaderboard: React.FC<QualiLeaderboardProps> = ({
  drivers,
  driverColors,
  selectedDriver,
  eliminatedDrivers,
  onDriverClick,
}) => {
  const sortedDrivers = [...drivers].sort((a, b) => a.lapTime - b.lapTime);

  const formatLapTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  };

  const fastestLap = sortedDrivers[0]?.lapTime ?? 0;

  return (
    <div className="flex flex-col gap-1 p-3 bg-black/30 rounded-lg overflow-auto max-h-full">
      <div className="text-xs text-white/50 font-mono mb-2 font-bold">
        LEADERBOARD
      </div>
      <AnimatePresence mode="popLayout">
        {sortedDrivers.map((driver, idx) => {
          const color = driverColors[driver.code] || [128, 128, 128];
          const isSelected = driver.code === selectedDriver;
          const isEliminated = eliminatedDrivers.includes(driver.code);
          const gap = idx === 0 ? null : driver.lapTime - fastestLap;

          return (
            <motion.div
              key={driver.code}
              layout
              onClick={() => onDriverClick(driver.code)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                isSelected
                  ? "bg-f1-red/30"
                  : isEliminated
                  ? "opacity-30"
                  : "hover:bg-white/10"
              }`}
              style={{
                borderLeft: `3px solid rgb(${color[0]}, ${color[1]}, ${color[2]})`,
              }}
            >
              <span
                className="text-xs font-bold font-mono w-5"
                style={{ color: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
              >
                {idx + 1}
              </span>
              <span className="text-sm font-semibold flex-1">{driver.code}</span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    idx === 0 ? "text-purple-400" : "text-white/70"
                  }`}
                >
                  {formatLapTime(driver.lapTime)}
                </div>
                {gap !== null && (
                  <div className="text-[10px] font-mono text-white/40">
                    +{(gap / 1000).toFixed(3)}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/QualiLeaderboard.tsx
git commit -m "feat: add QualiLeaderboard component

- Sorted by lap time
- Click to select driver
- Shows gap to leader
- Eliminated drivers greyed out"
```

---

## Task 8: Frontend - Create QualiSegmentTabs Component

**Files:**
- Create: `frontend/src/components/QualiSegmentTabs.tsx`

**Step 1: Create the segment tabs component**

```typescript
import React from "react";
import { QualiSegmentName } from "../types";

interface QualiSegmentTabsProps {
  activeSegment: QualiSegmentName;
  onSegmentChange: (segment: QualiSegmentName) => void;
  hasQ1: boolean;
  hasQ2: boolean;
  hasQ3: boolean;
}

export const QualiSegmentTabs: React.FC<QualiSegmentTabsProps> = ({
  activeSegment,
  onSegmentChange,
  hasQ1,
  hasQ2,
  hasQ3,
}) => {
  const tabs: { name: QualiSegmentName; label: string; available: boolean }[] = [
    { name: "Q1", label: "Q1", available: hasQ1 },
    { name: "Q2", label: "Q2", available: hasQ2 },
    { name: "Q3", label: "Q3", available: hasQ3 },
    { name: "Progressive", label: "FULL", available: hasQ1 },
  ];

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.name}
          onClick={() => tab.available && onSegmentChange(tab.name)}
          disabled={!tab.available}
          className={`px-4 py-2 text-sm font-mono font-bold rounded-t transition-colors ${
            activeSegment === tab.name
              ? "bg-f1-red text-white"
              : tab.available
              ? "bg-white/10 text-white/60 hover:text-white hover:bg-white/20"
              : "bg-white/5 text-white/20 cursor-not-allowed"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/QualiSegmentTabs.tsx
git commit -m "feat: add QualiSegmentTabs component

- Q1/Q2/Q3/Progressive tabs
- Disabled state for unavailable segments"
```

---

## Task 9: Frontend - Refactor QualiDashboard to Use New Components

**Files:**
- Modify: `frontend/src/components/QualiDashboard.tsx`

**Step 1: Replace the entire QualiDashboard component**

This is a complete rewrite. Replace the entire file content:

```typescript
import React, { useState, useMemo } from "react";
import { useReplayStore } from "../store/replayStore";
import { QualiSegmentName, QualiSegment, QualiSegments } from "../types";
import { useQualiPlayback } from "../hooks/useQualiPlayback";
import { QualiGhostRace } from "./QualiGhostRace";
import { QualiLeaderboard } from "./QualiLeaderboard";
import { QualiPlaybackControls } from "./QualiPlaybackControls";
import { QualiSegmentTabs } from "./QualiSegmentTabs";

export const QualiDashboard: React.FC = () => {
  const session = useReplayStore((state) => state.session);
  const metadata = session?.metadata;

  const [activeSegment, setActiveSegment] = useState<QualiSegmentName>("Q1");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const qualiSegments = metadata?.quali_segments as QualiSegments | undefined;
  const driverColors = metadata?.driver_colors || {};
  const trackGeometry = metadata?.track_geometry;

  const currentSegmentData: QualiSegment | null = useMemo(() => {
    if (!qualiSegments) return null;
    if (activeSegment === "Progressive") {
      return qualiSegments.Q1;
    }
    return qualiSegments[activeSegment] || null;
  }, [qualiSegments, activeSegment]);

  const {
    currentTime,
    duration,
    isPlaying,
    speed,
    drivers,
    play,
    pause,
    setSpeed,
    seek,
    stepForward,
    stepBackward,
  } = useQualiPlayback(currentSegmentData);

  const eliminatedDrivers = useMemo(() => {
    if (!qualiSegments) return [];
    const q2Drivers = new Set(Object.keys(qualiSegments.Q2?.drivers || {}));
    const q3Drivers = new Set(Object.keys(qualiSegments.Q3?.drivers || {}));

    if (activeSegment === "Q1") {
      return [];
    } else if (activeSegment === "Q2") {
      return Object.keys(qualiSegments.Q1?.drivers || {}).filter(
        (code) => !q2Drivers.has(code)
      );
    } else if (activeSegment === "Q3") {
      return Object.keys(qualiSegments.Q1?.drivers || {}).filter(
        (code) => !q3Drivers.has(code)
      );
    }
    return [];
  }, [qualiSegments, activeSegment]);

  const handleDriverClick = (code: string) => {
    setSelectedDriver((prev) => (prev === code ? null : code));
  };

  if (!metadata || !qualiSegments) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/50 font-mono">Loading qualifying data...</div>
      </div>
    );
  }

  const hasQ1 = Object.keys(qualiSegments.Q1?.drivers || {}).length > 0;
  const hasQ2 = Object.keys(qualiSegments.Q2?.drivers || {}).length > 0;
  const hasQ3 = Object.keys(qualiSegments.Q3?.drivers || {}).length > 0;

  return (
    <div className="flex flex-col h-full bg-f1-black">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-f1-red font-bold font-mono text-sm">
            QUALIFYING SESSION
          </div>
          <div className="text-white/50 text-xs font-mono">
            {metadata.year} Round {metadata.round}
          </div>
        </div>
        <QualiSegmentTabs
          activeSegment={activeSegment}
          onSegmentChange={setActiveSegment}
          hasQ1={hasQ1}
          hasQ2={hasQ2}
          hasQ3={hasQ3}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-white/10 overflow-hidden">
          <QualiLeaderboard
            drivers={drivers}
            driverColors={driverColors}
            selectedDriver={selectedDriver}
            eliminatedDrivers={eliminatedDrivers}
            onDriverClick={handleDriverClick}
          />
        </div>

        <div className="flex-1 relative">
          <QualiGhostRace
            trackGeometry={trackGeometry}
            drivers={drivers}
            driverColors={driverColors}
            selectedDriver={selectedDriver}
            eliminatedDrivers={eliminatedDrivers}
            onDriverClick={handleDriverClick}
          />

          {selectedDriver && (
            <div className="absolute top-4 right-4 bg-black/80 border border-white/20 rounded-lg p-4 w-48">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold font-mono">{selectedDriver}</span>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {(() => {
                const d = drivers.find((d) => d.code === selectedDriver);
                if (!d) return null;
                return (
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-white/50">Speed</span>
                      <span>{d.speed.toFixed(0)} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Gear</span>
                      <span>{d.gear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Throttle</span>
                      <span>{d.throttle.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Brake</span>
                      <span>{d.brake.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <QualiPlaybackControls
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onSpeedChange={setSpeed}
        onStepForward={stepForward}
        onStepBackward={stepBackward}
      />
    </div>
  );
};
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`

Expected: No errors (may need to fix import paths)

**Step 3: Build and verify**

Run: `cd frontend && npm run build`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/components/QualiDashboard.tsx
git commit -m "refactor: complete QualiDashboard rewrite for ghost racing

- Uses new segment-based data structure
- Ghost race visualization with driver markers
- Leaderboard with click-to-select
- Playback controls with scrub bar
- Segment tabs (Q1/Q2/Q3/Progressive)
- Selected driver telemetry panel"
```

---

## Task 10: Integration Test - Full Stack Verification

**Step 1: Clear old cache and start backend**

```bash
rm -f computed_data/*quali*.pkl
python backend/main.py
```

**Step 2: Start frontend dev server**

In another terminal:
```bash
cd frontend && npm run dev
```

**Step 3: Test in browser**

1. Open http://localhost:5173
2. Select 2025 Australian GP
3. Select Qualifying
4. Verify:
   - Track renders with driver dots
   - Leaderboard shows all Q1 drivers sorted by time
   - Click play - drivers animate around track
   - Click driver - highlights on track, telemetry panel shows
   - Switch Q1/Q2/Q3 tabs - different drivers shown
   - Scrub bar works
   - Speed controls work

**Step 4: Final commit if all works**

```bash
git add -A
git commit -m "feat: complete QualiDashboard ghost racing Phase 1

Phase 1 implementation complete:
- Ghost racing visualization with all drivers
- Segment tabs (Q1/Q2/Q3)
- Playback controls with speed/scrub
- Driver selection with telemetry panel
- Eliminated driver styling"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Backend data restructure | f1_data.py |
| 2 | Update replay_service | replay_service.py |
| 3 | Add TypeScript types | types.ts |
| 4 | Create playback hook | useQualiPlayback.ts |
| 5 | Create ghost race component | QualiGhostRace.tsx |
| 6 | Create playback controls | QualiPlaybackControls.tsx |
| 7 | Create leaderboard | QualiLeaderboard.tsx |
| 8 | Create segment tabs | QualiSegmentTabs.tsx |
| 9 | Refactor dashboard | QualiDashboard.tsx |
| 10 | Integration test | - |

Total: 10 tasks, ~14 hours estimated
