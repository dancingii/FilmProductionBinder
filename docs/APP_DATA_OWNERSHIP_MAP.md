# App Data Ownership Map

Source of truth for each data domain — who reads, who writes, how it persists.

---

## selectedProject

- **Source of truth:** `AuthWrapper.js` useState (line 127)
- **Who reads it:** App.js (receives as prop); all modules that need `selectedProject.id` for database calls receive it as a prop.
- **Who writes it:** `AuthWrapper` — set when user selects project in `ProjectSelector`, or set to null when "Projects" button clicked.
- **Persistence:** None (session only — reload returns to project selector).
- **UI modules affected:** All.
- **Type:** Production-facing AND writing.
- **Notes:** The object shape includes `{ id, name, userRole, modulePermissions }`. App.js re-triggers all database loads via `useEffect` on `selectedProject?.id`.

---

## user / userRole / modulePermissions

- **Source of truth:** `AuthWrapper.js` useState (lines 125–130).
- **Who reads it:** App.js (receives as props), passed down to nearly every module.
- **Who writes it:** `AuthWrapper` — `userRole`/`modulePermissions` set when project is selected (line 990–991). `user` set from Supabase auth session.
- **Persistence:** Supabase auth session (survives page reload). `userRole` and `modulePermissions` re-fetched from project membership on project select.
- **UI modules affected:** Access control in `renderModule()` (App.js:4321–4323) and within each module (`canEdit`, `isViewOnly` derived).
- **Type:** Shared.
- **Notes:** `getAccessibleModules()` in App.js uses userRole + modulePermissions to filter sidebar module list. "custom" role uses `modulePermissions` array. Role-to-module map defined at App.js:104–112.

---

## activeWorkflow

- **Source of truth:** `AuthWrapper.js` useState (line 132), default "writing".
- **Who reads it:** App.js (receives as prop), WorkflowWorkspace, WorkflowTabs.
- **Who writes it:** `WorkflowTabs` → `onWorkflowChange` → `setActiveWorkflow` in AuthWrapper.
- **Persistence:** None (session only — reloads return to "writing").
- **UI modules affected:** Entire rendering tree — determines whether Writing or Production sidebar/content renders.
- **Type:** Shared navigation state.
- **Notes:** Switching workflows does NOT reset `activeModule` or `writingActiveModule`.

---

## activeModule

- **Source of truth:** App.js useState (line 1676), default "Dashboard".
- **Who reads it:** App.js `renderModule()`, sidebar button highlight.
- **Who writes it:** Sidebar button clicks (App.js:5235), `setActiveModule` callbacks passed to Dashboard, StripboardSchedule, Characters, Locations, ShotList, Wardrobe, CastCrew (for cross-module navigation shortcuts).
- **Persistence:** None.
- **UI modules affected:** Determines which production module renders.
- **Type:** Production navigation.

---

## writingActiveModule

- **Source of truth:** App.js useState (line 1677), default "Script".
- **Who reads it:** Writing sidebar (App.js:4916–4963), writing content area selector.
- **Who writes it:** Writing sidebar buttons only.
- **Persistence:** None.
- **UI modules affected:** Writing content area only.
- **Type:** Writing navigation.
- **Notes:** Only "Script" is functional. "Moodboard" and "Characters" buttons are disabled.

---

## scenes

- **Source of truth:** App.js useState (line 123), loaded from Supabase `scenes` table.
- **Who reads it:** Script/ScriptBreakdown (editing), Dashboard, Timeline, Locations (mainScenes), Wardrobe, Characters, CostReport, Reports, StripboardSchedule.
- **Who writes it:**
  - App.js `setScenes` directly (FDX import, scene insert/delete/reorder handlers, realtime reload).
  - Script.js via `setScenes` prop (edit mode save).
  - Locations via `setMainScenes` prop (heading edits).
  - StripboardSchedule via `setScenes` prop.
  - Timeline via `onUpdateScenes` callback (calls `setScenes` + `saveScenesDatabase`).
