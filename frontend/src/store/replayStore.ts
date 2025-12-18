/**
 * Zustand store for managing F1 replay state
 * Optimized for minimal re-renders with selective subscriptions
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  FrameData,
  PlaybackState,
  SessionState,
  SelectedDriver,
  SessionMetadata,
} from "../types";

interface ReplayStore {
  // Session management
  session: SessionState;
  setSession: (sessionId: string, metadata: SessionMetadata) => void;
  setSessionLoading: (loading: boolean) => void;
  setSessionError: (error: string) => void;

  // Frame data (current frame only - avoid storing huge arrays)
  currentFrame: FrameData | null;
  setCurrentFrame: (frame: FrameData) => void;

  // Playback control
  playback: PlaybackState;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (frameIndex: number) => void;
  setFrameIndex: (frameIndex: number) => void;
  setTotalFrames: (total: number) => void;

  // Driver selection
  selectedDriver: SelectedDriver | null;
  setSelectedDriver: (driver: SelectedDriver | null) => void;

  // Leaderboard visibility
  showLeaderboard: boolean;
  toggleLeaderboard: () => void;

  // UI state
  showTelemetryChart: boolean;
  toggleTelemetryChart: () => void;

  // Sector colors visibility
  showSectorColors: boolean;
  toggleSectorColors: () => void;
}

export const useReplayStore = create<ReplayStore>()(
  subscribeWithSelector((set) => ({
    // Session state
    session: {
      sessionId: null,
      metadata: null,
      isLoading: false,
      error: null,
    },

    setSession: (sessionId: string, metadata: SessionMetadata) =>
      set({
        session: {
          sessionId,
          metadata,
          isLoading: false,
          error: null,
        },
      }),

    setSessionLoading: (loading: boolean) =>
      set((state) => ({
        session: { ...state.session, isLoading: loading },
      })),

    setSessionError: (error: string) =>
      set((state) => ({
        session: { ...state.session, error, isLoading: false },
      })),

    // Frame data
    currentFrame: null,
    setCurrentFrame: (frame: FrameData) => set({ currentFrame: frame }),

    // Playback state
    playback: {
      isPlaying: false,
      speed: 1.0,
      frameIndex: 0,
      currentTime: 0,
      totalFrames: 0,
    },

    play: () =>
      set((state) => ({
        playback: { ...state.playback, isPlaying: true },
      })),

    pause: () =>
      set((state) => ({
        playback: { ...state.playback, isPlaying: false },
      })),

    setSpeed: (speed: number) =>
      set((state) => ({
        playback: { ...state.playback, speed },
      })),

    seek: (frameIndex: number) =>
      set((state) => ({
        playback: { ...state.playback, frameIndex },
      })),

    setFrameIndex: (frameIndex: number) =>
      set((state) => ({
        playback: { ...state.playback, frameIndex },
      })),

    setTotalFrames: (total: number) =>
      set((state) => ({
        playback: { ...state.playback, totalFrames: total },
      })),

    // Driver selection
    selectedDriver: null,
    setSelectedDriver: (driver: SelectedDriver | null) =>
      set({ selectedDriver: driver }),

    // Leaderboard
    showLeaderboard: true,
    toggleLeaderboard: () =>
      set((state) => ({
        showLeaderboard: !state.showLeaderboard,
      })),

    // Telemetry chart
    showTelemetryChart: false,
    toggleTelemetryChart: () =>
      set((state) => ({
        showTelemetryChart: !state.showTelemetryChart,
      })),

    // Sector colors
    showSectorColors: true,
    toggleSectorColors: () =>
      set((state) => ({
        showSectorColors: !state.showSectorColors,
      })),
  }))
);

// Selectors for components to subscribe to only the parts they need
export const usePlaybackState = () =>
  useReplayStore((state) => state.playback);

export const usePlaybackControls = () =>
  useReplayStore((state) => ({
    play: state.play,
    pause: state.pause,
    setSpeed: state.setSpeed,
    seek: state.seek,
  }));

export const useCurrentFrame = () =>
  useReplayStore((state) => state.currentFrame);

export const useSelectedDriver = () =>
  useReplayStore((state) => state.selectedDriver);

export const useSessionMetadata = () =>
  useReplayStore((state) => state.session.metadata);

export const useLeaderboard = () =>
  useReplayStore((state) => ({
    isVisible: state.showLeaderboard,
    toggle: state.toggleLeaderboard,
  }));

export const useSectorColors = () =>
  useReplayStore((state) => ({
    isEnabled: state.showSectorColors,
    toggle: state.toggleSectorColors,
  }));
