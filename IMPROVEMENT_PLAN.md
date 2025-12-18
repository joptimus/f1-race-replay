# F1 Race Replay - Open Source Improvement Plan

## Executive Summary

The F1 Race Replay project has a solid foundation with good architecture and developer experience, but lacks testing coverage, comprehensive documentation, and production-ready deployment setup. This plan prioritizes improvements to make the project more welcoming for open source contributors and production-ready.

---

## Priority Levels

- **CRITICAL** - Blocks collaboration/deployment
- **HIGH** - Significantly improves contributor experience
- **MEDIUM** - Improves code quality
- **LOW** - Nice to have

---

## Improvement Areas

### 1. TESTING INFRASTRUCTURE (CRITICAL)
**Current State:** Minimal golden file tests, no unit/integration/E2E tests
**Impact:** Low confidence in PRs, hard to catch regressions

#### 1.1 Backend Unit Tests
- **What:** Create pytest test suite for backend services
- **Files:**
  - `backend/tests/conftest.py` - pytest fixtures (mock sessions, frames)
  - `backend/tests/test_api/test_rounds.py` - test GET /api/rounds, /api/sprints
  - `backend/tests/test_services/test_replay_service.py` - test F1ReplaySession class
  - `backend/tests/test_models.py` - test Pydantic model validation
- **Effort:** HIGH (3-4 days)
- **Owner:** New contributor
- **Checklist:**
  - [ ] Add pytest, pytest-asyncio, pytest-cov to dev dependencies
  - [ ] Create fixtures for mock F1 session data
  - [ ] Test all API endpoints with valid/invalid inputs
  - [ ] Test WebSocket frame streaming
  - [ ] Target 70%+ coverage

#### 1.2 Frontend Unit Tests
- **What:** Jest tests for React components and hooks
- **Files:**
  - `frontend/src/__tests__/components/` - component tests
  - `frontend/src/__tests__/hooks/` - useReplayWebSocket tests
  - `frontend/src/__tests__/store/` - store logic tests
- **Effort:** MEDIUM (2-3 days)
- **Checklist:**
  - [ ] Add jest, @testing-library/react to package.json
  - [ ] Test Leaderboard, TelemetryChart, PlaybackControls
  - [ ] Mock WebSocket connection
  - [ ] Test 60%+ coverage

#### 1.3 Integration Tests
- **What:** Test backend/frontend communication end-to-end
- **Files:**
  - `backend/tests/test_integration/test_websocket_flow.py` - frame streaming
- **Effort:** MEDIUM (1-2 days)
- **Checklist:**
  - [ ] Test full session load → frame stream → UI update
  - [ ] Test seeking/pausing during playback

#### 1.4 CI/CD Pipeline
- **What:** GitHub Actions for automated testing
- **Files:**
  - `.github/workflows/test.yml` - run tests on PR
  - `.github/workflows/lint.yml` - code quality checks
- **Effort:** MEDIUM (1 day)
- **Checklist:**
  - [ ] Run backend pytest on every PR
  - [ ] Run frontend jest on every PR
  - [ ] Run type checking (mypy, tsc)
  - [ ] Generate coverage reports
  - [ ] Block merge if tests fail

---

### 2. DOCUMENTATION & CONTRIBUTING (HIGH)
**Current State:** Good README but missing contributor guidelines
**Impact:** New contributors don't know how to get started or contribute

#### 2.1 CONTRIBUTING.md
- **What:** Clear guidelines for contributors
- **Content:**
  - How to set up dev environment
  - How to run tests
  - Code style guide (Python: black, TypeScript: prettier)
  - Commit message format
  - PR process (fork, branch, test, PR)
  - Issues/features discussion process
- **Effort:** LOW (1 day)
- **File:** `CONTRIBUTING.md`
- **Checklist:**
  - [ ] Development setup steps
  - [ ] Testing requirements
  - [ ] Code review expectations
  - [ ] Link to project conventions in CLAUDE.md

#### 2.2 API Documentation
- **What:** Swagger/OpenAPI docs for REST and WebSocket
- **Changes:**
  - Enable FastAPI docs: `docs_url="/api/docs"`
  - Document WebSocket message schema
  - Add examples to endpoints
- **Effort:** LOW (1 day)
- **Files:**
  - `backend/app/main.py` - enable Swagger
  - `backend/app/api/` - add docstrings to endpoints
- **Checklist:**
  - [ ] `/api/docs` works
  - [ ] All endpoints have descriptions
  - [ ] WebSocket format documented
  - [ ] Example requests/responses shown

