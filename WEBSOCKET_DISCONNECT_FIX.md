# WebSocket Disconnect Error Fix

## Problem Report

User reported repeated error messages in server logs:
```
Error receiving command: Cannot call receive on a disconnect message has been received
```

This error was appearing repeatedly instead of gracefully exiting when the client disconnected.

## Root Cause

The WebSocket handler had several issues with disconnect detection:

1. **No explicit WebSocketDisconnect handling** - The code was catching generic `Exception` which caught disconnects but didn't properly identify them
2. **Continued on errors** - When catching exceptions, the code would `continue` instead of breaking, causing it to immediately try to receive again on a dead connection
3. **RuntimeError not handled** - FastAPI sometimes raises `RuntimeError` with a "disconnect" message instead of `WebSocketDisconnect`
4. **No loop exit on disconnect** - The outer loop would continue even after detecting a disconnect

## Solution

### Changes Made

**File:** `backend/app/websocket.py`

1. **Import WebSocketDisconnect exception:**
   ```python
   from fastapi import WebSocket, WebSocketDisconnect
   ```

2. **Add specific disconnect handling in command receive phase:**
   ```python
   except WebSocketDisconnect:
       print(f"[WS] Client disconnected for session {session_id}")
       break
   ```

3. **Add RuntimeError detection for edge cases:**
   ```python
   except RuntimeError as cmd_error:
       if "disconnect" in str(cmd_error).lower():
           print(f"[WS] Client disconnected (RuntimeError): {cmd_error}")
           break
       # Log other runtime errors and continue
       print(f"[WS] Error receiving command: {cmd_error}")
       continue
   ```

4. **Add disconnect handling in frame send phase:**
   ```python
   except WebSocketDisconnect:
       print(f"[WS] Client disconnected while sending frames")
       break
   ```

### How It Works

The error flow is now:

1. **Command Receive Loop:**
   - `TimeoutError` (10ms timeout) → Pass (no message, just continue)
   - `WebSocketDisconnect` → Log and break (clean disconnect)
   - `RuntimeError` with "disconnect" → Log and break (edge case)
   - Other exceptions → Log and continue (unexpected but recoverable)

2. **Frame Send Loop:**
   - `WebSocketDisconnect` → Break (disconnect detected)
   - Other exceptions → Break (connection error)

3. **Main Loop:**
   - Either phase breaks → Outer loop exits
   - Finally block closes the connection properly

## Error Messages

### Before
```
[WS] Error receiving command: Cannot call receive on a disconnect message has been received
[WS] Error receiving command: Cannot call receive on a disconnect message has been received
[WS] Error receiving command: Cannot call receive on a disconnect message has been received
```

### After
```
[WS] Client disconnected for session 2025_18_R
```

Or:
```
[WS] Client disconnected (RuntimeError): Cannot call receive on a disconnect message has been received
```

## Testing

To verify the fix works:

1. Start the dev server: `node dev.js`
2. Select a race session
3. Watch the server logs
4. While watching, close the browser tab or disconnect the client
5. Expected: Single message like `[WS] Client disconnected for session 2025_18_R`
6. No repeated error messages

## Files Modified

- `backend/app/websocket.py` (lines 2, 65-76, 87-89)

## Backward Compatibility

✅ No breaking changes
✅ No API contract changes
✅ No frontend changes needed
✅ Improves logging clarity without affecting functionality

## Performance Impact

- **Positive:** Stops wasting CPU cycles trying to receive on closed connections
- **Positive:** Cleaner server logs (less noise)
- **Neutral:** No change to successful playback performance

---

This fix ensures proper cleanup when clients disconnect and prevents the noisy error logs that were previously appearing.
