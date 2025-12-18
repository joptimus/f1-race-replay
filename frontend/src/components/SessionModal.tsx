/**
 * Session selector modal for choosing F1 season and round
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (year: number, round: number) => void;
  currentYear?: number;
  currentRound?: number;
  isLoading?: boolean;
}

// F1 2025 Season - 24 rounds
const ROUNDS_2025 = Array.from({ length: 24 }, (_, i) => i + 1);
// F1 2024 Season - 24 rounds
const ROUNDS_2024 = Array.from({ length: 24 }, (_, i) => i + 1);

const ROUNDS_BY_YEAR: Record<number, number[]> = {
  2024: ROUNDS_2024,
  2025: ROUNDS_2025,
};

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSessionSelect,
  currentYear = 2025,
  currentRound = 12,
  isLoading = false,
}) => {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedRound, setSelectedRound] = useState(currentRound);
  const years = Object.keys(ROUNDS_BY_YEAR).map(Number).sort().reverse();
  const availableRounds = ROUNDS_BY_YEAR[selectedYear] || [];

  const handleSelect = () => {
    onSessionSelect(selectedYear, selectedRound);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(4px)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              background: "#1f1f27",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "32px",
              width: "90%",
              maxWidth: "500px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
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

            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "#e10600",
                marginBottom: "24px",
                marginTop: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Load Session
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Year Selection */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#d1d5db",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Season
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {years.map((year) => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: "6px",
                        border:
                          selectedYear === year
                            ? "2px solid #e10600"
                            : "1px solid #374151",
                        background: selectedYear === year ? "#e10600" : "#111318",
                        color: selectedYear === year ? "white" : "#9ca3af",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        transition: "all 0.2s ease",
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
              </div>

              {/* Round Selection */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#d1d5db",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Round
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "6px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {availableRounds.map((round) => (
                    <button
                      key={round}
                      onClick={() => setSelectedRound(round)}
                      style={{
                        padding: "12px 8px",
                        borderRadius: "6px",
                        border:
                          selectedRound === round
                            ? "2px solid #e10600"
                            : "1px solid #374151",
                        background:
                          selectedRound === round ? "#e10600" : "#111318",
                        color: selectedRound === round ? "white" : "#9ca3af",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedRound !== round) {
                          (e.currentTarget as any).style.borderColor = "#4b5563";
                          (e.currentTarget as any).style.background = "#1f1f27";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedRound !== round) {
                          (e.currentTarget as any).style.borderColor = "#374151";
                          (e.currentTarget as any).style.background = "#111318";
                        }
                      }}
                    >
                      R{round}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "6px",
                    border: "1px solid #374151",
                    background: "transparent",
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    transition: "all 0.2s ease",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.background = "#1f1f27";
                    (e.currentTarget as any).style.borderColor = "#4b5563";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.background = "transparent";
                    (e.currentTarget as any).style.borderColor = "#374151";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelect}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "6px",
                    border: "2px solid #e10600",
                    background: "#e10600",
                    color: "white",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    transition: "all 0.2s ease",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    opacity: isLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      (e.currentTarget as any).style.background = "#c70000";
                      (e.currentTarget as any).style.boxShadow =
                        "0 6px 16px rgba(225, 6, 0, 0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      (e.currentTarget as any).style.background = "#e10600";
                      (e.currentTarget as any).style.boxShadow = "none";
                    }
                  }}
                >
                  {isLoading ? "Loading..." : "Load"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SessionModal;
