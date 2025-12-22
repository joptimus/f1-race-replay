# Loading Bar Progress Synchronization

## Overview

The loading bar is now synced to the actual backend frame generation progress. Previously, the bar would slowly progress to 90% while simulating progress locally, then jump to 100% when the server finished. Now it accurately reflects the telemetry processing percentage.

## Architecture

### Backend Changes

#### 1. **f1_data.py** - Added progress callback support
- Modified `get_race_telemetry()` and `get_quali_telemetry()` to accept optional `progress_callback` parameter
- During frame generation loop (line 980-989), calls the callback every 250 frames with current progress percentage
- Callback invoked in try-catch block to prevent frame generation failure
- Callback receives float value representing 0-100% progress

```python
def get_race_telemetry(session, session_type='R', refresh=False, progress_callback=None):
    ...
    for i in range(num_frames):
        if i % 250 == 0:
            progress_pct = 100*i/num_frames
            if progress_callback:
                try:
                    progress_callback(progress_pct)
                except Exception as e:
                    print(f"[FRAMES] Warning: Progress callback failed: {e}", flush=True)
```

**Note:** Progress callback is NOT supported for qualifying sessions as they use multiprocessing workers. Progress tracking across worker processes would require significant complexity and is left for future implementation.

#### 2. **replay_service.py** - Progress callback integration
- `F1ReplaySession.load_data()` now defines a `progress_callback()` function that updates `loading_status`
- Passes this callback to both `get_race_telemetry()` and `get_quali_telemetry()` calls
- Status format: `"Processing telemetry: XX.X% (XX/100)"`

```python
def progress_callback(progress_pct):
    """Update loading status with frame generation progress"""
    self.loading_status = f"Processing telemetry: {progress_pct:.1f}% ({int(progress_pct)}/100)"
```

#### 3. **websocket.py** - More frequent status updates
- Increased status update frequency from every 2 seconds to every 0.5 seconds
- This allows the frontend to receive progress updates more frequently as the backend processes frames
- Change is minimal in terms of bandwidth (< 1KB/minute overhead)

### Frontend Changes

#### 1. **replayStore.ts** - Added loading progress state
- New field `loadingProgress: number` (0-100)
- New action `setLoadingProgress(progress: number)`
- Allows components to subscribe to progress updates via Zustand

#### 2. **useReplayWebSocket.ts** - Progress extraction
- Added `setLoadingProgress` subscription from store
- In the `onmessage` handler for status messages, extracts percentage using regex from the status text
- Sets `loadingProgress` to min(extracted_progress, 99) during loading to prevent premature 100%
- Sets to 100 when session ready message arrives

```typescript
if (message.type === 'status') {
  const progressMatch = message.message?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (progressMatch) {
    const progress = parseFloat(progressMatch[1]);
    setLoadingProgress(Math.min(progress, 99));
  }
}
```

#### 3. **LoadingModal.tsx** - Real progress display
- Removed local progress simulation
- Now subscribes to `loadingProgress` from the store
- Displays actual backend progress in real-time
- Progress jumps to 100% only when `isFullyLoaded` becomes true

## Data Flow

```
Backend Frame Processing
        ↓
Progress Callback (every 250 frames)
        ↓
F1ReplaySession.loading_status = "Processing telemetry: XX.X%..."
        ↓
WebSocket Status Message (every 0.5s)
        ↓
Frontend receives: {"type": "status", "message": "Processing telemetry: XX.X%..."}
        ↓
useReplayWebSocket extracts progress percentage via regex
        ↓
setLoadingProgress(XX.X) → Zustand store update
        ↓
LoadingModal reads loadingProgress and renders progress bar
```

## Progress Calculation

- Backend: `progress_pct = (current_frame_index / total_frames) * 100`
- Updates every 250 frames (out of typically 150k+ total frames for a race)
- Frontend caps at 99% until session is fully loaded to avoid premature 100%

## Error Handling

- Callback invocation wrapped in try-catch to prevent frame generation failure
- Exceptions logged to stdout and don't propagate
- Frame generation continues even if callback fails

## Testing

To verify the sync works:

1. Start the development server: `node dev.js`
2. Load a new session (one not cached)
3. Watch the loading bar:
   - Should start at 0%
   - Progress smoothly through multiple update stages
   - Should reach ~90-95% right before the "Frame generation complete" log
   - Should jump to 100% after the backend finishes all processing

Compare with the server logs to see correlation between:
- `[FRAMES] Processing frame X/Y (Z%)`
- Progress bar position in the UI

## Known Limitations

- **Qualifying sessions:** No progress reporting (uses multiprocessing with complex worker tracking)
- **Cached sessions:** Progress jumps immediately to 100% (data loaded from cache, no frame generation)

## Related Files

- `shared/telemetry/f1_data.py` - Frame generation with progress tracking
- `backend/app/services/replay_service.py` - Session loading with callback
- `backend/app/websocket.py` - WebSocket status streaming
- `frontend/src/store/replayStore.ts` - State management
- `frontend/src/hooks/useReplayWebSocket.ts` - WebSocket handling
- `frontend/src/components/LoadingModal.tsx` - UI display

## Code Review

This feature was reviewed and approved with recommendations:
- Exception handling added to callback invocation ✓
- Known limitation documented for qualifying sessions ✓
- No impact on multiprocessing compatibility ✓
- No cache file format changes ✓
