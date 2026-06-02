// Project Cache Manager — IndexedDB Project Cache (ActiveProjectMirror)
//
// ─── Architecture role ─────────────────────────────────────────────────────────
//
//   This is the PROJECT CACHE service (NOT emergency backup, NOT Supabase sync).
//
//   Responsibility:
//     • Active-project localStorage working mirror — captures and restores
//       the current-project's local state across project open/close cycles.
//     • Multi-project bounded cache/versioning for fast project hydration.
//     • Asset/module cache metadata for avoiding unnecessary Supabase re-downloads.
//
//   NOT responsible for:
//     • Emergency backup creation or restoration (see emergencyBackupStore.js).
//     • Supabase audit snapshots or backup manifests (see projectSupabaseBackupManager.js).
//     • Deciding whether project exit is clean — that is System 1 (AuthWrapper / flush handlers).
//     • Source of truth — Supabase is the durable source of truth.
//
//   Cache success does NOT make Supabase exit verification clean.
//   localStorage is cleared only after System 1 Supabase verification succeeds.
//
//   Emergency backup records are stored in a separate IDB database
//   (FilmProductionBinderEmergencyBackups) — they are never mixed with cache records here.
//
// ─── Storage layout ────────────────────────────────────────────────────────────
//
// Manages project-scoped, module-scoped local caches in IndexedDB.
// This is the foundation layer for the active-project localStorage mirror +
// multi-project bounded cache/versioning system.
//
// Storage layout:
//   IndexedDB DB:     FilmProductionBinderProjectCache (v1)
//   Stores:
//     currentProjectCache   — one record per (projectId × moduleKey): the live working cache
//     projectCacheVersions  — up to KEEP_VERSION_COUNT recent checkpoints per (projectId × moduleKey)
//     projectCacheConflicts — unresolved or resolved conflict records per (projectId × moduleKey)
//
// Record shapes — see JSDoc on each write function below.
//
// Retention rule:
//   - keep current cache record indefinitely (per project/module)
//   - keep KEEP_VERSION_COUNT (3) most recent version checkpoints per project/module
//   - never prune unresolved conflicts
//   - never prune if that would leave no available copy
//   - pruning is lazy: called only after a new version checkpoint is written
//   - emergency backups are NOT stored here — use FilmProductionBinderEmergencyBackups
//
// Conflict rule:
//   - newest timestamp normally wins when hydrating/overwriting
//   - if either timestamp is missing, or both sides changed, or data is incomplete:
//     write a conflict record and do NOT silently overwrite either side
//   - conflict status: "unresolved" | "resolved"
//
// localStorage mirror:
//   - collectProjectLocalStorageMirror() scans for all project-scoped localStorage keys
//     matching the given projectId and returns them as a map
//   - writeProjectLocalStorageMirrorToIndexedDB() saves the captured map as a cache record
//     under moduleKey = MIRROR_MODULE_KEY
//   - hydrateProjectLocalStorageMirrorFromIndexedDB() reads the mirror record and writes
//     each key back to localStorage (safe keys only — auth and global prefs excluded)
//   - clearProjectLocalStorageMirror() removes project-scoped localStorage keys ONLY after
//     a confirmed IndexedDB write — never clears without a safe copy
//
// Timestamp comparison:
//   - compareCacheTimestamps(local, supabase) returns:
//     "localNewer" | "supabaseNewer" | "equal" | "ambiguous"
//   - "ambiguous" must never trigger a silent overwrite

const PROJECT_CACHE_DB_NAME = "FilmProductionBinderProjectCache";
const PROJECT_CACHE_DB_VERSION = 1;
const STORE_CURRENT = "currentProjectCache";
const STORE_VERSIONS = "projectCacheVersions";
const STORE_CONFLICTS = "projectCacheConflicts";

const KEEP_VERSION_COUNT = 3;

// moduleKey used when storing the full localStorage mirror snapshot
export const MIRROR_MODULE_KEY = "localStorageMirror";

// Version checkpoint reason codes
export const CACHE_VERSION_REASONS = {
  SAVE_RETURN: "save_return",
  SUPABASE_SYNC: "supabase_sync",
  BEFORE_OVERWRITE: "before_overwrite",
  BEFORE_MIGRATION: "before_migration",
  MANUAL_BACKUP: "manual_backup",
};

