// ─── Project Supabase Backup Manager ─────────────────────────────────────────
// Writes snapshot and audit records to the new backup/safety layer tables:
//
//   project_module_snapshots         — latest snapshot per (project_id, module_key), upsert
//   project_module_snapshot_versions — append-only version history, insert-only
//   project_backup_manifests         — full save attempt summary, insert-only
//   project_load_audits              — project-open scan summary, insert-only
//
// CRITICAL DATA-SAFETY CONSTRAINTS:
//   • No function in this file may call supabase.delete() or .from().delete().
//   • No pruning, trimming, or removal of old records.
//   • project_module_snapshots: upsert on (project_id, module_key) only.
//   • All other tables: insert-only.
//   • Snapshot failure must propagate — callers decide whether to block exit.
//
// These writes are a BACKUP layer. They never replace operational module saves.

import { supabase } from "../supabase";

const SCHEMA_VERSION = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function estimateJsonByteSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function stableJsonHash(value) {
  try {
    const str = JSON.stringify(value);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (Math.imul(h, 0x01000193) >>> 0);
    }
    return h.toString(16).padStart(8, "0");
  } catch {
    return "00000000";
  }
}

// ─── buildModuleSnapshotPayload ───────────────────────────────────────────────
// Constructs the structured payload written to snapshot tables for a single
// module's flush result. Includes both save metadata and (where available)
// the actual data payload for recovery.
//
// Parameters:
//   moduleKey    — e.g. "moodBoard"
//   moduleLabel  — e.g. "MoodBoard"
//   flushResult  — the full normalized result from ModuleFlushContext
//   options      — { projectId, projectName, savedByUserId, savedByEmail, source }
//
// The returned object is the `payload` column value in the snapshot tables.

