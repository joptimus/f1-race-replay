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
    console.log("[WS Client] sendCommand called with:", message, "ws state:", wsRef.current?.readyState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Debounce identical commands within 100ms
      const isIdentical =
        lastSentCommandRef.current &&
        JSON.stringify(lastSentCommandRef.current) === JSON.stringify(message);

      if (!isIdentical) {
        console.log("[WS Client] Sending command to server");
        wsRef.current.send(JSON.stringify(message));
        lastSentCommandRef.current = message;
      } else {
        console.log("[WS Client] Skipped duplicate command");
      }
    } else {
      console.log("[WS Client] WebSocket not ready, state:", wsRef.current?.readyState);
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

    console.log("[WS Client] Connecting to:", wsUrl);

    wsRef.current = new WebSocket(wsUrl);
    console.log("[WS Client] WebSocket object created");

    wsRef.current.onopen = () => {
      console.log("[WS Client] WebSocket connected, about to send seek(0)");
      console.log("[WS Client] sendCommand function exists:", typeof sendCommand);
      // Request initial frame when connection opens
      sendCommand({ action: "seek", frame: 0 });
      console.log("[WS Client] seek(0) sent");
    };

    wsRef.current.onmessage = async (event) => {
      try {
        console.log("[WS Client] Message received, data type:", event.data?.constructor?.name, "size:", event.data?.byteLength || event.data?.length || "unknown");

        // Convert Blob to Uint8Array for msgpack deserialization
        let data: Uint8Array;
        if (event.data instanceof Blob) {
          console.log("[WS Client] Converting Blob to Uint8Array");
          const arrayBuffer = await event.data.arrayBuffer();
          data = new Uint8Array(arrayBuffer);
        } else if (event.data instanceof ArrayBuffer) {
          console.log("[WS Client] Already ArrayBuffer, converting to Uint8Array");
          data = new Uint8Array(event.data);
        } else {
          console.log("[WS Client] Unknown data type, using as-is");
          data = event.data;
        }

        console.log("[WS Client] Decoding msgpack, data length:", data.length);
        const decoder = new Unpackr();
        const decoded = decoder.unpack(data) as FrameData;
        console.log("[WS Client] Decoded frame:", {
          frame_index: decoded.frame_index,
          t: decoded.t,
          lap: decoded.lap,
          drivers_count: decoded.drivers ? Object.keys(decoded.drivers).length : 0,
          has_error: !!decoded.error,
        });

        if (!decoded.error) {
          setCurrentFrame(decoded);
          if (decoded.frame_index !== undefined) {
            setFrameIndex(decoded.frame_index);
          }
        } else {
          console.error("[WS Client] Frame has error property:", decoded.error);
        }
      } catch (error) {
        console.error("[WS Client] Failed to decode frame:", error);
        console.error("[WS Client] Error stack:", (error as Error).stack);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error("[WS Client] WebSocket error:", error);
      console.error("[WS Client] Error details:", {
        type: error.type,
        message: (error as any).message,
      });
    };

    wsRef.current.onclose = (event) => {
      console.log("[WS Client] WebSocket closed");
      console.log("[WS Client] Close event:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sendCommand, sessionId]);

  // Sync playback state to WebSocket
  useEffect(() => {
    // Only send playback commands if WebSocket is connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("[WS Client] Playback sync skipped - WebSocket not ready, state:", wsRef.current?.readyState);
      return;
    }

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
    // Only send seek commands if WebSocket is connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("[WS Client] Seek sync skipped - WebSocket not ready, state:", wsRef.current?.readyState);
      return;
    }

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
