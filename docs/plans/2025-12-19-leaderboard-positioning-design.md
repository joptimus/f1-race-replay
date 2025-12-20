# Leaderboard Positioning System Design
**Date**: 2025-12-19
**Status**: Design Review (Updated with Consolidated Feedback)
**Goal**: Implement reliable, flicker-free position calculations using a tiered data hierarchy (lap anchors → stream timing → race_progress → hysteresis).

---

## Executive Summary: Consolidated Strategy (CORRECTED)

We're implementing a **4-tier hierarchy** with **continuous-signal smoothing**:

1. **Tier 0 – Lap Anchor**: `Session.laps.Position` at lap completion (periodic validation)
2. **Tier 0.5 – Stream Position**: `timing_data()[1].stream_data['Position']` (PRIMARY FIA authority, ~240ms updates)
3. **Tier 2 – Race Progress**: Lap-aware distance calculation (physics backup)
4. **Tier 3 – Hysteresis**: UI smoothing layer (2-frame confirmation, time-based threshold)

**Critical rules**:
1. **Smooth `IntervalToPositionAhead`, NOT `GapToLeader`** (leader changes spike GapToLeader)
2. **Smooth continuous signals (intervals, distance) BEFORE sorting** – never smooth integer positions
3. **Use FIA stream position as primary sort key** (not lap boundaries)
4. **Freeze race_progress during pit stops** (pit lanes are shorter; prevents ghost overtakes)
5. **Convert timedelta to seconds ONCE** (avoid repeated conversions)
6. **Disable hysteresis during SC/VSC/Red** (safety car needs immediate position updates)

---

## 1. Data Source Documentation (FastF1 API)

### 1.1 Position Data Sources (4-Tier Hierarchy)

#### **Tier 0 – Lap Anchor (Legal Truth)**: `Session.laps.Position`
- **What it is**: Official position recorded by FIA at the END of each completed lap
- **Access method**:
  ```python
  # During lap iteration in _process_single_driver()
  lap.Position  # From each lap object
  ```
- **Characteristics**:
  - **Most authoritative** – represents the official leaderboard at lap boundary
  - Only available after lap completion (discrete, not continuous)
  - NaN for incomplete/invalid laps
  - **Our use**: Anchor point to reset/validate leaderboard at each lap end
  - Prevents long-term drift if Tier 1-2 data diverges

#### **Tier 0.5 – Stream Timing (Live Truth)**: `fastf1.api.timing_data()[1]`
- **What it is**: High-frequency FIA timing tower updates (~240ms resolution), NOT lap-level
- **Access method** (CORRECTED):
  ```python
  laps_data, stream_data = fastf1.api.timing_data(session.api_path)
  # stream_data is ONE DataFrame with columns: Time, Driver, Position, GapToLeader, IntervalToPositionAhead
  # NOT a dict keyed by driver

  # Filter by driver:
  driver_stream = stream_data[stream_data["Driver"] == "HAM"]

  # Or iterate:
  for driver_code, driver_df in stream_data.groupby("Driver"):
      position = driver_df["Position"].values
      gap = driver_df["GapToLeader"].dt.total_seconds().values  # Convert timedelta!
  ```
- **DataFrame structure**:
  - **Index**: (auto-incrementing or by time)
  - **Columns**: `Time` (timestamp), `Driver` (str), `Position` (int), `GapToLeader` (timedelta), `IntervalToPositionAhead` (timedelta)
  - **Values**: Position (1-20 or NaN), GapToLeader (seconds), IntervalToPositionAhead (seconds)
  - **Frequency**: ~240ms updates (not 1-2 Hz)
- **Characteristics**:
  - **Primary source for live FIA positioning** between lap boundaries
  - Position updated from FIA timing tower ~4 times per second
  - `GapToLeader` spikes when leader changes → SMOOTH `IntervalToPositionAhead` INSTEAD
  - May have NaN gaps during early race, pit stops, or safety car periods
  - **CRITICAL**: Use `IntervalToPositionAhead` for smoothing, NOT `GapToLeader` (leader changes cause spikes)

#### **Tier 2 – Race Progress (Physics Backup)**: Derived from telemetry
- **What it is**: Distance-based position derived from GPS/telemetry
- **Access method**:
  ```python
  # Built during telemetry processing:
  race_progress = cumulative_lap_distance + (current_lap_distance * lap_number)
  # Computed and validated in lines 582-613 of f1_data.py
  ```
