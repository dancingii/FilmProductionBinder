// ProjectModuleSyncContext — always-mounted sync controllers for risky modules.
//
// ─── Architecture: System 1 — Supabase DB Sync ───────────────────────────────
//
//   This context is part of System 1 (Supabase DB Sync / Exit Verification).
//   It ensures pending module writes reach Supabase before Save/Return proceeds.
//
//   Responsibility:
//     • Own debounce timers and active-save promises for Writing Script + MoodBoard.
//     • Serialize same-project writes to prevent read-modify-write races.
//     • Register sync barriers with ModuleSyncBarrierContext so Save/Return can
//       wait for pending writes before running flush handlers.
//     • Initialize the Writing Script empty-overwrite guard from Supabase on open.
//
//   NOT responsible for:
//     • Emergency backup creation or restoration.
//     • Marking project exit clean based on local/IDB fallback success.
//     • IndexedDB cache management (that is ActiveProjectMirror / ProjectCacheService).
//     • Backup manifests or Supabase audit snapshots.
//
// ─── Two-system architecture ──────────────────────────────────────────────────
//
//   System 1 — Supabase DB Sync / Exit Verification
//     Modules sync continuously during editing. Save/Return:
//       1. Waits for pending syncs via ModuleSyncBarrierContext barriers.
//       2. Runs flush handlers to verify Supabase DB is current.
//       3. If clean: clears localStorage working mirror, allows Return.
//       4. If not clean: preserves localStorage, creates emergency backup, blocks Return.
//
//   System 2 — Emergency Backup / Restore
//     Safety net only. Triggered when Supabase verification fails or user is offline.
//     Never marks exit clean. Never clears localStorage independently.
//     Managed by emergencyBackupStore.js + AuthWrapper banner + ProjectRecoveryModal.
//
//   IndexedDB Project Cache (ActiveProjectMirror)
//     • Stores working localStorage mirror per project for fast hydration on open.
//     • Supabase decides freshness; IDB is the local cache, not the source of truth.
//     • Managed by projectCacheManager.js.
//
// ─── PURPOSE ──────────────────────────────────────────────────────────────────
//   WritingScript.jsx and MoodBoard.js unmount when the user switches between
//   writing and production workflows. Any pending debounce timer inside those
//   components is lost on unmount, meaning edits made before switching workflows
//   could never reach Supabase — not even at Save/Return time.
//
//   This context lives outside the conditionally-mounted workflow UIs. It owns:
//     • the debounce timer
//     • the latest pending record (project-scoped, immutable at capture time)
//     • the active save promise (deduplication guard)
//     • the sync barrier registration
//     • local/IDB fallback on Supabase failure
//     • save status for UI display
//     • controller initialization from durable sources on project open
//
// PENDING RECORD — immutable project identity
//   Every markDirty call captures the project at the moment of the edit:
//
//   Writing Script record:
//     { projectId, projectName, project, nodes, savedAt, source, knownNonEmpty }
//
//   MoodBoard record:
//     { projectId, projectName, project, supabasePayload, localPayload, savedAt, source }
//
//   Flush functions receive the record explicitly and write to record.projectId —
//   never to projectRef.current (which is mutable and may already point at a new
//   project by the time the effect or timer fires).
//
// ACTIVE SAVE DEDUPLICATION
//   wsActiveSave / mbActiveSave track the in-flight save promise and the record
//   it is saving. If wsFlushRecord is called for a record that is already being
//   saved, it returns the existing promise instead of starting a second Supabase
//   write. This prevents the "timer already exists" console warnings from
//   writingDraftPersistence when debounce and Save/Return both flush simultaneously.
//
// CONTROLLER INITIALIZATION
//   On project open, the provider reads Supabase (then IDB/local marker fallback)
//   to determine whether the current project has known non-empty script data. This
//   ensures the empty-overwrite guard works even if WritingScript.jsx never mounts.
//
// CONTROLLER SHAPE (returned by useWritingScriptSync / useMoodBoardSync)
//   {
//     markDirty(nodesOrPayload),           — call on every content change
//     flushNow(reason),                    — immediate save, returns Promise<result>
//     initializeFromLoad(nodes, source),   — (WS) supplement guard from component load
//     getStatus(),                         — returns SyncStatus
//     statusRef,                           — ref mirror of status for closures
//   }
//
// SYNCSTATUS SHAPE
//   {
//     state: "idle"|"dirty"|"syncing"|"offlineQueued"|"failed"|"initializing",
//     lastLocalSavedAt: string|null,
//     lastSupabaseSavedAt: string|null,
//     lastError: string|null,
//   }

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import {
  saveWritingDraftSafely,
  loadWritingDraftFromDatabaseOnly,
  loadWritingDraftFromIndexedDbByKey,
  getWritingDraftStorageKey,
} from "../components/modules/WritingScript/writingDraftPersistence";
import { supabase } from "../supabase";
import { useModuleSyncBarrier } from "./ModuleSyncBarrierContext";

const WRITING_SCRIPT_DEBOUNCE_MS = 1500;
const MOODBOARD_DEBOUNCE_MS = 2000;
const MOODBOARD_STORAGE_KEY_PREFIX = "filmProductionBinder:moodboard:";

const ProjectModuleSyncContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — immutable pending record factories
// ─────────────────────────────────────────────────────────────────────────────

function makeWsRecord(project, nodes, source, knownNonEmpty) {
  return Object.freeze({
    projectId: project.id,
    projectName: project.name ?? project.id,
    project,
    nodes: Array.isArray(nodes) ? nodes : [],
    savedAt: new Date().toISOString(),
    source,
    knownNonEmpty: Boolean(knownNonEmpty),
  });
}

