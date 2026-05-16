# Project Handoff

## Current Objective

Stabilize the writing workflow, scene ordering, narrative outline, and timeline visibility without broad architecture rewrites.

## Current Known State

## Claude Handoff — Workflow Split Through Phase 4W

### Last Completed Phase

Architecture Audit (documentation-only): Full codebase audit and documentation created in `docs/`. Six documents cover app architecture, prop flow, module ownership, Writing/Production boundaries, data storage, and regression tests. No runtime code was changed. Key findings: WritingScript isolation confirmed. Mood overlay localStorage keys are unscoped (global) and WritingScript does not persist overlay changes back — this is the next known bug. `showBeatsTrack` is not persisted by WritingScript (unlike `showWritingTimeline`). See `docs/` for full details.

### Previous Implementation Phase

Phase 4Z: Full copy/adaptation of Script.js writing-mode implementation into WritingScript.jsx. All prior WritingScript.jsx internals replaced. WritingScript is now a self-contained writing-only module with full UI parity with Script.js writing mode. Production paths (saveScenesDatabase, setScenes, stripboard sync, tag callbacks) are removed. Beat Convert to Scene is disabled (`onConvertItem={null}`). Beats persist at `scriptBeats:${projectId}`. Draft persists at `scriptWritingDraft:${projectId}`. Build: clean (Compiled successfully, no warnings). Script.js was not modified.

### Architecture Goal

- `WritingScript` is draft/story-only and should own writing draft nodes, writing scene identity, writing editor state, writing-only persistence, and later writing scene list/timeline/beats/settings.
- `Script Breakdown` is production/pre-production/app-wide and currently renders legacy `Script.js` through the compatibility wrapper.
- A later explicit handoff layer will convert Writing data into production/pre-production data. Writing must not automatically overwrite production scenes.
- Do not let `WritingScript` receive production callbacks such as `setScenes`, `saveScenesDatabase`, stripboard sync, tag mutation, production character mutation, schedule callbacks, revision callbacks, or production scene persistence callbacks.

### Completed Workflow Migration Phases

