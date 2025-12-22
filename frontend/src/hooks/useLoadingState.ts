/**
 * Hook for managing loading modal state with minimum display time
 * Reads from global store (fed by useReplayWebSocket)
 */

import { useState, useEffect, useCallback } from "react";
import { useReplayStore } from "../store/replayStore";

const MIN_DISPLAY_MS = 700; // Modal must be visible for at least 700ms

export const useLoadingState = (sessionId: string | null, isOpen: boolean) => {
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const progress = useReplayStore((state) => state.loadingProgress);
  const error = useReplayStore((state) => state.loadingError);
  const isLoadingComplete = useReplayStore((state) => state.isLoadingComplete);

  // CRITICAL FIX: Reset openedAt when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setOpenedAt(performance.now());
    } else {
      setOpenedAt(null);
    }
  }, [isOpen, sessionId]);

  const shouldClose = useCallback(() => {
    if (!openedAt) return false;
    if (error) return false; // Keep open on error
    if (!isLoadingComplete) return false;
    const elapsed = performance.now() - openedAt;
    return elapsed >= MIN_DISPLAY_MS;
  }, [openedAt, error, isLoadingComplete]);

  const getCloseDelayMs = useCallback(() => {
    if (!openedAt) return 0;
    if (error) return Infinity;
    if (!isLoadingComplete) return Infinity;
    const elapsed = performance.now() - openedAt;
    return Math.max(0, MIN_DISPLAY_MS - elapsed);
  }, [openedAt, error, isLoadingComplete]);

  return { progress, error, shouldClose, getCloseDelayMs };
};
