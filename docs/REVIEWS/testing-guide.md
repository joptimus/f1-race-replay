# Testing Guide: Lights Modal Playback Fix

**Version:** 1.0
**Date:** December 21, 2025
**Related Review:** `/docs/REVIEWS/lights-modal-playback-fix-review.md`

This guide provides step-by-step instructions for testing the lights modal playback fix.

---

## Test Environment Setup

### Requirements
- Backend running: `python backend/main.py`
- Frontend running: `cd frontend && npm run dev`
- Browser DevTools console open for log monitoring
- Network tab open to watch WebSocket messages

### Before Each Test
1. Clear browser cache (or use Incognito mode)
2. Check browser console for errors
3. Verify WebSocket connected (green dot in header)
4. Load a race session (2025 Round 12 or any cached session)

---

## CRITICAL Test Cases

These tests must pass before deploying the fix.

### Test 1: First Play with Lights (Primary Use Case)

**What to Test:** Basic lights sequence functionality

**Steps:**
1. Load a fresh race session
2. Click the Play button (top center)
3. Observe: Lights modal should appear
4. Observe: 5 red lights turn on one-by-one (1 per second)
5. Observe: All lights turn off at 5 seconds
6. Observe: "Lights Out" audio plays (~2 seconds)
7. Observe: Modal fades out
8. Observe: Replay cars start moving

**Expected Behavior:**
- Cars do NOT move during entire lights sequence
- No jumping or stuttering at playback start
- Leaderboard and telemetry data update smoothly
- Both frontend animation and backend frame streaming in sync

**Logs to Watch:**
```
[WS Client] Connection opened
[WS Client] Play command → checks isPlaying is true
[WS Client] Sending play action to backend
useLightsBoard: startSequence called
useLightsBoard: playLights called
Light 1 on, Light 2 on, Light 3 on, Light 4 on, Light 5 on
useLightsBoard: audio ended
useLightsBoard: completing sequence
LightsBoard render: isVisible=false, currentPhase=idle
App.tsx: handleLightsSequenceComplete called
```

**Pass Criteria:** ✅
- All 5 lights turn on
- Cars start moving after modal closes
- No console errors
- Smooth frame delivery

---

### Test 2: Navigate to Different Session During Lights

**What to Test:** Edge case - callback handling when changing sessions

**Steps:**
1. Load race session A (e.g., 2025 Round 12)
2. Click Play button → lights start
3. Wait 2-3 seconds (lights are showing, not complete yet)
4. Click Menu button (top-left)
5. Select a different race session B (e.g., 2025 Round 13)
6. Observe: Session B loads
7. Wait for loading modal to close
8. Observe: Replay should NOT be playing
9. Click Play on session B
10. Observe: Lights sequence shows again

**Expected Behavior:**
- Session B loads cleanly without auto-playing
- User must click Play again to see lights
- No unintended playback of session B
- No console errors or warnings

**Logs to Watch:**
```
[WS Client] Client disconnected from [SessionA]
[WS Client] Initiating connection for [SessionB]
App.tsx: handleSessionSelect called
App.tsx: setHasPlayedLights(false) on new session
[WS Client] Session [SessionB] loaded
```

**Pass Criteria:** ✅
- Session B does not auto-play
- No console warnings about pending callbacks
- Fresh lights sequence on session B

**Fail Indicators:** ❌
- Session B auto-plays without user clicking Play
- Multiple "onSequenceComplete" callbacks fire
- Console warning: "Cannot update state on unmounted component"

---

### Test 3: Skip Lights Sequence

**What to Test:** Skip button functionality

**Steps:**
1. Load a race session
2. Click Play → lights modal appears
3. Wait 1-2 seconds (lights partially on)
4. Click "Skip" button (appears in bottom-right of modal)
5. Observe: Modal closes immediately
6. Observe: Replay starts playing immediately

**Expected Behavior:**
- Skip button available during lights sequence
- Modal closes without completing sequence
- Playback starts without delay
- No visual glitches or timeouts

**Logs to Watch:**
```
useLightsBoard: skipSequence called
useLightsBoard: completing sequence
LightsBoard render: isVisible=false, currentPhase=idle
handleLightsSequenceComplete called
```

**Pass Criteria:** ✅
- Modal closes immediately
- Playback starts within 100ms
- No console errors

---

### Test 4: Resume Without Lights (Second Play)

**What to Test:** Subsequent play not showing lights

