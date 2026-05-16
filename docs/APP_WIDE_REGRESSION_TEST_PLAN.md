# App-Wide Regression Test Plan

Format: numbered test cases grouped by feature area. Test IDs prefixed by area.

---

## 1. Project Load and Initialization

**1.1** — Log in with a valid user. Verify project selector appears. Verify owned projects and shared projects (with correct role badges) are listed.

**1.2** — Select a project. Verify the app loads all 20 data domains (scenes, cast/crew, characters, tagged items, script locations, actual locations, call sheet, wardrobe, garment inventory, cost categories, cost vendors, budget, todo items, shot list, shooting days, scheduled scenes, continuity, dood data, project settings). Open browser console and confirm all "Loaded X from database" log lines appear without errors.

**1.3** — Select a project with 0 scenes (new project). Verify app renders without crash. Verify Writing mode shows "No scenes yet" placeholder.

**1.4** — Verify that loading a project sets `userRole` correctly. Open as "viewer" and verify all edit buttons are absent.

**1.5** — Click "Projects" button. Verify return to project selector. Verify all state is cleared (no stale module data visible from previous project).

**1.6** — Reload page while a project is loaded. Verify Supabase auth session resumes, project selector re-appears (project is NOT auto-reloaded — expected behavior).

---

## 2. Workflow Tab Switching

**2.1** — Switch from Writing to Pre-Production. Verify Writing sidebar disappears, Production sidebar appears. Verify previously active production module is still active.

**2.2** — Switch from Pre-Production to Production. Verify module sidebar identical to Pre-Production (expected — no divergence yet).

**2.3** — Switch from Production to Writing. Verify WritingScript renders. Verify any production state (scenes list, tagged items) is NOT visible in the writing editor.

**2.4** — Rapidly switch between workflows 5 times. Verify no React error boundaries triggered, no console errors.

**2.5** — Switch to a disabled workflow tab (Pitching, Post-Production). Verify "Coming Soon" workspace renders, not a crash.

---

## 3. Top Toolbar Stability

**3.1** — Verify top toolbar (project name, workflow tabs, Team button, Sign Out, user display name) persists across all workflow switches.

**3.2** — Edit display name (click underlined name). Verify save works. Reload. Verify new name persists.

**3.3** — Click "Team" button (owner/producer only). Verify team management modal opens. Verify modal closes on backdrop click.

**3.4** — Verify Team button is NOT visible to "crew" or "viewer" role users.

---

## 4. Module Sidebar Navigation

**4.1** — Click each module in the production sidebar. Verify correct module renders. Verify active module button is highlighted.

**4.2** — Verify "viewer" role sidebar: Budget and Cost Report hidden (per ROLE_MODULES). Verify "crew" role sidebar: Budget, Cost Report, Reports hidden.

**4.3** — Verify "custom" role sidebar shows only permitted modules from `modulePermissions`.

**4.4** — Click Dashboard. Verify dashboard renders with project stats. Verify "Go to Script Breakdown" / navigation shortcuts work (setActiveModule callbacks).

**4.5** — Verify Export/Import buttons in sidebar appear only for editor/owner roles.

---

## 5. Writing Script Module

**5.1** — Open Writing mode with a project that has no writing draft. Verify empty state with "New Script" button. Click "New Script". Verify a blank scene heading appears in the editor.

**5.2** — Type a scene heading ("INT. LIVING ROOM - DAY"). Press Enter. Verify Action element type follows. Type action text. Verify scene appears in left scene list panel.

**5.3** — Reload page. Switch to Writing. Verify draft was saved and reloaded from localStorage.

**5.4** — Switch to Pre-Production tab, then back to Writing tab. Verify draft is intact.

**5.5** — Open Beat Sheet panel (tab). Paste a beat sheet (numbered list). Verify beats parse correctly into beat cards. Verify beats persist on reload.