- **Persistence:** Supabase `scenes` table. Save via `saveScenesDatabase` (App.js:1027).
- **Save function:** `database.saveScenesDatabase` wrapped in App.js `saveScenesDatabase` with sync lock.
- **Type:** Production-facing (writing draft is SEPARATE — see writingDraftNodes).
- **Known duplication:** `stripboardScenes` is a parallel copy. On load, stripboard scenes are merged from the `scenes` load.
- **Risk:** Multiple modules receive `setScenes` directly — any can overwrite all scenes state without going through `saveScenesDatabase`.

---

## editingScenes

- **Source of truth:** Script.js local useState (Script.js ~line 2930–2940, uncertain exact line).
- **Who reads it:** Script.js only (edit mode buffer).
- **Who writes it:** Script.js scene editor.
- **Persistence:** None — saved to `scenes` (App state) + database on explicit save action.
- **Type:** Production intermediate state.

---

## writingDraftNodes

- **Source of truth:** WritingScript.jsx useState (line 467) AND Script.js useState (line 3000). Two separate instances.
- **Who reads it:** WritingScript.jsx (writing mode), Script.js (writing sub-mode when `scriptWorkflowMode === "writing"`).
- **Who writes it:** Within their respective components only — no cross-component write.
- **Persistence:** localStorage key `scriptWritingDraft:${projectId}` — BOTH components use the same key with the same format.
- **Save function:** WritingScript saves on debounce; Script.js saves on editor change.
- **Type:** Writing-only.
- **Known duplication/ambiguity (CRITICAL):** Two components write to the same localStorage key. The last one to write wins. If both are loaded simultaneously (uncertain if possible), they would collide.

---

## writingDraftScenes

- **Source of truth:** Derived (memoized) in WritingScript.jsx (line 645) and Script.js (line 3033) from their respective `writingDraftNodes`.
- **Type:** Writing-only derived state.
- **Notes:** NOT the same as `scenes`. Never persisted to database.

---

## stripboardScenes

- **Source of truth:** App.js useState (line 1684).
- **Who reads it:** Stripboard (as `scenes` prop), StripboardSchedule, ShotList, Characters, DayOutOfDays, Calendar, CostReport, Reports, Dashboard.
- **Who writes it:**
  - App.js `setStripboardScenes` on load (merged from `scenes` + `stripboard_scenes` DB table).
  - App.js handlers: scene insert/delete/reorder.
  - StripboardSchedule via `setStripboardScenes` prop.
  - Script.js via `setStripboardScenes` prop.
  - App.js on FDX import.
- **Persistence:** Supabase `stripboard_scenes` table. Save via `syncStripboardScenesToDatabase`.
- **Type:** Production-facing.
- **Notes:** Loaded as a merge of `scenes` + `stripboard_scenes` DB rows. The `stripboardScenes` array mirrors `scenes` but adds `status`, `scheduledDate`, `scheduledTime`. Divergence between `scenes` and `stripboardScenes` is a known source of bugs.

---

## scheduledScenes

- **Source of truth:** App.js useState (line 1685), object keyed by date string `YYYY-MM-DD`.
- **Who reads it:** StripboardSchedule, CallSheet, Calendar, DayOutOfDays, Dashboard, Reports, ShotList.
- **Who writes it:**
  - StripboardSchedule via `setScheduledScenes` prop.
  - App.js `scheduleScene` / `unscheduleScene` handlers.
- **Persistence:** Supabase `scheduled_scenes` table. Save via `syncScheduledScenesToDatabase`.
- **Type:** Production-facing.

---

## shootingDays

- **Source of truth:** App.js useState (line 1697), default one placeholder day.
- **Who reads it:** StripboardSchedule, CallSheet, Calendar, DayOutOfDays, Dashboard, Reports, ShotList, Stripboard (passed as prop).
- **Who writes it:**
  - StripboardSchedule via `setShootingDays` prop.
  - App.js `syncAllShootingDaysToDatabase` wrapper.
