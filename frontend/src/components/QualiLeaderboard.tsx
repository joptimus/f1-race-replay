import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Driver {
  code: string;
  lapTime: number;
  finished: boolean;
}

interface QualiLeaderboardProps {
  drivers: Driver[];
  driverColors: Record<string, number[]>;
  selectedDriver: string | null;
  eliminatedDrivers: string[];
  onDriverClick: (code: string) => void;
}

export const QualiLeaderboard: React.FC<QualiLeaderboardProps> = ({
  drivers,
  driverColors,
  selectedDriver,
  eliminatedDrivers,
  onDriverClick,
}) => {
  const sortedDrivers = [...drivers].sort((a, b) => a.lapTime - b.lapTime);

  const formatLapTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  };

  const fastestLap = sortedDrivers[0]?.lapTime ?? 0;

  return (
    <div className="flex flex-col gap-1 p-3 bg-black/30 rounded-lg overflow-auto max-h-full">
      <div className="text-xs text-white/50 font-mono mb-2 font-bold">
        LEADERBOARD
      </div>
      <AnimatePresence mode="popLayout">
        {sortedDrivers.map((driver, idx) => {
          const color = driverColors[driver.code] || [128, 128, 128];
          const isSelected = driver.code === selectedDriver;
          const isEliminated = eliminatedDrivers.includes(driver.code);
          const gap = idx === 0 ? null : driver.lapTime - fastestLap;

          return (
            <motion.div
              key={driver.code}
              layout
              onClick={() => onDriverClick(driver.code)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                isSelected
                  ? "bg-f1-red/30"
                  : isEliminated
                  ? "opacity-30"
                  : "hover:bg-white/10"
              }`}
              style={{
                borderLeft: `3px solid rgb(${color[0]}, ${color[1]}, ${color[2]})`,
              }}
            >
              <span
                className="text-xs font-bold font-mono w-5"
                style={{ color: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
              >
                {idx + 1}
              </span>
              <span className="text-sm font-semibold flex-1">{driver.code}</span>
              <div className="text-right">
                <div
                  className={`text-xs font-mono ${
                    idx === 0 ? "text-purple-400" : "text-white/70"
                  }`}
                >
                  {formatLapTime(driver.lapTime)}
                </div>
                {gap !== null && (
                  <div className="text-[10px] font-mono text-white/40">
                    +{(gap / 1000).toFixed(3)}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