**5.6** — Toggle writing timeline. Verify timeline appears at bottom of editor. Drag a scene left/right. Verify scene order changes in the scene list.

**5.7** — Open Settings (target page count, etc.). Change target page count. Verify progress bar updates. Verify setting persists on reload.

**5.8** — Verify mood overlay toggle shows/hides overlay. Verify overlay settings (opacity, columns) save and reload.

**5.9** — Verify presence indicator shows other users in writing mode.

**5.10** — Verify WritingScript does NOT trigger any production database saves. Open Network tab. Edit writing draft. Verify no calls to `sync_scenes`, `sync_stripboard_scenes`, or `sync_characters` RPCs.

---

## 6. Script Breakdown Module

**6.1** — FDX import: upload a valid .fdx file. Verify scenes parse correctly (scene headings, action, dialogue). Verify scene count matches expected. Verify scenes appear in scene list.

**6.2** — FDX import: upload a malformed or empty .fdx. Verify error handling — no crash, error message shown.

**6.3** — Tag a word in a scene: click on a word, select a category from the tag menu. Verify word is highlighted. Verify tagged item appears in Props/Makeup/ProductionDesign module. Verify database save triggered.

**6.4** — Untag a word: click tagged word, select Remove Tag. Verify highlight removed. Verify tagged item removed from Props module.

**6.5** — Edit scene mode: click Edit (if available in breakdown mode). Edit scene heading (INT/EXT, location, time of day). Save. Verify heading updates in scene list. Verify database save triggered.

**6.6** — Add new scene (insert after scene N). Verify new scene gets correct sceneNumber (N+1 or with replacement letter). Verify stripboard scenes updated. Verify database saves triggered for scenes and stripboard.

**6.7** — Delete a scene. Confirm dialog. Verify scene removed. Verify stripboard scenes updated. Verify database saves.

**6.8** — Reorder scenes via drag-drop in scene list. Verify new order reflected. Verify database saves triggered. Verify stripboard scenes reordered to match.

**6.9** — Change scene number (rename). Verify all downstream data (characters, tagged items scene refs) updated.

**6.10** — Verify presence indicator shows other users viewing the breakdown.

**6.11** — Verify that tagging actions do NOT affect WritingScript's `writingDraftNodes`.

---

## 7. Stripboard Module

**7.1** — Verify all production scenes appear as strips. Verify status colors (Not Scheduled = default, Scheduled = blue, Shot = green).

**7.2** — Edit scene heading from Stripboard. Verify heading modal opens. Save. Verify heading updates in Stripboard strip. Verify database atomic update triggered.

**7.3** — Toggle column preferences (column checkboxes). Verify columns show/hide. Reload. Verify preferences persist (localStorage).

**7.4** — Verify scene grouping by location or status works (if implemented).

**7.5** — Verify viewer role cannot edit headings.

---

## 8. Stripboard Schedule Module

**8.1** — Add a shooting day. Verify day card appears with date and day number.

**8.2** — Assign a scene to a shooting day by drag-drop. Verify scene appears in the day's schedule block. Verify scene status changes to "Scheduled" in Stripboard. Verify database saves triggered (shooting_days, scheduled_scenes, stripboard_scenes).

**8.3** — Remove a scene from a shooting day. Verify scene returns to "Not Scheduled". Verify database updates.

**8.4** — Lock a shooting day. Verify scenes cannot be added/removed from locked day. Verify lock persists on reload.

**8.5** — Mark a day as "Shot". Verify day and scenes reflect shot status. Verify database updates.

**8.6** — Delete a shooting day. Confirm dialog. Verify day removed. Verify scenes previously in that day return to "Not Scheduled".

**8.7** — Verify scroll positions are cleared on page reload (no stale scroll).

**8.8** — Verify realtime: have another user add a scene to a day. Verify the first user's view updates within ~1 second.

---

## 9. Call Sheets Module

