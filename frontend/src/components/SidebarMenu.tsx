/**
 * Sidebar menu with navigation options
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Upload, RefreshCw, Palette } from "lucide-react";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSession?: () => void;
  onRefreshData?: () => void;
  showSectorColors?: boolean;
  onToggleSectorColors?: () => void;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  isOpen,
  onClose,
  onLoadSession,
  onRefreshData,
  showSectorColors,
  onToggleSectorColors,
}) => {
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
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Load Session */}
                {onLoadSession && (
                  <button
                    onClick={() => {
                      onLoadSession();
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
                    <Upload size={18} />
                    <span>Load Season</span>
                  </button>
                )}

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
