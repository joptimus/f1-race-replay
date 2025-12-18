import json
import sys
from pathlib import Path
import msgpack

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
        self.driver_numbers = {}
        self.driver_teams = {}
        self.total_laps = 0
        self.track_statuses = []
        self.race_start_time = None
        self.track_geometry = None
        self.is_loaded = False
        self.load_error = None
        self._serialized_frames = None
        self._msgpack_frames = None
        self.loading_status = "Initializing..."

    async def load_data(self):
        try:
            self.loading_status = f"Loading session {self.year} R{self.round_num}..."
            print(f"[REPLAY] {self.loading_status}")
            session = load_session(self.year, self.round_num, self.session_type)
            self.loading_status = "Session loaded, fetching telemetry..."
            print(f"[REPLAY] {self.loading_status}")

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
                self.race_start_time = data.get("race_start_time", None)

            self.driver_numbers = self._extract_driver_numbers(session)
            self.driver_teams = self._extract_driver_teams(session)

            self.loading_status = f"Loaded {len(self.frames)} frames, building track geometry..."
            print(f"[REPLAY] {self.loading_status}")

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
                self.loading_status = "Track geometry built successfully"
                print(f"[REPLAY] {self.loading_status}")
            except Exception as e:
                print(f"[REPLAY] Warning: Could not build track geometry: {e}")
                import traceback
                traceback.print_exc()
                self.track_geometry = None

            self.loading_status = f"Pre-serializing {len(self.frames)} frames..."
            print(f"[REPLAY] {self.loading_status}")
            self._pre_serialize_frames()
            self.loading_status = "Ready"
            print(f"[REPLAY] Session fully loaded and ready")
            self.is_loaded = True
        except Exception as e:
            self.load_error = str(e)
            self.is_loaded = True

    def _pre_serialize_frames(self) -> None:
        if not self.frames:
            self._serialized_frames = []
            self._msgpack_frames = []
            return

        # For large frame counts, don't pre-serialize everything upfront
        # Instead, serialize on-demand for better responsiveness
        # Large races (>100k frames) can take minutes to serialize
        frame_count = len(self.frames)
        if frame_count > 50000:
            # Only pre-serialize every Nth frame for quick lookup
            # This reduces startup time from minutes to seconds
            print(f"[REPLAY] Large session ({frame_count} frames), using lazy serialization")
            self._serialized_frames = None
            self._msgpack_frames = None
        else:
            # Small sessions: pre-serialize everything for speed
            print(f"[REPLAY] Small session ({frame_count} frames), pre-serializing all frames")
            self._serialized_frames = [
                self._build_frame_payload_json(i) for i in range(frame_count)
            ]
            self._msgpack_frames = [
                self._build_frame_payload_msgpack(i) for i in range(frame_count)
            ]

    def _build_frame_payload_json(self, frame_index: int) -> str:
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
            "frame_index": frame_index,
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
                "lap_time": safe_float(driver_data.get("lap_time")) if driver_data.get("lap_time") is not None else None,
                "sector1": safe_float(driver_data.get("sector1")) if driver_data.get("sector1") is not None else None,
                "sector2": safe_float(driver_data.get("sector2")) if driver_data.get("sector2") is not None else None,
                "sector3": safe_float(driver_data.get("sector3")) if driver_data.get("sector3") is not None else None,
                "status": driver_data.get("status", "Running"),
            }

        if "weather" in frame:
            payload["weather"] = frame["weather"]

        return json.dumps(payload)

    def _build_frame_payload_msgpack(self, frame_index: int) -> bytes:
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
            "frame_index": frame_index,
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
                "lap_time": safe_float(driver_data.get("lap_time")) if driver_data.get("lap_time") is not None else None,
                "sector1": safe_float(driver_data.get("sector1")) if driver_data.get("sector1") is not None else None,
                "sector2": safe_float(driver_data.get("sector2")) if driver_data.get("sector2") is not None else None,
                "sector3": safe_float(driver_data.get("sector3")) if driver_data.get("sector3") is not None else None,
                "status": driver_data.get("status", "Running"),
            }

        if "weather" in frame:
            payload["weather"] = frame["weather"]

        return msgpack.packb(payload, use_bin_type=True)

    def serialize_frame(self, frame_index: int) -> str:
        if not self.frames or frame_index < 0 or frame_index >= len(self.frames):
            return json.dumps({"error": "Invalid frame index"})

        # Use cached version if available
        if self._serialized_frames:
            return self._serialized_frames[frame_index]

        # Fall back to on-demand serialization for large sessions
        return self._build_frame_payload_json(frame_index)

    def serialize_frame_msgpack(self, frame_index: int) -> bytes:
        if not self.frames or frame_index < 0 or frame_index >= len(self.frames):
            return msgpack.packb({"error": "Invalid frame index"}, use_bin_type=True)

        # Use cached version if available
        if self._msgpack_frames:
            return self._msgpack_frames[frame_index]

        # Fall back to on-demand serialization for large sessions
        return self._build_frame_payload_msgpack(frame_index)

    def _extract_driver_numbers(self, session) -> dict:
        driver_numbers = {}
        try:
            for driver_num in session.drivers:
                driver_info = session.get_driver(driver_num)
                abbreviation = driver_info["Abbreviation"]
                car_number = driver_info["DriverNumber"]
                if abbreviation and car_number:
                    driver_numbers[abbreviation] = str(int(car_number))
        except Exception as e:
            pass
        return driver_numbers

    def _extract_driver_teams(self, session) -> dict:
        driver_teams = {}
        try:
            for driver_num in session.drivers:
                driver_info = session.get_driver(driver_num)
                abbreviation = driver_info["Abbreviation"]
                team_name = driver_info["TeamId"]
                if abbreviation and team_name:
                    driver_teams[abbreviation] = team_name
        except Exception as e:
            pass
        return driver_teams

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
            "driver_numbers": self.driver_numbers,
            "driver_teams": self.driver_teams,
            "track_geometry": self.track_geometry,
            "track_statuses": self.track_statuses,
            "race_start_time": self.race_start_time,
            "error": self.load_error,
        }
