# F1 Race Replay - Improvement Plan (Revised)
## Focus: Stabilize First, Test Later

---

## Philosophy

**Tests are valuable after the core is stable.** Right now, the app is still evolving with frequent feature changes and architectural refinements. Writing extensive tests now would be wasted effort - they'd break constantly as the API and core logic changes.

**Better approach:** Fix bugs, stabilize features, then write tests around the stable API.

---

## Revised Roadmap: Stabilization First

### Phase 1: Stabilization & Quality (Weeks 1-2)
**Goal:** Make the app reliable, fix bugs, improve code quality

#### 1.1 Quick Wins (5-6 hours)
These unblock everything and require minimal code changes:

- [ ] **Create `.env.example`** (30 min)
  - Documents all config options
  - No code changes needed

- [ ] **Create `CONTRIBUTING.md`** (2 hours)
  - PR process, code style
  - Links to CLAUDE.md for details

- [ ] **Reorganize `requirements.txt`** (30 min)
  - Move arcade/pyglet to `legacy/requirements.txt`
  - Create `backend/requirements.txt` (FastAPI, Uvicorn only)
  - Create `backend/requirements-dev.txt` (pytest, black, mypy)
  - Root `requirements.txt` can stay minimal or be removed

- [ ] **Enable FastAPI Swagger docs** (15 min)
  - Change `backend/app/main.py` line ~25 to add `docs_url="/api/docs"`
  - Instant API documentation

- [ ] **Add `.pre-commit-config.yaml`** (1 hour)
  - Auto-format on commit
  - Catch basic issues before PR

#### 1.2 Code Quality Improvements (3-4 days)
Make existing code cleaner without major restructuring:

- [ ] **Add Python type hints to critical paths** (2 days)
  - Focus: `shared/telemetry/f1_data.py` and `backend/app/services/replay_service.py`
  - Use type aliases for complex types
  - Don't aim for 100% - focus on function signatures and returns
  - Enable mypy for future code

- [ ] **Extract duplicated sys.path logic** (1 day)
  - Create `shared/__init__.py` that handles path setup once
  - Update imports in all files that do `sys.path.insert()`
  - Result: cleaner imports, easier to maintain

- [ ] **Create basic Pydantic models** (1 day)
  - Move from raw dicts to typed models
  - Files:
    - `backend/models/frame.py` - FrameData, DriverData
    - `backend/models/session.py` - SessionMetadata
    - `backend/models/errors.py` - ErrorResponse
  - Validates data at boundary, catches bugs

#### 1.3 Bug Fixes & Stability (Ongoing)
Fix issues as they're discovered:

- [ ] **Fix known telemetry issues** (TBD)
  - Leaderboard accuracy in first corners
  - Pit stop position calculations
  - Final lap position anomalies
  - Document issues in code, fix when ready

- [ ] **Improve error handling** (1-2 days)
  - Replace print() with logging
  - Create `backend/core/logging.py` (simple setup)
  - Clear error messages to frontend
  - Better handling of missing data

- [ ] **WebSocket reliability** (1-2 days)
  - Test with slow/unstable connections
  - Add reconnection logic if needed
  - Handle frame dropping gracefully

#### 1.4 Documentation (1-2 days)
Help future contributors understand what exists:

- [ ] **Write `docs/ARCHITECTURE.md`** (1 day)
  - How data flows: FastF1 → processing → WebSocket → UI
  - Why websocket instead of polling
  - Frame structure and timing

- [ ] **Write `docs/TROUBLESHOOTING.md`** (1 day)
  - Common issues: port conflicts, cache issues, connection failures
  - How to clear cache, debug mode, etc.

---

### Phase 2: Stabilized Features (Weeks 3-4)
**Goal:** Get the app feature-complete and rock-solid

Once Phase 1 is done and the app feels stable, tackle remaining features:

- [ ] **Verify all session types work** (Race, Sprint, Qualifying, Sprint Qualifying)
- [ ] **Complete telemetry comparison UI** (if in progress)
- [ ] **Sector visualization** (if not complete)
- [ ] **Performance optimization** where needed
- [ ] **Cross-browser testing** (if not done)

---

### Phase 3: Production Readiness (Week 5-6)
**Goal:** Ready to deploy, once we're confident the API won't change

Only after the app is stable should we add production infrastructure:

- [ ] **Docker support**
  - `Dockerfile` for backend
  - `docker-compose.yml` for dev
  - `docker-compose.prod.yml` for production

- [ ] **Environment-based config**
  - `backend/core/config.py` - load from `.env`
  - No hardcoded CORS origins
  - Configurable database/cache paths

- [ ] **Production deployment docs**
  - `docs/DEPLOYMENT.md`
  - How to run with Gunicorn
  - How to run in Docker
  - Monitoring/logging setup

