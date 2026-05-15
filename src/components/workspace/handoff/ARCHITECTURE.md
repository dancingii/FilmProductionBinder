# Writing to Pre-Production Handoff

The handoff layer is the only bridge between Writing data and production/pre-production data.

Rules:

- Writing data must not automatically mutate production data.
- Writing scenes will later be mapped to Script Breakdown scenes only after an explicit user action.
- Writing Characters will later be mapped or linked to Production Characters only after an explicit user action.
- New production scene IDs are created during handoff.
- New production character IDs are created during handoff unless the user links to an existing production character.
- Production scenes may store `sourceWritingSceneId` for traceability.
- Production characters may store `sourceWritingCharacterId` for traceability.
- Handoff must prompt before create, replace, link, skip, or cancel decisions.
- No automatic overwrite is allowed.
- `saveScenesDatabase` must only be called with a deliberate full production scene payload so stale-scene deletion does not remove production scenes unintentionally.

For Phase 4A this folder contains architecture notes only. No handoff behavior is implemented.
