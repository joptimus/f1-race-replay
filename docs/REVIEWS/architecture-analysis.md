# Architecture Analysis: Lights Modal Playback Fix

**Purpose:** Visual explanation of the fix and its impact on system architecture

**Date:** December 21, 2025

---

## State Flow Diagram

### BEFORE FIX (Broken)

```
┌─────────────────────────────────────────────────────────────┐
│ User Clicks Play Button                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ handlePlayWithLights()                                      │
│ - setHasPlayedLights(true)                                  │
│ - setLightsSequenceActive(true)                             │
│ - play()  ◀─── PROBLEM: Called too early!                   │
│ - lightsBoardRef.current?.startSequence()                   │
└────────────────────┬────────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
    ┌──────────────┐   ┌──────────────────────┐
    │ isPlaying    │   │ LightsBoard starts    │
    │ = true       │   │ 5 second sequence     │
    └──────┬───────┘   └──────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ usePlaybackAnimation detects          │
    │ isPlaying = true                     │
    │ ❌ Starts advancing frameIndex        │
    │    WHILE lights are showing!         │
    └──────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ useReplayWebSocket effect fires      │
    │ Sends {"action": "play"} to backend   │
    │ Backend starts streaming frames       │
    │ ❌ BOTH animating during lights!     │
    └──────────────────────────────────────┘
           │
           ▼
    Cars move while lights modal showing
    User sees broken experience ❌
```

### AFTER FIX (Correct)

```
┌─────────────────────────────────────────────────────────────┐
│ User Clicks Play Button                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ handlePlayWithLights()                                      │
│ - setHasPlayedLights(true)                                  │
│ - lightsBoardRef.current?.startSequence()                   │
│ - ✅ No play() call yet!                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────┐
    │ LightsBoard starts 5 second sequence  │
    │ Lights turn on, off, audio plays      │
    │ All with isPlaying = false            │
    │ usePlaybackAnimation stays dormant    │
    │ ✅ Animation is paused                │
    └──────┬───────────────────────────────┘
           │
           ├─ Light 1 (0s)
           ├─ Light 2 (1s)
           ├─ Light 3 (2s)
           ├─ Light 4 (3s)
           ├─ Light 5 (4s)
           ├─ Lights off (5s)
           ├─ Audio plays (5-7s)
           └─ Modal fades (6-7s)
                     │
                     ▼
    ┌──────────────────────────────────────┐
    │ LightsBoard.onSequenceComplete fired  │
    │ handleLightsSequenceComplete()        │
    │ play()  ✅ Now called at right time!  │
    └──────┬───────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────┐
    │ isPlaying = true                      │
    │ ✅ Both frontend and backend start    │
    │    together, synchronized             │
    └──────────────────────────────────────┘
           │
           ▼
    Smooth, synchronized playback starts
    User sees correct behavior ✅
```

---

## Component Architecture

### Separation of Concerns (IMPROVED)

```
┌─────────────────────────────────────────────────────────────┐
│ UI LAYER (React Components)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────┐    ┌──────────────────┐                │
│ │ PlaybackControls│    │ LightsBoard      │                │
│ │                 │    │ (handles timing) │                │
│ │ User clicks ────┼───→ Shows modal       │                │
│ │   Play/Pause    │    │ 5 second sequence│                │
│ └────────┬────────┘    └────────┬─────────┘                │
│          │                      │                          │
│          └──────────┬───────────┘                          │
│                     │                                      │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ App.tsx - ReplayView                                  │ │
│ │ - handlePlayWithLights()                              │ │
│ │ - handleLightsSequenceComplete()                      │ │
│ │   ✅ Controls playback timing via play()/pause()      │ │
│ └──────────────────┬───────────────────────────────────┘ │
│                    │                                      │
│                    ▼                                      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Zustand Store (replayStore)                          │ │
│ │ - playback.isPlaying (global source of truth)        │ │
│ │   ✅ Single source of truth                          │ │
│ └──────────────────┬───────────────────────────────────┘ │
└────────────────────┼──────────────────────────────────────┘
                     │
                     │ isPlaying changed
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ANIMATION LAYER (Frontend Timing)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ usePlaybackAnimation Hook                            │   │
│ │ - Subscribes to: playback.isPlaying                 │   │
│ │ - Advances: playback.frameIndex via requestAnimFrame│   │
│ │ ✅ Receives isPlaying at correct time               │   │
│ └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼──────────────────────────────────────┘
                     │
                     │ frameIndex changed
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ NETWORK LAYER (WebSocket Sync)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ useReplayWebSocket Hook                              │   │
│ │ - Subscribes to: playback.isPlaying                 │   │
│ │ - Subscribes to: playback.frameIndex                │   │
│ │ - Sends: {"action": "play/pause"} commands          │   │
│ │ - Sends: {"action": "seek", "frame": N}            │   │
│ │ ✅ Backend follows frontend's lead                  │   │
│ └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼──────────────────────────────────────┘
                     │
                     │ WebSocket message
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI + WebSocket)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ handle_replay_websocket()                            │   │
│ │ - Receives: "play" command                          │   │
│ │ - Sets: is_playing = True                           │   │
│ │ - Starts: advancing frame_index                     │   │
│ │ - Sends: serialized frames to frontend             │   │
│ │ ✅ Respects frontend's timing                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Both frontend and backend in sync ✅                        │
└─────────────────────────────────────────────────────────────┘
```

