// ─── Writing Characters Extraction ───────────────────────────────────────────
// Pure extraction utilities — no React, no app state, no side effects.
//
// ISOLATION CONTRACT:
//   • Reads committed Writing script nodes only (writingDraftNodes).
//   • Never reads live editor typing state or Production Characters.
//   • Never writes anything — all writes go through writingCharactersPersistence.
//   • Scene detection: Character speaker nodes + Action-line name mentions.
//   • Dialogue text mentions are deliberately excluded (too many false positives).

export function normalizeCharacterName(rawText) {
  return String(rawText || "")
    .replace(/\s*\(V\.?O\.?\)\s*$/i, "")
    .replace(/\s*\(O\.?S\.?\)\s*$/i, "")
    .replace(/\s*\(O\.?C\.?\)\s*$/i, "")
    .replace(/\s*\(CONT'?D\.?\)\s*$/i, "")
    .replace(/\s*\(CONTD\)\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
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

function buildActionMentionRegex(nameVariants) {
  const escaped = nameVariants
    .filter(Boolean)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return null;
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
}

// Returns Map<canonicalKey, ExtractedCharacter>
// ExtractedCharacter: {
//   normalizedKey, displayName,
//   firstAppearanceSceneId, firstAppearanceSceneHeading,
//   firstNodeIndex,
//   sceneIds: Set<string>,
//   sceneCount,
//   rawKeys: Set<string>,
//   sceneAppearances: Map<sceneId, SceneAppearance>
// }
//
// SceneAppearance: {
//   sceneId: string,
//   sources: Array<{ nodeIndex, nodeId, nodeType: "Character"|"Action", matchedName }>
// }
//
// Scene detection:
//   • Character speaker nodes — always counted
//   • Action node text mentions — word-boundary, case-insensitive
//   • Dialogue text — intentionally excluded
export function extractWritingCharacters(nodes, resolution = {}) {
  const result = new Map();
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeResolution =
    resolution && typeof resolution === "object" && !Array.isArray(resolution)
      ? resolution
      : {};

  const addSource = (ec, sceneId, source) => {
    if (!sceneId) return;
    ec.sceneIds.add(sceneId);
    if (!ec.sceneAppearances.has(sceneId)) {
      ec.sceneAppearances.set(sceneId, { sceneId, sources: [] });
    }
    ec.sceneAppearances.get(sceneId).sources.push(source);
  };

  // ── Phase 1: Character speaker nodes ─────────────────────────────────────
  for (let i = 0; i < safeNodes.length; i++) {
    const node = safeNodes[i];
    if (!node || node.type !== "Character") continue;

    const normalized = normalizeCharacterName(node.text);
    if (!normalized) continue;

    const rawKey = deriveCharacterKey(normalized);
    if (!rawKey) continue;

    const canonicalKey = safeResolution[rawKey] || rawKey;
    const sceneId = node.sceneId || null;

    if (!result.has(canonicalKey)) {
      let headingText = "";
      for (let j = i - 1; j >= 0; j--) {
        const prev = safeNodes[j];
        if (prev && prev.type === "Scene Heading" && prev.sceneId === sceneId) {
          headingText = String(prev.text || "");
          break;
        }
        if (prev && prev.type === "Scene Heading" && prev.sceneId !== sceneId) break;
      }

      const isResolved = canonicalKey !== rawKey;
      const displayNormalized = isResolved ? canonicalKey.replace(/_/g, " ") : normalized;

      result.set(canonicalKey, {
        normalizedKey: canonicalKey,
        rawKey,
        displayName: deriveDisplayName(displayNormalized),
        firstAppearanceSceneId: sceneId,
        firstAppearanceSceneHeading: headingText,
        firstNodeIndex: i,
        sceneIds: new Set(),
        rawKeys: new Set([rawKey]),
        sceneAppearances: new Map(),
      });
    } else {
      result.get(canonicalKey).rawKeys.add(rawKey);
    }

    const ec = result.get(canonicalKey);
    addSource(ec, sceneId, {
      nodeIndex: i,
      nodeId: node.id || null,
      nodeType: "Character",
      matchedName: normalized,
    });
  }

  // ── Phase 2: Action-line mentions ─────────────────────────────────────────
  result.forEach((ec) => {
    const nameVariants = new Set();
    nameVariants.add(ec.displayName);
    ec.rawKeys.forEach((rk) => {
      const spaced = rk.replace(/_/g, " ");
      nameVariants.add(spaced);
      nameVariants.add(deriveDisplayName(spaced));
    });
    const regex = buildActionMentionRegex(Array.from(nameVariants));
    if (!regex) return;

    for (let i = 0; i < safeNodes.length; i++) {
      const node = safeNodes[i];
      if (!node || node.type !== "Action") continue;
      const text = String(node.text || "");
      if (!text) continue;
      const match = regex.exec(text);
      if (!match) continue;
      const sceneId = node.sceneId || null;
      addSource(ec, sceneId, {
        nodeIndex: i,
        nodeId: node.id || null,
        nodeType: "Action",
        matchedName: match[0],
      });
    }
  });

  result.forEach((ec) => {
    ec.sceneCount = ec.sceneIds.size;
  });

  return result;
}
