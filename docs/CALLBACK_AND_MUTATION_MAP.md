# Callback and Mutation Map

Documents each callback/mutation function: where defined, where passed, what it does, risk level.

---

## saveScenesDatabase

- **Defined in:** App.js:1027 (wrapper) calls `database.saveScenesDatabase` (database.js:772)
- **Passed to:** ScriptBreakdown/Script.js (App.js:4374), StripboardSchedule (App.js:4426), Locations (App.js:4674), Timeline (via `onUpdateScenes` inline, App.js:4837)
- **Called by:** Script.js on scene save, StripboardSchedule on scene-day assignment, Locations on heading edits, Timeline on scene updates, App.js on FDX import (App.js:2732), App.js scene insert/delete/reorder handlers.
- **Mutates:** `isSavingScenes` state; triggers DB upsert of all scenes including delete of stale IDs.
- **Persists:** Supabase `scenes` table via `sync_scenes` RPC.
- **Sync/async:** Async. Has sync lock: `syncLocks.current.scenes = true` on entry, released with 750ms delay.
- **Risk level:** CRITICAL — saves entire scene array, deletes stale DB rows. If called with a partial array, scenes can be permanently deleted.
- **Should WritingScript receive it?** NO — WritingScript explicitly omits this callback.
- **Should future handoff use it?** NO for WritingScript. YES for ScriptBreakdown and StripboardSchedule. A partial-array guard or scene-by-scene atomic approach would reduce risk.

---

## setScenes

- **Defined in:** App.js:123 (React useState setter)
- **Passed to:** Script.js (App.js:4373), StripboardSchedule (App.js:4423), Locations (as `setMainScenes`, App.js:4673)
- **Called by:** All recipients, plus App.js inline callbacks for heading/time-of-day updates (App.js:4703, 4727).
- **Mutates:** `scenes` App state directly.
- **Persists:** Nothing — caller is responsible for also calling `saveScenesDatabase`.
- **Sync/async:** Synchronous (React state update).
- **Risk level:** HIGH — raw state setter. Any recipient can replace the entire scenes array without triggering a database save, causing silent desync.
- **Should WritingScript receive it?** NO.
- **Should future handoff use it?** Preferably wrap in a guarded mutation function. Passing raw `setScenes` to 3+ modules is fragile.

---

## setStripboardScenes

- **Defined in:** App.js:1684 (React useState setter)
- **Passed to:** Script.js (App.js:4385), StripboardSchedule (App.js:4420)
- **Called by:** Both recipients.
- **Mutates:** `stripboardScenes` App state.
- **Persists:** Nothing on its own — `syncStripboardScenesToDatabase` must be called separately.
- **Sync/async:** Synchronous.
- **Risk level:** HIGH — same raw-setter risk as setScenes.
- **Should WritingScript receive it?** NO.
- **Should future handoff use it?** Wrap in a combined setter-and-sync function.

---

## syncStripboardScenesToDatabase

- **Defined in:** App.js:1070 (wrapper) calls `database.syncStripboardScenesToDatabase` (database.js:873)
- **Passed to:** Script.js as `syncStripboardScenesToDatabase` (App.js:4386), StripboardSchedule as `onSyncStripboardScenes` (App.js:4427)
- **Called by:** Both recipients after local stripboard state changes.
- **Mutates:** Nothing in React state — writes to DB only.
- **Persists:** Supabase `stripboard_scenes` table via `sync_stripboard_scenes` RPC.
- **Sync/async:** Async. Sync lock: `syncLocks.current.stripboardScenes`.
- **Risk level:** MEDIUM — idempotent RPC, but full replace of stripboard data.
- **Should WritingScript receive it?** NO.
- **Should future handoff use it?** YES for ScriptBreakdown, YES for StripboardSchedule.

---

## syncScheduledScenesToDatabase / setScheduledScenes

- **Defined in:** App.js:1083 (sync wrapper), useState (line 1685)
- **Passed to:** StripboardSchedule (`onSyncScheduledScenes`, `setScheduledScenes` — App.js:4419, 4428)
- **Mutates:** `scheduledScenes` App state (setter) and Supabase `scheduled_scenes` table (sync).
- **Sync/async:** Async for sync, synchronous for setter.
- **Risk level:** MEDIUM.
- **Should WritingScript receive it?** NO.

---

