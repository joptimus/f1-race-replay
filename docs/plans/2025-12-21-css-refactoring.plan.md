# CSS Refactoring: Tailwind Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor F1 Race Replay frontend to use Tailwind utilities effectively while eliminating duplicate CSS and inline styles from major layout components.

**Architecture:** Phase 1 focuses on establishing proper Tailwind setup (config + directives) and refactoring layout components (App.tsx, Leaderboard, PlaybackControls). Complex styling (F1 driver card, animations, masks) remains in CSS. This approach eliminates CSS duplication and reduces bundle size while preserving existing design and visual behavior.

**Tech Stack:** Tailwind CSS 3.x, React/TypeScript, Framer Motion (for animations)

---

## Task 1: Extend Tailwind Configuration with F1 Colors

**Files:**
- Modify: `frontend/tailwind.config.js`

**Step 1: Read the current config to understand structure**

Run: `cat frontend/tailwind.config.js`

Expected: Current config with minimal color extensions

**Step 2: Add F1 color palette to tailwind.config.js**

Replace the entire file with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'f1-red': '#e10600',
        'f1-black': '#15151e',
        'f1-dark-gray': '#1f1f27',
        'f1-carbon': '#0f0f12',
        'f1-white': '#ffffff',
        'f1-silver': '#9ca3af',
        'f1-border': 'rgba(255, 255, 255, 0.1)',
      },
      fontFamily: {
        'f1-mono': "'JetBrains Mono', monospace",
      },
      fontSize: {
        'f1-xs': '0.65rem',
        'f1-sm': '0.75rem',
        'f1-base': '0.85rem',
      },
    }
  },
  plugins: [],
}
```

**Step 3: Verify config syntax is valid**

Run: `cd frontend && npm run build 2>&1 | head -20`

Expected: No errors about tailwind config, build should proceed

**Step 4: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat: add F1 color palette and typography to Tailwind config"
```

---

## Task 2: Add Tailwind Directives and Remove Duplicate Utilities from index.css

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Read the current index.css to understand what to keep/remove**

Run: `wc -l frontend/src/index.css`

Expected: ~694 lines

**Step 2: Update index.css with @tailwind directives and remove duplicate utilities**

Replace the first 40 lines of `frontend/src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;700;900&family=JetBrains+Mono:wght@700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* --- GLOBAL RESET --- */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --f1-red: #e10600;
  --f1-black: #15151e;
  --f1-dark-gray: #1f1f27;
  --f1-carbon: #0f0f12;
  --f1-white: #ffffff;
  --f1-silver: #9ca3af;
  --f1-border: rgba(255, 255, 255, 0.1);
  --font-main: 'Titillium Web', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* These variables must be provided via inline styles in DriverHero */
  --f1-team-colour: #F47600;
  --f1-accessible-colour: #863400;
}

html, body, #root {
  height: 100%;
  width: 100%;
  background-color: var(--f1-carbon);
  color: var(--f1-white);
  font-family: var(--font-main);
}
```

**Step 3: Remove duplicate utility classes from the file**

Remove these lines (237-257 in original):
```css
/* UTILITY CLASSES */
.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.h-full {
  height: 100%;
}
```

**Step 4: Verify the file looks correct**

Run: `grep -c "^@tailwind" frontend/src/index.css && grep -c "^/\* UTILITY CLASSES" frontend/src/index.css`

Expected: Output should be "3" and "0" (3 @tailwind directives, 0 old utility class sections)

**Step 5: Build to check for Tailwind warnings**

Run: `cd frontend && npm run build 2>&1 | grep -i "tailwind\|warning" || echo "No Tailwind warnings"`

Expected: No warnings about missing Tailwind directives or configuration

