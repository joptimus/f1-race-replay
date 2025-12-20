import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import pandas as pd
import numpy as np
from shared.telemetry.f1_data import _smooth_interval_data, sort_key_hybrid


def test_smooth_interval_data_basic():
    """Test that _smooth_interval_data processes dataframe correctly"""
    stream_data = pd.DataFrame({
        'Driver': ['HAM', 'HAM', 'HAM', 'VER', 'VER', 'VER'],
        'Interval_s': [0.5, 0.51, 0.52, 1.2, 1.21, 1.19],
    })

    result = _smooth_interval_data(stream_data, window_length=3, polyorder=1)

    assert 'Interval_smooth' in result.columns
    assert result[result['Driver'] == 'HAM']['Interval_smooth'].notna().sum() > 0
    assert result[result['Driver'] == 'VER']['Interval_smooth'].notna().sum() > 0


def test_smooth_interval_data_preserves_nan():
    """Test that NaN values are preserved"""
    stream_data = pd.DataFrame({
        'Driver': ['HAM', 'HAM', 'HAM'],
        'Interval_s': [0.5, np.nan, 0.51],
    })

    result = _smooth_interval_data(stream_data, window_length=3, polyorder=1)

    assert pd.isna(result.iloc[1]['Interval_smooth'])


def test_smooth_interval_data_empty():
    """Test that empty dataframe is handled gracefully"""
    stream_data = pd.DataFrame({'Interval_s': []})
    result = _smooth_interval_data(stream_data)

    assert result.empty


def test_smooth_interval_data_missing_driver_column():
    """Test that missing Driver column is handled gracefully"""
    stream_data = pd.DataFrame({
        'Interval_s': [0.5, 0.51, 0.52],
    })
    result = _smooth_interval_data(stream_data)
    assert result is not None


def test_sort_key_hybrid_basic_sorting():
    """Test basic sorting with 3 drivers with known values"""
    frame_data_raw = {
        'HAM': {'pos_raw': 1, 'interval_smooth': 0.5, 'race_progress': 1000.0},
        'VER': {'pos_raw': 2, 'interval_smooth': 1.2, 'race_progress': 950.0},
        'SAI': {'pos_raw': 3, 'interval_smooth': 2.1, 'race_progress': 900.0},
    }

    ham_key = sort_key_hybrid('HAM', frame_data_raw)
    ver_key = sort_key_hybrid('VER', frame_data_raw)
    sai_key = sort_key_hybrid('SAI', frame_data_raw)

    assert ham_key < ver_key < sai_key
    assert ham_key == (1, 0.5, -1000.0)
    assert ver_key == (2, 1.2, -950.0)
    assert sai_key == (3, 2.1, -900.0)


def test_sort_key_hybrid_none_interval_smooth():
    """Test handling of None interval_smooth (falls back to 9999)"""
    frame_data_raw = {
        'HAM': {'pos_raw': 1, 'interval_smooth': 0.5, 'race_progress': 1000.0},
        'VER': {'pos_raw': 2, 'interval_smooth': None, 'race_progress': 950.0},
    }

    ver_key = sort_key_hybrid('VER', frame_data_raw)
    assert ver_key[1] == 9999
    assert ver_key == (2, 9999, -950.0)


def test_sort_key_hybrid_nan_race_progress():
    """Test handling of NaN race_progress (treated as 0.0)"""
    frame_data_raw = {
        'HAM': {'pos_raw': 1, 'interval_smooth': 0.5, 'race_progress': 1000.0},
        'VER': {'pos_raw': 2, 'interval_smooth': 1.2, 'race_progress': np.nan},
    }

    ver_key = sort_key_hybrid('VER', frame_data_raw)
    assert ver_key[2] == 0.0
    assert ver_key == (2, 1.2, 0.0)


