# Storage and Database Map

---

## SUPABASE TABLES AND FUNCTIONS

### scenes
- **Load function:** `database.loadScenesFromDatabase`
- **Save/sync function:** `database.saveScenesDatabase` (via `sync_scenes` RPC; falls back to direct upsert; includes stale-row deletion)
- **Atomic functions:** `updateSceneStatus`, `updateSceneHeading`, `updateSceneTimeOfDay`, `updateSceneDescription`, `updateSceneNotes`
- **App state affected:** `scenes` (App.js:123)
- **Modules affected:** Script/ScriptBreakdown, StripboardSchedule, Timeline, Locations, Dashboard
- **Notes:** Row shape: `{ id (UUID), project_id, scene_number, heading, content (jsonb array), metadata (jsonb), page_number, page_length, timeline_start_page, estimated_duration, status, manual_time_of_day, description, notes }`. `metadata.scriptOrder` used for sort order. Full-replace sync — the entire array is saved each time.

### stripboard_scenes
- **Load function:** `database.loadStripboardScenesAfterScenes` (called after scenes load)
- **Save/sync function:** `database.syncStripboardScenesToDatabase` (via `sync_stripboard_scenes` RPC)
- **Atomic functions:** `updateStripboardSceneStatus`, `updateStripboardSceneSchedule`, `clearStripboardSceneSchedule`, `batchUpdateStripboardSceneStatuses`
- **App state affected:** `stripboardScenes` (App.js:1684)
- **Modules affected:** Stripboard, StripboardSchedule, ShotList, Calendar, DayOutOfDays
- **Notes:** Row shape: `{ project_id, scene_id (UUID FK), scene_number, status, scheduled_date, scheduled_time }`. Merged with `scenes` on load — if no stripboard row, scene is used as-is.

### shooting_days
- **Load function:** `database.loadShootingDaysFromDatabase`
- **Save/sync function:** `database.syncShootingDaysToDatabase` (via `sync_shooting_days_v3` RPC). App.js wrapper includes aggressive UUID conversion and bigint detection.
- **Atomic functions:** `updateShootingDayLockStatus`, `updateShootingDayShotStatus`, `updateShootingDayCollapsed`, `deleteShootingDay`, `batchUpdateShootingDayStatuses`, `batchUpdateDayNumbers`, `updateShootingDayScheduleBlocks`
- **App state affected:** `shootingDays` (App.js:1697)
- **Modules affected:** StripboardSchedule, CallSheet, Calendar, DayOutOfDays, Dashboard, ShotList, Reports
- **Notes:** Row shape: `{ id (UUID), project_id, date, day_number, schedule_blocks (jsonb), is_locked, is_shot, is_collapsed }`. The `schedule_blocks` contain scene refs.

### scheduled_scenes
- **Load function:** `database.loadScheduledScenesFromDatabase`
- **Save/sync function:** `database.syncScheduledScenesToDatabase` (via `sync_scheduled_scenes` RPC)
- **App state affected:** `scheduledScenes` (App.js:1685) — object keyed by date.
- **Modules affected:** StripboardSchedule, CallSheet, Calendar, DayOutOfDays, Dashboard, Reports, ShotList
- **Notes:** Row shape: `{ project_id, shoot_date, scenes (jsonb), scene_ids (jsonb array of UUIDs) }`.

### cast_crew
- **Load function:** `database.loadCastCrewFromDatabase` (also loads availability via `get_all_availability` RPC)
- **Save/sync function:** `database.syncCastCrewToDatabase` (via `sync_cast_crew` RPC). Has 3-person deletion safety block.
- **Atomic functions:** `addCastCrewPerson`, `updateCastCrewPerson`, `deleteCastCrewPerson`, `updateSingleCastCrewPerson` (via `upsert_cast_crew_person` RPC)
- **App state affected:** `castCrew` (App.js:1705)
- **Modules affected:** CallSheet, CastCrew, Characters, ShotList, DayOutOfDays, Wardrobe

### cast_crew_availability
- **Load function:** Loaded via `get_all_availability` RPC inside `loadCastCrewFromDatabase`
- **Save functions:** `addAvailabilityDateSafe`, `removeAvailabilityDateSafe`, `addAvailabilityDateRange` (all RPC-based)
- **Realtime channel:** `cast_crew_availability_${projectId}` — triggers cast/crew reload.
- **Notes:** Separate table for availability — daily cleanup handled by `checkAndRunDailyAvailabilityCleanup`.