**Step 6: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add @tailwind directives and remove duplicate utility classes"
```

---

## Task 3: Refactor App.tsx Layout Grid with Tailwind Utilities

**Files:**
- Modify: `frontend/src/App.tsx:34-150` (approx - find app-container and header rendering)

**Step 1: Read App.tsx to find the layout section**

Run: `grep -n "app-container\|className=\|style={{" frontend/src/App.tsx | head -30`

Expected: Find JSX sections with className or style attributes for layout

**Step 2: Read the ReplayPage component that uses the layout**

Run: `grep -n "ReplayPage\|app-container" frontend/src/App.tsx`

Look for the main layout structure. Identify where `.app-container` is used.

**Step 3: Update App.tsx to replace inline layout styles with Tailwind classes**

Find the div with `className="app-container"` and verify it doesn't have inline styles. If inline styles exist on layout elements, convert them to Tailwind utilities.

Key refactorings:
- Grid layout: Keep `.app-container` class in CSS (it has complex grid-template-columns), but ensure no duplicate inline styles
- Header: If header has inline `style={{ display: 'flex', ... }}`, replace with `className="flex items-center justify-between"`
- Status text: If `style={{ fontSize: '0.8rem' }}`, use `className="text-f1-sm"`
- Menu button: If `style={{ background: '#e10600' }}`, use `className="bg-f1-red"`

Run: `sed -n '34,150p' frontend/src/App.tsx | grep -c "style={{" || echo "0 inline styles found"`

**Step 4: Verify no build errors after changes**

Run: `cd frontend && npm run build 2>&1 | grep -i "error" || echo "Build successful"`

Expected: No build errors

**Step 5: Check visual result by running dev server**

Run: `cd frontend && timeout 10 npm run dev 2>&1 | grep "Local:" || echo "Dev server started"`

Expected: Dev server starts on http://localhost:5173

**Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: use Tailwind utilities for App.tsx layout instead of inline styles"
```

---

## Task 4: Refactor Leaderboard Component to Use Tailwind Flexbox and Spacing

**Files:**
- Modify: `frontend/src/components/Leaderboard.tsx:67-200` (main container and header rows)

**Step 1: Read Leaderboard.tsx to understand current structure**

Run: `grep -n "style={{" frontend/src/components/Leaderboard.tsx | head -20`

Expected: Multiple inline style objects for layout

**Step 2: Read the specific sections with heavy inline styles**

Run: `sed -n '67,150p' frontend/src/components/Leaderboard.tsx`

Identify patterns like:
- `display: 'flex', flexDirection: 'column'` → replace with `className="flex flex-col"`
- `gap: '12px'` → replace with `className="gap-3"`
- `marginBottom: '8px'` → replace with `className="mb-2"`
- `paddingBottom: '8px'` → replace with `className="pb-2"`

**Step 3: Refactor the main container div (line ~87)**

