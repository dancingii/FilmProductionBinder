// scene.sceneNumber is internal/canonical — used for persistence, sync, and ordering.
// Display labels are derived/presentation only. Do not use them as DB keys,
// stripboard sync IDs, revision diff keys, or any persistence identifiers.
// Inserted scenes (Boolean(scene.metadata?.replacementLetter)) do not consume
// a whole-number display count; they render as <prevNormal><letter> (e.g. "2A").

/**
 * Builds a Map<sceneId, displayLabel> derived from the scenes array order.
 * Normal scenes advance the whole-number display counter; inserted scenes
 * share the previous normal scene's display number and append their
 * replacementLetter.
 *
 * Example input array order: normal A, normal B, inserted C (letter "A"),
 * inserted D (letter "B"), normal E
 * Result map: A→"1", B→"2", C→"2A", D→"2B", E→"3"
 */
export const buildSceneDisplayLabelMap = (scenes) => {
  const map = new Map();
  if (!Array.isArray(scenes)) return map;
  let counter = 0;
  scenes.forEach((scene) => {
    if (!scene?.id) return;
    if (Boolean(scene.metadata?.replacementLetter)) {
      map.set(scene.id, `${counter}${scene.metadata.replacementLetter}`);
    } else {
      counter += 1;
      map.set(scene.id, String(counter));
    }
  });
  return map;
};

/**
 * Returns the display label for a scene.
 *
 * Call signatures:
 *   getSceneDisplayLabel(scene)
 *     → legacy fallback: sceneNumber + replacementLetter (existing behavior,
 *       all call sites without a second arg continue to work unchanged)
 *   getSceneDisplayLabel(scene, labelMap)
 *     → look up pre-built Map<id, label> from buildSceneDisplayLabelMap
 *   getSceneDisplayLabel(scene, scenesArray)
 *     → build map on-the-fly from the array, then look up
 */
export const getSceneDisplayLabel = (scene, scenesOrLabelMap) => {
  if (scene?.metadata?.writingDraft) {
    const scriptOrder = Number(scene?.metadata?.scriptOrder);

    if (Number.isFinite(scriptOrder) && scriptOrder > 0) {
      return String(scriptOrder);
    }
  }

  if (scenesOrLabelMap instanceof Map) {
    return (
      scenesOrLabelMap.get(scene?.id) ??
      `${scene?.sceneNumber ?? ""}${scene?.metadata?.replacementLetter || ""}`
    );
  }
  if (Array.isArray(scenesOrLabelMap)) {
    const map = buildSceneDisplayLabelMap(scenesOrLabelMap);
    return (
      map.get(scene?.id) ??
      `${scene?.sceneNumber ?? ""}${scene?.metadata?.replacementLetter || ""}`
    );
  }
  // Legacy: sceneNumber + replacementLetter concat — preserves current behavior
  return `${scene?.sceneNumber ?? ""}${scene?.metadata?.replacementLetter || ""}`;
};
