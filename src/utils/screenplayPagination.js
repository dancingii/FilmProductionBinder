const VALID_TYPES = [
  "Scene Heading",
  "Action",
  "Character",
  "Dialogue",
  "Parenthetical",
  "Transition",
  "Shot",
];

export const SCREENPLAY_PAGE_LAYOUT = {
  pageWidth: "8.5in",
  pageHeight: "11in",
  pageMarginTop: "1in",
  pageMarginRight: "1in",
  pageMarginBottom: "1in",
  pageMarginLeft: "1.4in",
};

export const DEFAULT_SCREENPLAY_LAYOUT_TUNING = {
  pageMarginTopIn: 1,
  pageMarginBottomIn: 1,
  sceneHeadingMarginTopPt: 22,
  sceneHeadingMarginBottomPt: 13,
  sceneHeadingLeftIn: 0,
  sceneHeadingWidthIn: 6.15,
  actionMarginTopPt: 0,
  actionMarginBottomPt: 12,
  actionLeftIn: 0,
  actionWidthIn: 6.15,
  characterMarginTopPt: 12,
  characterMarginBottomPt: 0,
  characterLeftIn: 2.62,
  characterWidthIn: 2.35,
  parentheticalMarginTopPt: 0,
  parentheticalMarginBottomPt: 0,
  parentheticalLeftIn: 1.74,
  parentheticalWidthIn: 2.35,
  dialogueMarginTopPt: 0,
  dialogueMarginBottomPt: 12,
  dialogueLeftIn: 1.35,
  dialogueWidthIn: 3.65,
  transitionMarginTopPt: 12,
  transitionMarginBottomPt: 12,
  transitionLeftIn: 4.6,
  transitionWidthIn: 1.8,
  lineHeightPt: 12,
  pageBodyLineOffset: 0,
};

export const SCREENPLAY_NODE_STYLE_BY_TYPE = {
  "Scene Heading": {
    fontWeight: "normal",
    textTransform: "uppercase",
    marginTop: "12pt",
    marginBottom: "12pt",
    marginLeft: "0",
    width: "100%",
  },
  Action: {
    marginTop: "0",
    marginBottom: "12pt",
    marginLeft: "0",
    width: "100%",
  },
  Character: {
    textTransform: "uppercase",
    marginTop: "12pt",
    marginBottom: "0",
    marginLeft: "2.62in",
    width: "2.35in",
    textAlign: "left",
  },
  Parenthetical: {
    marginTop: "0",
    marginBottom: "0",
    marginLeft: "2.28in",
    width: "2.35in",
  },
  Dialogue: {
    marginTop: "0",
    marginBottom: "12pt",
    marginLeft: "1.35in",
    width: "3.65in",
  },
  Transition: {
    textTransform: "uppercase",
    marginTop: "12pt",
    marginBottom: "12pt",
    marginLeft: "4.6in",
    width: "1.8in",
    textAlign: "right",
  },
  Shot: {
    textTransform: "uppercase",
    marginTop: "12pt",
    marginBottom: "12pt",
    marginLeft: "0",
    width: "100%",
  },
};

export const CHARS_PER_LINE_BY_TYPE = {
  "Scene Heading": 61,
  Action: 61,
  Character: 24,
  Parenthetical: 26,
  Dialogue: 36,
  Transition: 18,
  Shot: 61,
};

const HORIZONTAL_WIDTH_KEY_BY_TYPE = {
  "Scene Heading": "sceneHeadingWidthIn",
  Action: "actionWidthIn",
  Character: "characterWidthIn",
  Parenthetical: "parentheticalWidthIn",
  Dialogue: "dialogueWidthIn",
  Transition: "transitionWidthIn",
  Shot: "actionWidthIn",
};

export const normalizeScreenplayNodeType = (type) =>
  VALID_TYPES.includes(type) ? type : "Action";

export const parsePtValue = (value) => {
  const match = String(value || "").match(/^([\d.]+)pt$/);
  return match ? Number(match[1]) : 0;
};

