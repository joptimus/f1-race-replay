# Post-Refactoring Verification Checklist

Complete this checklist to verify everything is working correctly after the refactoring.

## File Structure Verification

- [ ] `legacy/` folder is deleted
- [ ] `resources/` folder is deleted
- [ ] `docs/archive/` contains old phase reports
- [ ] Root directory has only 7 files (less than before)
- [ ] `scripts/install.sh` exists and is executable
- [ ] `scripts/install.bat` exists
- [ ] `scripts/dev.js` exists and has new functions

## Dependencies Verification

- [ ] `requirements.txt` contains only: fastf1, pandas, numpy
- [ ] No `arcade`, `pyglet`, or `customtkinter` in requirements.txt
- [ ] Backend has its own `requirements.txt` with: fastapi, uvicorn, etc.
- [ ] Frontend `package.json` is clean and minimal

## Installation Script Testing

### On macOS/Linux:

```bash
# Test the install script
bash scripts/install.sh
```

Verify:
- [ ] Python 3.8+ check passes
- [ ] Node.js 16+ check passes
- [ ] npm check passes
- [ ] Virtual environment created at `backend/venv/`
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed (npm packages)
- [ ] Script completes with success message

### On Windows:

```bash
# Test the install script
scripts\install.bat
```

Verify:
- [ ] Python 3.8+ check passes
- [ ] Node.js 16+ check passes
- [ ] npm check passes
- [ ] Virtual environment created at `backend\venv\`
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Script completes with success message

## Development Server Testing

```bash
npm start
```

Verify:
- [ ] Caches are cleared (see "[CACHE]" messages)
- [ ] Ports are freed (see "[PORTS]" messages)
- [ ] Backend starts (see "[BACKEND]" message, port 8000)
- [ ] Frontend starts (see "[FRONTEND]" message, port 5173)
- [ ] Browser opens to http://localhost:5173
- [ ] Backend API responds at http://localhost:8000/api/health
- [ ] WebSocket connection works (check browser console)
- [ ] Leaderboard loads data
- [ ] 3D track visualization renders

## Verify Equivalent Commands

```bash
# Test both commands are equivalent
npm start
# Should be identical to:
npm run dev
```

Verify:
- [ ] Both commands produce same output
- [ ] Both start both services
- [ ] Both open browser
- [ ] Both clear caches first

## Documentation Verification

- [ ] `README.md` has new installation instructions
- [ ] `README.md` explains what `npm start` does
- [ ] `README.md` no longer references legacy app
- [ ] `CLAUDE.md` is still complete and accurate
- [ ] `docs/REFACTORING-SUMMARY.md` exists and is readable
- [ ] `docs/DIRECTORY-STRUCTURE.md` exists and is readable
- [ ] Old phase reports are in `docs/archive/`
- [ ] No broken links in documentation

## Git Status

```bash
git status
```

Verify:
- [ ] All changes are staged or intentionally untracked
- [ ] No unexpected files remain
- [ ] Deleted files show as deletions
- [ ] New files show as additions
- [ ] Modified files show as modifications

## Clean Cache Test

```bash
npm start
```

Verify:
- [ ] Cache directories (`data/`, `.fastf1-cache/`) are cleared
- [ ] App works correctly with fresh cache
- [ ] No stale data appears
- [ ] First run computes new telemetry (takes time for large sessions)

## Port Cleanup Test

1. Start the app: `npm start`
2. Don't close it
3. In another terminal, try to start again: `npm start`

Verify:
- [ ] First instance continues running
- [ ] Second instance detects ports are in use
- [ ] Error message is clear
- [ ] No unexpected behavior

## Cross-Platform Testing (if applicable)

**macOS:**
- [ ] Install script works
- [ ] npm start works
- [ ] Browser opens automatically
- [ ] Cache clearing works

**Windows:**
- [ ] Install script (.bat) works
- [ ] npm start works
- [ ] Browser opens automatically
- [ ] Cache clearing works

**Linux:**
- [ ] Install script works
- [ ] npm start works
- [ ] Browser opens or provides correct URL
- [ ] Cache clearing works

## Package Size Verification

```bash
du -sh backend frontend shared
```

Expected results:
- [ ] Frontend: ~355MB (mostly node_modules)
- [ ] Backend: ~80KB (small, only Python files)
- [ ] Shared: ~84KB (shared utilities)

Project footprint should be significantly smaller than before.

## Quick Onboarding Test

Simulate a new collaborator experience:

1. [ ] New person clones the repo
2. [ ] They run the install script for their OS
3. [ ] They run `npm start`
4. [ ] App opens and works without issues
5. [ ] No confusing error messages
6. [ ] README is clear and accurate

## Cleanup Confirmation

- [ ] No `PHASE_7_*.md` files in root
- [ ] No `VALIDATION_REPORT.md` in root
- [ ] No `PROJECT_STRUCTURE.md` in root
- [ ] No `cleanup.ps1` in root
- [ ] No `legacy/` folder
- [ ] No `resources/` folder
- [ ] No `scripts/start.js`
- [ ] No `scripts/kill_all.bat`

## Documentation Completeness

- [ ] README.md covers installation and running
- [ ] CLAUDE.md covers architecture and development
- [ ] docs/REFACTORING-SUMMARY.md explains all changes
- [ ] docs/DIRECTORY-STRUCTURE.md explains file organization
- [ ] All old documentation archived properly
- [ ] Links between docs are correct

## Final Checklist

- [ ] All tests above passed
- [ ] No unexpected errors or warnings
- [ ] Project is cleaner and more maintainable
- [ ] New collaborators can get started in <5 minutes
- [ ] Development workflow is faster (automatic cache/port cleanup)
- [ ] Ready for production or next development phase

## Sign-Off

**Checked by:** ___________________  
**Date:** ___________________  
**Status:** ☐ PASSED  ☐ NEEDS WORK

### Notes:

```
[Space for notes or issues found]
```

---

If any checks failed, refer to:
- `docs/REFACTORING-SUMMARY.md` for detailed changes
- `docs/DIRECTORY-STRUCTURE.md` for file organization
- `README.md` for quick start instructions
- `CLAUDE.md` for architecture details
