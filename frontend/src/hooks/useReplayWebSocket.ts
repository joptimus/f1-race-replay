/**
 * WebSocket hook for real-time frame streaming
 * Handles msgpack deserialization and state updates
 */

import { useEffect, useRef, useCallback } from "react";
import { Unpackr } from "msgpackr";
import { useReplayStore } from "../store/replayStore";
import { FrameData } from "../types";

interface WebSocketMessage {
  action: "play" | "pause" | "seek";
  speed?: number;
  frame?: number;
}

export const useReplayWebSocket = (sessionId: string | null) => {
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCurrentFrame = useReplayStore((state) => state.setCurrentFrame);
  const setLoadingProgress = useReplayStore((state) => state.setLoadingProgress);
  const setLoadingError = useReplayStore((state) => state.setLoadingError);
  const setLoadingComplete = useReplayStore((state) => state.setLoadingComplete);
  const setSession = useReplayStore((state) => state.setSession);
  const playback = useReplayStore((state) => state.playback);
  const lastSentCommandRef = useRef<WebSocketMessage | null>(null);
  const sendCommandRef = useRef<(message: WebSocketMessage) => void>();

  // Create sendCommand function (store in ref to avoid dependency issues)
  const sendCommand = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Debounce identical commands within 100ms
      const isIdentical =
        lastSentCommandRef.current &&
        JSON.stringify(lastSentCommandRef.current) === JSON.stringify(message);

      if (!isIdentical) {
        wsRef.current.send(JSON.stringify(message));
        lastSentCommandRef.current = message;
      }
    }
  }, []);

  // Keep sendCommand in ref so it doesn't cause effect re-runs
  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) {
      console.log("[WS Client] No sessionId, skipping connection");
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    console.log("[WS Client] Initiating connection for session:", sessionId);
    const protocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";
    // In development, connect directly to backend WebSocket
    // In production, would use /ws proxy path
    const wsUrl = `${protocol}//localhost:8000/ws/replay/${sessionId}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("[WS Client] Connection opened, requesting initial frame");
      // Request initial frame when connection opens
      if (sendCommandRef.current) {
        sendCommandRef.current({ action: "seek", frame: 0 });
      }
    };

    wsRef.current.onmessage = async (event) => {
      try {
        // Handle JSON control messages (loading_progress, loading_complete, loading_error, frame data)
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);

          // ===== LOADING PHASE MESSAGES =====
          if (message.type === 'loading_progress') {
            console.log("[WS Client] Loading progress:", message.progress + "%");
            setLoadingProgress(message.progress || 0);
            return;
          }

          if (message.type === 'loading_complete') {
            console.log("[WS Client] Loading complete");
            setLoadingProgress(100);
            setLoadingComplete(true);
            setLoadingError(null);

            // Update session metadata if provided
            if (message.metadata && sessionId) {
              setSession(sessionId, message.metadata);
              // Also set total frames for playback UI
              if (message.frames) {
                useReplayStore.getState().setTotalFrames(message.frames);
              }
            }
            return;
          }

          if (message.type === 'loading_error') {
            console.error("[WS Client] Loading error:", message.message);
            setLoadingError(message.message || "Unknown error");
            return;
          }

          console.warn("[WS Client] Unknown control message:", message);
          return;
        }

        // Handle binary msgpack frame data
        let data: Uint8Array;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          data = new Uint8Array(arrayBuffer);
        } else if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else {
          data = event.data;
        }

        const decoder = new Unpackr({
          mapsAsObjects: true, // Convert Maps to plain objects
        });
        const decoded = decoder.unpack(data) as FrameData;

        if (!decoded.error) {
          setCurrentFrame(decoded);
        } else {
          console.error("[WS Client] Frame has error property:", decoded.error);
        }
      } catch (error) {
        console.error("[WS Client] Failed to decode message:", error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("[WS Client] WebSocket error:", error);
    };

    wsRef.current.onclose = () => {
      console.log("[WS Client] WebSocket closed");
    };

    return () => {
      console.log("[WS Client] Cleanup: closing connection for session:", sessionId);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);

  // Timeout: if no activity within 10s, emit error
  useEffect(() => {
    if (!sessionId) return;

    let hasReceivedMessage = false;

    timeoutRef.current = setTimeout(() => {
      if (!hasReceivedMessage) {
        setLoadingError("Unable to connect to telemetry (timeout). Please try again.");
      }
    }, 10000);

    // CRITICAL: Subscribe to ANY loading state change and clear timeout on first message
    const unsubscribe = useReplayStore.subscribe(
      (state) => ({
        progress: state.loadingProgress,
        complete: state.isLoadingComplete,
        error: state.loadingError,
      }),
      () => {
        hasReceivedMessage = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [sessionId, setLoadingError]);

  // Sync playback state to WebSocket
  useEffect(() => {
    // Only send playback commands if WebSocket is connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (playback.isPlaying) {
      sendCommandRef.current?.({
        action: "play",
        speed: playback.speed,
      });
    } else {
      sendCommandRef.current?.({ action: "pause" });
    }
  }, [playback.isPlaying, playback.speed]);

  // Sync frame index (seeking) to WebSocket
  useEffect(() => {
    // Only send seek commands if WebSocket is connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    sendCommandRef.current?.({ action: "seek", frame: playback.frameIndex });
  }, [playback.frameIndex]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendSeek: (frameIndex: number) => {
      if (sendCommandRef.current) {
        sendCommandRef.current({ action: "seek", frame: frameIndex });
      }
    },
  };
};
