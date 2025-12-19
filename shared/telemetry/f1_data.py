import os
import sys
import fastf1
import fastf1.plotting
from multiprocessing import Pool, cpu_count
from collections import defaultdict
import numpy as np
import json
import pickle
from datetime import timedelta
from pathlib import Path

from shared.lib.tyres import get_tyre_compound_int
from shared.lib.time import parse_time_string, format_time

import pandas as pd

def enable_cache():
    # Check if cache folder exists
    if not os.path.exists('.fastf1-cache'):
        os.makedirs('.fastf1-cache')

    # Enable local cache
    fastf1.Cache.enable_cache('.fastf1-cache')

FPS = 25
DT = 1 / FPS

def _process_single_driver(args):
    """Process telemetry data for a single driver - must be top-level for multiprocessing"""
    driver_no, session, driver_code = args
    
    print(f"Getting telemetry for driver: {driver_code}")

    laps_driver = session.laps.pick_drivers(driver_no)
    if laps_driver.empty:
        return None

    driver_max_lap = laps_driver.LapNumber.max() if not laps_driver.empty else 0

    t_all = []
    x_all = []
    y_all = []
    race_dist_all = []
    rel_dist_all = []
    lap_numbers = []
    tyre_compounds = []
    speed_all = []
    gear_all = []
    drs_all = []
    throttle_all = []
    brake_all = []
    rpm_all = []
    lap_times_all = []
    sector1_all = []
    sector2_all = []
    sector3_all = []
    lap_positions = []  # Store lap end position for each lap

    total_dist_so_far = 0.0

    # iterate laps in order
    for lap_idx, (_, lap) in enumerate(laps_driver.iterlaps()):
        # get telemetry for THIS lap only
        lap_tel = lap.get_telemetry()
        lap_number = lap.LapNumber
        tyre_compund_as_int = get_tyre_compound_int(lap.Compound)

        # Extract position from this lap (position at end of lap)
        lap_position = int(lap.Position) if pd.notna(lap.Position) else None
        lap_positions.append(lap_position)

        if lap_tel.empty:
            continue

        t_lap = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
        x_lap = lap_tel["X"].to_numpy()
        y_lap = lap_tel["Y"].to_numpy()
        d_lap = lap_tel["Distance"].to_numpy()
        rd_lap = lap_tel["RelativeDistance"].to_numpy()
        speed_kph_lap = lap_tel["Speed"].to_numpy()
        gear_lap = lap_tel["nGear"].to_numpy()
        drs_lap = lap_tel["DRS"].to_numpy()
        throttle_lap = lap_tel["Throttle"].to_numpy()
        brake_lap = lap_tel["Brake"].to_numpy().astype(float)
        rpm_lap = lap_tel["RPM"].to_numpy()

        # Extract lap timing information
        lap_time = lap.LapTime.total_seconds() if pd.notna(lap.LapTime) else None
        sector1 = lap.Sector1Time.total_seconds() if pd.notna(lap.Sector1Time) else None
        sector2 = lap.Sector2Time.total_seconds() if pd.notna(lap.Sector2Time) else None
        sector3 = lap.Sector3Time.total_seconds() if pd.notna(lap.Sector3Time) else None

        # Filter out NaN values for robustness
        d_valid = d_lap[~np.isnan(d_lap)]

        # FIRST LAP VALIDATION: Ensure telemetry starts near 0
        if lap_idx == 0 and len(d_valid) > 0:
            if d_valid[0] > 100:
                print(f"WARNING: {driver_code} first lap telemetry starts at {d_valid[0]:.1f}m (expected ~0m)")

        # race distance = distance before this lap + distance within this lap
        race_d_lap = total_dist_so_far + d_lap

        # FIX: Update cumulative distance (only with valid data)
        if len(d_valid) > 1:
            total_dist_so_far += (d_valid[-1] - d_valid[0])

        t_all.append(t_lap)
        x_all.append(x_lap)
        y_all.append(y_lap)
        race_dist_all.append(race_d_lap)
        rel_dist_all.append(rd_lap)
        lap_numbers.append(np.full_like(t_lap, lap_number))
        tyre_compounds.append(np.full_like(t_lap, tyre_compund_as_int))
        speed_all.append(speed_kph_lap)
        gear_all.append(gear_lap)
        drs_all.append(drs_lap)
        throttle_all.append(throttle_lap)
        brake_all.append(brake_lap)
        rpm_all.append(rpm_lap)

        # Add lap time and sector times (same value for all points in this lap)
        # Use float with NaN for missing values to enable numpy interpolation
        lap_times_all.append(np.full_like(t_lap, lap_time if lap_time is not None else np.nan, dtype=float))
        sector1_all.append(np.full_like(t_lap, sector1 if sector1 is not None else np.nan, dtype=float))
        sector2_all.append(np.full_like(t_lap, sector2 if sector2 is not None else np.nan, dtype=float))
        sector3_all.append(np.full_like(t_lap, sector3 if sector3 is not None else np.nan, dtype=float))

    if not t_all:
        return None

    # OPTIMIZATION: Pre-sort lap intervals before concatenation to avoid O(2N) memory spike
    # Collect laps as (start_time, arrays_tuple) and verify monotonicity within each lap
    intervals = []

    # We need to reconstruct the intervals from the lists we've accumulated
    # Zip together all lap arrays to create intervals
    for lap_idx in range(len(t_all)):
        t_lap = t_all[lap_idx]
        if len(t_lap) > 0:
            # INTEGRITY: Assert time is monotonic within lap (allow duplicates at boundaries)
            assert np.all(t_lap[:-1] <= t_lap[1:]), \
                f"Non-monotonic lap time for {driver_code} in lap {lap_idx}"

            # Bundle all arrays for this lap
            arrays = (
                t_lap, x_all[lap_idx], y_all[lap_idx], race_dist_all[lap_idx],
                rel_dist_all[lap_idx], lap_numbers[lap_idx], tyre_compounds[lap_idx],
                speed_all[lap_idx], gear_all[lap_idx], drs_all[lap_idx],
                throttle_all[lap_idx], brake_all[lap_idx], rpm_all[lap_idx],
                lap_times_all[lap_idx], sector1_all[lap_idx], sector2_all[lap_idx], sector3_all[lap_idx]
            )
            intervals.append((t_lap[0], arrays))  # Sort key = lap start time

    # Sort intervals by start time (small list, typically 50-100 laps)
    # INTEGRITY: Verify laps are chronological
    intervals.sort(key=lambda x: x[0])

    # Concatenate pre-sorted intervals (single concatenation operation)
    if intervals:
        t_all = np.concatenate([interval[1][0] for interval in intervals])
        x_all = np.concatenate([interval[1][1] for interval in intervals])
        y_all = np.concatenate([interval[1][2] for interval in intervals])
        race_dist_all = np.concatenate([interval[1][3] for interval in intervals])
        rel_dist_all = np.concatenate([interval[1][4] for interval in intervals])
        lap_numbers = np.concatenate([interval[1][5] for interval in intervals])
        tyre_compounds = np.concatenate([interval[1][6] for interval in intervals])
        speed_all = np.concatenate([interval[1][7] for interval in intervals])
        gear_all = np.concatenate([interval[1][8] for interval in intervals])
        drs_all = np.concatenate([interval[1][9] for interval in intervals])
        throttle_all = np.concatenate([interval[1][10] for interval in intervals])
        brake_all = np.concatenate([interval[1][11] for interval in intervals])
        rpm_all = np.concatenate([interval[1][12] for interval in intervals])
        lap_times_all = np.concatenate([interval[1][13] for interval in intervals])
        sector1_all = np.concatenate([interval[1][14] for interval in intervals])
        sector2_all = np.concatenate([interval[1][15] for interval in intervals])
        sector3_all = np.concatenate([interval[1][16] for interval in intervals])

    # INTEGRITY: Verify concatenated time is monotonic (allow duplicates at lap boundaries)
    assert np.all(t_all[:-1] <= t_all[1:]), \
        f"Non-monotonic concatenated time for {driver_code}"

    print(f"Completed telemetry for driver: {driver_code}")
    
    return {
        "code": driver_code,
        "data": {
            "t": t_all,
            "x": x_all,
            "y": y_all,
            "dist": race_dist_all,
            "rel_dist": rel_dist_all,
            "lap": lap_numbers,
            "tyre": tyre_compounds,
            "speed": speed_all,
            "gear": gear_all,
            "drs": drs_all,
            "throttle": throttle_all,
            "brake": brake_all,
            "rpm": rpm_all,
            "lap_time": lap_times_all,
            "sector1": sector1_all,
            "sector2": sector2_all,
            "sector3": sector3_all,
        },
        "t_min": t_all.min(),
        "t_max": t_all.max(),
        "max_lap": driver_max_lap,
        "lap_positions": lap_positions  # List of positions at end of each lap
    }

