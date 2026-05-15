# Script Breakdown Module

Script Breakdown is the production/pre-production-owned script module.

It will own production scene records, production scene IDs, scene numbers and display labels, revision/page editing, tagging, breakdown metadata, stripboard and schedule relationships, and production persistence.

For Phase 4A this folder contains only a compatibility wrapper around `src/components/modules/Script/Script.js`. Runtime behavior is intentionally unchanged while production-facing logic is extracted in later phases.

Rules:

- Script Breakdown is allowed to update app-wide production scenes through the existing production save path.
- Script Breakdown owns tagging and interconnected production breakdown data.
- Script Breakdown must not mutate writing draft nodes directly.
- The temporary wrapper should be replaced incrementally as production-facing logic moves out of the legacy mixed Script module.
