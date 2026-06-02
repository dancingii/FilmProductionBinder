// ─── Writing Characters Persistence ──────────────────────────────────────────
// Saves/loads Writing Character profiles as part of project.settings.
//
// ISOLATION CONTRACT:
//   • Writing Character profiles are stored in project.settings["writingCharacterProfiles"].
//   • This is entirely separate from the characters, cast, or breakdown tables.
//   • Profiles contain Writing-only metadata: aliases, merges, suppressions, notes, role.
//   • Nothing here reads or writes Production Characters or Script Breakdown data.
import { supabase } from "../../../supabase";

export const WRITING_CHARACTER_PROFILES_SETTINGS_KEY = "writingCharacterProfiles";

const getProjectId = (project) => {
  if (!project) return "default-project";
  if (typeof project === "string") return project || "default-project";
  return project.id || project.name || "default-project";
};

export const getWritingCharactersStorageKey = (project) =>
  `writingCharacterProfiles:${getProjectId(project)}`;

// ─── Internal Supabase helpers (self-contained, mirrors writingDraftPersistence pattern) ────

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
  if (!project?.id) throw new Error("No project id for writing character profiles save.");
  const current = await loadProjectSettings(project);
  const next = { ...(current || {}), ...settingsPatch };
  const { error } = await supabase
    .from("projects")
    .update({ settings: next })
    .eq("id", project.id);
  if (error) throw error;
  return next;
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const loadWritingCharacterProfilesAsync = async (project) => {
  const storageKey = getWritingCharactersStorageKey(project);

  // Database first
  try {
    const settings = await loadProjectSettings(project);
    const dbData = settings?.[WRITING_CHARACTER_PROFILES_SETTINGS_KEY];
    if (dbData && typeof dbData === "object") {
      try { localStorage.setItem(storageKey, JSON.stringify(dbData)); } catch {}
      return { data: dbData, storage: "database" };
    }
    // Key not present in settings yet — return null (caller normalizes)
    return { data: null, storage: "empty" };
  } catch {}

  // localStorage fallback
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { data: parsed, storage: "localStorage" };
    }
  } catch {}

  return { data: null, storage: "empty" };
};

export const saveWritingCharacterProfilesAsync = async (project, data) => {
  const storageKey = getWritingCharactersStorageKey(project);

  try {
    await updateProjectSettings(project, {
      [WRITING_CHARACTER_PROFILES_SETTINGS_KEY]: data,
    });
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
    return { storage: "database" };
  } catch (dbError) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      return { storage: "localStorage", databaseError: dbError };
    } catch {
      throw dbError;
    }
  }
};
