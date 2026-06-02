// Emergency Backup Store — System 2: Emergency Backup / Restore
//
// ─── Architecture role ─────────────────────────────────────────────────────────
//
//   This is the EMERGENCY BACKUP service (safety net only).
//
//   Responsibility:
//     • Create/preserve emergency backup when System 1 Supabase exit verification fails.
//     • Store project backup records in a SEPARATE IDB database so they are never
//       mixed with normal cache records (projectCacheManager.js uses a different DB).
//     • Expose restore/export options after failure.
//     • Write a localStorage marker so pending backups can be detected on startup.
//
//   NOT responsible for:
//     • Marking project exit clean — backup success never makes Return visible.
//     • Clearing localStorage — that is gated on System 1 Supabase verification only.
//     • Normal Supabase sync — that is System 1 (ProjectModuleSyncContext + flush handlers).
//     • Being invoked during normal clean Save/Return — only invoked on failure.
//
//   Emergency backup is triggered by AuthWrapper.handleSaveAndReturn ONLY when
//   isCleanDatabaseSuccess is false. It is NEVER used as evidence that Supabase is current.
//
// ─── Storage layout ─────────────────────────────────────────────────────────────
//
// Stores project backup records in IndexedDB when a project exit flush cannot
// complete a clean database save. Writes a tiny localStorage marker so the app
// can detect pending backups on startup.
//
// Storage layout:
//   IndexedDB DB:    FilmProductionBinderEmergencyBackups (v1)
//   IndexedDB Store: backups   (keyPath: "id")
//   localStorage:   fpb:emergencyBackup:<projectId>  →  tiny marker JSON
//
// Record shape (stored in IDB):
//   {
//     id:          "emergency:<projectId>:<isoTimestamp>",
//     projectId:   string,
//     projectName: string,
//     createdAt:   ISO string,
//     reason:      "project_exit_flush_local" | "project_exit_flush_error" | "project_exit_flush_timeout",
//     syncStatus:  "pending",
//     schemaVersion: 1,
//     flushResults: FlushResult[],
//     modules: {
//       writingScript?: {
//         nodeCount: number,
//         storage: string | null,
//         localOnly: boolean,
//         errorMessage: string | null,
//       }
//       // TODO: add more modules here as they register flush handlers
//     }
//   }
//
// Marker shape (stored in localStorage, tiny):
//   {
//     id, projectId, projectName, createdAt, reason, syncStatus: "pending"
//   }
//
// Constraints:
//   - Never writes to sb-* auth keys.
//   - Never stores full module payloads in literal localStorage (marker only).
//   - If IDB write fails, returns null without touching localStorage.
//   - The marker is only written after a confirmed IDB write.
//
// TODO (future phases):
//   - Retry-on-reconnect: scan markers, attempt Supabase upsert, clear on success.
//   - Module payload providers: each module can optionally supply an emergency
//     payload via its flush result (result.emergencyPayload). This file should
//     store it in the modules map when provided.
//   - Full project snapshot: once all modules register flush handlers and provide
//     emergency payloads, assemble a full snapshot here.
//   - Supabase project_backups table (schema TBD): write backup after successful
//     IDB write, keep last 10 per project, use as secondary recovery path.

const EMERGENCY_DB_NAME = "FilmProductionBinderEmergencyBackups";
const EMERGENCY_DB_VERSION = 1;
const EMERGENCY_STORE_NAME = "backups";
export const EMERGENCY_MARKER_PREFIX = "fpb:emergencyBackup:";

function openEmergencyDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB unavailable"));
    }
    const req = indexedDB.open(EMERGENCY_DB_NAME, EMERGENCY_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EMERGENCY_STORE_NAME)) {
        db.createObjectStore(EMERGENCY_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Cannot open emergency backup DB"));
  });
}

function putRecord(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EMERGENCY_STORE_NAME, "readwrite");
    const store = tx.objectStore(EMERGENCY_STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("IDB put failed"));
    tx.onerror = () => reject(tx.error || new Error("IDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IDB transaction aborted"));
  });
}

