# Leaderboard Positioning – Implementation Guide

Quick reference for developers implementing the 4-tier hierarchy.

---

## Quick Start: The Core Insight

**Problem**: Integer positions (P1, P2) can't be smoothed without creating garbage values.
**Solution**: Smooth the **continuous underlying signals** (gaps in seconds, distance in meters) first, THEN derive positions by sorting.

```
Raw Stream Data      →  Smooth Signals     →  Sort by Signals  →  Derive Positions
(Position, Gap)         (Savitzky-Goyal)      (Hybrid Key)        (P1, P2, P3, ...)
```

---

## File: `shared/telemetry/f1_data.py`

### 1. Add Import
```python
from scipy.signal import savgol_filter
```

### 2. Add Functions (Before `get_race_telemetry()`)

#### Function A: Continuous Signal Smoothing
```python
def _smooth_gap_data(timing_gap_df, window_length=11, polyorder=2):
    """Smooth GapToLeader using Savitzky-Golay filter."""
    if timing_gap_df is None or timing_gap_df.empty:
        return timing_gap_df

    smoothed = timing_gap_df.copy()
    for driver in timing_gap_df.columns:
        gap_series = timing_gap_df[driver].values
        valid_mask = ~np.isnan(gap_series)

        if valid_mask.sum() > polyorder:
            try:
                gap_series[valid_mask] = savgol_filter(
                    gap_series[valid_mask],
                    window_length=min(window_length, valid_mask.sum() // 2 * 2 - 1),
                    polyorder=polyorder
                )
                smoothed[driver] = gap_series
            except Exception as e:
                print(f"Warning: Could not smooth gap data for {driver}: {e}")

    return smoothed
```

#### Function B: Lap Anchor Validation
```python
def _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries):
    """Snap leaderboard to official positions at lap boundaries."""
    lap_snap_corrections = {}

    for code in sorted_codes:
        if code in lap_boundaries and frame_data_raw[code]["lap"] in lap_boundaries[code]:
            lap_snap_corrections[code] = lap_boundaries[code][frame_data_raw[code]["lap"]]

    if lap_snap_corrections:
        def snap_key(code):
            return (0, lap_snap_corrections[code]) if code in lap_snap_corrections else (1, sorted_codes.index(code))
        sorted_codes = sorted(sorted_codes, key=snap_key)

    return sorted_codes
```

#### Function C: Retirement Detection
```python
def _detect_retirement(code, frame_data_raw):
    """Check if driver is retired."""
    return frame_data_raw[code]["status"] == "Retired"
```

#### Function D: Coverage Check
```python
def _check_timing_data_coverage(timing_pos_df, required_coverage=0.8):
    """Verify timing data sufficiency."""
    if timing_pos_df is None:
        return False, 0.0

    total_cells = timing_pos_df.shape[0] * timing_pos_df.shape[1]
    valid_cells = timing_pos_df.notna().sum().sum()
    coverage = valid_cells / total_cells if total_cells > 0 else 0.0

    return coverage >= required_coverage, coverage
```

#### Class A: Hysteresis Layer
```python
class PositionSmoothing:
    """Prevent position oscillations smaller than hysteresis threshold."""

    def __init__(self, hysteresis_threshold=5.0):
        self.previous_order = []
        self.hysteresis_threshold = hysteresis_threshold

    def apply(self, sorted_codes, frame_data_raw):
        if not self.previous_order:
            self.previous_order = list(sorted_codes)
            return self.previous_order

        smoothed = list(self.previous_order)
        current = list(sorted_codes)

        for i in range(len(current)):
            if i >= len(smoothed):
                smoothed.append(current[i])
                continue

            if current[i] != smoothed[i]:
                gap_diff = abs(
                    frame_data_raw[current[i]]["race_progress"] -
                    frame_data_raw[smoothed[i]]["race_progress"]
                )

                if gap_diff >= self.hysteresis_threshold:
                    smoothed[i] = current[i]

        self.previous_order = smoothed
        return smoothed
```

---

### 3. Modify `get_race_telemetry()` Function

#### Step 1: After resampling timing data (line ~420)
```python
# OLD: (existing code)
timing_gap_df = timing_gap_df.ffill().bfill()
timing_pos_df = timing_pos_df.ffill().bfill()

# NEW: Add smoothing and coverage check
timing_gap_df = timing_gap_df.ffill().bfill()
timing_pos_df = timing_pos_df.ffill().bfill()

# Apply continuous signal smoothing
if timing_gap_df is not None:
    timing_gap_df = _smooth_gap_data(timing_gap_df)
    print(f"Applied Savitzky-Golay smoothing to GapToLeader data")

# Check coverage
if timing_pos_df is not None:
    has_good_timing, coverage = _check_timing_data_coverage(timing_pos_df)
    if not has_good_timing:
        print(f"⚠️  WARNING: Timing data coverage only {coverage:.1%}. Using distance-based ordering.")
        timing_gap_df = None
        timing_pos_df = None
```

