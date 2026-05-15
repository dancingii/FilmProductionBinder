import { createSceneId, isValidSceneId } from "../../../utils/sceneIdentity";

export const SCRIPT_WRITING_NODE_TYPES = [
  "Scene Heading",
  "Action",
  "Character",
  "Dialogue",
  "Parenthetical",
  "Transition",
  "Shot",
];

export const DEFAULT_BODY_BLOCK_TYPE = "Action";

const VALID_NODE_TYPES = new Set(SCRIPT_WRITING_NODE_TYPES);

const normalizeType = (type) => {
  return VALID_NODE_TYPES.has(type) ? type : DEFAULT_BODY_BLOCK_TYPE;
};

const cloneBlock = (block = {}) => ({
  ...block,
  type: normalizeType(block.type),
  text: String(block.text || ""),
});

const cloneScene = (scene = {}) => ({
  ...scene,
  metadata: { ...(scene.metadata || {}) },
  content: Array.isArray(scene.content) ? scene.content.map(cloneBlock) : [],
});

const safeText = (value) => String(value || "");

const makeNodeId = (prefix, parts = []) => {
  return [prefix, ...parts.map(part => String(part || "").replace(/\s+/g, "-"))]
    .filter(Boolean)
    .join("-");
};

export const createEmptyWritingNode = (type = DEFAULT_BODY_BLOCK_TYPE, sceneId = null) => ({
  id: makeNodeId("node", [Date.now(), Math.random().toString(36).slice(2)]),
  type: normalizeType(type),
  text: "",
  sceneId,
});

export const createEmptySceneHeadingNode = (sceneId = null) => ({
  id: makeNodeId("scene-heading", [sceneId || Date.now(), Math.random().toString(36).slice(2)]),
  type: "Scene Heading",
  text: "",
  sceneId: sceneId || createSceneId(),
});

export const documentNodesFromScenes = (scenes = []) => {
  const sourceScenes = Array.isArray(scenes) ? scenes : [];

  if (sourceScenes.length === 0) {
    return [];
  }

  const nodes = [];

  sourceScenes.forEach((scene, sceneIndex) => {
    const sceneId = isValidSceneId(scene?.id) ? scene.id : createSceneId();

    nodes.push({
      id: makeNodeId("heading", [sceneId]),
      type: "Scene Heading",
      text: safeText(scene?.heading),
      sceneId,
      sourceSceneNumber: scene?.sceneNumber ?? sceneIndex + 1,
      metadata: { ...(scene?.metadata || {}) },
    });

    const content = Array.isArray(scene?.content) ? scene.content : [];

    if (content.length === 0) {
      nodes.push(createEmptyWritingNode(DEFAULT_BODY_BLOCK_TYPE, sceneId));
      return;
    }

    content.forEach((block, blockIndex) => {
      nodes.push({
        id: block.id || makeNodeId("block", [sceneId, blockIndex]),
        type: normalizeType(block.type),
        text: safeText(block.text),
        sceneId,
        sourceBlockIndex: blockIndex,
      });
    });
  });

  return nodes;
};

const buildPreviousSceneMap = (previousScenes = []) => {
  const byId = new Map();

  (Array.isArray(previousScenes) ? previousScenes : []).forEach((scene) => {
    if (scene?.id) byId.set(scene.id, cloneScene(scene));
  });

  return byId;
};

const makeFallbackScene = (sceneNumber = 1) => {
  const sceneId = createSceneId();

  return {
    id: sceneId,
    sceneNumber,
    heading: "",
    content: [{ type: DEFAULT_BODY_BLOCK_TYPE, text: "" }],
    metadata: {},
    tags: [],
    characters: [],
    props: [],
  };
};

const makeSceneFromHeadingNode = (headingNode, sceneNumber, previousSceneMap) => {
  const existingScene = headingNode.sceneId ? previousSceneMap.get(headingNode.sceneId) : null;
  const sceneId = isValidSceneId(headingNode.sceneId)
    ? headingNode.sceneId
    : existingScene?.id || createSceneId();

  return {
    ...(existingScene || {}),
    id: sceneId,
    sceneNumber,
    heading: safeText(headingNode.text),
    content: [],
    metadata: {
      ...(existingScene?.metadata || {}),
      ...(headingNode.metadata || {}),
      scriptOrder: sceneNumber,
    },
  };
};

export const scenesFromDocumentNodes = (documentNodes = [], previousScenes = []) => {
  const nodes = Array.isArray(documentNodes) ? documentNodes : [];
  const previousSceneMap = buildPreviousSceneMap(previousScenes);

  const scenes = [];
  let currentScene = null;

  const commitCurrentScene = () => {
    if (!currentScene) return;

    const hasHeading = safeText(currentScene.heading).trim().length > 0;
    const meaningfulBlocks = (currentScene.content || []).filter(block => safeText(block.text).trim().length > 0);

    // If a scene has no heading and no meaningful body, it is a ghost scene.
    // Empty writing mode should stay empty until the user clicks New Script.
    if (!hasHeading && meaningfulBlocks.length === 0) {
      currentScene = null;
      return;
    }

    if (!Array.isArray(currentScene.content) || currentScene.content.length === 0) {
      currentScene.content = [{ type: DEFAULT_BODY_BLOCK_TYPE, text: "" }];
    }

    scenes.push(currentScene);
    currentScene = null;
  };

  nodes.forEach((node) => {
    const type = normalizeType(node?.type);

    if (type === "Scene Heading") {
      commitCurrentScene();
      currentScene = makeSceneFromHeadingNode(node, scenes.length + 1, previousSceneMap);
      return;
    }

    if (!currentScene) {
      const fallbackHeadingNode = {
        type: "Scene Heading",
        text: "",
        sceneId: node?.sceneId && isValidSceneId(node.sceneId) ? node.sceneId : createSceneId(),
      };
      currentScene = makeSceneFromHeadingNode(fallbackHeadingNode, scenes.length + 1, previousSceneMap);
    }

    currentScene.content.push({
      id: node?.id,
      type,
      text: safeText(node?.text),
    });
  });

  commitCurrentScene();

  if (scenes.length === 0) {
    return [];
  }

  return scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
    metadata: {
      ...(scene.metadata || {}),
      scriptOrder: index + 1,
    },
    content: Array.isArray(scene.content) && scene.content.length > 0
      ? scene.content.map(cloneBlock)
      : [{ type: DEFAULT_BODY_BLOCK_TYPE, text: "" }],
  }));
};

export const getDocumentNodeElementTypeAfterEnter = (nodeType) => {
  switch (nodeType) {
    case "Scene Heading":
      return "Action";
    case "Character":
      return "Dialogue";
    case "Parenthetical":
      return "Dialogue";
    case "Dialogue":
      return "Action";
    case "Transition":
      return "Scene Heading";
    case "Shot":
      return "Action";
    case "Action":
    default:
      return "Action";
  }
};

export const getDocumentNodeElementTypeAfterTab = (nodeType, text = "") => {
  const hasText = safeText(text).trim().length > 0;

  if (nodeType === "Shot") return "Shot";

  if (nodeType === "Character") return "Parenthetical";
  if (nodeType === "Dialogue") return "Parenthetical";

  if (nodeType === "Action") {
    return hasText ? "Character" : "Character";
  }

  return nodeType;
};