**9.1** — Verify call sheet loads for the first shooting day by default.

**9.2** — Set general call time. Verify saved and reloads.

**9.3** — Set cast call time for a character. Verify saved.

**9.4** — Add crew to a day. Verify crew member appears in call sheet. Verify saved.

**9.5** — Add notes for a day. Verify saved.

**9.6** — Switch between shooting days. Verify each day's data loads correctly (crew, call times, notes are day-specific).

**9.7** — Navigate from Dashboard "upcoming shoot" link. Verify correct day opens in Call Sheet (via `callSheetInitialDay` / `window.__setCallSheetInitialDay`).

---

## 10. Characters Module

**10.1** — Verify characters list shows all auto-detected characters from scenes.

**10.2** — Add a character manually. Verify character appears. Verify saved to database.

**10.3** — Delete a character. Verify character removed. Verify scene associations cleared. Verify database updated.

**10.4** — Add/remove a scene from a character via overrides. Verify `getFinalCharacterScenes` reflects override.

**10.5** — Link a character to a Cast/Crew person. Verify association saved.

**10.6** — Navigate to Script Breakdown for a character's scene. Verify `setActiveModule("Script Breakdown")` and `setCurrentIndex` work.

---

## 11. Locations Module

**11.1** — Verify script locations are listed (extracted from scene headings).

**11.2** — Edit INT/EXT on a script location. Verify scene heading updates. Verify database atomic update triggered. Verify change reflects in Script Breakdown.

**11.3** — Create an actual location (physical address). Verify saved to database.

**11.4** — Link a script location to an actual location. Verify association saved.

**11.5** — Edit a scene time of day from Locations. Verify atomic update triggered.

---

## 12. Props Module

**12.1** — Verify props list shows all items tagged as "Props" from Script Breakdown.

**12.2** — Edit prop title. Verify updated in taggedItems. Verify database sync triggered.

**12.3** — Remove prop from a scene. Verify scene ref removed from prop entry. Verify database sync.

**12.4** — Add prop manually. Verify appears in Props list and Script Breakdown.

**12.5** — Upload prop image. Verify image appears in prop card.

**12.6** — Delete prop (with confirm). Verify removed from taggedItems and database.

---

## 13. Makeup Module

**13.1** — Verify makeup items list (tagged "Makeup" category).
**13.2** — CRUD operations: same as Props tests 12.1–12.3 adapted for Makeup.

---

## 14. Production Design Module

**14.1** — Verify production design items list (tagged "Production Design" category).
**14.2** — CRUD operations: same as Props tests adapted for Production Design.

---

## 15. Wardrobe Module

**15.1** — Add a wardrobe item for a character. Verify saved.

**15.2** — Upload wardrobe image. Verify image appears.

**15.3** — Add garment to garment inventory. Verify saved.

**15.4** — Delete wardrobe item (with confirm). Verify removed.

**15.5** — Verify wardrobeItems and garmentInventory are separate — deleting a garment does not delete a wardrobe item.

---

## 16. Moodboard Module

**16.1** — Open MoodBoard. Verify existing board loads (or empty board created).

**16.2** — Add an image URL. Verify image appears on canvas.

**16.3** — Add multiple boards. Switch between boards. Verify each board has independent content.

**16.4** — Move/resize canvas items. Verify position persists on reload.

**16.5** — Verify moodboard data is saved to Supabase. Reload. Verify canvas state restored from DB.

**16.6** — Verify moodboard images appear in Script Breakdown's mood overlay (via `onMoodboardDataChange` → `scriptMoodImages`).

---

## 17. Reports Module

**17.1** — Verify Reports renders without crash.

**17.2** — Verify breakdown report shows all tagged items grouped by category across all scenes.

**17.3** — Verify schedule report shows scenes per shooting day.

**17.4** — Verify wardrobe report includes wardrobe items.

**17.5** — Verify Reports is read-only — no edit buttons visible.