#### Step 2: Before frame generation loop (~line 600)
```python
# Initialize hysteresis smoother and lap boundaries
position_smoother = PositionSmoothing(hysteresis_threshold=5.0)

# Pre-compute lap boundaries (Tier 0 anchors)
lap_boundaries = defaultdict(dict)
for code in driver_data.keys():
    for lap_num, pos in enumerate(driver_lap_positions.get(code, [])):
        if pos is not None:
            lap_boundaries[code][lap_num + 1] = pos
```

#### Step 3: Replace sort key (~line 713)
```python
# OLD:
def sort_key(code):
    c = frame_data_raw[code]
    pos_val = c["pos_raw"] if c["pos_raw"] > 0 else 9999
    gap_val = c["gap"] if c["gap"] is not None else 9999
    dist_val = c["dist"] if not np.isnan(c["dist"]) else -9999
    return (pos_val, gap_val, -dist_val)

# NEW: Use smoothed gaps and race_progress
def sort_key_hybrid(code):
    c = frame_data_raw[code]
    pos_val = c["pos_raw"] if (c["pos_raw"] and c["pos_raw"] > 0) else 9999
    gap_val = c["gap_smoothed"] if c.get("gap_smoothed") is not None else 9999
    race_progress = c["race_progress"] if not np.isnan(c["race_progress"]) else -9999
    return (pos_val, gap_val, -race_progress)
```

#### Step 4: Update per-frame gap extraction (~line 660)
```python
# OLD: (existing code just assigns from timing_gap_df)
frame_data_raw[code]["gap"] = float(gap) if not pd.isna(gap) else None

# NEW: Also assign smoothed gap
frame_data_raw[code]["gap"] = float(gap) if not pd.isna(gap) else None
frame_data_raw[code]["gap_smoothed"] = float(gap) if not pd.isna(gap) else None
```

#### Step 5: Update sorting logic (~line 722)
```python
# OLD:
sorted_codes = sorted(active_codes, key=sort_key) + out_codes

# NEW: Apply all 4 tiers
sorted_codes_raw = sorted(active_codes, key=sort_key_hybrid)
sorted_codes = position_smoother.apply(sorted_codes_raw, frame_data_raw)  # Tier 3
sorted_codes = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)  # Tier 0
sorted_codes = sorted_codes + out_codes  # Append retired drivers
```

---

## Testing Checklist

```bash
# Run the replay to generate new telemetry
python backend/main.py

# Or legacy:
python legacy/main.py --year 2025 --round 12 --refresh-data

# Inspect debug_telemetry.log
# Look for:
# - Frame 0: Should be grid order (or close)
# - Frame 50: Should be smoothly transitioned, not random
# - Frame 100+: Should stabilize
# - No flicker at lap boundaries
# - No ghost overtakes at DNFs
```

---

## Validation Points

1. **Frame 0 order** = Grid order (or grid + first acceleration advantage)
2. **Frame 50 order** = Smooth transition from grid (no sudden reshuffles)
3. **Frame 100+ order** = Stable, matches FIA stream data
4. **Overtakes** = Single-frame position changes, crisp and clean
5. **DNFs** = Locked to bottom, never re-enter active leaderboard
6. **Pit stops** = Smooth gap increase (pit loss) → decrease (recovery)
7. **Lap boundaries** = Snap to Session.laps.Position, no flicker

---

## Rollback Plan

If issues arise:
1. Comment out `_smooth_gap_data()` call → reverts to unsmoothed stream data
2. Comment out `position_smoother.apply()` → reverts to raw FIA ordering
3. Comment out `_apply_lap_anchor()` → reverts to continuous sorting (allows drift)
4. All changes are isolated; can disable individually without affecting rest

---

## Performance Notes

- **Smoothing**: O(n) for all drivers, <10ms for typical session
- **Sorting**: O(n log n) per frame, ~1ms per frame
- **Hysteresis**: O(n) per frame, <1ms
- **Total overhead**: <20ms per frame (imperceptible at 25 FPS)

---

## Questions?

Refer to full design: [2025-12-19-leaderboard-positioning-design.md](2025-12-19-leaderboard-positioning-design.md)
