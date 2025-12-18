#!/usr/bin/env python3
"""
Generate golden files from baseline telemetry for validation.
Run this BEFORE making any optimizations.
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.telemetry.f1_data import get_race_telemetry, load_session


def create_golden_files():
    """Generate baseline output for validation."""
    test_races = [
        (2024, 1, "R", "short_race"),   # Short race
        (2024, 6, "R", "medium_race"),  # Medium race
        (2024, 22, "R", "long_race"),   # Long race
    ]

    golden_dir = Path(__file__).parent / "golden"
    golden_dir.mkdir(parents=True, exist_ok=True)

    for year, round_num, session_type, name in test_races:
        key = f"{year}_{round_num}_{session_type}"
        print(f"\nGenerating golden file for {name}: {key}")

        try:
            # Get telemetry using current implementation
            session = load_session(year, round_num, session_type)
            result = get_race_telemetry(session, session_type=session_type, refresh=False)

            # Extract frames dict (handle both old and new format)
            if isinstance(result, dict) and "frames" in result:
                frames = result["frames"]
            else:
                frames = result

            if not frames:
                print(f"  [SKIP] No frames generated for {key}")
                continue

            # Save key metrics
            golden = {
                "metadata": {
                    "year": year,
                    "round": round_num,
                    "session_type": session_type,
                    "name": name
                },
                "frame_count": len(frames),
                "driver_codes": sorted(list(frames[0]["drivers"].keys())) if frames else [],
                "first_frame": {
                    "t": frames[0].get("t") if frames else None,
                    "lap": frames[0].get("lap") if frames else None,
                    "leaders": sorted(list(frames[0].get("drivers", {}).keys())) if frames else []
                },
                "last_frame": {
                    "t": frames[-1].get("t") if frames else None,
                    "lap": frames[-1].get("lap") if frames else None,
                    "leaders": sorted(list(frames[-1].get("drivers", {}).keys())) if frames else []
                },
                "sample_frames": {}
            }

            # Sample frames at 0%, 50%, 100%
            sample_indices = [0, len(frames) // 2, len(frames) - 1]

            for idx in sample_indices:
                frame = frames[idx]
                sample_key = f"frame_{idx}"

                # Extract position ordering
                positions = {}
                for code, data in frame.get("drivers", {}).items():
                    positions[code] = data.get("position")

                golden["sample_frames"][sample_key] = {
                    "t": frame.get("t"),
                    "lap": frame.get("lap"),
                    "positions": positions,
                    # Sample some float values for comparison
                    "sample_values": {
                        list(frame["drivers"].keys())[0]: {
                            "x": frame["drivers"][list(frame["drivers"].keys())[0]].get("x"),
                            "y": frame["drivers"][list(frame["drivers"].keys())[0]].get("y"),
                            "speed": frame["drivers"][list(frame["drivers"].keys())[0]].get("speed"),
                            "dist": frame["drivers"][list(frame["drivers"].keys())[0]].get("dist"),
                        }
                    }
                }

            golden_file = golden_dir / f"{key}_golden.json"
            with open(golden_file, "w") as f:
                json.dump(golden, f, indent=2)

            print(f"  [OK] Created golden file: {golden_file}")
            print(f"      Frames: {golden['frame_count']}")
            print(f"      Drivers: {len(golden['driver_codes'])}")

        except Exception as e:
            print(f"  [ERROR] Failed to generate golden file for {key}: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    create_golden_files()
    print("\n✓ Golden file generation complete!")