// Derive a reason code from flush results.
function deriveReason(flushResults) {
  const statuses = flushResults.map((r) => r.status);
  if (statuses.includes("timeout")) return "project_exit_flush_timeout";
  if (statuses.includes("error")) return "project_exit_flush_error";
  return "project_exit_flush_local";
}

// Build the modules map from flush results.
// For now only writingScript is handled. Future modules add their own key.
function buildModulesMap(flushResults) {
  const modules = {};
  for (const r of flushResults) {
    if (r.key === "writingScript") {
      modules.writingScript = {
        nodeCount: r.nodeCount ?? null,
        storage: r.storage,
        localOnly: r.localOnly,
        errorMessage: r.errorMessage,
        // TODO: accept r.emergencyPayload once module provides it
      };
    }
    // TODO: add other modules here
  }
  return modules;
}

// Write an emergency backup record to IDB and a marker to localStorage.
// Returns the record id on success, null if IDB write fails.
export async function writeEmergencyBackup({ projectId, projectName, flushResults }) {
  const createdAt = new Date().toISOString();
  const id = `emergency:${projectId}:${createdAt}`;
  const reason = deriveReason(flushResults);

  const record = {
    id,
    projectId,
    projectName: projectName || projectId,
    createdAt,
    reason,
    syncStatus: "pending",
    schemaVersion: 1,
    flushResults,
    modules: buildModulesMap(flushResults),
  };

  let db;
  try {
    db = await openEmergencyDb();
    await putRecord(db, record);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[emergencyBackupStore] IDB write failed:", err?.message);
    }
    return null;
  } finally {
    try { db?.close(); } catch {}
  }

  // IDB confirmed — write tiny marker to localStorage.
  const marker = JSON.stringify({
    id,
    projectId,
    projectName: projectName || projectId,
    createdAt,
    reason,
    syncStatus: "pending",
  });

  const markerKey = `${EMERGENCY_MARKER_PREFIX}${projectId}`;
  try {
    localStorage.setItem(markerKey, marker);
  } catch {
    // Marker write failed. The IDB record is intact so data is not lost.
    // The banner won't show on next load but the backup is still in IDB.
    if (process.env.NODE_ENV === "development") {
      console.warn("[emergencyBackupStore] localStorage marker write failed; IDB backup is intact at:", id);
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[emergencyBackupStore] Wrote emergency backup:", id, "reason:", reason);
  }

  return id;
}

// Scan localStorage for pending emergency backup markers.
// Returns only markers with syncStatus === "pending" — dismissed-local and
// synced markers are excluded so they do not trigger the banner.
// Tolerates stale/malformed markers safely.
export function scanEmergencyBackupMarkers() {
  const markers = [];
  if (typeof localStorage === "undefined") return markers;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(EMERGENCY_MARKER_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "");
        if (!parsed?.id || !parsed?.projectId) continue;
        // Only surface markers that are actively pending — not dismissed or synced.
        if (parsed.syncStatus && parsed.syncStatus !== "pending") continue;
        markers.push({ ...parsed, _localStorageKey: key });
      } catch {}
    }
  } catch {}
  return markers;
}

// ─── IDB helpers (read + update, no full delete) ─────────────────────────────

function getRecord(db, id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(EMERGENCY_STORE_NAME, "readonly");
      const store = tx.objectStore(EMERGENCY_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("IDB get failed"));
    } catch (e) {
      reject(e);
    }
  });
}

function getAllRecords(db) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(EMERGENCY_STORE_NAME, "readonly");
      const store = tx.objectStore(EMERGENCY_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("IDB getAll failed"));
    } catch (e) {
      reject(e);
    }
  });
}

// ─── retryEmergencyBackupToSupabase ──────────────────────────────────────────

