import { supabase } from "../../../supabase";

const DEFAULT_PROJECT_ID = "default-project";
const WRITING_DRAFT_DB_NAME = "FilmProductionBinderWritingDrafts";
const WRITING_DRAFT_DB_VERSION = 1;
const WRITING_DRAFT_STORE_NAME = "drafts";
const WRITING_DRAFT_SETTINGS_KEY = "writingScriptDraft";
const WRITING_DICTIONARY_SETTINGS_KEY = "writingSpellcheckDictionaryWords";
const WRITING_TITLE_PAGE_SETTINGS_KEY = "writingTitlePageSettings";

// Full draft payloads must NEVER be written to literal localStorage.
// localStorage only stores a tiny marker {storage:"indexedDB", indexedDbKey, ...}.
// Legacy full-payload reads are still supported in the load path but never written back.

export const getWritingDraftProjectId = (project) => {
  if (!project) return DEFAULT_PROJECT_ID;
  if (typeof project === "string") return project || DEFAULT_PROJECT_ID;
  return project.id || project.name || DEFAULT_PROJECT_ID;
};

export const getWritingDraftStorageKey = (project) => {
  return `writingScriptDraft:${getWritingDraftProjectId(project)}`;
};

export const getLegacyWritingDraftStorageKey = (project) => {
  return `scriptWritingDraft:${getWritingDraftProjectId(project)}`;
};

export const buildWritingDraftPayload = (project, nodes = []) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  return {
    projectId: getWritingDraftProjectId(project),
    savedAt: new Date().toISOString(),
    hasUserCreatedScript: safeNodes.some(node => node?.type === "Scene Heading"),
    nodes: safeNodes,
  };
};

const normalizeDictionaryWords = (words = []) => (
  Array.from(new Set((Array.isArray(words) ? words : [])
    .map(word => String(word || "").trim().toLowerCase())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
);

const loadProjectSettings = async (project) => {
  if (!project?.id) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", project.id)
    .single();

  if (error) throw error;
  return data?.settings && typeof data.settings === "object" ? data.settings : {};
};

const updateProjectSettings = async (project, settingsPatch = {}) => {
  if (!project?.id) {
    throw new Error("Cannot save Writing project settings without a database project id.");
  }

  const currentSettings = await loadProjectSettings(project);
  const nextSettings = {
    ...(currentSettings || {}),
    ...settingsPatch,
  };

  const { error } = await supabase
    .from("projects")
    .update({ settings: nextSettings })
    .eq("id", project.id);

  if (error) throw error;
  return nextSettings;
};

const loadWritingDraftFromDatabase = async (project) => {
  const settings = await loadProjectSettings(project);
  return parseWritingDraftPayload(project, settings?.[WRITING_DRAFT_SETTINGS_KEY]);
};

const saveWritingDraftToDatabase = async (project, payload) => {
  await updateProjectSettings(project, {
    [WRITING_DRAFT_SETTINGS_KEY]: payload,
  });
  return payload;
};

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
};

const loadUserSettings = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("settings")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data?.settings && typeof data.settings === "object" ? data.settings : {};
};

const updateUserSettings = async (settingsPatch = {}) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Cannot save Writing spellcheck dictionary without a logged-in user.");
  }

  const currentSettings = await loadUserSettings();
  const nextSettings = {
    ...(currentSettings || {}),
    ...settingsPatch,
  };

  const { error } = await supabase
    .from("users")
    .update({ settings: nextSettings })
    .eq("id", userId);

  if (error) throw error;
  return nextSettings;
};

const getUserDictionaryStorageKey = async () => {
  try {
    const userId = await getCurrentUserId();
    return `writingSpellcheckDictionary:user:${userId || "anonymous"}`;
  } catch {
    return "writingSpellcheckDictionary:user:anonymous";
  }
};

