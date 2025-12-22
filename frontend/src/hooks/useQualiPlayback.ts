import { useState, useCallback, useRef, useEffect } from "react";
import { QualiSegment, QualiDriverFrame } from "../types";

interface InterpolatedDriver {
  code: string;
  x: number;
  y: number;
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number;
  lapTime: number;
  finished: boolean;
}

interface UseQualiPlaybackReturn {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  drivers: InterpolatedDriver[];
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (time: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

function interpolateDriver(
  frames: QualiDriverFrame[],
  time: number
): Omit<InterpolatedDriver, "code" | "lapTime"> {
  if (!frames || frames.length === 0) {
    return { x: 0, y: 0, speed: 0, gear: 0, throttle: 0, brake: 0, drs: 0, finished: true };
  }

  const lastFrame = frames[frames.length - 1];
  if (time >= lastFrame.t) {
    return {
      x: lastFrame.x,
      y: lastFrame.y,
      speed: lastFrame.speed,
      gear: lastFrame.gear,
      throttle: lastFrame.throttle,
      brake: lastFrame.brake,
      drs: lastFrame.drs,
      finished: true,
    };
  }

  if (time <= 0) {
    const first = frames[0];
    return {
      x: first.x,
      y: first.y,
      speed: first.speed,
      gear: first.gear,
      throttle: first.throttle,
      brake: first.brake,
      drs: first.drs,
      finished: false,
    };
  }

  let low = 0;
  let high = frames.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].t <= time) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const f0 = frames[low];
  const f1 = frames[high];
  const t = (time - f0.t) / (f1.t - f0.t);

  return {
    x: f0.x + (f1.x - f0.x) * t,
    y: f0.y + (f1.y - f0.y) * t,
    speed: f0.speed + (f1.speed - f0.speed) * t,
    gear: Math.round(f0.gear + (f1.gear - f0.gear) * t),
    throttle: f0.throttle + (f1.throttle - f0.throttle) * t,
    brake: f0.brake + (f1.brake - f0.brake) * t,
    drs: f0.drs,
    finished: false,
  };
}

export function useQualiPlayback(
  segment: QualiSegment | null
): UseQualiPlaybackReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const duration = segment?.duration ?? 0;

  const interpolateAllDrivers = useCallback(
    (time: number): InterpolatedDriver[] => {
      if (!segment) return [];
      return Object.entries(segment.drivers).map(([code, data]) => {
        const interpolated = interpolateDriver(data.frames, time);
        return {
          code,
          lapTime: data.lap_time,
          ...interpolated,
        };
      });
    },
    [segment]
  );

  const [drivers, setDrivers] = useState<InterpolatedDriver[]>([]);

  useEffect(() => {
    setDrivers(interpolateAllDrivers(currentTime));
  }, [currentTime, interpolateAllDrivers]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + delta * speed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed, duration]);

  const play = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying(true);
  }, [currentTime, duration]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const setSpeed = useCallback((s: number) => setSpeedState(s), []);

  const seek = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(0, Math.min(time, duration)));
    },
    [duration]
  );

  const stepForward = useCallback(() => {
    setCurrentTime((prev) => Math.min(prev + 1 / 25, duration));
  }, [duration]);

  const stepBackward = useCallback(() => {
    setCurrentTime((prev) => Math.max(prev - 1 / 25, 0));
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, [segment]);

  return {
    currentTime,
    duration,
    isPlaying,
    speed,
    drivers,
    play,
    pause,
    setSpeed,
    seek,
    stepForward,
    stepBackward,
  };
}
