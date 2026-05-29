// Pure data model helpers — no React, no persistence, no side effects.

export const WRITING_CHARACTER_PROFILES_VERSION = 1;

export function makeEmptyCharacterProfile(normalizedKey, displayName, extracted = {}) {
  const now = new Date().toISOString();
  return {
    id: normalizedKey,
    canonicalName: displayName || normalizedKey,
    aliases: [],
    ignoredAliases: [],

    firstAppearanceSceneHeading: extracted.firstAppearanceSceneHeading || "",
    firstAppearanceSceneId: extracted.firstAppearanceSceneId || null,
    sceneIds: Array.isArray(extracted.sceneIds)
      ? extracted.sceneIds
      : extracted.sceneIds instanceof Set
        ? Array.from(extracted.sceneIds)
        : [],
    sceneCount: extracted.sceneCount ?? 0,

    role: "",
    notes: "",

    // Phase 2+ scaffolded fields — not shown in Phase 1 UI
    biography: "",
    psychology: "",
    storyFunction: "",
    relationships: [],
    physicality: "",
    wardrobe: "",
    voice: "",
    arc: "",
    secrets: "",
    references: [],
    avatarUrl: null,
    castingIdea: "",

    createdAt: extracted.createdAt || now,
    updatedAt: extracted.updatedAt || now,
  };
}

export function normalizeWritingCharacterProfiles(raw) {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    version: src.version ?? WRITING_CHARACTER_PROFILES_VERSION,
    profiles:
      src.profiles && typeof src.profiles === "object" && !Array.isArray(src.profiles)
        ? src.profiles
        : {},
    resolution:
      src.resolution && typeof src.resolution === "object" ? src.resolution : {},
    ignoredSuggestions: Array.isArray(src.ignoredSuggestions)
      ? src.ignoredSuggestions
      : [],
    savedAt: src.savedAt || null,
  };
}

export function getWritingCharacterProfilesArray(data) {
  const profiles = data?.profiles || {};
  return Object.values(profiles).sort((a, b) => {
    if ((b.sceneCount || 0) !== (a.sceneCount || 0))
      return (b.sceneCount || 0) - (a.sceneCount || 0);
    return (a.canonicalName || "").localeCompare(b.canonicalName || "");
  });
}
