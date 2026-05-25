export const SCENE_STATUS_COLORS = {
  Scheduled: { backgroundColor: "#8fb8d4", borderColor: "#5f8aa5", textColor: "#111", statusLabel: "Scheduled", isProductionStatus: true },
  Shot: { backgroundColor: "#8aba8a", borderColor: "#5f8c5f", textColor: "#111", statusLabel: "Shot", isProductionStatus: true },
  Pickups: { backgroundColor: "#d4bc7a", borderColor: "#a88d45", textColor: "#111", statusLabel: "Pickups", isProductionStatus: true },
  Reshoot: { backgroundColor: "#d49494", borderColor: "#a96363", textColor: "#111", statusLabel: "Reshoot", isProductionStatus: true },
  Removed: { backgroundColor: "#c4a0c4", borderColor: "#936b93", textColor: "#111", statusLabel: "Removed", isProductionStatus: true },
};

export const SCENE_CUSTOM_COLORS = {
  default: { label: "Default grey", background: null, fill: "#b8b8b8", border: "#d9d9d9", swatch: "#b8b8b8" },
  red: { label: "Red", background: "#FFEBEE", fill: "#EF9A9A", border: "#C62828", swatch: "#EF9A9A" },
  orange: { label: "Orange", background: "#FFF3E0", fill: "#FFCC80", border: "#EF6C00", swatch: "#FFCC80" },
  yellow: { label: "Yellow", background: "#FFFDE7", fill: "#FFE082", border: "#F9A825", swatch: "#FFE082" },
  green: { label: "Green", background: "#E8F5E9", fill: "#A5D6A7", border: "#2E7D32", swatch: "#A5D6A7" },
  blue: { label: "Blue", background: "#E3F2FD", fill: "#90CAF9", border: "#1565C0", swatch: "#90CAF9" },
  purple: { label: "Purple", background: "#F3E5F5", fill: "#CE93D8", border: "#7B1FA2", swatch: "#CE93D8" },
};

export const INSERTED_BORDER_COLOR = "#f59e0b";
export const INSERTED_LABEL_COLOR = "#b45309";
export const APP_TAB_BLUE = "#2196F3";

export const SCENE_METADATA_COLUMN_WIDTHS = {
  customColor: "14px",
  originalNumber: "24px",
  pageNumber: "42px",
  pageLength: "34px",
};

export const getSceneStatusPresentation = (sceneOrStatus) => {
  const status = typeof sceneOrStatus === "string"
    ? sceneOrStatus
    : sceneOrStatus?.status || "Not Scheduled";
  const presentation = SCENE_STATUS_COLORS[status];

  if (presentation) return presentation;

  return {
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: "#111",
    statusLabel: status || "Not Scheduled",
    isProductionStatus: false,
  };
};

export const getSceneCustomColorPresentation = (scene) => {
  const colorKey = scene?.metadata?.color;
  const color = colorKey && SCENE_CUSTOM_COLORS[colorKey] ? SCENE_CUSTOM_COLORS[colorKey] : null;

  return {
    hasCustomColor: Boolean(color),
    swatch: color?.swatch || "transparent",
    border: color?.border || "transparent",
    background: color?.background || null,
    fill: color?.fill || null,
    label: color?.label || "",
    colorKey: colorKey || null,
  };
};

export const getSceneOriginalNumberPresentation = (scene, options = {}) => {
  const originalNumber = scene?.metadata?.originalSceneNumber;
  const currentLabel = options.displayLabel ?? scene?.sceneNumber;
  const showOriginal =
    originalNumber !== undefined &&
    originalNumber !== null &&
    String(originalNumber) !== String(currentLabel);

  return {
    showOriginal,
    originalNumber,
  };
};

const formatScenePageLength = (pageLength) => {
  const numericLength = Number(pageLength);

  if (!Number.isFinite(numericLength) || numericLength <= 0) return null;

  const eighths = Math.max(1, Math.round(numericLength * 8));
  const wholePages = Math.floor(eighths / 8);
  const remainingEighths = eighths % 8;

  if (wholePages > 0 && remainingEighths > 0) {
    return `${wholePages} ${remainingEighths}/8`;
  }

  if (wholePages > 0) {
    return String(wholePages);
  }

  return `${remainingEighths}/8`;
};

export const getSceneMetadataColumns = (scene, options = {}) => {
  const pageStats = options.pageStats || {};
  const metadata = scene?.metadata || {};

  const pageNumber =
    pageStats.startPage ??
    pageStats.pageNumber ??
    metadata.writingPageNumber ??
    null;

  const rawPageLength =
    pageStats.timelinePageLength ??
    metadata.writingTimelinePageLength ??
    pageStats.pageLength ??
    pageStats.pageCount ??
    metadata.writingPageLength ??
    null;

  return {
    customColor: getSceneCustomColorPresentation(scene),
    originalNumber: getSceneOriginalNumberPresentation(scene, options),
    pageNumber,
    pageLength: formatScenePageLength(rawPageLength),
  };
};

export const getSceneRowPresentation = (scene, options = {}) => {
  const status = getSceneStatusPresentation(options.status || scene);
  const customColor = getSceneCustomColorPresentation(scene);
  const originalNumber = getSceneOriginalNumberPresentation(scene, options);
  const isInserted = Boolean(scene?.metadata?.replacementLetter);
  const isCurrent = Boolean(options.isCurrent);
  const isDragging = Boolean(options.isDragging);
  const hasStatus = Boolean(status.isProductionStatus);

  return {
    status,
    customColor,
    originalNumber,
    isInserted,
    rowBackgroundColor: isDragging
      ? "rgba(227,242,253,0.75)"
      : isCurrent
        ? APP_TAB_BLUE
        : hasStatus
          ? status.backgroundColor
          : customColor.hasCustomColor
            ? customColor.background
            : isInserted
              ? "rgba(251,186,116,0.18)"
              : "transparent",
    rowTextColor: isCurrent ? "white" : status.textColor,
    metadataTextColor: isCurrent ? "rgba(255,255,255,0.82)" : "#333",
    insertedBorderColor: INSERTED_BORDER_COLOR,
    insertedLabelColor: INSERTED_LABEL_COLOR,
    customOnlyBorderColor: customColor.hasCustomColor && !hasStatus ? customColor.border : undefined,
    hasStatus,
  };
};
