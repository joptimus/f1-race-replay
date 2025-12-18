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
} from "recharts";
import { useComparisonStore } from "../../store/comparisonStore";
import { LapTelemetryPoint } from "../../types";

interface ChartProps {
  title: string;
  dataKey: keyof LapTelemetryPoint;
  unit?: string;
  yAxisDomain?: [number, number];
}

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

  const chartData = distances.map(distance => {
    const point: any = { distance: distance.toFixed(0) };

    lapTelemetry.forEach(lap => {
      const driver = selectedDrivers.find(d => d.code === lap.driver_code);
      if (!driver) return;

      const telemetry = lap.telemetry;
      const idx = telemetry.findIndex(t => t.distance >= distance);

      if (idx > 0) {
        const prev = telemetry[idx - 1];
        const next = telemetry[idx];
        const ratio = (distance - prev.distance) / (next.distance - prev.distance);
        const prevVal = prev[dataKey] as number;
        const nextVal = next[dataKey] as number;
        point[lap.driver_code] = prevVal + ratio * (nextVal - prevVal);
      } else if (idx === 0 && telemetry.length > 0) {
        point[lap.driver_code] = telemetry[0][dataKey];
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
          <XAxis
            dataKey="distance"
            stroke="#9CA3AF"
            label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis stroke="#9CA3AF" domain={yAxisDomain} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
            }}
            labelStyle={{ color: "#FFF" }}
          />
          <Legend />
          {lapTelemetry.map(lap => {
            const driver = selectedDrivers.find(d => d.code === lap.driver_code);
            if (!driver) return null;

            const color = `rgb(${driver.color[0]}, ${driver.color[1]}, ${driver.color[2]})`;
            return (
              <Line
                key={`${lap.driver_code}-${lap.lap_number}`}
                type="monotone"
                dataKey={lap.driver_code}
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
