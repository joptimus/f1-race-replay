import React, { useState, useMemo } from "react";
import { useReplayStore } from "../store/replayStore";
import { QualiSegmentName, QualiSegment, QualiSegments } from "../types";
import { useQualiPlayback } from "../hooks/useQualiPlayback";
import { QualiGhostRace } from "./QualiGhostRace";
import { QualiLeaderboard } from "./QualiLeaderboard";
import { QualiPlaybackControls } from "./QualiPlaybackControls";
import { QualiSegmentTabs } from "./QualiSegmentTabs";

export const QualiDashboard: React.FC = () => {
  const session = useReplayStore((state) => state.session);
  const metadata = session?.metadata;

  const [activeSegment, setActiveSegment] = useState<QualiSegmentName>("Q1");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const qualiSegments = metadata?.quali_segments as QualiSegments | undefined;
  const driverColors = metadata?.driver_colors || {};
  const trackGeometry = metadata?.track_geometry;

  const currentSegmentData: QualiSegment | null = useMemo(() => {
    if (!qualiSegments) return null;
    if (activeSegment === "Progressive") return null;
    return qualiSegments[activeSegment] || null;
  }, [qualiSegments, activeSegment]);

  const {
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
  } = useQualiPlayback(currentSegmentData);

  const eliminatedDrivers = useMemo(() => {
    if (!qualiSegments) return [];
    const q2Drivers = new Set(Object.keys(qualiSegments.Q2?.drivers || {}));
    const q3Drivers = new Set(Object.keys(qualiSegments.Q3?.drivers || {}));

    if (activeSegment === "Q1") {
      return [];
    } else if (activeSegment === "Q2") {
      return Object.keys(qualiSegments.Q1?.drivers || {}).filter(
        (code) => !q2Drivers.has(code)
      );
    } else if (activeSegment === "Q3") {
      return Object.keys(qualiSegments.Q1?.drivers || {}).filter(
        (code) => !q3Drivers.has(code)
      );
    }
    return [];
  }, [qualiSegments, activeSegment]);

  const handleDriverClick = (code: string) => {
    setSelectedDriver((prev) => (prev === code ? null : code));
  };

  if (!metadata || !qualiSegments) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/50 font-mono">Loading qualifying data...</div>
      </div>
    );
  }

  const hasQ1 = Object.keys(qualiSegments.Q1?.drivers || {}).length > 0;
  const hasQ2 = Object.keys(qualiSegments.Q2?.drivers || {}).length > 0;
  const hasQ3 = Object.keys(qualiSegments.Q3?.drivers || {}).length > 0;

  return (
    <div className="flex flex-col h-full bg-f1-black">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-f1-red font-bold font-mono text-sm">
            QUALIFYING SESSION
          </div>
          <div className="text-white/50 text-xs font-mono">
            {metadata.year} Round {metadata.round}
          </div>
        </div>
        <QualiSegmentTabs
          activeSegment={activeSegment}
          onSegmentChange={setActiveSegment}
          hasQ1={hasQ1}
          hasQ2={hasQ2}
          hasQ3={hasQ3}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-64 border-r border-white/10 overflow-hidden">
          <QualiLeaderboard
            drivers={drivers}
            driverColors={driverColors}
            selectedDriver={selectedDriver}
            eliminatedDrivers={eliminatedDrivers}
            onDriverClick={handleDriverClick}
          />
        </div>

        <div className="flex-1 relative">
          <QualiGhostRace
            trackGeometry={trackGeometry ?? null}
            drivers={drivers}
            driverColors={driverColors}
            selectedDriver={selectedDriver}
            eliminatedDrivers={eliminatedDrivers}
            onDriverClick={handleDriverClick}
          />

          {selectedDriver && (
            <div className="absolute top-4 right-4 bg-black/80 border border-white/20 rounded-lg p-4 w-48">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold font-mono">{selectedDriver}</span>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {(() => {
                const d = drivers.find((d) => d.code === selectedDriver);
                if (!d) return null;
                return (
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between">
                      <span className="text-white/50">Speed</span>
                      <span>{d.speed.toFixed(0)} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Gear</span>
                      <span>{d.gear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Throttle</span>
                      <span>{d.throttle.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Brake</span>
                      <span>{d.brake.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <QualiPlaybackControls
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onSpeedChange={setSpeed}
        onStepForward={stepForward}
        onStepBackward={stepBackward}
      />
    </div>
  );
};