### characters
- **Load function:** `database.loadCharactersFromDatabase`
- **Save/sync function:** `database.syncCharactersToDatabase` (via `sync_characters` RPC)
- **Atomic functions:** `upsertCharacter`, `deleteCharacter`
- **App state affected:** `characters` (App.js:1726)
- **Modules affected:** Script/ScriptBreakdown, Characters, CallSheet, Wardrobe, DayOutOfDays

### tagged_items
- **Load function:** `database.loadTaggedItemsFromDatabase` (also calls `calculateCategoryNumbers` to add derived category numbers)
- **Save/sync function:** `database.syncTaggedItemsToDatabase`
- **Atomic function:** `database.deleteTaggedItem`
- **App state affected:** `taggedItems` (App.js:1694)
- **Modules affected:** Script/ScriptBreakdown, Props, Makeup, ProductionDesign, CallSheet, Reports, Characters, Stripboard

### script_locations
- **Load function:** `database.loadScriptLocationsFromDatabase`
- **Save/sync function:** `database.syncScriptLocationsToDatabase` (via `sync_script_locations` RPC). Has empty-array guard. Post-save triggers `window.forceScriptLocationsReload`.
- **App state affected:** `scriptLocations` (App.js:1693)
- **Modules affected:** Locations, CallSheet, ProductionDesign, StripboardSchedule

### actual_locations
- **Load function:** `database.loadActualLocationsFromDatabase`
- **Save/sync function:** `database.syncActualLocationsToDatabase` (via `sync_actual_locations` RPC)
- **App state affected:** `actualLocations` (App.js:1696)
- **Modules affected:** Locations, CallSheet

### call_sheet_data
- **Load function:** `database.loadCallSheetDataFromDatabase` (loads most recent row)
- **Save/sync function:** `database.syncCallSheetDataToDatabase` (via `sync_call_sheet_v2` RPC)
- **App state affected:** `callSheetData` (App.js:1815)
- **Modules affected:** CallSheet, Dashboard

### wardrobe_items
- **Load function:** `database.loadWardrobeItemsFromDatabase`
- **Save/sync function:** `database.syncWardrobeItemsToDatabase`
- **App state affected:** `wardrobeItems` (App.js:1827)
- **Notes:** Each row has `item_data` JSONB column — full item object stored as blob.

### garment_inventory
- **Load function:** `database.loadGarmentInventoryFromDatabase`
- **Save/sync function:** `database.syncGarmentInventoryToDatabase`
- **App state affected:** `garmentInventory` (App.js:1828)

### cost_categories
- **Load function:** `database.loadCostCategoriesFromDatabase` (builds parent/child hierarchy from flat rows)
- **Save/sync function:** `database.syncCostCategoriesToDatabase`
- **App state affected:** `costCategories` (App.js:1769)
- **Modules affected:** CostReport, Budget (indirectly via `syncBudgetToCostCategories`)

### cost_vendors
- **Load function:** `database.loadCostVendorsFromDatabase`
- **Save/sync function:** `database.syncCostVendorsToDatabase`
- **App state affected:** `costVendors` (App.js:1807)

### budget_data
- **Load function:** `database.loadBudgetDataFromDatabase`
- **Save/sync function:** `database.syncBudgetDataToDatabase`. Also triggers cost category sync.
- **App state affected:** `budgetData` (App.js:1744)
- **Notes:** Single row per project stored as JSONB blobs (`atl_items`, `btl_items`, `legal_items`, etc.).

### todo_items
- **Load function:** `database.loadTodoItemsFromDatabase`
- **Save/sync function:** `database.syncTodoItemsToDatabase`
- **Atomic function:** `database.deleteTodoItem`
- **App state affected:** `todoItems` (App.js:1730)

### shot_list_data
- **Load function:** `database.loadShotListDataFromDatabase`
- **Save/sync function:** `database.syncShotListDataToDatabase`
- **App state affected:** `shotListData`, `sceneNotes` (App.js:1728–1729)
- **Notes:** Single row per project — `shot_list_data` and `scene_notes` stored as JSONB blobs.