## setShootingDays / syncAllShootingDaysToDatabase

- **Defined in:** App.js:1697 (setter), App.js:1157 (sync wrapper)
- **Passed to:** StripboardSchedule (`setShootingDays`, `onSyncAllShootingDays`, `syncShootingDays` — App.js:4418, 4425, 4432). Three shooting-day-related callbacks passed to one module.
- **Mutates:** `shootingDays` App state and Supabase `shooting_days` table.
- **Sync/async:** Async for sync (with UUID conversion logic in App.js:1176–1285, extensive debugging still inline).
- **Risk level:** HIGH — StripboardSchedule receives both the raw setter and two different sync callback variants, creating potential double-sync or inconsistent call ordering.
- **Should WritingScript receive it?** NO.

---

## tagWord

- **Defined in:** App.js:2269
- **Passed to:** Script.js only (App.js:4369)
- **Called by:** Script.js scene editor context menu (Script.js:2884), SceneList (Script.js:5897).
- **Mutates:** `taggedItems` App state (via `setTaggedItems`), then calls `syncTaggedItemsToDatabase`.
- **Persists:** Supabase `tagged_items` table.
- **Sync/async:** Async (triggers async sync inline).
- **Risk level:** MEDIUM — reads `scenes` from closure to locate word instances; stale closure possible.
- **Should WritingScript receive it?** NO — tagging is a production/breakdown function.
- **Should future handoff use it?** YES for ScriptBreakdown only.

---

## untagWordInstance

- **Defined in:** App.js:2026
- **Passed to:** Script.js only (App.js:4370)
- **Called by:** Script.js tag dropdown (Script.js:2842, 5894).
- **Mutates:** `taggedItems` (removes instance or deletes entry), then calls `syncTaggedItemsToDatabase`.
- **Sync/async:** Async.
- **Risk level:** MEDIUM.
- **Should WritingScript receive it?** NO.

---

## syncCharactersToDatabase / handleDeleteCharacter

- **Defined in:** App.js:1336, 1346
- **Passed to:** Script.js as `syncCharactersToDatabase` (App.js:4383), Characters module as `onUpdateCharacters`, `onDeleteCharacter` (App.js:4548, 4549).
- **Mutates:** `characters` App state (via `setCharacters` prop in children), Supabase `characters` table.
- **Risk level:** MEDIUM — `handleDeleteCharacter` also re-syncs updated characters after deletion.
- **Should WritingScript receive it?** NO.

---

## Character scene override callbacks

- **Callback:** `syncCharacterOverridesToDatabase` (App.js:1367)
- **Passed to:** Characters module as `onUpdateCharacterOverrides` (App.js:4550)
- **Mutates:** `characterSceneOverrides` App state + Supabase `projects.character_overrides` JSONB.
- **Risk level:** LOW.

---

## syncScriptLocationsToDatabase / syncActualLocationsToDatabase

- **Defined in:** App.js:1096, 1109 (wrappers calling database.js)
- **Passed to:** Locations module as `onSyncScriptLocations`, `onSyncActualLocations` (App.js:4681–4682)
- **Mutates:** Supabase tables only. React state via props (`setScriptLocations`, `setActualLocations`).
- **Risk level:** MEDIUM — `syncScriptLocationsToDatabase` in database.js has empty-array guard and extensive debug logging left in production code.

---

## syncCallSheetDataToDatabase / setCallSheetData

- **Defined in:** App.js:1139 (sync wrapper), line 1815 (setter)
- **Passed to:** CallSheet (`setCallSheetData`, `syncCallSheetData` — App.js:4498, 4504). Also `updateCrewCallTime` (App.js:4499).
- **Mutates:** `callSheetData` App state + Supabase `call_sheet_data` table.
- **Risk level:** LOW.
- **Should WritingScript receive it?** NO.

---

## Wardrobe/garment callbacks

- **Callbacks:** `syncWardrobeItemsToDatabase`, `syncGarmentInventoryToDatabase` (App.js:1374, 1385)
- **Passed to:** Wardrobe module (App.js:4781–4782)
- **Risk level:** LOW.

---

## Props callbacks