export function buildModuleSnapshotPayload(moduleKey, moduleLabel, flushResult, options = {}) {
  const { projectId, projectName, savedByUserId, savedByEmail, source = "saveVerification" } = options;
  const r = flushResult || {};

  const base = {
    source,
    moduleKey,
    moduleLabel,
    projectId,
    projectName,
    savePhase: r.savePhase ?? null,
    status: r.status ?? null,
    storage: r.storage ?? null,
    localOnly: r.localOnly ?? null,
    skipped: r.skipped ?? null,
    errorMessage: r.errorMessage ?? null,
    savedAt: r.savedAt ?? new Date().toISOString(),
    savedByUserId: savedByUserId ?? null,
    savedByEmail: savedByEmail ?? null,
    hasMeaningfulData: r.hasMeaningfulData ?? null,
    message: r.message ?? null,
  };

  // Per-module metadata fields and snapshotPayload
  switch (moduleKey) {
    case "writingScript":
      return {
        ...base,
        nodeCount: r.nodeCount ?? (Array.isArray(r.snapshotPayload?.nodes) ? r.snapshotPayload.nodes.length : null),
        hasUserCreatedScript: r.hasUserCreatedScript ?? r.snapshotPayload?.hasUserCreatedScript ?? null,
        supabaseTable: "projects.settings.writingScriptDraft",
        supabaseField: "settings.writingScriptDraft",
        snapshotPayload: r.snapshotPayload ?? null,
        snapshotNote: r.snapshotPayload
          ? "Full node payload included from flush result."
          : "Full node payload not included in this snapshot — metadata only. Full payload lives in IDB writingDrafts store.",
      };

    case "moodBoard":
      return {
        ...base,
        boardCount: r.boardCount ?? null,
        imageCount: r.imageCount ?? null,
        linkCount: r.linkCount ?? null,
        canvasItemCount: r.canvasItemCount ?? null,
        localStorageKey: r.localStorageKey ?? null,
        supabaseTable: r.supabaseTable ?? "moodboard_data",
        supabaseFields: r.supabaseFields ?? null,
        pendingDebounceFlushed: r.pendingDebounceFlushed ?? null,
        snapshotPayload: r.snapshotPayload ?? null,
      };

    case "writingCharacters":
      return {
        ...base,
        profileCount: r.profileCount ?? null,
        aliasCount: r.aliasCount ?? null,
        mergeHistoryCount: r.mergeHistoryCount ?? null,
        ignoredSuggestionCount: r.ignoredSuggestionCount ?? null,
        resolutionCount: r.resolutionCount ?? null,
        sceneSuppressionCount: r.sceneSuppressionCount ?? null,
        consumedSignalCount: r.consumedSignalCount ?? null,
        localStorageKey: r.localStorageKey ?? null,
        supabaseTable: r.supabaseTable ?? "projects",
        supabaseField: r.supabaseField ?? "settings.writingCharacterProfiles",
        snapshotPayload: r.snapshotPayload ?? null,
      };

    case "characters":
      return {
        ...base,
        localCharacterCount: r.localCharacterCount ?? null,
        supabaseCharacterCount: r.supabaseCharacterCount ?? null,
        blockedEmptyCharactersSave: r.blockedEmptyCharactersSave ?? null,
        metadataOnly: r.metadataOnly ?? null,
        supabaseTable: "characters",
        proxyAction: r.proxyAction ?? null,
        proxySavedLocalToSupabase: r.proxySavedLocalToSupabase ?? null,
        snapshotPayload: r.snapshotPayload ?? null,
        snapshotNote: r.snapshotPayload
          ? "Full character payload included from Supabase read."
          : "No snapshot payload — metadata only.",
      };

    case "scriptBreakdown":
      return {
        ...base,
        sceneCount: r.sceneCount ?? null,
        taggedItemCount: r.taggedItemCount ?? null,
        scriptRevisionCount: r.scriptRevisionCount ?? null,
        supabaseSceneCount: r.supabaseSceneCount ?? null,
        supabaseTaggedItemCount: r.supabaseTaggedItemCount ?? null,
        metadataOnly: r.metadataOnly ?? null,
        blockedEmptyScriptBreakdownSave: r.blockedEmptyScriptBreakdownSave ?? null,
        supabaseTables: r.supabaseTables ?? "scenes, tagged_items, script_revisions",
        snapshotPayload: r.snapshotPayload ?? null,
      };

    case "projectMetadata":
      return {
        ...base,
        verifiedProjectId: r.projectId ?? null,
        verifiedProjectName: r.projectName ?? null,
        verifiedUserRole: r.userRole ?? null,
        hasProjectId: r.hasProjectId ?? null,
        hasProjectName: r.hasProjectName ?? null,
        snapshotPayload: null,
      };

    case "projectSettings":
      return {
        ...base,
        settingsKeyCount: r.settingsKeyCount ?? null,
        hasWritingCharacterProfiles: r.hasWritingCharacterProfiles ?? null,
        writingCharacterProfileCount: r.writingCharacterProfileCount ?? null,
        hasWritingScriptDraft: r.hasWritingScriptDraft ?? null,
        writingScriptNodeCount: r.writingScriptNodeCount ?? null,
        snapshotPayload: null,
      };

    case "localRecovery":
      return {
        ...base,
        capturedKeyCount: r.capturedKeyCount ?? null,
        currentCacheWritten: r.currentCacheWritten ?? null,
        versionCheckpointCreated: r.versionCheckpointCreated ?? null,
        versionId: r.versionId ?? null,
        reason: r.reason ?? null,
        snapshotPayload: null,
      };

    case "supabaseVerification":
      return {
        ...base,
        writingScriptVerified: r.writingScriptVerified ?? null,
        writingScriptNodeCount: r.writingScriptNodeCount ?? null,
        moodBoardVerified: r.moodBoardVerified ?? null,
        moodBoardBoardCount: r.moodBoardBoardCount ?? null,
        moodBoardImageCount: r.moodBoardImageCount ?? null,
        writingCharactersVerified: r.writingCharactersVerified ?? null,
        writingCharacterProfileCount: r.writingCharacterProfileCount ?? null,
        settingsVerified: r.settingsVerified ?? null,
        snapshotPayload: null,
      };

    default:
      return { ...base, snapshotPayload: null };
  }
}

