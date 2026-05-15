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