- **App.js callbacks:** `onUpdatePropTitle`, `onRemovePropFromScene`, `onCreatePropVariant`, `onAddPropToScene`, `onCreateNewProp` — defined inline in App.js around line 2300–2500 (approximate; not read in detail).
- **Passed to:** Props.js (App.js:4566–4588)
- **Also:** `onUpdateTaggedItems` (= `setTaggedItems`), `onSyncTaggedItems` (= `syncTaggedItemsToDatabase`), `onDeleteProp` (inline, calls `database.deleteTaggedItem`).
- **Risk level:** MEDIUM — `onUpdateTaggedItems` passes raw `setTaggedItems`, allowing Props to replace the entire tagged items map.

---

## Makeup callbacks

- **Pattern:** Same as Props but for "Makeup" category. `onUpdateMakeupTitle`, `onRemoveMakeupFromScene`, etc.
- **Passed to:** Makeup module (App.js:4614–4625)
- **Risk level:** MEDIUM — same raw `setTaggedItems` pattern.

---

## Production Design callbacks

- **Pattern:** Same as Props but for "Production Design" category.
- **Passed to:** ProductionDesign module (App.js:4635–4646)
- **Risk level:** MEDIUM.

---

## Reports callbacks

- **None** — Reports is read-only, no mutation callbacks.

---

## Budget callbacks

- **Callbacks:** `syncBudgetDataToDatabase` (App.js:1438)
- **Passed to:** Budget (App.js:4864), CostReport (App.js:4755)
- **Side effects:** Budget save also triggers `syncBudgetToCostCategories` which updates `costCategories` state and re-syncs to database (App.js:1448–1458).
- **Risk level:** MEDIUM — budget save has a cascade effect into cost categories.

---

## Writing draft callbacks (handleWritingDraftNodesChange / equivalent)

- **In WritingScript.jsx:** Writing draft is saved entirely within WritingScript via internal `useEffect` + debounced localStorage write. No callback from App.js needed or provided.
- **In Script.js:** Script.js saves writing draft to same localStorage key on editor change (lines 4521, 4921).
- **Risk level:** MEDIUM — two components writing to the same localStorage key without coordination.

---

## Writing beats callbacks

- **In WritingScript.jsx:** Beats saved via internal `useEffect` to `scriptBeats:${projectId}`.
- **In Script.js:** Same key written from Script.js when in writing mode.
- **Risk level:** MEDIUM — same key collision as draft nodes.

---

## Timeline scene move callbacks (handleTimelineSceneMove)

- **In Script.js:** Defined internally around line 4352. Calls `rippleTimelineSceneMove` from writingTimelineUtils, updates `writingDraftNodes`, saves to localStorage.
- **In WritingScript.jsx:** Own internal timeline move handler.
- **Risk level:** LOW (each is isolated within its own component state).

---

## Scene reorder callbacks (onScenesReordered / onReorderScene)

- **Defined in:** App.js, passed to ScriptBreakdown as `onScenesReordered` (App.js:4387).
- **Also in:** SceneList component inside Script.js (`onReorderScene` prop).
- **Called by:** Script.js SceneList drag-drop handler.
- **Mutates:** `scenes` + `stripboardScenes`, then calls `saveScenesDatabase` + `syncStripboardScenesToDatabase`.
- **Risk level:** HIGH — reordering scenes updates both main scenes and stripboard, requires both saves to succeed atomically.

---

## Scene insert/delete callbacks

- **Defined in:** App.js handler functions (approximate lines 4075–4104, 4190).
- **Called by:** Script.js `onInsertScene`, `onDeleteScene` props.
- **Mutates:** `scenes` + `stripboardScenes`, calls both save functions.
- **Risk level:** HIGH — same dual-save concern as reorder.

---

## onSceneNumberChange callback

- **Defined in:** App.js. Passed to ScriptBreakdown (App.js:4363).
- **Called by:** Script.js when user changes a scene number.
- **Mutates:** scenes, stripboardScenes, characters, taggedItems (scene number references throughout).
- **Risk level:** HIGH — cascading update across multiple data domains.

---

## syncCastCrewToDatabase

- **Defined in:** App.js:1122 (wrapper)
- **Passed to:** CastCrew (`onSyncCastCrew`, App.js:4518), Characters (`syncCastCrewToDatabase`, App.js:4551), Wardrobe (App.js:4782 — uncertain)
- **Risk level:** HIGH — `database.syncCastCrewToDatabase` has a hard safety block that prevents syncing if >3 people would be deleted. This can silently fail if a valid large deletion is needed.

---

## Revision callbacks

