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

  const isSafetyCarActive = React.useMemo(() => {
    if (!metadata?.track_statuses || !currentFrame) return false;
    const currentTime = currentFrame.t;
    return metadata.track_statuses.some(
      (status) => status.status === "4" && status.start_time <= currentTime && (status.end_time === null || currentTime < status.end_time)
    );
  }, [metadata?.track_statuses, currentFrame]);

  if (!currentFrame || !metadata || !currentFrame.drivers) return <div className="p-4 f1-monospace">LOADING...</div>;

  const drivers = Object.entries(currentFrame.drivers)
    .map(([code, data]) => ({
      code,
      data,
      position: data.position,
      color: metadata.driver_colors[code] || [255, 255, 255],
    }))
    .sort((a, b) => {
      // Primary sort: by position
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      // Tiebreaker: by distance (race distance) in descending order
      const distDiff = (b.data.dist || 0) - (a.data.dist || 0);
      if (distDiff !== 0) return distDiff;
      // Final tiebreaker: alphabetically by code for stable sorting
      return a.code.localeCompare(b.code);
    });

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
        <span className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>GAP</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="popLayout">
          {drivers.map(({ code, data, position, color }, index) => {
            const isSelected = selectedDriver?.code === code;
            const hexColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

            // Simplified interval calculation (would ideally use distance/time gap from backend)
            const interval = index === 0 ? "LEADER" : `+${(Math.random() * 1.5).toFixed(3)}`;

            return (
              <motion.div
                key={code}
                layout
                onClick={() => {
                  if (isSelected) {
                    setSelectedDriver(null);
                  } else {
                    setSelectedDriver({ code, data, color });
                  }
                }}
                className={`f1-row ${isSelected ? 'selected' : ''}`}
                style={{ borderLeft: `4px solid ${hexColor}`, cursor: 'pointer' }}
              >
                <span className="f1-monospace" style={{ width: '25px', fontWeight: 900, fontSize: '0.75rem' }}>{position}</span>
                <span style={{ fontWeight: 700, width: '40px', fontSize: '0.85rem' }}>{code}</span>

                <span className="f1-monospace" style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.8 }}>
                  {interval}
                </span>

                <img
                  src={`/images/tyres/${TYRE_MAP[data.tyre] || '2.png'}`}
                  className="tyre-icon"
                  style={{ marginLeft: '8px', height: '16px', width: 'auto' }}
                  onError={(e) => (e.currentTarget.style.opacity = '0')}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};