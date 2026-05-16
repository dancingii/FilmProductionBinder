# Regression Test Checklist

Run this checklist before every commit that touches any of these files:
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `src/components/modules/Script/Script.js`
- `src/experimental/writingTimeline/WritingTimeline.jsx`
- `src/App.js`
- `src/components/modules/WritingScript/writingDraftModel.js`
- Any scene list component
- Any beats component

---

## A. Writing Workflow — Editor

- [ ] **A1.** Switch to Writing tab. Editor renders without errors.
- [ ] **A2.** If no draft exists, editor shows empty state or New Script button.
- [ ] **A3.** Click New Script. A blank Scene Heading node is created (no Action block, no extra nodes).
- [ ] **A4.** Caret starts inside the Scene Heading. Typing inserts text into the heading.
- [ ] **A5.** Press Enter from Scene Heading → creates an Action block. Caret is in Action block.
- [ ] **A6.** Type body text in the Action block. Text appears.
- [ ] **A7.** Reload the page. Both the Scene Heading text AND the Action block text are present after reload. (**Regression guard: body text must persist.**)
- [ ] **A8.** Element type selector in toolbar shows the current node type.
- [ ] **A9.** Changing the element type in toolbar changes the current block type in the editor.
- [ ] **A10.** Save status indicator shows "Saved" within 2 seconds of stopping typing.

---

## B. Writing Workflow — Scene List

- [ ] **B1.** Scene list shows one row per Scene Heading node.
- [ ] **B2.** Scene list row shows scene number and heading text.
- [ ] **B3.** Page number (Pg N) appears next to each scene in the scene list. (**Regression guard: all scenes must show their own page number, not all the same number.**)
- [ ] **B4.** Page fraction appears (e.g., `1/8`, `3/8`, `1 2/8`). (**Regression guard: short scenes show 1/8, long scenes show more.**)
- [ ] **B5.** Add a second Scene Heading (Tab in Action block → type scene heading text, or press Enter after heading). Both scenes appear in the scene list.
- [ ] **B6.** Scenes 1 and 2 show DIFFERENT page stats. (**Regression guard: multi-scene independence.**)
- [ ] **B7.** Type a long action block (20+ lines). Scene 1 page fraction updates to 3/8 or more.
- [ ] **B8.** Clicking a scene row in the scene list scrolls the editor to that scene's heading.
- [ ] **B9.** Drag a scene row to reorder it in the scene list. Scene order in editor updates.

---

## C. Writing Workflow — Timeline

- [ ] **C1.** Settings button opens settings modal.
- [ ] **C2.** Settings modal shows "Scene Timeline" and "Beats Timeline" checkboxes, both unchecked by default.
- [ ] **C3.** Check "Scene Timeline" only → timeline area appears showing scene track. Beats track is NOT visible.
- [ ] **C4.** Uncheck "Scene Timeline" → timeline area disappears (assuming Beats Timeline also unchecked).
- [ ] **C5.** Check "Beats Timeline" only → timeline area appears showing beats track. Scene track is NOT visible. (**Regression guard: Beats Timeline must not show scenes.**)
- [ ] **C6.** With Beats Timeline checked and no beats → beats track area is visible but empty (no scene blocks appear). (**Regression guard: empty beats state shows blank beats track, not scenes.**)
- [ ] **C7.** Check both Scene Timeline and Beats Timeline → both tracks appear.
- [ ] **C8.** Uncheck both → timeline area disappears.
- [ ] **C9.** Scene Timeline visibility persists across reload.
- [ ] **C10.** Beats Timeline visibility persists across reload. (Uncertain: WritingScript persists `showWritingTimeline` but not `showBeatsTrack` — verify.)

---

## D. Writing Workflow — Beats

- [ ] **D1.** Beats tab in right panel is clickable. Beats panel appears.
- [ ] **D2.** Add Beat button creates a new beat. Beat appears in beats list.
- [ ] **D3.** Add Act button creates a new act group. Act appears in beats list.
- [ ] **D4.** Beat title is editable in the beat detail modal (click/open beat).
- [ ] **D5.** Beat description is editable in beat detail modal.
- [ ] **D6.** Beat detail modal closes on Escape and on × button.
- [ ] **D7.** Beats persist across reload (`scriptBeats:${projectId}`).
- [ ] **D8.** Import Beats button opens import dialog.
- [ ] **D9.** Paste beat sheet text → Parse → beats appear in preview. Confirm → beats populate.
- [ ] **D10.** Beat color change (right-click → color menu) changes beat color in list and timeline.
- [ ] **D11.** "Convert to Scene" button is ABSENT or DISABLED for every beat. (**Hard requirement — must never call production callbacks.**)
- [ ] **D12.** Beat drag reorder works within the beats list.

---

## E. Writing Workflow — Settings

