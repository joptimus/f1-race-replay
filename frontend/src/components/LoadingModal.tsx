/**
 * Loading modal shown while session data is being fetched
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLoadingState } from "../hooks/useLoadingState";
import { useReplayStore } from "../store/replayStore";

interface LoadingModalProps {
  isOpen: boolean;
  sessionId: string | null;
  year?: number;
  round?: number;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  sessionId,
  year = 2025,
  round = 1,
}) => {
  // CRITICAL: Pass isOpen to useLoadingState to drive openedAt reset
  // This fixes the "reload same race → instant close" bug
  const { progress, error, shouldClose, getCloseDelayMs } = useLoadingState(sessionId, isOpen);
  const setSessionLoading = useReplayStore((state) => state.setSessionLoading);

  useEffect(() => {
    // Only run this effect if modal is open and should close
    if (!isOpen) return;

    if (shouldClose()) {
      const delay = getCloseDelayMs();
      if (delay <= 0) {
        setSessionLoading(false);
      } else {
        const timer = setTimeout(() => setSessionLoading(false), delay);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldClose, getCloseDelayMs, setSessionLoading]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.8)",
              backdropFilter: "blur(4px)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: "relative",
              background: "#1f1f27",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "48px 64px",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8)",
              minWidth: "400px",
            }}
          >
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
              Loading Session
            </h2>

            <div
              style={{
                fontSize: "1.125rem",
                color: "#d1d5db",
                marginBottom: "32px",
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              {year} F1 ROUND {round}
            </div>

            {/* Animated Loading Spinner */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                marginBottom: "24px",
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#e10600",
                  }}
                />
              ))}
            </div>

            {/* Progress Bar */}
            {!error && (
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#374151",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginBottom: "8px",
                  }}
                >
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      background: "linear-gradient(to right, #e10600, #ff4444)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "#9ca3af",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {Math.round(progress)}%
                </div>
              </div>
            )}

            {/* Error Message or Status */}
            <div
              style={{
                fontSize: "0.875rem",
                color: error ? "#ff6b6b" : "#9ca3af",
                fontFamily: "monospace",
              }}
            >
              {error ? error : "Processing telemetry data..."}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LoadingModal;