- **Persistence:** Supabase `shooting_days` table.
- **Type:** Production-facing.
- **Notes:** Each day has `{ id (UUID), date, dayNumber, scheduleBlocks, isLocked, isShot, isCollapsed }`. `scheduleBlocks` contains scene refs.

---

## callSheetData

- **Source of truth:** App.js useState (line 1815).
- **Who reads it:** CallSheet, Dashboard, DayOutOfDays (partially).
- **Who writes it:**
  - CallSheet via `setCallSheetData` prop.
  - App.js `updateCrewCallTime` helper.
- **Persistence:** Supabase `call_sheet_data` table. Save via `syncCallSheetDataToDatabase`.
- **Type:** Production-facing.

---

## taggedItems

- **Source of truth:** App.js useState (line 1694), object keyed by normalized word/phrase stem.
- **Who reads it:** Script/ScriptBreakdown, Props, Makeup, ProductionDesign, CallSheet, Reports, Characters, Stripboard.
- **Who writes it:**
  - App.js `tagWord` and `untagWordInstance` functions (only entry points to mutation).
  - Props / Makeup / ProductionDesign via `onUpdateTaggedItems` (= `setTaggedItems`) and `onSyncTaggedItems` callbacks.
- **Persistence:** Supabase `tagged_items` table. Save via `syncTaggedItemsToDatabase`.
- **Type:** Production-facing (script breakdown).
- **Notes:** Each entry: `{ displayName, customTitle, category, color, chronologicalNumber, categoryNumber, position, scenes (sceneNumbers), sceneIds, instances (instance IDs), assignedCharacters, manuallyCreated, photos, propId, ... }`.

---

## characters

- **Source of truth:** App.js useState (line 1726), object keyed by character name string.
- **Who reads it:** Script/ScriptBreakdown, Characters, CallSheet, ShotList, Wardrobe, DayOutOfDays, Stripboard.
- **Who writes it:**
  - App.js `autoDetectCharacters` (reads from `scenes`).
  - Characters module via `setCharacters` prop.
  - Script.js via `setCharacters` prop.
- **Persistence:** Supabase `characters` table. Save via `syncCharactersToDatabase`.
- **Type:** Production-facing.

---

## castCrew

- **Source of truth:** App.js useState (line 1705), array of person objects.
- **Who reads it:** CallSheet, CastCrew, Characters, ShotList, Timeline, DayOutOfDays, Dashboard, Wardrobe, StripboardSchedule.
- **Who writes it:**
  - CastCrew via `setCastCrew` prop.
  - Wardrobe via `setCastCrew` prop (for wardrobe-per-character).
  - CallSheet via `onUpdateCastCrew` callback.
- **Persistence:** Supabase `cast_crew` and `cast_crew_availability` tables.
- **Type:** Production-facing.

---

## scriptLocations / actualLocations

- **Source of truth:** App.js useState (lines 1693, 1696).
- **scriptLocations:** Derived from scene headings — list of unique `{ parentLocation, subLocation, intExt, scenes, ... }`.
- **actualLocations:** Physical location addresses — manually created.
- **Who reads it:** Locations module, CallSheet, ProductionDesign.
- **Who writes it:**
  - Locations via `setScriptLocations`, `setActualLocations` props.
  - App.js heading update inline callbacks.
- **Persistence:** Supabase `script_locations` and `actual_locations` tables.
- **Type:** Production-facing.

---

## props / makeup / productionDesign

- **Persistence model:** These are NOT stored as separate state arrays. They are DERIVED from `taggedItems` filtered by category ("Props", "Makeup", "Production Design").
- **Source of truth:** `taggedItems` in App.js.
- **Who reads category-filtered views:** Props.js, Makeup.js, ProductionDesign.js modules.
- **Who writes:** Via `onUpdateTaggedItems` / `onSyncTaggedItems` props (same as taggedItems).
- **Type:** Production-facing.

---

## wardrobeItems / garmentInventory