- [ ] **E1.** Target page count dialog opens from "Target" button in toolbar.
- [ ] **E2.** Changing target page count updates written/remaining/percent display in toolbar.
- [ ] **E3.** Target page count persists across reload.
- [ ] **E4.** Settings modal "Show Scene Numbers" toggle shows/hides scene numbers in editor.
- [ ] **E5.** Mood overlay toggle (in settings modal) shows/hides mood overlay visual.
- [ ] **E6.** Written/remaining/percent display in toolbar updates when typing (more text = higher written count).

---

## F. Production — Script Breakdown

Run these after any WritingScript or App.js change to confirm no regression.

- [ ] **F1.** Switch to Pre-Production or Production tab. Module sidebar appears with production modules.
- [ ] **F2.** Click "Script Breakdown". Script Breakdown module loads without errors.
- [ ] **F3.** Production scene list is present and shows expected scenes.
- [ ] **F4.** Scene timeline (production) shows correct scene positions.
- [ ] **F5.** Edit Mode button is present and functional.
- [ ] **F6.** Entering Edit Mode and typing in a scene block works. Save commits to database.
- [ ] **F7.** Script tagging (right-click → tag word) works. Tagged word highlight appears.
- [ ] **F8.** Adding a scene (+ Add Scene) creates a new scene in the production list and saves to database.
- [ ] **F9.** Beats in Script Breakdown are present (uses same `scriptBeats:${projectId}` key as WritingScript).
- [ ] **F10.** Convert Beat to Scene in Script Breakdown creates a production scene (enabled in Script.js, disabled only in WritingScript).
- [ ] **F11.** FDX import (if applicable) loads scenes into production and saves to database.

---

## G. Production — Stripboard / Schedule

- [ ] **G1.** Switch to Stripboard module. Stripboard loads with production scenes.
- [ ] **G2.** Stripboard scenes match production scenes (same scene numbers/headings).
- [ ] **G3.** Scene reorder in Script Breakdown updates Stripboard order.
- [ ] **G4.** StripboardSchedule module loads without errors.

---

## H. Routing / Layout

- [ ] **H1.** Workflow tabs (Writing, Pre-Production, Production) are centered in the toolbar.
- [ ] **H2.** Tab switching does NOT cause toolbar to jump or resize.
- [ ] **H3.** Writing sidebar (120px, peach `#FFE5B4`) is present on the left when Writing tab is active.
- [ ] **H4.** Production sidebar (120px, peach) is present when Pre-Production/Production tab is active.
- [ ] **H5.** Writing content area starts at `left: 120px` (no overlap with sidebar).
- [ ] **H6.** Editor is `8.5in` wide and does not stretch to fill available space.
- [ ] **H7.** Right panel (scene/beat list) is `492px` wide and does not expand beyond expected width.
- [ ] **H8.** No horizontal scroll bar appears in the browser viewport (unless timeline or editor is zoomed).
- [ ] **H9.** Switching from Writing to Pre-Production and back retains Writing draft content.
- [ ] **H10.** Switching modules within Pre-Production/Production does not affect Writing draft.

---

## I. Data Isolation Checks (spot-check per commit)

- [ ] **I1.** `grep -n "saveScenesDatabase" src/components/modules/WritingScript/WritingScript.jsx` returns only comments.
- [ ] **I2.** `grep -n "setScenes\b" src/components/modules/WritingScript/WritingScript.jsx` returns nothing.
- [ ] **I3.** `grep -n "setStripboardScenes\|syncStripboard" src/components/modules/WritingScript/WritingScript.jsx` returns nothing.
- [ ] **I4.** `grep -n "supabase\." src/components/modules/WritingScript/WritingScript.jsx` returns nothing.
- [ ] **I5.** App.js `<WritingScript ...>` JSX does not pass `scenes`, `setScenes`, `saveScenesDatabase`, `stripboardScenes`, `setStripboardScenes`, `tagWord`, or `untagWordInstance`.
- [ ] **I6.** `npm run build` completes with `Compiled successfully` and no errors.

---

## J. Known Future Issues (Document — Do Not Test Yet)

- [ ] **J1.** Beat drag-to-position on timeline (not yet implemented — beats appear but cannot be dragged to specific timeline positions).
- [ ] **J2.** Beat hover tooltip on timeline (not yet implemented — beat markers are clickable but show no tooltip on hover).
- [ ] **J3.** Mood overlay key is unscoped — WritingScript reads `scriptMoodOverlayEnabled` (global) not `scriptMoodOverlayEnabled:${projectId}`. Changing overlay in WritingScript does not persist.
- [ ] **J4.** `showBeatsTrack` visibility does not persist across reload in WritingScript (unlike `showWritingTimeline` which does persist). Track whether this is intentional.
- [ ] **J5.** Presence channel is `"script"` in both WritingScript and Script.js — shared presence. Should be `"writing-script"` for the writing module.
- [ ] **J6.** `scriptTimelinePositions:${projectId}` is written only by Script.js writing mode, not by WritingScript. Timeline scene positions from WritingScript's drag operations are set via node `metadata.targetPage` but not via the positions key.
