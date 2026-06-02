// Storage quota guard — migrates Writing Script draft payloads out of localStorage.
//
// The new storage contract requires that full draft payloads NEVER live in literal
// localStorage. localStorage may only hold a tiny marker pointing to IndexedDB.
//
// On app startup this module scans ALL Writing Script draft keys — regardless of
// size — and migrates any full payload to IndexedDB, replacing the localStorage
// entry with a tiny marker. Existing markers are left untouched.
//
// If the IndexedDB write fails for any reason the original localStorage entry
// is left completely untouched — no data is ever deleted without a confirmed
// safe copy existing first.
//
// Key constants below must stay in sync with writingDraftPersistence.js.

const DB_NAME = "FilmProductionBinderWritingDrafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";

// Only these key prefixes are ever touched. All others (including sb-*) are
// completely ignored.
const MIGRATABLE_PREFIXES = [
  "writingScriptDraft:",   // current draft cache key
  "scriptWritingDraft:",   // legacy draft cache key
];

// Key prefixes that must never be removed or migrated, ever.
const PROTECTED_PREFIXES = [
  "sb-",  // Supabase auth session tokens
];

function isProtected(key) {
  return PROTECTED_PREFIXES.some((p) => key.startsWith(p));
}

function isMigratable(key) {
  return MIGRATABLE_PREFIXES.some((p) => key.startsWith(p));
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB unavailable"));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open draft DB"));
  });
}

function putToIndexedDb(db, key, payload) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ key, payload });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("IndexedDB put failed"));
    tx.oncomplete = () => {};
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

// Read an existing IndexedDB record by key. Returns the record or null.
function getFromIndexedDb(db, key) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Migrate one Writing Script draft localStorage entry to IndexedDB.
// Returns true if the localStorage entry was replaced with a marker.
// Returns false if anything went wrong (original localStorage entry is intact).
//
// Duplicate-pair logic:
//   Legacy keys (scriptWritingDraft:<id>) normalise to the same IDB key as
//   current keys (writingScriptDraft:<id>). If the current-key pass already
//   wrote an IDB record, the legacy pass checks for it and skips the IDB write
//   to avoid clobbering a potentially newer payload. The legacy localStorage
//   entry is still replaced with a marker pointing to the existing IDB record.
async function migrateEntry(db, key, rawValue) {
  let payload;
  try {
    payload = JSON.parse(rawValue);
  } catch {
    return false;
  }

  // Already a marker — nothing to migrate.
  if (payload?.storage === "indexedDB") return false;

  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : (Array.isArray(payload) ? payload : null);
  if (!nodes) return false;

  // Normalise to current IDB key.
  const indexedDbKey = key.startsWith("scriptWritingDraft:")
    ? key.replace("scriptWritingDraft:", "writingScriptDraft:")
    : key;

  const normalizedPayload = {
    projectId: payload.projectId || indexedDbKey.replace("writingScriptDraft:", ""),
    savedAt: payload.savedAt || null,
    hasUserCreatedScript: payload.hasUserCreatedScript === true ||
      nodes.some((n) => n?.type === "Scene Heading"),
    nodes,
  };

  // For legacy keys: check if a current-key IDB record already exists.
  // If so, skip the IDB write — don't overwrite a potentially newer payload.
  // We still replace the legacy localStorage entry with a marker below.
  const isLegacyKey = key.startsWith("scriptWritingDraft:");
  let skipIdbWrite = false;
  if (isLegacyKey) {
    const existing = await getFromIndexedDb(db, indexedDbKey);
    if (existing) {
      skipIdbWrite = true;
      if (process.env.NODE_ENV === "development") {
        console.info(`[storageQuotaGuard] Legacy key "${key}" — IDB record already exists at "${indexedDbKey}", skipping overwrite`);
      }
    }
  }

  if (!skipIdbWrite) {
    try {
      await putToIndexedDb(db, indexedDbKey, normalizedPayload);
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[storageQuotaGuard] IDB write failed for "${key}" — localStorage entry preserved`);
      }
      return false;
    }
  }

  // IDB write confirmed (or skipped because record already exists).
  // Replace the localStorage full payload with a tiny marker.
  // If setItem also fails (quota still too tight), free the space with removeItem —
  // the load path falls back to database when no localStorage entry exists.
  const marker = JSON.stringify({
    projectId: normalizedPayload.projectId,
    savedAt: normalizedPayload.savedAt,
    hasUserCreatedScript: normalizedPayload.hasUserCreatedScript,
    storage: "indexedDB",
    indexedDbKey,
    nodeCount: nodes.length,
  });

  try {
    localStorage.setItem(key, marker);
  } catch {
    try { localStorage.removeItem(key); } catch {}
  }

  return true;
}

// Scans localStorage for ANY Writing Script draft full payload and migrates it to
// IndexedDB, replacing localStorage with a tiny marker. Existing markers are skipped.
//
// Handles duplicate legacy+current pairs for the same project ID:
//   - If both `scriptWritingDraft:<id>` and `writingScriptDraft:<id>` are full
//     payloads, both are migrated. The legacy key normalises to the current IDB key
//     (writingScriptDraft:<id>). If a current-key IDB record already exists after
//     the current-key migration runs first, the legacy key migration skips the IDB
//     write to avoid overwriting a potentially newer payload. The legacy localStorage
//     entry is still replaced with a marker pointing to the existing IDB record.
//
// This function is exported under the old name for backwards compatibility with
// AuthWrapper.js which calls evictOversizedDraftCache(). Both names work.
export async function migrateAllDraftPayloads() {
  if (typeof localStorage === "undefined") return;

  // Collect ALL migratable draft keys synchronously (iteration is sync).
  // Full payloads have a "nodes" array; markers have storage:"indexedDB".
  const candidates = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || isProtected(key) || !isMigratable(key)) continue;
      try {
        const val = localStorage.getItem(key);
        if (!val) continue;
        // Quick check: if it already looks like a marker, skip.
        // Markers are small JSON objects with storage:"indexedDB".
        // We do a lightweight check before full JSON parse.
        if (val.includes('"storage":"indexedDB"')) continue;
        candidates.push({ key, val });
      } catch {}
    }
  } catch {}

  if (candidates.length === 0) return;

  let db;
  try {
    db = await openDb();
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[storageQuotaGuard] IndexedDB unavailable — cannot migrate draft payloads");
    }
    return;
  }

  // Sort: process current-prefix keys before legacy-prefix keys so that the
  // current IDB record is established first. Legacy keys then detect it and
  // skip overwriting with a potentially older payload.
  candidates.sort((a, b) => {
    const aLegacy = a.key.startsWith("scriptWritingDraft:") ? 1 : 0;
    const bLegacy = b.key.startsWith("scriptWritingDraft:") ? 1 : 0;
    return aLegacy - bLegacy;
  });

  let migrated = 0;
  const migratedKeys = [];
  for (const { key, val } of candidates) {
    const ok = await migrateEntry(db, key, val);
    if (ok) { migrated++; migratedKeys.push(key); }
  }

  try { db.close(); } catch {}

  if (process.env.NODE_ENV === "development" && migrated > 0) {
    console.info(
      `[storageQuotaGuard] Migrated ${migrated} draft payload(s) to IndexedDB: ${migratedKeys.join(", ")}`
    );
  }
}

// Backwards-compatible alias — AuthWrapper.js calls this name.
export const evictOversizedDraftCache = migrateAllDraftPayloads;
