/**
 * Simple 2D SVG-based track visualization
 * Shows driver positions on a simplified circuit representation
 */

import React from "react";
import { useCurrentFrame, useSelectedDriver } from "../store/replayStore";

export const SimpleTrackView: React.FC = () => {
  const currentFrame = useCurrentFrame();
  const selectedDriver = useSelectedDriver();

  if (!currentFrame || !currentFrame.drivers) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <p style={{ color: '#9ca3af' }}>Loading race data...</p>
      </div>
    );
  }

  const drivers = Object.entries(currentFrame.drivers);
  const maxSpeed = Math.max(...drivers.map(([_, d]) => d.speed || 0), 300);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' }}>
      <svg viewBox="0 0 400 300" style={{ width: '100%', height: '100%', maxWidth: '600px', maxHeight: '450px' }}>
        {/* Track background */}
        <rect x="0" y="0" width="400" height="300" fill="#1f2937" />

        {/* Simplified oval track */}
        <ellipse cx="200" cy="150" rx="180" ry="120" fill="none" stroke="#4b5563" strokeWidth="80" />
        <ellipse cx="200" cy="150" rx="120" ry="80" fill="none" stroke="#1f2937" strokeWidth="2" />

        {/* Center marker */}
        <circle cx="200" cy="150" r="4" fill="#9ca3af" />

        {/* Driver positions */}
        {drivers.map(([code, driver]) => {
          const angle = (driver.position / drivers.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 150;
          const x = 200 + radius * Math.cos(angle);
          const y = 150 + radius * Math.sin(angle);
          const speedPercent = (driver.speed || 0) / maxSpeed;
          const size = 8 + speedPercent * 8;

          return (
            <g key={code}>
              {/* Driver dot */}
              <circle
                cx={x}
                cy={y}
                r={size}
                fill={code === selectedDriver?.code ? '#ef4444' : '#dc2626'}
                opacity={0.8}
              />
              {/* Driver label */}
              <text
                x={x}
                y={y - size - 5}
                textAnchor="middle"
                fontSize="10"
                fill="#f3f4f6"
                fontWeight="bold"
              >
                {code}
              </text>
              {/* Speed indicator */}
              <text
                x={x}
                y={y + size + 12}
                textAnchor="middle"
                fontSize="8"
                fill="#9ca3af"
              >
                {Math.round(driver.speed)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
        <p>{drivers.length} drivers | Lap {currentFrame.lap}</p>
        {selectedDriver && (
          <p style={{ color: '#f3f4f6', fontWeight: 'bold' }}>
            {selectedDriver.code} • Position {selectedDriver.data.position} • {Math.round(selectedDriver.data.speed)} km/h
          </p>
        )}
      </div>
    </div>
  );
};

export default SimpleTrackView;
