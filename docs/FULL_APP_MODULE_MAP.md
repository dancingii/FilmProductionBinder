# Full App Module Map

Generated from source audit — 2026-05-16.
"Uncertain" marks areas where ownership could not be fully confirmed from source.

---

## CORE

### App.js
- **File:** `src/App.js` (5479 lines)
- **Purpose:** Root application component. Owns all global state, all database sync functions (wrapped with sync locks), the entire rendering tree, and workflow/module navigation.
- **Parent:** `AuthWrapper` mounts it via `React.cloneElement`.
- **Props received:** `selectedProject`, `userRole`, `modulePermissions`, `user`, `activeWorkflow` (default: "writing")
- **State owned internally (major):**
  - `scenes` / `scenesLoaded` / `isSavingScenes`
  - `stripboardScenes`
  - `scheduledScenes` (object keyed by date)
  - `shootingDays`
  - `castCrew`
  - `characters` / `characterSceneOverrides`
  - `taggedItems`
  - `scriptLocations` / `actualLocations`
  - `callSheetData`
  - `wardrobeItems` / `garmentInventory` / `garmentCategories`
  - `costCategories` / `costVendors` / `budgetData`
  - `shotListData` / `sceneNotes`
  - `timelineData`
  - `continuityElements`
  - `todoItems` / `todoCategories`
  - `projectSettings`
  - `doodCastEvents` / `doodOverrides` / `doodSettings`
  - `scriptMoodImages`
  - `activeModule` (production sidebar nav, default "Dashboard")
  - `writingActiveModule` (writing sidebar nav, default "Script")
  - `editingLocks`
  - `appAlert` (global confirm/alert modal state)
  - `callSheetInitialDay`
  - `crewSortOrder`
  - `currentIndex`
- **Database reads:** All 20 tables loaded on `selectedProject` change — see STORAGE_AND_DATABASE_MAP.
- **Database writes:** All sync functions wrapped in `syncLocks` ref pattern; see CALLBACK_AND_MUTATION_MAP.
- **localStorage reads/writes:** `appVersion` (inline read in sidebar, line ~5206); sessionStorage keys `stripboard-schedule-scroll-position`, `stripboard-scroll-position` (cleared on mount, line ~159).
- **Dependent modules (imports from):** All module components, all workspace components, all utils, database.js, supabase.js, usePresence.js.
- **Modules that depend on it:** None — it is the root.
- **Known coupling risks:**
  - `syncLocks` is a `useRef` passed directly to `StripboardScheduleModule` as a prop (`syncLocks={syncLocks}`), making lock state partially external. App.js:4412.
  - `window.__setCallSheetInitialDay` global escape hatch (App.js:1681–1683).
  - `window.forceScriptLocationsReload` global attached in realtime setup (App.js:673).
  - Realtime reload handlers close over `scenes` directly (App.js:393), creating potential stale closure risk.

---

### AuthWrapper.js
- **File:** `src/components/auth/AuthWrapper.js`
- **Purpose:** Handles Supabase auth session, project selection, user display name, workflow tab bar, and team management modal.
- **Parent:** Root index/entry point (wraps `<App />`).
- **Props received:** `children` (App component)
- **State owned internally:**
  - `user`, `loading`, `selectedProject`, `userRole`, `modulePermissions`
  - `activeWorkflow` (state here, passed to App as prop)
  - `showTeamModal`, auth form fields (email, password, names, isLogin)
- **Props passed down:** `selectedProject`, `userRole`, `modulePermissions`, `user`, `activeWorkflow` injected into children via `React.cloneElement`.
- **Database reads:** `supabase.auth.getSession()`, `users` table for display name.
- **localStorage:** None directly.
- **Known coupling risks:** `activeWorkflow` state lives here but is consumed deeply in App.js — workflow switching does not preserve active module state.

---