- **Source of truth:** App.js useState (lines 1827, 1828).
- **Who reads it:** Wardrobe, Characters.
- **Who writes it:** Wardrobe via `setWardrobeItems`, `setGarmentInventory` props.
- **Persistence:** Supabase `wardrobe_items` and `garment_inventory` tables. Data stored as JSON blob in `item_data` / `garment_data` columns.
- **Type:** Production-facing.

---

## reports

- **Persistence model:** No dedicated state — Reports module is read-only, derived from `shootingDays`, `scheduledScenes`, `stripboardScenes`, `taggedItems`, `wardrobeItems`, `scenes`.
- **Type:** Production-facing read-only.

---

## budgetData / costCategories / costVendors

- **Source of truth:** App.js useState (lines 1744, 1769, 1807).
- **Who reads it:** Budget, CostReport.
- **Who writes it:**
  - Budget via `setBudgetData`, `onSyncBudgetData` props.
  - CostReport via `setCostCategories`, `setCostVendors`, `onSyncCostCategories`, `onSyncCostVendors` props.
  - App.js `syncBudgetToCostCategories` auto-syncs budget departments → cost categories on budget save.
- **Persistence:** Supabase `budget_data`, `cost_categories`, `cost_vendors` tables.
- **Type:** Production-facing.
- **Notes:** Budget-to-CostCategories sync is one-directional (budget changes auto-push to cost categories). Manual cost category expenses are preserved.

---

## moodboardImages

- **Source of truth:** App.js `scriptMoodImages` useState (line 126), populated by MoodBoard's `onMoodboardDataChange` callback.
- **Who reads it:** ScriptBreakdown receives as `moodboardImages` prop; Script.js uses for mood overlay.
- **Who writes it:** MoodBoard module — calls `onMoodboardDataChange({ images })` on save.
- **Persistence:** Supabase `moodboard_data` table + localStorage `moodboard-${projectId}` fallback. (Moodboard manages its own persistence.)
- **Type:** Shared (writing references moodboard images in overlay).

---

## shotListData / sceneNotes

- **Source of truth:** App.js useState (lines 1728, 1729).
- **Who reads it:** ShotList.
- **Who writes it:** ShotList via `setShotListData`, `setSceneNotes` props.
- **Persistence:** Supabase `shot_list_data` table (single JSON blob row per project).
- **Type:** Production-facing.

---

## timelineData

- **Source of truth:** App.js useState (line 1742).
- **Who reads it:** Timeline module.
- **Who writes it:** Timeline via `setTimelineData` prop.
- **Persistence:** Supabase `timeline_data` table.
- **Type:** Production-facing (NOT the writing timeline — that is `writingDraftNodes`).

---

## continuityElements

- **Source of truth:** App.js useState (line 1743).
- **Who reads it:** Timeline, Characters.
- **Who writes it:** Timeline via `setContinuityElements` prop.
- **Persistence:** Supabase `continuity_elements` table.
- **Type:** Production-facing.

---

## doodCastEvents / doodOverrides / doodSettings

- **Source of truth:** App.js useState (lines 1706–1708).
- **Who reads it:** DayOutOfDays, Calendar.
- **Who writes it:** DayOutOfDays via `setDoodCastEvents`, `setDoodOverrides`, `setDoodSettings` props.
- **Persistence:** Supabase `dood_cast_events`, `dood_overrides`, `dood_settings` tables (uncertain — loaded via `database.loadDoodCastEvents` etc.).
- **Type:** Production-facing.

---

## beats

- **Source of truth:** WritingScript.jsx useState (line 486) AND Script.js useState (uncertain line ~3200).
- **Who reads it:** Beat panel in each respective component.
- **Who writes it:** Each component independently.
- **Persistence:** localStorage `scriptBeats:${projectId}` — BOTH components use the same key.
- **Type:** Writing-only.
- **Known duplication (HIGH):** Same key, two writers. See writingDraftNodes notes.

---

## timelinePositions (writing timeline scene positions)

- **Source of truth:** Script.js localStorage (read at line 3412).
- **Persistence:** localStorage `scriptTimelinePositions:${projectId}`.
- **Who reads/writes:** Script.js only (WritingScript uses its own internal timeline state — uncertain if WritingTimeline.jsx persists positions independently).
- **Type:** Writing-only.