#### 2.3 Architecture Decision Records (ADRs)
- **What:** Document why certain technologies were chosen
- **Files:**
  - `docs/adr/001-why-three-js.md` - 3D visualization
  - `docs/adr/002-why-websocket.md` - real-time streaming
  - `docs/adr/003-why-zustand.md` - state management
- **Effort:** MEDIUM (2 days)
- **Checklist:**
  - [ ] Document 3-5 major decisions
  - [ ] Include trade-offs and alternatives

#### 2.4 Troubleshooting Guide
- **What:** Common issues and solutions
- **File:** `docs/TROUBLESHOOTING.md`
- **Content:**
  - Port conflicts
  - Python version issues
  - Cache clearing
  - WebSocket connection failures
  - Windows vs Mac/Linux paths
- **Effort:** LOW (1 day)
- **Checklist:**
  - [ ] FAQ section
  - [ ] Debug mode setup
  - [ ] Common error messages explained

---

### 3. DEPENDENCIES & CONFIGURATION (HIGH)
**Current State:** Mixed requirements.txt, missing .env template, no version pinning
**Impact:** Hard to reproduce environments, version conflicts for contributors

#### 3.1 Fix Requirements Structure
- **What:** Separate backend, frontend, and legacy dependencies
- **Changes:**
  - Move root `requirements.txt` legacy deps to `legacy/requirements.txt`
  - Create `backend/requirements.txt` with backend-only deps + FastAPI/Uvicorn
  - Create `backend/requirements-dev.txt` for testing/linting tools
  - Pin versions with exact numbers or ranges
- **Effort:** LOW (1 day)
- **Files:**
  - `backend/requirements.txt` - new, backend-only
  - `backend/requirements-dev.txt` - new, testing tools
  - `legacy/requirements.txt` - new, legacy-only
  - `requirements.txt` - removed or keep for quick install
- **Checklist:**
  - [ ] Remove arcade, pyglet, customtkinter from root
  - [ ] Add pytest, black, mypy, pylint to dev deps
  - [ ] Add FastAPI/Uvicorn to backend deps
  - [ ] Create .python-version for Python 3.8+

#### 3.2 Environment Configuration
- **What:** Create .env template and load from environment
- **Files:**
  - `.env.example` - template with all variables
  - `backend/core/config.py` - load config from .env
- **Effort:** MEDIUM (1 day)
- **Content:**
  ```
  # API Server
  API_HOST=0.0.0.0
  API_PORT=8000
  API_WORKERS=4

  # CORS (comma-separated)
  CORS_ORIGINS=http://localhost:5173,http://localhost:3000

  # Data
  FASTF1_CACHE_DIR=.fastf1-cache
  DATA_CACHE_DIR=computed_data
  REFRESH_DATA=false

  # Logging
  LOG_LEVEL=INFO

  # Frontend
  VITE_API_URL=http://localhost:8000
  ```
- **Checklist:**
  - [ ] .env.example documented
  - [ ] backend/core/config.py created
  - [ ] CORS_ORIGINS from env
  - [ ] LOG_LEVEL configurable

#### 3.3 Pre-commit Hooks
- **What:** Automated checks before commit
- **Files:**
  - `.pre-commit-config.yaml` - defines hooks
- **Tools:**
  - black (Python formatting)
  - isort (Python import sorting)
  - eslint (TypeScript linting)
  - prettier (TypeScript formatting)
  - mypy (Python type checking)
  - trailing-whitespace, end-of-file-fixer
- **Effort:** MEDIUM (1 day)
- **Checklist:**
  - [ ] .pre-commit-config.yaml created
  - [ ] Setup instructions in CONTRIBUTING.md
  - [ ] Exclude files as needed (vendor, legacy)

---

### 4. CODE QUALITY & ORGANIZATION (MEDIUM)
**Current State:** Some type hints missing, repeated patterns, loose typing
**Impact:** Harder to refactor, bugs from type errors

#### 4.1 Add Type Hints
- **What:** Add Python type annotations to all functions
- **Priority Files:**
  - `shared/telemetry/f1_data.py` - 1056 lines, heavily used
  - `backend/app/services/replay_service.py`
  - All functions in `shared/lib/` and `shared/utils/`
- **Effort:** HIGH (3-4 days)
- **Checklist:**
  - [ ] Add type hints to all function signatures
  - [ ] Create type aliases for complex types
  - [ ] Run mypy with strict mode
  - [ ] Create `py.typed` marker file

