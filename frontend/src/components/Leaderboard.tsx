import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentFrame, useSelectedDriver, useReplayStore } from "../store/replayStore";

const TYRE_MAP: Record<number, string> = {
  0: '0.0.png', 1: '1.0.png', 2: '2.0.png', 3: '3.0.png', 4: '4.0.png'
};

export const Leaderboard: React.FC = () => {
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();
  const { setSelectedDriver } = useReplayStore();
  const session = useReplayStore((state) => state.session);
  const metadata = session?.metadata;

  const raceStarted = React.useMemo(() => {
    if (!metadata?.race_start_time || !currentFrame) return false;
    return currentFrame.t >= metadata.race_start_time;
  }, [metadata?.race_start_time, currentFrame?.t]);

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

  if (!currentFrame || !metadata || !currentFrame.drivers) return <div className="p-4 f1-monospace">LOADING...</div>;

  const totalLaps = metadata?.total_laps || 0;
  const currentLap = currentFrame?.lap || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
      <AnimatePresence mode="wait">
        {isSafetyCarActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{
              width: '100%',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src="/images/fia/safetycar.png"
              alt="Safety Car"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--f1-border)', flexShrink: 0 }}>
        <div className="f1-monospace" style={{ fontSize: '0.85rem', color: '#e10600', fontWeight: 900, marginBottom: '4px' }}>
          LAP: <span style={{ fontSize: '1rem' }}>{currentLap}/{totalLaps}</span>
        </div>
        <div className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
          TIME: {currentFrame?.t ? (currentFrame.t / 60).toFixed(2) : '0.00'}m | FRAME: {currentFrame?.t !== undefined ? Math.round(currentFrame.t * 25) : 0}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--f1-border)', flexShrink: 0 }}>
        <h3 style={{ fontWeight: 900, textTransform: 'uppercase', color: '#e10600', fontSize: '0.75rem', margin: 0 }}>STANDINGS</h3>
        <div style={{ display: 'flex', gap: '16px', marginRight: '8px', alignItems: 'center' }}>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '40px', textAlign: 'right' }}>GAP</span>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '40px', textAlign: 'right' }}>LEA</span>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '24px', textAlign: 'center' }}>TYRE</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AnimatePresence mode="popLayout">
          {drivers.map(({ code, data, position, color, isOut }, index) => {
            const isSelected = selectedDriver?.code === code;
            const hexColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            const isFirstOutDriver = isOut && (index === 0 || !drivers[index - 1]?.isOut);

            // Get gap values from backend (updated every 3 seconds)
            const gap_to_previous = data.gap_to_previous || 0;
            const gap_to_leader = data.gap_to_leader || 0;

            const formatGap = (gapSeconds: number): string => {
              if (gapSeconds === 0) return "LEADER";
              return `+${gapSeconds.toFixed(3)}`;
            };

            const gapToPrevious = formatGap(gap_to_previous);
            const gapToLeader = formatGap(gap_to_leader);

            return (
              <React.Fragment key={code}>
                {isFirstOutDriver && currentLap > 1 && (
                  <div
                    style={{
                      padding: '8px 0',
                      margin: '4px 0',
                      borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                      borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
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
                  className={`f1-row ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderLeft: `4px solid ${isOut ? '#6b7280' : hexColor}`,
                    cursor: 'pointer',
                    opacity: isOut ? 0.4 : 1,
                    backgroundColor: isOut ? 'rgba(0, 0, 0, 0.3)' : undefined,
                    pointerEvents: isOut ? 'auto' : 'auto',
                  }}
                >
                  <span className="f1-monospace" style={{ width: '25px', fontWeight: 900, fontSize: '0.75rem', color: isOut ? '#6b7280' : 'inherit' }}>{position}</span>
                  <span style={{ fontWeight: 700, width: '40px', fontSize: '0.85rem', color: isOut ? '#6b7280' : 'inherit' }}>{code}</span>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {!isOut && (
                      <>
                        <span className="f1-monospace" style={{ fontSize: '0.7rem', opacity: 0.8, width: '40px', textAlign: 'right' }}>
                          {gapToPrevious}
                        </span>
                        <span className="f1-monospace" style={{ fontSize: '0.7rem', opacity: 0.8, width: '40px', textAlign: 'right' }}>
                          {gapToLeader}
                        </span>
                      </>
                    )}
                  </div>

                  <img
                    src={`/images/tyres/${TYRE_MAP[data.tyre] || '2.png'}`}
                    className="tyre-icon"
                    style={{ marginLeft: '8px', height: '16px', width: 'auto', opacity: isOut ? 0.3 : 1 }}
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