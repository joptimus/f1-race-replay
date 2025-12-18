import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from shared.telemetry.f1_data import (
    get_race_telemetry,
    get_quali_telemetry,
    load_session,
)
from shared.utils.track_geometry import build_track_from_example_lap


class F1ReplaySession:
    def __init__(self, year: int, round_num: int, session_type: str, refresh: bool = False):
        self.year = year
        self.round_num = round_num
        self.session_type = session_type
        self.refresh = refresh
        self.frames = None
        self.driver_colors = {}
        self.total_laps = 0
        self.track_statuses = []
        self.track_geometry = None
        self.is_loaded = False
        self.load_error = None

    async def load_data(self):
        try:
            session = load_session(self.year, self.round_num, self.session_type)

            if self.session_type in ["Q", "SQ"]:
                data = get_quali_telemetry(session, session_type=self.session_type, refresh=self.refresh)
                self.frames = data.get("frames", [])
                self.driver_colors = data.get("driver_colors", {})
            else:
                data = get_race_telemetry(session, session_type=self.session_type, refresh=self.refresh)
                self.frames = data.get("frames", [])
                self.driver_colors = data.get("driver_colors", {})
                self.track_statuses = data.get("track_statuses", [])
                self.total_laps = data.get("total_laps", 0)

            try:
                fastest_lap_obj = session.laps.pick_fastest()
                fastest_lap_telem = fastest_lap_obj.get_telemetry()
                track_data = build_track_from_example_lap(fastest_lap_telem, lap_obj=fastest_lap_obj)
                self.track_geometry = {
                    "centerline_x": [float(x) for x in track_data[0]],
                    "centerline_y": [float(y) for y in track_data[1]],
                    "inner_x": [float(x) for x in track_data[2]],
                    "inner_y": [float(y) for y in track_data[3]],
                    "outer_x": [float(x) for x in track_data[4]],
                    "outer_y": [float(y) for y in track_data[5]],
                    "x_min": float(track_data[6]),
                    "x_max": float(track_data[7]),
                    "y_min": float(track_data[8]),
                    "y_max": float(track_data[9]),
                }
                if track_data[10] is not None:
                    self.track_geometry["sector"] = [int(s) for s in track_data[10]]
            except Exception as e:
                print(f"Warning: Could not build track geometry: {e}")
                import traceback
                traceback.print_exc()
                self.track_geometry = None

            self.is_loaded = True
        except Exception as e:
            self.load_error = str(e)
            self.is_loaded = True

    def serialize_frame(self, frame_index: int) -> str:
        if not self.frames or frame_index >= len(self.frames):
            return json.dumps({"error": "Invalid frame index"})

        def safe_float(value, default=0.0):
            try:
                f = float(value)
                if f != f or not (-1e308 < f < 1e308):
                    return default
                return f
            except (ValueError, TypeError):
                return default

        frame = self.frames[frame_index]

        payload = {
            "t": safe_float(frame.get("t"), 0.0),
            "lap": frame.get("lap", 1),
            "drivers": {},
        }

        for driver_code, driver_data in frame.get("drivers", {}).items():
            payload["drivers"][driver_code] = {
                "x": safe_float(driver_data.get("x")),
                "y": safe_float(driver_data.get("y")),
                "speed": safe_float(driver_data.get("speed")),
                "gear": int(driver_data.get("gear", 0)),
                "lap": int(driver_data.get("lap", 0)),
                "position": int(driver_data.get("position", 0)),
                "tyre": int(driver_data.get("tyre", 0)),
                "throttle": safe_float(driver_data.get("throttle")),
                "brake": safe_float(driver_data.get("brake")),
                "drs": int(driver_data.get("drs", 0)),
                "dist": safe_float(driver_data.get("dist")),
                "rel_dist": safe_float(driver_data.get("rel_dist")),
                "race_progress": safe_float(driver_data.get("race_progress")),
            }

        if "weather" in frame:
            payload["weather"] = frame["weather"]

        return json.dumps(payload)

    def get_metadata(self) -> dict:
        return {
            "year": self.year,
            "round": self.round_num,
            "session_type": self.session_type,
            "total_frames": len(self.frames) if self.frames else 0,
            "total_laps": self.total_laps,
            "driver_colors": {
                code: list(color) if isinstance(color, tuple) else color
                for code, color in self.driver_colors.items()
            },
            "track_geometry": self.track_geometry,
            "error": self.load_error,
        }