// Conflict reason codes
export const CACHE_CONFLICT_REASONS = {
  MISSING_TIMESTAMP: "missing_timestamp",
  BOTH_CHANGED: "both_changed",
  INCOMPLETE_DATA: "incomplete_data",
  TIMESTAMP_AMBIGUOUS: "timestamp_ambiguous",
  CHECKSUM_MISMATCH: "checksum_mismatch",
};

// Source codes for cache records
export const CACHE_SOURCES = {
  LOCALSTORAGE_MIRROR: "localStorageMirror",
  INDEXEDDB: "indexedDB",
  SUPABASE: "supabase",
  MIGRATION: "migration",
  MANUAL: "manual",
};

// ─── DB open ────────────────────────────────────────────────────────────────

function openProjectCacheDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB unavailable"));
    }
    const req = indexedDB.open(PROJECT_CACHE_DB_NAME, PROJECT_CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_CURRENT)) {
        const cur = db.createObjectStore(STORE_CURRENT, { keyPath: "id" });
        cur.createIndex("byProject", "projectId", { unique: false });
        cur.createIndex("byProjectModule", ["projectId", "moduleKey"], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        const ver = db.createObjectStore(STORE_VERSIONS, { keyPath: "id" });
        ver.createIndex("byProjectModule", ["projectId", "moduleKey"], { unique: false });
        ver.createIndex("byCreatedAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CONFLICTS)) {
        const con = db.createObjectStore(STORE_CONFLICTS, { keyPath: "id" });
        con.createIndex("byProjectModule", ["projectId", "moduleKey"], { unique: false });
        con.createIndex("byStatus", "status", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Cannot open FilmProductionBinderProjectCache"));
  });
}

function idbPut(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error(`IDB put failed on ${storeName}`));
    tx.onerror = () => reject(tx.error || new Error(`IDB transaction failed on ${storeName}`));
    tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted on ${storeName}`));
  });
}

function idbGet(db, storeName, id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error(`IDB get failed on ${storeName}`));
    } catch (e) {
      reject(e);
    }
  });
}

function idbGetAllByIndex(db, storeName, indexName, keyRange) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(keyRange);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error(`IDB index getAll failed on ${storeName}/${indexName}`));
    } catch (e) {
      reject(e);
    }
  });
}

function idbDelete(db, storeName, id) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`IDB delete failed on ${storeName}`));
      tx.onerror = () => reject(tx.error || new Error(`IDB transaction failed on ${storeName}`));
      tx.onabort = () => reject(tx.error || new Error(`IDB transaction aborted on ${storeName}`));
    } catch (e) {
      reject(e);
    }
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error(`IDB getAll failed on ${storeName}`));
    } catch (e) {
      reject(e);
    }
  });
}

// ─── ID helpers ─────────────────────────────────────────────────────────────

function currentCacheId(projectId, moduleKey) {
  return `cache:${projectId}:${moduleKey}`;
}

function versionId(projectId, moduleKey, timestamp) {
  return `ver:${projectId}:${moduleKey}:${timestamp}`;
}

function conflictId(projectId, moduleKey, timestamp) {
  return `conflict:${projectId}:${moduleKey}:${timestamp}`;
}

// ─── Current cache ───────────────────────────────────────────────────────────

/**
 * Save (upsert) the current working cache for a project/module.
 *
 * Record shape stored in currentProjectCache:
 * {
 *   id:            "cache:<projectId>:<moduleKey>",
 *   projectId:     string,
 *   moduleKey:     string,
 *   payload:       any,
 *   updatedAt:     ISO string,
 *   source:        CACHE_SOURCES.*,
 *   schemaVersion: number,
 *   sizeBytes:     number | null,
 *   lastAccessedAt: ISO string,
 * }
 *
 * Returns true on success, false if IDB write fails (no destructive action on failure).
 */
export async function saveCurrentProjectCache(projectId, moduleKey, payload, metadata = {}) {
  if (!projectId || !moduleKey) return false;
  const now = new Date().toISOString();
  let serialized = null;
  let sizeBytes = null;
  try {
    serialized = JSON.stringify(payload);
    sizeBytes = serialized.length;
  } catch {}

  const record = {
    id: currentCacheId(projectId, moduleKey),
    projectId,
    moduleKey,
    payload,
    updatedAt: metadata.updatedAt || now,
    source: metadata.source || CACHE_SOURCES.INDEXEDDB,
    schemaVersion: metadata.schemaVersion || 1,
    sizeBytes,
    lastAccessedAt: now,
  };

  let db;
  try {
    db = await openProjectCacheDb();
    await idbPut(db, STORE_CURRENT, record);
    return true;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] saveCurrentProjectCache failed for ${projectId}/${moduleKey}:`, err?.message);
    }
    return false;
  } finally {
    try { db?.close(); } catch {}
  }
}

