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
  const setCurrentFrame = useReplayStore((state) => state.setCurrentFrame);
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
        // Handle JSON control messages (ready, status, error)
        if (typeof event.data === 'string') {
          const message = JSON.parse(event.data);

          if (message.type === 'ready') {
            console.log("[WS Client] Session ready - frames:", message.frames, "load time:", message.load_time_seconds + "s");
            return;
          }

          if (message.type === 'status') {
            console.log("[WS Client] Status:", message.message, `(${message.elapsed_seconds}s)`);
            return;
          }

          if (message.error) {
            console.error("[WS Client] Server error:", message.error);
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
