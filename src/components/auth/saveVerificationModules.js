// Shared module roster for the Save Verification system.
// Imported by both SaveVerificationModal (display) and AuthWrapper (flush result completion).
//
// ─── Two-system architecture ──────────────────────────────────────────────────
//
// SYSTEM 1 — Supabase DB Sync / Exit Verification  (registered: true, source: "flushHandler")
//   These modules must return a clean database result before Return is allowed.
//   A module flush result is clean if: status="success", storage="database", no localOnly,
//   no errorMessage — or status="skipped" (no changes for this module this session).
//   Failure → Return is hidden, emergency backup is preserved, localStorage is NOT cleared.
//
// SYSTEM 2 — Infrastructure / Safety Net  (registered: false)
//   Rows that are displayed for transparency but do NOT gate Return to Project Selector.
//   Includes:
//     - "Local Recovery / IndexedDB" (IDB mirror write of working localStorage — cache step)
//     - "Supabase Backup Verification" (backup snapshot/manifest writes — audit/recovery layer)
//   These are write-after-exit infrastructure. Their failure does not mean Supabase data
//   is stale — it means the backup/cache layer had a problem. Return remains available
//   if all System 1 modules are clean.
//
// ─── Field reference ──────────────────────────────────────────────────────────
//
// registered: true  — a result must appear for this key to allow Return.
//                      allRegisteredClean requires all of these to be verified/skipped.
//
// registered: false — shown in the modal but does NOT block Return.
//
// source: "flushHandler"
//   — registered via ModuleFlushContext.registerFlushHandler().
//   — callAllFlushHandlers() is expected to return a result for this key.
//   — if no result is returned, AuthWrapper injects a blocked missing-handler result.
//
// source: "postFlush"
// managedBy: "authWrapper"
//   — NOT registered with ModuleFlushContext.
//   — Result is written directly by AuthWrapper after callAllFlushHandlers() completes.
//   — Must NOT be included in missing-handler fill-in logic.
//   — Must NOT show "could not be verified because its save handler is not registered/mounted."

export const SAVE_VERIFICATION_MODULES = [
  // ── System 1: Supabase DB Sync / Exit Verification ──────────────────────────
  // These must all be clean (database/skipped, no localOnly) for Return to appear.
  { key: "writingScript",        label: "Writing Script",              registered: true,  source: "flushHandler" },
  { key: "moodBoard",            label: "MoodBoard",                   registered: true,  source: "flushHandler" },
  { key: "writingCharacters",    label: "Writing Characters",          registered: true,  source: "flushHandler" },
  { key: "projectMetadata",      label: "Project Metadata",            registered: true,  source: "flushHandler" },
  { key: "projectSettings",      label: "Project Settings",            registered: true,  source: "flushHandler" },
  { key: "scriptBreakdown",      label: "Script Breakdown",            registered: true,  source: "flushHandler" },
  { key: "characters",           label: "Characters",                  registered: true,  source: "flushHandler" },

  // ── Not yet registered (no save handler implemented) ─────────────────────────
  { key: "castCrew",             label: "Cast & Crew",                 registered: false, source: "flushHandler" },
  { key: "locations",            label: "Locations",                   registered: false, source: "flushHandler" },
  { key: "props",                label: "Props",                       registered: false, source: "flushHandler" },
  { key: "wardrobe",             label: "Wardrobe",                    registered: false, source: "flushHandler" },
  { key: "makeup",               label: "Makeup",                      registered: false, source: "flushHandler" },
  { key: "productionDesign",     label: "Production Design",           registered: false, source: "flushHandler" },
  { key: "shotList",             label: "Shot List",                   registered: false, source: "flushHandler" },
  { key: "stripboard",           label: "Stripboard",                  registered: false, source: "flushHandler" },
  { key: "stripboardSchedule",   label: "Stripboard Schedule",         registered: false, source: "flushHandler" },
  { key: "calendar",             label: "Calendar",                    registered: false, source: "flushHandler" },
  { key: "callSheets",           label: "Call Sheets",                 registered: false, source: "flushHandler" },
  { key: "budget",               label: "Budget",                      registered: false, source: "flushHandler" },
  { key: "reports",              label: "Reports / Export Settings",   registered: false, source: "flushHandler" },

  // ── System 2: Infrastructure / Safety Net ────────────────────────────────────
  // Displayed for transparency but registered: false — do NOT gate Return.
  // Their failure is shown visually but does not block project exit when System 1 is clean.
  //
  // "Local Recovery / IndexedDB": writes the active localStorage working mirror to IDB
  //   as a cache checkpoint before clearing it. An IDB write failure here means the
  //   cache snapshot was not captured, not that Supabase data is stale.
  //
  // "Supabase Backup Verification": writes audit/recovery snapshots and a backup manifest
  //   to Supabase project_backups tables. Failure means the audit log was not written,
  //   not that module data failed to save.
  { key: "localRecovery",        label: "Local Recovery / IndexedDB",  registered: false, source: "postFlush", managedBy: "authWrapper" },
  { key: "supabaseVerification", label: "Supabase Backup Verification",registered: false, source: "postFlush", managedBy: "authWrapper" },
];