def test_sort_key_hybrid_retired_driver():
    """Test handling of pos_raw <= 0 (treated as 9999, retired)"""
    frame_data_raw = {
        'HAM': {'pos_raw': 1, 'interval_smooth': 0.5, 'race_progress': 1000.0},
        'RET': {'pos_raw': 0, 'interval_smooth': None, 'race_progress': 500.0},
    }

    ret_key = sort_key_hybrid('RET', frame_data_raw)
    assert ret_key[0] == 9999
    assert ret_key == (9999, 9999, -500.0)


def test_sort_key_hybrid_tuple_ordering():
    """Test that tuple ordering is correct (lower values sort first)"""
    frame_data_raw = {
        'P1': {'pos_raw': 1, 'interval_smooth': 0.5, 'race_progress': 1000.0},
        'P2': {'pos_raw': 2, 'interval_smooth': 1.0, 'race_progress': 900.0},
        'P3': {'pos_raw': 3, 'interval_smooth': 1.5, 'race_progress': 800.0},
    }

    drivers = ['P1', 'P2', 'P3']
    sort_keys = [sort_key_hybrid(code, frame_data_raw) for code in drivers]

    sorted_drivers = sorted(drivers, key=lambda c: sort_key_hybrid(c, frame_data_raw))
    assert sorted_drivers == ['P1', 'P2', 'P3']


from shared.telemetry.f1_data import PositionSmoothing


def test_position_smoothing_initial_state():
    """Test that first call returns same order unchanged"""
    smoother = PositionSmoothing()
    frame_data_raw = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes = ['HAM', 'VER', 'SAI']
    result = smoother.apply(sorted_codes, frame_data_raw, 0.0, '1')

    assert result == ['HAM', 'VER', 'SAI']


def test_position_smoothing_no_change():
    """Test that same order returns same order"""
    smoother = PositionSmoothing()
    frame_data_raw = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes = ['HAM', 'VER', 'SAI']
    smoother.apply(sorted_codes, frame_data_raw, 0.0, '1')

    result = smoother.apply(sorted_codes, frame_data_raw, 0.5, '1')

    assert result == ['HAM', 'VER', 'SAI']