---

## 18. Budget Module

**18.1** — Add an ATL line item. Verify total updates.

**18.2** — Add a BTL department line item. Verify department budget tracked.

**18.3** — Save budget. Verify Supabase database save triggered. Verify cost categories in Cost Report updated (BTL departments sync).

**18.4** — Reload. Verify budget data persists.

**18.5** — Verify Budget is hidden for "crew" and "department_head" roles.

---

## 19. Calendar Module

**19.1** — Verify calendar renders shooting days at correct dates.

**19.2** — Verify todo items appear on their due dates.

**19.3** — Verify expanded/collapsed section preference persists (note: currently not project-scoped — same for all projects).

---

## 20. Shot List Module

**20.1** — Verify shot list loads scenes from stripboardScenes.

**20.2** — Add a shot to a scene. Verify saved to database.

**20.3** — Edit shot notes. Verify saved.

**20.4** — Add scene notes. Verify saved separately from shots.

---

## 21. Database Saves (Integration)

**21.1** — Tag a word in Script Breakdown. Open Network tab. Verify a Supabase RPC call to `tagged_items` (or equivalent) completes with 200 status.

**21.2** — Reorder two scenes. Verify `sync_scenes` RPC called. Verify `sync_stripboard_scenes` RPC called. Verify no data loss (all scenes still present after reload).

**21.3** — Add a shooting day. Verify `sync_shooting_days_v3` RPC called.

**21.4** — Verify sync lock behavior: rapidly save scenes 3 times in quick succession. Verify only one save completes per sync lock cycle — no concurrent saves.

**21.5** — Verify realtime subscription prevents reload loops: after saving scenes, confirm no unexpected reload is triggered (check console for "SKIPPING" log lines from sync lock).

---

## 22. localStorage Saves

**22.1** — Edit writing draft. Switch away from Writing tab and back. Verify draft intact.

**22.2** — Reload page (hard refresh). Navigate to Writing. Verify draft reloaded from localStorage.

**22.3** — Clear localStorage manually in DevTools. Reload. Verify app handles empty localStorage gracefully — no crash, defaults applied.

**22.4** — Verify Stripboard column preferences persist on reload (localStorage `stripboard-prefs-${projectId}`).

**22.5** — Verify mood overlay settings persist on reload (note: currently not project-scoped).

---

## 23. Import/Export

**23.1** — Export project. Verify JSON file downloads. Verify file contains all major data domains (scenes, cast, characters, locations, tagged items, shooting days).

**23.2** — Import exported JSON. Verify all data restored. Verify no extra scenes added, no scenes missing.

**23.3** — FDX import of a full screenplay. Verify scene count, heading format, content blocks all parse correctly.

**23.4** — PDF export (if available). Verify PDF generates without crash.

---

## 24. Permissions: Role-Based Access

**24.1** — "viewer" role: verify all save/edit buttons hidden across all modules. Verify no database mutations possible from UI.

**24.2** — "crew" role: verify Budget, Cost Report, Reports are not in sidebar. Verify other modules accessible.

**24.3** — "department_head" role: verify Budget excluded.

**24.4** — "custom" role: verify only permitted modules appear in sidebar.

**24.5** — "owner" role: verify all modules accessible, Team button visible, Export/Import available.

---

## 25. Realtime Presence

**25.1** — Open project in two browser windows with two different users. Verify presence indicator shows the other user in modules that support it (Script Breakdown, CastCrew, ShotList, ToDoList, WritingScript).

**25.2** — Navigate one user to a different module. Verify the other user's presence indicator updates or disappears from the previous module.

**25.3** — One user edits a cast/crew entry. Verify the other user sees the update within ~1 second (realtime subscription).

**25.4** — Verify presence channel does not show "script" users when one user is in WritingScript and the other is in Script Breakdown (known bug — both currently use "script" module name, so this test is expected to FAIL until fixed).

