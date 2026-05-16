# Redundancy and Holes Report

---

## R-01: Duplicate Script Document Model Files

- **Title:** `scriptWritingModel.js` vs `writingDraftModel.js` — identical purpose, separate files
- **Description:** `src/components/modules/Script/scriptWritingModel.js` and `src/components/modules/WritingScript/writingDraftModel.js` both export `documentNodesFromScenes` and `scenesFromDocumentNodes` — functions that convert between flat node arrays and scene objects. They appear to have been implemented independently and are near-identical.
- **Affected files:**
  - `src/components/modules/Script/scriptWritingModel.js`
  - `src/components/modules/WritingScript/writingDraftModel.js`
- **Risk level:** MEDIUM — divergence between the two implementations will silently produce different output when scene handling edge cases arise.
- **Recommended cleanup:** Consolidate into a single `src/utils/scriptDocumentModel.js` or keep only `writingDraftModel.js` as the canonical version. Script.js should import from the canonical source.
- **Fix now or defer?** Defer (no user-facing impact until they diverge further), but track actively.

---

## R-02: Duplicate Beat Sheet Logic

- **Title:** Beat helpers duplicated verbatim between Script.js and WritingScript.jsx
- **Description:** The beat parsing/normalization functions (`normalizeBeatText`, `createBeatId`, `stripBeatMarker`, `extractOriginalBeatNumber`, `isBeatSectionHeader`, `isActHeading`, `isNumberedBeatTitle`, `isBulletBeatTitle`, `isLikelyBeatTitle`, `createAutoBeatTitle`, `normalizeOutlineItems`, `parseBeatSheetText`) and the `BEAT_MENU_COLORS` constant appear at the top of both files. WritingScript.jsx lines 39–210 are a copy-paste of Script.js lines ~350–575.
- **Affected files:**
  - `src/components/modules/Script/Script.js` (lines ~350–575)
  - `src/components/modules/WritingScript/WritingScript.jsx` (lines 39–210)
- **Risk level:** HIGH — bug fixes in one will not propagate to the other. Beat parsing is complex and any divergence will cause different beat import results between writing and production modes.
- **Recommended cleanup:** Extract all beat helpers to `src/utils/beatSheet.js`. Both files import from there.
- **Fix now or defer?** Defer but flag as a named tech debt item.

---

## R-03: Shared localStorage Keys Written by Two Components (CRITICAL)

- **Title:** `scriptWritingDraft`, `scriptBeats`, `scriptSidePanelTab`, `scriptCollapsedActs`, `scriptTimelineVisible:writing`, `scriptTargetPageCount` — keys written by both Script.js and WritingScript.jsx
- **Description:** Both Script.js and WritingScript.jsx define storage key getter functions that produce identical key strings for the same project. Both write to these keys. The last writer wins. If the user navigates from Writing tab (WritingScript) to Pre-Production tab (Script.js in writing mode) without a project reload, the Script.js instance may overwrite or read stale data from the WritingScript instance.
- **Affected files:**
  - `src/components/modules/Script/Script.js` (lines 3105–3120, 3127–3519)
  - `src/components/modules/WritingScript/WritingScript.jsx` (lines 506–634)
  - `src/components/modules/WritingScript/writingDraftPersistence.js`
- **Risk level:** CRITICAL — writing draft data loss is possible if both modules are mounted and write to the same key in the same session.
- **Recommended cleanup:** Decide on ONE canonical owner per key. If WritingScript is the canonical writing module, Script.js should read-only from the writing draft key (or not use it at all when in production/breakdown mode). Optionally add a `writingScript:` vs `breakdown:` prefix distinction.
- **Fix now or defer?** Fix now — this is an active data loss risk.

---

## R-04: Unscoped `scriptMoodOverlayEnabled` and `scriptMoodOverlaySettings` Keys

- **Title:** Mood overlay state is not project-scoped
- **Description:** Both Script.js (lines 2955, 2960, 3514, 3519) and WritingScript.jsx (lines 475, 479) use `localStorage.getItem("scriptMoodOverlayEnabled")` and `"scriptMoodOverlaySettings"` without any project ID suffix. This means all projects share one mood overlay state.
- **Affected files:**
  - `src/components/modules/Script/Script.js`
  - `src/components/modules/WritingScript/WritingScript.jsx`
