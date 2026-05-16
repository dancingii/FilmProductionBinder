# Prop Flow Map

Legend:
- `[PROD-MUTATE]` — callback that writes production data to Supabase or App state
- `[PROD-READ]` — reads production data but does not mutate
- `[WRITING-ONLY]` — writing-draft only, no production side-effect
- `[UI-ONLY]` — view/display callback, no data mutation
- `[SHARED]` — shared between writing and production contexts (potential coupling risk)

---

## AuthWrapper

**Props IN:** none (root)

**Props OUT (via `React.cloneElement` to App):**
- `selectedProject` — active project object
- `userRole` — role string
- `modulePermissions` — custom module permission list or null
- `user` — Supabase auth user object
- `activeWorkflow` — current workflow tab string

**Internal state:** `selectedProject`, `userRole`, `modulePermissions`, `user`, `activeWorkflow`

---

## App (`src/App.js`)

**Props IN from AuthWrapper:**
- `selectedProject`, `userRole`, `modulePermissions`, `user`, `activeWorkflow`

**Key state:**
- `scenes` — production scenes [PROD-READ source]
- `stripboardScenes` — stripboard copy
- `taggedItems`, `characters`, `castCrew`, `callSheetData`, etc.
- `activeModule`, `writingActiveModule`, `currentIndex`

**Callbacks defined and passed to production modules:**
- `saveScenesDatabase(updatedScenes)` [PROD-MUTATE] — App wrapper around `database.saveScenesDatabase`
- `setScenes(updatedScenes)` [PROD-MUTATE] — updates App-level canonical scenes
- `setStripboardScenes(updatedStripboard)` [PROD-MUTATE] — updates App-level stripboard
- `syncStripboardScenesToDatabase(scenes)` [PROD-MUTATE] — writes stripboard to Supabase
- `tagWord(word, category)` [PROD-MUTATE] — creates a tagged item
- `untagWordInstance(key, si, bi, wi)` [PROD-MUTATE] — removes a tag instance
- `onSceneNumberChange(...)` [PROD-MUTATE] — updates scene label/number
- `handleScriptScenesReordered(...)` [PROD-MUTATE] — reorders and saves scenes
- `syncCharactersToDatabase(...)` [PROD-MUTATE]
- `updateStripboardScene(...)` [PROD-MUTATE]
- `showAlert(message)`, `showConfirm(message)` [UI-ONLY]

**Props passed to WritingScript (ONLY):**
```js
previewMode="editor"          // [UI-ONLY] activates editor render path
selectedProject={selectedProject}  // [PROD-READ] project identity
user={user}                   // [PROD-READ] user identity
userRole={userRole}           // [UI-ONLY] permission derivation
```

**Note:** No production callbacks are passed to WritingScript.

**Props passed to ScriptBreakdownModule (partial list):**
```js
scenes={scenes}                          // [PROD-READ]
setScenes={setScenes}                    // [PROD-MUTATE]
saveScenesDatabase={saveScenesDatabase}  // [PROD-MUTATE]
stripboardScenes={stripboardScenes}      // [PROD-READ]
setStripboardScenes={setStripboardScenes} // [PROD-MUTATE]
syncStripboardScenesToDatabase={...}      // [PROD-MUTATE]
tagWord={tagWord}                         // [PROD-MUTATE]
untagWordInstance={untagWordInstance}     // [PROD-MUTATE]
taggedItems={taggedItems}                // [PROD-READ]
characters={characters}                   // [PROD-READ]
setCharacters={setCharacters}            // [PROD-MUTATE]
syncCharactersToDatabase={...}           // [PROD-MUTATE]
moodboardImages={scriptMoodImages}       // [PROD-READ]
onScenesReordered={handleScriptScenesReordered} // [PROD-MUTATE]
onAlert={showAlert}                      // [UI-ONLY]
onConfirm={showConfirm}                  // [UI-ONLY]
userRole, canEdit, isViewOnly, selectedProject, user  // [PROD-READ / UI-ONLY]
```

---

## ScriptBreakdown (`ScriptBreakdown.jsx`)

Thin pass-through wrapper: `<LegacyScriptModule {...props} />`. All props listed above flow into `Script.js` unchanged.

---

## Script.js (`src/components/modules/Script/Script.js`)

**Props IN (production-facing):**
```js
scenes                          // [PROD-READ]
currentIndex, setCurrentIndex   // [PROD-READ / PROD-MUTATE]
setScenes                       // [PROD-MUTATE]
saveScenesDatabase              // [PROD-MUTATE]
handleFileUpload                // [PROD-MUTATE]
handleSingleSceneUpload         // [PROD-MUTATE]
taggedItems                     // [PROD-READ]
tagCategories                   // [PROD-READ]
showTagDropdown, setShowTagDropdown  // [UI-ONLY]
tagWord                         // [PROD-MUTATE]
untagWordInstance               // [PROD-MUTATE]
isWordInstanceTagged            // [PROD-READ]
onSceneNumberChange             // [PROD-MUTATE]
stripboardScenes                // [PROD-READ]
userRole, canEdit, isViewOnly   // [UI-ONLY]
selectedProject, user           // [PROD-READ]
characters                      // [PROD-READ]
setCharacters                   // [PROD-MUTATE]
syncCharactersToDatabase        // [PROD-MUTATE]
moodboardImages                 // [PROD-READ]
setStripboardScenes             // [PROD-MUTATE]
syncStripboardScenesToDatabase  // [PROD-MUTATE]
onScenesReordered               // [PROD-MUTATE]
onAlert, onConfirm              // [UI-ONLY]
```