export const loadUserWritingDictionaryWordsAsync = async () => {
  const storageKey = await getUserDictionaryStorageKey();

  try {
    const settings = await loadUserSettings();
    const databaseWords = normalizeDictionaryWords(settings?.[WRITING_DICTIONARY_SETTINGS_KEY]);
    try {
      localStorage.setItem(storageKey, JSON.stringify(databaseWords));
    } catch {}
    return { words: databaseWords, storage: "database" };
  } catch {
    // Local fallback below.
  }

  try {
    const localWords = normalizeDictionaryWords(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    return { words: localWords, storage: localWords.length ? "localStorage" : "empty" };
  } catch {
    return { words: [], storage: "empty" };
  }
};

export const saveUserWritingDictionaryWordsAsync = async (words = []) => {
  const safeWords = normalizeDictionaryWords(words);
  const storageKey = await getUserDictionaryStorageKey();

  try {
    await updateUserSettings({
      [WRITING_DICTIONARY_SETTINGS_KEY]: safeWords,
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(safeWords));
    } catch {}
    return { words: safeWords, storage: "database" };
  } catch (error) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(safeWords));
      return { words: safeWords, storage: "localStorage", databaseError: error };
    } catch {
      throw error;
    }
  }
};

export const loadWritingDictionaryWordsAsync = async (project) => {
  const storageKey = `writingSpellcheckDictionary:${getWritingDraftProjectId(project)}`;
  let userResult = { words: [], storage: "empty" };
  let projectWords = [];

  try {
    userResult = await loadUserWritingDictionaryWordsAsync();
  } catch {
    // Project/local fallback below.
  }

  try {
    const settings = await loadProjectSettings(project);
    projectWords = normalizeDictionaryWords(settings?.[WRITING_DICTIONARY_SETTINGS_KEY]);
  } catch {
    // Local fallback below.
  }

  try {
    const localWords = normalizeDictionaryWords(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    const legacyProjectWords = projectWords.length ? projectWords : localWords;
    const mergedWords = normalizeDictionaryWords([
      ...(userResult.words || []),
      ...legacyProjectWords,
    ]);
    return {
      words: mergedWords,
      userWords: normalizeDictionaryWords(userResult.words || []),
      projectWords: legacyProjectWords,
      storage: userResult.storage === "database" ? "database" : (legacyProjectWords.length ? "project" : userResult.storage),
    };
  } catch {
    const mergedWords = normalizeDictionaryWords([
      ...(userResult.words || []),
      ...projectWords,
    ]);
    return {
      words: mergedWords,
      userWords: normalizeDictionaryWords(userResult.words || []),
      projectWords,
      storage: userResult.storage === "database" ? "database" : (projectWords.length ? "project" : userResult.storage),
    };
  }
};

export const saveWritingDictionaryWordsAsync = async (project, words = []) => {
  const storageKey = `writingSpellcheckDictionary:${getWritingDraftProjectId(project)}`;

  try {
    const result = await saveUserWritingDictionaryWordsAsync(words);
    try {
      localStorage.setItem(storageKey, JSON.stringify(result.words));
    } catch {}
    return result;
  } catch (error) {
    const safeWords = normalizeDictionaryWords(words);
    try {
      localStorage.setItem(storageKey, JSON.stringify(safeWords));
      return { words: safeWords, storage: "localStorage", databaseError: error };
    } catch {
      throw error;
    }
  }
};

export const loadWritingTitlePageSettingsAsync = async (project) => {
  const storageKey = `writingTitlePageSettings:${getWritingDraftProjectId(project)}`;

  try {
    const settings = await loadProjectSettings(project);
    const databaseSettings = settings?.[WRITING_TITLE_PAGE_SETTINGS_KEY];
    if (databaseSettings && typeof databaseSettings === "object") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(databaseSettings));
      } catch {}
      return { settings: databaseSettings, storage: "database" };
    }
  } catch {
    // Local fallback below.
  }

  try {
    const localSettings = JSON.parse(localStorage.getItem(storageKey) || "null");
    return {
      settings: localSettings && typeof localSettings === "object" ? localSettings : null,
      storage: localSettings ? "localStorage" : "empty",
    };
  } catch {
    return { settings: null, storage: "empty" };
  }
};