---

### Phase 4: Testing (After Stabilization)
**Goal:** Catch regressions once API is stable

When the app reaches 1.0:

- [ ] **Backend unit tests** - FastAPI routes, services
- [ ] **Frontend component tests** - React components
- [ ] **Integration tests** - Full flow
- [ ] **CI/CD pipeline** - GitHub Actions

**Why wait?**
- API will likely change during stabilization
- Tests would break constantly
- Effort on tests now is wasted
- Once stable, tests prevent regressions

---

## Quick Wins Order (Do These First!)

Pick these in this order, each can be done independently:

### Day 1: Documentation Foundation
1. **Create `.env.example`** (30 min)
2. **Create `CONTRIBUTING.md`** (2 hours)
3. **Add FastAPI Swagger** (15 min)

**Result:** Contributors know what to do, API is self-documenting

### Day 2: Development Experience
4. **Reorganize `requirements.txt`** (30 min)
5. **Add `.pre-commit-config.yaml`** (1 hour)

**Result:** Consistent code style, clear dependencies

### Days 3-4: Code Quality
6. **Extract sys.path logic** (1 day)
7. **Add critical type hints** (2 days)
8. **Create Pydantic models** (1 day)

**Result:** Fewer bugs, easier to maintain

### Ongoing: Stabilization
- Fix bugs as found
- Improve error handling
- Document discoveries

---

## What NOT to Do Yet

❌ **Don't write comprehensive tests**
- Will break constantly as API changes
- Effort wasted during active development

❌ **Don't restructure backend/models/ aggressively**
- Only make minor organizational changes
- Keep API stable for now

❌ **Don't add Docker yet**
- Wait until deployment needs are clear
- Dependencies might change

❌ **Don't refactor large functions**
- Leave `f1_data.py` as-is for now
- Focus on bugs, not architecture

❌ **Don't over-engineer configuration**
- Keep it simple until you know what varies
- `.env.example` is enough for now

---

## Success Metrics for Phase 1-2

By end of week 4, the app should be:

✅ **Usable**
- All session types work
- No crashes on normal use
- Clear error messages

✅ **Understandable**
- Contributors can get it running in 30 min
- Code is readable with type hints
- Architecture documented

✅ **Reliable**
- Known bugs documented
- Error handling improves
- WebSocket connections stable

✅ **Professional**
- Consistent code style
- Clear dependencies
- API self-documenting (Swagger)

---

## Then: Stabilization Checklist

Use this to track stability:

- [ ] **Can load any race/sprint/qualifying from any year**
- [ ] **Playback works smoothly (no jitter, seeking works)**
- [ ] **Leaderboard updates correctly (or known limitations documented)**
- [ ] **Telemetry panel shows accurate data**
- [ ] **No crashes on edge cases** (early/late sessions, retirements, etc.)
- [ ] **WebSocket doesn't drop under load**
- [ ] **Can run without Docker or special setup** (`node dev.js` just works)
- [ ] **Error messages help debug problems**
- [ ] **Performance is acceptable** (< 5 min first load)
- [ ] **UI is responsive** (no freezing during playback)

Once all checked: **Ready for Phase 4 (Testing)**

---

## When to Move to Phase 3 (Production)

Start thinking about Docker/production when:

- [ ] App is stable enough for daily use
- [ ] Main features complete
- [ ] API is unlikely to change drastically
- [ ] Deploy somewhere (Heroku, VPS, etc.)

This might be weeks, might be months. Don't rush it.

---

## Questions for You

1. **Phase 1 priority:** Which is most important?
   - Documentation (help contributors)
   - Code quality (easier to work with)
   - Bug fixes (more reliable)
   - All three in parallel

2. **Stabilization focus:** What areas need work?
   - Telemetry accuracy (leaderboard, positions)
   - UI/UX (playback controls, responsiveness)
   - WebSocket reliability (connection stability)
   - Performance (load time, playback smoothness)

3. **Known bugs:** What's the top priority to fix?
   - Leaderboard inaccuracy?
   - Something else?

4. **Timeline:** How long to stabilize?
   - 1 month
   - 2-3 months
   - Ongoing while building features

---

## Summary

**Old Plan:** Test-driven, structured, waterfall
**New Plan:** Stability-driven, pragmatic, iterative

Focus on:
1. ✅ Quick wins (documentation, code style)
2. ✅ Bug fixes (reliability)
3. ✅ Feature completion (feature-complete)
4. ✅ Stabilization (zero crashes, predictable behavior)
5. ⏸️ **Then** add comprehensive tests

This keeps velocity high while the app is evolving, and avoids throwing away test code when APIs change.