**Key internal state:**
- `editingScenes` — local write buffer for production scene edits
- `isEditMode`, `isSaving`, `committedRounds`, `viewingRevision` — edit mode state
- `isWritingMode` — boolean derived from `editingScenes` existence (confusingly named; relates to script edit mode, not the Writing workflow)
- `writingDraftNodes` [WRITING-ONLY] — writing draft node array
- `beats` [WRITING-ONLY] — outline/beat items
- `showWritingTimeline`, `showBeatsTrack`, `targetPageCount` [WRITING-ONLY] — writing settings
- `showMoodOverlay`, `moodOverlaySettings` [SHARED] — mood overlay (shared key with WritingScript)
- `activeSidePanelTab`, `collapsedActIds` [SHARED] — side panel tab/act state

**Production mutation callbacks used internally:**
- `setScenes(updatedScenes)` [PROD-MUTATE] — called after scene edits, reorder, delete, new scene
- `saveScenesDatabase(updatedScenes)` [PROD-MUTATE] — called after scene save, file upload, reorder
- `setStripboardScenes(...)` [PROD-MUTATE] — called after scene edits that affect stripboard
- `syncStripboardScenesToDatabase(...)` [PROD-MUTATE] — called after scene reorder
- `tagWord(...)`, `untagWordInstance(...)` [PROD-MUTATE] — script tagging

---

## WritingScript (`src/components/modules/WritingScript/WritingScript.jsx`)

**Props IN (from App.js):**
```js
selectedProject    // [PROD-READ] — project identity for localStorage key generation
user               // [PROD-READ] — passed to SceneList → usePresence
userRole           // [UI-ONLY] — derives isViewOnly, read-only guards
previewMode        // [UI-ONLY] — activates editor render path ("editor")
previewShell       // [UI-ONLY] — legacy shell path (not used in production routing)
```

**Key state (all WRITING-ONLY):**
- `writingDraftNodes` — flat array of screenplay nodes
- `writingDraftSaveStatus` — `"saved"` | `"saving"` | `"unsaved"`
- `writingScenePageStats` — `{ [nodeId]: { pageNumber, pageLength, timelineStartPage, timelinePageLength } }`
- `showWritingTimeline`, `showBeatsTrack` — timeline visibility toggles
- `showWritingSceneNumbers` — scene number display toggle
- `targetPageCount` — target page count (default 90)
- `showMoodOverlay`, `moodOverlaySettings` — mood overlay toggle and settings
- `beats` — outline/beat items array
- `activeSidePanelTab` — `"scenes"` | `"beats"`
- `collapsedActIds`, `beatTrackZoom` — beat panel display state
- `currentIndex`, `currentSceneNumber` — current scene tracking

**Derived (all WRITING-ONLY):**
- `writingDraftScenes` — scenes from `scenesFromDocumentNodes(writingDraftNodes)` with stats embedded
- `writingWrittenPages`, `writingRemainingPages`, `writingWrittenPercent`
- `displaySceneNumber`

**Callbacks defined and used internally:**
- `handleWritingDraftNodesChange(nextNodes)` [WRITING-ONLY] — debounced save to localStorage
- `handleStartNewScript()` [WRITING-ONLY] — clears draft, creates empty Scene Heading node
- `handleWritingSceneListReorder(draggedKey, targetKey, position)` [WRITING-ONLY] — reorders scene blocks in draft node array
- `handleTimelineSceneMove(sceneIndex, nextStartPage)` [WRITING-ONLY] — sets `targetPage` metadata on heading node, updates node array

**Props passed to child components:**
See individual sections below.

**Callbacks NOT present (confirmed):**
- `saveScenesDatabase` — absent
- `setScenes` — absent
- `setStripboardScenes` — absent
- `syncStripboardScenesToDatabase` — absent
- `tagWord`, `untagWordInstance` — absent

---

## WritingScriptEditor / ScriptWritingEditor

**File:** `src/components/modules/WritingScript/WritingScriptEditor.jsx`
**Re-export shim:** `src/components/modules/Script/ScriptWritingEditor.jsx` → forwards to WritingScriptEditor

