# Script Module Ownership

This document maps what `Script.js` owns, what has been copied into `WritingScript.jsx`, and what remains only in `Script.js`.

---

## Script.js — File Path

`src/components/modules/Script/Script.js`

Mounted via `ScriptBreakdown` wrapper → `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx` → passes all props directly to `LegacyScriptModule` (Script.js).

---

## Script.js — Production-Facing Responsibilities

These are purely production concerns. They live in Script.js and must NOT be replicated in WritingScript.

### Scene Management
- Owns `editingScenes` local state (write buffer for production edits)
- Edit Mode (`isEditMode`) — exclusive to production; locks scenes for editing
- Save Mode — calls `saveScenesDatabase(updatedScenes)` then `setScenes(updatedScenes)` on commit
- Scene number change (`onSceneNumberChange`) — rewrites production scene order and saves to DB
- Scene delete — removes from `editingScenes`, syncs to `scenes`, saves to DB
- Scene reorder — calls `syncStripboardScenesToDatabase`, `setStripboardScenes`, `setScenes`, `saveScenesDatabase`
- Scene insert (Add Scene button) — creates `createBlankScene`, writes to DB
- FDX import — parses FDX, creates production scenes, saves to DB, syncs stripboard
- Scene revision tracking — `committedRounds`, `pendingRecord`, `showRevisionModal`, `viewingRevision`

### Script Tagging
- Right-click word tagging via `tagWord(word, category)` → creates tagged item in Supabase
- Removing tags via `untagWordInstance(key, si, bi, wi)`
- Tagged item display and highlighting in the screenplay viewer
- `showTagDropdown`, `setShowTagDropdown` — tag category selector

### Stripboard Integration
- After scene save/reorder/delete, calls `setStripboardScenes(...)` and `syncStripboardScenesToDatabase(...)`
- New scenes from double-enter or Add Scene are synced to stripboard

### Character Integration
- Character autocomplete in screenplay blocks uses `characters` prop
- New characters discovered in Character blocks can be synced via `syncCharactersToDatabase`

### Moodboard Images
- Receives `moodboardImages` prop for mood overlay (sourced from App.js `scriptMoodImages`)

---

## Script.js — Writing-Mode Responsibilities Still Present

