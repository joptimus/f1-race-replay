import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { useComparisonStore } from "../../store/comparisonStore";
import { LapTelemetryPoint } from "../../types";

interface ChartProps {
  title: string;
  dataKey: keyof LapTelemetryPoint;
  unit?: string;
  yAxisDomain?: [number, number];
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[]; label?: string; unit?: string; dataKey?: string }> = ({ active, payload, label, unit, dataKey }) => {
  if (!active || !payload || payload.length === 0) return null;

  const formatValue = (value: number) => {
    if (typeof value !== 'number') return 'N/A';
    return value.toFixed(3);
  };

  const getLabel = () => {
    switch (dataKey) {
      case 'speed': return 'Speed';
      case 'throttle': return 'Throttle';
      case 'brake': return 'Brake';
      case 'rpm': return 'RPM';
      case 'gear': return 'Gear';
      default: return 'Value';
    }
  };

  return (
    <div style={{
      backgroundColor: '#111318',
      border: '2px solid #e10600',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 16px rgba(225, 6, 0, 0.3)',
    }}>
      <p style={{
        color: '#9CA3AF',
        fontSize: '0.75rem',
        fontWeight: 700,
        margin: '0 0 8px 0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Distance: {label}m
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {payload.map((entry, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: entry.color,
            }} />
            <span style={{ color: '#E5E7EB', fontWeight: 700, minWidth: '80px' }}>
              {entry.name}:
            </span>
            <span style={{ color: '#e10600', fontWeight: 700, fontFamily: 'monospace' }}>
              {formatValue(entry.value)} {unit || ''}
            </span>
          </div>
        ))}
      </div>
      <p style={{
        color: '#6B7280',
        fontSize: '0.7rem',
        margin: '8px 0 0 0',
        borderTop: '1px solid #374151',
        paddingTop: '8px',
      }}>
        {getLabel()}
      </p>
    </div>
  );
};


const TelemetryLineChart: React.FC<ChartProps> = ({ title, dataKey, unit, yAxisDomain }) => {
  const { lapTelemetry, selectedDrivers } = useComparisonStore();

  if (lapTelemetry.length === 0) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="f1-monospace" style={{ color: '#6b7280' }}>No data loaded</p>
      </div>
    );
  }

  const allDistances = lapTelemetry.flatMap(lap => lap.telemetry.map(t => t.distance));
  const minDist = Math.min(...allDistances);
  const maxDist = Math.max(...allDistances);

  const step = (maxDist - minDist) / 500;
  const distances = Array.from({ length: 500 }, (_, i) => minDist + i * step);

  // Calculate sector boundaries based on distance (approximate thirds of the track)
  const trackLength = maxDist - minDist;
  const sector1End = minDist + trackLength / 3;
  const sector2End = minDist + (trackLength * 2) / 3;

  const chartData = distances.map(distance => {
    const point: any = { distance: distance.toFixed(0) };

    lapTelemetry.forEach(lap => {
      const driver = selectedDrivers.find(d => d.code === lap.driver_code);
      if (!driver) return;

      const telemetry = lap.telemetry;
      const idx = telemetry.findIndex(t => t.distance >= distance);

      const key = `${lap.driver_code}-L${lap.lap_number}`;

      if (idx > 0) {
        const prev = telemetry[idx - 1];
        const next = telemetry[idx];
        const ratio = (distance - prev.distance) / (next.distance - prev.distance);
        let prevVal = prev[dataKey] as number;
        let nextVal = next[dataKey] as number;

        if (dataKey === 'brake') {
          prevVal *= 100;
          nextVal *= 100;
        }

        point[key] = prevVal + ratio * (nextVal - prevVal);
      } else if (idx === 0 && telemetry.length > 0) {
        let val = telemetry[0][dataKey] as number;
        if (dataKey === 'brake') {
          val *= 100;
        }
        point[key] = val;
      }
    });

    return point;
  });

  return (
    <div>
      <h4 className="f1-monospace" style={{ color: '#e10600', fontWeight: 700, marginBottom: '8px' }}>
        {title} {unit && `(${unit})`}
      </h4>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

          {/* Sector divider lines - ghosted appearance */}
          <ReferenceLine
            x={sector1End.toFixed(0)}
            stroke="#ef4444"
            strokeDasharray="5 5"
            opacity={0.2}
            label={{
              value: 'S1/S2',
              position: 'top',
              fill: '#ef4444',
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.4,
            }}
          />
          <ReferenceLine
            x={sector2End.toFixed(0)}
            stroke="#ef4444"
            strokeDasharray="5 5"
            opacity={0.2}
            label={{
              value: 'S2/S3',
              position: 'top',
              fill: '#ef4444',
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.4,
            }}
          />

          <XAxis
            dataKey="distance"
            stroke="#9CA3AF"
            label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis stroke="#9CA3AF" domain={yAxisDomain} />
          <Tooltip
            content={(props) => <CustomTooltip {...props} unit={unit} dataKey={dataKey} />}
            cursor={{ stroke: '#e10600', strokeWidth: 2 }}
          />
          <Legend />
          {lapTelemetry.map(lap => {
            const driver = selectedDrivers.find(d => d.code === lap.driver_code);
            if (!driver) return null;

            const color = `rgb(${driver.color[0]}, ${driver.color[1]}, ${driver.color[2]})`;
            const key = `${lap.driver_code}-L${lap.lap_number}`;
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={`${lap.driver_code} (Lap ${lap.lap_number})`}
                animationDuration={600}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TelemetryCharts: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <TelemetryLineChart title="SPEED" dataKey="speed" unit="km/h" />
      <TelemetryLineChart title="THROTTLE" dataKey="throttle" unit="%" yAxisDomain={[0, 100]} />
      <TelemetryLineChart title="BRAKE" dataKey="brake" unit="%" yAxisDomain={[0, 100]} />
      <TelemetryLineChart title="RPM" dataKey="rpm" unit="RPM" />
      <TelemetryLineChart title="GEAR" dataKey="gear" yAxisDomain={[0, 8]} />
    </div>
  );
};