export const saveWritingTitlePageSettingsAsync = async (project, settings = {}) => {
  const storageKey = `writingTitlePageSettings:${getWritingDraftProjectId(project)}`;
  const safeSettings = settings && typeof settings === "object" ? settings : {};

  try {
    await updateProjectSettings(project, {
      [WRITING_TITLE_PAGE_SETTINGS_KEY]: safeSettings,
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(safeSettings));
    } catch {}
    return { settings: safeSettings, storage: "database" };
  } catch (error) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(safeSettings));
      return { settings: safeSettings, storage: "localStorage", databaseError: error };
    } catch {
      throw error;
    }
  }
};


const openWritingDraftDatabase = () => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WRITING_DRAFT_DB_NAME, WRITING_DRAFT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WRITING_DRAFT_STORE_NAME)) {
        db.createObjectStore(WRITING_DRAFT_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open Writing draft database."));
  });
};

const runDraftStoreOperation = async (mode, operation) => {
  const db = await openWritingDraftDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WRITING_DRAFT_STORE_NAME, mode);
    const store = transaction.objectStore(WRITING_DRAFT_STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Writing draft database operation failed."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Writing draft database transaction failed."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Writing draft database transaction aborted."));
    };
  });
};

const saveWritingDraftToIndexedDb = async (project, payload) => {
  const key = getWritingDraftStorageKey(project);
  await runDraftStoreOperation("readwrite", store => store.put({ key, payload }));
  return key;
};

const loadWritingDraftFromIndexedDb = async (project, indexedDbKey = null) => {
  const key = indexedDbKey || getWritingDraftStorageKey(project);
  const record = await runDraftStoreOperation("readonly", store => store.get(key));
  return record?.payload || null;
};

const deleteWritingDraftFromIndexedDb = async (project) => {
  try {
    await runDraftStoreOperation("readwrite", store => store.delete(getWritingDraftStorageKey(project)));
  } catch {
    // Best-effort cleanup only.
  }
};

const parseWritingDraftPayload = (project, rawDraft) => {
  if (!rawDraft) return null;
  const parsed = typeof rawDraft === "string" ? JSON.parse(rawDraft) : rawDraft;
  const nodes = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.nodes)
      ? parsed.nodes
      : [];
  const hasSceneHeading = nodes.some(node => node?.type === "Scene Heading");
  const hasMeaningfulText = nodes.some(node => String(node?.text || "").trim().length > 0);

  if (!nodes.length || (parsed?.hasUserCreatedScript !== true && !hasSceneHeading && !hasMeaningfulText)) {
    return null;
  }

  return {
    projectId: parsed?.projectId || getWritingDraftProjectId(project),
    savedAt: parsed?.savedAt || null,
    hasUserCreatedScript: parsed?.hasUserCreatedScript === true || hasSceneHeading || hasMeaningfulText,
    nodes,
  };
};

export const loadWritingDraft = (project) => {
  const emptyDraft = {
    projectId: getWritingDraftProjectId(project),
    savedAt: null,
    hasUserCreatedScript: false,
    nodes: [],
  };

  if (!project || typeof localStorage === "undefined") {
    return emptyDraft;
  }

  const parseDraft = (rawDraft) => parseWritingDraftPayload(project, rawDraft);

  // Read from current key. If it is a full payload (legacy pre-migration state),
  // return it as-is but do NOT write it back to localStorage — the async path handles
  // the IDB migration on the next load. If it is a marker, the async path handles it.
  const draft = parseDraft(localStorage.getItem(getWritingDraftStorageKey(project)));
  if (draft) return draft;

  // Legacy key fallback — read only, no localStorage write. The async loader
  // (loadWritingDraftAsync) migrates legacy entries to IDB when it next runs.
  const legacyDraft = parseDraft(localStorage.getItem(getLegacyWritingDraftStorageKey(project)));
  if (legacyDraft) return legacyDraft;

  return emptyDraft;
};

