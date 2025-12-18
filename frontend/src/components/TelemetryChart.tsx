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

      telemetryHistoryRef.current.push(newPoint);
      lastFrameTimeRef.current = currentFrame.t;

      if (telemetryHistoryRef.current.length > 300) {
        telemetryHistoryRef.current.shift();
      }

      setTelemetryData([...telemetryHistoryRef.current]);
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
      <div className="w-full h-64 bg-gray-900/50 rounded-lg flex items-center justify-center text-gray-400 f1-monospace">
        SELECT A DRIVER
      </div>
    );
  }

  const driverCodeInFrame = selectedDriver.code;
  const currentDriverData = currentFrame.drivers[driverCodeInFrame];

  if (!currentDriverData) {
    return (
      <div className="w-full h-64 bg-gray-900/50 rounded-lg flex items-center justify-center text-gray-400 f1-monospace">
        SELECT A DRIVER
      </div>
    );
  }

  const hexColor = `rgb(${selectedDriver.color[0]}, ${selectedDriver.color[1]}, ${selectedDriver.color[2]})`;
  const kmhSpeed = currentDriverData.speed;
  const displaySpeed = speedUnit === "kmh" ? kmhSpeed : kmhSpeed * 0.621371;
  const speedLabel = speedUnit === "kmh" ? "km/h" : "mph";

  // Handle brake/throttle that might be 0-1 or 0-100
  const throttlePercent = currentDriverData.throttle > 1 ? currentDriverData.throttle : currentDriverData.throttle * 100;
  const brakePercent = currentDriverData.brake > 1 ? currentDriverData.brake : currentDriverData.brake * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-gray-900/50 rounded-lg p-4 space-y-4"
    >
      {/* Driver Info Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: hexColor }}
          />
          <div>
            <div className="font-semibold text-white f1-monospace">
              {selectedDriver.code} TELEMETRY
            </div>
            <div className="text-sm text-gray-400 f1-monospace">
              Speed: {displaySpeed.toFixed(1)} {speedLabel} • Lap: {currentDriverData.lap} • Gear:{" "}
              {currentDriverData.gear === 0 ? "N" : currentDriverData.gear}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setSpeedUnit("kmh")}
            style={{
              padding: "4px 8px",
              backgroundColor: speedUnit === "kmh" ? hexColor : "transparent",
              color: "white",
              border: `1px solid ${hexColor}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 700,
              transition: "background-color 0.2s",
            }}
          >
            KM/H
          </button>
          <button
            onClick={() => setSpeedUnit("mph")}
            style={{
              padding: "4px 8px",
              backgroundColor: speedUnit === "mph" ? hexColor : "transparent",
              color: "white",
              border: `1px solid ${hexColor}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 700,
              transition: "background-color 0.2s",
            }}
          >
            MPH
          </button>
        </div>
      </div>

      {/* Speed Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Speed</h4>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={telemetryData}>
            <defs>
              <linearGradient
                id="colorSpeed"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={hexColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={hexColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" hide={true} />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
              }}
              labelStyle={{ color: "#FFF" }}
              animationDuration={200}
            />
            <Area
              type="monotone"
              dataKey="speed"
              stroke={hexColor}
              fillOpacity={1}
              fill="url(#colorSpeed)"
              animationDuration={600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Throttle/Brake Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2 f1-monospace">
          THROTTLE / BRAKE
        </h4>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px', fontFamily: 'monospace' }}>THROTTLE</div>
            <div style={{
              width: '100%',
              height: '30px',
              backgroundColor: '#1F2937',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid #374151',
              position: 'relative'
            }}>
              <div style={{
                width: `${Math.min(Math.max(throttlePercent, 0), 100)}%`,
                height: '100%',
                backgroundColor: '#00C853',
                transition: 'width 0.1s ease'
              }} />
              <div style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#FFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'monospace'
              }}>
                {Math.min(Math.max(throttlePercent, 0), 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px', fontFamily: 'monospace' }}>BRAKE</div>
            <div style={{
              width: '100%',
              height: '30px',
              backgroundColor: '#1F2937',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid #374151',
              position: 'relative'
            }}>
              <div style={{
                width: `${Math.min(Math.max(brakePercent, 0), 100)}%`,
                height: '100%',
                backgroundColor: '#DC2626',
                transition: 'width 0.1s ease'
              }} />
              <div style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#FFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'monospace'
              }}>
                {Math.min(Math.max(brakePercent, 0), 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Speed", value: `${displaySpeed.toFixed(0)} ${speedUnit === "kmh" ? "km/h" : "mph"}` },
          { label: "Gear", value: currentDriverData.gear === 0 ? "N" : currentDriverData.gear },
          { label: "Throttle", value: `${Math.min(Math.max(throttlePercent, 0), 100).toFixed(0)}%` },
          { label: "Brake", value: `${Math.min(Math.max(brakePercent, 0), 100).toFixed(0)}%` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-800 rounded p-2 text-center f1-monospace"
            style={{ fontSize: '0.75rem' }}
          >
            <div className="text-xs text-gray-400">{stat.label}</div>
            <div className="text-lg font-bold text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default TelemetryChart;