### Control Flow (Explicit Sequencing)

```
┌─────────────────────────────────────────────────────┐
│ User clicks Play                                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Is first play?       │
        │ (hasPlayedLights?)   │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
       NO                    YES (first play)
        │                     │
        │                     ▼
        │          ┌────────────────────────┐
        │          │ Show lights modal      │
        │          │ startSequence()        │
        │          │ Wait 5 seconds         │
        │          │ Play audio (1-2s)      │
        │          │ Fade out (0.5s)        │
        │          └────────────┬───────────┘
        │                       │
        │                       ▼ onSequenceComplete
        │          ┌────────────────────────┐
        │          │ play()                 │
        │          │ isPlaying = true       │
        │          └────────────┬───────────┘
        │                       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Animation starts     │
        │ WebSocket sync       │
        │ Backend streams      │
        │ frames               │
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Playback            │
        │ ✅ Synchronized      │
        └──────────────────────┘
```

---

## State Transition Diagram

### ReplayView Component State

```
Session Load
    │
    ├─ hasPlayedLights = false ──────────────┐
    │                                        │
    │                                        │
    ▼                                        │
User clicks Play                            │
    │                                        │
    ├─ Check hasPlayedLights                 │
    │  │                                     │
    │  ├─ true → Resume (no lights)          │
    │  │                                     │
    │  └─ false → Show lights                │
    │       │                                │
    │       ├─ setHasPlayedLights = true ───┤
    │       │                                │
    │       └─ startSequence()               │
    │            │                           │
    │            ├─ 5s: lights play          │
    │            ├─ 1s: audio plays          │
    │            └─ onSequenceComplete       │
    │                 │                      │
    │                 └─ play()               │
    │                    isPlaying = true     │
    │                                        │
    ▼                                        │
Playback                                    │
    │                                        │
    ├─ Pause → pause()                       │
    │  isPlaying = false                     │
    │  │                                     │
    │  └─ User clicks Play again             │
    │     (hasPlayedLights still true)       │
    │     → play() directly (no lights)  ────┤
    │                                        │
    └─ Load new session                      │
       → hasPlayedLights = false ────────────┘
```

---

## Timing Sequence Diagram

```
Timeline (seconds)
0.0 ─── User clicks Play
        handlePlayWithLights() called
        hasPlayedLights = true
        setLightsSequenceActive(true)  ❌ REMOVED
        play()  ❌ REMOVED (was here in old code)
        lightsBoardRef.current?.startSequence()

0.05 ── LightsBoard.useLightsBoard starts
        setIsVisible(true)
        setCurrentPhase('lights')

0.1 ─── Light 1 turns on
0.2 ─── Beep sound

1.0 ─── Light 2 turns on
1.1 ─── Beep sound

2.0 ─── Light 3 turns on
2.1 ─── Beep sound

3.0 ─── Light 4 turns on
3.1 ─── Beep sound

4.0 ─── Light 5 turns on
4.1 ─── Beep sound

5.0 ─── All lights off
        setCurrentPhase('audio')
        mainAudioRef.current?.play()  "Lights Out"

6.5 ─── Audio ends
        handleAudioEnd()
        setCurrentPhase('fadeout')
        (650ms fade duration)

7.15 ── Fade complete
        setIsVisible(false)
        setCurrentPhase('idle')

7.16 ── LightsBoard.useEffect detects
        !isVisible && currentPhase === 'idle'
        onSequenceComplete callback fires

7.17 ── handleLightsSequenceComplete()
        play()  ✅ Called at right time!
        isPlaying = true

7.18 ── usePlaybackAnimation effect triggers
        isPlaying changed to true
        startTimeRef.current = performance.now()
        startFrameRef.current = 0
        requestAnimationFrame loop starts

7.19 ── useReplayWebSocket effect triggers
        playback.isPlaying changed to true
        sendCommandRef.current({action: "play", speed: 1.0})
        WebSocket sends to backend

7.20 ── Backend receives play command
        is_playing = True
        frame_index += speed * (1/60) * 25

7.21+ ── Streaming begins
        Both frontend and backend in sync ✅
```

---

## Data Structure Comparison

### App.tsx Local State

**BEFORE:**
```typescript
const [menuOpen, setMenuOpen] = useState(false);
const [lightsSequenceActive, setLightsSequenceActive] = useState(false);  ❌ REMOVED
const [hasPlayedLights, setHasPlayedLights] = useState(false);
```