export const parseInValue = (value) => {
  const match = String(value || "").match(/^([\d.]+)in$/);
  return match ? Number(match[1]) : 0;
};

export const formatPt = (value) => `${Number(value || 0)}pt`;
export const formatIn = (value) => `${Number(value || 0)}in`;

export const getScreenplayLayoutTuningValue = (layoutTuning, key) => {
  const value = layoutTuning?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : DEFAULT_SCREENPLAY_LAYOUT_TUNING[key];
};

export const getEffectiveScreenplayPageBodyHeightLines = (layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const pageHeightIn = parseInValue(SCREENPLAY_PAGE_LAYOUT.pageHeight);
  const topMarginIn = getScreenplayLayoutTuningValue(layoutTuning, "pageMarginTopIn");
  const bottomMarginIn = getScreenplayLayoutTuningValue(layoutTuning, "pageMarginBottomIn");
  const lineHeightPt = Math.max(1, getScreenplayLayoutTuningValue(layoutTuning, "lineHeightPt"));
  const lineOffset = getScreenplayLayoutTuningValue(layoutTuning, "pageBodyLineOffset");
  const bodyHeightIn = Math.max(0, pageHeightIn - topMarginIn - bottomMarginIn);

  return Math.max(1, Math.floor((bodyHeightIn * 72) / lineHeightPt) + lineOffset);
};

export const marginLinesFromStyle = (value, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const lineHeight = Math.max(1, getScreenplayLayoutTuningValue(layoutTuning, "lineHeightPt"));
  return Math.round(parsePtValue(value) / lineHeight);
};

export const getTunedScreenplayNodeStyleByType = (layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => ({
  ...SCREENPLAY_NODE_STYLE_BY_TYPE,
  "Scene Heading": {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE["Scene Heading"],
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "sceneHeadingMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "sceneHeadingMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "sceneHeadingLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "sceneHeadingWidthIn")),
  },
  Action: {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE.Action,
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "actionMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "actionMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "actionLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "actionWidthIn")),
  },
  Character: {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE.Character,
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "characterMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "characterMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "characterLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "characterWidthIn")),
  },
  Parenthetical: {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE.Parenthetical,
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "parentheticalMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "parentheticalMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "parentheticalLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "parentheticalWidthIn")),
  },
  Dialogue: {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE.Dialogue,
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "dialogueMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "dialogueMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "dialogueLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "dialogueWidthIn")),
  },
  Transition: {
    ...SCREENPLAY_NODE_STYLE_BY_TYPE.Transition,
    marginTop: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "transitionMarginTopPt")),
    marginBottom: formatPt(getScreenplayLayoutTuningValue(layoutTuning, "transitionMarginBottomPt")),
    marginLeft: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "transitionLeftIn")),
    width: formatIn(getScreenplayLayoutTuningValue(layoutTuning, "transitionWidthIn")),
  },
});

export const getWrappedLineCount = (text, maxChars) => {
  const source = String(text || "").replace(/\u00a0/g, " ").trimEnd();

  if (!source) return 1;

  const paragraphs = source.split(/\n+/);
  let totalLines = 0;

  paragraphs.forEach((paragraph) => {
    const words = String(paragraph || "").trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      totalLines += 1;
      return;
    }

    let lineLength = 0;
    let paragraphLines = 1;

    words.forEach((word) => {
      const wordLength = word.length;

      if (lineLength === 0) {
        lineLength = wordLength;
        return;
      }

      if (lineLength + 1 + wordLength <= maxChars) {
        lineLength += 1 + wordLength;
      } else {
        paragraphLines += 1;
        lineLength = wordLength;
      }
    });

    totalLines += paragraphLines;
  });

  return Math.max(1, totalLines);
};

