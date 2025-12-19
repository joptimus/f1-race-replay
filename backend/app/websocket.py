"""
WebSocket handler for F1 Race Replay real-time frame streaming.

Logging Format:
  All log messages follow the format: [YYYY-MM-DD HH:MM:SS] [module.path] [LEVEL] [TAG] message

  Tags used in this module:
    [WS] - WebSocket connection and frame streaming events

  Example log sequence:
    [2025-12-19 11:40:57] [backend.websocket] [INFO] [WS] Client connected for session 2025_1_R
    [2025-12-19 11:40:59] [backend.websocket] [DEBUG] [WS] Sent status update to 2025_1_R: Loading...
    [2025-12-19 11:41:01] [backend.websocket] [INFO] [WS] Session 2025_1_R loaded with 154173 frames in 3.5s
    [2025-12-19 11:41:01] [backend.websocket] [INFO] [WS] Connection closed for 2025_1_R after 4.2s (0 frames sent)
"""

import asyncio
import logging
import time
from fastapi import WebSocket, WebSocketDisconnect
import sys
from pathlib import Path
import msgpack

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

logger = logging.getLogger("backend.websocket")

async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    connection_start = time.time()

    try:
        await websocket.accept(subprotocol=None)
        logger.info(f"[WS] Client connected for session {session_id}")

        if session_id not in active_sessions:
            logger.warning(f"[WS] Session {session_id} not found. Available: {list(active_sessions.keys())}")
            await websocket.send_json({"error": "Session not found"})
            await websocket.close()
            return

        session = active_sessions[session_id]

        # Wait for session to load with timeout
        load_timeout = 300  # 5 minutes max
        load_start = asyncio.get_event_loop().time()
        load_check_interval = 0.5
        last_status_sent = 0

        while not session.is_loaded:
            elapsed = asyncio.get_event_loop().time() - load_start

            # Send status update every 2 seconds
            if elapsed - last_status_sent > 2.0:
                try:
                    await websocket.send_json({
                        "type": "status",
                        "message": session.loading_status or "Loading...",
                        "elapsed_seconds": int(elapsed)
                    })
                    last_status_sent = elapsed
                    logger.debug(f"[WS] Sent status update to {session_id}: {session.loading_status}")
                except Exception as status_error:
                    logger.warning(f"[WS] Failed to send status update to {session_id}: {status_error}")
                    break

            if elapsed > load_timeout:
                logger.error(f"[WS] Session load timeout for {session_id} after {elapsed:.1f}s")
                await websocket.send_json({"error": f"Session load timeout after {elapsed:.0f}s"})
                await websocket.close()
                return

            await asyncio.sleep(load_check_interval)

        if session.load_error:
            logger.error(f"[WS] Session {session_id} has load error: {session.load_error}")
            await websocket.send_json({"error": session.load_error})
            await websocket.close()
            return

        load_time = asyncio.get_event_loop().time() - load_start
        logger.info(f"[WS] Session {session_id} loaded with {len(session.frames)} frames in {load_time:.1f}s")

        # Send ready message
        await websocket.send_json({
            "type": "ready",
            "frames": len(session.frames),
            "load_time_seconds": load_time
        })

        # Playback state
        frame_index = 0.0
        playback_speed = 1.0
        is_playing = False
        last_frame_sent = -1
        frames_sent = 0
        send_start_time = time.time()

        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)

                    if data.get("action") == "play":
                        is_playing = True
                        playback_speed = data.get("speed", 1.0)
                        logger.debug(f"[WS] Play command for {session_id}: speed={playback_speed}")
                    elif data.get("action") == "pause":
                        is_playing = False
                        logger.debug(f"[WS] Pause command for {session_id}")
                    elif data.get("action") == "seek":
                        frame_index = float(data.get("frame", 0))
                        last_frame_sent = -1
                        logger.debug(f"[WS] Seek command for {session_id}: frame={frame_index}")

                except asyncio.TimeoutError:
                    pass
                except (WebSocketDisconnect, RuntimeError) as disconnect_error:
                    if isinstance(disconnect_error, RuntimeError) and "disconnect" not in str(disconnect_error).lower():
                        logger.debug(f"[WS] Error receiving command from {session_id}: {disconnect_error}")
                        continue
                    logger.info(f"[WS] Client disconnected from {session_id}")
                    break
                except Exception as cmd_error:
                    logger.warning(f"[WS] Unexpected error receiving command from {session_id}: {cmd_error}")
                    continue

                try:
                    if is_playing:
                        frame_index += playback_speed * (1.0 / 60.0) * 25

                    current_frame = int(frame_index)
                    if current_frame != last_frame_sent and 0 <= current_frame < len(session.frames):
                        send_time_start = time.time()
                        frame_data = session.serialize_frame_msgpack(current_frame)
                        send_time = time.time() - send_time_start

                        await websocket.send_bytes(frame_data)
                        frames_sent += 1
                        last_frame_sent = current_frame

                        if frames_sent % 100 == 0:  # Log every 100 frames
                            elapsed_send = time.time() - send_start_time
                            frame_rate = frames_sent / elapsed_send if elapsed_send > 0 else 0
                            logger.debug(f"[WS] {session_id}: sent frame {current_frame} ({len(frame_data)} bytes, {send_time*1000:.1f}ms), {frames_sent} total, {frame_rate:.1f} fps")

                    if frame_index >= len(session.frames):
                        is_playing = False
                        frame_index = len(session.frames) - 1
                        logger.debug(f"[WS] Playback completed for {session_id}")

                    await asyncio.sleep(1 / 60)

                except (WebSocketDisconnect, RuntimeError) as disconnect_error:
                    if isinstance(disconnect_error, RuntimeError) and "disconnect" not in str(disconnect_error).lower():
                        logger.error(f"[WS] Error sending frame to {session_id}: {disconnect_error}")
                        break
                    logger.info(f"[WS] Client disconnected while sending frames to {session_id}")
                    break
                except Exception as send_error:
                    logger.error(f"[WS] Unexpected error sending frame to {session_id}: {send_error}", exc_info=True)
                    break

        except (WebSocketDisconnect, RuntimeError) as e:
            if isinstance(e, RuntimeError) and "disconnect" not in str(e).lower():
                logger.error(f"[WS] Unexpected error in playback loop for {session_id}: {e}")
                import traceback
                traceback.print_exc()
        except Exception as e:
            logger.error(f"[WS] Unexpected WebSocket error for {session_id}: {e}", exc_info=True)
        finally:
            total_time = time.time() - connection_start
            logger.info(f"[WS] Connection closed for {session_id} after {total_time:.1f}s ({frames_sent} frames sent)")
            try:
                await websocket.close()
            except Exception as close_error:
                logger.debug(f"[WS] Error closing WebSocket for {session_id}: {close_error}")
    except Exception as e:
        logger.error(f"[WS] Critical error handling {session_id}: {e}", exc_info=True)
