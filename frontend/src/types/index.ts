/**
 * Type definitions for F1 Race Replay
 */

export interface DriverData {
  x: number;
  y: number;
  speed: number;
  gear: number;
  lap: number;
  position: number;
  tyre: number;
  throttle: number;
  brake: number;
  drs: number;
  dist: number;
  rel_dist: number;
  race_progress: number;
  lap_time?: number | null;
  sector1?: number | null;
  sector2?: number | null;
  sector3?: number | null;
  status?: string;
  gap_to_previous?: number;
  gap_to_leader?: number;
}

export interface FrameData {
  frame_index?: number;
  t: number;
  lap: number;
  drivers: Record<string, DriverData>;
  weather?: WeatherData;
  error?: string;
}

export interface WeatherData {
  track_temp: number;
  air_temp: number;
  humidity: number;
  wind_speed: number;
  wind_direction: number;
  rain_state: string;
}

export interface TrackGeometry {
  centerline_x: number[];
  centerline_y: number[];
  inner_x: number[];
  inner_y: number[];
  outer_x: number[];
  outer_y: number[];
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  sector?: number[];
}

export interface TrackStatus {
  status: string;
  start_time: number;
  end_time: number | null;
}

export interface SessionMetadata {
  year: number;
  round: number;
  session_type: string;
  total_frames: number;
  total_laps: number;
  driver_colors: Record<string, [number, number, number]>;
  track_geometry?: TrackGeometry;
  track_statuses?: TrackStatus[];
  race_start_time?: number;
  quali_segments?: QualiSegments;
  error?: string;
}

export interface SessionState {
  sessionId: string | null;
  metadata: SessionMetadata | null;
  isLoading: boolean;
  error: string | null;
}

export interface PlaybackState {
  isPlaying: boolean;
  speed: number; // 0.25x, 0.5x, 1x, 2x, 4x
  frameIndex: number;
  currentTime: number;
  totalFrames: number;
}

export interface SelectedDriver {
  code: string;
  data: DriverData;
  color: [number, number, number];
}

// Tyre compound mapping
export const TYRE_NAMES = {
  0: "SOFT",
  1: "MEDIUM",
  2: "HARD",
  3: "INTERMEDIATE",
  4: "WET",
};

export const TYRE_COLORS = {
  0: "#FF0000", // SOFT - Red
  1: "#FFFF00", // MEDIUM - Yellow
  2: "#FFFFFF", // HARD - White
  3: "#00FF00", // INTERMEDIATE - Green
  4: "#0000FF", // WET - Blue
};

// DRS status
export enum DRS_STATUS {
  OFF = 0,
  AVAILABLE = 8,
  ACTIVE_1 = 10,
  ACTIVE_2 = 12,
  ACTIVE_3 = 14,
}

// Telemetry comparison types
export interface LapTelemetryPoint {
  distance: number;
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  gear: number;
  x: number;
  y: number;
}

export interface DriverLapTelemetry {
  driver_code: string;
  lap_number: number;
  lap_time: number | null;
  telemetry: LapTelemetryPoint[];
}

export interface SectorTime {
  driver_code: string;
  lap_number: number;
  sector_1: number | null;
  sector_2: number | null;
  sector_3: number | null;
  lap_time: number | null;
}

export interface ComparisonDriver {
  code: string;
  color: [number, number, number];
  lapNumber: number;
}

export interface QualiDriverFrame {
  t: number;
  x: number;
  y: number;
  dist: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number;
}

export interface QualiDriverData {
  frames: QualiDriverFrame[];
  lap_time: number;
}

export interface QualiSegment {
  duration: number;
  drivers: Record<string, QualiDriverData>;
}

export interface QualiSegments {
  Q1: QualiSegment;
  Q2: QualiSegment;
  Q3: QualiSegment;
}

export interface QualiResult {
  code: string;
  position: number;
  color: [number, number, number];
  Q1: string | null;
  Q2: string | null;
  Q3: string | null;
}

export type QualiSegmentName = "Q1" | "Q2" | "Q3" | "Progressive";