export const getScreenplayNodeStyle = (node, previousNode, nextNode, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const type = normalizeScreenplayNodeType(node?.type);
  const previousType = normalizeScreenplayNodeType(previousNode?.type);
  const nextType = normalizeScreenplayNodeType(nextNode?.type);
  const nodeStyleByType = getTunedScreenplayNodeStyleByType(layoutTuning);
  const baseStyle = nodeStyleByType[type] || nodeStyleByType.Action;

  const style = { ...baseStyle };

  if (type === "Dialogue" && nextType === "Parenthetical") {
    style.marginBottom = "0";
  }

  if (type === "Scene Heading" && previousType === "Scene Heading") {
    style.marginTop = "0";
  }

  if (type === "Parenthetical") {
    style.marginTop = "0";
    style.marginBottom = "0";
  }
  if (type === "Dialogue" && previousType === "Parenthetical") {
    style.marginTop = "0";
  }

  if (type === "Character" && nextType === "Dialogue") {
    style.marginBottom = "0";
  }

  return style;
};

export const getSpacingBeforeNodeLines = (node, previousNode, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const type = normalizeScreenplayNodeType(node?.type);
  const previousType = previousNode ? normalizeScreenplayNodeType(previousNode?.type) : null;

  if (!previousType) return 0;

  if (type === "Dialogue" && (previousType === "Character" || previousType === "Parenthetical")) {
    return 0;
  }

  if (type === "Parenthetical" && (previousType === "Character" || previousType === "Dialogue" || previousType === "Parenthetical")) {
    return 0;
  }

  if (type === "Dialogue" && previousType === "Dialogue") {
    return 0;
  }

  const previousStyle = getScreenplayNodeStyle(previousNode, null, node, layoutTuning);
  const currentStyle = getScreenplayNodeStyle(node, previousNode, null, layoutTuning);
  return Math.max(
    marginLinesFromStyle(previousStyle.marginBottom, layoutTuning),
    marginLinesFromStyle(currentStyle.marginTop, layoutTuning)
  );
};

export const getTunedCharsPerLine = (type, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const widthKey = HORIZONTAL_WIDTH_KEY_BY_TYPE[type];
  if (widthKey) {
    const widthIn = getScreenplayLayoutTuningValue(layoutTuning, widthKey);
    return Math.max(10, Math.round(widthIn * 10));
  }
  return CHARS_PER_LINE_BY_TYPE[type] || CHARS_PER_LINE_BY_TYPE.Action;
};

export const getNodeLineEstimate = (node, previousNode, nextNode, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const type = normalizeScreenplayNodeType(node?.type);
  const maxChars = getTunedCharsPerLine(type, layoutTuning);
  const textLines = getWrappedLineCount(node?.text || " ", maxChars);

  return Math.max(
    1,
    getSpacingBeforeNodeLines(node, previousNode, layoutTuning) + textLines
  );
};

export const getNodeTextLineEstimate = (node, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const type = normalizeScreenplayNodeType(node?.type);
  const maxChars = getTunedCharsPerLine(type, layoutTuning);
  return getWrappedLineCount(node?.text || " ", maxChars);
};