- **Risk level:** LOW (UI preference only, no data loss), but confusing UX.
- **Recommended cleanup:** Change to `scriptMoodOverlayEnabled:${projectId}` and `scriptMoodOverlaySettings:${projectId}`.
- **Fix now or defer?** Defer — UX issue only.

---

## R-05: `ScriptBreakdown.jsx` Is a Pass-Through Alias

- **Title:** ScriptBreakdown is just `<LegacyScriptModule {...props} />`
- **Description:** `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx` contains only 9 lines — it imports Script.js as `LegacyScriptModule` and renders it with all props forwarded. The split between ScriptBreakdown and Script.js has not happened yet; the module rename exists only in routing, not in implementation.
- **Affected files:**
  - `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`
  - `src/components/modules/ScriptBreakdown/index.js`
  - `src/components/modules/Script/Script.js`
- **Risk level:** LOW (no functional impact), but creates misleading architecture impression.
- **Recommended cleanup:** Track as "extraction pending" — only proceed when the writing/production logic split inside Script.js is complete.
- **Fix now or defer?** Defer — do not extract prematurely.

---

## R-06: `WritingTimeline` Is Shared Between Writing and Production Modes

- **Title:** WritingTimeline.jsx imported by both Script.js and WritingScript.jsx
- **Description:** `src/experimental/writingTimeline/WritingTimeline.jsx` is an experimental component used in both Script.js (writing mode timeline) and WritingScript.jsx. It accepts `scenes` (draft scenes) and callbacks. If the component adds production-specific features, it will require guard logic.
- **Affected files:**
  - `src/experimental/writingTimeline/WritingTimeline.jsx`
  - `src/components/modules/Script/Script.js`
  - `src/components/modules/WritingScript/WritingScript.jsx`
- **Risk level:** MEDIUM — experimental status + shared import = changes could break either mode.
- **Recommended cleanup:** When WritingScript is fully extracted, consider making WritingTimeline exclusively owned by WritingScript. Production Script.js (breakdown mode) likely doesn't need a writing timeline.
- **Fix now or defer?** Defer.

---

## R-07: `stemWord` Function Defined Twice

- **Title:** `stemWord` defined in App.js AND imported/re-exported from utils.js
- **Description:** App.js:2151 defines a local `stemWord` function. `src/utils.js` also exports `stemWord` (imported at App.js:2). The local definition in App.js shadows/re-implements the one in utils.js. Script.js imports `stemWord` from utils.js (Script.js:2). Props.js receives `stemWord` as a prop from App.js, which passes the local App.js version.
- **Affected files:**
  - `src/App.js` (line 2151)
  - `src/utils.js`
- **Risk level:** LOW — if both implementations match, no bug. If they ever diverge, the prop-passed version and the utils.js version will produce different results.
- **Recommended cleanup:** Remove the local App.js `stemWord` definition. Import from utils.js and pass that to Props.js.
- **Fix now or defer?** Defer — low risk, no current divergence.

---

## R-08: Realtime Presence Channel Collision

- **Title:** Script.js and WritingScript.jsx connect to the same presence channel with the same `moduleName`
- **Description:** Both components call `usePresence(selectedProject?.id, user, "script", currentSceneNumber)`. This means users working in Writing mode and users working in Script Breakdown both appear as "script" presence to each other, and both see each other's cursors/avatars even though they are in different workflow tabs.
- **Affected files:**
  - `src/components/modules/Script/Script.js` (line 96)
  - `src/components/modules/WritingScript/WritingScript.jsx` (line 355)
  - `src/hooks/usePresence.js` (line 41, channel name `presence_${projectId}`)
- **Risk level:** MEDIUM — confusing user experience, not a data corruption issue.
- **Recommended cleanup:** Use distinct module names: `"scriptBreakdown"` and `"writingScript"`. Or, if both should share a presence channel, make the channel name intentionally unified and use `moduleName` only for display labels.
- **Fix now or defer?** Defer — known bug, low urgency.

---

## R-09: `syncLocks` Ref Passed as Prop to StripboardSchedule

