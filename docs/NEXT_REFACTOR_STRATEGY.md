# Next Refactor Strategy

Date: 2026-05-16

Scope: app-wide architecture audit strategy only. Do not treat this file as approval to implement code.

---

## Current Architecture Baseline

- `AuthWrapper` owns auth session, selected project, user role/module permissions, and `activeWorkflow`. It injects those props into `App` with `React.cloneElement` (`src/components/auth/AuthWrapper.js:983`).
- `App` owns most production/app-wide state: `scenes`, `stripboardScenes`, `scheduledScenes`, `shootingDays`, `callSheetData`, `taggedItems`, `characters`, locations, wardrobe, budget, timeline, continuity, todo, DOD, and project settings (`src/App.js:124`, `src/App.js:1675` onward).
- `WritingScript` is the new draft-only route for `activeWorkflow === "writing"` (`src/App.js:4875`, `src/App.js:4891`).
- `Script Breakdown` still renders legacy `Script.js` through `src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`.
- Pre-Production and Production still share the same module system and `renderModule()` path.
- Pitching and Post-Production are disabled/Coming Soon shell states.

---

## What Must Not Be Touched Yet

1. Do not remove legacy writing branches from `Script.js` until WritingScript draft persistence is proven stable and the user approves cleanup.
2. Do not change `saveScenesDatabase` or stale-scene deletion behavior while writing draft persistence is unstable.
3. Do not change scene identity semantics while Stripboard, StripboardSchedule, CallSheet, Reports, ShotList, Characters, Props, Makeup, and Production Design still depend on mixed scene references.
4. Do not split Pre-Production and Production module ownership until the workflow shell has separate module lists and active module state per workflow.
5. Do not rename storage keys without a migration plan. `scriptWritingDraft:${projectId}` and related writing keys are actively shared by old and new paths.
6. Do not route production mutation callbacks into WritingScript. Forbidden callbacks include `setScenes`, `saveScenesDatabase`, `setStripboardScenes`, `syncStripboardScenesToDatabase`, `tagWord`, `untagWordInstance`, production character callbacks, schedule callbacks, call sheet callbacks, and revision callbacks.

---

## Stabilize First

### 1. WritingScript Draft Persistence

Highest priority. Manual testing after Phase 4M found that scene heading appears to persist on reload, but body/action text may not persist.

Recommended next implementation phase:

- Inspect `WritingScript` editor save flow from `WritingScriptEditor` to `handleWritingDraftNodesChange`.
- Confirm whether `contentEditable` body text updates are emitted as node changes.
- Inspect localStorage payload for `scriptWritingDraft:${projectId}` after typing heading and action text.
- Fix only the draft persistence path, without adding scene list/timeline/beats/settings work in the same patch.
- Verify no Supabase `sync_scenes` call happens while editing WritingScript.

### 2. Writing Layout Pass

After persistence is stable:

- Move the element selector/control to a deliberate toolbar location.
- Confirm writing toolbar, target pages, save status, and settings controls fit without jumps.
- Keep layout changes contained to WritingScript.

### 3. Writing Surface Activation

Only after persistence/layout are stable:

- Activate writing scene list.
- Activate writing timeline.
- Activate beats panel.
- Activate settings modal.
- Keep each surface in a separate small phase.

---

## Centralize Later

### Writing Model

Current overlap:

- `src/components/modules/WritingScript/writingDraftModel.js`
- `src/components/modules/Script/scriptWritingModel.js` compatibility re-export
- `documentNodesFromScenes`
- `scenesFromDocumentNodes`

Future target:

- `WritingScript` owns writing draft model helpers.
- Handoff owns conversion from writing nodes/scenes to production scenes.
- `ScriptBreakdown` should not depend on writing draft ownership.

### Beat/Outline Logic

Current overlap:

- Beat parsing, normalization, import, ordering, color, and detail logic exists in both `Script.js` and `WritingScript.jsx`.

Future target:

- Extract pure generic beat parsing utilities.
- Keep writing beat state under WritingScript.
- Move any conversion-to-production-scene behavior behind explicit handoff.

### Scene Display and Identity

Current shared utilities:

