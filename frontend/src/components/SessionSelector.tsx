/**
 * Session selector menu for choosing season and Grand Prix
 * Placed in the header menu bar
 */

import React, { useState } from "react";
import { dataService } from "../services/dataService";

interface SessionSelectorProps {
  currentYear?: number;
  currentRound?: number;
  isLoading?: boolean;
  onSessionSelect: (year: number, round: number) => void;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  currentYear,
  currentRound,
  isLoading = false,
  onSessionSelect,
}) => {
  const years = dataService.getAvailableYears();
  const defaultYear = currentYear ?? years[0];
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const defaultRound = currentRound ?? dataService.getRoundsForYear(defaultYear)[0]?.round ?? 1;
  const [selectedRound, setSelectedRound] = useState(defaultRound);
  const availableRounds = dataService.getRoundsForYear(selectedYear);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    // Reset round to first available round for new year
    const roundsForYear = dataService.getRoundsForYear(year);
    if (roundsForYear.length > 0) {
      setSelectedRound(roundsForYear[0].round);
    }
  };

  const handleLoad = () => {
    onSessionSelect(selectedYear, selectedRound);
  };

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {/* Year Selector */}
      <select
        value={selectedYear}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        disabled={isLoading}
        style={{
          padding: "8px 12px",
          borderRadius: "4px",
          border: "1px solid var(--f1-border)",
          background: "var(--f1-black)",
          color: "var(--f1-silver)",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "0.85rem",
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      {/* Grand Prix Selector */}
      <select
        value={selectedRound}
        onChange={(e) => setSelectedRound(Number(e.target.value))}
        disabled={isLoading}
        style={{
          padding: "8px 12px",
          borderRadius: "4px",
          border: "1px solid var(--f1-border)",
          background: "var(--f1-black)",
          color: "var(--f1-silver)",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontWeight: 600,
          fontSize: "0.85rem",
          minWidth: "280px",
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {availableRounds.map((roundData) => (
          <option key={roundData.round} value={roundData.round}>
            R{roundData.round} - {roundData.raceName}
          </option>
        ))}
      </select>

      {/* Load Button */}
      <button
        onClick={handleLoad}
        disabled={isLoading}
        style={{
          padding: "8px 16px",
          borderRadius: "4px",
          border: "1px solid var(--f1-red)",
          background: isLoading ? "var(--f1-red)" : "var(--f1-red)",
          color: "white",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontWeight: 700,
          fontSize: "0.85rem",
          textTransform: "uppercase",
          transition: "all 0.2s ease",
          opacity: isLoading ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.currentTarget as any).style.background = "#c70000";
            (e.currentTarget as any).style.boxShadow =
              "0 4px 12px rgba(225, 6, 0, 0.3)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            (e.currentTarget as any).style.background = "var(--f1-red)";
            (e.currentTarget as any).style.boxShadow = "none";
          }
        }}
      >
        {isLoading ? "Loading..." : "Load"}
      </button>
    </div>
  );
};

export default SessionSelector;
