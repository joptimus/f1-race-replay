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
  const { currentFrame, setCurrentFrame, playback, setFrameIndex } = useReplayStore();
  const lastSentCommandRef = useRef<WebSocketMessage | null>(null);

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

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) {
      if (wsRef.current) {
        wsRef.current.close();
      }
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
      // Request initial frame when connection opens
      sendCommand({ action: "seek", frame: 0 });
    };

    wsRef.current.onmessage = async (event) => {
      try {
        // Convert Blob to Uint8Array for msgpack deserialization
        let data: Uint8Array;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          data = new Uint8Array(arrayBuffer);
        } else if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else {
          data = event.data;
        }

        const decoder = new Unpackr();
        const decoded = decoder.unpack(data) as FrameData;

        if (!decoded.error) {
          setCurrentFrame(decoded);
          if (decoded.frame_index !== undefined) {
            setFrameIndex(decoded.frame_index);
          }
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
  }, [sendCommand, sessionId]);

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

  // Sync frame index (seeking) to WebSocket
  useEffect(() => {
    sendCommand({ action: "seek", frame: playback.frameIndex });
  }, [playback.frameIndex, sendCommand]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    currentFrame,
    sendSeek: (frameIndex: number) => {
      sendCommand({ action: "seek", frame: frameIndex });
    },
  };
};