def _calculate_gaps(sorted_codes, frame_data):
    """Calculate gap to car ahead and gap to leader for all drivers.

    Returns: dict mapping driver_code -> {"gap_to_previous": float, "gap_to_leader": float}
    """
    gaps = {}

    def distance_to_time_gap(distance_diff, speed_ms):
        if speed_ms <= 0 or distance_diff <= 0:
            return 0.0
        return distance_diff / speed_ms

    leader_code = sorted_codes[0] if sorted_codes else None
    leader_data = frame_data.get(leader_code) if leader_code else None

    for idx, code in enumerate(sorted_codes):
        data = frame_data[code]
        gap_to_previous = 0.0
        gap_to_leader = 0.0

        current_speed_ms = (data["speed"] * 1000) / 3600

        if idx > 0:
            prev_code = sorted_codes[idx - 1]
            prev_data = frame_data[prev_code]
            dist_diff = prev_data["race_progress"] - data["race_progress"]
            if dist_diff > 0 and current_speed_ms > 0:
                gap_to_previous = distance_to_time_gap(dist_diff, current_speed_ms)

            if leader_data:
                dist_diff = leader_data["race_progress"] - data["race_progress"]
                if dist_diff > 0 and current_speed_ms > 0:
                    gap_to_leader = distance_to_time_gap(dist_diff, current_speed_ms)

        gaps[code] = {
            "gap_to_previous": gap_to_previous,
            "gap_to_leader": gap_to_leader,
        }

    return gaps

def load_session(year, round_number, session_type='R'):
    # session_type: 'R' (Race), 'S' (Sprint) etc.
    session = fastf1.get_session(year, round_number, session_type)
    session.load(telemetry=True, weather=True)
    return session

# The following functions require a loaded session object

def get_driver_colors(session):
    color_mapping = fastf1.plotting.get_driver_color_mapping(session)
    
    # Convert hex colors to RGB tuples
    rgb_colors = {}
    for driver, hex_color in color_mapping.items():
        hex_color = hex_color.lstrip('#')
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        rgb_colors[driver] = rgb
    return rgb_colors

def get_circuit_rotation(session):
    circuit = session.get_circuit_info()
    return circuit.rotation

