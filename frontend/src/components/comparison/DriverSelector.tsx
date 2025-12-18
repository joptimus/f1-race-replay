import React, { useState } from "react";
import { useSessionMetadata } from "../../store/replayStore";
import { useComparisonStore } from "../../store/comparisonStore";
import { motion } from "framer-motion";

type SyncMode = 'none' | 'same-lap' | 'live';

export const DriverSelector: React.FC = () => {
  const metadata = useSessionMetadata();
  const { selectedDrivers, addDriver, removeDriver, updateDriverLap } = useComparisonStore();
  const [lapNumbers, setLapNumbers] = useState<Record<string, number>>({});
  const [syncMode, setSyncMode] = useState<SyncMode>('none');

  if (!metadata) return <div>No session loaded</div>;

  const availableDrivers = Object.entries(metadata.driver_colors).map(([code, color]) => ({
    code,
    color: color as [number, number, number],
  }));

  const isSelected = (code: string) => selectedDrivers.some(d => d.code === code);

  const handleToggleDriver = (code: string, color: [number, number, number]) => {
    if (isSelected(code)) {
      removeDriver(code);
    } else {
      const lapNumber = lapNumbers[code] || 1;
      addDriver({ code, color, lapNumber });
    }
  };

  const handleLapChange = (code: string, lapNumber: number) => {
    setLapNumbers(prev => ({ ...prev, [code]: lapNumber }));
    if (isSelected(code)) {
      updateDriverLap(code, lapNumber);
    }
  };

  const handleSyncMode = (mode: SyncMode) => {
    setSyncMode(mode);
    if (mode === 'same-lap' && selectedDrivers.length > 0) {
      const firstLap = selectedDrivers[0].lapNumber;
      selectedDrivers.forEach(driver => {
        updateDriverLap(driver.code, firstLap);
        setLapNumbers(prev => ({ ...prev, [driver.code]: firstLap }));
      });
    } else if (mode === 'live' && selectedDrivers.length > 0) {
      selectedDrivers.forEach(driver => {
        updateDriverLap(driver.code, 1);
        setLapNumbers(prev => ({ ...prev, [driver.code]: 1 }));
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 className="f1-monospace" style={{ color: '#e10600', fontWeight: 900 }}>
        SELECT DRIVERS
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="f1-monospace" style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>
          SYNC OPTIONS
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleSyncMode('none')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: syncMode === 'none' ? 'var(--f1-red)' : '#374151',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              if (syncMode !== 'none') {
                (e.currentTarget as any).style.background = '#4B5563';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as any).style.background = syncMode === 'none' ? 'var(--f1-red)' : '#374151';
            }}
          >
            Manual
          </button>
          <button
            onClick={() => handleSyncMode('same-lap')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: syncMode === 'same-lap' ? 'var(--f1-red)' : '#374151',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              if (syncMode !== 'same-lap') {
                (e.currentTarget as any).style.background = '#4B5563';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as any).style.background = syncMode === 'same-lap' ? 'var(--f1-red)' : '#374151';
            }}
          >
            Same Lap
          </button>
          <button
            onClick={() => handleSyncMode('live')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: syncMode === 'live' ? 'var(--f1-red)' : '#374151',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              if (syncMode !== 'live') {
                (e.currentTarget as any).style.background = '#4B5563';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as any).style.background = syncMode === 'live' ? 'var(--f1-red)' : '#374151';
            }}
          >
            Live Lap
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {selectedDrivers.length === 0 && (
          <div className="f1-monospace" style={{ fontSize: '0.75rem', color: '#6B7280', fontStyle: 'italic' }}>
            No drivers selected
          </div>
        )}
        {availableDrivers.map(({ code, color }) => {
          const selected = isSelected(code);
          const hexColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

          return (
            <motion.div
              key={code}
              layout
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px',
                border: `2px solid ${selected ? hexColor : '#374151'}`,
                borderRadius: '4px',
                background: selected ? 'rgba(255,255,255,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => handleToggleDriver(code, color)}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '2px',
                  backgroundColor: hexColor,
                }}
              />
              <span className="f1-monospace" style={{ fontWeight: 700, flex: 1 }}>
                {code}
              </span>

              {selected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label className="f1-monospace" style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                    Lap:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={metadata.total_laps}
                    value={lapNumbers[code] || 1}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleLapChange(code, parseInt(e.target.value));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '50px',
                      padding: '4px 6px',
                      background: '#111318',
                      border: '1px solid #374151',
                      borderRadius: '4px',
                      color: 'white',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
