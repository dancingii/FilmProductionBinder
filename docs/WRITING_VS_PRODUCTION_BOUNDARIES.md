# Writing vs. Production Boundaries

This is the canonical boundary definition for what WritingScript may and may not own or call.

---

## Current Enforcement Status

As of Phase 4Z, the WritingScript module correctly:
- Receives no production mutation callbacks from App.js
- Does not call `saveScenesDatabase`
- Does not call `setScenes`
- Does not call `setStripboardScenes`
- Does not call `syncStripboardScenesToDatabase`
- Does not call `tagWord` or `untagWordInstance`
- Has `onConvertItem={null}` — Beat Convert to Scene is disabled
- Derives `isViewOnly` from `userRole === "viewer"` (not from a production permission callback)

---

## WritingScript MAY Own or Use

### Data
- `writingDraftNodes` — flat array of `{ id, type, text, sceneId, metadata }` nodes
- `writingDraftSaveStatus` — `"saved"` | `"saving"` | `"unsaved"`
- `writingScenePageStats` — page stats map from the editor, keyed by node IDs
- `writingDraftScenes` — derived from `scenesFromDocumentNodes(writingDraftNodes)`, never connected to production scenes
- `beats` — outline/beat items (writing-only narrative planning)
- Writing-only UI state: `activeSidePanelTab`, `collapsedActIds`, `beatTrackZoom`, `currentIndex`, `currentSceneNumber`, `writingEditorElementType`
- Writing-only settings: `showWritingTimeline`, `showBeatsTrack`, `targetPageCount`, `showWritingSceneNumbers`

### Mood Overlay
- `showMoodOverlay` and `moodOverlaySettings` — currently read from UNSCOPED localStorage keys (`"scriptMoodOverlayEnabled"`, `"scriptMoodOverlaySettings"`) — this is a **shared key risk** (see Known Issues below)
- **Risk:** Mood overlay state in WritingScript and Script.js currently share the same unscoped localStorage key. Changing mood overlay in one affects the other on next load. This should be scoped to writing-only keys eventually.

### Persistence
WritingScript may write to these localStorage keys:
- `scriptWritingDraft:${projectId}` — writing draft
- `scriptBeats:${projectId}` — beats array (**shared with Script.js writing mode — see Known Issues**)
- `scriptTimelineVisible:writing:${projectId}` — scene timeline visibility
- `scriptTargetPageCount:${projectId}` — target page count
- `scriptSidePanelTab:${projectId}` — scenes/beats tab selection
- `scriptCollapsedActs:${projectId}` — collapsed act IDs

### Display
- Writing timeline (via `WritingTimeline` component)
- Writing scene list (via `SceneList` component with writing-only props)
- Beats list (via `BeatsList` component, Convert to Scene disabled)
- All writing modals: beat import, beat detail, target page dialog, settings modal

### External Services
- `usePresence(selectedProject?.id, user, "script", currentSceneNumber)` — currently uses `"script"` channel (**shared risk** — same channel as Script.js)

---

## WritingScript MUST NOT Receive or Call

### From App.js — Must Not Be Passed as Props
- `scenes` — production scene array
- `setScenes` — production scene setter
- `saveScenesDatabase` — database scene write
- `stripboardScenes` — stripboard data
- `setStripboardScenes` — stripboard setter
- `syncStripboardScenesToDatabase` — stripboard DB write
- `tagWord` — script tagging write
- `untagWordInstance` — script tagging write
- `isWordInstanceTagged` — tagging read (not needed in writing mode)
- `taggedItems` — tagged items (production data)
- `characters`, `setCharacters`, `syncCharactersToDatabase` — production character data
- `moodboardImages` — production moodboard images (not needed in writing mode)
- `onScenesReordered` — production scene reorder callback
- `handleFileUpload`, `handleSingleSceneUpload` — FDX import (production path)
- `onSceneNumberChange` — production scene number change

### Within WritingScript — Must Not Be Called
- `database.saveScenesDatabase(...)` — never
- Any Supabase write that targets the `scenes` table
- Any function that writes to the production `scenes` App state

---

## Script Breakdown (Script.js) Owns

Script Breakdown owns these exclusively. WritingScript must not touch them.

