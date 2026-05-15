const DEFAULT_PROJECT_ID = "default-project";

export const getWritingDraftProjectId = (project) => {
  if (!project) return DEFAULT_PROJECT_ID;
  if (typeof project === "string") return project || DEFAULT_PROJECT_ID;
  return project.id || project.name || DEFAULT_PROJECT_ID;
};

export const getWritingDraftStorageKey = (project) => {
  return `scriptWritingDraft:${getWritingDraftProjectId(project)}`;
};

export const buildWritingDraftPayload = (project, nodes = []) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  return {
    projectId: getWritingDraftProjectId(project),
    savedAt: new Date().toISOString(),
    hasUserCreatedScript: safeNodes.some(node => node?.type === "Scene Heading"),
    nodes: safeNodes,
  };
};

export const loadWritingDraft = (project) => {
  if (!project || typeof localStorage === "undefined") {
    return {
      projectId: getWritingDraftProjectId(project),
      savedAt: null,
      hasUserCreatedScript: false,
      nodes: [],
    };
  }

  const rawDraft = localStorage.getItem(getWritingDraftStorageKey(project));
  if (!rawDraft) {
    return {
      projectId: getWritingDraftProjectId(project),
      savedAt: null,
      hasUserCreatedScript: false,
      nodes: [],
    };
  }

  const parsed = JSON.parse(rawDraft);
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];

  return {
    projectId: parsed?.projectId || getWritingDraftProjectId(project),
    savedAt: parsed?.savedAt || null,
    hasUserCreatedScript: parsed?.hasUserCreatedScript === true,
    nodes,
  };
};

export const saveWritingDraft = (project, nodes = []) => {
  const payload = buildWritingDraftPayload(project, nodes);

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(getWritingDraftStorageKey(project), JSON.stringify(payload));
  }

  return payload;
};

export const clearWritingDraft = (project) => {
  if (project && typeof localStorage !== "undefined") {
    localStorage.removeItem(getWritingDraftStorageKey(project));
  }
};
