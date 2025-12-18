# WebSocket Debugging Guide

## Recent Fixes Applied

### 1. Frontend Component Safety (Defensive Null Checks)
**Files Modified:**
- `frontend/src/components/TrackVisualization3D.tsx` (Line 333)
- `frontend/src/components/SimpleTrackView.tsx` (Line 13)
- `frontend/src/components/TrackVisualization.tsx` (Line 92)

**What Changed:**
Added explicit checks for `currentFrame.drivers` before accessing to prevent crashes when WebSocket connection drops or sends partial data.

**Impact:** Prevents "can't convert undefined to object" errors and shows graceful loading state instead.

### 2. Backend Error Handling
**File Modified:**
- `backend/app/websocket.py`

**What Changed:**
- Separated error handling for command receiving vs frame sending
- Added detailed error logging with traceback output
- Errors are now prefixed with `[WS]` for easy filtering

**Impact:** Will now show exactly what error causes WebSocket disconnection in server logs.

## How to Test

### 1. Start the Dev Server
```bash
node dev.js
```

### 2. Monitor Server Logs
Watch for messages prefixed with `[WS]`:
- `[WS] Client connected for session` - Connection established
- `[WS] Session loaded with X frames` - Session ready
- `[WS] Play/Pause/Seek commands` - Commands being received
- `[WS] Error receiving command` - Problem with client input
- `[WS] Error sending frame` - Problem with frame transmission
- `[WS] Unexpected WebSocket error` - Unexpected failure (with traceback)

### 3. Navigate to a Session
1. Go to http://localhost:5173
2. Select a race session from the landing page
3. Wait for loading to complete
4. Watch browser console and server logs for any errors

### 4. Interpret Results

**Expected Behavior:**
```
[WS] Client connected for session 2025_18_R
[WS] Session loaded with 143860 frames
[WS] Seek command: frame=0
[WS] Play command: speed=1.0
```

**If Connection Drops:**
Look for one of these errors in logs:
- `[WS] Error receiving command:` - Client sent invalid data
- `[WS] Error sending frame:` - Failed to serialize or send frame
- `[WS] Unexpected WebSocket error:` - Unhandled exception (check traceback)

## Common Issues and Solutions

### Issue 1: "Connection interrupted while page was loading"
**Cause:** Metadata hasn't loaded yet when WebSocket tries to connect
**Fix:** Ensure polling completes before rendering replay view (already implemented)

### Issue 2: Large Sessions Take Too Long to Load
**Cause:** Pre-serializing 50k+ frames takes minutes
**Fix:** Already implemented lazy serialization (serialize on-demand)
**Status:** Should be working - monitor logs for `Using lazy serialization` message

### Issue 3: Component Crashes When WebSocket Drops
**Cause:** Components access undefined properties on partial data
**Fix:** Just applied - defensive null checks on all visualization components
**Status:** Should prevent crashes now

## Advanced Debugging

### Enable Verbose Logging
Add this to backend/app/websocket.py to log every frame:
```python
# After line 77 (last_frame_sent = current_frame):
# print(f"[WS] Sent frame {current_frame}")
```

### Check Session State
Add this to see if session is getting stuck:
```python
# Before line 40:
print(f"[WS] Session is_loaded={session.is_loaded}, frames={len(session.frames)}, error={session.load_error}")
```

### Monitor Serialization Performance
Check `shared/telemetry/f1_data.py` for multiprocessing progress:
```python
# Look for "[REPLAY] Pre-serializing" or "[REPLAY] Large session" messages
```

## Performance Expectations

### Load Times
- Small sessions (<20k frames): ~30 seconds
- Medium sessions (20-50k frames): ~1-2 minutes
- Large sessions (>50k frames): ~2-5 minutes (depends on CPU cores and multiprocessing tuning)

### Frame Transmission
- Should see frames being sent every 16ms (60 FPS)
- Each frame is ~100-500 bytes of binary data (msgpack compressed)

### Memory Usage
- Frontend: ~50-100 MB for large sessions
- Backend: ~500 MB - 2 GB for large sessions (session data + cache)

## Next Steps If Issues Persist

1. **Check Backend Logs**
   - Look for the specific error message
   - Check if session fails to load (load_error would be set)

2. **Check Browser Console**
   - Look for WebSocket error messages
   - Check for failed frame decoding errors

3. **Monitor Network**
   - Use browser DevTools → Network → WS tab
   - Check if frames are being sent
   - Look for frames getting stuck or delayed

4. **Verify Session Data**
   - Manually check if session can load via REST API:
     ```bash
     curl http://localhost:8000/api/sessions/2025_18_R
     ```

5. **Test with Different Sessions**
   - Try different year/round combinations
   - Try sessions with fewer drivers/laps to isolate the issue

## Files Modified in This Session

1. `frontend/src/components/TrackVisualization3D.tsx`
2. `frontend/src/components/SimpleTrackView.tsx`
3. `frontend/src/components/TrackVisualization.tsx`
4. `backend/app/websocket.py`

All changes are backward compatible and should not affect existing functionality.