### database.js
- **File:** `src/services/database.js` (3779 lines)
- **Purpose:** Pure service layer. All Supabase table reads (load functions) and writes (sync/atomic functions). No React state — only accepts state setters as parameters.
- **Key exports (load):** `loadScenesFromDatabase`, `loadStripboardScenesAfterScenes`, `loadCastCrewFromDatabase`, `loadTaggedItemsFromDatabase`, `loadProjectSettingsFromDatabase`, `loadShootingDaysFromDatabase`, `loadCharactersFromDatabase`, `loadActualLocationsFromDatabase`, `loadScriptLocationsFromDatabase`, `loadCallSheetDataFromDatabase`, `loadWardrobeItemsFromDatabase`, `loadGarmentInventoryFromDatabase`, `loadCostCategoriesFromDatabase`, `loadCostVendorsFromDatabase`, `loadBudgetDataFromDatabase`, `loadTodoItemsFromDatabase`, `loadShotListDataFromDatabase`, `loadScheduledScenesFromDatabase`, `loadContinuityElementsFromDatabase`, `loadDoodCastEvents`, `loadDoodOverrides`, `loadDoodSettings`.
- **Key exports (sync):** `saveScenesDatabase`, `syncStripboardScenesToDatabase`, `syncScheduledScenesToDatabase`, `syncShootingDaysToDatabase`, `syncScriptLocationsToDatabase`, `syncActualLocationsToDatabase`, `syncCastCrewToDatabase`, `syncCallSheetDataToDatabase`, `syncCharactersToDatabase`, `syncWardrobeItemsToDatabase`, `syncGarmentInventoryToDatabase`, `syncCostCategoriesToDatabase`, `syncCostVendorsToDatabase`, `syncBudgetDataToDatabase`, `syncShotListDataToDatabase`, `syncTimelineDataToDatabase`, `syncContinuityElementsToDatabase`, `syncTodoItemsToDatabase`, `syncProjectSettingsToDatabase`.
- **Atomic/granular exports:** `updateStripboardSceneStatus`, `updateStripboardSceneSchedule`, `updateSceneStatus`, `updateSceneHeading`, `updateSceneTimeOfDay`, `updateSceneDescription`, `updateSceneNotes`, `addCastCrewPerson`, `updateCastCrewPerson`, `deleteCastCrewPerson`, `addAvailabilityDateSafe`, `removeAvailabilityDateSafe`, `upsertCharacter`, `deleteCharacter`, `updateShootingDayLockStatus`, `updateShootingDayShotStatus`, `deleteShootingDay`, and more.
- **localStorage reads/writes:** `lastAvailabilityCleanup_${projectId}` key in `checkAndRunDailyAvailabilityCleanup` (lines 1860–1876). This is a project-scoped cleanup date guard.
- **Known coupling risks:** `syncScriptLocationsToDatabase` has excessive debug logging left in (lines 1250–1295). `syncCastCrewToDatabase` has a hard-coded safety block that alerts users if deleting >3 people at once (line 1461).

---

## WORKSPACE

### WorkflowWorkspace.jsx
- **File:** `src/components/workspace/WorkflowWorkspace.jsx`
- **Purpose:** Dispatches to the correct workspace shell (`WritingWorkspace`, `PreProductionWorkspace`, `ProductionWorkspace`, `ComingSoonWorkspace`) based on `activeWorkflow`.
- **Parent:** `App.js` (line 4891)
- **Props received:** `activeWorkflow`, `children`
- **State:** None
- **Known coupling risks:** `PreProductionWorkspace` and `ProductionWorkspace` are separate shells but currently both render identical `{children}` — App.js puts the same production render tree under both.

### WorkflowTabs.jsx
- **File:** `src/components/workspace/WorkflowTabs.jsx`
- **Purpose:** Tab bar for switching between workflows. Rendered by `AuthWrapper`.
- **Props:** `activeWorkflow`, `onWorkflowChange`
- **State:** None — controlled.

### workflowConfig.js
- **File:** `src/components/workspace/workflowConfig.js`
- **Purpose:** Array of workflow definitions (id, label, enabled flag, optional badge). Source of truth for available workflows.
- **Workflows:** writing (enabled), pitching (disabled), preProduction (enabled), production (enabled), postProduction (disabled).

### WritingWorkspace / PreProductionWorkspace / ProductionWorkspace / ComingSoonWorkspace
- **Files:** `src/components/workspace/WritingWorkspace.jsx`, etc.
- **Purpose:** CSS/layout wrappers for each workflow. Currently pass-through shells with minimal styling.
- **State:** None.

---

## WRITING MODULES

### WritingScript (module)
- **File:** `src/components/modules/WritingScript/WritingScript.jsx`
- **Purpose:** Standalone writing-only script editor. Does NOT receive `scenes`, `setScenes`, `saveScenesDatabase`, `stripboardScenes`, or any production callbacks. Owns its own draft state.
- **Parent:** `App.js` (line 4982), rendered when `isWritingWorkflow && writingActiveModule === "Script"`.
- **Props received:** `previewMode`, `selectedProject`, `user`, `userRole`
- **State owned:**
  - `writingDraftNodes` — array of flat document nodes
  - `writingDraftSaveStatus`
  - `writingScenePageStats`
  - `beats` — outline/beat items
  - `activeSidePanelTab`, `showBeatsTrack`, `beatTrackZoom`
  - `showWritingTimeline`, `targetPageCount`
  - `showMoodOverlay`, `moodOverlaySettings`
  - `collapsedActIds`
  - `currentIndex`, `currentSceneNumber`