---

## 26. Data Isolation: Writing Must Not Affect Production Scenes

**26.1** — Write content in WritingScript (create scenes, add action). Open Script Breakdown. Verify production `scenes` array is unchanged (WritingScript draft did not write to `scenes`).

**26.2** — Verify no network calls to `sync_scenes` occur while editing in WritingScript.

**26.3** — Reload. Verify writing draft and production scenes are both independently intact.

**26.4** — Import an FDX file in Script Breakdown. Verify writing draft in WritingScript is unaffected (both are independent, but test that the draft localStorage key was not overwritten).

**26.5** — Edit beats in WritingScript. Open Script Breakdown. Verify beats from WritingScript do not appear in Script Breakdown's beat panel (if Script.js writing mode is separate). Note: this test may expose the shared localStorage key bug (R-03).

---

## 27. Phase 4M / WritingScript Persistence Focus

**27.1** — In Writing workflow, click New Script. Type a scene heading and one Action/body line. Wait for save status to show Saved. Reload. Verify both heading and body/action text persist. Current manual result: heading appears to persist, body/action text may fail.

**27.2** — Inspect localStorage `scriptWritingDraft:${projectId}` after typing heading and action text. Verify the saved `nodes` array includes the Action/body node with typed text.

**27.3** — While typing in WritingScript, monitor network/Supabase calls. Verify no `sync_scenes`, `sync_stripboard_scenes`, tag mutation, character mutation, schedule mutation, or revision calls occur.

**27.4** — Switch from Writing to Pre-Production Script Breakdown after editing. Verify production scenes are unchanged unless explicit handoff exists.

**27.5** — Switch back to Writing. Verify draft content remains intact and no legacy Script Breakdown writing branch overwrote localStorage.

---

## 28. Mobile Regression Pass

**28.1** — Open the mobile app path if available. Verify login/project selection works.

**28.2** — Verify mobile Dashboard loads shooting days, scheduled scenes, call sheet data, and project state without desktop-only assumptions.

**28.3** — Verify mobile Call Sheet renders the same selected shooting day and scene/cast data as desktop CallSheet.

**28.4** — Verify mobile Props opens the same prop records and scene references as desktop Props.

**28.5** — Verify mobile Wardrobe opens character/garment data without corrupting desktop wardrobe state.

**28.6** — After any scene identity or schedule data change, repeat mobile Call Sheet and Props tests before commit.

---

## 29. Storage Collision Tests

**29.1** — With a project open, inspect keys for `scriptWritingDraft:${projectId}`, `scriptBeats:${projectId}`, `scriptSidePanelTab:${projectId}`, `scriptCollapsedActs:${projectId}`, `scriptTimelineVisible:writing:${projectId}`, and `scriptTargetPageCount:${projectId}`.

**29.2** — Edit WritingScript draft and note localStorage timestamp/payload.

**29.3** — Open Script Breakdown and switch any legacy script workflow controls if available. Verify it does not overwrite the WritingScript draft payload.

**29.4** — Confirm mood overlay preferences are currently shared across projects; mark expected until a storage migration is done.

---

## 30. Minimum Checklist Before Next Commit

1. Build only when implementation changes are made. For documentation-only changes, do not run build unless requested.
2. Writing: New Script, heading text, body/action text, save status, reload persistence.
3. Production Script Breakdown: open existing script, edit/save production page, verify scenes persist.
4. Stripboard: scene status, schedule date, page/scene labels.
5. StripboardSchedule: schedule/unschedule scene, reload, verify `shootingDays`, `scheduledScenes`, and `stripboardScenes` stay aligned.
6. CallSheet: selected shoot day, cast calls, crew calls, PDF export smoke test.
7. Characters/Props/Makeup/Production Design: scene links still resolve.
8. Realtime: second window reload/update test for scenes and schedule.
9. Mobile: smoke test any data domain touched by the commit.