- **Title:** App-internal sync lock state is exposed to a child module
- **Description:** App.js:4412 passes `syncLocks={syncLocks}` (a `useRef`) to StripboardScheduleModule. This breaks the encapsulation of the sync lock system — StripboardSchedule can observe and mutate the lock state directly, bypassing the wrapper functions in App.js.
- **Affected files:**
  - `src/App.js` (line 4412)
  - `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- **Risk level:** HIGH — if StripboardSchedule sets a lock incorrectly, it could cause a permanent sync-dead state (all realtime reloads blocked).
- **Recommended cleanup:** Do not pass `syncLocks` as a prop. If StripboardSchedule needs to prevent realtime interference during a sync, expose a discrete `onSyncStart` / `onSyncEnd` callback pair instead.
- **Fix now or defer?** Defer until StripboardSchedule is refactored, but document clearly.

---

## R-10: Excessive Debug Logging in Production Code

- **Title:** `syncScriptLocationsToDatabase` has debug log spam left in
- **Description:** `database.js` lines 1251–1291 contain repeated `console.log` calls with "🔍 EXACT DATA BEING SENT TO RPC" (appears twice), location-specific UUID lookups for hardcoded location IDs (`script_location_1762107556378_*`), and full JSON stringify of data being sent.
- **Affected files:**
  - `src/services/database.js` (lines 1251–1291)
- **Risk level:** LOW (functional) / MEDIUM (security — logs full location data to console in production).
- **Recommended cleanup:** Remove all debug `console.log` calls in this function except the start/success/error messages.
- **Fix now or defer?** Fix now — console log cleanup is safe.

---

## R-11: `autoDetectCharacters` Duplicates Scene-Scanning Logic

- **Title:** Character auto-detection logic duplicates what TaggedItems already does
- **Description:** App.js:1919 defines `autoDetectCharacters` which scans all `scenes[].content` blocks looking for `block.type === "Character"`. This is a duplicate traversal of the same data already available in `taggedItems` (which has `category: "Cast"`). The function is not clearly called on any recurring basis — its invocation pattern is uncertain.
- **Affected files:**
  - `src/App.js` (lines 1919–1983)
- **Risk level:** LOW — orphaned/rarely-used feature.
- **Recommended cleanup:** Evaluate whether `autoDetectCharacters` is still used (no grep hits found for callers outside its definition). If unused, remove it.
- **Fix now or defer?** Defer — verify usage first.

---

## H-01: Writing Draft Has No Database Persistence

- **Title:** Writing draft nodes are localStorage-only — no Supabase backup
- **Description:** `writingDraftNodes` (the writing script content) is persisted only to `localStorage`. There is no database table for writing draft content. If a user clears localStorage or switches browsers, all writing work is lost.
- **Affected files:**
  - `src/components/modules/WritingScript/writingDraftPersistence.js`
  - `src/components/modules/WritingScript/WritingScript.jsx`
- **Risk level:** HIGH — potential complete data loss.
- **Recommended cleanup:** Add a `writing_drafts` Supabase table. Use the same load/sync pattern as other modules. Keep localStorage as a fast local cache, sync to DB on debounce.
- **Fix now or defer?** Should be prioritized as a near-term feature.

---

## H-02: Beats Have No Database Persistence

- **Title:** Beat sheet is localStorage-only
- **Description:** Same issue as H-01 — `scriptBeats:${projectId}` is localStorage-only with no Supabase backup.
- **Risk level:** HIGH — potential complete data loss of outline/story structure.
- **Recommended cleanup:** Add `writing_beats` Supabase table or extend `writing_drafts` to include beats.
- **Fix now or defer?** Same priority as H-01.

---

## H-03: `WritingCharacters` Module Is Unused

- **Title:** `src/components/modules/WritingCharacters/` directory exists but its module is not mounted
- **Description:** The Writing sidebar in App.js shows a disabled "Characters" button (App.js:4930–4962). The `WritingCharacters` directory exists but its content was not read in detail. It is not imported or mounted anywhere in the current render tree.
- **Affected files:**
  - `src/components/modules/WritingCharacters/` (directory)
  - `src/App.js` (lines 4930–4963 — disabled button)
- **Risk level:** LOW — dead code.
- **Recommended cleanup:** If not planned in the near term, consider removing the directory to reduce confusion. If planned, add a ticket.
- **Fix now or defer?** Defer — note existence.

---

## H-04: StripboardSchedule Receives Too Many Raw Setters

- **Title:** StripboardSchedule has direct write access to 4 App state arrays
- **Description:** StripboardSchedule receives `setShootingDays`, `setScheduledScenes`, `setStripboardScenes`, `setScenes`, plus `saveScenesDatabase`, `onSyncStripboardScenes`, `onSyncScheduledScenes`, `onSyncAllShootingDays`, `syncShootingDays`. Nine separate write-path props for schedule-related state. This means any StripboardSchedule bug can corrupt any of the four core production arrays.
- **Affected files:**
  - `src/App.js` (lines 4408–4433)
  - `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- **Risk level:** HIGH.
