# Project Handoff

## Current Objective

Stabilize the writing workflow, scene ordering, narrative outline, and timeline visibility without broad architecture rewrites.

## Current Known State

## Codex Handoff — Emergency Writing Scripts Empty Display Guard

**Completed 2026-06-01:** Emergency response after scripts appeared empty following the Writing Characters suggestion sprint.

Files changed:
- `src/components/modules/WritingCharacters/WritingCharactersPanel.jsx`
- `src/components/modules/WritingCharacters/WritingCharactersModulePanel.jsx`
- `src/components/modules/WritingCharacters/writingCharactersModel.js`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Reverted the Writing Characters suggestion helper/import/explicit Rescan changes from the prior sprint.
- Removed the added standalone Writing Characters Rescan button/status behavior from the prior sprint.
- Restored the prior local suggestion computation paths in the Writing Characters panels.
- Added a narrow guard in the active Writing Script save wrapper: if an empty node array is about to save and the app knows about non-empty script data from the last saved payload, session cache, or ProjectCache, the save is blocked and development logs “Blocked empty Writing Script save to prevent overwrite.”
- No project was opened for testing, no recovery attach was run, no localStorage/IndexedDB clearing was performed, and no direct Supabase writes were made.
- `WritingScriptEditor.jsx`, Writing Script persistence, storage/recovery files, backup architecture, and Supabase schema were not edited in this emergency pass.

Verification:
- `npm run build` passed.

## Codex Handoff — Writing Characters Suggestion Rescan Guard

**Completed 2026-06-01:** Stopped Writing Characters suggestion review from opening on normal project load/hydration and tightened merged-alias filtering.