Script.js has a dual-mode: Production Edit Mode (isEditMode) and "Writing Mode" (which is NOT the same as the Writing workflow — it's the screenplay-editing mode within the Script Breakdown module).

**Confusingly, `isWritingMode` in Script.js refers to a MODE within the Script Breakdown module, not the Writing workflow tab.**

### Writing Draft (in Script.js — partially duplicated in WritingScript.jsx)
- `writingDraftNodes` — same data shape, same localStorage key (`scriptWritingDraft:${projectId}`)
- `handleWritingDraftNodesChange` — debounced save to localStorage
- `handleStartNewScript` — creates initial scene (in Script.js this ALSO called `setScenes` and `saveScenesDatabase` to sync writing result to production)
- `handleWritingSceneListReorder` — reorders nodes in draft
- `handleTimelineSceneMove` — moves scene in timeline

### Beats (in Script.js — duplicated in WritingScript.jsx)
- `beats` state — outline/beat items
- `normalizeOutlineItems`, `parseBeatSheetText` — same helpers
- `BeatsList` component — same component
- Beats persistence: `scriptBeats:${projectId}` (same key as WritingScript)
- Beat handlers: `handleConvertBeatToScene` — **this calls production callbacks** (`setScenes`, `saveScenesDatabase`)

### Writing Timeline (in Script.js — duplicated in WritingScript.jsx)
- `showWritingTimeline`, `showBeatsTrack` — visibility state
- `ENABLE_WRITING_TIMELINE` constant
- Timeline positions: `scriptTimelinePositions:${projectId}` — a writing-mode-specific key that WritingScript.jsx does NOT save (this is only in Script.js's writing mode)

### Writing Settings (in Script.js — duplicated in WritingScript.jsx)
- `targetPageCount`, `showTargetPageDialog`
- `showMoodOverlay`, `moodOverlaySettings`
- `activeSidePanelTab`, `collapsedActIds`
- Settings modal

---

## Script.js — Database Writes

All database writes from Script.js are production-facing:

| Operation | DB Function |
|---|---|
| Scene save (edit mode commit) | `saveScenesDatabase(updatedScenes)` |
| Scene reorder | `saveScenesDatabase(updatedScenes)` + `syncStripboardScenesToDatabase(...)` |
| Scene delete | `saveScenesDatabase(updatedScenes)` |
| Scene insert | `saveScenesDatabase(updatedScenes)` |
| FDX import | `saveScenesDatabase(updatedScenes)` |
| Beat-to-scene conversion | `saveScenesDatabase(updatedScenes)` |
| Scene count change (writing mode) | `saveScenesDatabase(normalized)` (via useEffect on `editingScenes.length`) |

---

## Script.js — localStorage Writes

| Key Pattern | What | When Written |
|---|---|---|
| `scriptWritingDraft:${projectId}` | Writing draft nodes (JSON) | After node change, debounced; on handleStartNewScript |
| `scriptBeats:${projectId}` | Beats array (JSON) | When `beats` state changes |
| `scriptTimelineVisible:${mode}:${projectId}` | Timeline visibility boolean | When `showWritingTimeline` changes (mode = `"writing"` or `"script"`) |
| `scriptTargetPageCount:${projectId}` | Target page count integer | When `targetPageCount` changes |
| `scriptMoodOverlayEnabled:${projectId}` | Mood overlay boolean | When `showMoodOverlay` changes |
| `scriptMoodOverlaySettings:${projectId}` | Mood overlay settings object | When `moodOverlaySettings` changes |
| `scriptSidePanelTab:${projectId}` | `"scenes"` or `"beats"` | When `activeSidePanelTab` changes |
| `scriptCollapsedActs:${projectId}` | Collapsed act IDs object | When `collapsedActIds` changes |
| `scriptTimelinePositions:${projectId}` | Timeline scene positions (JSON) | When writing timeline scenes are moved |

**Note:** Script.js initial state for `showWritingTimeline` reads from the UNSCOPED key `"scriptTimelineVisible:writing"` (no project ID), but then saves to the scoped key. This is a bug: initial state may not match if you have multiple projects.

---

## WritingScript.jsx — What Was Copied from Script.js

Phase 4Z copied the following from Script.js writing mode:

| Item | Source Lines (approx) | Status |
|---|---|---|
| `BEAT_MENU_COLORS` constant | Script.js ~63 | Copied exactly |
| Beat text helpers (createBeatId, normalizeBeatText, etc.) | Script.js ~360–575 | Copied exactly |
| `normalizeOutlineItems`, `parseBeatSheetText` | Script.js ~576–600 | Copied exactly |
| `BeatsList` component | Script.js ~577–736 | Copied — Convert to Scene disabled |
| `SceneList` component | Script.js ~95–290 | Copied — production callbacks nulled |
| All writing state (draft, beats, settings) | Script.js ~2948–3016 | Copied |
| `writingDraftScenes` useMemo | Script.js ~3033–3082 | Copied + enhanced with multi-key stats lookup |
| Storage effects and keys | Script.js ~3098–3460 | Copied — `getTimelinePositionsStorageKey` removed |
| Beat handlers | Script.js ~4031–4348 | Copied — `handleConvertBeatToScene` removed |
| `handleTimelineSceneMove` | Script.js ~4350–4462 | Copied |
| `handleStartNewScript` | Script.js ~4496–4545 | Copied — DB calls removed |
| Progress calculations | Script.js ~4886–4899 | Copied |
| `handleWritingDraftNodesChange` | Script.js ~4903–4935 | Copied |
| `handleWritingSceneListReorder` | Script.js ~4937–5013 | Copied |
| Full JSX/render | Script.js ~5015–5963 | Copied — production toolbar items removed |

---

## What Remains ONLY in Script.js (Not in WritingScript)

- All production Edit Mode logic (`isEditMode`, `editingScenes`, `handleSave`, revision tracking)
- `handleFileUpload`, `handleSingleSceneUpload` (FDX import)
- `tagWord`, `untagWordInstance` integration
- `handleConvertBeatToScene` — calls `setScenes`, `saveScenesDatabase`
- `handleSceneDelete`, `handleInsertScene` (production scene management)
- `handleSceneReorder` production path (with stripboard sync)
- Scene tagging highlight display
- Character autocomplete (from `characters` prop)
- `moodboardImages` rendering
- Revision viewer
- `scriptTimelinePositions:${projectId}` storage (writing timeline scene positions)
- `ContinuousScript` sub-component (production screenplay viewer/editor)
- Scene Detail modal (double-click scene)
- `onSceneNumberChange` production path