/**
 * Read the current working cache for a project/module.
 * Returns the record or null if not found.
 */
export async function getCurrentProjectCache(projectId, moduleKey) {
  if (!projectId || !moduleKey) return null;
  let db;
  try {
    db = await openProjectCacheDb();
    const record = await idbGet(db, STORE_CURRENT, currentCacheId(projectId, moduleKey));
    // Verify projectId matches — never return a record from a different project.
    if (record && record.projectId !== projectId) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[projectCacheManager] getCurrentProjectCache: projectId mismatch. Expected "${projectId}", got "${record.projectId}". Treating as not found.`);
      }
      return null;
    }
    return record || null;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] getCurrentProjectCache failed for ${projectId}/${moduleKey}:`, err?.message);
    }
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

// ─── Version checkpoints ─────────────────────────────────────────────────────

/**
 * Create a version checkpoint for a project/module.
 * Call this at meaningful save points — NOT on every keystroke.
 *
 * Record shape stored in projectCacheVersions:
 * {
 *   id:            "ver:<projectId>:<moduleKey>:<isoTimestamp>",
 *   projectId:     string,
 *   moduleKey:     string,
 *   payload:       any,
 *   createdAt:     ISO string,
 *   source:        CACHE_SOURCES.*,
 *   reason:        CACHE_VERSION_REASONS.*,
 *   schemaVersion: number,
 *   sizeBytes:     number | null,
 * }
 *
 * After writing, prunes older versions down to KEEP_VERSION_COUNT.
 * Returns the version id on success, null on failure.
 */
export async function createProjectCacheVersion(projectId, moduleKey, payload, reason, metadata = {}) {
  if (!projectId || !moduleKey) return null;
  const now = new Date().toISOString();
  let sizeBytes = null;
  try {
    sizeBytes = JSON.stringify(payload).length;
  } catch {}

  const id = versionId(projectId, moduleKey, now);
  const record = {
    id,
    projectId,
    moduleKey,
    payload,
    createdAt: now,
    source: metadata.source || CACHE_SOURCES.INDEXEDDB,
    reason: reason || CACHE_VERSION_REASONS.MANUAL_BACKUP,
    schemaVersion: metadata.schemaVersion || 1,
    sizeBytes,
  };

  let db;
  try {
    db = await openProjectCacheDb();
    await idbPut(db, STORE_VERSIONS, record);
    // Prune old versions lazily — after this write, not before.
    await pruneProjectCacheVersions(projectId, moduleKey, KEEP_VERSION_COUNT, db);
    return id;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] createProjectCacheVersion failed for ${projectId}/${moduleKey}:`, err?.message);
    }
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

/**
 * List all version checkpoints for a project/module, newest first.
 */
export async function listProjectCacheVersions(projectId, moduleKey) {
  if (!projectId || !moduleKey) return [];
  let db;
  try {
    db = await openProjectCacheDb();
    const all = await idbGetAllByIndex(db, STORE_VERSIONS, "byProjectModule", IDBKeyRange.only([projectId, moduleKey]));
    return all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] listProjectCacheVersions failed for ${projectId}/${moduleKey}:`, err?.message);
    }
    return [];
  } finally {
    try { db?.close(); } catch {}
  }
}

/**
 * Prune version checkpoints, keeping only the `keepCount` newest.
 * Never prunes if that would leave no copies.
 * Accepts an optional already-open db to avoid double-open in createProjectCacheVersion.
 */