- **Derived:** `writingDraftScenes` (memoized from `writingDraftNodes` via `scenesFromDocumentNodes`)
- **localStorage reads/writes (all project-scoped):**
  - `scriptWritingDraft:${projectId}` — writing draft nodes
  - `scriptBeats:${projectId}` — beat sheet
  - `scriptSidePanelTab:${projectId}` — active panel tab
  - `scriptCollapsedActs:${projectId}` — collapsed act IDs
  - `scriptTimelineVisible:writing:${projectId}` — timeline panel open/closed
  - `scriptTargetPageCount:${projectId}` — target page count
  - `scriptMoodOverlayEnabled` — **UNSCOPED** (known bug, also read by Script.js)
  - `scriptMoodOverlaySettings` — **UNSCOPED** (known bug, also read by Script.js)
- **Database reads/writes:** None (writing draft is localStorage-only)
- **Presence:** `usePresence(selectedProject?.id, user, "script", currentSceneNumber)` — uses same channel as Script.js (known bug)
- **Dependent modules:** `WritingTimeline`, `ScriptWritingEditor` (from Script/), `writingDraftModel.js`, `writingDraftPersistence.js`, `writingPageStats.js`, shared utilities.
- **Known coupling risks:** Shares localStorage key namespace with Script.js. Shares presence channel with Script.js. Beat "Convert to Scene" is disabled. Does not touch production `scenes` state.

### writingDraftModel.js
- **File:** `src/components/modules/WritingScript/writingDraftModel.js`
- **Purpose:** Pure functions for converting between flat document node arrays and scene arrays. `documentNodesFromScenes`, `scenesFromDocumentNodes`.
- **State:** None — pure utility.

### writingDraftPersistence.js
- **File:** `src/components/modules/WritingScript/writingDraftPersistence.js`
- **Purpose:** localStorage helpers for writing draft. `loadWritingDraft`, `saveWritingDraft`, `clearWritingDraft`, `getWritingDraftStorageKey`.
- **State:** None.

### WritingBeatsPanel.jsx / WritingSceneList.jsx / WritingScriptEditor.jsx / WritingTimelinePanel.jsx / WritingSettingsModal.jsx
- **Files:** `src/components/modules/WritingScript/` directory
- **Purpose:** Sub-panels for WritingScript. Beats panel, scene list sidebar, editor (uses shared ScriptWritingEditor), timeline panel, settings modal.
- **State:** Controlled by WritingScript parent.

### WritingTimeline (experimental)
- **File:** `src/experimental/writingTimeline/WritingTimeline.jsx` (large)
- **Purpose:** Horizontal page-length timeline bar for writing draft scenes. Drag-to-reorder.
- **Parent:** `WritingScript` and `Script.js` (both embed it when `showWritingTimeline` is true)
- **Known coupling risks:** Shared between writing and production Script.js modes.

### writingTimelineUtils.js
- **File:** `src/experimental/writingTimeline/writingTimelineUtils.js`
- **Purpose:** Pure utilities — `getSceneTimelineData`, `rippleTimelineSceneMove`, `formatPageLength`.

---

## PRODUCTION MODULES

### Script Breakdown (module)
- **File:** `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`
- **Purpose:** Thin compatibility wrapper that renders `LegacyScriptModule` (Script.js). Production-facing breakdown view is still the legacy mixed Script module.
- **Parent:** App.js `renderModule()` → case `"Script Breakdown"`
- **Props received:** Full set passed from App.js — see Script.js below.
- **Known coupling risks:** `ScriptBreakdown` is just an alias for `Script.js`. The split is not complete.

### Script.js (Legacy mixed module)
- **File:** `src/components/modules/Script/Script.js` (5963 lines)
- **Purpose:** Legacy mixed module that handles BOTH writing mode (when `scriptWorkflowMode === "writing"`) and production Script Breakdown mode (when in breakdown/production mode). Contains: scene editor, scene list, beat sheet panel, writing timeline, tag/breakdown overlay, scene reorder, scene insert/delete, FDX import, PDF export, page count, mood overlay.
- **Parent:** `ScriptBreakdown.jsx` → `App.js`
- **Props received (major):**
  - `scenes`, `setScenes`, `saveScenesDatabase`
  - `stripboardScenes`, `setStripboardScenes`, `syncStripboardScenesToDatabase`
  - `taggedItems`, `tagWord`, `untagWordInstance`, `setShowTagDropdown`, `showTagDropdown`
  - `characters`, `setCharacters`, `syncCharactersToDatabase`
  - `moodboardImages`
  - `userRole`, `canEdit`, `isViewOnly`, `selectedProject`, `user`
  - `onScenesReordered`, `onAlert`, `onConfirm`
  - `handleFileUpload`, `handleSingleSceneUpload`
  - `onSceneNumberChange`, `currentIndex`, `setCurrentIndex`
- **State owned (major):**
  - `writingDraftNodes`, `writingDraftScenes` (derived), `editingScenes`, `editingScene`
  - `beats`, `activeSidePanelTab`, `collapsedActIds`
  - `showWritingTimeline`, `targetPageCount`, `scriptWorkflowMode`
  - `showMoodOverlay`, `moodOverlaySettings`
  - `currentSceneNumber`, `scriptMoodboardImages`