#### 4.2 Create Backend Pydantic Models
- **What:** Define request/response models for all endpoints
- **Files:**
  - `backend/app/models/` (reorganize)
    - `session.py` - SessionRequest, SessionResponse
    - `frame.py` - FrameData, DriverData, WeatherData
    - `telemetry.py` - LapTelemetry, SectorTimes
    - `errors.py` - ErrorResponse, ValidationError
- **Effort:** MEDIUM (2 days)
- **Checklist:**
  - [ ] All endpoints have request/response models
  - [ ] Models in separate files
  - [ ] Docstrings with examples
  - [ ] Proper error models

#### 4.3 Reduce Code Duplication
- **What:** Extract repeated patterns into reusable utilities
- **Specific Issues:**
  1. **sys.path insertion** - Create `backend/core/imports.py` that handles it once
  2. **Router factory** - Create `backend/core/router_factory.py` for common setup
  3. **Type conversion** - Create dataclass for Frame structure in `shared/models/frame.py`
  4. **Error handling** - Create decorator `@handle_errors` for common try/catch patterns
- **Effort:** MEDIUM (2 days)
- **Files:**
  - `backend/core/imports.py` - handle sys.path
  - `backend/core/router_factory.py` - base router setup
  - `shared/models/frame.py` - Frame dataclass
  - `backend/core/decorators.py` - @handle_errors
- **Checklist:**
  - [ ] sys.path handled once in __init__.py or core
  - [ ] All routes use router factory
  - [ ] Type conversion uses shared model
  - [ ] Error handling uses decorator

#### 4.4 Improve Logging
- **What:** Replace print() statements with structured logging
- **Files:**
  - `backend/core/logging.py` - logging setup
  - All files with print() statements
- **Effort:** MEDIUM (2 days)
- **Checklist:**
  - [ ] Create logging module
  - [ ] Replace print() in core files
  - [ ] Log levels: DEBUG, INFO, WARNING, ERROR
  - [ ] Include request IDs for tracing

---

### 5. BUILD & DEPLOYMENT (HIGH)
**Current State:** No Docker, hardcoded config, no production setup
**Impact:** Can't deploy easily, hard to run same thing locally and production

#### 5.1 Docker Support
- **What:** Dockerfile and docker-compose for local dev and production
- **Files:**
  - `Dockerfile` - multi-stage backend build
  - `docker-compose.yml` - dev setup (backend + frontend)
  - `docker-compose.prod.yml` - production setup
  - `.dockerignore` - exclude unnecessary files
- **Effort:** MEDIUM (2 days)
- **Content:**
  - Backend: Python 3.11, FastAPI, Uvicorn
  - Frontend: Node.js, build, serve static
  - Volumes for dev hot-reload
- **Checklist:**
  - [ ] Docker builds successfully
  - [ ] docker-compose up works for dev
  - [ ] docker-compose -f docker-compose.prod.yml works
  - [ ] Health checks included

#### 5.2 Production Configuration
- **What:** WSGI server, reverse proxy, static file serving
- **Files:**
  - `gunicorn_config.py` - production WSGI config
  - `nginx.conf` - reverse proxy config (example)
  - `backend/app/main.py` - serve static files from frontend/dist
- **Effort:** MEDIUM (1-2 days)
- **Changes:**
  - Replace Uvicorn with Gunicorn in production
  - Configure static file serving
  - Set up CORS for production domains
- **Checklist:**
  - [ ] Gunicorn config created
  - [ ] Static files served from /dist
  - [ ] Health check endpoint tests dependencies

#### 5.3 Development Setup Documentation
- **What:** Clear instructions for running in different environments
- **Files:**
  - `docs/DEVELOPMENT.md` - local dev setup
  - `docs/DEPLOYMENT.md` - production deployment
  - `docs/DOCKER.md` - Docker setup
- **Effort:** LOW (1 day)
- **Checklist:**
  - [ ] Local dev: node dev.js vs Docker
  - [ ] Production: Docker vs systemd
  - [ ] Environment variables documented
  - [ ] Troubleshooting common deployment issues

---

### 6. DEVELOPER EXPERIENCE (MEDIUM)
**Current State:** Good but missing convenience features
**Impact:** Faster contributor onboarding

#### 6.1 VS Code Configuration
- **What:** Debugging, linting, formatting setup
- **Files:**
  - `.vscode/launch.json` - debug configurations
  - `.vscode/settings.json` - recommended extensions/settings
  - `.vscode/extensions.json` - recommended extensions
