// Pure extraction utilities — no React, no app state, no side effects.

export function normalizeCharacterName(rawText) {
  return String(rawText || "")
    .replace(/\s*\(V\.?O\.?\)\s*$/i, "")
    .replace(/\s*\(O\.?S\.?\)\s*$/i, "")
    .replace(/\s*\(O\.?C\.?\)\s*$/i, "")
    .replace(/\s*\(CONT'?D\.?\)\s*$/i, "")
    .replace(/\s*\(CONTD\)\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")   // catch-all: strip any remaining trailing (...)
    .trim()
    .toUpperCase();
}

export function deriveCharacterKey(normalizedName) {
  return normalizedName.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

export function deriveDisplayName(normalizedName) {
  return normalizedName
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Returns Map<canonicalKey, ExtractedCharacter>
// ExtractedCharacter: {
//   normalizedKey, displayName,
//   firstAppearanceSceneId, firstAppearanceSceneHeading,
//   firstNodeIndex,        ← index in nodes array of the first Character node
//   sceneIds: Set<string>, sceneCount,
//   rawKeys: Set<string>,  ← all raw script keys that resolved to this canonical key
// }
//
// Optional `resolution` map: { [rawKey]: canonicalKey }
// When a raw character key is in resolution, its appearances are counted under the
// canonical key. This allows YOUNG_SADIE → SADIE without changing script text.
export function extractWritingCharacters(nodes, resolution = {}) {
  const result = new Map();
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeResolution =
    resolution && typeof resolution === "object" && !Array.isArray(resolution)
      ? resolution
      : {};

  for (let i = 0; i < safeNodes.length; i++) {
    const node = safeNodes[i];
    if (!node || node.type !== "Character") continue;

    const normalized = normalizeCharacterName(node.text);
    if (!normalized) continue;

    const rawKey = deriveCharacterKey(normalized);
    if (!rawKey) continue;

    // Resolve to canonical key if this name is merged/aliased
    const canonicalKey = safeResolution[rawKey] || rawKey;
    const sceneId = node.sceneId || null;

    if (!result.has(canonicalKey)) {
      // Find the most recent Scene Heading with matching sceneId
      let headingText = "";
      for (let j = i - 1; j >= 0; j--) {
        const prev = safeNodes[j];
        if (prev && prev.type === "Scene Heading" && prev.sceneId === sceneId) {
          headingText = String(prev.text || "");
          break;
        }
        if (prev && prev.type === "Scene Heading" && prev.sceneId !== sceneId) break;
      }

      // Display name uses the canonical key when resolving an alias
      const isResolved = canonicalKey !== rawKey;
      const displayNormalized = isResolved
        ? canonicalKey.replace(/_/g, " ")
        : normalized;

      result.set(canonicalKey, {
        normalizedKey: canonicalKey,
        rawKey,
        displayName: deriveDisplayName(displayNormalized),
        firstAppearanceSceneId: sceneId,
        firstAppearanceSceneHeading: headingText,
        firstNodeIndex: i,
        sceneIds: new Set(sceneId ? [sceneId] : []),
        rawKeys: new Set([rawKey]),
      });
    } else {
      const ec = result.get(canonicalKey);
      if (sceneId) ec.sceneIds.add(sceneId);
      ec.rawKeys.add(rawKey);
    }
  }

  // Attach sceneCount as a plain number for convenience
  result.forEach((ec) => {
    ec.sceneCount = ec.sceneIds.size;
  });

  return result;
}