**AFTER:**
```typescript
const [menuOpen, setMenuOpen] = useState(false);
const [hasPlayedLights, setHasPlayedLights] = useState(false);  ✅ Simplified
```

**Benefit:** Single boolean `hasPlayedLights` sufficient to control first-play behavior

### useReplayWebSocket Hook Parameters

**BEFORE:**
```typescript
export const useReplayWebSocket = (
  sessionId: string | null,
  delayPlayback: boolean = false  ❌ REMOVED
) => {
  const pendingPlaybackRef = useRef<boolean>(false);  ❌ REMOVED
  ...
}
```

**AFTER:**
```typescript
export const useReplayWebSocket = (
  sessionId: string | null  ✅ Only sessionId needed
) => {
  // No pendingPlaybackRef needed ✅
  ...
}
```

**Benefit:** Simpler interface, no ref-based state tracking

### Effect Dependencies

**BEFORE:**
```typescript
useEffect(() => {
  // Complex delay logic
}, [playback.isPlaying, playback.speed, delayPlayback]);  // 3 deps
```

**AFTER:**
```typescript
useEffect(() => {
  // Simple sync
}, [playback.isPlaying, playback.speed]);  // 2 deps
```

**Benefit:** Fewer dependencies, easier to reason about

---

## Message Flow (WebSocket)

### First Play Sequence

```
FRONTEND                      WEBSOCKET               BACKEND
   │                              │                      │
   ├─ play()                      │                      │
   ├─ isPlaying=true              │                      │
   │                              │                      │
   ├─ Effect detects change       │                      │
   │                              │                      │
   └─────────────────────────────→│                      │
        {"action": "play",         │                      │
         "speed": 1.0}            │                      │
                                   │→ is_playing=true     │
                                   │→ frame_index+=1/60*25│
                                   │                      │
                                   │←──────────────────────
                                   │  msgpack(frame_data) │
   ←──────────────────────────────────────────────────────
        Frame data received
   │
   ├─ setCurrentFrame()
   ├─ usePlaybackAnimation updates frameIndex
   │
   └─────────────────────────────→│                      │
        {"action": "seek",         │                      │
         "frame": 1}              │                      │
                                   │→ frame_index=1.0     │
                                   │                      │
                                   │←──────────────────────
                                   │  msgpack(frame_data) │
```

---

## Hooks Dependency Chain

### Critical Dependencies

```
replayStore (global state)
    │
    ├─────────────────────────────────┐
    │                                 │
    ▼                                 ▼
playback.isPlaying              playback.frameIndex
    │                                 │
    ├─→ usePlaybackAnimation          ├─→ useReplayWebSocket
    │   (animates frameIndex)         │   (sends seek commands)
    │                                 │
    ├─→ useReplayWebSocket            │
    │   (sends play/pause)            │
    │                                 │
    └─→ PlaybackControls              └─→ TrackVisualization3D
        (button state)                    (renders cars)
```

### No Circular Dependencies ✅

- Effects depend on store state
- Store doesn't depend on effects
- Clean unidirectional data flow

---

## Error Handling

### State Machine Robustness

```
Playing:
  ├─ Pause → paused state ✅
  ├─ Seek → seek position ✅
  ├─ Speed change → update speed ✅
  └─ End of race → auto-pause ✅

Paused:
  ├─ Play → playing state ✅
  │  └─ First play? → show lights ✅
  ├─ Seek → seek position ✅
  ├─ Speed change → update speed ✅
  └─ Load new session → reset ✅

Lights Sequence:
  ├─ Complete normally → play() ✅
  ├─ Skip clicked → play() ✅
  ├─ Audio end detected → complete ✅
  ├─ Timeout (5s) → complete ✅
  └─ Navigation away → cleanup ✅
```

All transitions handled correctly. No stuck states.

---

## Risk Matrix

```
Risk vs. Impact Matrix:

                    HIGH IMPACT
                         │
                         │
MEDIUM ────┼─────────────┼─────────────┼──── LOW
LIKELIHOOD │             │             │
           │      *2     │             │
           │  (nav)      │    *1       │
           │             │  (callback) │
           │             │             │
           │             │             │
LOW ───────┼─────────────┼─────────────┼──── HIGH
                         │
                    LOW IMPACT

*1 = Callback firing on wrong session (test #2)
*2 = Edge cases (pause during lights, slow load)

Current risks LOW overall (need testing for #2)
```

---

## Conclusion

**Architecture Quality:** ⭐⭐⭐⭐☆ (4/5)

**Strengths:**
- ✅ Clear separation of concerns (UI → Animation → Network)
- ✅ Unidirectional data flow (store → effects → commands)
- ✅ Explicit state transitions (no implicit timing)
- ✅ Simpler code (removed complexity)

**Areas for Improvement:**
- ⚠️ Consider AbortController for LightsBoard cleanup
- ⚠️ Document UX intent for pause button during lights
- ⚠️ Add loading state overlay design

**Overall:** Solid architectural improvement with proper separation of concerns.
