# Module Interaction Matrix

## Column Key

| Abbrev | Data Domain |
|---|---|
| Proj | selectedProject |
| Role | user/userRole/modulePermissions |
| Wflow | activeWorkflow/activeModule |
| Scenes | scenes (production array) |
| Strip | stripboardScenes |
| Sched | scheduledScenes |
| WDraft | writingDraftNodes / writingDraftScenes |
| Beats | beats (outline) |
| Tags | taggedItems |
| Chars | characters |
| Locs | scriptLocations/actualLocations |
| Props | props (via taggedItems) |
| Mkup | makeup (via taggedItems) |
| PD | productionDesign (via taggedItems) |
| Ward | wardrobeItems/garmentInventory |
| Budg | budget/costs/vendors |
| Rpts | reports (read-only aggregated) |
| Mood | moodboardImages/moodboard |
| Shots | shotList/sceneNotes |
| CSheet | callSheetData |
| TL | timelineData (production) |
| Revs | revisionData |

## Marker Key

| Marker | Meaning |
|---|---|
| R | Reads from App state (receives as prop, reads local) |
| W | Writes to App state or local state (mutates) |
| DB | Loads from or saves to database |
| LS | Uses localStorage |
| CB | Receives callback from App.js |
| D | Derived / computed only (no direct R/W) |
| ? | Uncertain |

---

## Matrix

| Module | Proj | Role | Wflow | Scenes | Strip | Sched | WDraft | Beats | Tags | Chars | Locs | Props | Mkup | PD | Ward | Budg | Rpts | Mood | Shots | CSheet | TL | Revs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **AuthWrapper** | W,DB | W | W | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **App.js** | R | R | R,W | R,W,DB | R,W,DB | R,W,DB | — | — | R,W,DB | R,W,DB | R,W,DB | D | D | D | R,W,DB | R,W,DB | — | R,W | R,W,DB | R,W,DB | R,W,DB | ? |
| **WritingScript** | R | R | — | — | — | — | R,W,LS | R,W,LS | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **Script.js (ScriptBreakdown)** | R | R | — | R,W,CB | R,W,CB | — | R,W,LS | R,W,LS | R,W,CB | R,W,CB | — | — | — | — | — | — | — | R | — | — | — | R,LS |
| **Dashboard** | R | R | W | R | R | R | — | — | — | — | — | — | — | — | — | R | — | — | — | R | — | — |
| **Stripboard** | — | R | — | — | R | — | — | — | R | R | — | — | — | — | R | — | — | — | — | — | — | — |
| **StripboardSchedule** | R | R | — | R,W,CB | R,W,CB | R,W,CB | — | — | — | — | R | — | — | — | — | — | — | — | — | — | — | — |
| **CallSheet** | R | — | — | R | R | R | — | — | R | R | R | — | — | — | R | — | — | — | — | R,W,CB | — | — |
| **Characters** | R | R | W | R | R | — | — | — | R | R,W,CB | — | — | — | — | R | — | — | — | — | — | — | — |
| **CastCrew** | R | R | — | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **Locations** | R | R | W | R,W,CB | R | — | — | — | — | — | R,W,CB | — | — | — | — | — | — | — | — | — | — | — |
| **Props** | R | R | W | R | R | — | — | — | R,W,CB | R | — | R,W,CB | — | — | — | — | — | — | — | — | — | — |
| **Makeup** | — | R | W | R | — | — | — | — | R,W,CB | R | — | — | R,W,CB | — | — | — | — | — | — | — | — | — |
| **ProductionDesign** | — | R | W | R | — | — | — | — | R,W,CB | — | R | — | — | R,W,CB | — | — | — | — | — | — | — | — |
| **Wardrobe** | R | R | W | R | — | — | — | — | — | R | — | — | — | — | R,W,CB | — | — | — | — | — | — | — |
| **Reports** | — | R | — | R | R | R | — | — | R | — | — | — | — | — | R | — | D | — | — | — | — | — |
| **Budget** | — | R | — | — | — | — | — | — | — | — | — | — | — | — | — | R,W,CB | — | — | — | — | — | — |
| **CostReport** | R | R | — | R | — | — | — | — | — | — | — | — | — | — | — | R,W,CB | — | — | — | — | — | — |
| **Calendar** | — | R | — | — | R | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **DayOutOfDays** | R | R | — | — | R | R | — | — | — | R | — | — | — | — | — | — | — | — | — | — | — | — |
| **ShotList** | R | R | — | — | R | R | — | — | — | R | — | — | — | — | — | — | — | — | R,W,CB | — | — | — |
| **Timeline (prod)** | — | R | — | R,W,CB | R | — | — | — | — | R | — | — | — | — | — | — | — | — | — | — | R,W,CB | — |
| **MoodBoard** | R | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | R,W,DB,LS | — | — | — | — |
| **ToDoList** | R | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **WritingTimeline (exp)** | — | — | — | — | — | — | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **writingDraftModel** | — | — | — | — | — | — | D | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **writingDraftPersistence** | — | — | — | — | — | — | R,W,LS | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **usePresence** | R | R | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **database.js** | R | — | — | R,W,DB | R,W,DB | R,W,DB | — | — | R,W,DB | R,W,DB | R,W,DB | — | — | — | R,W,DB | R,W,DB | — | — | R,W,DB | R,W,DB | R,W,DB | — |

