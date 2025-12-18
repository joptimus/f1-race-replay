from fastapi import APIRouter, HTTPException
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from backend.models.lap_telemetry import LapTelemetryRequest, LapTelemetryResponse, SectorTimesResponse
from shared.telemetry.f1_data import load_session, get_lap_telemetry, get_sector_times

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.post("/laps", response_model=LapTelemetryResponse)
async def get_lap_telemetry_endpoint(request: LapTelemetryRequest):
    """
    Get detailed telemetry for specific drivers and laps.

    Returns telemetry data points (distance, speed, throttle, brake, rpm, gear, x, y)
    for comparison between drivers.
    """
    try:
        session = load_session(request.year, request.round_num, request.session_type)
        laps_data = get_lap_telemetry(session, request.driver_codes, request.lap_numbers)
        return {"laps": laps_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get lap telemetry: {str(e)}")


@router.post("/sectors", response_model=SectorTimesResponse)
async def get_sector_times_endpoint(request: LapTelemetryRequest):
    """
    Get sector times for specific drivers and laps.

    Returns sector 1, 2, 3 times and total lap time for lap timing analysis.
    """
    try:
        session = load_session(request.year, request.round_num, request.session_type)
        sectors_data = get_sector_times(session, request.driver_codes, request.lap_numbers)
        return {"sectors": sectors_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get sector times: {str(e)}")