- **Recommended cleanup:** Create a `useStripboardScheduleHandlers` hook in App.js that centralizes all scheduling mutations. Pass only that hook's stable callbacks to StripboardSchedule.
- **Fix now or defer?** Defer until StripboardSchedule is refactored.

---

## H-05: Timeline Module Can Trigger Scene Saves

- **Title:** Production Timeline module receives `onUpdateScenes` which calls `saveScenesDatabase`
- **Description:** App.js:4837 passes an inline callback to Timeline that calls `setScenes(updatedScenes)` then `saveScenesDatabase(updatedScenes)`. The production Timeline (a continuity/character tracking view) should not typically need to modify the canonical scene array.
- **Affected files:**
  - `src/App.js` (lines 4837–4840)
  - `src/components/modules/Timeline/Timeline.js`
- **Risk level:** MEDIUM — unclear when Timeline triggers this; if misused it could corrupt scene content.
- **Recommended cleanup:** Clarify what Timeline uses `onUpdateScenes` for. If it is only for updating `timelineStartPage` per scene, convert to an atomic `database.updateSceneTimelineStartPage` call instead.
- **Fix now or defer?** Investigate Timeline usage before fixing.

---

## H-06: `calendarExpandedSections` Not Project-Scoped

- **Title:** Calendar localStorage key is shared across all projects
- **Description:** Calendar.js uses `localStorage.getItem("calendarExpandedSections")` with no project ID. All projects share the same expanded/collapsed state.
- **Affected files:**
  - `src/components/modules/Calendar/Calendar.js` (lines 13–18)
- **Risk level:** LOW.
- **Recommended cleanup:** Change to `calendarExpandedSections:${selectedProject?.id}`.
- **Fix now or defer?** Defer.

---

## H-07: No PreProduction vs Production Workflow Divergence

- **Title:** PreProduction and Production workflows render identical content
- **Description:** App.js:4875 checks `isWritingWorkflow` and renders either the Writing sidebar+WritingScript, or the Production sidebar+`renderModule()`. But `renderModule()` is the same function regardless of whether `activeWorkflow` is "preProduction" or "production". The `PreProductionWorkspace` and `ProductionWorkspace` wrappers both just pass children through.
- **Affected files:**
  - `src/App.js` (line 4875, 4990–5268)
  - `src/components/workspace/PreProductionWorkspace.jsx`
  - `src/components/workspace/ProductionWorkspace.jsx`
- **Risk level:** LOW (current behavior matches expectations — both tabs show same modules), but blocks future differentiation.
- **Recommended cleanup:** When pre-production vs production module sets diverge, split `renderModule()` to filter by workflow.
- **Fix now or defer?** Defer — design decision needed first.

---

## H-08: `window.__setCallSheetInitialDay` and `window.forceScriptLocationsReload` Global Escapes

- **Title:** Two global `window` properties used as inter-component communication escapes
- **Description:** App.js:1681–1683 sets `window.__setCallSheetInitialDay` as a way for child components to trigger navigation to a specific call sheet day. App.js:673 sets `window.forceScriptLocationsReload` as a post-sync reload trigger. Both bypass React's prop/callback system.
- **Affected files:**
  - `src/App.js` (lines 673, 1681–1683)
