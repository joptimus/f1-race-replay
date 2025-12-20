# Leaderboard Positioning System – Design Contract

**Status**: Design Review Complete
**Date**: 2025-12-19
**Audience**: Implementation team, design review

---

## Problem Statement

Current leaderboard shows **random reshuffles in early race** (frames 0-50) and **single-frame flicker** (P6↔P7) due to:
1. Sparse FIA timing data at race start
2. Fallback to unstable distance-based sorting
3. No continuous signal smoothing (positions are smoothed instead of gaps)
4. No lap anchor validation to prevent drift

**Observation**: debug_telemetry.log shows frame 0 order is `[HUL, ALB, ALO, ...]` but frame 50 rearranges to `[NOR, ALO, PIA, ...]`. This is unacceptable for a "live" race replay.

---

## Solution: 4-Tier Hierarchy with Continuous Signal Smoothing

### Core Principles

1. **Smooth continuous signals (gaps, distance) BEFORE deriving positions**
   - ✓ Smooth GapToLeader (float) with Savitzky-Golay
   - ✗ Do NOT smooth integer positions directly

2. **Use a 4-tier reliability hierarchy**
   - **Tier 0**: `Session.laps.Position` (legal truth at lap boundary)
   - **Tier 1**: `timing_data().stream_data.Position + GapToLeader` (live tower, 1-2 Hz)
   - **Tier 2**: `race_progress` (distance-based physics fallback)
   - **Tier 3**: Hysteresis (UI noise rejection, 5m threshold)

3. **Handle critical edge cases explicitly**
   - Lap 1 / Race start: rely on Tier 1 until first lap completes
   - DNFs/crashes: detect and lock to "Retired" section (no ghost overtakes)
   - Pit stops: handled naturally by Tier 1 gap updates
   - Lap boundaries: snap to official position from Session.laps

---

## Implementation Overview

### Phase 1: Continuous Signal Smoothing
```python
# Apply Savitzky-Golay to gap data BEFORE sorting
from scipy.signal import savgol_filter
timing_gap_df = _smooth_gap_data(timing_gap_df)
```

### Phase 2: Improved Sort Key
```python
# Sort by smoothed continuous signals, not integer positions
def sort_key_hybrid(code):
    pos_val = c["pos_raw"] if c["pos_raw"] > 0 else 9999  # Tier 1
    gap_val = c["gap_smoothed"] if c["gap_smoothed"] is not None else 9999  # Tier 1 (refined)
    race_progress = c["race_progress"] if not np.isnan(c["race_progress"]) else -9999  # Tier 2
    return (pos_val, gap_val, -race_progress)
```

### Phase 3: Hysteresis + Lap Anchor + Retirement Detection
```python
# Prevent single-frame flicker
sorted_codes = position_smoother.apply(sorted_codes_raw, frame_data_raw)

# Snap to official positions at lap boundaries
sorted_codes = _apply_lap_anchor(sorted_codes, frame_data_raw)

# Lock retired drivers (no re-sorting)
active_codes = [c for c in sorted_codes if frame_data_raw[c]["status"] != "Retired"]
```

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| **Frame 0 reshuffle** | Random order | Grid order |
| **Frame 0-50 stability** | Major rearrangements | Smooth, incremental changes |
| **Single-frame flicker** | P6↔P7 oscillates | Stuck unless gap > 5m |
| **DNF ghost overtakes** | Crashed car drifts down | Retired, stays at bottom |
| **Drift (late race)** | Possible over many laps | Synced via lap anchors |

---

## Data Flow (Summary)

```
FIA stream (Tier 1)        GPS/Telemetry (Tier 2)       Lap results (Tier 0)
      ↓                              ↓                             ↓
[Position, GapToLeader]      [race_progress]            [Session.laps.Position]
      ↓                              ↓                             ↓
      └──────────────┬───────────────┴──────────────┬──────────────┘
                     │
              SMOOTHING PHASE
         (Savitzky-Golay on gaps)
                     │
              SORTING PHASE
    (by pos_val, gap_smoothed, -race_progress)
                     │
             HYSTERESIS LAYER
          (5m swap threshold)
                     │
             LAP ANCHOR LAYER
        (snap to official at lap end)
                     │
          FINAL POSITION ASSIGNMENT
          (1, 2, 3, ... to frontend)
```

---

## File Changes Required

**Main file**: `shared/telemetry/f1_data.py`

**Functions to add**:
- `_smooth_gap_data()` – Savitzky-Golay smoothing
- `sort_key_hybrid()` – Replace existing `sort_key()`
- `PositionSmoothing` class – Hysteresis layer
- `_apply_lap_anchor()` – Tier 0 validation
- `_detect_retirement()` – Anti-ghost logic
- `_check_timing_data_coverage()` – Fallback detection

**Approx lines of code**: ~250-300 (well-isolated functions)

---

## Testing Strategy

1. **Early race (frames 0-100)**: Verify no reshuffles, smooth order emergence
2. **Overtakes (frames 200-300)**: Confirm single-frame position changes are crisp
3. **Pit stops**: Smooth gap increase/decrease during in/out
4. **Safety car**: No flicker during bunching
5. **DNF (known sessions)**: No ghost overtakes
6. **Lap boundaries**: Snap behavior smooth, official order preserved

---

## Implementation Timeline

Phases 1-3 (core smoothing + sorting): ~2-3 hours
Phases 4-6 (lap anchor + retirement + fallback): ~2 hours
Phase 7 (testing + debugging): ~2-3 hours
**Total**: ~1 development day

---

## Key Caveats & Notes

1. **Data rates**: Timing is ~1-2 Hz, GPS is ~10-100 Hz (approximate, session-dependent)
2. **Smoothing only on floats**: Never apply smoothing to integer positions
3. **Hysteresis is a safety net, not primary**: Primary source is smoothed tier-1 data
4. **Lap anchors are periodic resets**: Prevents long-term drift, not continuous enforcement
5. **Retired drivers are locked**: Once marked, they stay at bottom (most conservative approach)

---

## Design Contract: What We Agree On

✅ Use `timing_data().stream_data` for primary live positioning
✅ Apply Savitzky-Golay to gaps/distance, NOT to integer positions
✅ Use lap_positions from Session.laps as anchors (Tier 0)
✅ Implement hysteresis on position swaps (5m threshold)
✅ Detect DNFs/retirements and lock them out of re-sorting
✅ All edge cases (Lap 1, pit stops, SC, crashes) have explicit handling
✅ Fallback to distance-based ordering if timing data sparse (< 80%)

---

## References

- [Full Design Document](2025-12-19-leaderboard-positioning-design.md)
- [FastF1 Timing API](https://docs.fastf1.dev/api_reference/timing_data.html)
- [FastF1 Telemetry API](https://docs.fastf1.dev/api_reference/telemetry.html)
- [Savitzky-Golay Filter (SciPy)](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.savgol_filter.html)

---

**Status**: Ready for implementation
**Next**: Review and approval, then proceed to Phase 1
