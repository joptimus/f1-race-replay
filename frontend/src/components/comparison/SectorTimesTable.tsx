import React, { useState } from "react";
import { useComparisonStore } from "../../store/comparisonStore";
import { X } from "lucide-react";

interface SectorStatus {
  isFastest: boolean;
  isPersonalBest: boolean;
  isSlower: boolean;
}

export const SectorTimesTable: React.FC = () => {
  const { sectorTimes, selectedDrivers } = useComparisonStore();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [expandedTimes, setExpandedTimes] = useState<Set<string>>(new Set());

  if (sectorTimes.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p className="f1-monospace" style={{ color: '#6b7280' }}>No sector data loaded</p>
      </div>
    );
  }

  const formatTimeDisplay = (seconds: number | null, expanded: boolean = false): string => {
    if (seconds === null) return "-";

    if (seconds < 60) {
      return seconds.toFixed(1) + "s";
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

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "-";
    return seconds.toFixed(3) + "s";
  };

  const fastestS1 = Math.min(...sectorTimes.filter(s => s.sector_1 !== null).map(s => s.sector_1!));
  const fastestS2 = Math.min(...sectorTimes.filter(s => s.sector_2 !== null).map(s => s.sector_2!));
  const fastestS3 = Math.min(...sectorTimes.filter(s => s.sector_3 !== null).map(s => s.sector_3!));
  const fastestLap = Math.min(...sectorTimes.filter(s => s.lap_time !== null).map(s => s.lap_time!));

  // Get each driver's best times for their personal best comparison
  const getDriverBestTimes = (driverCode: string) => {
    const driverSectors = sectorTimes.filter(s => s.driver_code === driverCode);
    return {
      s1: Math.min(...driverSectors.filter(s => s.sector_1 !== null).map(s => s.sector_1!)) || Infinity,
      s2: Math.min(...driverSectors.filter(s => s.sector_2 !== null).map(s => s.sector_2!)) || Infinity,
      s3: Math.min(...driverSectors.filter(s => s.sector_3 !== null).map(s => s.sector_3!)) || Infinity,
    };
  };

  const getSectorStatus = (value: number | null, fastest: number, driverBest: number): SectorStatus => {
    if (value === null) return { isFastest: false, isPersonalBest: false, isSlower: false };
    const epsilon = 0.0001;
    return {
      isFastest: Math.abs(value - fastest) < epsilon,
      isPersonalBest: Math.abs(value - fastest) >= epsilon && Math.abs(value - driverBest) < epsilon,
      isSlower: value > driverBest + epsilon,
    };
  };

  const SectorCell = ({ value, fastest, driverBest, timeKey }: { value: number | null; fastest: number; driverBest: number; timeKey: string }) => {
    const status = getSectorStatus(value, fastest, driverBest);
    const isExpanded = expandedTimes.has(timeKey);

    let barColor = '#6b7280'; // default gray
    let borderColor = '#374151';

    if (status.isFastest) {
      barColor = '#a855f7'; // purple
      borderColor = '#a855f7';
    } else if (status.isPersonalBest) {
      barColor = '#22c55e'; // green
      borderColor = '#22c55e';
    } else if (status.isSlower) {
      barColor = '#eab308'; // yellow
      borderColor = '#eab308';
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
            fontWeight: status.isFastest || status.isPersonalBest ? 700 : 400,
            color: status.isFastest || status.isPersonalBest ? borderColor : 'inherit',
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
            backgroundColor: barColor,
            borderRadius: '2px',
            opacity: 0.8,
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px' }}>
      {/* Table Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h4 className="f1-monospace" style={{ color: '#e10600', fontWeight: 700, marginBottom: '16px' }}>
          SECTOR TIMES
        </h4>

        {/* Legend */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#a855f7', borderRadius: '2px' }} />
            <span className="f1-monospace" style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Fastest</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '2px' }} />
            <span className="f1-monospace" style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Personal Best</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#eab308', borderRadius: '2px' }} />
            <span className="f1-monospace" style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Below PB</span>
          </div>
        </div>

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
              const driverBests = getDriverBestTimes(sector.driver_code);
              const isSelected = selectedDriver === sector.driver_code;

              return (
                <tr
                  key={idx}
                  onClick={() => setSelectedDriver(isSelected ? null : sector.driver_code)}
                  style={{
                    borderBottom: '1px solid #374151',
                    verticalAlign: 'top',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(225, 6, 0, 0.1)' : 'transparent',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td style={{ padding: '12px', borderLeft: `4px solid ${color}` }}>
                    <span className="f1-monospace" style={{ fontWeight: 700 }}>{sector.driver_code}</span>
                  </td>
                  <td className="f1-monospace" style={{ padding: '12px', textAlign: 'center' }}>
                    {sector.lap_number}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <SectorCell value={sector.sector_1} fastest={fastestS1} driverBest={driverBests.s1} timeKey={`${idx}-s1`} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <SectorCell value={sector.sector_2} fastest={fastestS2} driverBest={driverBests.s2} timeKey={`${idx}-s2`} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <SectorCell value={sector.sector_3} fastest={fastestS3} driverBest={driverBests.s3} timeKey={`${idx}-s3`} />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div
                        onClick={(e) => toggleTimeExpanded(`${idx}-lap`, e)}
                        className="f1-monospace"
                        style={{
                          padding: '8px 12px',
                          border: sector.lap_time === fastestLap ? '2px solid #22c55e' : '2px solid #374151',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          fontWeight: sector.lap_time === fastestLap ? 700 : 400,
                          color: sector.lap_time === fastestLap ? '#22c55e' : 'inherit',
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
                        {formatTimeDisplay(sector.lap_time, expandedTimes.has(`${idx}-lap`))}
                      </div>
                      <div
                        style={{
                          height: '4px',
                          width: '70px',
                          backgroundColor: sector.lap_time === fastestLap ? '#22c55e' : '#6b7280',
                          borderRadius: '2px',
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Driver Details Panel */}
      {selectedDriver && (
        <div style={{
          width: '350px',
          background: 'var(--f1-black)',
          border: '1px solid var(--f1-border)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--f1-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h5 className="f1-monospace" style={{ margin: 0, color: '#e10600', fontWeight: 700 }}>
              {selectedDriver} DETAILS
            </h5>
            <button
              onClick={() => setSelectedDriver(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sectorTimes
              .filter(s => s.driver_code === selectedDriver)
              .map((sector, idx) => {
                const driverBests = getDriverBestTimes(sector.driver_code);
                const s1Status = getSectorStatus(sector.sector_1, fastestS1, driverBests.s1);
                const s2Status = getSectorStatus(sector.sector_2, fastestS2, driverBests.s2);
                const s3Status = getSectorStatus(sector.sector_3, fastestS3, driverBests.s3);

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--f1-border)',
                      borderRadius: '6px',
                      padding: '12px',
                    }}
                  >
                    <div className="f1-monospace" style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '12px' }}>
                      LAP {sector.lap_number}
                    </div>

                    {/* Sector Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {[
                        { label: 'S1', value: sector.sector_1, status: s1Status },
                        { label: 'S2', value: sector.sector_2, status: s2Status },
                        { label: 'S3', value: sector.sector_3, status: s3Status },
                      ].map((sector_data) => {
                        let bgColor = 'rgba(0, 0, 0, 0.3)';
                        if (sector_data.status.isFastest) bgColor = 'rgba(168, 85, 247, 0.2)';
                        else if (sector_data.status.isPersonalBest) bgColor = 'rgba(34, 197, 94, 0.2)';
                        else if (sector_data.status.isSlower) bgColor = 'rgba(234, 179, 8, 0.2)';

                        return (
                          <div key={sector_data.label} style={{ textAlign: 'center' }}>
                            <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                              {sector_data.label}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTimeExpanded(`detail-${idx}-${sector_data.label}`, e);
                              }}
                              className="f1-monospace"
                              style={{
                                padding: '8px',
                                background: bgColor,
                                border: `1px solid ${
                                  sector_data.status.isFastest ? '#a855f7' :
                                  sector_data.status.isPersonalBest ? '#22c55e' :
                                  sector_data.status.isSlower ? '#eab308' : '#374151'
                                }`,
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
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
                              {formatTimeDisplay(sector_data.value, expandedTimes.has(`detail-${idx}-${sector_data.label}`))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Lap Time */}
                    <div>
                      <div className="f1-monospace" style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>
                        LAP TIME
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTimeExpanded(`detail-${idx}-lap`, e);
                        }}
                        className="f1-monospace"
                        style={{
                          padding: '12px',
                          background: sector.lap_time === fastestLap ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                          border: sector.lap_time === fastestLap ? '1px solid #22c55e' : '1px solid #374151',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: sector.lap_time === fastestLap ? '#22c55e' : 'inherit',
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
                        {formatTimeDisplay(sector.lap_time, expandedTimes.has(`detail-${idx}-lap`))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