- `src/utils/sceneIdentity.js`
- `src/utils/sceneDisplayLabel.js`
- `src/utils/scenePresentation.js`
- `src/utils/propSceneRefs.js`

Future target:

- Keep display labels out of persistence keys.
- Use internal scene IDs for production references.
- Introduce explicit `writingSceneId`, `productionSceneId`, and `sourceWritingSceneId`.

---

## Production Callback Protection

Wrap or narrow high-risk callbacks before more workflow divergence:

| Callback | Current risk | Future protection |
|---|---|---|
| `saveScenesDatabase` | Full production scene save plus stale scene deletion | Only callable from Script Breakdown / explicit handoff / production scene tools |
| `setScenes` | Raw App state setter passed into multiple modules | Replace with named operations where possible |
| `setStripboardScenes` | Schedule/stripboard scenes can diverge from scenes | Route through stripboard-specific updater |
| `syncStripboardScenesToDatabase` | Must stay aligned with scene IDs and status | Wrap with transaction-like App helper |
| `setScheduledScenes` / sync scheduled scenes | Schedule blocks and scheduled map can diverge | Prefer one canonical schedule representation |
| `tagWord` / `untagWordInstance` | Production breakdown tags; should not be in WritingScript | Keep only in Script Breakdown |
| Character sync callbacks | Production casting-facing data | Keep out of Writing Characters until handoff/linking |
| Revision callbacks | Production script revision history | Keep in Script Breakdown only |

---

## Continue Writing / Script Breakdown Split Safely

Recommended phase order:

1. Fix WritingScript body/action persistence.
2. Add a focused WritingScript regression test checklist and manual verification notes.
3. Clean up WritingScript toolbar/layout.
4. Activate WritingSceneList using writing-only nodes/scenes.
5. Activate WritingTimelinePanel using writing-only nodes/scenes.
6. Activate WritingBeatsPanel with writing-only persistence.
7. Add WritingSettingsModal as the owner of target page count, timeline visibility, beats visibility, scene-number visibility, and mood overlay settings.
8. Stop legacy `Script.js` from writing to writing draft localStorage when it is reached as Script Breakdown.
9. Remove or disable legacy writing mode inside Script Breakdown.
10. Add explicit Writing-to-Pre-Production handoff.
11. Add Writing Characters as draft-only data.
12. Add character handoff/linking to Production Characters.

---

## Plan Pre-Production vs Production Divergence

Current state: Pre-Production and Production both render the same existing module system.

Recommended future steps:

1. Add `activeModuleByWorkflow` only after WritingScript is stable.
2. Introduce workflow module config:
   - Writing: Script, future Writing Characters.
   - Pre-Production: Script Breakdown, Stripboard, Schedule prep, Characters, Locations, Props, Makeup, Production Design, Wardrobe, Budget, Cast & Crew.
   - Production: StripboardSchedule, CallSheet, Reports, Day Out of Days, ShotList, Cost Report, Calendar, production-facing modules.
3. Keep old module labels and permissions compatible through `normalizeModuleName`.
4. Avoid moving modules between workflows until each module's data ownership is clear.

---

## Safest Future Phase Order

1. **Phase N:** Fix WritingScript body/action persistence bug.
2. **Phase O:** WritingScript toolbar/layout stabilization.
3. **Phase P:** WritingScript scene list activation.
4. **Phase Q:** WritingScript settings ownership.
5. **Phase R:** WritingScript timeline activation.
6. **Phase S:** WritingScript beats activation and beat key ownership cleanup.
7. **Phase T:** Freeze/disable legacy writing branches in Script Breakdown.
8. **Phase U:** Create handoff mapper for scenes.
9. **Phase V:** Create handoff modal.
10. **Phase W:** Create Writing Characters model/storage.
11. **Phase X:** Create character handoff/linking.
12. **Phase Y:** Split Pre-Production/Production module lists.

---

## Stop Conditions

Stop and re-plan if any of the following appear:

- WritingScript calls `saveScenesDatabase`.
- WritingScript receives `setScenes` or production mutation callbacks.
- Script Breakdown stops opening the existing production script path.
- A scene reorder breaks stripboard scene IDs.
- A write path changes display labels instead of internal IDs.
- Pre-Production and Production diverge before permissions/module compatibility is mapped.