Current:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
```

Replace with:
```tsx
<div className="flex flex-col h-full min-h-0 w-full">
```

**Step 4: Refactor header row styling**

Find lines with header flexbox (around line 95-110):

Current pattern:
```tsx
style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
  paddingBottom: '8px',
  borderBottom: '1px solid var(--f1-border)',
  flexShrink: 0
}}
```

Replace with:
```tsx
className="flex justify-between items-center mb-2 pb-2 border-b border-f1-border flex-shrink-0"
```

**Step 5: Refactor gap attributes on containers**

Replace inline `style={{ gap: '12px' }}` with `className="gap-3"` (3 = 12px in Tailwind)

**Step 6: Verify component still renders**

Run: `cd frontend && npm run build 2>&1 | grep -i "leaderboard.*error" || echo "No Leaderboard errors"`

Expected: No build errors

**Step 7: Commit**

```bash
git add frontend/src/components/Leaderboard.tsx
git commit -m "refactor: replace inline styles with Tailwind utilities in Leaderboard"
```

---

## Task 5: Refactor PlaybackControls Component (if needed)

**Files:**
- Check: `frontend/src/components/PlaybackControls.tsx`

**Step 1: Check if PlaybackControls uses inline styles**

Run: `grep -n "style={{" frontend/src/components/PlaybackControls.tsx | wc -l`

If output is `0`, skip to Step 5 (no changes needed).

If output > 0, continue to Step 2.

**Step 2: Read the file to identify inline styles**

Run: `grep -B2 "style={{" frontend/src/components/PlaybackControls.tsx | head -20`

Expected: List of inline style patterns

**Step 3: Refactor layout styles**

For each `style={{` pattern found, replace with appropriate Tailwind classes:
- `display: 'flex'` → `className="flex"`
- `gap: '12px'` → `className="gap-3"`
- `padding: '16px'` → `className="p-4"`
- `flexDirection: 'column'` → `className="flex-col"`

Keep CSS classes like `.playback-btn`, `.playback-slider` (they have pseudo-selectors and states in CSS)

**Step 4: Verify build**

Run: `cd frontend && npm run build 2>&1 | grep -i "error" || echo "Build successful"`

Expected: No build errors

**Step 5: Commit (if changes were made)**

```bash
git add frontend/src/components/PlaybackControls.tsx
git commit -m "refactor: replace inline styles with Tailwind utilities in PlaybackControls"
```

Or if no changes needed:

```bash
echo "PlaybackControls already minimal - no changes needed"
```

---

## Task 6: Visual Validation and Testing

**Files:**
- Test: All components (no file modifications)

**Step 1: Start dev server and visually inspect layout**

Run: `cd frontend && npm run dev > /tmp/dev-server.log 2>&1 &`

Wait 5 seconds for server startup.

**Step 2: Check that server started successfully**

Run: `grep "Local:" /tmp/dev-server.log || echo "Checking server..."`

Expected: Shows URL like `Local: http://localhost:5173`

**Step 3: Validate color consistency**

Open browser to `http://localhost:5173` and visually check:
- [ ] Header has red bottom border (F1 red #e10600)
- [ ] Background is dark carbon color #0f0f12
- [ ] Text is white/silver color
- [ ] Buttons and active states use correct F1 red
- [ ] Leaderboard rows have proper spacing and alignment
- [ ] Playback controls are properly styled

**Step 4: Check for any layout shifts or misalignment**

Navigate to a replay session (if data available) and check:
- [ ] 3-column grid layout intact
- [ ] Sidebar, center view, and controls properly positioned
- [ ] No overlapping or shifted elements
- [ ] Responsive behavior on smaller screens

**Step 5: Verify no CSS warnings in build**

Run: `cd frontend && npm run build 2>&1 | tee /tmp/build.log | grep -i "warning\|error" || echo "No warnings or errors"`

Expected: Clean build with no CSS warnings

**Step 6: Stop dev server**

Run: `pkill -f "npm run dev"`

**Step 7: Run full build**

Run: `cd frontend && npm run build`

Expected: Build completes successfully

**Step 8: Check bundle size reduction (optional)**

Run: `ls -lh frontend/dist/assets/index*.css frontend/dist/assets/index*.js 2>/dev/null | awk '{print $5, $9}'`

Expected: CSS bundle should be same or smaller due to duplicate removal

**Step 9: Commit validation completion**

```bash
git add -A
git commit -m "test: validate CSS refactoring - all components styled correctly"
```

---

## Success Criteria

✅ **Configuration:**
- [ ] Tailwind config extends with F1 colors (red, black, dark-gray, carbon, silver, border)
- [ ] No build warnings about Tailwind configuration
- [ ] index.css includes all 3 @tailwind directives

✅ **Code Quality:**
- [ ] Removed all duplicate utility classes from index.css (.flex, .flex-col, .items-center, .justify-between, .h-full)
- [ ] Reduced inline style attributes in App.tsx, Leaderboard, PlaybackControls
- [ ] Maintained all CSS classes for complex styling (.f1-driver-card, .f1-card-pattern, .playback-* classes)

✅ **Visual:**
- [ ] All colors match original design (validated in browser)
- [ ] Layout spacing consistent with existing design
- [ ] No visual shifts or layout breaks
- [ ] Hover states and active states work correctly
- [ ] Responsive design preserved

✅ **Build:**
- [ ] Clean build with no errors
- [ ] No CSS warnings
- [ ] Dev server starts without issues

---

## Notes

- **Complex CSS preserved:** F1 driver card, card patterns, animations, and playback slider styling remain in `index.css` because they use CSS masks, pseudo-elements (`::-webkit-slider-thumb`), and keyframes that Tailwind doesn't handle
- **Dynamic colors:** Team colors (`--f1-team-colour`, `--f1-accessible-colour`) remain as CSS variables set via inline styles on DriverHero component - this is acceptable for dynamic values
- **Backward compatible:** Old CSS classes remain until components are refactored, allows incremental deployment
- **Tailwind utilities:** Use Tailwind's spacing scale (p-1 to p-4 for padding, gap-3 for 12px, etc.) consistently
- **Verification:** After each task, verify build succeeds and no visual regressions

---

## Rollback Plan

If issues occur during refactoring:

1. **Revert recent commits:**
   ```bash
   git log --oneline | head -5  # See recent commits
   git reset --hard HEAD~N      # Go back N commits
   ```

2. **Check git diff before each commit** to ensure only expected changes

3. **Dev server should always be runnable** - if not, revert last component changes

---

## Related Documentation

- Design document: `docs/plans/2025-12-21-css-refactoring-design.md`
- Tailwind docs: https://tailwindcss.com
- Index.css structure: Complex styling kept in CSS, layout utilities moved to Tailwind