**Steps:**
1. Load a race session
2. Click Play → lights show → playback starts
3. Let playback run for 5-10 seconds
4. Click Pause button
5. Click Play button again
6. Observe: Lights modal should NOT appear
7. Observe: Playback resumes immediately

**Expected Behavior:**
- No lights modal on second play
- Playback resumes at paused position
- Smooth continuation without delay
- Resume speed respects selected playback speed

**Logs to Watch:**
```
// First play
handlePlayWithLights called, hasPlayedLights: false
Showing lights board
// Second play
handlePlayWithLights called, hasPlayedLights: true
Skipping lights board, already played
App.tsx: play() called directly (not via lights)
```

**Pass Criteria:** ✅
- No lights modal on second play
- Immediate playback resume
- Frame continuity (no jumps)

---

## IMPORTANT Test Cases

These tests should pass to ensure robustness.

### Test 5: Pause During Lights

**What to Test:** Pause button behavior while lights are showing

**Scenario:** User might want to pause during lights

**Steps:**
1. Load a race session
2. Click Play → lights start
3. Wait 1-2 seconds
4. Click Pause button
5. Observe: What happens?

**Expected Behavior (Design Decision Needed):**
- Option A: Pause is disabled during lights (button greyed out)
- Option B: Pause works, but lights continue animating
- Option C: Pause works, lights stop too

**Current Code:** Not specified - pause button appears to be enabled

**Pass Criteria:** ✅
- Consistent behavior (matches design intent)
- No crash or errors
- Clear user experience

**Action:** Verify which behavior is intended and ensure it's consistent

---

### Test 6: Slow Session Load with Lights

**What to Test:** Behavior when lights complete but session still loading

**Steps:**
1. Hard refresh browser (Cmd+Shift+R)
2. Load a race session (not cached)
3. Click Play immediately → lights start
4. Observe: Loading modal might show over/under lights?
5. Wait for session to load (5-15 seconds)
6. Observe: When lights complete, does playback start?
7. Observe: When does session loading finish?

**Expected Behavior:**
- Lights show even while loading
- When lights complete, playback attempts to start
- Once session is ready, frames start streaming
- No crash or timeout

**Logs to Watch:**
```
[WS Client] Loading progress: X%
[WS Client] Loading complete
play() called while isLoadingComplete = false
setTotalFrames received
usePlaybackAnimation starts
```

**Pass Criteria:** ✅
- Graceful handling of slow load
- Playback starts when ready
- No crash or excessive waiting

---

### Test 7: Speed Change During Lights

**What to Test:** Changing playback speed before lights complete

**Steps:**
1. Load a race session
2. Click Play → lights start
3. Wait 1 second
4. Click 2.0x speed button
5. Wait for lights to complete
6. Observe: Playback speed should be 2.0x

**Expected Behavior:**
- Speed change is registered
- When playback starts, uses selected speed
- No lag or desynchronization

**Pass Criteria:** ✅
- Speed change takes effect immediately
- Playback at correct speed when lights complete

---

### Test 8: Seek (Slider) During Lights

**What to Test:** Moving timeline slider before lights complete

**Steps:**
1. Load a race session
2. Click Play → lights start
3. Wait 1 second
4. Drag timeline slider to 2:30
5. Release slider
6. Wait for lights to complete
7. Observe: Should playback start from 2:30?

**Expected Behavior:**
- Slider update is registered
- When lights complete, playback starts from new position
- No visual glitches

**Pass Criteria:** ✅
- Slider position respected
- Playback starts at correct frame

---

## Additional Test Cases

### Test 9: Multiple Sessions in Sequence

**What to Test:** Loading and playing multiple sessions

**Steps:**
1. Load session A → Play → lights → playback
2. Pause playback
3. Load session B → Play → lights → playback
4. Load session C → Play → lights → playback

**Pass Criteria:** ✅
- Each session shows lights correctly
- hasPlayedLights reset properly
- No state leakage between sessions

---

### Test 10: Network Issues

**What to Test:** Reconnection scenarios

**Steps:**
1. Start playback
2. Open DevTools → Network tab
3. Throttle connection (Slow 3G) or disconnect
4. Observe reconnection behavior
5. Resume playback

**Pass Criteria:** ✅
- Graceful handling of disconnection
- Playback resumes when connection restored

---

## Browser Compatibility

Test these combinations:
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)

For each:
- [ ] Test Case 1 (First play with lights)
- [ ] Test Case 4 (Resume without lights)

---

## Performance Monitoring

During testing, watch for:

