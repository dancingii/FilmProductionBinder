# Writing Script Module

Writing Script is the draft/story-only script module for the Writing workflow.

Future ownership:

- `writingDraftNodes`
- Writing editor
- Writing scene list
- Writing timeline
- Beats and outline
- Target page count
- Writing settings
- Writing-only persistence

Rules:

- Must not call `saveScenesDatabase`.
- Must not mutate production scenes, Script Breakdown scenes, stripboard, schedule, tags, call sheets, revisions, or production scene records.
- Must use writing scene IDs, not production scene IDs.
- Later production sync must happen only through the explicit Writing-to-Pre-Production handoff layer.

For Phase 4A this is a placeholder only and is not routed by the app.