---

## Notes on the Matrix

1. **Scene writes are dangerously distributed.** Six different modules (Script.js, StripboardSchedule, Locations, Timeline, App.js handlers, and FDX import) can write to `scenes` or `stripboardScenes`. Only App.js wrappers have sync locks.

2. **WritingScript is correctly isolated.** It touches WDraft and Beats only — no production state columns show R/W.

3. **Props/Makeup/ProductionDesign all write to Tags (taggedItems).** They share the same mutation surface and the same `onUpdateTaggedItems` raw setter. A bug in one can corrupt data used by the others.

4. **Reports column is all R or D.** Reports is genuinely read-only — good.

5. **MoodBoard persistence is self-contained.** It does not route saves through App.js callbacks. The only App.js coupling is `onMoodboardDataChange` which updates `scriptMoodImages`.

6. **Timeline (production) can call `saveScenesDatabase`.** It receives `onUpdateScenes` which calls both `setScenes` and `saveScenesDatabase` in App.js. Timeline is the only "non-script" module with this level of scene write access.

7. **Characters module has unusually broad write access.** It can mutate `characters`, `castCrew`, and `characterSceneOverrides` — three different data domains.

---

## 2026-05-16 Matrix Addendum

### Additional Rows / Clarifications

| Module | Proj | Role | Wflow | Scenes | Strip | Sched | WDraft | Beats | Tags | Chars | Locs | Props | Mkup | PD | Ward | Budg | Rpts | Mood | Shots | CSheet | TL | Revs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **MobileApp** | R,W,DB | R,W,DB | W | R,W,DB | R,W,DB | R,W,DB | — | — | R,W,DB | R | — | R,W | — | — | R,W,DB | R | — | — | — | R,W,DB | — | — |
| **Auth DisplayNameEditor** | R,DB | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **ProjectSelector** | R,W,DB | R,W,DB | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **SceneDetailModal** | — | — | — | CB | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| **WritingCharacters placeholder** | — | — | — | — | — | — | ? | — | — | ? | — | — | — | — | — | — | — | — | — | — | — | — |

### Matrix Interpretation Updates

- `WritingScript` is not purely editor-only in current source: when routed with `previewMode="editor"`, it now contains toolbar/settings, scene list, beats panel, and optional writing timeline code paths. It still does not receive production callbacks.
- `Script.js (ScriptBreakdown)` should be read as "legacy mixed Script component mounted through ScriptBreakdown wrapper." It still owns writing-mode localStorage branches in addition to production scene/revision/tag behavior.
- `MobileApp` must be included in scene/schedule regression testing because it has separate state and database loading paths from desktop `App.js`.
