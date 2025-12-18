#!/usr/bin/env python3
"""
Test script to diagnose WebSocket connection issues.
This script will:
1. Create a session via REST API
2. Wait for it to load
3. Connect to WebSocket
4. Monitor the connection
"""

import asyncio
import json
import aiohttp
import websockets
from pathlib import Path
import sys

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"

async def create_session(year: int, round_num: int, session_type: str = "R"):
    """Create a replay session via REST API"""
    print(f"\n[TEST] Creating session: {year} round {round_num} {session_type}...")

    async with aiohttp.ClientSession() as session:
        payload = {
            "year": year,
            "round_num": round_num,
            "session_type": session_type,
            "refresh": False
        }

        try:
            async with session.post(f"{BASE_URL}/api/sessions", json=payload) as resp:
                if resp.status != 200:
                    print(f"[TEST] Error creating session: {resp.status}")
                    text = await resp.text()
                    print(f"[TEST] Response: {text}")
                    return None

                data = await resp.json()
                print(f"[TEST] Session created: {data}")
                return data.get("session_id")
        except Exception as e:
            print(f"[TEST] Exception creating session: {e}")
            return None

async def poll_session_status(session_id: str, max_wait: int = 60):
    """Poll session status until it's loaded"""
    print(f"\n[TEST] Polling session status (max {max_wait}s)...")

    async with aiohttp.ClientSession() as session:
        elapsed = 0
        while elapsed < max_wait:
            try:
                async with session.get(f"{BASE_URL}/api/sessions/{session_id}") as resp:
                    if resp.status != 200:
                        print(f"[TEST] Poll error: {resp.status}")
                        await asyncio.sleep(1)
                        elapsed += 1
                        continue

                    data = await resp.json()
                    is_loading = data.get("loading", True)
                    print(f"[TEST] Status: loading={is_loading}")

                    if not is_loading:
                        print(f"[TEST] Session loaded!")
                        return True

                    await asyncio.sleep(1)
                    elapsed += 1

            except Exception as e:
                print(f"[TEST] Exception polling: {e}")
                await asyncio.sleep(1)
                elapsed += 1

        print(f"[TEST] Timeout waiting for session to load")
        return False

async def connect_websocket(session_id: str):
    """Connect to WebSocket and monitor"""
    ws_url = f"{WS_URL}/ws/replay/{session_id}"
    print(f"\n[TEST] Connecting to WebSocket: {ws_url}")

    try:
        async with websockets.connect(ws_url) as websocket:
            print(f"[TEST] WebSocket connected!")

            # Send initial seek command
            print(f"[TEST] Sending seek(0) command...")
            await websocket.send(json.dumps({"action": "seek", "frame": 0}))

            # Wait for response with timeout
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                print(f"[TEST] Received message: {len(msg)} bytes")
                print(f"[TEST] Message preview: {msg[:100] if isinstance(msg, str) else msg[:100]}")
            except asyncio.TimeoutError:
                print(f"[TEST] No message received within 3 seconds (expected for binary msgpack)")
            except Exception as e:
                print(f"[TEST] Error receiving: {e}")

    except Exception as e:
        print(f"[TEST] WebSocket connection failed: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Run the test"""
    print("=" * 60)
    print("F1 Race Replay WebSocket Connection Test")
    print("=" * 60)

    # Create session (use an available round)
    session_id = await create_session(year=2025, round_num=1, session_type="R")
    if not session_id:
        print("[TEST] Failed to create session, aborting")
        return

    # Poll until loaded
    if not await poll_session_status(session_id, max_wait=120):
        print("[TEST] Session failed to load, aborting")
        return

    # Connect to WebSocket
    await connect_websocket(session_id)

    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