// ─── upsertProjectModuleSnapshot ─────────────────────────────────────────────
// Writes (or updates) the latest-snapshot row for this (project_id, module_key).
// Uses upsert with onConflict: "project_id,module_key".
// NEVER calls delete().

export async function upsertProjectModuleSnapshot({
  projectId,
  projectName,
  moduleKey,
  moduleLabel,
  payload,
  savedByUserId = null,
  savedByEmail = null,
  source = "saveVerification",
  status = "verified",
}) {
  if (!projectId || !moduleKey) {
    throw new Error(`upsertProjectModuleSnapshot: projectId and moduleKey are required (got ${projectId}, ${moduleKey})`);
  }

  const byteSize = estimateJsonByteSize(payload);
  const payloadHash = stableJsonHash(payload);
  const itemCount = (() => {
    if (!payload) return 0;
    // Use the most meaningful count field available.
    return payload.nodeCount ?? payload.profileCount ?? payload.boardCount ?? payload.capturedKeyCount ?? 0;
  })();
  const savedAt = new Date().toISOString();

  const record = {
    project_id: projectId,
    project_name: projectName ?? null,
    module_key: moduleKey,
    module_label: moduleLabel ?? moduleKey,
    schema_version: SCHEMA_VERSION,
    payload,
    payload_hash: payloadHash,
    item_count: itemCount,
    byte_size: byteSize,
    saved_at: savedAt,
    saved_by_user_id: savedByUserId,
    saved_by_email: savedByEmail,
    source,
    status,
  };

  const { error } = await supabase
    .from("project_module_snapshots")
    .upsert(record, { onConflict: "project_id,module_key" });

  if (error) throw error;
  return { savedAt, payloadHash, byteSize, itemCount };
}

// ─── insertProjectModuleSnapshotVersion ──────────────────────────────────────
// Appends a historical version row. Insert-only — never updates or deletes.

export async function insertProjectModuleSnapshotVersion({
  projectId,
  projectName,
  moduleKey,
  moduleLabel,
  payload,
  savedByUserId = null,
  savedByEmail = null,
  source = "saveVerification",
  status = "verified",
  versionReason = "save_return",
}) {
  if (!projectId || !moduleKey) {
    throw new Error(`insertProjectModuleSnapshotVersion: projectId and moduleKey are required`);
  }

  const byteSize = estimateJsonByteSize(payload);
  const payloadHash = stableJsonHash(payload);
  const itemCount = (() => {
    if (!payload) return 0;
    return payload.nodeCount ?? payload.profileCount ?? payload.boardCount ?? payload.capturedKeyCount ?? 0;
  })();
  const savedAt = new Date().toISOString();

  const record = {
    project_id: projectId,
    project_name: projectName ?? null,
    module_key: moduleKey,
    module_label: moduleLabel ?? moduleKey,
    schema_version: SCHEMA_VERSION,
    payload,
    payload_hash: payloadHash,
    item_count: itemCount,
    byte_size: byteSize,
    saved_at: savedAt,
    saved_by_user_id: savedByUserId,
    saved_by_email: savedByEmail,
    source,
    status,
    version_reason: versionReason,
  };

  const { error } = await supabase
    .from("project_module_snapshot_versions")
    .insert(record);

  if (error) throw error;
  return { savedAt, payloadHash };
}

// ─── insertProjectBackupManifest ─────────────────────────────────────────────
// Records the full flush result summary for a save attempt. Insert-only.