- **Characteristics**:
  - High temporal resolution (~0.01-0.1 second from GPS)
  - Monotonically increasing (can't go backward on track)
  - Used when Tier 0-1 data missing or clearly inconsistent
  - **IMPORTANT**: Distance has integration error; used only as fallback, not primary
  - Provides continuous physics-based ordering for all drivers

#### **Tier 3 – Hysteresis (UI Safety Net)**: Position smoothing layer
- **What it is**: Prevents single-frame position oscillations without blocking real overtakes
- **Mechanism**: Only allow position swap if gap/distance difference exceeds threshold (~5m)
- **Used when**: Tier 1 timing data is jittery or sparse
- **Characteristics**:
  - Applied AFTER sorting (never smooth integer positions directly)
  - Works on continuous signals (GapToLeader, race_progress)

### 1.2 Gap Data Sources

#### **Primary: GapToLeader** (`session.timing_data`)
- **What it is**: Time gap to the race leader at each timing point
- **Access method**:
  ```python
  timing_gap_df = timing.pivot(index="Date", columns="Driver", values="GapToLeader")
  ```
- **DataFrame structure**: Same as Position (Date index, Driver columns, float values in seconds)
- **Characteristics**:
  - Also updated throughout race
  - May have NaN gaps during early race or when driver is leading

#### **Fallback: Calculated from Distance**
- Computed as: `gap_time = distance_diff / speed_mps` (implemented in `_calculate_gaps()`)
- Only used if timing gap data is unavailable

### 1.3 Critical Edge Cases

#### **A. Lap 1 / Race Start**
- **Problem**: `Session.laps.Position` doesn't help until drivers complete Lap 1
- **Strategy**:
  - For Lap 1: rely heavily on **Tier 1 stream_data.Position + gaps**
  - Use **Tier 2 race_progress** as backup when entries missing
  - Once first lap completes: "snap" to **Tier 0 lap anchor** and resume normal hierarchy
- **Code implication**: Don't wait for lap completion; use stream timing immediately at race start

#### **B. DNFs, Crashes, Retirements (Ghost Overtakes)**
- **Problem**: Retired car can "fall" through field as others pass in distance-based mode (ghost overtake)
- **Strategy**:
  - Use FastF1 flags: `IsAccurate`, `FastF1Generated`, status info from laps/timing
  - When DNF/retirement confirmed: immediately move driver to **Retired section** in tower
  - Stop re-sorting retired drivers in active positions (no drifting P13 → P20)
  - Mark driver status as "Retired" and remove from active leaderboard
- **Code implication**: Add retirement detection logic before sorting; check for zero speed + IsAccurate=False

#### **C. Pit Stops (Position Loss & Gain) — CRITICAL PIT LANE BUG**
- **Problem**: Pit lanes are physically shorter than main straight
  - Car in pit can appear ahead in `race_progress` despite being behind on track
  - Creates "ghost overtakes" where pit-stopping car shows ahead, then drops back
- **Strategy**:
  - **MUST USE STREAM POSITION** (Tier 0.5), NOT distance-based ordering during pits
  - Detect pit stops via `Status == "InPit"` from `timing_app_data` or pit lane coordinates
  - **FREEZE race_progress** while in pit lane (or cap at pit entry value)
  - Hysteresis (Tier 3) prevents flicker during pit entry/exit
  - Lap anchor (Tier 0) validates position after pit exit completes
- **Code implication**:
  ```python
  # Detect pit stops
  def is_in_pitlane(pos_sample, circuit_info):
      pit_entry = circuit_info.pit_entry
      pit_exit = circuit_info.pit_exit
      return pit_entry_x < pos_sample.x < pit_exit_x  # Simplified

  # Freeze distance in pit
  if is_in_pitlane(current_pos, circuit):
      race_progress[i] = race_progress[pit_entry_frame]  # Stay at pit entry distance
  ```
  - Always prefer `stream_data.Position` during pit stops over distance-based order

### 1.4 Track Status Awareness (SC/VSC/Red Flag)

**Critical**: Position smoothing must be disabled during safety car periods.

**Access method**:
```python
track_status = fastf1.api.track_status_data(session.api_path)
# Returns DataFrame with columns: Time, Status (str), Message (str)
# Status codes:
#   '1' = AllClear/Green
#   '4' = Safety Car
#   '6' = Virtual Safety Car
#   '7' = Red Flag
```

**Integration points**:
- **Disable hysteresis** during SC/VSC/Red (Status in ['4','6','7'])
- **Use stream Position directly** (no smoothing artifacts)
- **Reset hysteresis state** when track status changes
- **Allow immediate position updates** for actual overtakes

**Code pattern**:
```python
track_status_df = fastf1.api.track_status_data(session.api_path)

# Resample to animation timeline
track_status_resampled = track_status_df.set_index('Time').reindex(abs_timeline, method='ffill')
current_status = track_status_resampled.loc[t_abs, 'Status']

# In frame loop:
if current_status in ['4', '6', '7']:  # SC/VSC/Red
    position_smoother.disable()  # Or skip hysteresis application
else:
    position_smoother.enable()
```

### 1.5 Data Stream Resampling Alignment

**Critical**: pos_data (X/Y coordinates) and stream_data (gaps/positions) sample at different rates and times.

**Problem**:
- `pos_data` from GPS ~100 Hz (X, Y, Z coordinates)
- `stream_data` from FIA ~4 Hz (Position, gaps, timing)
- Direct merge causes misalignment → race_progress doesn't sync with gaps

**Solution**: Resample to common timebase before merging:

```python
def align_position_and_timing(session, target_freq='250ms'):
    """
    Align pos_data (X/Y) with stream_data (gaps/positions).

    Returns:
        dict mapping driver_num -> aligned DataFrame with both streams
    """
    aligned_data = {}
    stream_data = get_stream_timing(session)  # Use adapter

    for driver_num in session.drivers:
        # Get position data (X, Y, Z from GPS)
        pos_df = session.pos_data.get(driver_num, None)
        if pos_df is None or pos_df.empty:
            continue

        # Get timing data for this driver (Position, gaps)
        driver_code = session.get_driver(driver_num)["Abbreviation"]
        stream_df = stream_data[stream_data["Driver"] == driver_code]

        if stream_df.empty:
            continue

        # Resample both to common frequency (250ms = 4 Hz)
        pos_resampled = pos_df.set_index('Time').resample(target_freq).interpolate()
        stream_resampled = stream_df.set_index('Time').resample(target_freq).ffill()

        # Merge on aligned timestamps
        aligned = pd.merge(
            pos_resampled,
            stream_resampled,
            left_index=True,
            right_index=True,
            how='inner'
        )

        aligned_data[driver_num] = aligned

    return aligned_data
```

### 1.6 Race Start Alignment

**Critical Issue**: Timing data and telemetry data have different time references.
- **Telemetry time**: Seconds from first data point (varies by driver)
- **Timing data time**: Absolute session seconds from session start

**Solution implemented** (lines 409-421):
```python
abs_timeline = timeline + global_t_min  # Convert animation timeline to absolute session time
timing_gap_df = timing_gap_df.reindex(abs_timeline, method="nearest", tolerance=0.25)
timing_pos_df = timing_pos_df.reindex(abs_timeline, method="nearest", tolerance=0.25)
```

---

## 2. Current System Analysis

### 2.1 How Positions Are Currently Calculated

**Location**: [shared/telemetry/f1_data.py:711-722](../shared/telemetry/f1_data.py#L711-L722)

```python
def sort_key(code):
    c = frame_data_raw[code]
    pos_val = c["pos_raw"] if c["pos_raw"] > 0 else 9999
    gap_val = c["gap"] if c["gap"] is not None else 9999
    dist_val = c["dist"] if not np.isnan(c["dist"]) else -9999
    return (pos_val, gap_val, -dist_val)

sorted_codes = sorted(active_codes, key=sort_key) + out_codes
```

**How frame_data_raw is populated** (lines 657-669):
```python
if timing_gap_df is not None and timing_pos_df is not None:
    try:
        gap = timing_gap_df.at[t_abs, code]
        pos = timing_pos_df.at[t_abs, code]
        frame_data_raw[code]["gap"] = float(gap) if not pd.isna(gap) else None
        frame_data_raw[code]["pos_raw"] = int(pos) if not pd.isna(pos) else 0
    except (KeyError, TypeError):
        frame_data_raw[code]["gap"] = None
        frame_data_raw[code]["pos_raw"] = 0
```

### 2.2 Root Cause of Leaderboard Instability

**Observed behavior** (from debug_telemetry.log):
- **Frame 0** (t=0.00s): Order is `[HUL, ALB, ALO, PIA, STR, ...]` (random shuffle)
- **Frame 50** (t=2.00s): Order becomes `[NOR, ALO, PIA, GAS, HAM, ...]` (rearranges)
- **Frame 100+**: Settles into more stable order

**Why this happens**:
1. Early in the race (frames 0-50), FIA timing position data is sparse/NaN
2. When `pos_raw = 0`, it becomes `pos_val = 9999` (fallback tier)
3. Most drivers hit the fallback, so sorting relies on `gap_val` and `dist_val`
4. These are inconsistent/missing at race start, causing random ordering
5. As race progresses, FIA timing data becomes available and stable

**Key insight from FastF1 docs**: Position field is NaN for "FP1, FP2, FP3, Sprint Shootout, and Qualifying." It's designed for race sessions specifically, but even in races, early data is sparse.

---

## 3. API Isolation Layer (Phase 0 – Foundation)

**Critical**: FastF1 marks `fastf1.api` as "will be private." Create adapters to isolate changes.

**New file**: `shared/telemetry/fastf1_adapter.py`

```python
"""
Adapter layer for FastF1 API calls.

Isolates FastF1 API usage to enable future upgrades without code changes.
All timedelta conversion happens here (once, not per-frame).
"""

import fastf1
import pandas as pd

def get_stream_timing(session):
    """
    Adapter: Get stream-level timing data (FIA tower updates ~240ms).

    Returns:
        DataFrame with columns: Time, Driver, Position, GapToLeader, IntervalToPositionAhead
    """
    laps_data, stream_data = fastf1.api.timing_data(session.api_path)

    # Convert Timedelta → seconds ONCE (not per-frame)
    stream_data["GapToLeader_s"] = stream_data["GapToLeader"].dt.total_seconds()
    stream_data["Interval_s"] = stream_data["IntervalToPositionAhead"].dt.total_seconds()

    return stream_data


def get_lap_timing(session):
    """
    Adapter: Get lap-level timing data with LapNumber.

    Returns:
        DataFrame with lap positions and timing info
    """
    return fastf1.api.timing_app_data(session.api_path)


def get_track_status(session):
    """
    Adapter: Get track status (SC/VSC/Red Flag detection).

    Returns:
        DataFrame with columns: Time, Status (str), Message (str)
        Status codes: '1'=Green, '4'=SC, '6'=VSC, '7'=Red
    """
    return fastf1.api.track_status_data(session.api_path)


def get_position_data(session):
    """
    Adapter: Get GPS position data (X, Y, Z coordinates).

    Returns:
        dict mapping driver_num -> DataFrame with X, Y, Z, Time columns
    """
    return session.pos_data
```

**Integration**: Replace all FastF1 API calls in `f1_data.py` with adapter functions.

```python
# OLD (in f1_data.py):
laps_data, stream_data = fastf1.api.timing_data(session.api_path)

# NEW:
from shared.telemetry.fastf1_adapter import get_stream_timing
stream_data = get_stream_timing(session)
```

---

## 4. Proposed Solution: 4-Tier Hierarchy Implementation

### 3.1 Tier 0 Integration: Lap Anchor Validation

**Location**: [shared/telemetry/f1_data.py, during frame generation]

After sorting each frame, check if any driver just completed a lap:

```python
def _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries):
    """
    Validate leaderboard against Tier 0 lap anchors.

    If multiple drivers completed a lap at current frame, snap to their official positions.
    This prevents long-term drift in the leaderboard.
    """
    # lap_boundaries: dict mapping driver_code -> list of (frame_index, official_position)
    # Pre-computed during telemetry processing

    lap_snap_corrections = {}
    for code in sorted_codes:
        if code in lap_boundaries and frame_data_raw[code]["lap"] in lap_boundaries[code]:
            official_pos = lap_boundaries[code][frame_data_raw[code]["lap"]]
            lap_snap_corrections[code] = official_pos

    # Apply corrections: re-sort by official position where lap completed
    if lap_snap_corrections:
        def snap_sort_key(code):
            if code in lap_snap_corrections:
                return (0, lap_snap_corrections[code])  # Highest priority
            else:
                return (1, sorted_codes.index(code))  # Keep other order

        sorted_codes = sorted(sorted_codes, key=snap_sort_key)

    return sorted_codes
```

**Integration point** (in frame loop, before position assignment):
```python
sorted_codes = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
```

### 3.2 Tier 0.5 + Tier 2: Improved Sort Key with Stream Position

**Change location**: [shared/telemetry/f1_data.py:713-720]

```python
def sort_key_hybrid(code):
    """
    Tiered sort key: FIA stream position is primary authority.

    CRITICAL:
    - Stream Position from FIA timing tower is TIER 0.5 (most reliable)
    - Smoothed Interval gap is tie-breaker
    - Distance is fallback only
    - Sorting operates on FIA positions + smoothed continuous signals
    """
    c = frame_data_raw[code]

    # TIER 0.5: FIA Stream Position (primary authority, ~240ms updates)
    # This comes from session.timing_data().stream_data['Position']
    # Most reliable, authoritative source
    stream_pos = c.get("stream_position", 9999)
    if stream_pos is None or stream_pos <= 0:
        stream_pos = 9999

    # TIER 0.5 (tie-breaker): Smoothed IntervalToPositionAhead
    # Use interval (gap to car ahead), NOT GapToLeader (which spikes on leader change)
    # Provides granular tie-breaking without leader-change artifacts
    interval_smooth = c.get("interval_smooth", 9999)
    if interval_smooth is None:
        interval_smooth = 9999

    # TIER 2: Lap-Aware Race Progress (distance-based, physics backup)
    # Only used if stream position completely unavailable
    # race_progress = lap_number * track_length + current_lap_distance
    race_progress = c.get("race_progress", -9999)
    if np.isnan(race_progress):
        race_progress = -9999

    # Return tuple: lower values sort first
    # Negating race_progress ensures higher distance = earlier in sort
    return (stream_pos, interval_smooth, -race_progress)
```

**Why this approach (CORRECTED from previous)**:
- **Stream Position is Tier 0.5, not Tier 1** – it's THE FIA authority (not just lap results)
- **Smooth IntervalToPositionAhead, NOT GapToLeader** – leader changes cause GapToLeader spikes
- **race_progress must be lap-aware** – `lap_number * track_length + distance_in_lap`
- **Sort operates on FIA authority first, gaps second, distance last** – proper hierarchy
- Never smooth integer positions; only smooth continuous signals before sorting

### 3.3 Continuous Signal Smoothing (Before Sorting)

**Location**: [shared/telemetry/f1_data.py, before frame loop]

**CRITICAL**: Smooth `IntervalToPositionAhead`, NOT `GapToLeader`

- **GapToLeader** spikes when leader changes (new reference point) → causes leaderboard smearing
- **IntervalToPositionAhead** (gap to car immediately ahead) is stable → safe to smooth

```python
from scipy.signal import savgol_filter
import numpy as np

def _smooth_interval_data(stream_data, window_length=7, polyorder=2):
    """
    Smooth IntervalToPositionAhead using Savitzky-Golay filter.

    IMPORTANT DISTINCTION:
    - GapToLeader: Spikes on leader change (unreliable for smoothing)
    - IntervalToPositionAhead: Gap to car ahead (stable, safe to smooth)

    Args:
        stream_data: DataFrame from fastf1.api.timing_data()[1]
                    with columns: Time, Driver, Position, IntervalToPositionAhead
        window_length: Filter window (must be odd, >= polyorder + 1)
        polyorder: Polynomial order (2 is typical)

    Returns:
        DataFrame with smoothed intervals in new column 'Interval_smooth'
    """
    if stream_data is None or stream_data.empty:
        return stream_data

    smoothed = stream_data.copy()

    # Convert timedelta to seconds ONCE (avoid repeated conversions)
    intervals_s = stream_data["IntervalToPositionAhead"].dt.total_seconds().values

    for driver_code, driver_df in stream_data.groupby("Driver"):
        driver_intervals = intervals_s[driver_df.index]
        valid_mask = ~np.isnan(driver_intervals)

        if valid_mask.sum() > polyorder:
            try:
                smoothed_intervals = driver_intervals.copy()
                smoothed_intervals[valid_mask] = savgol_filter(
                    driver_intervals[valid_mask],
                    window_length=min(window_length, valid_mask.sum() // 2 * 2 - 1),
                    polyorder=polyorder
                )
                smoothed.loc[driver_df.index, "Interval_smooth"] = smoothed_intervals
            except Exception as e:
                print(f"Warning: Could not smooth interval data for {driver_code}: {e}")

    return smoothed
```

**Integration point** (after loading stream_data):
```python
# Get stream timing data
laps_data, stream_data = fastf1.api.timing_data(session.api_path)

# Convert timedelta columns to seconds (do once)
stream_data["GapToLeader_s"] = stream_data["GapToLeader"].dt.total_seconds()
stream_data["Interval_s"] = stream_data["IntervalToPositionAhead"].dt.total_seconds()

# Smooth intervals (not gaps!)
stream_data = _smooth_interval_data(stream_data)
print(f"Applied Savitzky-Golay smoothing to IntervalToPositionAhead data")
```

**Why smooth IntervalToPositionAhead, not GapToLeader**:
- When leader pits/crashes, GapToLeader jumps 5+ seconds instantly → Savitzky-Golay interprets as overtake
- IntervalToPositionAhead (gap to car ahead) is continuous and stable
- Prevents 11-frame leaderboard smearing from leader change spike
- Only smooth continuous signals → derive positions by sorting
- Never smooth integer positions directly (creates garbage)

### 3.4 Position Hysteresis (Final UI Layer – TIME-BASED)

**Add new class** before `get_race_telemetry()`:

**CRITICAL FIX**: Use **TIME-BASED threshold** (not distance-based).

Why distance fails:
- At 300 km/h: 5m = 0.06s (allows jitter)
- At 60 km/h: 5m = 0.3s (blocks real overtakes)

```python
from collections import defaultdict

class PositionSmoothing:
    """Prevent single-frame position oscillations (time-based, track-status aware)"""

    def __init__(self, time_threshold_s=1.0):
        """
        Args:
            time_threshold_s: Minimum time gap (seconds) to allow swap.
                             1.0s is robust across all speeds.
        """
        self.previous_order = []
        self.swap_candidates = defaultdict(int)  # Track confirmation count
        self.time_threshold = time_threshold_s
        self.enabled = True

    def disable(self):
        """Disable during SC/VSC/Red Flag (allow instant updates)"""
        self.enabled = False
        self.previous_order = []
        self.swap_candidates.clear()

    def enable(self):
        """Re-enable after track clears"""
        self.enabled = True

    def apply(self, sorted_codes, frame_data_raw):
        """
        Smooth positions with 2-frame confirmation on time gaps.

        Args:
            sorted_codes: Current frame's sorted order (from sort_key_hybrid)
            frame_data_raw: Raw data with interval_smooth values

        Returns:
            Smoothed driver order, or original if no history
        """
        # If disabled (SC/VSC), return raw order and reset state
        if not self.enabled:
            self.previous_order = list(sorted_codes)
            self.swap_candidates.clear()
            return sorted_codes

        if not self.previous_order:
            self.previous_order = list(sorted_codes)
            return sorted_codes

        smoothed_order = list(self.previous_order)
        current_order = list(sorted_codes)

        # Check each position for changes
        for i in range(len(current_order)):
            if i >= len(smoothed_order):
                smoothed_order.append(current_order[i])
                continue

            current_code = current_order[i]
            previous_code = smoothed_order[i]

            # Same driver, no change needed
            if current_code == previous_code:
                self.swap_candidates.pop((i, current_code), None)
                continue

            # Different driver - check TIME gap (not distance)
            current_interval = frame_data_raw[current_code].get("interval_smooth", 9999)
            previous_interval = frame_data_raw[previous_code].get("interval_smooth", 9999)

            # Handle NaN/missing data
            if current_interval is None or previous_interval is None:
                current_interval = frame_data_raw[current_code].get("gap_smoothed", 9999)
                previous_interval = frame_data_raw[previous_code].get("gap_smoothed", 9999)

            gap_diff = abs(current_interval - previous_interval) if (
                current_interval != 9999 and previous_interval != 9999
            ) else 0

            swap_key = (i, current_code)

            # Time-based threshold check
            if gap_diff >= self.time_threshold:
                self.swap_candidates[swap_key] += 1
                # Require 2-frame confirmation (prevents single-frame jitter)
                if self.swap_candidates[swap_key] >= 2:
                    smoothed_order[i] = current_code
                    self.swap_candidates.pop(swap_key, None)
            else:
                # Gap below threshold, reset confirmation count
                self.swap_candidates[swap_key] = 0

        self.previous_order = smoothed_order
        return smoothed_order
```

**Integration point** (in frame loop, after sorting):
```python
sorted_codes_raw = sorted(active_codes, key=sort_key_hybrid)
sorted_codes = position_smoother.apply(sorted_codes_raw, frame_data_raw)
```

**Track status integration** (in frame loop):
```python
current_track_status = track_status_resampled.loc[t_abs, 'Status']

if current_track_status in ['4', '6', '7']:  # SC/VSC/Red
    position_smoother.disable()
else:
    position_smoother.enable()

sorted_codes = position_smoother.apply(sorted_codes_raw, frame_data_raw)
```

**Where to instantiate** (before frame loop in `get_race_telemetry()`):
```python
position_smoother = PositionSmoothing(time_threshold_s=1.0)  # 1 second = robust threshold
```

### 3.5 Retirement Detection (Anti-Ghost-Overtake)

**Location**: [shared/telemetry/f1_data.py, in frame generation loop]

Prevent "ghost overtakes" by detecting when a car is truly retired:

```python
def _detect_retirement(code, frame_data_raw, driver_arrays, i, RETIREMENT_THRESHOLD=10):
    """
    Determine if driver is retired based on multiple signals.

    Checks:
    1. Zero speed for extended period (current method)
    2. FastF1 IsAccurate flag (driver still on track and providing valid data?)
    3. Status from final results

    Returns: bool (is_retired)
    """
    d = driver_arrays[code]
    speed = frame_data_raw[code]["speed"]

    # Already detected as retired earlier (speed=0 for 10+ seconds)
    if frame_data_raw[code]["status"] == "Retired":
        return True

    # TODO: Check IsAccurate flag when available from session data
    # if not d["is_accurate"][i]:
    #     return True

    # If no other signals, default to speed-based detection
    return False
```

**Integration point** (in frame loop, before sorting):
```python
# Update retirement status more robustly
for code in driver_codes:
    if _detect_retirement(code, frame_data_raw, driver_arrays, i):
        frame_data_raw[code]["status"] = "Retired"

# Then separate active from retired BEFORE sorting
active_codes = [c for c in driver_codes if frame_data_raw[c]["status"] != "Retired"]
retired_codes = [c for c in driver_codes if frame_data_raw[c]["status"] == "Retired"]
```

**Effect**: Retired drivers are sorted to the bottom and stay there, never re-entering the active leaderboard.

### 3.6 Timing Data Completeness Check

**Add new function** before `get_race_telemetry()`:

```python
def _check_timing_data_coverage(timing_pos_df, required_coverage=0.8):
    """
    Verify that timing position data is sufficiently populated.

    Args:
        timing_pos_df: DataFrame with Position data (Date index, Driver columns)
        required_coverage: Minimum % of non-NaN values (default 80%)

    Returns:
        tuple: (is_sufficient: bool, coverage_percent: float)
    """
    if timing_pos_df is None:
        return False, 0.0

    # Count valid (non-NaN) cells across all timestamps and drivers
    total_cells = timing_pos_df.shape[0] * timing_pos_df.shape[1]
    valid_cells = timing_pos_df.notna().sum().sum()
    coverage = valid_cells / total_cells if total_cells > 0 else 0.0

    is_sufficient = coverage >= required_coverage
    return is_sufficient, coverage
```

**Integration point** (after line 416, post-resampling):
```python
if timing_pos_df is not None:
    has_good_timing, coverage = _check_timing_data_coverage(timing_pos_df)
    if not has_good_timing:
        print(f"⚠️  WARNING: Timing position data coverage only {coverage:.1%}.")
        print(f"    Falling back to distance-based ordering for this session.")
        timing_gap_df = None
        timing_pos_df = None
else:
    print("ℹ️  No FIA timing data available. Using distance-based ordering.")
```

---

## 4. Data Flow Diagram (4-Tier Hierarchy)

```
┌──────────────────────────────────────────────────────┐
│ FastF1 Data Sources                                  │
├──────────────────────────────────────────────────────┤
│ - session.laps (Tier 0: Lap Position)                │
│ - session.timing_data()[1] (Tier 1: Stream)          │
│ - session.get_telemetry() (Tier 2: GPS/distance)     │
└──────────────────────────┬───────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │ Extract & Resample to Timeline      │
        │ (0.04s @ 25 FPS)                   │
        │ - timing_pos_df (Position)          │
        │ - timing_gap_df (GapToLeader)       │
        │ - race_progress (distance-based)    │
        │ - lap_positions (per lap, Tier 0)   │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ SMOOTHING PHASE (on continuous signals)│
        │ Apply Savitzky-Golay to:               │
        │ - GapToLeader (Tier 1)                 │
        │ - race_progress (Tier 2, optional)     │
        │ ✓ NOT to integer positions             │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ Per frame: Build frame_data_raw         │
        │ With smoothed: gap_smoothed,            │
        │ race_progress, pos_raw, status          │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ Detect Retirements (before sort)        │
        │ Separate active_codes, retired_codes    │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ SORTING PHASE (on smoothed signals)     │
        │ sort_key_hybrid():                      │
        │ (pos_val, gap_smoothed, -race_progress)│
        │ → sorted_codes_raw                      │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ Apply Hysteresis (Tier 3)               │
        │ Only swap positions if gap > 5m         │
        │ → sorted_codes (smoothed)               │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ Apply Lap Anchor (Tier 0)               │
        │ If lap just completed, snap to official │
        │ position from Session.laps              │
        └──────────────────┬──────────────────────┘
                           │
        ┌──────────────────▼──────────────────────┐
        │ Assign Positions (1, 2, 3, ...)         │
        │ Build final frame payload               │
        │ Send to frontend                        │
        └──────────────────────────────────────────┘
```

---

## 5. Implementation Checklist (Phase by Phase)

### Phase 1: Continuous Signal Smoothing
- [ ] Add `_smooth_gap_data()` function (Savitzky-Golay on gaps)
- [ ] Import scipy.signal.savgol_filter
- [ ] Apply smoothing to `timing_gap_df` after resampling
- [ ] Store smoothed gaps as `gap_smoothed` in frame_data_raw

### Phase 2: Improved Sorting with Continuous Signals
- [ ] Replace `sort_key()` with `sort_key_hybrid()`
- [ ] Update sort key to use `gap_smoothed` (Tier 1) and `race_progress` (Tier 2)
- [ ] Ensure sort operates on smoothed continuous data, not integer positions
- [ ] Test early-race stability (frames 0-100)

### Phase 3: Hysteresis Layer (UI Noise Rejection)
- [ ] Add `PositionSmoothing` class
- [ ] Implement 5m hysteresis threshold
- [ ] Instantiate `position_smoother` at frame loop start (line ~600)
- [ ] Apply smoothing after sorting: `sorted_codes = position_smoother.apply(...)`

### Phase 4: Lap Anchor Validation (Tier 0)
- [ ] Add `_apply_lap_anchor()` function
- [ ] Pre-compute lap boundaries during telemetry processing
- [ ] Apply lap snapping in frame loop after sorting (before position assignment)
- [ ] Test at lap boundaries to ensure snap behavior is smooth

### Phase 5: Retirement Detection (Anti-Ghost)
- [ ] Add `_detect_retirement()` function
- [ ] Call before sorting to separate active/retired drivers
- [ ] Ensure retired drivers never re-enter active leaderboard
- [ ] Test with known DNF/retirement sessions

### Phase 6: Fallback & Error Handling (Per-Frame Logic)
- [ ] **Remove session-wide coverage gates** (too coarse-grained)
- [ ] Implement per-frame, per-driver fallback:
  ```python
  # For each driver in each frame:
  if stream_data[driver].Position is NaN or None:
      use race_progress  # Fallback for this driver only
  else:
      use stream_Position  # Primary (always prefer FIA data when available)
  ```
- [ ] Log diagnostic warnings: "Driver X using distance at frame Y (missing stream position)"
- [ ] **Keep `_check_timing_data_coverage()` for diagnostics only** (logging, not behavior)
- [ ] **Never disable timing globally** unless SessionNotAvailableError
- [ ] Add logging level control (verbose/warning/error)

### Phase 7: Testing & Validation (DETAILED)

**Automated Unit Tests:**
- [ ] Frame 0: Order matches grid positions (±1 for first-corner acceleration)
- [ ] Frame 50: Smooth transition from grid (no random reshuffles)
- [ ] Lap boundaries: Positions match Session.laps.Position (±0.5s)
- [ ] Overtake detection: Single-frame position changes visible, no oscillation
- [ ] DNF test: Retired drivers locked at bottom, never re-enter
- [ ] Pit stop test: No "ghost overtakes" (car in pit shows ahead momentarily)
- [ ] SC/VSC test: No position oscillations during safety car periods
- [ ] Red flag test: Correct handling at race restart
- [ ] Final classification: Order matches Session.results exactly
- [ ] Resampling validation: pos_data (GPS) aligns with stream_data (gaps)
- [ ] Adapter layer: All FastF1 calls go through `fastf1_adapter.py`
- [ ] Fallback logging: Detect and log per-frame fallback events

**Manual Validation (Real Races):**
- [ ] 2024 Abu Dhabi GP: Complex SC restart with position changes
- [ ] 2024 Monaco GP: Heavy traffic, multiple pit stops, no "ghosts"
- [ ] 2024 Brazil Sprint: Rapid position changes, wet conditions
- [ ] 2024 Silverstone: Long straight overtakes
- [ ] Compare at 5 key race moments vs. official broadcast

**Performance Benchmarks:**
- [ ] Frame generation: <50ms per frame (target 25 FPS playback)
- [ ] Memory usage: <500MB for full race (3000+ frames)
- [ ] API adapter overhead: <5% vs. direct calls
- [ ] Smoothing computation: <10ms per frame

**Edge Cases:**
- [ ] All 20 drivers on track
- [ ] Drivers with missing telemetry (late start, warm-up lap)
- [ ] Extreme pit loss (10+ position drop)
- [ ] Late-race DSQ or penalties
- [ ] Multiple retirements in quick succession
- [ ] Multi-lap safety car period

---

## 6. Expected Outcomes

| Aspect | Before | After |
|--------|--------|-------|
| **Frame 0-50 stability** | Random reshuffles | Grid position → FIA timing as available |
| **Single-frame flicker** | Position oscillates P6↔P7 | Stuck to P6 unless >5m gap opens |
| **Fallback behavior** | Distance sorting is hidden | Clear warning if timing unavailable |
| **Monotonicity** | race_progress only | race_progress still used, more reliable |

---

## 7. Testing Strategy

1. **Early race (frames 0-100)**: Verify no reshuffles between grid order and first full lap
2. **Mid-race (pit stops)**: Confirm smooth handling when drivers lose/gain positions
3. **Late race (SC, VSC)**: Ensure flicker doesn't occur during position bunching
4. **Session types**: Test race, sprint, and qualifying (if enabled)
5. **Edge cases**: Retirements, disqualifications, time penalties

---

## 8. Example Scenarios (Shared Understanding)

### Scenario A: Race Start (Lap 1, Frame 0-50)

**Frame 0 (lights out)**:
- FIA stream Position: mostly NaN (tower just starting)
- race_progress: 0 for all (all at start line)
- Expected behavior:
  - Can't use Tier 1 (no positions yet)
  - Sort by Tier 2 (race_progress) → all tied at 0
  - Use grid position as tiebreaker
  - Result: Grid order maintained

**Frame 50 (2 seconds later)**:
- FIA stream Position: starting to populate (1-2 Hz)
- race_progress: varies based on acceleration
- Smoothed gaps: becoming available
- Expected behavior:
  - Tier 1 position data exists for most drivers
  - Sort by (pos_val, gap_smoothed, -race_progress)
  - Hysteresis prevents single-frame flicker
  - Result: Smooth transition from grid to "real" race order

### Scenario B: Normal Overtake (Frame 200-250)

**Frame 200 (mid-race)**:
- Position: VER P1, NOR P2, HAM P3
- race_progress: VER = 1000m, NOR = 995m, HAM = 990m
- GapToLeader: NOR +1.2s, HAM +2.5s (smoothed)

**Frame 210 (HAM passes NOR)**:
- FIA stream updates: Position now NOR P3, HAM P2
- race_progress: HAM now ahead
- Smoothed gap: HAM gap to leader decreases sharply
- Expected behavior:
  - Tier 1 position catches up (tower already recorded it)
  - Hysteresis allows swap (gap difference > 5m)
  - Result: Clean, single-frame overtake visible
  - Frontend shows: "HAM +1.8s, NOR +2.3s" (smoothed gaps)

### Scenario C: DNF (Crash at Frame 300)

**Frame 299 (before crash)**:
- GAS P7, position order normal

**Frame 300 (crash/DNF)**:
- Speed drops to 0
- IsAccurate / status flags indicate DNF
- Expected behavior:
  - `_detect_retirement()` marks GAS as "Retired"
  - GAS moved out of active_codes list
  - GAS stays in leaderboard but stops being re-sorted
  - Other drivers advance (no ghost overtakes)
  - Result: GAS falls to bottom of leaderboard, stays there

### Scenario D: Lap Completion (Frame 1200+)

**Frame 1199 (approaching finish line)**:
- Leading driver about to complete Lap 20
- FIA stream: position data current

**Frame 1200 (lap boundary)**:
- Lap counter increments to Lap 20 (completed)
- Tier 0 data available: Session.laps[NOR].Position = 1
- Expected behavior:
  - `_apply_lap_anchor()` checks lap boundary
  - Official position from Session.laps trumps all
  - Snap leaderboard to official order
  - Result: No drift; leaderboard stays in sync with official results

---

## References

- FastF1 Timing Data: https://docs.fastf1.dev/api_reference/timing_data.html
- FastF1 Telemetry: https://docs.fastf1.dev/api_reference/telemetry.html
- Current Implementation: [shared/telemetry/f1_data.py](../shared/telemetry/f1_data.py)
- Savitzky-Golay Filter: https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.savgol_filter.html
