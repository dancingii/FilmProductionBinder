# AI Task Log

Use this file to track work done by Claude, Codex, or any other coding agent.

## Active Task

### Agent

—

### Branch

main

### Task

—

### Files Allowed

—

### Status

—

---

## Completed Tasks

### Writing Public Share Watermark Branding

**Date:** 2026-05-25
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/PublicScriptShareViewer.jsx`

**Changes:**
- Extended per-link Share Script watermark settings with project-name fallback text, optional recipient name, and URL-based branding image controls.
- Organized the Watermark Settings popup into Text, Appearance, and Branding Image sections.
- Updated the public script viewer to merge older/null watermark settings safely, use project name as the default watermark text, append recipient name when enabled, and render a non-interactive subtle branding image overlay when configured.
- Kept storage in `script_share_links.watermark_settings`; no DB schema or RPC changes were made.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned; `git status --short build` showed no output.

### Writing Page Body Line Offset Calibration

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added `pageBodyLineOffset` to the temporary Writing layout tuning defaults with a default of `1`.
- Added a `Page body line offset` control to the LAYOUT TUNING panel with range `-3` to `3`, step `1`, unit `lines`.
- Updated `getEffectivePageBodyHeightLines()` to return the physical derived line count plus the offset.
- Kept visual top and bottom margins at `1in`.
- Kept the physical page geometry calculation as the base source of truth.
- Did not touch Scene Heading keep-together rules, block spacing values, parser/import logic, PDF import, `(CONT'D)` logic, Script.js, Script Breakdown, saved script content, contenteditable/caret internals, or unrelated modules.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Physical Page Margin Pagination

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Set Writing page bottom margin defaults to `1in` in both `PAGE_LAYOUT` and `DEFAULT_LAYOUT_TUNING`.
- Kept Writing page top margin defaults at `1in`.
- Replaced independent `pageBodyHeightLines` pagination reads with a physical page-body line calculation derived from page height, top margin, bottom margin, and line height.
- Removed the `pageBodyHeightLines` layout tuning control so it no longer conflicts with physical margins.
- Applied the derived page-body line count to pagination, scene stats, and dialogue overflow splitting.
- Did not touch parser/import logic, PDF import, `(CONT'D)` logic, Script.js, Script Breakdown, saved script content, contenteditable/caret internals, or unrelated modules.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Scene Heading Final Pagination Pass + Top Margin Default

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Changed `PAGE_LAYOUT.pageMarginTop` fallback from `0.75in` to `1in`.
- Confirmed `DEFAULT_LAYOUT_TUNING.pageMarginTopIn` remains `1` and `pageBodyHeightLines` remains `55`.
- Added a final `fixTrailingSceneHeadings()` pass after `paginateNodesForScreen()` so the page array used by rendering cannot end a non-final page with a meaningful Scene Heading.
- Added guarded finalized-page pagination diagnostics behind `window.__DEBUG_WRITING_PAGINATION`.
- Did not touch parser/import logic, `(CONT'D)` logic, Script.js, Script Breakdown, saved script content, contenteditable/caret internals, spacing values, or unrelated modules.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### PDF Action Page-Boundary Cleanup + Writing Scene Heading Guard

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/utils/screenplayImport.js`
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a conservative PDF page-artifact cleanup heuristic that preserves a blank paragraph boundary when removing a standalone page number/artifact between two action-looking lines and the previous line is sentence-complete.
- Kept wrapped action line grouping and mid-sentence action continuation behavior intact.
- Updated Writing page capacity defaults from 54/56 to `55` where the active tuning/default page-body line count is defined.
- Raised the Scene Heading hard keep-together guard from fewer than 4 remaining lines to fewer than 6 remaining lines.
- Kept the deterministic trailing Scene Heading post-pass in place.
- Did not touch `(CONT'D)` logic, Script.js, Script Breakdown, saved content, contenteditable/caret internals, or the layout tuning panel behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Trailing Scene Heading Pagination Post-Pass

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added page finalization logic inside `paginateNodesForScreen`.
- Before a page is pushed, it checks the last meaningful node.
- If that last meaningful node is a Scene Heading, the heading and trailing non-meaningful nodes are carried to the next page.
- Avoids pushing an empty page if the moved heading was the only page content.
- Kept existing keep-together estimates and hard remaining-lines guard.
- Did not change spacing values, tuning UI behavior, parser/import logic, `(CONT'D)` behavior, Script Breakdown, saved content, or contenteditable internals.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Scene Heading Hard Keep Guard

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a hard Scene Heading pagination guard inside `paginateNodesForScreen`.
- If fewer than 4 tuned page lines remain and the current page already has content, Scene Heading nodes now force a page break before placement.
- Kept the existing next-meaningful-node keep-together logic.
- Added `remainingLines` and `sceneHeadingHardBreak` fields to guarded pagination debug output.
- Did not change spacing values, tuning UI behavior, parser/import logic, `(CONT'D)` behavior, Script Breakdown, or contenteditable internals.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Keep-Together Pagination Refinement

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Updated temporary layout tuning defaults to the provided baseline values for current testing.
- Added meaningful-node lookup so keep-together estimates do not fail when empty/harmless nodes appear between structural elements.
- Scene Heading, Character, and Parenthetical keep-together checks now use the next meaningful required content/dialogue node.
- Added guarded debug logging behind `window.__DEBUG_WRITING_PAGINATION`.
- Did not touch parser/import logic, `(CONT'D)` import behavior, Script Breakdown, saved script content, or contenteditable internals.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Pagination Keep-Together Rules

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added `getNodeFirstLineEstimate()` and `getKeepTogetherLineEstimate()` for Writing pagination.
- Prevents Scene Heading, Character cue, and Parenthetical nodes from being stranded at page bottoms when their required following line does not fit.
- Character keep-together includes an optional following Parenthetical plus the first Dialogue line.
- Kept dialogue continuation visual/render-only behavior unchanged.
- Did not touch parser/import logic, `(CONT'D)` import behavior, Script Breakdown, spacing values, or tuning slider behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Layout Tuning Panel Portal

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Imported `createPortal` from `react-dom`.
- Rendered the existing temporary `LAYOUT TUNING` panel through `document.body` so it is no longer trapped by the editor/sidebar stacking context.
- Kept the same fixed top/right position, z-index, controls, slider behavior, tuning state, and copyable JSON readout.
- Did not change spacing values, parser/import/save logic, `(CONT'D)` handling, or Script Breakdown.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Layout Tuning Panel Stacking

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Raised the temporary `LAYOUT TUNING` panel z-index from `1400` to `2147483647`.
- Did not move the panel, change slider behavior, change spacing values, or touch import/save/parser logic.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Draft Quota Fallback

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/useWritingDraftState.js`
- `src/components/modules/WritingScript/writingDraftPersistence.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a native IndexedDB fallback for oversized Writing draft payloads.
- Kept small drafts on the existing `writingScriptDraft:<project-id>` localStorage path.
- On localStorage `QuotaExceededError`, saves the full draft to IndexedDB and stores only a small marker in localStorage.
- Updated Writing draft loading to restore marker-backed drafts from IndexedDB.
- Updated the existing `useWritingDraftState` helper to use the same async safe load/save path.
- Suppressed repeated identical save-error spam and only warns once per oversized payload when using the fallback.
- Removed now-unused inline Writing draft storage-key callbacks from `WritingScript.jsx`.
- Did not touch PDF import, parser/classification, `(CONT'D)` logic, Script Breakdown, editor layout tuning, or contenteditable internals.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Temporary Writing Layout Tuning Panel

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a temporary floating `LAYOUT TUNING` button and collapsible panel in the Writing screenplay editor.
- Added live sliders for page top/bottom margins, all requested block top/bottom margins, line height, and page body line count.
- Initialized tuning state from the current Writing layout constants so default rendering is unchanged.
- Routed tuning state into `getScreenplayNodeStyle`, pagination estimates, scene stats, and dialogue overflow splitting.
- Added a copyable JSON readout of the current tuning values.
- Did not persist tuning values or change script data/import/parser behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Page Spacing Tuning

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Tuned only Writing screenplay page layout constants.
- Reduced Scene Heading margins from `24pt` before/after to `12pt` before/after.
- Updated `getSpacingBeforeNodeLines()` so Scene Heading before/after spacing estimates match the visual one-line gap.
- Increased `PAGE_LAYOUT.pageBodyHeightLines` from 54 to 56 to bring page breaks closer to the rendered page body and bottom margin.
- Did not touch PDF import, `(CONT'D)` logic, Script Breakdown, parser classification, page-break rendering internals, or contenteditable behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### PDF Continuation UI Path Normalization

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed Script Breakdown and Writing both use the shared `parseScriptFile()` import path from `src/utils/screenplayImport.js`.
- Added `normalizeCharacterContinuationMarkers()` as a post-parse cleanup before imported scenes are returned to App/Writing state.
- The normalizer folds a continuation-marker Parenthetical immediately after a Character block into that Character cue and removes the separate Parenthetical block.
- Added a parser fallback for continuation marker lines that appear after an extracted blank but still directly follow a Character block in scene content.
- Kept normal parentheticals as separate Parenthetical blocks and left render/editor internals unchanged.

**Verification:**
- Harness confirmed `ROLLAND` + `(CONT'D)` becomes `ROLLAND (CONT'D)` before imported data reaches UI state.
- Harness confirmed `(confused)` remains a Parenthetical under `MARIE`.
- Sample PDF check still showed zero separate continuation-marker Parenthetical blocks and zero `88xx..` numeric artifact blocks.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### PDF Dialogue Continuation Cleanup

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a targeted PDF numeric-artifact cleanup for standalone and trailing markers like `8833..`, `8822..`, and `8844..`.
- Kept standalone page number cleanup and title-page cleanup intact.
- Removed the artificial blank immediately after stripped page/artifact markers so dialogue mode can continue across page breaks.
- Preserved the existing action paragraph grouping and normal blank-line paragraph boundaries.
- Kept `(CONT'D)` continuation markers attached to Character cues while leaving normal parentheticals as Parenthetical blocks.

**Verification:**
- Parser harness confirmed continuation markers attach to Character cues and regular parentheticals remain separate.
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`; long dialogue with `(pause)` parentheticals remains Dialogue across the `8833..` page artifact, and numeric `88xx..` artifacts are removed from parsed blocks.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### PDF Character Continuation Import

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added continuation-marker detection for imported parenthetical text immediately following a Character block.
- Folded `(CONT'D)`, smart-apostrophe `(CONT’D)`, and dotted continuation variants into the preceding Character cue.
- Kept normal parentheticals as separate Parenthetical blocks so dialogue sequences still render correctly.
- Left Writing/Script renderers, contenteditable behavior, page-break logic, and scene parsing behavior otherwise unchanged.

**Verification:**
- Parser harness confirmed `MARIE` + `(CONT'D)` imports as `MARIE (CONT'D)` while `(nervously)` remains a Parenthetical block.
- Sample PDF import path produced no separate continuation-marker parenthetical blocks in the parsed output.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Mood Board Shared Route

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a shared `renderSharedMoodBoardModule()` helper in `App.js`.
- Reused that helper for both the normal production/pre-production `MoodBoard` module case and the Writing workflow Mood Board nav route.
- Removed duplicated inline Mood Board JSX from the Writing workflow path.
- Kept the same canonical Mood Board component, selected project, user role/editability, user, and moodboard data callback for both routes.
- Added the same `10px` content padding for Writing workflow Mood Board rendering.
- Did not change Mood Board internals, state/storage shape, page/layer/canvas behavior, export behavior, or saved data behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### PDF Import Paragraph Grouping

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Preserved paragraph gaps during positioned PDF text extraction so blank-line boundaries survive import.
- Changed plain screenplay parsing to accumulate wrapped physical lines into screenplay blocks rather than committing every line as its own block.
- Grouped wrapped Action paragraphs into one Action element.
- Grouped wrapped Dialogue lines under the same Character cue into one Dialogue element.
- Recombined wrapped parentheticals and kept them as Parenthetical elements in dialogue sequences.
- Kept title-page cleanup and standalone page-number cleanup in the PDF text path.
- Left Final Draft XML import behavior unchanged.

**Verification:**
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`; output starts at `EXT. ALLEY - NIGHT`, excludes title/contact text and standalone page numbers, groups first-scene wrapped Action paragraphs, and preserves wrapped Parenthetical blocks.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Writing Header Toolbar Refinement

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed the old visible `Writing Editor` label.
- Moved `TARGET` immediately to the right of the unified `WRITING` title.
- Moved the existing Writing toolbar controls into the unified header row while preserving control behavior.
- Kept the `Element` selector and controls to its right anchored to the same horizontal position inside the editor-width column as closely as possible.
- Left Writing editor internals, caret/contenteditable behavior, page rendering, scene window, import behavior, and Writing-to-Pre-Production isolation untouched.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Script Import Popups and Writing Shell

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/ProjectSelector.js`
- `src/components/modules/Script/Script.js`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Kept Script Breakdown `.fdx`/selectable-text `.pdf` import routed through the shared screenplay import helper.
- Replaced remaining Script Breakdown import/replace confirmation and alert paths with the existing centered app modal callbacks.
- Removed browser popup fallbacks from the legacy Script module when App modal callbacks are provided.
- Replaced Project Selection delete confirmation and delete result browser alerts with a matching centered app-style modal.
- Added the unified `WRITING` module header and writing-workflow `10px` content padding for the Writing Script submodule.
- Routed Writing import failure through the app alert callback when available.

**Verification:**
- Sample screenplay PDF extraction had already been verified against `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`, producing recognizable screenplay text and 99 parsed scenes.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Screenplay PDF Import

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/Script/Script.js`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/utils/screenplayImport.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added a shared `screenplayImport` utility that preserves existing Final Draft XML import and adds selectable-text screenplay PDF extraction/parsing.
- Updated Script Breakdown upload to accept `.fdx` and `.pdf` while keeping the existing production scene state, page stats, location/character detection, database save, and AI summarization prompt flow.
- Added Writing import support for `.fdx` and `.pdf` when the Writing editor has no script, converting imported scenes through the existing writing node conversion and draft save path.
- Kept imported-state behavior tied to existing content state: Script Breakdown hides upload once production scenes exist; Writing hides import/new controls once `noScript` is false.
- Did not add OCR or a new PDF-only script data shape.

**Verification:**
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf` through the PDF extraction/parser path; it produced recognizable screenplay text and 99 parsed scenes.
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Props Header Unification

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/Props/Props.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed the exact Props active module key is `Props`.
- Added `Props` to the App-level unified module padding condition.
- Reworked the Props root into the same fixed header and flex content structure used by confirmed reference modules.
- Set the header title to `PROPS` with the unified module title style.
- Moved Print Queue and `+ ADD CUSTOM PROP` into the right-aligned header action group.
- Kept prop filters, prop list, scene breakdown, prop management popup, image/lightbox behavior, scene associations, print queue behavior, and saved data behavior intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mood Board Board Title Correction

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed the active board title from the global `MOOD BOARD` module header.
- Restored the active board title, such as `Mood Board 1`, to the board workspace row directly above the canvas.
- Kept global Mood Board toolbar controls in the module header row with uppercase labels.
- Preserved add page, add text, duplicate, delete, grid snap, zoom, fit, export PDF, layers, canvas, pages, layer panel, image/card, presentation, and saved data behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mood Board Header Toolbar

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed the exact Mood Board active module key is `MoodBoard` and it is already in the shared App-level `10px` padding condition.
- Moved the main Mood Board canvas toolbar controls into the unified `MOOD BOARD` header row.
- Header now contains Add Page, Add Text, Duplicate, Delete, Grid Snap, Zoom, Fit, Export PDF, Layers, active board name, and status text.
- Removed the old separate main toolbar row so the workspace/content starts one row higher.
- Preserved contextual selected-item controls and existing canvas, layer, zoom, snap, export, add/delete/duplicate, upload, image/card, presentation, and saved data behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mood Board Header Unification

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed the exact Mood Board active module key is `MoodBoard`.
- Added `MoodBoard` to the App-level unified module padding condition.
- Added the shared fixed module header above the existing Mood Board workspace.
- Set the header title to `MOOD BOARD` with the unified module title style.
- Kept the existing board list, upload/roll controls, canvas toolbar, image/card layout, layer panel, presentation mode, drag/reorder behavior, and saved data behavior intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Timeline Header Unification

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/Timeline/Timeline.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed the exact Timeline active module key is `Timeline`.
- Added `Timeline` to the App-level unified module padding condition.
- Reworked the Timeline root into the same fixed header, controls row, and scrollable content structure used by the confirmed reference modules.
- Set the header title to `TIMELINE` with the unified module title style.
- Kept primary Timeline actions right-aligned in the header row and uppercased visible header/control labels.
- Kept Timeline selector, view tabs, and status in a separate controls row below the header.
- Preserved timeline visualization, event editing, lock behavior, view switching, scrolling, and saved data behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Shot List PG Columns Refinement

**Date:** 2026-05-22
**Branch:** main

**Files changed:**
- `src/components/modules/ShotList/ShotList.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added visible `PG #` and `PG CNT` labels to the fixed right-side page columns in Shot List scene heading rows.
- Kept page number and page count immediately to the left of `View Scene`.
- Preserved Shot List header layout, scene preview behavior, shot controls, editing, filtering, export, and saved data behavior.
- Confirmed To Do List already uses the exact `ToDoList` App module key, shared `10px` wrapper padding, and unified header structure from the prior pass.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Shot List Row Alignment and To Do List Header

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/ShotList/ShotList.js`
- `src/components/modules/ToDoList.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Adjusted Shot List scene heading rows so page number and page count use fixed right-side columns immediately before `View Scene`.
- Kept Shot List scene title/location area flexible so long titles do not shift the page columns or action button.
- Confirmed the exact To Do List active module key is `ToDoList`.
- Added `ToDoList` to the App-level unified module padding condition.
- Reworked To Do List root into the same fixed header and scrollable content structure used by the confirmed reference modules.
- Set the header title to `TO DO LIST` with the unified module title style.
- Kept `SHOW/HIDE COMPLETED` and `+ ADD TASK` controls right-aligned in the header.
- Kept Status, Assigned To, and Category filters in a separate control row below the header.
- Uppercased visible To Do List header/filter labels while preserving task behavior, completion, filtering, editing, deletion, and saved data behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Shot List — Header Unification

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/ShotList/ShotList.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Confirmed the exact Shot List active module key is `ShotList`.
- Added `ShotList` to the App-level unified module padding condition.
- Reworked the desktop Shot List root into the same fixed header and scrollable content structure used by the confirmed reference modules.
- Set the header title to `SHOT LIST` with the unified module title style.
- Kept the date filter and `Export PDF` controls together and right-aligned in the header.
- Kept scene rows, shot controls, shot editing, drag/reorder, PDF export, preview modal, and saved data behavior intact.
- Updated the no-scenes empty state to use the same header/content structure.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Call Sheet — Wrapper Padding Fix

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/App.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Corrected the unified App-level module padding condition from `Call Sheet` to the actual active module name `CallSheet`.
- This gives Call Sheet the same `10px` outer wrapper padding as the confirmed reference modules.
- No Call Sheet document/page preview styling, controls, export behavior, saved data behavior, or unrelated modules were changed in this pass.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Call Sheet — Header Unification

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/App.js`
- `src/components/modules/CallSheet/CallSheet.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added `Call Sheet` to the App-level unified module padding list.
- Reworked the desktop Call Sheet root into the same fixed header and scrollable content structure used by the confirmed reference modules.
- Set the header title to `CALL SHEET` with the unified module title style.
- Kept the Shooting Day selector plus `Export Call Sheet` and `Export Sides` controls in the same relative group, right-aligned in the header.
- Kept the call sheet document body in the scrollable content area.
- Updated the no-shooting-days empty state to use the same header/content structure.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Day Out of Days — Header Button Placement

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/modules/DayOutOfDays/DayOutOfDays.jsx`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Moved `+ Add Manual Event` and `Settings` from the Day Out of Days content controls row into the top header row.
- Kept the `DAY OUT OF DAYS` heading left-aligned and placed the buttons in a right-aligned header group.
- Preserved Matrix Filters in their existing content controls area.
- Preserved existing button handlers, disabled state, and settings modal behavior.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Active Scene Dropdown and Sides Polish

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added production-style mobile scene heading rendering that collapses embedded heading whitespace/newlines before display.
- Kept scene headings single-rendered and removed the raw `pre-wrap` heading behavior that could force imported heading fragments onto separate lines.
- Removed the separate `Sides view active` banner.
- Changed `Sides` button styling so inactive is white/gray like `More`, and active remains blue-filled.
- Kept `Sides` as a toggle/action; it does not open the `More` / `Script Tools` popup.
- Added active scene tracking from the mobile script scroll container.
- Updated the custom scene dropdown field to display the current active scene.
- Added dropdown row refs and list centering so opening the scene dropdown highlights and centers the active row when possible.
- Kept `More` / `Script Tools`, search, page jump, filters, Sides Behavior settings, custom scene dropdown, production-scene data source, fixed zoom, and fixed offset intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Script Tools Filters and Sides

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Expanded the mobile Script `More` popup into `Script Tools` sections for `Search`, `Page Jump`, `Script Filters`, and a collapsible `Sides Behavior` accordion.
- Kept the `More` popup free of any scenes grid; scene navigation remains handled by the custom toolbar scene dropdown.
- Added local search/filter state for text search, character, schedule/shooting day, status, and sides behavior settings.
- Derived a single local `visibleScenes` list from production scenes plus active search, filters, and sides settings without mutating source scenes.
- Added search against scene display labels/numbers, headings, script content text, and character cues.
- Added character options from production `Character` blocks.
- Added schedule options from already-loaded mobile `shootingDays` / `scheduledScenes` data and status options from `scene.status`.
- Changed `Sides` so it applies the selected local sides behavior as a toggle, while `More` remains the only button that opens `Script Tools`.
- Added page jump using rendered page-break markers with a closest-known-page fallback.
- Kept `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`, `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9`, production-scenes-only data, and the custom scene dropdown intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Sides Toggle and Text Autosizing

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added local `showSidesOnly` state.
- Changed `Sides` so it toggles sides display state instead of opening the `More` / `Script Tools` popup.
- Added a visible active state for `Sides` and a compact `Sides view active` banner.
- Kept `More` as the only toolbar button that opens the `Script Tools` popup.
- Kept the `Sides Behavior` placeholder section inside `Script Tools`.
- Added `WebkitTextSizeAdjust: "100%"` and `textSizeAdjust: "100%"` to the shared screenplay base style and scaled script page container to prevent mobile Safari from autosizing wider Scene Heading/Action blocks differently from narrower Dialogue/Parenthetical blocks.
- Kept `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9` and `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Font Consistency and Scroll Spacer

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed the custom mobile `h2` scene heading render path.
- Rendered scene headings through `getMobileProductionElementStyle("Scene Heading")`, matching the same duplicated production-style helper used by Action/Character/Dialogue/Parenthetical/Transition/Shot.
- Kept duplicated production base font family, `12pt` font size, `12pt` line height, color, whitespace, and wrapping behavior shared across all screenplay element types.
- Kept the duplicate metadata-style scene heading line removed.
- Trimmed the scroll spacer by the 0.75in page bottom margin and kept only a small 16px bottom buffer after scaled content.
- Kept fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`, `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9`, the custom scene dropdown, `More`, `Sides`, and Script Tools shell intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Locked Offset and Script Tools Shell

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed temporary offset slider UI and `bodyOffsetPx` local state.
- Locked `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9`.
- Kept body alignment calculation as `SCRIPT_VIEWER_BODY_X_OFFSET_PX - (MOBILE_SCRIPT_BODY_LEFT_PX * finalScale)`.
- Kept fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`.
- Added a compact `Sides` button at the far right of the mobile Script toolbar.
- Wired both `More` and `Sides` to a basic `Script Tools` popup shell.
- Added a `Sides Behavior` section with placeholders for `Day / Shooting Day`, `Character`, `Current Day`, and `Scheduled Scenes`.
- Matched mobile read-only scene heading style more closely to production `ContinuousScript` h2 style.
- Kept duplicate metadata heading/status body line removed; status remains only in the custom scene picker.
- Changed scroll-height initialization/measurement to reduce stale blank space after the final script content.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Offset Slider and Production Body Cleanup

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added temporary local `bodyOffsetPx` state initialized from `SCRIPT_VIEWER_BODY_X_OFFSET_PX = -15`.
- Added a compact non-persistent offset slider in the mobile Script toolbar with range `-80` to `80`, step `1`, and visible numeric value.
- Slider updates the readable body offset live via `bodyOffsetPx - (MOBILE_SCRIPT_BODY_LEFT_PX * finalScale)`.
- Removed the mobile-only `INT/EXT • LOCATION • TIME` metadata line under scene headings.
- Removed the mobile-only status badge from the script body; compact status remains in the custom scene picker.
- Changed mobile scene heading rendering to match production Script Breakdown's read-only h2-style heading more closely.
- Kept production duplicated body styles for Action/Character/Dialogue/Parenthetical/Transition/Shot.
- Observed the rendered page in the scroll-height measurement path so the vertical spacer tracks content height more reliably.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Custom Scene Picker and Body Alignment

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed the native scene `<select>` from `MobileScriptModule`.
- Added a custom toolbar scene field that opens a compact popup below the one-line Script toolbar.
- Popup rows show scene display label, heading, viewer-estimated page number, and scheduled status badge when available.
- Selecting a row closes the popup and scrolls the script viewer to that scene.
- Kept `More` as a button only; no More/Filters modal was added.
- Replaced outer-page offset tuning with `SCRIPT_VIEWER_BODY_X_OFFSET_PX = -15`.
- Body alignment subtracts the scaled 1.4in page/body margin before applying the body offset, so the tuning constant visibly moves the readable script body.
- Kept fixed 132% zoom, production scene data source, production-style formatting, page breaks, and browser pinch prevention unchanged.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Screen-Space Offset and Compact Select

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Replaced the transform-combined horizontal offset with `SCRIPT_VIEWER_X_OFFSET_SCREEN_PX = -15`.
- Applied the offset to an unscaled outer wrapper using `left: -15px`, while the inner page keeps `transform: scale(finalScale)`.
- Kept `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`.
- Preserved the one-line toolbar layout and `More` button.
- Tightened the closed native scene select with 5px toolbar side padding, smaller font, compact height, and compact padding.
- Did not implement the More modal or change script formatting/data source.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — One-Line Toolbar and Offset

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Set `SCRIPT_VIEWER_X_OFFSET_PX = -15` for the fixed-scale mobile Script page.
- Kept `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` and the existing fit-to-width baseline calculation.
- Collapsed the mobile Script toolbar from two rows to one compact row.
- Toolbar now shows Script title and scene count on the left, native Scenes dropdown in the center, and a `More` button at the far right.
- Removed the read-only pill from the toolbar and kept zoom controls absent.
- Made the native scene select field more compact with smaller font, compact height, and near full available center width.
- Left browser pinch prevention, production-style formatting, page breaks, and production-scene data source unchanged.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Fixed 132% Viewer Zoom

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Removed mobile Script reader manual zoom state, refs, touch listeners, +/- buttons, and zoom label.
- Kept app-level browser pinch prevention intact.
- Added `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` and `SCRIPT_VIEWER_X_OFFSET_PX = 0`.
- Changed the mobile Script page transform to `translateX(${SCRIPT_VIEWER_X_OFFSET_PX}px) scale(${finalScale})`, with `finalScale` derived from fit-to-width scale times the fixed 132% zoom.
- Kept the main mobile toolbar and Script toolbar outside the scaled script wrapper.
- Left production-style script formatting, page breaks, and production-scene data source unchanged.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

### Mobile Script Reader — Production Formatting and Toolbar

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Replaced the simplified mobile-only screenplay formatting with duplicated production Script Breakdown formatting constants from `Script.js`.
- Mobile reader now uses production-style page width, body margins, per-element indents/widths, uppercase behavior, and dialogue/parenthetical spacing.
- Wrapped the script page in horizontal overflow so mobile preserves production-style relative formatting instead of collapsing it into percentage indents.
- Reworked the scene dropdown into a sticky mobile Script toolbar with module label, read-only status, current scene indicator, and Scenes navigation control.
- Kept the reader read-only and production-scenes-only.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

---

### Mobile Script Reader — Production Scenes Read-Only MVP

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Enabled the existing mobile `Script` module option.
- Added `MobileScriptModule`, a read-only mobile script reader that uses production `scenes` loaded from the `scenes` table.
- Added scene jump dropdown with smooth scroll to scene sections.
- Rendered scene display labels, headings, metadata location/time summary, status badge, and content blocks with mobile-readable screenplay formatting.
- Did not use WritingScript, writing draft nodes, writing localStorage, beats, or writing timeline state.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

---

### Production Script Breakdown — Viewer-Based Page Stats and Wrap Spacing

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/modules/Script/Script.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Replaced SceneList's independent `calculateScenePageStats()` fallback with page stats emitted by production `ContinuousScript`.
- Added a single viewer pagination pass that generates both viewer page breaks and per-scene `{ pageNumber, startPage, timelineStartPage, timelinePageLength }`.
- Passed viewer page stats from `ContinuousScript` up to `Script` and down into `SceneList`.
- Adapted production script element wrapping/spacing constants from the Writing editor: screenplay body margins, per-element widths/indents, line wrapping, and dialogue/parenthetical spacing.
- Kept production edit mode and existing production save/database paths intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

---

### Stripboard Schedule — Lunch Divider Reflow and Empty Target Fill

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Added empty target detection for schedule scene blocks with no scene/custom/lunch/end-of-day content.
- Dropping an available or scheduled scene/custom item onto an empty block now fills that block instead of inserting before/after it.
- Added lunch-divider reflow helpers so non-lunch scheduled moves reorder the non-lunch sequence and then restore lunch to its previous divider index.
- Lunch itself still moves through the existing insert/reflow path when dragged.
- Kept `preserveEmpty` rows, UUID `+` rows, immediate `+` row sync, insert/reflow behavior, and shooting-day persistence behavior intact.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

---

### Stripboard Schedule — Preserve Intentional Empty Rows During Reorder

**Date:** 2026-05-21
**Branch:** main

**Files changed:**
- `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Changes:**
- Stopped the reorder helper from globally filtering every empty scene block during scene/custom/lunch moves.
- Reorder now removes only the dragged source block and inserts it before/after the drop target, preserving all other empty rows.
- Scene removal still removes the specific scene block so that removal collapses that row only.
- New `+` empty rows now use UUID ids, are marked with `preserveEmpty: true`, and sync immediately via the existing schedule-block update path.
- Empty-row removal and custom-item edits now also sync the changed day blocks immediately, reducing stale realtime overwrite windows.

**Verification:**
- `npm run build` — passed.
- Generated build artifacts were restored/cleaned.

---

### Writing Timeline Visibility Fix — Scene and Beats Tracks Independent

**Date:** 2026-05-16
**Branch:** main

**Files changed:**
- `src/experimental/writingTimeline/WritingTimeline.jsx` — five targeted changes (see below)
- `build/` — rebuilt successfully (Compiled successfully, no warnings)
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Motivation:**
Scene Timeline and Beats Timeline checkboxes were not independent. Enabling only Beats Timeline still showed the scene track because `showSceneTrack` was not in WritingTimeline's function signature (prop was silently ignored) and the scene track div rendered unconditionally. Enabling Beats Timeline with no beats showed nothing at all because `hasVisibleBeatsTrack = showBeatsTrack && beats.length > 0` hid the beats area when empty.

**Changes to `WritingTimeline.jsx`:**
1. Added `showSceneTrack = true` to the function signature (was missing — prop was silently ignored).
2. Replaced `hasVisibleBeatsTrack = showBeatsTrack && beats.length > 0` with `hasVisibleBeatsTrack = showBeatsTrack` and `hasBeats = Array.isArray(beats) && beats.length > 0` (decoupled area visibility from content).
3. Changed early return from `if (!scenes.length) return null` to `const hasAnythingToShow = (showSceneTrack && scenes.length > 0) || showBeatsTrack; if (!hasAnythingToShow) return null`.
4. Scene Timeline label and Scenes Zoom controls gated on `{showSceneTrack && ...}`; "Beats Timeline" header label shown only when `!showSceneTrack && showBeatsTrack`.
5. Entire scene track scroll area wrapped in `{showSceneTrack && ...}`.
6. Beat count text gated on `showBeatsTrack && hasBeats`.

**WritingScript.jsx was not modified** — already passes `showSceneTrack={showWritingTimeline}` and `showBeatsTrack={showBeatsTrack}` correctly.

**Behavior after fix:**
- Neither checked → timeline does not render.
- Scene Timeline only → scene track visible; beats track hidden.
- Beats Timeline only (with beats) → beats track visible; scene track hidden.
- Beats Timeline only (no beats) → empty beats rail visible; scene track hidden; no fallback to scenes.
- Both checked → both tracks visible.

**Hard limits honored:**
- No database.js, saveScenesDatabase, setScenes, setStripboardScenes, or production callbacks touched.
- No Pre-Production, Production, or Script Breakdown behavior changed.
- No localStorage key names changed.
- No beat drag-to-position or hover tooltip implemented.

**Build:** `npm run build` — Compiled successfully, no warnings.

**Pending (not in this phase):**
- Beat drag-to-position on timeline.
- Beat hover tooltip on timeline.
- `showBeatsTrack` persistence across reload (known bug — `docs/REGRESSION_TEST_CHECKLIST.md` J4).

---

### Architecture Audit — Full Codebase Documentation

**Date:** 2026-05-16
**Branch:** main

**Files created:**
- `docs/APP_ARCHITECTURE_MAP.md` — App.js routing, workflow branching, AuthWrapper, WorkflowTabs, module mounting
- `docs/PROP_FLOW_MAP.md` — Full prop map for App, ScriptBreakdown, Script.js, WritingScript, WritingScriptEditor, WritingTimeline, SceneList, BeatsList
- `docs/SCRIPT_MODULE_OWNERSHIP.md` — Script.js production vs. writing mode responsibilities, what was copied into WritingScript, what remains only in Script.js
- `docs/WRITING_VS_PRODUCTION_BOUNDARIES.md` — Canonical boundary definition: what WritingScript may own, must not receive, and future handoff design
- `docs/DATA_STORAGE_MAP.md` — All localStorage keys with owner/shape/reader/writer; all Supabase tables; key risk areas (unscoped mood overlay keys)
- `docs/REGRESSION_TEST_CHECKLIST.md` — Complete pre-commit checklist covering Writing editor, scene list, timeline, beats, settings, Script Breakdown, Stripboard, routing/layout, and data isolation

**Key findings:**
- WritingScript is correctly isolated — no production callbacks, no DB writes confirmed by grep
- Mood overlay localStorage keys (`scriptMoodOverlayEnabled`, `scriptMoodOverlaySettings`) are UNSCOPED (global) in both WritingScript and Script.js init — WritingScript doesn't persist changes back; this is a known bug
- `scriptBeats:${projectId}` and `scriptWritingDraft:${projectId}` are intentionally shared between WritingScript and Script.js writing mode
- `showBeatsTrack` is NOT persisted by WritingScript (unlike `showWritingTimeline`)
- Presence channel is `"script"` in both modules — should eventually be `"writing-script"`
- `scriptTimelinePositions:${projectId}` is only written by Script.js, not by WritingScript

**No runtime code was changed.**

---

### Phase 4Z — WritingScript: Full Copy of Script.js Writing Mode

**Date:** 2026-05-16
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx` — complete rewrite as full copy/adaptation of Script.js writing mode (~730 lines)
- `build/` — rebuilt successfully (Compiled successfully, no warnings)
- `HANDOFF.md`, `AI_TASK_LOG.md`, `src/components/modules/WritingScript/ARCHITECTURE.md`

**Motivation:**
User rejected the Phase 4Y partial stats fix and demanded a full direct copy/adaptation of the Script.js writing-mode implementation into WritingScript.jsx. All prior WritingScript.jsx internals were replaced.

**What was copied from Script.js writing mode:**
- All beat text helpers: `BEAT_MENU_COLORS`, `normalizeBeatText`, `createBeatId`, `stripBeatMarker`, `extractOriginalBeatNumber`, `isBeatSectionHeader`, `isActHeading`, `isNumberedBeatTitle`, `isBulletBeatTitle`, `isLikelyBeatTitle`, `createAutoBeatTitle`
- `normalizeOutlineItems`, `parseBeatSheetText`
- Full `BeatsList` component (drag/drop, color markers, context menu, act grouping, beat detail modal)
- Full `SceneList` component with presence indicators, page stats display, drag/reorder
- All writing state: `writingDraftNodes`, `writingDraftSaveStatus`, `writingScenePageStats`, `showWritingSceneNumbers`, `showWritingTimeline`, `targetPageCount`, `showTargetPageDialog`, `showMoodOverlaySettings`, `beats`, `activeSidePanelTab`, `showBeatsTrack`, `showBeatImportDialog`, `beatImportText`, `beatImportDraft`, `selectedBeatDetailId`, `collapsedActIds`, `currentIndex`, `currentSceneNumber`, `writingEditorElementType`
- Full toolbar: Target button, element selector, save status, written/remaining/percent, New Script button, Settings button
- WritingTimeline integration
- Beat import modal, beat detail modal, target page dialog, settings modal (scene timeline/beats timeline/scene numbers/mood overlay toggles)
- All handlers: `handleWritingDraftNodesChange`, `handleWritingSceneListReorder`, `handleTimelineSceneMove`, `handleStartNewScript`, all beat handlers
- Multi-key stats lookup: `stableSceneId = headingNode.id || headingNode.sceneId || scene.sceneId || scene.id || fallback`

**Production paths removed (per hard limits):**
- No `saveScenesDatabase` call
- No `setScenes` / `setStripboardScenes` / `syncStripboardScenesToDatabase`
- No `tagWord` / `untagWordInstance`
- No production character/revision/schedule/call-sheet/report callbacks
- `handleStartNewScript` simplified to just `createEmptySceneHeadingNode()`
- Beat Convert to Scene disabled: `onConvertItem={null}` in BeatsList, button always disabled
- `isViewOnly` derived from `userRole === "viewer"` prop

**Persistence keys (unchanged from Script.js writing mode):**
- Draft: `scriptWritingDraft:${projectId}`
- Beats: `scriptBeats:${projectId}`

**Build:** `npm run build` — Compiled successfully, no warnings.

---

### Phase 4W — Writing Scene Page Stats: Full Reliable Rewrite

**Date:** 2026-05-16
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/writingPageStats.js` — new file: `normalizeWritingDraftNodes` + `calculateWritingPageStats`
- `src/components/modules/WritingScript/WritingScript.jsx` — replaced state-based stats with useMemo from normalized nodes
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Root cause (confirmed):**

Two independent bugs combined to make all scenes show wrong stats:

1. **Invalid sceneIds in existing localStorage data.** Scenes created via `transformEmptyNodeToNewSceneHeading` (Enter key from Action → Scene Heading) stored `sceneId: "temp-node-{timestamp}-{random}"` (non-UUID). `scenesFromDocumentNodes` checked `isValidSceneId(headingNode.sceneId)` and, finding false, called `createSceneId()` to generate a BRAND NEW UUID for `scene.id` on every render. Stats were keyed by the temp-node string. Lookup `scenePageStats[scene.id]` always found nothing for scene 2+.

2. **Stats depended on editor-internal emission (`onSceneStatsChange`).** When the editor emitted stats, they were keyed by the heading node's `sceneId` (temp-node string). But `scene.id` in WritingSceneList came from `scenesFromDocumentNodes`, which generated a new UUID each render. Even after Phase 4V fixed the `createSceneId()` call for NEW scenes, existing saved drafts already had temp-node IDs in localStorage and were not migrated.

**Phase 4V fix (partial — only helped future scenes):** Changed `transformEmptyNodeToNewSceneHeading` to use `createSceneId()` instead of `makeTempNodeId()` for scene heading `sceneId`. Didn't fix existing stored drafts.

**Phase 4W fix (complete):**

A. `normalizeWritingDraftNodes(nodes)` — repairs any heading node with non-UUID sceneId by assigning a new UUID. Body nodes following a heading inherit the corrected UUID. Returns original array reference (by reference equality) when no repair is needed, so useMemo doesn't thrash. Called on every `writingDraftNodes` change via useMemo in WritingScript.

B. `calculateWritingPageStats(nodes)` — standalone stats calculator operating directly on normalized nodes. Duplicates the exact same algorithm as `getSceneStatsFromPaginatedPages` in WritingScriptEditor (same spacing rules, CHARS_PER_LINE_BY_TYPE, PAGE_BODY_HEIGHT_LINES=54, pageIndex/lineCursor, timelineStartPage, timelinePageLength, pageLength, pageNumber). Keyed by `node.sceneId` which is now guaranteed to be a valid UUID. No dependency on editor-internal state or `onSceneStatsChange`.

C. In WritingScript.jsx: replaced `useState({})` / `setWritingScenePageStats` / `onSceneStatsChange` prop with:
```js
const normalizedDraftNodes = useMemo(() => normalizeWritingDraftNodes(writingDraftNodes), [writingDraftNodes]);
const writingScenes = useMemo(() => scenesFromDocumentNodes(normalizedDraftNodes), [normalizedDraftNodes]);
const writingScenePageStats = useMemo(() => calculateWritingPageStats(normalizedDraftNodes), [normalizedDraftNodes]);
```
A useEffect persists normalized nodes back to localStorage via `handleWritingDraftNodesChange` when repair was needed (avoids future re-normalization). Normalization effect has a ref guard to prevent double-writes.

**Proof — different length scenes produce different stats:**
```
Scene 1 (heading + 1 short action): pageNumber=1, timelinePageLength=0.125 → 1/8
Scene 2 (heading + 20 lines action): pageNumber=1, timelinePageLength=0.315 → 3/8
Scene 3 (heading + 60 lines action): pageNumber=1, timelinePageLength=1.667 → 1 5/8
```
Verified by running the algorithm in Node.js before implementation.

**Why "all scenes 1/8" happened:** When scene 2's stats lookup returned null (key mismatch), scene 2 showed nothing. But scene 1's stats always had `timelinePageLength = 0.125` because the editor-emitted stats used the node's `text` from React state (`nodes`), which was always empty (stale — `handleInput` never calls `setNodes`). So all visible stats showed 1/8.

**Why "all scenes show last page's page number":** With the key mismatch, only scene 1's lookup succeeded. The `pageNumber` in its stats came from stale empty-text nodes where the line cursor never crossed a page boundary (lineCursor stayed small → pageIndex always 0 → pageNumber always 1). After Phase 4U added emission in `handleInput`, the live nodes had correct text, but the key mismatch still caused scene 2+ to show nothing. Any apparently "wrong" page numbers were from stale emissions.

**localStorage compatibility:** Existing drafts with temp-node sceneIds are automatically normalized on load via the useMemo + useEffect pattern. No user action needed. Normalized IDs are written back to localStorage so future loads don't re-normalize.

**Layout/beats/production:** No layout geometry, toolbar, sidebar, beats behavior, New Script behavior, production callbacks, database.js, or save paths changed.

---

### Phase 4V — Writing Scene IDs: Fix sceneId for New Scenes (Partial Fix)

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx` — import `createSceneId`; use it instead of `makeTempNodeId()` for sceneId in `transformEmptyNodeToNewSceneHeading`

**Root cause addressed:** `transformEmptyNodeToNewSceneHeading` called `makeTempNodeId()` for the new scene's `sceneId`. This returned `"temp-node-{timestamp}-{random}"` (non-UUID), which failed `isValidSceneId()` in `scenesFromDocumentNodes`, causing a brand-new UUID to be generated for `scene.id` on every render — preventing stats from ever being found.

**Why incomplete:** Only fixed NEW scenes created after the change. Existing localStorage drafts still had old temp-node sceneIds. Phase 4W added the full normalization pass.

---

### Phase 4U — Writing Scene Page Fractions: Fix Stale Stats (All Scenes 1/8)

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx` — emit stats from live DOM nodes on input
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Root cause (exact):**

`handleInput` reads current DOM text into `liveNodes` and calls `emitNodesChange(liveNodes)` — but never calls `setNodes(liveNodes)`. The editor's internal `nodes` React state therefore stays at its initial/stale value (with empty text) throughout active typing. The stats `useEffect` fires only when `nodes` changes, which never happens during text input. The `initialNodes` sync effect is blocked by the `lastEmittedNodesPayloadRef` guard (it matches because `normalizeNodes(liveNodes) === liveNodes` in payload, so the guard short-circuits and `setNodes` is not called).

**Consequence:** Stats (`timelinePageLength`) were always computed from nodes with empty text, resulting in minimal line counts. `timelinePageLength` always hit the `Math.max(0.125, ...)` fallback → every scene displayed "1/8" regardless of actual content length.

**Why structural changes worked:** Enter/delete calls `updateNodes`, which calls `setNodes(normalizedNextNodes)` with DOM-fresh text via `readNodesFromDom`. That updates internal `nodes` → stats useEffect fires → correct stats computed. Text-only input never triggered this path.

**Fix:** In `handleInput`, immediately after `emitNodesChange(liveNodes)`, also compute and emit page stats from the same live DOM nodes:
```js
const livePaginated = paginateNodesForScreen(liveNodes);
onSceneStatsChange?.(getSceneStatsFromPaginatedPages(livePaginated, liveNodes));
```
Both functions are module-level (accessible in closure). `onSceneStatsChange` is the prop passed as `setWritingScenePageStats`. Stats now update in real-time as user types.

**Old WritingSceneList fix preserved:** `stats?.timelinePageLength ?? stats?.pageLength` — correct field priority (decimal fraction first, integer whole-pages fallback).

---

### Phase 4T — Writing Scene Page Fractions: Wrong Field (All Showed "1")

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingSceneList.jsx` — changed `stats?.pageLength` to `stats?.timelinePageLength ?? stats?.pageLength`

**Problem:** `pageLength` emitted by `getSceneStatsFromPaginatedPages` is an integer (whole pages, always >= 1). `formatScenePageLength(1)` = "1" (not a fraction). The decimal field is `timelinePageLength`. Fix: read `timelinePageLength` first (as legacy `getSceneMetadataColumns` does). This was correct but incomplete — stats themselves were still stale.

---

### Phase 4S — Writing Scene Page Fractions + New Script Caret Fix

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingSceneList.jsx` — added page fraction display
- `src/components/modules/WritingScript/WritingScript.jsx` — fixed New Script creates only Scene Heading
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Problem A:** WritingSceneList only showed `pageNumber` (e.g., "Pg 2"), not fractional `pageLength` (e.g., "3/8"). The `pageLength` decimal (0.125 = 1/8 page) was already being provided by `writingScenePageStats` from `WritingScriptEditor`, but was not being formatted or displayed.

**Fix A:** Added `formatScenePageLength()` (copied from `src/utils/scenePresentation.js`) directly into WritingSceneList.jsx. The formatter converts a decimal page length to eighths notation: `0.125 → "1/8"`, `0.375 → "3/8"`, `1.25 → "1 2/8"`. Both `pageNumber` and `pageLength` columns are now shown in scene rows.

**Problem B:** `handleCreateWritingDraft` created two nodes — a Scene Heading and an Action body node. The caret landed on the Action line instead of the Scene Heading.

**Fix B:** Removed the `createEmptyWritingNode("Action", ...)` call. `handleCreateWritingDraft` now creates only the Scene Heading node. The unused `createEmptyWritingNode` import was also removed.

---

### Phase 4R — Writing Layout Geometry Correction

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx` — main workspace row geometry corrected
- `src/App.js` — Writing content wrapper overflow corrected
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Problem:** The Writing layout had incorrect geometry:
- Editor column used `flex: 1` — `WritingScriptEditor` centers 8.5in pages within whatever width it receives, creating excess left centering padding as the viewport widened.
- Right panel also used `flex: 1` — both halves split the screen equally, causing the Scenes/Beats panel to drift far from the editor/page on wide screens.
- No width constraint on the main content row.
- App.js Writing content wrapper used `overflow: "hidden"` instead of `overflow: "auto"`, clipping content on narrow screens.

**Fix — WritingScript.jsx main workspace (lines copied from Script.js line 5732 and 5908):**

*Before:*
```
Main workspace div: flex: 1, display: "flex", flexDirection: "row", overflow: "hidden"
Editor div: flex: 1, overflow: "auto"
Right panel div: flex: 1, padding: "8px 20px 12px 0", boxSizing: "border-box"
Tab bar div: display: "flex", gap: "6px", padding: "0 0 5px", marginLeft: "20px", width: "492px"
```

*After (matches Script.js):*
```
Main workspace div: display: "flex", flex: 1, overflow: "hidden", minWidth: 0, minHeight: 0,
  width: "calc(8.5in + 520px)", maxWidth: "calc(8.5in + 520px)",
  alignSelf: "flex-start", paddingTop: "5px", boxSizing: "border-box"

Editor div: flex: "0 0 8.5in", width: "8.5in", minHeight: 0,
  overflowY: "auto", overflowX: "hidden"

Right panel div: flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
  position: "relative", zIndex: 1, backgroundColor: "white", minWidth: 0
  (no padding — removed "8px 20px 12px 0")

Tab bar div: marginLeft: "20px", width: "492px", display: "flex",
  flexShrink: 0, gap: "6px", padding: "0 0 5px", boxSizing: "border-box", alignItems: "center"
```

**Fix — App.js Writing content wrapper:**
- Changed `overflow: "hidden"` → `overflow: "auto"` to match production content wrapper behavior (allows horizontal scroll on narrow screens).

**Effect:**
- Editor column is now exactly 8.5in wide — pages fill edge-to-edge with no centering margin, eliminating the excess left padding.
- Right panel is constrained to the remaining space within `calc(8.5in + 520px)` — approximately 520px — matching the Script Breakdown side panel geometry. Panel no longer drifts on wide screens.
- `alignSelf: "flex-start"` prevents the content row from stretching to fill the viewport width.
- `paddingTop: "5px"` adds the same top inset as Script Breakdown.

**Functionality preserved:**
- New Script, element selector, save status, page count — unchanged.
- Scene list (derives from writingDraftNodes only) — unchanged.
- Beat add/edit/delete/reorder/color/context menu/detail modal — unchanged.
- `writingBeats:${projectId}` localStorage key — unchanged.
- Writing draft persistence — unchanged.
- No production callbacks passed into WritingScript.
- `database.js` and `saveScenesDatabase` not touched.
- `Script.js` not edited.
- Pre-Production and Production behavior unchanged.

**Build result:** Compiled successfully.

**Known issues:**
- Body/action text persistence bug (650ms debounce) — unresolved, next priority.

---

### Phase 4Q — Writing Left Sidebar and Beats Panel Parity

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/App.js` — Writing workflow block replaced with sidebar + content area; added `writingActiveModule` state
- `src/components/modules/WritingScript/WritingScript.jsx` — beats state lifted here; beat detail modal; Add Beat/Act in tab bar
- `src/components/modules/WritingScript/WritingBeatsPanel.jsx` — converted to pure display component, copy of BeatsList from Script.js minus Convert to Scene
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Part A — Writing left module sidebar:**
- Writing workflow now renders a Writing sidebar (`position: fixed`, `left: 0`, `top: 44px`, `bottom: 0`, `width: 120px`, `backgroundColor: "#FFE5B4"`) — same dimensions and style as the production/pre-production sidebar
- Writing content area starts at `left: "120px"` instead of `left: 0` — no more horizontal jump when switching workflows
- Writing sidebar shows: Script (active — enabled, sets `writingActiveModule`), Moodboard (disabled placeholder, `opacity: 0.45`), Characters (disabled placeholder)
- Moodboard shown as disabled because wiring it to the production MoodBoard component + `setScriptMoodImages` callback was out of scope and risked production coupling
- Characters shown as disabled because Writing Characters is not implemented yet

**Part B — Writing Beats parity with Script Breakdown BeatsList:**

*WritingBeatsPanel.jsx (pure display component):*
- Receives: `beats`, `onDeleteItem`, `onReorderItem`, `onOpenItem`, `onColorItem`, `collapsedActIds`, `onToggleAct`
- Panel header: "Outline" label + beat count + act count — matches BeatsList header exactly
- Beat rows: `padding: "10px"`, `borderBottom` from color or `#eee`, `borderLeft: 3px` color accent, `backgroundColor` from color — matches BeatsList
- Beat row header: `#N` (8px, #777), strong title (11px, #222, ellipsis), red delete button (20×20, #c62828)
- Description text below title: `fontSize: "10px"`, `color: "#444"`, `whiteSpace: "pre-wrap"`
- Act rows: `#CFD8DC` background, uppercase bold, collapse toggle button (22×22), delete button
- Drag-and-drop reorder: `draggable`, `onDragStart/Over/Drop/End`, drop indicator via `2px solid #316AC5`
- Context menu on right-click: "Open Details", "Change Color" (with color picker submenu), "Delete Beat" — no "Convert to Scene"
- Color markers: `BEAT_MENU_COLORS` (7 colors: default/red/orange/yellow/green/blue/purple) applied as `borderLeft` accent + `backgroundColor` tint — matches Script Breakdown exactly
- Double-click opens beat detail modal (handled in WritingScript.jsx)
- Act collapse/expand toggle via `collapsedActIds`

*WritingScript.jsx (beats state owner):*
- Beats state lifted from WritingBeatsPanel:
  - `const [beats, setBeats] = useState(() => loadWritingBeats(projectId))`
  - `const [collapsedActIds, setCollapsedActIds] = useState({})`
  - `const [selectedBeatDetailId, setSelectedBeatDetailId] = useState(null)`
- localStorage key unchanged: `writingBeats:${projectId || "default"}`
- Backward compat: old beats with `notes` field are migrated to `description` on load
- Beat shape extended: `{ id, type, title, description, order, markerColor }` (type: "beat" | "act")
- Beat functions: `handleAppendBeat`, `handleDeleteBeat`, `handleReorderBeat`, `handleUpdateBeat`, `handleColorBeat`, `handleToggleAct`
- "Add Act" + "Add Beat" buttons appear in tab bar when Beats tab is active — matches Script Breakdown layout
- Beats tab label shows `"Beats (N)"` count when beats exist
- Beat detail modal: title input + description textarea, Delete Beat + Close buttons — no Convert to Scene (Writing-only)

**Functionality intentionally omitted (vs Script Breakdown):**
- "Convert to Scene" — Writing-only, no production scene creation
- "Import Beats" — not implemented in Phase 4Q, can be added later as Writing-only import
- Moodboard module — shown as disabled placeholder, not wired to production
- Characters module — disabled placeholder, Writing Characters not implemented

**Backward compatibility of beat data:**
- Old `notes` field migrated to `description` on load via `normalizeWritingBeats`
- No change to localStorage key `writingBeats:${projectId}`

**Production callback isolation confirmed:**
- No production callbacks passed into WritingScript.
- `database.js` not touched.
- `saveScenesDatabase` not touched.
- `Script.js` not edited.
- Pre-Production and Production behavior unchanged.
- Writing beats use `writingBeats:${projectId}` key (separate from production `scriptBeats:${projectId}`).

**Build result:** Compiled successfully (+1.96 kB gzip).

**Known issues / follow-up:**
- Body/action text persistence bug (650ms debounce) — not fixed in 4Q, remains next priority.
- Moodboard could be wired to the existing `MoodBoard` module in a future phase if writing-specific image storage is added.
- Writing Characters module planned but not started.

---

### Phase 4P — Writing Workflow Visual Parity with Script Breakdown

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingSceneList.jsx` — restyled to match Script Breakdown SceneList
- `src/components/modules/WritingScript/WritingBeatsPanel.jsx` — restyled to match Script Breakdown BeatsList
- `src/components/modules/WritingScript/WritingScript.jsx` — tabbed right panel, restyled toolbar
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Layout change:**
Replaced three-column workspace (scene list left | editor center | beats right) with:
- Editor (flex, left)
- Right panel (flex 1, ~512px effective) with Scenes / Beats tab bar + conditionally rendered panel

**Tab bar:**
- `marginLeft: "20px"`, `width: "492px"`, `gap: "6px"`, `padding: "0 0 5px"`
- Active tab: `backgroundColor: "#316AC5"`, white text
- Inactive tab: `backgroundColor: "#f5f5f5"`, `color: "#222"`
- `fontWeight: "bold"`, `fontSize: "12px"`, `border: "1px solid #ccc"`, `borderRadius: "4px"`, `padding: "6px 12px"`
- `activeSidePanelTab` state in `WritingScript`: `"scenes"` | `"beats"`, default `"scenes"`

**WritingSceneList.jsx restyling:**
- Outer: `marginLeft: "20px"`, `flex: 1`, `display: "flex"`, `flexDirection: "column"`, `minHeight: 0`
- Panel: `width: "492px"`, `border: "2px inset #ccc"`, white bg, Century Gothic 12px
- Row: `padding: "3px 8px"`, `borderBottom: "1px solid #f0f0f0"`, hover `#E3F2FD`
- Scene number: `<strong style={{ fontSize: "13px" }}>`, `" – "`, heading text or Untitled italic
- Page label: `fontSize: "10px"`, `color: "#888"`, right-aligned, `"Pg N"` format

**WritingBeatsPanel.jsx restyling:**
- Outer: `marginLeft: "20px"`, `flex: 1`, `display: "flex"`, `flexDirection: "column"`, `minHeight: 0`
- Panel: `width: "492px"`, `border: "2px inset #ccc"`, white bg, Century Gothic 12px
- Beat row: `padding: "10px"`, `borderBottom: "1px solid #eee"`
- Beat number: `fontSize: "8px"`, `color: "#777"`, `fontVariantNumeric: "tabular-nums"`, `minWidth: "22px"`
- Beat title: `fontSize: "11px"`, `fontWeight: "bold"`, `color: "#222"`, overflow ellipsis
- Delete button: `width: "20px"`, `height: "20px"`, `backgroundColor: "#c62828"`, white, `fontSize: "10px"`
- Add beat row embedded in the bottom of the panel; `+` button blue when title present
- Expanded beat: inline edit with input + textarea + Done button + delete button

**WritingScript.jsx toolbar restyling:**
- `minHeight: "38px"` (was 40px fixed)
- `padding: "5px 0 5px 12px"` (was `"0 12px"`)
- `backgroundColor: "white"` (was `"#fafafa"`)
- `borderBottom: "1px solid #eee"` (was `"1px solid #e0e0e0"`)
- New Script button: `padding: "6px 14px"`, `fontSize: "13px"` (was 12px)
- "Writing Editor" label (was "Element") with `color: "#607D8B"`, `fontSize: "11px"`, `fontWeight: "bold"`
- Element selector: `padding: "5px 8px"`, `fontSize: "12px"` (was `"3px 5px"` / `"11px"`)
- Save status: `width: "64px"`, `color: "#777"`, `textAlign: "left"` (was 68px / `"#999"` / right)

**Production callback isolation confirmed:**
- No production callbacks passed into WritingScript.
- `database.js` not touched.
- `saveScenesDatabase` not touched.
- `Script.js` not edited (inspected patterns only).
- Pre-Production and Production behavior unchanged.

**Build result:** Compiled successfully.

---

### Phase 4O — Writing Scene List and Beats Panel

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingSceneList.jsx` — full implementation (was placeholder)
- `src/components/modules/WritingScript/WritingBeatsPanel.jsx` — full implementation (was placeholder)
- `src/components/modules/WritingScript/WritingScript.jsx` — three-column layout, scene derivation, stats fix
- `HANDOFF.md`, `AI_TASK_LOG.md`

**Layout implemented:**
Three-column row workspace below the toolbar:
- Left 200px (fixed): `WritingSceneList`
- Center (flex): `WritingScriptEditor` in scrollable wrapper
- Right 200px (fixed): `WritingBeatsPanel`

**Scene list behavior:**
- Derives writing scenes from `writingDraftNodes` via `scenesFromDocumentNodes` (useMemo, writing-only — no production scenes read)
- Displays scene number, heading text ("Untitled" if empty), page number from `writingScenePageStats` if available
- Click-to-scroll via `sceneRefs` (calls `scrollIntoView` on the heading element ref)
- Drag/reorder intentionally not implemented in Phase 4O — document as follow-up

**Beat panel behavior:**
- Self-contained beat state in `WritingBeatsPanel` (no shared production state)
- localStorage key: `writingBeats:${projectId}` (separate from legacy `scriptBeats:${projectId}`)
- Supports: add beat (type title + Enter or + button), click to expand and edit title/notes, delete
- Beat-to-production-scene conversion intentionally not implemented

**WritingScript.jsx changes:**
- Added `useMemo` import
- Added `scenesFromDocumentNodes` import
- Fixed `writingScenePageStats` — was `const [, setWritingScenePageStats]` (discarded); now stores and passes to scene list
- Added `projectId = selectedProject?.id || selectedProject?.name || null`
- Added `writingScenes = useMemo(() => scenesFromDocumentNodes(writingDraftNodes), [writingDraftNodes])`
- Replaced single editor `div` with three-column row

**Body/action persistence bug:** Not fixed in Phase 4O. Likely cause: 650ms debounce + quick reload. Noted as highest-priority next fix.

**Production callback isolation confirmed:**
- No production callbacks passed into WritingScript.
- `database.js` not touched.
- `saveScenesDatabase` not touched.
- `Script.js` not edited (inspected patterns only).
- Pre-Production and Production behavior unchanged.

**Build result:** Compiled successfully.

### Phase 4N — Writing Toolbar/Header

**Date:** 2026-05-15
**Branch:** main

**Files changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

**Controls added to Writing toolbar/header:**
- New Script button (only shown when `writingDraftNodes.length === 0`)
- Element selector: `<select>` of all 7 node types, disabled when no node is focused, visible once a draft exists
- Page count: "N pg / N pgs", sourced from `onPageCountChange` callback fed by editor's `paginatedPages.length`
- Save status: fixed 68px width, shows Saved / Unsaved / Saving... / Save error

**Element selector position fix:**
- Added `showFloatingElementSelector = true` prop to `WritingScriptEditor`
- Wrapped the existing fixed bottom-right floating element panel with `showFloatingElementSelector && activeNode && ...`
- Passed `showFloatingElementSelector={false}` from `WritingScript` — floating selector is now suppressed
- Element selector in the toolbar uses `activeElementType` state (bidirectional with editor via existing `onActiveElementTypeChange` → `activeElementType` prop cycle)

**WritingScriptEditor edits:** Yes — minimal prop additions only (`showFloatingElementSelector`, `onPageCountChange`). No behavior changes, no production code touched.

**Body/action persistence bug:** Not fixed in Phase 4N. Noted as highest-priority follow-up.

**Production callback isolation confirmed:**
- No production callbacks (`setScenes`, `saveScenesDatabase`, `setStripboardScenes`, `syncStripboardScenesToDatabase`, `tagWord`, `untagWordInstance`, production character/revision/schedule callbacks) were passed into WritingScript.
- `database.js` was not touched.
- `saveScenesDatabase` was not touched.
- Pre-Production and Production behavior unchanged.

**Build result:** Compiled successfully.

### 2026-05-15 — Codex — Phase 4M WritingScript Editor Activation

**Task:**
Route the Writing workflow to the dedicated WritingScript module in editor-only mode while leaving Pre-Production and Production on the existing module system.

**Files Changed:**
- `src/App.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added the first active WritingScript route. When `activeWorkflow === "writing"`, `App` now renders `WritingScript` with `previewMode="editor"` in a fixed workspace pane and does not render the existing production/pre-production module sidebar. Pre-Production and Production continue to render the existing sidebar/module system unchanged. WritingScript receives only `selectedProject`, `user`, and `userRole`; no production mutation callbacks are passed.

**Verification:**
- Build: `npm run build` passed
- Manual: Writing tab shows the isolated WritingScript editor-only surface.
- Manual: The old production/pre-production sidebar is gone in Writing mode.
- Manual: Pre-Production still shows the existing module system.
- Manual: Production still shows the existing module system.
- Manual: Script Breakdown still appears to open and function.
- Manual: New Script appears to create a writing draft, but current UI testing did not fully confirm all behavior.
- Manual: Reload appears to preserve the scene heading, but not body/action text.
- Manual: It is not yet clear from the UI whether Writing actions are completely isolated from production scenes.

**Remaining Issues:**
- Phase 4M is the first rough activation of WritingScript, not a polished Writing workflow.
- Editor-only Writing mode is intentionally incomplete. Scene window, beats window, timeline, and settings/header controls are not active yet.
- Highest-priority next bug: body/action text persistence appears broken in the new isolated WritingScript editor path. Scene heading persistence appears to work on reload, but body/action text does not.
- The element selector/control appears in the bottom-right corner. This is not the desired final location and needs a future layout pass.
- Script Breakdown still contains legacy writing-mode behavior/branches from `Script.js` until later cleanup.
- Pre-Production Script Breakdown still contains the old writing-mode behavior/branches from legacy `Script.js`; this is expected for now.
- There may be a brief flash/load of the old writing side of Script Breakdown when switching workflows. Track this as a future routing/loading cleanup issue.
- Handoff and Writing Characters remain inactive follow-up phases.

### 2026-05-15 — Codex — Phase 4L WritingScript Editor Preview

**Task:**
Make the non-routed WritingScript shell capable of rendering an isolated editor-only preview using WritingScript-owned draft state.

**Files Changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added an explicit `previewMode="editor"` path to `WritingScript`. The component still returns `null` by default and remains unrouted. In editor preview mode it uses `useWritingDraftState(selectedProject)`, renders `WritingScriptEditor`, shows writing draft save status, and provides a writing-only New Script action that creates draft nodes through writing draft helpers. No production callbacks or production scene data are imported or used.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
The New Script preview path uses `createEmptySceneHeadingNode`, which still relies on the shared scene identity helper. This remains compatible for now but should be clarified later as writing-scene identity, not production scene identity.

### 2026-05-15 — Codex — Phase 4K Writing Draft Persistence Foundation

**Task:**
Create the WritingScript-owned writing draft persistence/state foundation without routing WritingScript or changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/writingDraftPersistence.js`
- `src/components/modules/WritingScript/useWritingDraftState.js`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added inactive WritingScript-owned localStorage persistence helpers and a draft-state hook for future activation. The helper preserves the existing `scriptWritingDraft:${projectId}` key and payload shape (`projectId`, `savedAt`, `hasUserCreatedScript`, `nodes`). Nothing is routed or used by active runtime yet, and no production mutation callbacks are imported.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future phases still need to wire WritingScript to these helpers and then remove the active writing draft persistence from the legacy mixed Script module.

### 2026-05-15 — Codex — Phase 4I Non-Routed WritingScript Shell

**Task:**
Create a non-routed WritingScript shell that composes the future WritingScript surfaces without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Updated `WritingScript.jsx` from a null-only placeholder into a non-routed future shell. It returns `null` by default. If explicitly passed `previewShell={true}`, it renders only hidden inert surface markers for the future WritingTimelinePanel, WritingScriptEditor, WritingSceneList, WritingBeatsPanel, and WritingSettingsModal; it does not mount active editor/timeline components or create runtime state.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
WritingScript is still not routed. Future phases must provide writing-only props/state before activating this shell.

### 2026-05-15 — Codex — Phase 4H Writing Settings Placeholder

**Task:**
Create a WritingScript-owned settings modal placeholder without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/WritingSettingsModal.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added `WritingSettingsModal` as a non-rendering ownership placeholder and exported it from the WritingScript module index. Actual target page count, timeline/beats/scene-number visibility, editor element type, save-status display, toolbar settings buttons, and localStorage-backed writing settings remain in the legacy mixed Script module unchanged.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future extraction must split writing settings from the legacy Script module without changing the current localStorage keys or visible writing toolbar behavior.

### 2026-05-15 — Codex — Phase 4G Writing Scene List Placeholder

**Task:**
Create a WritingScript-owned scene list placeholder without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/WritingSceneList.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added `WritingSceneList` as a non-rendering ownership placeholder and exported it from the WritingScript module index. Actual scene list UI, writing draft scene derivation, display labels, drag/reorder, page metadata display, scene refs, and selection behavior remain in the legacy mixed Script module unchanged.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future extraction must split the current mixed `SceneList`, which serves both writing draft scenes and production/script-breakdown scenes.

### 2026-05-15 — Codex — Phase 4F Writing Beats Panel Placeholder

**Task:**
Create a WritingScript-owned beats/outline panel placeholder without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/WritingBeatsPanel.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added `WritingBeatsPanel` as a non-rendering ownership placeholder and exported it from the WritingScript module index. Actual beats state, BeatsList, import/detail UI, persistence, and beat conversion remain in the legacy mixed Script module unchanged.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future extraction must handle `handleConvertBeatToScene` carefully because it currently creates production scenes directly. That behavior should become writing-only draft behavior or move behind the explicit Writing-to-Pre-Production handoff.

### 2026-05-15 — Codex — Phase 4E Writing Timeline Panel Wrapper

**Task:**
Create a WritingScript-owned timeline panel wrapper around the existing experimental WritingTimeline component without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/WritingTimelinePanel.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added `WritingTimelinePanel` as a pass-through wrapper around `src/experimental/writingTimeline/WritingTimeline.jsx` and exported it from the WritingScript module index. The legacy mixed Script module still imports the experimental timeline directly; no timeline runtime imports, props, drag/reorder/snap behavior, or utilities were changed.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future phases still need to route Writing through a dedicated WritingScript component before this wrapper becomes the active timeline render path.

### 2026-05-15 — Codex — Phase 4D Screenplay Preview Relocation

**Task:**
Move the screenplay preview implementation into the WritingScript module area with a compatibility re-export and no runtime behavior changes.

**Files Changed:**
- `src/components/modules/WritingScript/ScreenplayPagePreview.jsx`
- `src/components/modules/Script/ScreenplayPagePreview.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Moved the implementation source from `Script/ScreenplayPagePreview.jsx` to `WritingScript/ScreenplayPagePreview.jsx`. The old Script path now re-exports the new implementation so legacy imports continue to resolve. No implementation import paths needed adjustment beyond the relocation because the component only imports React.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
The preview is not yet part of a dedicated routed WritingScript module. Future phases still need to route Writing through writing-only props and keep preview/editor behavior isolated from production data.

### 2026-05-15 — Codex — Phase 4C Writing Editor Relocation

**Task:**
Move the writing editor implementation into the WritingScript module area with a compatibility re-export and no runtime behavior changes.

**Files Changed:**
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `src/components/modules/Script/ScriptWritingEditor.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Moved the implementation source from `Script/ScriptWritingEditor.jsx` to `WritingScript/WritingScriptEditor.jsx`. The old Script path now re-exports the new implementation so existing imports from the legacy mixed Script module continue to resolve unchanged. The only implementation import path adjustment was switching the editor model import to `./writingDraftModel`.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
The editor is still rendered through the legacy mixed Script module. Future phases still need to route Writing to a dedicated WritingScript component with writing-only props.

### 2026-05-15 — Codex — Phase 4B Writing Draft Model Extraction

**Task:**
Extract pure writing draft model helpers into the new WritingScript module area without changing runtime behavior.

**Files Changed:**
- `src/components/modules/WritingScript/writingDraftModel.js`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `src/components/modules/Script/scriptWritingModel.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Moved the existing writing draft model exports into `WritingScript/writingDraftModel.js`. The legacy `Script/scriptWritingModel.js` file is now a compatibility re-export, so existing imports from `Script.js` and `ScriptWritingEditor.jsx` continue to work unchanged. Helper behavior, return shapes, ID behavior, metadata behavior, and scene conversion behavior were intentionally preserved.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
`documentNodesFromScenes` and `scenesFromDocumentNodes` still preserve the existing production-shaped scene conversion behavior. They should be split later into writing-only draft helpers and explicit handoff mappers.

### 2026-05-15 — Codex — Phase 4A Script Split Structure

**Task:**
Create structure-only compatibility folders for the future WritingScript, ScriptBreakdown, WritingCharacters, and Writing-to-Pre-Production handoff split.

**Files Changed:**
- `src/App.js`
- `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`
- `src/components/modules/ScriptBreakdown/index.js`
- `src/components/modules/ScriptBreakdown/ARCHITECTURE.md`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/index.js`
- `src/components/modules/WritingScript/ARCHITECTURE.md`
- `src/components/modules/WritingCharacters/WritingCharacters.jsx`
- `src/components/modules/WritingCharacters/index.js`
- `src/components/modules/WritingCharacters/ARCHITECTURE.md`
- `src/components/workspace/handoff/ARCHITECTURE.md`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Summary:**
Added placeholder module folders and architecture notes for the planned split. `ScriptBreakdown` is a temporary pass-through wrapper around the legacy mixed `Script` module, and `App.js` now imports the production-facing Script Breakdown module through that wrapper. No Script internals, database code, persistence, scene data, characters, schedules, tags, revisions, or runtime behavior were changed.

**Verification:**
- Build: `npm run build` passed

**Remaining Issues:**
Future phases still need to extract actual Writing Script logic, Script Breakdown logic, Writing Characters behavior, and the explicit handoff layer.

### 2026-05-15 — Codex — Phase 3 Script Breakdown Label Compatibility

**Task:**
Rename the production-facing module label from Script to Script Breakdown in the general module system while preserving backward compatibility with old "Script" references. Phase 3 only; no Script split, persistence changes, or handoff implementation.

**Files Changed:**
- `src/App.js`
- `src/components/auth/AuthWrapper.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Added `SCRIPT_BREAKDOWN_MODULE`, `normalizeModuleName`, and `normalizeModuleList` helpers in `App.js`.
- Changed the general module list label from `Script` to `Script Breakdown`.
- Aliased the existing `src/components/modules/Script/Script.js` import as `ScriptBreakdownModule` without moving or editing the file.
- Updated module rendering so normalized `Script` and `Script Breakdown` values both render the existing script component.
- Updated permission handling so old custom permissions containing `Script` normalize to `Script Breakdown`.
- Updated sidebar active-state and Script-specific content padding to use normalized module names.
- Updated the team custom-permissions picker to show `Script Breakdown` while treating old stored `Script` values as checked and removable.

**Verification:**
- Build: `npm run build` PASSED.

**Notes:**
- No changes were made to `Script.js`, `database.js`, `saveScenesDatabase`, scene data, writing draft data, stripboard data, schedules, tags, revisions, realtime subscriptions, production module internals, or handoff behavior.

### 2026-05-15 — Codex — Phase 2 Workflow Workspace Routing

**Task:**
Add workflow-level routing/workspace structure while keeping existing module behavior stable. Phase 2 only; no Script split, data persistence, module rename, handoff, or module internals changes.

**Files Changed:**
- `src/components/auth/AuthWrapper.js`
- `src/App.js`
- `src/components/workspace/WorkflowWorkspace.jsx`
- `src/components/workspace/WritingWorkspace.jsx`
- `src/components/workspace/PreProductionWorkspace.jsx`
- `src/components/workspace/ProductionWorkspace.jsx`
- `src/components/workspace/ComingSoonWorkspace.jsx`
- `src/components/workspace/workflowConfig.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Passed `activeWorkflow` from `AuthWrapper` into `App` through the existing clone/injection path.
- Added a lightweight `WorkflowWorkspace` router.
- Added placeholder workspace components for Writing, Pre-Production, and Production. They currently render the existing module system unchanged.
- Added a stable `ComingSoonWorkspace` for disabled workflow states if reached directly.
- Added `getWorkflowById` helper to workflow config.

**Verification:**
- Build: `npm run build` PASSED.

**Notes:**
- No changes were made to `Script.js`, `database.js`, `saveScenesDatabase`, scenes, writing draft data, stripboard data, schedules, tags, revisions, realtime subscriptions, module routing internals, or production module internals.
- Separate `activeModuleByWorkflow` was intentionally not added in Phase 2. Keeping the current single `activeModule` avoids changing existing sidebar/module behavior and avoids widening module navigation changes before the Script split plan is ready.

### 2026-05-15 — Codex — Phase 1 Workflow Toolbar Shell

**Task:**
Add top-level workflow tabs to the existing desktop toolbar and move the project name left beside the welcome/display-name area. Phase 1 only; no module routing, Script split, data, persistence, or database changes.

**Files Changed:**
- `src/components/auth/AuthWrapper.js`
- `src/components/workspace/WorkflowTabs.jsx`
- `src/components/workspace/workflowConfig.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Added config-driven workflow phases: Writing, Pitching, Pre-Production, Production, Post-Production.
- Added presentational `WorkflowTabs` with stable fixed-width tab geometry.
- Added `activeWorkflow` state in `AuthWrapper.js` for visual tab selection only.
- Moved the project name from the old absolute-centered toolbar position into the left welcome area while preserving its existing font weight, size, letter spacing, uppercase transform, and nowrap behavior.
- Reworked the toolbar layout to a three-column grid: left identity/project, centered workflow tabs, right project/team/sign-out controls.
- Disabled Pitching and Post-Production tabs remain visible, greyed out, and show "Coming Soon"; clicking them does nothing.

**Verification:**
- Build: `npm run build` PASSED.

**Notes:**
- No changes were made to `Script.js`, `database.js`, `saveScenesDatabase`, module routing, scenes, writing draft data, stripboard data, schedules, tags, revisions, or production module internals.

### 2026-05-09 — Claude — Script Writing-Mode Deletion/Scene-Creation Cleanup Sprint

**Task:**
Fix 5 issues in the script writing mode: orphaned heading-only scenes after selected delete, heading drag selection limited to heading only, double-enter leaving an orphan Action block, new scenes defaulting to "INT. LOCATION - DAY", and noisy realtime console logs.

**Root Causes:**

1. **Orphaned "2:" scene after delete (Problem 1):**
   Combined effect of Problem 2 (selection constrained, endOffset mid-block) and `survivingFromRange` never filtering out scenes whose heading was cleared to `""` AND all content blocks are empty. Those scenes would appear in the sidebar as "N:" with no heading text.

2. **Heading drag selection constrained (Problem 2):**
   When dragging starts on a `contenteditable` heading, the browser enters "editing mode" for that element and constrains the drag selection to within the heading boundary, even after `setEditableBlocksEnabled(false)`. Unlike block drags where this constraint doesn't trigger, heading drags consistently caused this behavior.

3. **Double-enter orphan Action block (Problem 3):**
   `handleCreateSceneAfter` updated the `blockIndex` block's text to `blockText` but never removed it from the source scene's content. The empty Action block at `blockIndex` that triggered scene creation remained in the scene.

4. **Default "INT. LOCATION - DAY" heading (Problem 4):**
   `createBlankScene` hard-coded `heading: "INT. LOCATION - DAY"` and `metadata: { intExt: "INT.", location: "LOCATION", timeOfDay: "DAY" }`.

5. **Noisy realtime logs (Problem 5):**
   Supabase realtime fires one event per DB row changed (1 upsert + N deletes per save). Each event triggered a separate `console.log("REALTIME: Scenes changed...")` and `console.log("SKIPPING... sync lock active")`.

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `src/App.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**

**Problem 2 — `handleSelectionMouseDownCapture` (Script.js):**
- Added `isHeadingStart` detection.
- When starting on a heading: capture `headingMousedownRange = getCaretRangeFromPoint(event.clientX, event.clientY)` BEFORE `setEditableBlocksEnabled(false)`. Call `event.preventDefault()` to prevent the browser from entering contenteditable editing mode (which constrains drag to the heading).
- In `handleMouseUp`: if `drag.headingMousedownRange && drag.moved`, use `getCaretRangeFromPoint(upEvent.clientX, upEvent.clientY)` for the end position. Build a synthetic `spanRange` from both positions. Compute `pendingSelectionDeleteRef` from the two endpoints. This bypasses browser native selection entirely for heading-start drags.
- Non-heading drags fall through to the existing native selection snapshot path unchanged.
- Click on heading (no drag): `event.preventDefault()` means no automatic focus. `handleMouseUp` still calls `targetBlock.focus()` via the `drag.blockEl` fallback; heading `onFocus` fires and sets `activeBlock`.

**Problem 1 — `handleMultiBlockSelectionDelete` (Script.js):**
- After `survivingFromRange` loop, added `cleanSurvivors` filter: keeps only scenes where `heading.trim()` is non-empty OR at least one content block has non-empty text.
- `guaranteedSurvivors`: if `cleanSurvivors` is empty AND no scenes exist outside the range (entire script would be empty), keeps one clean empty scene from `currentScenes[orderedEnd.si]`.
- `nextScenes` construction and `pushUndoEntry`'s `replace` field both use `guaranteedSurvivors` instead of `survivingFromRange`.
- DOM reconciliation loop updated to iterate `guaranteedSurvivors`.

**Problem 3 — `handleCreateSceneAfter` (Script.js):**
- Removed `blockText` parameter (now unused).
- Instead of updating `blockIndex`'s text, the block is filtered out of the source scene's content. If removing it would leave 0 blocks, one clean empty Action block is kept.

**Problem 4 — `createBlankScene` (Script.js):**
- `heading: ""` (was `"INT. LOCATION - DAY"`).
- `metadata: {}` (was `{ intExt: "INT.", location: "LOCATION", timeOfDay: "DAY" }`).
- Heading form uses `|| "INT."` / `|| "DAY"` fallbacks so existing UX is unchanged.

**Problem 5 — Realtime handler (App.js):**
- Added `window._scenesRealtimeLogAt` and `window._scenesSkipLogAt` timestamp guards. Each log only fires once per 2-second window, collapsing repeated per-row events into a single line.

**Verification:**
- Build: `npm run build` PASSED

**Expected Behavior After Fix:**
1. Selecting from beginning of Scene 2 heading to end of script and pressing Delete → Scene 2 and all following scenes removed entirely. No "2:" orphan.
2. Starting selection drag on a scene heading → selection extends into body blocks and across scenes normally. Delete removes selected content/scenes correctly.
3. Double-enter on empty Action block → new scene created, NO orphan Action line left in previous scene.
4. New scene (Add Scene, double-enter) → heading field is blank after the display label, no "INT. LOCATION - DAY".
5. Undo/redo → restores/re-deletes cleanly, no orphan scenes.
6. Persistence → deleted scenes stay deleted after module switch.

### 2026-05-08 — Claude — Script Writing-Mode Selected-Delete Persistence Fix

**Task:**
Make selected-delete persist: deleted scenes must update canonical `scenes` state (and the DB) immediately, not just local `editingScenes`.

**Root Cause:**
`editingScenes` is local state in the outer Script component. Canonical `scenes` (shown in the Scenes list, used to reload on module-switch) lives in App state. They're only synced via the 15-second auto-save timer. When a scene is deleted:
1. `editingScenes` drops one entry immediately — editor view updates ✓
2. `scenes` still has N scenes for ≤15 seconds — Scenes list shows stale data ✗
3. If the component remounts (module switch), the init `useEffect` (dep: `[isWritingMode, scenes]`) re-populates `editingScenes` from the old `scenes` — deleted scene returns ✗

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
Added one `useEffect` in the outer Script component, after the 15s auto-save effect:

```js
useEffect(() => {
  if (!isWritingMode) return;
  if (!editingScenes.length) return;
  if (editingScenes.length === scenes.length) return;
  const normalized = normalizeSceneIds(editingScenes);
  setScenes(normalized);
  saveScenesDatabase(normalized).catch(...);
}, [editingScenes.length, isWritingMode]);
```

- Dep is `editingScenes.length` (not the full `editingScenes` array) — fires only on scene add/remove, not on every keystroke.
- The `if (editingScenes.length === scenes.length)` guard prevents firing when counts are already in sync (normal state), on init with empty `editingScenes`, or after the auto-save already synced.
- `setScenes(normalized)` updates the canonical Scenes list immediately.
- `saveScenesDatabase(normalized)` persists to DB immediately (the 15s auto-save would later be a no-op since payload matches).
- Only fires in writing mode (`isWritingMode`). Edit mode preserves its "commit on Save" design.
- Undo/redo that changes scene count (via `multi-scene-delete`) also triggers the effect automatically.

**Undo/Redo Persistence:**
- Undo restores deleted scenes → `editingScenes.length` increases → effect fires → `setScenes` restores scenes to canonical state ✓
- Redo re-deletes scenes → `editingScenes.length` decreases → effect fires → `setScenes` removes scenes from canonical state ✓
- No changes to `applyUndoEntry` or `ContinuousScript` needed.

**Verification:**
- Build: `npm run build` PASSED

### 2026-05-08 — Claude — Script Writing-Mode Selected-Delete Structural Cleanup

**Task:**
Fix blank-block leftovers after selected delete, and enable full scene removal when entire scenes are encompassed by the selection.

**Root Cause of Blank-Block Leftovers:**
- Middle scenes were always preserved via `ensureSceneHasBlock([], content[0])` — never removed from `editingScenes`.
- Start blocks trimmed to `""` (startOffset=0 with selection continuing past them) stayed in `nextContent` because `firstRemovedBlockIndex` excludes the start block itself.
- End blocks trimmed to `""` (endOffset at or past block length) stayed for the same reason.

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- **`isSceneFullySelected`**: detects scenes whose entire content (heading start at offset 0 through last block end) is covered by the selection.
- **`fullySelectedSet`**: Set of scene indices to remove; safety ensures at least one scene (orderedEnd.si) is always preserved.
- **`survivingFromRange`**: explicit loop replacing the old `currentScenes.map`; fully-selected scenes are skipped (`continue`); `blocksToRemove` Set catches middle blocks AND fully-consumed start/end blocks.
- **`nextScenes`**: spread construction from `currentScenes.slice(0, spliceAt) + survivingFromRange + currentScenes.slice(orderedEnd.si+1)`.
- **`multi-scene-delete` undo entry**: symmetric `spliceAt / replace / insert` splice model. `applyUndoEntry` swaps `replace`↔`insert` and `focus`↔`inverseFocus` to produce the inverse entry; redo is free.
- **DOM reconciliation**: uses `buildSceneDisplayLabelMap(editingScenesRef.current)` computed inside the `setTimeout` so heading labels are always based on the post-delete scene array.
- **Focus after delete**: deletion point if start scene survived; heading of first surviving scene otherwise.
- **`selection?.removeAllRanges()`**: made optional-chained for safety.

**Verification:**
- Build: `npm run build` PASSED

**Limitations:**
- Manual browser testing still needed for partial heading selections spanning scene boundaries, single-block scenes, and deep undo/redo chains.

### 2026-05-08 — Claude — Script Writing-Mode Selected-Delete Repair

**Task:**
Fix multi-block selected delete across heading/body boundaries. Selections made via the selection bridge were not being deleted because browsers collapse cross-`contenteditable` selections when `contenteditable` is restored to `true`.

**Root Cause:**
`setEditableBlocksEnabled(true)` in the mouseup handler runs before Delete fires. Chrome/Safari collapse any cross-boundary selection at that moment. `handleMultiBlockSelectionDelete` checks `selection.isCollapsed` first and bails immediately.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Added `pendingSelectionDeleteRef = useRef(null)` to store a normalized selection snapshot.
- Added `getNodeAndOffsetAtChar(el, charOffset)` helper that walks the DOM text tree to map a character offset back to a `{ node, offset }` pair for `Range` construction.
- `handleSelectionMouseDownCapture`: clears `pendingSelectionDeleteRef` at drag start; before calling `setEditableBlocksEnabled(true)`, captures normalized snapshot (ordered flow positions + char offsets) into `pendingSelectionDeleteRef.current`; after re-enabling editability, attempts to restore the browser selection visually using `getNodeAndOffsetAtChar`.
- `handleMultiBlockSelectionDelete`: restructured to try live browser selection first, then fall back to `pendingSelectionDeleteRef.current` when live selection is collapsed/unavailable. Clears the ref regardless of outcome.

**Verification:**
- Build: `npm run build` PASSED

### 2026-05-08 — Codex — Script Writing-Mode Documentation/Handoff Update

**Task:**
Document the current writing-mode editor architecture and the remaining selected-delete issue for a clean Claude handoff. No behavior changes.

**Files Changed:**
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Current Verified State:**
- Scene rendering unification is complete.
- Multi-scene visual selection works.
- Body-block multi-block selected delete exists.
- Heading integration exists for navigation and custom delete resolution.
- ArrowUp/ArrowDown navigation through headings works correctly.
- Typing safety is stable.
- Parenthetical behavior is stable.
- Undo/redo are stable.
- Cmd+1-7, Tab/Enter, Character autocomplete, and final empty-block delete are working.

**Script Editor Architecture Notes:**
- Writing mode still uses multiple separate `contentEditable` hosts, not one editor root.
- Body text blocks render as `.script-edit-block`.
- Editable scene headings render as `.script-heading-edit`.
- Live typing is intentionally DOM-owned while focused; React state is synced on blur or explicit structural/type/history operations.
- The flow-unit model is:
  - `{ si, kind: "heading" }`
  - `{ si, kind: "block", bi }`
- Multi-scene selection uses a selection bridge: on drag from an editable block/heading, editables are temporarily marked `contenteditable=false`; on mouseup editability is restored.
- Undo/redo are local to Script writing mode and scoped by entry type. They do not restore whole-script snapshots.
- `multi-block-delete` history entries store only touched scene heading/body content arrays.
- Character autocomplete is local state in `ContinuousScript`, active only on Character lines, sourced from existing Character blocks plus `characters` prop/module data.

**Historical Root Causes Documented:**
- Reverse typing happened when focused `contentEditable` blocks were rendered as React children and React rewrote the focused DOM on each keystroke, resetting caret placement.
- Imported vs writing-created scenes diverged because writing-created scene wrappers/default fields and heading/editable classes differed from imported render paths; unification removed extra dividers/spacing and aligned defaults.
- Headings were originally skipped because navigation/delete resolvers only targeted `.script-edit-block`; headings used `.script-heading-edit`.
- The original delete path failed with headings because the custom selected-delete resolver could not resolve selection endpoints inside heading edit hosts.

**Important Remaining Issue:**
- Browser testing shows multi-block selected delete involving headings/body selections still does **not** reliably delete the actual highlighted selected text.
- Navigation across headings is correct.
- Visual selection across headings/body blocks works.
- The failure is specifically Delete/Backspace reconciliation against the browser `Selection`/`Range` across separate contentEditable hosts after the selection bridge.

**Recommended Next Claude Sprint:**
- Audit browser `Selection`/`Range` mutation behavior for selections spanning `.script-heading-edit` and `.script-edit-block`.
- Verify whether the custom delete path receives the same range the user sees highlighted after editability is restored.
- Reconcile selected range offsets against actual DOM text before mutating `editingScenes`.
- Keep the flow-unit model and scoped undo/redo; do not rewrite the editor into one contentEditable.

**Verification:**
- Build: `npm run build` PASSED
- No code files were edited in this documentation pass.

### 2026-05-08 — Codex — Script Writing-Mode Heading Integration

**Task:**
Include editable scene headings in writing-mode vertical navigation and selected-delete behavior.

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Added a generalized script-flow resolver for writing mode:
  - `{ si, kind: "heading" }`
  - `{ si, kind: "block", bi }`
- ArrowUp/ArrowDown now traverse headings as part of the screenplay flow:
  - heading → first body block
  - first body block → heading
  - previous scene last block → next scene heading
  - scene heading → previous scene last block
- Multi-block selected delete now resolves both `.script-heading-edit` and `.script-edit-block`.
- Selected delete involving headings trims/clears heading text while preserving scene objects, scene ids, metadata, order, and at least one body block per touched scene.
- Scoped undo/redo for `multi-block-delete` now restores/reapplies both affected headings and body content arrays.

**Verification:**
- Build: `npm run build` PASSED
- Diff whitespace check: `git diff --check -- src/components/modules/Script/Script.js AI_TASK_LOG.md HANDOFF.md` PASSED

**Deferred / Limitations:**
- Heading labels remain derived display text. If a selection removes derived label characters, only the editable heading text is persisted; scene labels/ids are not modified.
- Manual browser verification is still needed for complex heading/body selections around page-break markers.

### 2026-05-08 — Codex — Script Writing-Mode Multi-Block Selected Delete

**Task:**
Implement safe Delete/Backspace behavior for selections spanning multiple screenplay blocks/scenes.

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Added a conservative multi-block selection delete path for Script writing mode.
- Delete/Backspace now intercept only when the browser selection resolves to two different `.script-edit-block` elements.
- Single-block selections remain native browser behavior.
- Multi-block deletion:
  - trims selected text from the first block
  - trims selected text from the last block
  - removes fully selected middle blocks
  - preserves scene identity/order and keeps every touched scene with at least one content block
  - collapses the caret back to the deletion start
- Added scoped undo/redo support through a `multi-block-delete` history entry storing only touched scene content arrays, not whole-script snapshots.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Scene headings are preserved conservatively. Selections that start or end in a scene heading are not handled by the custom multi-block delete path.
- Manual browser verification is still needed for copy/delete feel across complex selections and page-break boundaries.

### 2026-05-08 — Codex — Script Writing-Mode Redo Stabilization

**Task:**
Fix broken Script writing-mode redo before adding any new editor features.

**Files Changed:**
- `src/components/modules/Script/Script.js`
- `AI_TASK_LOG.md`
- `HANDOFF.md`

**Changes:**
- Redo now applies the same scoped history entries as undo: text edits, type changes, add block, and delete block.
- History application now uses a current `editingScenes` ref instead of stale render-closure state.
- Pending text snapshot timers are cancelled before undo/redo application so delayed typing snapshots cannot clear redo or overwrite restored text.
- Structural undo/redo rebuilds the block text snapshot map after block indices shift.
- Type/text/add/delete edits continue clearing redo through the normal `pushUndoEntry` path.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Multi-block selected delete was deferred. The selection bridge spans separate `contentEditable` hosts, and implementing destructive cross-block deletion needs browser verification to avoid damaging scene/block structure.
- Manual browser verification is still needed for redo feel across text/type/add/delete block operations.

### 2026-05-08 — Codex — Script Writing-Mode Follow-Up Sprint

**Task:**
Fix final empty-block deletion, add conservative redo, and add Character-line autocomplete.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Final empty block deletion:
  - Backspace/Delete now remove an empty current block even when it is the last block in the scene.
  - The only block in a scene is still protected.
  - Caret restores to the end of the previous block without changing its type/text.
- Redo:
  - Added Cmd+Shift+Z / Ctrl+Shift+Z redo.
  - Redo mirrors scoped undo entries only: text edits, type changes, add block, delete block.
  - New edits clear the redo stack.
  - No whole-script snapshots are restored.
- Character autocomplete:
  - Active only on Character lines.
  - Suggestions come from existing script Character blocks plus `characters` prop/module data.
  - Matching is case-insensitive.
  - Enter/Tab accept only while the dropdown is open.
  - Escape closes; Up/Down navigate suggestions only while open.
  - Accepted names insert uppercase text.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Manual browser verification still needed for autocomplete positioning and redo feel.
- Autocomplete currently uses script/Characters names only; no fuzzy matching beyond case-insensitive substring matching.

### 2026-05-08 — Codex — Script Writing-Mode Scene Rendering Unification

**Task:**
Audit and fix differences affecting writing-created scene rendering/selection versus imported scripts.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Removed the non-screenplay visual scene divider from the continuous script scene wrapper (`borderTop`) and reduced wrapper-only scene spacing to standard heading spacing (`24pt`) with no extra top padding.
- Added `script-heading-edit` to editable scene headings and included headings in the temporary selection bridge. This prevents editable headings from acting as separate selection barriers at scene boundaries during drag selection.
- Aligned blank writing-created scenes with imported scene defaults by adding `estimatedDuration: "30 min"` and `status: "Not Scheduled"` in `createBlankScene`.
- Left page break markers unchanged.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Manual browser verification is still needed for multi-scene selection/copy in both imported and writing-created scripts.

### 2026-05-08 — Codex — Script Writing-Mode Multi-Block Selection Fix

**Task:**
Allow mouse drag selection to span multiple editable screenplay blocks without adding autocomplete or redo.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Added a narrow selection bridge for Script writing/editor mode.
- On left-button drag starting inside a screenplay block, editable blocks are temporarily marked `contenteditable=false` so the browser can select across block boundaries as normal text.
- On mouseup, editability is restored.
- If the mouse action was a simple click/collapsed selection, focus and caret are restored to the clicked block.
- Existing typing safety, scoped undo, Cmd+1-7 shortcuts, Tab/Enter behavior, Up/Down movement, parenthetical behavior, and active-line indicator were preserved.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- This is a compatibility workaround for separate `contentEditable` hosts; selection across blocks depends on native browser selection behavior.
- Manual browser testing is needed to confirm copy text formatting across scene boundaries.

### 2026-05-08 — Codex — Emergency Script Writing-Mode Regression Fix

**Task:**
Stabilize severe writing-mode regressions: reverse-populated typing, parenthetical caret/reset issues, and unsafe undo that could make the editor appear empty. No autocomplete or redo added.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Restored editable screenplay blocks to DOM-owned content while focused:
  - removed React text children from focused `contentEditable` blocks
  - initialized/updated DOM text through refs only when the block is not focused
  - stopped writing `editingScenes` on every keystroke
- Keystrokes now update undo bookkeeping only; canonical `editingScenes` text is synced on blur or explicit structural/type changes.
- Parenthetical creation still inserts `()` and places caret between parentheses, without React re-rendering the focused block after the first typed character.
- Parenthetical cleanup on type changes updates both React state and the live DOM:
  - `()` → empty when changing away from Parenthetical
  - `(beat)` → `beat` when changing away from Parenthetical
- Replaced risky whole-script structural undo snapshots with scoped undo entries:
  - text undo affects one block
  - type-change undo restores one block
  - add-block undo removes the inserted block
  - delete-block undo restores the deleted block
- Redo deferred until undo is manually verified safe.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Manual browser verification is still needed for caret behavior and undo feel.
- Redo not implemented.
- Undo remains local to Script writing/editor mode.

### 2026-05-08 — Codex — Script Writing-Mode Safety/Regression Sprint

**Task:**
Fix writing-mode regressions around parenthetical caret placement, soft-wrap text preservation, parenthetical cleanup on type changes, and local undo. Autocomplete remains out of scope.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Parenthetical lines created by Tab on Character/Dialogue still initialize as `()`, but caret placement is now deferred through `requestAnimationFrame` after focus so it lands between the parentheses.
- Editable screenplay blocks now sync text into `editingScenes` on every input instead of waiting for blur. This prevents stale React state from re-rendering over newer contentEditable DOM text during unrelated renders or visual wrapping.
- Editable blocks now render plain text children instead of `dangerouslySetInnerHTML`, avoiding HTML reparse/reset behavior while typing.
- Parenthetical cleanup on type change:
  - `()` becomes an empty string when changed away from Parenthetical.
  - `(beat)` becomes `beat` when changed away from Parenthetical.
  - Parentheses are preserved when the line remains Parenthetical.
- Local script-writing undo now supports:
  - debounced text edit undo
  - element/type changes
  - add block
  - delete block
- Cmd+Z/Ctrl+Z are handled only in editable screenplay blocks.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Browser manual testing still needed for caret behavior under all browsers/fonts.
- Undo remains local to script writing/editor mode and does not include scene reorder/delete/create or global app undo.
- Character autocomplete remains out of scope.

### 2026-05-08 — Codex — Script Writing-Mode Keyboard Regression Fixes

**Task:**
Fix Phase 1/2 writing-mode regressions without adding autocomplete.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Fixed likely React #185 / maximum update-depth cause by making active-block focus updates idempotent. Focus/caret paths now reuse `setActiveBlockIfChanged`, avoiding repeated fresh-object state writes for the same active line.
- Fixed Tab on Character and Dialogue: it now creates/focuses the next line as Parenthetical instead of changing the current line's element type.
- Newly inserted Parenthetical lines from Tab now contain `()` and place the caret between the parentheses.
- Improved cross-block ArrowUp/ArrowDown placement: boundary movement now uses the current caret x-coordinate and chooses the closest offset on the first/last visual line of the target block instead of using raw character offset.
- Preserved Cmd+1-7 shortcuts, wrapped-line native Up/Down movement, Enter behavior, parenthetical shortcut behavior, and the active-line indicator.

**Verification:**
- Build: `npm run build` PASSED
- Browser runtime smoke test not run; no browser automation dependency is present in the repo.

**Deferred / Limitations:**
- Cross-block caret placement is x-coordinate based on browser range rectangles; exact behavior can vary slightly by browser font/caret reporting.
- Character autocomplete remains out of scope.

### 2026-05-08 — Codex — Script Writing-Mode Keyboard Sprint Phase 2B

**Task:**
Correct Phase 2 Up/Down navigation so wrapped paragraphs use native visual-line movement inside the same screenplay block and only cross blocks at true visual boundaries.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Replaced always-block-to-block ArrowUp/ArrowDown behavior with hybrid visual-line-aware handling.
- Added caret/range rectangle helpers to detect whether the caret is on the first or last visual line of the active editable block.
- ArrowUp/ArrowDown now allow native browser movement inside wrapped lines.
- Cross-block movement only occurs from the first visual line (ArrowUp) or last visual line (ArrowDown), preserving approximate character offset into the target block.
- Existing Cmd+1-7 shortcuts, Tab/Enter behavior, parenthetical auto-parens, active-line indicator, and left/right arrow behavior were preserved.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Cross-block horizontal preservation remains character-offset based, not pixel-column based.
- Visual-line detection depends on browser caret rectangle reporting from `Range#getBoundingClientRect()` / `getClientRects()`.

### 2026-05-08 — Codex — Script Writing-Mode Keyboard Sprint Phase 2

**Task:**
Implement word-processor-style Up/Down arrow navigation inside Script writing/editor mode without changing editor architecture.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- ArrowUp/ArrowDown are now intercepted only inside editable screenplay blocks.
- Native contentEditable paragraph navigation is prevented for Up/Down to avoid jumping to paragraph starts/ends.
- Added caret offset capture and adjacent editable block traversal in visual screenplay order.
- Moving Up/Down focuses the previous/next editable screenplay block and restores the closest character offset; shorter target lines naturally clamp to the end.
- Left/right arrow behavior, Cmd+1-7 shortcuts, Tab/Enter behavior, parenthetical auto-parens, and the active-line indicator were preserved.

**Verification:**
- Build: `npm run build` PASSED

**Deferred / Limitations:**
- Horizontal preservation is character-offset based, not pixel-column based.
- Up/Down traverses editable screenplay blocks, not individual wrapped visual lines inside one long block.

### 2026-05-08 — Codex — Script Writing-Mode Keyboard Sprint Phase 1

**Task:**
Implement core writing-mode element shortcuts and the active-line element indicator. Character autocomplete and arrow-key navigation were intentionally left out of scope.

**Files Changed:**
- `src/components/modules/Script/Script.js`

**Changes:**
- Added Cmd+1 through Cmd+7 shortcuts in editable script blocks:
  - Cmd+1 Scene Heading
  - Cmd+2 Action
  - Cmd+3 Character
  - Cmd+4 Parenthetical
  - Cmd+5 Dialogue
  - Cmd+6 Shot
  - Cmd+7 Transition
- Cmd+4 on an empty line now creates `()` and places the caret between the parentheses.
- Replaced the broad Tab element cycle with the requested foundation behavior:
  - Empty Action line → Character
  - Non-empty Action line → inserts/focuses next Character line
  - Character line → Parenthetical
  - Dialogue line → Parenthetical
  - Shot line → no-op
- Enter behavior now explicitly keeps Character → Dialogue and Dialogue → Action.
- Added a left-margin active-line indicator for editable script blocks only, using S/A/C/P/D/S/T labels.

**Verification:**
- Build: `npm run build` PASSED

**Deferred:**
- Character autocomplete/autopopulation.
- New arrow-key cursor/navigation work.
- Parenthetical wrapping behavior for non-empty lines; current behavior preserves existing text and only changes the element type.

### 2026-05-08 — Codex — Scene Chronology Provenance Phase 1

**Task:**
Add `metadata.originalScriptOrder` as frozen screenplay-position provenance without changing display/UI behavior.

**Files Changed:**
- `src/App.js`
- `src/components/modules/Script/Script.js`

**Changes:**
- Full FDX import now stamps `metadata.originalScriptOrder` alongside existing `metadata.originalSceneNumber` at both scene-finalization points.
- Single-scene FDX replace now preserves existing `metadata.originalScriptOrder`; fallback order is existing `originalScriptOrder`, then current `metadata.scriptOrder`, then current array index when available.
- Inserted blank scenes now stamp `metadata.originalScriptOrder` with the clamped insertion index while preserving `replacementLetter` behavior.

**Verification:**
- Build: `npm run build` PASSED
- No display logic changed; `getSceneOriginalNumberPresentation` and original-number rendering remain untouched.

**Deferred:**
- Add `getChronologyOffset` using `metadata.scriptOrder - metadata.originalScriptOrder`.
- Add fringe-case original-number/chronology display handling in a later phase.

### 2026-05-08 — Claude — Props Phase P2B: shoot-day bridge, script viewer pre-confirm, highlight, variant writes

**Task:**
Complete the next layer of mixed-format `prop.scenes` compatibility: shoot-day filtering, script viewer pre-confirm, script highlight check, and inline variant creation all now use UUID-aware helpers.

**Files Changed:**
- `src/components/modules/Props/Props.js` — 8 targeted edits

**Changes:**

*Shoot-day filtering bridge (4 sites):*
- Filter list (`dayHasProp` check): `item.scenes` → `getPropSceneNumbersForDisplay(item, scenes)` — resolves UUID refs to sceneNumbers before map lookup
- Filter count span: same
- Prop list render filter: same
- Prop detail shoot-date badges: `taggedItems[word]?.scenes || selectedProp.scenes` → `getPropSceneNumbersForDisplay(livePropData, scenes)` — props with UUID-only refs now show correct shoot-day badges

*Script viewer pre-confirm (openPropScriptViewer):*
- `savedScenes = (scenes || []).map(String)` / `savedScenes.includes(sceneNum)` → `savedSceneIds = getPropSceneIds(selectedProp, scenes)` / `savedSceneIds.includes(sceneId)` — pre-confirm now works for legacy integer refs, UUID refs, and mixed arrays

*Script highlight check:*
- `(selectedProp.scenes || []).map(String).includes(String(sceneNum))` → `(selectedProp.scenes || []).some((ref) => sceneMatchesPropSceneRef(scene, ref))` — highlights correctly for UUID-ref scenes in the script viewer preview

*Variant creation writes (2 sites):*
- Variant reuse path: dedup-then-append with `sceneNum` → `normalizePropScenesOnAdd(currentScenes, scene)` (dedup is built in; writes UUID)
- New variant creation path: `scenes: [scene.sceneNumber]` → `scenes: [scene.id]`; `instances: ['manual-...']` → `instances: ['${scene.id}-manual-...']` (UUID-anchored instance ID)

**Build:** passed

**Deferred to P2C:**
- `mergedScenes` write in script tagging path (`App.js:2308`) — `foundScenes` from `searchScript` returns sceneNumbers; changing this touches the core script-tagging pipeline
- Character scene merging (`propData.scenes` + `charObj.scenes.map(String)`) — `charObj.scenes` owned by Characters module
- `pendingPropScenes` ephemeral array — intentionally left as sceneNumbers (not persisted)
- `prop.sceneIds` field reconciliation vs `prop.scenes` post-migration

---

### 2026-05-08 — Claude — Props Phase P2A: dual-read prop.scenes compatibility layer

**Task:**
Make Props stable with mixed prop.scenes formats (legacy integer sceneNumbers, UUID scene.id refs, mixed arrays). Write-forward migration: new writes store UUIDs, old integer refs remain supported indefinitely.

**Files Changed:**
- `src/utils/propSceneRefs.js` — new helper file (7 exported functions)
- `src/components/modules/Props/Props.js` — 4 read-path fixes + sort replacement
- `src/App.js` — 2 write-path fixes + import

**New file — `src/utils/propSceneRefs.js`:**
- `isSceneIdRef(ref)` — UUID detection
- `sceneMatchesPropSceneRef(scene, ref)` — UUID → scene.id compare; integer → sceneNumber compare
- `resolvePropSceneRef(ref, scenes)` — resolves either format to `{ scene, index }`
- `getPropSceneIds(prop, scenes)` — returns `scene.id[]` for all resolved refs
- `getPropSceneNumbersForDisplay(prop, scenes)` — returns `sceneNumber[]` for display/navigation only
- `normalizePropScenesOnAdd(propScenes, scene)` — removes any matching ref, appends `scene.id` UUID
- `normalizePropScenesOnRemove(propScenes, scene)` — removes all refs matching scene

**Props.js read-path fixes:**
- `getPropsForScene`: `String(s) === String(sceneNumber)` → `sceneMatchesPropSceneRef(scene, ref)`
- Scene toggle assigned state: same sceneNumber comparison → `sceneMatchesPropSceneRef(scene, ref)`
- Scene viewer navigation: `scenes.findIndex((s) => s.sceneNumber === String(...))` → `resolvePropSceneRef(viewingRef, scenes)` (eliminates silent "Scene not found" on UUID refs)
- `getEarliestSceneNum` replaced with `getEarliestScriptOrder`: uses `metadata.scriptOrder` first, falls back to `sceneNumber`; `parseFloat(UUID)` = NaN is no longer a risk

**App.js write-path fixes:**
- `onAddPropToScene`: replaced manual `push(scene.sceneNumber)` + numeric sort with `normalizePropScenesOnAdd(item.scenes, scene)` — entries are now written as UUIDs
- `onRemovePropFromScene`: replaced `sceneNum !== sceneNumber` filter with `normalizePropScenesOnRemove(item.scenes, scene)` — handles both integer and UUID refs

**Build:** passed

**Deferred to P2B:**
- Shoot-day filtering (sceneShootDayMap keyed by sceneNumber; needs bridge via getPropSceneNumbersForDisplay)
- Script viewer pre-confirm (openPropScriptViewer savedScenes comparison)
- Script highlight check (selectedProp.scenes.map(String).includes(String(sceneNum)))
- Inline variant creation writes (scenes: [scene.sceneNumber] in script viewer batch)
- mergedScenes write in script tagging path (App.js:2308)
- character scene merging, pendingPropScenes, prop.sceneIds reconciliation

---

### 2026-05-08 — Claude — Stripboard UX refinement: consolidated header, sticky column header, per-column font-size overrides, badge rendering

**Task:**
Improve Stripboard header/layout and add per-column font-size controls.

**Files Changed:**
- `src/components/modules/Stripboard/Stripboard.js` — all changes below

**Changes:**

1. **Consolidated header:** Title changed to `STRIPBOARD` (removed "— Scene Breakdown"). Status/stat badges (Total, Unscheduled, Scheduled, Shot, Pickups, Reshoots, Removed) merged into the same flex header row as the title. No separate second header band. Toolbar (font size control + Columns button) remains in the right side of the same header row.

2. **Sticky column header:** Outer module wrapper changed from `overflowY: auto` scroll container to `display: flex; flexDirection: column; overflow: hidden`. A new inner `<div ref={scrollContainerRef}>` with `flex: 1; overflow: auto` wraps the column header and rows. Column header has `position: sticky; top: 0; zIndex: 2`. Both header and rows share the same scroll container so horizontal scroll is synchronized automatically. Scroll restoration via `sessionStorage` preserved on the new inner ref. Column resizing, column widths, and saved prefs behavior unchanged.

3. **Per-column font-size overrides:**
   - `columnFontSizes: {}` added to `defaultPrefs()` and `loadPrefs()` (no PREFS_KEY bump — gracefully defaults to `{}` if key missing from stored JSON).
   - `renderCell` now uses `const fs = (prefs.columnFontSizes || {})[colKey] ?? prefs.fontSize` — falls back to global for columns with no override.
   - Global font-size control unchanged; it does not override manually customized columns.
   - Helpers added: `adjustColumnFontSize(colKey, delta)`, `setColumnFontSizeAbsolute(colKey, size | null)`, `resetColumnWidth(colKey)`.
   - Columns with an override show a small `●` dot in the header label.

4. **Column-header right-click menu:**
   - `headerContextMenu` state: `null | { colKey, x, y }`.
   - `onContextMenu` on each header cell calls `e.preventDefault(); e.stopPropagation(); setHeaderContextMenu(...)` — suppresses browser menu, does NOT open scene modal.
   - Row `onContextMenu` unchanged — still opens scene heading modal.
   - Menu options: "↩ Use Global Font Size" (removes override), "Smaller" (step −1), "Normal (= global Npx)" (sets override to current global value), "Larger" (step +1), "Reset Column Width" (resizable columns only).
   - Closes on Escape (added to existing `onEsc` handler) and on backdrop click.

5. **Badge rendering preserved:** `renderItemBadges` helper unchanged. Cast, Props, Wardrobe, Makeup, Production Design continue to render as flex-wrap badge tokens.

**Verification:**
- Build: `npm run build` PASSED

---

### 2026-05-08 — Claude — Phase 3: Heading parser rewrite + buildHeadingString utility

**Task:**
Fix heading round-trip integrity: rewrite `parseSceneHeading`, add `buildHeadingString`, eliminate duplicated template literals, fix missing `modifier` in in-memory metadata.

**Files Changed:**
- `src/utils.js` — parser rewrite + new `buildHeadingString` export
- `src/App.js` — import `buildHeadingString`; replace 2× inline template literals; add `modifier` to both in-memory metadata spreads
- `src/components/modules/Script/Script.js` — import `buildHeadingString`; replace inline template in `onSave` callback
- `src/components/shared/SceneDetailModal.js` — import `buildHeadingString`; replace `previewHeading` template

**Summary:**

`parseSceneHeading` rewrite:
- Added `TIME_OF_DAY_SYNONYMS` map and `KNOWN_MODIFIERS` list as module-level constants
- Added `normalizeTimeOfDay(segment)` helper
- Parser now recognises `INT.`, `EXT.`, and `I/E` as valid intExt prefixes
- Primary path: splits on ` - ` separators → segment 0 = location, segment 1 = timeOfDay (if canonical), remaining = modifier
- When segment 1 is not a timeOfDay (e.g. "SAME TIME"), treats it as modifier and leaves timeOfDay empty
- Fallback path (no dashes): greedily extracts modifier keywords (longest first), then timeOfDay synonyms; remaining text is location
- Removed all `console.log` debug calls

`buildHeadingString({ intExt, location, timeOfDay, modifier })`:
- Canonical heading reconstruction; produces `INT. LOCATION - TIMEOFDAY - MODIFIER`
- Missing fields omitted cleanly — no double spaces, no stray dashes
- Exported from `utils.js` and used by App.js, Script.js, SceneDetailModal.js

Bug fix in `App.js` `updateStripboardScene`:
- Both in-memory metadata spreads (inside `setStripboardScenes` and `setScenes`) now include `modifier` — previously it was written to the DB but not to in-memory state, causing the modal to show stale modifier on re-open

**Round-trip test cases (all pass):**
- `INT. KITCHEN - DAY` ✓
- `EXT. STREET - NIGHT` ✓
- `I/E CAR - DAWN` ✓
- `INT. BEDROOM - NIGHT - CONTINUOUS` ✓
- `EXT. FIELD - DUSK - LATER` ✓
- `INT. OFFICE - DAY - MOMENTS LATER` ✓
- `INT. HOUSE - SAME TIME` (no timeOfDay, modifier="SAME TIME") ✓
- `INT. HALLWAY` (no timeOfDay, no modifier) ✓

**Remaining edge cases:**
- Locations containing time-of-day words (e.g. "NIGHT CLUB") will be mishandled in the space-separated fallback path — but are correct in the dash-separated primary path (since buildHeadingString always produces dashes). Only affects legacy headings imported without dashes.
- Modifier field is not sanitised — if user types a freeform modifier not in KNOWN_MODIFIERS, it round-trips via the heading string correctly but is not matched in the fallback extraction path.

**Verification:**
- Build: `npm run build` PASSED

---

### 2026-05-08 — Claude — Phase 2: Shared SceneDetailModal + Stripboard/Script integration

**Task:**
Create a shared `SceneDetailModal` component used by both Script and Stripboard, consolidating the Stripboard Edit Heading modal and the Script Scene Detail modal into one reusable component.

**Files Changed:**
- `src/components/shared/SceneDetailModal.js` — new file
- `src/components/modules/Stripboard/Stripboard.js` — import + replace local heading modal
- `src/components/modules/Script/Script.js` — import + add state/effect + replace inline modal

**Summary:**

SceneDetailModal props API:
- Required: `scene`, `displayLabel`, `onClose`
- Heading editing (all three together or omit for read-only): `headingForm`, `onHeadingFormChange`, `onSave`
- Optional actions: `isViewOnly`, `onDelete`, `onInsertBefore`, `disableInsertBefore`, `onInsertAfter`, `onViewScript`
- Optional data: `tagged`, `sceneCharacters`, `sceneMoodImages`
- `zIndex` (default 21800)

Stripboard wiring:
- Local `headingForm`/`setHeadingForm` state unchanged; `onHeadingFormChange` merges updates via spread
- `onSave` calls existing `onUpdateScene(idx, "heading", form)` path — no persistence change
- `onViewScript` closes modal then calls existing `handleSceneClick` — surfaces the script popup
- No delete/insert/view-only wired (not relevant for Stripboard Phase 2)

Script wiring:
- Added `scriptHeadingForm` state (initialized `{ intExt: "INT.", location: "", timeOfDay: "DAY", modifier: "" }`)
- Added `useEffect` watching `editingSceneIndex` to sync form fields from `scene.metadata` on open (excludes `scenes` dependency to preserve in-progress edits)
- `onSave` reconstructs heading string from form fields, calls `handleSceneHeadingChange(idx, fullHeading)` — same DB path as direct contentEditable heading edit
- All existing Script modal sections preserved: characters, location, props, wardrobe, makeup, production design, other tagged items, mood images, delete/insert before/after actions

**Deferred (Phase 3):**
- `parseSceneHeading` limitations: modifier not round-tripped; `I/E` intExt not parsed back from heading string. Modal saves correct structured fields; direct contentEditable re-edit afterward will overwrite modifier with `""`.
- `buildHeadingString` formula duplicated in App.js (×2) and now also in Script.js `onSave` callback — consolidation deferred.

**Verification:**
- Build: `npm run build` PASSED

### 2026-05-08 — Claude — WritingTimeline Custom Color Fix

**Task:**
Fix WritingTimeline so custom scene colors fill the entire timeline block, production statuses are never applied to the timeline, and custom color dot/circle indicators are removed.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx

**Summary:**
Three surgical edits to WritingTimeline.jsx:
1. `getSceneTimelineColor` (line ~127): Removed the `custom` field from all return values. Previously, `isCurrent` returned `custom: custom || null` (causing a dot on current+custom scenes) and the custom-color branch returned `{ ...custom, custom }` (causing a redundant dot since the block was already filled). Now all paths return only `{ fill, text }`.
2. Removed the custom color dot `<span>` from the zoom lens (render section, ~line 910). The span was gated on `sceneColor.custom` which is now always falsy/absent.
3. Removed the custom color dot `<span>` from the main timeline block (render section, ~line 1031). Same gate.

Production statuses were already absent from `getSceneTimelineColor` — it reads only `scene.metadata.color`. No status logic was introduced or modified. Inserted scene orange top-border (`3px solid #f59e0b`) and current-selected blue fill (`#316AC5`) are both preserved unchanged.

**Verification:**
- Build: `npm run build` PASSED
- Tests: not run
- Manual testing: not run

**Remaining Issues:**
Manual browser verification needed:
- Custom-color scene block fills fully with the custom color, no dot
- Status-only scene remains gray
- Current-selected scene remains blue, readable
- Inserted scene orange top-border still visible
- No color circles anywhere in the timeline

**Notes for Next Agent:**
`sceneTimelineColors` (the local fill/text map for custom colors) is still present in WritingTimeline.jsx but `getSceneTimelineColor` no longer returns a `custom` sub-object. If custom dots are ever re-introduced, they would need to come from a new field on the return object. `SCENE_CUSTOM_COLORS` in `scenePresentation.js` is the canonical color registry — consider referencing it from `getSceneTimelineColor` in a future consolidation pass rather than maintaining a parallel `sceneTimelineColors` constant.


### 2026-05-07 — Claude — Insert Scene UX shell

**Task:**
Add Insert Before / Insert After buttons to Scene Detail Modal. Create `handleInsertScene(insertAtIndex)` that reuses the existing scene creation infrastructure to insert a blank scene at any array position and stamp it with `metadata.replacementLetter: "A"`. No derived numbering, no insertedAfterSceneId, no auto-sequence logic.

**Files Changed:**
- src/components/modules/Script/Script.js only

**Summary:**
- `handleInsertScene(insertAtIndex)` added after `handleCreateSceneAfter`. Mirrors its state-update pattern: `setScenes`, `syncLocalStripboardFromScenes`, `setCurrentIndex`, `setCurrentSceneNumber`, `setEditingScenes`, `setOriginalContent`, `setIsEditMode(true)`, `saveScenesDatabase`. Uses `createBlankScene` + `normalizeSceneIds`. Adds `metadata.replacementLetter: "A"` to the new scene. Handles insertAtIndex=0 (prepend) correctly.
- `onInsertScene = null` added to `SceneList` props signature.
- Modal footer updated: Insert Before and Insert After buttons added between Delete Scene and Close. Each captures `editingScene` index before closing, then calls `onInsertScene(idx)` or `onInsertScene(idx + 1)`.
- Helper text added to the coming-soon placeholder: "Inserted scenes will receive screenplay revision numbering in a later phase."
- `SceneList` call site updated: `onInsertScene={!isViewOnly ? handleInsertScene : null}`.
- Parse: PASS, paren diff -7 (pre-existing).

**Insert path reused:** Same as `handleCreateSceneAfter` — `createBlankScene` → `normalizeSceneIds` → `setScenes` → `syncLocalStripboardFromScenes` → `setCurrentIndex`/`setCurrentSceneNumber` → `setEditingScenes` → `setOriginalContent` → `setIsEditMode(true)` → `saveScenesDatabase` → `scrollIntoView`.

**Risk notes:**
- Insert Before/After uses same save path as all other scene creation. Stripboard sync is `syncLocalStripboardFromScenes` — same as add/delete/reorder.
- `replacementLetter: "A"` is permanent metadata on the inserted scene. Reflow preserves `metadata` intact (always has). Delete works normally — deletes by UUID.
- Reorder after insert: drag-reorder calls `reflowScenesSequentially` which preserves `metadata` — letter survives reorder.
- Reload persistence: `saveScenesDatabase` writes full metadata blob. Load sort uses replacementLetter as tie-break. Round-trips correctly.
- Timeline sync: `setCurrentSceneNumber` + `setCurrentIndex` update timeline selection. `sceneRefs.current[clampedIdx]?.scrollIntoView` scrolls screenplay. Both match `handleAddScene` pattern.

---

### 2026-05-07 — Claude — Three focused fixes: scroll highlight, orange colors, read-only scene number

**Task 1 — Fix current-scene scroll highlight**
Replaced IntersectionObserver (which fired only on changed entries, causing the lowest newly-visible scene to win) with a RAF-throttled scroll event listener on `containerRef.current`. Algorithm: walk `sceneRefs`, find the last scene whose heading top is ≤ 50px below the container top, call `setCurrentSceneNumber`. Runs once on mount/scene-change to sync initial state. Does NOT call `setCurrentIndex` (consistent with prior behavior). Does NOT affect click-to-scroll, timeline, presence, drag/reorder, or persistence. `observerRef` declaration left in place (harmless unused ref).

**Task 2 — Replace red with orange for inserted-scene highlights**
Updated Phase A visual palette across all 4 files:
- Background: `#fff5f5` → `#fff7ed`
- Primary border/accent: `#e53935` → `#f59e0b`; heading border `#e8a0a0` → `#fbbf24`
- Text: `#c62828` → `#b45309`
- Timeline lens: `#e57373` → `#f59e0b` (amber); main block `#ef9a9a` → `#fdba74` (peach); label `#7b1a1a` → `#92400e`
- StripboardSchedule scheduled card border: `#e57373` → `#f59e0b`

**Task 3 — Scene Number read-only in Scene Detail Modal**
Replaced the Scene Number `<input>` with a read-only display `<div>` showing `{newSceneNumber}`. Updated help text to "Auto-assigned. Use Insert Scene to add replacement scenes." Moved `autoFocus` and `Enter` key handler to the Replacement Letter input. `onSceneNumberChange` and `saveSceneNumber` are untouched and dormant — no architecture removed.

**Files Changed:**
- src/components/modules/Script/Script.js
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/components/modules/Stripboard/Stripboard.js
- src/components/modules/StripboardSchedule/StripboardSchedule.js

**Verification:** Parse PASS all 4 files. Paren diffs: Script.js -7 (pre-existing), WritingTimeline.jsx 0, Stripboard.js +4 (pre-existing), StripboardSchedule.js +3 (pre-existing).

---

### 2026-05-07 — Claude — Phase A: Inserted/Replacement Scene Visual Highlight

**Task:**
Add subtle visual highlighting for scenes with `metadata.replacementLetter` set (treated as inserted/replacement scenes). Visual only — no reflow, numbering, insert workflow, or persistence changes.

**Files Changed:**
- src/components/modules/Script/Script.js
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/components/modules/Stripboard/Stripboard.js
- src/components/modules/StripboardSchedule/StripboardSchedule.js

**Summary:**
- Definition used everywhere: `isInserted = Boolean(scene.metadata?.replacementLetter)`.
- Scene list rows: soft red/pink background `#fff5f5`, red left border `3px solid #e53935` when not current-selected; padded scene number label `#c62828` when inserted.
- Screenplay heading: heading flex wrapper gets `borderLeft: "3px solid #e8a0a0"` + `paddingLeft: "6px"` for inserted scenes; no layout shift in non-inserted scenes.
- Timeline popup (scene detail card): small inline `INS` badge after scene label in the h2 when inserted.
- WritingTimeline.jsx zoom lens: background `#e57373` (vs grey), white label text.
- WritingTimeline.jsx main block: background `#ef9a9a` (vs grey), dark-red label text `#7b1a1a`.
- Stripboard.js row: `borderLeft: "3px solid #e53935"` on each scene row when inserted. Case "scene" cell wrapped in block scope, shows `{sceneNumber}{replacementLetter}` with `#c62828` color.
- StripboardSchedule.js available-scenes list: React key fixed from `scene.sceneNumber` → `scene.id || \`${scene.sceneNumber}-${index}\``; `borderLeft: "3px solid #e53935"` when inserted and unscheduled; `replacementLetter` added to scene label.
- StripboardSchedule.js scheduled scene card: `borderLeft: "3px solid #e57373"` when inserted; `replacementLetter` added to scene label.
- Behavior unchanged: all selection, drag/reorder, scheduling, persistence, reflow logic untouched.

**Verification:**
- Parse: PASS on all 4 files
- Paren balance: Script.js -7 (pre-existing), WritingTimeline.jsx 0, Stripboard.js +4 (pre-existing), StripboardSchedule.js +3 (pre-existing) — all pre-existing, unchanged by this sprint

**Notes for Next Agent:**
- Phase B (display-label derivation from predecessor UUID) and Phase C (insert scene function) are NOT started.
- `isInserted` is computed inline at each render site — no helper function added. When Phase B introduces `getSceneDisplayLabel(scene, scenes)`, these inline checks can be refactored if desired.
- The screenplay heading border adds 6px left padding to the heading wrapper; if Phase B changes the heading content, verify no visual regression.

---

### 2026-05-07 — Claude — Follow-up Display/Key Patch Sprint

**Task:**
Two micro-fixes after Phase 1+2 implementation:
1. Scene selector dropdown: show "004A" format (was missing replacementLetter).
2. React key fallback tightening: replace `scene.id || scene.sceneNumber` fallbacks with index-qualified `scene.id || \`${scene.sceneNumber}-${index}\`` in all map callbacks that have access to index.

**Files Changed:**
- src/components/modules/Script/Script.js

**Summary:**
- Scene selector dropdown option (~line 3310): added `{scene.metadata?.replacementLetter || ""}` after padded sceneNumber so options display "004A – Heading".
- Line ~178 (SceneList items map): `key={scene.id || scene.sceneNumber || index}` → `key={scene.id || \`${scene.sceneNumber}-${index}\`}`.
- Line ~1031 (revision viewer scenes map): callback `scene =>` → `(scene, si) =>`, key `scene.id || scene.sceneNumber` → `scene.id || \`${scene.sceneNumber}-${si}\``.
- Line ~1079 (ContinuousScript scenesToRender map, `si` already present): key `` `scene-${scene.id || scene.sceneNumber}` `` → `` `scene-${scene.id || `${scene.sceneNumber}-${si}`}` ``.

**Verification:**
- Parse: PASS
- Paren balance: diff=-7 (pre-existing, unchanged)

---

### 2026-05-07 — Claude — Phase 1+2: Replacement Letter Metadata + Display Labels

**Task:**
Phase 1: Move replacement scene letters out of sceneNumber into metadata.replacementLetter. Add getSceneDisplayLabel helper. Update all visible label rendering. Add Replacement Letter field to Scene Detail Modal. Add handleUpdateSceneMetadataField handler with change-detection on save.
Phase 2: Fix database.js load sort to use replacementLetter as a tie-break when integer parts match.
Key audit: Replace sceneNumber-only React key in revision viewer (line ~1004) with UUID-safe key.

**Files Changed:**
- src/components/modules/Script/Script.js
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/services/database.js

**Summary:**
- Added `getSceneDisplayLabel(scene)` pure function at module scope in Script.js — returns `${sceneNumber}${metadata.replacementLetter || ""}`.
- All user-visible scene labels updated to use helper: scene list padded number, Scene Detail modal header, ContinuousScript h2 (both edit and view modes), onBlur heading extraction, revision viewer heading, Beat Detail linked scene label, timeline popup scene header.
- Scene Detail Modal: split "SCENE NUMBER / LABEL" into two fields — SCENE NUMBER (integer, existing onSceneNumberChange path) and REPLACEMENT LETTER (new, A–Z only, maxLength 1, writes via onUpdateSceneMetadata prop).
- saveSceneNumber() now has change-detection: onSceneNumberChange called only if number changed; onUpdateSceneMetadata called only if letter changed. Neither fires unnecessarily.
- New `handleUpdateSceneMetadataField(sceneIndex, updates)` in Script main — merges partial updates into scene.metadata and saves via existing saveScenesDatabase path. No reflow, no reorder.
- SceneList call site: added `onUpdateSceneMetadata={!isViewOnly ? handleUpdateSceneMetadataField : null}`.
- WritingTimeline.jsx: zoom-lens label, tooltip title, and scene block inner label updated with inline letter suffix expression.
- database.js: load sort now uses replacementLetter as secondary tie-break when integer scene numbers match (`"" < "A" < "B"` via localeCompare).
- Key fix: revision viewer key changed from `key={scene.sceneNumber}` to `key={scene.id || scene.sceneNumber}` — prevents React key collisions for scenes sharing same integer sceneNumber.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Parse: PASS on all three files
- Brace/paren balance: Script.js parens diff=-7 (pre-existing unchanged), braces 0; WritingTimeline.jsx 0/0; database.js 0/0

**Remaining Issues:**
- Manual browser verification needed: open Scene Detail → set Replacement Letter "A" → Save → scene list should show "004A", screenplay heading should show "4A: INT. LOCATION - DAY", Beat Detail should show "Linked Scene: 4A — ...".
- After drag reorder, sceneNumber integer changes (reflow) but replacementLetter persists in metadata — display label will update to reflect new base number + preserved letter. This is expected Phase 1 behavior; Phase 3 would fix the base-number anchoring.
- Existing scenes with letters embedded in sceneNumber (e.g. sceneNumber = "4A", old format) still display via getSceneDisplayLabel correctly since it reads sceneNumber as-is plus any metadata.replacementLetter.

**Notes for Next Agent:**
- `getSceneDisplayLabel` is at module scope in Script.js (before SceneList). Do NOT move it inside a component.
- WritingTimeline.jsx uses inline expression rather than importing the helper — intentional to avoid adding an import.
- `handleUpdateSceneMetadataField` takes a partial updates object — do not revert to a letter-specific signature.
- Phase 3 (reflow preservation of replacement letters) is NOT implemented and must not be started without explicit approval.

### 2026-05-07 — Claude — Scene Detail Modal v1

**Task:**
Implement Scene Detail Modal v1. Double-clicking a scene opens a modal with scene heading display, scene number/label editing (preserved from old behavior), linked beat indicator, and future metadata placeholder. Escape and backdrop-click close the modal.

**Files Changed:**
- src/components/modules/Script/Script.js

**Summary:**
All changes are localized to the `SceneList` sub-component (top of Script.js, lines ~52–220).

- Added `useEffect` in `SceneList` that listens for Escape and calls `setEditingScene(null)` when `editingScene !== null`. Same pattern as Beat Detail modal Escape handler.
- Replaced the old minimal "Edit Scene Number" dialog (plain h3 + p + input + two buttons) with a properly structured Scene Detail modal matching the Beat Detail modal visual language:
  - Header: "Scene Detail" title + scene number subtitle + × close button
  - Body: HEADING section (read-only, Courier monospace, uppercase display); SCENE NUMBER / LABEL input (same `newSceneNumber` state and `saveSceneNumber()` handler — behavior unchanged, letters like 24A still work); source beat indicator if `scene.metadata?.sourceBeatId` is set; future metadata dashed placeholder
  - Footer: Cancel + Save buttons
- z-index: 21800/21801 (below Beat Detail at 21900/21901)
- `onDoubleClick` at line 160, `editingScene` state, `newSceneNumber` state, `saveSceneNumber()` handler, and `onSceneNumberChange` call are all completely unchanged.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Parse: `@babel/parser` JSX parse → PASS
- Brace/paren balance: parens diff=-7 (pre-existing, unchanged), braces balanced

**Remaining Issues:**
- Manual browser verification needed: double-click a scene → modal opens with heading + editable number; Enter/Save persists; Escape/×/backdrop closes; "B" link indicator visible on converted scenes.
- Scene heading text is read-only in this modal (editing still happens in the screenplay body) — this is intentional for v1.

**Notes for Next Agent:**
- `SceneList` component is lines ~52–220. All Scene Detail modal code is within that range — do not move it outside `SceneList` without explicit request.
- `editingScene` is a zero-based index into `scenes`. `scenes[editingScene]?.heading` and `.metadata?.sourceBeatId` are safe null-guarded accesses.
- The old "Edit Scene Number" dialog is gone — do not reintroduce it.
- Beat Detail uses z-index 21900/21901; Scene Detail uses 21800/21801 — keep this ordering.

### 2026-05-07 — Claude — Convert Beat to Scene Cleanup (Blank Scene + Linked Scene Label)

**Task:**
Three-part cleanup for Convert Beat to Scene:
1. Beat Detail modal: replace raw UUID display with human-readable linked scene label.
2. Conversion: create a blank screenplay scene instead of copying beat title/description into content.
3. Preserve all existing linkage (beat.convertedSceneId, scene.metadata.sourceBeatId).

**Files Changed:**
- src/components/modules/Script/Script.js

**Summary:**
- `handleConvertBeatToScene` (line ~2033): Removed the explicit `content` override that was copying `beat.title` and `beat.description` into the new scene's Action blocks. The spread of `createBlankScene()` now provides the default empty content `[{ type: "Action", text: "", formatting: null }]`. All linkage fields (`sourceBeatId`, `convertedSceneId`) are unchanged.
- Beat Detail modal (line ~2899): Replaced raw `{selectedBeatDetail.convertedSceneId}` text with an IIFE that looks up the scene by ID in `scenes` and renders `Linked Scene: {sceneNumber} — {heading}`. Falls back to "Linked Scene: (not found in current script)" if the scene can't be matched.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Parse: `@babel/parser` JSX parse → PASS
- Brace/paren balance: parens diff=-7 (pre-existing, unchanged), braces balanced

**Remaining Issues:**
- Manual browser verification needed: converted scene should be blank (empty Action block, default heading "INT. LOCATION - DAY"); Beat Detail should show "Linked Scene: N — INT. LOCATION - DAY".
- Existing converted beats with copied text are not retroactively cleaned up — only new conversions go forward as blank scenes.

**Notes for Next Agent:**
- `createBlankScene` (line ~1642) is the canonical blank scene factory — do not re-add content population to `handleConvertBeatToScene`.
- The linked scene lookup in the Beat Detail modal reads from `scenes` (not `editingScenes`); this is intentional since `scenes` is always updated after save.

### 2026-05-05 — Claude — Compact Timelines, Escape-to-Close Beat Modal, Source Beat Marker

**Task:**
Three-part focused UI sprint:
1. Compact both timeline containers (~2px between ruler bottom and scrollbar; smaller gutter).
2. Escape key closes the Beat Detail modal.
3. Show a small clickable "B" marker on scene headings that were converted from beats; clicking it opens the originating Beat Detail modal.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/components/modules/Script/Script.js

**Summary:**
- `WritingTimeline.jsx`: Changed `SCENE_LAYER_HEIGHT` from 60 → 47 and `SCROLLBAR_GUTTER_PX` from 14 → 10 to reduce vertical bulk in both timeline containers.
- `Script.js`: Added a `useEffect` that listens for Escape and calls `setSelectedBeatDetailId(null)` whenever `selectedBeatDetailId` is set.
- `Script.js`: Added `onBeatOpen` prop to `ContinuousScript` function signature.
- `Script.js`: Wrapped the scene heading conditional (`isEditMode ? h2 : h2`) in a flex row div; moved `marginBottom` from individual `h2` elements to the wrapper; added a conditional "B" button after the heading that appears only when `scene.metadata?.sourceBeatId` exists and `onBeatOpen` is provided. Button is outside the `h2` and does not modify screenplay text.
- `Script.js`: Passed `onBeatOpen={setSelectedBeatDetailId}` to the `ContinuousScript` call site.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Brace/paren balance: PASS for WritingTimeline.jsx; Script.js shows paren imbalance (diff -7) but this is pre-existing and unchanged by this session's edits (confirmed via `git show HEAD` diff).

**Remaining Issues:**
- Manual browser review needed: compact timeline height feel, scrollbar gutter appearance, Escape closing Beat Detail, "B" button visibility on converted scenes.
- Pre-existing Script.js paren imbalance (7 extra closes) was present before this session — does not affect runtime but should be investigated separately.

**Notes for Next Agent:**
- The "B" button reads `scene.metadata?.sourceBeatId` — only appears for converted beats. It does not alter screenplay text.
- Do not move the "B" button inside the `h2` (which is `contentEditable` in edit mode).
- `SCENE_LAYER_HEIGHT = 47` and `SCROLLBAR_GUTTER_PX = 10` are the new values in WritingTimeline.jsx. Do not revert to 60/14.

### 2026-05-05 — Claude — Independent Beat/Scene Scroll Containers (Architecture Fix)

**Task:**
Make Scenes Zoom and Beat Zoom truly independent by giving each timeline track its own scroll/scale container. Remove all `safeBeatTrackZoom / timelineZoom` compensation formulas.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx (complete rewrite of JSX structure; logic unchanged)

**Summary:**
Root cause: beat track lived inside `timelineBarRef` (`width: timelineZoom * 100%`), so it always appeared proportionally narrower than the scene track when scene zoom > 1x, regardless of the compensation formula.

Fix: split into two independent scroll containers:
- `timelineScrollRef` + `timelineBarRef`: scene track, scene ruler, zoom lens, scene blocks. Width = `timelineZoom * 100%`. Drag/snap math unchanged — still reads `timelineBarRef.getBoundingClientRect()`.
- New `beatScrollRef` + beat inner div: beat track, beat markers, act spans, beat ruler. Width = `safeBeatTrackZoom * 100%`. No reference to `timelineZoom`.

Constants removed: `BEAT_TRACK_TOP_PX`, `BEAT_RULER_TOP_PX`, `TIMELINE_BAR_HEIGHT`.
Constants added: `SCENE_LAYER_HEIGHT = 60`, `BEAT_MARKER_OVERHANG_PX = 18`, `BEAT_LAYER_HEIGHT = 64`.

Beat track top within beat layer = `BEAT_MARKER_OVERHANG_PX` (18px) to give headroom for alternating marker pins that extend above the track. Beat ruler top = 52px (18 + 32 + 2).

`beatScrollRef` added as a third ref. All drag logic, snapping, ripple, and scene block rendering are untouched.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Brace/paren balance: pass

**Remaining Issues:**
Manual browser verification needed:
- Scenes Zoom must not affect beat track width, beat ruler spacing, or beat marker positions.
- Beat Zoom must not affect scene track width or scene ruler spacing.
- Both scroll containers scroll independently.
- Beat markers and right-click color menu remain functional.
- Act spans render correctly.
- Scene drag/snapping/ripple unchanged.

**Notes for Next Agent:**
The beat layer is now a sibling of the scene layer, not a child. Do NOT move the beat track back inside `timelineBarRef`. Do NOT re-introduce `safeBeatTrackZoom / timelineZoom` compensation anywhere. If linked scrolling is added later, wire it through a scroll sync effect on `beatScrollRef` and `timelineScrollRef` without changing their independent width formulas.

### 2026-05-08 — Codex — Script Module Right-Click Completion

**Task:**
Continue Claude's partial Script-module right-click normalization and finish the missing SceneList, BeatsList, and screenplay viewer context-menu behavior.

**Files Changed:**
- src/components/modules/Script/Script.js
- HANDOFF.md
- AI_TASK_LOG.md

**Summary:**
Verified the build passed before editing. SceneList already had partial context-menu state/JSX; wired Insert Before/After to the existing Insert Source modal path and allowed Insert Before on the first scene. BeatsList already had context-menu state and row handlers; added the missing menu JSX for Open Details, Convert to Scene, Delete Beat, and disabled Change Color. ContinuousScript now suppresses the browser menu in non-edit view, opens the tagging menu for selected text, and falls back to the clicked word via word-span data attributes. Edit/contentEditable mode keeps native context-menu behavior.

**Verification:**
- Build: `npm run build` passed before and after patching
- Tests: not run
- Manual testing: not run
- Transform: covered by production build

**Remaining Issues:**
Manual browser verification is still needed for all right-click interactions. Double-click tagging/editing remains in place as legacy behavior. A shared app-wide context menu system is still deferred.

**Notes for Next Agent:**
Do not replace module-specific menus globally yet. The Script viewer word fallback uses `data-word`, `data-clean-word`, `data-scene-index`, `data-block-index`, and `data-word-index` on rendered word spans.

### 2026-05-08 — Codex — Multi-Word Script Tagging

**Task:**
Implement true multi-word tagging from screenplay selections and align Script/Props phrase matching around the shared script search utility.

**Files Changed:**
- src/utils/scriptSearch.js
- src/App.js
- src/components/modules/Script/Script.js
- src/components/modules/Props/Props.js
- AI_TASK_LOG.md
- HANDOFF.md

**Summary:**
Extended the shared script search utility to return UUID-based phrase groups, normalized phrase keys, exact visible phrase text, scene IDs, scene numbers, and Props-compatible grouped instances. Updated App tagging so selected phrases like "cigarette holder" create/find one phrase tag and refresh all matched phrase word instances. Updated Script highlighting to use phrase group metadata so all words in a phrase highlight as one unit, with longer phrase tags winning overlaps. Updated Props search/viewer paths to use UUID instance IDs from the shared utility instead of positional instance IDs.

**Verification:**
- Build: `npm run build` passed
- Tests: not run
- Manual testing: not run
- Transform: covered by production build

**Remaining Issues:**
Manual browser verification is still needed for phrase tagging, overlapping phrase behavior, phrase untagging, and Props viewer phrase review.

**Notes for Next Agent:**
Tag keys for new phrases are normalized stemmed words joined by spaces. Legacy phrase keys without spaces are still accepted when already present.

### 2026-05-08 — Codex — Script Tagging UX Stabilization

**Task:**
Fix Script-only tagging UX regressions: highlight refresh after inserting scenes and missing Remove Tag in the right-click menu.

**Files Changed:**
- src/components/modules/Script/Script.js
- src/App.js
- AI_TASK_LOG.md
- HANDOFF.md

**Summary:**
Changed `ContinuousScript` instance lookup to use the same active scene array as rendering (`editingScenes` in edit mode, otherwise `scenes`) so insert operations do not leave highlights mapped against a stale scene array. Added tagged-context detection to the Script right-click menu and restored Remove Tag for tagged words/phrases. Added an app-level untag fallback for selected phrase removal when no exact word coordinates are available.

**Verification:**
- Build: `npm run build` passed
- Tests: not run
- Manual testing: not run
- Transform: covered by production build

**Remaining Issues:**
Manual browser verification is still needed for remove-tag persistence and insert-before highlight stability. Props remains explicitly out of scope and still needs a separate repair sprint.

**Notes for Next Agent:**
Do not repair Props in a Script UX sprint. For Script right-click removal, clicked words carry exact coordinates; selected phrases may remove the whole tag when coordinates are unavailable.

### 2026-05-05 — Claude — Ruler Tick Correction (labeled = number, unlabeled = compact tick)

**Task:**
Restore compact tick marks for unlabeled ruler positions after the previous pass removed them entirely. Labeled positions should show only the page number; unlabeled positions should show only a small tick bar.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx

**Summary:**
Removed `if (!tick.showLabel) return null` early-exit from both the scene ruler and beat ruler. Replaced it with a branch: unlabeled ticks render a 2–3px tall bar (1px wide, no number); labeled ticks render the page number only (no bar). Heights: isFive = 3px, others = 2px. Colors match existing ruler palette. Independent zoom fix from the previous pass is untouched.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Brace/paren balance: pass

**Remaining Issues:**
Manual browser verification needed: labeled positions should show number only; unlabeled positions should show a compact bar only; rulers should remain compact.

**Notes for Next Agent:**
Both rulers now use an explicit `if (!tick.showLabel)` branch — do not collapse back to a single render path that shows both bar and number.

### 2026-05-05 — Claude — Independent Beat/Scene Zoom + Compact Rulers

**Task:**
Make Scenes Zoom and Beat Zoom fully independent. Compact both rulers by removing tick bar divs. Rename "Timeline Zoom" label to "Scenes Zoom".

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx

**Summary:**
- Renamed "Timeline Zoom" → "Scenes Zoom" in the toolbar label.
- Beat track outer div: changed `right: 0` to `width: (safeBeatTrackZoom / timelineZoom) * 100%`. This is the root fix — the yellow background no longer stretches with scene zoom.
- Beat track inner div: simplified to `width: "100%"` since the parent is now correctly sized (no more double-compensation).
- Beat ruler container: reduced from 18px to 12px height.
- Scene ruler and beat ruler: removed the tick bar `<div>` from each tick. Non-labeled ticks are now skipped entirely (`if (!tick.showLabel) return null`). Page numbers render directly as the position marker.
- Snapping math, drag handlers, scene blocks, beat markers, right-click color menu, act spans — all untouched.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Brace/paren balance: pass (node balance check)

**Remaining Issues:**
Manual browser verification needed:
- Scenes Zoom should not affect beat track width or ruler spacing at any zoom level.
- Beat Zoom should not affect scene track width or ruler spacing.
- Rulers should show page numbers without tick bars; spacing should feel readable at default and 2x zoom.
- Beat marker click and right-click color menu should be unaffected.

**Notes for Next Agent:**
The beat track outer div is now explicitly sized via `width` formula. The inner div is `width: 100%`. Do not re-introduce `right: 0` on the beat track outer div — that was the source of the coupling.

### YYYY-MM-DD — Agent Name — Short Task Title

**Task:**
Describe what the agent was asked to do.

**Files Changed:**
- file/path/example.tsx
- file/path/example.css

**Summary:**
Briefly explain what changed.

**Verification:**
- Build: pass/fail/not run
- Tests: pass/fail/not run
- Manual testing: describe result

**Remaining Issues:**
List anything unresolved.

**Notes for Next Agent:**
Explain what the next agent should know before continuing.

### 2026-05-07 — ChatGPT — Created Multi-Agent Coordination Files

**Task:**
Create project coordination structure for alternating between Codex and Claude.

**Files Changed:**
- AGENTS.md
- HANDOFF.md
- AI_TASK_LOG.md

**Summary:**
Added rules for AI coding agents, a shared project handoff file, and a task log to prevent Claude and Codex from duplicating or reversing each other’s work.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not applicable

**Remaining Issues:**
The handoff should be updated after each agent session.

**Notes for Next Agent:**
Read AGENTS.md, HANDOFF.md, and AI_TASK_LOG.md before making any code changes. ChatGPT is coordinating the workflow.

### 2026-05-07 — Codex — Scene Delete Reflow Fix

**Task:**
Fix scene delete behavior so remaining scenes renumber and reflow consistently with scene-list reorder.

**Files Changed:**
- src/components/modules/Script/Script.js

**Summary:**
Added `reflowScenesSequentially` and `buildOriginalContentMap`, then updated delete/reorder paths to share sequential renumbering, continuous `timelineStartPage` rebuilds, stripboard sync, and persistence flow.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/components/modules/Script/Script.js`

**Remaining Issues:**
Manual browser verification is still needed for delete Scene 1, delete middle scene, reload persistence, and stripboard/timeline visual updates.

**Notes for Next Agent:**
Scene IDs and `metadata.originalSceneNumber` should remain stable during reorder/delete. Do not touch snapping or DB/RPC code unless explicitly requested.

### 2026-05-07 — Codex — Beat Timeline Marker Shape Refinement

**Task:**
Refine beat timeline marker styling so markers read as narrow vertical pins instead of sideways/diamond shapes.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx

**Summary:**
Replaced the rotated diamond marker body with a narrow upright rounded body and longer tapered point while preserving beat number placement, click handling, tooltip, beat zoom, alternating heights, and act spans.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/experimental/writingTimeline/WritingTimeline.jsx`

**Remaining Issues:**
Manual visual review is still needed to confirm the marker shape meets the intended production UI polish.

**Notes for Next Agent:**
Keep beat marker styling isolated from scene timeline drag/snapping and DB/RPC code.

### 2026-05-07 — Codex — Global Layout and Script Alerts

**Task:**
Fix module viewport clipping below the persistent top toolbar and move common Script alerts/confirms to centered app-level modals.

**Files Changed:**
- src/App.js
- src/components/modules/Script/Script.js

**Summary:**
Changed the main module wrapper to allow overflow scrolling, made Script fill its parent height instead of recalculating viewport height, passed App's centered alert/confirm helpers into Script, and migrated Script's native alert/confirm calls to those helpers.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/App.js` and `src/components/modules/Script/Script.js`

**Remaining Issues:**
Native `alert`/`confirm` calls remain in App-level utilities and other modules. Manual browser verification is still needed for bottom visibility across modules and centered alert placement.

**Notes for Next Agent:**
Do not replace all global alerts in one broad sweep unless explicitly requested. Continue migrating module-by-module through the centered App alert helpers.

### 2026-05-07 — Codex — Beat Timeline Marker Layout and Color Menu

**Task:**
Move beat timeline markers higher so they do not block act labels/spans, and add a right-click color menu for beat markers only.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/components/modules/Script/Script.js
- HANDOFF.md
- AI_TASK_LOG.md

**Summary:**
Increased the beat track height, repositioned beat numbers and marker pins from the top of the track, added persistent `markerColor` support on beat items, and added a compact right-click beat marker color menu. Scene timeline context-menu behavior was inspected only; its existing actions remain mostly placeholder.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/experimental/writingTimeline/WritingTimeline.jsx` and `src/components/modules/Script/Script.js`

**Remaining Issues:**
Manual browser verification is still needed for marker spacing, act label clearance, color persistence after reload, and color menu placement at viewport edges.

**Notes for Next Agent:**
Keep beat marker right-click behavior separate from scene timeline context menus until the regular scene timeline right-click workflow is explicitly scoped.

### 2026-05-07 — Codex — Beat Timeline Height Correction

**Task:**
Reduce the beat timeline back toward its compact height while keeping marker pins and beat numbers high enough to avoid bottom act labels/spans.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx
- AI_TASK_LOG.md

**Summary:**
Restored compact beat-track/page-tick/timeline heights and moved beat marker buttons upward with visible overflow so numbers and marker tops sit above the lane instead of forcing the lane taller.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/experimental/writingTimeline/WritingTimeline.jsx`

**Remaining Issues:**
Manual browser verification is still needed for compact timeline height, marker/number spacing, act label clearance, and color-menu behavior.

**Notes for Next Agent:**
Keep beat timeline height work isolated in `WritingTimeline.jsx`; do not adjust scene timeline drag/snapping constants unless explicitly scoped.

### 2026-05-07 — Codex — Timeline Ruler Refinement

**Task:**
Split the timeline ruler into separate compact rulers for the scene track and beat track, with beat ruler labels tied to beat-track zoom instead of page scale.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx
- AI_TASK_LOG.md

**Summary:**
Replaced the single shared page ruler with a compact page-based scene ruler below the scene track and a compact beat-index ruler rendered inside the beat zoom layer. Beat ruler ticks use current beat numbers and zoom with `beatTrackZoom`; scene page ticks remain tied to scene timeline zoom/page scale.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/experimental/writingTimeline/WritingTimeline.jsx`

**Remaining Issues:**
Manual browser verification is still needed for visual density, ruler label clearance, beat zoom behavior, and scene ruler readability at high page counts.

**Notes for Next Agent:**
Beat ruler labels are outline/beat indices, not page numbers. Do not treat them as page-accurate without adding real beat placement data.

### 2026-05-07 — Codex — Timeline Ruler Correction and Independent Zoom Controls

**Task:**
Correct the beat ruler back to page-based semantics and group Timeline Zoom and Beat Zoom controls together while keeping the two zooms independent.

**Files Changed:**
- src/experimental/writingTimeline/WritingTimeline.jsx
- src/components/modules/Script/Script.js
- AI_TASK_LOG.md

**Summary:**
Replaced the beat-index ruler with a page-based beat ruler using the same target page count as the scene ruler. Beat ruler density and marker spacing now follow `beatTrackZoom`, while scene page ruler and scene blocks continue to follow `timelineZoom`. Moved Beat Zoom controls from the Script toolbar into the Writing Timeline header next to Timeline Zoom controls and added a small extra gap between scene and beat tracks.

**Verification:**
- Build: not run
- Tests: not run
- Manual testing: not run
- Transform: Babel transform passed for `src/experimental/writingTimeline/WritingTimeline.jsx` and `src/components/modules/Script/Script.js`

**Remaining Issues:**
Manual browser verification is still needed for independent zoom behavior, page-ruler readability, and scroll behavior when beat zoom exceeds scene timeline zoom.

**Notes for Next Agent:**
Beat markers are still positioned by outline order for now, but both scene and beat rulers represent screenplay page count. Do not reintroduce beat-index ruler labels unless explicitly requested.

### 2026-05-25 — Codex — DOOD PDF Export and Shared Screenplay Pagination

**Task:**
Add PDF export to Day Out of Days and unify screenplay pagination/export math across Writing, Script Breakdown, Call Sheet sides, and Character sides.

**Files Changed:**
- src/utils/screenplayPagination.js
- src/utils/exportScriptPagesToPdf.js
- src/components/modules/WritingScript/WritingScriptEditor.jsx
- src/components/modules/Script/Script.js
- src/components/modules/CallSheet/CallSheet.js
- src/components/modules/Characters/Characters.js
- src/components/modules/DayOutOfDays/DayOutOfDays.jsx

**Summary:**
Added a shared screenplay pagination utility from Writing’s canonical page rules, routed Writing pagination through it, replaced Script Breakdown PDF internals with the model-based Writing PDF path, and moved Call Sheet/Character sides exports onto the shared page selection math. Added a jsPDF Day Out of Days matrix export using the current filtered report view.

**Verification:**
- Build: `npm run build` passed.
- Tests: not run.
- Manual testing: not run.

**Remaining Issues:**
Manual browser checks are still needed for generated PDF appearance, especially very wide Day Out of Days date ranges and long sides exports.

### 2026-05-25 — Codex — Global Typography Guardrail

**Task:**
Investigate the unintended app-wide font change and add guardrails so global typography changes are never silent.

**Files Changed:**
- AGENTS.md
- HANDOFF.md
- AI_TASK_LOG.md
- src/App.js

**Summary:**
Found that the current app-wide UI font is inherited from `src/App.js` workflow/content shell styles using `'Century Gothic', 'Futura', 'Arial', sans-serif`. The change was already committed in `db71256`, not introduced by the staged DOOD/pagination sprint, and the current staged PDF `setFont(...)` calls only affect generated PDFs. Documented the current font as the accepted baseline and added instructions requiring explicit user approval and summary disclosure for future global typography changes.

**Verification:**
- Build: `npm run build` passed.
- Tests: not run.
- Manual testing: not run.

**Remaining Issues:**
No font revert was performed. Build artifacts changed from the build and were intentionally left unstaged.

### 2026-05-25 — Codex — Script Export Runtime Fix and Guardrails

**Task:**
Fix the Script Breakdown runtime crash from the undefined `scenesToRender` reference and reinforce typography/runtime guardrails.

**Files Changed:**
- AGENTS.md
- HANDOFF.md
- AI_TASK_LOG.md
- src/components/modules/Script/Script.js

**Summary:**
Fixed `handleExportBreakdownPdf` in the parent `Script` component by replacing the out-of-scope `scenesToRender` reference with a correctly scoped `exportScenes` value derived from existing component state. Confirmed remaining `scenesToRender` references are scoped inside `ContinuousScript`. Reaffirmed the accepted app typography baseline as an accidental global change Joshua liked and now accepts: `'Century Gothic', 'Futura', 'Arial', sans-serif`. Added runtime identifier guardrails warning that CRA builds can pass despite render-time ReferenceErrors.

**Verification:**
- Build: `npm run build` passed.
- Search: remaining `scenesToRender` references are in `ContinuousScript`, where it is declared.
- Manual browser testing: not run in this environment.

**Remaining Issues:**
Build artifacts changed from the build and were intentionally left unstaged. Existing unstaged MoodBoard changes were not touched.

### 2026-05-25 — Codex — Sides PDF Heading Formatting Fix

**Task:**
Fix Call Sheet sides and Character custom sides PDF formatting where scene headings rendered as repeated numbered fragments.

**Files Changed:**
- src/utils/exportScriptPagesToPdf.js
- src/utils/screenplayPagination.js

**Summary:**
Kept the shared Writing-derived pagination/export architecture and fixed the sides renderer path. Scene headings converted from scene data now collapse embedded whitespace before pagination/rendering, and sides margin scene numbers render only on the first visual line of a wrapped scene heading instead of every wrapped segment.

**Verification:**
- Build: `npm run build` passed.
- Tests: not run.
- Manual browser export testing: pending/not available in this environment.

**Remaining Issues:**
Manual PDF export checks are still recommended for representative Call Sheet and Character sides.

### 2026-05-25 — Codex — FDX Adjacent Text Node Import Fix

**Task:**
Fix Final Draft XML import compatibility for FDX paragraphs that split one screenplay paragraph across adjacent styled `<Text>` nodes.

**Files Changed:**
- src/utils/screenplayImport.js

**Summary:**
Added an explicit FDX paragraph text helper that joins direct `<Text>` children within a single `<Paragraph>` before existing whitespace normalization and screenplay block classification. This preserves styled/adorned text nodes such as `Horsa` inside the same Action or Scene Heading paragraph as plain text instead of relying on broad paragraph text extraction.

**Verification:**
- Build: `npm run build` passed.
- Tests: not run.
- FDX validation: `CD Draft2.fdx` was available at `/Users/joshuachiara/Downloads/CD Draft2.fdx`; parser-source validation confirmed `An Airspeed Horsa flies through the shroud of night and a TERRIBLE STORM.` imports as one Action block, `INT. AIRSPEED HORSA - SAME - NIGHT` imports as one Scene Heading, and no standalone `Horsa` or split fake heading blocks were produced.

**Remaining Issues:**
Manual browser re-import of `CD Draft2.fdx` is still recommended to verify the Airspeed Horsa examples in the full app flow. This fix preserves styled/adorned words as plain text only; bold/italic/underline/strikethrough import into editable/exportable rich-text runs remains a separate future sprint.

### 2026-05-25 — Codex — Call Sheet Sides Target Selection Fix

**Task:**
Make Call Sheet sides export match Character sides behavior by exporting full screenplay pages for the selected shoot-day scenes and greying/striking non-day material on those pages.

**Files Changed:**
- src/components/modules/CallSheet/CallSheet.js

**Summary:**
Kept the shared `exportScreenplaySidesToPdf` renderer unchanged. Call Sheet sides already passed the full scene array, but it filtered scheduled scenes by heading/content before building the target scene set. Removed that extra screenplay-content filter so every real scheduled shoot-day scene becomes a target, while lunch/ADR/custom non-scene rows remain excluded.

**Verification:**
- Build: `npm run build` passed.
- Tests: not run.
- Manual browser export testing: pending/not available in this environment.

**Remaining Issues:**
Manual Call Sheet sides export verification is still recommended for a shoot day with multiple scenes sharing pages with non-day scenes.
