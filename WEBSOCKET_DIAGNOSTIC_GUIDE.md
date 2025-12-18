# WebSocket Connection Diagnostic Guide

## Summary of Findings

After thorough investigation, the WebSocket connection system is **working correctly** at the server and protocol level:

✓ Session creation works
✓ Session loading works
✓ WebSocket connections succeed
✓ Frames are received and properly serialized (msgpack binary)
✓ 3405+ bytes of frame data transmitted successfully in tests

## Added Diagnostics

### Frontend Logging (useReplayWebSocket.ts)

The frontend hook now includes comprehensive logging to identify any connection issues:

#### Connection Establishment
```
[WS Client] Connecting to: ws://localhost:8000/ws/replay/2025_1_R
[WS Client] WebSocket object created
[WS Client] WebSocket connected, about to send seek(0)
[WS Client] sendCommand function exists: function
[WS Client] Sending command to server
[WS Client] seek(0) sent
```

#### Frame Reception
```
[WS Client] Message received, data type: Uint8Array, size: 3405
[WS Client] Decoding msgpack, data length: 3405
[WS Client] Decoded frame: {
  frame_index: 0,
  t: 0,
  lap: 1,
  drivers_count: 20,
  has_error: false
}
```

#### Connection Closure
```
[WS Client] WebSocket closed
[WS Client] Close event: {
  code: 1000,           // Normal closure
  reason: "",
  wasClean: true
}
```

#### Error Cases
```
[WS Client] WebSocket error: Error
[WS Client] Error details: {
  type: "error",
  message: "..."
}

[WS Client] Failed to decode frame: TypeError: ...
[WS Client] Error stack: ...
```

### Backend Logging (websocket.py)

The backend handler now logs more debugging information:

```
[WS] Active sessions: ['2025_1_R', '2025_12_R']
[WS] Session loaded with 143860 frames
[WS] Session 2025_1_R not found in active_sessions
[WS] Available sessions: ['2025_12_R']
```

## How to Diagnose Connection Issues

### Step 1: Open Browser Console

When you load the application and the connection drops, open DevTools (F12) and go to the **Console** tab.

### Step 2: Look for These Key Messages

#### Good Connection
You should see:
```
[WS Client] Connecting to: ws://localhost:8000/ws/replay/XXXX_XX_X
[WS Client] WebSocket object created
[WS Client] WebSocket connected, about to send seek(0)
[WS Client] Sending command to server
[WS Client] seek(0) sent
[WS Client] Message received, data type: Uint8Array, size: XXXX
[WS Client] Decoded frame: { frame_index: 0, ... }
```

#### Connection Failed (Session Not Found)
Look for this sequence:
```
[WS Client] Connecting to: ws://localhost:8000/ws/replay/2025_1_R
[WS Client] WebSocket object created
[WS Client] WebSocket connected, about to send seek(0)
[WS Client] WebSocket error: Event
[WS Client] WebSocket closed
[WS Client] Close event: { code: 1000, reason: "", wasClean: true }
```

If you see this, check the **Server Logs** for:
```
[WS] Session 2025_1_R not found in active_sessions
[WS] Available sessions: [...]
```

#### Frame Decoding Error
If you see:
```
[WS Client] Failed to decode frame: TypeError: ...
[WS Client] Error stack: ...
```

The connection is working but there's an issue with the msgpack decoding. This would suggest a data format mismatch.

### Step 3: Check Server Logs

Run the dev server with: `node dev.js`

Look for messages starting with `[WS]`:

```bash
[WS] Client connected for session 2025_1_R
[WS] Active sessions: ['2025_1_R']
[WS] Session loaded with 143860 frames
[WS] Seek command: frame=0
[WS] Play command: speed=1.0
[WS] Client disconnected for session 2025_1_R
```

## Potential Issues and Solutions

### Issue 1: "Session not found" Error
**Symptom:**
- Browser console shows connection attempt but no frames received
- Server logs show `[WS] Session XXXX_XX_X not found`

**Cause:**
The WebSocket connected before the session was registered in `active_sessions`

**Solution:**
This should not happen in normal flow, but if it does:
1. Check that the REST API created the session (check Network tab)
2. Wait for session status to return `loading: false` before navigation
3. Check dev server logs for session creation messages

### Issue 2: "Cannot decode frame" Error
**Symptom:**
- Browser console shows msgpack decoding error
- Server logs show frames being sent

**Cause:**
Data format mismatch or corrupted frame

**Solution:**
1. Check that `frontend/package.json` has `msgpackr` installed
2. Run `npm install` in frontend directory
3. Clear browser cache and reload

### Issue 3: Immediate Disconnection (No Frames)
**Symptom:**
- Connection opens but closes immediately
- No frame data received
- No error messages in console

**Cause:**
Could be:
1. Session failed to load (check server logs for exception)
2. Session timeout (very large race, >5 min load time)
3. Race condition in session registration

**Solution:**
1. Check server logs for `[REPLAY]` messages about session loading
2. If session says "Large session" with many frames, wait longer
3. Check if there are any Python exceptions in server logs
4. Try with a smaller/simpler race session (fewer drivers/laps)

## Test Script

To verify the WebSocket works independently of the frontend:

```bash
python test_websocket_connection.py
```

This script:
1. Creates a session via REST API
2. Waits for it to load
3. Connects to WebSocket
4. Sends a seek command
5. Receives and validates frame data

If this script works but the frontend doesn't, the issue is in the frontend application logic, not the server.

## File-by-File Changes

### Frontend: `frontend/src/hooks/useReplayWebSocket.ts`
- Line 58: Log WebSocket URL being connected
- Line 61: Log WebSocket object creation
- Lines 64-66: Log onopen handler execution and sendCommand status
- Line 70: Log message reception with data type and size
- Lines 75-83: Log data type conversion details
- Lines 89-95: Log decoded frame metadata
- Lines 106-107: Log decoding errors with stack traces
- Lines 112-116: Enhanced error event logging
- Lines 120-125: Enhanced close event logging

### Backend: `backend/app/websocket.py`
- Line 13: Log list of active sessions
- Line 16-17: Better error message with available sessions list

## Next Steps If Issues Persist

1. **Enable verbose logging** - Add more logging to frame serialization
2. **Check message formats** - Log raw bytes before/after msgpack encoding
3. **Profile performance** - Check if session loading is actually completing
4. **Test with different sessions** - Verify issue isn't specific to certain race data
5. **Network diagnostics** - Use browser DevTools → Network → WS tab to monitor WebSocket traffic

## Performance Expectations

- **Small sessions** (<20k frames): Loads in ~30 seconds
- **Medium sessions** (20-50k frames): Loads in ~1-2 minutes
- **Large sessions** (>50k frames): Loads in ~2-5 minutes

If a session takes longer than 5 minutes, the WebSocket connection will timeout.

---

**Last Updated:** After comprehensive testing with test_websocket_connection.py
**Status:** Diagnostics in place, ready for user feedback