export async function insertProjectBackupManifest({
  projectId,
  projectName,
  savedByUserId = null,
  savedByEmail = null,
  overallStatus,
  complete,
  modules,
  failedModules,
  warnings,
  warningCount,
  localRecoveryStatus = null,
  supabaseVerificationStatus = null,
}) {
  if (!projectId) throw new Error("insertProjectBackupManifest: projectId is required");

  const savedAt = new Date().toISOString();

  const record = {
    project_id: projectId,
    project_name: projectName ?? null,
    saved_at: savedAt,
    saved_by_user_id: savedByUserId,
    saved_by_email: savedByEmail,
    overall_status: overallStatus,
    complete: complete === true,
    modules: modules ?? {},
    failed_modules: failedModules ?? [],
    warnings: warnings ?? [],
    warning_count: warningCount ?? 0,
    local_recovery_status: localRecoveryStatus ?? null,
    supabase_verification_status: supabaseVerificationStatus ?? null,
  };

  const { data, error } = await supabase
    .from("project_backup_manifests")
    .insert(record)
    .select("id")
    .single();

  if (error) throw error;
  return { manifestId: data?.id ?? null, savedAt };
}

// ─── insertProjectLoadAudit ───────────────────────────────────────────────────
// Records a project-open scan summary. Insert-only. Never blocks open on failure.

export async function insertProjectLoadAudit({
  projectId,
  projectName,
  checkedByUserId = null,
  checkedByEmail = null,
  localStatus = null,
  indexeddbStatus = null,
  supabaseStatus = null,
  moduleStatuses = null,
  warnings = [],
  recommendedAction = null,
  requiresUserChoice = false,
}) {
  if (!projectId) throw new Error("insertProjectLoadAudit: projectId is required");

  const checkedAt = new Date().toISOString();

  const record = {
    project_id: projectId,
    project_name: projectName ?? null,
    checked_at: checkedAt,
    checked_by_user_id: checkedByUserId,
    checked_by_email: checkedByEmail,
    local_status: localStatus ?? null,
    indexeddb_status: indexeddbStatus ?? null,
    supabase_status: supabaseStatus ?? null,
    module_statuses: moduleStatuses ?? null,
    warnings: warnings ?? [],
    recommended_action: recommendedAction ?? null,
    requires_user_choice: requiresUserChoice === true,
  };

  const { data, error } = await supabase
    .from("project_load_audits")
    .insert(record)
    .select("id")
    .single();

  if (error) throw error;
  return { auditId: data?.id ?? null, checkedAt };
}

// ─── hasFullSnapshotPayload ───────────────────────────────────────────────────
// Returns true if the built payload contains a genuine full data payload
// (not just metadata). Used to gate upsert of project_module_snapshots so that
// a skipped/no-change module never overwrites a previously full latest snapshot
// with null/empty payload data.
//
// Metadata-only modules (projectMetadata, projectSettings, localRecovery,
// supabaseVerification) return true unconditionally because they NEVER carry
// a data payload — they are verification rows, not data rows, so writing them
// does not risk replacing real user data.

export function hasFullSnapshotPayload(moduleKey, flushResult) {
  const r = flushResult || {};

  switch (moduleKey) {
    case "writingScript":
      // Full if snapshotPayload is present and has a nodes array.
      return (
        r.snapshotPayload != null &&
        Array.isArray(r.snapshotPayload.nodes)
      );

    case "moodBoard":
      // Full if snapshotPayload is present and has at least one data array.
      return (
        r.snapshotPayload != null &&
        (
          Array.isArray(r.snapshotPayload.boards) ||
          Array.isArray(r.snapshotPayload.images) ||
          Array.isArray(r.snapshotPayload.links) ||
          Array.isArray(r.snapshotPayload.canvas_items)
        )
      );

    case "writingCharacters":
      // Full if snapshotPayload is present and has writingCharacterProfiles object.
      return (
        r.snapshotPayload != null &&
        r.snapshotPayload.writingCharacterProfiles != null &&
        typeof r.snapshotPayload.writingCharacterProfiles === "object"
      );

    case "characters":
      // Full if snapshotPayload is present and has a characters array.
      return (
        r.snapshotPayload != null &&
        Array.isArray(r.snapshotPayload.characters)
      );

    case "scriptBreakdown":
      // Full if snapshotPayload is present and has a scenes array.
      return (
        r.snapshotPayload != null &&
        Array.isArray(r.snapshotPayload.scenes)
      );

    case "projectMetadata":
    case "projectSettings":
    case "localRecovery":
    case "supabaseVerification":
      // These are always metadata/verification rows — never carry full data payloads.
      // Treat as "full" so they are always written (they cannot replace data payloads).
      return true;

    default:
      // Unknown module — assume metadata-only, allow write.
      return true;
  }
}

