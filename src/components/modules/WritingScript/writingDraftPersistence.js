import { supabase } from "../../../supabase";

const DEFAULT_PROJECT_ID = "default-project";
const WRITING_DRAFT_DB_NAME = "FilmProductionBinderWritingDrafts";
const WRITING_DRAFT_DB_VERSION = 1;
const WRITING_DRAFT_STORE_NAME = "drafts";
const WRITING_DRAFT_SETTINGS_KEY = "writingScriptDraft";
const WRITING_DICTIONARY_SETTINGS_KEY = "writingSpellcheckDictionaryWords";
const WRITING_TITLE_PAGE_SETTINGS_KEY = "writingTitlePageSettings";
const LOCAL_STORAGE_SAFE_LIMIT = 2500000;

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

const isQuotaExceededError = (err) => {
  return err?.name === "QuotaExceededError" ||
    err?.code === 22 ||
    err?.code === 1014;
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

  const draft = parseDraft(localStorage.getItem(getWritingDraftStorageKey(project)));
  if (draft) return draft;

  const legacyDraft = parseDraft(localStorage.getItem(getLegacyWritingDraftStorageKey(project)));
  if (legacyDraft) {
    try {
      localStorage.setItem(getWritingDraftStorageKey(project), JSON.stringify(legacyDraft));
    } catch {
      // Large legacy drafts may not fit during migration; the async loader/save path
      // will use IndexedDB on the next write.
    }
    return legacyDraft;
  }

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
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(getWritingDraftStorageKey(project), JSON.stringify(databaseDraft));
        } catch {
          // Cache only; database remains the source of truth.
        }
      }
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

export const saveWritingDraft = (project, nodes = []) => {
  const payload = buildWritingDraftPayload(project, nodes);

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(getWritingDraftStorageKey(project), JSON.stringify(payload));
  }

  return payload;
};

export const saveWritingDraftSafely = async (project, nodes = []) => {
  const payload = buildWritingDraftPayload(project, nodes);
  const storageKey = getWritingDraftStorageKey(project);
  const serializedPayload = JSON.stringify(payload);
  let databaseError = null;

  try {
    await saveWritingDraftToDatabase(project, payload);
    if (typeof localStorage !== "undefined") {
      try {
        if (serializedPayload.length <= LOCAL_STORAGE_SAFE_LIMIT) {
          localStorage.setItem(storageKey, serializedPayload);
          deleteWritingDraftFromIndexedDb(project);
        } else {
          const indexedDbKey = await saveWritingDraftToIndexedDb(project, payload);
          localStorage.setItem(storageKey, JSON.stringify({
            projectId: payload.projectId,
            savedAt: payload.savedAt,
            hasUserCreatedScript: payload.hasUserCreatedScript,
            storage: "indexedDB",
            indexedDbKey,
            nodeCount: payload.nodes.length,
          }));
        }
      } catch {
        // Cache failure should not downgrade a successful database save.
      }
    }
    return { payload, storage: "database" };
  } catch (error) {
    databaseError = error;
  }

  if (typeof localStorage === "undefined") {
    return { payload, storage: "memory", databaseError };
  }

  try {
    if (serializedPayload.length <= LOCAL_STORAGE_SAFE_LIMIT) {
      localStorage.setItem(storageKey, serializedPayload);
      deleteWritingDraftFromIndexedDb(project);
      return { payload, storage: "localStorage", localOnly: true, databaseError };
    }
    throw { name: "QuotaExceededError" };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      throw err;
    }

    const indexedDbKey = await saveWritingDraftToIndexedDb(project, payload);
    const marker = {
      projectId: payload.projectId,
      savedAt: payload.savedAt,
      hasUserCreatedScript: payload.hasUserCreatedScript,
      storage: "indexedDB",
      indexedDbKey,
      nodeCount: payload.nodes.length,
    };

    localStorage.removeItem(storageKey);
    localStorage.setItem(storageKey, JSON.stringify(marker));
    return { payload, storage: "indexedDB", quotaExceeded: true, localOnly: true, databaseError };
  }
};

export const clearWritingDraft = (project) => {
  if (project && typeof localStorage !== "undefined") {
    localStorage.removeItem(getWritingDraftStorageKey(project));
  }
  if (project) deleteWritingDraftFromIndexedDb(project);
};
