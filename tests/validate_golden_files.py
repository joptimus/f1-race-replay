#!/usr/bin/env python3
"""
Validate optimized telemetry against golden files.
Run this AFTER each optimization to ensure correctness.
"""

import sys
import json
import math
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.telemetry.f1_data import get_race_telemetry, load_session


def validate_against_golden(year: int, round_num: int, session_type: str, name: str = ""):
    """Compare new output against golden file."""
    key = f"{year}_{round_num}_{session_type}"
    golden_dir = Path(__file__).parent / "golden"
    golden_file = golden_dir / f"{key}_golden.json"

    if not golden_file.exists():
        print(f"[WARN] No golden file for {key}")
        return True, "No golden file"

    print(f"\nValidating {name or key}...")

    # Load golden baseline
    with open(golden_file, "r") as f:
        golden = json.load(f)

    # Get new output with optimized implementation
    try:
        session = load_session(year, round_num, session_type)
        result = get_race_telemetry(session, session_type=session_type, refresh=False)

        # Extract frames dict
        if isinstance(result, dict) and "frames" in result:
            frames = result["frames"]
        else:
            frames = result
    except Exception as e:
        return False, f"Failed to load telemetry: {e}"

    issues = []

    # 1. Validate frame count
    if len(frames) != golden["frame_count"]:
        issues.append(f"Frame count mismatch: {len(frames)} vs {golden['frame_count']}")

    if issues:
        return False, "; ".join(issues)

    # 2. Validate first/last frames timestamps
    if frames[0].get("t") != golden["first_frame"]["t"]:
        issues.append(
            f"First frame timestamp mismatch: {frames[0].get('t')} vs {golden['first_frame']['t']}"
        )

    if frames[-1].get("t") != golden["last_frame"]["t"]:
        issues.append(
            f"Last frame timestamp mismatch: {frames[-1].get('t')} vs {golden['last_frame']['t']}"
        )

    # 3. Validate driver codes
    current_codes = sorted(list(frames[0]["drivers"].keys())) if frames else []
    golden_codes = golden["first_frame"]["leaders"]
    if current_codes != golden_codes:
        issues.append(f"Driver code mismatch at first frame")

    # 4. Validate sample frames (positions and leaders)
    for frame_idx_str, expected in golden["sample_frames"].items():
        frame_idx = int(frame_idx_str.split("_")[1])

        if frame_idx >= len(frames):
            issues.append(f"Sample frame {frame_idx} out of range")
            continue

        frame = frames[frame_idx]

        # Validate positions
        current_positions = {code: data.get("position") for code, data in frame.get("drivers", {}).items()}

        for code, expected_pos in expected["positions"].items():
            if code not in current_positions:
                issues.append(f"Driver {code} missing at frame {frame_idx}")
                continue

            actual_pos = current_positions[code]
            if actual_pos != expected_pos:
                issues.append(
                    f"Position mismatch for {code} at frame {frame_idx}: {actual_pos} vs {expected_pos}"
                )

        # Validate sample float values (within tolerance)
        if "sample_values" in expected:
            for code, expected_vals in expected["sample_values"].items():
                if code not in frame["drivers"]:
                    continue

                actual = frame["drivers"][code]
                for field in ["x", "y", "speed", "dist"]:
                    if field in expected_vals and expected_vals[field] is not None:
                        actual_val = actual.get(field)
                        expected_val = expected_vals[field]

                        if actual_val is None:
                            issues.append(f"{field} is None for {code} at frame {frame_idx}")
                            continue

                        # Allow robust floating-point comparison (relative + absolute tolerance)
                        if isinstance(actual_val, (int, float)) and isinstance(expected_val, (int, float)):
                            abs_diff = abs(actual_val - expected_val)
                            # Combined tolerance: 1e-5 relative OR 1e-9 absolute
                            # Handles both large values (rel tolerance) and near-zero values (abs tolerance)
                            if expected_val != 0:
                                rel_error = abs_diff / abs(expected_val)
                                if rel_error > 1e-5 and abs_diff > 1e-9:
                                    issues.append(
                                        f"{field} mismatch for {code} at frame {frame_idx}: {actual_val} vs {expected_val} (rel_error={rel_error:.2e}, abs_diff={abs_diff:.2e})"
                                    )
                            else:
                                if abs_diff > 1e-9:
                                    issues.append(
                                        f"{field} mismatch for {code} at frame {frame_idx}: {actual_val} vs {expected_val} (abs_diff={abs_diff:.2e})"
                                    )

    # 5. Check for NaN values
    for frame_idx, frame in enumerate(frames):
        for code, data in frame.get("drivers", {}).items():
            for key in ["x", "y", "dist", "speed", "position"]:
                val = data.get(key)
                if isinstance(val, float) and math.isnan(val):
                    issues.append(f"NaN found in {code}.{key} at frame {frame_idx}")

    if issues:
        print(f"  [FAIL] {len(issues)} validation errors:")
        for issue in issues[:5]:  # Show first 5 issues
            print(f"    - {issue}")
        if len(issues) > 5:
            print(f"    ... and {len(issues) - 5} more issues")
        return False, f"{len(issues)} validation errors"
    else:
        print(f"  [OK] All validations passed!")
        return True, "Pass"


def validate_all():
    """Validate all test races."""
    test_races = [
        (2024, 1, "R", "short_race"),
        (2024, 6, "R", "medium_race"),
        (2024, 22, "R", "long_race"),
    ]

    results = []
    for year, round_num, session_type, name in test_races:
        passed, msg = validate_against_golden(year, round_num, session_type, name)
        results.append((name, passed, msg))

    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    for name, passed, msg in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status}  {name:20} - {msg}")

    all_passed = all(r[1] for r in results)
    return all_passed


if __name__ == "__main__":
    all_passed = validate_all()
    sys.exit(0 if all_passed else 1)