// ─── writeAllModuleSnapshots ──────────────────────────────────────────────────
// Writes both the latest snapshot (upsert) and a version entry (insert) for
// every module in the provided results array that is registered and clean
// AND has a full payload.
//
// Modules that are skipped/no-payload are tracked in skippedSnapshots and
// included in the manifest but DO NOT upsert project_module_snapshots —
// this prevents a null-payload row from overwriting a previously full snapshot.
//
// Returns { successes, failures, skippedSnapshots }.
// Never calls delete(). Failures are collected and returned, not thrown.

export async function writeAllModuleSnapshots({
  flushResults,
  projectId,
  projectName,
  savedByUserId,
  savedByEmail,
  versionReason = "save_return",
}) {
  const successes = [];
  const failures = [];
  const skippedSnapshots = [];

  for (const r of flushResults) {
    if (!r || !r.key) continue;

    // Only process registered modules that are clean (verified or skipped).
    const isClean =
      (r.status === "success" && !r.localOnly && !r.errorMessage) ||
      r.status === "skipped";
    if (!isClean) continue;

    const moduleKey = r.key;
    const moduleLabel = r.label ?? moduleKey;

    // If the module was skipped (no changes) and has no full payload,
    // do not upsert the latest snapshot. Record in skippedSnapshots for manifest.
    if (r.status === "skipped" && !hasFullSnapshotPayload(moduleKey, r)) {
      skippedSnapshots.push({
        moduleKey,
        reason: "skipped-no-payload",
      });
      continue;
    }

    // If the module saved successfully but somehow has no full payload
    // for a data module, skip the snapshot write to avoid overwriting
    // a previous full cloud snapshot with null/empty data.
    if (r.status === "success" && !hasFullSnapshotPayload(moduleKey, r)) {
      skippedSnapshots.push({
        moduleKey,
        reason: "success-no-payload",
      });
      continue;
    }

    const payload = buildModuleSnapshotPayload(moduleKey, moduleLabel, r, {
      projectId,
      projectName,
      savedByUserId,
      savedByEmail,
      source: "saveVerification",
    });

    const status = r.status === "skipped" ? "skipped" : "verified";

    try {
      const upsertResult = await upsertProjectModuleSnapshot({
        projectId,
        projectName,
        moduleKey,
        moduleLabel,
        payload,
        savedByUserId,
        savedByEmail,
        source: "saveVerification",
        status,
      });

      // Insert a version only for modules with full payloads and non-skipped status.
      // Skipped-but-full-payload modules get a latest upsert but no version insert
      // (nothing changed, no new version needed).
      if (r.status !== "skipped") {
        await insertProjectModuleSnapshotVersion({
          projectId,
          projectName,
          moduleKey,
          moduleLabel,
          payload,
          savedByUserId,
          savedByEmail,
          source: "saveVerification",
          status,
          versionReason,
        });
      }

      successes.push({ moduleKey, ...upsertResult });
    } catch (err) {
      failures.push({ moduleKey, error: err?.message ?? "unknown error" });
    }
  }

  return { successes, failures, skippedSnapshots };
}