/**
 * Attempt to sync a pending emergency backup to Supabase.
 *
 * Strategy for Writing Script (the only registered flush module so far):
 *   1. Read the full IDB emergency backup record.
 *   2. The emergency record itself does NOT store full node payloads — it stores
 *      metadata (nodeCount, storage, localOnly) only.
 *   3. Read the latest Writing Script draft from FilmProductionBinderWritingDrafts
 *      IDB store using projectId — this is the most recent locally cached draft.
 *   4. If a draft is found, push it to Supabase via saveWritingDraftSafely.
 *   5. On confirmed database success:
 *      - Update IDB emergency record: syncStatus "synced", syncedAt, syncResult
 *      - Remove the localStorage marker
 *      - Return { success: true }
 *   6. On failure:
 *      - Update IDB emergency record retry metadata: lastRetryAt, lastRetryError, retryCount
 *      - Keep localStorage marker
 *      - Return { success: false, error }
 *   7. Never delete the IDB emergency record.
 *   8. Never touch sb-* auth keys.
 *   9. Never touch unrelated project markers.
 *
 * @param {string} projectId
 * @param {string} [backupId] — optional, the specific emergency record id to retry.
 *   If omitted, looks up the marker for projectId and uses its id.
 * @returns {{ success: boolean, storage?: string, error?: string }}
 */
export async function retryEmergencyBackupToSupabase(projectId, backupId) {
  if (!projectId) return { success: false, error: "projectId is required" };

  // Resolve the backup record id from the localStorage marker if not provided.
  let resolvedBackupId = backupId;
  if (!resolvedBackupId) {
    const markerKey = `${EMERGENCY_MARKER_PREFIX}${projectId}`;
    try {
      const raw = localStorage.getItem(markerKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        resolvedBackupId = parsed?.id || null;
      }
    } catch {}
    if (!resolvedBackupId) {
      return { success: false, error: "No pending emergency backup marker found for this project." };
    }
  }

  let db;
  try {
    db = await openEmergencyDb();
  } catch (err) {
    return { success: false, error: `Could not open emergency backup DB: ${err?.message}` };
  }

  let emergencyRecord = null;
  try {
    emergencyRecord = await getRecord(db, resolvedBackupId);
  } catch (err) {
    try { db?.close(); } catch {}
    return { success: false, error: `Could not read emergency backup record: ${err?.message}` };
  }

  if (!emergencyRecord) {
    try { db?.close(); } catch {}
    return { success: false, error: `Emergency backup record "${resolvedBackupId}" not found in IndexedDB.` };
  }

  // The emergency record only stores metadata — retrieve the actual Writing Script
  // draft from FilmProductionBinderWritingDrafts/drafts.
  let draft = null;
  let draftSource = null;
  try {
    // Dynamic import to avoid a circular dep — emergencyBackupStore and
    // writingDraftPersistence are both utility modules.
    const { loadWritingDraftFromIndexedDbOnly } =
      await import("../components/modules/WritingScript/writingDraftPersistence");
    const projectObj = { id: projectId, name: emergencyRecord.projectName };
    draft = await loadWritingDraftFromIndexedDbOnly(projectObj);
    if (draft) draftSource = "indexedDB";
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[emergencyBackupStore] Could not load Writing Script IDB draft for retry:", err?.message);
    }
  }

  if (!draft || !Array.isArray(draft.nodes) || draft.nodes.length === 0) {
    // Update retry metadata but do not claim success.
    const now = new Date().toISOString();
    const updated = {
      ...emergencyRecord,
      lastRetryAt: now,
      lastRetryError: "Retry unavailable: no restorable Writing Script draft found in IndexedDB.",
      retryCount: (emergencyRecord.retryCount || 0) + 1,
    };
    try {
      await putRecord(db, updated);
    } catch {}
    try { db?.close(); } catch {}
    return {
      success: false,
      error: "Retry unavailable: no restorable Writing Script draft found in IndexedDB for this project.",
    };
  }

  // We have a draft. Push it to Supabase via saveWritingDraftSafely (which has
  // its own 10s DB timeout + IDB fallback, so it will not hang indefinitely).
  let saveResult = null;
  try {
    const { saveWritingDraftSafely } =
      await import("../components/modules/WritingScript/writingDraftPersistence");
    const projectObj = { id: projectId, name: emergencyRecord.projectName };
    saveResult = await saveWritingDraftSafely(projectObj, draft.nodes);
  } catch (err) {
    saveResult = { storage: "error", localOnly: true, databaseError: err };
  }

  const now = new Date().toISOString();
  const saveSucceeded = saveResult?.storage === "database" && !saveResult?.localOnly;

  if (saveSucceeded) {
    // Confirmed Supabase write. Update IDB record status.
    const updated = {
      ...emergencyRecord,
      syncStatus: "synced",
      syncedAt: now,
      lastRetryAt: now,
      lastRetryError: null,
      retryCount: (emergencyRecord.retryCount || 0) + 1,
      syncResult: {
        storage: saveResult.storage,
        draftSource,
        nodeCount: draft.nodes.length,
        syncedAt: now,
      },
    };
    try {
      await putRecord(db, updated);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[emergencyBackupStore] Could not update IDB record after sync:", err?.message);
      }
      // IDB record update failed — but Supabase save succeeded. Still clear the marker.
    }
    try { db?.close(); } catch {}

    // Remove the localStorage marker — data is now in Supabase.
    const markerKey = `${EMERGENCY_MARKER_PREFIX}${projectId}`;
    try { localStorage.removeItem(markerKey); } catch {}

    if (process.env.NODE_ENV === "development") {
      console.info(`[emergencyBackupStore] Retry sync succeeded for project ${projectId}. Marker cleared.`);
    }

    return { success: true, storage: saveResult.storage, draftSource };
  }

  // Save failed — update retry metadata, keep marker.
  const errMsg = saveResult?.databaseError?.message || "Database save failed or returned localOnly.";
  const updated = {
    ...emergencyRecord,
    lastRetryAt: now,
    lastRetryError: errMsg,
    retryCount: (emergencyRecord.retryCount || 0) + 1,
  };
  try {
    await putRecord(db, updated);
  } catch {}
  try { db?.close(); } catch {}

  if (process.env.NODE_ENV === "development") {
    console.warn(`[emergencyBackupStore] Retry sync failed for project ${projectId}:`, errMsg);
  }

  return { success: false, error: errMsg };
}

