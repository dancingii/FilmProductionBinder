# App Architecture Map

## Entry Point

`src/index.js` → renders `<AuthWrapper><App /></AuthWrapper>`

---

## AuthWrapper (`src/components/auth/AuthWrapper.js`)

**Owns:**
- `user` — Supabase auth user object
- `selectedProject` — the active project (set from ProjectSelector)
- `userRole` — role string: `"owner"`, `"editor"`, `"viewer"`, `"custom"`, etc.
- `modulePermissions` — custom per-module list (only when `userRole === "custom"`)
- `activeWorkflow` — currently active workflow tab (`"writing"` | `"preProduction"` | `"production"` | `"pitching"` | `"postProduction"`). Defaults to `"writing"`.

**Passes down to App via `React.cloneElement`:**
```
{ selectedProject, userRole, modulePermissions, user, activeWorkflow }
```

**Toolbar (rendered by AuthWrapper, not App):**
- Project selector (left)
- WorkflowTabs (center) → `onWorkflowChange={setActiveWorkflow}`
- Display name / sign-out (right)

WorkflowTabs calls `onWorkflowChange(workflow.id)` which sets `activeWorkflow` in AuthWrapper state.

---

## WorkflowTabs (`src/components/workspace/WorkflowTabs.jsx`)

- Renders one button per workflow from `WORKFLOWS` in `workflowConfig.js`
- Enabled workflows: `writing`, `preProduction`, `production`
- Disabled (Coming Soon): `pitching`, `postProduction`
- Clicking an enabled tab calls `onWorkflowChange(workflow.id)` → sets `activeWorkflow` in AuthWrapper

---

## App (`src/App.js`)

**Props received from AuthWrapper:**
- `selectedProject` — active project object
- `userRole` — role string
- `modulePermissions` — custom module list or null
- `user` — Supabase user object
- `activeWorkflow` — `"writing"` | `"preProduction"` | `"production"` (default: `"writing"`)

**Key top-level state owned by App:**
- `scenes` — canonical production scene array (loaded from Supabase)
- `scenesLoaded` — boolean for initial load complete
- `stripboardScenes` — stripboard copy of scenes
- `taggedItems` — all tagged script items
- `characters` — characters data
- `castCrew` — cast and crew
- `scheduledScenes` — schedule data
- `shootingDays` — shooting days
- `callSheetData` — call sheet
- `wardrobeItems`, `garmentInventory` — wardrobe
- `projectSettings` — project-level settings
- `activeModule` — active production module string, default `"Dashboard"`
- `writingActiveModule` — active writing sidebar module, default `"Script"`
- `currentIndex` — current scene index
- `isSavingScenes` — DB save in-progress flag
- `appAlert` — centered modal alert/confirm state

**Routing branch (at the bottom of App render):**

```jsx
const isWritingWorkflow = activeWorkflow === "writing";

<WorkflowWorkspace activeWorkflow={activeWorkflow}>
  {isWritingWorkflow ? (
    // Writing branch
    <>
      <WritingSidebar />  {/* 120px peach sidebar: Script, Moodboard(disabled), Characters(disabled) */}
      <WritingContentArea>
        <WritingScript
          previewMode="editor"
          selectedProject={selectedProject}
          user={user}
          userRole={userRole}
        />
      </WritingContentArea>
    </>
  ) : (
    // Pre-Production / Production branch
    <>
      <ProductionSidebar />  {/* 120px sidebar with Export/Import + module buttons */}
      <ProductionContentArea>
        {renderModule()}  {/* switches on activeModule */}
      </ProductionContentArea>
    </>
  )}
</WorkflowWorkspace>
```

**Writing sidebar buttons:**
- `Script` → sets `writingActiveModule = "Script"` (currently the only active option)
- `Moodboard` — disabled (Coming Soon)
- `Characters` — disabled (Coming Soon)

The sidebar currently only shows `Script` as active but does NOT use `writingActiveModule` to switch the content area — `WritingScript` is always rendered regardless of `writingActiveModule`.

**Production module routing (`renderModule()`):**
Switches on `activeModule`. Key entries:
- `Script Breakdown` → `ScriptBreakdownModule` (which is just `LegacyScriptModule = Script.js`)
- `Stripboard` → `StripboardModule`
- `StripboardSchedule` → `StripboardScheduleModule`
- `Characters` → `CharactersModule`
- `Locations` → `LocationsModule`
- `Props`, `Makeup`, `ProductionDesign`, `Wardrobe` → their respective modules
- `CallSheet`, `Calendar`, `Reports`, `Budget`, etc.

---

## WorkflowWorkspace (`src/components/workspace/WorkflowWorkspace.jsx`)

Thin router. Switches on `activeWorkflow`:
- `"writing"` → `WritingWorkspace` (currently just `<>{children}</>`)
- `"preProduction"` → `PreProductionWorkspace` (currently just `<>{children}</>`)
- `"production"` → `ProductionWorkspace` (currently just `<>{children}</>`)
- disabled workflows → `ComingSoonWorkspace`

All workspace wrappers currently pass children through unchanged. No workspace-specific layout is applied yet.

---

## WritingScript (`src/components/modules/WritingScript/WritingScript.jsx`)

**Where mounted:** App.js inside the `isWritingWorkflow` branch, always rendered when `activeWorkflow === "writing"`.

**Props from App.js:**
```js
previewMode="editor"
selectedProject={selectedProject}
user={user}
userRole={userRole}
```

No production callbacks are passed. Not mounted in the production branch.

**Module is fully self-contained** — all state, persistence, and UI owned internally. See `PROP_FLOW_MAP.md`.

---

## ScriptBreakdown (`src/components/modules/ScriptBreakdown/ScriptBreakdown.jsx`)

**Where mounted:** `renderModule()` in App.js, inside the `!isWritingWorkflow` branch, when `activeModule === "Script Breakdown"`.

**Props from App.js:** Full production callback set — scenes, taggedItems, saveScenesDatabase, setScenes, stripboardScenes, setStripboardScenes, syncStripboardScenesToDatabase, tagWord, untagWordInstance, characters, setCharacters, syncCharactersToDatabase, moodboardImages, onScenesReordered, onAlert, onConfirm, user, userRole, canEdit, isViewOnly, selectedProject, etc.

**Implementation:** Thin wrapper that passes all props to `LegacyScriptModule` (`Script.js`).

---

## Database Load Timing

All Supabase data loads fire in one `useEffect` in App.js that runs when `selectedProject` changes. This runs regardless of `activeWorkflow`. All scene and production data is always loaded even when Writing workflow is active.

---

## Scene Identity

`scenes` (App state) = production scenes loaded from Supabase. Used by `ScriptBreakdown`, `Stripboard`, `StripboardSchedule`, `CallSheet`, `Props`, `Dashboard`, etc.

`writingDraftNodes` (WritingScript state) = writing draft, stored in `localStorage`. Completely separate from production `scenes`.

`writingDraftScenes` (WritingScript derived) = scenes derived from `writingDraftNodes` via `scenesFromDocumentNodes()`. Not connected to production `scenes` in any way.
