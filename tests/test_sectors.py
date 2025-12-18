#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from shared.telemetry.f1_data import load_session
from shared.utils.track_geometry import build_track_from_example_lap

try:
    print("Loading session...")
    session = load_session(2024, 1, "R")

    print("Getting fastest lap...")
    fastest_lap_obj = session.laps.pick_fastest()
    fastest_lap_telem = fastest_lap_obj.get_telemetry()

    print(f"Sector1Time: {fastest_lap_obj['Sector1Time']}")
    print(f"Sector2Time: {fastest_lap_obj['Sector2Time']}")
    print(f"Sector3Time: {fastest_lap_obj['Sector3Time']}")

    print("Building track with sectors...")
    track_data = build_track_from_example_lap(fastest_lap_telem, lap_obj=fastest_lap_obj)

    print(f"Track data tuple length: {len(track_data)}")
    print(f"Centerline points: {len(track_data[0])}")
    print(f"Sector array: {track_data[10] is not None}")

    if track_data[10] is not None:
        sectors = track_data[10]
        unique_sectors = set(sectors)
        print(f"Unique sectors: {sorted(unique_sectors)}")
        print(f"Sector 1 count: {sum(1 for s in sectors if s == 1)}")
        print(f"Sector 2 count: {sum(1 for s in sectors if s == 2)}")
        print(f"Sector 3 count: {sum(1 for s in sectors if s == 3)}")
        print(f"First 10 sectors: {list(sectors[:10])}")
        print("✅ Sector computation successful!")
    else:
        print("❌ Sector computation failed (returned None)")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
