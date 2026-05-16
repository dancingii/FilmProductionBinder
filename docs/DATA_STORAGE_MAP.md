# Data Storage Map

---

## Supabase / Database Tables

### `scenes` table

**Used by:** `database.saveScenesDatabase`, `database.loadScenesFromDatabase`

**Called from:** Script.js (via `saveScenesDatabase` prop from App.js), App.js initial load effect

**Schema (per scene row):**
```
id                    UUID (stable scene identity)
project_id            UUID
scene_number          integer
heading               text
content               JSONB array of { type, text } blocks
metadata              JSONB { scriptOrder, replacementLetter, originalSceneNumber, targetPage, ... }
page_number           integer
page_length           integer
timeline_start_page   float nullable
estimated_duration    text
status                text (Not Scheduled, Scheduled, etc.)
manual_time_of_day    text nullable
description           text nullable
tags                  JSONB array (uncertain — may be denormalized or separate table)
characters            JSONB array
props                 JSONB array
```

**Owner:** Script Breakdown / App.js production path
**WritingScript access:** None — WritingScript does not read or write the scenes table

---

### Other Supabase Tables (referenced)
- `stripboard_scenes` — stripboard order and scheduling data
- `shooting_days` — shooting day records
- `scheduled_scenes` — scene-to-shooting-day assignments
- `cast_crew` — cast and crew members
- `cast_crew_availability` — availability records
- `characters` — character records
- `tagged_items` — script tag instances
- `script_locations` — script-derived locations
- `actual_locations` — confirmed shoot locations
- `call_sheet` — call sheet data
- `wardrobe_items`, `garment_inventory` — wardrobe
- `cost_categories`, `cost_vendors`, `budget` — budget
- `todo_items` — to-do list
- `shot_list` — shot list
- `timeline` — timeline events
- `continuity` — continuity elements
- `users` — user display names
- `project_members` — user-project role mappings

**None of these tables are accessed by WritingScript.**

---

## localStorage Keys

All keys follow the pattern `${key}:${projectId}` where `projectId = selectedProject?.id || selectedProject?.name || "default-project"`.

### Writing-Only Keys

| Key | Data Shape | Owner | Reads | Writes |
|---|---|---|---|---|
| `scriptWritingDraft:${projectId}` | `{ nodes: WritingDraftNode[] }` | WritingScript + Script.js writing mode | WritingScript, Script.js | WritingScript, Script.js |
| `scriptBeats:${projectId}` | `OutlineItem[]` | WritingScript + Script.js writing mode | WritingScript, Script.js | WritingScript, Script.js |
| `scriptTimelineVisible:writing:${projectId}` | `"true"` or `"false"` | WritingScript | WritingScript | WritingScript |
| `scriptTargetPageCount:${projectId}` | integer string | WritingScript + Script.js | WritingScript, Script.js | WritingScript, Script.js |
| `scriptSidePanelTab:${projectId}` | `"scenes"` or `"beats"` | WritingScript + Script.js | WritingScript, Script.js | WritingScript, Script.js |
| `scriptCollapsedActs:${projectId}` | `{ [actId]: boolean }` | WritingScript + Script.js | WritingScript, Script.js | WritingScript, Script.js |
| `scriptTimelinePositions:${projectId}` | `{ scenes: [...] }` | Script.js writing mode ONLY | Script.js | Script.js |

**Note:** `scriptWritingDraft` and `scriptBeats` are intentionally shared between WritingScript and Script.js writing mode. This is correct — same user, same project, same draft.

### Mood Overlay Keys — SHARED RISK

| Key | Data Shape | Risk |
|---|---|---|
| `scriptMoodOverlayEnabled` (UNSCOPED) | `"true"` or `"false"` | **Read by WritingScript and Script.js on init. Not project-scoped. Global across all projects.** |
| `scriptMoodOverlaySettings` (UNSCOPED) | `{ opacity, columnWidth, columns, refreshSeconds }` | **Same — unscoped, global.** |
| `scriptMoodOverlayEnabled:${projectId}` (SCOPED) | `"true"` or `"false"` | Written by Script.js after initial load. |
| `scriptMoodOverlaySettings:${projectId}` (SCOPED) | `{ opacity, columnWidth, columns, refreshSeconds }` | Written by Script.js after initial load. |

