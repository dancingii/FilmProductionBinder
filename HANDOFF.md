# Project Handoff

## Current Objective

Stabilize the film production app workflow, especially timeline drag/drop, stripboard synchronization, canvas object behavior, and scene scheduling views.

## Current Known State

### Working

- Timeline drag/drop is mostly functional.
- Timeline scene movement is visually responding correctly in most cases.
- Recent cluster snapping work improved behavior, but may still need refinement.
- Core app is functional enough to continue surgical fixes rather than rewriting.

### Broken / Needs Work

- Stripboard and stripboard schedule do not populate or reflect changes made by timeline drag/drop.
- Cluster snapping may still snap slightly early by choosing internal scene edges instead of the semantic outer edge of a contiguous cluster.
- Canvas toolbar spacing/padding is too large between toolbar and canvas.
- Canvas controls may be hidden behind the canvas.
- Text boxes do not delete when selected and Delete is pressed.
- Text boxes should enter edit mode only on double click, not by counting separate single clicks.
- Images are not landing where expected on the canvas.
- Image aspect ratios may differ between the roll and the canvas.

### Recently Changed

- Codex worked on timeline drag/drop and snapping behavior.
- A previous build generated untracked build bundle files, which should not be committed.
- `git restore build` was run to restore generated build output.
- Remaining untracked build artifacts may need cleanup if still present.

## Important Files / Areas

Confirm actual paths before editing. Likely areas include:

- timeline components
- stripboard components
- stripboard schedule components
- canvas/editor components
- drag/drop utilities
- shared scene/order state
- image roll / image placement logic
- text box selection/editing logic

## Source of Truth Rules

- Timeline drag/drop should update the canonical scene/order state.
- Stripboard and stripboard schedule should derive from that same canonical scene/order state.
- Do not create a separate stripboard-only order unless explicitly approved.
- Do not duplicate scene state to “fix” sync unless there is a clear reason.
- If timeline drag/drop changes scene order, all dependent views should reflect that change.
- Preserve existing working drag/drop behavior while fixing sync issues.

## UX Constraints

- Preserve the existing visual direction.
- Avoid adding extra padding around canvas/timeline controls.
- Keep controls accessible and visible.
- Text boxes should enter edit mode by double click only.
- A selected, non-editing text box should delete with the Delete key.
- Single click should select text boxes, not enter edit mode.
- Image placement should match the expected drop/click position.
- Image aspect ratio should remain consistent between roll preview and canvas placement unless intentionally cropped.

## Current Open Questions

- What is the current canonical source of scene/order data?
- Does timeline drag/drop mutate local timeline-only state instead of shared scene state?
- Should stripboard schedule derive directly from stripboard order or from the same canonical scene model?
- Should snapping prioritize semantic cluster boundaries over nearest internal edge when dragging near contiguous scene clusters?
- Are image placement bugs caused by coordinate conversion, scaling, canvas transform, or react-rnd behavior?

## Next Recommended Task

Investigate why stripboard and stripboard schedule do not reflect timeline drag/drop changes.

Do not edit first. Inspect the data flow and report:
- where timeline drag/drop stores the new order
- where stripboard reads its order from
- where stripboard schedule reads its order from
- whether there is duplicated or disconnected scene state
- the smallest safe fix to make all views derive from the same source