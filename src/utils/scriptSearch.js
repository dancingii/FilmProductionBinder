// Reusable script phrase-search utility.
// Returns UUID-based instance IDs — scene.id is the stable anchor,
// not a transient sceneIndex that breaks on reorder/insert/delete.
// Caller passes stemWordFn; this module has zero React dependencies.

const UUID_PREFIX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Resolve the current scenes-array index for an instance ID.
 * Supports both UUID-based IDs (new) and legacy positional IDs (old).
 *
 * UUID format  : `<scene.id>-<blockIndex>-<wordIndex>` or `<scene.id>-manual-<ts>`
 * Legacy format: `<sceneIndex>-<blockIndex>-<wordIndex>` or `<sceneIndex>-manual-<ts>`
 *   (first segment is a pure integer)
 *
 * Returns -1 when the scene is not found (e.g. scene deleted after tag was created).
 */
export const resolveInstanceSceneIndex = (instanceId, scenes) => {
  if (!instanceId || typeof instanceId !== "string") return -1;
  if (UUID_PREFIX_RE.test(instanceId)) {
    const sceneId = instanceId.slice(0, 36);
    return scenes.findIndex((s) => s.id === sceneId);
  }
  const parsed = parseInt(instanceId.split("-")[0], 10);
  return Number.isFinite(parsed) ? parsed : -1;
};

export const normalizeSearchWords = (query, stemWordFn) => {
  if (!query?.trim() || typeof stemWordFn !== "function") return [];
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\w]/g, ""))
    .filter(Boolean)
    .map((word) => stemWordFn(word));
};

export const createScriptSearchKey = (query, stemWordFn) => {
  return normalizeSearchWords(query, stemWordFn).join(" ");
};

export const cleanVisiblePhrase = (query = "") => {
  return String(query || "").trim().replace(/\s+/g, " ");
};

/**
 * Search all scenes for every occurrence of a word or multi-word phrase.
 * Uses stemmed prefix matching — same logic as Props.js searchScript.
 *
 * Instance IDs are UUID-based: `${scene.id}-${blockIndex}-${wordIndex}`.
 * For a 2-word phrase, TWO instance IDs are pushed per match occurrence
 * (one per matched word), so every matched word is individually addressable.
 *
 * @param {Array}    scenes     — scene objects with .id, .content[], .sceneNumber
 * @param {string}   query      — word or phrase to search for
 * @param {Function} stemWordFn — (word: string) => string stemmer
 * @returns {{
 *   instanceIds:  string[],  // UUID instance IDs for every matched word position
 *   sceneIds:     string[],  // de-duped scene.id values containing at least one match
 *   sceneNumbers: number[]   // de-duped scene.sceneNumber values (legacy companion)
 * }}
 */
export const searchScript = (scenes, query, stemWordFn) => {
  const instanceIds = [];
  const sceneIds = [];
  const sceneNumbers = [];
  const matchGroups = [];
  const instancesByScene = {};

  if (
    !query?.trim() ||
    !Array.isArray(scenes) ||
    typeof stemWordFn !== "function"
  ) {
    return { instanceIds, sceneIds, sceneNumbers, matchGroups, instancesByScene, sceneIndices: [] };
  }

  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isMultiWord = queryWords.length > 1;
  const stemmedQueryWords = normalizeSearchWords(query, stemWordFn);
  if (stemmedQueryWords.length === 0) {
    return { instanceIds, sceneIds, sceneNumbers, matchGroups, instancesByScene, sceneIndices: [] };
  }

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    if (!scene?.content || !scene?.id) continue;
    let sceneMatched = false;

    for (let bi = 0; bi < scene.content.length; bi++) {
      const block = scene.content[bi];
      if (!block?.text) continue;

      const rawTokens = block.text.split(/(\s+)/);
      const wordTokens = [];
      for (let wi = 0; wi < rawTokens.length; wi++) {
        if (rawTokens[wi].trim()) wordTokens.push({ wi, text: rawTokens[wi] });
      }

      for (let ti = 0; ti < wordTokens.length; ti++) {
        const token = wordTokens[ti];
        const clean = token.text.toLowerCase().replace(/[^\w]/g, "");
        const stemmed = stemWordFn(clean);

        if (isMultiWord) {
          if (!stemmed.startsWith(stemmedQueryWords[0])) continue;
          let matched = true;
          for (let qi = 1; qi < stemmedQueryWords.length; qi++) {
            const nextToken = wordTokens[ti + qi];
            if (!nextToken) {
              matched = false;
              break;
            }
            const nextStemmed = stemWordFn(
              nextToken.text.toLowerCase().replace(/[^\w]/g, "")
            );
            if (!nextStemmed.startsWith(stemmedQueryWords[qi])) {
              matched = false;
              break;
            }
          }
          if (!matched) continue;
          const groupIds = [];
          const visibleWords = [];
          for (let qi = 0; qi < stemmedQueryWords.length; qi++) {
            const t = wordTokens[ti + qi];
            const instanceId = `${scene.id}-${bi}-${t.wi}`;
            groupIds.push(instanceId);
            visibleWords.push(t.text);
            instanceIds.push(instanceId);
          }
          const primaryInstanceId = groupIds[0];
          if (!instancesByScene[si]) instancesByScene[si] = [];
          instancesByScene[si].push(primaryInstanceId);
          instancesByScene[`_group_${primaryInstanceId}`] = groupIds;
          matchGroups.push({
            primaryInstanceId,
            instanceIds: groupIds,
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            sceneIndex: si,
            blockIndex: bi,
            startWordIndex: wordTokens[ti].wi,
            phraseText: visibleWords.join(" "),
          });
        } else {
          // Single word: prefix match
          if (
            !stemmed.startsWith(stemmedQueryWords[0]) &&
            !clean.startsWith(queryWords[0])
          )
            continue;
          const instanceId = `${scene.id}-${bi}-${token.wi}`;
          instanceIds.push(instanceId);
          if (!instancesByScene[si]) instancesByScene[si] = [];
          instancesByScene[si].push(instanceId);
          matchGroups.push({
            primaryInstanceId: instanceId,
            instanceIds: [instanceId],
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            sceneIndex: si,
            blockIndex: bi,
            startWordIndex: token.wi,
            phraseText: token.text,
          });
        }

        if (!sceneMatched) {
          sceneMatched = true;
          sceneIds.push(scene.id);
          sceneNumbers.push(scene.sceneNumber);
        }
      }
    }
  }

  const sceneIndices = Object.keys(instancesByScene)
    .filter((key) => !key.startsWith("_group_"))
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  return { instanceIds, sceneIds, sceneNumbers, matchGroups, instancesByScene, sceneIndices };
};