function makeMbRecord(project, supabasePayload, localPayload, source) {
  return Object.freeze({
    projectId: project.id,
    projectName: project.name ?? project.id,
    project,
    supabasePayload,
    localPayload,
    savedAt: new Date().toISOString(),
    source,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function ProjectModuleSyncProvider({ selectedProject, children, onProjectDirty, onProjectSynced }) {
  // onProjectDirty(source) — called when markDirty runs (local change started).
  // onProjectSynced(source) — called after a successful Supabase flush (touches project_sync_status).
  // Provided by AuthWrapper; default to no-ops so context works standalone.
  // projectRef/projectIdRef — used only to create NEW records at markDirty time
  // or read current active project for status. Never used as flush target for
  // existing records (records carry their own immutable project identity).
  const projectIdRef = useRef(selectedProject?.id ?? null);
  const projectRef = useRef(selectedProject ?? null);
  projectIdRef.current = selectedProject?.id ?? null;
  projectRef.current = selectedProject ?? null;

  // Stable refs for the dirty/synced callbacks so closures always call the latest version.
  const onProjectDirtyRef = useRef(onProjectDirty ?? null);
  const onProjectSyncedRef = useRef(onProjectSynced ?? null);
  onProjectDirtyRef.current = onProjectDirty ?? null;
  onProjectSyncedRef.current = onProjectSynced ?? null;

  const { registerSyncBarrier } = useModuleSyncBarrier();

  // ── Writing Script status ──────────────────────────────────────────────────
  const [writingScriptStatus, setWritingScriptStatus] = useState({
    state: "initializing",
    lastLocalSavedAt: null,
    lastSupabaseSavedAt: null,
    lastError: null,
  });
  const writingScriptStatusRef = useRef(writingScriptStatus);
  useEffect(() => { writingScriptStatusRef.current = writingScriptStatus; }, [writingScriptStatus]);

  // Latest pending WS record — immutable, carries project identity.
  const wsPendingRecordRef = useRef(null);
  // Active save tracking — { record, promise, reason, startedAt } | null
  // Deduplication: if flushRecord is called for a record already being saved,
  // return the existing promise instead of starting a second Supabase write.
  const wsActiveSaveRef = useRef(null);
  const wsTimerRef = useRef(null);
  const wsSequenceRef = useRef(0);
  // Init state: { initialized, knownNonEmpty, knownNodeCount, source, initializedAt } | null
  const wsInitStateRef = useRef(null);
  const wsProjectIdRef = useRef(null);

  // ── MoodBoard status ───────────────────────────────────────────────────────
  const [moodBoardStatus, setMoodBoardStatus] = useState({
    state: "idle",
    lastLocalSavedAt: null,
    lastSupabaseSavedAt: null,
    lastError: null,
  });
  const moodBoardStatusRef = useRef(moodBoardStatus);
  useEffect(() => { moodBoardStatusRef.current = moodBoardStatus; }, [moodBoardStatus]);

  // Latest pending MB record.
  const mbPendingRecordRef = useRef(null);
  // Active save tracking — { record, promise, reason, startedAt } | null
  const mbActiveSaveRef = useRef(null);
  const mbTimerRef = useRef(null);
  const mbProjectIdRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Writing Script — wsFlushRecord
  //
  // Accepts an explicit immutable record. Never reads projectRef.current as the
  // write target.
  //
  // SERIALIZATION: saveWritingDraftSafely does a read-modify-write on
  // projects.settings. Two concurrent writes for the same project can interleave:
  // both read the same settings, then one overwrites the other. To prevent this,
  // if an active save is already running for the same projectId, the newer record
  // is chained to run AFTER the active save completes — not concurrently.
  //
  // Same-record deduplication (existing): if the same record object is being saved,
  // return the existing promise (no second Supabase call for identical content).
  // ─────────────────────────────────────────────────────────────────────────────
  const wsFlushRecord = useCallback(async (record, reason = "flush") => {
    if (!record) {
      console.warn(`[WritingScriptSync] flushRecord(${reason}): no record — skipped`);
      return { storage: "skipped", localOnly: true, skippedReason: "no-record" };
    }
    if (!record.projectId) {
      console.warn(`[WritingScriptSync] flushRecord(${reason}): record has no projectId — blocked`);
      return { storage: "blocked", localOnly: true, skippedReason: "no-project-id" };
    }

    const active = wsActiveSaveRef.current;

    // ── Same-record deduplication ────────────────────────────────────────────
    // If the identical record object is already being saved, return the active
    // promise. No second Supabase call for the same content.
    if (active && active.record === record) {
      console.info(
        `[WritingScriptSync] flush deduped — awaiting active save, ` +
        `projectId=${record.projectId}, reason=${reason}, activeReason=${active.reason}, ` +
        `recordSavedAt=${record.savedAt}`
      );
      return active.promise;
    }

    // ── Same-project serialization ───────────────────────────────────────────
    // A different (presumably older) record for the SAME project is actively
    // saving. saveWritingDraftSafely does a read-modify-write on projects.settings:
    // starting a second concurrent write would race with the active one and the
    // older write could finish last, clobbering the newer content.
    //
    // Solution: await the active save, then re-read wsPendingRecordRef to get
    // the newest record (which may have been updated again while waiting), and
    // flush that newest record instead.
    if (active && active.record.projectId === record.projectId) {
      console.info(
        `[WritingScriptSync] flush serialized — same project active save running, ` +
        `will flush newest record after active save completes. ` +
        `activeRecordSavedAt=${active.record.savedAt}, ` +
        `requestedRecordSavedAt=${record.savedAt}, ` +
        `projectId=${record.projectId}, reason=${reason}`
      );
      // Await the active save to completion (it uses its own frozen record — safe).
      await active.promise;
      // Re-read the latest pending record — may be newer than `record` if more
      // markDirty calls arrived while we were waiting.
      const newestRecord = wsPendingRecordRef.current;
      if (!newestRecord) {
        // The pending record was already flushed (e.g., debounce timer ran and
        // cleared it) or there is nothing left to flush.
        console.info(
          `[WritingScriptSync] serialized flush: no pending record after active save — ` +
          `projectId=${record.projectId}`
        );
        return { storage: "skipped", localOnly: false, skippedReason: "no-pending-record-after-serialize" };
      }
      if (newestRecord !== record) {
        console.info(
          `[WritingScriptSync] serialized flush: flushing newest record (not original request) — ` +
          `originalSavedAt=${record.savedAt}, newestSavedAt=${newestRecord.savedAt}, ` +
          `projectId=${record.projectId}, reason=${reason}`
        );
      }
      // Recurse with the newest record. Any same-project active save that started
      // during our await will be caught by this same guard again.
      return wsFlushRecord(newestRecord, reason);
    }

    const nodes = record.nodes;
    const isSameProject = projectIdRef.current === record.projectId;

    // Empty-overwrite guard.
    if (Array.isArray(nodes) && nodes.length === 0) {
      const initKnownNonEmpty = wsInitStateRef.current?.knownNonEmpty === true;
      const recordKnownNonEmpty = record.knownNonEmpty === true;
      if (initKnownNonEmpty || recordKnownNonEmpty) {
        console.warn(
          `[WritingScriptSync] flushRecord(${reason}): blocked empty-overwrite — ` +
          `initKnownNonEmpty=${initKnownNonEmpty}, recordKnownNonEmpty=${recordKnownNonEmpty}, ` +
          `projectId=${record.projectId}, recordSavedAt=${record.savedAt}`
        );
        return { storage: "blocked", blockedEmptySave: true, localOnly: true };
      }
    }

    const sequence = wsSequenceRef.current + 1;
    wsSequenceRef.current = sequence;

    console.info(
      `[WritingScriptSync] flush started — reason=${reason}, nodes=${nodes.length}, ` +
      `recordProjectId=${record.projectId}, currentProjectId=${projectIdRef.current}, ` +
      `sameProject=${isSameProject}, recordSavedAt=${record.savedAt}`
    );

    if (!isSameProject) {
      console.warn(
        `[WritingScriptSync] flush for old project ${record.projectId} — ` +
        `current project is ${projectIdRef.current}. Writing to old project only.`
      );
    }

    if (isSameProject) {
      setWritingScriptStatus(prev => ({ ...prev, state: "syncing" }));
    }

    // Build the save promise and register it in wsActiveSaveRef for deduplication.
    const savePromise = (async () => {
      let result;
      try {
        result = await saveWritingDraftSafely(record.project, nodes);
      } catch (err) {
        if (wsSequenceRef.current !== sequence) return { storage: "cancelled" };
        console.warn(
          `[WritingScriptSync] flush failed — reason=${reason}, projectId=${record.projectId}, ` +
          `recordSavedAt=${record.savedAt}:`, err?.message
        );
        if (isSameProject) {
          setWritingScriptStatus(prev => ({
            ...prev,
            state: "failed",
            lastError: err?.message ?? "unknown",
          }));
        }
        return { storage: "error", localOnly: true, error: err };
      }

      if (wsSequenceRef.current !== sequence) return { storage: "cancelled" };

      const isDb = result?.storage === "database";
      const now = new Date().toISOString();

      console.info(
        `[WritingScriptSync] flush completed — reason=${reason}, storage=${result?.storage}, ` +
        `projectId=${record.projectId}, recordSavedAt=${record.savedAt}`
      );

      if (isSameProject) {
        setWritingScriptStatus(prev => ({
          ...prev,
          state: isDb ? "idle" : "offlineQueued",
          lastLocalSavedAt: now,
          lastSupabaseSavedAt: isDb ? now : prev.lastSupabaseSavedAt,
          lastError: isDb ? null : (result?.databaseError?.message ?? "Supabase unavailable"),
        }));
      }
      if (isDb && isSameProject) {
        // Await the marker touch so project_sync_status is written before
        // awaitAllBarriersIdle resolves and the exit gate reads the table.
        await onProjectSyncedRef.current?.("writingScript");
      }
      return result;
    })();

    // Register this as the active save.
    wsActiveSaveRef.current = { record, promise: savePromise, reason, startedAt: new Date().toISOString() };

    const finalResult = await savePromise;

    // Clear active save only if it still refers to this save (not a newer one).
    if (wsActiveSaveRef.current?.record === record) {
      wsActiveSaveRef.current = null;
      console.info(
        `[WritingScriptSync] active save cleared — projectId=${record.projectId}, ` +
        `storage=${finalResult?.storage}, recordSavedAt=${record.savedAt}`
      );
    }

    return finalResult;
  }, []);

  // Public wsFlushNow — flushes the current pending record or checks init state.
  const wsFlushNow = useCallback(async (reason = "flush") => {
    const record = wsPendingRecordRef.current;
    const active = wsActiveSaveRef.current;

    // No pending record.
    if (!record) {
      // If there is an active save (e.g., debounce fired and completed clearing
      // wsPendingRecordRef but wsActiveSaveRef is still resolving), await it.
      if (active) {
        console.info(
          `[WritingScriptSync] flushNow(${reason}): no pending record but active save running — ` +
          `awaiting active save for projectId=${active.record?.projectId}, activeReason=${active.reason}`
        );
        return active.promise;
      }

      const init = wsInitStateRef.current;
      if (!init || !init.initialized) {
        console.warn(
          `[WritingScriptSync] flushNow(${reason}): controller not initialized — ` +
          `blocked-uninitialized, projectId=${projectIdRef.current}`
        );
        return { storage: "blocked", localOnly: true, skippedReason: "uninitialized" };
      }
      console.info(
        `[WritingScriptSync] flushNow(${reason}): no pending record — idle, no save attempted ` +
        `(knownNonEmpty=${init.knownNonEmpty}, projectId=${projectIdRef.current})`
      );
      return { storage: "skipped", localOnly: false, skippedReason: "no-pending-record" };
    }

    return wsFlushRecord(record, reason);
  }, [wsFlushRecord]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MoodBoard — mbFlushRecord
  //
  // Same-record deduplication + same-project serialization (see wsFlushRecord).
  // MoodBoard upserts a single row by project_id — concurrent writes race on
  // that row (last write wins without ordering guarantees). Serialization ensures
  // only the newest record reaches Supabase.
  // ─────────────────────────────────────────────────────────────────────────────
  const mbFlushRecord = useCallback(async (record, reason = "flush") => {
    if (!record) {
      console.info(`[MoodBoardSync] flushRecord(${reason}): no record — idle`);
      return { ok: true, reason: "no-record" };
    }
    if (!record.projectId) {
      console.warn(`[MoodBoardSync] flushRecord(${reason}): record has no projectId — blocked`);
      return { ok: false, reason: "no-project-id" };
    }

    const active = mbActiveSaveRef.current;

    // ── Same-record deduplication ────────────────────────────────────────────
    if (active && active.record === record) {
      console.info(
        `[MoodBoardSync] flush deduped — awaiting active save, ` +
        `projectId=${record.projectId}, reason=${reason}, activeReason=${active.reason}, ` +
        `recordSavedAt=${record.savedAt}`
      );
      return active.promise;
    }

    // ── Same-project serialization ───────────────────────────────────────────
    if (active && active.record.projectId === record.projectId) {
      console.info(
        `[MoodBoardSync] flush serialized — same project active save running, ` +
        `will flush newest record after active save completes. ` +
        `activeRecordSavedAt=${active.record.savedAt}, ` +
        `requestedRecordSavedAt=${record.savedAt}, ` +
        `projectId=${record.projectId}, reason=${reason}`
      );
      await active.promise;
      const newestRecord = mbPendingRecordRef.current;
      if (!newestRecord) {
        console.info(
          `[MoodBoardSync] serialized flush: no pending record after active save — ` +
          `projectId=${record.projectId}`
        );
        return { ok: true, reason: "no-pending-record-after-serialize" };
      }
      if (newestRecord !== record) {
        console.info(
          `[MoodBoardSync] serialized flush: flushing newest record (not original request) — ` +
          `originalSavedAt=${record.savedAt}, newestSavedAt=${newestRecord.savedAt}, ` +
          `projectId=${record.projectId}, reason=${reason}`
        );
      }
      return mbFlushRecord(newestRecord, reason);
    }

    const isSameProject = projectIdRef.current === record.projectId;

    // Write localStorage using record's projectId — not current project.
    if (record.localPayload) {
      const storageKey = `${MOODBOARD_STORAGE_KEY_PREFIX}${record.projectId}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(record.localPayload));
        console.info(
          `[MoodBoardSync] localStorage written — projectId=${record.projectId}, reason=${reason}`
        );
      } catch {}
    }

    console.info(
      `[MoodBoardSync] flush started — reason=${reason}, recordProjectId=${record.projectId}, ` +
      `currentProjectId=${projectIdRef.current}, sameProject=${isSameProject}, ` +
      `recordSavedAt=${record.savedAt}`
    );

    if (!isSameProject) {
      console.warn(
        `[MoodBoardSync] flush for old project ${record.projectId} — ` +
        `current project is ${projectIdRef.current}. Writing to old project only.`
      );
    }

    if (isSameProject) {
      setMoodBoardStatus(prev => ({ ...prev, state: "syncing" }));
    }

    const payload = record.supabasePayload;

    const savePromise = (async () => {
      try {
        const { error } = await supabase.from("moodboard_data").upsert({
          project_id: record.projectId,
          active_board_id: payload.activeBoardId,
          boards: payload.boards,
          links: payload.links,
          images: payload.images,
          canvas_items: payload.canvasItems,
          zoom: payload.zoom,
          show_grid: payload.showGrid,
          updated_at: new Date().toISOString(),
        }, { onConflict: "project_id" });

        if (error) throw error;

        const now = new Date().toISOString();
        console.info(
          `[MoodBoardSync] flush completed — reason=${reason}, projectId=${record.projectId}, ` +
          `recordSavedAt=${record.savedAt}`
        );
        if (isSameProject) {
          setMoodBoardStatus(prev => ({
            ...prev,
            state: "idle",
            lastLocalSavedAt: now,
            lastSupabaseSavedAt: now,
            lastError: null,
          }));
          // Await the marker touch so project_sync_status is written before
          // awaitAllBarriersIdle resolves and the exit gate reads the table.
          await onProjectSyncedRef.current?.("moodBoard");
        }
        return { ok: true };
      } catch (err) {
        console.warn(
          `[MoodBoardSync] flush failed — reason=${reason}, projectId=${record.projectId}, ` +
          `recordSavedAt=${record.savedAt}:`, err?.message
        );
        if (isSameProject) {
          setMoodBoardStatus(prev => ({
            ...prev,
            state: "offlineQueued",
            lastLocalSavedAt: prev.lastLocalSavedAt ?? new Date().toISOString(),
            lastError: err?.message ?? "unknown",
          }));
        }
        return { ok: false, reason: err?.message ?? "db-error", error: err };
      }
    })();

    mbActiveSaveRef.current = { record, promise: savePromise, reason, startedAt: new Date().toISOString() };

    const finalResult = await savePromise;

    if (mbActiveSaveRef.current?.record === record) {
      mbActiveSaveRef.current = null;
      console.info(
        `[MoodBoardSync] active save cleared — projectId=${record.projectId}, ` +
        `ok=${finalResult?.ok}, recordSavedAt=${record.savedAt}`
      );
    }

    return finalResult;
  }, []);

  // Public mbFlushNow.
  const mbFlushNow = useCallback(async (reason = "flush") => {
    const record = mbPendingRecordRef.current;
    const active = mbActiveSaveRef.current;
    if (!record) {
      if (active) {
        console.info(
          `[MoodBoardSync] flushNow(${reason}): no pending record but active save running — ` +
          `awaiting active save for projectId=${active.record?.projectId}`
        );
        return active.promise;
      }
      console.info(`[MoodBoardSync] flushNow(${reason}): no pending record — idle, no save attempted`);
      return { ok: true, reason: "no-pending-record" };
    }
    return mbFlushRecord(record, reason);
  }, [mbFlushRecord]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Writing Script — wsInitializeForProject
  // Reads Supabase then IDB/local fallback to seed the empty-overwrite guard.
  // Called on project open so the guard works even if WritingScript.jsx never mounts.
  // ─────────────────────────────────────────────────────────────────────────────
  const wsInitializeForProject = useCallback(async (project) => {
    if (!project?.id) return;

    console.info(
      `[WritingScriptSync] initializing controller — projectId=${project.id}`
    );
    setWritingScriptStatus(prev => ({ ...prev, state: "initializing" }));

    // Step 1: Supabase.
    try {
      const dbDraft = await loadWritingDraftFromDatabaseOnly(project);
      const dbNodes = Array.isArray(dbDraft?.nodes) ? dbDraft.nodes : [];
      const knownNonEmpty = dbNodes.length > 0;
      wsInitStateRef.current = {
        initialized: true,
        knownNonEmpty,
        knownNodeCount: dbNodes.length,
        source: "database",
        initializedAt: new Date().toISOString(),
      };
      console.info(
        `[WritingScriptSync] initialized from Supabase — projectId=${project.id}, ` +
        `nodes=${dbNodes.length}, knownNonEmpty=${knownNonEmpty}`
      );
      setWritingScriptStatus(prev => ({ ...prev, state: "idle" }));
      return;
    } catch (dbErr) {
      console.warn(
        `[WritingScriptSync] Supabase init failed for projectId=${project.id}: ` +
        `${dbErr?.message}. Falling back to IDB/local marker.`
      );
    }

    // Step 2: IDB/local marker fallback.
    try {
      const lsKey = getWritingDraftStorageKey(project);
      const rawMarker = typeof localStorage !== "undefined" ? localStorage.getItem(lsKey) : null;
      let idbNodes = null;
      if (rawMarker) {
        const parsedMarker = JSON.parse(rawMarker);
        if (parsedMarker?.storage === "indexedDB" && parsedMarker?.indexedDbKey) {
          const idbDraft = await loadWritingDraftFromIndexedDbByKey(project, parsedMarker.indexedDbKey);
          idbNodes = Array.isArray(idbDraft?.nodes) ? idbDraft.nodes : null;
        } else if (parsedMarker?.nodeCount > 0) {
          idbNodes = new Array(parsedMarker.nodeCount);
        }
      }
      const knownNonEmpty = Array.isArray(idbNodes) && idbNodes.length > 0;
      wsInitStateRef.current = {
        initialized: true,
        knownNonEmpty,
        knownNodeCount: idbNodes?.length ?? 0,
        source: idbNodes ? "indexedDB" : "empty",
        initializedAt: new Date().toISOString(),
      };
      console.info(
        `[WritingScriptSync] initialized from IDB/local — projectId=${project.id}, ` +
        `knownNonEmpty=${knownNonEmpty}, source=${wsInitStateRef.current.source}`
      );
    } catch (idbErr) {
      console.warn(
        `[WritingScriptSync] IDB/local init also failed for projectId=${project.id}: ` +
        `${idbErr?.message}. Controller marked initialization-failed.`
      );
      wsInitStateRef.current = {
        initialized: false,
        knownNonEmpty: false,
        knownNodeCount: 0,
        source: "error",
        initializedAt: new Date().toISOString(),
        error: idbErr?.message,
      };
    }

    setWritingScriptStatus(prev => ({
      ...prev,
      state: wsInitStateRef.current?.initialized ? "idle" : "failed",
    }));
  }, []);

  // ─── Reset on project change ─────────────────────────────────────────────────
  useEffect(() => {
    const nextId = selectedProject?.id ?? null;
    const nextProject = selectedProject ?? null;

    // ── Writing Script reset ─────────────────────────────────────────────────
    if (wsProjectIdRef.current !== null && wsProjectIdRef.current !== nextId) {
      const oldProjectId = wsProjectIdRef.current;
      const oldRecord = wsPendingRecordRef.current;
      const oldActive = wsActiveSaveRef.current;

      console.info(
        `[WritingScriptSync] Project changed ${oldProjectId} → ${nextId}. ` +
        `Record-based non-destructive reset.`
      );

      clearTimeout(wsTimerRef.current);
      wsTimerRef.current = null;

      if (oldRecord) {
        console.warn(
          `[WritingScriptSync] reset: pending record for projectId=${oldRecord.projectId} — ` +
          `flushing old record before clearing`
        );
        wsPendingRecordRef.current = null;
        // Flush uses oldRecord.project (frozen) — not projectRef.current.
        wsFlushRecord(oldRecord, "pre-reset").then((result) => {
          console.info(
            `[WritingScriptSync] pre-reset flush for old projectId=${oldRecord.projectId} ` +
            `completed — storage=${result?.storage}, recordSavedAt=${oldRecord.savedAt}`
          );
        }).catch((err) => {
          console.warn(
            `[WritingScriptSync] pre-reset flush for old projectId=${oldRecord.projectId} ` +
            `threw: ${err?.message}`
          );
        });
      } else if (oldActive) {
        // Active save was running but pending record was already consumed.
        // Let it complete naturally — it uses oldActive.record (frozen).
        console.info(
          `[WritingScriptSync] reset: no pending record but active save still running for ` +
          `projectId=${oldActive.record?.projectId} — letting it complete`
        );
        wsPendingRecordRef.current = null;
      } else {
        console.info(
          `[WritingScriptSync] reset: no pending record, no active save for ` +
          `old projectId=${oldProjectId} — clean reset`
        );
        wsPendingRecordRef.current = null;
      }

      wsInitStateRef.current = null;
      wsSequenceRef.current = 0;
      // wsActiveSaveRef is NOT cleared — the active save may still be running and
      // uses the frozen old record. It will clear itself when it completes.
    }
    wsProjectIdRef.current = nextId;

    // ── MoodBoard reset ──────────────────────────────────────────────────────
    if (mbProjectIdRef.current !== null && mbProjectIdRef.current !== nextId) {
      const oldMbId = mbProjectIdRef.current;
      const oldMbRecord = mbPendingRecordRef.current;
      const oldMbActive = mbActiveSaveRef.current;

      console.info(
        `[MoodBoardSync] Project changed ${oldMbId} → ${nextId}. ` +
        `Record-based non-destructive reset.`
      );

      clearTimeout(mbTimerRef.current);
      mbTimerRef.current = null;

      if (oldMbRecord) {
        console.warn(
          `[MoodBoardSync] reset: pending record for projectId=${oldMbRecord.projectId} — ` +
          `flushing old record before clearing`
        );
        mbPendingRecordRef.current = null;
        mbFlushRecord(oldMbRecord, "pre-reset").then((result) => {
          console.info(
            `[MoodBoardSync] pre-reset flush for old projectId=${oldMbRecord.projectId} ` +
            `completed — ok=${result?.ok}, recordSavedAt=${oldMbRecord.savedAt}`
          );
        }).catch((err) => {
          console.warn(
            `[MoodBoardSync] pre-reset flush for old projectId=${oldMbRecord.projectId} ` +
            `threw: ${err?.message}`
          );
        });
      } else if (oldMbActive) {
        console.info(
          `[MoodBoardSync] reset: no pending record but active save still running for ` +
          `projectId=${oldMbActive.record?.projectId} — letting it complete`
        );
        mbPendingRecordRef.current = null;
      } else {
        console.info(
          `[MoodBoardSync] reset: no pending record, no active save for ` +
          `old projectId=${oldMbId} — clean reset`
        );
        mbPendingRecordRef.current = null;
      }
      // mbActiveSaveRef NOT cleared — same reasoning as WS.
    }
    mbProjectIdRef.current = nextId;

    // Reset UI status for new project and initialize.
    if (nextId !== null) {
      setWritingScriptStatus({ state: "initializing", lastLocalSavedAt: null, lastSupabaseSavedAt: null, lastError: null });
      setMoodBoardStatus({ state: "idle", lastLocalSavedAt: null, lastSupabaseSavedAt: null, lastError: null });
      if (nextProject) {
        wsInitializeForProject(nextProject);
      }
    }
  }, [selectedProject?.id, wsFlushRecord, mbFlushRecord, wsInitializeForProject]);

  // Cleanup on unmount — cancel timers only. No async Supabase work.
  useEffect(() => {
    return () => {
      const pendingWs = wsPendingRecordRef.current;
      const pendingMb = mbPendingRecordRef.current;
      const activeWs = wsActiveSaveRef.current;
      const activeMb = mbActiveSaveRef.current;

      if (wsTimerRef.current != null || pendingWs) {
        console.warn(
          `[WritingScriptSync] unmount with pending data — ` +
          `projectId=${pendingWs?.projectId ?? wsProjectIdRef.current}, ` +
          `pendingRecord=${!!pendingWs}, timerActive=${wsTimerRef.current != null}. ` +
          `Timer cancelled. Primary safety is Save/Return barrier. ` +
          `No async Supabase work started from unmount cleanup.`
        );
      }
      if (activeWs) {
        console.info(
          `[WritingScriptSync] unmount: active save still running for ` +
          `projectId=${activeWs.record?.projectId}, recordSavedAt=${activeWs.record?.savedAt}. ` +
          `It uses frozen record — not projectRef.current.`
        );
      }
      clearTimeout(wsTimerRef.current);
      wsTimerRef.current = null;

      if (mbTimerRef.current != null || pendingMb) {
        console.warn(
          `[MoodBoardSync] unmount with pending data — ` +
          `projectId=${pendingMb?.projectId ?? mbProjectIdRef.current}, ` +
          `pendingRecord=${!!pendingMb}, timerActive=${mbTimerRef.current != null}. ` +
          `Timer cancelled. Data is in localStorage from synchronous markDirty writes. ` +
          `No async Supabase work started from unmount cleanup.`
        );
      }
      if (activeMb) {
        console.info(
          `[MoodBoardSync] unmount: active save still running for ` +
          `projectId=${activeMb.record?.projectId}.`
        );
      }
      clearTimeout(mbTimerRef.current);
      mbTimerRef.current = null;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Writing Script — markDirty
  // ─────────────────────────────────────────────────────────────────────────────
  const wsMarkDirty = useCallback((nodes) => {
    const project = projectRef.current;
    if (!project?.id) return;

    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const knownNonEmpty = wsInitStateRef.current?.knownNonEmpty === true || safeNodes.length > 0;

    const record = makeWsRecord(project, safeNodes, "markDirty", knownNonEmpty);
    wsPendingRecordRef.current = record;
    onProjectDirtyRef.current?.("writingScript");

    if (safeNodes.length > 0 && wsInitStateRef.current) {
      wsInitStateRef.current = { ...wsInitStateRef.current, knownNonEmpty: true };
    }

    setWritingScriptStatus(prev => ({ ...prev, state: "dirty" }));

    console.info(
      `[WritingScriptSync] markDirty — nodes=${safeNodes.length}, ` +
      `projectId=${record.projectId}, recordSavedAt=${record.savedAt}`
    );

    clearTimeout(wsTimerRef.current);
    wsTimerRef.current = setTimeout(async () => {
      wsTimerRef.current = null;
      const currentRecord = wsPendingRecordRef.current;
      if (!currentRecord) {
        console.info(`[WritingScriptSync] scheduled save: no pending record — skipped`);
        return;
      }
      console.info(
        `[WritingScriptSync] scheduled save firing — projectId=${currentRecord.projectId}, ` +
        `recordSavedAt=${currentRecord.savedAt}`
      );
      await wsFlushRecord(currentRecord, "debounce");
      // Clear pending only if it hasn't been replaced by a newer markDirty.
      if (wsPendingRecordRef.current === currentRecord) {
        wsPendingRecordRef.current = null;
      } else {
        console.info(
          `[WritingScriptSync] scheduled save: newer record exists after debounce flush — ` +
          `keeping newer record pending, projectId=${wsPendingRecordRef.current?.projectId}`
        );
      }
    }, WRITING_SCRIPT_DEBOUNCE_MS);
  }, [wsFlushRecord]);

  // initializeFromLoad — called by WritingScript.jsx to supplement init state.
  const wsInitializeFromLoad = useCallback((nodes, source) => {
    const project = projectRef.current;
    if (!project?.id) return;

    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const isNonEmpty = safeNodes.length > 0;
    const prev = wsInitStateRef.current;

    wsInitStateRef.current = {
      initialized: true,
      knownNonEmpty: isNonEmpty || (prev?.knownNonEmpty === true),
      knownNodeCount: Math.max(safeNodes.length, prev?.knownNodeCount ?? 0),
      source: prev?.source ?? source,
      supplementedFromComponent: true,
      initializedAt: prev?.initializedAt ?? new Date().toISOString(),
    };

    console.info(
      `[WritingScriptSync] initializeFromLoad — projectId=${project.id}, ` +
      `nodes=${safeNodes.length}, source=${source}, ` +
      `knownNonEmpty=${wsInitStateRef.current.knownNonEmpty}`
    );
  }, []);

  // ─── Writing Script barrier ──────────────────────────────────────────────────
  useEffect(() => {
    console.info("[WritingScriptSync] registering sync barrier");
    return registerSyncBarrier("writingScript", {
      label: "Writing Script",
      getState: () => {
        const s = writingScriptStatusRef.current.state;
        const isPending = wsTimerRef.current != null || wsPendingRecordRef.current != null || wsActiveSaveRef.current != null;
        return {
          state: isPending ? "dirty" : s,
          pendingCount: isPending ? 1 : 0,
          lastSyncedAt: writingScriptStatusRef.current.lastSupabaseSavedAt,
          lastError: writingScriptStatusRef.current.lastError,
        };
      },
      awaitIdle: async () => {
        const baseResult = {
          moduleKey: "writingScript",
          label: "Writing Script",
          flushed: false,
          offlineQueued: false,
          localOnly: false,
        };

        const init = wsInitStateRef.current;
        const pendingRecord = wsPendingRecordRef.current;
        const activeRecord = wsActiveSaveRef.current;
        const isPending = wsTimerRef.current != null || pendingRecord != null;
        const currentState = writingScriptStatusRef.current.state;

        // Case E: controller not initialized — block, no save.
        if (!init || !init.initialized) {
          console.warn(
            `[WritingScriptSync] awaitIdle: controller not initialized — blocked, ` +
            `no save attempted, projectId=${projectIdRef.current}`
          );
          return {
            ...baseResult,
            settled: false,
            timedOut: false,
            blocked: true,
            blockedReason: "uninitialized",
            finalState: {
              state: "failed",
              pendingCount: 0,
              lastSyncedAt: null,
              lastError: "Controller not initialized — init source: " + (init?.source ?? "none"),
            },
            errorMessage: "Writing Script controller not initialized — cannot verify save state.",
          };
        }

        // Case A: no pending record, no active save, already idle.
        if (!isPending && !activeRecord && (currentState === "idle" || currentState === "failed")) {
          console.info(
            `[WritingScriptSync] awaitIdle: idle, no pending record — idle, no save attempted ` +
            `(knownNonEmpty=${init.knownNonEmpty}, state=${currentState})`
          );
          return {
            ...baseResult,
            settled: true,
            timedOut: false,
            finalState: {
              state: currentState === "idle" ? "idle" : "failed",
              pendingCount: 0,
              lastSyncedAt: writingScriptStatusRef.current.lastSupabaseSavedAt,
              lastError: writingScriptStatusRef.current.lastError,
            },
            errorMessage: currentState === "failed" ? writingScriptStatusRef.current.lastError : null,
          };
        }

        // Cancel the debounce timer.
        clearTimeout(wsTimerRef.current);
        wsTimerRef.current = null;

        const recordToFlush = wsPendingRecordRef.current;

        // Case B: no pending record but active save is running — await it.
        // After it completes, re-check for a newer pending record that may have
        // arrived while we were waiting (Case D variant).
        if (!recordToFlush && activeRecord) {
          console.info(
            `[WritingScriptSync] awaitIdle: no pending record, awaiting active save — ` +
            `projectId=${activeRecord.record?.projectId}, activeReason=${activeRecord.reason}, ` +
            `recordSavedAt=${activeRecord.record?.savedAt}`
          );
          const activeResult = await activeRecord.promise;

          // After active save completes, check for a newer pending record.
          const newerRecord = wsPendingRecordRef.current;
          if (newerRecord) {
            console.info(
              `[WritingScriptSync] awaitIdle: newer pending record appeared while awaiting active save — ` +
              `flushing newest, projectId=${newerRecord.projectId}, recordSavedAt=${newerRecord.savedAt}`
            );
            // Fall through to flush the newer record below.
            // Use wsFlushRecord directly — serialization is already resolved since
            // wsActiveSaveRef has been cleared by the time we get here.
            const newerFlushResult = await wsFlushRecord(newerRecord, "save-return");
            if (wsPendingRecordRef.current === newerRecord) {
              wsPendingRecordRef.current = null;
            }
            const isNewerDb = newerFlushResult?.storage === "database";
            const isNewerLocalOnly = newerFlushResult?.localOnly === true ||
              newerFlushResult?.storage === "indexedDB" || newerFlushResult?.storage === "memory";
            return {
              ...baseResult,
              settled: isNewerDb || newerFlushResult?.storage === "blocked" || newerFlushResult?.storage === "skipped",
              timedOut: false,
              flushed: true,
              awaitedActiveSave: true,
              newerPendingFlushed: true,
              offlineQueued: isNewerLocalOnly,
              localOnly: isNewerLocalOnly,
              flushedRecordSavedAt: newerRecord.savedAt,
              finalState: {
                state: isNewerDb ? "idle" : (isNewerLocalOnly ? "offlineQueued" : "idle"),
                pendingCount: 0,
                lastSyncedAt: isNewerDb ? new Date().toISOString() : writingScriptStatusRef.current.lastSupabaseSavedAt,
                lastError: isNewerLocalOnly ? (newerFlushResult?.databaseError?.message ?? "Supabase unavailable") : null,
              },
              errorMessage: isNewerLocalOnly
                ? (newerFlushResult?.databaseError?.message ?? "Writing Script: Supabase unavailable — saved to local fallback")
                : null,
            };
          }

          const isDb = activeResult?.storage === "database";
          const isLocalOnly = activeResult?.localOnly === true || activeResult?.storage === "indexedDB" || activeResult?.storage === "memory";
          return {
            ...baseResult,
            settled: isDb || activeResult?.storage === "blocked" || activeResult?.storage === "skipped",
            timedOut: false,
            flushed: !isLocalOnly,
            awaitedActiveSave: true,
            offlineQueued: isLocalOnly,
            localOnly: isLocalOnly,
            flushedRecordSavedAt: activeRecord.record?.savedAt,
            finalState: {
              state: isDb ? "idle" : (isLocalOnly ? "offlineQueued" : "idle"),
              pendingCount: 0,
              lastSyncedAt: isDb ? new Date().toISOString() : writingScriptStatusRef.current.lastSupabaseSavedAt,
              lastError: isLocalOnly ? (activeResult?.databaseError?.message ?? "Supabase unavailable") : null,
            },
            errorMessage: isLocalOnly
              ? (activeResult?.databaseError?.message ?? "Writing Script: Supabase unavailable — saved to local fallback")
              : null,
          };
        }

        if (!recordToFlush) {
          // No pending record and no active save — already handled above, shouldn't reach here.
          console.info(`[WritingScriptSync] awaitIdle: timer cleared, no record — idle`);
          return {
            ...baseResult,
            settled: true,
            timedOut: false,
            finalState: { state: "idle", pendingCount: 0, lastSyncedAt: writingScriptStatusRef.current.lastSupabaseSavedAt, lastError: null },
          };
        }

        // Cases C & D: pending record exists.
        // wsFlushRecord handles same-record dedupe (C) and same-project serialization (D):
        // if an older save is still active for this project, wsFlushRecord awaits it
        // then flushes the newest pending record — eliminating the concurrent write race.
        console.info(
          `[AuthWrapper → WritingScriptSync] Save/Return flushing pending record — ` +
          `projectId=${recordToFlush.projectId}, nodes=${recordToFlush.nodes.length}, ` +
          `recordSavedAt=${recordToFlush.savedAt}`
        );

        const flushResult = await wsFlushRecord(recordToFlush, "save-return");

        // After wsFlushRecord returns (which may have serialized through an active save
        // and then flushed the newest record), clear wsPendingRecordRef only if it
        // still holds the record we requested to flush. If serialization switched to
        // a newer record, that newer record has been flushed and should be cleared too.
        if (wsPendingRecordRef.current === recordToFlush ||
            flushResult?.skippedReason === "no-pending-record-after-serialize") {
          wsPendingRecordRef.current = null;
        } else if (wsPendingRecordRef.current) {
          console.info(
            `[WritingScriptSync] awaitIdle: pending record cleared by serialization — ` +
            `newest was flushed, projectId=${recordToFlush.projectId}`
          );
          wsPendingRecordRef.current = null;
        }

        const isDb = flushResult?.storage === "database";
        const isBlocked = flushResult?.storage === "blocked";
        const isSkipped = flushResult?.storage === "skipped" || flushResult?.skippedReason === "no-pending-record-after-serialize";
        const isLocalOnly = flushResult?.localOnly === true ||
          flushResult?.storage === "indexedDB" ||
          flushResult?.storage === "memory";

        return {
          ...baseResult,
          settled: isDb || isBlocked || isSkipped,
          timedOut: false,
          flushed: !isSkipped && !isBlocked && flushResult?.storage !== "cancelled",
          offlineQueued: isLocalOnly,
          localOnly: isLocalOnly,
          flushedRecordSavedAt: recordToFlush.savedAt,
          finalState: {
            state: isDb ? "idle" : (isLocalOnly ? "offlineQueued" : "idle"),
            pendingCount: 0,
            lastSyncedAt: isDb ? new Date().toISOString() : writingScriptStatusRef.current.lastSupabaseSavedAt,
            lastError: isLocalOnly
              ? (flushResult?.databaseError?.message ?? flushResult?.error?.message ?? "Supabase unavailable")
              : null,
          },
          errorMessage: isLocalOnly
            ? (flushResult?.databaseError?.message ?? flushResult?.error?.message ?? "Writing Script: Supabase unavailable — saved to local fallback")
            : null,
        };
      },
    });
  }, [registerSyncBarrier, wsFlushRecord]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MoodBoard — markDirty
  // ─────────────────────────────────────────────────────────────────────────────
  const mbMarkDirty = useCallback((supabasePayload, localPayload) => {
    const project = projectRef.current;
    if (!project?.id) return;

    const record = makeMbRecord(project, supabasePayload, localPayload, "markDirty");
    mbPendingRecordRef.current = record;
    onProjectDirtyRef.current?.("moodBoard");
    setMoodBoardStatus(prev => ({ ...prev, state: "dirty" }));

    console.info(
      `[MoodBoardSync] markDirty — projectId=${record.projectId}, recordSavedAt=${record.savedAt}`
    );

    clearTimeout(mbTimerRef.current);
    mbTimerRef.current = setTimeout(async () => {
      mbTimerRef.current = null;
      const currentRecord = mbPendingRecordRef.current;
      if (!currentRecord) {
        console.info(`[MoodBoardSync] scheduled save: no pending record — skipped`);
        return;
      }
      console.info(
        `[MoodBoardSync] scheduled save firing — projectId=${currentRecord.projectId}, ` +
        `recordSavedAt=${currentRecord.savedAt}`
      );
      await mbFlushRecord(currentRecord, "debounce");
      if (mbPendingRecordRef.current === currentRecord) {
        mbPendingRecordRef.current = null;
      } else {
        console.info(
          `[MoodBoardSync] scheduled save: newer record exists after debounce flush — ` +
          `keeping newer record pending`
        );
      }
    }, MOODBOARD_DEBOUNCE_MS);
  }, [mbFlushRecord]);

  // ─── MoodBoard barrier ───────────────────────────────────────────────────────
  useEffect(() => {
    console.info("[MoodBoardSync] registering sync barrier");
    return registerSyncBarrier("moodBoard", {
      label: "MoodBoard",
      getState: () => ({
        state: (mbTimerRef.current != null || mbPendingRecordRef.current != null || mbActiveSaveRef.current != null) ? "dirty" : moodBoardStatusRef.current.state,
        pendingCount: (mbTimerRef.current != null || mbPendingRecordRef.current != null || mbActiveSaveRef.current != null) ? 1 : 0,
        lastSyncedAt: moodBoardStatusRef.current.lastSupabaseSavedAt,
        lastError: moodBoardStatusRef.current.lastError,
      }),
      awaitIdle: async () => {
        const baseResult = {
          moduleKey: "moodBoard",
          label: "MoodBoard",
          flushed: false,
          offlineQueued: false,
          localOnly: false,
        };

        const pendingRecord = mbPendingRecordRef.current;
        const activeRecord = mbActiveSaveRef.current;
        const isPending = mbTimerRef.current != null || pendingRecord != null;
        const currentState = moodBoardStatusRef.current.state;

        // No pending data at all.
        if (!isPending && !activeRecord && (currentState === "idle" || currentState === "failed")) {
          console.info(
            `[MoodBoardSync] awaitIdle: already idle, no save attempted (state=${currentState})`
          );
          return {
            ...baseResult,
            settled: true,
            timedOut: false,
            finalState: {
              state: currentState,
              pendingCount: 0,
              lastSyncedAt: moodBoardStatusRef.current.lastSupabaseSavedAt,
              lastError: moodBoardStatusRef.current.lastError,
            },
            errorMessage: currentState === "failed" ? moodBoardStatusRef.current.lastError : null,
          };
        }

        clearTimeout(mbTimerRef.current);
        mbTimerRef.current = null;

        const recordToFlush = mbPendingRecordRef.current;

        // No pending record but active save running — await it.
        // After it completes, re-check for a newer pending record.
        if (!recordToFlush && activeRecord) {
          console.info(
            `[MoodBoardSync] awaitIdle: no pending record, awaiting active save — ` +
            `projectId=${activeRecord.record?.projectId}, recordSavedAt=${activeRecord.record?.savedAt}`
          );
          const activeResult = await activeRecord.promise;

          const newerRecord = mbPendingRecordRef.current;
          if (newerRecord) {
            console.info(
              `[MoodBoardSync] awaitIdle: newer pending record appeared while awaiting active save — ` +
              `flushing newest, projectId=${newerRecord.projectId}, recordSavedAt=${newerRecord.savedAt}`
            );
            const newerFlushResult = await mbFlushRecord(newerRecord, "save-return");
            if (mbPendingRecordRef.current === newerRecord) {
              mbPendingRecordRef.current = null;
            }
            const isNewerOk = newerFlushResult?.ok === true;
            return {
              ...baseResult,
              settled: isNewerOk,
              timedOut: false,
              flushed: true,
              awaitedActiveSave: true,
              newerPendingFlushed: true,
              offlineQueued: !isNewerOk,
              localOnly: !isNewerOk,
              flushedRecordSavedAt: newerRecord.savedAt,
              finalState: {
                state: isNewerOk ? "idle" : "offlineQueued",
                pendingCount: 0,
                lastSyncedAt: isNewerOk ? new Date().toISOString() : moodBoardStatusRef.current.lastSupabaseSavedAt,
                lastError: isNewerOk ? null : (newerFlushResult?.reason ?? "MoodBoard DB flush failed"),
              },
              errorMessage: isNewerOk ? null : `MoodBoard barrier flush failed: ${newerFlushResult?.reason ?? "unknown"}`,
            };
          }

          const isOk = activeResult?.ok === true;
          return {
            ...baseResult,
            settled: isOk,
            timedOut: false,
            flushed: true,
            awaitedActiveSave: true,
            offlineQueued: !isOk,
            localOnly: !isOk,
            flushedRecordSavedAt: activeRecord.record?.savedAt,
            finalState: {
              state: isOk ? "idle" : "offlineQueued",
              pendingCount: 0,
              lastSyncedAt: isOk ? new Date().toISOString() : moodBoardStatusRef.current.lastSupabaseSavedAt,
              lastError: isOk ? null : (activeResult?.reason ?? "MoodBoard DB flush failed"),
            },
            errorMessage: isOk ? null : `MoodBoard barrier flush failed: ${activeResult?.reason ?? "unknown"}`,
          };
        }

        if (!recordToFlush) {
          console.info(`[MoodBoardSync] awaitIdle: timer cleared, no record — idle`);
          return {
            ...baseResult,
            settled: true,
            timedOut: false,
            finalState: { state: "idle", pendingCount: 0, lastSyncedAt: moodBoardStatusRef.current.lastSupabaseSavedAt, lastError: null },
          };
        }

        console.info(
          `[AuthWrapper → MoodBoardSync] Save/Return flushing pending record — ` +
          `projectId=${recordToFlush.projectId}, recordSavedAt=${recordToFlush.savedAt}`
        );

        // mbFlushRecord handles same-record dedupe and same-project serialization.
        const flushResult = await mbFlushRecord(recordToFlush, "save-return");

        // Clear pending record — serialization may have flushed a newer record than recordToFlush.
        // In all cases the newest available content has been flushed; clear whatever remains.
        if (mbPendingRecordRef.current === recordToFlush ||
            flushResult?.reason === "no-pending-record-after-serialize") {
          mbPendingRecordRef.current = null;
        } else if (mbPendingRecordRef.current) {
          // Serialization flushed a newer record — that record is now durable.
          console.info(
            `[MoodBoardSync] awaitIdle: serialization flushed newest record — clearing ref`
          );
          mbPendingRecordRef.current = null;
        }

        const isOk = flushResult?.ok === true;
        const isNoRecord = flushResult?.reason === "no-pending-record-after-serialize" || flushResult?.reason === "no-record";
        return {
          ...baseResult,
          settled: isOk || isNoRecord,
          timedOut: false,
          flushed: !isNoRecord,
          flushedRecordSavedAt: recordToFlush.savedAt,
          offlineQueued: !isOk && !isNoRecord,
          localOnly: !isOk && !isNoRecord,
          finalState: {
            state: isOk || isNoRecord ? "idle" : "offlineQueued",
            pendingCount: 0,
            lastSyncedAt: isOk ? new Date().toISOString() : moodBoardStatusRef.current.lastSupabaseSavedAt,
            lastError: isOk || isNoRecord ? null : (flushResult?.reason ?? "MoodBoard DB flush failed"),
          },
          errorMessage: isOk || isNoRecord ? null : `MoodBoard barrier flush failed: ${flushResult?.reason ?? "unknown"}`,
        };
      },
    });
  }, [registerSyncBarrier, mbFlushRecord]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────────
  const writingScriptController = useMemo(() => ({
    markDirty: wsMarkDirty,
    flushNow: wsFlushNow,
    initializeFromLoad: wsInitializeFromLoad,
    getStatus: () => writingScriptStatusRef.current,
    statusRef: writingScriptStatusRef,
    status: writingScriptStatus,
  }), [wsMarkDirty, wsFlushNow, wsInitializeFromLoad, writingScriptStatus]);

  const moodBoardController = useMemo(() => ({
    markDirty: mbMarkDirty,
    flushNow: mbFlushNow,
    getStatus: () => moodBoardStatusRef.current,
    statusRef: moodBoardStatusRef,
    status: moodBoardStatus,
  }), [mbMarkDirty, mbFlushNow, moodBoardStatus]);

  const value = useMemo(() => ({
    writingScript: writingScriptController,
    moodBoard: moodBoardController,
  }), [writingScriptController, moodBoardController]);

  return (
    <ProjectModuleSyncContext.Provider value={value}>
      {children}
    </ProjectModuleSyncContext.Provider>
  );
}

export function useProjectModuleSync() {
  const ctx = useContext(ProjectModuleSyncContext);
  if (!ctx) throw new Error("useProjectModuleSync must be used inside ProjectModuleSyncProvider");
  return ctx;
}

export function useWritingScriptSync() {
  return useProjectModuleSync().writingScript;
}

export function useMoodBoardSync() {
  return useProjectModuleSync().moodBoard;
}