### timeline_data
- **Load function:** `database.loadTimelineDataFromDatabase`
- **Save/sync function:** `database.syncTimelineDataToDatabase`
- **App state affected:** `timelineData` (App.js:1742)
- **Notes:** Single JSONB row per project.

### continuity_elements
- **Load function:** `database.loadContinuityElementsFromDatabase`
- **Save/sync function:** `database.syncContinuityElementsToDatabase`
- **App state affected:** `continuityElements` (App.js:1743)

### moodboard_data
- **Load function:** Inline in MoodBoard.js (direct Supabase query)
- **Save/sync function:** Inline in MoodBoard.js (debounced upsert)
- **App state affected:** `scriptMoodImages` (indirectly via `onMoodboardDataChange` callback)
- **Notes:** NOT managed by database.js. MoodBoard owns its own persistence.

### projects
- **Load function:** `database.loadProjectSettingsFromDatabase` (reads `settings` and `character_overrides` from projects row)
- **Save/sync function:** `database.syncProjectSettingsToDatabase`, `database.syncCharacterOverridesToDatabase`
- **App state affected:** `projectSettings`, `characterSceneOverrides`

### project_members
- **Load function:** Loaded by ProjectSelector, AuthWrapper (via `supabase` direct queries).
- **Realtime channel:** `members_${projectId}` — subscribed but handler only logs (App.js:1001).

### users
- **Used by:** AuthWrapper (display name load/update), usePresence.js (display name lookup).
- **Not managed by database.js.**

### Dood tables (dood_cast_events, dood_overrides, dood_settings)
- **Load functions:** `database.loadDoodCastEvents`, `database.loadDoodOverrides`, `database.loadDoodSettings`
- **Save functions:** `database.syncDoodCastEvent`, `database.syncDoodOverride`, `database.syncDoodSettings` (called inline via App.js callbacks in DayOutOfDays render — App.js:4466–4473)
- **App state affected:** `doodCastEvents`, `doodOverrides`, `doodSettings`

---

## SUPABASE RPC FUNCTIONS

| RPC Name | Called By | Purpose |
|---|---|---|
| `sync_scenes` | `database.saveScenesDatabase` | Full scene array upsert |
| `sync_stripboard_scenes` | `database.syncStripboardScenesToDatabase` | Full stripboard replace |
| `sync_shooting_days_v3` | `database.syncShootingDaysToDatabase` | Full shooting days replace |
| `sync_scheduled_scenes` | `database.syncScheduledScenesToDatabase` | Full scheduled scenes replace |
| `sync_cast_crew` | `database.syncCastCrewToDatabase` | Full cast/crew replace |
| `sync_call_sheet_v2` | `database.syncCallSheetDataToDatabase` | Call sheet upsert |
| `sync_script_locations` | `database.syncScriptLocationsToDatabase` | Script locations replace |
| `sync_actual_locations` | `database.syncActualLocationsToDatabase` | Actual locations replace |
| `sync_characters` | `database.syncCharactersToDatabase` | Characters replace |
| `upsert_cast_crew_person` | `addCastCrewPerson`, `updateCastCrewPerson`, `updateSingleCastCrewPerson` | Single person upsert |
| `delete_cast_crew_person` | `deleteCastCrewPerson` | Single person delete |
| `upsert_character` | `upsertCharacter` | Single character upsert |
| `delete_character` | `deleteCharacter` | Single character delete |
| `get_all_availability` | `loadCastCrewFromDatabase` | Batch availability load |
| `add_availability_date_safe` | `addAvailabilityDateSafe` | Atomic date add |
| `remove_availability_date_safe` | `removeAvailabilityDateSafe` | Atomic date remove |
| `add_availability_date_range` | `addAvailabilityDateRange` | Date range add |
| `get_person_availability` | `getPersonAvailability` | Single person availability |
| `cleanup_old_availability` | `cleanupOldAvailabilityDates` | Background cleanup |
| `update_stripboard_scene_status` | `updateStripboardSceneStatus` | Atomic status update |
| `update_stripboard_scene_schedule` | `updateStripboardSceneSchedule` | Atomic schedule update |
| `clear_stripboard_scene_schedule` | `clearStripboardSceneSchedule` | Atomic schedule clear |
| `batch_update_stripboard_scene_statuses` | `batchUpdateStripboardSceneStatuses` | Batch status update |
| `update_scene_status` | `updateSceneStatus` | Atomic main scene status |
| `update_scene_heading` | `updateSceneHeading` | Atomic heading update |
| `update_scene_time_of_day` | `updateSceneTimeOfDay` | Atomic time of day |
| `update_scene_description` | `updateSceneDescription` | Atomic description |
| `update_scene_notes` | `updateSceneNotes` | Atomic notes |
| `update_shooting_day_lock_status` | `updateShootingDayLockStatus` | Atomic day lock |
| `update_shooting_day_shot_status` | `updateShootingDayShotStatus` | Atomic day shot |
| `update_shooting_day_collapsed` | `updateShootingDayCollapsed` | Atomic day collapsed |