export async function pruneProjectCacheVersions(projectId, moduleKey, keepCount = KEEP_VERSION_COUNT, existingDb = null) {
  if (!projectId || !moduleKey) return;
  let db = existingDb;
  let ownedDb = false;
  try {
    if (!db) {
      db = await openProjectCacheDb();
      ownedDb = true;
    }
    const all = await idbGetAllByIndex(db, STORE_VERSIONS, "byProjectModule", IDBKeyRange.only([projectId, moduleKey]));
    if (all.length <= keepCount) return;

    const sorted = all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const toDelete = sorted.slice(keepCount); // oldest beyond keepCount

    for (const record of toDelete) {
      try {
        await idbDelete(db, STORE_VERSIONS, record.id);
      } catch (delErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[projectCacheManager] pruneProjectCacheVersions: could not delete ${record.id}:`, delErr?.message);
        }
        // Non-fatal — leave the record in place, do not block the caller.
      }
    }
  } catch (err) {
    // Pruning failures must never crash the caller.
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] pruneProjectCacheVersions failed for ${projectId}/${moduleKey}:`, err?.message);
    }
  } finally {
    if (ownedDb) {
      try { db?.close(); } catch {}
    }
  }
}

// ─── Conflict records ────────────────────────────────────────────────────────

/**
 * Record a cache conflict for a project/module.
 *
 * Record shape stored in projectCacheConflicts:
 * {
 *   id:                  "conflict:<projectId>:<moduleKey>:<isoTimestamp>",
 *   projectId:           string,
 *   moduleKey:           string,
 *   createdAt:           ISO string,
 *   localUpdatedAt:      ISO string | null,
 *   supabaseUpdatedAt:   ISO string | null,
 *   reason:              CACHE_CONFLICT_REASONS.*,
 *   localVersionId:      string | null,   — id of the projectCacheVersions record if captured
 *   supabaseMeta:        any | null,       — metadata about the Supabase state (NOT full payload)
 *   status:              "unresolved" | "resolved",
 *   notes:               string | null,
 * }
 *
 * Returns the conflict id on success, null on failure.
 */