- **Risk level:** MEDIUM — these globals survive component unmount and could be called after a project change or component teardown.
- **Recommended cleanup:** Replace both with proper React callbacks or a lightweight event bus. `callSheetInitialDay` is already in App state — StripboardSchedule should call a passed `onNavigateToCallSheet(dayNumber)` callback.
- **Fix now or defer?** Defer — low urgency but creates unmaintainable patterns.

---

## H-09: `showBeatsTrack` State Not Persisted in WritingScript

- **Title:** `showBeatsTrack` (beat track panel visibility) resets on reload in WritingScript
- **Description:** WritingScript.jsx:488 initializes `showBeatsTrack` to `false` with no load from localStorage. This means the beats track panel always collapses on page reload, even if the user had it open.
- **Affected files:**
  - `src/components/modules/WritingScript/WritingScript.jsx` (line 488)
- **Risk level:** LOW — UX annoyance only.
- **Recommended cleanup:** Add `showBeatsTrack` to the localStorage load/save pattern alongside other WritingScript prefs.
- **Fix now or defer?** Defer.

---

## 2026-05-16 Audit Completion Addendum

## H-10: WritingScript Body/Action Persistence Regression

- **Title:** WritingScript body/action text appears not to persist on reload
- **Description:** Manual test after Phase 4M found that scene heading reloads, but body/action text appears to be lost. The current source has both `WritingScript.jsx` direct localStorage persistence and `useWritingDraftState.js`; active WritingScript appears to use the direct implementation.
- **Affected files:**
  - `src/components/modules/WritingScript/WritingScript.jsx`
  - `src/components/modules/WritingScript/WritingScriptEditor.jsx`
  - `src/components/modules/WritingScript/writingDraftPersistence.js`
- **Risk level:** CRITICAL — active user writing can be lost.
- **Recommended cleanup:** Fix first. Verify editor node changes include body/action text before adding more writing UI work.
- **Fix now or defer?** Fix next.

## H-11: WritingScript Still Imports Editor Through Legacy Script Path

- **Title:** `WritingScript.jsx` imports `../Script/ScriptWritingEditor`
- **Description:** `ScriptWritingEditor.jsx` under Script is a compatibility re-export, but the active WritingScript route should ideally import `./WritingScriptEditor` directly to avoid implying ownership flows through the legacy Script module.
- **Affected files:**
  - `src/components/modules/WritingScript/WritingScript.jsx`
  - `src/components/modules/Script/ScriptWritingEditor.jsx`
- **Risk level:** LOW.
- **Recommended cleanup:** Change import in a behavior-neutral cleanup phase after persistence bug is fixed.
- **Fix now or defer?** Defer.

## H-12: Mobile App Duplicates Desktop Data Ownership

- **Title:** MobileApp has separate activeModule/data loading and module implementations
- **Description:** `src/components/mobile/MobileApp.js` owns its own auth/project/module state and loads several production domains independently. Desktop refactors to scene identity, schedule shapes, call sheet shape, props data, or wardrobe data can break mobile silently.
- **Affected files:**
  - `src/components/mobile/MobileApp.js`
  - `src/App.js`
  - `src/services/database.js`
- **Risk level:** HIGH.
- **Recommended cleanup:** Add mobile coverage to every scene/schedule/call sheet/props regression pass. Long term, share data adapters instead of duplicating load/render assumptions.
- **Fix now or defer?** Defer, but test before commits that touch shared data shapes.

## H-13: Non-Project-Scoped UI Preferences

- **Title:** Several UI preference keys leak across projects
- **Description:** `scriptMoodOverlayEnabled`, `scriptMoodOverlaySettings`, `calendarExpandedSections`, `stripboard_prefs_v1`, and `timeline-view-collapsed-${selectedTimeline}` are not project-scoped.
- **Affected files:**
  - `src/components/modules/Script/Script.js`
  - `src/components/modules/WritingScript/WritingScript.jsx`
  - `src/components/modules/Calendar/Calendar.js`
  - `src/components/modules/Stripboard/Stripboard.js`
  - `src/components/modules/Timeline/Timeline.js`
- **Risk level:** LOW to MEDIUM.
- **Recommended cleanup:** Project-scope preferences during a dedicated storage migration pass.
- **Fix now or defer?** Defer.