- **localStorage (project-scoped via `getProjectStorageKey`):**
  - `scriptWritingDraft:${projectId}` (same key as WritingScript — COLLISION RISK)
  - `scriptBeats:${projectId}` (same key as WritingScript — COLLISION RISK)
  - `scriptSidePanelTab:${projectId}`
  - `scriptCollapsedActs:${projectId}`
  - `scriptTimelineVisible:${mode}:${projectId}`
  - `scriptTargetPageCount:${projectId}`
  - `scriptMoodOverlayEnabled` (unscoped — same key as WritingScript)
  - `scriptMoodOverlaySettings` (unscoped — same key as WritingScript)
  - `scriptWorkflowMode:${projectId}`
- **Database reads/writes:** Calls `saveScenesDatabase` (via App.js callback). Direct `supabase` import at line 14 (used for revision/history uncertain).
- **Known coupling risks (CRITICAL):** Contains all beat helpers, timeline logic, writing draft persistence duplicated from/with WritingScript. localStorage key collision with WritingScript for `scriptWritingDraft` and `scriptMoodOverlay*` keys.

### ScriptWritingEditor.jsx
- **File:** `src/components/modules/Script/ScriptWritingEditor.jsx`
- **Purpose:** The actual contenteditable screenplay editor. Shared between Script.js and WritingScript.jsx.
- **State:** Internally manages editor DOM interactions.
- **Known coupling risks:** Shared component — changes affect both writing and production script editor.

### scriptWritingModel.js
- **File:** `src/components/modules/Script/scriptWritingModel.js`
- **Purpose:** Same purpose as `writingDraftModel.js` but in the Script directory — `documentNodesFromScenes`, `scenesFromDocumentNodes`. These are parallel implementations.
- **Known coupling risks (HIGH):** DUPLICATE of `writingDraftModel.js`. Two separate model files with same exported function names.

### Dashboard
- **File:** `src/components/modules/Dashboard/Dashboard.js`
- **Purpose:** Project overview — upcoming shoot days, quick stats, navigation shortcuts.
- **Props received:** `user`, `selectedProject`, `todoItems`, `shootingDays`, `scheduledScenes`, `stripboardScenes`, `callSheetData`, `castCrew`, `scenes`, `costCategories`, `characters`, `userRole`, `setActiveModule`, `canEdit`, `isViewOnly`, `projectSettings`, `setProjectSettings`, `syncProjectSettingsToDatabase`
- **State:** Local UI state only.
- **Database writes:** Calls `syncProjectSettingsToDatabase` (passed as prop).

### Stripboard
- **File:** `src/components/modules/Stripboard/Stripboard.js`
- **Purpose:** Visual strip board — displays `stripboardScenes` as colored strips, scene status updates, heading edits.
- **Props received:** `scenes` (= stripboardScenes), `taggedItems`, `characters`, `castCrew`, `wardrobeItems`, `onUpdateScene`, `shootingDays`, `userRole`, `canEdit`, `isViewOnly`, `onLocationClick`
- **State:** Local UI state; column preference persisted to localStorage key `stripboard-prefs` (project-scoped via `PREFS_KEY`, set at Stripboard.js:37–38 as `stripboard-prefs-${selectedProject?.id || 'default'}`).
- **localStorage:** `stripboard-prefs-${projectId}` for column preferences.
- **Database writes:** None directly — calls `onUpdateScene` callback from App.js.