---

## revisions

- **Source of truth:** Uncertain. Script.js imports `WGA_COLORS` and `getRevisionColor` (lines 33–45). Revision data shape and persistence not confirmed from available source reads.
- **Persistence:** Uncertain.
- **Type:** Uncertain.

---

## projectSettings

- **Source of truth:** App.js useState (line 1764).
- **Who reads it:** Dashboard, CallSheet, Reports.
- **Who writes it:** Dashboard, CallSheet via `setProjectSettings` prop; App.js `syncProjectSettingsToDatabase`.
- **Persistence:** Supabase `projects` table `settings` JSONB column.
- **Type:** Shared.

---

## todoItems

- **Source of truth:** App.js useState (line 1730).
- **Who reads it:** ToDoList, Dashboard, Calendar.
- **Who writes it:** ToDoList via `setTodoItems` prop.
- **Persistence:** Supabase `todo_items` table.
- **Type:** Shared.

---

## 2026-05-16 Audit Completion Addendum

### Ownership Corrections / Clarifications

#### writingActiveModule

- **Source of truth:** `App.js` useState (`src/App.js:1677`).
- **Readers:** No active readers found in the final grep pass.
- **Writers:** `setWritingActiveModule` state setter exists but no active call sites were found.
- **Persistence:** None.
- **Type:** Writing-only intent, currently stale/uncertain.
- **Duplication/ambiguity:** This may be leftover from an earlier Writing sidebar plan. Do not build new behavior on it without confirming the intended Writing module navigation model.

#### WritingScript local draft data

- **Source of truth:** `WritingScript.jsx` active route state for Writing workflow; `useWritingDraftState.js` also exists but active `WritingScript.jsx` currently owns a local save implementation directly.
- **Readers:** WritingScript editor, writing scene derivation, writing scene list, writing timeline, writing page stats.
- **Writers:** `WritingScript.handleWritingDraftNodesChange`.
- **Persistence:** localStorage `scriptWritingDraft:${projectId}`.
- **Type:** Writing-only.
- **Duplication/ambiguity:** Legacy `Script.js` still reads/writes the same draft key. This is the largest writing data ownership hole.

#### Script Breakdown legacy writing data

- **Source of truth:** Legacy `Script.js` still has `scriptWorkflowMode`, `writingDraftNodes`, beats, writing timeline positions, target page count, side panel tab, collapsed acts, and mood overlay state.
- **Readers/writers:** Only when the legacy Script component is mounted as Script Breakdown.
- **Persistence:** Same localStorage key family as WritingScript.
- **Type:** Should become production-only, but currently mixed.
- **Duplication/ambiguity:** High. Do not remove before WritingScript persistence is fixed and verified.

#### Mobile production data

- **Source of truth:** `MobileApp.js` duplicates desktop state for several domains.
- **Readers:** Mobile dashboard, call sheet, wardrobe, props, cost report.
- **Writers:** Mobile module-specific callbacks and database functions.
- **Persistence:** Supabase/database functions.
- **Type:** Production-facing mobile path.
- **Duplication/ambiguity:** Scene identity and schedule data changes must be tested on mobile separately.

### Ownership Holes

1. **Production scenes are too broadly writable.** `setScenes` and `saveScenesDatabase` are passed into Script Breakdown, StripboardSchedule, Locations, Timeline, and import paths.
2. **Stripboard/Schedule are split across three domains.** `stripboardScenes`, `scheduledScenes`, and `shootingDays.scheduleBlocks` can represent overlapping scheduling truth.
3. **Writing and legacy Script share localStorage.** WritingScript and Script.js both write `scriptWritingDraft:${projectId}`, `scriptBeats:${projectId}`, and several settings keys.
4. **Characters are production-facing only today.** There is no active Writing Characters data domain yet.
5. **Pre-Production vs Production ownership is not split.** Both workflows use the same module system and state.
