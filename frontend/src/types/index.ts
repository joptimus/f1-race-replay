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
}

export interface FrameData {
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
}

export interface SessionMetadata {
  year: number;
  round: number;
  session_type: string;
  total_frames: number;
  total_laps: number;
  driver_colors: Record<string, [number, number, number]>;
  track_geometry?: TrackGeometry;
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