**Problem:** WritingScript reads from the unscoped keys on `useState` initialization, then does NOT persist changes back. This means:
1. Changes to mood overlay in WritingScript are lost on reload
2. The initial state reads a global value that may have been set by any project's Script Breakdown

**Fix needed:** WritingScript should use project-scoped keys and persist on change (matching Script.js behavior).

### Script.js Writing Mode — Timeline Key (Unscoped Init)

Script.js initializes `showWritingTimeline` from the UNSCOPED key `"scriptTimelineVisible:writing"` (line 2949), but saves to the SCOPED key `scriptTimelineVisible:${mode}:${projectId}`. This means the first load may read a stale global value if the user has never opened the project-scoped path before.

---

## Writing Draft Data Shape

`scriptWritingDraft:${projectId}` stores:
```json
{
  "nodes": [
    {
      "id": "scene-heading-abc123-xyz",
      "type": "Scene Heading",
      "text": "INT. COFFEE SHOP - DAY",
      "sceneId": "a1b2c3d4-...(UUID)"
    },
    {
      "id": "node-1234567890-abc",
      "type": "Action",
      "text": "A barista steams milk.",
      "sceneId": "a1b2c3d4-...(UUID)"
    }
  ]
}
```

**Node types:** `"Scene Heading"`, `"Action"`, `"Character"`, `"Dialogue"`, `"Parenthetical"`, `"Transition"`, `"Shot"`

**Key invariants:**
- Each node has a stable `id` (not a UUID — generated by `makeNodeId` which uses timestamp + random)
- Scene Heading nodes should have a valid UUID in `sceneId` (generated by `createSceneId()`)
- Body nodes inherit their section's `sceneId` from the preceding Scene Heading
- If `sceneId` is a temp-node string (not UUID), `scenesFromDocumentNodes` generates a new UUID on every call — this was the Phase 4W bug, now handled by multi-key stats lookup

---

## Beat Data Shape

`scriptBeats:${projectId}` stores:
```json
[
  {
    "id": "beat-0-abc123",
    "type": "beat",
    "title": "Hero crosses threshold",
    "description": "Optional longer description",
    "order": 0,
    "markerColor": "default",
    "originalBeatNumber": 5,
    "verified": false,
    "status": null,
    "convertedSceneId": null
  },
  {
    "id": "act-1-def456",
    "type": "act",
    "title": "ACT 1",
    "order": -0.5
  }
]
```

**Beat types:** `"beat"` (narrative beat), `"act"` (act group header)

**Marker colors:** `"default"`, `"red"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, `"purple"`

---

## Session Storage

`sessionStorage` is used only for scroll position preservation:
- `stripboard-schedule-scroll-position`
- `stripboard-schedule-has-auto-scrolled`
- `stripboard-scroll-position`

Cleared on app load (App.js `useEffect` with empty dep array). WritingScript does not use sessionStorage.

---

## Summary: WritingScript Storage Footprint

WritingScript reads/writes exactly these keys:

| Key | Direction | Scoped? |
|---|---|---|
| `scriptWritingDraft:${projectId}` | Read+Write | Yes |
| `scriptBeats:${projectId}` | Read+Write | Yes |
| `scriptTimelineVisible:writing:${projectId}` | Read+Write | Yes |
| `scriptTargetPageCount:${projectId}` | Read+Write | Yes |
| `scriptSidePanelTab:${projectId}` | Read+Write | Yes |
| `scriptCollapsedActs:${projectId}` | Read+Write | Yes |
| `scriptMoodOverlayEnabled` | Read ONLY (init) | **No — Bug** |
| `scriptMoodOverlaySettings` | Read ONLY (init) | **No — Bug** |

WritingScript does NOT read or write to Supabase.