export const hasMeaningfulNodeText = (node) => {
  return String(node?.text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .trim().length > 0;
};

export const findNextMeaningfulNodeIndex = (nodes = [], startIndex = 0) => {
  for (let index = startIndex; index < nodes.length; index += 1) {
    if (hasMeaningfulNodeText(nodes[index])) return index;
  }

  return -1;
};

export const getPageEntryLineEstimate = (nodes = [], entry, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const entryIndex = entry?.index ?? -1;
  if (entryIndex < 0) return 0;

  return getNodeLineEstimate(
    nodes[entryIndex],
    nodes[entryIndex - 1] || null,
    nodes[entryIndex + 1] || null,
    layoutTuning
  );
};

const getEntriesLineEstimate = (nodes = [], entries = [], layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  return entries.reduce((total, entry) => (
    total + getPageEntryLineEstimate(nodes, entry, layoutTuning)
  ), 0);
};

const makePaginationUnit = (nodes = [], entries = [], unitType = "SingleNodeUnit", layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING, options = {}) => {
  const lineCount = getEntriesLineEstimate(nodes, entries, layoutTuning);

  return {
    type: unitType,
    entries,
    lineCount,
    placementLineCount: options.placementLineCount ?? lineCount,
    firstIndex: entries[0]?.index ?? -1,
    meta: options.meta || {},
  };
};

const getFollowingMeaningfulNode = (nodes = [], startIndex = 0) => {
  const index = findNextMeaningfulNodeIndex(nodes, startIndex);
  return index >= 0 ? { index, node: nodes[index] } : null;
};

const buildSceneHeadingUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const node = nodes[index];
  const entry = { node, index };
  const previousNode = nodes[index - 1] || null;
  const nextMeaningful = getFollowingMeaningfulNode(nodes, index + 1);
  const nextMeaningfulType = normalizeScreenplayNodeType(nextMeaningful?.node?.type);
  const headingLineCount = getNodeLineEstimate(node, previousNode, nodes[index + 1] || null, layoutTuning);
  const headingSpacingLines = getSpacingBeforeNodeLines(node, previousNode, layoutTuning);
  let placementLineCount = headingLineCount;
  let followingActionLines = 0;

  if (nextMeaningfulType === "Action") {
    followingActionLines =
      getSpacingBeforeNodeLines(nextMeaningful.node, node, layoutTuning) +
      Math.min(2, getNodeTextLineEstimate(nextMeaningful.node, layoutTuning));
    placementLineCount += followingActionLines;
  }

  return makePaginationUnit(nodes, [entry], "SceneHeadingUnit", layoutTuning, {
    placementLineCount,
    meta: {
      headingSpacingLines,
      followingActionLines,
      hasFollowingMeaningfulContent: Boolean(nextMeaningful),
      hasFollowingAction: nextMeaningfulType === "Action",
    },
  });
};

const buildDialogueOpeningUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const characterNode = nodes[index];
  const parenthetical = getFollowingMeaningfulNode(nodes, index + 1);
  const parentheticalType = normalizeScreenplayNodeType(parenthetical?.node?.type);
  let dialogue = null;

  if (parentheticalType === "Parenthetical") {
    const maybeDialogue = getFollowingMeaningfulNode(nodes, parenthetical.index + 1);
    if (normalizeScreenplayNodeType(maybeDialogue?.node?.type) === "Dialogue") {
      dialogue = maybeDialogue;
    }
  } else if (parentheticalType === "Dialogue") {
    dialogue = parenthetical;
  }

  if (!dialogue) {
    return makePaginationUnit(nodes, [{ node: characterNode, index }], "SingleNodeUnit", layoutTuning);
  }

  const endIndex = dialogue.index;
  const entries = [];
  for (let entryIndex = index; entryIndex <= endIndex; entryIndex += 1) {
    entries.push({ node: nodes[entryIndex], index: entryIndex });
  }

  return makePaginationUnit(nodes, entries, "DialogueOpeningUnit", layoutTuning, {
    meta: {
      hasParenthetical: parentheticalType === "Parenthetical",
      dialogueTextLines: getNodeTextLineEstimate(dialogue.node, layoutTuning),
    },
  });
};

const buildParentheticalUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const node = nodes[index];
  const dialogue = getFollowingMeaningfulNode(nodes, index + 1);

  if (normalizeScreenplayNodeType(dialogue?.node?.type) !== "Dialogue") {
    return makePaginationUnit(nodes, [{ node, index }], "SingleNodeUnit", layoutTuning);
  }

  const entries = [];
  for (let entryIndex = index; entryIndex <= dialogue.index; entryIndex += 1) {
    entries.push({ node: nodes[entryIndex], index: entryIndex });
  }

  return makePaginationUnit(nodes, entries, "ParentheticalUnit", layoutTuning, {
    meta: {
      dialogueTextLines: getNodeTextLineEstimate(dialogue.node, layoutTuning),
    },
  });
};

