from pydantic import BaseModel
from typing import List, Optional


class LapTelemetryRequest(BaseModel):
    year: int
    round_num: int
    session_type: str = "R"
    driver_codes: List[str]
    lap_numbers: List[int]


class TelemetryPoint(BaseModel):
    distance: float
    speed: float
    throttle: float
    brake: float
    rpm: int
    gear: int
    x: float
    y: float


class DriverLapTelemetry(BaseModel):
    driver_code: str
    lap_number: int
    lap_time: Optional[float]
    telemetry: List[TelemetryPoint]


class LapTelemetryResponse(BaseModel):
    laps: List[DriverLapTelemetry]


class SectorTimeData(BaseModel):
    driver_code: str
    lap_number: int
    sector_1: Optional[float]
    sector_2: Optional[float]
    sector_3: Optional[float]
    lap_time: Optional[float]


class SectorTimesResponse(BaseModel):
    sectors: List[SectorTimeData]
