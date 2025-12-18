import React from "react";
import { useComparisonStore } from "../../store/comparisonStore";

export const SectorTimesTable: React.FC = () => {
  const { sectorTimes, selectedDrivers } = useComparisonStore();

  if (sectorTimes.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p className="f1-monospace" style={{ color: '#6b7280' }}>No sector data loaded</p>
      </div>
    );
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "-";
    return seconds.toFixed(3) + "s";
  };

  const fastestS1 = Math.min(...sectorTimes.filter(s => s.sector_1 !== null).map(s => s.sector_1!));
  const fastestS2 = Math.min(...sectorTimes.filter(s => s.sector_2 !== null).map(s => s.sector_2!));
  const fastestS3 = Math.min(...sectorTimes.filter(s => s.sector_3 !== null).map(s => s.sector_3!));
  const fastestLap = Math.min(...sectorTimes.filter(s => s.lap_time !== null).map(s => s.lap_time!));

  return (
    <div>
      <h4 className="f1-monospace" style={{ color: '#e10600', fontWeight: 700, marginBottom: '12px' }}>
        SECTOR TIMES
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #374151' }}>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'left', color: '#9CA3AF' }}>DRIVER</th>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'center', color: '#9CA3AF' }}>LAP</th>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'right', color: '#9CA3AF' }}>S1</th>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'right', color: '#9CA3AF' }}>S2</th>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'right', color: '#9CA3AF' }}>S3</th>
            <th className="f1-monospace" style={{ padding: '12px', textAlign: 'right', color: '#9CA3AF' }}>LAP TIME</th>
          </tr>
        </thead>
        <tbody>
          {sectorTimes.map((sector, idx) => {
            const driver = selectedDrivers.find(d => d.code === sector.driver_code);
            const color = driver ? `rgb(${driver.color[0]}, ${driver.color[1]}, ${driver.color[2]})` : '#fff';

            return (
              <tr key={idx} style={{ borderBottom: '1px solid #374151' }}>
                <td style={{ padding: '12px', borderLeft: `4px solid ${color}` }}>
                  <span className="f1-monospace" style={{ fontWeight: 700 }}>{sector.driver_code}</span>
                </td>
                <td className="f1-monospace" style={{ padding: '12px', textAlign: 'center' }}>
                  {sector.lap_number}
                </td>
                <td
                  className="f1-monospace"
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    color: sector.sector_1 === fastestS1 ? '#a855f7' : 'inherit',
                    fontWeight: sector.sector_1 === fastestS1 ? 700 : 400,
                  }}
                >
                  {formatTime(sector.sector_1)}
                </td>
                <td
                  className="f1-monospace"
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    color: sector.sector_2 === fastestS2 ? '#a855f7' : 'inherit',
                    fontWeight: sector.sector_2 === fastestS2 ? 700 : 400,
                  }}
                >
                  {formatTime(sector.sector_2)}
                </td>
                <td
                  className="f1-monospace"
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    color: sector.sector_3 === fastestS3 ? '#a855f7' : 'inherit',
                    fontWeight: sector.sector_3 === fastestS3 ? 700 : 400,
                  }}
                >
                  {formatTime(sector.sector_3)}
                </td>
                <td
                  className="f1-monospace"
                  style={{
                    padding: '12px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: sector.lap_time === fastestLap ? '#22c55e' : 'inherit',
                  }}
                >
                  {formatTime(sector.lap_time)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