export const loadWritingDraftAsync = async (project) => {
  const emptyDraft = {
    projectId: getWritingDraftProjectId(project),
    savedAt: null,
    hasUserCreatedScript: false,
    nodes: [],
  };

  if (!project) {
    return emptyDraft;
  }

  try {
    const databaseDraft = await loadWritingDraftFromDatabase(project);
    if (databaseDraft) {
      // Always cache to IndexedDB — never write the full payload to localStorage.
      // Fire-and-forget: the database result is what we return. The IDB cache is
      // for offline/recovery and fast subsequent loads within the same session.
      saveWritingDraftToIndexedDb(project, databaseDraft).then((indexedDbKey) => {
        try {
          localStorage.setItem(getWritingDraftStorageKey(project), JSON.stringify({
            projectId: databaseDraft.projectId,
            savedAt: databaseDraft.savedAt,
            hasUserCreatedScript: databaseDraft.hasUserCreatedScript,
            storage: "indexedDB",
            indexedDbKey,
            nodeCount: databaseDraft.nodes.length,
          }));
        } catch {}
      }).catch(() => {});
      return { ...databaseDraft, storage: "database" };
    }
  } catch {
    // Local fallback below.
  }

  if (typeof localStorage === "undefined") {
    return emptyDraft;
  }

  const storageKey = getWritingDraftStorageKey(project);
  const rawDraft = localStorage.getItem(storageKey);

  if (rawDraft) {
    try {
      const parsed = JSON.parse(rawDraft);
      if (parsed?.storage === "indexedDB" && parsed?.indexedDbKey) {
        const indexedPayload = await loadWritingDraftFromIndexedDb(project, parsed.indexedDbKey);
        const indexedDraft = parseWritingDraftPayload(project, indexedPayload);
        if (indexedDraft) return { ...indexedDraft, storage: "indexedDB" };
      }

      const localDraft = parseWritingDraftPayload(project, parsed);
      if (localDraft) return { ...localDraft, storage: "localStorage" };
    } catch {
      // Fall through to legacy/sync loader below.
    }
  }

  return loadWritingDraft(project);
};

// saveWritingDraft is retained for API compatibility only — it is not called
// anywhere in the app. All active save paths use saveWritingDraftSafely().
// This version writes to IndexedDB + marker rather than a full localStorage payload.
export const saveWritingDraft = async (project, nodes = []) => {
  return saveWritingDraftSafely(project, nodes);
};

// Maximum time (ms) to wait for a Supabase database save before falling back
// to IndexedDB. Keeps the flush handler well within its own timeout budget.
const DATABASE_SAVE_TIMEOUT_MS = 10_000;