---

## LOCALSTORAGE

### scriptWritingDraft:${projectId}
- **Owner:** Both Script.js (line 3115) and WritingScript.jsx (line 519) define this key independently.
- **Data shape:** `{ projectId, savedAt, hasUserCreatedScript, nodes: [] }` — array of flat document nodes.
- **Reader:** Script.js (line 3127), WritingScript.jsx (line 531), writingDraftPersistence.js (line 34).
- **Writer:** Script.js (lines 4521, 4921), WritingScript.jsx (line 720), writingDraftPersistence.js (line 59).
- **Project-scoped:** Yes.
- **Duplicated between Script.js and WritingScript:** YES (CRITICAL RISK).
- **Status:** Active — primary persistence for writing draft.

### scriptBeats:${projectId}
- **Owner:** Both Script.js (line 3110) and WritingScript.jsx (line 514) define this key independently.
- **Data shape:** Array of beat/act objects `{ id, type, title, description, order, ... }`.
- **Reader:** Script.js (line 3191), WritingScript.jsx (line 559).
- **Writer:** Script.js (line 3209), WritingScript.jsx (line 572).
- **Project-scoped:** Yes.
- **Duplicated between Script.js and WritingScript:** YES (HIGH RISK).
- **Status:** Active.

### scriptSidePanelTab:${projectId}
- **Owner:** Script.js (line 3218), WritingScript.jsx (line 578).
- **Data shape:** String `"beats"` or `"scenes"`.
- **Duplicated:** YES (same key pattern, same logic).
- **Status:** Active.

### scriptCollapsedActs:${projectId}
- **Owner:** Script.js (line 3237), WritingScript.jsx (line 593).
- **Data shape:** Object `{ [actId]: boolean }`.
- **Duplicated:** YES.
- **Status:** Active.

### scriptTimelineVisible:writing:${projectId}
- **Owner:** Script.js (line 3332, as `scriptTimelineVisible:${scriptWorkflowMode}:${projectId}`), WritingScript.jsx (line 618, hardcoded as `scriptTimelineVisible:writing`).
- **Data shape:** String `"true"` / `"false"`.
- **Duplicated:** YES (WritingScript always uses `:writing`; Script.js uses mode-dependent suffix).
- **Status:** Active.

### scriptTargetPageCount:${projectId}
- **Owner:** Script.js (line 3338), WritingScript.jsx (line 624).
- **Data shape:** Number string.
- **Duplicated:** YES.
- **Status:** Active.

### scriptMoodOverlayEnabled
- **Owner:** Script.js (line 3503), WritingScript.jsx (line 475).
- **Data shape:** String `"true"` / `"false"`.
- **Project-scoped:** NO — unscoped. All projects share this value.
- **Duplicated:** YES (same unscoped key).
- **Status:** Active (KNOWN BUG — should be project-scoped).

### scriptMoodOverlaySettings
- **Owner:** Script.js (line 3507), WritingScript.jsx (line 479).
- **Data shape:** `{ opacity, columnWidth, columns, refreshSeconds }`.
- **Project-scoped:** NO — unscoped.
- **Duplicated:** YES (same unscoped key).
- **Status:** Active (KNOWN BUG — should be project-scoped).

### scriptWorkflowMode:${projectId}
- **Owner:** Script.js (line 3305).
- **Data shape:** String `"writing"` / `"production"`.
- **Project-scoped:** Yes.
- **Duplicated:** NO — Script.js only.
- **Status:** Active. Controls which mode Script.js renders in.

