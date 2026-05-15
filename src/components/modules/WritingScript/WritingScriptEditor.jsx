import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SCRIPT_WRITING_NODE_TYPES,
  getDocumentNodeElementTypeAfterEnter,
  getDocumentNodeElementTypeAfterTab,
} from "./writingDraftModel";

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
  pageBodyHeightLines: 54,
  pageMarginTop: "0.75in",
  pageMarginRight: "1in",
  pageMarginBottom: "0.75in",
  pageMarginLeft: "1.4in",
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

const marginLinesFromStyle = (value) => {
  return Math.round(parsePtValue(value) / 12);
};

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

const getSpacingBeforeNodeLines = (node, previousNode) => {
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

  if (type === "Parenthetical" && previousType === "Dialogue") {
    return 0;
  }

  if (type === "Dialogue" && previousType === "Dialogue") {
    return 0;
  }

  if (type === "Parenthetical" && previousType === "Parenthetical") {
    return 0;
  }

  // Transitions were already over-counting badly. Treat the transition line itself
  // as the thing that matters for pagination, not extra surrounding blank lines.
  if (type === "Transition") {
    return 0;
  }

  // The line after a transition already starts with enough visual separation.
  if (previousType === "Transition") {
    return 1;
  }

  // Scene headings, shots, character cues, and normal action paragraph breaks
  // visually add one blank line before the new element, not top + bottom margins.
  if (type === "Scene Heading") {
    return 1;
  }

  if (type === "Shot") {
    return 1;
  }

  if (type === "Character") {
    return 1;
  }

  if (type === "Action") {
    return 1;
  }

  return 1;
};