- **Effort:** LOW (1 day)
- **Content:**
  - Debug backend with breakpoints
  - Debug frontend with Chrome
  - Auto-format on save
  - Type checking on save
- **Checklist:**
  - [ ] Backend debugging works
  - [ ] Frontend debugging works
  - [ ] Recommended extensions listed

#### 6.2 Makefile for Common Tasks
- **What:** Simple shortcuts for common commands
- **File:** `Makefile` or `Taskfile.yml`
- **Commands:**
  ```
  make dev              # Start dev server
  make test             # Run all tests
  make test-backend     # Run backend tests
  make test-frontend    # Run frontend tests
  make lint             # Run linters
  make format           # Auto-format code
  make clean            # Clean build artifacts
  make docker-up        # Docker up
  make docker-down      # Docker down
  ```
- **Effort:** LOW (1 day)
- **Checklist:**
  - [ ] Makefile created with main tasks
  - [ ] Documented in CONTRIBUTING.md

---

## Implementation Roadmap

### Phase 1: Foundations (Week 1)
**Goal:** Make contributing easier and more confident

1. **Fix Dependencies** (1 day)
   - Reorganize requirements.txt files
   - Create .env.example

2. **Create CONTRIBUTING.md** (1 day)
   - Contributor guidelines
   - Setup instructions

3. **Add Basic CI/CD** (1 day)
   - GitHub Actions for pytest
   - GitHub Actions for TypeScript compilation

4. **Setup Code Quality** (1 day)
   - .pre-commit-config.yaml
   - black, prettier configs

### Phase 2: Testing (Week 2-3)
**Goal:** Catch regressions, enable confident refactoring

1. **Backend Unit Tests** (2-3 days)
   - API tests
   - Service tests
   - Model tests

2. **Frontend Unit Tests** (1-2 days)
   - Component tests
   - Hook tests

3. **Integration Tests** (1 day)
   - End-to-end flow tests

### Phase 3: Quality & Docs (Week 4)
**Goal:** Better code and clearer documentation

1. **Add Type Hints** (2-3 days)
   - Python type annotations
   - Create type aliases

2. **Create Backend Models** (1-2 days)
   - Pydantic request/response models
   - Organize models

3. **Code Deduplication** (1-2 days)
   - Extract router factory
   - Extract type conversions

4. **API Documentation** (1 day)
   - Enable Swagger/OpenAPI
   - Document WebSocket

### Phase 4: Deployment (Week 5)
**Goal:** Production-ready deployment

1. **Docker Support** (2 days)
   - Dockerfile, docker-compose

2. **Production Config** (1 day)
   - Environment-based config
   - Gunicorn setup

3. **Deployment Docs** (1 day)
   - Deployment guide
   - Troubleshooting

---

## Success Metrics

### Before (Current)
- ❌ No tests - can't verify changes work
- ❌ No contributor guide - unclear how to contribute
- ❌ No Docker - hard to reproduce issues
- ❌ Limited type safety - runtime errors possible
- ⚠️ Mixed config - environment not clear

### After (Goals)
- ✅ 70%+ test coverage - confident refactoring
- ✅ Clear CONTRIBUTING.md - easy onboarding
- ✅ Docker support - reproducible setup
- ✅ Full type hints - catch errors early
- ✅ .env-based config - environment explicit
- ✅ CI/CD pipeline - automated quality checks
- ✅ API docs - clear interface contract
- ✅ Production ready - deployable to cloud

---

## Quick Wins (Do First!)
These provide immediate value with minimal effort:

1. **Create .env.example** (30 min)
2. **Create CONTRIBUTING.md** (2 hours)
3. **Reorganize requirements.txt** (30 min)
4. **Enable FastAPI Swagger docs** (15 min)
5. **Add .pre-commit-config.yaml** (1 hour)
6. **Create GitHub Actions test workflow** (1 hour)

**Total Quick Wins: ~5-6 hours** → Massive improvement in contributor experience!

---

## Estimated Total Effort
- Phase 1: 5 days
- Phase 2: 5-7 days
- Phase 3: 6-8 days
- Phase 4: 4-5 days
- **Total: 20-25 days** of focused work

Could be done over 4-5 weeks with 1-2 people, or distributed across team.

---

## Questions for Prioritization
1. **Deployment priority?** Should we prioritize Docker/production setup?
2. **Testing scope?** 70% coverage, 50%, or higher?
3. **Type hints?** Full strict mode, or gradual adoption?
4. **Breaking changes?** OK to restructure backend/models if it helps?
5. **Timeline?** What's realistic for your team?