### Memory Leaks
- Open DevTools → Performance → Record
- Run full lights sequence
- Check for increasing memory usage
- Stop recording and check heap snapshot

### Frame Rate
- Should maintain 60 FPS during lights
- Should maintain 25 FPS equivalent during playback
- No stuttering or drops

### Network
- Initial frame: <100ms latency
- Subsequent frames: <50ms latency
- Frame size: 5-15 KB (msgpack compressed)

---

## Logging Checklist

### Frontend Console (Browser DevTools)

Check for these logs (in order):
```
1. [WS Client] Initiating connection
2. [WS Client] Connection opened
3. [WS Client] Requesting initial frame → seek frame 0
4. handlePlayWithLights called, hasPlayedLights: false
5. Showing lights board
6. useLightsBoard: startSequence called
7. useLightsBoard: playLights called
8. Light 1 on, Light 2 on, Light 3 on, Light 4 on, Light 5 on (spaced 1s apart)
9. useLightsBoard: audio ended
10. useLightsBoard: completing sequence
11. LightsBoard render: isVisible=false, currentPhase=idle
12. handleLightsSequenceComplete called
13. [WS Client] Play command: speed=1.0
14. [WS Client] Sent playback command
```

### Backend Logs (Terminal)

Check for these logs:
```
[WS] Client connected for session [session_id]
[WS] Session [session_id] loaded with XXXXX frames
[WS] Play command for [session_id]: speed=1.0
[WS] sent frame 0 (XXXX bytes)
[WS] sent frame 1 (XXXX bytes)
...
[WS] Client disconnected from [session_id]
```

---

## Regression Testing

### Existing Features to Verify

- [ ] **Playback controls** still work (play, pause, seek)
- [ ] **Speed control** still works (0.25x to 4.0x)
- [ ] **Timeline slider** still works (seeking)
- [ ] **Leaderboard** updates correctly during playback
- [ ] **Selected driver** telemetry displays correctly
- [ ] **Multiple sessions** load and play correctly
- [ ] **Pause and resume** work without glitches
- [ ] **End of race** auto-pauses playback

---

## Failure Resolution

### If Test 1 Fails (Lights don't show)

**Check:**
1. Console errors about LightsBoard?
2. Is `lightsBoardRef.current?.startSequence()` being called?
3. Are audio files loading? Check Network tab for `/audio/lights-*.mp3`
4. Is `isVisible` state in useLightsBoard changing to true?

**Debug:**
```javascript
// In browser console
const store = window.__ZUSTAND_DEVTOOLS__?.state || {};
console.log('isPlaying:', store.playback?.isPlaying);
console.log('hasPlayedLights:', store.session?.hasPlayedLights);
```

---

### If Test 2 Fails (Auto-play on session B)

**Likely Cause:** Old LightsBoard callback firing on new session

**Debug:**
1. Check console for multiple `onSequenceComplete` logs
2. Verify `hasPlayedLights` is reset on new session (should be false)
3. Check if old WebSocket connection properly closed

**Fix Needed:** Possibly add AbortController to cancel pending timeouts

---

### If Test 6 Fails (Crash during slow load)

**Check:**
1. `totalFrames` is 0 when lights complete?
2. usePlaybackAnimation crashes with undefined `totalFrames`?
3. Frame delivery timeout?

**Debug:**
```javascript
// Check store state
const state = useReplayStore.getState();
console.log('totalFrames:', state.playback.totalFrames);
console.log('isLoadingComplete:', state.isLoadingComplete);
```

---

## Sign-Off

After completing all tests, fill in:

```markdown
### Test Results
- Date Tested: ___________
- Tester: ___________
- Browser/OS: ___________

### Critical Tests
- [ ] Test 1: First play with lights - PASS / FAIL
- [ ] Test 2: Navigate during lights - PASS / FAIL / SKIP
- [ ] Test 3: Skip lights - PASS / FAIL

### Important Tests
- [ ] Test 4: Resume without lights - PASS / FAIL
- [ ] Test 5: Pause during lights - PASS / FAIL
- [ ] Test 6: Slow load - PASS / FAIL

### Additional Tests
- [ ] Test 7-10: All passed - YES / NO / PARTIAL

### Overall Result
- ✅ READY TO DEPLOY
- ⚠️ NEEDS FIXES
- ❌ BLOCKING ISSUES

### Notes
[Any issues, observations, or recommendations]
```

---

## Questions?

Refer to the full review: `/docs/REVIEWS/lights-modal-playback-fix-review.md`

For detailed technical analysis of each component.