export async function recordProjectCacheConflict(projectId, moduleKey, conflictMetadata) {
  if (!projectId || !moduleKey) return null;
  const now = new Date().toISOString();
  const id = conflictId(projectId, moduleKey, now);

  const record = {
    id,
    projectId,
    moduleKey,
    createdAt: now,
    localUpdatedAt: conflictMetadata?.localUpdatedAt || null,
    supabaseUpdatedAt: conflictMetadata?.supabaseUpdatedAt || null,
    reason: conflictMetadata?.reason || CACHE_CONFLICT_REASONS.TIMESTAMP_AMBIGUOUS,
    localVersionId: conflictMetadata?.localVersionId || null,
    supabaseMeta: conflictMetadata?.supabaseMeta || null,
    status: "unresolved",
    notes: conflictMetadata?.notes || null,
  };

  let db;
  try {
    db = await openProjectCacheDb();
    await idbPut(db, STORE_CONFLICTS, record);
    if (process.env.NODE_ENV === "development") {
      console.info(`[projectCacheManager] Conflict recorded for ${projectId}/${moduleKey}: ${record.reason} at ${now}`);
    }
    return id;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[projectCacheManager] recordProjectCacheConflict failed for ${projectId}/${moduleKey}:`, err?.message);
    }
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

// ─── Timestamp / conflict resolver ──────────────────────────────────────────

/**
 * Compare timestamps from a local cache record and a Supabase record.
 *
 * Each arg should have: { updatedAt?, savedAt?, createdAt? }
 *
 * Returns:
 *   "localNewer"    — local timestamp is definitively newer
 *   "supabaseNewer" — supabase timestamp is definitively newer
 *   "equal"         — both timestamps are equal
 *   "ambiguous"     — one or both timestamps are missing, unparseable,
 *                     or within 1-second rounding tolerance
 *
 * Callers must NEVER overwrite silently on "ambiguous".
 */
export function compareCacheTimestamps(localRecord, supabaseRecord) {
  const pickTimestamp = (r) => {
    if (!r || typeof r !== "object") return null;
    const raw = r.updatedAt || r.savedAt || r.createdAt || null;
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  };

  const localTs = pickTimestamp(localRecord);
  const supabaseTs = pickTimestamp(supabaseRecord);

  if (localTs === null || supabaseTs === null) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[projectCacheManager] compareCacheTimestamps: missing timestamp data.", { localRecord, supabaseRecord });
    }
    return "ambiguous";
  }

  const diff = localTs - supabaseTs;

  // Within 1s: treat as equal to absorb clock/rounding noise.
  if (Math.abs(diff) <= 1000) return "equal";
  if (diff > 0) return "localNewer";
  return "supabaseNewer";
}

// ─── localStorage mirror helpers ─────────────────────────────────────────────

// Keys that must NEVER be captured or restored, regardless of what they look like.
const NEVER_CAPTURE_PREFIXES = [
  "sb-",                    // Supabase auth session tokens — NEVER
];

// Keys that are global user/app preferences — not project-scoped, do not capture.
const GLOBAL_PREF_EXACT = new Set([
  "stripboard_prefs_v1",
  "calendarExpandedSections",
  "filmProductionBinder:devBacklog",
  "filmProductionBinder:devBacklog:showCompleted",
]);

// Key prefixes that ARE project-scoped and safe to capture when the suffix
// matches the given projectId. Order: most specific first.
// Each entry: { prefix, extractId: fn(key) => projectId | null }
const PROJECT_SCOPED_PREFIXES = [
  { prefix: "writingScriptDraft:",           extractId: k => k.slice("writingScriptDraft:".length) || null },
  { prefix: "scriptWritingDraft:",           extractId: k => k.slice("scriptWritingDraft:".length) || null },
  { prefix: "writingScriptBeats:",           extractId: k => k.slice("writingScriptBeats:".length) || null },
  { prefix: "scriptBeats:",                  extractId: k => k.slice("scriptBeats:".length) || null },
  { prefix: "writingScriptSidePanelTab:",    extractId: k => k.slice("writingScriptSidePanelTab:".length) || null },
  { prefix: "writingScriptCollapsedActs:",   extractId: k => k.slice("writingScriptCollapsedActs:".length) || null },
  { prefix: "writingScriptTimelineSettings:",extractId: k => k.slice("writingScriptTimelineSettings:".length) || null },
  { prefix: "writingScriptMoodOverlay:",     extractId: k => k.slice("writingScriptMoodOverlay:".length) || null },
  { prefix: "writingScriptTargetPageCount:", extractId: k => k.slice("writingScriptTargetPageCount:".length) || null },
  { prefix: "writingScriptEditorPosition:",  extractId: k => k.slice("writingScriptEditorPosition:".length) || null },
  { prefix: "writingTitlePageSettings:",     extractId: k => k.slice("writingTitlePageSettings:".length) || null },
  { prefix: "writingCharacterProfiles:",     extractId: k => k.slice("writingCharacterProfiles:".length) || null },
  { prefix: "filmProductionBinder:moodboard:", extractId: k => k.slice("filmProductionBinder:moodboard:".length).split(":")[0] || null },
  { prefix: "scriptMoodOverlayEnabled:",     extractId: k => k.slice("scriptMoodOverlayEnabled:".length) || null },
  { prefix: "scriptMoodOverlaySettings:",    extractId: k => k.slice("scriptMoodOverlaySettings:".length) || null },
  { prefix: "scriptTimelinePositions:",      extractId: k => k.slice("scriptTimelinePositions:".length) || null },
  { prefix: "timeline-view-collapsed-",      extractId: k => k.slice("timeline-view-collapsed-".length) || null },
  { prefix: "lastAvailabilityCleanup_",      extractId: k => k.slice("lastAvailabilityCleanup_".length) || null },
  { prefix: "fpb:emergencyBackup:",          extractId: () => null }, // never capture — emergency backup markers stay
  // spellcheck dict: skip user-scoped keys (writingSpellcheckDictionary:user:*)
  {
    prefix: "writingSpellcheckDictionary:",
    extractId: k => {
      const rest = k.slice("writingSpellcheckDictionary:".length);
      if (rest.startsWith("user:")) return null; // user-scoped, not project-scoped
      return rest || null;
    },
  },
];

/**
 * Collect all project-scoped localStorage keys matching the given projectId.
 * Returns a plain object: { [localStorageKey]: rawValue }.
 *
 * Does NOT touch localStorage. Read-only.
 * Auth keys, global prefs, emergency backup markers, user-scoped dict keys
 * are never captured.
 */
export function collectProjectLocalStorageMirror(projectId) {
  if (!projectId || typeof localStorage === "undefined") return {};
  const mirror = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Never capture auth or globally protected keys.
      if (NEVER_CAPTURE_PREFIXES.some(p => key.startsWith(p))) continue;
      if (GLOBAL_PREF_EXACT.has(key)) continue;

      // Check if the key is project-scoped and belongs to this projectId.
      for (const { prefix, extractId } of PROJECT_SCOPED_PREFIXES) {
        if (!key.startsWith(prefix)) continue;
        const id = extractId(key);
        if (id === null) break; // extractId returning null means "don't capture this key"
        if (id !== projectId) break; // different project
        try {
          const raw = localStorage.getItem(key);
          if (raw !== null) mirror[key] = raw;
        } catch {}
        break;
      }
    }
  } catch {}

  if (process.env.NODE_ENV === "development") {
    const count = Object.keys(mirror).length;
    if (count > 0) {
      console.info(`[projectCacheManager] collectProjectLocalStorageMirror: ${count} keys for project ${projectId}`);
    }
  }

  return mirror;
}

/**
 * Write the current project localStorage mirror to IndexedDB as a
 * currentProjectCache record under moduleKey = MIRROR_MODULE_KEY.
 *
 * @param {string} projectId
 * @param {string} reason — CACHE_VERSION_REASONS.* (used for logging/diagnostics)
 * @returns {{ success: boolean, mirrorPayload: object, keyCount: number }}
 *   success:      true if the IDB write confirmed, false otherwise
 *   mirrorPayload: the payload object that was written (or attempted), for use
 *                  as the version checkpoint payload — always returned regardless
 *                  of success so callers can inspect what was captured
 *   keyCount:     number of project-scoped localStorage keys captured
 *
 * Does NOT delete any localStorage keys. That must be done separately,
 * and only after confirming success === true.
 */
export async function writeProjectLocalStorageMirrorToIndexedDB(projectId, reason) {
  if (!projectId) return { success: false, mirrorPayload: null, keyCount: 0 };
  const mirror = collectProjectLocalStorageMirror(projectId);
  const keyCount = Object.keys(mirror).length;
  const capturedAt = new Date().toISOString();

  const mirrorPayload = {
    keys: mirror,
    capturedAt,
    keyCount,
    reason: reason || CACHE_VERSION_REASONS.MANUAL_BACKUP,
  };

  // Always write the record even if there are no keys — an empty mirror is
  // a valid snapshot (project has no localStorage data currently).
  const success = await saveCurrentProjectCache(projectId, MIRROR_MODULE_KEY, mirrorPayload, {
    source: CACHE_SOURCES.LOCALSTORAGE_MIRROR,
    updatedAt: capturedAt,
  });

  if (process.env.NODE_ENV === "development") {
    if (success) {
      console.info(`[projectCacheManager] writeProjectLocalStorageMirrorToIndexedDB: wrote ${keyCount} keys for project ${projectId} (reason: ${reason})`);
    } else {
      console.warn(`[projectCacheManager] writeProjectLocalStorageMirrorToIndexedDB: IDB write failed for project ${projectId}`);
    }
  }

  return { success, mirrorPayload, keyCount };
}

/**
 * Hydrate project localStorage keys from the IndexedDB mirror record.
 * Writes each captured key back to localStorage, skipping auth/global/emergency keys.
 *
 * Safe: will not write any key that is in NEVER_CAPTURE_PREFIXES or GLOBAL_PREF_EXACT.
 * Intended for use at project open time to restore the active localStorage mirror from cache.
 *
 * Returns { restored: number, skipped: number } or null if no mirror record found.
 */
export async function hydrateProjectLocalStorageMirrorFromIndexedDB(projectId) {
  if (!projectId) return null;
  const record = await getCurrentProjectCache(projectId, MIRROR_MODULE_KEY);
  if (!record?.payload?.keys) return null;

  const mirror = record.payload.keys;
  let restored = 0;
  let skipped = 0;

  for (const [key, rawValue] of Object.entries(mirror)) {
    // Safety re-check: never hydrate auth or global prefs.
    if (NEVER_CAPTURE_PREFIXES.some(p => key.startsWith(p))) { skipped++; continue; }
    if (GLOBAL_PREF_EXACT.has(key)) { skipped++; continue; }
    // Never hydrate emergency backup markers.
    if (key.startsWith("fpb:emergencyBackup:")) { skipped++; continue; }

    try {
      localStorage.setItem(key, rawValue);
      restored++;
    } catch {
      skipped++;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info(`[projectCacheManager] hydrateProjectLocalStorageMirrorFromIndexedDB: restored ${restored}, skipped ${skipped} for project ${projectId}`);
  }

  return { restored, skipped };
}

/**
 * Clear project-scoped localStorage keys for the given projectId.
 *
 * IMPORTANT: Only call this AFTER writeProjectLocalStorageMirrorToIndexedDB()
 * has returned true. This function does NOT write to IDB — it only removes
 * localStorage keys.
 *
 * Auth keys, global prefs, emergency backup markers, and user-scoped dict keys
 * are never removed.
 *
 * Returns { removed: number } — count of keys removed.
 *
 * This function is intentionally NOT called automatically anywhere. It must be
 * explicitly called after a confirmed IDB write.
 */
export function clearProjectLocalStorageMirror(projectId) {
  if (!projectId || typeof localStorage === "undefined") return { removed: 0 };
  let removed = 0;

  const keysToRemove = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (NEVER_CAPTURE_PREFIXES.some(p => key.startsWith(p))) continue;
      if (GLOBAL_PREF_EXACT.has(key)) continue;
      if (key.startsWith("fpb:emergencyBackup:")) continue;

      for (const { prefix, extractId } of PROJECT_SCOPED_PREFIXES) {
        if (!key.startsWith(prefix)) continue;
        const id = extractId(key);
        if (id === null) break;
        if (id !== projectId) break;
        keysToRemove.push(key);
        break;
      }
    }
  } catch {}

  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
      removed++;
    } catch {}
  }

  if (process.env.NODE_ENV === "development" && removed > 0) {
    console.info(`[projectCacheManager] clearProjectLocalStorageMirror: removed ${removed} keys for project ${projectId}`);
  }

  return { removed };
}

// ─── Diagnostics helpers (read-only) ────────────────────────────────────────

/**
 * Read all records from all three stores for diagnostics display.
 * Returns { currentCache: [], versions: [], conflicts: [], error?: string }
 * Never throws.
 */
export async function readProjectCacheForDiagnostics() {
  let db;
  try {
    db = await openProjectCacheDb();
    const [currentCache, versions, conflicts] = await Promise.all([
      idbGetAll(db, STORE_CURRENT),
      idbGetAll(db, STORE_VERSIONS),
      idbGetAll(db, STORE_CONFLICTS),
    ]);
    return { currentCache, versions, conflicts };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[projectCacheManager] readProjectCacheForDiagnostics failed:", err?.message);
    }
    return { currentCache: [], versions: [], conflicts: [], error: err?.message };
  } finally {
    try { db?.close(); } catch {}
  }
}

/**
 * Dry-run: report what collectProjectLocalStorageMirror would capture
 * for the given projectId, without writing anything.
 * For dev logging / diagnostics only.
 */
export function dryRunLocalStorageMirror(projectId) {
  const mirror = collectProjectLocalStorageMirror(projectId);
  const keys = Object.keys(mirror);
  const totalBytes = keys.reduce((sum, k) => sum + k.length + (mirror[k]?.length || 0), 0);

  if (process.env.NODE_ENV === "development") {
    console.info(`[projectCacheManager] dryRunLocalStorageMirror for project ${projectId}:`);
    console.info(`  Would capture ${keys.length} keys (${totalBytes} bytes total)`);
    for (const k of keys) {
      console.info(`  ${k} — ${mirror[k]?.length || 0} chars`);
    }
  }

  return { keys, totalBytes };
}
