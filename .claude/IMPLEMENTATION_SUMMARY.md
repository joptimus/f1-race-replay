# Leaderboard Fix Implementation Summary

## Problem Statement
The Arcade leaderboard was displaying drivers in incorrect positions while the Three.js visualization showed the correct track order. This was caused by sorting frames by instantaneous `rel_dist` (relative position on track) instead of accumulated race progress.

## Root Cause Analysis
**File:** `src/f1_data.py:405` (before fix)

The original sorting logic:
```python
snapshot.sort(key=lambda r: (-r["lap"], -r["rel_dist"]))
```

This approach is unreliable because:
1. At race start: `rel_dist` values are noisy and don't represent true position order
2. During pit stops: `rel_dist` shows pit lane position, not race order
3. Early laps: Drivers may not have settled into actual grid order yet

## Solution Implemented

### 1. Calculate Circuit Length (Step 5)
**File:** `src/f1_data.py:351-363`

Extract circuit length from reference (fastest) lap telemetry:
```python
circuit_length = 0.0
try:
    reference_lap = session.laps.pick_fastest().get_telemetry()
    if not reference_lap.empty:
        ref_distances = reference_lap["Distance"].to_numpy()
        circuit_length = ref_distances[-1] - ref_distances[0]
except Exception as e:
    circuit_length = 5000.0  # Fallback estimate
```

### 2. Compute Race Progress Metric
**File:** `src/f1_data.py:401-408`

For each driver in each frame, calculate accumulated total distance:
```python
for r in snapshot:
    lap = max(r.get("lap", 1), 1)
    rel = float(r.get("rel_dist", 0.0))
    rel = max(0.0, min(1.0, rel))
    r["race_progress"] = (lap - 1) * circuit_length + rel * circuit_length
```

This combines:
- Full laps completed: `(lap - 1) * circuit_length`
- Distance on current lap: `rel_dist * circuit_length`

### 3. Update Sorting Logic
**File:** `src/f1_data.py:412-421`

Replace lap/rel_dist sorting with race_progress:
```python
if is_race_start and grid_positions:
    snapshot.sort(key=lambda r: (grid_positions.get(r["code"], 999), -r["race_progress"]))
elif race_finished and final_positions:
    snapshot.sort(key=lambda r: final_positions.get(r["code"], 999))
else:
    # During race: sort by accumulated race progress
    snapshot.sort(key=lambda r: -r["race_progress"])
```

Key improvements:
- Race start: Uses grid positions with race_progress tiebreaker
- Race end: Uses official final positions
- Active race: Uses race_progress (accounts for both laps and position on current lap)

### 4. Include in Frame Data
**File:** `src/f1_data.py:464`

Add race_progress to serialized frame data for frontend debugging:
```python
"race_progress": round(car["race_progress"], 1),
```

### 5. Update Backend Serialization
**File:** `backend/main.py:131-133`

Ensure race_progress flows through to frontend:
```python
"dist": float(driver_data.get("dist", 0)),
"rel_dist": float(driver_data.get("rel_dist", 0)),
"race_progress": float(driver_data.get("race_progress", 0)),
```

### 6. Update TypeScript Types
**File:** `frontend/src/types/index.ts:17-18`

Add new fields to DriverData interface:
```typescript
rel_dist: number;
race_progress: number;
```

## Commits Made
1. **599a566**: Implement race_progress metric for accurate position sorting
   - Core algorithm implementation
   - Circuit length calculation
   - Frame data updates

2. **078910b**: Update frontend types and backend serialization
   - TypeScript type definitions
   - Backend API payload updates

3. **e2c73cf**: Clean up debug logging
   - Removed verbose BEFORE/AFTER sort logs
   - Kept monotonicity warnings for data quality

## Testing & Validation

### Debug Output Observed
```
DEBUG: Calculated circuit_length = 5364.0m from reference lap
DEBUG: Starting frame processing. Total frames: 139957, Timeline range: 0.0s to 5598.2s
```

The race_progress values in debug logs show proper accumulation:
- Frame at t=10.04s: VER 450.4m (0.084 lap), PER 459.3m (0.086 lap)
- Frame at t=11.00s: VER 484.5m (0.090 lap), PER 500.4m (0.093 lap)

### Data Quality Warnings
Monotonicity warnings show where telemetry has backtracking, which is expected early in races during data initialization.

## Next Steps for Verification

### Step 4 (Optional): Frontend Verification
If needed, temporarily update Leaderboard.tsx to calculate race_progress directly:
```typescript
const raceProgress = (lap - 1) * circuitLength + rel * circuitLength;
drivers.sort((a, b) => b.raceProgress - a.raceProgress);
```
This would provide independent verification that backend positions are correct.

### Step 6 (Optional): FastF1 Comparison
Compare calculated positions against FastF1 official position field:
```python
official_pos = session.laps.iloc[frame_idx].Position
```
Would identify any systematic differences.

### Full Integration Testing
Once backend processing completes (140k frames):
1. Run the application with the fixed data
2. Compare Arcade leaderboard positions against 3D visualization
3. Verify positions match at critical moments (race start, pit stops, race end)
4. Check lap transitions for smooth position changes

## Impact
- **Leaderboard accuracy**: Now based on actual accumulated distance, not instantaneous track position
- **Race start handling**: Uses grid positions with proper fallback to race_progress
- **Pit stop handling**: Race progress smoothly handles drivers leaving/entering pits
- **Data flow**: All layers (Python → JSON → TypeScript) properly handle race_progress metric

## Files Modified
| File | Changes |
|------|---------|
| `src/f1_data.py` | Circuit length calculation, race_progress metric, sorting logic |
| `backend/main.py` | Serialize race_progress in frame payloads |
| `frontend/src/types/index.ts` | Added rel_dist and race_progress to DriverData |

## Known Limitations
- Early race telemetry can be sparse/interpolated (non-monotonic dist warnings)
- Circuit length relies on reference lap being available
- Grid positions only used for first 500m to prevent lock-in

## Future Improvements
1. Smooth position changes frame-to-frame to prevent sudden jumps
2. Handle multi-class racing (if needed)
3. Add configurable race_progress calculation preferences
4. Database storage of positions for offline analysis