def get_race_telemetry(session, session_type='R', refresh=False):

    event_name = str(session).replace(' ', '_')
    cache_suffix = session_type.lower()

    # Use absolute path for caching (backend runs from different cwd)
    cache_dir = Path(__file__).parent.parent.parent / "computed_data"
    cache_file = cache_dir / f"{event_name}_{cache_suffix}_telemetry.pkl"

    # Check if this data has already been computed

    try:
        if not refresh and "--refresh-data" not in sys.argv:
            with open(cache_file, "rb") as f:
                frames = pickle.load(f)
                print(f"Loaded precomputed {cache_suffix} telemetry data.")
                print("The replay should begin in a new window shortly!")
                return frames
    except FileNotFoundError:
        pass  # Need to compute from scratch


    drivers = session.drivers

    driver_codes = {
        num: session.get_driver(num)["Abbreviation"]
        for num in drivers
    }

    grid_positions = {}
    final_positions = {}
    driver_statuses = {}
    try:
        results = session.results
        for _, row in results.iterrows():
            code = row["Abbreviation"]
            grid_positions[code] = int(row["GridPosition"])
            # Also get final race positions
            if "Position" in results.columns:
                final_positions[code] = int(row["Position"])
            # Get retirement status
            if "Status" in results.columns:
                driver_statuses[code] = row["Status"]
    except Exception as e:
        print(f"Warning: Could not get grid/final positions: {e}")

    driver_data = {}
    driver_lap_positions = {}  # Maps driver_code -> list of positions per lap

    global_t_min = None
    global_t_max = None

    max_lap_number = 0

    # 1. Get all of the drivers telemetry data using multiprocessing
    # Prepare arguments for parallel processing
    print(f"Processing {len(drivers)} drivers in parallel...")
    driver_args = [(driver_no, session, driver_codes[driver_no]) for driver_no in drivers]

    num_processes = min(cpu_count(), len(drivers))

    # Auto-tune chunk size for optimal load distribution
    # Aim for 4-8 chunks per worker for balanced load distribution
    num_drivers = len(drivers)
    chunksize = max(1, (num_drivers + num_processes * 4 - 1) // (num_processes * 4))

    with Pool(processes=num_processes) as pool:
        results = pool.imap_unordered(_process_single_driver, driver_args, chunksize=chunksize)

        # Process results while pool is still active
        for result in results:
            if result is None:
                continue

            code = result["code"]
            driver_data[code] = result["data"]
            driver_lap_positions[code] = result.get("lap_positions", [])

            t_min = result["t_min"]
            t_max = result["t_max"]
            max_lap_number = max(max_lap_number, result["max_lap"])

            global_t_min = t_min if global_t_min is None else min(global_t_min, t_min)
            global_t_max = t_max if global_t_max is None else max(global_t_max, t_max)

    # Ensure we have valid time bounds
    if global_t_min is None or global_t_max is None:
        raise ValueError("No valid telemetry data found for any driver")

    # 2. Create a timeline (start from zero)
    timeline = np.arange(global_t_min, global_t_max, DT) - global_t_min

    # 3. Resample each driver's telemetry (x, y, gap) onto the common timeline
    resampled_data = {}

    for code, data in driver_data.items():
        t = data["t"] - global_t_min  # Shift

        # OPTIMIZATION: Data should already be pre-sorted from _process_single_driver
        # Skip redundant np.argsort() call - this is Bottleneck #4 fix
        # INTEGRITY: Assert data is monotonic (allow duplicates at boundaries)
        assert np.all(t[:-1] <= t[1:]), \
            f"Driver {code} data not monotonic in time (pre-sort failed in _process_single_driver)"

        t_sorted = t  # No need to sort if pre-sorted

        # Resample all channels efficiently
        # Each channel resampled with shared t_sorted and timeline
        resampled = [np.interp(timeline, t_sorted, arr) for arr in [
            data["x"],
            data["y"],
            data["dist"],
            data["rel_dist"],
            data["lap"],
            data["tyre"],
            data["speed"],
            data["gear"],
            data["drs"],
            data["throttle"],
            data["brake"],
            data["rpm"],
        ]]
        x_resampled, y_resampled, dist_resampled, rel_dist_resampled, lap_resampled, \
        tyre_resampled, speed_resampled, gear_resampled, drs_resampled, throttle_resampled, brake_resampled, rpm_resampled = resampled

        # Resample lap and sector times (forward-fill since they don't change smoothly)
        lap_time_resampled = np.interp(timeline, t_sorted, data["lap_time"], left=np.nan, right=np.nan)
        sector1_resampled = np.interp(timeline, t_sorted, data["sector1"], left=np.nan, right=np.nan)
        sector2_resampled = np.interp(timeline, t_sorted, data["sector2"], left=np.nan, right=np.nan)
        sector3_resampled = np.interp(timeline, t_sorted, data["sector3"], left=np.nan, right=np.nan)

        resampled_data[code] = {
            "t": timeline,
            "x": x_resampled,
            "y": y_resampled,
            "dist": dist_resampled,   # race distance (metres since Lap 1 start)
            "rel_dist": rel_dist_resampled,
            "lap": lap_resampled,
            "tyre": tyre_resampled,
            "speed": speed_resampled,
            "gear": gear_resampled,
            "drs": drs_resampled,
            "throttle": throttle_resampled,
            "brake": brake_resampled,
            "rpm": rpm_resampled,
            "lap_time": lap_time_resampled,
            "sector1": sector1_resampled,
            "sector2": sector2_resampled,
            "sector3": sector3_resampled,
        }

    # 4. Incorporate track status data into the timeline (for safety car, VSC, etc.)

    track_status = session.track_status

    formatted_track_statuses = []
    race_start_time = None

    for status in track_status.to_dict('records'):
        seconds = timedelta.total_seconds(status['Time'])

        # Track status times are already in session timeline (seconds from session start)
        # Don't shift by global_t_min - that's only for telemetry normalization
        start_time = seconds
        end_time = None

        # Set the end time of the previous status

        if formatted_track_statuses:
            formatted_track_statuses[-1]['end_time'] = start_time

        formatted_track_statuses.append({
            'status': status['Status'],
            'start_time': start_time,
            'end_time': end_time,
        })

        # Record race start as first "All Clear" status (status code "1")
        if race_start_time is None and status['Status'] == "1":
            race_start_time = start_time

    # 4.1. Resample weather data onto the same timeline for playback
    weather_resampled = None
    weather_df = getattr(session, "weather_data", None)
    if weather_df is not None and not weather_df.empty:
        try:
            weather_times = weather_df["Time"].dt.total_seconds().to_numpy() - global_t_min
            if len(weather_times) > 0:
                order = np.argsort(weather_times)
                weather_times = weather_times[order]

                def _maybe_get(name):
                    return weather_df[name].to_numpy()[order] if name in weather_df else None

                def _resample(series):
                    if series is None:
                        return None
                    return np.interp(timeline, weather_times, series)

                track_temp = _resample(_maybe_get("TrackTemp"))
                air_temp = _resample(_maybe_get("AirTemp"))
                humidity = _resample(_maybe_get("Humidity"))
                wind_speed = _resample(_maybe_get("WindSpeed"))
                wind_direction = _resample(_maybe_get("WindDirection"))
                rainfall_raw = _maybe_get("Rainfall")
                rainfall = _resample(rainfall_raw.astype(float)) if rainfall_raw is not None else None

                weather_resampled = {
                    "track_temp": track_temp,
                    "air_temp": air_temp,
                    "humidity": humidity,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_direction,
                    "rainfall": rainfall,
                }
        except Exception as e:
            print(f"Weather data could not be processed: {e}")

    # 5. Build the frames + LIVE LEADERBOARD
    frames = []
    num_frames = len(timeline)

    # Pre-extract data references for faster access
    driver_codes = list(resampled_data.keys())
    driver_arrays = {code: resampled_data[code] for code in driver_codes}

    race_finished = False  # Flag to track once race end is detected
    last_dist = defaultdict(lambda: -1.0)  # Track monotonicity of dist per driver

    # Calculate circuit length from reference lap (fastest lap)
    circuit_length = 0.0
    try:
        reference_lap = session.laps.pick_fastest().get_telemetry()
        if not reference_lap.empty:
            ref_distances = reference_lap["Distance"].to_numpy()
            circuit_length = ref_distances[-1] - ref_distances[0] if len(ref_distances) > 1 else 0.0
    except Exception as e:
        print(f"WARNING: Could not calculate circuit_length: {e}", flush=True)
        circuit_length = 5000.0  # Fallback estimate


    # OPTIMIZATION: Pre-compute race_progress for all drivers at all frames to avoid repeated calculation
    # This also enables vectorized sorting operations
    race_progress_all = {}
    for code in driver_codes:
        d = driver_arrays[code]
        lap = np.maximum(np.round(d["lap"]), 1)  # Round to nearest lap, ensure >= 1
        rel = np.clip(d["rel_dist"], 0.0, 1.0)  # Clamp rel_dist to [0,1]
        race_progress_all[code] = (lap - 1) * circuit_length + rel * circuit_length

    # Track retirement confirmation: driver must have speed=0 for at least 10 seconds
    # to be marked as retired (avoids false positives from pit stops or pauses)
    RETIREMENT_THRESHOLD = 10  # seconds with speed == 0
    driver_zero_speed_time = defaultdict(float)  # Track continuous zero-speed duration per driver
    driver_retired = defaultdict(bool)  # Track confirmed retirement status

    # Calculate total race distance and finish epsilon
    total_race_distance = circuit_length * max_lap_number
    FINISH_EPSILON = min(0.01 * circuit_length, 50.0)  # 1% of circuit or 50m, whichever is tighter


    for i in range(num_frames):
        t = timeline[i]

        # OPTIMIZATION: Build data for all drivers in one pass (no intermediate snapshot list)
        frame_data_raw = {}

        for code in driver_codes:
            d = driver_arrays[code]
            race_prog = race_progress_all[code][i]
            speed = float(d['speed'][i])

            frame_data_raw[code] = {
                "x": float(d["x"][i]),
                "y": float(d["y"][i]),
                "dist": float(d["dist"][i]),
                "lap": int(round(d["lap"][i])),
                "rel_dist": float(d["rel_dist"][i]),
                "race_progress": float(race_prog),
                "tyre": int(d["tyre"][i]),
                "speed": speed,
                "gear": int(d['gear'][i]),
                "drs": int(d['drs'][i]),
                "throttle": float(d['throttle'][i]),
                "brake": float(d['brake'][i]),
                "rpm": int(d['rpm'][i]),
                "lap_time": float(d["lap_time"][i]) if not np.isnan(d["lap_time"][i]) else None,
                "sector1": float(d["sector1"][i]) if not np.isnan(d["sector1"][i]) else None,
                "sector2": float(d["sector2"][i]) if not np.isnan(d["sector2"][i]) else None,
                "sector3": float(d["sector3"][i]) if not np.isnan(d["sector3"][i]) else None,
                "status": driver_statuses.get(code, "Finished"),
            }

            # Track retirement: update zero-speed duration
            if speed == 0:
                driver_zero_speed_time[code] += DT
                if driver_zero_speed_time[code] >= RETIREMENT_THRESHOLD:
                    driver_retired[code] = True
            else:
                driver_zero_speed_time[code] = 0  # Reset if driver has any speed

        # IDENTIFY ACTIVE AND RETIRED DRIVERS (single source of truth)
        # A driver is OUT if: (1) confirmed retired (speed=0 for 10s+) OR (2) marked retired by FastF1 (status field)
        # Use FastF1's official status field to avoid false positives from rel_dist crossing during intermediate laps
        active_codes = [code for code in driver_codes if not driver_retired[code] and driver_statuses.get(code, "Finished") == "Finished"]
        out_codes = [code for code in driver_codes if driver_retired[code] or driver_statuses.get(code, "Finished") != "Finished"]

        # IDENTIFY CURRENT LEADER (from active drivers only, using consolidated retirement tracking)
        if active_codes:
            current_leader = max(active_codes, key=lambda c: frame_data_raw[c]["race_progress"])
            leader_progress = frame_data_raw[current_leader]["race_progress"]
            leader_lap = frame_data_raw[current_leader]["lap"]
            leader_rel = frame_data_raw[current_leader]["rel_dist"]
        else:
            current_leader = None
            leader_progress = 0.0
            leader_lap = 1
            leader_rel = 0.0

        # RACE START DETECTION - Priority: Use official track status timestamp
        if current_leader:
            if race_start_time is not None:
                # Use authoritative race start time from track status
                is_race_start = 0 <= (t - race_start_time) <= 10.0
            else:
                # Fallback: Leader on lap 1 and near start line
                is_race_start = (leader_lap <= 1) and (leader_rel < 0.05)
        else:
            is_race_start = False

        # RACE FINISH DETECTION - Only triggers once
        if not race_finished and current_leader and leader_progress >= (total_race_distance - FINISH_EPSILON) and final_positions:
            race_finished = True

        # STATE-AWARE SORTING
        if is_race_start and grid_positions:
            active_codes.sort(key=lambda code: (grid_positions.get(code, 999), -frame_data_raw[code]["race_progress"]))
        elif race_finished and final_positions:
            active_codes.sort(key=lambda code: final_positions.get(code, 999))
        else:
            active_codes.sort(key=lambda code: -frame_data_raw[code]["race_progress"])

        sorted_codes = active_codes + out_codes

        # Calculate positions and gaps for this frame
        frame_data = {}
        for code in sorted_codes:
            frame_data[code] = frame_data_raw[code].copy()
            # Only give race positions to active drivers
            if code in active_codes:
                frame_data[code]["position"] = active_codes.index(code) + 1
            else:
                # OUT drivers get positions after all active drivers
                frame_data[code]["position"] = len(active_codes) + out_codes.index(code) + 1

            # Check distance monotonicity per driver (warns if data is non-monotonic)
            progress = frame_data[code]["race_progress"]
            if progress + 1e-3 < last_dist[code]:
                print(
                    f"[WARN] non-monotonic dist for {code} at t={t:.2f}s: "
                    f"{progress:.3f} < {last_dist[code]:.3f}",
                    flush=True,
                )
            last_dist[code] = progress

        # Calculate gaps for this frame
        current_gaps = _calculate_gaps(sorted_codes, frame_data)


        for code in sorted_codes:
            # Add gap data (always - every driver should have gap values)
            gap_data = current_gaps.get(code, {"gap_to_previous": 0.0, "gap_to_leader": 0.0})
            frame_data[code]["gap_to_previous"] = gap_data["gap_to_previous"]
            frame_data[code]["gap_to_leader"] = gap_data["gap_to_leader"]

        # Get leader info for frame payload
        leader_code = sorted_codes[0] if sorted_codes else None
        leader_lap = frame_data[leader_code]["lap"] if leader_code else 1

        weather_snapshot = {}
        if weather_resampled:
            try:
                wt = weather_resampled
                rain_val = wt["rainfall"][i] if wt.get("rainfall") is not None else 0.0
                weather_snapshot = {
                    "track_temp": float(wt["track_temp"][i]) if wt.get("track_temp") is not None else None,
                    "air_temp": float(wt["air_temp"][i]) if wt.get("air_temp") is not None else None,
                    "humidity": float(wt["humidity"][i]) if wt.get("humidity") is not None else None,
                    "wind_speed": float(wt["wind_speed"][i]) if wt.get("wind_speed") is not None else None,
                    "wind_direction": float(wt["wind_direction"][i]) if wt.get("wind_direction") is not None else None,
                    "rain_state": "RAINING" if rain_val and rain_val > 0 else "DRY",
                }
            except Exception as e:
                print(f"Failed to attach weather data to frame {i}: {e}")

        frame_payload = {
            "t": round(t, 3),
            "lap": leader_lap,   # leader's lap at this time
            "drivers": frame_data,
        }
        if weather_snapshot:
            frame_payload["weather"] = weather_snapshot

        frames.append(frame_payload)
    print("completed telemetry extraction...")
    print("Saving to cache file...")
    # If computed_data/ directory doesn't exist, create it
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Save using pickle (10-100x faster than JSON)
    with open(cache_file, "wb") as f:
        pickle.dump({
            "frames": frames,
            "driver_colors": get_driver_colors(session),
            "track_statuses": formatted_track_statuses,
            "total_laps": int(max_lap_number),
            "race_start_time": race_start_time,
        }, f, protocol=pickle.HIGHEST_PROTOCOL)

    print("Saved Successfully!")
    print("The replay should begin in a new window shortly")
    return {
        "frames": frames,
        "driver_colors": get_driver_colors(session),
        "track_statuses": formatted_track_statuses,
        "total_laps": int(max_lap_number),
        "race_start_time": race_start_time,
    }


def get_qualifying_results(session):

    # Extract the qualifying results and return a list of the drivers, their positions and their lap times in each qualifying segment

    results = session.results

    qualifying_data = []

    for _, row in results.iterrows():
        driver_code = row["Abbreviation"]
        position = int(row["Position"])
        q1_time = row["Q1"]
        q2_time = row["Q2"]
        q3_time = row["Q3"]

        # Convert pandas Timedelta objects to seconds (or None if NaT)
        def convert_time_to_seconds(time_val) -> str:
            if pd.isna(time_val):
                return None
            return str(time_val.total_seconds())    

        qualifying_data.append({
            "code": driver_code,
            "position": position,
            "color": get_driver_colors(session).get(driver_code, (128,128,128)),
            "Q1": convert_time_to_seconds(q1_time),
            "Q2": convert_time_to_seconds(q2_time),
            "Q3": convert_time_to_seconds(q3_time),
        })
    return qualifying_data

def get_driver_quali_telemetry(session, driver_code: str, quali_segment: str):

    # Split Q1/Q2/Q3 sections
    q1, q2, q3 = session.laps.split_qualifying_sessions()

    segments = {
        "Q1": q1,
        "Q2": q2,
        "Q3": q3
    }

    # Validate the segment
    if quali_segment not in segments:
        raise ValueError("quali_segment must be 'Q1', 'Q2', or 'Q3'")

    segment_laps = segments[quali_segment]
    if segment_laps is None:
        raise ValueError(f"{quali_segment} does not exist for this session.")

    # Filter laps for the driver
    driver_laps = segment_laps.pick_drivers(driver_code)
    if driver_laps.empty:
        raise ValueError(f"No laps found for driver '{driver_code}' in {quali_segment}")

    # Pick fastest lap
    fastest_lap = driver_laps.pick_fastest()

    # Extract telemetry with xyz coordinates

    if fastest_lap is None:
        raise ValueError(f"No valid laps for driver '{driver_code}' in {quali_segment}")

    telemetry = fastest_lap.get_telemetry()

    # Guard: if telemetry has no time data, return empty
    if telemetry is None or telemetry.empty or 'Time' not in telemetry or len(telemetry) == 0:
        return {"frames": [], "track_statuses": []}

    global_t_min = telemetry["Time"].dt.total_seconds().min()
    global_t_max = telemetry["Time"].dt.total_seconds().max()

    max_speed = telemetry["Speed"].max()
    min_speed = telemetry["Speed"].min()

    # An array of objects containing the start and end disances of each time the driver used DRS during the lap
    lap_drs_zones = []

    # Build arrays directly from dataframes
    t_arr = telemetry["Time"].dt.total_seconds().to_numpy()
    x_arr = telemetry["X"].to_numpy()
    y_arr = telemetry["Y"].to_numpy()
    dist_arr = telemetry["Distance"].to_numpy()
    rel_dist_arr = telemetry["RelativeDistance"].to_numpy()
    speed_arr = telemetry["Speed"].to_numpy()
    gear_arr = telemetry["nGear"].to_numpy()
    throttle_arr = telemetry["Throttle"].to_numpy()
    brake_arr = telemetry["Brake"].to_numpy()
    drs_arr = telemetry["DRS"].to_numpy()

    # Recompute time bounds from the (possibly modified) telemetry times
    global_t_min = float(t_arr.min())
    global_t_max = float(t_arr.max())

    # Create timeline (relative times starting at zero) and include endpoint
    timeline = np.arange(global_t_min, global_t_max + DT/2, DT) - global_t_min

    # Ensure we have at least one sample
    if t_arr.size == 0:
        return {"frames": [], "track_statuses": []}

    # Shift telemetry times to same reference as timeline (relative to global_t_min)
    t_rel = t_arr - global_t_min

    # Sort & deduplicate times using the relative times
    order = np.argsort(t_rel)
    t_sorted = t_rel[order]
    t_sorted_unique, unique_idx = np.unique(t_sorted, return_index=True)
    idx_map = order[unique_idx]

    x_sorted = x_arr[idx_map]
    y_sorted = y_arr[idx_map]
    dist_sorted = dist_arr[idx_map]
    rel_dist_sorted = rel_dist_arr[idx_map]
    speed_sorted = speed_arr[idx_map]
    gear_sorted = gear_arr[idx_map]
    throttle_sorted = throttle_arr[idx_map]
    brake_sorted = brake_arr[idx_map]
    drs_sorted = drs_arr[idx_map]

    # Continuous interpolation
    x_resampled = np.interp(timeline, t_sorted_unique, x_sorted)
    y_resampled = np.interp(timeline, t_sorted_unique, y_sorted)
    dist_resampled = np.interp(timeline, t_sorted_unique, dist_sorted)
    rel_dist_resampled = np.interp(timeline, t_sorted_unique, rel_dist_sorted)
    speed_resampled = np.round(np.interp(timeline, t_sorted_unique, speed_sorted), 1)
    throttle_resampled = np.round(np.interp(timeline, t_sorted_unique, throttle_sorted), 1)
    brake_resampled = np.round(np.interp(timeline, t_sorted_unique, brake_sorted), 1)
    drs_resampled = np.interp(timeline, t_sorted_unique, drs_sorted)

    # Make sure that braking is between 0 and 100 so that it matches the throttle scale

    brake_resampled = brake_resampled * 100.0

    # Forward-fill / step sampling for discrete fields (gear)
    idxs = np.searchsorted(t_sorted_unique, timeline, side='right') - 1
    idxs = np.clip(idxs, 0, len(t_sorted_unique) - 1)
    gear_resampled = gear_sorted[idxs].astype(int)

    resampled_data = {
        "t": timeline,
        "x": x_resampled,
        "y": y_resampled,
        "dist": dist_resampled,
        "rel_dist": rel_dist_resampled,
        "speed": speed_resampled,
        "gear": gear_resampled,
        "throttle": throttle_resampled,
        "brake": brake_resampled,
        "drs": drs_resampled,
    }

    track_status = session.track_status

    formatted_track_statuses = []

    for status in track_status.to_dict('records'):
        seconds = timedelta.total_seconds(status['Time'])

        start_time = seconds - global_t_min # Shift to match timeline
        end_time = None

        # Set the end time of the previous status
        if formatted_track_statuses:
            formatted_track_statuses[-1]['end_time'] = start_time

        formatted_track_statuses.append({
            'status': status['Status'],
            'start_time': start_time,
            'end_time': end_time, 
        })

    # 4.1. Resample weather data onto the same timeline for playback
    weather_resampled = None
    weather_df = getattr(session, "weather_data", None)
    if weather_df is not None and not weather_df.empty:
        try:
            weather_times = weather_df["Time"].dt.total_seconds().to_numpy() - global_t_min
            if len(weather_times) > 0:
                order_w = np.argsort(weather_times)
                weather_times = weather_times[order_w]

                def _maybe_get(name):
                    return weather_df[name].to_numpy()[order_w] if name in weather_df else None

                def _resample(series):
                    if series is None:
                        return None
                    return np.interp(timeline, weather_times, series)

                track_temp = _resample(_maybe_get("TrackTemp"))
                air_temp = _resample(_maybe_get("AirTemp"))
                humidity = _resample(_maybe_get("Humidity"))
                wind_speed = _resample(_maybe_get("WindSpeed"))
                wind_direction = _resample(_maybe_get("WindDirection"))
                rainfall_raw = _maybe_get("Rainfall")
                rainfall = _resample(rainfall_raw.astype(float)) if rainfall_raw is not None else None

                weather_resampled = {
                    "track_temp": track_temp,
                    "air_temp": air_temp,
                    "humidity": humidity,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_direction,
                    "rainfall": rainfall,
                }
        except Exception as e:
            print(f"Weather data could not be processed: {e}")

    # Build the frames
    frames = []
    num_frames = len(timeline)

    for i in range(num_frames):
        t = timeline[i]

        weather_snapshot = {}
        if weather_resampled:
            try:
                wt = weather_resampled
                rain_val = wt["rainfall"][i] if wt.get("rainfall") is not None else 0.0
                weather_snapshot = {
                    "track_temp": float(wt["track_temp"][i]) if wt.get("track_temp") is not None else None,
                    "air_temp": float(wt["air_temp"][i]) if wt.get("air_temp") is not None else None,
                    "humidity": float(wt["humidity"][i]) if wt.get("humidity") is not None else None,
                    "wind_speed": float(wt["wind_speed"][i]) if wt.get("wind_speed") is not None else None,
                    "wind_direction": float(wt["wind_direction"][i]) if wt.get("wind_direction") is not None else None,
                    "rain_state": "RAINING" if rain_val and rain_val > 0 else "DRY",
                }
            except Exception as e:
                print(f"Failed to attach weather data to frame {i}: {e}")

        # Check if drs has changed from the previous frame

        if i > 0:
            drs_prev = resampled_data["drs"][i - 1]
            drs_curr = resampled_data["drs"][i]

            if (drs_curr >= 10) and (drs_prev < 10):
                # DRS activated
                lap_drs_zones.append({
                    "zone_start": float(resampled_data["dist"][i]),
                    "zone_end": None,
                })
            elif (drs_curr < 10) and (drs_prev >= 10):
                # DRS deactivated
                if lap_drs_zones and lap_drs_zones[-1]["zone_end"] is None:
                    lap_drs_zones[-1]["zone_end"] = float(resampled_data["dist"][i])

        frame_payload = {
            "t": round(t, 3),
            "telemetry": {
                "x": float(resampled_data["x"][i]),
                "y": float(resampled_data["y"][i]),
                "dist": float(resampled_data["dist"][i]),
                "rel_dist": float(resampled_data["rel_dist"][i]),
                "speed": float(resampled_data["speed"][i]),
                "gear": int(resampled_data["gear"][i]),
                "throttle": float(resampled_data["throttle"][i]),
                "brake": float(resampled_data["brake"][i]),
                "drs": int(resampled_data["drs"][i]),
            }
        }
        if weather_snapshot:
            frame_payload["weather"] = weather_snapshot

        frames.append(frame_payload)

    # Set the time of the final frame to the exact lap time
            
    frames[-1]["t"] = round(parse_time_string(str(fastest_lap["LapTime"])), 3)

    return {
        "frames": frames,
        "track_statuses": formatted_track_statuses,
        "drs_zones": lap_drs_zones,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def _process_quali_driver(args):
    """Process qualifying telemetry data for a single driver - must be top-level for multiprocessing"""
    session, driver_code = args

    print(f"Getting qualifying telemetry for driver: {driver_code}")

    driver_telemetry_data = {}

    max_speed = 0.0
    min_speed = 0.0

    for segment in ["Q1", "Q2", "Q3"]:
        try:
            segment_telemetry = get_driver_quali_telemetry(session, driver_code, segment)
            driver_telemetry_data[segment] = segment_telemetry

            # Update global max/min speed
            if segment_telemetry["max_speed"] > max_speed:
                max_speed = segment_telemetry["max_speed"]
            if segment_telemetry["min_speed"] < min_speed or min_speed == 0.0:
                min_speed = segment_telemetry["min_speed"]

        except ValueError:
            driver_telemetry_data[segment] = {"frames": [], "track_statuses": []}

    print(f"Finished processing qualifying telemetry for driver: {driver_code}")
        
    return {
        "driver_code": driver_code,
        "driver_telemetry_data": driver_telemetry_data,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def get_quali_telemetry(session, session_type='Q', refresh=False):
    # This function is going to get the results from qualifying and the telemetry for each drivers' fastest laps in each qualifying segment

    # The structure of the returned data will be:
    # {
    #   "results": [ { "code": driver_code, "position": position, "Q1": time, "Q2": time, "Q3": time }, ... ],
    #   "telemetry": {
    #       "driver_code": {
    #           "Q1": { "frames": [ { "t": time, "x": x, "y": y, "dist": dist, "speed": speed, "gear": gear }, ... ] },
    #           "Q2": { ... },
    #           "Q3": { ... },
    #       },
    #       ...
    #   }
    # }

    event_name = str(session).replace(' ', '_')
    cache_suffix = 'sprintquali' if session_type == 'SQ' else 'quali'

    # Use absolute path for caching (backend runs from different cwd)
    cache_dir = Path(__file__).parent.parent.parent / "computed_data"
    cache_file = cache_dir / f"{event_name}_{cache_suffix}_telemetry.pkl"

    # Check if this data has already been computed
    try:
        if not refresh and "--refresh-data" not in sys.argv:
            with open(cache_file, "rb") as f:
                data = pickle.load(f)
                print(f"Loaded precomputed {cache_suffix} telemetry data.")
                print("The replay should begin in a new window shortly!")
                return data
    except FileNotFoundError:
        pass  # Need to compute from scratch

    qualifying_results = get_qualifying_results(session)

    telemetry_data = {}

    max_speed = 0.0
    min_speed = 0.0

    driver_codes = {
        num: session.get_driver(num)["Abbreviation"]
        for num in session.drivers
    }

    telemetry_data = {}

    driver_args = [(session, driver_codes[driver_no]) for driver_no in session.drivers]

    print(f"Processing {len(session.drivers)} drivers in parallel...")

    num_processes = min(cpu_count(), len(session.drivers))

    # Auto-tune chunk size for optimal load distribution
    # Aim for 4-8 chunks per worker for balanced load distribution
    num_drivers = len(session.drivers)
    chunksize = max(1, (num_drivers + num_processes * 4 - 1) // (num_processes * 4))

    with Pool(processes=num_processes) as pool:
        results = pool.imap_unordered(_process_quali_driver, driver_args, chunksize=chunksize)

        # Process results while pool is still active
        for result in results:
            driver_code = result["driver_code"]
            telemetry_data[driver_code] = result["driver_telemetry_data"]

            if result["max_speed"] > max_speed:
                max_speed = result["max_speed"]
            if result["min_speed"] < min_speed or min_speed == 0.0:
                min_speed = result["min_speed"]

    # Save to the compute_data directory
    cache_dir.mkdir(parents=True, exist_ok=True)

    with open(cache_file, "wb") as f:
        pickle.dump({
            "results": qualifying_results,
            "telemetry": telemetry_data,
            "max_speed": max_speed,
            "min_speed": min_speed,
        }, f, protocol=pickle.HIGHEST_PROTOCOL)

    return {
        "results": qualifying_results,
        "telemetry": telemetry_data,
        "max_speed": max_speed,
        "min_speed": min_speed,
    }


def get_lap_telemetry(session, driver_codes: list, lap_numbers: list):
    """Get detailed telemetry for specific drivers and lap numbers for comparison.

    Args:
        session: Loaded FastF1 session object
        driver_codes: List of driver codes (e.g., ['VER', 'HAM'])
        lap_numbers: List of lap numbers to retrieve (e.g., [10, 10])

    Returns:
        List of dicts with driver_code, lap_number, lap_time, and telemetry points
    """
    result = []

    for driver_code, lap_num in zip(driver_codes, lap_numbers):
        try:
            driver_laps = session.laps.pick_drivers(driver_code)
            lap = driver_laps[driver_laps['LapNumber'] == lap_num].iloc[0]
            telemetry = lap.get_telemetry()

            if telemetry.empty:
                continue

            points = []
            for _, row in telemetry.iterrows():
                points.append({
                    "distance": float(row["Distance"]),
                    "speed": float(row["Speed"]),
                    "throttle": float(row["Throttle"]),
                    "brake": float(row["Brake"]),
                    "rpm": int(row["RPM"]) if pd.notna(row["RPM"]) else 0,
                    "gear": int(row["nGear"]),
                    "x": float(row["X"]),
                    "y": float(row["Y"]),
                })

            lap_time = float(lap["LapTime"].total_seconds()) if pd.notna(lap["LapTime"]) else None

            result.append({
                "driver_code": driver_code,
                "lap_number": int(lap_num),
                "lap_time": lap_time,
                "telemetry": points,
            })
        except (IndexError, KeyError) as e:
            print(f"Warning: Could not get telemetry for {driver_code} lap {lap_num}: {e}")
            continue

    return result


def get_sector_times(session, driver_codes: list, lap_numbers: list):
    """Get sector times for specific drivers and lap numbers.

    Args:
        session: Loaded FastF1 session object
        driver_codes: List of driver codes (e.g., ['VER', 'HAM'])
        lap_numbers: List of lap numbers to retrieve (e.g., [10, 10])

    Returns:
        List of dicts with driver_code, lap_number, sector times, and lap time
    """
    result = []

    for driver_code, lap_num in zip(driver_codes, lap_numbers):
        try:
            driver_laps = session.laps.pick_drivers(driver_code)
            lap = driver_laps[driver_laps['LapNumber'] == lap_num].iloc[0]

            sector_1 = float(lap["Sector1Time"].total_seconds()) if pd.notna(lap["Sector1Time"]) else None
            sector_2 = float(lap["Sector2Time"].total_seconds()) if pd.notna(lap["Sector2Time"]) else None
            sector_3 = float(lap["Sector3Time"].total_seconds()) if pd.notna(lap["Sector3Time"]) else None
            lap_time = float(lap["LapTime"].total_seconds()) if pd.notna(lap["LapTime"]) else None

            result.append({
                "driver_code": driver_code,
                "lap_number": int(lap_num),
                "sector_1": sector_1,
                "sector_2": sector_2,
                "sector_3": sector_3,
                "lap_time": lap_time,
            })
        except (IndexError, KeyError) as e:
            print(f"Warning: Could not get sector times for {driver_code} lap {lap_num}: {e}")
            continue

    return result


def list_rounds(year):
    """Lists all rounds for a given year."""
    enable_cache()
    print(f"F1 Schedule {year}")
    schedule = fastf1.get_event_schedule(year)
    for _, event in schedule.iterrows():
        print(f"{event['RoundNumber']}: {event['EventName']}")
    sys.exit()

def list_sprints(year):
    """Lists all sprint rounds for a given year."""
    enable_cache()
    print(f"F1 Sprint Races {year}")
    schedule = fastf1.get_event_schedule(year)
    sprint_name = 'sprint_qualifying'
    if year == 2023:
        sprint_name = 'sprint_shootout'
    if year in [2021, 2022]:
        sprint_name = 'sprint'
    sprints = schedule[schedule['EventFormat'] == sprint_name]
    if sprints.empty:
        print(f"No sprint races found for {year}.")
    else:
        for _, event in sprints.iterrows():
            print(f"{event['RoundNumber']}: {event['EventName']}")
    sys.exit()