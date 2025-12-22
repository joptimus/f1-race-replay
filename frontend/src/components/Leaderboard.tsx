import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentFrame, useSelectedDriver, useReplayStore } from "../store/replayStore";
import { leaderboardDebugger } from "../utils/leaderboardDebug";

const TYRE_MAP: Record<number, string> = {
  0: '0.0.png', 1: '1.0.png', 2: '2.0.png', 3: '3.0.png', 4: '4.0.png'
};

export const Leaderboard: React.FC = () => {
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();
  const { setSelectedDriver } = useReplayStore();
  const session = useReplayStore((state) => state.session);
  const metadata = session?.metadata;

  // Log frame data for debugging (first 150 frames)
  React.useEffect(() => {
    if (!currentFrame || !currentFrame.drivers) return;

    const frameIndex = Math.round((currentFrame.t || 0) * 25); // Convert time to frame index
    if (frameIndex <= 150) {
      leaderboardDebugger.logFrame(frameIndex, currentFrame.t || 0, currentFrame.drivers);
    }

    // Print report at frame 150
    if (frameIndex === 150) {
      console.log('\n=== Frame 150 Reached - Printing Debug Report ===\n');
      leaderboardDebugger.printReport();
      console.log('\n=== Export Report as JSON ===\n');
      console.log(leaderboardDebugger.exportReport());
    }
  }, [currentFrame]);

  const drivers = React.useMemo(() => {
    if (!currentFrame?.drivers) return [];
    return Object.entries(currentFrame.drivers)
      .map(([code, data]) => {
        // A driver is out if they're retired or have finished the race
        const isRetired = data.status === "Retired" || data.status === "+1L" || data.status?.includes("DNF");
        const isOut = isRetired;
        return {
          code,
          data,
          position: data.position,
          color: metadata?.driver_colors?.[code] || [255, 255, 255],
          isOut,
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [currentFrame, metadata?.driver_colors]);

  const isSafetyCarActive = React.useMemo(() => {
    if (!metadata?.track_statuses || !currentFrame) return false;
    const currentTime = currentFrame.t;
    return metadata.track_statuses.some(
      (status) => status.status === "4" && status.start_time <= currentTime && (status.end_time === null || currentTime < status.end_time)
    );
  }, [metadata?.track_statuses, currentFrame]);

  if (!currentFrame || !metadata || !currentFrame.drivers) return (
    <div className="flex items-center justify-center h-full w-full text-gray-500 text-sm font-semibold tracking-wide font-mono">
      SELECT A RACE
    </div>
  );

  const totalLaps = metadata?.total_laps || 0;
  const currentLap = currentFrame?.lap || 0;

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
      <AnimatePresence mode="wait">
        {isSafetyCarActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full overflow-hidden flex-shrink-0"
          >
            <img
              src="/images/fia/safetycar.png"
              alt="Safety Car"
              className="w-full h-auto block"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mb-3 pb-2 border-b border-f1-border flex-shrink-0">
        <div className="f1-monospace text-[0.85rem] text-f1-red font-black mb-1">
          LAP: <span className="text-base">{currentLap}/{totalLaps}</span>
        </div>
        <div className="f1-monospace text-[0.65rem] text-gray-400">
          TIME: {currentFrame?.t ? (currentFrame.t / 60).toFixed(2) : '0.00'}m | FRAME: {currentFrame?.t !== undefined ? Math.round(currentFrame.t * 25) : 0}
        </div>
      </div>
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-f1-border flex-shrink-0">
        <h3 className="font-black uppercase text-f1-red text-[0.75rem]">STANDINGS</h3>
        <div className="flex gap-4 mr-2 items-center">
          <span className="f1-monospace text-[0.65rem] text-gray-400 w-10 text-right">GAP</span>
          <span className="f1-monospace text-[0.65rem] text-gray-400 w-10 text-right">LEADER</span>
          <span className="f1-monospace text-[0.65rem] text-gray-400 w-6 text-center">TYRE</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex flex-col min-h-0">
        <AnimatePresence mode="popLayout">
          {drivers.map(({ code, data, position, color, isOut }, index) => {
            const isSelected = selectedDriver?.code === code;
            const hexColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            const isFirstOutDriver = isOut && (index === 0 || !drivers[index - 1]?.isOut);

            // Get gap values from backend (updated every 3 seconds)
            const gap_to_previous = data.gap_to_previous || 0;
            const gap_to_leader = data.gap_to_leader || 0;

            const formatGap = (gapSeconds: number): string => {
              if (gapSeconds === 0) return "-";
              return `+${gapSeconds.toFixed(3)}`;
            };

            const gapToPrevious = formatGap(gap_to_previous);
            const gapToLeader = formatGap(gap_to_leader);

            return (
              <React.Fragment key={code}>
                {isFirstOutDriver && currentLap > 1 && (
                  <div className="py-2 my-1 border-t border-b border-red-600 border-opacity-30 text-center">
                    <span className="text-[0.65rem] text-red-500 font-bold uppercase">
                      RETIRED
                    </span>
                  </div>
                )}
                <motion.div
                  layout
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDriver(null);
                    } else {
                      setSelectedDriver({ code, data, color });
                    }
                  }}
                  className={`f1-row ${isSelected ? 'selected' : ''} cursor-pointer`}
                  style={{
                    borderLeft: `4px solid ${isOut ? '#6b7280' : hexColor}`,
                    opacity: isOut ? 0.4 : 1,
                    backgroundColor: isOut ? 'rgba(0, 0, 0, 0.3)' : undefined,
                  }}
                >
                  <span className="f1-monospace w-6 font-black text-[0.75rem]" style={{ color: isOut ? '#6b7280' : 'inherit' }}>{position}</span>
                  <span className="font-bold w-10 text-[0.85rem]" style={{ color: isOut ? '#6b7280' : 'inherit' }}>{code}</span>

                  <div className="ml-auto flex gap-4 items-center">
                    {!isOut && (
                      <>
                        <span className="f1-monospace text-[0.7rem] opacity-80 w-10 text-right">
                          {gapToPrevious}
                        </span>
                        <span className="f1-monospace text-[0.7rem] opacity-80 w-10 text-right">
                          {gapToLeader}
                        </span>
                      </>
                    )}
                  </div>

                  <img
                    src={`/images/tyres/${TYRE_MAP[data.tyre] || '2.png'}`}
                    className="tyre-icon ml-2 h-4 w-auto"
                    style={{ opacity: isOut ? 0.3 : 1 }}
                    onError={(e) => (e.currentTarget.style.opacity = '0')}
                  />
                </motion.div>
              </React.Fragment>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};