// ─── Writing Characters Model ─────────────────────────────────────────────────
// Pure data model helpers — no React, no persistence, no side effects.
//
// ISOLATION CONTRACT:
//   • Writing Characters are a Writing-only subsystem, completely separate from
//     Production Characters and Script Breakdown.
//   • Profiles, aliases, merges, and suppressions live in project.settings under
//     the "writingCharacterProfiles" key — not in the characters or cast tables.
//   • Scene appearances derive from committed Writing script nodes only.
//   • Any future handoff from Writing Characters to Production Characters must be
//     an explicit manual user action — never automatic.

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

    role: "Supporting",
    notes: "",

    // Merge fields
    status: "active",           // "active" | "merged"
    mergedIntoProfileId: null,
    mergedAt: null,
    mergeHistory: [],           // [{ sourceProfileId, sourceCanonicalName, mergedIntoProfileId, mergedAt, sourceSnapshot }]

    // Phase 2+ scaffolded fields
    biography: "",
    psychology: "",
    motivation: "",
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
    // castingCandidates: each { id, name, imdbUrl, headshotUrl, knownFor: [{ title, imdbUrl }] }
    castingCandidates: [],

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
    // sceneSuppresssions: { [profileId]: string[] } — sceneIds suppressed per profile.
    // Stored as arrays for JSON serialization; converted to Sets at use sites.
    sceneSuppresssions:
      src.sceneSuppresssions && typeof src.sceneSuppresssions === "object" && !Array.isArray(src.sceneSuppresssions)
        ? src.sceneSuppresssions
        : {},
    // consumedScriptImportSignals: { [projectId]: { lastConsumedImportedAt, lastConsumedNodeCount, consumedAt } }
    // Prevents the same import event from reopening the suggestions modal on reload.
    consumedScriptImportSignals:
      src.consumedScriptImportSignals && typeof src.consumedScriptImportSignals === "object" && !Array.isArray(src.consumedScriptImportSignals)
        ? src.consumedScriptImportSignals
        : {},
    savedAt: src.savedAt || null,
  };
}

// Ensure a single profile has all expected fields (safe to call on load).
export function normalizeWritingCharacterProfile(raw) {
  if (!raw || typeof raw !== "object") return raw;
  return {
    ...raw,
    castingCandidates: Array.isArray(raw.castingCandidates) ? raw.castingCandidates : [],
    motivation: raw.motivation ?? "",
    biography: raw.biography ?? "",
    psychology: raw.psychology ?? "",
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    wardrobe: raw.wardrobe ?? "",
    voice: raw.voice ?? "",
    arc: raw.arc ?? "",
    secrets: raw.secrets ?? "",
    references: Array.isArray(raw.references) ? raw.references : [],
  };
}

// Returns active (non-merged) profiles sorted by scene count descending.
export function getWritingCharacterProfilesArray(data) {
  const profiles = data?.profiles || {};
  return Object.values(profiles)
    .filter((p) => p.status !== "merged")
    .sort((a, b) => {
      if ((b.sceneCount || 0) !== (a.sceneCount || 0))
        return (b.sceneCount || 0) - (a.sceneCount || 0);
      return (a.canonicalName || "").localeCompare(b.canonicalName || "");
    });
}
