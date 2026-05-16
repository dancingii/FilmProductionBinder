// Dual-read compatibility layer for prop.scenes entries.
//
// prop.scenes may contain:
//   - legacy integer sceneNumbers  (e.g. 3, "3")
//   - UUID scene.id refs           (e.g. "a1b2c3d4-...")
//   - mixed arrays of both formats
//
// All helpers treat UUIDs as canonical identity.
// Integer refs continue to work via sceneNumber comparison.
// No destructive migration — callers decide when to upgrade a ref.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when ref is a UUID string. */
export const isSceneIdRef = (ref) => UUID_RE.test(String(ref ?? ""));

/**
 * Does a prop scene ref match a given scene?
 * UUID ref  → compares scene.id
 * integer/string ref → compares scene.sceneNumber
 */
export const sceneMatchesPropSceneRef = (scene, ref) => {
  if (!scene || ref == null) return false;
  if (isSceneIdRef(ref)) return scene.id === ref;
  return String(scene.sceneNumber) === String(ref);
};

/**
 * Resolve a prop scene ref to { scene, index } in the live scenes array.
 * Returns { scene: null, index: -1 } when not found.
 */
export const resolvePropSceneRef = (ref, scenes) => {
  if (ref == null || !Array.isArray(scenes)) return { scene: null, index: -1 };
  const index = isSceneIdRef(ref)
    ? scenes.findIndex((s) => s.id === ref)
    : scenes.findIndex((s) => String(s.sceneNumber) === String(ref));
  return { scene: index >= 0 ? scenes[index] : null, index };
};

/** Return scene.id[] for every ref in prop.scenes that resolves to a live scene. */
export const getPropSceneIds = (prop, scenes) =>
  (prop?.scenes || [])
    .map((ref) => resolvePropSceneRef(ref, scenes))
    .filter(({ scene }) => scene != null)
    .map(({ scene }) => scene.id);

/**
 * Return sceneNumber[] for every ref in prop.scenes that resolves to a live scene.
 * For display and legacy navigation only — not identity.
 */
export const getPropSceneNumbersForDisplay = (prop, scenes) =>
  (prop?.scenes || [])
    .map((ref) => resolvePropSceneRef(ref, scenes))
    .filter(({ scene }) => scene != null)
    .map(({ scene }) => scene.sceneNumber);

/**
 * Add a scene to a prop.scenes array.
 * Removes any existing ref that matches the scene (by UUID or sceneNumber),
 * then appends the canonical scene.id UUID.
 * Write-forward: once touched, the entry is always a UUID.
 */
export const normalizePropScenesOnAdd = (propScenes, scene) => {
  const filtered = (propScenes || []).filter(
    (ref) => !sceneMatchesPropSceneRef(scene, ref)
  );
  return [...filtered, scene.id];
};

/**
 * Remove all refs matching a scene from a prop.scenes array.
 * Handles both UUID and legacy integer refs.
 */
export const normalizePropScenesOnRemove = (propScenes, scene) =>
  (propScenes || []).filter((ref) => !sceneMatchesPropSceneRef(scene, ref));
