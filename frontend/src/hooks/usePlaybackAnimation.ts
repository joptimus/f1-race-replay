/**
 * Animation loop hook for advancing playback frameIndex
 * Synchronizes frontend state with backend playback timing
 */

import { useEffect, useRef } from "react";
import { useReplayStore } from "../store/replayStore";

const FPS = 25; // Frames per second

export const usePlaybackAnimation = () => {
  const { isPlaying, speed, frameIndex, totalFrames } = useReplayStore((state) => ({
    isPlaying: state.playback.isPlaying,
    speed: state.playback.speed,
    frameIndex: state.playback.frameIndex,
    totalFrames: state.playback.totalFrames,
  }));

  const setFrameIndex = useReplayStore((state) => state.setFrameIndex);
  const pause = useReplayStore((state) => state.pause);

  const startTimeRef = useRef<number | null>(null);
  const startFrameRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      startTimeRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Initialize start time and frame on first play
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
      startFrameRef.current = frameIndex;
    }

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) return;

      // Calculate elapsed time in seconds
      const elapsedSeconds = (currentTime - startTimeRef.current) / 1000;

      // Calculate new frame index: startFrame + (elapsed * speed * FPS)
      const newFrameIndex =
        startFrameRef.current + elapsedSeconds * speed * FPS;

      if (newFrameIndex >= totalFrames - 1) {
        // Reached end of race
        setFrameIndex(totalFrames - 1);
        pause();
      } else {
        setFrameIndex(Math.floor(newFrameIndex));
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, speed, totalFrames, setFrameIndex, pause]);
};
