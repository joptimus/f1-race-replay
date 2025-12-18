/**
 * FP1 Dashboard - Practice session with sector telemetry visualization
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrentFrame, useSelectedDriver, useReplayStore } from "../store/replayStore";

const TYRE_MAP: Record<number, string> = {
  0: '0.0.png', 1: '1.0.png', 2: '2.0.png', 3: '3.0.png', 4: '4.0.png'
};

export const FP1Dashboard: React.FC = () => {
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();
  const { setSelectedDriver } = useReplayStore();
  const session = useReplayStore((state) => state.session);
  const metadata = session?.metadata;
  const [expandedTimes, setExpandedTimes] = useState<Set<string>>(new Set());

  if (!currentFrame || !metadata || !currentFrame.drivers) {
    return <div className="p-4 f1-monospace">LOADING...</div>;
  }

  const drivers = Object.entries(currentFrame.drivers)
    .map(([code, data]) => ({
      code,
      data,
      position: data.position,
      color: metadata.driver_colors[code] || [255, 255, 255],
    }))
    .sort((a, b) => a.position - b.position);

  const fastestS1 = Math.min(...drivers.filter(d => d.data.sector1).map(d => d.data.sector1));
  const fastestS2 = Math.min(...drivers.filter(d => d.data.sector2).map(d => d.data.sector2));
  const fastestS3 = Math.min(...drivers.filter(d => d.data.sector3).map(d => d.data.sector3));

  const formatTimeDisplay = (milliseconds: number | null, expanded: boolean = false): string => {
    if (!milliseconds) return "-";
    const seconds = milliseconds / 1000;
    if (seconds < 60) {
      return seconds.toFixed(expanded ? 3 : 1) + "s";
    } else {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const decimalPlaces = expanded ? 3 : 1;
      return `${minutes}:${secs.toFixed(decimalPlaces).padStart(expanded ? 7 : 5, '0')}`;
    }
  };

  const toggleTimeExpanded = (timeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedTimes);
    if (newExpanded.has(timeKey)) {
      newExpanded.delete(timeKey);
    } else {
      newExpanded.add(timeKey);
    }
    setExpandedTimes(newExpanded);
  };

  const SectorCell = ({ value, fastest, timeKey }: { value: number | null; fastest: number; timeKey: string }) => {
    const isExpanded = expandedTimes.has(timeKey);
    let borderColor = '#6b7280';

    if (value && Math.abs(value - fastest) < 0.1) {
      borderColor = '#a855f7';
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <div
          onClick={(e) => toggleTimeExpanded(timeKey, e)}
          className="f1-monospace"
          style={{
            padding: '8px 12px',
            border: `2px solid ${borderColor}`,
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            fontWeight: value && Math.abs(value - fastest) < 0.1 ? 700 : 400,
            color: value && Math.abs(value - fastest) < 0.1 ? borderColor : 'inherit',
            minWidth: '70px',
            textAlign: 'right',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.opacity = '1';
          }}
        >
          {formatTimeDisplay(value, isExpanded)}
        </div>
        <div
          style={{
            height: '4px',
            width: '70px',
            backgroundColor: borderColor,
            borderRadius: '2px',
            opacity: 0.8,
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%', background: 'var(--f1-black)' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--f1-border)', flexShrink: 0 }}>
        <div className="f1-monospace" style={{ fontSize: '0.85rem', color: '#e10600', fontWeight: 900, marginBottom: '4px' }}>
          FP1 - PRACTICE SESSION
        </div>
        <div className="f1-monospace" style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
          TIME: {currentFrame?.t ? (currentFrame.t / 60).toFixed(2) : '0.00'}m | FRAME: {currentFrame?.t !== undefined ? Math.round(currentFrame.t * 25) : 0}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: '#a855f7', borderRadius: '2px' }} />
          <span className="f1-monospace" style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Fastest</span>
        </div>
      </div>

      {/* Drivers List */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        <AnimatePresence mode="popLayout">
          {drivers.map((driver) => {
            const isSelected = selectedDriver?.code === driver.code;
            const hexColor = `rgb(${driver.color[0]}, ${driver.color[1]}, ${driver.color[2]})`;

            return (
              <motion.div
                key={driver.code}
                layout
                onClick={() => {
                  if (isSelected) {
                    setSelectedDriver(null);
                  } else {
                    setSelectedDriver({ code: driver.code, data: driver.data, color: driver.color });
                  }
                }}
                style={{
                  padding: '12px',
                  borderLeft: `3px solid ${hexColor}`,
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'rgba(225, 6, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                whileHover={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span className="f1-monospace" style={{ fontSize: '0.8rem', fontWeight: 900, color: hexColor, minWidth: '25px' }}>
                      P{driver.position}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{driver.code}</span>
                    <span className="f1-monospace" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      LAP {driver.data.lap}
                    </span>
                  </div>
                  <span className="f1-monospace" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Speed: {driver.data.speed.toFixed(0)} km/h
                  </span>
                </div>

                {/* Sectors Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div>
                    <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                      S1
                    </div>
                    <SectorCell value={driver.data.sector1} fastest={fastestS1} timeKey={`${driver.code}-s1`} />
                  </div>
                  <div>
                    <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                      S2
                    </div>
                    <SectorCell value={driver.data.sector2} fastest={fastestS2} timeKey={`${driver.code}-s2`} />
                  </div>
                  <div>
                    <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                      S3
                    </div>
                    <SectorCell value={driver.data.sector3} fastest={fastestS3} timeKey={`${driver.code}-s3`} />
                  </div>
                </div>

                {/* Lap Time */}
                {driver.data.lap_time && driver.data.lap_time > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                      LAP TIME
                    </div>
                    <div
                      onClick={(e) => toggleTimeExpanded(`${driver.code}-lap`, e)}
                      className="f1-monospace"
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #374151',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.opacity = '1';
                      }}
                    >
                      {formatTimeDisplay(driver.data.lap_time, expandedTimes.has(`${driver.code}-lap`))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