- **Status:** Uncertain. `WGA_COLORS` and revision logic exist in Script.js but revision state persistence mechanism was not confirmed in source reads.

---

## 2026-05-16 Audit Completion Addendum

### Forbidden Production Callbacks for WritingScript

WritingScript must not receive these callbacks or raw setters:

- `setScenes`
- `saveScenesDatabase`
- `setStripboardScenes`
- `syncStripboardScenesToDatabase`
- `setScheduledScenes`
- `syncScheduledScenesToDatabase`
- `setShootingDays`
- `syncShootingDaysToDatabase`
- `tagWord`
- `untagWordInstance`
- `setTaggedItems`
- `syncTaggedItemsToDatabase`
- `setCharacters`
- `syncCharactersToDatabase`
- `setCastCrew`
- `syncCastCrewToDatabase`
- `setCallSheetData`
- `syncCallSheetDataToDatabase`
- production revision callbacks / `script_revisions` calls

Current `App.js` Writing route passes only `selectedProject`, `user`, `userRole`, and `previewMode="editor"` into `WritingScript`.

### High-Risk Callback Inventory

| Callback / setter | Defined in | Passed to | Mutates | Persists | Risk | WritingScript? | Handoff? |
|---|---|---|---|---|---|---|---|
| `saveScenesDatabase` | `App.js` wrapper around `database.saveScenesDatabase` | Script Breakdown, StripboardSchedule, Locations, Timeline wrapper | production `scenes` | Supabase `sync_scenes` + stale delete | Critical | No | Maybe, only after explicit prompt |
| `setScenes` | `App.js` | Script Breakdown, StripboardSchedule, Locations, Timeline/import paths | production `scenes` | no direct DB unless paired | Critical | No | No direct raw setter |
| `setStripboardScenes` | `App.js` | Script Breakdown, StripboardSchedule | stripboard scenes | no direct DB unless paired | High | No | No |
| `syncStripboardScenesToDatabase` | `App.js` wrapper | Script Breakdown, StripboardSchedule | Supabase stripboard rows | `sync_stripboard_scenes` | High | No | Maybe, only as production post-handoff sync |
| `setScheduledScenes` | `App.js` | StripboardSchedule | scheduled scene map | no direct DB unless paired | High | No | No |
| `syncScheduledScenesToDatabase` | `App.js` wrapper | StripboardSchedule | scheduled scene rows | `sync_scheduled_scenes` | High | No | No |
| `tagWord` / `untagWordInstance` | `App.js` | Script Breakdown | `taggedItems` | `sync_tagged_items` via related flows | High | No | No |
| `syncCharactersToDatabase` | `App.js` wrapper | Script Breakdown, Characters | production characters | `sync_characters` | High | No | Maybe for character handoff only |
| `syncCallSheetDataToDatabase` | `App.js` wrapper | CallSheet | call sheet data | `sync_call_sheet_v2` | Medium | No | No |
| `syncWardrobeItemsToDatabase` / `syncGarmentInventoryToDatabase` | `App.js` wrappers | Wardrobe | wardrobe/garments | wardrobe/garment RPCs | Medium | No | No |
| `syncBudgetDataToDatabase` | `App.js` wrapper | Budget, CostReport | budget data | `sync_budget_data` | Medium | No | No |
| `syncTimelineDataToDatabase` / `syncContinuityElementsToDatabase` | `App.js` wrappers | Timeline | production timeline/continuity | timeline/continuity RPCs | Medium | No | No |
| `handleWritingDraftNodesChange` | `WritingScript.jsx` | WritingScriptEditor | writing draft nodes | localStorage only | High due current bug | Yes | Input source for handoff |

### Current Gaps

- Several modules receive raw setters plus sync callbacks, so local App state and database state can diverge if a save fails.
- StripboardSchedule receives the broadest production mutation surface: `setShootingDays`, `setScheduledScenes`, `setStripboardScenes`, `setScenes`, `saveScenesDatabase`, stripboard sync, scheduled sync, shooting days sync, and scene update callbacks.
- Timeline receives `onUpdateScenes`, which calls `setScenes` and `saveScenesDatabase`; this makes Timeline a production scene writer.
- Locations receives `setMainScenes` and `saveScenesDatabase`, plus direct `database.updateSceneHeading` and `database.updateSceneTimeOfDay` wrappers.