### scriptTimelinePositions:${projectId}
- **Owner:** Script.js (line 3105, 3169, 3412).
- **Data shape:** Array of `{ sceneId, startPage }` timeline position overrides.
- **Project-scoped:** Yes.
- **Duplicated:** NO.
- **Status:** Active (uncertain whether WritingScript also uses this via WritingTimeline).

### stripboard-prefs-${projectId}
- **Owner:** Stripboard.js (lines 37–39).
- **Data shape:** Object of display preferences (column visibility, grouping, etc.).
- **Project-scoped:** Yes.
- **Duplicated:** NO.
- **Status:** Active.

### calendarExpandedSections
- **Owner:** Calendar.js (lines 13–18).
- **Data shape:** Object of section expanded states.
- **Project-scoped:** NO — unscoped.
- **Duplicated:** NO.
- **Status:** Active (minor bug — not project-scoped, shared across all projects).

### moodboard-${projectId}
- **Owner:** MoodBoard.js (lines 367, 417).
- **Data shape:** Full moodboard state `{ version, savedAt, activeBoardId, boards, links, images, canvasItems, zoom, showGrid }`.
- **Project-scoped:** Yes.
- **Duplicated:** NO.
- **Status:** Active (fallback when DB unavailable).

### timeline-data-${projectId} (uncertain)
- **Owner:** Timeline.js (lines 46–54, approximate — not read in full).
- **Data shape:** Uncertain.
- **Project-scoped:** Uncertain.
- **Status:** Uncertain.

### lastAvailabilityCleanup_${projectId}
- **Owner:** database.js (lines 1860, 1873).
- **Data shape:** Date string `YYYY-MM-DD`.
- **Project-scoped:** Yes.
- **Duplicated:** NO.
- **Status:** Active (maintenance/background).

### appVersion
- **Owner:** App.js (line 5206–5208).
- **Data shape:** Timestamp integer (Date.now() string).
- **Project-scoped:** NO.
- **Duplicated:** NO.
- **Status:** Active (read only — uncertain where/if it is written; the read is used for sidebar version display).

### stripboard-schedule-scroll-position / stripboard-schedule-has-auto-scrolled / stripboard-scroll-position
- **Owner:** App.js sessionStorage (cleared on mount, lines 162–165).
- **Type:** sessionStorage (not localStorage).
- **Project-scoped:** No.
- **Status:** Active (cleared on load to reset scroll positions).

---

## REALTIME CHANNELS (Supabase)

All channels follow pattern: `supabase.channel(<name>_${selectedProject.id})` and use `postgres_changes` with project filter.

| Channel | Table | Debounce | Sync Lock Used |
|---|---|---|---|
| `scenes_${id}` | scenes | 500ms | syncLocks.scenes |
| `stripboard_${id}` | stripboard_scenes | 1000ms | syncLocks.stripboardScenes + scenes + shootingDays + scheduledScenes |
| `shooting_days_${id}` | shooting_days | 500ms | syncLocks.shootingDays |
| `scheduled_${id}` | scheduled_scenes | 500ms | syncLocks.scheduledScenes |
| `cast_crew_${id}` | cast_crew | 500ms | syncLocks.castCrew |
| `cast_crew_availability_${id}` | cast_crew_availability | 500ms | syncLocks.castCrew |
| `characters_${id}` | characters | 500ms | syncLocks.characters |
| `tagged_items_${id}` | tagged_items | 500ms | syncLocks.taggedItems |
| `script_loc_${id}` | script_locations | 500ms | syncLocks.scriptLocations |
| `actual_loc_${id}` | actual_locations | none | syncLocks.actualLocations |
| `call_sheet_${id}` | call_sheet_data | none | syncLocks.callSheet |
| `wardrobe_${id}` | wardrobe_items | 500ms | syncLocks.wardrobeItems (uncertain key name) |
| `garment_${id}` | garment_inventory | 500ms | syncLocks.garmentInventory |
| `cost_cat_${id}` | cost_categories | none | none |
| `cost_vend_${id}` | cost_vendors | none | none |
| `budget_${id}` | budget_data | none | syncLocks.budget |
| `shot_list_${id}` | shot_list_data | 500ms | syncLocks.shotList |
| `timeline_${id}` | timeline_data | none | none |
| `continuity_${id}` | continuity_elements | none | none |
| `todo_${id}` | todo_items | none | syncLocks.todoItems |
| `members_${id}` | project_members | none | none (handler only logs) |