def test_position_smoothing_change_too_fast():
    """Test that new order is rejected if less than threshold time has passed"""
    smoother = PositionSmoothing()
    frame_data_raw_1 = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_1 = ['HAM', 'VER', 'SAI']
    smoother.apply(sorted_codes_1, frame_data_raw_1, 0.0, '1')

    frame_data_raw_2 = {
        'VER': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'HAM': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_2 = ['VER', 'HAM', 'SAI']
    result = smoother.apply(sorted_codes_2, frame_data_raw_2, 0.5, '1')

    assert result == ['HAM', 'VER', 'SAI']


def test_position_smoothing_change_with_threshold():
    """Test that new order is accepted after hysteresis threshold passes"""
    smoother = PositionSmoothing()
    frame_data_raw_1 = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_1 = ['HAM', 'VER', 'SAI']
    smoother.apply(sorted_codes_1, frame_data_raw_1, 0.0, '1')

    frame_data_raw_2 = {
        'VER': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'HAM': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_2 = ['VER', 'HAM', 'SAI']
    result = smoother.apply(sorted_codes_2, frame_data_raw_2, 1.5, '1')

    assert result == ['VER', 'HAM', 'SAI']


def test_position_smoothing_track_status_safety_car():
    """Test that SC/VSC reduces hysteresis threshold to 0.3s"""
    smoother = PositionSmoothing()
    frame_data_raw_1 = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_1 = ['HAM', 'VER', 'SAI']
    smoother.apply(sorted_codes_1, frame_data_raw_1, 0.0, '1')

    frame_data_raw_2 = {
        'VER': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'HAM': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
    }

    sorted_codes_2 = ['VER', 'HAM', 'SAI']
    result = smoother.apply(sorted_codes_2, frame_data_raw_2, 0.35, '4')

    assert result == ['VER', 'HAM', 'SAI']


def test_position_smoothing_track_status_vsc():
    """Test that VSC (6/7) reduces hysteresis threshold to 0.3s"""
    smoother = PositionSmoothing()
    frame_data_raw_1 = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
    }

    sorted_codes_1 = ['HAM', 'VER']
    smoother.apply(sorted_codes_1, frame_data_raw_1, 0.0, '1')

    frame_data_raw_2 = {
        'VER': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'HAM': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
    }

    sorted_codes_2 = ['VER', 'HAM']
    result = smoother.apply(sorted_codes_2, frame_data_raw_2, 0.25, '6')

    assert result == ['HAM', 'VER']


def test_position_smoothing_multiple_driver_changes():
    """Test that multiple drivers can change in different frames"""
    smoother = PositionSmoothing()
    frame_data_raw_1 = {
        'HAM': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'VER': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'SAI': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
        'ALO': {'race_progress': 850.0, 'pos_raw': 4, 'interval_smooth': 3.0},
    }

    sorted_codes_1 = ['HAM', 'VER', 'SAI', 'ALO']
    smoother.apply(sorted_codes_1, frame_data_raw_1, 0.0, '1')

    frame_data_raw_2 = {
        'VER': {'race_progress': 1000.0, 'pos_raw': 1, 'interval_smooth': 0.5},
        'HAM': {'race_progress': 950.0, 'pos_raw': 2, 'interval_smooth': 1.2},
        'ALO': {'race_progress': 900.0, 'pos_raw': 3, 'interval_smooth': 2.1},
        'SAI': {'race_progress': 850.0, 'pos_raw': 4, 'interval_smooth': 3.0},
    }

    sorted_codes_2 = ['VER', 'HAM', 'ALO', 'SAI']
    result = smoother.apply(sorted_codes_2, frame_data_raw_2, 1.5, '1')

    assert result == ['VER', 'HAM', 'ALO', 'SAI']


from shared.telemetry.f1_data import _apply_lap_anchor


def test_apply_lap_anchor_no_anchors():
    """Test that order is unchanged when no lap boundaries exist"""
    sorted_codes = ['HAM', 'VER', 'SAI']
    frame_data_raw = {
        'HAM': {'lap': 5},
        'VER': {'lap': 5},
        'SAI': {'lap': 5},
    }
    lap_boundaries = {}

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['HAM', 'VER', 'SAI']


def test_apply_lap_anchor_partial_anchors():
    """Test partial anchors - some drivers snap to official position, others use current order"""
    sorted_codes = ['HAM', 'VER', 'SAI']
    frame_data_raw = {
        'HAM': {'lap': 5},
        'VER': {'lap': 5},
        'SAI': {'lap': 5},
    }
    lap_boundaries = {
        'HAM': {5: 2},
        'VER': {5: 1},
    }

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['VER', 'HAM', 'SAI']


def test_apply_lap_anchor_all_drivers_anchored():
    """Test all drivers anchored at lap boundary"""
    sorted_codes = ['HAM', 'VER', 'SAI']
    frame_data_raw = {
        'HAM': {'lap': 10},
        'VER': {'lap': 10},
        'SAI': {'lap': 10},
    }
    lap_boundaries = {
        'HAM': {10: 3},
        'VER': {10: 1},
        'SAI': {10: 2},
    }

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['VER', 'SAI', 'HAM']


def test_apply_lap_anchor_multiple_laps():
    """Test correct lap number used for lookups"""
    sorted_codes = ['HAM', 'VER', 'SAI', 'ALO']
    frame_data_raw = {
        'HAM': {'lap': 15},
        'VER': {'lap': 15},
        'SAI': {'lap': 14},
        'ALO': {'lap': 14},
    }
    lap_boundaries = {
        'HAM': {14: 2, 15: 2},
        'VER': {14: 1, 15: 1},
        'SAI': {14: 4},
        'ALO': {14: 3},
    }

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['VER', 'HAM', 'ALO', 'SAI']


def test_apply_lap_anchor_missing_lap_boundary():
    """Test driver not in lap_boundaries uses fallback (current order)"""
    sorted_codes = ['HAM', 'VER', 'SAI']
    frame_data_raw = {
        'HAM': {'lap': 8},
        'VER': {'lap': 8},
        'SAI': {'lap': 8},
    }
    lap_boundaries = {
        'HAM': {8: 2},
        'VER': {8: 1},
    }

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['VER', 'HAM', 'SAI']


def test_apply_lap_anchor_tier_0_priority():
    """Test Tier 0 (lap anchors) takes priority over Tier 3 (current order)"""
    sorted_codes = ['HAM', 'VER', 'SAI']
    frame_data_raw = {
        'HAM': {'lap': 25},
        'VER': {'lap': 25},
        'SAI': {'lap': 25},
    }
    lap_boundaries = {
        'HAM': {25: 1},
        'VER': {25: 3},
        'SAI': {25: 2},
    }

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['HAM', 'SAI', 'VER']


def test_apply_lap_anchor_empty_sorted_codes():
    """Test empty input returns empty output"""
    sorted_codes = []
    frame_data_raw = {}
    lap_boundaries = {}

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == []


def test_apply_lap_anchor_single_driver():
    """Test single driver returns unchanged"""
    sorted_codes = ['HAM']
    frame_data_raw = {'HAM': {'lap': 5}}
    lap_boundaries = {'HAM': {5: 1}}

    result = _apply_lap_anchor(sorted_codes, frame_data_raw, lap_boundaries)
    assert result == ['HAM']


def test_detect_retirement_from_status():
    """Test that Retired status is detected"""
    from shared.telemetry.f1_data import _detect_retirement

    frame_data_raw = {
        'HAM': {'status': 'Retired', 'speed': 0},
    }

    assert _detect_retirement('HAM', frame_data_raw) == True


def test_detect_retirement_active_driver():
    """Test that active driver is not marked as retired"""
    from shared.telemetry.f1_data import _detect_retirement

    frame_data_raw = {
        'HAM': {'status': 'Finished', 'speed': 300},
    }

    assert _detect_retirement('HAM', frame_data_raw) == False


def test_detect_retirement_missing_data():
    """Test that missing data is handled gracefully"""
    from shared.telemetry.f1_data import _detect_retirement

    frame_data_raw = {
        'HAM': {},
    }

    assert _detect_retirement('HAM', frame_data_raw) == False


def test_check_timing_coverage_good():
    """Test that good coverage is detected"""
    from shared.telemetry.f1_data import _check_timing_data_coverage

    stream_data = pd.DataFrame({
        'Driver': ['HAM', 'HAM', 'HAM', 'VER', 'VER', 'VER'],
        'Position': [1, 1, 1, 2, 2, 2],
    })

    has_good, coverage = _check_timing_data_coverage(stream_data, required_coverage=0.8)

    assert has_good == True
    assert coverage >= 0.8


def test_check_timing_coverage_poor():
    """Test that poor coverage is detected"""
    from shared.telemetry.f1_data import _check_timing_data_coverage

    stream_data = pd.DataFrame({
        'Driver': ['HAM', 'HAM', 'HAM', 'VER', 'VER', 'VER'],
        'Position': [1, np.nan, np.nan, 2, np.nan, np.nan],
    })

    has_good, coverage = _check_timing_data_coverage(stream_data, required_coverage=0.8)

    assert has_good == False
    assert coverage < 0.8


def test_check_timing_coverage_empty():
    """Test that empty data is handled"""
    from shared.telemetry.f1_data import _check_timing_data_coverage

    stream_data = pd.DataFrame({'Position': []})

    has_good, coverage = _check_timing_data_coverage(stream_data)

    assert has_good == False
    assert coverage == 0.0