Files changed:
- `src/components/modules/WritingCharacters/WritingCharactersPanel.jsx`
- `src/components/modules/WritingCharacters/WritingCharactersModulePanel.jsx`
- `src/components/modules/WritingCharacters/writingCharactersModel.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Writing Characters no longer opens the new-character suggestions modal from mount, project load, profile hydration, or script-data hydration.
- Rescan Script explicitly computes unresolved suggestions and opens the modal only when unresolved suggestions remain.
- If Rescan finds no unresolved suggestions, the panel shows “No new unresolved characters found.” inline.
- Suggestion filtering now uses a shared normalized comparison helper that trims, collapses repeated spaces, uppercases, and treats underscore IDs as spaced names for matching.
- Resolved names include profile IDs, canonical/name fields, aliases, merge history source/original names, resolution mappings, ignored suggestions, and existing `mergedAliases` metadata.
- Merge history is read and preserved; no profile-shape migration or hard delete changes were added.
- No script text, WritingScriptEditor, storage/recovery, backup/save architecture, Supabase schema, or Writing Script persistence changes were made.
- First-import suggestion auto-open is deferred because these panels do not currently receive a reliable explicit import event without touching Writing Script import internals.

Verification:
- `npm run build` passed.

## Codex Handoff — Writing Public Share Watermark Branding

**Completed 2026-05-25:** Extended public script share watermark customization without changing DB schema or RPC SQL.

Files changed:
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/PublicScriptShareViewer.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Share Script Watermark Settings now support project-name default text, optional recipient name text, and URL-based branding image settings.
- Watermark settings are still saved per link in `script_share_links.watermark_settings`.
- Public viewer defaults to the project name when no custom watermark text is set, then falls back to `SHARED SCRIPT`.
- Recipient names are only rendered in the public watermark when explicitly enabled.
- Branding images render as a subtle, non-interactive overlay and do not affect normal authenticated Writing.
- Existing links with older or null `watermarkSettings` continue to load safely.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned; `git status --short build` showed no output.

## Codex Handoff — Writing Page Body Line Offset Calibration

**Completed 2026-05-22:** Added a small pagination-only line offset to fine-tune Writing page fit after the physical margin calculation.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `pageBodyLineOffset` defaults to `1`.
- The LAYOUT TUNING panel now includes `Page body line offset` from `-3` to `3` lines.
- `getEffectivePageBodyHeightLines()` still derives the physical base from page height, top margin, bottom margin, and line height, then adds the offset.
- With current defaults, the physical base is 54 lines and the effective pagination fit is 55 lines.
- The offset affects pagination fit only; visual page margins remain `1in` top and `1in` bottom.
- Scene Heading keep-together rules and block spacing values were not changed.
- No parser/import logic, PDF import, `(CONT'D)` logic, Script.js, Script Breakdown, saved content, contenteditable/caret internals, or unrelated modules were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Physical Page Margin Pagination

**Completed 2026-05-22:** Updated Writing pagination so rendered page body margins and page-break calculations use the same physical page geometry.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Writing top margin defaults remain `1in`.
- Writing bottom margin defaults are now `1in`.
- Pagination now derives effective body lines from `PAGE_LAYOUT.pageHeight`, `pageMarginTopIn`, `pageMarginBottomIn`, and `lineHeightPt`.
- With 11in page height, 1in top/bottom margins, and 12pt line height, the derived usable body height is 54 lines.
- The top and bottom margin sliders now affect page breaks because they feed the same derived line count used by pagination.
- The visual page body still uses the same top/bottom margin tuning values.
- The independent `pageBodyHeightLines` tuning control was removed to avoid contradicting physical margins.
- Scene Heading keep-together behavior remains in place.
- No parser/import logic, PDF import, `(CONT'D)` logic, Script.js, Script Breakdown, saved content, contenteditable/caret internals, or unrelated modules were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Scene Heading Final Pagination Pass + Top Margin Default

**Completed 2026-05-22:** Fixed the Writing top margin fallback and added a final rendered-page Scene Heading correction pass.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `PAGE_LAYOUT.pageMarginTop` now defaults to `1in`.
- `DEFAULT_LAYOUT_TUNING.pageMarginTopIn` remains `1`.
- `pageBodyHeightLines` remains `55`.
- `paginatedPages` is now produced by running `fixTrailingSceneHeadings()` after `paginateNodesForScreen()`.
- The final pass moves a trailing meaningful Scene Heading from a non-final page to the start of the next page, preserving node order and avoiding empty rendered pages.
- Guarded debug output behind `window.__DEBUG_WRITING_PAGINATION` logs finalized page diagnostics, including last meaningful node type/text, whether correction ran, and the next page's first meaningful node type/text.
- No parser/import logic, `(CONT'D)` logic, Script.js, Script Breakdown, saved content, contenteditable/caret internals, spacing values, or unrelated modules were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — PDF Action Page-Boundary Cleanup + Writing Scene Heading Guard

**Completed 2026-05-22:** Fixed the scoped PDF action over-merge case and adjusted Writing page capacity/Scene Heading keep-together behavior.

Files changed:
- `src/utils/screenplayImport.js`
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- PDF artifact cleanup now preserves a paragraph boundary when a standalone page artifact/page number is removed between two action-looking lines and the previous action line is sentence-complete.
- Wrapped action lines still group normally; mid-sentence action continuation across a page break is not forcibly split.
- Inline numeric artifact cleanup and existing page/artifact removal remain in place.
- Writing `pageBodyHeightLines` defaults now use `55` in both `PAGE_LAYOUT` and the temporary layout tuning defaults.
- The Scene Heading hard page-bottom guard now forces a break when fewer than `6` tuned lines remain before placement.
- The deterministic trailing Scene Heading finalization post-pass remains in place.
- No `(CONT'D)` logic, Script.js, Script Breakdown, saved content, contenteditable/caret internals, or layout tuning panel behavior was changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Trailing Scene Heading Pagination Post-Pass

**Completed 2026-05-22:** Added deterministic page finalization logic so Writing pages do not end with a meaningful Scene Heading.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `paginateNodesForScreen` now finalizes pages through a local helper before pushing them.
- Before a page is pushed, the helper finds the last meaningful node on that page.
- If the last meaningful node is a Scene Heading, that heading and any trailing non-meaningful nodes are removed from the current page and carried to the start of the next page.
- If removing the heading leaves the page empty, no empty page is pushed.
- Existing line-estimate guards and tuning behavior remain in place.
- Guarded debug output behind `window.__DEBUG_WRITING_PAGINATION` logs when a trailing Scene Heading is moved.
- No spacing values, tuning panel behavior, parser/import logic, `(CONT'D)` handling, Script Breakdown, saved content, or contenteditable internals were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Scene Heading Hard Keep Guard

**Completed 2026-05-22:** Added a hard remaining-lines guard for Writing Scene Heading pagination.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `paginateNodesForScreen` now calculates `remainingLines = linesPerPage - currentLineCount` before placing each node.
- If the current node is a Scene Heading, the current page already has content, and fewer than 4 lines remain, pagination forces a page break before placing that heading.
- Existing next-meaningful-node keep-together checks remain in place.
- Guarded debug output behind `window.__DEBUG_WRITING_PAGINATION` now includes `remainingLines` and `sceneHeadingHardBreak`.
- No spacing values, tuning UI, parser/import logic, `(CONT'D)` handling, Script Breakdown, saved content, or contenteditable internals were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Keep-Together Pagination Refinement

**Completed 2026-05-22:** Tightened Writing keep-together pagination and set the temporary tuning defaults to the current testing baseline.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Updated temporary `DEFAULT_LAYOUT_TUNING` to the provided current baseline values: top margin `1in`, Scene Heading margins `22pt/13pt`, and `pageBodyHeightLines: 54`.
- Keep-together now finds the next meaningful node instead of failing when an empty/harmless node sits between structural elements.
- Scene Heading keep-with-next now uses the next meaningful content line.
- Character keep-with-dialogue now supports an optional meaningful Parenthetical before the first Dialogue line.
- Parenthetical keep-with-dialogue now checks the next meaningful Dialogue line.
- Added guarded pagination diagnostics behind `window.__DEBUG_WRITING_PAGINATION`.
- No parser/import logic, `(CONT'D)` import behavior, Script Breakdown, saved content, or contenteditable internals were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Pagination Keep-Together Rules

**Completed 2026-05-22:** Added Final Draft-style keep-together checks to Writing pagination.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Added minimum keep-together estimates for Scene Heading, Character, and Parenthetical nodes inside `paginateNodesForScreen`.
- Scene Heading moves to the next page if there is not room for the heading plus the first following content line.
- Character cue moves to the next page if there is not room for the cue, optional following Parenthetical, and at least the first Dialogue line.
- Parenthetical moves to the next page if there is not room for it plus at least one following Dialogue line.
- Estimates use the existing tuned layout values and line estimates.
- Existing visual dialogue continuation cue behavior remains render-only; no fake blocks or script data mutations were added.
- Layout tuning sliders, parser/import logic, `(CONT'D)` import handling, Script Breakdown, and contenteditable internals were not changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Layout Tuning Panel Portal

**Completed 2026-05-22:** Moved the temporary Writing `LAYOUT TUNING` panel into a `document.body` portal so it escapes the editor/sidebar stacking context.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Imported `createPortal` from `react-dom`.
- Extracted the existing tuning panel JSX into a local `layoutTuningPanel` constant and renders it with `createPortal(layoutTuningPanel, document.body)`.
- Preserved the same fixed top/right visual position and high z-index.
- Slider behavior, tuning values, JSON readout, spacing constants, parser/import/save logic, `(CONT'D)` handling, and Script Breakdown were not changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Layout Tuning Panel Stacking

**Completed 2026-05-22:** Raised the temporary Writing `LAYOUT TUNING` panel above the scenes/sidebar UI.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Increased the fixed layout tuning panel z-index from `1400` to `2147483647`.
- Panel location, sliders, tuning values, and live behavior were not changed.
- No parser/import/save logic, `(CONT'D)` handling, Script Breakdown, or spacing constants were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Draft Quota Fallback

**Completed 2026-05-22:** Fixed Writing draft save failures when full imported scripts exceed localStorage quota.

Files changed:
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/components/modules/WritingScript/useWritingDraftState.js`
- `src/components/modules/WritingScript/writingDraftPersistence.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Small Writing drafts still save to the existing `writingScriptDraft:<project-id>` localStorage key.
- If localStorage throws `QuotaExceededError`, the full draft payload is saved to native IndexedDB and localStorage stores only a small marker pointing to that IndexedDB record.
- Writing draft load now checks that marker and restores oversized drafts from IndexedDB.
- The existing `useWritingDraftState` helper now uses the same async safe load/save helpers.
- Repeated save-error console spam is avoided by warning once per oversized payload and suppressing repeated identical save errors.
- In-memory draft state is not cleared when a save fallback is needed.
- No parser/import logic, `(CONT'D)` handling, Script Breakdown, editor rendering, or contenteditable internals were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Temporary Writing Layout Tuning Panel

**Completed 2026-05-22:** Added a temporary live layout tuning panel to the Writing screenplay editor.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Added a floating `LAYOUT TUNING` button/panel inside `WritingScriptEditor.jsx`.
- Panel sliders control page top margin, page bottom margin, Scene Heading margins, Action margins, Character margins, Parenthetical margins, Dialogue margins, Transition margins, line height, and page body line count.
- Defaults match the current hard-coded Writing layout values.
- Slider values update render styles live and are also used by pagination estimates, scene stats, and dialogue overflow splitting.
- Added a copyable JSON readout of the current tuning values for later hard-coding.
- Values are local component state only and are not persisted to project/script data.
- PDF import, `(CONT'D)` handling, parser/classification logic, Script Breakdown, page content data, and contenteditable internals were not changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Page Spacing Tuning

**Completed 2026-05-22:** Tuned only the Writing screenplay page spacing/layout constants.

Files changed:
- `src/components/modules/WritingScript/WritingScriptEditor.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Reduced Scene Heading visual spacing from `24pt` before/after to `12pt` before/after for a cleaner one-line screenplay gap.
- Updated the matching pagination estimator so Scene Heading before/after spacing counts as one line instead of two.
- Adjusted Writing page body line capacity from 54 to 56 lines so visual page breaks better match the rendered 8.5x11 page body and bottom margin.
- Action, Dialogue, Character, Parenthetical content, import parsing, `(CONT'D)` logic, page-break rendering internals, and editor/contenteditable behavior were not changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — PDF Continuation UI Path Normalization

**Completed 2026-05-22:** Added a shared post-import continuation-marker normalization step so the actual App/Writing import path cannot keep `(CONT'D)` as a separate Parenthetical block.

Files changed:
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Confirmed both Script Breakdown and Writing import through `parseScriptFile()` from `src/utils/screenplayImport.js`.
- Added `normalizeCharacterContinuationMarkers()` to walk imported scene blocks after parsing.
- If a Parenthetical block whose text is exactly a continuation marker follows a Character block, it is appended to that Character cue and the separate Parenthetical block is removed.
- Added a parser fallback for continuation marker lines that appear after an extracted blank but still immediately follow a Character block in scene content.
- Normal parentheticals like `(pause)` and `(confused)` remain separate Parenthetical blocks.
- No renderer, contenteditable, page-break, or editor internals were changed.

Verification:
- Harness verified `ROLLAND` + `(CONT'D)` normalizes to `ROLLAND (CONT'D)` before state receives it.
- Harness verified normal parentheticals remain separate.
- Sample PDF check still reports zero separate continuation-marker Parenthetical blocks and zero `88xx..` numeric artifact blocks.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — PDF Dialogue Continuation Cleanup

**Completed 2026-05-22:** Tightened PDF screenplay import cleanup so page artifacts do not break dialogue context.

Files changed:
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Added targeted cleanup for obvious PDF numeric artifacts such as `8833..`, `8822..`, `8844..`, including standalone artifact lines and artifact fragments appended to dialogue/action lines.
- Removed the blank line immediately after a stripped PDF page/artifact marker so dialogue can continue across page breaks instead of being reclassified as Action.
- Existing standalone page number cleanup remains in place.
- `(CONT'D)`/`(CONT’D)` continuation markers still fold into the preceding Character cue, while normal parentheticals remain separate Parenthetical blocks.
- Parser/editor renderers, contenteditable internals, page-break rendering, and saved data shape were not changed.

Verification:
- Parser harness confirmed `MARIE` + `(CONT'D)` imports as `MARIE (CONT'D)` and normal parentheticals stay separate.
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`; long MARIE dialogue across `8833..`/page-break cleanup remains Dialogue, `(pause)` remains Parenthetical, and `88xx..` artifacts no longer appear in parsed blocks.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — PDF Character Continuation Import

**Completed 2026-05-22:** Fixed PDF/plain screenplay import normalization for character continuation markers.

Files changed:
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- A Parenthetical block immediately following a Character block is now folded into the Character text only when it is a continuation marker such as `(CONT'D)`, `(CONT’D)`, or `(CONT'D.)`.
- Imported output now renders cues like `MARIE (CONT'D)` on the character cue line instead of as a separate parenthetical line.
- Regular parentheticals such as `(nervously)` and `(she tries to force a smile)` remain separate Parenthetical blocks below the cue.
- No renderer, editor, page-break, scene parsing, or saved data shape changes were made.

Verification:
- Parser harness confirmed continuation markers attach to Character blocks while normal parentheticals remain separate.
- Checked the sample PDF import path; no separate continuation-marker parenthetical blocks were produced in that sample parse.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Mood Board Shared Route

**Completed 2026-05-22:** Routed the Writing workflow Mood Board nav item through the same shared Mood Board module render path used by the rest of the app.

Files changed:
- `src/App.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Added `renderSharedMoodBoardModule()` in `App.js` and use it for both the production/pre-production `MoodBoard` module case and the Writing workflow Mood Board nav item.
- Removed the duplicated inline Mood Board JSX from the Writing workflow route.
- Writing Mood Board now receives the same canonical `MoodBoard` component, props, user role/editability, selected project, user, and `onMoodboardDataChange` behavior as the normal module.
- Writing Mood Board now receives the same 10px content wrapper padding as the shared module shell.
- No Mood Board module internals, data storage, page/layer/canvas behavior, export behavior, or saved data behavior were changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — PDF Import Paragraph Grouping

**Completed 2026-05-22:** Refined selectable-text PDF screenplay import so wrapped visual lines become proper screenplay blocks.

Files changed:
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- PDF extraction now preserves paragraph gaps from positioned PDF text instead of returning only flat physical lines.
- The plain screenplay parser now accumulates wrapped Action lines into one Action block until a blank line or screenplay boundary.
- Dialogue lines under the same character cue are accumulated into one Dialogue block until a blank line, parenthetical, new cue, scene heading, transition, or other boundary.
- Wrapped/multiline parentheticals are recombined and retained as Parenthetical blocks.
- Standalone page numbers and title-page material before `FADE IN:` or the first scene heading remain ignored.
- FDX import path was not changed.

Verification:
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`; first scene imports as `EXT. ALLEY - NIGHT`, title/contact text is not imported, standalone page numbers are ignored, wrapped first-scene action lines are grouped into paragraph blocks, and wrapped parentheticals remain parentheticals.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Writing Header Toolbar Refinement

**Completed 2026-05-22:** Moved the Writing toolbar controls into the unified `WRITING` module header row.

Files changed:
- `src/components/modules/WritingScript/WritingScript.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Removed the old visible `Writing Editor` text from the toolbar.
- Moved `TARGET` immediately next to the `WRITING` title.
- Moved the `Element` selector, save status, scene/beat zoom controls, written/remaining page counter, import/new script controls, and settings into the same header row.
- Kept the `Element` selector group anchored to the same horizontal position inside the 8.5in editor column while moving it vertically into the header.
- Left the Writing editor/contenteditable internals, page rendering, scene window, import behavior, and Writing isolation behavior unchanged.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Script Import Popups and Writing Shell

**Completed 2026-05-22:** Finished the expanded screenplay import/pass by replacing browser popups in Script Breakdown and Project Selection and unifying the Writing shell.

Files changed:
- `src/App.js`
- `src/components/ProjectSelector.js`
- `src/components/modules/Script/Script.js`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Script Breakdown import continues to accept `.fdx` and selectable-text `.pdf` through the shared screenplay import utility.
- Script Breakdown import success/summarization, import failures, replace-scene messages, and Script module confirmations now use app-style centered modals instead of browser `alert`/`confirm`.
- Project Selection delete confirmation and delete success/failure messages now use the same centered app-style modal pattern instead of browser popups.
- Writing import uses the shared screenplay import helper and routes import failure through the app modal when available.
- Writing in the writing workflow now receives the same `10px` content padding for the Script submodule and has a unified `WRITING` header row above the existing Writing toolbar/editor.

Verification:
- Sample selectable-text PDF extraction was verified in the prior import pass with `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf`, producing recognizable screenplay lines and 99 parsed scenes.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Screenplay PDF Import

**Completed 2026-05-22:** Added selectable-text screenplay PDF import support to production Script Breakdown and Writing import flows.

Files changed:
- `src/App.js`
- `src/components/modules/Script/Script.js`
- `src/components/modules/WritingScript/WritingScript.jsx`
- `src/utils/screenplayImport.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Added a shared screenplay import utility for existing Final Draft XML import plus selectable-text PDF extraction.
- Script Breakdown upload now accepts `.fdx` and `.pdf`; imported production scenes still flow through the existing App script state, page stats, location detection, character detection, database save, and AI summarization prompt.
- Writing now exposes an import button only when no writing script exists; it accepts `.fdx` and `.pdf`, converts imported scenes into writing nodes, and uses the existing writing draft save path.
- Imported-state behavior is driven by existing content state (`scenes.length` in Script Breakdown and `noScript` in Writing), not by a separate duplicated flag.
- PDF support is text extraction only; OCR was not added.

Verification:
- Tested `/Users/joshuachiara/Desktop/I am awake (12-21-22).pdf` through the PDF extraction/parser path; it produced recognizable screenplay lines and 99 parsed scenes.
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Props Header Unification

**Completed 2026-05-22:** Unified the desktop Props module header with the production/pre-production module header pattern.

Files changed:
- `src/App.js`
- `src/components/modules/Props/Props.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The exact active module key is `Props`; it is now included in the App-level `10px` module wrapper padding condition.
- Props root now uses the shared fixed header plus scrollable/flex content structure.
- Header title is `PROPS` with the unified `17px`, `0.08em` letter spacing style.
- Print queue and `+ ADD CUSTOM PROP` remain available and are right-aligned in the header row.
- Existing prop filters, prop list, scene breakdown, prop management popup, image/lightbox behavior, scene associations, print queue behavior, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mood Board Board Title Correction

**Completed 2026-05-22:** Corrected Mood Board header/title separation after moving global toolbar controls.

Files changed:
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `MOOD BOARD` remains the global module title in the unified module header.
- The active board title, such as `Mood Board 1`, was removed from the global header and restored to the board workspace row directly above the canvas.
- Global toolbar controls remain in the `MOOD BOARD` header row with uppercase labels.
- The old separate global toolbar row remains removed; the board title row now keeps the board title visually associated with the canvas.
- Existing add page, add text, duplicate, delete, grid snap, zoom, fit, export PDF, layers, canvas, pages, layer panel, image/card, presentation, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mood Board Header Toolbar

**Completed 2026-05-22:** Moved Mood Board's main canvas toolbar controls into the unified `MOOD BOARD` header row.

Files changed:
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Confirmed the exact active module key is `MoodBoard` and it is already included in the App-level `10px` module wrapper padding condition.
- Moved Add Page, Add Text, Duplicate, Delete, Grid Snap, Zoom, Fit, Export PDF, Layers, active board name, and status text into the main `MOOD BOARD` header row.
- Removed the old separate main toolbar row above the canvas workspace so the workspace shifts up into that space.
- Contextual selected-item controls remain below the header and retain their existing behavior.
- Mood board pages, canvas workspace, layers, zoom, snap, export, add/delete/duplicate behavior, uploads, image/card behavior, presentation mode, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mood Board Header Unification

**Completed 2026-05-22:** Unified the desktop Mood Board module header with the production/pre-production module header pattern.

Files changed:
- `src/App.js`
- `src/components/modules/MoodBoard/MoodBoard.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The exact active module key is `MoodBoard`; it is now included in the App-level `10px` module wrapper padding condition.
- Mood Board root now uses the shared fixed module header above the existing two-pane mood board workspace.
- Header title is `MOOD BOARD` with the unified `17px`, `0.08em` letter spacing style.
- Existing board list, upload/roll controls, canvas toolbar, image/card layout, layer panel, presentation mode, drag/reorder behavior, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Timeline Header Unification

**Completed 2026-05-22:** Unified the desktop Timeline module header with the production/pre-production module header pattern.

Files changed:
- `src/App.js`
- `src/components/modules/Timeline/Timeline.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The exact active module key is `Timeline`; it is now included in the App-level `10px` module wrapper padding condition.
- Timeline root now uses the shared fixed header plus separate controls row and flex content structure.
- Header title is `TIMELINE` with the unified `17px`, `0.08em` letter spacing style.
- Primary Timeline buttons remain right-aligned in the header row with uppercase labels.
- Timeline selector, view mode tabs, and detection status remain in a separate controls row below the header with uppercase visible labels.
- Timeline events, editing, placement, lock behavior, view switching, scrolling, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Shot List PG Columns Refinement

**Completed 2026-05-22:** Added visible `PG #` and `PG CNT` labels to the Shot List scene heading row page columns.

Files changed:
- `src/components/modules/ShotList/ShotList.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Shot List scene heading rows now show fixed right-side `PG #` and `PG CNT` label/value columns immediately before `View Scene`.
- Page number and page count values remain aligned across rows regardless of scene heading length.
- The existing Shot List module header, scene preview behavior, shot controls, editing, filtering, export, and saved data behavior were preserved.
- To Do List was inspected; the exact active module key remains `ToDoList` and it already uses the unified App-level `10px` padding plus unified header structure from the prior pass.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Shot List Row Alignment and To Do List Header

**Completed 2026-05-21:** Refined Shot List scene heading rows and unified the desktop To Do List module header.

Files changed:
- `src/App.js`
- `src/components/modules/ShotList/ShotList.js`
- `src/components/modules/ToDoList.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Shot List scene heading rows now keep page number and page count in fixed right-side columns immediately before `View Scene`.
- Long scene title/location text no longer shifts the page columns or `View Scene` action.
- `ShotList` remains in the App-level `10px` module wrapper padding condition.
- The exact To Do List active module key is `ToDoList`; it is now included in the App-level `10px` module wrapper padding condition.
- To Do List root now uses the shared fixed header plus scrollable content layout.
- Header title is `TO DO LIST` with the unified `17px`, `0.08em` letter spacing style.
- `SHOW/HIDE COMPLETED` and `+ ADD TASK` remain available and are right-aligned in the header row.
- Status, Assigned To, and Category filters remain in a separate control row below the header.
- Visible To Do List header/filter labels were uppercased; task behavior, completion, filtering, editing, deletion, and saved data behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Shot List Header Unification

**Completed 2026-05-21:** Unified the desktop Shot List module header with the production/pre-production module header pattern.

Files changed:
- `src/App.js`
- `src/components/modules/ShotList/ShotList.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The actual active module key is `ShotList`; it is now included in the App-level `10px` module wrapper padding condition.
- Shot List root now uses the shared fixed header plus scrollable content layout.
- Header title is `SHOT LIST` with the unified `17px`, `0.08em` letter spacing style.
- Date filter and `Export PDF` controls remain available and are right-aligned in the header row.
- Shot List scene rows, shot editing, drag/reorder, PDF export, scene preview modal, and saved data behavior were preserved.
- The empty state for no scenes also uses the unified header/content structure.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Call Sheet Wrapper Padding Fix

**Completed 2026-05-21:** Corrected Call Sheet's App-level module padding key.

Files changed:
- `src/App.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The active module name is `CallSheet`, not `Call Sheet`.
- Updated the unified App wrapper padding condition to match `CallSheet`, so Call Sheet now receives the same `10px` wrapper padding as the confirmed reference modules.
- No Call Sheet document/page-preview layout or module functionality was changed in this pass.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Call Sheet Header Unification

**Completed 2026-05-21:** Unified the desktop Call Sheet module header with the production/pre-production module header pattern.

Files changed:
- `src/App.js`
- `src/components/modules/CallSheet/CallSheet.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Call Sheet now receives the same App-level `10px` module padding as the confirmed reference modules.
- Call Sheet root now uses the shared fixed header plus scrollable content layout.
- Header title is `CALL SHEET` with the unified `17px`, `0.08em` letter spacing style.
- Shooting Day selector plus `Export Call Sheet` and `Export Sides` remain available and are right-aligned in the header row.
- The call sheet body remains in a scrollable content area; existing call sheet editing/export behavior was preserved.
- The empty state for no shooting days also uses the unified header/content structure.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Day Out of Days Header Buttons

**Completed 2026-05-21:** Moved Day Out of Days action buttons into the module header row.

Files changed:
- `src/components/modules/DayOutOfDays/DayOutOfDays.jsx`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `DAY OUT OF DAYS` remains left-aligned in the unified module header.
- `+ Add Manual Event` and `Settings` now sit in a right-aligned header button group.
- Matrix Filters remain in their existing content controls area.
- Button handlers, disabled behavior, and settings modal behavior were preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Active Scene Dropdown and Sides Polish

**Completed 2026-05-21:** Polished mobile Script scene heading wrapping, Sides active UI, and active-scene dropdown behavior.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Mobile scene headings now normalize embedded whitespace/newlines before rendering, matching production Script Breakdown's read-only heading behavior that collapses raw line breaks.
- Mobile scene headings render once through a production-style inline heading block instead of the body element `pre-wrap` path, preventing headings like `AIRSPEED / HORSA / - SAME - NIGHT` from being forced onto separate raw lines.
- Removed the separate `Sides view active` banner below the toolbar.
- `Sides` now communicates state only through the toolbar button: white/gray when off, blue filled when on.
- `Sides` still toggles sides view and does not open the `More` / `Script Tools` popup.
- The custom scene dropdown field displays the current selected/active scene.
- The script scroll container updates active scene state from the scene nearest the top of the viewer.
- The opened scene dropdown highlights the active scene row and scrolls that row toward the vertical center when possible.
- Opening the dropdown does not scroll the script viewer; selecting a scene still closes the dropdown and scrolls the viewer to that scene.
- `More` / `Script Tools`, search, page jump, filters, Sides Behavior settings, custom scene dropdown, production-scene data source, `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`, and `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9` remain unchanged.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Tools Filters and Sides

**Completed 2026-05-21:** Built out the mobile Script `More` / `Script Tools` popup with local search, filters, page jump, and sides behavior controls.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `More` opens a mobile-friendly `Script Tools` popup with `Search`, `Page Jump`, `Script Filters`, and a collapsible `Sides Behavior` accordion.
- No scenes grid was added to the `More` popup; the custom scene dropdown remains the fast scene navigation tool.
- Search filters visible production scenes by display label/number, heading, script content, and character cues.
- Character options are derived from production script `Character` blocks.
- Schedule filters use already-loaded mobile `shootingDays` and `scheduledScenes` data when available; no new database reads were added.
- Status filters use existing `scene.status`, falling back to `Not Scheduled`.
- `Sides` remains a separate toolbar toggle and uses local `Sides Behavior` settings instead of opening `Script Tools`.
- `visibleScenes` is derived locally from production scenes plus search/filter/sides state; original scene data is not mutated.
- Page jump uses rendered mobile page break markers, with a closest-known-page fallback.
- When search/filters/sides are active, the custom scene dropdown shows the currently visible scenes so scene jumps target rendered content.
- `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` and `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9` remain unchanged.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Sides Toggle and Text Autosizing

**Completed 2026-05-21:** Corrected mobile Script Sides behavior and addressed the remaining iPhone font-size mismatch caused by mobile text autosizing.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `More` still opens the `Script Tools` popup.
- `Sides` no longer opens `Script Tools`; it toggles local `showSidesOnly` state.
- When active, `Sides` uses a darker active button color and shows a compact `Sides view active` banner.
- Full sides filtering/generation is still not implemented.
- The `Script Tools` popup still contains the `Sides Behavior` placeholder section.
- All mobile screenplay elements already used the same duplicated production `12pt/12pt` base source styles; the visual mismatch was caused by mobile Safari text autosizing enlarging wider blocks like Scene Heading/Action differently than narrower dialogue blocks.
- Added `WebkitTextSizeAdjust: "100%"` and `textSizeAdjust: "100%"` to the shared mobile production base style and scaled script page container.
- `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9` and fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` remain unchanged.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Font and Scroll Spacer

**Completed 2026-05-21:** Fixed the remaining mobile Script heading/body font mismatch and trimmed blank scroll space after the final content.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `SCRIPT_VIEWER_BODY_X_OFFSET_PX` remains locked at `9`.
- Fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` remains unchanged.
- Mobile scene headings no longer render through a custom `h2` style.
- Scene headings now render through `getMobileProductionElementStyle("Scene Heading")`, the same duplicated production-style helper used for body blocks.
- This puts Scene Heading, Action, Character, Dialogue, Parenthetical, Transition, and Shot on the same production base font family/size/line-height/wrapping system.
- The duplicate metadata-style scene heading line remains removed.
- The scroll spacer now subtracts the 0.75in page bottom margin from measured page height and adds only a small 16px buffer, reducing blank scrollable space after the last content.
- Custom scene dropdown, `More`, `Sides`, Script Tools popup shell, production-scene data source, browser pinch prevention, and fixed app shell behavior remain unchanged.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Locked Offset and Tools Shell

**Completed 2026-05-21:** Removed the temporary mobile Script offset slider, locked the tuned body offset, and added the initial Script Tools/Sides shell.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Removed temporary `bodyOffsetPx` state and range slider UI.
- Locked `SCRIPT_VIEWER_BODY_X_OFFSET_PX = 9`.
- Readable body alignment still uses `SCRIPT_VIEWER_BODY_X_OFFSET_PX - (MOBILE_SCRIPT_BODY_LEFT_PX * finalScale)`.
- Fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32` remains unchanged.
- The custom scene dropdown remains in the one-line toolbar.
- Added a compact `Sides` button at the far right of the Script toolbar.
- `More` and `Sides` open a basic `Script Tools` popup; full filtering/sides generation is not implemented.
- The popup includes a `Sides Behavior` section with placeholders for `Day / Shooting Day`, `Character`, `Current Day`, and `Scheduled Scenes`.
- Mobile scene heading rendering now mirrors production Script Breakdown's read-only h2 inline style more closely; body blocks continue using duplicated production `getProductionElementStyle` values.
- The duplicate metadata-style scene heading line remains removed; status badges remain in the custom scene picker, not in the script body.
- Scroll spacer now starts at `0`, uses measured unscaled `pageRef.scrollHeight * finalScale`, and remeasures after render/resize to reduce blank scroll space after final content.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Offset Tuning Slider

**Completed 2026-05-21:** Added a temporary body offset tuning slider and removed mobile-only duplicate scene metadata from the Script body.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `MobileScriptModule` keeps the custom scene dropdown and fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`.
- Added local `bodyOffsetPx` state initialized from `SCRIPT_VIEWER_BODY_X_OFFSET_PX = -15`.
- Added a compact temporary toolbar slider (`-80` to `80`, step `1`) that shows `Offset: <value>` and updates body alignment live.
- The body offset still maps through `bodyOffsetPx - (MOBILE_SCRIPT_BODY_LEFT_PX * finalScale)` so tuning moves the readable script body, not only the page frame.
- Removed the mobile-only metadata line under scene headings (`INT/EXT • LOCATION • TIME`), which caused a duplicate scene heading appearance.
- Removed the mobile-only status badge from the script body; status remains available in the custom scene picker.
- Mobile scene heading/body rendering now follows production Script Breakdown read-only rendering more closely: heading uses the production h2 style, body blocks use the duplicated production element styles.
- The scroll-height spacer now observes both the scroll area and rendered page so stale content height is less likely to leave large blank space after the last page.
- No desktop Script Breakdown, Writing, database, or production save behavior was intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Custom Scene Picker

**Completed 2026-05-21:** Replaced the native mobile Script scene select with a custom compact scene picker and aligned the readable script body rather than the outer page frame.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- The mobile Script toolbar remains one row: Script/scene count, custom scene field, and `More` button.
- Native `<select>` was removed from `MobileScriptModule`.
- Tapping the custom scene field opens a near edge-to-edge popup (`5px` side margins) below the toolbar.
- Popup rows show scene display label, heading, viewer-estimated page number, and compact status badge when scheduled.
- Tapping a row closes the popup and scrolls the isolated script viewer to that production scene.
- `More` remains present; the full More/Filters modal was not implemented.
- Body alignment now uses `SCRIPT_VIEWER_BODY_X_OFFSET_PX = -15`.
- The script page wrapper subtracts the scaled 1.4in body margin before applying that body offset, so the constant affects the readable script body rather than only the outer page frame.
- Fixed `SCRIPT_VIEWER_FIXED_ZOOM = 1.32`, production-style formatting constants, page breaks, browser pinch prevention, and production-scenes-only data source remain unchanged.
- The right-side clipping was caused by cropping the zoomed full page while leaving the scaled left page margin in view; aligning to the readable body crops page margin instead of body text.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Screen-Space Offset

**Completed 2026-05-21:** Made the mobile Script horizontal offset apply in rendered screen pixels and tightened the closed native scene select.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Replaced the transform-combined offset with `SCRIPT_VIEWER_X_OFFSET_SCREEN_PX = -15`.
- The offset is applied to an unscaled outer wrapper with `left: -15px`; the inner script page still only uses `transform: scale(finalScale)`.
- `SCRIPT_VIEWER_FIXED_ZOOM` remains `1.32`; production-style formatting, page breaks, and production scene data source were not intentionally changed.
- The one-line toolbar layout remains intact.
- The closed native scene select was tightened with 5px toolbar side padding, smaller font, smaller height, and compact padding.
- Native iOS opened select picker row density remains browser-controlled; the next modal/grid pass is the correct route for a denser scene picker.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Toolbar Condense

**Completed 2026-05-21:** Condensed the mobile-only Script toolbar to one row and shifted the fixed-zoom script page left for visual tuning.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `SCRIPT_VIEWER_X_OFFSET_PX` is now `-15`.
- `SCRIPT_VIEWER_FIXED_ZOOM` remains `1.32`; the script page still uses fit-to-width scale times the fixed 132% zoom.
- The mobile Script toolbar is now a single compact row with Script title/scene count on the left, native Scenes dropdown in the middle, and a `More` button on the right.
- The previous read-only pill/second toolbar row is removed; no zoom controls are present.
- The native scene dropdown has compact field styling and uses the available center width.
- Browser/page pinch prevention and app-shell fixed viewport behavior remain unchanged.
- Script formatting, page breaks, production scene data source, desktop Script Breakdown, and standalone Writing were not intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Fixed Zoom

**Completed 2026-05-21:** Removed manual zoom from the mobile-only Script reader and fixed its viewer scale to the tested 132% visual zoom.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Mobile Script still lives only in `src/components/mobile/MobileApp.js`.
- The reader still uses production `scenes`; no Writing data, beats, writing localStorage, or writing timeline state is used.
- Browser/page pinch prevention remains in the mobile app shell: viewport locking, Safari gesture prevention, and document-level multi-touch prevention are still active.
- Internal Script viewer zoom was removed: no `userZoom` state, no script-area pinch listeners, and no +/- zoom controls.
- The script page keeps the 8.5in / 816px model and now uses `finalScale = baseFitScale * 1.32`.
- `SCRIPT_VIEWER_X_OFFSET_PX` was added near the mobile script constants for manual side-to-side tuning of the scaled page.
- Script toolbar and main mobile toolbar remain outside the scaled wrapper.
- Script formatting, page break labels, and production-scene data source were not intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Script Formatting

**Completed 2026-05-21:** Updated the mobile-only Script reader to preserve production Script Breakdown screenplay formatting more closely.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `MobileScriptModule` still lives only in `src/components/mobile/MobileApp.js`.
- It still renders production `scenes` loaded from the `scenes` table; no Writing data, beats, writing localStorage, or writing timeline state is used.
- Formatting constants are duplicated from production `Script.js` for this pass: page width, page margins, per-element indents/widths, uppercase behavior, and dialogue/parenthetical spacing.
- Mobile script content now renders inside an 8.5in script page with horizontal scrolling on small screens, preserving relative screenplay formatting instead of using mobile percentage indents.
- The mobile Script top area is now a sticky toolbar with Script label, read-only state, current scene indicator, and Scenes dropdown for navigation.
- Desktop Script Breakdown, standalone Writing tab, and production save/database behavior were not intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Mobile Production Script Reader

**Completed 2026-05-21:** Added the first functional mobile-only Script reader.

Files changed:
- `src/components/mobile/MobileApp.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Mobile app lives in `src/components/mobile/MobileApp.js` and is selected by `src/index.js` for iPhone/iPad/Android or viewport width under 768px.
- The existing mobile module dropdown now enables `Script`.
- `MobileScriptModule` renders production `scenes` loaded via `database.loadScenesFromDatabase(selectedProject, setScenes, ...)`.
- The reader is read-only and does not write to database.
- The reader displays scene labels/headings, location/time metadata when present, production status, and scene content blocks in mobile-readable screenplay formatting.
- A sticky scene dropdown lets users jump/scroll to scenes.
- It does not use `WritingScript.jsx`, writing draft nodes, writing localStorage, beats, or writing timeline state.
- Desktop Script Breakdown and standalone Writing tab were not intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Production Script Breakdown Pagination

**Completed 2026-05-21:** Fixed production Script Breakdown SceneList page metadata to use the production script viewer pagination source of truth.

Files changed:
- `src/components/modules/Script/Script.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `SceneList` no longer falls back to the old independent `calculateScenePageStats()` estimate.
- `ContinuousScript` now computes one viewer pagination pass used for both page break labels and per-scene stats.
- `Script` stores viewer-emitted stats and passes them back into `SceneList`.
- SceneList page number and 1/8 page length now come from the same calculation as the visible production script viewer.
- Production script wrapping/spacing was aligned more closely with Writing editor constants: 0.75in top/bottom page margins, 1.4in left body margin, 1in right margin, per-element screenplay widths, and dialogue/parenthetical spacing.
- Production edit mode, production save/database behavior, standalone Writing tab, and Stripboard Schedule were not intentionally changed.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Stripboard Schedule Lunch Divider and Empty Target Fill

**Completed 2026-05-21:** Refined Stripboard Schedule reorder behavior after the empty-row preservation fix.

Files changed:
- `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- Empty scene blocks are detected as fill targets (`type: "scene"`, no scene/custom/lunch/end-of-day).
- Dropping an available scene or scheduled scene/custom block onto an empty block fills that existing block instead of inserting a new block around it.
- Non-lunch scheduled moves preserve lunch as a divider by reordering the non-lunch sequence and reinserting lunch at its previous divider index.
- Example now intended: `Scene 1, Scene 2, Lunch, Scene 3, Scene 4`; moving Scene 3 before Scene 2 produces `Scene 1, Scene 3, Lunch, Scene 2, Scene 4`.
- Dragging lunch itself still uses the regular insert/reflow path, so lunch remains movable.
- Prior fixes remain: `preserveEmpty` rows, UUID `+` rows, immediate `+` row sync, insert/reflow instead of swap, and shooting-day persistence.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Codex Handoff — Stripboard Schedule Empty Row Preservation

**Completed 2026-05-21:** Fixed the previous Stripboard Schedule reorder/removal cleanup so intentional empty rows are preserved.

Files changed:
- `src/components/modules/StripboardSchedule/StripboardSchedule.js`
- `HANDOFF.md`
- `AI_TASK_LOG.md`

Key behavior:
- `normalizeOrderedBlocks()` no longer filters all empty scene blocks.
- `insertBlockAtTarget()` preserves existing empty rows and inserts the dragged block before/after the target.
- Removing a scheduled scene removes only that scene's block, so the removed row collapses without deleting unrelated empty rows.
- User-created `+` empty rows now use UUID ids, carry `preserveEmpty: true`, and sync immediately via `updateShootingDayScheduleBlocks`.
- Removing empty rows and editing/removing custom items now syncs the changed day blocks immediately.
- Lunch remains draggable; scene/custom/lunch reorders remain insert/reflow rather than swap.
- Shooting-day creation persistence fix from the prior pass was preserved.

Verification:
- `npm run build` passed.
- Generated build artifacts were restored/cleaned.

## Claude Handoff — Workflow Split Through Timeline Fix

### Last Completed Phase

**Writing Timeline Visibility Fix** (2026-05-16): Fixed Scene Timeline and Beats Timeline to operate as fully independent tracks in WritingTimeline.jsx.

Root cause: `showSceneTrack` was not in WritingTimeline's function signature — the prop was silently ignored and the scene track always rendered. `hasVisibleBeatsTrack` was gated on `beats.length > 0`, so Beats Timeline with no beats showed nothing.

Fixes applied to `src/experimental/writingTimeline/WritingTimeline.jsx`:
- Added `showSceneTrack = true` to function signature.
- Decoupled `hasVisibleBeatsTrack = showBeatsTrack` from beat count.
- Fixed early return: `(showSceneTrack && scenes.length > 0) || showBeatsTrack`.
- Gated entire scene track scroll area on `{showSceneTrack && ...}`.
- Gated header labels and Scenes Zoom controls on `showSceneTrack`.
- Gated beat count text on `showBeatsTrack && hasBeats`.

WritingScript.jsx was not modified — already passes correct props.

Behavior matrix verified correct:
- Neither checked → no timeline.
- Scene Timeline only → scene track; no beats track.
- Beats Timeline only (with beats) → beats track; no scene track.
- Beats Timeline only (no beats) → empty beats rail; no scene track; no fallback.
- Both checked → both tracks.

Build: Compiled successfully, no warnings.

### Previous Implementation Phase

Architecture Audit (documentation-only): Full codebase audit and documentation created in `docs/`. Six documents cover app architecture, prop flow, module ownership, Writing/Production boundaries, data storage, and regression tests. No runtime code was changed.

### Prior Implementation Phase

Phase 4Z: Full copy/adaptation of Script.js writing-mode implementation into WritingScript.jsx. All prior WritingScript.jsx internals replaced. WritingScript is now a self-contained writing-only module with full UI parity with Script.js writing mode. Production paths (saveScenesDatabase, setScenes, stripboard sync, tag callbacks) are removed. Beat Convert to Scene is disabled (`onConvertItem={null}`). Beats persist at `scriptBeats:${projectId}`. Draft persists at `scriptWritingDraft:${projectId}`. Build: clean. Script.js was not modified.

### Architecture Goal

- `WritingScript` is draft/story-only and should own writing draft nodes, writing scene identity, writing editor state, writing-only persistence, and later writing scene list/timeline/beats/settings.
- `Script Breakdown` is production/pre-production/app-wide and currently renders legacy `Script.js` through the compatibility wrapper.
- A later explicit handoff layer will convert Writing data into production/pre-production data. Writing must not automatically overwrite production scenes.
- Do not let `WritingScript` receive production callbacks such as `setScenes`, `saveScenesDatabase`, stripboard sync, tag mutation, production character mutation, schedule callbacks, revision callbacks, or production scene persistence callbacks.

### Completed Workflow Migration Phases

- Phase 1: centered workflow tabs in the toolbar.
- Phase 2: workflow workspace routing shell.
- Phase 3: production-facing module label changed to `Script Breakdown` with old `"Script"` compatibility.
- Phase 4A: structural folders and `ScriptBreakdown` compatibility wrapper.
- Phase 4B: writing draft model helpers moved under `WritingScript`.
- Phase 4C: `WritingScriptEditor` moved under `WritingScript` with old-path re-export.
- Phase 4D: `ScreenplayPagePreview` moved under `WritingScript` with old-path re-export.
- Phase 4E: `WritingTimelinePanel` wrapper added.
- Phase 4F: `WritingBeatsPanel` placeholder added.
- Phase 4G: `WritingSceneList` placeholder added.
- Phase 4H: `WritingSettingsModal` placeholder added.
- Phase 4I: non-routed `WritingScript` shell added.
- Phase 4K: WritingScript-owned draft persistence/helper hook added.
- Phase 4L: isolated editor-only preview mode added.
- Phase 4M: Writing workflow now routes to `WritingScript` editor-only mode.
- Phase 4N: Writing toolbar/header added; element selector moved from fixed bottom-right into toolbar.
- Phase 4O: Writing scene list and beats panel restored; three-column writing workspace layout.
- Phase 4P: Writing workflow visual parity with Script Breakdown — Scenes/Beats tabbed right panel, `2px inset #ccc` bordered panels, restyled toolbar, matching row typography and delete buttons.
- Phase 4Q: Writing module sidebar (120px, #FFE5B4, Script/Moodboard(disabled)/Characters(disabled)). WritingBeatsPanel parity — drag/drop, color markers, context menu, act grouping, beat detail modal, Add Beat/Add Act in tab bar.
- Phase 4R: Writing layout geometry corrected — editor fixed to `flex: "0 0 8.5in"`, right panel within `calc(8.5in + 520px)` row, `alignSelf: "flex-start"`, excess padding removed.
- Phase 4S: Writing scene list page fraction display restored (`formatScenePageLength`, eighths notation). New Script now creates only Scene Heading (Action node removed). `createEmptyWritingNode` import removed from WritingScript.
- Phase 4T: WritingSceneList switched to read `timelinePageLength` (decimal fraction) instead of `pageLength` (integer whole pages). Correct field, but stats were still stale.
- Phase 4U: Fixed stale stats root cause — `handleInput` now emits stats from live DOM nodes immediately after `emitNodesChange`. Stats update in real-time as user types.
- Phase 4V: Fixed `transformEmptyNodeToNewSceneHeading` to use `createSceneId()` (UUID) instead of `makeTempNodeId()` for scene heading `sceneId`. Fixed new scenes only; existing localStorage data not migrated.
- Phase 4W: Full writing page stats rewrite. New `writingPageStats.js` with `normalizeWritingDraftNodes` (repairs temp-node sceneIds to UUIDs, persists back to localStorage) and `calculateWritingPageStats` (standalone stats from normalized nodes, same algorithm as editor). WritingScript now computes both scenes and stats from `normalizedDraftNodes` via useMemo — no dependency on editor state. Existing bad drafts auto-repaired on load.
- Phase 4Z: Full copy/adaptation of Script.js writing-mode implementation into WritingScript.jsx. Replaced all prior WritingScript.jsx internals. Copied: all beat helpers, BeatsList (Convert to Scene disabled — `onConvertItem={null}`), SceneList (writing-safe props), all writing state, full toolbar (Target button, element selector, save status, written/remaining/percent, New Script button, Settings button), WritingTimeline, beat import modal, beat detail modal, target page dialog, settings modal, all handlers (handleWritingDraftNodesChange, handleWritingSceneListReorder, handleTimelineSceneMove, handleStartNewScript simplified, all beat handlers), multi-key stats lookup via `stableSceneId` pattern. Removed all production paths: no saveScenesDatabase, no setScenes, no stripboard sync, no tag callbacks. Beats key: `scriptBeats:${projectId}`. Draft key: `scriptWritingDraft:${projectId}`. Build: clean.

### Actual Manual Test Results After Phase 4Z

Build: Compiled successfully, no warnings.

Pending manual verification (test checklist from Phase 4Z):
1. Writing workflow opens without errors.
2. Writing draft persists across reload (`scriptWritingDraft:${projectId}`).
3. Scene list shows scenes derived from draft nodes.
4. Page stats (Pg N, page fraction) display correctly in scene list.
5. Beats persist across reload (`scriptBeats:${projectId}`).
6. Beat import parses and populates beats panel.
7. Beat detail modal opens/closes correctly.
8. Target page dialog opens from Target button.
9. Settings modal opens from Settings button.
10. WritingTimeline shows when enabled in settings.
11. New Script clears draft and creates a blank scene heading.
12. Scene list click scrolls editor to scene.
13. Scene reorder updates editor draft nodes order.
14. Beat Convert to Scene is disabled (button greyed, no crash).
15. Pre-Production and Production routing unchanged (Script Breakdown still works).
- Build clean (Compiled successfully, no warnings).

**Recommended manual test:**
1. Open Writing workflow with an existing project that has a saved draft.
2. Scene list should immediately show correct page fractions (not all 1/8).
3. Type more text in an action block — scene list fractions should update in real-time.
4. Create a second scene (Tab key on Action → creates Scene Heading). Both scenes should show independent fractions.
5. Type a long action block (20+ lines) under scene 1 — scene 1 should show 3/8 or larger.
6. Scroll the scene list and verify clicking a scene scrolls the editor to that scene.

### Next Recommended Phase

**Timeline follow-up (narrow):** Beat drag-to-position on timeline — beats currently render as markers but cannot be dragged to specific positions. Beat hover tooltip — beat markers are clickable but show no tooltip on hover. Both are listed as J1/J2 in `docs/REGRESSION_TEST_CHECKLIST.md`.

**Known bugs to fix in dedicated phases (do not fix incidentally):**
- `showBeatsTrack` not persisted across reload (unlike `showWritingTimeline`). Fix: add load/save effect in WritingScript matching the `showWritingTimeline` pattern. (`docs/REGRESSION_TEST_CHECKLIST.md` J4)
- Mood overlay localStorage keys are unscoped — `scriptMoodOverlayEnabled` / `scriptMoodOverlaySettings` are global, not per-project. WritingScript reads but never writes them back. Fix: scope to `${key}:${projectId}`. (`docs/REGRESSION_TEST_CHECKLIST.md` J3)
- Presence channel `"script"` is shared between WritingScript and Script.js — should be `"writing-script"` in WritingScript. (`docs/REGRESSION_TEST_CHECKLIST.md` J5)

### Working

- Phase 4R layout geometry correction is implemented: Writing main workspace row is now `width: "calc(8.5in + 520px)"`, `maxWidth: "calc(8.5in + 520px)"`, `alignSelf: "flex-start"`, `paddingTop: "5px"` (copied from Script.js line 5732). Editor column is `flex: "0 0 8.5in"`, `width: "8.5in"` (was `flex: 1`). Right panel is `flex: 1, overflow: "hidden"` with no extra padding (removed `padding: "8px 20px 12px 0"`). Tab bar has `flexShrink: 0`. App.js Writing wrapper changed from `overflow: "hidden"` to `overflow: "auto"`. No functional changes. No production callbacks. `database.js` and `saveScenesDatabase` not touched.
- Phase 4Q Writing sidebar and beats parity is implemented: Writing workflow has a 120px `#FFE5B4` sidebar (Script/Moodboard(disabled)/Characters(disabled)). Writing content area starts at `left: "120px"`. `WritingBeatsPanel` is a full BeatsList clone — drag/drop, 7-color markers, right-click context menu, act grouping/collapse, beat detail modal (title + description, no Convert to Scene). Beats state is owned by `WritingScript`. Beats persist in `writingBeats:${projectId}`. Old `notes` field backward-compat-migrated to `description`. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4P visual parity is implemented: Writing workflow now matches Script Breakdown's side panel visual language. `WritingScript` renders an editor (flex left) + tabbed right panel with Scenes/Beats tabs (blue active, grey inactive, `6px gap`, `492px width`). `WritingSceneList` and `WritingBeatsPanel` use `width: "492px"`, `border: "2px inset #ccc"`, white bg, Century Gothic 12px — same as Script Breakdown panels. Beat rows have 8px beat number, 11px bold title, 20×20 red delete button. Toolbar is white, `minHeight: "38px"`, `padding: "5px 0 5px 12px"`, matching Script Breakdown toolbar. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4O Writing workspace beat/scene panels are implemented: scene list derives writing scenes from `writingDraftNodes` via `scenesFromDocumentNodes`; no production scenes are read. Beats panel uses `writingBeats:${projectId}` localStorage key (separate from `scriptBeats:${projectId}`). Clicking a scene scrolls to it via `sceneRefs`. `writingScenePageStats` is stored and passed to scene list for page number display. Beat-to-scene conversion intentionally not implemented. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4N Writing toolbar/header is implemented: `WritingScript` now renders a stable 40px toolbar above the editor. Controls: New Script button (when no draft), element type selector (when draft exists, disabled when no node is focused), page count display (updates from `onPageCountChange` callback), and save status with fixed width. The floating bottom-right element selector inside `WritingScriptEditor` is suppressed via `showFloatingElementSelector={false}`. No production callbacks were passed into WritingScript. `database.js` and `saveScenesDatabase` were not touched. Pre-Production and Production behavior were not changed.
- Phase 4M editor-only WritingScript activation is implemented: when `activeWorkflow === "writing"`, `App` renders `WritingScript` with `previewMode="editor"` instead of the existing production/pre-production module sidebar.
- Pre-Production and Production still render the existing sidebar/module system unchanged, including Script Breakdown through the compatibility wrapper around legacy `Script.js`.
- WritingScript currently receives only `selectedProject`, `user`, and `userRole`; no production scene, stripboard, schedule, tag, revision, character, database, or `saveScenesDatabase` callbacks are passed into WritingScript.
- Phase 4M did not edit Script.js, database code, production save paths, scenes, stripboard data, schedules, tags, revisions, production characters, module labels, or permissions.
- Manual test after Phase 4M confirmed Writing routes to the isolated editor surface and Pre-Production/Production still route to the existing module system.
- Manual test after Phase 4M found that scene heading appears to persist on reload, but body/action text appears not to persist.
- Writing mode is currently editor-only by design. Scene list, beats, timeline, and settings/header controls are intentionally not active yet.
- Script Breakdown still uses legacy `Script.js` through the compatibility wrapper and still contains old writing-mode branches until later cleanup.
- Phase 4L isolated WritingScript editor preview is implemented: `WritingScript` still returns `null` by default and is not routed, but can render an editor-only preview if explicitly passed `previewMode="editor"`.
- The preview uses `useWritingDraftState(selectedProject)` and `WritingScriptEditor` only. It shows draft save status and a writing-only New Script button; it does not render timeline, scene list, beats, settings modal, or production UI.
- Phase 4L did not edit Script.js, app routing, workflow routing, database code, `saveScenesDatabase`, production callbacks, production scenes, stripboard, schedules, tags, revisions, production characters, or production save paths.
- Phase 4K writing draft persistence foundation is implemented: `src/components/modules/WritingScript/writingDraftPersistence.js` and `src/components/modules/WritingScript/useWritingDraftState.js` exist but are not used by active runtime.
- The new helper preserves the current `scriptWritingDraft:${projectId}` localStorage key and payload shape for future compatibility.
- Phase 4K did not route WritingScript, edit Script.js runtime behavior, change active localStorage behavior, import production callbacks, edit database code, touch `saveScenesDatabase`, or mutate production scenes/stripboard/schedules/tags/revisions/characters.
- Phase 4I non-routed WritingScript shell is implemented: `src/components/modules/WritingScript/WritingScript.jsx` returns `null` by default and is not routed.
- If explicitly passed `previewShell={true}`, `WritingScript` renders only hidden inert surface markers; it does not mount active editor/timeline components, create runtime state, call callbacks, or write persistence.
- Phase 4I did not edit Script.js, app routing, workflow routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, production characters, or production save paths.
- Phase 4H writing settings ownership placeholder is implemented: `src/components/modules/WritingScript/WritingSettingsModal.jsx` exists and currently returns `null`.
- Actual writing settings runtime behavior remains in the legacy mixed `Script.js`: target page count, target page modal, writing timeline visibility, beats visibility, scene-number visibility, editor element type controls, save-status display, toolbar settings buttons, and localStorage-backed preferences were not moved or edited.
- Phase 4H did not edit Script runtime logic, target page behavior, timeline/beats/scene-number visibility behavior, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4G scene-list ownership placeholder is implemented: `src/components/modules/WritingScript/WritingSceneList.jsx` exists and currently returns `null`.
- Actual scene-list runtime behavior remains in the legacy mixed `Script.js`: `SceneList`, writing draft scene derivation, display labels, scene refs, drag/reorder, page metadata display, and scene selection were not moved or edited.
- Phase 4G did not edit Script runtime logic, scene list behavior, drag/reorder behavior, page metadata display, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4F beats/outline ownership placeholder is implemented: `src/components/modules/WritingScript/WritingBeatsPanel.jsx` exists and currently returns `null`.
- Actual beats runtime behavior remains in the legacy mixed `Script.js`: `BeatsList`, beat state, import/detail UI, localStorage persistence, and `handleConvertBeatToScene` were not moved or edited.
- Phase 4F did not edit Script runtime logic, beat conversion, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4E timeline ownership wrapper is implemented: `src/components/modules/WritingScript/WritingTimelinePanel.jsx` now wraps the existing experimental `WritingTimeline` component.
- `Script.js` still imports `src/experimental/writingTimeline/WritingTimeline.jsx` directly; Phase 4E intentionally did not change existing timeline runtime imports.
- Phase 4E did not edit `WritingTimeline.jsx`, `writingTimelineUtils.js`, Script runtime logic, app routing, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4D screenplay preview relocation is implemented: `src/components/modules/WritingScript/ScreenplayPagePreview.jsx` now contains the screenplay preview implementation.
- `src/components/modules/Script/ScreenplayPagePreview.jsx` remains as a compatibility re-export for legacy imports.
- Phase 4D did not change preview behavior, app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4C writing editor relocation is implemented: `src/components/modules/WritingScript/WritingScriptEditor.jsx` now contains the writing editor implementation.
- `src/components/modules/Script/ScriptWritingEditor.jsx` remains as a compatibility re-export, so the legacy mixed Script module can keep importing the old path.
- Phase 4C did not change editor behavior, app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Phase 4B writing draft model extraction is implemented: `src/components/modules/WritingScript/writingDraftModel.js` is now the source file for the existing writing draft model exports.
- `src/components/modules/Script/scriptWritingModel.js` remains as a compatibility re-export so existing `Script.js` and `ScriptWritingEditor.jsx` imports keep working unchanged.
- Phase 4B did not change app routing, Script runtime behavior, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters.
- Known follow-up from Phase 4B: `documentNodesFromScenes` and `scenesFromDocumentNodes` still preserve the current production-shaped scene conversion behavior and should later be split into writing-only helpers plus handoff mappers.
- Phase 4A structure-only split preparation is implemented: new `WritingScript`, `WritingCharacters`, `ScriptBreakdown`, and workspace `handoff` folders exist with architecture notes.
- `ScriptBreakdown` is currently a temporary pass-through wrapper around the legacy mixed `src/components/modules/Script/Script.js` component.
- `App.js` now imports the production-facing Script Breakdown module through `src/components/modules/ScriptBreakdown`; runtime props and behavior are intended to be unchanged.
- WritingScript and WritingCharacters are placeholders only and are not routed by the app yet.
- No Script internals, database code, persistence behavior, scenes, writing draft state, stripboard data, schedules, tags, revisions, or production characters were changed for Phase 4A.
- Phase 3 module label compatibility is implemented: the general production/pre-production module list now displays `Script Breakdown`, and old `"Script"` active module / custom permission values normalize to `Script Breakdown`.
- `Script Breakdown` still renders the existing `src/components/modules/Script/Script.js` component through the Phase 4A compatibility wrapper. The actual Script split has not started.
- Phase 2 workflow workspace routing is implemented: `AuthWrapper` passes `activeWorkflow` into `App`, and `App` wraps the existing sidebar/module content in `WorkflowWorkspace`.
- Writing, Pre-Production, and Production currently render the existing module system unchanged through thin workspace placeholders. Pitching/Post-Production have a defensive Coming Soon workspace if reached directly.
- Phase 2 intentionally did not add `activeModuleByWorkflow`; current single `activeModule` behavior remains unchanged to avoid destabilizing existing sidebar/module callbacks.
- Phase 1 workflow toolbar shell is implemented: top-level workflow tabs now sit centered in the desktop toolbar, the project name sits beside the welcome/display-name area, and tab selection is visual only. Pitching and Post-Production are visible disabled "Coming Soon" tabs.
- Phase 1 intentionally did not change module routing, Script internals, database persistence, realtime subscriptions, scene data, writing draft data, stripboard data, schedules, tags, or revisions.
- Scene identity is centralized in `src/utils/sceneIdentity.js`.
- New Script, Add Scene, double-enter scene creation, scene persistence, stripboard population, and timeline continuity are working.
- Scene list drag reorder exists in the Scenes tab and saves through the existing scene persistence path.
- Scene delete now renumbers/reflows remaining scenes using the same sequential reflow logic as scene-list reorder.
- Outline acts/beats are separate ordered item types.
- Beat add/delete/import/reorder and act group drag/drop are working.
- Beat timeline markers, beat zoom, act dividers, and beat marker color selection exist.
- Scene and beat timelines now have independent scroll/scale containers — Scenes Zoom and Beat Zoom are fully independent.
- Script module right-click menus are normalized for scene rows, beat rows, and non-edit screenplay tagging.
- Multi-word screenplay tagging now uses shared UUID-based phrase search; selected phrases tag all matched phrase words as one item.
- Convert Beat to Scene exists.
- Script module alerts/confirms use centered app-level modals.

### Broken / Needs Work

- Highest priority: WritingScript editor-only mode appears not to persist body/action text on reload. Scene heading seems to persist, but body/action text does not. Likely cause: 650ms save debounce — body text typed quickly then reload loses unsaved changes. Fix options: reduce delay in `useWritingDraftState.js` or add `beforeunload` save.
- Writing mode does not yet have drag/reorder in the scene list (click-to-scroll only; add as follow-up).
- Writing mode does not yet have a timeline, settings modal, or Writing Characters.
- It is not yet clear from the UI whether Writing actions are fully isolated from production scenes. Verify while fixing persistence.
- Script Breakdown still contains legacy writing-mode branches from `Script.js`. Do not remove them until WritingScript has stable editor persistence and the needed writing UI surfaces.
- Possible brief flash/load of the old writing side of Script Breakdown when switching workflows. Track as future routing/loading cleanup.
- Beat timeline marker placement/color selection was refined, but manual visual review is still needed.
- Beat timeline marker placement/color selection was refined, but manual visual review is still needed.
- Convert Beat to Scene: now creates a blank screenplay scene (no beat text copied). Beat Detail modal shows a human-readable linked scene label instead of raw UUID. Button state/color refinement still pending.
- Regular scene timeline right-click menu exists but is still mostly placeholder/incomplete. Script-module right-click menus are separate and working-path implemented.
- Scene Detail modal v1 implemented: double-click scene → modal with heading display, scene number/label edit, linked beat indicator, future metadata placeholder. Escape/backdrop/× close it.
- Scene number/label editing now lives inside the Scene Detail modal (old inline dialog replaced).
- Replacement letter metadata: scene.metadata.replacementLetter stores optional letter suffix (A/B/C). getSceneDisplayLabel() renders the combined label. All user-visible scene labels updated to use it (scene list, screenplay heading, revision viewer, beat detail linked label, timeline popup, scene selector dropdown). Scene Detail Modal has separate Replacement Letter field. handleUpdateSceneMetadataField saves metadata-only changes without triggering reflow. Load sort uses replacementLetter as tie-break. React keys in SceneList items, revision viewer, and ContinuousScript map callbacks use index-qualified fallback (`scene.id || \`${scene.sceneNumber}-${index}\``) to prevent collisions.
- Beats panel scrollbar gutter needs cleanup.
- Native `alert`/`confirm` calls still exist outside Script and should be migrated gradually to the centered App modal helpers. Toast/feedback messages are ad-hoc (inline state banners, browser alerts) — a unified toast component should be standardized but not implemented globally in a single pass.
- Module bottom visibility needs manual review across non-Script modules after the global wrapper scroll change.
- Pre-existing paren imbalance in Script.js (7 extra closes, confirmed pre-dates this session) — does not affect runtime but should be investigated.

### Recent Fixes

- Script writing-mode deletion/scene-creation cleanup sprint (2026-05-09):
  - **Heading drag selection (Problem 2):** Starting a drag on a scene heading now correctly extends into body blocks and across scene boundaries. Fix: `event.preventDefault()` on heading mousedown prevents the browser from entering contenteditable-constrained editing mode; the mousedown caret position is captured via `getCaretRangeFromPoint`, and the mouseup position is captured separately; `pendingSelectionDeleteRef` is built from the two endpoints instead of relying on native browser selection.
  - **Orphaned "2:" scene after delete (Problem 1):** `survivingFromRange` now has an orphan filter: scenes with empty heading AND all-empty content are removed after the `fullySelectedSet` / trim loop. Safety fallback keeps one clean empty scene if the entire script would otherwise be wiped. `pushUndoEntry` and DOM reconciliation both use the filtered list (`guaranteedSurvivors`).
  - **Double-enter orphan Action block (Problem 3):** `handleCreateSceneAfter` now removes the trigger block (the empty Action block at `blockIndex`) from the source scene instead of leaving it as an orphan.
  - **Default "INT. LOCATION - DAY" heading (Problem 4):** `createBlankScene` now sets `heading: ""` and `metadata: {}`. New scenes (Add Scene button, double-enter, new script) start with a blank heading field after the display label.
  - **Realtime console noise (Problem 5):** Throttled "REALTIME: Scenes changed" and "SKIPPING Scenes reload" logs to once per 2-second window using `window._scenesRealtimeLogAt` / `window._scenesSkipLogAt` gates.
- Script writing-mode selected-delete persistence fix:
  - Root cause: `editingScenes` (local to Script) and `scenes` (canonical, App state) were only synced via the 15s auto-save. Deleted scenes stayed in `scenes` (and thus the Scenes list) until the timer fired. On module switch+remount, the init effect re-populated `editingScenes` from the stale `scenes`, restoring the deleted scene.
  - Fix: a single new `useEffect` with dep `[editingScenes.length, isWritingMode]`. When scene count diverges from `scenes.length` in writing mode, it immediately calls `setScenes(normalized)` and `saveScenesDatabase(normalized)`.
  - Undo/redo that changes scene count triggers the effect automatically — no changes to `ContinuousScript` needed.
  - Edit mode behavior unchanged (commit on Save only).
- Script writing-mode selected-delete structural cleanup:
  - Root cause of blank-block leftovers: middle scenes were always preserved via `ensureSceneHasBlock`; start/end blocks trimmed to `""` (when offset=0 or selection consumed to end) were kept in `nextContent` because the removed-block range excluded them.
  - Fully-selected scenes (heading start through last block end covered by selection) are now removed from `editingScenes` entirely. Surviving scene objects and their `id`/`metadata` are preserved unchanged.
  - Fully-consumed start blocks (selection offset=0, something selected after) and end blocks (endOffset at or past block end, something selected before) are removed instead of left as blank placeholders.
  - `ensureSceneHasBlock` still runs for all kept scenes so a minimum of one body block always exists.
  - At least one scene is always preserved; if the entire screenplay is selected, the last touched scene is kept (cleared to empty).
  - New undo entry type `multi-scene-delete` uses a `spliceAt / replace / insert` splice model. Symmetric: applying `applyUndoEntry` on a `multi-scene-delete` entry restores the removed scenes and returns the inverse entry, which when applied re-deletes them. Undo/redo depth is unlimited and correct.
  - DOM reconciliation after delete and after undo/redo uses a fresh `buildSceneDisplayLabelMap` computed from the updated `editingScenesRef.current`, avoiding stale display-label references from the pre-delete render closure.
  - Caret after delete lands at the deletion point if the start scene survived, or at the start of the first surviving scene if the start scene was removed.
  - Selection snapshot fallback (`pendingSelectionDeleteRef`) preserved and still used when the browser collapses the cross-contenteditable selection on `contenteditable=true` restore.
  - All other editor behaviors (typing safety, navigation, parenthetical, Cmd+1-7, Tab/Enter, autocomplete, final-block delete) are unchanged.
- Script writing-mode selected-delete repair (selection bridge):
  - Root cause: `setEditableBlocksEnabled(true)` in the mouseup handler fires before Delete, collapsing any cross-boundary selection in Chrome/Safari.
  - Fix: capture a normalized selection snapshot (flow positions + char offsets) before restoring editability; attempt to re-apply the browser selection after; `handleMultiBlockSelectionDelete` falls back to the stored snapshot when the live selection is collapsed.
- Script writing-mode documentation/handoff update:
  - Current editor architecture and unresolved selected-delete gap documented for Claude.
  - No behavior changes.
- Script writing-mode heading integration:
  - Editable scene headings are now script-flow units alongside body blocks.
  - ArrowUp/ArrowDown traverse headings and body blocks in screenplay order while preserving wrapped-line body behavior.
  - Multi-block selected delete resolves both `.script-heading-edit` and `.script-edit-block`.
  - Intended selected-delete behavior can trim/clear heading text without deleting scene objects, ids, metadata, numbering, or scene order.
  - `multi-block-delete` undo/redo entries now restore/reapply affected headings plus touched scene content arrays.
  - Browser-tested caveat: highlighted heading/body selections do not always delete the exact highlighted text yet; range reconciliation remains open.
- Script writing-mode multi-block selected delete:
  - Delete/Backspace now handle selections spanning multiple screenplay content blocks.
  - The custom delete path only runs when selection endpoints resolve to different writing-mode flow units; single-unit selections stay native.
  - Deletion trims first/last selected blocks, removes fully selected middle blocks, preserves scene identity/order, and keeps at least one block per touched scene.
  - Undo/redo uses a scoped `multi-block-delete` history entry with only touched scene content arrays.
  - Scene headings are preserved conservatively; selections that start or end in headings are not custom-deleted.
- Script writing-mode redo stabilization:
  - Redo now mirrors the scoped undo model for text edits, type changes, add block, and delete block.
  - History application uses a current `editingScenes` ref rather than stale render-closure state.
  - Pending text snapshot timers are cleared before undo/redo so delayed typing snapshots cannot invalidate redo.
  - Structural history entries rebuild the block text snapshot map after indices shift.
  - Multi-block selected delete is still deferred pending a safe cross-`contentEditable` deletion design and browser verification.
- Current-scene scroll highlight: IntersectionObserver replaced with RAF-throttled scroll listener on `containerRef.current`. Picks the last sceneRef with `top <= 50px` from container top. Only updates `currentSceneNumber`, not `currentIndex`.
- Inserted-scene colors: updated from red (#e53935/#c62828) to orange (#f59e0b/#b45309) across all 4 display surfaces.
- Scene Detail Modal: Scene Number is now a read-only display field. Replacement Letter keeps its input and now has `autoFocus`. `onSceneNumberChange` still exists but is not exposed in UI.

### Phase A Complete

Visual highlight for inserted/replacement scenes (defined as `Boolean(scene.metadata?.replacementLetter)`) added to all 4 display surfaces:
- Script.js: scene list row (pink tint + red left border + red label), screenplay heading (thin red left border), timeline popup (INS badge)
- WritingTimeline.jsx: zoom lens block (red tint) and main timeline block (pinkish-red tint, dark label)
- Stripboard.js: row red left border, scene cell shows letter in red
- StripboardSchedule.js: available-scenes list (red left border + letter display, React key fixed), scheduled card (border + letter display)

Phase B (display derivation from predecessor UUID), Phase C (insert scene), Phase D (reflow), Phase E (stripboard persistence) are all unstarted.

## Script Writing Mode Editor Handoff

### Current Verified State

- Scene rendering unification is complete.
- Multi-scene visual selection works, including drag selections that start on scene headings.
- Multi-block selected delete works across headings and body blocks.
- Fully-selected scenes are removed from the screenplay (not just cleared).
- Orphan scenes (empty heading + empty content) are filtered from survivors automatically.
- Fully-consumed blocks are removed (no blank-block leftovers).
- Heading integration for navigation and custom delete resolution is complete.
- ArrowUp/ArrowDown navigation through editable scene headings works correctly.
- Double-enter creates a new scene cleanly (no orphan Action block left in previous scene).
- New scenes start with a blank heading (no default "INT. LOCATION - DAY").
- Typing safety is stable.
- Parenthetical behavior is stable.
- Undo/redo are stable, including for multi-scene deletes.
- Cmd+1-7, Tab/Enter, Character autocomplete, and final empty-block delete are working.

### Core Editor Model

- Writing mode still uses multiple separate `contentEditable` hosts.
- Body screenplay lines use `.script-edit-block`.
- Editable scene headings use `.script-heading-edit`.
- The editor is intentionally **not** one giant contentEditable.
- Live text entry is DOM-owned while the block is focused. React must not render live text children into focused edit hosts on every keystroke.
- React state syncs on blur and on explicit structural/type/history operations.
- The current flow-unit model is:
  - `{ si, kind: "heading" }`
  - `{ si, kind: "block", bi }`
- Flow units are used for heading-aware selection/delete resolution and vertical navigation.

### contentEditable Stabilization Strategy

- Focused screenplay blocks/headings should not be rewritten by React during normal typing.
- `blockRefs` and `sceneHeadingRefs` are the live DOM handles.
- `editingScenesRef` is used so undo/redo/history application can read current scene state without relying on stale render closures.
- Text snapshot timers track local undo text batches, but pending timers are cleared before undo/redo application.
- Earlier reverse-populated typing was caused by React rendering focused `contentEditable` text as children, which reset the caret so each new character inserted at the start.

### Undo/Redo Architecture

- Undo/redo are local to Script writing mode.
- They are scoped entries, not whole-script snapshots.
- Supported scoped entries include:
  - text edits
  - block/type changes
  - add block
  - delete block
  - `multi-block-delete` (legacy, kept for backward compat)
  - `multi-scene-delete` (current selected-delete path)
- Redo mirrors undo using inverse entries.
- New edits clear the redo stack through `pushUndoEntry`.
- Structural history changes rebuild the block text snapshot map after indices shift.
- `multi-scene-delete` entries use a symmetric `spliceAt / replace / insert` splice model. Applying the entry swaps `replace` and `insert` and swaps the focus fields to produce the inverse (redo) entry. No separate redo-specific format needed.

### Multi-Scene Selection

- Multi-scene visual selection uses a bridge for separate contentEditable hosts.
- On drag start inside `.script-edit-block` or `.script-heading-edit`, editable hosts are temporarily marked `contenteditable=false`.
- **Heading-start drags:** `event.preventDefault()` is called to prevent the browser from entering contenteditable editing mode (which would constrain the drag to the heading). The mousedown caret position is captured via `getCaretRangeFromPoint` before disabling editability. On mouseup, the end position is captured via `getCaretRangeFromPoint(upEvent.x, upEvent.y)`. A synthetic `spanRange` is built from both points; `pendingSelectionDeleteRef` is populated from it. Native browser selection is not used for heading-start drags.
- **Block-start drags:** `setEditableBlocksEnabled(false)` fires in capture phase; native browser selection extends across non-contenteditable elements. On mouseup the native selection is snapshotted into `pendingSelectionDeleteRef` before restoring editability.
- After restoring editability, the code attempts to re-apply the browser selection visually from the snapshot.
- A simple click/collapsed selection restores focus/caret to the clicked edit host. For heading clicks where `preventDefault` suppressed focus, the mouseup handler calls `.focus()` on `drag.blockEl` (the heading) explicitly.

### Multi-Block / Multi-Scene Delete

- Custom Delete/Backspace runs only when selection endpoints resolve to different writing-mode flow units.
- Single-unit selections stay native browser behavior.
- Live browser selection is tried first; `pendingSelectionDeleteRef` snapshot is used as fallback when the live selection is collapsed.
- Deletion behavior by selection coverage:
  - **Partial block**: trim text only; preserve the block.
  - **Fully consumed start block** (selection starts at offset 0 AND continues past the block): remove the block.
  - **Fully consumed end block** (selection covers the full block text AND started before it): remove the block.
  - **Middle blocks** (fully within the selection range): removed.
  - **`ensureSceneHasBlock`**: always runs for kept scenes; adds one empty fallback block only when all blocks would otherwise be gone.
  - **Partially selected scene**: kept, trimmed as above.
  - **Fully selected scene** (heading start at offset 0 through last block end fully covered): removed from `editingScenes`. Surviving scene `id`, metadata, and numbering are untouched.
  - **Entire screenplay selected**: last touched scene kept as an empty fallback.
  - **Orphan survivors** (empty heading + all-empty content): removed from `survivingFromRange` by a post-loop filter (`cleanSurvivors`). Safety fallback `guaranteedSurvivors` keeps one clean empty scene when the filter would produce an empty script.
- Caret after deletion: at the trim point if the start scene survived; at the heading of the first surviving scene otherwise.
- Scene identity of all surviving scenes is preserved exactly.
- `pushUndoEntry` and DOM reconciliation both use `guaranteedSurvivors`, not the raw `survivingFromRange`.

### Heading Integration

- Editable scene headings are now part of normal writing-mode script flow.
- ArrowDown from a previous scene's last body block moves into the next scene heading.
- ArrowDown from a heading moves into that scene's first body block.
- ArrowUp from the first body block moves into that scene heading.
- ArrowUp from a heading moves to the previous scene's last body block.
- Wrapped-line behavior inside body blocks remains native/hybrid and should be preserved.
- Headings were skipped originally because old traversal only used `.script-edit-block`; headings are `.script-heading-edit`.
- The original selected-delete path failed with headings because selection endpoints inside headings could not be resolved.

### Character Autocomplete

- Character autocomplete is local state in `ContinuousScript`.
- It is active only on Character lines.
- Suggestions come from existing script Character blocks plus `characters` prop/module data.
- Matching is case-insensitive.
- Enter/Tab accept only when the dropdown is open.
- Escape closes; Up/Down navigate suggestions only while open.
- Accepted names insert uppercase text.

### Persistence Model

- `editingScenes` is local state in the Script component (writing buffer).
- `scenes` is App-level canonical state (Scenes list, module-switch reload source).
- Writing mode syncs them in two ways:
  1. **Immediate (scene count change)**: a `useEffect` on `[editingScenes.length, isWritingMode]` calls `setScenes` + `saveScenesDatabase` the moment the scene array grows or shrinks.
  2. **Debounced (content change)**: the 15s auto-save handles text/block edits.
- Edit mode preserves its "commit on explicit Save" design — no immediate sync.
- Selected-delete (scene removal) goes through path 1 → Scenes list updates immediately, module-switch reload correct.

### Scene Creation

- `createBlankScene(sceneNumber, timelineStartPage)` creates a new scene with `heading: ""` and `metadata: {}`.
- Display label ("N: ") is derived and shown automatically; the user types their heading text after it.
- `handleCreateSceneAfter` (double-enter) removes the empty trigger block from the source scene. If the scene would have 0 blocks after removal, one clean empty Action block is kept.
- `handleInsertScene` (insert-between from sidebar) still overrides metadata with `replacementLetter` and form defaults (`intExt: "INT."` etc.) but the heading starts blank.
- Beat-to-scene conversion (`handleAddSceneFromBeat`) also overrides metadata with `sourceBeatId` and form defaults but heading starts blank.

### Remaining Limitations

- Display labels (scene numbers) on surviving headings update correctly after deletion because the DOM reconciliation timeout uses a fresh `buildSceneDisplayLabelMap` computed from `editingScenesRef.current`.
- The `pendingSelectionDeleteRef` snapshot depends on `getFlowPositionForNode` / `getRangeOffsetInFlowUnit` resolving correctly at mouseup time. Complex nested DOM structures could theoretically confuse these; this has not been a problem in practice.
- Heading-start drag selection relies on `getCaretRangeFromPoint` hitting the correct text node at mouseup. If the user releases the mouse over a non-text area (e.g., padding, margins), the range may miss the intended word boundary.
- Manual browser testing still recommended for: partial heading selections spanning scene boundaries, scenes with only one block, and redo-after-multiple-undos chains.

### Recommended Next Sprint

- Writing-mode scene-level features (e.g., merge scenes, split scene at caret) if needed.
- Deleted-scenes recovery UI (soft-delete / trash), if desired.
- No architectural changes to the editor are needed at this time.

### Historical Root Causes

- Reverse typing: React rewrote focused `contentEditable` children during typing, resetting caret placement and causing new characters to insert at the start.
- Imported vs writing-created scene divergence: writing-created scenes had different wrappers/default fields and extra divider/spacing compared with imported scenes; unification removed the visual divider/extra spacing and aligned blank scene defaults.
- Heading skip: arrow/delete resolvers originally treated only `.script-edit-block` as editable flow, so `.script-heading-edit` was invisible.
- Heading delete failure: custom selected-delete originally could not resolve heading endpoints, so heading/body selections were ignored or mishandled.

### Recently Changed

- **Scene chronology provenance Phase 1:**
  - `metadata.originalScriptOrder` now exists as additive frozen screenplay-position provenance.
  - Full FDX import stamps `originalScriptOrder` as 0-based import order alongside existing `originalSceneNumber`.
  - Single-scene FDX replace preserves existing `originalScriptOrder`; fallback order is current `metadata.scriptOrder`, then current array index when safely available.
  - Inserted blank scenes stamp `originalScriptOrder` with the clamped insertion index while preserving `replacementLetter`.
  - Display/offset logic is still deferred. `getSceneOriginalNumberPresentation` and original-number rendering were not changed.
  - Next phase should add `getChronologyOffset` and fringe-case display handling for chronologically displaced scenes.
- **Stripboard UX refinement:**
  - Title is now `STRIPBOARD` (no "— Scene Breakdown").
  - Status/stat badges consolidated into the main header row alongside the title — no separate second header band.
  - Sticky column header: outer module wrapper is now `display:flex; flex-direction:column; overflow:hidden`. Inner scroll container (`flex:1; overflow:auto`) wraps column header + rows. Header uses `position:sticky; top:0; zIndex:2`. Horizontal scroll is shared between header and rows automatically.
  - Per-column font-size overrides: `columnFontSizes: {}` added to Stripboard prefs (stored in `stripboard_prefs_v1`). Each column resolves `(prefs.columnFontSizes[key] ?? prefs.fontSize)`. Columns with an override show a `●` dot in the header. Global font-size control still works for unoverridden columns.
  - Column-header right-click menu: suppresses browser context menu, does NOT open scene modal. Options: Use Global Font Size, Smaller, Normal (= current global), Larger, Reset Column Width. Row right-click still opens the heading modal.
  - Badge rendering: Cast, Props, Wardrobe, Makeup, Production Design columns render items as flex-wrap token badges.
- **Phase 3 — Heading architecture:** `parseSceneHeading` in `src/utils.js` fully rewritten — supports `INT.`, `EXT.`, `I/E`; dash-separated primary path; space-separated fallback; extracts modifier correctly; `console.log` noise removed. `buildHeadingString({ intExt, location, timeOfDay, modifier })` added as canonical heading reconstruction utility (exported from `src/utils.js`). Used in `App.js` (×2 sites), `Script.js` modal `onSave`, and `SceneDetailModal.js` preview. Bug fixed: `modifier` now written to in-memory `scene.metadata` in `updateStripboardScene` (was written to DB only).
- **Phase 2 — Shared modal:** `src/components/shared/SceneDetailModal.js` created. Both Script Scene Detail modal and Stripboard Edit Heading modal replaced with the shared component. Script modal adds editable heading controls; Stripboard modal gains "View Script Page" button. Parent modules own all state and callbacks.
- **Phase 1 — Stripboard cleanup:** Inserted left-stripe removed. `script` column repurposed as narrow badge column (blank header, 22px default). Inserted scenes show amber circle badge with replacement letter. `✎` edit button removed. Right-click on row opens heading modal directly; browser context menu suppressed.
- Scene IDs now use shared `createSceneId` / `isValidSceneId` helpers from `src/utils/sceneIdentity.js`.
- FDX import creates valid UUID scene IDs and stores imported source numbering in `scene.metadata.originalSceneNumber`.
- Scene list reorder updates canonical scene order, scene numbers, continuous timeline positions, local stripboard state, and database persistence.
- Scene delete now reflows remaining scenes, preserves stable IDs, and preserves `metadata.originalSceneNumber`.
- `reflowScenesSequentially` and `buildOriginalContentMap` support consistent delete/reorder updates.
- Main module wrapper now scrolls instead of hard-clipping overflow, and Script fills parent height instead of using viewport height.
- App-level centered alert/confirm helpers are passed into Script.
- `WritingTimeline.jsx`: `SCENE_LAYER_HEIGHT` reduced to 47, `SCROLLBAR_GUTTER_PX` reduced to 10 for compact timeline containers.
- Beat Detail modal now closes on Escape keypress.
- Scene headings show a small "B" button when the scene was converted from a beat (`scene.metadata.sourceBeatId`); clicking it opens the Beat Detail modal for the originating beat. Button is UI-only and outside the contentEditable `h2`.
- Convert Beat to Scene now creates a blank scene (empty Action block, default heading). Beat Detail shows "Linked Scene: N — heading" instead of raw UUID.
- Scene Detail modal v1 added: double-click any scene in the scene list opens it. Scene number/label editing (including letters like 24A) moved into the modal. Escape/backdrop/× close it.
- Script viewer right-click now suppresses browser menu in non-edit view, uses selected text when available, and falls back to clicked word spans for tagging. Edit/contentEditable mode preserves native context-menu behavior.
- Script/Props phrase search now shares `src/utils/scriptSearch.js`; new phrase tag keys are normalized stemmed words joined by spaces, with legacy no-space phrase keys still accepted.
- Script right-click tagging menu again supports Remove Tag for tagged words/phrases. ContinuousScript highlight lookup now follows the active rendered scene array so insert-before operations should not require module switch/refresh to restore highlights.

## Important Files / Areas

Confirm actual paths before editing. Likely areas include:

- `src/components/modules/Script/Script.js`
- `src/experimental/writingTimeline/WritingTimeline.jsx`
- `src/experimental/writingTimeline/writingTimelineUtils.js`
- `src/utils/sceneIdentity.js`
- `src/App.js`
- `src/services/database.js`

## Scene Identity Architecture Map

## Scene State Ownership / Centralization Goal

- Scene is the fundamental unit of the app.
- `scene.id` is stable identity.
- `metadata.scriptOrder` is screenplay order.
- `getSceneDisplayLabel` is the visible label source.
- `scene.status` belongs to production/scheduling state.
- `scene.metadata.color` is user/custom visual annotation.
- Status color is production meaning and wins in Script/SceneList.
- Custom color is secondary annotation when status exists.
- Timeline is a writing/navigation tool and should show custom colors, not production status colors.
- Stripboard/Schedule are production tools and own scheduling/status workflows.
- Future work should centralize status colors and scene display helpers into shared utilities.

## Scene Presentation Layer

- `src/utils/scenePresentation.js` is the canonical visual semantics layer for scene status, custom color, original-number metadata, and SceneList metadata columns.
- Modules should consume these helpers instead of inventing their own status/color logic.
- Production statuses override custom color backgrounds; custom colors remain secondary indicators when status exists.
- Timeline intentionally ignores production statuses and shows custom scene colors only.
- Future migrations: Stripboard, StripboardSchedule, Props viewer, Beats window.

### Source of Truth

| Concern | Field | Notes |
|---|---|---|
| Stable identity | `scene.id` | UUID; never changes; use as DB/sync/cross-module key |
| Canonical script order | `metadata.scriptOrder` | Stamped on every save; used for DB reload sort |
| Legacy DB integer | `scene.sceneNumber` | Unique integer assigned by reflow; backward-compat reads only |
| Display label | `buildSceneDisplayLabelMap(scenes)` | Derived from array position + `replacementLetter`; never persisted |
| Inserted/revision marker | `metadata.replacementLetter` | Optional letter suffix (A/B/C); determines inserted-scene label |

### Props Scene Association Layer

- `src/utils/propSceneRefs.js` is the compatibility layer for `prop.scenes` entries.
- `prop.scenes` may contain legacy integer sceneNumbers, UUID scene.id refs, or mixed arrays.
- All membership reads must use `sceneMatchesPropSceneRef(scene, ref)` — never raw string comparison.
- All navigation lookups must use `resolvePropSceneRef(ref, scenes)` — never `findIndex` by sceneNumber.
- Shoot-day filtering/display uses `getPropSceneNumbersForDisplay(prop, scenes)` to resolve refs to current sceneNumbers for schedule map lookup (schedule data stays keyed by sceneNumber).
- Script-viewer pre-confirm uses `getPropSceneIds(prop, scenes)` to resolve refs to `scene.id[]` for UUID-stable matching.
- Script-viewer highlight check uses `sceneMatchesPropSceneRef(scene, ref)` — no raw string comparison.
- Writes via `onAddPropToScene` now store UUID in `prop.scenes` (write-forward migration).
- Writes via `onRemovePropFromScene` now remove by `normalizePropScenesOnRemove` (handles both formats).
- Inline variant creation (Props.js script viewer) now writes `scene.id` into `scenes` and creates UUID-anchored instance IDs.
- Sorting uses `getEarliestScriptOrder` via `metadata.scriptOrder` — not raw `parseFloat` of refs.

**P2C deferred (Props migration remaining items):**
- `mergedScenes` write in script tagging path (`App.js:2308`) — `searchScript` returns sceneNumbers; migrating this requires changes to the core script-tagging pipeline
- Character scene merging (`charObj.scenes.map(String)` merged into `propData.scenes`) — `charObj.scenes` is owned by Characters module, not in scope
- `pendingPropScenes` ephemeral array — intentionally left as sceneNumbers; not persisted, low risk
- `prop.sceneIds` field reconciliation — `App.js` already stores `mergedSceneIds` alongside `scenes` on script-tagged items; relationship to `prop.scenes` post-migration needs clarification in P2C

### Stable Systems

- **Scene reorder + reflow**: `handleSceneListReorder` → `resequenceInsertedGroupLetters` → `reflowScenesSequentially`. Inserted-scene labels are correct after drag.
- **Display label derivation**: `buildSceneDisplayLabelMap` + `getSceneDisplayLabel` in `src/utils/sceneDisplayLabel.js`. Never use display labels as DB keys.
- **ShotList dual-key lookup**: checks `_bySceneId[scene.id]` first, `[sceneNumber]` fallback — reference model for other modules.
- **sceneIdentity.js utilities**: `sameScene()`, `getSceneId()`, `getSceneNumber()`, `isValidSceneId()`, `createSceneId()` — consistently used in StripboardSchedule and ShotList.

### Rules for Future Work

1. Use `scene.id` (UUID) as the canonical key for any new persistence, sync, or cross-module reference.
2. Never use `scene.sceneNumber` as an ordering or display source — only for legacy DB backward-compat reads.
3. Never persist a display label (e.g., `"3A"`) as a DB key, diff key, or sync ID.
4. All new tag/prop/makeup/PD instance IDs must embed `scene.id`, not a positional `sceneIndex`.
5. New module lookups must follow the ShotList dual-key pattern: write to both UUID key and sceneNumber key; read UUID-first.

### Global Typography Guardrail

- Current accepted app UI typography baseline is inherited from the app/workflow shell in `src/App.js`: `'Century Gothic', 'Futura', 'Arial', sans-serif`.
- Do not change global app fonts, root `font-family`, typography variables, shared button/input typography, or module-wide inherited font styling unless the user explicitly asks for typography changes.
- PDF-only font changes must stay isolated to PDF export utilities and must not affect app rendering.
- Any sprint touching global CSS, root layout styles, shared style constants, or theme variables must call out typography impact before staging.
- Before staging style-related work, search for `font-family`, `fontFamily`, global selectors, and theme typography variables; summarize any changes in the final report.

### Runtime Identifier Guardrail

- Do not introduce new variable names into existing React components without verifying they are declared or imported in that exact component scope.
- After changing callback dependency arrays, verify every referenced variable exists in scope.
- Build passing is not enough for React runtime-sensitive changes: CRA can compile successfully while an undefined identifier crashes only when the affected module renders.
- Before staging, search modified files for newly introduced identifiers used in JSX/callbacks and confirm they are declared/imported. Avoid placeholder names like `scenesToRender`, `filteredItems`, or `currentRows` unless they already exist in the same scope or are added in the patch.

### Module Status

| Module | Scene Identity Model | Risk |
|---|---|---|
| ShotList | UUID + sceneNumber dual-key (`_bySceneId`) | Stable |
| StripboardSchedule | `sameScene()` / `getSceneId()` | Stable |
| Script (reorder, display) | UUID reflow + `displayLabelMap` | Stable |
| Tagging instances | Positional `"si-bi-wi"` string | High — breaks on reorder/insert |
| Props `searchScript` | Positional `"si-bi-wi"` string | High — same as tagging |
| Props `prop.scenes` | Dual-read: UUID or integer (`propSceneRefs.js`) | P2A+P2B complete — writes use UUID, all reads handle both; shoot-day, pre-confirm, highlight, variant writes migrated. P2C deferred: script-tag mergedScenes write, charObj.scenes merge |
| Makeup, PD | `parseInt(instanceId.split("-")[0])` | High — positional only |
| Characters, Wardrobe, Locations | `sceneNumber` integer | Medium — works until reflow diverges |
| Revision diff JSONB | No `scene_id` embedded | Medium — reflow can detach diffs |

### Next Feature Path

Migrate tagging instance IDs from positional `"si-bi-wi"` to `"${scene.id}-${bi}-${wi}"` (T2) before any new cross-scene feature. This unblocks correct tag persistence after reorder, multi-word phrase tagging, and Props/Makeup/PD scene-linking.

## UX Constraints

- Preserve the existing visual direction.
- Keep scene timeline drag/snapping behavior untouched unless explicitly requested.
- Keep beat timeline marker work separate from scene timeline snapping/dragging.
- Keep Beats/Scenes side-panel controls visible and testable.
- Avoid broad UI rewrites; make surgical changes around the current workflow.
- Migrate native alerts module-by-module through the centered App modal helpers; avoid broad alert rewrites.

## Current Known Issues / Next Tasks

- DOOD PDF export and unified screenplay pagination/export wiring are implemented and build-passing. Call Sheet/Character sides heading formatting was corrected so scene numbers render once per heading and scene-heading whitespace is normalized. Call Sheet sides target selection now passes every real scheduled shoot-day scene into the shared full-page sides renderer, while lunch/ADR/custom rows stay excluded. Script share links now support authenticated app-only internal labels stored in `script_share_links.label`; labels do not affect tokens, URLs, public validation, or public viewer output. The Mood Overlay repeat-cycle opacity bug was traced to the activity reset clearing/staling the opacity interval, and the reset path now leaves the interval alive. The Mood Overlay Image fade control is re-enabled only for image-layer crossfade keyframes, while the global opacity lifecycle remains isolated to the existing Fade time/inactivity settings. FDX import now explicitly joins adjacent direct `<Text>` nodes inside each `<Paragraph>` so styled/adorned words remain in the same screenplay block as plain text. Parser-source validation against `/Users/joshuachiara/Downloads/CD Draft2.fdx` confirmed the Airspeed Horsa Action and Scene Heading cases no longer split. Manual browser verification is still recommended for generated PDFs across Writing, Script Breakdown, Call Sheet sides, Character sides, wide Day Out of Days matrices, share-link label editing, Mood Overlay repeated opacity-ramp cycles and image fade timing, and the full `CD Draft2.fdx` import flow. Rich-text run preservation for FDX styles is not implemented yet and should be handled in a separate future sprint. Mood Overlay should be extracted into dedicated components/hooks before further behavior expansion.
- Review beat marker placement/color menu visually and refine spacing/beat-track zoom UX if needed.
- Finish regular scene timeline right-click actions and align them with the beat marker color menu pattern.
- Refine Convert button state/color for converted beats.
- Add scene-heading beat-link indicator that opens the Beat Detail modal.
- Clean up Beats panel scrollbar gutter.
- Add Scene Detail modal.
- Move scene renumber editing into a modal eventually.
- Continue manual verification of scene delete/reorder persistence across reloads.
- Continue replacing native alerts/confirms outside Script; standardize toast/feedback styling module-by-module (do not rewrite all modules at once).
- Verify module bottom visibility across Dashboard, Stripboard, Budget, DOD, and other large modules.

## Next Recommended Task

Continue with the next requested focused sprint. Do not start DB/RPC, snapping, stripboard rewrite, right-click/context menu, or broad timeline architecture work unless explicitly requested.
