/**
 * Sidebar menu with navigation options
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, RefreshCw, Palette, BarChart3 } from "lucide-react";
import { dataService } from "../services/dataService";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
  showSectorColors?: boolean;
  onToggleSectorColors?: () => void;
  currentYear?: number;
  currentRound?: number;
  onSessionSelect?: (year: number, round: number) => void;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  showSectorColors,
  onToggleSectorColors,
  currentYear,
  currentRound,
  onSessionSelect,
}) => {
  const navigate = useNavigate();
  const years = dataService.getAvailableYears();
  const defaultYear = currentYear ?? years[0];
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const defaultRound = currentRound ?? dataService.getRoundsForYear(defaultYear)[0]?.round ?? 1;
  const [selectedRound, setSelectedRound] = useState(defaultRound);
  const availableRounds = dataService.getRoundsForYear(selectedYear);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const roundsForYear = dataService.getRoundsForYear(year);
    if (roundsForYear.length > 0) {
      setSelectedRound(roundsForYear[0].round);
    }
  };

  const handleSelectRace = () => {
    if (onSessionSelect) {
      onSessionSelect(selectedYear, selectedRound);
      onClose();
    }
  };
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
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 990,
            }}
          />

          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              height: "100vh",
              width: "280px",
              background: "#1f1f27",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRight: "1px solid #374151",
              zIndex: 991,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  fontWeight: 900,
                  color: "#e10600",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Menu
              </h2>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Race Selection */}
                {onSessionSelect && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 900,
                        color: "#e10600",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "8px 0",
                      }}
                    >
                      RACE SELECTION
                    </div>

                    {/* Year Header */}
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                      }}
                    >
                      Year
                    </div>

                    {/* Year Buttons */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {years.map((year) => (
                        <button
                          key={year}
                          onClick={() => handleYearChange(year)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: selectedYear === year ? "1px solid #e10600" : "1px solid #374151",
                            background: selectedYear === year ? "rgba(225, 6, 0, 0.1)" : "#111318",
                            color: selectedYear === year ? "#e10600" : "#d1d5db",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: selectedYear === year ? 700 : 600,
                            transition: "all 0.2s ease",
                            flex: "1 1 auto",
                            minWidth: "45px",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedYear !== year) {
                              (e.currentTarget as any).style.borderColor = "#4b5563";
                              (e.currentTarget as any).style.background = "#1f1f27";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedYear !== year) {
                              (e.currentTarget as any).style.borderColor = "#374151";
                              (e.currentTarget as any).style.background = "#111318";
                            }
                          }}
                        >
                          {year}
                        </button>
                      ))}
                    </div>

                    {/* Rounds Header */}
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        marginTop: "12px",
                        marginBottom: "4px",
                      }}
                    >
                      Rounds
                    </div>

                    {/* Round Buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {availableRounds.map((roundData) => (
                        <button
                          key={roundData.round}
                          onClick={() => setSelectedRound(roundData.round)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "4px",
                            border: selectedRound === roundData.round ? "1px solid #e10600" : "1px solid #374151",
                            background: selectedRound === roundData.round ? "rgba(225, 6, 0, 0.1)" : "#111318",
                            color: selectedRound === roundData.round ? "#e10600" : "#d1d5db",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: selectedRound === roundData.round ? 700 : 600,
                            transition: "all 0.2s ease",
                            textAlign: "left",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedRound !== roundData.round) {
                              (e.currentTarget as any).style.borderColor = "#4b5563";
                              (e.currentTarget as any).style.background = "#1f1f27";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedRound !== roundData.round) {
                              (e.currentTarget as any).style.borderColor = "#374151";
                              (e.currentTarget as any).style.background = "#111318";
                            }
                          }}
                        >
                          R{roundData.round} - {roundData.raceName}
                        </button>
                      ))}
                    </div>

                    {/* Load Race Button */}
                    <button
                      onClick={handleSelectRace}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "4px",
                        border: "1px solid #e10600",
                        background: "#e10600",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        transition: "all 0.2s ease",
                        width: "100%",
                        marginTop: "8px",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as any).style.background = "#c70000";
                        (e.currentTarget as any).style.boxShadow = "0 4px 12px rgba(225, 6, 0, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as any).style.background = "#e10600";
                        (e.currentTarget as any).style.boxShadow = "none";
                      }}
                    >
                      Load Race
                    </button>
                  </div>
                )}

                {/* Divider */}
                {onSessionSelect && <div style={{ height: "1px", background: "#374151", margin: "8px 0" }} />}

                {/* Refresh Data */}
                {onRefreshData && (
                  <button
                    onClick={() => {
                      onRefreshData();
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "6px",
                      border: "1px solid #374151",
                      background: "#111318",
                      color: "#d1d5db",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as any).style.background = "#1f1f27";
                      (e.currentTarget as any).style.borderColor = "#4b5563";
                      (e.currentTarget as any).style.color = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as any).style.background = "#111318";
                      (e.currentTarget as any).style.borderColor = "#374151";
                      (e.currentTarget as any).style.color = "#d1d5db";
                    }}
                  >
                    <RefreshCw size={18} />
                    <span>Refresh Data</span>
                  </button>
                )}

                {/* Toggle Sector Colors */}
                {onToggleSectorColors && (
                  <button
                    onClick={() => {
                      onToggleSectorColors();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "6px",
                      border: `1px solid ${showSectorColors ? "#4b5563" : "#374151"}`,
                      background: showSectorColors ? "#1a3a3a" : "#111318",
                      color: showSectorColors ? "#00e5ff" : "#d1d5db",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as any).style.background = "#1f1f27";
                      (e.currentTarget as any).style.borderColor = "#4b5563";
                      (e.currentTarget as any).style.color = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      const active = showSectorColors;
                      (e.currentTarget as any).style.background = active ? "#1a3a3a" : "#111318";
                      (e.currentTarget as any).style.borderColor = active ? "#4b5563" : "#374151";
                      (e.currentTarget as any).style.color = active ? "#00e5ff" : "#d1d5db";
                    }}
                  >
                    <Palette size={18} />
                    <span>{showSectorColors ? "Sector Colors ON" : "Sector Colors OFF"}</span>
                  </button>
                )}

                {/* Telemetry Comparison */}
                <button
                  onClick={() => {
                    navigate("/comparison");
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    border: "1px solid #374151",
                    background: "#111318",
                    color: "#d1d5db",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                    width: "100%",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.background = "#1f1f27";
                    (e.currentTarget as any).style.borderColor = "#4b5563";
                    (e.currentTarget as any).style.color = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.background = "#111318";
                    (e.currentTarget as any).style.borderColor = "#374151";
                    (e.currentTarget as any).style.color = "#d1d5db";
                  }}
                >
                  <BarChart3 size={18} />
                  <span>Telemetry Comparison</span>
                </button>

                {/* Settings (placeholder) */}
                <button
                  onClick={() => {}}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    border: "1px solid #374151",
                    background: "#111318",
                    color: "#6b7280",
                    cursor: "not-allowed",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                    width: "100%",
                    textAlign: "left",
                    opacity: 0.5,
                  }}
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #374151",
                fontSize: "0.75rem",
                color: "#6b7280",
              }}
            >
              <div style={{ marginBottom: "4px" }}>F1 Race Replay</div>
              <div>v1.0.0</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SidebarMenu;
