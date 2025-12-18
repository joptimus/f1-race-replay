/**
 * Real-time telemetry visualization using Recharts
 */

import React, { useState, useRef, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useSelectedDriver, useCurrentFrame } from "../store/replayStore";
import { motion } from "framer-motion";

interface TelemetryDataPoint {
  time: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
}

export const TelemetryChart: React.FC = () => {
  const selectedDriver = useSelectedDriver();
  const currentFrame = useCurrentFrame();
  const [speedUnit, setSpeedUnit] = useState<"kmh" | "mph">("kmh");
  const telemetryHistoryRef = useRef<TelemetryDataPoint[]>([]);
  const lastFrameTimeRef = useRef<number>(-1);
  const [telemetryData, setTelemetryData] = useState<TelemetryDataPoint[]>([]);

  // All hooks must be called unconditionally
  useEffect(() => {
    // Reset history when driver changes
    telemetryHistoryRef.current = [];
    lastFrameTimeRef.current = -1;
  }, [selectedDriver?.code]);

  useEffect(() => {
    if (!currentFrame || !selectedDriver) return;

    const driverCodeInFrame = selectedDriver.code;
    const currentDriverData = currentFrame.drivers[driverCodeInFrame];
    if (!currentDriverData) return;

    // Detect any significant time jump (backward or forward): clear history to prevent rubber banding
    // This handles both seeking backward and seeking forward past the current playback
    if (lastFrameTimeRef.current >= 0 && Math.abs(currentFrame.t - lastFrameTimeRef.current) > 1) {
      telemetryHistoryRef.current = [];
    }

    // Only add new data point if frame time has changed
    if (currentFrame.t !== lastFrameTimeRef.current) {
      const kmhSpeed = currentDriverData.speed;

      const newPoint: TelemetryDataPoint = {
        time: currentFrame.t,
        speed: kmhSpeed,
        throttle: currentDriverData.throttle,
        brake: currentDriverData.brake,
        gear: currentDriverData.gear,
        drs: currentDriverData.drs,
      };

      // Only add if this is not going backward in time (prevents out-of-order frame buffering)
      const lastHistoryTime = telemetryHistoryRef.current.length > 0
        ? telemetryHistoryRef.current[telemetryHistoryRef.current.length - 1].time
        : -Infinity;

      if (currentFrame.t >= lastHistoryTime) {
        telemetryHistoryRef.current.push(newPoint);
        lastFrameTimeRef.current = currentFrame.t;

        if (telemetryHistoryRef.current.length > 300) {
          telemetryHistoryRef.current.shift();
        }

        setTelemetryData([...telemetryHistoryRef.current]);
      }
    }
  }, [currentFrame?.t, selectedDriver?.code]);

  useEffect(() => {
    if (telemetryHistoryRef.current.length === 0) return;

    const convertedData = telemetryHistoryRef.current.map(point => ({
      ...point,
      speed: speedUnit === "kmh" ? point.speed : point.speed * 0.621371,
    }));

    setTelemetryData(convertedData);
  }, [speedUnit]);

  if (!selectedDriver || !currentFrame) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: '#6b7280',
      }}>
        <p className="f1-monospace" style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          margin: 0,
        }}>NO TELEMETRY DATA</p>
      </div>
    );
  }

  const driverCodeInFrame = selectedDriver.code;
  const currentDriverData = currentFrame.drivers[driverCodeInFrame];

  if (!currentDriverData) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: '#6b7280',
      }}>
        <p className="f1-monospace" style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          margin: 0,
        }}>NO TELEMETRY DATA</p>
      </div>
    );
  }

  const hexColor = `rgb(${selectedDriver.color[0]}, ${selectedDriver.color[1]}, ${selectedDriver.color[2]})`;
  const kmhSpeed = currentDriverData.speed;
  const displaySpeed = speedUnit === "kmh" ? kmhSpeed : kmhSpeed * 0.621371;

  // Handle brake/throttle that might be 0-1 or 0-100
  const throttlePercent = currentDriverData.throttle > 1 ? currentDriverData.throttle : currentDriverData.throttle * 100;
  const brakePercent = currentDriverData.brake > 1 ? currentDriverData.brake : currentDriverData.brake * 100;

  // Format time helper (mm:ss.sss format) - used for lap times when data available
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds)) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(7, '0')}`;
  };

  // Format delta (for sector deltas and live delta) - used when data available
  const formatDelta = (delta: number | null): string => {
    if (delta === null || isNaN(delta)) return "N/A";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.abs(delta).toFixed(3)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Driver Info Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: hexColor }}
          />
          <div>
            <div className="font-bold text-white f1-monospace" style={{ fontSize: '0.85rem' }}>
              {selectedDriver.code}
            </div>
            <div className="text-xs text-gray-400 f1-monospace flex items-center gap-2">
              <span>LAP {currentDriverData.lap}</span>
              {(() => {
                let bgColor = '#374151';
                let label = 'DRS OFF';
                if ([10, 12, 14].includes(currentDriverData.drs)) {
                  bgColor = '#10b981';
                  label = 'DRS ACTIVE';
                } else if (currentDriverData.drs === 8) {
                  bgColor = '#eab308';
                  label = 'DRS AVAILABLE';
                }
                return (
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: bgColor,
                    color: '#fff',
                    borderRadius: '3px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    marginLeft: '14px',
                  }}>
                    {label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '3px' }}>
          <button
            onClick={() => setSpeedUnit("kmh")}
            style={{
              padding: "2px 6px",
              backgroundColor: speedUnit === "kmh" ? hexColor : "transparent",
              color: "white",
              border: `1px solid ${hexColor}`,
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "0.65rem",
              fontWeight: 700,
              transition: "background-color 0.2s",
            }}
          >
            KM/H
          </button>
          <button
            onClick={() => setSpeedUnit("mph")}
            style={{
              padding: "2px 6px",
              backgroundColor: speedUnit === "mph" ? hexColor : "transparent",
              color: "white",
              border: `1px solid ${hexColor}`,
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "0.65rem",
              fontWeight: 700,
              transition: "background-color 0.2s",
            }}
          >
            MPH
          </button>
        </div>
      </div>

      {/* Gear Display */}
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '12px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '2rem',
          fontWeight: 900,
          color: hexColor,
          lineHeight: 1,
          marginBottom: '4px',
        }}>
          {currentDriverData.gear === 0 ? 'N' : currentDriverData.gear}
        </div>
        <div style={{
          fontSize: '0.65rem',
          color: '#9CA3AF',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>
          GEAR
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900 rounded p-2 border border-gray-700" style={{ textAlign: 'center' }}>
          <div className="text-xs text-gray-400 f1-monospace">SPEED</div>
          <div className="text-sm font-bold text-white f1-monospace">
            {displaySpeed.toFixed(0)} {speedUnit === "kmh" ? "km/h" : "mph"}
          </div>
        </div>
        <div className="bg-gray-900 rounded p-2 border border-gray-700" style={{ textAlign: 'center' }}>
          <div className="text-xs text-gray-400 f1-monospace">RPM</div>
          <div className="text-sm font-bold text-white f1-monospace">
            {currentDriverData.speed > 0 ? Math.round(currentDriverData.speed * 100) : 0}
          </div>
        </div>
      </div>

      {/* Compact Throttle/Brake Bars */}
      <div className="space-y-2">
        <div>
          <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '3px', fontFamily: 'monospace', fontWeight: 700 }}>THROTTLE</div>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#1F2937',
            borderRadius: '3px',
            overflow: 'hidden',
            border: '1px solid #374151',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(Math.max(throttlePercent, 0), 100)}%`,
              height: '100%',
              backgroundColor: '#10B981',
              transition: 'width 0.1s ease'
            }} />
            <div style={{
              position: 'absolute',
              right: '3px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#FFF',
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'monospace'
            }}>
              {Math.min(Math.max(throttlePercent, 0), 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '3px', fontFamily: 'monospace', fontWeight: 700 }}>BRAKE</div>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#1F2937',
            borderRadius: '3px',
            overflow: 'hidden',
            border: '1px solid #374151',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(Math.max(brakePercent, 0), 100)}%`,
              height: '100%',
              backgroundColor: '#EF4444',
              transition: 'width 0.1s ease'
            }} />
            <div style={{
              position: 'absolute',
              right: '3px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#FFF',
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'monospace'
            }}>
              {Math.min(Math.max(brakePercent, 0), 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Lap Time & Deltas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Lap Time Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '8px',
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: '6px'
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px', fontFamily: 'monospace', fontWeight: 700 }}>LAP TIME</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#9CA3AF', fontFamily: 'monospace' }}>
              {formatTime(currentDriverData.lap_time ?? null)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px', fontFamily: 'monospace', fontWeight: 700 }}>LIVE DELTA</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#9CA3AF', fontFamily: 'monospace' }}>
              {formatDelta(null)}
            </div>
          </div>
        </div>

        {/* Sector Deltas Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '4px',
          padding: '8px',
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'monospace', fontWeight: 700 }}>SECTOR Δ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px', fontFamily: 'monospace' }}>S1</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d1d5db', fontFamily: 'monospace' }}>
                {formatTime(currentDriverData.sector1 ?? null)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px', fontFamily: 'monospace' }}>S2</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d1d5db', fontFamily: 'monospace' }}>
                {formatTime(currentDriverData.sector2 ?? null)}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px', fontFamily: 'monospace' }}>S3</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#d1d5db', fontFamily: 'monospace' }}>
                {formatTime(currentDriverData.sector3 ?? null)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Speed Chart */}
      <div>
        <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '3px', fontFamily: 'monospace', fontWeight: 700 }}>SPEED HISTORY</div>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={telemetryData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient
                id="colorSpeed"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={hexColor} stopOpacity={0.5} />
                <stop offset="95%" stopColor={hexColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" width={0.5} vertical={false} />
            <XAxis dataKey="time" stroke="#9CA3AF" hide={true} />
            <YAxis stroke="#9CA3AF" width={30} style={{ fontSize: '0.65rem' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                fontSize: '0.75rem',
              }}
              labelStyle={{ color: "#FFF" }}
              animationDuration={0}
            />
            <Area
              type="natural"
              dataKey="speed"
              stroke={hexColor}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSpeed)"
              animationDuration={500}
              animationEasing="ease-in-out"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default TelemetryChart;
