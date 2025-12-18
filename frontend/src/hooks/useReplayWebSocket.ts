/**
 * WebSocket hook for real-time frame streaming
 * Handles JSON deserialization and state updates
 */

import { useEffect, useRef, useCallback } from "react";
import { useReplayStore } from "../store/replayStore";
import { FrameData } from "../types";

interface WebSocketMessage {
  action: "play" | "pause" | "seek";
  speed?: number;
  frame?: number;
}

export const useReplayWebSocket = (sessionId: string | null) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { currentFrame, setCurrentFrame, playback, session } = useReplayStore();
  const lastSentCommandRef = useRef<WebSocketMessage | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId || !session.metadata) {
      return;
    }

    const protocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";
    // In development, connect directly to backend WebSocket
    // In production, would use /ws proxy path
    const wsUrl = `${protocol}//localhost:8000/ws/replay/${sessionId}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("WebSocket connected");
      // Request initial frame
      sendCommand({ action: "seek", frame: 0 });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const decoded = JSON.parse(event.data) as FrameData;

        if (!decoded.error) {
          setCurrentFrame(decoded);
        }
      } catch (error) {
        console.error("Failed to decode frame:", error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId, session.metadata, setCurrentFrame]);

  // Send control commands to server
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

  // Sync playback state to WebSocket
  useEffect(() => {
    if (playback.isPlaying) {
      sendCommand({
        action: "play",
        speed: playback.speed,
      });
    } else {
      sendCommand({ action: "pause" });
    }
  }, [playback.isPlaying, playback.speed, sendCommand]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    currentFrame,
    sendSeek: (frameIndex: number) => {
      sendCommand({ action: "seek", frame: frameIndex });
    },
  };
};
