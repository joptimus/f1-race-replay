import asyncio
from fastapi import WebSocket, WebSocketDisconnect
import sys
from pathlib import Path
import msgpack

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


async def handle_replay_websocket(websocket: WebSocket, session_id: str, active_sessions: dict):
    await websocket.accept(subprotocol=None)
    print(f"[WS] Client connected for session {session_id}")

    if session_id not in active_sessions:
        print(f"[WS] Session {session_id} not found")
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    session = active_sessions[session_id]

    # Wait for session to load with timeout
    load_timeout = 300  # 5 minutes max
    load_start = asyncio.get_event_loop().time()
    while not session.is_loaded:
        elapsed = asyncio.get_event_loop().time() - load_start
        if elapsed > load_timeout:
            print(f"[WS] Session load timeout after {elapsed}s")
            await websocket.send_json({"error": "Session load timeout"})
            await websocket.close()
            return
        await asyncio.sleep(0.5)

    if session.load_error:
        print(f"[WS] Session load error: {session.load_error}")
        await websocket.send_json({"error": session.load_error})
        await websocket.close()
        return

    print(f"[WS] Session loaded with {len(session.frames)} frames")

    frame_index = 0.0
    playback_speed = 1.0
    is_playing = False
    last_frame_sent = -1

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)

                if data.get("action") == "play":
                    is_playing = True
                    playback_speed = data.get("speed", 1.0)
                    print(f"[WS] Play command: speed={playback_speed}")
                elif data.get("action") == "pause":
                    is_playing = False
                    print(f"[WS] Pause command")
                elif data.get("action") == "seek":
                    frame_index = float(data.get("frame", 0))
                    last_frame_sent = -1
                    print(f"[WS] Seek command: frame={frame_index}")
            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                print(f"[WS] Client disconnected for session {session_id}")
                break
            except RuntimeError as cmd_error:
                if "disconnect" in str(cmd_error).lower():
                    print(f"[WS] Client disconnected (RuntimeError): {cmd_error}")
                    break
                print(f"[WS] Error receiving command: {cmd_error}")
                continue
            except Exception as cmd_error:
                print(f"[WS] Error receiving command: {cmd_error}")
                continue

            try:
                if is_playing:
                    frame_index += playback_speed * (1.0 / 60.0) * 25

                current_frame = int(frame_index)
                if current_frame != last_frame_sent and 0 <= current_frame < len(session.frames):
                    frame_data = session.serialize_frame_msgpack(current_frame)
                    await websocket.send_bytes(frame_data)
                    last_frame_sent = current_frame

                if frame_index >= len(session.frames):
                    is_playing = False
                    frame_index = len(session.frames) - 1

                await asyncio.sleep(1 / 60)
            except WebSocketDisconnect:
                print(f"[WS] Client disconnected while sending frames")
                break
            except Exception as send_error:
                print(f"[WS] Error sending frame: {send_error}")
                break

    except Exception as e:
        print(f"[WS] Unexpected WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await websocket.close()