const buildPaginationUnits = (nodes = [], layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const units = [];
  let index = 0;

  while (index < sourceNodes.length) {
    const node = sourceNodes[index];
    const type = normalizeScreenplayNodeType(node?.type);
    let unit = null;

    if (type === "Scene Heading") {
      unit = buildSceneHeadingUnit(sourceNodes, index, layoutTuning);
    } else if (type === "Character") {
      unit = buildDialogueOpeningUnit(sourceNodes, index, layoutTuning);
    } else if (type === "Parenthetical") {
      unit = buildParentheticalUnit(sourceNodes, index, layoutTuning);
    } else {
      unit = makePaginationUnit(sourceNodes, [{ node, index }], "SingleNodeUnit", layoutTuning);
    }

    units.push(unit);
    index = (unit.entries[unit.entries.length - 1]?.index ?? index) + 1;
  }

  return units;
};

export const paginateScreenplayNodes = (nodes = [], layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const units = buildPaginationUnits(sourceNodes, layoutTuning);
  const pages = [];
  let currentPage = [];
  let currentLineCount = 0;
  const linesPerPage = getEffectiveScreenplayPageBodyHeightLines(layoutTuning);

  const finalizeCurrentPage = () => {
    if (!currentPage.length) return;
    pages.push(currentPage);
    currentPage = [];
    currentLineCount = 0;
  };

  units.forEach((unit) => {
    const remainingLines = linesPerPage - currentLineCount;

    let needsNewPage =
      currentPage.length > 0 &&
      currentLineCount + unit.placementLineCount > linesPerPage;

    if (
      !needsNewPage &&
      unit.type === "SceneHeadingUnit" &&
      unit.meta.hasFollowingMeaningfulContent &&
      currentPage.length > 0 &&
      remainingLines - (unit.meta.headingSpacingLines || 0) <= 3
    ) {
      needsNewPage = true;
    }

    if (needsNewPage) {
      finalizeCurrentPage();
    }

    currentPage.push(...unit.entries);
    currentLineCount += unit.lineCount;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

export const scenesToScreenplayNodes = (scenes = [], options = {}) => {
  const includeSceneNumberInHeading = options.includeSceneNumberInHeading === true;
  const getSceneLabel = typeof options.getSceneLabel === "function" ? options.getSceneLabel : null;
  const nodes = [];

  (Array.isArray(scenes) ? scenes : []).forEach((scene, sceneIndex) => {
    const sceneNumber = scene?.sceneNumber ?? sceneIndex + 1;
    const sceneLabel = getSceneLabel ? getSceneLabel(scene, sceneIndex) : sceneNumber;
    const normalizedHeading = String(scene?.heading || "").replace(/\s+/g, " ").trim();
    const headingText = includeSceneNumberInHeading
      ? `${sceneLabel}: ${normalizedHeading}`
      : normalizedHeading;
    nodes.push({
      id: `scene-${sceneNumber}-heading-${sceneIndex}`,
      type: "Scene Heading",
      text: headingText,
      sceneNumber,
      sceneIndex,
      isSceneHeading: true,
      sourceScene: scene,
    });

    (scene?.content || []).forEach((block, blockIndex) => {
      nodes.push({
        id: `scene-${sceneNumber}-block-${blockIndex}`,
        ...block,
        type: normalizeScreenplayNodeType(block?.type),
        text: block?.type === "Character" ? String(block?.text || "").toUpperCase() : String(block?.text || ""),
        sceneNumber,
        sceneIndex,
        blockIndex,
        sourceScene: scene,
        sourceBlock: block,
      });
    });
  });

  return nodes;
};

export const getScreenplayPageNumbersForSceneNumbers = (scenes = [], targetSceneNumbers = new Set(), layoutTuning = DEFAULT_SCREENPLAY_LAYOUT_TUNING) => {
  const targetSet = new Set(Array.from(targetSceneNumbers || []).map(String));
  const nodes = scenesToScreenplayNodes(scenes);
  const pages = paginateScreenplayNodes(nodes, layoutTuning);
  const pageIndexes = [];

  pages.forEach((pageEntries, pageIndex) => {
    const hasTarget = pageEntries.some(({ node }) => targetSet.has(String(node?.sceneNumber)));
    if (hasTarget) pageIndexes.push(pageIndex);
  });

  return { nodes, pages, pageIndexes };
};