// ─── markEmergencyBackupResolvedLocally ──────────────────────────────────────

/**
 * Mark a pending emergency backup as locally resolved after the user confirms
 * that the project data is safe.
 *
 * This does NOT sync to Supabase and does NOT claim a database save happened.
 * It only:
 *   - updates the IDB emergency record: syncStatus "dismissed-local", resolvedAt, resolutionReason
 *   - removes the localStorage marker for that projectId
 *   - never deletes the IDB record
 *   - never touches auth keys or unrelated markers
 *
 * @param {string} projectId
 * @param {string} [backupId] — optional specific record id; if omitted uses marker id
 * @returns {{ success: boolean, error?: string }}
 */
export async function markEmergencyBackupResolvedLocally(projectId, backupId) {
  if (!projectId) return { success: false, error: "projectId is required" };

  // Resolve the backup record id.
  let resolvedBackupId = backupId;
  const markerKey = `${EMERGENCY_MARKER_PREFIX}${projectId}`;
  if (!resolvedBackupId) {
    try {
      const raw = localStorage.getItem(markerKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        resolvedBackupId = parsed?.id || null;
      }
    } catch {}
    if (!resolvedBackupId) {
      // No marker but caller asked to resolve — remove any stale marker and return ok.
      try { localStorage.removeItem(markerKey); } catch {}
      return { success: true };
    }
  }

  let db;
  try {
    db = await openEmergencyDb();
  } catch (err) {
    // IDB unavailable — still remove the localStorage marker so banner clears.
    try { localStorage.removeItem(markerKey); } catch {}
    return { success: true };
  }

  let record = null;
  try {
    record = await getRecord(db, resolvedBackupId);
  } catch {}

  if (record) {
    const updated = {
      ...record,
      syncStatus: "dismissed-local",
      resolvedAt: new Date().toISOString(),
      resolutionReason: "manually_verified_safe",
    };
    try {
      await putRecord(db, updated);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[emergencyBackupStore] Could not update IDB record during resolve:", err?.message);
      }
      // Non-fatal — still clear the localStorage marker.
    }
  }

  try { db?.close(); } catch {}

  // Remove only the matching localStorage marker.
  try { localStorage.removeItem(markerKey); } catch {}

  if (process.env.NODE_ENV === "development") {
    console.info(`[emergencyBackupStore] Emergency backup for project ${projectId} marked resolved locally.`);
  }

  return { success: true };
}