**Props IN:**
```js
initialNodes = []               // [WRITING-ONLY] — initial node array
onNodesChange = null            // [WRITING-ONLY] — called when nodes change (fires on input)
activeElementType = ""          // [UI-ONLY] — element type selector binding
onActiveElementTypeChange = null // [UI-ONLY] — notifies parent of active node type
onActiveElementTypeSelect = null // [UI-ONLY] — explicit type change from parent
sceneRefs = null                // [UI-ONLY] — DOM refs for scene heading elements
onSceneStatsChange = null       // [WRITING-ONLY] — emits { [nodeId]: stats } map
onPageCountChange = null        // [UI-ONLY] — emits page count number
showSceneNumbers = true         // [UI-ONLY]
showFloatingElementSelector = true  // [UI-ONLY]
```

**Stats emission:**
- `onSceneStatsChange` is called in a `useEffect` on `[nodes, paginatedPages]` changes
- Also called in `handleInput` (live DOM path) on every input event
- Stats are keyed by BOTH `node.sceneId` (primary) AND `node.id` (secondary, as `headingNodeId`)
- This means `writingScenePageStats` in WritingScript will have keys for both `headingNode.id` and `headingNode.sceneId`

**No production callbacks.** Does not receive or call `setScenes`, `saveScenesDatabase`, `tagWord`, etc.

---

## WritingTimeline (`src/experimental/writingTimeline/WritingTimeline.jsx`)

**Props IN:**
```js
scenes = []           // [WRITING-ONLY] — writingDraftScenes array
beats = []            // [WRITING-ONLY] — beats array
showSceneTrack = true // [UI-ONLY] — whether to render scene track
showBeatsTrack = false // [UI-ONLY] — whether to render beats track area
beatTrackZoom = 1     // [UI-ONLY] — beat track horizontal zoom
currentSceneNumber    // [UI-ONLY] — for current-scene highlight
setCurrentIndex       // [UI-ONLY] — calls parent index setter on scene click
sceneRefs             // [UI-ONLY] — DOM refs for scrollIntoView
targetPages           // [UI-ONLY] — target page count
onSceneMove           // [WRITING-ONLY] — called when scene dragged to new position
onSceneOpen           // [UI-ONLY] — called on scene double-click
onBeatOpen            // [UI-ONLY] — called when beat marker clicked (opens detail modal)
onBeatColorChange     // [WRITING-ONLY] — changes beat marker color in parent state
onBeatTrackZoomChange // [UI-ONLY] — updates beat track zoom
```

**Produces no external data mutations.** All callbacks bubble up to WritingScript which owns the state.

---

## SceneList (inline in WritingScript.jsx, lines ~353–459)

**Props IN from WritingScript:**
```js
scenes={writingDraftScenes}            // [WRITING-ONLY]
currentSceneNumber={displaySceneNumber} // [UI-ONLY]
sceneRefs={sceneRefs}                   // [UI-ONLY]
getSceneStatusColor={() => ({ statusLabel: null })}  // [UI-ONLY] — always returns null
selectedProject={selectedProject}       // [PROD-READ] — passed to usePresence
user={user}                             // [PROD-READ] — passed to usePresence
onSceneNumberChange={null}              // null — scene number editing disabled
setCurrentIndex={setCurrentIndex}       // [UI-ONLY]
showMoodOverlay={showMoodOverlay}       // [UI-ONLY]
canCreateScene={false}                  // [UI-ONLY]
onCreateFirstScene={null}               // null
canDeleteScene={false}                  // [UI-ONLY]
onDeleteScene={null}                    // null
onReorderScene={handleWritingSceneListReorder}  // [WRITING-ONLY]
pageStatsBySceneId={writingScenePageStats}       // [WRITING-ONLY]
```

**Note:** `usePresence` is called with `"script"` channel. This is a shared presence channel — writing users and script-breakdown users would see each other's presence indicators. **Uncertain/risk:** unclear if this is intentional.

---

## BeatsList (inline in WritingScript.jsx, lines ~138–350)

**Props IN from WritingScript:**
```js
beats={beats}                        // [WRITING-ONLY]
onDeleteItem={deleteOutlineItem}      // [WRITING-ONLY]
onReorderItem={reorderOutlineItem}    // [WRITING-ONLY]
onOpenItem={setSelectedBeatDetailId} // [UI-ONLY]
onConvertItem={null}                  // null — Convert to Scene DISABLED
onColorItem={handleBeatMarkerColorChange}  // [WRITING-ONLY]
collapsedActIds={collapsedActIds}     // [UI-ONLY]
onToggleAct={toggleCollapsedAct}      // [UI-ONLY]
```

**No production callbacks. Convert to Scene is explicitly disabled.**

---

## Presence Coupling (Risk Area)

`usePresence(selectedProject?.id, user, "script", currentSceneNumber)` is called in:
- **Script.js** writing mode's SceneList
- **WritingScript.jsx** SceneList (same `"script"` channel)

Both write to the same Supabase presence channel. When both workflows are active simultaneously (theoretically impossible since the app only renders one branch at a time), they would not conflict. But the channel name `"script"` is not Writing-specific — this should eventually be `"writing-script"` for clarity.