**Presence channel:** `presence_${projectId}` — used by `usePresence` hook. Both Script.js and WritingScript.jsx connect to the same channel with `moduleName = "script"`, causing presence indicator collision.

---

## 2026-05-16 Audit Completion Addendum

### localStorage Keys Confirmed By Final Search

| Key / pattern | Owner(s) | Project scoped | Reader/writer | Status |
|---|---|---:|---|---|
| `scriptWritingDraft:${projectId}` | WritingScript, legacy Script.js, writingDraftPersistence | Yes | both read/write | Active collision risk |
| `scriptBeats:${projectId}` | WritingScript, legacy Script.js | Yes | both read/write | Active collision risk |
| `scriptTimelinePositions:${projectId}` | legacy Script.js | Yes | Script.js read/write | Active legacy writing path |
| `scriptTimelineVisible:writing` | legacy Script.js initial unscoped read | No | Script.js read | Legacy compatibility/uncertain |
| `scriptTimelineVisible:writing:${projectId}` | WritingScript, legacy Script.js | Yes | both read/write | Active collision risk |
| `scriptTargetPageCount:${projectId}` | WritingScript, legacy Script.js | Yes | both read/write | Active collision risk |
| `scriptSidePanelTab:${projectId}` | WritingScript, legacy Script.js | Yes | both read/write | Active collision risk |
| `scriptCollapsedActs:${projectId}` | WritingScript, legacy Script.js | Yes | both read/write | Active collision risk |
| `scriptWorkflowMode:${projectId}` | legacy Script.js | Yes | Script.js read/write | Legacy mode switch |
| `scriptWorkflowMode` | legacy Script.js initial unscoped read | No | Script.js read | Legacy compatibility/uncertain |
| `scriptMoodOverlayEnabled` | WritingScript, legacy Script.js | No | both read/write | Cross-project collision |
| `scriptMoodOverlaySettings` | WritingScript, legacy Script.js | No | both read/write | Cross-project collision |
| `calendarExpandedSections` | Calendar | No | Calendar read/write | Cross-project UI state |
| `stripboard_prefs_v1` | Stripboard | No | Stripboard read/write | Cross-project UI state; actual key differs from requested `stripboard-prefs-${projectId}` |
| `filmProductionBinder:moodboard:${projectId}` | MoodBoard | Yes | MoodBoard read/write fallback | Active fallback |
| `timeline-view-collapsed-${selectedTimeline}` | Timeline | No project id | Timeline read/write | Cross-project UI state |
| `appVersion` | App sidebar read | No | App read only in grep | Writer not found in final search |
| `lastAvailabilityCleanup_${projectId}` | database.js | Yes | database read/write | Active maintenance |

### sessionStorage Keys

| Key | Owner | Purpose |
|---|---|---|
| `stripboard-schedule-scroll-position` | App clears; StripboardSchedule reads/writes | schedule scroll restoration |
| `stripboard-schedule-has-auto-scrolled` | App clears; StripboardSchedule reads/writes | one-time schedule auto-scroll guard |
| `stripboard-scroll-position` | App clears; Stripboard reads/writes | stripboard scroll restoration |

### Supabase / Database Hotspots

- `database.saveScenesDatabase` maps full `updatedScenes` into the `sync_scenes` RPC payload and then deletes stale DB rows not present in the current scene payload.
- `database.syncStripboardScenesToDatabase` writes stripboard status/schedule rows through `sync_stripboard_scenes`.
- `database.syncScheduledScenesToDatabase` writes scheduled scenes and `scene_ids` through `sync_scheduled_scenes`.
- `Script.js` directly accesses `script_revisions` through `supabase.from("script_revisions")`.
- `MoodBoard` directly upserts `moodboard_data` and uses Supabase storage.
- `usePresence` opens `presence_${projectId}` for modules that support presence.

### Data Loss / Collision Risks

1. `scriptWritingDraft:${projectId}` is currently the highest priority storage risk because manual testing found body/action text may not persist in the active WritingScript path.
2. Shared writing localStorage keys mean legacy Script Breakdown writing branches can overwrite WritingScript state if mounted and used.
3. `saveScenesDatabase` stale deletion is production-safe only if the full intended production scene list is supplied. It must not be called from WritingScript.
4. Several UI preference keys are not project-scoped and can leak preferences across projects.