- Phase 1: centered workflow tabs in the toolbar.
- Phase 2: workflow workspace routing shell.
- Phase 3: production-facing module label changed to `Script Breakdown` with old `"Script"` compatibility.
- Phase 4A: structural folders and `ScriptBreakdown` compatibility wrapper.
- Phase 4B: writing draft model helpers moved under `WritingScript`.
- Phase 4C: `WritingScriptEditor` moved under `WritingScript` with old-path re-export.
- Phase 4D: `ScreenplayPagePreview` moved under `WritingScript` with old-path re-export.
- Phase 4E: `WritingTimelinePanel` wrapper added.
- Phase 4F: `WritingBeatsPanel` placeholder added.
- Phase 4G: `WritingSceneList` placeholder added.
- Phase 4H: `WritingSettingsModal` placeholder added.
- Phase 4I: non-routed `WritingScript` shell added.
- Phase 4K: WritingScript-owned draft persistence/helper hook added.
- Phase 4L: isolated editor-only preview mode added.
- Phase 4M: Writing workflow now routes to `WritingScript` editor-only mode.
- Phase 4N: Writing toolbar/header added; element selector moved from fixed bottom-right into toolbar.
- Phase 4O: Writing scene list and beats panel restored; three-column writing workspace layout.
- Phase 4P: Writing workflow visual parity with Script Breakdown — Scenes/Beats tabbed right panel, `2px inset #ccc` bordered panels, restyled toolbar, matching row typography and delete buttons.
- Phase 4Q: Writing module sidebar (120px, #FFE5B4, Script/Moodboard(disabled)/Characters(disabled)). WritingBeatsPanel parity — drag/drop, color markers, context menu, act grouping, beat detail modal, Add Beat/Add Act in tab bar.
- Phase 4R: Writing layout geometry corrected — editor fixed to `flex: "0 0 8.5in"`, right panel within `calc(8.5in + 520px)` row, `alignSelf: "flex-start"`, excess padding removed.
- Phase 4S: Writing scene list page fraction display restored (`formatScenePageLength`, eighths notation). New Script now creates only Scene Heading (Action node removed). `createEmptyWritingNode` import removed from WritingScript.
- Phase 4T: WritingSceneList switched to read `timelinePageLength` (decimal fraction) instead of `pageLength` (integer whole pages). Correct field, but stats were still stale.
- Phase 4U: Fixed stale stats root cause — `handleInput` now emits stats from live DOM nodes immediately after `emitNodesChange`. Stats update in real-time as user types.
- Phase 4V: Fixed `transformEmptyNodeToNewSceneHeading` to use `createSceneId()` (UUID) instead of `makeTempNodeId()` for scene heading `sceneId`. Fixed new scenes only; existing localStorage data not migrated.
- Phase 4W: Full writing page stats rewrite. New `writingPageStats.js` with `normalizeWritingDraftNodes` (repairs temp-node sceneIds to UUIDs, persists back to localStorage) and `calculateWritingPageStats` (standalone stats from normalized nodes, same algorithm as editor). WritingScript now computes both scenes and stats from `normalizedDraftNodes` via useMemo — no dependency on editor state. Existing bad drafts auto-repaired on load.
- Phase 4Z: Full copy/adaptation of Script.js writing-mode implementation into WritingScript.jsx. Replaced all prior WritingScript.jsx internals. Copied: all beat helpers, BeatsList (Convert to Scene disabled — `onConvertItem={null}`), SceneList (writing-safe props), all writing state, full toolbar (Target button, element selector, save status, written/remaining/percent, New Script button, Settings button), WritingTimeline, beat import modal, beat detail modal, target page dialog, settings modal, all handlers (handleWritingDraftNodesChange, handleWritingSceneListReorder, handleTimelineSceneMove, handleStartNewScript simplified, all beat handlers), multi-key stats lookup via `stableSceneId` pattern. Removed all production paths: no saveScenesDatabase, no setScenes, no stripboard sync, no tag callbacks. Beats key: `scriptBeats:${projectId}`. Draft key: `scriptWritingDraft:${projectId}`. Build: clean.

### Actual Manual Test Results After Phase 4Z

Build: Compiled successfully, no warnings.

Pending manual verification (test checklist from Phase 4Z):
1. Writing workflow opens without errors.
2. Writing draft persists across reload (`scriptWritingDraft:${projectId}`).
3. Scene list shows scenes derived from draft nodes.
4. Page stats (Pg N, page fraction) display correctly in scene list.
5. Beats persist across reload (`scriptBeats:${projectId}`).
6. Beat import parses and populates beats panel.
7. Beat detail modal opens/closes correctly.
8. Target page dialog opens from Target button.
9. Settings modal opens from Settings button.
10. WritingTimeline shows when enabled in settings.
11. New Script clears draft and creates a blank scene heading.
12. Scene list click scrolls editor to scene.
13. Scene reorder updates editor draft nodes order.
14. Beat Convert to Scene is disabled (button greyed, no crash).
15. Pre-Production and Production routing unchanged (Script Breakdown still works).
- Build clean (Compiled successfully, no warnings).

**Recommended manual test:**
1. Open Writing workflow with an existing project that has a saved draft.
2. Scene list should immediately show correct page fractions (not all 1/8).
3. Type more text in an action block — scene list fractions should update in real-time.
4. Create a second scene (Tab key on Action → creates Scene Heading). Both scenes should show independent fractions.
5. Type a long action block (20+ lines) under scene 1 — scene 1 should show 3/8 or larger.
6. Scroll the scene list and verify clicking a scene scrolls the editor to that scene.

### Next Recommended Phase

Diagnose and fix the WritingScript editor persistence/body text issue (reload drops body/action text but preserves scene heading). The `handleWritingDraftNodesChange` debounce saves to localStorage after 650ms. Fix: add `beforeunload` immediate save in `useWritingDraftState.js`.

### Next Recommended Phase

Diagnose and fix the WritingScript editor persistence/body text issue (reload drops body/action text but preserves scene heading). The `handleWritingDraftNodesChange` debounce saves to localStorage after 650ms. Fix: add `beforeunload` immediate save in `useWritingDraftState.js`.

### Working

- Phase 4R layout geometry correction is implemented: Writing main workspace row is now `width: "calc(8.5in + 520px)"`, `maxWidth: "calc(8.5in + 520px)"`, `alignSelf: "flex-start"`, `paddingTop: "5px"` (copied from Script.js line 5732). Editor column is `flex: "0 0 8.5in"`, `width: "8.5in"` (was `flex: 1`). Right panel is `flex: 1, overflow: "hidden"` with no extra padding (removed `padding: "8px 20px 12px 0"`). Tab bar has `flexShrink: 0`. App.js Writing wrapper changed from `overflow: "hidden"` to `overflow: "auto"`. No functional changes. No production callbacks. `database.js` and `saveScenesDatabase` not touched.
- Phase 4Q Writing sidebar and beats parity is implemented: Writing workflow has a 120px `#FFE5B4` sidebar (Script/Moodboard(disabled)/Characters(disabled)). Writing content area starts at `left: "120px"`. `WritingBeatsPanel` is a full BeatsList clone — drag/drop, 7-color markers, right-click context menu, act grouping/collapse, beat detail modal (title + description, no Convert to Scene). Beats state is owned by `WritingScript`. Beats persist in `writingBeats:${projectId}`. Old `notes` field backward-compat-migrated to `description`. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4P visual parity is implemented: Writing workflow now matches Script Breakdown's side panel visual language. `WritingScript` renders an editor (flex left) + tabbed right panel with Scenes/Beats tabs (blue active, grey inactive, `6px gap`, `492px width`). `WritingSceneList` and `WritingBeatsPanel` use `width: "492px"`, `border: "2px inset #ccc"`, white bg, Century Gothic 12px — same as Script Breakdown panels. Beat rows have 8px beat number, 11px bold title, 20×20 red delete button. Toolbar is white, `minHeight: "38px"`, `padding: "5px 0 5px 12px"`, matching Script Breakdown toolbar. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4O Writing workspace beat/scene panels are implemented: scene list derives writing scenes from `writingDraftNodes` via `scenesFromDocumentNodes`; no production scenes are read. Beats panel uses `writingBeats:${projectId}` localStorage key (separate from `scriptBeats:${projectId}`). Clicking a scene scrolls to it via `sceneRefs`. `writingScenePageStats` is stored and passed to scene list for page number display. Beat-to-scene conversion intentionally not implemented. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4N Writing toolbar/header is implemented: `WritingScript` now renders a stable 40px toolbar above the editor. Controls: New Script button (when no draft), element type selector (when draft exists, disabled when no node is focused), page count display (updates from `onPageCountChange` callback), and save status with fixed width. The floating bottom-right element selector inside `WritingScriptEditor` is suppressed via `showFloatingElementSelector={false}`. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4M editor-only WritingScript activation is implemented: when `activeWorkflow === "writing"`, `App` renders `WritingScript` with `previewMode="editor"` instead of the existing production/pre-production module sidebar.
- Pre-Production and Production still render the existing sidebar/module system unchanged, including Script Breakdown through the compatibility wrapper around legacy `Script.js`.
- WritingScript currently receives only `selectedProject`, `user`, and `userRole`; no production scene, stripboard, schedule, tag, revision, character, database, or `saveScenesDatabase` callbacks are passed into WritingScript.
- Phase 4M did not edit Script.js, database code, production save paths, scenes, stripboard data, schedules, tags, revisions, production characters, module labels, or permissions.
- Manual test after Phase 4M confirmed Writing routes to the isolated editor surface and Pre-Production/Production still route to the existing module system.
- Manual test after Phase 4M found that scene heading appears to persist on reload, but body/action text appears not to persist.
- Writing mode is currently editor-only by design. Scene list, beats, timeline, and settings/header controls are intentionally not active yet.
- Script Breakdown still uses legacy `Script.js` through the compatibility wrapper and still contains old writing-mode branches until later cleanup.
- Phase 4L isolated WritingScript editor preview is implemented: `WritingScript` still returns `null` by default and is not routed, but can render an editor-only preview if explicitly passed `previewMode="editor"`.
- The preview uses `useWritingDraftState(selectedProject)` and `WritingScriptEditor` only. It shows draft save status and a writing-only New Script button; it does not render timeline, scene list, beats, settings modal, or production UI.
- Phase 4L did not edit Script.js, app routing, workflow routing, database code, `saveScenesDatabase`, production callbacks, production scenes, stripboard, schedules, tags, revisions, production characters, or production save paths.
- Phase 4K writing draft persistence foundation is implemented: `src/components/modules/WritingScript/writingDraftPersistence.js` and `src/components/modules/WritingScript/useWritingDraftState.js` exist but are not used by active runtime.
- The new helper preserves the current `scriptWritingDraft:${projectId}` localStorage key and payload shape for future compatibility.
- Phase 4K did not route WritingScript, edit Script.js runtime behavior, change active localStorage behavior, import production callbacks, edit database code, touch `saveScenesDatabase`, or mutate production scenes/stripboard/schedules/tags/revisions/characters.
- Phase 4I non-routed WritingScript shell is implemented: `src/components/modules/WritingScript/WritingScript.jsx` returns `null` by default and is not routed.
- If explicitly passed `previewShell={true}`, `WritingScript` renders only hidden inert surface markers; it does not mount active editor/timeline components, create runtime state, call callbacks, or write persistence.
- Phase 4I did not edit Script.js, app routing, workflow routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, production characters, or production save paths.
- Phase 4H writing settings ownership placeholder is implemented: `src/components/modules/WritingScript/WritingSettingsModal.jsx` exists and currently returns `null`.
- Actual writing settings runtime behavior remains in the legacy mixed `Script.js`: target page count, target page modal, writing timeline visibility, beats visibility, scene-number visibility, editor element type controls, save-status display, toolbar settings buttons, and localStorage-backed preferences were not moved or edited.
- Phase 4H did not edit Script runtime logic, target page behavior, timeline/beats/scene-number visibility behavior, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4G scene-list ownership placeholder is implemented: `src/components/modules/WritingScript/WritingSceneList.jsx` exists and currently returns `null`.
- Actual scene-list runtime behavior remains in the legacy mixed `Script.js`: `SceneList`, writing draft scene derivation, display labels, scene refs, drag/reorder, page metadata display, and scene selection were not moved or edited.
- Phase 4G did not edit Script runtime logic, scene list behavior, drag/reorder behavior, page metadata display, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4F beats/outline ownership placeholder is implemented: `src/components/modules/WritingScript/WritingBeatsPanel.jsx` exists and currently returns `null`.
- Actual beats runtime behavior remains in the legacy mixed `Script.js`: `BeatsList`, beat state, import/detail UI, localStorage persistence, and `handleConvertBeatToScene` were not moved or edited.
- Phase 4F did not edit Script runtime logic, beat conversion, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4E timeline ownership wrapper is implemented: `src/components/modules/WritingScript/WritingTimelinePanel.jsx` now wraps the existing experimental `WritingTimeline` component.
- `Script.js` still imports `src/experimental/writingTimeline/WritingTimeline.jsx` directly; Phase 4E intentionally did not change existing timeline runtime imports.
- Phase 4E did not edit `WritingTimeline.jsx`, `writingTimelineUtils.js`, Script runtime logic, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4D screenplay preview relocation is implemented: `src/components/modules/WritingScript/ScreenplayPagePreview.jsx` now contains the screenplay preview implementation.
- `src/components/modules/Script/ScreenplayPagePreview.jsx` remains as a compatibility re-export for legacy imports.
- Phase 4D did not change preview behavior, app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4C writing editor relocation is implemented: `src/components/modules/WritingScript/WritingScriptEditor.jsx` now contains the writing editor implementation.
- `src/components/modules/Script/ScriptWritingEditor.jsx` remains as a compatibility re-export, so the legacy mixed Script module can keep importing the old path.
- Phase 4C did not change editor behavior, app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4B writing draft model extraction is implemented: `src/components/modules/WritingScript/writingDraftModel.js` is now the source file for the existing writing draft model exports.
- `src/components/modules/Script/scriptWritingModel.js` remains as a compatibility re-export so existing `Script.js` and `ScriptWritingEditor.jsx` imports keep working unchanged.
- Phase 4B did not change app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Known follow-up from Phase 4B: `documentNodesFromScenes` and `scenesFromDocumentNodes` still preserve the current production-shaped scene conversion behavior and should later be split into writing-only helpers plus handoff mappers.
- Phase 4A structure-only split preparation is implemented: new `WritingScript`, `WritingCharacters`, `ScriptBreakdown`, and workspace `handoff` folders exist with architecture notes.
- `ScriptBreakdown` is currently a temporary pass-through wrapper around the legacy mixed `src/components/modules/Script/Script.js` component.
- `App.js` now imports the production-facing Script Breakdown module through `src/components/modules/ScriptBreakdown`; runtime props and behavior are intended to be unchanged.
- WritingScript and WritingCharacters are placeholders only and are not routed by the app yet.
- No Script internals, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters were changed for Phase 4A.
- Phase 3 module label compatibility is implemented: the general production/pre-production module list now displays `Script Breakdown`, and old `"Script"` active module / custom permission values normalize to `Script Breakdown`.
- `Script Breakdown` still renders the existing `src/components/modules/Script/Script.js` component through the Phase 4A compatibility wrapper. The actual Script split has not started.
- Phase 2 workflow workspace routing is implemented: `AuthWrapper` passes `activeWorkflow` into `App`, and `App` wraps the existing sidebar/module content in `WorkflowWorkspace`.
- Writing, Pre-Production, and Production currently render the existing module system unchanged through thin workspace placeholders. Pitching/Post-Production have a defensive Coming Soon workspace if reached directly.
- Phase 2 intentionally did not add `activeModuleByWorkflow`; current single `activeModule` behavior remains unchanged to avoid destabilizing existing sidebar/module callbacks.
- Phase 1 workflow toolbar shell is implemented: top-level workflow tabs now sit centered in the desktop toolbar, the project name sits beside the welcome/display-name area, and tab selection is visual only. Pitching and Post-Production are visible disabled "Coming Soon" tabs.
- Phase 1 intentionally did not change module routing, Script internals, database persistence, realtime subscriptions, scene data, writing draft data, stripboard data, schedules, tags, or revisions.
- Scene identity is centralized in `src/utils/sceneIdentity.js`.
- New Script, Add Scene, double-enter scene creation, scene persistence, stripboard population, and timeline continuity are working.
- Scene list drag reorder exists in the Scenes tab and saves through the existing scene persistence path.
- Scene delete now renumbers/reflows remaining scenes using the same sequential reflow logic as scene-list reorder.
- Outline acts/beats are separate ordered item types.
- Beat add/delete/import/reorder and act group drag/drop are working.
- Beat timeline markers, beat zoom, act dividers, and beat marker color selection exist.
- Scene and beat timelines now have independent scroll/scale containers — Scenes Zoom and Beat Zoom are fully independent.
- Script module right-click menus are normalized for scene rows, beat rows, and non-edit screenplay tagging.
- Multi-word screenplay tagging now uses shared UUID-based phrase search; selected phrases tag all matched phrase words as one item.
- Convert Beat to Scene exists.
- Script module alerts/confirms use centered app-level modals.

### Broken / Needs Work

- Highest priority: WritingScript editor-only mode appears not to persist body/action text on reload. Scene heading seems to persist, but body/action text does not. Likely cause: 650ms save debounce — body text typed quickly then reload loses unsaved changes. Fix options: reduce delay in `useWritingDraftState.js` or add `beforeunload` save.
- Writing mode does not yet have drag/reorder in the scene list (click-to-scroll only; add as follow-up).
- Writing mode does not yet have a timeline, settings modal, or Writing Characters.
- It is not yet clear from the UI whether Writing actions are fully isolated from production scenes. Verify while fixing persistence.
- Script Breakdown still contains legacy writing-mode branches from `Script.js`. Do not remove them until WritingScript has stable editor persistence and the needed writing UI surfaces.
- Possible brief flash/load of the old writing side of Script Breakdown when switching workflows. Track as future routing/loading cleanup.
- Beat timeline marker placement/color selection was refined, but manual visual review is still needed.
- Beat timeline marker placement/color selection was refined, but manual visual review is still needed.
- Convert Beat to Scene: now creates a blank screenplay scene (no beat text copied). Beat Detail modal shows a human-readable linked scene label instead of raw UUID. Button state/color refinement still pending.
- Regular scene timeline right-click menu exists but is still mostly placeholder/incomplete. Script-module right-click menus are separate and working-path implemented.
- Scene Detail modal v1 implemented: double-click scene → modal with heading display, scene number/label edit, linked beat indicator, future metadata placeholder. Escape/backdrop/× close it.
- Scene number/label editing now lives inside the Scene Detail modal (old inline dialog replaced).
- Replacement letter metadata: scene.metadata.replacementLetter stores optional letter suffix (A/B/C). getSceneDisplayLabel() renders the combined label. All user-visible scene labels updated to use it (scene list, screenplay heading, revision viewer, beat detail linked label, timeline popup, scene selector dropdown). Scene Detail Modal has separate Replacement Letter field. handleUpdateSceneMetadataField saves metadata-only changes without triggering reflow. Load sort uses replacementLetter as tie-break. React keys in SceneList items, revision viewer, and ContinuousScript map callbacks use index-qualified fallback (`scene.id || \`${scene.sceneNumber}-${index}\``) to prevent collisions.
- Beats panel scrollbar gutter needs cleanup.
- Native `alert`/`confirm` calls still exist outside Script and should be migrated gradually to the centered App modal helpers. Toast/feedback messages are ad-hoc (inline state banners, browser alerts) — a unified toast component should be standardized but not implemented globally in a single pass.
- Module bottom visibility needs manual review across non-Script modules after the global wrapper scroll change.
- Pre-existing paren imbalance in Script.js (7 extra closes, confirmed pre-dates this session) — does not affect runtime but should be investigated.

### Recent Fixes

- Script writing-mode deletion/scene-creation cleanup sprint (2026-05-09):
  - **Heading drag selection (Problem 2):** Starting a drag on a scene heading now correctly extends into body blocks and across scene boundaries. Fix: `event.preventDefault()` on heading mousedown prevents the browser from entering contenteditable-constrained editing mode; the mousedown caret position is captured via `getCaretRangeFromPoint`, and the mouseup position is captured separately; `pendingSelectionDeleteRef` is built from the two endpoints instead of relying on native browser selection.
  - **Orphaned "2:" scene after delete (Problem 1):** `survivingFromRange` now has an orphan filter: scenes with empty heading AND all-empty content are removed after the `fullySelectedSet` / trim loop. Safety fallback keeps one clean empty scene if the entire script would otherwise be wiped. `pushUndoEntry` and DOM reconciliation both use the filtered list (`guaranteedSurvivors`).
  - **Double-enter orphan Action block (Problem 3):** `handleCreateSceneAfter` now removes the trigger block (the empty Action block at `blockIndex`) from the source scene instead of leaving it as an orphan.
  - **Default "INT. LOCATION - DAY" heading (Problem 4):** `createBlankScene` now sets `heading: ""` and `metadata: {}`. New scenes (Add Scene button, double-enter, new script) start with a blank heading field after the display label.
  - **Realtime console noise (Problem 5):** Throttled "REALTIME: Scenes changed" and "SKIPPING Scenes reload" logs to once per 2-second window using `window._scenesRealtimeLogAt` / `window._scenesSkipLogAt` gates.
- Script writing-mode selected-delete persistence fix:
  - Root cause: `editingScenes` (local to Script) and `scenes` (canonical, App state) were only synced via the 15s auto-save. Deleted scenes stayed in `scenes` (and thus the Scenes list) until the timer fired. On module switch+remount, the init effect re-populated `editingScenes` from the stale `scenes`, restoring the deleted scene.
  - Fix: a single new `useEffect` with dep `[editingScenes.length, isWritingMode]`. When scene count diverges from `scenes.length` in writing mode, it immediately calls `setScenes(normalized)` and `saveScenesDatabase(normalized)`.
  - Undo/redo that changes scene count triggers the effect automatically — no changes to `ContinuousScript` needed.
  - Edit mode behavior unchanged (commit on Save only).
- Script writing-mode selected-delete structural cleanup:
  - Root cause of blank-block leftovers: middle scenes were always preserved via `ensureSceneHasBlock`; start/end blocks trimmed to `""` (when offset=0 or selection consumed to end) were kept in `nextContent` because the removed-block range excluded them.
  - Fully-selected scenes (heading start through last block end covered by selection) are now removed from `editingScenes` entirely. Surviving scene objects and their `id`/`metadata` are preserved unchanged.
  - Fully-consumed start blocks (selection offset=0, something selected after) and end blocks (endOffset at or past block end, something selected before) are removed instead of left as blank placeholders.
  - `ensureSceneHasBlock` still runs for all kept scenes so a minimum of one body block always exists.
  - At least one scene is always preserved; if the entire screenplay is selected, the last touched scene is kept (cleared to empty).
  - New undo entry type `multi-scene-delete` uses a `spliceAt / replace / insert` splice model. Symmetric: applying `applyUndoEntry` on a `multi-scene-delete` entry restores the removed scenes and returns the inverse entry, which when applied re-deletes them. Undo/redo depth is unlimited and correct.
  - DOM reconciliation after delete and after undo/redo uses a fresh `buildSceneDisplayLabelMap` computed from the updated `editingScenesRef.current`, avoiding stale display-label references from the pre-delete render closure.
  - Caret after delete lands at the deletion point if the start scene survived, or at the start of the first surviving scene if the start scene was removed.
  - Selection snapshot fallback (`pendingSelectionDeleteRef`) preserved and still used when the browser collapses the cross-contenteditable selection on `contenteditable=true` restore.
  - All other editor behaviors (typing safety, navigation, parenthetical, Cmd+1-7, Tab/Enter, autocomplete, final-block delete) are unchanged.
- Script writing-mode selected-delete repair (selection bridge):
  - Root cause: `setEditableBlocksEnabled(true)` in the mouseup handler fires before Delete, collapsing any cross-boundary selection in Chrome/Safari.
  - Fix: capture a normalized selection snapshot (flow positions + char offsets) before restoring editability; attempt to re-apply the browser selection after; `handleMultiBlockSelectionDelete` falls back to the stored snapshot when the live selection is collapsed.
- Script writing-mode documentation/handoff update:
  - Current editor architecture and unresolved selected-delete gap documented for Claude.
  - No behavior changes.
- Script writing-mode heading integration:
  - Editable scene headings are now script-flow units alongside body blocks.
  - ArrowUp/ArrowDown traverse headings and body blocks in screenplay order while preserving wrapped-line body behavior.
  - Multi-block selected delete resolves both `.script-heading-edit` and `.script-edit-block`.
  - Intended selected-delete behavior can trim/clear heading text without deleting scene objects, ids, metadata, numbering, or scene order.
  - `multi-block-delete` undo/redo entries now restore/reapply affected headings plus touched scene content arrays.
  - Browser-tested caveat: highlighted heading/body selections do not always delete the exact highlighted text yet; range reconciliation remains open.
- Script writing-mode multi-block selected delete:
  - Delete/Backspace now handle selections spanning multiple screenplay content blocks.
  - The custom delete path only runs when selection endpoints resolve to different writing-mode flow units; single-unit selections stay native.
  - Deletion trims first/last selected blocks, removes fully selected middle blocks, preserves scene identity/order, and keeps at least one block per touched scene.
  - Undo/redo uses a scoped `multi-block-delete` history entry with only touched scene content arrays.
  - Scene headings are preserved conservatively; selections that start or end in headings are not custom-deleted.
- Script writing-mode redo stabilization:
  - Redo now mirrors the scoped undo model for text edits, type changes, add block, and delete block.
  - History application uses a current `editingScenes` ref rather than stale render-closure state.
  - Pending text snapshot timers are cleared before undo/redo so delayed typing snapshots cannot invalidate redo.
  - Structural history entries rebuild the block text snapshot map after indices shift.
  - Multi-block selected delete is still deferred pending a safe cross-`contentEditable` deletion design and browser verification.
- Current-scene scroll highlight: IntersectionObserver replaced with RAF-throttled scroll listener on `containerRef.current`. Picks the last sceneRef with `top <= 50px` from container top. Only updates `currentSceneNumber`, not `currentIndex`.
- Inserted-scene colors: updated from red (#e53935/#c62828) to orange (#f59e0b/#b45309) across all 4 display surfaces.
- Scene Detail Modal: Scene Number is now a read-only display field. Replacement Letter keeps its input and now has `autoFocus`. `onSceneNumberChange` still exists but is not exposed in UI.

### Phase A Complete

Visual highlight for inserted/replacement scenes (defined as `Boolean(scene.metadata?.replacementLetter)`) added to all 4 display surfaces:
- Script.js: scene list row (pink tint + red left border + red label), screenplay heading (thin red left border), timeline popup (INS badge)
- WritingTimeline.jsx: zoom lens block (red tint) and main timeline block (pinkish-red tint, dark label)
- Stripboard.js: row red left border, scene cell shows letter in red
- StripboardSchedule.js: available-scenes list (red left border + letter display, React key fixed), scheduled card (border + letter display)

Phase B (display derivation from predecessor UUID), Phase C (insert scene), Phase D (reflow), Phase E (stripboard persistence) are all unstarted.

## Script Writing Mode Editor Handoff

### Current Verified State

- Scene rendering unification is complete.
- Multi-scene visual selection works, including drag selections that start on scene headings.
- Multi-block selected delete works across headings and body blocks.
- Fully-selected scenes are removed from the screenplay (not just cleared).
- Orphan scenes (empty heading + empty content) are filtered from survivors automatically.
- Fully-consumed blocks are removed (no blank-block leftovers).
- Heading integration for navigation and custom delete resolution is complete.
- ArrowUp/ArrowDown navigation through editable scene headings works correctly.
- Double-enter creates a new scene cleanly (no orphan Action block left in previous scene).
- New scenes start with a blank heading (no default "INT. LOCATION - DAY").
- Typing safety is stable.
- Parenthetical behavior is stable.
- Undo/redo are stable, including for multi-scene deletes.
- Cmd+1-7, Tab/Enter, Character autocomplete, and final empty-block delete are working.

### Core Editor Model

- Writing mode still uses multiple separate `contentEditable` hosts.
- Body screenplay lines use `.script-edit-block`.
- Editable scene headings use `.script-heading-edit`.
- The editor is intentionally **not** one giant contentEditable.
- Live text entry is DOM-owned while the block is focused. React must not render live text children into focused edit hosts on every keystroke.
- React state syncs on blur and on explicit structural/type/history operations.
- The current flow-unit model is:
  - `{ si, kind: "heading" }`
  - `{ si, kind: "block", bi }`
- Flow units are used for heading-aware selection/delete resolution and vertical navigation.

### contentEditable Stabilization Strategy

- Focused screenplay blocks/headings should not be rewritten by React during normal typing.
- `blockRefs` and `sceneHeadingRefs` are the live DOM handles.
- `editingScenesRef` is used so undo/redo/history application can read current scene state without relying on stale render closures.
- Text snapshot timers track local undo text batches, but pending timers are cleared before undo/redo application.
- Earlier reverse-populated typing was caused by React rendering focused `contentEditable` text as children, which reset the caret so each new character inserted at the start.

### Undo/Redo Architecture

- Undo/redo are local to Script writing mode.
- They are scoped entries, not whole-script snapshots.
- Supported scoped entries include:
  - text edits
  - block/type changes
  - add block
  - delete block
  - `multi-block-delete` (legacy, kept for backward compat)
  - `multi-scene-delete` (current selected-delete path)
- Redo mirrors undo using inverse entries.
- New edits clear the redo stack through `pushUndoEntry`.
- Structural history changes rebuild the block text snapshot map after indices shift.
- `multi-scene-delete` entries use a symmetric `spliceAt / replace / insert` splice model. Applying the entry swaps `replace` and `insert` and swaps the focus fields to produce the inverse (redo) entry. No separate redo-specific format needed.

### Multi-Scene Selection

- Multi-scene visual selection uses a bridge for separate contentEditable hosts.
- On drag start inside `.script-edit-block` or `.script-heading-edit`, editable hosts are temporarily marked `contenteditable=false`.
- **Heading-start drags:** `event.preventDefault()` is called to prevent the browser from entering contenteditable editing mode (which would constrain the drag to the heading). The mousedown caret position is captured via `getCaretRangeFromPoint` before disabling editability. On mouseup, the end position is captured via `getCaretRangeFromPoint(upEvent.x, upEvent.y)`. A synthetic `spanRange` is built from both points; `pendingSelectionDeleteRef` is populated from it. Native browser selection is not used for heading-start drags.
- **Block-start drags:** `setEditableBlocksEnabled(false)` fires in capture phase; native browser selection extends across non-contenteditable elements. On mouseup the native selection is snapshotted into `pendingSelectionDeleteRef` before restoring editability.
- After restoring editability, the code attempts to re-apply the browser selection visually from the snapshot.
- A simple click/collapsed selection restores focus/caret to the clicked edit host. For heading clicks where `preventDefault` suppressed focus, the mouseup handler calls `.focus()` on `drag.blockEl` (the heading) explicitly.

### Multi-Block / Multi-Scene Delete

- Custom Delete/Backspace runs only when selection endpoints resolve to different writing-mode flow units.
- Single-unit selections stay native browser behavior.
- Live browser selection is tried first; `pendingSelectionDeleteRef` snapshot is used as fallback when the live selection is collapsed.
- Deletion behavior by selection coverage:
  - **Partial block**: trim text only; preserve the block.
  - **Fully consumed start block** (selection starts at offset 0 AND continues past the block): remove the block.
  - **Fully consumed end block** (selection covers the full block text AND started before it): remove the block.
  - **Middle blocks** (fully within the selection range): removed.
  - **`ensureSceneHasBlock`**: always runs for kept scenes; adds one empty fallback block only when all blocks would otherwise be gone.
  - **Partially selected scene**: kept, trimmed as above.
  - **Fully selected scene** (heading start at offset 0 through last block end fully covered): removed from `editingScenes`. Surviving scene `id`, metadata, and numbering are untouched.
  - **Entire screenplay selected**: last touched scene kept as an empty fallback.
  - **Orphan survivors** (empty heading + all-empty content): removed from `survivingFromRange` by a post-loop filter (`cleanSurvivors`). Safety fallback `guaranteedSurvivors` keeps one clean empty scene when the filter would produce an empty script.
- Caret after deletion: at the trim point if the start scene survived; at the heading of the first surviving scene otherwise.
- Scene identity of all surviving scenes is preserved exactly.
- `pushUndoEntry` and DOM reconciliation both use `guaranteedSurvivors`, not the raw `survivingFromRange`.

### Heading Integration

- Editable scene headings are now part of normal writing-mode script flow.
- ArrowDown from a previous scene's last body block moves into the next scene heading.
- ArrowDown from a heading moves into that scene's first body block.
- ArrowUp from the first body block moves into that scene heading.
- ArrowUp from a heading moves to the previous scene's last body block.
- Wrapped-line behavior inside body blocks remains native/hybrid and should be preserved.
- Headings were skipped originally because old traversal only used `.script-edit-block`; headings are `.script-heading-edit`.
- The original selected-delete path failed with headings because selection endpoints inside headings could not be resolved.

### Character Autocomplete

- Character autocomplete is local state in `ContinuousScript`.
- It is active only on Character lines.
- Suggestions come from existing script Character blocks plus `characters` prop/module data.
- Matching is case-insensitive.
- Enter/Tab accept only when the dropdown is open.
- Escape closes; Up/Down navigate suggestions only while open.
- Accepted names insert uppercase text.

### Persistence Model

- `editingScenes` is local state in the Script component (writing buffer).
- `scenes` is App-level canonical state (Scenes list, module-switch reload source).
- Writing mode syncs them in two ways:
  1. **Immediate (scene count change)**: a `useEffect` on `[editingScenes.length, isWritingMode]` calls `setScenes` + `saveScenesDatabase` the moment the scene array grows or shrinks.
  2. **Debounced (content change)**: the 15s auto-save handles text/block edits.
- Edit mode preserves its "commit on explicit Save" design — no immediate sync.
- Selected-delete (scene removal) goes through path 1 → Scenes list updates immediately, module-switch reload correct.

### Scene Creation

- `createBlankScene(sceneNumber, timelineStartPage)` creates a new scene with `heading: ""` and `metadata: {}`.
- Display label ("N: ") is derived and shown automatically; the user types their heading text after it.
- `handleCreateSceneAfter` (double-enter) removes the empty trigger block from the source scene. If the scene would have 0 blocks after removal, one clean empty Action block is kept.
- `handleInsertScene` (insert-between from sidebar) still overrides metadata with `replacementLetter` and form defaults (`intExt: "INT."` etc.) but the heading starts blank.
- Beat-to-scene conversion (`handleAddSceneFromBeat`) also overrides metadata with `sourceBeatId` and form defaults but heading starts blank.

### Remaining Limitations

- Display labels (scene numbers) on surviving headings update correctly after deletion because the DOM reconciliation timeout uses a fresh `buildSceneDisplayLabelMap` computed from `editingScenesRef.current`.
- The `pendingSelectionDeleteRef` snapshot depends on `getFlowPositionForNode` / `getRangeOffsetInFlowUnit` resolving correctly at mouseup time. Complex nested DOM structures could theoretically confuse these; this has not been a problem in practice.
- Heading-start drag selection relies on `getCaretRangeFromPoint` hitting the correct text node at mouseup. If the user releases the mouse over a non-text area (e.g., padding, margins), the range may miss the intended word boundary.
- Manual browser testing still recommended for: partial heading selections spanning scene boundaries, scenes with only one block, and redo-after-multiple-undos chains.

### Recommended Next Sprint

- Writing-mode scene-level features (e.g., merge scenes, split scene at caret) if needed.
- Deleted-scenes recovery UI (soft-delete / trash), if desired.
- No architectural changes to the editor are needed at this time.

### Historical Root Causes

- Reverse typing: React rewrote focused `contentEditable` children during typing, resetting caret placement and causing new characters to insert at the start.
- Imported vs writing-created scene divergence: writing-created scenes had different wrappers/default fields and extra divider/spacing compared with imported scenes; unification removed the visual divider/extra spacing and aligned blank scene defaults.
- Heading skip: arrow/delete resolvers originally treated only `.script-edit-block` as editable flow, so `.script-heading-edit` was invisible.
- Heading delete failure: custom selected-delete originally could not resolve heading endpoints, so heading/body selections were ignored or mishandled.

### Recently Changed

- **Scene chronology provenance Phase 1:**
  - `metadata.originalScriptOrder` now exists as additive frozen screenplay-position provenance.
  - Full FDX import stamps `originalScriptOrder` as 0-based import order alongside existing `originalSceneNumber`.
  - Single-scene FDX replace preserves existing `originalScriptOrder`; fallback order is current `metadata.scriptOrder`, then current array index when safely available.
  - Inserted blank scenes stamp `originalScriptOrder` with the clamped insertion index while preserving `replacementLetter`.
  - Display/offset logic is still deferred. `getSceneOriginalNumberPresentation` and original-number rendering were not changed.
  - Next phase should add `getChronologyOffset` and fringe-case display handling for chronologically displaced scenes.
- **Stripboard UX refinement:**
  - Title is now `STRIPBOARD` (no "— Scene Breakdown").
  - Status/stat badges consolidated into the main header row alongside the title — no separate second header band.
  - Sticky column header: outer module wrapper is now `display:flex; flex-direction:column; overflow:hidden`. Inner scroll container (`flex:1; overflow:auto`) wraps column header + rows. Header uses `position:sticky; top:0; zIndex:2`. Horizontal scroll is shared between header and rows automatically.
  - Per-column font-size overrides: `columnFontSizes: {}` added to Stripboard prefs (stored in `stripboard_prefs_v1`). Each column resolves `(prefs.columnFontSizes[key] ?? prefs.fontSize)`. Columns with an override show a `●` dot in the header. Global font-size control still works for unoverridden columns.
  - Column-header right-click menu: suppresses browser context menu, does NOT open scene modal. Options: Use Global Font Size, Smaller, Normal (= current global), Larger, Reset Column Width. Row right-click still opens the heading modal.
  - Badge rendering: Cast, Props, Wardrobe, Makeup, Production Design columns render items as flex-wrap token badges.
- **Phase 3 — Heading architecture:** `parseSceneHeading` in `src/utils.js` fully rewritten — supports `INT.`, `EXT.`, `I/E`; dash-separated primary path; space-separated fallback; extracts modifier correctly; `console.log` noise removed. `buildHeadingString({ intExt, location, timeOfDay, modifier })` added as canonical heading reconstruction utility (exported from `src/utils.js`). Used in `App.js` (×2 sites), `Script.js` modal `onSave`, and `SceneDetailModal.js` preview. Bug fixed: `modifier` now written to in-memory `scene.metadata` in `updateStripboardScene` (was written to DB only).
- **Phase 2 — Shared modal:** `src/components/shared/SceneDetailModal.js` created. Both Script Scene Detail modal and Stripboard Edit Heading modal replaced with the shared component. Script modal adds editable heading controls; Stripboard modal gains "View Script Page" button. Parent modules own all state and callbacks.
- **Phase 1 — Stripboard cleanup:** Inserted left-stripe removed. `script` column repurposed as narrow badge column (blank header, 22px default). Inserted scenes show amber circle badge with replacement letter. `✎` edit button removed. Right-click on row opens heading modal directly; browser context menu suppressed.
- Scene IDs now use shared `createSceneId` / `isValidSceneId` helpers from `src/utils/sceneIdentity.js`.
- FDX import creates valid UUID scene IDs and stores imported source numbering in `scene.metadata.originalSceneNumber`.
- Scene list reorder updates canonical scene order, scene numbers, continuous timeline positions, local stripboard state, and database persistence.
- Scene delete now reflows remaining scenes, preserves stable IDs, and preserves `metadata.originalSceneNumber`.
- `reflowScenesSequentially` and `buildOriginalContentMap` support consistent delete/reorder updates.
- Main module wrapper now scrolls instead of hard-clipping overflow, and Script fills parent height instead of using viewport height.
- App-level centered alert/confirm helpers are passed into Script.
- `WritingTimeline.jsx`: `SCENE_LAYER_HEIGHT` reduced to 47, `SCROLLBAR_GUTTER_PX` reduced to 10 for compact timeline containers.
- Beat Detail modal now closes on Escape keypress.
- Scene headings show a small "B" button when the scene was converted from a beat (`scene.metadata.sourceBeatId`); clicking it opens the Beat Detail modal for the originating beat. Button is UI-only and outside the contentEditable `h2`.
- Convert Beat to Scene now creates a blank scene (empty Action block, default heading). Beat Detail shows "Linked Scene: N — heading" instead of raw UUID.
- Scene Detail modal v1 added: double-click any scene in the scene list opens it. Scene number/label editing (including letters like 24A) moved into the modal. Escape/backdrop/× close it.
- Script viewer right-click now suppresses browser menu in non-edit view, uses selected text when available, and falls back to clicked word spans for tagging. Edit/contentEditable mode preserves native context-menu behavior.
- Script/Props phrase search now shares `src/utils/scriptSearch.js`; new phrase tag keys are normalized stemmed words joined by spaces, with legacy no-space phrase keys still accepted.
- Script right-click tagging menu again supports Remove Tag for tagged words/phrases. ContinuousScript highlight lookup now follows the active rendered scene array so insert-before operations should not require module switch/refresh to restore highlights.

## Important Files / Areas

Confirm actual paths before editing. Likely areas include:

- `src/components/modules/Script/Script.js`
- `src/experimental/writingTimeline/WritingTimeline.jsx`
- `src/experimental/writingTimeline/writingTimelineUtils.js`
- `src/utils/sceneIdentity.js`
- `src/App.js`
- `src/services/database.js`

## Scene Identity Architecture Map

## Scene State Ownership / Centralization Goal

- Scene is the fundamental unit of the app.
- `scene.id` is stable identity.
- `metadata.scriptOrder` is screenplay order.
- `getSceneDisplayLabel` is the visible label source.
- `scene.status` belongs to production/scheduling state.
- `scene.metadata.color` is user/custom visual annotation.
- Status color is production meaning and wins in Script/SceneList.
- Custom color is secondary annotation when status exists.
- Timeline is a writing/navigation tool and should show custom colors, not production status colors.
- Stripboard/Schedule are production tools and own scheduling/status workflows.
- Future work should centralize status colors and scene display helpers into shared utilities.

## Scene Presentation Layer

- `src/utils/scenePresentation.js` is the canonical visual semantics layer for scene status, custom color, original-number metadata, and SceneList metadata columns.
- Modules should consume these helpers instead of inventing their own status/color logic.
- Production statuses override custom color backgrounds; custom colors remain secondary indicators when status exists.
- Timeline intentionally ignores production statuses and shows custom scene colors only.
- Future migrations: Stripboard, StripboardSchedule, Props viewer, Beats window.

### Source of Truth

| Concern | Field | Notes |
|---|---|---|
| Stable identity | `scene.id` | UUID; never changes; use as DB/sync/cross-module key |
| Canonical script order | `metadata.scriptOrder` | Stamped on every save; used for DB reload sort |
| Legacy DB integer | `scene.sceneNumber` | Unique integer assigned by reflow; backward-compat reads only |
| Display label | `buildSceneDisplayLabelMap(scenes)` | Derived from array position + `replacementLetter`; never persisted |
| Inserted/revision marker | `metadata.replacementLetter` | Optional letter suffix (A/B/C); determines inserted-scene label |

### Props Scene Association Layer

- `src/utils/propSceneRefs.js` is the compatibility layer for `prop.scenes` entries.
- `prop.scenes` may contain legacy integer sceneNumbers, UUID scene.id refs, or mixed arrays.
- All membership reads must use `sceneMatchesPropSceneRef(scene, ref)` — never raw string comparison.
- All navigation lookups must use `resolvePropSceneRef(ref, scenes)` — never `findIndex` by sceneNumber.
- Shoot-day filtering/display uses `getPropSceneNumbersForDisplay(prop, scenes)` to resolve refs to current sceneNumbers for schedule map lookup (schedule data stays keyed by sceneNumber).
- Script-viewer pre-confirm uses `getPropSceneIds(prop, scenes)` to resolve refs to `scene.id[]` for UUID-stable matching.
- Script-viewer highlight check uses `sceneMatchesPropSceneRef(scene, ref)` — no raw string comparison.
- Writes via `onAddPropToScene` now store UUID in `prop.scenes` (write-forward migration).
- Writes via `onRemovePropFromScene` now remove by `normalizePropScenesOnRemove` (handles both formats).
- Inline variant creation (Props.js script viewer) now writes `scene.id` into `scenes` and creates UUID-anchored instance IDs.
- Sorting uses `getEarliestScriptOrder` via `metadata.scriptOrder` — not raw `parseFloat` of refs.

**P2C deferred (Props migration remaining items):**
- `mergedScenes` write in script tagging path (`App.js:2308`) — `searchScript` returns sceneNumbers; migrating this requires changes to the core script-tagging pipeline
- Character scene merging (`charObj.scenes.map(String)` merged into `propData.scenes`) — `charObj.scenes` is owned by Characters module, not in scope
- `pendingPropScenes` ephemeral array — intentionally left as sceneNumbers; not persisted, low risk
- `prop.sceneIds` field reconciliation — `App.js` already stores `mergedSceneIds` alongside `scenes` on script-tagged items; relationship to `prop.scenes` post-migration needs clarification in P2C

### Stable Systems

- **Scene reorder + reflow**: `handleSceneListReorder` → `resequenceInsertedGroupLetters` → `reflowScenesSequentially`. Inserted-scene labels are correct after drag.
- **Display label derivation**: `buildSceneDisplayLabelMap` + `getSceneDisplayLabel` in `src/utils/sceneDisplayLabel.js`. Never use display labels as DB keys.
- **ShotList dual-key lookup**: checks `_bySceneId[scene.id]` first, `[sceneNumber]` fallback — reference model for other modules.
- **sceneIdentity.js utilities**: `sameScene()`, `getSceneId()`, `getSceneNumber()`, `isValidSceneId()`, `createSceneId()` — consistently used in StripboardSchedule and ShotList.

### Rules for Future Work

1. Use `scene.id` (UUID) as the canonical key for any new persistence, sync, or cross-module reference.
2. Never use `scene.sceneNumber` as an ordering or display source — only for legacy DB backward-compat reads.
3. Never persist a display label (e.g., `"3A"`) as a DB key, diff key, or sync ID.
4. All new tag/prop/makeup/PD instance IDs must embed `scene.id`, not a positional `sceneIndex`.
5. New module lookups must follow the ShotList dual-key pattern: write to both UUID key and sceneNumber key; read UUID-first.

### Module Status

| Module | Scene Identity Model | Risk |
|---|---|---|
| ShotList | UUID + sceneNumber dual-key (`_bySceneId`) | Stable |
| StripboardSchedule | `sameScene()` / `getSceneId()` | Stable |
| Script (reorder, display) | UUID reflow + `displayLabelMap` | Stable |
| Tagging instances | Positional `"si-bi-wi"` string | High — breaks on reorder/insert |
| Props `searchScript` | Positional `"si-bi-wi"` string | High — same as tagging |
| Props `prop.scenes` | Dual-read: UUID or integer (`propSceneRefs.js`) | P2A+P2B complete — writes use UUID, all reads handle both; shoot-day, pre-confirm, highlight, variant writes migrated. P2C deferred: script-tag mergedScenes write, charObj.scenes merge |
| Makeup, PD | `parseInt(instanceId.split("-")[0])` | High — positional only |
| Characters, Wardrobe, Locations | `sceneNumber` integer | Medium — works until reflow diverges |
| Revision diff JSONB | No `scene_id` embedded | Medium — reflow can detach diffs |

### Next Feature Path

Migrate tagging instance IDs from positional `"si-bi-wi"` to `"${scene.id}-${bi}-${wi}"` (T2) before any new cross-scene feature. This unblocks correct tag persistence after reorder, multi-word phrase tagging, and Props/Makeup/PD scene-linking.

## UX Constraints

- Preserve the existing visual direction.
- Keep scene timeline drag/snapping behavior untouched unless explicitly requested.
- Keep beat timeline marker work separate from scene timeline snapping/dragging.
- Keep Beats/Scenes side-panel controls visible and testable.
- Avoid broad UI rewrites; make surgical changes around the current workflow.
- Migrate native alerts module-by-module through the centered App modal helpers; avoid broad alert rewrites.

## Current Known Issues / Next Tasks

- Review beat marker placement/color menu visually and refine spacing/beat-track zoom UX if needed.
- Finish regular scene timeline right-click actions and align them with the beat marker color menu pattern.
- Refine Convert button state/color for converted beats.
- Add scene-heading beat-link indicator that opens the Beat Detail modal.
- Clean up Beats panel scrollbar gutter.
- Add Scene Detail modal.
- Move scene renumber editing into a modal eventually.
- Continue manual verification of scene delete/reorder persistence across reloads.
- Continue replacing native alerts/confirms outside Script; standardize toast/feedback styling module-by-module (do not rewrite all modules at once).
- Verify module bottom visibility across Dashboard, Stripboard, Budget, DOD, and other large modules.

## Next Recommended Task

Continue with the next requested focused sprint. Do not start DB/RPC, snapping, stripboard rewrite, right-click/context menu, or broad timeline architecture work unless explicitly requested.
