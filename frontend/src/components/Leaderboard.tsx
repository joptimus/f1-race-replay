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
      .map(([code, data]) => ({
        code,
        data,
        position: data.position,
        color: metadata?.driver_colors?.[code] || [255, 255, 255],
        isOut: raceStarted && data.speed === 0 && data.rel_dist < 0.99,
      }))
      .sort((a, b) => a.position - b.position);
  }, [currentFrame, metadata?.driver_colors, raceStarted]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--f1-border)' }}>
        <div className="f1-monospace" style={{ fontSize: '0.85rem', color: '#e10600', fontWeight: 900, marginBottom: '4px', position: 'relative', display: 'inline-block' }}>
          LAP: <span style={{ fontSize: '1rem' }}>{currentLap}/{totalLaps}</span>
          <AnimatePresence>
            {isSafetyCarActive && (
              <motion.img
                src="/images/fia/safetycar.png"
                alt="Safety Car"
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-32px',
                  height: '28px',
                  width: 'auto',
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
          TIME: {currentFrame?.t ? (currentFrame.t / 60).toFixed(2) : '0.00'}m | FRAME: {currentFrame?.t !== undefined ? Math.round(currentFrame.t * 25) : 0}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--f1-border)' }}>
        <h3 style={{ fontWeight: 900, textTransform: 'uppercase', color: '#e10600', fontSize: '0.75rem', margin: 0 }}>STANDINGS</h3>
        <div style={{ display: 'flex', gap: '16px', marginRight: '8px', alignItems: 'center' }}>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '40px', textAlign: 'right' }}>GAP</span>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '40px', textAlign: 'right' }}>LEA</span>
          <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af', width: '24px', textAlign: 'center' }}>TYRE</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="popLayout">
          {drivers.map(({ code, data, position, color, isOut }, index) => {
            const isSelected = selectedDriver?.code === code;
            const hexColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            const isFirstOutDriver = isOut && (index === 0 || !drivers[index - 1]?.isOut);

            // Helper function to convert distance gap to time gap in seconds
            const distanceToTime = (distanceGap: number, speed: number): string => {
              if (speed <= 0 || distanceGap <= 0) return "0.000";
              // distance in meters, speed in km/h
              // convert speed to m/s: km/h * 1000 / 3600
              const speedMs = (speed * 1000) / 3600;
              const timeSeconds = distanceGap / speedMs;
              return `+${timeSeconds.toFixed(3)}`;
            };

            // Calculate gap to previous driver (gap to car ahead)
            let gapToPrevious = "LEADER";
            let gapToLeader = "-";

            if (index > 0) {
              const prevDriver = drivers[index - 1];
              if (!prevDriver.isOut) {
                const prevDistance = prevDriver.data.dist || 0;
                const currentDistance = data.dist || 0;
                const distanceGap = prevDistance - currentDistance;
                const prevSpeed = prevDriver.data.speed || 0;
                gapToPrevious = distanceToTime(distanceGap, prevSpeed);
              }
            }

            // Calculate gap to leader
            const leader = drivers.find(d => !d.isOut);
            if (leader && leader.code !== code) {
              const leaderDistance = leader.data.dist || 0;
              const currentDistance = data.dist || 0;
              const distanceGap = leaderDistance - currentDistance;
              const leaderSpeed = leader.data.speed || 0;
              gapToLeader = distanceToTime(distanceGap, leaderSpeed);
            }

            return (
              <React.Fragment key={code}>
                {isFirstOutDriver && (
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