export const saveWritingDraftSafely = async (project, nodes = []) => {
  const payload = buildWritingDraftPayload(project, nodes);
  const storageKey = getWritingDraftStorageKey(project);
  let databaseError = null;

  // Helper: write to IndexedDB and replace localStorage with a tiny marker.
  // Returns the IDB key on success, null on failure (original localStorage untouched).
  const writeIdbAndMarker = async () => {
    try {
      const indexedDbKey = await saveWritingDraftToIndexedDb(project, payload);
      const marker = JSON.stringify({
        projectId: payload.projectId,
        savedAt: payload.savedAt,
        hasUserCreatedScript: payload.hasUserCreatedScript,
        storage: "indexedDB",
        indexedDbKey,
        nodeCount: payload.nodes.length,
      });
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(storageKey, marker);
        }
      } catch {}
      return indexedDbKey;
    } catch {
      // IDB write failed — do not touch localStorage.
      return null;
    }
  };

  // Race the database save against a bounded timeout. If Supabase is slow or
  // unresponsive the timeout rejects and we fall through to the IDB path below,
  // returning localOnly instead of hanging until the flush context's outer guard fires.
  const dbSaveWithTimeout = () =>
    Promise.race([
      saveWritingDraftToDatabase(project, payload),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Database save timed out after ${DATABASE_SAVE_TIMEOUT_MS / 1000}s`)),
          DATABASE_SAVE_TIMEOUT_MS
        )
      ),
    ]);

  try {
    if (process.env.NODE_ENV === "development") {
      console.time("[writingDraftPersistence] database save");
    }
    await dbSaveWithTimeout();
    if (process.env.NODE_ENV === "development") {
      console.timeEnd("[writingDraftPersistence] database save");
    }
    // Database save succeeded. Update local cache: IDB + tiny marker.
    // Fire-and-forget — a cache write failure must not downgrade a successful DB save.
    writeIdbAndMarker().catch(() => {});
    return { payload, storage: "database" };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.timeEnd("[writingDraftPersistence] database save");
      console.warn("[writingDraftPersistence] Database save failed/timed out, falling back to IDB:", error?.message);
    }
    databaseError = error;
  }

  // Database save failed or timed out. Try IDB as the local-only fallback.
  const indexedDbKey = await writeIdbAndMarker();
  if (indexedDbKey) {
    return { payload, storage: "indexedDB", localOnly: true, databaseError };
  }

  // IDB also unavailable. This is a last-resort path: no writes succeed.
  // Return memory-only so the caller can show a warning, but never throw away data.
  return { payload, storage: "memory", localOnly: true, databaseError };
};

/**
 * Load the Writing Script draft from IndexedDB only — no Supabase round-trip.
 * Returns the parsed payload or null if missing/empty.
 */
export const loadWritingDraftFromIndexedDbOnly = async (project) => {
  try {
    const raw = await loadWritingDraftFromIndexedDb(project);
    return parseWritingDraftPayload(project, raw);
  } catch {
    return null;
  }
};

/**
 * Load the Writing Script draft from IndexedDB using an explicit IDB key.
 * Used by the Save Verification proxy to load the exact record a localStorage
 * marker points to, without a Supabase round-trip.
 * Returns the parsed payload or null if missing/empty.
 */
export const loadWritingDraftFromIndexedDbByKey = async (project, indexedDbKey) => {
  try {
    const raw = await loadWritingDraftFromIndexedDb(project, indexedDbKey || null);
    return parseWritingDraftPayload(project, raw);
  } catch {
    return null;
  }
};

/**
 * Load the Writing Script draft from Supabase only — no IDB or localStorage fallback.
 * Returns the parsed payload or null if missing/empty.
 * Throws on Supabase errors (caller should catch).
 */
export const loadWritingDraftFromDatabaseOnly = async (project) => {
  if (!project?.id) return null;
  const draft = await loadWritingDraftFromDatabase(project);
  return draft || null;
};

/**
 * Save a pre-built Writing Script payload directly to Supabase (projects.settings).
 * Guards against empty payloads — throws if nodes.length === 0.
 * Used by recovery/attach flow. Does NOT rebuild payload — accepts an already-normalized payload.
 */
export const saveWritingDraftPayloadToDatabase = async (project, payload) => {
  if (!payload || !Array.isArray(payload.nodes) || payload.nodes.length === 0) {
    throw new Error("Cannot save empty Writing Script payload to database.");
  }
  if (!project?.id) {
    throw new Error("Cannot save Writing Script: no project database ID.");
  }
  await saveWritingDraftToDatabase(project, payload);
  return payload;
};

/**
 * Save a pre-built Writing Script payload directly to IndexedDB.
 * Guards against empty payloads.
 * Returns the IDB key on success. Does NOT touch localStorage.
 */
export const saveWritingDraftPayloadToIndexedDb = async (project, payload) => {
  if (!payload || !Array.isArray(payload.nodes) || payload.nodes.length === 0) {
    throw new Error("Cannot save empty Writing Script payload to IndexedDB.");
  }
  const key = await saveWritingDraftToIndexedDb(project, payload);
  return key;
};

/**
 * Write the localStorage marker for a Writing Script IDB record.
 * Marker shape: { projectId, savedAt, hasUserCreatedScript, storage:"indexedDB", indexedDbKey, nodeCount }
 */
export const writeWritingDraftMarker = (project, payload, indexedDbKey) => {
  try {
    const storageKey = getWritingDraftStorageKey(project);
    const marker = JSON.stringify({
      projectId: payload.projectId,
      savedAt: payload.savedAt,
      hasUserCreatedScript: payload.hasUserCreatedScript,
      storage: "indexedDB",
      indexedDbKey,
      nodeCount: payload.nodes.length,
    });
    localStorage.setItem(storageKey, marker);
    return true;
  } catch {
    return false;
  }
};

export const clearWritingDraft = (project) => {
  if (project && typeof localStorage !== "undefined") {
    localStorage.removeItem(getWritingDraftStorageKey(project));
  }
  if (project) deleteWritingDraftFromIndexedDb(project);
};