| Concern | Details |
|---|---|
| Production scenes | `scenes` state in App, `editingScenes` in Script.js |
| Production scene DB persistence | `saveScenesDatabase(updatedScenes)` |
| Script tagging | `tagWord`, `untagWordInstance`, `taggedItems` |
| FDX import | `handleFileUpload`, `handleSingleSceneUpload` |
| Scene number/label edits | `onSceneNumberChange` |
| Revision tracking | `committedRounds`, `pendingRecord`, revision modal |
| Production characters | `characters`, `setCharacters`, `syncCharactersToDatabase` |
| Stripboard data | `stripboardScenes`, `setStripboardScenes`, `syncStripboardScenesToDatabase` |
| Scheduling/call sheets | `scheduledScenes`, `callSheetData` (owned by other modules, not Script.js) |
| Moodboard images | `moodboardImages` (production-sourced) |
| Beat-to-scene conversion | `handleConvertBeatToScene` → calls `saveScenesDatabase` |

---

## Future Writing-to-Pre-Production Handoff

This handoff does not exist yet. The current design:

**Current state:** Writing draft and production scenes are fully separate. There is no automatic sync from writing to production.

**Required future design:**
- WritingScript produces `writingDraftNodes` (stored in `scriptWritingDraft:${projectId}`)
- A separate, explicit handoff action should be available that:
  1. Converts `writingDraftNodes` → production scene objects via `scenesFromDocumentNodes`
  2. Shows a confirmation dialog ("This will replace your production scenes with your writing draft. Continue?")
  3. Only on user confirmation: calls `setScenes(convertedScenes)` and `saveScenesDatabase(convertedScenes)` from App.js
  4. The handoff action should live in App.js or a dedicated handoff module — NOT inside WritingScript

**Rules for the handoff:**
- WritingScript must not call the handoff action directly
- The handoff must be user-initiated, never automatic
- The handoff must show a confirmation that explains what it does
- The handoff must be reversible (consider DB backup / Supabase before writing)
- Beat-to-scene mapping from writing beats → production scenes is a separate, later concern

---

## Known Shared-Key Risks

These are places where WritingScript and Script.js (Script Breakdown) share the same localStorage keys, meaning data written by one is read by the other:

| Key | Shared By | Risk |
|---|---|---|
| `scriptWritingDraft:${projectId}` | WritingScript AND Script.js | **INTENDED SHARED** — this is correct; both should see the same draft |
| `scriptBeats:${projectId}` | WritingScript AND Script.js | **INTENDED SHARED** — writing beats are the same in both modules |
| `scriptMoodOverlayEnabled` | WritingScript (unscoped), Script.js (unscoped at init) | **UNINTENDED SHARED** — should be project-scoped in WritingScript |
| `scriptMoodOverlaySettings` | WritingScript (unscoped), Script.js (unscoped at init) | **UNINTENDED SHARED** — same issue |
| `scriptSidePanelTab:${projectId}` | WritingScript AND Script.js | **SHARED** — tab selection syncs between modules, may be intentional |
| `scriptCollapsedActs:${projectId}` | WritingScript AND Script.js | **SHARED** — collapsed acts syncs between modules |
| `scriptTargetPageCount:${projectId}` | WritingScript AND Script.js | **SHARED** — same target applies in both modules |
| `scriptTimelineVisible:writing:${projectId}` | WritingScript AND Script.js | **SHARED** — timeline visibility in writing mode |

### Action Required
- Mood overlay keys in WritingScript should be changed to project-scoped: `scriptMoodOverlayEnabled:${projectId}` and `scriptMoodOverlaySettings:${projectId}`. This prevents the overlay toggle in Writing from affecting Script Breakdown on next load.
- The Writing presence channel should eventually be changed from `"script"` to `"writing-script"`.

---

## Boundary Verification Test

Before any phase that touches WritingScript, verify:

1. App.js `<WritingScript ...>` render does NOT pass: `scenes`, `setScenes`, `saveScenesDatabase`, `stripboardScenes`, `setStripboardScenes`, `syncStripboardScenesToDatabase`, `tagWord`, `untagWordInstance`, `characters`, `setCharacters`, or any production mutation callback.
2. `grep -n "saveScenesDatabase\|setScenes\b\|setStripboard" src/components/modules/WritingScript/WritingScript.jsx` returns only comments.
3. `grep -n "supabase\." src/components/modules/WritingScript/WritingScript.jsx` returns nothing.
4. WritingScript does not import from `../../../services/database`.