### StripboardSchedule
- **File:** `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- **Purpose:** Drag-and-drop shooting day scheduler. Manages shooting day creation, scene assignment to days, day lock/unlock.
- **Props received:** `selectedProject`, `syncLocks`, `stripboardScenes`, `scheduledScenes`, `onScheduleScene`, `onUnscheduleScene`, `shootingDays`, `setShootingDays`, `setScheduledScenes`, `setStripboardScenes`, `scenes`, `setScenes`, `onUpdateScene`, `onSyncAllShootingDays`, `saveScenesDatabase`, `onSyncStripboardScenes`, `onSyncScheduledScenes`, `userRole`, `canEdit`, `isViewOnly`, `syncShootingDays`, `scriptLocations`
- **State:** Local UI state.
- **Database writes:** Calls multiple sync callbacks from App.js. Also receives `syncLocks` ref directly.
- **Known coupling risks (HIGH):** Receives `setShootingDays`, `setScheduledScenes`, `setStripboardScenes`, `setScenes` — it can directly mutate App state for 4 different arrays. Receives `saveScenesDatabase` which triggers full scene re-save.

### CallSheet
- **File:** `src/components/modules/CallSheet/CallSheet.js`
- **Purpose:** Daily call sheet — cast call times, crew assignments, general call, notes per shooting day.
- **Props received:** `scenes`, `shootingDays`, `initialDayNumber`, `castCrew`, `onUpdateCastCrew`, `characters`, `stripboardScenes`, `scheduledScenes`, `projectSettings`, `setProjectSettings`, `callSheetData`, `setCallSheetData`, `updateCrewCallTime`, `wardrobeItems`, `scriptLocations`, `actualLocations`, `getFinalCharacterScenes`, `syncCallSheetData`, `selectedProject`, `taggedItems`
- **State:** Local UI state.
- **Database writes:** Calls `syncCallSheetData` callback.

### Characters
- **File:** `src/components/modules/Characters/Characters.js`
- **Purpose:** Character CRUD, scene associations, override management, links to cast/crew.
- **Props received:** `characters`, `setCharacters`, `characterSceneOverrides`, `setCharacterSceneOverrides`, `getFinalCharacterScenes`, `scenes`, `castCrew`, `setCastCrew`, `wardrobeItems`, `garmentInventory`, `taggedItems`, `continuityElements`, `stripboardScenes`, `setActiveModule`, `setCurrentIndex`, `onUpdateCharacters`, `onDeleteCharacter`, `onUpdateCharacterOverrides`, `syncCastCrewToDatabase`, `selectedProject`, `userRole`, `canEdit`, `isViewOnly`
- **Database writes:** Calls `onUpdateCharacters`, `onDeleteCharacter`, `onUpdateCharacterOverrides`, `syncCastCrewToDatabase` callbacks.

### Locations
- **File:** `src/components/modules/Locations/Locations.js`
- **Purpose:** Manages script locations (extracted from scene headings) and actual locations (physical addresses). Links them. Allows heading edits that update the `scenes` array.
- **Props received:** `scenes` (= stripboardScenes), `mainScenes`, `setMainScenes`, `saveScenesDatabase`, `scriptLocations`, `setScriptLocations`, `actualLocations`, `setActualLocations`, `onSyncScriptLocations`, `onSyncActualLocations`, `selectedProject`, `onUpdateSceneHeading`, `onUpdateSceneTimeOfDay`, `userRole`, `canEdit`, `isViewOnly`, `setActiveModule`, `setCurrentIndex`
- **Known coupling risks:** Receives `setMainScenes` (= `setScenes`) and `saveScenesDatabase` — can mutate production scene list directly.

### Props
- **File:** `src/components/modules/Props/Props.js`
- **Purpose:** Props management — derived from `taggedItems` filtered to "Props" category. Add/remove/edit props, link to scenes.
- **Props received:** `taggedItems`, `scenes`, `characters`, `setActiveModule`, `setCurrentIndex`, `onUpdatePropTitle`, `onRemovePropFromScene`, `onCreatePropVariant`, `onAddPropToScene`, `onCreateNewProp`, `onUpdateTaggedItems`, `onSyncTaggedItems`, `stemWord`, `projectSettings`, `projectId`, `stripboardScenes`, `shootingDays`, `onDeleteProp`, `showConfirm`, `userRole`, `canEdit`, `isViewOnly`, `onUploadPropImage`, `onDeletePropImage`
- **Database writes:** Calls `onSyncTaggedItems` (→ `syncTaggedItemsToDatabase`) and `onDeleteProp` (→ `database.deleteTaggedItem`).

### Makeup
- **File:** `src/components/modules/Makeup/Makeup.js`
- **Purpose:** Makeup/hair items — derived from `taggedItems` filtered to "Makeup" category.
- **Props received:** Similar to Props — `taggedItems`, `scenes`, `characters`, `setActiveModule`, `setCurrentIndex`, variant callbacks, `onUpdateTaggedItems`, `onSyncTaggedItems`, `stemWord`, `userRole`, `canEdit`, `isViewOnly`

### ProductionDesign
- **File:** `src/components/modules/ProductionDesign/ProductionDesign.js`
- **Purpose:** Production design items — derived from `taggedItems` filtered to "Production Design" category.
- **Props received:** Similar to Props/Makeup plus `scriptLocations`.

### Wardrobe
- **File:** `src/components/modules/Wardrobe/Wardrobe.js`
- **Purpose:** Wardrobe items per character, garment inventory, image upload.
- **Props received:** `scenes`, `characters`, `wardrobeItems`, `setWardrobeItems`, `garmentInventory`, `setGarmentInventory`, `garmentCategories`, `setGarmentCategories`, `castCrew`, `setCastCrew`, `onSyncWardrobeItems`, `onSyncGarmentInventory`, `selectedProject`, `userRole`, `canEdit`, `isViewOnly`, `setActiveModule`, `setCurrentIndex`
- **Database writes:** Calls sync callbacks.

### Reports
- **File:** `src/components/modules/Reports/Reports.js`
- **Purpose:** Read-only report generation — breakdown reports, schedule reports. No direct mutations.
- **Props received:** `shootingDays`, `scheduledScenes`, `stripboardScenes`, `taggedItems`, `wardrobeItems`, `garmentInventory`, `scenes`, `projectSettings`, `userRole`, `canEdit`, `isViewOnly`
- **Database writes:** None — read-only.

### Budget
- **File:** `src/components/modules/Budget/Budget.js`
- **Purpose:** Above-the-line / below-the-line budget with line items, totals, department budgets.
- **Props received:** `budgetData`, `setBudgetData`, `onSyncBudgetData`, `userRole`, `canEdit`, `isViewOnly`
- **Database writes:** Calls `onSyncBudgetData` → also triggers `syncBudgetToCostCategories` in App.js.

### CostReport
- **File:** `src/components/modules/CostReport/CostReport.js`
- **Purpose:** Actual expense tracking against budget categories.
- **Props received:** `costCategories`, `setCostCategories`, `costVendors`, `setCostVendors`, `budgetData`, `setBudgetData`, `onSyncBudgetData`, `scenes`, `shootingDays`, `castCrew`, `crewSortOrder`, `onSyncCostCategories`, `onSyncCostVendors`, `selectedProject`, `userRole`, `canEdit`, `isViewOnly`

### Calendar
- **File:** `src/components/modules/Calendar/Calendar.js`
- **Purpose:** Calendar view of shooting schedule and todo items.
- **Props received:** `scheduledScenes`, `todoItems`, `castCrew`, `shootingDays`, `stripboardScenes`, `doodCastEvents`, `userRole`, `canEdit`, `isViewOnly`
- **localStorage:** `calendarExpandedSections` (unscoped — not project-scoped, line 13–18).
- **Database writes:** None directly.

### DayOutOfDays
- **File:** `src/components/modules/DayOutOfDays/DayOutOfDays.jsx`
- **Purpose:** Cast availability grid vs. shooting days. Tracks DOOD events and overrides.
- **Props received:** `selectedProject`, `castCrew`, `shootingDays`, `characters`, `stripboardScenes`, `scheduledScenes`, `doodCastEvents`, `setDoodCastEvents`, `doodOverrides`, `setDoodOverrides`, `doodSettings`, `setDoodSettings`, plus `onSync*` callbacks, `userRole`, `canEdit`, `isViewOnly`

### CastCrew
- **File:** `src/components/modules/CastCrew/CastCrew.js`
- **Purpose:** Cast and crew directory — photos, roles, departments, availability.
- **Props received:** `scenes`, `castCrew`, `setCastCrew`, `crewSortOrder`, `setCrewSortOrder`, `onSyncCastCrew`, `setActiveModule`, `setCurrentIndex`, `userRole`, `canEdit`, `isViewOnly`, `selectedProject`, `user`, `moduleCharacters`
- **Presence:** `usePresence(selectedProject?.id, user, "cast_crew")`

### ShotList
- **File:** `src/components/modules/ShotList/ShotList.js`
- **Purpose:** Shot list by scene — shots, angles, notes, lens.
- **Props received:** `stripboardScenes`, `characters`, `castCrew`, `shootingDays`, `scheduledScenes`, `shotListData`, `setShotListData`, `sceneNotes`, `setSceneNotes`, `onSyncShotListData`, `userRole`, `canEdit`, `isViewOnly`, `selectedProject`, `user`
- **Presence:** `usePresence`.

### Timeline (production)
- **File:** `src/components/modules/Timeline/Timeline.js`
- **Purpose:** Production timeline / continuity view. Distinct from writing timeline.
- **Props received:** `scenes`, `characters`, `castCrew`, `stripboardScenes`, `timelineData`, `setTimelineData`, `continuityElements`, `setContinuityElements`, `onSyncTimelineData`, `onSyncContinuityElements`, `onUpdateScenes`, `userRole`, `canEdit`, `isViewOnly`
- **localStorage:** `timeline-data-${projectId}` (project-scoped, line 46–54 — uncertain exact key).
- **Database writes:** Calls `onSyncTimelineData`, `onSyncContinuityElements`. Also `onUpdateScenes` which calls `saveScenesDatabase`.

### MoodBoard
- **File:** `src/components/modules/MoodBoard/MoodBoard.js`
- **Purpose:** Freeform image moodboard with multi-board support, canvas layout, links.
- **Props received:** `selectedProject`, `userRole`, `canEdit`, `isViewOnly`, `user`, `onMoodboardDataChange`
- **State:** All board state local (boards, images, links, canvasItems, zoom, showGrid).
- **localStorage:** `moodboard-${projectId}` — full board state fallback when DB unavailable.
- **Database reads/writes:** `moodboard_data` table — load on mount, debounced save on state change.
- **Note:** `onMoodboardDataChange` callback in App.js updates `scriptMoodImages` (App.js:4854–4856), which gets passed as `moodboardImages` to ScriptBreakdown.

### ToDoList
- **File:** `src/components/modules/ToDoList.js`
- **Purpose:** Project task list with categories, assignees, due dates.
- **Props received:** `todoItems`, `setTodoItems`, `todoCategories`, `setTodoCategories`, `castCrew`, `syncTodoItemsToDatabase`, `onDeleteTodoItem`, `userRole`, `canEdit`, `isViewOnly`, `selectedProject`, `user`
- **Presence:** `usePresence`.

### WritingCharacters
- **File:** `src/components/modules/WritingCharacters/` (directory listed — not read in depth; uncertain)
- **Purpose:** Uncertain — possibly a writing-specific characters module not yet integrated. (Writing sidebar shows "Characters" button but it is `disabled`.)

---

## SHARED COMPONENTS

### EditableInput.js
- **File:** `src/components/shared/EditableInput.js`
- **Purpose:** Inline editable text field — click to edit, blur/enter to save. Calls `onSave` callback.
- **State:** Local edit value.

### SceneDetailModal.js
- **File:** `src/components/shared/SceneDetailModal.js`
- **Purpose:** Modal for viewing/editing scene heading details (INT/EXT, location, time of day, modifier). Accepts `onSave` callback.
- **State:** Local heading form state.

### PresenceIndicator.js
- **File:** `src/components/shared/PresenceIndicator.js`
- **Purpose:** Renders colored dot indicators for other users viewing the same item.

### ImageUpload.js / MultiImageUpload.js / ImageViewer.js / ImageCropper.js
- **Files:** `src/components/shared/`
- **Purpose:** Image upload/display utilities used by Wardrobe, Props, etc.

---

## UTILITIES

### utils.js
- **File:** `src/utils.js`
- **Purpose:** General script utilities — `stemWord`, `measureSceneInDOM`, `calculateScenePageStats`, `estimateSceneLines`, `updateScenesWithPageData`, `parseSceneHeading`, `buildHeadingString`, `extractLocations`, `getElementStyle`, `formatElementText`, `calculateBlockLines`, `LINES_PER_PAGE` constant.
- **Imports from:** Nothing app-specific.

### sceneIdentity.js
- **File:** `src/utils/sceneIdentity.js`
- **Purpose:** Canonical scene identity helpers — `createSceneId`, `getSceneId`, `getSceneNumber`, `isValidSceneId`, `sameScene`, `normalizeSceneRef`, `normalizeScheduleBlock`.

### sceneDisplayLabel.js
- **File:** `src/utils/sceneDisplayLabel.js`
- **Purpose:** Presentation-layer display label computation — `buildSceneDisplayLabelMap`, `getSceneDisplayLabel`. Must NOT be used as DB/persistence keys.

### scenePresentation.js
- **File:** `src/utils/scenePresentation.js`
- **Purpose:** Scene row styling constants and helpers — `SCENE_STATUS_COLORS`, `SCENE_CUSTOM_COLORS`, `getSceneStatusPresentation`, `getSceneMetadataColumns`, `getSceneRowPresentation`.

### propSceneRefs.js
- **File:** `src/utils/propSceneRefs.js`
- **Purpose:** Dual-read compatibility layer for prop scene refs (UUID vs. legacy integer). `normalizePropScenesOnAdd`, `normalizePropScenesOnRemove`, `sceneMatchesPropSceneRef`, etc.

### scriptSearch.js
- **File:** `src/utils/scriptSearch.js`
- **Purpose:** Full-text script search utilities — `cleanVisiblePhrase`, `createScriptSearchKey`, `searchScript`, `resolveInstanceSceneIndex`.

### usePresence.js
- **File:** `src/hooks/usePresence.js`
- **Purpose:** Supabase Realtime presence hook. Tracks which users are in which module/item. Returns `{ otherUsers }`.
- **Shared channel issue:** Script.js and WritingScript.jsx both connect to `presence_${projectId}` channel with `moduleName = "script"`. They broadcast to the same channel — users in either view appear in both.

---

## 2026-05-16 Audit Completion Addendum

### Required Audit Docs State

The docs folder now contains all eight required audit documents:

1. `docs/FULL_APP_MODULE_MAP.md`
2. `docs/APP_DATA_OWNERSHIP_MAP.md`
3. `docs/CALLBACK_AND_MUTATION_MAP.md`
4. `docs/STORAGE_AND_DATABASE_MAP.md`
5. `docs/MODULE_INTERACTION_MATRIX.md`
6. `docs/REDUNDANCY_AND_HOLES_REPORT.md`
7. `docs/APP_WIDE_REGRESSION_TEST_PLAN.md`
8. `docs/NEXT_REFACTOR_STRATEGY.md`

`FULL_APP_MODULE_MAP.md` was checked at EOF and was not obviously cut off mid-sentence. This addendum fills audit gaps found during the final pass.

### Mobile App

- **File:** `src/components/mobile/MobileApp.js`
- **Purpose:** Separate mobile-specific shell with its own auth/session loading, active module state, mobile module selector, and mobile versions of dashboard/call sheet/wardrobe/props/cost report views.
- **Mounted from / parent:** Not confirmed from source reads. It is present under `src/components/mobile/` and should be treated as a separate app path until routing is verified.
- **Major props received:** Internal top-level mobile component appears to own its own state and load data directly.
- **Internal state owned:** `activeModule`, `scenes`, `shootingDays`, `scheduledScenes`, `callSheetData`, `stripboardScenes`, auth/user/project state.
- **Database reads/writes:** Imports `supabase` and `database`; uses auth calls, realtime/channel cleanup, tagged item writes, and database load helpers.
- **localStorage:** None found in required localStorage grep for mobile.
- **Known coupling risks:** Mobile duplicates parts of desktop state ownership and module routing. Changes to scene identity, stripboard schedule, call sheet data shape, or props data can break mobile independently of desktop.

### Current WritingScript Runtime Shape

- **File:** `src/components/modules/WritingScript/WritingScript.jsx`
- **Purpose:** Dedicated writing workflow script surface. It is active when `App` renders `previewMode="editor"` for `activeWorkflow === "writing"`.
- **Mounted from / parent:** `src/App.js:4891` branch for `isWritingWorkflow`.
- **Major props received:** `selectedProject`, `user`, `userRole`, `previewMode`, `previewShell`.
- **Internal state owned:** writing draft nodes/save status/page stats, target page count, timeline visibility, scene-number visibility, mood overlay settings, beats, side-panel tab, beat track zoom, current writing scene index, current scene number, editor element type.
- **App state read:** Only project/user/role props. It should not read App production scenes.
- **App state written:** None intentionally.
- **Database reads/writes:** None intentionally.
- **localStorage reads/writes:** `scriptWritingDraft:${projectId}`, `scriptBeats:${projectId}`, `scriptSidePanelTab:${projectId}`, `scriptCollapsedActs:${projectId}`, `scriptTimelineVisible:writing:${projectId}`, `scriptTargetPageCount:${projectId}`, unscoped `scriptMoodOverlayEnabled`, unscoped `scriptMoodOverlaySettings`.
- **Dependencies/imports:** Imports the legacy compatibility path `../Script/ScriptWritingEditor` even though that path re-exports the WritingScript editor implementation. Imports `WritingTimeline` from experimental path directly, plus writing draft model helpers and `usePresence`.
- **Known coupling risks:** It duplicates significant logic from legacy `Script.js`, writes several of the same localStorage keys, and shares the same presence module name (`script`) as Script Breakdown.

### Current Script Breakdown Runtime Shape

- **Files:** `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`, `src/components/modules/Script/Script.js`
- **Purpose:** Production/pre-production script breakdown route. `ScriptBreakdown.jsx` is only a pass-through wrapper.
- **Mounted from / parent:** `App.renderModule()` case `SCRIPT_BREAKDOWN_MODULE`.
- **Major props received:** production scenes, `setScenes`, `saveScenesDatabase`, tagged items, tag mutation callbacks, characters, character sync, stripboard scenes, stripboard setters/sync, alert/confirm callbacks, selectedProject/user/role.
- **Internal state owned:** Legacy `Script.js` still owns both production state and legacy writing-mode state.
- **Database reads/writes:** Calls revision table operations directly with `supabase.from("script_revisions")`; receives `saveScenesDatabase` for scene writes and receives production character/tag callbacks.
- **localStorage reads/writes:** Same writing draft/beat/settings keys as WritingScript plus script workflow mode and timeline positions.
- **Known coupling risks:** Script Breakdown still contains writing-mode branches and can write writing draft localStorage keys. This is expected temporarily but should be retired after WritingScript is stable.

### Source Files Inspected In Final Pass

- `src/App.js`
- `src/components/auth/AuthWrapper.js`
- `src/services/database.js`
- `src/components/workspace/*`
- `src/components/modules/Script/Script.js`
- `src/components/modules/ScriptBreakdown/*`
- `src/components/modules/WritingScript/*`
- `src/components/modules/Dashboard/*`
- `src/components/modules/Stripboard/*`
- `src/components/modules/StripboardSchedule/*`
- `src/components/modules/CallSheet/*`
- `src/components/modules/Characters/*`
- `src/components/modules/Locations/*`
- `src/components/modules/Props/*`
- `src/components/modules/Makeup/*`
- `src/components/modules/ProductionDesign/*`
- `src/components/modules/Wardrobe/*`
- `src/components/modules/Reports/*`
- `src/components/modules/Budget/*`
- `src/components/modules/Calendar/*`
- `src/components/modules/MoodBoard/*`
- `src/components/modules/ShotList/*`
- `src/components/modules/Timeline/*`
- `src/components/modules/DayOutOfDays/*`
- `src/components/mobile/*`
- `src/components/shared/*`
- `src/hooks/*`
- `src/utils/*`
