# Writing Script Module

Writing Script is the draft/story-only script module for the Writing workflow.

## Ownership

- `writingDraftNodes` — flat array of screenplay nodes persisted at `scriptWritingDraft:${projectId}`
- Writing editor (`WritingScriptEditor` / `ScriptWritingEditor`)
- Writing scene list (`SceneList` — writing-safe, no production callbacks)
- Writing timeline (`WritingTimeline`)
- Beats and outline (`BeatsList` — Convert to Scene disabled)
- Target page count
- Writing settings
- Writing-only persistence

## Hard Rules

- Must not call `saveScenesDatabase`.
- Must not mutate production scenes, Script Breakdown scenes, stripboard, schedule, tags, call sheets, revisions, or production scene records.
- Must use writing scene IDs, not production scene IDs.
- Later production sync must happen only through the explicit Writing-to-Pre-Production handoff layer.
- `isViewOnly` is derived from `userRole === "viewer"` prop — never from a production permission system.

## Phase History

- **Phase 4A**: structural folders and `ScriptBreakdown` compatibility wrapper.
- **Phase 4B**: writing draft model helpers moved under `WritingScript`. `scriptWritingModel.js` remains as a re-export.
- **Phase 4C**: `WritingScriptEditor` moved under `WritingScript`. `Script/ScriptWritingEditor.jsx` remains as a re-export.
- **Phase 4D**: `ScreenplayPagePreview` moved under `WritingScript`. `Script/ScreenplayPagePreview.jsx` remains as a re-export.
- **Phase 4E–4H**: ownership wrapper placeholders (WritingTimelinePanel, WritingBeatsPanel, WritingSceneList, WritingSettingsModal).
- **Phase 4I–4L**: WritingScript shell, persistence foundation, isolated editor-only preview, routing activation.
- **Phase 4M–4S**: editor-only mode activated; toolbar, scene list, beats panel, layout geometry, scene fractions added incrementally.
- **Phase 4T–4W**: Writing scene page stats fixed (stale stats, key mismatch, temp-node sceneId normalization).
- **Phase 4Z**: **Full copy/adaptation of Script.js writing-mode implementation.** All prior WritingScript.jsx internals replaced. See details below.

## Phase 4Z Architecture (current)

`WritingScript.jsx` is now a self-contained full-featured writing module, copied/adapted directly from the writing-mode implementation inside `Script.js`. It is ~730 lines.

### State

```js
const [writingDraftNodes, setWritingDraftNodes] = useState([]);
const [writingDraftSaveStatus, setWritingDraftSaveStatus] = useState("saved");
const [writingScenePageStats, setWritingScenePageStats] = useState({});
const [showWritingSceneNumbers, setShowWritingSceneNumbers] = useState(false);
const [showWritingTimeline, setShowWritingTimeline] = useState(false);
const [targetPageCount, setTargetPageCount] = useState(90);
const [showTargetPageDialog, setShowTargetPageDialog] = useState(false);
const [showMoodOverlaySettings, setShowMoodOverlaySettings] = useState(false);
const [beats, setBeats] = useState([]);
const [activeSidePanelTab, setActiveSidePanelTab] = useState("scenes");
const [showBeatsTrack, setShowBeatsTrack] = useState(false);
const [showBeatImportDialog, setShowBeatImportDialog] = useState(false);
const [beatImportText, setBeatImportText] = useState("");
const [beatImportDraft, setBeatImportDraft] = useState(null);
const [selectedBeatDetailId, setSelectedBeatDetailId] = useState(null);
const [collapsedActIds, setCollapsedActIds] = useState({});
const [currentIndex, setCurrentIndex] = useState(0);
const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
const [writingEditorElementType, setWritingEditorElementType] = useState("");
```

### Persistence Keys

| Data | localStorage Key |
|---|---|
| Draft nodes | `scriptWritingDraft:${projectId}` |
| Beats | `scriptBeats:${projectId}` |

Both keys match what Script.js writing mode uses. Sharing the key means writing drafts and beats are shared between Script.js writing mode and WritingScript — this is intentional for now and will be separated in a future handoff phase.

### Stats: Multi-Key Lookup

`writingScenePageStats` is set via `onSceneStatsChange={setWritingScenePageStats}` from `ScriptWritingEditor`. The editor keys stats by `headingNode.id` (primary) and `headingNode.sceneId` (secondary). The `writingDraftScenes` useMemo uses `stableSceneId = headingNode.id || headingNode.sceneId || scene.sceneId || scene.id || fallback` and sets `scene.id = stableSceneId`, ensuring the lookup always hits the correct stats entry.

### Production Isolation

The following callbacks are intentionally absent from WritingScript:
- `saveScenesDatabase` — not called
- `setScenes` — not called
- `setStripboardScenes` — not called
- `syncStripboardScenesToDatabase` — not called
- `tagWord` / `untagWordInstance` — not called
- All production character/revision/schedule/call-sheet/report mutation callbacks

`handleStartNewScript` creates only a single `createEmptySceneHeadingNode()` and saves to localStorage — no DB call.

Beat Convert to Scene is disabled: `onConvertItem={null}` passed to BeatsList; the button is always rendered as disabled.

### Imports

```js
import { usePresence, PresenceIndicator } from "../../shared/presence";
import { calculateScenePageStats, LINES_PER_PAGE } from "../../shared/scenePageStats";
import { createSceneId } from "../../../utils/sceneIdentity";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../../utils/sceneDisplayLabel";
import { getSceneRowPresentation, getSceneMetadataColumns, SCENE_METADATA_COLUMN_WIDTHS } from "../../../utils/scenePresentation";
import WritingTimeline from "../../../experimental/writingTimeline/WritingTimeline";
import ScriptWritingEditor from "../Script/ScriptWritingEditor"; // re-export shim → WritingScriptEditor
import { documentNodesFromScenes, scenesFromDocumentNodes, createEmptySceneHeadingNode } from "./writingDraftModel";
```

## Compatibility Re-exports (not modified)

- `src/components/modules/Script/ScriptWritingEditor.jsx` → re-exports `WritingScriptEditor`
- `src/components/modules/Script/scriptWritingModel.js` → re-exports from `writingDraftModel`
- `src/components/modules/WritingScript/WritingScriptEditor.jsx` — the actual editor implementation

## Props from App.js

```jsx
<WritingScript
  previewMode="editor"
  selectedProject={selectedProject}
  user={user}
  userRole={userRole}
/>
```

No production scene, stripboard, schedule, tag, revision, character, database, or `saveScenesDatabase` callbacks are passed.

## Files

| File | Purpose |
|---|---|
| `WritingScript.jsx` | Main component — full writing mode UI |
| `WritingScriptEditor.jsx` | Screenplay editor (contenteditable) |
| `writingDraftModel.js` | Node type constants and conversion helpers |
| `writingPageStats.js` | Legacy stats helpers (Phase 4W) — no longer imported in WritingScript.jsx |
| `ScreenplayPagePreview.jsx` | Page preview panel |
| `WritingTimelinePanel.jsx` | Thin wrapper around experimental WritingTimeline |
| `WritingBeatsPanel.jsx` | Placeholder (beats now handled inline in WritingScript.jsx) |
| `WritingSceneList.jsx` | Placeholder (scene list now handled inline in WritingScript.jsx) |
| `WritingSettingsModal.jsx` | Placeholder (settings now handled inline in WritingScript.jsx) |
| `ARCHITECTURE.md` | This file |
