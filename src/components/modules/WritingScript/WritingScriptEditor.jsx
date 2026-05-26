import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SCRIPT_WRITING_NODE_TYPES,
  getDocumentNodeElementTypeAfterEnter,
  getDocumentNodeElementTypeAfterTab,
} from "./writingDraftModel";
import { createSceneId } from "../../../utils/sceneIdentity";
import { APP_TAB_BLUE } from "../../../utils/scenePresentation";
import { paginateScreenplayNodes } from "../../../utils/screenplayPagination";

const NODE_TYPE_LABELS = {
  "Scene Heading": "S",
  Action: "A",
  Character: "C",
  Dialogue: "D",
  Parenthetical: "P",
  Transition: "T",
  Shot: "H",
};

const NODE_TYPE_BY_KEY = {
  S: "Scene Heading",
  A: "Action",
  C: "Character",
  D: "Dialogue",
  P: "Parenthetical",
  T: "Transition",
  H: "Shot",
};

// Writing toolbar/autocomplete overlays must stay above the page viewer and side panels.
const WRITING_OVERLAY_Z_INDEX = 100000;

const NODE_STYLE_BY_TYPE = {
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

const PAGE_LAYOUT = {
  pageWidth: "8.5in",
  pageHeight: "11in",
  pageMarginTop: "1in",
  pageMarginRight: "1in",
  pageMarginBottom: "1in",
  pageMarginLeft: "1.4in",
};

const DEFAULT_LAYOUT_TUNING = {
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


const CHARS_PER_LINE_BY_TYPE = {
  "Scene Heading": 61,
  Action: 61,
  Character: 24,
  Parenthetical: 26,
  Dialogue: 36,
  Transition: 18,
  Shot: 61,
};
const parsePtValue = (value) => {
  const match = String(value || "").match(/^([\d.]+)pt$/);
  return match ? Number(match[1]) : 0;
};

const parseInValue = (value) => {
  const match = String(value || "").match(/^([\d.]+)in$/);
  return match ? Number(match[1]) : 0;
};

const formatPt = (value) => `${Number(value || 0)}pt`;
const formatIn = (value) => `${Number(value || 0)}in`;

const getLayoutTuningValue = (layoutTuning, key) => {
  const value = layoutTuning?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : DEFAULT_LAYOUT_TUNING[key];
};

const getEffectivePageBodyHeightLines = (layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const pageHeightIn = parseInValue(PAGE_LAYOUT.pageHeight);
  const topMarginIn = getLayoutTuningValue(layoutTuning, "pageMarginTopIn");
  const bottomMarginIn = getLayoutTuningValue(layoutTuning, "pageMarginBottomIn");
  const lineHeightPt = Math.max(1, getLayoutTuningValue(layoutTuning, "lineHeightPt"));
  const lineOffset = getLayoutTuningValue(layoutTuning, "pageBodyLineOffset");
  const bodyHeightIn = Math.max(0, pageHeightIn - topMarginIn - bottomMarginIn);

  return Math.max(1, Math.floor((bodyHeightIn * 72) / lineHeightPt) + lineOffset);
};

const marginLinesFromStyle = (value, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const lineHeight = Math.max(1, getLayoutTuningValue(layoutTuning, "lineHeightPt"));
  return Math.round(parsePtValue(value) / lineHeight);
};

const getTunedNodeStyleByType = (layoutTuning = DEFAULT_LAYOUT_TUNING) => ({
  ...NODE_STYLE_BY_TYPE,
  "Scene Heading": {
    ...NODE_STYLE_BY_TYPE["Scene Heading"],
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "sceneHeadingMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "sceneHeadingMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "sceneHeadingLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "sceneHeadingWidthIn")),
  },
  Action: {
    ...NODE_STYLE_BY_TYPE.Action,
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "actionMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "actionMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "actionLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "actionWidthIn")),
  },
  Character: {
    ...NODE_STYLE_BY_TYPE.Character,
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "characterMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "characterMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "characterLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "characterWidthIn")),
  },
  Parenthetical: {
    ...NODE_STYLE_BY_TYPE.Parenthetical,
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "parentheticalMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "parentheticalMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "parentheticalLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "parentheticalWidthIn")),
  },
  Dialogue: {
    ...NODE_STYLE_BY_TYPE.Dialogue,
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "dialogueMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "dialogueMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "dialogueLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "dialogueWidthIn")),
  },
  Transition: {
    ...NODE_STYLE_BY_TYPE.Transition,
    marginTop: formatPt(getLayoutTuningValue(layoutTuning, "transitionMarginTopPt")),
    marginBottom: formatPt(getLayoutTuningValue(layoutTuning, "transitionMarginBottomPt")),
    marginLeft: formatIn(getLayoutTuningValue(layoutTuning, "transitionLeftIn")),
    width: formatIn(getLayoutTuningValue(layoutTuning, "transitionWidthIn")),
  },
});

const getWrappedLineCount = (text, maxChars) => {
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

const getSpacingBeforeNodeLines = (node, previousNode, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const type = normalizeNodeType(node?.type);
  const previousType = previousNode ? normalizeNodeType(previousNode?.type) : null;

  if (!previousType) return 0;

  // Dialogue groups are visually continuous:
  // CHARACTER
  // dialogue
  // (parenthetical)
  // dialogue
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

const HORIZONTAL_WIDTH_KEY_BY_TYPE = {
  "Scene Heading": "sceneHeadingWidthIn",
  Action: "actionWidthIn",
  Character: "characterWidthIn",
  Parenthetical: "parentheticalWidthIn",
  Dialogue: "dialogueWidthIn",
  Transition: "transitionWidthIn",
  Shot: "actionWidthIn",
};

const getTunedCharsPerLine = (type, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const widthKey = HORIZONTAL_WIDTH_KEY_BY_TYPE[type];
  if (widthKey) {
    const widthIn = getLayoutTuningValue(layoutTuning, widthKey);
    return Math.max(10, Math.round(widthIn * 10));
  }
  return CHARS_PER_LINE_BY_TYPE[type] || CHARS_PER_LINE_BY_TYPE.Action;
};

const getNodeLineEstimate = (node, previousNode, nextNode, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const type = normalizeNodeType(node?.type);
  const maxChars = getTunedCharsPerLine(type, layoutTuning);
  const textLines = getWrappedLineCount(node?.text || " ", maxChars);

  return Math.max(
    1,
    getSpacingBeforeNodeLines(node, previousNode, layoutTuning) + textLines
  );
};

const getNodeTextLineEstimate = (node, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const type = normalizeNodeType(node?.type);
  const maxChars = getTunedCharsPerLine(type, layoutTuning);
  return getWrappedLineCount(node?.text || " ", maxChars);
};

const hasMeaningfulNodeText = (node) => {
  return String(node?.text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .trim().length > 0;
};

const findNextMeaningfulNodeIndex = (nodes = [], startIndex = 0) => {
  for (let index = startIndex; index < nodes.length; index += 1) {
    if (hasMeaningfulNodeText(nodes[index])) return index;
  }

  return -1;
};

const debugWritingPagination = (message, details = {}) => {
  if (typeof window !== "undefined" && window.__DEBUG_WRITING_PAGINATION) {
    console.log("[WritingPagination]", message, details);
  }
};

const getPageEntryLineEstimate = (nodes = [], entry, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const entryIndex = entry?.index ?? -1;
  if (entryIndex < 0) return 0;

  return getNodeLineEstimate(
    nodes[entryIndex],
    nodes[entryIndex - 1] || null,
    nodes[entryIndex + 1] || null,
    layoutTuning
  );
};

const getEntriesLineEstimate = (nodes = [], entries = [], layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  return entries.reduce((total, entry) => (
    total + getPageEntryLineEstimate(nodes, entry, layoutTuning)
  ), 0);
};

const makePaginationUnit = (nodes = [], entries = [], unitType = "SingleNodeUnit", layoutTuning = DEFAULT_LAYOUT_TUNING, options = {}) => {
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

const buildSceneHeadingUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const node = nodes[index];
  const entry = { node, index };
  const previousNode = nodes[index - 1] || null;
  const nextMeaningful = getFollowingMeaningfulNode(nodes, index + 1);
  const nextMeaningfulType = normalizeNodeType(nextMeaningful?.node?.type);
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

const buildDialogueOpeningUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const characterNode = nodes[index];
  const parenthetical = getFollowingMeaningfulNode(nodes, index + 1);
  const parentheticalType = normalizeNodeType(parenthetical?.node?.type);
  let dialogue = null;

  if (parentheticalType === "Parenthetical") {
    const maybeDialogue = getFollowingMeaningfulNode(nodes, parenthetical.index + 1);
    if (normalizeNodeType(maybeDialogue?.node?.type) === "Dialogue") {
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

const buildParentheticalUnit = (nodes = [], index = 0, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const node = nodes[index];
  const dialogue = getFollowingMeaningfulNode(nodes, index + 1);

  if (normalizeNodeType(dialogue?.node?.type) !== "Dialogue") {
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

const buildPaginationUnits = (nodes = [], layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const units = [];
  let index = 0;

  while (index < sourceNodes.length) {
    const node = sourceNodes[index];
    const type = normalizeNodeType(node?.type);
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

const paginateNodesForScreen = (nodes = [], layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  return paginateScreenplayNodes(nodes, layoutTuning);
};

const normalizeNodeType = (type) => {
  return SCRIPT_WRITING_NODE_TYPES.includes(type) ? type : "Action";
};

const getScreenplayNodeStyle = (node, previousNode, nextNode, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const type = normalizeNodeType(node?.type);
  const previousType = normalizeNodeType(previousNode?.type);
  const nextType = normalizeNodeType(nextNode?.type);
  const nodeStyleByType = getTunedNodeStyleByType(layoutTuning);
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

const makeTempNodeId = () => {
  return `temp-node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isContdMarkerText = (text = "") =>
  /^\(CONT'?D\.?\)$/i.test(
    String(text || "").replace(/[‘’Õ]/g, "'").trim()
  );

const normalizeNodes = (nodes = []) => {
  const source = Array.isArray(nodes) ? nodes : [];

  if (source.length === 0) {
    return [];
  }

  const basicNormalized = source.map((node, index) => ({
    ...node,
    id: node.id || `temp-node-${index}-${Date.now()}`,
    type: normalizeNodeType(node.type),
    text: String(node.text || ""),
  }));

  const result = [];
  basicNormalized.forEach((node) => {
    const prev = result[result.length - 1];
    if (
      node.type === "Parenthetical" &&
      prev?.type === "Character" &&
      /^\(CONT'?D\.?\)$/i.test(node.text.replace(/[‘’Õ]/g, "'").trim())
    ) {
      result[result.length - 1] = {
        ...prev,
        text: `${prev.text.replace(/\s*\(CONT'?D\.?\)\s*$/i, "").trim()} (CONT'D)`,
      };
      return;
    }
    result.push(node);
  });

  return result;
};

const getNodeElement = (root, nodeId) => {
  if (!root || !nodeId) return null;
  return root.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`);
};

const getNodeTextElement = (root, nodeId) => {
  const rowEl = getNodeElement(root, nodeId);
  return rowEl?.querySelector?.("[data-node-text='true']") || rowEl;
};

const getNodeIdFromTarget = (target) => {
  return target?.closest?.("[data-node-id]")?.dataset?.nodeId || null;
};

const getCaretNodeId = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return getNodeIdFromTarget(element);
};

const getCaretOffsetInElement = (el) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !el) return 0;

  const range = selection.getRangeAt(0);
  const preRange = document.createRange();

  try {
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  } catch (_) {
    return 0;
  }
};

const setCaretToEnd = (el) => {
  if (!el) return;

  const textEl = el.querySelector?.("[data-node-text='true']") || el;
  const range = document.createRange();

  range.selectNodeContents(textEl);
  range.collapse(false);

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
};

const setCaretOffset = (el, offset) => {
  if (!el) return;

  const textEl = el.querySelector?.("[data-node-text='true']") || el;
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    remaining -= length;
    node = walker.nextNode();
  }

  setCaretToEnd(el);
};

const getTextNodePositionAtOffset = (textEl, offset) => {
  if (!textEl) return null;

  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  let lastTextNode = null;

  while (node) {
    lastTextNode = node;
    const length = node.textContent.length;
    if (remaining <= length) {
      return { node, offset: remaining };
    }

    remaining -= length;
    node = walker.nextNode();
  }

  return lastTextNode
    ? { node: lastTextNode, offset: lastTextNode.textContent.length }
    : null;
};

const setSelectionRangeInEditor = (root, startNodeId, startOffset, endNodeId, endOffset) => {
  const startTextEl = getNodeTextElement(root, startNodeId);
  const endTextEl = getNodeTextElement(root, endNodeId);
  const startPosition = getTextNodePositionAtOffset(startTextEl, startOffset);
  const endPosition = getTextNodePositionAtOffset(endTextEl, endOffset);

  if (!startPosition || !endPosition) return;

  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);

  const selection = window.getSelection();
  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
};

const getTextFromNodeElement = (el) => {
  if (!el) return "";

  const textEl = el.querySelector?.("[data-node-text='true']") || el;
  const clone = textEl.cloneNode(true);

  clone.querySelectorAll("[data-editor-ui='true']").forEach(node => node.remove());

  return String(clone.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\n/g, "");
};

const normalizeHighlightColor = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "transparent" || raw === "rgba(0, 0, 0, 0)" || raw === "rgba(0,0,0,0)") return false;

  const compact = raw.replace(/\s+/g, "");
  const knownColors = {
    "#ffff00": "#ffff00",
    "#fff59d": "#fff59d",
    "#c8e6c9": "#c8e6c9",
    "#bbdefb": "#bbdefb",
    "#f8bbd0": "#f8bbd0",
    "rgb(255,255,0)": "#ffff00",
    "rgb(255,245,157)": "#fff59d",
    "rgb(200,230,201)": "#c8e6c9",
    "rgb(187,222,251)": "#bbdefb",
    "rgb(248,187,208)": "#f8bbd0",
  };

  return knownColors[compact] || raw;
};

const getRunStyle = (run) => {
  if (!run) return {};
  const style = {};
  const textDecorations = [];
  if (run.bold) style.fontWeight = "bold";
  if (run.italic) style.fontStyle = "italic";
  if (run.underline) textDecorations.push("underline");
  if (run.strike) textDecorations.push("line-through");
  if (textDecorations.length) style.textDecoration = textDecorations.join(" ");
  if (run.highlight) style.backgroundColor = run.highlight === true ? "#ffff00" : run.highlight;
  return style;
};

const runsToText = (runs) =>
  Array.isArray(runs) ? runs.map(r => String(r.text || "")).join("") : "";

const getRunsFromNodeElement = (el) => {
  if (!el) return undefined;
  const textEl = el.querySelector?.('[data-node-text="true"]') || el;
  const runs = [];
  const iter = document.createNodeIterator(textEl, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = iter.nextNode())) {
    const raw = tn.nodeValue || "";
    const text = raw.replace(/\u00a0/g, " ").replace(/\u200B/g, "").replace(/\n/g, "");
    if (!text) continue;
    let bold = false, italic = false, underline = false, strike = false, highlight = false;
    let p = tn.parentElement;
	    while (p && p !== textEl) {
	      const tag = p.tagName?.toLowerCase();
	      const isSpellcheckHighlight = p.dataset?.spellcheckHighlight === "true";
	      if (tag === "b" || tag === "strong") bold = true;
	      if (tag === "em" || tag === "i") italic = true;
	      if (tag === "u") underline = true;
	      if (tag === "s" || tag === "strike" || tag === "del") strike = true;
	      if (p.style?.fontWeight === "bold" || p.style?.fontWeight === "700") bold = true;
	      if (p.style?.fontStyle === "italic") italic = true;
	      if (!isSpellcheckHighlight && p.style?.textDecoration?.includes("underline")) underline = true;
	      if (!isSpellcheckHighlight && p.style?.textDecoration?.includes("line-through")) strike = true;
	      if (!isSpellcheckHighlight) {
	        const bg = normalizeHighlightColor(p.style?.backgroundColor);
	        if (bg) highlight = bg;
	      }
	      p = p.parentElement;
	    }
    if (runs.length > 0) {
      const last = runs[runs.length - 1];
      if (last.bold === bold && last.italic === italic && last.underline === underline && last.strike === strike && last.highlight === highlight) {
        last.text += text;
        continue;
      }
    }
    runs.push({ text, bold, italic, underline, strike, highlight });
  }
  if (runs.length === 0) return undefined;
  const hasFormatting = runs.some(r => r.bold || r.italic || r.underline || r.strike || r.highlight);
  return hasFormatting ? runs : undefined;
};

const splitRunsAtOffset = (runs, offset) => {
  if (!Array.isArray(runs) || runs.length === 0) return [undefined, undefined];
  let remaining = offset;
  const before = [];
  const after = [];
  let splitDone = false;
  for (const run of runs) {
    if (splitDone) { after.push({ ...run }); continue; }
    const len = String(run.text || "").length;
    if (remaining >= len) {
      before.push({ ...run });
      remaining -= len;
    } else {
      if (remaining > 0) before.push({ ...run, text: run.text.slice(0, remaining) });
      after.push({ ...run, text: run.text.slice(remaining) });
      splitDone = true;
    }
  }
  const hasFormatBefore = before.some(r => r.bold || r.italic || r.underline || r.strike || r.highlight);
  const hasFormatAfter = after.some(r => r.bold || r.italic || r.underline || r.strike || r.highlight);
  return [hasFormatBefore ? before : undefined, hasFormatAfter ? after : undefined];
};

const getNodesPayload = (sourceNodes = []) => JSON.stringify(Array.isArray(sourceNodes) ? sourceNodes : []);

const getSceneStatsPayload = (stats = {}) => JSON.stringify(stats || {});

const activeRectEquals = (rectA, rectB) => {
  if (!rectA && !rectB) return true;
  if (!rectA || !rectB) return false;
  return Math.round(rectA.left) === Math.round(rectB.left) &&
    Math.round(rectA.top) === Math.round(rectB.top);
};

const SCENE_HEADING_PREFIX_PATTERN = /^\s*((?:INT|EXT|INT\.\/EXT|I\/E|INT\/EXT|EST)\.?)\s+/i;

const getSceneHeadingLocationParts = (text = "") => {
  const source = String(text || "");
  const prefixMatch = source.match(SCENE_HEADING_PREFIX_PATTERN);
  const prefix = prefixMatch ? source.slice(0, prefixMatch[0].length) : "";
  const afterPrefix = prefixMatch ? source.slice(prefix.length) : source;
  const dashMatch = afterPrefix.match(/\s+-\s+[^-]*$/);
  const suffix = dashMatch ? afterPrefix.slice(dashMatch.index) : "";
  const location = dashMatch ? afterPrefix.slice(0, dashMatch.index) : afterPrefix;
  const locationStart = prefix.length;
  const locationEnd = locationStart + location.length;

  return {
    prefix,
    location,
    suffix,
    locationStart,
    locationEnd,
  };
};

const extractSceneHeadingLocation = (text = "") => {
  return getSceneHeadingLocationParts(text).location
    .replace(/\s+/g, " ")
    .trim();
};

const mergeRunsForNodes = (nodeA, nodeB) => {
  const eitherHasRuns = Array.isArray(nodeA?.runs) || Array.isArray(nodeB?.runs);
  if (!eitherHasRuns) return undefined;
  const toRuns = (node) => {
    if (Array.isArray(node?.runs) && node.runs.length > 0) return node.runs;
    const text = String(node?.text || "");
    return text ? [{ text, bold: false, italic: false, underline: false, strike: false, highlight: false }] : [];
  };
  const combined = [...toRuns(nodeA), ...toRuns(nodeB)];
  const merged = [];
  for (const run of combined) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline && last.strike === run.strike && last.highlight === run.highlight) {
      merged[merged.length - 1] = { ...last, text: last.text + run.text };
    } else {
      merged.push({ ...run });
    }
  }
  const hasFormatting = merged.some(r => r.bold || r.italic || r.underline || r.strike || r.highlight);
  return hasFormatting ? merged : undefined;
};

const normalizeRuns = (runs = []) => {
  const merged = [];

  runs.forEach((run) => {
    const text = String(run?.text || "");
    if (!text) return;

    const normalizedRun = {
      text,
      bold: Boolean(run?.bold),
      italic: Boolean(run?.italic),
      underline: Boolean(run?.underline),
      strike: Boolean(run?.strike),
      highlight: normalizeHighlightColor(run?.highlight),
    };
    const last = merged[merged.length - 1];

    if (
      last &&
      last.bold === normalizedRun.bold &&
      last.italic === normalizedRun.italic &&
      last.underline === normalizedRun.underline &&
      last.strike === normalizedRun.strike &&
      last.highlight === normalizedRun.highlight
    ) {
      merged[merged.length - 1] = { ...last, text: last.text + normalizedRun.text };
      return;
    }

    merged.push(normalizedRun);
  });

  const hasFormatting = merged.some(run => run.bold || run.italic || run.underline || run.strike || run.highlight);
  return hasFormatting ? merged : undefined;
};

const getCompleteRunsForNode = (node) => {
  const text = String(node?.text || "");
  if (!text) return [];

  if (Array.isArray(node?.runs) && runsToText(node.runs) === text) {
    return node.runs.map(run => ({
      text: String(run?.text || ""),
      bold: Boolean(run?.bold),
      italic: Boolean(run?.italic),
      underline: Boolean(run?.underline),
      strike: Boolean(run?.strike),
      highlight: normalizeHighlightColor(run?.highlight),
    }));
  }

  return [{ text, bold: false, italic: false, underline: false, strike: false, highlight: false }];
};

const getRunMarkValue = (run, markName) => {
  if (markName === "highlight") return normalizeHighlightColor(run?.highlight);
  if (markName === "bold") return Boolean(run?.bold);
  if (markName === "italic") return Boolean(run?.italic);
  if (markName === "underline") return Boolean(run?.underline);
  if (markName === "strike") return Boolean(run?.strike);
  return false;
};

const normalizeInlineMarkValue = (markName, value) => {
  if (markName === "highlight") return normalizeHighlightColor(value);
  if (["bold", "italic", "underline", "strike"].includes(markName)) return Boolean(value);
  return value;
};

const applyInlineMarkToRuns = (node, startOffset, endOffset, markName, nextValue) => {
  const text = String(node?.text || "");
  const safeStart = Math.max(0, Math.min(text.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(text.length, endOffset));

  if (!["bold", "italic", "underline", "strike", "highlight"].includes(markName) || safeStart === safeEnd) {
    return node?.runs;
  }

  const nextRuns = [];
  let cursor = 0;
  const normalizedValue = normalizeInlineMarkValue(markName, nextValue);

  getCompleteRunsForNode(node).forEach((run) => {
    const runText = String(run.text || "");
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;

    if (runEnd <= safeStart || runStart >= safeEnd) {
      nextRuns.push(run);
      return;
    }

    const selectedStart = Math.max(safeStart, runStart);
    const selectedEnd = Math.min(safeEnd, runEnd);
    const beforeText = runText.slice(0, selectedStart - runStart);
    const selectedText = runText.slice(selectedStart - runStart, selectedEnd - runStart);
    const afterText = runText.slice(selectedEnd - runStart);

    if (beforeText) nextRuns.push({ ...run, text: beforeText });
    if (selectedText) nextRuns.push({ ...run, text: selectedText, [markName]: normalizedValue });
    if (afterText) nextRuns.push({ ...run, text: afterText });
  });

  return normalizeRuns(nextRuns);
};

const isNodeRangeFullyMarked = (node, startOffset, endOffset, markName) => {
  const text = String(node?.text || "");
  const safeStart = Math.max(0, Math.min(text.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(text.length, endOffset));
  if (safeStart === safeEnd) return false;

  let cursor = 0;
  let sawSelectedText = false;

  for (const run of getCompleteRunsForNode(node)) {
    const runText = String(run.text || "");
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;

    if (runEnd <= safeStart || runStart >= safeEnd) continue;
    const selectedStart = Math.max(safeStart, runStart);
    const selectedEnd = Math.min(safeEnd, runEnd);
    if (selectedEnd <= selectedStart) continue;

    sawSelectedText = true;
    if (!getRunMarkValue(run, markName)) return false;
  }

  return sawSelectedText;
};

const getNodeRangeHighlightValue = (node, startOffset, endOffset) => {
  const text = String(node?.text || "");
  const safeStart = Math.max(0, Math.min(text.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(text.length, endOffset));
  if (safeStart === safeEnd) return false;

  let cursor = 0;
  let selectedHighlight = null;

  for (const run of getCompleteRunsForNode(node)) {
    const runText = String(run.text || "");
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;

    if (runEnd <= safeStart || runStart >= safeEnd) continue;
    const selectedStart = Math.max(safeStart, runStart);
    const selectedEnd = Math.min(safeEnd, runEnd);
    if (selectedEnd <= selectedStart) continue;

    const highlight = normalizeHighlightColor(run.highlight);
    if (!highlight) return false;
    if (selectedHighlight === null) {
      selectedHighlight = highlight;
    } else if (selectedHighlight !== highlight) {
      return false;
    }
  }

  return selectedHighlight || false;
};

const getInlineFormatsAtOffset = (node, offset = 0) => {
  const text = String(node?.text || "");
  if (!text) return { bold: false, italic: false, underline: false, strike: false, highlight: false };

  const safeOffset = Math.max(0, Math.min(text.length, offset));
  let cursor = 0;

  for (const run of getCompleteRunsForNode(node)) {
    const runText = String(run.text || "");
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;

    const isInsideRun = safeOffset >= runStart && (safeOffset < runEnd || (safeOffset === text.length && safeOffset === runEnd));
    if (!isInsideRun) continue;

    return {
      bold: Boolean(run.bold),
      italic: Boolean(run.italic),
      underline: Boolean(run.underline),
      strike: Boolean(run.strike),
      highlight: normalizeHighlightColor(run.highlight),
    };
  }

  return { bold: false, italic: false, underline: false, strike: false, highlight: false };
};

const applyHighlightToRuns = (node, startOffset, endOffset, highlightColor) => {
  return applyInlineMarkToRuns(node, startOffset, endOffset, "highlight", highlightColor);
};

const replaceTextRangeInNode = (node, startOffset, endOffset, replacementText) => {
  const text = String(node?.text || "");
  const safeStart = Math.max(0, Math.min(text.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(text.length, endOffset));
  const replacement = String(replacementText || "");

  if (safeStart === safeEnd && !replacement) return node;

  const nextRuns = [];
  let cursor = 0;
  let inserted = false;
  let replacementStyle = { bold: false, italic: false, underline: false, strike: false, highlight: false };

  getCompleteRunsForNode(node).forEach((run) => {
    const runText = String(run.text || "");
    const runStart = cursor;
    const runEnd = cursor + runText.length;
    cursor = runEnd;

    if (runEnd <= safeStart || runStart >= safeEnd) {
      nextRuns.push(run);
      return;
    }

    const selectedStart = Math.max(safeStart, runStart);
    const selectedEnd = Math.min(safeEnd, runEnd);
    const beforeText = runText.slice(0, selectedStart - runStart);
    const afterText = runText.slice(selectedEnd - runStart);

    if (!inserted) {
      replacementStyle = {
        bold: Boolean(run.bold),
        italic: Boolean(run.italic),
        underline: Boolean(run.underline),
        strike: Boolean(run.strike),
        highlight: normalizeHighlightColor(run.highlight),
      };
    }

    if (beforeText) nextRuns.push({ ...run, text: beforeText });
    if (!inserted && replacement) nextRuns.push({ ...replacementStyle, text: replacement });
    inserted = true;
    if (afterText) nextRuns.push({ ...run, text: afterText });
  });

  if (!inserted && replacement) nextRuns.push({ ...replacementStyle, text: replacement });

  return {
    ...node,
    text: `${text.slice(0, safeStart)}${replacement}${text.slice(safeEnd)}`,
    runs: normalizeRuns(nextRuns),
  };
};

const debugWritingSelection = (...args) => {
  if (typeof window !== "undefined" && window.__DEBUG_WRITING_SELECTION) {
    console.log("[WritingSelection]", ...args);
  }
};

const getRangeDebugLabel = (range) => {
  if (!range) return null;
  const node = range.startContainer;
  return {
    nodeType: node?.nodeType,
    nodeName: node?.nodeName,
    parentDataNodeId: node?.parentElement?.closest?.("[data-node-id]")?.dataset?.nodeId || null,
    offset: range.startOffset,
  };
};

const getTextContentRect = (textEl) => {
  if (!textEl) return null;

  const textNodeRects = [];
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    textNodeRects.push(...Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0));
    textNode = walker.nextNode();
  }

  const rects = textNodeRects;
  if (!rects.length) return textEl.getBoundingClientRect();

  return rects.reduce((bounds, rect) => ({
    left: Math.min(bounds.left, rect.left),
    right: Math.max(bounds.right, rect.right),
    top: Math.min(bounds.top, rect.top),
    bottom: Math.max(bounds.bottom, rect.bottom),
    width: Math.max(bounds.right, rect.right) - Math.min(bounds.left, rect.left),
    height: Math.max(bounds.bottom, rect.bottom) - Math.min(bounds.top, rect.top),
  }), rects[0]);
};

const getCaretRangeFromPoint = (clientX, clientY) => {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(clientX, clientY);
  }

  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (!position) return null;

    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return null;
};

const getTextBoundaryRange = (textEl, boundary) => {
  if (!textEl) return null;

  const range = document.createRange();
  range.selectNodeContents(textEl);
  range.collapse(boundary === "start");
  return range;
};

const getTextRangeForRowPointer = (rowEl, clientX, clientY) => {
  const textEl = rowEl?.querySelector?.("[data-node-text='true']");
  if (!textEl) return null;

  const contentRect = getTextContentRect(textEl);
  const textRect = textEl.getBoundingClientRect();
  const leftBoundary = contentRect?.left ?? textRect.left;
  const rightBoundary = contentRect?.right ?? textRect.right;

  if (clientX <= leftBoundary) {
    return getTextBoundaryRange(textEl, "start");
  }

  if (clientX >= rightBoundary) {
    return getTextBoundaryRange(textEl, "end");
  }

  const pointRange = getCaretRangeFromPoint(clientX, clientY);
  if (pointRange && textEl.contains(pointRange.startContainer)) {
    return pointRange;
  }

  if (contentRect) {
    return getTextBoundaryRange(
      textEl,
      clientX <= contentRect.left + contentRect.width / 2 ? "start" : "end"
    );
  }

  return getTextBoundaryRange(
    textEl,
    clientX <= textRect.left + textRect.width / 2 ? "start" : "end"
  );
};

const rangesHaveSameBoundary = (firstRange, secondRange) => {
  return Boolean(
    firstRange &&
    secondRange &&
    firstRange.startContainer === secondRange.startContainer &&
    firstRange.startOffset === secondRange.startOffset
  );
};

const getNearestRowFromPointer = (root, clientY) => {
  if (!root) return null;

  const rows = Array.from(root.querySelectorAll("[data-writing-node-row='true']"));
  if (!rows.length) return null;

  return rows.reduce((nearest, row) => {
    const rect = row.getBoundingClientRect();
    const distance =
      clientY < rect.top ? rect.top - clientY :
      clientY > rect.bottom ? clientY - rect.bottom :
      0;

    if (!nearest || distance < nearest.distance) {
      return { row, distance };
    }

    return nearest;
  }, null)?.row || null;
};

const getTextRangeFromPointer = (root, clientX, clientY) => {
  if (!root) return null;

  const target = document.elementFromPoint(clientX, clientY);
  const rowEl =
    target?.closest?.("[data-writing-node-row='true']") ||
    getNearestRowFromPointer(root, clientY);

  if (rowEl) {
    return getTextRangeForRowPointer(rowEl, clientX, clientY);
  }

  const pointRange = getCaretRangeFromPoint(clientX, clientY);
  if (pointRange && root.contains(pointRange.startContainer)) {
    return pointRange;
  }

  return null;
};

const getPointerSideForRow = (rowEl, clientX) => {
  const textEl = rowEl?.querySelector?.("[data-node-text='true']");
  const contentRect = getTextContentRect(textEl);

  if (!contentRect) return "other";
  if (clientX < contentRect.left) return "left margin";
  if (clientX > contentRect.right) return "right margin";
  return "text";
};

const getElementDiagnostic = (element) => {
  if (!element) return null;
  const computedStyle = window.getComputedStyle(element);

  return {
    tag: element.tagName,
    className: typeof element.className === "string" ? element.className : "",
    dataset: { ...(element.dataset || {}) },
    cursor: computedStyle.cursor,
    pointerEvents: computedStyle.pointerEvents,
    position: computedStyle.position,
    zIndex: computedStyle.zIndex,
  };
};

const getRectDiagnostic = (rect) => {
  if (!rect) return null;
  return {
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
};

const applyCollapsedSelection = (range) => {
  if (!range) return false;

  const selection = window.getSelection();
  if (!selection) return false;

  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const applySelectionBetweenRanges = (anchorRange, focusRange) => {
  if (!anchorRange || !focusRange) return false;

  const selectionRange = document.createRange();
  const anchorBeforeFocus =
    anchorRange.compareBoundaryPoints(Range.START_TO_START, focusRange) <= 0;

  if (anchorBeforeFocus) {
    selectionRange.setStart(anchorRange.startContainer, anchorRange.startOffset);
    selectionRange.setEnd(focusRange.startContainer, focusRange.startOffset);
  } else {
    selectionRange.setStart(focusRange.startContainer, focusRange.startOffset);
    selectionRange.setEnd(anchorRange.startContainer, anchorRange.startOffset);
  }

  const selection = window.getSelection();
  if (!selection) return false;

  selection.removeAllRanges();
  selection.addRange(selectionRange);
  return true;
};

const isEffectivelyEmptyText = (text) => {
  return !String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\n/g, "")
    .trim().length;
};

// Types whose blocks can be merged when the user presses Backspace at the start
// or Delete at the end of a same-typed adjacent block.
// Scene Heading, Character, and Transition are structural anchors and must not merge.
const MERGE_COMPATIBLE_TYPES = new Set(["Action", "Dialogue", "Parenthetical", "Shot"]);

const isMergeCompatible = (typeA, typeB) =>
  typeA === typeB && MERGE_COMPATIBLE_TYPES.has(typeA);

const normalizeCharacterName = (text = "") => {
  return String(text || "")
    .replace(/\s*\(CONT'D\)\s*$/i, "")
    .trim()
    .toUpperCase();
};

const findCharacterForDialogueBeforeIndex = (nodes = [], dialogueIndex) => {
  for (let i = dialogueIndex - 1; i >= 0; i -= 1) {
    const type = normalizeNodeType(nodes[i]?.type);

    if (type === "Scene Heading") return "";

    if (type === "Character") {
      return normalizeCharacterName(nodes[i]?.text);
    }

    if (type !== "Parenthetical" && type !== "Dialogue") {
      return "";
    }
  }

  return "";
};

const getPreviousSpeakingCharacterInScene = (nodes = [], characterIndex) => {
  for (let i = characterIndex - 1; i >= 0; i -= 1) {
    const type = normalizeNodeType(nodes[i]?.type);

    if (type === "Scene Heading") return "";

    if (type === "Dialogue" && !isEffectivelyEmptyText(nodes[i]?.text)) {
      return findCharacterForDialogueBeforeIndex(nodes, i);
    }
  }

  return "";
};

const shouldShowCharacterContinued = (nodes = [], characterIndex) => {
  const node = nodes[characterIndex];

  if (normalizeNodeType(node?.type) !== "Character") return false;

  if (/\(CONT'?D\.?\)/i.test(String(node?.text || ""))) return false;

  const currentCharacter = normalizeCharacterName(node?.text);
  if (!currentCharacter) return false;

  const previousSpeakingCharacter = getPreviousSpeakingCharacterInScene(nodes, characterIndex);

  return previousSpeakingCharacter === currentCharacter;
};

const isDialogueFlowType = (type) => {
  const normalizedType = normalizeNodeType(type);
  return normalizedType === "Dialogue" || normalizedType === "Parenthetical";
};

const getDialogueGroupCharacterBeforeIndex = (nodes = [], index) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const type = normalizeNodeType(nodes[i]?.type);

    if (type === "Scene Heading") return "";

    if (type === "Character") {
      return normalizeCharacterName(nodes[i]?.text);
    }

    if (!isDialogueFlowType(type)) {
      return "";
    }
  }

  return "";
};

const getDialogueContinuationCharacterAtIndex = (nodes = [], index) => {
  const node = nodes[index];
  const type = normalizeNodeType(node?.type);

  if (!isDialogueFlowType(type)) return "";

  return getDialogueGroupCharacterBeforeIndex(nodes, index);
};

const shouldShowDialogueMoreAfterPage = (nodes = [], pageNodes = []) => {
  const lastEntry = pageNodes[pageNodes.length - 1];
  if (!lastEntry) return false;

  const lastIndex = lastEntry.index;
  const nextNode = nodes[lastIndex + 1];

  if (!isDialogueFlowType(lastEntry.node?.type) || !isDialogueFlowType(nextNode?.type)) {
    return false;
  }

  const currentCharacter = getDialogueContinuationCharacterAtIndex(nodes, lastIndex);
  const nextCharacter = getDialogueContinuationCharacterAtIndex(nodes, lastIndex + 1);

  return Boolean(currentCharacter && currentCharacter === nextCharacter);
};

const getPageStartDialogueContinuationCharacter = (nodes = [], pageNodes = []) => {
  const firstEntry = pageNodes[0];
  if (!firstEntry || firstEntry.index <= 0) return "";

  const firstIndex = firstEntry.index;
  const previousNode = nodes[firstIndex - 1];

  if (!isDialogueFlowType(firstEntry.node?.type) || !isDialogueFlowType(previousNode?.type)) {
    return "";
  }

  const currentCharacter = getDialogueContinuationCharacterAtIndex(nodes, firstIndex);
  const previousCharacter = getDialogueContinuationCharacterAtIndex(nodes, firstIndex - 1);

  return currentCharacter && currentCharacter === previousCharacter ? currentCharacter : "";
};

const getWrappedLineSegments = (text = "", maxChars = 36) => {
  const source = String(text || "").replace(/\u00a0/g, " ");

  if (!source.trim()) {
    return [{ text: source, start: 0, end: source.length }];
  }

  const segments = [];
  const paragraphs = source.split(/(\n+)/);
  let globalOffset = 0;

  paragraphs.forEach((part) => {
    const partStart = globalOffset;
    globalOffset += part.length;

    if (!part) return;

    if (/^\n+$/.test(part)) {
      part.split("").forEach((char, index) => {
        segments.push({
          text: char,
          start: partStart + index,
          end: partStart + index + 1,
        });
      });
      return;
    }

    const words = [];
    const wordRegex = /\S+/g;
    let match;

    while ((match = wordRegex.exec(part)) !== null) {
      words.push({
        text: match[0],
        start: partStart + match.index,
        end: partStart + match.index + match[0].length,
      });
    }

    if (!words.length) {
      segments.push({
        text: part,
        start: partStart,
        end: partStart + part.length,
      });
      return;
    }

    let lineStart = words[0].start;
    let lineEnd = words[0].end;
    let lineLength = words[0].text.length;

    words.slice(1).forEach((word) => {
      const nextLength = lineLength + 1 + word.text.length;

      if (nextLength <= maxChars) {
        lineEnd = word.end;
        lineLength = nextLength;
        return;
      }

      segments.push({
        text: source.slice(lineStart, lineEnd),
        start: lineStart,
        end: lineEnd,
      });

      lineStart = word.start;
      lineEnd = word.end;
      lineLength = word.text.length;
    });

    segments.push({
      text: source.slice(lineStart, lineEnd),
      start: lineStart,
      end: lineEnd,
    });
  });

  return segments.length ? segments : [{ text: source, start: 0, end: source.length }];
};

const getSceneStatsFromPaginatedPages = (pages = [], nodes = [], layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const stats = {};
  const linesPerPage = getEffectivePageBodyHeightLines(layoutTuning);

  let pageIndex = 0;
  let lineCursor = 0;
  let activeScene = null;

  const closeActiveScene = (endTimelinePage) => {
    if (!activeScene) return;

    const safeEndTimelinePage = Math.max(activeScene.timelineStartPage + 0.125, endTimelinePage);
    const endPageNumber = Math.max(
      activeScene.pageNumber,
      Math.ceil(safeEndTimelinePage)
    );

    const sceneStats = {
      pageNumber: activeScene.pageNumber,
      pageLength: Math.max(1, endPageNumber - activeScene.pageNumber + 1),
      timelineStartPage: activeScene.timelineStartPage,
      timelinePageLength: Math.max(0.125, safeEndTimelinePage - activeScene.timelineStartPage),
    };

    stats[activeScene.sceneId] = sceneStats;

    if (activeScene.headingNodeId && activeScene.headingNodeId !== activeScene.sceneId) {
      stats[activeScene.headingNodeId] = sceneStats;
    }

    activeScene = null;
  };

  pages.forEach((pageEntries = [], currentPageIndex) => {
    pageIndex = currentPageIndex;
    lineCursor = 0;

    pageEntries.forEach((entry) => {
      const node = entry?.node;
      const lineEstimate = getPageEntryLineEstimate(sourceNodes, entry, layoutTuning);

      if (normalizeNodeType(node?.type) === "Scene Heading") {
        const timelineStartPage = pageIndex + (lineCursor / linesPerPage);
        const sceneId = node?.sceneId || node?.id;
        const headingNodeId = node?.id || sceneId;

        closeActiveScene(timelineStartPage);

        if (sceneId) {
          activeScene = {
            sceneId,
            headingNodeId,
            pageNumber: pageIndex + 1,
            timelineStartPage,
          };
        }
      }

      lineCursor += lineEstimate;
    });
  });

  closeActiveScene(pageIndex + (lineCursor / linesPerPage));

  return stats;
};

const findDialoguePageOverflowSplit = (nodes = [], targetIndex = -1, caretOffset = 0, layoutTuning = DEFAULT_LAYOUT_TUNING) => {
  if (targetIndex < 0) return null;

  const targetNode = nodes[targetIndex];
  if (normalizeNodeType(targetNode?.type) !== "Dialogue") return null;

  const maxChars = getTunedCharsPerLine("Dialogue", layoutTuning);
  const targetText = String(targetNode.text || "");
  const segments = getWrappedLineSegments(targetText, maxChars);

  if (segments.length <= 1) return null;

  let currentLineCount = 0;
  const linesPerPage = getEffectivePageBodyHeightLines(layoutTuning);

  for (let i = 0; i < targetIndex; i += 1) {
    const previousNode = nodes[i - 1] || null;
    const nextNode = nodes[i + 1] || null;
    const lineEstimate = getNodeLineEstimate(nodes[i], previousNode, nextNode, layoutTuning);

    if (
      currentLineCount > 0 &&
      currentLineCount + lineEstimate > linesPerPage
    ) {
      currentLineCount = 0;
    }

    currentLineCount += lineEstimate;
  }

  const previousNode = nodes[targetIndex - 1] || null;
  const nextNode = nodes[targetIndex + 1] || null;
  const style = getScreenplayNodeStyle(targetNode, previousNode, nextNode, layoutTuning);
  const marginTopLines = marginLinesFromStyle(style.marginTop, layoutTuning);
  const marginBottomLines = marginLinesFromStyle(style.marginBottom, layoutTuning);
  const availableTextLines = linesPerPage - currentLineCount - marginTopLines - marginBottomLines;

  if (availableTextLines < 2) return null;
  if (segments.length <= availableTextLines) return null;

  const splitAfterSegment = segments[Math.max(0, availableTextLines - 1)];
  const splitOffset = splitAfterSegment?.end || 0;

  const beforeText = targetText.slice(0, splitOffset).trimEnd();
  const afterText = targetText.slice(splitOffset).trimStart();

  if (!beforeText || !afterText) return null;

  const continuationNode = {
    ...targetNode,
    id: makeTempNodeId(),
    text: afterText,
  };

  const nextNodes = [
    ...nodes.slice(0, targetIndex),
    { ...targetNode, text: beforeText },
    continuationNode,
    ...nodes.slice(targetIndex + 1),
  ];

  const shouldFocusContinuation = caretOffset > splitOffset;

  return {
    nextNodes,
    focusNodeId: shouldFocusContinuation ? continuationNode.id : targetNode.id,
    focusOffset: shouldFocusContinuation
      ? Math.max(0, caretOffset - splitOffset)
      : Math.min(caretOffset, beforeText.length),
  };
};

const ScriptWritingEditor = forwardRef(function ScriptWritingEditor({
  initialNodes = [],
  onNodesChange = null,
  activeElementType = "",
  onActiveElementTypeChange = null,
  onActiveElementTypeSelect = null,
  sceneRefs = null,
  onSceneStatsChange = null,
  onPageCountChange = null,
  showSceneNumbers = true,
  showFloatingElementSelector = true,
  showMoodOverlay = false,
  spellCheckEnabled = false,
}, ref) {
  const [nodes, setNodes] = useState(() => normalizeNodes(initialNodes));
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [characterAutocomplete, setCharacterAutocomplete] = useState(null);
  const [locationAutocomplete, setLocationAutocomplete] = useState(null);
  const [elementChooser, setElementChooser] = useState(null);
  const [activeSpellcheckRange, setActiveSpellcheckRange] = useState(null);
  const [activeElementRect, setActiveElementRect] = useState(null);
  const [sceneDragState, setSceneDragState] = useState({
    draggedSceneId: null,
    overSceneId: null,
    position: "before",
  });
  const editorRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastEmittedNodesPayloadRef = useRef("");
  const lastSceneStatsPayloadRef = useRef("");
  const lastPageCountRef = useRef(null);
  const nodesRef = useRef(nodes);
  const onNodesChangeRef = useRef(onNodesChange);
  const marginSelectionCleanupRef = useRef(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    onNodesChangeRef.current = onNodesChange;
  }, [onNodesChange]);

  useEffect(() => {
    return () => {
      marginSelectionCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const normalizedInitialNodes = normalizeNodes(initialNodes);
    const nextPayload = getNodesPayload(normalizedInitialNodes);

    if (nextPayload === lastEmittedNodesPayloadRef.current) {
      return;
    }

    setNodes(prevNodes => {
      const currentPayload = getNodesPayload(prevNodes);

      return currentPayload === nextPayload ? prevNodes : normalizedInitialNodes;
    });

    setCharacterAutocomplete(null);
    setLocationAutocomplete(null);
    setElementChooser(null);
  }, [initialNodes]);

  const activeNode = useMemo(() => {
    return nodes.find(node => node.id === activeNodeId) || null;
  }, [activeNodeId, nodes]);

  useEffect(() => {
    onActiveElementTypeChange?.(activeNode?.type || "");
  }, [activeNode?.type, onActiveElementTypeChange]);

  useEffect(() => {
    if (!activeElementType || !activeNodeId) return;
    if (activeNode?.type === activeElementType) return;

    updateNodeType(activeNodeId, activeElementType);
  }, [activeElementType]);

  const paginatedPages = useMemo(() => {
    return paginateNodesForScreen(nodes);
  }, [nodes]);

  useEffect(() => {
    const nextStats = getSceneStatsFromPaginatedPages(paginatedPages, nodes);
    const nextPayload = getSceneStatsPayload(nextStats);
    if (nextPayload === lastSceneStatsPayloadRef.current) return;

    lastSceneStatsPayloadRef.current = nextPayload;
    onSceneStatsChange?.(nextStats);
  }, [nodes, onSceneStatsChange, paginatedPages]);

  useEffect(() => {
    if (lastPageCountRef.current === paginatedPages.length) return;
    lastPageCountRef.current = paginatedPages.length;
    onPageCountChange?.(paginatedPages.length);
  }, [paginatedPages.length, onPageCountChange]);

  const updateActiveElementRect = (nodeId = activeNodeId) => {
    requestAnimationFrame(() => {
      if (!nodeId) {
        setActiveElementRect(prev => (prev === null ? prev : null));
        return;
      }

      const rowEl = getNodeElement(editorRef.current, nodeId);
      if (!rowEl) {
        setActiveElementRect(prev => (prev === null ? prev : null));
        return;
      }

      const rect = rowEl.getBoundingClientRect();
      const nextRect = {
        left: rect.left - 30,
        top: rect.top + 1,
      };

      setActiveElementRect(prev => (activeRectEquals(prev, nextRect) ? prev : nextRect));
    });
  };

  useEffect(() => {
    if (!activeNodeId) {
      setActiveElementRect(prev => (prev === null ? prev : null));
      return undefined;
    }

    const update = () => updateActiveElementRect(activeNodeId);

    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeNodeId, nodes]);

  const characterNames = useMemo(() => {
    const names = new Set();

    nodes.forEach((node) => {
      if (node.type !== "Character") return;

      const name = String(node.text || "")
        .replace(/\s*\(CONT'D\)\s*$/i, "")
        .trim()
        .toUpperCase();

      if (name) names.add(name);
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [nodes]);

  const sceneHeadingLocations = useMemo(() => {
    const locations = new Set();

    nodes.forEach((node) => {
      if (node.type !== "Scene Heading") return;
      const location = extractSceneHeadingLocation(node.text);
      if (location) locations.add(location.toUpperCase());
    });

    return Array.from(locations).sort((a, b) => a.localeCompare(b));
  }, [nodes]);

  const emitNodesChange = (nextNodes) => {
    lastEmittedNodesPayloadRef.current = getNodesPayload(nextNodes);
    onNodesChange?.(nextNodes);
  };

  const readNodesFromDom = (sourceNodes = nodes) => {
    const root = editorRef.current;
    if (!root) return sourceNodes;

    let changed = false;
    const nextNodes = sourceNodes.map((node) => {
      const el = getNodeElement(root, node.id);
      const text = getTextFromNodeElement(el);
      const runs = getRunsFromNodeElement(el);
      const nextNode = runs !== undefined ? { ...node, text, runs } : { ...node, text, runs: undefined };
      const sameText = String(node.text || "") === String(nextNode.text || "");
      const sameRuns = JSON.stringify(node.runs) === JSON.stringify(nextNode.runs);

      if (sameText && sameRuns) return node;

      changed = true;
      return nextNode;
    });

    return changed ? nextNodes : sourceNodes;
  };

  const syncNodesFromDom = () => {
    const nextNodes = readNodesFromDom(nodes);
    const nextPayload = getNodesPayload(nextNodes);
    const currentPayload = getNodesPayload(nodes);

    if (nextPayload !== currentPayload) {
      setNodes(nextNodes);
      emitNodesChange(nextNodes);
    }

    return nextNodes;
  };

  const flushNodesFromDom = () => {
    const liveNodes = readNodesFromDom(nodesRef.current);
    const livePayload = getNodesPayload(liveNodes);

    if (livePayload !== lastEmittedNodesPayloadRef.current) {
      lastEmittedNodesPayloadRef.current = livePayload;
      onNodesChangeRef.current?.(liveNodes);
    }

    return liveNodes;
  };

  useEffect(() => {
    return () => {
      if (!editorRef.current) return;
      flushNodesFromDom();
    };
  }, []);
  const cloneNodesForHistory = (sourceNodes) => {
    return normalizeNodes(sourceNodes).map(node => ({
      ...node,
      metadata: node.metadata ? { ...node.metadata } : node.metadata,
    }));
  };

  const pushHistorySnapshot = (snapshotNodes = readNodesFromDom(nodes)) => {
    undoStackRef.current.push(cloneNodesForHistory(snapshotNodes));

    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }

    redoStackRef.current = [];
  };

  const restoreNodeSnapshot = (snapshotNodes, focusNodeId = null) => {
    const restoredNodes = cloneNodesForHistory(snapshotNodes);
    setNodes(restoredNodes);
    emitNodesChange(restoredNodes);

    const nodeToFocus = focusNodeId || activeNodeId || restoredNodes[0]?.id || null;

    if (nodeToFocus) {
      requestAnimationFrame(() => {
        const el = getNodeElement(editorRef.current, nodeToFocus);
        if (!el) return;

        el.focus();
        setCaretToEnd(el);
        setActiveNodeId(nodeToFocus);
      });
    }
  };

  const handleUndoRedo = (direction) => {
    const currentNodes = readNodesFromDom(nodes);

    if (direction === "undo") {
      const previousSnapshot = undoStackRef.current.pop();
      if (!previousSnapshot) return;

      redoStackRef.current.push(cloneNodesForHistory(currentNodes));
      restoreNodeSnapshot(previousSnapshot);
      return;
    }

    if (direction === "redo") {
      const nextSnapshot = redoStackRef.current.pop();
      if (!nextSnapshot) return;

      undoStackRef.current.push(cloneNodesForHistory(currentNodes));
      restoreNodeSnapshot(nextSnapshot);
    }
  };

  const updateNodes = (updater, focusNodeId = null, focusOptions = {}) => {
    let normalizedNextNodes = null;
    let shouldEmit = false;

    setNodes(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      normalizedNextNodes = normalizeNodes(next);
      const prevPayload = getNodesPayload(prev);
      const nextPayload = getNodesPayload(normalizedNextNodes);
      shouldEmit = prevPayload !== nextPayload;
      return shouldEmit ? normalizedNextNodes : prev;
    });

    if (normalizedNextNodes && shouldEmit) {
      requestAnimationFrame(() => {
        emitNodesChange(normalizedNextNodes);
      });
    }

    if (focusNodeId) {
      requestAnimationFrame(() => {
        const el = getNodeElement(editorRef.current, focusNodeId);
        if (el) {
          el.focus();

          if (Number.isFinite(focusOptions.caretOffset)) {
            setCaretOffset(el, focusOptions.caretOffset);
          } else {
            setCaretToEnd(el);
          }

          setActiveNodeId(focusNodeId);
        }
      });
    }
  };

  const getSceneDragId = (node) => {
    return String(node?.id || "");
  };

  const getSceneRanges = (sourceNodes = []) => {
    const headings = sourceNodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => normalizeNodeType(node?.type) === "Scene Heading");

    return headings.map((heading, headingIndex) => {
      const nextHeading = headings[headingIndex + 1];
      const headingNodeId = String(heading.node?.id || "");

      return {
        sceneId: headingNodeId,
        headingNodeId,
        start: heading.index,
        end: nextHeading ? nextHeading.index : sourceNodes.length,
      };
    });
  };

  const moveSceneSection = (draggedSceneId, targetSceneId, position = "before") => {
    if (!draggedSceneId || !targetSceneId || draggedSceneId === targetSceneId) return;

    const currentNodes = readNodesFromDom(nodes);
    const ranges = getSceneRanges(currentNodes);
    const draggedRange = ranges.find(range => range.sceneId === String(draggedSceneId));
    const targetRange = ranges.find(range => range.sceneId === String(targetSceneId));

    if (!draggedRange || !targetRange) return;

    pushHistorySnapshot(currentNodes);

    const movingNodes = currentNodes.slice(draggedRange.start, draggedRange.end);
    const remainingNodes = [
      ...currentNodes.slice(0, draggedRange.start),
      ...currentNodes.slice(draggedRange.end),
    ];

    let insertIndex = position === "after" ? targetRange.end : targetRange.start;

    if (draggedRange.start < insertIndex) {
      insertIndex -= movingNodes.length;
    }

    insertIndex = Math.max(0, Math.min(insertIndex, remainingNodes.length));

    const nextNodes = [
      ...remainingNodes.slice(0, insertIndex),
      ...movingNodes,
      ...remainingNodes.slice(insertIndex),
    ];

    setSceneDragState({
      draggedSceneId: null,
      overSceneId: null,
      position: "before",
    });

    updateNodes(nextNodes, movingNodes[0]?.id || null);
  };

  const getSceneDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const handleSceneDragStart = (event, sceneId) => {
    if (!sceneId) return;

    event.stopPropagation();

    const selection = window.getSelection();
    selection?.removeAllRanges();

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sceneId);

    setSceneDragState({
      draggedSceneId: sceneId,
      overSceneId: null,
      position: "before",
    });
  };
  const handleSceneDragOver = (event, sceneId) => {
    if (!sceneId || !sceneDragState.draggedSceneId) return;

    event.preventDefault();

    const position = getSceneDropPosition(event);

    setSceneDragState(prev => (
      prev.overSceneId === sceneId && prev.position === position
        ? prev
        : {
            ...prev,
            overSceneId: sceneId,
            position,
          }
    ));
  };

  const handleSceneDrop = (event, sceneId) => {
    if (!sceneId) return;

    event.preventDefault();
    event.stopPropagation();

    const draggedSceneId =
      sceneDragState.draggedSceneId ||
      event.dataTransfer.getData("text/plain");

    const position = getSceneDropPosition(event);

    moveSceneSection(draggedSceneId, sceneId, position);
  };

  const clearSceneDragState = () => {
    setSceneDragState({
      draggedSceneId: null,
      overSceneId: null,
      position: "before",
    });
  };

  const updateNodeType = (nodeId, type) => {
    if (!nodeId) return;

    setCharacterAutocomplete(null);
    setLocationAutocomplete(null);
    setElementChooser(null);
    pushHistorySnapshot();

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      return currentNodes.map(node => (
        node.id === nodeId ? { ...node, type: normalizeNodeType(type) } : node
      ));
    }, nodeId);

    setActiveNodeId(nodeId);
  };
  const transformNodeType = (nodeId, type, text = "") => {
    if (!nodeId) return;

    setCharacterAutocomplete(null);
    setElementChooser(null);
    pushHistorySnapshot();

    const nextType = normalizeNodeType(type);

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      return currentNodes.map(node => (
        node.id === nodeId ? { ...node, type: nextType, text: String(text || "") } : node
      ));
    }, nodeId);

    setActiveNodeId(nodeId);
  };

  const transformEmptyNodeToNewSceneHeading = (nodeId) => {
    if (!nodeId) return;

    setCharacterAutocomplete(null);
    setElementChooser(null);
    pushHistorySnapshot();

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      const newSceneId = createSceneId();

      return currentNodes.map(node => (
        node.id === nodeId
          ? {
              ...node,
              type: "Scene Heading",
              text: "",
              sceneId: newSceneId,
            }
          : node
      ));
    }, nodeId, { caretOffset: 0 });

    setActiveNodeId(nodeId);
  };

  const insertNodeAfter = (nodeId, type, text = "", focusOptions = {}) => {
    setCharacterAutocomplete(null);
    setElementChooser(null);
    pushHistorySnapshot();

    const newNode = {
      id: makeTempNodeId(),
      type: normalizeNodeType(type),
      text: String(text || ""),
      sceneId: null,
    };

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      const index = currentNodes.findIndex(node => node.id === nodeId);
      const currentNode = currentNodes[index];

      newNode.sceneId = currentNode?.sceneId || null;

      return index < 0
        ? [...currentNodes, newNode]
        : [
            ...currentNodes.slice(0, index + 1),
            newNode,
            ...currentNodes.slice(index + 1),
          ];
    }, newNode.id, focusOptions);

    return newNode;
  };

  const deleteEmptyNode = (nodeId) => {
    const currentNodes = readNodesFromDom(nodes);

    if (currentNodes.length <= 1) return;

    pushHistorySnapshot(currentNodes);

    const index = currentNodes.findIndex(node => node.id === nodeId);
    if (index < 0) return;

    const focusNode = currentNodes[index - 1] || currentNodes[index + 1];
    const focusNodeId = focusNode?.id || null;
    const nextNodes = currentNodes.filter(node => node.id !== nodeId);

    updateNodes(nextNodes, focusNodeId);

    if (focusNodeId) {
      setActiveNodeId(focusNodeId);
    }
  };

  const updateActiveNodeFromSelection = () => {
    requestAnimationFrame(() => {
      const currentNodeId = getCaretNodeId();
      if (currentNodeId) {
        setActiveNodeId(prev => (prev === currentNodeId ? prev : currentNodeId));
        updateActiveElementRect(currentNodeId);
      }
    });
  };

  const moveCaretToAdjacentNode = (direction) => {
    const { currentNode, currentNodes } = getCurrentLiveNode();

    if (!currentNode?.id) return false;

    const currentIndex = currentNodes.findIndex(node => node.id === currentNode.id);
    if (currentIndex < 0) return false;

    const nextIndex = currentIndex + direction;
    const nextNode = currentNodes[nextIndex];

    if (!nextNode?.id) return false;

    const currentTextEl = getNodeTextElement(editorRef.current, currentNode.id);
    const caretOffset = getCaretOffsetInElement(currentTextEl);
    const nextEl = getNodeElement(editorRef.current, nextNode.id);

    if (!nextEl) return false;

    nextEl.focus();

    requestAnimationFrame(() => {
      const latestEl = getNodeElement(editorRef.current, nextNode.id);
      if (!latestEl) return;

      setCaretOffset(latestEl, Math.min(caretOffset, String(nextNode.text || "").length));
      setActiveNodeId(nextNode.id);
      updateActiveElementRect(nextNode.id);

      latestEl.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });

    return true;
  };

  const getCurrentLiveNode = () => {
    const currentNodeId = getCaretNodeId() || activeNodeId;
    const currentNodes = readNodesFromDom(nodes);

    if (!currentNodeId) {
      return {
        currentNodeId: null,
        currentNode: null,
        currentEl: null,
        currentText: "",
        currentNodes,
      };
    }

    const currentNode = currentNodes.find(node => node.id === currentNodeId) || null;
    const currentEl = getNodeElement(editorRef.current, currentNodeId);
    const currentText = getTextFromNodeElement(currentEl);

    return { currentNodeId, currentNode, currentEl, currentText, currentNodes };
  };

  const getSelectionPositionInNode = (container, offset) => {
    const element = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;
    const rowEl = element?.closest?.("[data-node-id]");

    if (!rowEl || !editorRef.current?.contains(rowEl)) return null;

    const nodeId = rowEl.dataset.nodeId;
    const textEl = rowEl.querySelector?.("[data-node-text='true']") || rowEl;

    try {
      const range = document.createRange();
      range.selectNodeContents(textEl);
      range.setEnd(container, offset);

      const textOffset = String(range.toString() || "")
        .replace(/\u00a0/g, " ")
        .replace(/\u200B/g, "")
        .replace(/\n/g, "")
        .length;

      return { nodeId, offset: textOffset };
    } catch (_) {
      return { nodeId, offset: 0 };
    }
  };

  const getCurrentSelectionRange = () => {
    const selection = window.getSelection();
    const root = editorRef.current;

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !root) return null;

    const range = selection.getRangeAt(0);

    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      return null;
    }

    const currentNodes = readNodesFromDom(nodes);
    const startPos = getSelectionPositionInNode(range.startContainer, range.startOffset);
    const endPos = getSelectionPositionInNode(range.endContainer, range.endOffset);

    if (!startPos || !endPos) return null;

    const startIndexRaw = currentNodes.findIndex(node => node.id === startPos.nodeId);
    const endIndexRaw = currentNodes.findIndex(node => node.id === endPos.nodeId);

    if (startIndexRaw < 0 || endIndexRaw < 0) return null;

    const isForward =
      startIndexRaw < endIndexRaw ||
      (startIndexRaw === endIndexRaw && startPos.offset <= endPos.offset);

    return {
      currentNodes,
      startIndex: isForward ? startIndexRaw : endIndexRaw,
      endIndex: isForward ? endIndexRaw : startIndexRaw,
      startOffset: isForward ? startPos.offset : endPos.offset,
      endOffset: isForward ? endPos.offset : startPos.offset,
    };
  };

  const applyHighlightToSelection = (highlightColor) => {
    const selectionRange = getCurrentSelectionRange();
    if (!selectionRange) return false;

    const { currentNodes, startIndex, endIndex, startOffset, endOffset } = selectionRange;
    const startNode = currentNodes[startIndex];
    const endNode = currentNodes[endIndex];

    if (!startNode || !endNode) return false;

    pushHistorySnapshot(currentNodes);

    const nextNodes = currentNodes.map((node, index) => {
      if (index < startIndex || index > endIndex) return node;

      const nodeText = String(node.text || "");
      const nodeStartOffset = index === startIndex ? startOffset : 0;
      const nodeEndOffset = index === endIndex ? endOffset : nodeText.length;

      return {
        ...node,
        runs: applyHighlightToRuns(node, nodeStartOffset, nodeEndOffset, highlightColor),
      };
    });

    updateNodes(nextNodes);

    requestAnimationFrame(() => {
      setSelectionRangeInEditor(editorRef.current, startNode.id, startOffset, endNode.id, endOffset);
      setActiveNodeId(prev => (prev === startNode.id ? prev : startNode.id));
      updateActiveElementRect(startNode.id);
    });

    return true;
  };

  const getActiveInlineFormatsForSelection = () => {
    const selection = window.getSelection();
    const root = editorRef.current;

    if (!selection || selection.rangeCount === 0 || !root) {
      return { bold: false, italic: false, underline: false, strike: false, highlight: false };
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      return { bold: false, italic: false, underline: false, strike: false, highlight: false };
    }

    if (selection.isCollapsed) {
      const currentNodes = readNodesFromDom(nodes);
      const pos = getSelectionPositionInNode(range.startContainer, range.startOffset);
      const node = pos ? currentNodes.find(item => item.id === pos.nodeId) : null;
      return getInlineFormatsAtOffset(node, pos?.offset || 0);
    }

    const selectionRange = getCurrentSelectionRange();
    if (!selectionRange) return { bold: false, italic: false, underline: false, strike: false, highlight: false };

    const { currentNodes, startIndex, endIndex, startOffset, endOffset } = selectionRange;
    const formats = {
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      highlight: null,
    };
    let sawSelectedText = false;

    for (let index = startIndex; index <= endIndex; index += 1) {
      const node = currentNodes[index];
      if (!node) continue;

      const nodeText = String(node.text || "");
      const nodeStartOffset = index === startIndex ? startOffset : 0;
      const nodeEndOffset = index === endIndex ? endOffset : nodeText.length;
      if (nodeEndOffset <= nodeStartOffset) continue;

      sawSelectedText = true;
      formats.bold = formats.bold && isNodeRangeFullyMarked(node, nodeStartOffset, nodeEndOffset, "bold");
      formats.italic = formats.italic && isNodeRangeFullyMarked(node, nodeStartOffset, nodeEndOffset, "italic");
      formats.underline = formats.underline && isNodeRangeFullyMarked(node, nodeStartOffset, nodeEndOffset, "underline");
      formats.strike = formats.strike && isNodeRangeFullyMarked(node, nodeStartOffset, nodeEndOffset, "strike");

      const highlight = getNodeRangeHighlightValue(node, nodeStartOffset, nodeEndOffset);
      if (!highlight) {
        formats.highlight = false;
      } else if (formats.highlight === null) {
        formats.highlight = highlight;
      } else if (formats.highlight !== highlight) {
        formats.highlight = false;
      }
    }

    if (!sawSelectedText) {
      return { bold: false, italic: false, underline: false, strike: false, highlight: false };
    }

    return {
      bold: Boolean(formats.bold),
      italic: Boolean(formats.italic),
      underline: Boolean(formats.underline),
      strike: Boolean(formats.strike),
      highlight: formats.highlight || false,
    };
  };

  const applyInlineMarkToSelection = (markName, nextValue) => {
    const selectionRange = getCurrentSelectionRange();
    if (!selectionRange || !["bold", "italic", "underline", "strike"].includes(markName)) return false;

    const { currentNodes, startIndex, endIndex, startOffset, endOffset } = selectionRange;
    const startNode = currentNodes[startIndex];
    const endNode = currentNodes[endIndex];

    if (!startNode || !endNode) return false;

    pushHistorySnapshot(currentNodes);

    const nextNodes = currentNodes.map((node, index) => {
      if (index < startIndex || index > endIndex) return node;

      const nodeText = String(node.text || "");
      const nodeStartOffset = index === startIndex ? startOffset : 0;
      const nodeEndOffset = index === endIndex ? endOffset : nodeText.length;

      return {
        ...node,
        runs: applyInlineMarkToRuns(node, nodeStartOffset, nodeEndOffset, markName, nextValue),
      };
    });

    updateNodes(nextNodes);

    requestAnimationFrame(() => {
      setSelectionRangeInEditor(editorRef.current, startNode.id, startOffset, endNode.id, endOffset);
      setActiveNodeId(prev => (prev === startNode.id ? prev : startNode.id));
      updateActiveElementRect(startNode.id);
    });

    return true;
  };

  const toggleInlineMarkForSelection = (markName) => {
    const selectionRange = getCurrentSelectionRange();
    if (!selectionRange || !["bold", "italic", "underline", "strike"].includes(markName)) return false;

    const { currentNodes, startIndex, endIndex, startOffset, endOffset } = selectionRange;
    let fullyMarked = true;
    let sawSelectedText = false;

    for (let index = startIndex; index <= endIndex; index += 1) {
      const node = currentNodes[index];
      if (!node) continue;

      const nodeText = String(node.text || "");
      const nodeStartOffset = index === startIndex ? startOffset : 0;
      const nodeEndOffset = index === endIndex ? endOffset : nodeText.length;
      if (nodeEndOffset <= nodeStartOffset) continue;

      sawSelectedText = true;
      if (!isNodeRangeFullyMarked(node, nodeStartOffset, nodeEndOffset, markName)) {
        fullyMarked = false;
        break;
      }
    }

    if (!sawSelectedText) return false;
    return applyInlineMarkToSelection(markName, !fullyMarked);
  };

  const selectTextRange = ({ nodeId, startOffset = 0, endOffset = startOffset } = {}) => {
    if (!nodeId) return false;

    requestAnimationFrame(() => {
      const rowEl = getNodeElement(editorRef.current, nodeId);
      if (!rowEl) return;

      rowEl.scrollIntoView({ block: "center", inline: "nearest" });
      setSelectionRangeInEditor(editorRef.current, nodeId, startOffset, nodeId, endOffset);
      setActiveNodeId(prev => (prev === nodeId ? prev : nodeId));
      updateActiveElementRect(nodeId);
    });

    return true;
  };

  const replaceTextRange = ({ nodeId, startOffset = 0, endOffset = startOffset, replacement = "" } = {}) => {
    if (!nodeId) return false;

    const currentNodes = readNodesFromDom(nodes);
    const nodeIndex = currentNodes.findIndex(node => node.id === nodeId);
    if (nodeIndex < 0) return false;

    const currentNode = currentNodes[nodeIndex];
    pushHistorySnapshot(currentNodes);

    const nextNode = replaceTextRangeInNode(currentNode, startOffset, endOffset, replacement);
    const nextNodes = currentNodes.map((node, index) => (index === nodeIndex ? nextNode : node));
    const nextCaretOffset = startOffset + String(replacement || "").length;

    updateNodes(nextNodes, nodeId, { caretOffset: nextCaretOffset });

    requestAnimationFrame(() => {
      const el = getNodeElement(editorRef.current, nodeId);
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        setCaretOffset(el, nextCaretOffset);
      }
    });

    return true;
  };

	  const replaceTextRanges = (ranges = [], replacement = "") => {
	    const safeRanges = Array.isArray(ranges) ? ranges : [];
	    if (!safeRanges.length) return false;

    const currentNodes = readNodesFromDom(nodes);
    const rangesByNodeId = safeRanges.reduce((acc, range) => {
      if (!range?.nodeId) return acc;
      acc[range.nodeId] = acc[range.nodeId] || [];
      acc[range.nodeId].push(range);
      return acc;
    }, {});

    pushHistorySnapshot(currentNodes);

    const nextNodes = currentNodes.map((node) => {
      const nodeRanges = (rangesByNodeId[node.id] || [])
        .slice()
        .sort((a, b) => Number(b.startOffset) - Number(a.startOffset));

      return nodeRanges.reduce((nextNode, range) => (
        replaceTextRangeInNode(nextNode, range.startOffset, range.endOffset, replacement)
      ), node);
    });

	    updateNodes(nextNodes);
	    return true;
	  };

	  const clearActiveSpellcheckRange = useCallback(() => {
	    setActiveSpellcheckRange(prevRange => (prevRange === null ? prevRange : null));

	    const selection = window.getSelection?.();
	    const root = editorRef.current;
	    if (!selection || !root || selection.rangeCount === 0) {
	      return true;
	    }

	    const range = selection.getRangeAt(0);
	    if (root.contains(range.startContainer) || root.contains(range.endContainer)) {
	      selection.removeAllRanges();
	    }

	    return true;
	  }, []);

	  const updateActiveSpellcheckRange = useCallback((range) => {
	    const startOffset = Number(range?.startOffset);
	    const endOffset = Number(range?.endOffset);

	    if (!range?.nodeId || !Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
	      return clearActiveSpellcheckRange();
	    }

	    const nextRange = {
	      nodeId: range.nodeId,
	      startOffset: Math.max(0, startOffset),
	      endOffset: Math.max(0, endOffset),
	    };

	    setActiveSpellcheckRange(prevRange => {
	      if (
	        prevRange?.nodeId === nextRange.nodeId &&
	        prevRange?.startOffset === nextRange.startOffset &&
	        prevRange?.endOffset === nextRange.endOffset
	      ) {
	        return prevRange;
	      }

	      return nextRange;
	    });

	    return true;
	  }, [clearActiveSpellcheckRange]);

	  useEffect(() => {
	    if (!spellCheckEnabled) {
	      clearActiveSpellcheckRange();
	    }
	  }, [clearActiveSpellcheckRange, spellCheckEnabled]);

	  useImperativeHandle(ref, () => ({
	    applyInlineStyleToSelection: ({ highlight } = {}) => applyHighlightToSelection(highlight),
	    clearInlineStyleFromSelection: (styleName) => {
	      if (styleName !== "highlight") return false;
	      return applyHighlightToSelection(false);
	    },
	    toggleInlineStyleForSelection: toggleInlineMarkForSelection,
	    getActiveInlineFormats: getActiveInlineFormatsForSelection,
	    setActiveSpellcheckRange: updateActiveSpellcheckRange,
	    clearSpellcheckRange: clearActiveSpellcheckRange,
	    selectTextRange,
	    replaceTextRange,
	    replaceTextRanges,
	    getPdfExportModel: () => ({ pages: paginatedPages, nodes, layoutTuning: DEFAULT_LAYOUT_TUNING }),
	  }));

  const handleSelectedDelete = (event) => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

    const range = selection.getRangeAt(0);
    const root = editorRef.current;

    if (!root || (!root.contains(range.startContainer) && !root.contains(range.endContainer))) {
      return false;
    }

    const currentNodes = readNodesFromDom(nodes);
    const startPos = getSelectionPositionInNode(range.startContainer, range.startOffset);
    const endPos = getSelectionPositionInNode(range.endContainer, range.endOffset);

    if (!startPos || !endPos) return false;

    const startIndexRaw = currentNodes.findIndex(node => node.id === startPos.nodeId);
    const endIndexRaw = currentNodes.findIndex(node => node.id === endPos.nodeId);

    if (startIndexRaw < 0 || endIndexRaw < 0) return false;

    const isForward =
      startIndexRaw < endIndexRaw ||
      (startIndexRaw === endIndexRaw && startPos.offset <= endPos.offset);

    const startIndex = isForward ? startIndexRaw : endIndexRaw;
    const endIndex = isForward ? endIndexRaw : startIndexRaw;
    const startOffset = isForward ? startPos.offset : endPos.offset;
    const endOffset = isForward ? endPos.offset : startPos.offset;

    event.preventDefault();
    event.stopPropagation();

    pushHistorySnapshot(currentNodes);

    const startNode = currentNodes[startIndex];
    const endNode = currentNodes[endIndex];

    if (startIndex === endIndex) {
      const before = String(startNode.text || "").slice(0, startOffset);
      const after = String(startNode.text || "").slice(endOffset);
      const [runsBeforeStart] = splitRunsAtOffset(startNode.runs, startOffset);
      const [, runsAfterEnd] = splitRunsAtOffset(startNode.runs, endOffset);
      const mergedRuns = mergeRunsForNodes(
        { text: before, runs: runsBeforeStart },
        { text: after, runs: runsAfterEnd }
      );

      const nextNodes = currentNodes.map((node, index) => (
        index === startIndex ? { ...node, text: `${before}${after}`, runs: mergedRuns } : node
      ));

      updateNodes(nextNodes, startNode.id);

      requestAnimationFrame(() => {
        const el = getNodeElement(editorRef.current, startNode.id);
        if (el) setCaretOffset(el, startOffset);
      });

      return true;
    }

    const startText = String(startNode.text || "");
    const endText = String(endNode.text || "");
    const startBefore = startText.slice(0, startOffset);
    const endAfter = endText.slice(endOffset);
    const mergedText = `${startBefore}${endAfter}`;

    const shouldUseEndNodeAsSurvivor =
      isEffectivelyEmptyText(startBefore) &&
      !isEffectivelyEmptyText(endAfter);

    const survivorNode = shouldUseEndNodeAsSurvivor
      ? { ...endNode, text: mergedText }
      : { ...startNode, text: mergedText };

    const shouldKeepSurvivor = !isEffectivelyEmptyText(mergedText);

    const nextNodes = [
      ...currentNodes.slice(0, startIndex),
      ...(shouldKeepSurvivor ? [survivorNode] : []),
      ...currentNodes.slice(endIndex + 1),
    ];

    const safeNextNodes = nextNodes.length
      ? nextNodes
      : [{
          id: makeTempNodeId(),
          type: "Action",
          text: "",
          sceneId: null,
        }];

    const focusNodeId =
      (shouldKeepSurvivor ? survivorNode.id : null) ||
      safeNextNodes[Math.min(startIndex, safeNextNodes.length - 1)]?.id ||
      safeNextNodes[0]?.id ||
      null;

    updateNodes(safeNextNodes, focusNodeId);

    requestAnimationFrame(() => {
      const el = getNodeElement(editorRef.current, focusNodeId);
      if (el) setCaretOffset(el, shouldKeepSurvivor ? startBefore.length : 0);
    });

    return true;
  };

  const getCharacterAutocompleteOptions = (query, currentNodeId = null) => {
    const normalizedQuery = String(query || "").trim().toUpperCase();

    if (!normalizedQuery) return [];

    return characterNames
      .filter(name => name.startsWith(normalizedQuery))
      .filter(name => name !== normalizedQuery)
      .slice(0, 8);
  };

  const updateCharacterAutocomplete = (nodeId, text) => {
    const node = nodes.find(item => item.id === nodeId);
    if (!node || node.type !== "Character") {
      setCharacterAutocomplete(null);
      return;
    }

    const query = String(text || "").trim().toUpperCase();
    const suggestions = getCharacterAutocompleteOptions(query, nodeId);

    if (!query || suggestions.length === 0) {
      setCharacterAutocomplete(null);
      return;
    }

    const rowEl = getNodeElement(editorRef.current, nodeId);
    const rect = rowEl?.getBoundingClientRect?.();

    setCharacterAutocomplete({
      nodeId,
      query,
      suggestions,
      selectedIndex: 0,
      rect: rect
        ? {
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
          }
        : null,
    });
  };

  const getLocationAutocompleteOptions = (query, currentLocation = "") => {
    const normalizedQuery = String(query || "").trim().toUpperCase();
    const normalizedCurrent = String(currentLocation || "").trim().toUpperCase();

    if (!normalizedQuery) return [];

    return sceneHeadingLocations
      .filter(location => location.startsWith(normalizedQuery))
      .filter(location => location !== normalizedCurrent)
      .slice(0, 8);
  };

  const updateLocationAutocomplete = (nodeId, text) => {
    const node = nodes.find(item => item.id === nodeId);
    if (!node || node.type !== "Scene Heading") {
      setLocationAutocomplete(null);
      return;
    }

    const parts = getSceneHeadingLocationParts(text);
    const query = parts.location.trim().toUpperCase();
    const suggestions = getLocationAutocompleteOptions(query, parts.location);

    if (!query || suggestions.length === 0) {
      setLocationAutocomplete(null);
      return;
    }

    const rowEl = getNodeElement(editorRef.current, nodeId);
    const rect = rowEl?.getBoundingClientRect?.();

    setLocationAutocomplete({
      nodeId,
      parts,
      query,
      suggestions,
      selectedIndex: 0,
      rect: rect
        ? {
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
          }
        : null,
    });
  };

  const acceptCharacterAutocomplete = (suggestion = null) => {
    if (!characterAutocomplete?.nodeId) return false;

    const selectedName = suggestion || characterAutocomplete.suggestions[characterAutocomplete.selectedIndex];

    if (!selectedName) return false;

    pushHistorySnapshot();

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      return currentNodes.map(node => (
        node.id === characterAutocomplete.nodeId
          ? { ...node, text: selectedName, runs: undefined }
          : node
      ));
    }, characterAutocomplete.nodeId);

    setCharacterAutocomplete(null);

    requestAnimationFrame(() => {
      const el = getNodeElement(editorRef.current, characterAutocomplete.nodeId);
      if (!el) return;

      el.focus();
      setCaretToEnd(el);
      setActiveNodeId(characterAutocomplete.nodeId);
    });

    return true;
  };

  const acceptLocationAutocomplete = (suggestion = null) => {
    if (!locationAutocomplete?.nodeId) return false;

    const selectedLocation = suggestion || locationAutocomplete.suggestions[locationAutocomplete.selectedIndex];
    if (!selectedLocation) return false;

    const { prefix, suffix } = locationAutocomplete.parts;
    const nextText = `${prefix}${selectedLocation}${suffix}`;

    pushHistorySnapshot();

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      return currentNodes.map(node => (
        node.id === locationAutocomplete.nodeId
          ? { ...node, text: nextText, runs: undefined }
          : node
      ));
    }, locationAutocomplete.nodeId, { caretOffset: `${prefix}${selectedLocation}`.length });

    setLocationAutocomplete(null);

    requestAnimationFrame(() => {
      const el = getNodeElement(editorRef.current, locationAutocomplete.nodeId);
      if (!el) return;

      el.focus();
      setCaretOffset(el, `${prefix}${selectedLocation}`.length);
      setActiveNodeId(locationAutocomplete.nodeId);
    });

    return true;
  };

  const openElementChooserForNode = (nodeId) => {
    if (!nodeId) return;

    const rowEl = getNodeElement(editorRef.current, nodeId);
    const rect = rowEl?.getBoundingClientRect?.();

    setCharacterAutocomplete(null);
    setElementChooser({
      nodeId,
      selectedIndex: 0,
      options: SCRIPT_WRITING_NODE_TYPES,
      rect: rect
        ? {
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
          }
        : null,
    });
  };

  const acceptElementChoice = (type = null) => {
    if (!elementChooser?.nodeId) return false;

    const selectedType = type || elementChooser.options[elementChooser.selectedIndex];
    if (!selectedType) return false;

    transformNodeType(elementChooser.nodeId, selectedType);
    setElementChooser(null);

    requestAnimationFrame(() => {
      const el = getNodeElement(editorRef.current, elementChooser.nodeId);
      if (!el) return;

      el.focus();
      setCaretToEnd(el);
      setActiveNodeId(elementChooser.nodeId);
    });

    return true;
  };

  const getPlainTextLinesForPaste = (text = "") => {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(line => line.replace(/\u00a0/g, " ").trimEnd())
      .filter(line => line.trim().length > 0);
  };
  const splitCurrentNodeAtCaret = (nextType = null) => {
    const { currentNode, currentEl, currentText, currentNodes } = getCurrentLiveNode();

    if (!currentNode?.id || !currentEl) return false;

    const caretOffset = getCaretOffsetInElement(getNodeTextElement(editorRef.current, currentNode.id));
    const beforeText = String(currentText || "").slice(0, caretOffset);
    const afterText = String(currentText || "").slice(caretOffset);
    const index = currentNodes.findIndex(node => node.id === currentNode.id);

    if (index < 0) return false;

    if (
      currentNode.type === "Parenthetical" &&
      String(currentText || "").endsWith(")") &&
      afterText === ")"
    ) {
      const newNode = {
        id: makeTempNodeId(),
        type: normalizeNodeType(nextType || getDocumentNodeElementTypeAfterEnter(currentNode.type)),
        text: "",
        sceneId: currentNode.sceneId || null,
      };

      pushHistorySnapshot(currentNodes);

      const nextNodes = [
        ...currentNodes.slice(0, index + 1),
        newNode,
        ...currentNodes.slice(index + 1),
      ];

      updateNodes(nextNodes, newNode.id, { caretOffset: 0 });
      return true;
    }

    const [beforeRuns, afterRuns] = splitRunsAtOffset(currentNode.runs, caretOffset);
    const newNode = {
      id: makeTempNodeId(),
      type: normalizeNodeType(nextType || getDocumentNodeElementTypeAfterEnter(currentNode.type)),
      text: afterText,
      runs: afterRuns,
      sceneId: currentNode.sceneId || null,
    };

    pushHistorySnapshot(currentNodes);

    const nextNodes = [
      ...currentNodes.slice(0, index),
      { ...currentNode, text: beforeText, runs: beforeRuns },
      newNode,
      ...currentNodes.slice(index + 1),
    ];

    updateNodes(nextNodes, newNode.id, { caretOffset: 0 });
    return true;
  };

  const handlePaste = (event) => {
    const pastedText = event.clipboardData?.getData("text/plain") || "";
    if (!pastedText) return;

    const lines = getPlainTextLinesForPaste(pastedText);
    if (lines.length <= 1) return;

    event.preventDefault();
    event.stopPropagation();

    const root = editorRef.current;
    const selection = window.getSelection();
    const currentNodes = readNodesFromDom(nodes);

    let workingNodes = currentNodes;
    let targetNodeId = null;
    let targetOffset = 0;

    if (
      selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      root &&
      root.contains(selection.getRangeAt(0).startContainer) &&
      root.contains(selection.getRangeAt(0).endContainer)
    ) {
      const range = selection.getRangeAt(0);
      const startPos = getSelectionPositionInNode(range.startContainer, range.startOffset);
      const endPos = getSelectionPositionInNode(range.endContainer, range.endOffset);

      if (!startPos || !endPos) return;

      const startIndexRaw = currentNodes.findIndex(node => node.id === startPos.nodeId);
      const endIndexRaw = currentNodes.findIndex(node => node.id === endPos.nodeId);

      if (startIndexRaw < 0 || endIndexRaw < 0) return;

      const isForward =
        startIndexRaw < endIndexRaw ||
        (startIndexRaw === endIndexRaw && startPos.offset <= endPos.offset);

      const startIndex = isForward ? startIndexRaw : endIndexRaw;
      const endIndex = isForward ? endIndexRaw : startIndexRaw;
      const startOffset = isForward ? startPos.offset : endPos.offset;
      const endOffset = isForward ? endPos.offset : startPos.offset;

      const startNode = currentNodes[startIndex];
      const endNode = currentNodes[endIndex];

      const startBefore = String(startNode.text || "").slice(0, startOffset);
      const endAfter = String(endNode.text || "").slice(endOffset);

      const targetNode = {
        ...startNode,
        text: `${startBefore}${endAfter}`,
      };

      workingNodes = [
        ...currentNodes.slice(0, startIndex),
        targetNode,
        ...currentNodes.slice(endIndex + 1),
      ];

      targetNodeId = targetNode.id;
      targetOffset = startBefore.length;
    } else {
      const { currentNode, currentText } = getCurrentLiveNode();
      if (!currentNode?.id) return;

      const caretOffset = getCaretOffsetInElement(getNodeTextElement(editorRef.current, currentNode.id));
      const index = currentNodes.findIndex(node => node.id === currentNode.id);
      if (index < 0) return;

      workingNodes = currentNodes;
      targetNodeId = currentNode.id;
      targetOffset = caretOffset;
    }

    const targetIndex = workingNodes.findIndex(node => node.id === targetNodeId);
    if (targetIndex < 0) return;

    const targetNode = workingNodes[targetIndex];
    const targetText = String(targetNode.text || "");
    const beforeText = targetText.slice(0, targetOffset);
    const afterText = targetText.slice(targetOffset);

    const pasteNodes = lines.map((line, lineIndex) => ({
      id: lineIndex === 0 ? targetNode.id : makeTempNodeId(),
      type: lineIndex === 0 ? targetNode.type : "Action",
      text: lineIndex === 0 ? `${beforeText}${line}` : line,
      sceneId: targetNode.sceneId || null,
    }));

    if (afterText) {
      pasteNodes.push({
        id: makeTempNodeId(),
        type: "Action",
        text: afterText,
        sceneId: targetNode.sceneId || null,
      });
    }

    const nextNodes = [
      ...workingNodes.slice(0, targetIndex),
      ...pasteNodes,
      ...workingNodes.slice(targetIndex + 1),
    ];

    const focusNode = pasteNodes[pasteNodes.length - 1];

    pushHistorySnapshot(currentNodes);
    updateNodes(nextNodes, focusNode?.id || targetNode.id);

    setCharacterAutocomplete(null);
    setElementChooser(null);
  };

  const handleInput = () => {
    setElementChooser(null);
    updateActiveNodeFromSelection();

    const savedCaretNodeId = getCaretNodeId() || activeNodeId;
    const savedCaretTextEl = savedCaretNodeId ? getNodeTextElement(editorRef.current, savedCaretNodeId) : null;
    const savedCaretOffset = savedCaretTextEl ? getCaretOffsetInElement(savedCaretTextEl) : 0;

    requestAnimationFrame(() => {
      const liveNodes = readNodesFromDom(nodes);
      const currentNodeId = savedCaretNodeId;
      const currentNode = liveNodes.find(node => node.id === currentNodeId) || null;
      const currentEl = currentNodeId ? getNodeElement(editorRef.current, currentNodeId) : null;
      const currentText = getTextFromNodeElement(currentEl);

      const prevCurrentNode = nodes.find(n => n.id === currentNodeId);
      if (currentNode && JSON.stringify(currentNode.runs) !== JSON.stringify(prevCurrentNode?.runs)) {
        if (getNodesPayload(liveNodes) !== getNodesPayload(nodes)) {
          setNodes(liveNodes);
          emitNodesChange(liveNodes);
        }
        requestAnimationFrame(() => {
          const el = getNodeElement(editorRef.current, currentNodeId);
          if (el) setCaretOffset(el, savedCaretOffset);
        });
        return;
      }

      if (currentNode?.type === "Dialogue") {
        const currentIndex = liveNodes.findIndex(node => node.id === currentNode.id);
        const caretOffset = getCaretOffsetInElement(getNodeTextElement(editorRef.current, currentNode.id));
        const splitResult = findDialoguePageOverflowSplit(liveNodes, currentIndex, caretOffset);

        if (splitResult) {
          updateNodes(splitResult.nextNodes, splitResult.focusNodeId, {
            caretOffset: splitResult.focusOffset,
          });
          return;
        }
      }

      if (getNodesPayload(liveNodes) !== lastEmittedNodesPayloadRef.current) {
        emitNodesChange(liveNodes);
      }

      const livePaginated = paginateNodesForScreen(liveNodes);
      const nextStats = getSceneStatsFromPaginatedPages(livePaginated, liveNodes);
      const nextStatsPayload = getSceneStatsPayload(nextStats);
      if (nextStatsPayload !== lastSceneStatsPayloadRef.current) {
        lastSceneStatsPayloadRef.current = nextStatsPayload;
        onSceneStatsChange?.(nextStats);
      }

      if (currentNode?.type === "Character") {
        updateCharacterAutocomplete(currentNode.id, currentText);
        setLocationAutocomplete(null);
      } else if (currentNode?.type === "Scene Heading") {
        updateLocationAutocomplete(currentNode.id, currentText);
        setCharacterAutocomplete(null);
      } else {
        setCharacterAutocomplete(null);
        setLocationAutocomplete(null);
      }
    });
  };
  const handleClick = (event) => {
    const nodeId = getNodeIdFromTarget(event.target);
    if (nodeId) {
      setActiveNodeId(nodeId);
      updateActiveElementRect(nodeId);

      if (elementChooser?.nodeId !== nodeId) {
        setElementChooser(null);
      }

      const clickedNode = nodes.find(node => node.id === nodeId);
      if (clickedNode?.type !== "Character") {
        setCharacterAutocomplete(null);
      }
      if (clickedNode?.type !== "Scene Heading") {
        setLocationAutocomplete(null);
      }

      return;
    }

    setCharacterAutocomplete(null);
    setLocationAutocomplete(null);
    setElementChooser(null);
    updateActiveNodeFromSelection();
  };

  const startMarginSelectionFromRow = (event, rowEl, nodeId, source = "row") => {
    if (event.button !== 0) return;
    if (event.target?.closest?.("[data-editor-ui='true']")) return;

    const textEl = rowEl.querySelector?.("[data-node-text='true']");
    if (!textEl) {
      debugWritingSelection("mousedown no text span", {
        source,
        targetTag: event.target?.tagName,
        targetDataset: { ...(event.target?.dataset || {}) },
        rowNodeId: rowEl?.dataset?.nodeId,
      });
      return;
    }

    const targetTextEl = event.target?.closest?.("[data-node-text='true']");
    const contentRect = getTextContentRect(textEl);
    const clickSide = getPointerSideForRow(rowEl, event.clientX);

    debugWritingSelection("mousedown", {
      source,
      targetTag: event.target?.tagName,
      targetDataset: { ...(event.target?.dataset || {}) },
      handlerFired: true,
      rowNodeId: rowEl?.dataset?.nodeId,
      requestedNodeId: nodeId,
      textSpanFound: Boolean(textEl),
      clickSide,
      contentRect: contentRect ? {
        left: Math.round(contentRect.left),
        right: Math.round(contentRect.right),
        width: Math.round(contentRect.width),
      } : null,
      clientX: Math.round(event.clientX),
      clientY: Math.round(event.clientY),
    });

    if (
      source === "row" &&
      targetTextEl === textEl &&
      contentRect &&
      event.clientX >= contentRect.left &&
      event.clientX <= contentRect.right
    ) {
      return;
    }

    const anchorRange = getTextRangeForRowPointer(rowEl, event.clientX, event.clientY);
    if (!anchorRange) {
      debugWritingSelection("mousedown no anchor range", { source, rowNodeId: rowEl?.dataset?.nodeId, clickSide });
      return;
    }
    const anchorTextEl = rowEl.querySelector?.("[data-node-text='true']");
    const anchorContentRect = getTextContentRect(anchorTextEl);
    const anchorStartedOnLeft =
      anchorContentRect ? event.clientX <= anchorContentRect.left : false;
    const anchorStartedOnRight =
      anchorContentRect ? event.clientX >= anchorContentRect.right : false;

    event.preventDefault();
    debugWritingSelection("anchor created", {
      source,
      rowNodeId: rowEl?.dataset?.nodeId,
      clickSide,
      anchorStartedOnLeft,
      anchorStartedOnRight,
      anchorRange: getRangeDebugLabel(anchorRange),
      preventDefaultCalled: true,
    });

    marginSelectionCleanupRef.current?.();
    applyCollapsedSelection(anchorRange);
    setActiveNodeId(nodeId);
    updateActiveElementRect(nodeId);
    setElementChooser(null);
    setCharacterAutocomplete(null);

    let didDrag = false;
    let cleanup = () => {};

    const handleMouseMove = (moveEvent) => {
      didDrag = true;
      let focusRange = getTextRangeFromPointer(editorRef.current, moveEvent.clientX, moveEvent.clientY);
      if (
        rangesHaveSameBoundary(anchorRange, focusRange) &&
        anchorTextEl &&
        ((anchorStartedOnLeft && moveEvent.clientX > event.clientX) ||
          (anchorStartedOnRight && moveEvent.clientX < event.clientX))
      ) {
        focusRange = getTextBoundaryRange(anchorTextEl, anchorStartedOnLeft ? "end" : "start");
      }
      if (!focusRange) return;
      moveEvent.preventDefault();
      applySelectionBetweenRanges(anchorRange, focusRange);
      debugWritingSelection("mousemove selection", {
        source,
        rowNodeId: rowEl?.dataset?.nodeId,
        focusRange: getRangeDebugLabel(focusRange),
        selectedTextLength: window.getSelection()?.toString?.().length || 0,
        selectedTextPreview: window.getSelection()?.toString?.().slice(0, 60) || "",
      });
      updateActiveNodeFromSelection();
    };

    const handleMouseUp = () => {
      cleanup();
      debugWritingSelection("mouseup", {
        source,
        rowNodeId: rowEl?.dataset?.nodeId,
        didDrag,
        selectedTextLength: window.getSelection()?.toString?.().length || 0,
      });
      if (!didDrag) {
        updateActiveElementRect(nodeId);
      } else {
        updateActiveNodeFromSelection();
      }
    };

    cleanup = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      marginSelectionCleanupRef.current = null;
    };

    marginSelectionCleanupRef.current = cleanup;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleLineMarginMouseDown = (event, nodeId) => {
    startMarginSelectionFromRow(event, event.currentTarget, nodeId, "row");
  };

  const handleEditorMouseDownCapture = (event) => {
    if (event.button !== 0) return;
    const root = editorRef.current;
    if (!root || !root.contains(event.target)) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const rowEl = target?.closest?.("[data-writing-node-row='true']");
    const pageBodyEl = target?.closest?.("[data-writing-page-body='true']");
    const textEl = target?.closest?.("[data-node-text='true']");
    const nearestRow = !rowEl && pageBodyEl ? getNearestRowFromPointer(pageBodyEl, event.clientY) : null;
    const diagnosticRow = rowEl || nearestRow;
    const diagnosticTextEl = diagnosticRow?.querySelector?.("[data-node-text='true']");
    const contentRect = getTextContentRect(diagnosticTextEl);

    debugWritingSelection("capture mousedown", {
      clientX: Math.round(event.clientX),
      clientY: Math.round(event.clientY),
      elementFromPoint: getElementDiagnostic(target),
      target: getElementDiagnostic(event.target),
      closestRowNodeId: rowEl?.dataset?.nodeId || null,
      mappedNearestRowNodeId: nearestRow?.dataset?.nodeId || null,
      closestContentEditable: Boolean(target?.closest?.("[contenteditable='true']")),
      insideEditor: root.contains(event.target),
      insidePageBody: Boolean(pageBodyEl),
      insideTextSpan: Boolean(textEl),
      rowRect: getRectDiagnostic(diagnosticRow?.getBoundingClientRect?.()),
      textSpanRect: getRectDiagnostic(diagnosticTextEl?.getBoundingClientRect?.()),
      textContentRect: getRectDiagnostic(contentRect),
      pointerSide: diagnosticRow ? getPointerSideForRow(diagnosticRow, event.clientX) : "outside row",
      possibleOverlayAboveRow: Boolean(nearestRow && target && target !== nearestRow && !nearestRow.contains(target)),
    });

    if (rowEl || !pageBodyEl || !nearestRow) return;

    const nodeId = nearestRow.dataset?.nodeId;
    if (!nodeId) return;

    startMarginSelectionFromRow(event, nearestRow, nodeId, "page");
  };

  const selectAllEditorText = () => {
    const root = editorRef.current;
    if (!root) return false;

    const textNodes = Array.from(root.querySelectorAll("[data-node-text='true']"));
    const firstTextNode = textNodes[0];
    const lastTextNode = textNodes[textNodes.length - 1];

    if (!firstTextNode || !lastTextNode) return false;

    const range = document.createRange();
    range.setStartBefore(firstTextNode);
    range.setEndAfter(lastTextNode);

    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);

    setCharacterAutocomplete(null);
    setElementChooser(null);

    return true;
  };

  const handleKeyDown = (event) => {
    if (elementChooser?.options?.length) {
      const requestedType = NODE_TYPE_BY_KEY[String(event.key || "").toUpperCase()];

      if (requestedType && elementChooser.options.includes(requestedType)) {
        event.preventDefault();
        event.stopPropagation();
        acceptElementChoice(requestedType);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setElementChooser(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.options.length - 1),
        }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setElementChooser(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setElementChooser(null);
        return;
      }
    }

    if (characterAutocomplete?.suggestions?.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCharacterAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1),
        }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCharacterAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        acceptCharacterAutocomplete();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setCharacterAutocomplete(null);
        return;
      }
    }

    if (locationAutocomplete?.suggestions?.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLocationAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1),
        }));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLocationAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        acceptLocationAutocomplete();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setLocationAutocomplete(null);
        return;
      }
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      requestAnimationFrame(() => {
        updateActiveNodeFromSelection();
      });
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      event.stopPropagation();
      selectAllEditorText();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        handleUndoRedo("redo");
      } else {
        handleUndoRedo("undo");
      }

      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && handleSelectedDelete(event)) {
      return;
    }

    const { currentNode, currentText, currentNodes } = getCurrentLiveNode();

    if (!currentNode?.id) {
      if (
        event.key === "Enter" ||
        event.key === "Tab" ||
        event.key === "Backspace" ||
        event.key === "Delete" ||
        ((event.metaKey || event.ctrlKey) && /^[1-7]$/.test(event.key))
      ) {
        event.preventDefault();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && /^[1-7]$/.test(event.key)) {
      event.preventDefault();

      const shortcutMap = {
        "1": "Scene Heading",
        "2": "Action",
        "3": "Character",
        "4": "Parenthetical",
        "5": "Dialogue",
        "6": "Shot",
        "7": "Transition",
      };

      const nextType = shortcutMap[event.key];
      if (nextType) {
        updateNodeType(currentNode.id, nextType);
      }

      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const nextType = getDocumentNodeElementTypeAfterEnter(currentNode.type);

      if (isEffectivelyEmptyText(currentText)) {
        if (currentNode.type === "Action" || currentNode.type === "Character" || currentNode.type === "Dialogue" || currentNode.type === "Shot") {
          openElementChooserForNode(currentNode.id);
          return;
        }

        if (currentNode.type === "Parenthetical") {
          return;
        }

        transformNodeType(currentNode.id, nextType);
        return;
      }

      splitCurrentNodeAtCaret(nextType);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();

      const trimmedText = currentText.trim();

      if (currentNode.type === "Shot") {
        return;
      }

      if (!trimmedText) {
        if (currentNode.type === "Action") {
          updateNodeType(currentNode.id, "Character");
          setActiveNodeId(currentNode.id);
          return;
        }

        if (currentNode.type === "Character") {
          updateNodeType(currentNode.id, "Action");
          setActiveNodeId(currentNode.id);
          return;
        }

        const nextType = getDocumentNodeElementTypeAfterTab(currentNode.type, currentText);
        updateNodeType(currentNode.id, nextType);
        setActiveNodeId(currentNode.id);
        return;
      }

      if (currentNode.type === "Action") {
        insertNodeAfter(currentNode.id, "Character");
        return;
      }

      if (currentNode.type === "Character" || currentNode.type === "Dialogue") {
        insertNodeAfter(currentNode.id, "Parenthetical", "()", { caretOffset: 1 });
        return;
      }

      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      if (isEffectivelyEmptyText(currentText)) {
        event.preventDefault();
        event.stopPropagation();
        deleteEmptyNode(currentNode.id);
        return;
      }

      // Intercept Backspace at position 0 and Delete at end-of-text.
      // The browser's native contentEditable would physically merge DOM nodes across block
      // boundaries, leaving React's vDOM out of sync → insertBefore NotFoundError.
      // Instead: perform a safe data-model merge for compatible types, or just move the
      // caret for structural types that should never merge.
      const textEl = getNodeTextElement(editorRef.current, currentNode.id);
      const caretOffset = getCaretOffsetInElement(textEl);

      if (event.key === "Backspace" && caretOffset === 0) {
        event.preventDefault();
        const currentIndex = currentNodes.findIndex(n => n.id === currentNode.id);
        const prevNode = currentIndex > 0 ? currentNodes[currentIndex - 1] : null;
        if (!prevNode) return;

        if (isMergeCompatible(prevNode.type, currentNode.type)) {
          const prevText = String(prevNode.text || "");
          const currText = String(currentText || "");
          const focusOffset = prevText.length;
          const mergedRuns = mergeRunsForNodes(prevNode, { ...currentNode, text: currText });
          pushHistorySnapshot(currentNodes);
          const nextNodes = [
            ...currentNodes.slice(0, currentIndex - 1),
            { ...prevNode, text: prevText + currText, runs: mergedRuns },
            ...currentNodes.slice(currentIndex + 1),
          ];
          updateNodes(nextNodes, prevNode.id, { caretOffset: focusOffset });
        } else {
          const prevEl = getNodeElement(editorRef.current, prevNode.id);
          if (prevEl) {
            prevEl.focus();
            setCaretToEnd(prevEl);
            setActiveNodeId(prevNode.id);
            updateActiveElementRect(prevNode.id);
          }
        }
        return;
      }

      if (event.key === "Delete" && caretOffset >= String(currentText || "").length) {
        event.preventDefault();
        const currentIndex = currentNodes.findIndex(n => n.id === currentNode.id);
        const nextNode = currentIndex < currentNodes.length - 1 ? currentNodes[currentIndex + 1] : null;
        if (!nextNode) return;

        if (isMergeCompatible(currentNode.type, nextNode.type)) {
          const currText = String(currentText || "");
          const nextText = String(nextNode.text || "");
          const focusOffset = currText.length;
          const mergedRuns = mergeRunsForNodes({ ...currentNode, text: currText }, nextNode);
          pushHistorySnapshot(currentNodes);
          const nextNodes = [
            ...currentNodes.slice(0, currentIndex),
            { ...currentNode, text: currText + nextText, runs: mergedRuns },
            ...currentNodes.slice(currentIndex + 2),
          ];
          updateNodes(nextNodes, currentNode.id, { caretOffset: focusOffset });
        } else {
          const nextEl = getNodeElement(editorRef.current, nextNode.id);
          if (nextEl) {
            nextEl.focus();
            setCaretOffset(nextEl, 0);
            setActiveNodeId(nextNode.id);
            updateActiveElementRect(nextNode.id);
          }
        }
        return;
      }
    }
  };

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        minHeight: "9in",
        margin: "0",
        fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
        fontSize: "12pt",
        lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
        color: "#000",
        outline: "none",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {activeNode && activeElementRect && (
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            left: activeElementRect.left,
            top: activeElementRect.top,
            width: "22px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "10px",
            fontWeight: "bold",
            color: APP_TAB_BLUE,
            border: "1px solid #9ec3ff",
            backgroundColor: "#eaf2ff",
            borderRadius: "4px",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 850,
          }}
          title={activeNode.type}
        >
          {NODE_TYPE_LABELS[activeNode.type] || "A"}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellCheckEnabled}
        onInput={handleInput}
        onBlur={flushNodesFromDom}
        onMouseDownCapture={handleEditorMouseDownCapture}
        onClick={handleClick}
        onMouseUp={updateActiveNodeFromSelection}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveNodeFromSelection}
        style={{
          outline: "none",
          position: "relative",
          caretColor: "black",
          cursor: "text",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          padding: "24px 0 48px",
          backgroundColor: "transparent",
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
        }}
      >
        {nodes.length === 0 && (
          <div
            contentEditable={false}
            style={{
              width: PAGE_LAYOUT.pageWidth,
              minHeight: "2in",
              boxSizing: "border-box",
              padding: "28px",
              backgroundColor: "rgba(255,255,255,0.72)",
              border: "1px dashed #cfd8dc",
              borderRadius: "6px",
              color: "#607D8B",
              fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
              fontSize: "13px",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            No script has been created yet. Use New Script to create the first scene.
          </div>
        )}

        {paginatedPages.map((pageNodes, pageIndex) => {
          const pageStartContinuationCharacter = getPageStartDialogueContinuationCharacter(nodes, pageNodes);
          const showDialogueMore = shouldShowDialogueMoreAfterPage(nodes, pageNodes);
          const displayPageNodes = (() => {
            const result = [];
            for (let i = 0; i < pageNodes.length; i++) {
              const entry = pageNodes[i];
              const entryType = normalizeNodeType(entry.node.type);
              const nextEntry = pageNodes[i + 1];
              if (
                entryType === "Character" &&
                nextEntry &&
                normalizeNodeType(nextEntry.node.type) === "Parenthetical" &&
                isContdMarkerText(nextEntry.node.text)
              ) {
                const baseText = String(entry.node.text || "").replace(/\s*\(CONT'?D\.?\)\s*$/i, "").trim();
                result.push({ ...entry, node: { ...entry.node, text: `${baseText} (CONT'D)` } });
                i += 1;
              } else {
                result.push(entry);
              }
            }
            return result;
          })();

          return (
          <div
            key={`page-${pageIndex}`}
            data-writing-page="true"
            style={{
              width: PAGE_LAYOUT.pageWidth,
              minHeight: PAGE_LAYOUT.pageHeight,
              backgroundColor: showMoodOverlay ? "transparent" : "white",
              boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
              border: "1px solid #d8dde3",
              boxSizing: "border-box",
              position: "relative",
              flexShrink: 0,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            <div
              data-writing-page-body="true"
              style={{
                position: "absolute",
                top: formatIn(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "pageMarginTopIn")),
                right: 0,
                bottom: formatIn(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "pageMarginBottomIn")),
                left: 0,
                paddingLeft: PAGE_LAYOUT.pageMarginLeft,
                paddingRight: PAGE_LAYOUT.pageMarginRight,
                outline: "none",
                userSelect: "text",
                cursor: "text",
                pointerEvents: "auto",
              }}
            >
              {displayPageNodes.map(({ node, index }) => {
                const type = normalizeNodeType(node.type);
                const previousNode = nodes[index - 1] || null;
                const nextNode = nodes[index + 1] || null;
                const style = {
                  ...getScreenplayNodeStyle(node, previousNode, nextNode, DEFAULT_LAYOUT_TUNING),
                  ...(displayPageNodes[0]?.node?.id === node.id ? { marginTop: "0" } : {}),
                };
                const lineBlockStyle = {
                  marginTop: style.marginTop,
                  marginBottom: style.marginBottom,
                };
                const lineTextStyle = {
                  ...style,
                  marginTop: 0,
                  marginBottom: 0,
                };

                const isActive = activeNodeId === node.id;
                const showCharacterContinued =
                  !/\(CONT'?D\.?\)/i.test(String(node.text || "")) &&
                  shouldShowCharacterContinued(nodes, index);
                const isSceneHeading = type === "Scene Heading";
                const sceneHeadingIndex = isSceneHeading
                  ? nodes.slice(0, index + 1).filter(item => normalizeNodeType(item?.type) === "Scene Heading").length - 1
                  : -1;
                const sceneDisplayNumber = sceneHeadingIndex + 1;
                const sceneDragId = isSceneHeading ? getSceneDragId(node) : "";
                const sceneDropBorderTop =
                  isSceneHeading &&
                  sceneDragState.overSceneId === sceneDragId &&
                  sceneDragState.position === "before"
                    ? `2px solid ${APP_TAB_BLUE}`
                    : undefined;
                const sceneDropBorderBottom =
                  isSceneHeading &&
                  sceneDragState.overSceneId === sceneDragId &&
                  sceneDragState.position === "after"
                    ? `2px solid ${APP_TAB_BLUE}`
                    : undefined;
                const spellcheckStartOffset =
                  activeSpellcheckRange?.nodeId === node.id
                    ? Math.max(0, Math.min(String(node.text || "").length, Number(activeSpellcheckRange.startOffset) || 0))
                    : null;
                const spellcheckEndOffset =
                  activeSpellcheckRange?.nodeId === node.id
                    ? Math.max(spellcheckStartOffset, Math.min(String(node.text || "").length, Number(activeSpellcheckRange.endOffset) || 0))
                    : null;
                const renderFormattedTextPiece = (run, key, isSpellcheckMatch = false) => {
	                  let inner = <>{run.text}</>;
	                  if (run.highlight) inner = <mark style={{ backgroundColor: run.highlight === true ? "#ffff00" : run.highlight }}>{inner}</mark>;
	                  if (run.strike) inner = <s>{inner}</s>;
	                  // TODO: Add underline drawing to model-based PDF export when exportScriptPagesToPdf is in scope.
	                  if (run.underline) inner = <u>{inner}</u>;
	                  if (run.italic) inner = <em>{inner}</em>;
	                  if (run.bold) inner = <b>{inner}</b>;
	                  if (isSpellcheckMatch) {
	                    inner = (
	                      <span
	                        data-spellcheck-highlight="true"
	                        style={{ boxShadow: "0 0 0 2px #f6c344", borderRadius: "2px", textDecoration: "underline wavy #c62828", textUnderlineOffset: "2px" }}
	                      >
	                        {inner}
	                      </span>
	                    );
                  }
                  return <span key={key}>{inner}</span>;
                };
                const renderNodeText = () => {
                  const text = String(node.text || "");
                  if (!text) return "\u200B";

                  const sourceRuns = getCompleteRunsForNode(node);
                  const hasSpellcheckRange =
                    spellcheckStartOffset !== null &&
                    spellcheckEndOffset !== null &&
                    spellcheckEndOffset > spellcheckStartOffset;

                  if (!hasSpellcheckRange) {
                    return sourceRuns.map((run, runIndex) => renderFormattedTextPiece(run, runIndex));
                  }

                  const pieces = [];
                  let cursor = 0;
                  sourceRuns.forEach((run, runIndex) => {
                    const runText = String(run.text || "");
                    const runStart = cursor;
                    const runEnd = cursor + runText.length;
                    cursor = runEnd;

                    if (runEnd <= spellcheckStartOffset || runStart >= spellcheckEndOffset) {
                      pieces.push(renderFormattedTextPiece(run, `${runIndex}-all`));
                      return;
                    }

                    const selectedStart = Math.max(spellcheckStartOffset, runStart);
                    const selectedEnd = Math.min(spellcheckEndOffset, runEnd);
                    const beforeText = runText.slice(0, selectedStart - runStart);
                    const selectedText = runText.slice(selectedStart - runStart, selectedEnd - runStart);
                    const afterText = runText.slice(selectedEnd - runStart);

                    if (beforeText) pieces.push(renderFormattedTextPiece({ ...run, text: beforeText }, `${runIndex}-before`));
                    if (selectedText) pieces.push(renderFormattedTextPiece({ ...run, text: selectedText }, `${runIndex}-spellcheck`, true));
                    if (afterText) pieces.push(renderFormattedTextPiece({ ...run, text: afterText }, `${runIndex}-after`));
                  });

                  return pieces;
                };

                return (
                  <div
                    key={node.id}
                    ref={(el) => {
                      if (type === "Scene Heading" && sceneRefs?.current && sceneHeadingIndex >= 0) {
                        sceneRefs.current[sceneHeadingIndex] = el;
                      }
                    }}
                    data-node-id={node.id}
                    data-node-type={type}
                    data-scene-id={node.sceneId || ""}
                    data-writing-node-row="true"
                    onMouseDown={(event) => handleLineMarginMouseDown(event, node.id)}
                    onDragOver={isSceneHeading ? (event) => handleSceneDragOver(event, sceneDragId) : undefined}
                    onDrop={isSceneHeading ? (event) => handleSceneDrop(event, sceneDragId) : undefined}
                    onDragEnd={isSceneHeading ? clearSceneDragState : undefined}
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      minHeight: "1em",
                      position: "relative",
                      width: "100%",
                      boxSizing: "border-box",
                      cursor: "text",
                      borderTop: sceneDropBorderTop,
                      borderBottom: sceneDropBorderBottom,
                      ...lineBlockStyle,
                    }}
                  >
                    {isSceneHeading && showSceneNumbers && (
                      <>
                        <span
                          contentEditable={false}
                          data-editor-ui="true"
                          draggable
                          onDragStart={(event) => handleSceneDragStart(event, sceneDragId)}
                          onDragEnd={clearSceneDragState}
                          title="Drag to reorder scene"
                          style={{
                            position: "absolute",
                            left: "-0.88in",
                            top: 0,
                            width: "0.35in",
                            textAlign: "right",
                            color: "#000",
                            fontSize: "12pt",
                            lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
                            cursor: "grab",
                            userSelect: "none",
                            pointerEvents: "auto",
                          }}
                        >
                          {sceneDisplayNumber}
                        </span>

                        <span
                          contentEditable={false}
                          data-editor-ui="true"
                          draggable
                          onDragStart={(event) => handleSceneDragStart(event, sceneDragId)}
                          onDragEnd={clearSceneDragState}
                          title="Drag to reorder scene"
                          style={{
                            position: "absolute",
                            right: "-0.42in",
                            top: 0,
                            width: "0.35in",
                            textAlign: "left",
                            color: "#000",
                            fontSize: "12pt",
                            lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
                            cursor: "grab",
                            userSelect: "none",
                            pointerEvents: "auto",
                          }}
                        >
                          {sceneDisplayNumber}
                        </span>
                      </>
                    )}

                    <span
                      data-node-text="true"
                      style={{
                        display: type === "Character" ? "inline" : "block",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                        wordBreak: "normal",
                        minHeight: "1em",
                        boxSizing: "border-box",
                        cursor: "text",
                        ...lineTextStyle,
                      }}
                    >
                      {renderNodeText()}
                    </span>
                    {showCharacterContinued && (
                      <span
                        contentEditable={false}
                        data-editor-ui="true"
                        style={{
                          color: "#a8adbd",
                          paddingLeft: "0.3em",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      >
                        {"(CONT'D)"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {pageStartContinuationCharacter && (
              <div
                contentEditable={false}
                data-editor-ui="true"
                style={{
                  position: "absolute",
                  top: "0.42in",
                  left: `calc(${PAGE_LAYOUT.pageMarginLeft} + 2.35in)`,
                  width: "3in",
                  color: "#a8adbd",
                  fontSize: "12pt",
                  lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
                  textTransform: "uppercase",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                {pageStartContinuationCharacter} {"(CONT'D)"}
              </div>
            )}

            {showDialogueMore && (
              <div
                contentEditable={false}
                data-editor-ui="true"
                style={{
                  position: "absolute",
                  bottom: "0.78in",
                  left: `calc(${PAGE_LAYOUT.pageMarginLeft} + 2.35in)`,
                  width: "3in",
                  color: "#a8adbd",
                  fontSize: "12pt",
                  lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                (MORE)
              </div>
            )}

            {pageIndex > 0 && (
              <div
                contentEditable={false}
                data-editor-ui="true"
                style={{
                  position: "absolute",
                  top: "0.5in",
                  right: PAGE_LAYOUT.pageMarginRight,
                  color: "#000",
                  fontSize: "12pt",
                  lineHeight: formatPt(getLayoutTuningValue(DEFAULT_LAYOUT_TUNING, "lineHeightPt")),
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                {pageIndex + 1}.
              </div>
            )}
          </div>
          );
        })}
      </div>

      {elementChooser?.options?.length > 0 && createPortal(
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            left: elementChooser.rect?.left || 0,
            top: elementChooser.rect?.top || 0,
            minWidth: elementChooser.rect?.width || 180,
            maxWidth: 280,
            backgroundColor: "white",
            border: "1px solid #cfd8dc",
            borderRadius: "6px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
            zIndex: WRITING_OVERLAY_Z_INDEX,
            overflow: "hidden",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "12px",
          }}
        >
          {elementChooser.options.map((type, index) => (
            <div
              key={type}
              onMouseDown={(event) => {
                event.preventDefault();
                acceptElementChoice(type);
              }}
              style={{
                padding: "7px 10px",
                cursor: "pointer",
                backgroundColor: index === elementChooser.selectedIndex ? "#E3F2FD" : "white",
                color: "#222",
                fontWeight: index === elementChooser.selectedIndex ? "bold" : "normal",
                borderBottom: index === elementChooser.options.length - 1 ? "none" : "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span>{type}</span>
              <strong>{NODE_TYPE_LABELS[type] || ""}</strong>
            </div>
          ))}
        </div>
      , document.body)}

      {characterAutocomplete?.suggestions?.length > 0 && createPortal(
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            left: characterAutocomplete.rect?.left || 0,
            top: characterAutocomplete.rect?.top || 0,
            minWidth: characterAutocomplete.rect?.width || 180,
            maxWidth: 260,
            backgroundColor: "white",
            border: "1px solid #cfd8dc",
            borderRadius: "6px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
            zIndex: WRITING_OVERLAY_Z_INDEX,
            overflow: "hidden",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "12px",
          }}
        >
          {characterAutocomplete.suggestions.map((name, index) => (
            <div
              key={name}
              onMouseDown={(event) => {
                event.preventDefault();
                acceptCharacterAutocomplete(name);
              }}
              style={{
                padding: "7px 10px",
                cursor: "pointer",
                backgroundColor: index === characterAutocomplete.selectedIndex ? "#E3F2FD" : "white",
                color: "#222",
                fontWeight: index === characterAutocomplete.selectedIndex ? "bold" : "normal",
                borderBottom: index === characterAutocomplete.suggestions.length - 1 ? "none" : "1px solid #f0f0f0",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      , document.body)}

      {locationAutocomplete?.suggestions?.length > 0 && createPortal(
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            left: locationAutocomplete.rect?.left || 0,
            top: locationAutocomplete.rect?.top || 0,
            minWidth: locationAutocomplete.rect?.width || 180,
            maxWidth: 300,
            backgroundColor: "white",
            border: "1px solid #cfd8dc",
            borderRadius: "6px",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
            zIndex: WRITING_OVERLAY_Z_INDEX,
            overflow: "hidden",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "12px",
          }}
        >
          {locationAutocomplete.suggestions.map((location, index) => (
            <div
              key={location}
              onMouseDown={(event) => {
                event.preventDefault();
                acceptLocationAutocomplete(location);
              }}
              style={{
                padding: "7px 10px",
                cursor: "pointer",
                backgroundColor: index === locationAutocomplete.selectedIndex ? "#E3F2FD" : "white",
                color: "#222",
                fontWeight: index === locationAutocomplete.selectedIndex ? "bold" : "normal",
                borderBottom: index === locationAutocomplete.suggestions.length - 1 ? "none" : "1px solid #f0f0f0",
              }}
            >
              {location}
            </div>
          ))}
        </div>
      , document.body)}

      {showFloatingElementSelector && activeNode && (
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            bottom: "14px",
            right: "14px",
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.16)",
            padding: "8px",
            display: "flex",
            gap: "6px",
            alignItems: "center",
            zIndex: 500,
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "11px",
          }}
        >
          <span style={{ color: "#777", fontWeight: "bold" }}>Element</span>
          <select
            value={activeNode.type}
            onChange={(event) => updateNodeType(activeNode.id, event.target.value)}
            style={{
              fontSize: "11px",
              padding: "3px 6px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            {SCRIPT_WRITING_NODE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});

export default ScriptWritingEditor;