const getNodeLineEstimate = (node, previousNode, nextNode) => {
  const type = normalizeNodeType(node?.type);
  const maxChars = CHARS_PER_LINE_BY_TYPE[type] || CHARS_PER_LINE_BY_TYPE.Action;
  const textLines = getWrappedLineCount(node?.text || " ", maxChars);

  return Math.max(
    1,
    getSpacingBeforeNodeLines(node, previousNode) + textLines
  );
};
const paginateNodesForScreen = (nodes = []) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const pages = [];
  let currentPage = [];
  let currentLineCount = 0;

  sourceNodes.forEach((node, index) => {
    const previousNode = sourceNodes[index - 1] || null;
    const nextNode = sourceNodes[index + 1] || null;
    const lineEstimate = getNodeLineEstimate(node, previousNode, nextNode);

    if (
      currentPage.length > 0 &&
      currentLineCount + lineEstimate > PAGE_LAYOUT.pageBodyHeightLines
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentLineCount = 0;
    }

    currentPage.push({
      node,
      index,
    });

    currentLineCount += lineEstimate;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

const normalizeNodeType = (type) => {
  return SCRIPT_WRITING_NODE_TYPES.includes(type) ? type : "Action";
};

const getScreenplayNodeStyle = (node, previousNode, nextNode) => {
  const type = normalizeNodeType(node?.type);
  const previousType = normalizeNodeType(previousNode?.type);
  const nextType = normalizeNodeType(nextNode?.type);
  const baseStyle = NODE_STYLE_BY_TYPE[type] || NODE_STYLE_BY_TYPE.Action;

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

const normalizeNodes = (nodes = []) => {
  const source = Array.isArray(nodes) ? nodes : [];

  if (source.length === 0) {
    return [];
  }

  return source.map((node, index) => ({
    ...node,
    id: node.id || `temp-node-${index}-${Date.now()}`,
    type: normalizeNodeType(node.type),
    text: String(node.text || ""),
  }));
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

const isEffectivelyEmptyText = (text) => {
  return !String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\n/g, "")
    .trim().length;
};

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

const getSceneStatsFromPaginatedPages = (pages = [], nodes = []) => {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const stats = {};
  const linesPerPage = PAGE_LAYOUT.pageBodyHeightLines;

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

  sourceNodes.forEach((node, index) => {
    const previousNode = sourceNodes[index - 1] || null;
    const nextNode = sourceNodes[index + 1] || null;
    const lineEstimate = getNodeLineEstimate(node, previousNode, nextNode);

    if (
      lineCursor > 0 &&
      lineCursor + lineEstimate > linesPerPage
    ) {
      pageIndex += 1;
      lineCursor = 0;
    }

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

  closeActiveScene(pageIndex + (lineCursor / linesPerPage));

  return stats;
};

const findDialoguePageOverflowSplit = (nodes = [], targetIndex = -1, caretOffset = 0) => {
  if (targetIndex < 0) return null;

  const targetNode = nodes[targetIndex];
  if (normalizeNodeType(targetNode?.type) !== "Dialogue") return null;

  const maxChars = CHARS_PER_LINE_BY_TYPE.Dialogue;
  const targetText = String(targetNode.text || "");
  const segments = getWrappedLineSegments(targetText, maxChars);

  if (segments.length <= 1) return null;

  let currentLineCount = 0;

  for (let i = 0; i < targetIndex; i += 1) {
    const previousNode = nodes[i - 1] || null;
    const nextNode = nodes[i + 1] || null;
    const lineEstimate = getNodeLineEstimate(nodes[i], previousNode, nextNode);

    if (
      currentLineCount > 0 &&
      currentLineCount + lineEstimate > PAGE_LAYOUT.pageBodyHeightLines
    ) {
      currentLineCount = 0;
    }

    currentLineCount += lineEstimate;
  }

  const previousNode = nodes[targetIndex - 1] || null;
  const nextNode = nodes[targetIndex + 1] || null;
  const style = getScreenplayNodeStyle(targetNode, previousNode, nextNode);
  const marginTopLines = marginLinesFromStyle(style.marginTop);
  const marginBottomLines = marginLinesFromStyle(style.marginBottom);
  const availableTextLines = PAGE_LAYOUT.pageBodyHeightLines - currentLineCount - marginTopLines - marginBottomLines;

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

export default function ScriptWritingEditor({
  initialNodes = [],
  onNodesChange = null,
  activeElementType = "",
  onActiveElementTypeChange = null,
  onActiveElementTypeSelect = null,
  sceneRefs = null,
  onSceneStatsChange = null,
  showSceneNumbers = true,
}) {
  const [nodes, setNodes] = useState(() => normalizeNodes(initialNodes));
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [characterAutocomplete, setCharacterAutocomplete] = useState(null);
  const [elementChooser, setElementChooser] = useState(null);
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

  useEffect(() => {
    const normalizedInitialNodes = normalizeNodes(initialNodes);
    const nextPayload = JSON.stringify(normalizedInitialNodes);

    if (nextPayload === lastEmittedNodesPayloadRef.current) {
      return;
    }

    setNodes(prevNodes => {
      const currentPayload = JSON.stringify(prevNodes);

      return currentPayload === nextPayload ? prevNodes : normalizedInitialNodes;
    });

    setCharacterAutocomplete(null);
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
    onSceneStatsChange?.(getSceneStatsFromPaginatedPages(paginatedPages, nodes));
  }, [nodes, onSceneStatsChange, paginatedPages]);

  const updateActiveElementRect = (nodeId = activeNodeId) => {
    requestAnimationFrame(() => {
      if (!nodeId) {
        setActiveElementRect(null);
        return;
      }

      const rowEl = getNodeElement(editorRef.current, nodeId);
      if (!rowEl) {
        setActiveElementRect(null);
        return;
      }

      const rect = rowEl.getBoundingClientRect();
      const pageBodyRect = rowEl.closest?.("[contenteditable='true']")?.getBoundingClientRect?.();

      setActiveElementRect({
        left: (pageBodyRect?.left || rect.left) - 30,
        top: rect.top + 1,
      });
    });
  };

  useEffect(() => {
    if (!activeNodeId) {
      setActiveElementRect(null);
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

  const emitNodesChange = (nextNodes) => {
    lastEmittedNodesPayloadRef.current = JSON.stringify(nextNodes);
    onNodesChange?.(nextNodes);
  };

  const readNodesFromDom = (sourceNodes = nodes) => {
    const root = editorRef.current;
    if (!root) return sourceNodes;

    return sourceNodes.map((node) => {
      const el = getNodeElement(root, node.id);
      return {
        ...node,
        text: getTextFromNodeElement(el),
      };
    });
  };

  const syncNodesFromDom = () => {
    const nextNodes = readNodesFromDom(nodes);
    setNodes(nextNodes);
    emitNodesChange(nextNodes);
    return nextNodes;
  };
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

    setNodes(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      normalizedNextNodes = normalizeNodes(next);
      return normalizedNextNodes;
    });

    if (normalizedNextNodes) {
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
      const newSceneId = makeTempNodeId();

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
        setActiveNodeId(currentNodeId);
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

      const nextNodes = currentNodes.map((node, index) => (
        index === startIndex ? { ...node, text: `${before}${after}` } : node
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

  const acceptCharacterAutocomplete = (suggestion = null) => {
    if (!characterAutocomplete?.nodeId) return false;

    const selectedName = suggestion || characterAutocomplete.suggestions[characterAutocomplete.selectedIndex];

    if (!selectedName) return false;

    pushHistorySnapshot();

    updateNodes(prev => {
      const currentNodes = readNodesFromDom(prev);
      return currentNodes.map(node => (
        node.id === characterAutocomplete.nodeId
          ? { ...node, text: selectedName }
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

    const newNode = {
      id: makeTempNodeId(),
      type: normalizeNodeType(nextType || getDocumentNodeElementTypeAfterEnter(currentNode.type)),
      text: afterText,
      sceneId: currentNode.sceneId || null,
    };

    pushHistorySnapshot(currentNodes);

    const nextNodes = [
      ...currentNodes.slice(0, index),
      { ...currentNode, text: beforeText },
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

    requestAnimationFrame(() => {
      const liveNodes = readNodesFromDom(nodes);
      const currentNodeId = getCaretNodeId() || activeNodeId;
      const currentNode = liveNodes.find(node => node.id === currentNodeId) || null;
      const currentEl = currentNodeId ? getNodeElement(editorRef.current, currentNodeId) : null;
      const currentText = getTextFromNodeElement(currentEl);

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

      emitNodesChange(liveNodes);

      if (currentNode?.type === "Character") {
        updateCharacterAutocomplete(currentNode.id, currentText);
      } else {
        setCharacterAutocomplete(null);
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

      return;
    }

    setCharacterAutocomplete(null);
    setElementChooser(null);
    updateActiveNodeFromSelection();
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

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();

      const direction = event.key === "ArrowUp" ? -1 : 1;
      moveCaretToAdjacentNode(direction);
      return;
    }

    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
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

    const { currentNode, currentText } = getCurrentLiveNode();

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
        lineHeight: "12pt",
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
            fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
            fontSize: "10px",
            fontWeight: "bold",
            color: "#316AC5",
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
        onInput={handleInput}
        onClick={handleClick}
        onMouseUp={updateActiveNodeFromSelection}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveNodeFromSelection}
        style={{
          outline: "none",
          position: "relative",
          caretColor: "black",
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
              fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
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

          return (
          <div
            key={`page-${pageIndex}`}
            contentEditable={false}
            style={{
              width: PAGE_LAYOUT.pageWidth,
              minHeight: PAGE_LAYOUT.pageHeight,
              backgroundColor: "white",
              boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
              border: "1px solid #d8dde3",
              boxSizing: "border-box",
              position: "relative",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{
                position: "absolute",
                top: PAGE_LAYOUT.pageMarginTop,
                right: PAGE_LAYOUT.pageMarginRight,
                bottom: PAGE_LAYOUT.pageMarginBottom,
                left: PAGE_LAYOUT.pageMarginLeft,
                outline: "none",
                userSelect: "text",
              }}
            >
              {pageNodes.map(({ node, index }) => {
                const type = normalizeNodeType(node.type);
                const previousNode = nodes[index - 1] || null;
                const nextNode = nodes[index + 1] || null;
                const style = {
                  ...getScreenplayNodeStyle(node, previousNode, nextNode),
                  ...(pageNodes[0]?.node?.id === node.id ? { marginTop: "0" } : {}),
                };
                const isActive = activeNodeId === node.id;
                const showCharacterContinued = shouldShowCharacterContinued(nodes, index);
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
                    ? "2px solid #316AC5"
                    : undefined;
                const sceneDropBorderBottom =
                  isSceneHeading &&
                  sceneDragState.overSceneId === sceneDragId &&
                  sceneDragState.position === "after"
                    ? "2px solid #316AC5"
                    : undefined;

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
                    onDragOver={isSceneHeading ? (event) => handleSceneDragOver(event, sceneDragId) : undefined}
                    onDrop={isSceneHeading ? (event) => handleSceneDrop(event, sceneDragId) : undefined}
                    onDragEnd={isSceneHeading ? clearSceneDragState : undefined}
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      minHeight: "1em",
                      position: "relative",
                      borderTop: sceneDropBorderTop,
                      borderBottom: sceneDropBorderBottom,
                      ...style,
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
                            lineHeight: "12pt",
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
                            lineHeight: "12pt",
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
                      }}
                    >
                      {node.text || "\u200B"}
                    </span>
                    {showCharacterContinued && (
                      <span
                        contentEditable={false}
                        data-editor-ui="true"
                        style={{
                          color: "#a8adbd",
                          marginLeft: "0.35in",
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
                  lineHeight: "12pt",
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
                  lineHeight: "12pt",
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
                  lineHeight: "12pt",
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

      {elementChooser?.options?.length > 0 && (
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
            zIndex: 950,
            overflow: "hidden",
            fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
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
      )}

      {characterAutocomplete?.suggestions?.length > 0 && (
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
            zIndex: 900,
            overflow: "hidden",
            fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
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
      )}

      {activeNode && (
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
            fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
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
}
