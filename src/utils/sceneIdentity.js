export const getSceneId = (ref) => {
  if (!ref) return null;
  if (typeof ref === "object") {
    if (ref.id) return ref.id;
    if (ref.sceneId) return ref.sceneId;
    if (ref.scene_id) return ref.scene_id;
    if (ref.scene) return getSceneId(ref.scene);
  }
  return null;
};

export const getSceneNumber = (ref) => {
  if (ref === null || ref === undefined || ref === "") return null;
  if (typeof ref === "object") {
    if (ref.sceneNumber !== undefined && ref.sceneNumber !== null) {
      return ref.sceneNumber;
    }
    if (ref.scene_number !== undefined && ref.scene_number !== null) {
      return ref.scene_number;
    }
    if (ref.number !== undefined && ref.number !== null) return ref.number;
    if (ref.scene) return getSceneNumber(ref.scene);
    return null;
  }
  return ref;
};

export const sameScene = (a, b) => {
  const aId = getSceneId(a);
  const bId = getSceneId(b);
  if (aId && bId) return String(aId) === String(bId);

  const aNumber = getSceneNumber(a);
  const bNumber = getSceneNumber(b);
  if (aNumber === null || bNumber === null) return false;
  return String(aNumber) === String(bNumber);
};

export const normalizeSceneRef = (scene) => {
  if (!scene || typeof scene !== "object") return scene;

  const sceneId = getSceneId(scene);
  const sceneNumber = getSceneNumber(scene);
  return {
    ...scene,
    ...(sceneId ? { sceneId } : {}),
    ...(sceneNumber !== null ? { sceneNumber } : {}),
  };
};

export const normalizeScheduleBlock = (block) => {
  if (!block || typeof block !== "object") return block;
  if (!block.scene || typeof block.scene !== "object") {
    if (Object.prototype.hasOwnProperty.call(block, "scene")) {
      const { sceneId, sceneNumber, ...rest } = block;
      return rest;
    }
    return block;
  }

  const scene = normalizeSceneRef(block.scene);
  const sceneId = getSceneId(scene);
  const sceneNumber = getSceneNumber(scene);

  return {
    ...block,
    scene,
    ...(sceneId ? { sceneId } : {}),
    ...(sceneNumber !== null ? { sceneNumber } : {}),
  };
};
