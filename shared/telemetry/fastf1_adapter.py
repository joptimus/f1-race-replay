"""
Adapter layer for FastF1 API calls.

Isolates FastF1 API usage to enable future upgrades without code changes.
All timedelta conversion happens here (once, not per-frame).

Exports:
- get_stream_timing(session) -> DataFrame
- get_track_status(session) -> DataFrame
- get_lap_timing(session) -> DataFrame
- get_position_data(session) -> dict
"""

from typing import Dict

import fastf1
import pandas as pd
from fastf1.core import Session


def get_stream_timing(session: Session) -> pd.DataFrame:
    """
    Adapter: Get stream-level timing data (FIA tower updates ~240ms).

    Returns:
        DataFrame with columns: Time, Driver, Position, GapToLeader_s, Interval_s
        - GapToLeader_s and Interval_s are already converted to seconds (timedelta → float)
    """
    if not session.api_path:
        raise ValueError("Session does not have API path available")

    try:
        laps_data, stream_data = fastf1.api.timing_data(session.api_path)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch stream timing: {e}") from e

    try:
        stream_data["GapToLeader_s"] = stream_data["GapToLeader"].dt.total_seconds()
        stream_data["Interval_s"] = stream_data["IntervalToPositionAhead"].dt.total_seconds()
    except KeyError as e:
        raise RuntimeError(f"Expected column missing in stream data: {e}") from e

    return stream_data


def get_track_status(session: Session) -> pd.DataFrame:
    """
    Adapter: Get track status (SC/VSC/Red Flag detection).

    Returns:
        DataFrame with columns: Time, Status (str), Message (str)
        Status codes: '1'=Green, '4'=SC, '6'=VSC, '7'=Red
    """
    if not session.api_path:
        raise ValueError("Session does not have API path available")

    try:
        return fastf1.api.track_status_data(session.api_path)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch track status: {e}") from e


def get_lap_timing(session: Session) -> pd.DataFrame:
    """
    Adapter: Get lap-level timing data with lap positions.

    Returns:
        DataFrame with lap information and official positions
    """
    if not session.api_path:
        raise ValueError("Session does not have API path available")

    try:
        return fastf1.api.timing_app_data(session.api_path)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch lap timing: {e}") from e


def get_position_data(session: Session) -> Dict:
    """
    Adapter: Get GPS position data (X, Y, Z coordinates).

    Returns:
        dict mapping driver_num -> DataFrame with X, Y, Z, Time columns
    """
    if session.pos_data is None:
        raise ValueError("Session does not have position data")

    return session.pos_data
