import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MapSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  showSectorColors: boolean;
  onToggleSectorColors: () => void;
  showWeatherPanel: boolean;
  onToggleWeatherPanel: () => void;
  temperatureUnit: 'C' | 'F';
  onToggleTemperatureUnit: () => void;
  enableWeatherFx: boolean;
  onToggleWeatherFx: () => void;
}

export const MapSettingsPanel: React.FC<MapSettingsPanelProps> = ({
  isOpen,
  onClose,
  showSectorColors,
  onToggleSectorColors,
  showWeatherPanel,
  onToggleWeatherPanel,
  temperatureUnit,
  onToggleTemperatureUnit,
  enableWeatherFx,
  onToggleWeatherFx,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 990,
            }}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              height: '100vh',
              width: '280px',
              background: '#1f1f27',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderLeft: '1px solid #374151',
              zIndex: 991,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 900,
                  color: '#e10600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Settings
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Settings Items */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Sector Colors Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#111318',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    Sector Colors
                  </label>
                  <button
                    onClick={onToggleSectorColors}
                    style={{
                      background: showSectorColors ? '#10b981' : '#4b5563',
                      border: 'none',
                      borderRadius: '12px',
                      width: '44px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        background: 'white',
                        transform: showSectorColors ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>
                </div>

                {/* Weather Panel Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#111318',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    Weather Panel
                  </label>
                  <button
                    onClick={onToggleWeatherPanel}
                    style={{
                      background: showWeatherPanel ? '#10b981' : '#4b5563',
                      border: 'none',
                      borderRadius: '12px',
                      width: '44px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        background: 'white',
                        transform: showWeatherPanel ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>
                </div>

                {/* Temperature Unit Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#111318',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    Temperature
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={onToggleTemperatureUnit}
                      style={{
                        padding: '4px 12px',
                        background: temperatureUnit === 'C' ? '#e10600' : '#374151',
                        color: temperatureUnit === 'C' ? 'white' : '#9ca3af',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      °C
                    </button>
                    <button
                      onClick={onToggleTemperatureUnit}
                      style={{
                        padding: '4px 12px',
                        background: temperatureUnit === 'F' ? '#e10600' : '#374151',
                        color: temperatureUnit === 'F' ? 'white' : '#9ca3af',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      °F
                    </button>
                  </div>
                </div>

                {/* Weather FX Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: '#111318',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    Weather FX
                  </label>
                  <button
                    onClick={onToggleWeatherFx}
                    style={{
                      background: enableWeatherFx ? '#10b981' : '#4b5563',
                      border: 'none',
                      borderRadius: '12px',
                      width: '44px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        background: 'white',
                        transform: enableWeatherFx ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MapSettingsPanel;
