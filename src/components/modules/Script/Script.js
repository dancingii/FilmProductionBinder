import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { exportBreakdownScriptToPdf } from "../../../utils/exportScriptPagesToPdf";
import {
  getEffectiveScreenplayPageBodyHeightLines,
  getPageEntryLineEstimate,
  paginateScreenplayNodes,
  scenesToScreenplayNodes,
} from "../../../utils/screenplayPagination";
import {
  stemWord,
  formatElementText,
  calculateBlockLines,
  LINES_PER_PAGE,
  parseSceneHeading,
  buildHeadingString,
} from "../../../utils.js";
import { usePresence } from "../../../hooks/usePresence";
import PresenceIndicator from "../../shared/PresenceIndicator";
import SceneDetailModal from "../../shared/SceneDetailModal";
import { supabase } from "../../../supabase";
import { createSceneId, isValidSceneId } from "../../../utils/sceneIdentity";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../../utils/sceneDisplayLabel";
import { createScriptSearchKey, searchScript as searchScriptUtil } from "../../../utils/scriptSearch";
import { normalizeCharacterContinuationMarkers } from "../../../utils/screenplayImport";
import {
  SCENE_CUSTOM_COLORS,
  SCENE_METADATA_COLUMN_WIDTHS,
  getSceneMetadataColumns,
  getSceneRowPresentation,
  getSceneStatusPresentation,
} from "../../../utils/scenePresentation";

const WGA_COLORS = [
  { name: "White",     hex: "#FFFFFF", textHex: "#000000" },
  { name: "Blue",      hex: "#B8D4E8", textHex: "#1a3a5c" },
  { name: "Pink",      hex: "#F4C2C2", textHex: "#7a1a1a" },
  { name: "Yellow",    hex: "#F5F5A0", textHex: "#5c5c00" },
  { name: "Green",     hex: "#B8E0B8", textHex: "#1a4c1a" },
  { name: "Goldenrod", hex: "#DAA520", textHex: "#3c2800" },
  { name: "Buff",      hex: "#F0DC82", textHex: "#4c3c00" },
  { name: "Salmon",    hex: "#FA8072", textHex: "#5c0000" },
  { name: "Cherry",    hex: "#DE3163", textHex: "#FFFFFF" },
  { name: "Tan",       hex: "#D2B48C", textHex: "#3c2a1a" },
];
const getRevisionColor = (n) => WGA_COLORS[n % WGA_COLORS.length] || WGA_COLORS[1];

const ELEMENT_TYPES = ["Scene Heading","Action","Character","Dialogue","Parenthetical","Transition","Shot"];

const ENTER_NEXT_TYPE = {
  "Scene Heading":"Action","Action":"Action","Character":"Dialogue",
  "Dialogue":"Character","Parenthetical":"Dialogue","Transition":"Scene Heading","Shot":"Action",
};
const TYPE_SHORTCUTS = {
  "1":"Scene Heading","2":"Action","3":"Character","4":"Parenthetical",
  "5":"Dialogue","6":"Shot","7":"Transition",
};
const ELEMENT_TYPE_INDICATORS = {
  "Scene Heading":"S","Action":"A","Character":"C","Parenthetical":"P",
  "Dialogue":"D","Shot":"S","Transition":"T",
};

const SCRIPT_PAGE_LAYOUT = {
  pageBodyHeightLines: 54,
  pageMarginTop: "0.75in",
  pageMarginRight: "1in",
  pageMarginBottom: "0.75in",
  pageMarginLeft: "1.4in",
};

const SCRIPT_CHARS_PER_LINE_BY_TYPE = {
  "Scene Heading": 61,
  Action: 61,
  Character: 24,
  Parenthetical: 26,
  Dialogue: 36,
  Transition: 18,
  Shot: 61,
};

const SCRIPT_ELEMENT_STYLE_BY_TYPE = {
  "Scene Heading": {
    fontWeight: "bold",
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
    fontStyle: "italic",
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

const getProductionElementStyle = (type, previousType = null, nextType = null) => {
  const baseStyle = {
    fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
    fontSize: "12pt",
    lineHeight: "12pt",
    color: "#000",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "normal",
    boxSizing: "border-box",
  };
  const style = {
    ...baseStyle,
    ...(SCRIPT_ELEMENT_STYLE_BY_TYPE[type] || SCRIPT_ELEMENT_STYLE_BY_TYPE.Action),
  };

  if (type === "Dialogue" && (previousType === "Character" || previousType === "Parenthetical" || previousType === "Dialogue")) {
    style.marginTop = "0";
  }
  if (type === "Dialogue" && nextType === "Parenthetical") {
    style.marginBottom = "0";
  }
  if (type === "Character" && nextType === "Dialogue") {
    style.marginBottom = "0";
  }
  if (type === "Parenthetical") {
    style.marginTop = "0";
    style.marginBottom = "0";
  }

  return style;
};

const getWrappedLineCountForScript = (text, maxChars) => {
  const source = String(text || "").replace(/\u00a0/g, " ").trimEnd();
  if (!source) return 1;

  return source.split(/\n+/).reduce((total, paragraph) => {
    const words = String(paragraph || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return total + 1;

    let lineLength = 0;
    let paragraphLines = 1;
    words.forEach((word) => {
      if (lineLength === 0) {
        lineLength = word.length;
      } else if (lineLength + 1 + word.length <= maxChars) {
        lineLength += 1 + word.length;
      } else {
        paragraphLines += 1;
        lineLength = word.length;
      }
    });
    return total + paragraphLines;
  }, 0);
};

const getSpacingBeforeScriptElementLines = (type, previousType) => {
  if (!previousType) return 0;
  if (type === "Dialogue" && (previousType === "Character" || previousType === "Parenthetical" || previousType === "Dialogue")) return 0;
  if (type === "Parenthetical" && (previousType === "Character" || previousType === "Dialogue" || previousType === "Parenthetical")) return 0;
  if (type === "Transition") return 0;
  if (previousType === "Transition") return 1;
  if (type === "Scene Heading") return 2;
  if (previousType === "Scene Heading") return 2;
  return 1;
};

const getScriptElementLineEstimate = (type, text, previousType) => {
  const maxChars = SCRIPT_CHARS_PER_LINE_BY_TYPE[type] || SCRIPT_CHARS_PER_LINE_BY_TYPE.Action;
  return Math.max(
    1,
    getSpacingBeforeScriptElementLines(type, previousType) +
      getWrappedLineCountForScript(text || " ", maxChars)
  );
};

const getSceneStatsKey = (scene, index) => (
  scene?.id || scene?.sceneId || scene?.sceneNumber || `scene-${index}`
);

const calculateViewerPagination = (sceneList = []) => {
  const pageBreakKeys = new Set();
  const pageStatsBySceneId = {};

  const nodes = scenesToScreenplayNodes(sceneList, {
    includeSceneNumberInHeading: true,
    getSceneLabel: getSceneDisplayLabel,
  });
  const pages = paginateScreenplayNodes(nodes);
  const linesPerPage = getEffectiveScreenplayPageBodyHeightLines();
  const sceneTimelineRanges = new Map();

  pages.forEach((pageEntries, pageIndex) => {
    const firstEntry = pageEntries[0];
    const firstNode = firstEntry?.node;

    if (pageIndex > 0 && firstNode) {
      if (firstNode.isSceneHeading) {
        pageBreakKeys.add(`scene-${firstNode.sceneIndex}`);
      } else if (Number.isInteger(firstNode.sceneIndex) && Number.isInteger(firstNode.blockIndex)) {
        pageBreakKeys.add(`${firstNode.sceneIndex}-${firstNode.blockIndex}`);
      }
    }

    let pageLineCursor = 0;
    pageEntries.forEach((entry) => {
      const node = entry.node;
      const sceneIndex = node?.sceneIndex;
      if (!Number.isInteger(sceneIndex)) return;

      const lineCount = getPageEntryLineEstimate(nodes, entry);
      const start = pageIndex + (pageLineCursor / linesPerPage);
      const end = pageIndex + ((pageLineCursor + lineCount) / linesPerPage);
      const existing = sceneTimelineRanges.get(sceneIndex);

      sceneTimelineRanges.set(sceneIndex, {
        start: existing ? Math.min(existing.start, start) : start,
        end: existing ? Math.max(existing.end, end) : end,
        startPageIndex: existing ? Math.min(existing.startPageIndex, pageIndex) : pageIndex,
        endPageIndex: existing ? Math.max(existing.endPageIndex, pageIndex) : pageIndex,
      });

      pageLineCursor += lineCount;
    });
  });

  sceneList.forEach((scene, si) => {
    const range = sceneTimelineRanges.get(si);
    if (!range) return;

    const pageNumber = range.startPageIndex + 1;
    const timelineStartPage = range.start;
    const safeEndTimelinePage = Math.max(range.end, timelineStartPage);
    const timelinePageLength = Math.max(0.125, safeEndTimelinePage - timelineStartPage);
    const stats = {
      pageNumber,
      startPage: pageNumber,
      pageLength: Math.max(1, range.endPageIndex - range.startPageIndex + 1),
      timelineStartPage,
      timelinePageLength,
      measuredFromViewer: true,
    };

    pageStatsBySceneId[getSceneStatsKey(scene, si)] = stats;
    if (scene?.id) pageStatsBySceneId[scene.id] = stats;
    if (scene?.sceneId) pageStatsBySceneId[scene.sceneId] = stats;
    if (scene?.sceneNumber !== undefined && scene?.sceneNumber !== null) {
      pageStatsBySceneId[scene.sceneNumber] = stats;
    }
  });

  return { pageBreakKeys, pageStatsBySceneId };
};

// ─── Inserted-scene group resequencing ───────────────────────────────────────
// Pure helper — no side effects. Finds the contiguous group of inserted scenes
// containing insertedIndex, then assigns A/B/C... deterministically by position.
const resequenceInsertedGroupLetters = (sceneList, insertedIndex) => {
  let groupStart = insertedIndex;
  while (groupStart > 0 && Boolean(sceneList[groupStart - 1]?.metadata?.replacementLetter)) {
    groupStart--;
  }
  let groupEnd = insertedIndex;
  while (groupEnd + 1 < sceneList.length && Boolean(sceneList[groupEnd + 1]?.metadata?.replacementLetter)) {
    groupEnd++;
  }
  return sceneList.map((scene, i) => {
    if (i < groupStart || i > groupEnd) return scene;
    return {
      ...scene,
      metadata: { ...scene.metadata, replacementLetter: String.fromCharCode(65 + (i - groupStart)) },
    };
  });
};

// ─── Scene List ───────────────────────────────────────────────────────────────
function SceneList({ scenes, currentSceneNumber, sceneRefs, getSceneStatusColor, selectedProject, user, onSceneNumberChange, setCurrentIndex, canDeleteScene = false, onDeleteScene = null, onReorderScene = null, onUpdateSceneMetadata = null, onInsertScene = null, onOpenSceneDetail = null, onRequestInsert = null, pageStatsBySceneId = null }) {
  const { otherUsers } = usePresence(selectedProject?.id, user, "script", currentSceneNumber);
  const [dragState, setDragState] = useState({ draggedKey: null, overKey: null, position: "before" });
  const listRef = useRef(null);
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);
  const [sceneContextMenu, setSceneContextMenu] = useState(null);

  useEffect(() => {
    if (!sceneContextMenu) return;
    const handleEsc = (e) => { if (e.key === "Escape") setSceneContextMenu(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [sceneContextMenu]);

  useEffect(() => {
    const idx = scenes.findIndex(s => s.sceneNumber === currentSceneNumber);
    if (idx >= 0 && listRef.current) {
      const item = listRef.current.children[idx];
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [currentSceneNumber, scenes]);

  const scrollToScene = (index) => {
    setCurrentIndex(index);
    if (sceneRefs.current[index]) {
      sceneRefs.current[index].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getSceneDragKey = (scene, index) => {
    return `${scene.id || scene.sceneId || scene.sceneNumber || "scene"}-${index}`;
  };

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (sceneKey, position) => {
    if (dragState.overKey !== sceneKey || dragState.position !== position) return undefined;
    return "2px solid #2196F3";
  };

  const handleDragStart = (event, sceneKey) => {
    if (!onReorderScene) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sceneKey);
    setDragState({ draggedKey: sceneKey, overKey: null, position: "before" });
  };

  const handleDragOver = (event, sceneKey) => {
    if (!onReorderScene) return;
    event.preventDefault();
    const position = getDropPosition(event);
    setDragState(prev => (
      prev.overKey === sceneKey && prev.position === position
        ? prev
        : { ...prev, overKey: sceneKey, position }
    ));
  };

  const handleDrop = (event, targetKey) => {
    if (!onReorderScene) return;
    event.preventDefault();
    const draggedKey = dragState.draggedKey || event.dataTransfer.getData("text/plain");
    const position = getDropPosition(event);
    setDragState({ draggedKey: null, overKey: null, position: "before" });
    onReorderScene(draggedKey, targetKey, position);
  };

  const clearDragState = () => {
    setDragState({ draggedKey: null, overKey: null, position: "before" });
  };

  if (scenes.length === 0) {
    return (
      <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: "white", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden", padding: "18px", boxSizing: "border-box", color: "#555", lineHeight: 1.45 }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#222", marginBottom: "8px" }}>No scenes yet</div>
          <div style={{ marginBottom: "14px" }}>Upload a script to begin breakdown.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={listRef} style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: "white", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden" }}>
	        {scenes.map((scene, index) => {
	          const sceneKey = getSceneDragKey(scene, index);
	          const statusPresentation = getSceneStatusColor(scene.sceneNumber);
	          const isCurrent = currentSceneNumber === scene.sceneNumber;
	          const displayLabel = getSceneDisplayLabel(scene, displayLabelMap);
	          const pageStats =
            pageStatsBySceneId?.[scene.id] ||
            pageStatsBySceneId?.[scene.sceneId] ||
            pageStatsBySceneId?.[scene.sceneNumber] ||
            pageStatsBySceneId?.[getSceneStatsKey(scene, index)] ||
            null;
          const rowPresentation = getSceneRowPresentation(scene, {
            status: statusPresentation.statusLabel,
            isCurrent,
            isDragging: dragState.draggedKey === sceneKey,
            displayLabel,
          });
          const metadataColumns = getSceneMetadataColumns(scene, { displayLabel, pageStats });
          const statColor = rowPresentation.metadataTextColor;
          const sceneHeadingDisplayText = scene.metadata?.writingDraft
            ? String(scene.heading || "").toUpperCase()
            : scene.heading;
          return (
            <PresenceIndicator key={sceneKey} itemId={sceneKey} otherUsers={otherUsers} position="top">
	              <div
	                draggable={Boolean(onReorderScene)}
	                onDragStart={(event) => handleDragStart(event, sceneKey)}
	                onDragOver={(event) => handleDragOver(event, sceneKey)}
	                onDrop={(event) => handleDrop(event, sceneKey)}
	                onDragEnd={clearDragState}
	                onClick={() => scrollToScene(index)}
	                onDoubleClick={() => onOpenSceneDetail?.(index)}
	                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSceneContextMenu({ x: e.clientX, y: e.clientY, index }); }}
	                style={{ padding: "3px 8px", cursor: onReorderScene ? "grab" : "pointer", userSelect: "none", borderTop: getDropBorderStyle(sceneKey, "before"), borderBottom: getDropBorderStyle(sceneKey, "after") || "1px solid #f0f0f0", borderLeft: rowPresentation.isInserted && !isCurrent ? `3px solid ${rowPresentation.insertedBorderColor}` : rowPresentation.customOnlyBorderColor && !isCurrent ? `3px solid ${rowPresentation.customOnlyBorderColor}` : undefined, backgroundColor: rowPresentation.rowBackgroundColor, color: rowPresentation.rowTextColor, display: "flex", alignItems: "center", gap: "4px" }}
	              >
	                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
	                  <strong style={{ fontSize: "13px", color: rowPresentation.isInserted && !isCurrent ? rowPresentation.insertedLabelColor : undefined }}>{displayLabel}</strong>
	                  {" – "}{sceneHeadingDisplayText}
	                </span>
                <span style={{ display: "grid", gridTemplateColumns: `${SCENE_METADATA_COLUMN_WIDTHS.customColor} ${SCENE_METADATA_COLUMN_WIDTHS.originalNumber} ${SCENE_METADATA_COLUMN_WIDTHS.pageNumber} ${SCENE_METADATA_COLUMN_WIDTHS.pageLength}`, alignItems: "center", columnGap: "4px", flexShrink: 0 }}>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.customColor, textAlign: "center", lineHeight: 0 }}>
                    <span title={metadataColumns.customColor.hasCustomColor ? `${metadataColumns.customColor.label} custom scene color` : undefined} style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: metadataColumns.customColor.hasCustomColor ? metadataColumns.customColor.swatch : "transparent", border: metadataColumns.customColor.hasCustomColor ? `1px solid ${isCurrent ? "rgba(255,255,255,0.7)" : metadataColumns.customColor.border}` : "1px solid transparent", visibility: metadataColumns.customColor.hasCustomColor ? "visible" : "hidden" }} />
                  </span>
                  <span title={metadataColumns.originalNumber.showOriginal ? `Original scene number ${metadataColumns.originalNumber.originalNumber}` : undefined} style={{ width: SCENE_METADATA_COLUMN_WIDTHS.originalNumber, textAlign: "right", fontSize: "9px", color: "#c62828", fontWeight: "bold", fontVariantNumeric: "tabular-nums", visibility: metadataColumns.originalNumber.showOriginal ? "visible" : "hidden" }}>
                    {metadataColumns.originalNumber.showOriginal ? metadataColumns.originalNumber.originalNumber : "0"}
                  </span>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.pageNumber, textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums", fontWeight: isCurrent ? "bold" : 600 }}>
                    {metadataColumns.pageNumber !== null ? `Pg ${metadataColumns.pageNumber}` : ""}
                  </span>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.pageLength, textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums", fontWeight: isCurrent ? "bold" : 600 }}>
                    {metadataColumns.pageLength !== null ? metadataColumns.pageLength : ""}
                  </span>
                </span>

              </div>
            </PresenceIndicator>
          );
        })}
      </div>
      {sceneContextMenu !== null && scenes[sceneContextMenu.index] && (() => {
        const { x, y, index: mi } = sceneContextMenu;
        const ms = scenes[mi];
        return (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 2999 }} onClick={() => setSceneContextMenu(null)} />
            <div style={{ position: "fixed", left: x, top: y, zIndex: 3000, backgroundColor: "white", border: "1px solid #e0e0e0", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", minWidth: "200px", overflow: "hidden", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", fontSize: "12px" }}>
              <div style={{ padding: "6px 12px 5px", fontSize: "11px", color: "#999", borderBottom: "1px solid #f0f0f0", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
                Scene {getSceneDisplayLabel(ms, displayLabelMap)}{ms.heading ? `: ${ms.heading}` : ""}
              </div>
              <div onClick={() => { setSceneContextMenu(null); onOpenSceneDetail?.(mi); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}>Open Details</div>
              {onRequestInsert && (
                <div onClick={() => { setSceneContextMenu(null); onRequestInsert(mi); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}>Insert Before</div>
              )}
              {onRequestInsert && (
                <div onClick={() => { setSceneContextMenu(null); onRequestInsert(mi + 1); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}>Insert After</div>
              )}
              {onUpdateSceneMetadata && (
                <>
                  <div onClick={() => setSceneContextMenu(prev => ({ ...prev, showColors: !prev.showColors }))} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: sceneContextMenu.showColors ? "none" : "1px solid #f5f5f5" }}>Change Color</div>
                  {sceneContextMenu.showColors && (
                    <div style={{ padding: "4px 0", borderBottom: "1px solid #f5f5f5", backgroundColor: "#fafafa" }}>
                      {Object.entries(SCENE_CUSTOM_COLORS).map(([colorKey, option]) => {
                        const selected = (ms.metadata?.color || "default") === colorKey;
                        return (
                          <div key={colorKey} onClick={() => { setSceneContextMenu(null); onUpdateSceneMetadata(mi, { color: colorKey === "default" ? null : colorKey }); }} style={{ padding: "5px 12px 5px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", backgroundColor: selected ? "#eef5ff" : "transparent" }}>
                            <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: option.swatch, border: `1px solid ${option.border}`, flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{option.label}</span>
                            {selected && <span style={{ color: "#607D8B", fontWeight: "bold" }}>Selected</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {onDeleteScene && (
                <div onClick={() => { setSceneContextMenu(null); onDeleteScene(mi); }} style={{ padding: "7px 12px", cursor: "pointer", color: "#c62828" }}>Delete Scene</div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ─── Element Type Toolbar ─────────────────────────────────────────────────────
function ElementTypeToolbar({ activeBlock, editingScenes, onTypeChange }) {
  if (!activeBlock) return null;
  const block = editingScenes[activeBlock.si]?.content[activeBlock.bi];
  if (!block) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "11px", color: "#555", fontWeight: "bold" }}>ELEMENT:</span>
      <select value={block.type} onChange={(e) => onTypeChange(activeBlock.si, activeBlock.bi, e.target.value)} style={{ padding: "3px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }}>
        {ELEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <span style={{ fontSize: "10px", color: "#aaa" }}>Tab · Cmd+1-7</span>
    </div>
  );
}

// ─── Revision Round Modal ─────────────────────────────────────────────────────
function RevisionRoundModal({ pendingRecord, committedRounds, onCommit, onClose }) {
  const nextNum = (committedRounds?.length || 0) + 1;
  const autoColor = getRevisionColor(nextNum);
  const [roundNumber, setRoundNumber] = useState(nextNum);
  const [roundName, setRoundName] = useState(`Revision ${nextNum}`);
  const [saving, setSaving] = useState(false);
  const changedScenes = [...new Set((pendingRecord?.changes || []).map(c => c.scene_number))];

  const handleCommit = async () => {
    if (!roundName.trim()) return;
    setSaving(true);
    await onCommit(pendingRecord.id, roundNumber, roundName, autoColor);
    setSaving(false);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 10000 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "10px", padding: "28px", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", zIndex: 10001, minWidth: "440px", maxWidth: "540px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Create Revision Round</h2>
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: "0 0 72px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>ROUND #</div>
            <input type="number" value={roundNumber} onChange={(e) => setRoundNumber(parseInt(e.target.value) || 1)} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "16px", fontWeight: "bold" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>ROUND NAME</div>
            <input type="text" value={roundName} onChange={(e) => setRoundName(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }} />
          </div>
          <div style={{ flex: "0 0 90px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>COLOR</div>
            <div style={{ backgroundColor: autoColor.hex, border: "2px solid #ccc", borderRadius: "4px", padding: "8px 4px", fontSize: "11px", color: autoColor.textHex, fontWeight: "bold", textAlign: "center", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>{autoColor.name}</div>
          </div>
        </div>
        <div style={{ backgroundColor: "#f7f7f7", borderRadius: "6px", padding: "12px", marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>CHANGED SCENES ({changedScenes.length})</div>
          <div style={{ fontSize: "13px", color: "#333", lineHeight: 1.7 }}>{changedScenes.map(n => `Scene ${n}`).join("  ·  ") || "No changes recorded"}</div>
          <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{(pendingRecord?.changes || []).length} block change{(pendingRecord?.changes || []).length !== 1 ? "s" : ""} total</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleCommit} disabled={saving || !roundName.trim()} style={{ flex: 1, padding: "10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating…" : `Create ${autoColor.name} Pages`}
          </button>
          <button onClick={onClose} style={{ padding: "10px 20px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Keep Editing</button>
        </div>
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "10px", textAlign: "center" }}>Your changes are saved. Close this and keep editing — create the revision round when you're ready.</div>
      </div>
    </>
  );
}

// ─── Continuous Script (View + Edit) ─────────────────────────────────────────
const ContinuousScript = React.memo(function ContinuousScript({
  scenes, sceneRefs, isEditMode, editingScenes, setEditingScenes,
  activeBlock, setActiveBlock, taggedItems, tagCategories,
  showTagDropdown, setShowTagDropdown, tagWord, untagWordInstance,
  isWordInstanceTagged, getSceneStatusColor, committedRounds,
  viewingRevision, setCurrentIndex, onSceneHeadingChange, onCreateSceneAfter,
  onPageStatsChange, characters = {},
}) {
  const blockRefs = useRef({});
  const sceneHeadingRefs = useRef({});
  const getKey = (si, bi) => `${si}-${bi}`;
  const lastArrowKey = useRef(null);
  const preArrowCaretRect = useRef(null);
  const preArrowBlockKey = useRef(null);
  const lastSceneCreationRef = useRef({ si: null, bi: null, at: 0 });
  const normalizedViewScenes = useMemo(() => normalizeCharacterContinuationMarkers(scenes), [scenes]);
  const scenesToRender = isEditMode ? editingScenes : normalizedViewScenes;
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenesToRender), [scenesToRender]);
  const [characterAutocomplete, setCharacterAutocomplete] = useState(null);

  const characterSuggestionNames = useMemo(() => {
    const names = new Set();
    scenesToRender.forEach(scene => {
      (scene.content || []).forEach(block => {
        if (block.type === "Character") {
          const name = String(block.text || "").trim().toUpperCase();
          if (name) names.add(name);
        }
      });
    });
    Object.values(characters || {}).forEach(character => {
      const name = String(character?.name || character?.characterName || "").trim().toUpperCase();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [scenesToRender, characters]);

  // ── Instance lookup map — position → { item, key } ───────────────────────
  // Covers both UUID-based (new) and legacy positional (old) instance IDs.
  // Longer phrases are inserted first so they win over single-word tags at
  // shared positions (e.g. "cigarette holder" beats "cigarette").
  // Tags with only synthetic manual instances (Props/PD/Makeup created outside
  // the Script viewer) fall back to a live phrase search so they highlight too.
  const instanceLookup = useMemo(() => {
    const map = new Map();
    // Sort by phrase length descending so longer matches claim positions first.
    const sorted = Object.entries(taggedItems).sort(([, a], [, b]) => {
      const aLen = (a.displayName || "").split(/\s+/).filter(Boolean).length;
      const bLen = (b.displayName || "").split(/\s+/).filter(Boolean).length;
      return bLen - aLen;
    });
    sorted.forEach(([key, item]) => {
      const instances = item.instances || [];
      const phraseLength = (item.displayName || "").split(/\s+/).filter(Boolean).length;
      const phraseGroups = Array.isArray(item.matchGroups) && item.matchGroups.length
        ? item.matchGroups
        : searchScriptUtil(scenesToRender, item.customTitle || item.displayName || "", stemWord).matchGroups;
      const groupByInstance = new Map();
      phraseGroups.forEach((group) => {
        (group.instanceIds || []).forEach((id, index) => {
          groupByInstance.set(id, {
            groupIds: group.instanceIds || [id],
            groupIndex: index,
            groupLength: (group.instanceIds || []).length,
          });
        });
      });
      // Only UUID-prefixed IDs are stable across insert/reorder.
      // Legacy positional IDs ("5-0-3") are position-index-based and break when
      // scenes are inserted before the tagged scene — treat them like synthetic IDs
      // and fall through to the live search so highlights survive structural changes.
      const hasUuidIds = instances.some((id) => /^[0-9a-f]{8}-/i.test(id));
      if (hasUuidIds) {
        instances.forEach((id) => {
          if (/^[0-9a-f]{8}-/i.test(id) && !map.has(id)) {
            map.set(id, { item, key, phraseLength, ...(groupByInstance.get(id) || {}) });
          }
        });
      } else {
        // Fallback: live text search for tags with only legacy or synthetic IDs.
        // This covers: Props/PD/Makeup synthetic IDs, pre-migration legacy IDs.
        const displayName = item.customTitle || item.displayName || "";
        if (displayName) {
          const { instanceIds, matchGroups } = searchScriptUtil(scenesToRender, displayName, stemWord);
          const fallbackGroupByInstance = new Map();
          matchGroups.forEach((group) => {
            (group.instanceIds || []).forEach((id, index) => {
              fallbackGroupByInstance.set(id, {
                groupIds: group.instanceIds || [id],
                groupIndex: index,
                groupLength: (group.instanceIds || []).length,
              });
            });
          });
          instanceIds.forEach((id) => {
            if (!map.has(id)) map.set(id, { item, key, phraseLength, ...(fallbackGroupByInstance.get(id) || {}) });
          });
        }
      }
    });
    return map;
  }, [taggedItems, scenesToRender]);

  // ── Right-click contextual tagging menu ──────────────────────────────────
  // State: { x, y, selectedText, phase: "menu"|"categories", source: "selection-context-menu" }
  const [showContextMenu, setShowContextMenu] = useState(null);
  const scriptContentRef = useRef(null);
  const isPropTagCategory = (category) => {
    const normalized = String(category || "").trim().toLowerCase();
    return normalized === "prop" || normalized === "props";
  };

  useEffect(() => {
    if (!showContextMenu) return;
    const handleCtxEsc = (e) => { if (e.key === "Escape") setShowContextMenu(null); };
    window.addEventListener("keydown", handleCtxEsc);
    return () => window.removeEventListener("keydown", handleCtxEsc);
  }, [showContextMenu]);

  const handleContextMenu = (e) => {
    if (isEditMode) return;
    e.preventDefault();

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() ?? "";
    const anchor = sel.anchorNode;
    const wordEl = e.target.closest?.("[data-word]");
    const getGroupVisibleText = (tagEntry, fallbackText = "") => {
      const groupIds = Array.isArray(tagEntry?.groupIds) && tagEntry.groupIds.length > 1
        ? tagEntry.groupIds
        : null;

      if (!groupIds) return fallbackText;

      const parsed = groupIds.map((id) => {
        const parts = String(id || "").split("-");
        const wordIndex = Number(parts[parts.length - 1]);
        const blockIndex = Number(parts[parts.length - 2]);
        return { blockIndex, wordIndex };
      }).filter(({ blockIndex, wordIndex }) => Number.isFinite(blockIndex) && Number.isFinite(wordIndex));

      if (!parsed.length) {
        return tagEntry?.item?.customTitle || tagEntry?.item?.displayName || fallbackText;
      }

      const blockIndex = parsed[0].blockIndex;
      if (parsed.some((item) => item.blockIndex !== blockIndex)) {
        return tagEntry?.item?.customTitle || tagEntry?.item?.displayName || fallbackText;
      }

      const sceneIndex = Number(wordEl?.dataset?.sceneIndex);
      const blockText = scenesToRender[sceneIndex]?.content?.[blockIndex]?.text || "";
      const rawTokens = blockText.split(/(\s+)/);
      const wordIndexes = parsed.map(item => item.wordIndex).sort((a, b) => a - b);
      const start = wordIndexes[0];
      const end = wordIndexes[wordIndexes.length - 1];
      const visibleText = rawTokens.slice(start, end + 1).join("").trim();

      return visibleText || tagEntry?.item?.customTitle || tagEntry?.item?.displayName || fallbackText;
    };
    const getClickedTagContext = () => {
      if (!wordEl || !scriptContentRef.current?.contains(wordEl)) return null;
      const sceneIndex = Number(wordEl.dataset.sceneIndex);
      const blockIndex = Number(wordEl.dataset.blockIndex);
      const wordIndex = Number(wordEl.dataset.wordIndex);
      const scene = scenesToRender[sceneIndex];
      const uuidId = scene?.id ? `${scene.id}-${blockIndex}-${wordIndex}` : null;
      const legacyId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
      const tagEntry = (uuidId && instanceLookup.get(uuidId)) || instanceLookup.get(legacyId);
      if (!tagEntry) return null;
      return {
        tagKey: tagEntry.key,
        tagItem: tagEntry.item,
        sceneIndex,
        blockIndex,
        wordIndex,
        category: tagEntry.item?.category,
        selectedText: getGroupVisibleText(tagEntry, wordEl.dataset.word?.trim() || ""),
      };
    };

    if (selectedText && anchor && scriptContentRef.current?.contains(anchor)) {
      const selectedKey = createScriptSearchKey(selectedText, stemWord);
      const legacyKey = stemWord(selectedText.toLowerCase().replace(/[^\w]/g, ""));
      const selectedItem = taggedItems[selectedKey] ? { tagKey: selectedKey, tagItem: taggedItems[selectedKey], category: taggedItems[selectedKey].category } : taggedItems[legacyKey] ? { tagKey: legacyKey, tagItem: taggedItems[legacyKey], category: taggedItems[legacyKey].category } : null;
      const tagContext = selectedItem || getClickedTagContext();
      setShowContextMenu({ x: e.clientX, y: e.clientY, selectedText: tagContext?.selectedText || selectedText, phase: "menu", source: "selection-context-menu", ...tagContext });
      return;
    }

    if (wordEl && scriptContentRef.current?.contains(wordEl)) {
      const clickedWord = wordEl.dataset.word?.trim();
      if (clickedWord) {
        const tagContext = getClickedTagContext();
        setShowContextMenu({ x: e.clientX, y: e.clientY, selectedText: tagContext?.selectedText || clickedWord, phase: "menu", source: "word-context-menu", ...tagContext });
      }
      return;
    }

    setShowContextMenu(null);
  };

  // ── Undo stack ────────────────────────────────────────────────────────────
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lastSnapshotText = useRef({});
  const textSnapshotTimers = useRef({});
  const pendingTextSnapshots = useRef({});
  const focusedBlockKey = useRef(null);
  const selectionDragRef = useRef(null);
  const pendingSelectionDeleteRef = useRef(null);
  const editingScenesRef = useRef(editingScenes);

  useEffect(() => {
    editingScenesRef.current = editingScenes;
  }, [editingScenes]);

  const buildSnapshotTextMap = (sceneList) => {
    const next = {};
    sceneList.forEach((scene, si) => {
      (scene.content || []).forEach((block, bi) => {
        next[getKey(si, bi)] = block.text || "";
      });
    });
    return next;
  };

  const clearTextSnapshotTimer = (key) => {
    clearTimeout(textSnapshotTimers.current[key]);
    delete textSnapshotTimers.current[key];
    pendingTextSnapshots.current[key] = false;
  };

  const clearAllTextSnapshotTimers = () => {
    Object.values(textSnapshotTimers.current).forEach(clearTimeout);
    textSnapshotTimers.current = {};
    pendingTextSnapshots.current = {};
  };

  const setEditingScenesForHistory = (nextScenes) => {
    editingScenesRef.current = nextScenes;
    setEditingScenes(nextScenes);
  };

  const rebuildLastSnapshotText = (sceneList) => {
    lastSnapshotText.current = buildSnapshotTextMap(sceneList);
  };

  const getHeadingLabelText = (scene) => {
    return `${getSceneDisplayLabel(scene, displayLabelMap)}:`;
  };

  const getHeadingDisplayText = (scene) => {
    return scene?.heading || "";
  };

  const getHeadingTextFromDisplay = (si, text) => {
    const scene = editingScenesRef.current[si] || scenesToRender[si];
    const label = getSceneDisplayLabel(scene, displayLabelMap);
    const value = String(text || "").trimStart();

    return value
      .replace(new RegExp(`^${String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`), "")
      .trimStart();
  };

  const compareFlowPositions = (a, b) => {
    if (a.si !== b.si) return a.si - b.si;
    const aOrder = a.kind === "heading" ? -1 : a.bi;
    const bOrder = b.kind === "heading" ? -1 : b.bi;
    return aOrder - bOrder;
  };

  const getFlowPositionForNode = (node) => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const editEl = element?.closest?.(".script-edit-block, .script-heading-edit, .script-heading-label");
    if (!editEl || !scriptContentRef.current?.contains(editEl)) return null;

    if (editEl.classList.contains("script-heading-label")) {
      const headingEl = editEl.parentElement?.querySelector?.(".script-heading-edit");
      const entry = Object.entries(sceneHeadingRefs.current).find(([, el]) => el === headingEl);
      const si = Number(entry?.[0]);
      if (!Number.isFinite(si) || !headingEl) return null;
      return { si, kind: "heading", el: headingEl, fromLabel: true };
    }

    if (editEl.classList.contains("script-heading-edit")) {
      const entry = Object.entries(sceneHeadingRefs.current).find(([, el]) => el === editEl);
      const si = Number(entry?.[0]);
      if (!Number.isFinite(si)) return null;
      return { si, kind: "heading", el: editEl };
    }

    const entry = Object.entries(blockRefs.current).find(([, el]) => el === editEl);
    if (!entry) return null;
    const [si, bi] = entry[0].split("-").map(Number);
    if (!Number.isFinite(si) || !Number.isFinite(bi)) return null;
    return { si, bi, kind: "block", el: editEl };
  };

  const getRangeOffsetInFlowUnit = (range, unit, boundary) => {
    if (!range || !unit?.el) return 0;

    const container = boundary === "start" ? range.startContainer : range.endContainer;
    const offset = boundary === "start" ? range.startOffset : range.endOffset;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;

    if (unit.kind === "heading" && !unit.el.contains(container)) {
      const labelEl = element?.closest?.(".script-heading-label");
      if (labelEl) {
        return boundary === "start" ? 0 : (unit.el.textContent || "").length;
      }
    }

    try {
      const probe = document.createRange();
      probe.selectNodeContents(unit.el);
      probe.setEnd(container, offset);
      return probe.toString().length;
    } catch (_) {
      return boundary === "start" ? 0 : (unit.el.textContent || "").length;
    }
  };

  // Walk text nodes in an element to find the DOM node and local offset for a character position.
  const getNodeAndOffsetAtChar = (el, charOffset) => {
    if (!el) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = charOffset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.textContent.length) return { node, offset: remaining };
      remaining -= node.textContent.length;
      node = walker.nextNode();
    }
    const fallback = el.lastChild;
    return fallback
      ? { node: fallback, offset: fallback.textContent ? fallback.textContent.length : 0 }
      : { node: el, offset: 0 };
  };

  const restoreMultiBlockDeleteSelection = (entry) => {
    const nextScenes = editingScenesRef.current.map((scene, si) => {
      const scenePatch = entry.scenes.find(item => item.si === si);
      return scenePatch
        ? { ...scene, heading: scenePatch.beforeHeading, content: scenePatch.beforeContent }
        : scene;
    });
    setEditingScenesForHistory(nextScenes);
    rebuildLastSnapshotText(nextScenes);
    focusedBlockKey.current = null;
    setTimeout(() => {
      entry.scenes.forEach(scenePatch => {
        const headingEl = sceneHeadingRefs.current[scenePatch.si];
        if (headingEl) {
          const headingText = getHeadingDisplayText(nextScenes[scenePatch.si], scenePatch.si);
          if (headingEl.textContent !== headingText) headingEl.textContent = headingText;
        }
        scenePatch.beforeContent.forEach((block, bi) => {
          const el = blockRefs.current[getKey(scenePatch.si, bi)];
          if (el && el.textContent !== (block.text || "")) {
            el.textContent = block.text || "";
          }
        });
      });
      const el = entry.focus.kind === "heading"
        ? sceneHeadingRefs.current[entry.focus.si]
        : blockRefs.current[getKey(entry.focus.si, entry.focus.bi)];
      if (!el) return;
      if (entry.focus.kind === "heading") {
        const headingText = getHeadingDisplayText(nextScenes[entry.focus.si], entry.focus.si);
        if (el.textContent !== headingText) el.textContent = headingText;
      } else {
        el.textContent = nextScenes[entry.focus.si]?.content?.[entry.focus.bi]?.text || "";
      }
      el.focus();
      setActiveBlockIfChanged(entry.focus);
      setCaretPosition(el, Math.min(entry.focus.offset, el.textContent.length));
    }, 10);
    return {
      type: "multi-block-delete",
      scenes: entry.scenes.map(item => ({
        si: item.si,
        beforeHeading: item.afterHeading,
        afterHeading: item.beforeHeading,
        beforeContent: item.afterContent,
        afterContent: item.beforeContent,
      })),
      focus: entry.focus,
    };
  };

  const setActiveBlockIfChanged = useCallback((nextBlock) => {
    setActiveBlock(prev => {
      if (!nextBlock) return prev === null ? prev : null;
      if (prev?.si === nextBlock.si && prev?.bi === nextBlock.bi && prev?.kind === nextBlock.kind) return prev;
      return nextBlock;
    });
  }, [setActiveBlock]);

  const getCaretRangeFromPoint = (x, y) => {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      if (!position) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  };

  const setEditableBlocksEnabled = (enabled) => {
    const root = scriptContentRef.current;
    if (!root) return;
    root.querySelectorAll(".script-edit-block, .script-heading-edit").forEach((el) => {
      el.setAttribute("contenteditable", enabled ? "true" : "false");
    });
  };

  const handleSelectionMouseDownCapture = (event) => {
    if (!isEditMode || event.button !== 0) return;
    const blockEl = event.target.closest?.(".script-edit-block, .script-heading-edit");
    if (!blockEl || !scriptContentRef.current?.contains(blockEl)) return;

    pendingSelectionDeleteRef.current = null;
    const headingMousedownRange = null;

    selectionDragRef.current = {
      blockEl,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      headingMousedownRange,
    };
    setEditableBlocksEnabled(false);

    const handleMouseMove = (moveEvent) => {
      const drag = selectionDragRef.current;
      if (!drag) return;
      if (
        Math.abs(moveEvent.clientX - drag.startX) > 3 ||
        Math.abs(moveEvent.clientY - drag.startY) > 3
      ) {
        drag.moved = true;
      }
    };

    const handleMouseUp = (upEvent) => {
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseUp, true);

      const drag = selectionDragRef.current;
      selectionDragRef.current = null;

      const root = scriptContentRef.current;

      // Heading-start drag: the browser has no native selection (we called
      // preventDefault), so we manually compute start + end from mousedown/up positions.
      if (drag?.headingMousedownRange && drag?.moved) {
        const upRange = getCaretRangeFromPoint(upEvent.clientX, upEvent.clientY);
        if (upRange) {
          const ps = getFlowPositionForNode(drag.headingMousedownRange.startContainer);
          const pe = getFlowPositionForNode(upRange.startContainer);
          if (ps && pe) {
            const ordS = compareFlowPositions(ps, pe) <= 0 ? ps : pe;
            const ordE = ordS === ps ? pe : ps;
            if (!(ordS.si === ordE.si && ordS.kind === ordE.kind && ordS.bi === ordE.bi)) {
              try {
                const spanRange = document.createRange();
                if (ordS === ps) {
                  spanRange.setStart(drag.headingMousedownRange.startContainer, drag.headingMousedownRange.startOffset);
                  spanRange.setEnd(upRange.startContainer, upRange.startOffset);
                } else {
                  spanRange.setStart(upRange.startContainer, upRange.startOffset);
                  spanRange.setEnd(drag.headingMousedownRange.startContainer, drag.headingMousedownRange.startOffset);
                }
                pendingSelectionDeleteRef.current = {
                  orderedStart: ordS,
                  orderedEnd: ordE,
                  startOffset: getRangeOffsetInFlowUnit(spanRange, ordS, "start"),
                  endOffset: getRangeOffsetInFlowUnit(spanRange, ordE, "end"),
                };
              } catch (_) {}
            }
          }
        }
      }

      // Non-heading-start drag (or heading drag that produced no snapshot above):
      // snapshot native browser selection before restoring editability — browsers
      // often collapse cross-boundary selections when contenteditable goes back to true.
      if (!pendingSelectionDeleteRef.current) {
        const preSel = window.getSelection();
        const preRange = preSel && preSel.rangeCount > 0 && !preSel.isCollapsed
          ? preSel.getRangeAt(0)
          : null;
        if (preRange && root && (root.contains(preRange.startContainer) || root.contains(preRange.endContainer))) {
          const ps = getFlowPositionForNode(preRange.startContainer);
          const pe = getFlowPositionForNode(preRange.endContainer);
          if (ps && pe) {
            const ordS = compareFlowPositions(ps, pe) <= 0 ? ps : pe;
            const ordE = ordS === ps ? pe : ps;
            pendingSelectionDeleteRef.current = {
              orderedStart: ordS,
              orderedEnd: ordE,
              startOffset: getRangeOffsetInFlowUnit(preRange, ordS, ordS === ps ? "start" : "end"),
              endOffset: getRangeOffsetInFlowUnit(preRange, ordE, ordE === pe ? "end" : "start"),
            };
          }
        }
      }

      setEditableBlocksEnabled(true);

      // Attempt to restore visual selection after re-enabling editability.
      const snap = pendingSelectionDeleteRef.current;
      if (snap) {
        const startEl = snap.orderedStart.kind === "heading"
          ? sceneHeadingRefs.current[snap.orderedStart.si]
          : blockRefs.current[getKey(snap.orderedStart.si, snap.orderedStart.bi)];
        const endEl = snap.orderedEnd.kind === "heading"
          ? sceneHeadingRefs.current[snap.orderedEnd.si]
          : blockRefs.current[getKey(snap.orderedEnd.si, snap.orderedEnd.bi)];
        if (startEl && endEl) {
          try {
            const startPos = getNodeAndOffsetAtChar(startEl, snap.startOffset);
            const endPos = getNodeAndOffsetAtChar(endEl, snap.endOffset);
            if (startPos && endPos) {
              const newRange = document.createRange();
              newRange.setStart(startPos.node, startPos.offset);
              newRange.setEnd(endPos.node, endPos.offset);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
          } catch (_) {}
        }
      }

      const selection = window.getSelection();
      const hasRangeSelection = selection && !selection.isCollapsed && scriptContentRef.current?.contains(selection.anchorNode);
      if (drag?.moved || hasRangeSelection) return;

      const targetBlock = upEvent.target.closest?.(".script-edit-block") || drag?.blockEl;
      if (!targetBlock) return;

      targetBlock.focus();
      const range = getCaretRangeFromPoint(upEvent.clientX, upEvent.clientY);
      if (range && targetBlock.contains(range.startContainer)) {
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      const key = Object.entries(blockRefs.current).find(([, el]) => el === targetBlock)?.[0];
      if (key) {
        const [si, bi] = key.split("-").map(Number);
        if (Number.isFinite(si) && Number.isFinite(bi)) {
          setActiveBlockIfChanged({ si, bi });
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseUp, true);
  };

  useEffect(() => {
    if (isEditMode && editingScenes.length > 0) {
      undoStack.current = [];
      redoStack.current = [];
      lastSnapshotText.current = buildSnapshotTextMap(editingScenes);
      clearAllTextSnapshotTimers();
    }
  }, [isEditMode]);

  const scheduleTextSnapshot = (si, bi, currentText = null) => {
    const key = getKey(si, bi);
    const nextText = currentText ?? blockRefs.current[key]?.textContent ?? "";
    const lastText = lastSnapshotText.current[key] ?? "";

    if (nextText !== lastText && !pendingTextSnapshots.current[key]) {
      pendingTextSnapshots.current[key] = true;
      pushUndoEntry({ type: "text", si, bi, text: lastText });
    }

    clearTimeout(textSnapshotTimers.current[key]);
    textSnapshotTimers.current[key] = setTimeout(() => {
      const settledText = blockRefs.current[key]?.textContent ?? "";
      const previousText = lastSnapshotText.current[key] ?? "";
      if (settledText !== previousText) {
        if (!pendingTextSnapshots.current[key]) {
          pushUndoEntry({ type: "text", si, bi, text: previousText });
        }
        lastSnapshotText.current[key] = settledText;
      }
      pendingTextSnapshots.current[key] = false;
      delete textSnapshotTimers.current[key];
    }, 800);
  };

  const syncBlockTextFromInput = useCallback((si, bi, text) => {
    scheduleTextSnapshot(si, bi, text);
  }, []);

  const flushTextSnapshot = (si, bi, text) => {
    const key = getKey(si, bi);
    const hadPendingSnapshot = Boolean(pendingTextSnapshots.current[key]);
    clearTextSnapshotTimer(key);
    if (hadPendingSnapshot) {
      lastSnapshotText.current[key] = text;
    } else if ((lastSnapshotText.current[key] ?? "") !== text) {
      const lastText = lastSnapshotText.current[key] ?? "";
      if (text !== lastText) {
        pushUndoEntry({ type: "text", si, bi, text: lastText });
      }
      lastSnapshotText.current[key] = text;
    }
  };

  const updateCharacterAutocomplete = (si, bi, text) => {
    const query = String(text || "").trim().toUpperCase();
    if (!query) {
      setCharacterAutocomplete(null);
      return;
    }

    const suggestions = characterSuggestionNames
      .filter(name => name.includes(query))
      .slice(0, 8);

    if (!suggestions.length) {
      setCharacterAutocomplete(null);
      return;
    }

    setCharacterAutocomplete(prev => ({
      si,
      bi,
      query,
      suggestions,
      selectedIndex: prev?.si === si && prev?.bi === bi
        ? Math.min(prev.selectedIndex || 0, suggestions.length - 1)
        : 0,
    }));
  };

  const acceptCharacterAutocomplete = (nameOverride = null) => {
    if (!characterAutocomplete?.suggestions?.length) return false;
    const name = nameOverride || characterAutocomplete.suggestions[characterAutocomplete.selectedIndex || 0];
    const { si, bi } = characterAutocomplete;
    const el = blockRefs.current[getKey(si, bi)];
    if (!name || !el) return false;

    scheduleTextSnapshot(si, bi, name);
    el.textContent = name;
    updateBlockText(si, bi, name);
    lastSnapshotText.current[getKey(si, bi)] = name;
    setCharacterAutocomplete(null);
    requestAnimationFrame(() => setCaretPosition(el, name.length));
    return true;
  };

  const pushBlockSnapshot = (si, bi) => {
    const domText = blockRefs.current[getKey(si, bi)]?.textContent ?? "";
    const block = editingScenesRef.current[si]?.content?.[bi];
    if (!block) return;
    pushUndoEntry({
      type: "block",
      si,
      bi,
      block: { ...block, text: domText },
    });
  };

  function pushUndoEntry(entry) {
    undoStack.current.push(entry);
    if (undoStack.current.length > 200) undoStack.current.shift();
    redoStack.current = [];
  }

  const applyUndoEntry = (entry) => {
    clearAllTextSnapshotTimers();

    if (entry.type === "text") {
      const key = getKey(entry.si, entry.bi);
      const currentText = blockRefs.current[key]?.textContent ?? editingScenesRef.current[entry.si]?.content?.[entry.bi]?.text ?? "";
      const nextScenes = editingScenesRef.current.map((s, i) =>
        i !== entry.si ? s : {
          ...s, content: s.content.map((b, j) => j !== entry.bi ? b : { ...b, text: entry.text }),
        }
      );
      setEditingScenesForHistory(nextScenes);
      lastSnapshotText.current[key] = entry.text;
      setTimeout(() => {
        const el = blockRefs.current[key];
        if (el) {
          el.textContent = entry.text;
          lastSnapshotText.current[key] = entry.text;
          el.focus();
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      }, 10);
      return { type: "text", si: entry.si, bi: entry.bi, text: currentText };
    } else if (entry.type === "block") {
      const key = getKey(entry.si, entry.bi);
      const currentBlock = editingScenesRef.current[entry.si]?.content?.[entry.bi];
      const currentText = blockRefs.current[key]?.textContent ?? currentBlock?.text ?? "";
      const nextScenes = editingScenesRef.current.map((s, i) =>
        i !== entry.si ? s : {
          ...s,
          content: s.content.map((b, j) => j !== entry.bi ? b : { ...entry.block }),
        }
      );
      setEditingScenesForHistory(nextScenes);
      lastSnapshotText.current[key] = entry.block.text || "";
      setTimeout(() => {
        const el = blockRefs.current[key];
        if (!el) return;
        el.textContent = entry.block.text || "";
        lastSnapshotText.current[key] = entry.block.text || "";
        el.focus();
        setCaretPosition(el, el.textContent.length);
      }, 10);
      return currentBlock ? { type: "block", si: entry.si, bi: entry.bi, block: { ...currentBlock, text: currentText } } : null;
    } else if (entry.type === "delete-added-block") {
      const removedBlock = editingScenesRef.current[entry.si]?.content?.[entry.bi] || entry.block || null;
      const nextScenes = editingScenesRef.current.map((s, i) => {
        if (i !== entry.si) return s;
        return { ...s, content: s.content.filter((_, j) => j !== entry.bi) };
      });
      setEditingScenesForHistory(nextScenes);
      rebuildLastSnapshotText(nextScenes);
      return removedBlock ? { type: "insert-deleted-block", si: entry.si, bi: entry.bi, block: { ...removedBlock } } : null;
    } else if (entry.type === "insert-deleted-block") {
      const nextScenes = editingScenesRef.current.map((s, i) => {
        if (i !== entry.si) return s;
        const content = [...s.content];
        content.splice(entry.bi, 0, { ...entry.block });
        return { ...s, content };
      });
      setEditingScenesForHistory(nextScenes);
      rebuildLastSnapshotText(nextScenes);
      setTimeout(() => {
        const key = getKey(entry.si, entry.bi);
        const el = blockRefs.current[key];
        if (!el) return;
        el.textContent = entry.block.text || "";
        lastSnapshotText.current[key] = entry.block.text || "";
        el.focus();
        setActiveBlockIfChanged({ si: entry.si, bi: entry.bi });
        setCaretPosition(el, el.textContent.length);
      }, 10);
      return { type: "delete-added-block", si: entry.si, bi: entry.bi, block: { ...entry.block } };
    } else if (entry.type === "multi-block-delete") {
      return restoreMultiBlockDeleteSelection(entry);
    } else if (entry.type === "multi-scene-delete") {
      const currentScenes = editingScenesRef.current;
      const nextScenes = [
        ...currentScenes.slice(0, entry.spliceAt),
        ...entry.insert,
        ...currentScenes.slice(entry.spliceAt + entry.replace.length),
      ];
      setEditingScenesForHistory(nextScenes);
      rebuildLastSnapshotText(nextScenes);
      focusedBlockKey.current = null;
      setTimeout(() => {
        const freshLabelMap = buildSceneDisplayLabelMap(editingScenesRef.current);
        const getUpdatedHeadingText = (si) => {
          const s = editingScenesRef.current[si];
          if (!s) return "";
          return `${getSceneDisplayLabel(s, freshLabelMap)}: ${s.heading || ""}`;
        };
        entry.insert.forEach((scene, rangeIdx) => {
          const si = entry.spliceAt + rangeIdx;
          const headingEl = sceneHeadingRefs.current[si];
          if (headingEl) {
            const headingText = getUpdatedHeadingText(si);
            if (headingEl.textContent !== headingText) headingEl.textContent = headingText;
          }
          scene.content.forEach((block, bi) => {
            const el = blockRefs.current[getKey(si, bi)];
            if (el && el.textContent !== (block.text || "")) el.textContent = block.text || "";
          });
        });
        const focusSi = entry.focus.si;
        const focusEl = entry.focus.kind === "heading"
          ? sceneHeadingRefs.current[focusSi]
          : blockRefs.current[getKey(focusSi, entry.focus.bi ?? 0)];
        if (!focusEl) return;
        if (entry.focus.kind === "heading") {
          const headingText = getUpdatedHeadingText(focusSi);
          if (focusEl.textContent !== headingText) focusEl.textContent = headingText;
        } else {
          focusEl.textContent = editingScenesRef.current[focusSi]?.content?.[entry.focus.bi]?.text || "";
        }
        focusEl.focus();
        setActiveBlockIfChanged(entry.focus);
        setCaretPosition(focusEl, Math.min(entry.focus.offset ?? 0, focusEl.textContent.length));
      }, 10);
      return {
        type: "multi-scene-delete",
        spliceAt: entry.spliceAt,
        replace: entry.insert,
        insert: entry.replace,
        focus: entry.inverseFocus,
        inverseFocus: entry.focus,
      };
    }
    return null;
  };

  const undo = () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    const redoEntry = applyUndoEntry(entry);
    if (redoEntry) {
      redoStack.current.push(redoEntry);
      if (redoStack.current.length > 200) redoStack.current.shift();
    }
  };

  const redo = () => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    const undoEntry = applyUndoEntry(entry);
    if (undoEntry) {
      undoStack.current.push(undoEntry);
      if (undoStack.current.length > 200) undoStack.current.shift();
    }
  };

  const updateBlockText = useCallback((si, bi, text) => {
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) =>
        i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : { ...b, text }) }
      );
      editingScenesRef.current = nextScenes;
      lastSnapshotText.current[getKey(si, bi)] = text;
      return nextScenes;
    });
  }, [setEditingScenes]);

  const updateSceneHeading = useCallback((si, heading) => {
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) =>
        i !== si ? s : { ...s, heading: heading.toUpperCase() }
      );
      editingScenesRef.current = nextScenes;
      return nextScenes;
    });
  }, [setEditingScenes]);

  const normalizeTextForTypeChange = (currentType, newType, text) => {
    const nextText = String(text || "");
    if (currentType === "Parenthetical" && newType !== "Parenthetical") {
      if (nextText.trim() === "()") return "";
      const match = nextText.match(/^\((.*)\)$/s);
      if (match) return match[1];
    }
    return newType === "Character" ? nextText.toUpperCase() : nextText;
  };

  const updateBlockType = useCallback((si, bi, newType) => {
    pushBlockSnapshot(si, bi);
    const domText = blockRefs.current[getKey(si, bi)]?.textContent || "";
    const currentType = editingScenesRef.current[si]?.content?.[bi]?.type;
    const nextText = normalizeTextForTypeChange(currentType, newType, domText);
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) =>
        i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : {
          ...b, type: newType,
          text: normalizeTextForTypeChange(b.type, newType, domText),
        }) }
      );
      editingScenesRef.current = nextScenes;
      lastSnapshotText.current[getKey(si, bi)] = nextText;
      return nextScenes;
    });
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, bi)];
      if (!el) return;
      el.textContent = nextText;
      el.focus();
      setCaretPosition(el, el.textContent.length);
    }, 20);
  }, [setEditingScenes]);

  const setCaretPosition = (el, offset) => {
    if (!el) return;
    const range = document.createRange();
    const selection = window.getSelection();
    const textNode = el.firstChild;

    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      range.setStart(textNode, Math.min(offset, textNode.textContent.length));
      range.collapse(true);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const syncSceneFromDom = (scene, si) => ({
    ...scene,
    heading: getHeadingTextFromDisplay(si, sceneHeadingRefs.current[si]?.textContent ?? getHeadingDisplayText(scene, si)),
    content: (scene.content || []).map((block, bi) => ({
      ...block,
      text: blockRefs.current[getKey(si, bi)]?.textContent ?? block.text ?? "",
    })),
  });

  const ensureSceneHasBlock = (content, fallbackBlock) => {
    if (content.length > 0) return content;
    const safeBlock = fallbackBlock || { type: "Action", text: "", formatting: null };
    return [{ ...safeBlock, text: "" }];
  };

  const handleMultiBlockSelectionDelete = useCallback(() => {
    const root = scriptContentRef.current;
    if (!root) return false;

    let orderedStart = null, orderedEnd = null, startOffset = 0, endOffset = 0;
    const selection = window.getSelection();

    // Try live browser selection first.
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (root.contains(range.startContainer) || root.contains(range.endContainer)) {
        const start = getFlowPositionForNode(range.startContainer);
        const end = getFlowPositionForNode(range.endContainer);
        if (start && end) {
          const candS = compareFlowPositions(start, end) <= 0 ? start : end;
          const candE = candS === start ? end : start;
          if (!(candS.si === candE.si && candS.kind === candE.kind && candS.bi === candE.bi)) {
            orderedStart = candS;
            orderedEnd = candE;
            startOffset = getRangeOffsetInFlowUnit(range, orderedStart, orderedStart === start ? "start" : "end");
            endOffset = getRangeOffsetInFlowUnit(range, orderedEnd, orderedEnd === end ? "end" : "start");
          }
        }
      }
    }

    // Fallback: use the snapshot captured before editability was restored.
    if (!orderedStart && pendingSelectionDeleteRef.current) {
      const snap = pendingSelectionDeleteRef.current;
      orderedStart = snap.orderedStart;
      orderedEnd = snap.orderedEnd;
      startOffset = snap.startOffset;
      endOffset = snap.endOffset;
    }
    pendingSelectionDeleteRef.current = null;

    if (!orderedStart || !orderedEnd) return false;
    if (
      orderedStart.si === orderedEnd.si &&
      orderedStart.kind === orderedEnd.kind &&
      orderedStart.bi === orderedEnd.bi
    ) return false;

    const currentScenes = editingScenesRef.current.map((scene, si) => syncSceneFromDom(scene, si));

    // A scene is fully selected when the selection covers from the very start of its
    // heading through to the very end of its last body block.
    const isSceneFullySelected = (si) => {
      const content = currentScenes[si]?.content || [];
      const startCovered = orderedStart.si < si ||
        (orderedStart.si === si && orderedStart.kind === "heading" && startOffset === 0);
      if (!startCovered) return false;
      if (orderedEnd.si > si) return true;
      if (orderedEnd.si < si) return false;
      if (orderedEnd.kind === "heading") return false;
      const lastBi = content.length - 1;
      if (lastBi < 0) return true;
      if (orderedEnd.bi < lastBi) return false;
      return endOffset >= (content[lastBi]?.text || "").length;
    };

    const fullySelectedSet = new Set();
    for (let si = orderedStart.si; si <= orderedEnd.si; si++) {
      if (isSceneFullySelected(si)) fullySelectedSet.add(si);
    }
    // Never remove every scene from the screenplay.
    if (fullySelectedSet.size >= currentScenes.length) {
      fullySelectedSet.delete(orderedEnd.si);
    }

    const getUnitText = (scene, unit) => (
      unit.kind === "heading"
        ? getHeadingDisplayText(scene, unit.si)
        : scene.content?.[unit.bi]?.text || ""
    );
    const trimStartUnit = (scene, unit, offset) => {
      if (unit.kind === "heading") {
        const nextDisplay = getUnitText(scene, unit).slice(0, offset);
        return { ...scene, heading: getHeadingTextFromDisplay(unit.si, nextDisplay) };
      }
      return {
        ...scene,
        content: scene.content.map((block, bi) =>
          bi === unit.bi ? { ...block, text: (block.text || "").slice(0, offset) } : block
        ),
      };
    };
    const trimEndUnit = (scene, unit, offset) => {
      if (unit.kind === "heading") {
        const nextDisplay = getUnitText(scene, unit).slice(offset);
        return { ...scene, heading: getHeadingTextFromDisplay(unit.si, nextDisplay) };
      }
      return {
        ...scene,
        content: scene.content.map((block, bi) =>
          bi === unit.bi ? { ...block, text: (block.text || "").slice(offset) } : block
        ),
      };
    };

    // Build the surviving scenes from the selected range (fully-selected scenes are dropped).
    const survivingFromRange = [];
    for (let si = orderedStart.si; si <= orderedEnd.si; si++) {
      if (fullySelectedSet.has(si)) continue;

      const scene = currentScenes[si];
      const content = scene.content || [];
      const sceneStartUnit = si === orderedStart.si ? orderedStart : { si, kind: "heading" };
      const sceneEndUnit = si === orderedEnd.si ? orderedEnd : { si, kind: "block", bi: content.length - 1 };

      let nextScene = { ...scene, content: [...content] };

      // Both endpoints land in the heading of the same scene.
      if (sceneStartUnit.kind === "heading" && sceneEndUnit.kind === "heading") {
        const start = si === orderedStart.si ? startOffset : 0;
        const end = si === orderedEnd.si ? endOffset : getHeadingDisplayText(scene, si).length;
        const displayText = getHeadingDisplayText(scene, si);
        survivingFromRange.push({
          ...nextScene,
          heading: getHeadingTextFromDisplay(si, displayText.slice(0, start) + displayText.slice(end)),
          content: ensureSceneHasBlock(content, content[0]),
        });
        continue;
      }

      if (sceneStartUnit.kind === "heading") {
        nextScene = trimStartUnit(nextScene, sceneStartUnit, si === orderedStart.si ? startOffset : 0);
      } else if (si === orderedStart.si) {
        nextScene = trimStartUnit(nextScene, sceneStartUnit, startOffset);
      }

      if (sceneEndUnit.kind === "heading") {
        nextScene = trimEndUnit(nextScene, sceneEndUnit, si === orderedEnd.si ? endOffset : getHeadingDisplayText(scene, si).length);
      } else if (si === orderedEnd.si) {
        nextScene = trimEndUnit(nextScene, sceneEndUnit, endOffset);
      }

      // Build the set of original block indices to remove.
      const firstRemovedBi = sceneStartUnit.kind === "heading" ? 0 : sceneStartUnit.bi + 1;
      const lastRemovedBi = sceneEndUnit.kind === "heading"
        ? -1
        : (si === orderedEnd.si ? sceneEndUnit.bi - 1 : content.length - 1);
      const blocksToRemove = new Set();
      for (let bi = firstRemovedBi; bi <= lastRemovedBi; bi++) blocksToRemove.add(bi);

      // Also remove the start block when the selection consumed it entirely (offset at 0).
      if (
        sceneStartUnit.kind === "block" &&
        startOffset === 0 &&
        (orderedEnd.si > si || (orderedEnd.si === si && orderedEnd.kind === "block" && orderedEnd.bi > orderedStart.bi))
      ) {
        blocksToRemove.add(sceneStartUnit.bi);
      }

      // Also remove the end block when the selection consumed it entirely (offset at end).
      if (
        si === orderedEnd.si &&
        sceneEndUnit.kind === "block" &&
        (orderedStart.si < si || orderedStart.kind === "heading" ||
          (orderedStart.kind === "block" && orderedStart.bi < orderedEnd.bi)) &&
        endOffset >= (content[orderedEnd.bi]?.text || "").length
      ) {
        blocksToRemove.add(sceneEndUnit.bi);
      }

      const nextContent = nextScene.content.filter((_, bi) => !blocksToRemove.has(bi));
      const fallbackBlock =
        (sceneStartUnit.kind === "block" ? content[sceneStartUnit.bi] : null) ||
        (sceneEndUnit.kind === "block" ? content[sceneEndUnit.bi] : null) ||
        content[0];
      survivingFromRange.push({
        ...nextScene,
        content: ensureSceneHasBlock(nextContent, fallbackBlock),
      });
    }

    // Remove orphan scenes produced by the delete: selection cleared the heading
    // AND all content blocks (e.g. selecting from the start of a scene heading
    // through its last block leaves an empty scene rendered as "N:" only).
    const beforeRange = currentScenes.slice(0, orderedStart.si);
    const afterRange = currentScenes.slice(orderedEnd.si + 1);
    const cleanSurvivors = survivingFromRange.filter(
      (scene) =>
        !!(scene.heading || "").trim() ||
        (scene.content || []).some((b) => !!(b.text || "").trim())
    );
    // If all survivors were orphans and nothing else remains, keep one clean
    // empty scene (the script can never be entirely empty).
    const guaranteedSurvivors =
      cleanSurvivors.length === 0 && beforeRange.length === 0 && afterRange.length === 0
        ? [{ ...currentScenes[orderedEnd.si], heading: "", content: [{ type: "Action", text: "", formatting: null }] }]
        : cleanSurvivors;

    const nextScenes = [
      ...beforeRange,
      ...guaranteedSurvivors,
      ...afterRange,
    ];

    // Compute caret position in the after-state.
    const afterFocusSi = Math.min(orderedStart.si, nextScenes.length - 1);
    const startSceneKept = !fullySelectedSet.has(orderedStart.si);
    let focusAfterDelete;
    if (!startSceneKept) {
      focusAfterDelete = { si: afterFocusSi, kind: "heading", bi: 0, offset: 0 };
    } else if (orderedStart.kind === "heading") {
      focusAfterDelete = { si: afterFocusSi, kind: "heading", bi: 0, offset: startOffset };
    } else {
      const newContentLen = guaranteedSurvivors[0]?.content?.length ?? 1;
      const focusBi = Math.min(orderedStart.bi, Math.max(0, newContentLen - 1));
      focusAfterDelete = { si: afterFocusSi, kind: "block", bi: focusBi, offset: focusBi === orderedStart.bi ? startOffset : 0 };
    }

    // Undo entry uses a splice model: apply = replace `replace` with `insert`.
    // Symmetric: the inverse simply swaps replace/insert and swaps focus fields.
    pushUndoEntry({
      type: "multi-scene-delete",
      spliceAt: orderedStart.si,
      replace: guaranteedSurvivors,
      insert: currentScenes.slice(orderedStart.si, orderedEnd.si + 1),
      focus: { si: orderedStart.si, kind: orderedStart.kind, bi: orderedStart.bi ?? 0, offset: startOffset },
      inverseFocus: focusAfterDelete,
    });

    clearAllTextSnapshotTimers();
    focusedBlockKey.current = null;
    setEditingScenesForHistory(nextScenes);
    rebuildLastSnapshotText(nextScenes);
    setCharacterAutocomplete(null);
    selection?.removeAllRanges();

    setTimeout(() => {
      const freshLabelMap = buildSceneDisplayLabelMap(editingScenesRef.current);
      const getUpdatedHeadingText = (si) => {
        const s = editingScenesRef.current[si];
        if (!s) return "";
        return `${getSceneDisplayLabel(s, freshLabelMap)}: ${s.heading || ""}`;
      };
      guaranteedSurvivors.forEach((scene, rangeIdx) => {
        const afterSi = orderedStart.si + rangeIdx;
        const headingEl = sceneHeadingRefs.current[afterSi];
        if (headingEl) {
          const headingText = getUpdatedHeadingText(afterSi);
          if (headingEl.textContent !== headingText) headingEl.textContent = headingText;
        }
        scene.content.forEach((block, bi) => {
          const el = blockRefs.current[getKey(afterSi, bi)];
          if (el && el.textContent !== (block.text || "")) el.textContent = block.text || "";
        });
      });
      const focusSi = focusAfterDelete.si;
      const focusEl = focusAfterDelete.kind === "heading"
        ? sceneHeadingRefs.current[focusSi]
        : blockRefs.current[getKey(focusSi, focusAfterDelete.bi)];
      if (!focusEl) return;
      if (focusAfterDelete.kind === "heading") {
        const headingText = getUpdatedHeadingText(focusSi);
        if (focusEl.textContent !== headingText) focusEl.textContent = headingText;
      } else {
        focusEl.textContent = editingScenesRef.current[focusSi]?.content?.[focusAfterDelete.bi]?.text || "";
      }
      focusEl.focus();
      setActiveBlockIfChanged({ si: focusSi, kind: focusAfterDelete.kind, bi: focusAfterDelete.bi });
      setCaretPosition(focusEl, Math.min(focusAfterDelete.offset, focusEl.textContent.length));
    }, 10);

    return true;
  }, [setEditingScenes, setActiveBlockIfChanged]);

  const getCaretCharacterOffset = (el) => {
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) {
      return el?.textContent?.length || 0;
    }

    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) {
      return el.textContent?.length || 0;
    }

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(el);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
  };

  const createRangeAtCharacterOffset = (el, offset) => {
    const range = document.createRange();
    const targetOffset = Math.max(0, Math.min(offset, el?.textContent?.length || 0));
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = targetOffset;
    let node = walker.nextNode();

    while (node) {
      const length = node.textContent.length;
      if (remaining <= length) {
        range.setStart(node, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= length;
      node = walker.nextNode();
    }

    range.selectNodeContents(el);
    range.collapse(false);
    return range;
  };

  const getRangeRect = (range, fallbackEl = null) => {
    if (!range) return fallbackEl?.getBoundingClientRect?.() || null;
    const rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) return rect;
    const rects = range.getClientRects();
    if (rects && rects.length) return rects[0];
    return fallbackEl?.getBoundingClientRect?.() || null;
  };

  const getCaretRect = (el) => {
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    return getRangeRect(range, el);
  };

  const getVerticalCaretBoundary = (el) => {
    if (!el) return { isFirstLine: true, isLastLine: true };
    const currentRect = getCaretRect(el);
    const textLength = el.textContent?.length || 0;
    const firstRect = getRangeRect(createRangeAtCharacterOffset(el, 0), el);
    const lastRect = getRangeRect(createRangeAtCharacterOffset(el, textLength), el);
    const lineTolerance = 3;

    if (!currentRect || !firstRect || !lastRect) {
      return { isFirstLine: true, isLastLine: true };
    }

    return {
      isFirstLine: currentRect.top <= firstRect.top + lineTolerance,
      isLastLine: currentRect.top >= lastRect.top - lineTolerance,
    };
  };

  const getCaretOffsetForLineX = (el, lineEdge, targetX) => {
    if (!el) return 0;
    const textLength = el.textContent?.length || 0;
    if (textLength === 0) return 0;

    const edgeOffset = lineEdge === "last" ? textLength : 0;
    const edgeRect = getRangeRect(createRangeAtCharacterOffset(el, edgeOffset), el);
    if (!edgeRect) return edgeOffset;

    const lineTolerance = 3;
    const candidates = [];
    for (let offset = 0; offset <= textLength; offset++) {
      const rect = getRangeRect(createRangeAtCharacterOffset(el, offset), el);
      if (!rect || Math.abs(rect.top - edgeRect.top) > lineTolerance) continue;
      candidates.push({ offset, x: rect.left });
    }

    if (!candidates.length) return edgeOffset;

    let best = candidates[0];
    candidates.forEach(candidate => {
      if (Math.abs(candidate.x - targetX) < Math.abs(best.x - targetX)) {
        best = candidate;
      }
    });
    return best.offset;
  };

  const updateBlockTypeWithText = useCallback((si, bi, newType, nextText, caretOffset = null) => {
    pushBlockSnapshot(si, bi);
    const currentType = editingScenesRef.current[si]?.content?.[bi]?.type;
    const normalizedText = normalizeTextForTypeChange(currentType, newType, nextText);
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) =>
        i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : {
          ...b,
          type: newType,
          text: normalizeTextForTypeChange(b.type, newType, nextText),
        }) }
      );
      editingScenesRef.current = nextScenes;
      lastSnapshotText.current[getKey(si, bi)] = normalizedText;
      return nextScenes;
    });
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, bi)];
      if (!el) return;
      el.textContent = normalizedText;
      el.focus();
      if (caretOffset !== null) {
        requestAnimationFrame(() => setCaretPosition(el, caretOffset));
      }
    }, 20);
  }, [setEditingScenes]);

  const addBlock = useCallback((si, afterBi, type = "Action", initialText = "", caretOffset = null) => {
    const domText = blockRefs.current[getKey(si, afterBi)]?.textContent || "";
    pushUndoEntry({ type: "delete-added-block", si, bi: afterBi + 1 });
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) => {
        if (i !== si) return s;
        const content = [...s.content];
        content[afterBi] = { ...content[afterBi], text: domText };
        content.splice(afterBi + 1, 0, { type, text: initialText, formatting: null });
        return { ...s, content };
      });
      editingScenesRef.current = nextScenes;
      rebuildLastSnapshotText(nextScenes);
      return nextScenes;
    });
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, afterBi + 1)];
      if (el) {
        if (initialText && el.textContent !== initialText) el.textContent = initialText;
        el.focus();
        setActiveBlockIfChanged({ si, bi: afterBi + 1 });
        if (caretOffset !== null) {
          requestAnimationFrame(() => setCaretPosition(el, caretOffset));
        }
      }
    }, 30);
  }, [setEditingScenes, setActiveBlockIfChanged]);

  const handleTabKey = useCallback((e, si, bi, block) => {
    e.preventDefault();
    const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";

    if (block.type === "Action") {
      if (txt.trim()) {
        addBlock(si, bi, "Character");
      } else {
        updateBlockType(si, bi, "Character");
      }
      return;
    }

    if (block.type === "Character" || block.type === "Dialogue") {
      addBlock(si, bi, "Parenthetical", "()", 1);
    }
  }, [addBlock, updateBlockType]);

  const handleTypeShortcut = useCallback((e, si, bi, block, newType) => {
    e.preventDefault();
    const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";

    if (newType === "Parenthetical" && !txt.trim()) {
      updateBlockTypeWithText(si, bi, "Parenthetical", "()", 1);
      return;
    }

    updateBlockType(si, bi, newType);
  }, [updateBlockType, updateBlockTypeWithText]);

  const canCreateSceneFromEmptyBlock = (block) => {
    return block?.type === "Action" || block?.type === "Scene Heading" || block?.type === "Transition";
  };

  const createSceneAfterBlock = useCallback((si, bi) => {
    if (!onCreateSceneAfter) return false;

    const now = Date.now();
    const last = lastSceneCreationRef.current;
    if (last.si === si && last.bi === bi && now - last.at < 800) return true;

    pushBlockSnapshot(si, bi);
    lastSceneCreationRef.current = { si, bi, at: now };
    const domText = blockRefs.current[getKey(si, bi)]?.textContent || "";
    onCreateSceneAfter(si, bi, domText);

    setActiveBlockIfChanged(null);
    setTimeout(() => {
      const headingEl = sceneHeadingRefs.current[si + 1];
      if (!headingEl) return;

      headingEl.focus();
      const range = document.createRange();
      range.selectNodeContents(headingEl);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 60);

    return true;
  }, [onCreateSceneAfter, setActiveBlockIfChanged]);

  const deleteBlock = useCallback((si, bi, len) => {
    if (len <= 1) return;
    const deletedBlock = editingScenesRef.current[si]?.content?.[bi];
    if (!deletedBlock) return;
    pushUndoEntry({
      type: "insert-deleted-block",
      si,
      bi,
      block: { ...deletedBlock, text: blockRefs.current[getKey(si, bi)]?.textContent ?? deletedBlock.text ?? "" },
    });
    setEditingScenes(prev => {
      const nextScenes = prev.map((s, i) => {
        if (i !== si) return s;
        const content = [...s.content];
        content.splice(bi, 1);
        return { ...s, content };
      });
      editingScenesRef.current = nextScenes;
      rebuildLastSnapshotText(nextScenes);
      return nextScenes;
    });
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, Math.max(0, bi - 1))];
      if (el) {
        el.focus();
        setActiveBlockIfChanged({ si, bi: Math.max(0, bi - 1) });
        setCaretPosition(el, el.textContent.length);
      }
    }, 30);
  }, [setEditingScenes, setActiveBlockIfChanged]);

  const getFlowElement = (unit) => {
    if (!unit) return null;
    return unit.kind === "heading"
      ? sceneHeadingRefs.current[unit.si]
      : blockRefs.current[getKey(unit.si, unit.bi)];
  };

  const getAdjacentFlowUnit = useCallback((unit, direction) => {
    if (!unit) return null;
    if (direction < 0) {
      if (unit.kind === "block") {
        if (unit.bi > 0) return { si: unit.si, kind: "block", bi: unit.bi - 1 };
        return { si: unit.si, kind: "heading" };
      }
      for (let prevSi = unit.si - 1; prevSi >= 0; prevSi--) {
        const prevContent = editingScenes[prevSi]?.content || [];
        if (prevContent.length > 0) return { si: prevSi, kind: "block", bi: prevContent.length - 1 };
        return { si: prevSi, kind: "heading" };
      }
      return null;
    }

    if (unit.kind === "heading") {
      const currentContent = editingScenes[unit.si]?.content || [];
      if (currentContent.length > 0) return { si: unit.si, kind: "block", bi: 0 };
    } else {
      const currentContent = editingScenes[unit.si]?.content || [];
      if (unit.bi + 1 < currentContent.length) return { si: unit.si, kind: "block", bi: unit.bi + 1 };
    }

    for (let nextSi = unit.si + 1; nextSi < editingScenes.length; nextSi++) {
      const nextContent = editingScenes[nextSi]?.content || [];
      return { si: nextSi, kind: "heading" };
    }
    return null;
  }, [editingScenes]);

  const handleVerticalArrowKey = useCallback((e, unit) => {
    const direction = e.key === "ArrowUp" ? -1 : 1;
    const currentEl = getFlowElement(unit);
    if (!currentEl) return;

    const { isFirstLine, isLastLine } = getVerticalCaretBoundary(currentEl);
    const isBoundary = direction < 0 ? isFirstLine : isLastLine;
    if (!isBoundary) return;

    e.preventDefault();

    const target = getAdjacentFlowUnit(unit, direction);
    if (!target) return;
    const caretRect = getCaretRect(currentEl);
    const targetX = caretRect?.left ?? currentEl.getBoundingClientRect().left;
    const targetEl = getFlowElement(target);
    if (!targetEl) return;
    const targetOffset = getCaretOffsetForLineX(targetEl, direction < 0 ? "last" : "first", targetX);

    targetEl.focus();
    setActiveBlockIfChanged(target);
    requestAnimationFrame(() => {
      setCaretPosition(targetEl, targetOffset);
      targetEl.scrollIntoView({ block: "nearest" });
    });
  }, [getAdjacentFlowUnit, setActiveBlockIfChanged]);

  const handleKeyDown = useCallback((e, si, bi, len) => {
    const block = editingScenes[si]?.content[bi];
    if (!block) return;

    const sel = window.getSelection();
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      ((sel && !sel.isCollapsed) || pendingSelectionDeleteRef.current)
    ) {
      if (handleMultiBlockSelectionDelete()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const autocompleteOpen =
      characterAutocomplete?.si === si &&
      characterAutocomplete?.bi === bi &&
      Array.isArray(characterAutocomplete.suggestions) &&
      characterAutocomplete.suggestions.length > 0;

    if (autocompleteOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCharacterAutocomplete(prev => {
          if (!prev) return prev;
          const delta = e.key === "ArrowDown" ? 1 : -1;
          const count = prev.suggestions.length;
          return { ...prev, selectedIndex: (prev.selectedIndex + delta + count) % count };
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptCharacterAutocomplete();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setCharacterAutocomplete(null);
        return;
      }
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      handleVerticalArrowKey(e, { si, kind: "block", bi });
      return;
    }

    // ── Left/right arrows: fully native within block, RAF boundary detection ──────
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      lastArrowKey.current = e.key;
      preArrowBlockKey.current = getKey(si, bi);
      if (sel && sel.rangeCount > 0) {
        try { preArrowCaretRect.current = sel.getRangeAt(0).getBoundingClientRect(); }
        catch { preArrowCaretRect.current = null; }
      }
      // No preventDefault — browser handles all within-block movement natively.
      // RAF fires after browser updates selection; we check for boundary crossing.
      requestAnimationFrame(() => {
        const sel2 = window.getSelection();
        if (!sel2 || sel2.rangeCount === 0) return;
        const activeEl = document.activeElement;
        const origEl = blockRefs.current[preArrowBlockKey.current];

        // If focus moved to a different block naturally, just sync activeBlock
        let movedToSi = si, movedToBi = bi;
        let focusedKey = null;
        Object.entries(blockRefs.current).forEach(([k, refEl]) => {
          if (refEl && refEl === activeEl) {
            focusedKey = k;
            const parts = k.split("-");
            movedToSi = parseInt(parts[0]);
            movedToBi = parseInt(parts[1]);
          }
        });
        if (focusedKey && focusedKey !== preArrowBlockKey.current) {
          setActiveBlockIfChanged({ si: movedToSi, bi: movedToBi });
          return;
        }
        // Still in same block — check if at boundary
        if (activeEl !== origEl) return;
        const range = sel2.getRangeAt(0);
        if (e.key === "ArrowLeft" && bi > 0) {
          const node = range.startContainer;
          const offset = range.startOffset;
          const atStart = offset === 0 &&
            (node === origEl || node === origEl?.firstChild);
          if (atStart) {
            const prevEl = blockRefs.current[getKey(si, bi - 1)];
            if (prevEl) {
              prevEl.focus();
              const r = document.createRange();
              r.selectNodeContents(prevEl);
              r.collapse(false);
              sel2.removeAllRanges(); sel2.addRange(r);
              setActiveBlockIfChanged({ si, bi: bi - 1 });
            }
          }
        } else if (e.key === "ArrowRight" && bi < len - 1) {
          const textLen = origEl?.textContent?.length || 0;
          const node = range.endContainer;
          const offset = range.endOffset;
          const atEnd = (node === origEl && offset >= textLen) ||
            (node === origEl?.lastChild && offset >= (origEl?.lastChild?.textContent?.length || 0));
          if (atEnd) {
            const nextEl = blockRefs.current[getKey(si, bi + 1)];
            if (nextEl) {
              nextEl.focus();
              const r = document.createRange();
              r.selectNodeContents(nextEl);
              r.collapse(true);
              sel2.removeAllRanges(); sel2.addRange(r);
              setActiveBlockIfChanged({ si, bi: bi + 1 });
            }
          }
        }
      });
      return;
    }

    // ── Existing handlers ──────────────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && TYPE_SHORTCUTS[e.key]) {
      handleTypeShortcut(e, si, bi, block, TYPE_SHORTCUTS[e.key]);
      return;
    }
    if (e.key === "Tab") {
      handleTabKey(e, si, bi, block);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";
      if (!txt.trim() && canCreateSceneFromEmptyBlock(block) && createSceneAfterBlock(si, bi)) return;
      let next = ENTER_NEXT_TYPE[block.type] || "Action";
      if (block.type === "Dialogue") next = "Action";
      addBlock(si, bi, next);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";
      if (!txt.trim() && len > 1) { e.preventDefault(); deleteBlock(si, bi, len); return; }
    }
  }, [editingScenes, characterAutocomplete, addBlock, deleteBlock, setActiveBlockIfChanged, createSceneAfterBlock, handleTabKey, handleTypeShortcut, handleVerticalArrowKey, handleMultiBlockSelectionDelete]);

  useEffect(() => {
    if (!isEditMode) return undefined;

    const handleDocumentSelectionDelete = (event) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const activeEl = document.activeElement;
      if (activeEl?.closest?.("input, textarea, select, [role='dialog']")) return;
      const selection = window.getSelection();
      const root = scriptContentRef.current;
      const hasPendingSelection = Boolean(pendingSelectionDeleteRef.current);

      if (!root) return;

      if (!hasPendingSelection) {
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!root.contains(range.startContainer) && !root.contains(range.endContainer)) return;
      }

      if (handleMultiBlockSelectionDelete()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleDocumentSelectionDelete, true);
    return () => window.removeEventListener("keydown", handleDocumentSelectionDelete, true);
  }, [isEditMode, handleMultiBlockSelectionDelete]);

  const handleHeadingKeyDown = useCallback((e, si) => {
    const selection = window.getSelection();
    if ((e.key === "Backspace" || e.key === "Delete") && selection && !selection.isCollapsed) {
      if (handleMultiBlockSelectionDelete()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      handleVerticalArrowKey(e, { si, kind: "heading" });
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      redo();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const firstBlock = blockRefs.current[getKey(si, 0)];
      if (firstBlock) firstBlock.focus();
    }
  }, [handleMultiBlockSelectionDelete, handleVerticalArrowKey]);

  const renderTagged = (text, si, bi, block) => {
    if (block?.formatting) { const fmt = formatElementText(block); if (React.isValidElement(fmt)) return fmt; }
    return text.split(/(\s+)/).map((word, wi) => {
      if (!word.trim()) return word;
      const scene = scenesToRender[si];
      const clean = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
      // UUID-based lookup (new format) then legacy positional fallback
      const uuidId = scene?.id ? `${scene.id}-${bi}-${wi}` : null;
      const legacyId = `${si}-${bi}-${wi}`;
      const tagEntry =
        (uuidId && instanceLookup.get(uuidId)) || instanceLookup.get(legacyId);
      const tagged = tagEntry?.item;
      const tagKey = tagEntry?.key;
      const isTag = Boolean(tagged);
      const isPhraseTag = isTag && (tagEntry?.groupLength || tagEntry?.phraseLength || 1) > 1;
      const phraseIndex = tagEntry?.groupIndex ?? 0;
      const phraseLength = tagEntry?.groupLength || tagEntry?.phraseLength || 1;
      return (
        <span key={wi}
          data-word={word}
          data-clean-word={clean}
          data-scene-index={si}
          data-block-index={bi}
          data-word-index={wi}
          data-instance-id={uuidId || legacyId}
          data-tag-key={tagKey || ""}
          data-phrase-length={isPhraseTag ? phraseLength : 1}
          onDoubleClick={(e) => {
            e.preventDefault();
            setShowTagDropdown(
              isTag
                ? { x: e.clientX, y: e.clientY, word, cleanWord: clean, sceneIndex: si, blockIndex: bi, wordIndex: wi, isTagged: true, category: tagged.category, tagKey }
                : { x: e.clientX, y: e.clientY, word, cleanWord: clean, sceneIndex: si, blockIndex: bi, wordIndex: wi, isTagged: false }
            );
          }}
          style={{
            backgroundColor: isTag ? tagged.color : "transparent",
            cursor: "pointer",
            padding: isTag ? "1px 2px" : 0,
            borderTopLeftRadius: isPhraseTag && phraseIndex > 0 ? 0 : (isTag ? "2px" : 0),
            borderBottomLeftRadius: isPhraseTag && phraseIndex > 0 ? 0 : (isTag ? "2px" : 0),
            borderTopRightRadius: isPhraseTag && phraseIndex < phraseLength - 1 ? 0 : (isTag ? "2px" : 0),
            borderBottomRightRadius: isPhraseTag && phraseIndex < phraseLength - 1 ? 0 : (isTag ? "2px" : 0),
            boxShadow: isPhraseTag ? `inset 0 -1px 0 ${tagged.color}` : "none",
          }}
        >{word}</span>
      );
    });
  };

  const viewerPagination = useMemo(() => calculateViewerPagination(scenesToRender), [scenesToRender]);
  const pageBreakKeys = viewerPagination.pageBreakKeys;

  useEffect(() => {
    onPageStatsChange?.(viewerPagination.pageStatsBySceneId);
  }, [onPageStatsChange, viewerPagination.pageStatsBySceneId]);

  // Revision view
  if (viewingRevision) {
    const round = committedRounds?.find(r => r.id === viewingRevision);
    if (!round) return <div style={{ padding: "40px", color: "#999" }}>Revision not found.</div>;
    const roundTextColor = round.round_color_text || "#cc0000";
    const affected = new Set((round.changes || []).map(c => c.scene_number));
    return (
      <div style={{ fontFamily: "Courier New, monospace", fontSize: "12pt" }}>
        <div style={{ backgroundColor: round.round_color, padding: "10px 16px", borderRadius: "4px", marginBottom: "24px", textAlign: "center", fontWeight: "bold", fontSize: "14px", color: roundTextColor, border: "1px solid rgba(0,0,0,0.1)" }}>
          {round.round_name} — {round.round_color_name} Pages
        </div>
        {scenes.filter(s => affected.has(s.sceneNumber)).map((scene, si) => {
          const sceneChanges = (round.changes || []).filter(c => c.scene_number === scene.sceneNumber);
          const changedIdx = new Set(sceneChanges.map(c => c.block_index));
          return (
            <div key={scene.id || `${scene.sceneNumber}-${si}`} style={{ marginBottom: "48pt" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px", marginBottom: "12pt" }}>{getSceneDisplayLabel(scene, displayLabelMap)}: {scene.heading}</div>
              {scene.content.map((block, bi) => {
                const style = getProductionElementStyle(
                  block.type,
                  scene.content?.[bi - 1]?.type || null,
                  scene.content?.[bi + 1]?.type || null
                );
                const change = sceneChanges.find(c => c.block_index === bi);
                const changed = changedIdx.has(bi);
                return (
                  <div key={bi} style={{ position: "relative" }}>
                    {changed && <span style={{ position: "absolute", right: "-28px", top: 0, color: roundTextColor, fontWeight: "bold", fontSize: "16px", lineHeight: 1 }}>*</span>}
                    {changed && change?.old_text && <div style={{ ...style, color: "#aaa", textDecoration: "line-through", marginBottom: "2px" }}>{change.old_text}</div>}
                    <div style={{ ...style, color: changed ? roundTextColor : (style.color || "inherit") }}>{block.text}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  let pageLabel = 1;
  const PB_STYLE = { borderTop: "2px dashed #ccc", margin: "24pt 0", paddingTop: "12pt", fontSize: "10pt", color: "#999", textAlign: "right" };
  const PB_PROPS = { style: PB_STYLE, "data-breakdown-page-break": "true" };

  return (
    <div ref={scriptContentRef} onMouseDownCapture={handleSelectionMouseDownCapture} onContextMenu={handleContextMenu}>
      {scenesToRender.map((scene, si) => {
        const statusPresentation = getSceneStatusColor(scene.sceneNumber);
        const isInserted = Boolean(scene.metadata?.replacementLetter);
        const rowPresentation = getSceneRowPresentation(scene, { status: statusPresentation.statusLabel });
        const sceneColor = rowPresentation.customColor;
        const headingBackgroundColor = rowPresentation.hasStatus
          ? rowPresentation.status.backgroundColor
          : sceneColor.background || "transparent";
        const headingPadding = headingBackgroundColor !== "transparent" ? "4px 8px" : 0;
        if (pageBreakKeys.has(`scene-${si}`)) pageLabel++;
        return (
          <React.Fragment key={`scene-${scene.id || `${scene.sceneNumber}-${si}`}`}>
            {pageBreakKeys.has(`scene-${si}`) && <div {...PB_PROPS}>Page {pageLabel}</div>}
            <div ref={el => { sceneRefs.current[si] = el; }} data-scene-index={si} style={{ marginTop: si === 0 ? 0 : "24pt", paddingTop: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "24pt", borderLeft: isInserted ? "3px solid #fbbf24" : undefined, paddingLeft: isInserted ? "6px" : undefined }}>
              {sceneColor.hasCustomColor && (
                <span title={`${sceneColor.label} custom scene color`} style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: sceneColor.swatch, border: `1px solid ${sceneColor.border}`, flexShrink: 0, alignSelf: "center" }} />
              )}
              {isEditMode ? (
                <h2
  style={{
    marginBottom: 0,
    fontSize: "12pt",
    fontFamily: "Courier New, monospace",
    fontWeight: "bold",
    textTransform: "uppercase",
    backgroundColor: headingBackgroundColor,
    padding: headingPadding,
    borderRadius: headingBackgroundColor !== "transparent" ? "4px" : 0,
    boxShadow: sceneColor.hasCustomColor && !rowPresentation.hasStatus ? `inset 0 -2px 0 ${sceneColor.border}` : "none",
    display: "inline-flex",
    alignItems: "baseline",
    gap: "4px",
    outline: "none",
  }}
>
  <span
    className="script-heading-label"
    contentEditable={false}
    style={{
      userSelect: "text",
      whiteSpace: "pre",
      flexShrink: 0,
    }}
  >
    {getSceneDisplayLabel(scene, displayLabelMap)}:
  </span>
  <span
    ref={el => { sceneHeadingRefs.current[si] = el; }}
    contentEditable
    suppressContentEditableWarning
    className="script-heading-edit"
    onFocus={() => {
      focusedBlockKey.current = null;
      setActiveBlockIfChanged({ si, kind: "heading" });
      setCharacterAutocomplete(null);
    }}
    onBlur={(e) => {
      const nextHeading = e.currentTarget.textContent.trim();
      updateSceneHeading(si, nextHeading);
      onSceneHeadingChange?.(si, nextHeading);
    }}
    onKeyDown={(e) => handleHeadingKeyDown(e, si)}
    style={{
      display: "inline-block",
      outline: "none",
      cursor: "text",
      minWidth: "1ch",
      whiteSpace: "pre-wrap",
    }}
  >
    {scene.heading || ""}
  </span>
</h2>
              ) : (
                <h2 style={{ marginBottom: 0, fontSize: "12pt", fontFamily: "Courier New, monospace", fontWeight: "bold", textTransform: "uppercase", backgroundColor: headingBackgroundColor, padding: headingPadding, borderRadius: headingBackgroundColor !== "transparent" ? "4px" : 0, boxShadow: sceneColor.hasCustomColor && !rowPresentation.hasStatus ? `inset 0 -2px 0 ${sceneColor.border}` : "none", display: "inline-block" }}>
                  {getSceneDisplayLabel(scene, displayLabelMap)}: {scene.heading}
                </h2>
              )}
            </div>
              {scene.content.map((block, bi) => {
                if (pageBreakKeys.has(`${si}-${bi}`)) pageLabel++;
                const style = getProductionElementStyle(
                  block.type,
                  scene.content?.[bi - 1]?.type || null,
                  scene.content?.[bi + 1]?.type || null
                );
                const key = getKey(si, bi);
                const isActiveEditingBlock = isEditMode && activeBlock?.si === si && activeBlock?.bi === bi;
                const indicatorLabel = ELEMENT_TYPE_INDICATORS[block.type] || "";
                return (
                  <React.Fragment key={bi}>
                    {pageBreakKeys.has(`${si}-${bi}`) && <div {...PB_PROPS}>Page {pageLabel}</div>}
                    {isEditMode ? (
                      <div style={{ position: "relative" }}>
                        {isActiveEditingBlock && indicatorLabel && (
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              left: "-22px",
                              top: "1px",
                              width: "15px",
                              height: "15px",
                              lineHeight: "15px",
                              textAlign: "center",
                              borderRadius: "3px",
                              backgroundColor: "rgba(0,138,252,0.1)",
                              color: "#2196F3",
                              border: "1px solid rgba(0,138,252,0.28)",
                              fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
                              fontSize: "9px",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            {indicatorLabel}
                          </span>
                        )}
                        <div
                          ref={el => {
                            blockRefs.current[key] = el;
                            if (el && focusedBlockKey.current !== key && el.textContent !== (block.text || "")) {
                              el.textContent = block.text || "";
                            }
                          }}
                          contentEditable suppressContentEditableWarning
                          className="script-edit-block"
                          onFocus={() => {
                            focusedBlockKey.current = key;
                            setActiveBlockIfChanged({ si, bi });
                            if (block.type !== "Character") setCharacterAutocomplete(null);
                          }}
                          onBlur={(e) => {
                            const text = e.currentTarget.textContent;
                            focusedBlockKey.current = null;
                            flushTextSnapshot(si, bi, text);
                            updateBlockText(si, bi, text);
                          }}
                          onInput={(e) => {
                            const text = e.currentTarget.textContent;
                            syncBlockTextFromInput(si, bi, text);
                            if (block.type === "Character") {
                              updateCharacterAutocomplete(si, bi, text);
                            } else {
                              setCharacterAutocomplete(null);
                            }
                          }}
                          onKeyDown={(e) => handleKeyDown(e, si, bi, scene.content.length)}
                          style={{ ...style, minHeight: "14pt", backgroundColor: style.backgroundColor || "transparent", borderRadius: "2px" }}
                        />
                        {characterAutocomplete?.si === si && characterAutocomplete?.bi === bi && characterAutocomplete.suggestions.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: style.marginLeft || 0,
                              top: "18pt",
                              zIndex: 1200,
                              minWidth: "180px",
                              maxWidth: "280px",
                              backgroundColor: "white",
                              border: "1px solid #d0d0d0",
                              borderRadius: "4px",
                              boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
                              fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
                              fontSize: "12px",
                              overflow: "hidden",
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
                                  padding: "6px 9px",
                                  cursor: "pointer",
                                  backgroundColor: index === characterAutocomplete.selectedIndex ? "#E3F2FD" : "white",
                                  color: "#222",
                                  fontWeight: index === characterAutocomplete.selectedIndex ? "bold" : "normal",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={style}>{block.formatting ? formatElementText(block) : renderTagged(block.text, si, bi, block)}</div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </React.Fragment>
        );
      })}
      {/* ── Right-click contextual tagging menu ─────────────────────────── */}
      {showContextMenu && (
        <>
          {/* Backdrop — outside click closes menu */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 1099 }}
            onClick={() => setShowContextMenu(null)}
          />
          {/* Menu panel */}
          <div
            style={{
              position: "fixed",
              left: showContextMenu.x,
              top: showContextMenu.y,
              zIndex: 1100,
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              minWidth: "180px",
              overflow: "hidden",
              fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
              fontSize: "13px",
            }}
          >
            {/* Selected text preview */}
            <div
              style={{
                padding: "6px 12px 5px",
                fontSize: "11px",
                color: "#999",
                borderBottom: "1px solid #f0f0f0",
                fontStyle: "italic",
                maxWidth: "220px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {`"${showContextMenu.selectedText.length > 40 ? showContextMenu.selectedText.slice(0, 40) + "…" : showContextMenu.selectedText}"`}
            </div>
            {showContextMenu.phase === "menu" ? (
              <>
                <div
                  onClick={() => setShowContextMenu(prev => ({ ...prev, phase: "categories" }))}
                  style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                >
                  {showContextMenu.tagKey ? "Add Another Tag" : "Tag Selection"}
                </div>
                {showContextMenu.tagKey && (
                  <div
                    onClick={() => {
                      untagWordInstance(
                        showContextMenu.tagKey,
                        showContextMenu.sceneIndex,
                        showContextMenu.blockIndex,
                        showContextMenu.wordIndex
                      );
                      setShowContextMenu(null);
                    }}
                    style={{ padding: "8px 12px", cursor: "pointer", color: "#c62828", borderBottom: "1px solid #f0f0f0" }}
                  >
                    Remove Tag{showContextMenu.category ? ` (${showContextMenu.category})` : ""}
                  </div>
                )}
                {showContextMenu.tagKey && (
                  <div
                    style={{ padding: "8px 12px", color: "#bbb", cursor: "not-allowed", borderBottom: "1px solid #f0f0f0" }}
                  >
                    Change Category <span style={{ fontSize: "10px" }}>(coming soon)</span>
                  </div>
                )}
                {showContextMenu.tagKey && isPropTagCategory(showContextMenu.category) && (
                  <div
                    title="The Props detail modal is currently owned by the Props module and is not exposed to Script."
                    style={{ padding: "8px 12px", color: "#bbb", cursor: "not-allowed", borderBottom: "1px solid #f0f0f0" }}
                  >
                    View Prop <span style={{ fontSize: "10px" }}>(coming soon)</span>
                  </div>
                )}
                <div
                  onClick={() => setShowContextMenu(null)}
                  style={{ padding: "8px 12px", cursor: "pointer", color: "#888" }}
                >
                  Cancel
                </div>
              </>
            ) : (
              tagCategories.map((cat, i) => (
                <div
                  key={i}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tagWord(showContextMenu.selectedText, cat.name);
                    setShowContextMenu(null);
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: i < tagCategories.length - 1 ? "1px solid #f0f0f0" : "none",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div style={{ width: "12px", height: "12px", backgroundColor: cat.color, marginRight: "8px", borderRadius: "2px", flexShrink: 0 }} />
                  {cat.name}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}, (prev, next) => (
  prev.scenes === next.scenes &&
  prev.editingScenes === next.editingScenes &&
  prev.isEditMode === next.isEditMode &&
  prev.activeBlock === next.activeBlock &&
  prev.viewingRevision === next.viewingRevision &&
  prev.committedRounds === next.committedRounds &&
  prev.taggedItems === next.taggedItems &&
  prev.characters === next.characters &&
  prev.onPageStatsChange === next.onPageStatsChange &&
  prev.showTagDropdown === next.showTagDropdown
));

// ─── Script (Main) ────────────────────────────────────────────────────────────
function Script({
  scenes, currentIndex, setCurrentIndex, setScenes, saveScenesDatabase,
  handleFileUpload, handleSingleSceneUpload, taggedItems, tagCategories,
  showTagDropdown, setShowTagDropdown, tagWord, untagWordInstance,
  isWordInstanceTagged, onSceneNumberChange, stripboardScenes,
  userRole, canEdit, isViewOnly, selectedProject, user,
  characters = {},
  setCharacters = null,
  syncCharactersToDatabase = null,
  setStripboardScenes = null,
	  syncStripboardScenesToDatabase = null,
	  onScenesReordered = null,
	  onAlert = null,
	  onConfirm = null,
	}) {
	  const [isEditMode,       setIsEditMode]       = useState(false);
  const [editingScenes,    setEditingScenes]    = useState([]);
  const [originalContent,  setOriginalContent]  = useState({});
  const [activeBlock,      setActiveBlock]      = useState(null);
  const [isSaving,         setIsSaving]         = useState(false);
  const [committedRounds,  setCommittedRounds]  = useState([]);
  const [pendingRecord,    setPendingRecord]    = useState(null);
  const [showRevisionModal,setShowRevisionModal]= useState(false);
  const [viewingRevision,  setViewingRevision]  = useState(null);
  const [showReplaceDialog,setShowReplaceDialog]= useState(false);
  const [replaceTargetIdx, setReplaceTargetIdx] = useState(null);
  const [currentSceneNumber,setCurrentSceneNumber] = useState(scenes[0]?.sceneNumber || null);
  const [editingSceneIndex, setEditingSceneIndex] = useState(null);
  const [scriptHeadingForm, setScriptHeadingForm] = useState({ intExt: "INT.", location: "", timeOfDay: "DAY", modifier: "" });
  const [pendingInsertIndex, setPendingInsertIndex] = useState(null);
  const [showInsertSourceModal, setShowInsertSourceModal] = useState(false);
  const [viewerPageStatsBySceneId, setViewerPageStatsBySceneId] = useState({});
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  const autoSaveTimerRef = useRef(null);
  const lastAutoSavePayloadRef = useRef("");
  const lastViewerPageStatsPayloadRef = useRef("");

  const sceneRefs       = useRef([]);
  const containerRef    = useRef(null);
  const observerRef     = useRef(null);
  const uploadInputRef  = useRef(null);
  const replaceInputRef = useRef(null);

  const isProductionMode = true;
  const isScriptEditable = isEditMode;
  const exportScenes = useMemo(
    () => (isScriptEditable ? editingScenes : normalizeCharacterContinuationMarkers(scenes)),
    [editingScenes, isScriptEditable, scenes]
  );

  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);

  const showScriptAlert = useCallback((message) => {
	    if (onAlert) return onAlert(message);
	    return Promise.resolve(true);
	  }, [onAlert]);

	  const showScriptConfirm = useCallback((message, confirmLabel = "OK", cancelLabel = "Cancel") => {
	    if (onConfirm) return onConfirm(message, confirmLabel, cancelLabel);
	    return Promise.resolve(false);
	  }, [onConfirm]);

  const handleViewerPageStatsChange = useCallback((nextStats) => {
    const payload = JSON.stringify(nextStats || {});
    if (payload === lastViewerPageStatsPayloadRef.current) return;
    lastViewerPageStatsPayloadRef.current = payload;
    setViewerPageStatsBySceneId(nextStats || {});
  }, []);

  const handleExportBreakdownPdf = useCallback(async () => {
    if (!exportScenes.length) return;
    setIsPdfExporting(true);
    try {
      const projectName = (selectedProject?.name || "Script").replace(/[^a-zA-Z0-9\-]/g, "_");
      await exportBreakdownScriptToPdf(exportScenes, `${projectName}-ScriptBreakdown.pdf`);
    } finally {
      setIsPdfExporting(false);
    }
  }, [exportScenes, selectedProject]);

	  const getProjectStorageKey = useCallback((key) => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `${key}:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const loadRevisions = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const { data, error } = await supabase.from("script_revisions").select("*").eq("project_id", selectedProject.id).order("created_at", { ascending: true });
      if (error) throw error;
      setPendingRecord(data?.find(r => r.is_pending) || null);
      setCommittedRounds(data?.filter(r => !r.is_pending) || []);
    } catch (err) { console.error("Error loading revisions:", err); }
  }, [selectedProject]);

  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  useEffect(() => {
    if (editingSceneIndex === null) return;
    const handleSceneDetailKeyDown = (e) => {
      if (e.key === "Escape") setEditingSceneIndex(null);
    };
    window.addEventListener("keydown", handleSceneDetailKeyDown);
    return () => window.removeEventListener("keydown", handleSceneDetailKeyDown);
  }, [editingSceneIndex]);

  // Sync heading form fields from scene metadata whenever a different scene is opened.
  // Intentionally excludes `scenes` so in-progress edits are not reset by background scene updates.
  useEffect(() => {
    if (editingSceneIndex === null) return;
    const s = scenes[editingSceneIndex];
    if (!s) return;
    setScriptHeadingForm({
      intExt: s.metadata?.intExt || "INT.",
      location: s.metadata?.location || "",
      timeOfDay: s.metadata?.timeOfDay || s.manualTimeOfDay || "DAY",
      modifier: s.metadata?.modifier || "",
    });
  }, [editingSceneIndex]); // intentionally excludes `scenes` — preserves in-progress edits

  useEffect(() => {
    if (!showInsertSourceModal) return;
    const handleInsertSourceKeyDown = (e) => {
      if (e.key === "Escape") { setShowInsertSourceModal(false); setPendingInsertIndex(null); }
    };
    window.addEventListener("keydown", handleInsertSourceKeyDown);
    return () => window.removeEventListener("keydown", handleInsertSourceKeyDown);
  }, [showInsertSourceModal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || scenes.length === 0) return;

    let rafId = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const containerTop = container.getBoundingClientRect().top;
        let activeIdx = 0;
        sceneRefs.current.forEach((el, idx) => {
          if (!el) return;
          const elTop = el.getBoundingClientRect().top - containerTop;
          if (elTop <= 50) activeIdx = idx;
        });
        if (scenes[activeIdx]) {
          setCurrentSceneNumber(scenes[activeIdx].sceneNumber);
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [scenes]);

  useEffect(() => {
    if (!isEditMode || !editingScenes.length) return;

    const payload = JSON.stringify(editingScenes);
    if (payload === lastAutoSavePayloadRef.current) return;

    clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const normalizedScenes = normalizeSceneIds(editingScenes);
        await saveScenesDatabase(normalizedScenes);
        setScenes(normalizedScenes);
        await syncWritingModeCharacters(normalizedScenes);
        lastAutoSavePayloadRef.current = payload;
      } catch (err) {
        console.error("Production autosave failed:", err);
      }
    }, 15000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [isEditMode, editingScenes, saveScenesDatabase, setScenes]);

  const enterEditMode = () => {
    const copy = scenes.map(s => ({ ...s, content: s.content.map(b => ({ ...b })) }));
    const origMap = {};
    scenes.forEach(s => { origMap[s.sceneNumber] = s.content.map(b => ({ ...b })); });
    setEditingScenes(copy); setOriginalContent(origMap); setActiveBlock(null); setIsEditMode(true);
  };

  const cancelEditMode = () => { setIsEditMode(false); setEditingScenes([]); setActiveBlock(null); };

  const getSceneEstimatedPageLength = (scene) => {
    if (!scene || !Array.isArray(scene.content)) return 0.125;

    const lines = 3 + scene.content.reduce((sum, block) => {
      return sum + calculateBlockLines(block);
    }, 0);

    return Math.max(0.125, lines / LINES_PER_PAGE);
  };

  const getNextSceneNumber = (sceneList) => {
    const numericSceneNumbers = sceneList
      .map(scene => parseInt(scene.sceneNumber, 10))
      .filter(Number.isFinite);

    if (numericSceneNumbers.length === 0) return 1;

    return Math.max(...numericSceneNumbers) + 1;
  };

  const normalizeSceneIds = (sceneList = []) => {
    return sceneList.map(scene => {
      if (isValidSceneId(scene?.id)) return scene;
      return { ...scene, id: createSceneId() };
    });
  };

  const reflowScenesSequentially = (sceneList = []) => {
    let nextTimelineStartPage = 0;
    return normalizeSceneIds(sceneList.map((scene, index) => {
      const reflowedScene = {
        ...scene,
        sceneNumber: index + 1,
        timelineStartPage: nextTimelineStartPage,
        metadata: { ...(scene.metadata || {}) },
        content: Array.isArray(scene.content) ? scene.content.map(block => ({ ...block })) : [],
      };
      nextTimelineStartPage += getSceneEstimatedPageLength(reflowedScene);
      return reflowedScene;
    }));
  };

  const buildOriginalContentMap = (sceneList = []) => {
    const contentMap = {};
    sceneList.forEach(scene => {
      contentMap[scene.sceneNumber] = Array.isArray(scene.content)
        ? scene.content.map(block => ({ ...block }))
        : [];
    });
    return contentMap;
  };

  const syncLocalStripboardFromScenes = (sceneList = []) => {
    if (!setStripboardScenes) return;

    setStripboardScenes(prevStripboardScenes => {
      const existingStripboardScenes = Array.isArray(prevStripboardScenes) ? prevStripboardScenes : [];

      return sceneList.map(scene => {
        const existing =
          existingStripboardScenes.find(stripScene => stripScene.sceneId && scene.id && String(stripScene.sceneId) === String(scene.id)) ||
          existingStripboardScenes.find(stripScene => stripScene.id && scene.id && String(stripScene.id) === String(scene.id)) ||
          existingStripboardScenes.find(stripScene => String(stripScene.sceneNumber) === String(scene.sceneNumber));

        return {
          ...scene,
          sceneId: scene.id || existing?.sceneId || null,
          status: existing?.status || scene.status || "Not Scheduled",
          scheduledDate: existing?.scheduledDate || null,
          scheduledTime: existing?.scheduledTime || null,
        };
      });
    });
  };

  const createBlankScene = (sceneNumber, timelineStartPage = 0) => ({
    id: createSceneId(),
    sceneNumber,
    heading: "",
    timelineStartPage,
    estimatedDuration: "30 min",
    status: "Not Scheduled",
    metadata: {},
    content: [
      {
        type: "Action",
        text: "",
        formatting: null,
      },
    ],
  });


  const handleCreateSceneAfter = useCallback((sceneIndex, blockIndex) => {
    const baseScenes = isScriptEditable ? editingScenes : scenes;
    const insertAfterIndex = Math.max(0, Math.min(sceneIndex, baseScenes.length - 1));
    const sourceScene = baseScenes[insertAfterIndex];
    if (!sourceScene) return;

    const nextSceneNumber = getNextSceneNumber(baseScenes);
    const sourceStartPage = Number.isFinite(Number(sourceScene.timelineStartPage))
      ? Number(sourceScene.timelineStartPage)
      : 0;
    const timelineStartPage = Math.min(
      Math.max(0, sourceStartPage + getSceneEstimatedPageLength(sourceScene)),
      89
    );
    const newScene = createBlankScene(nextSceneNumber, timelineStartPage);
    // The block at blockIndex triggered scene creation (it was empty). Remove it
    // from the source scene so it does not appear as an orphan Action line.
    const rawSourceContent = Array.isArray(sourceScene.content) ? sourceScene.content : [];
    const filteredSourceContent = rawSourceContent.filter((_, i) => i !== blockIndex);
    const safeSourceContent =
      filteredSourceContent.length > 0
        ? filteredSourceContent.map((b) => ({ ...b }))
        : [{ type: "Action", text: "", formatting: null }];
    const normalizedSourceScene = { ...sourceScene, content: safeSourceContent };
    const updatedScenes = normalizeSceneIds([
      ...baseScenes.slice(0, insertAfterIndex + 1),
      newScene,
      ...baseScenes.slice(insertAfterIndex + 1),
    ].map((scene, index) => index === insertAfterIndex ? normalizedSourceScene : scene));

    setScenes(updatedScenes);
    syncLocalStripboardFromScenes(updatedScenes);
    setCurrentIndex(insertAfterIndex + 1);
    setCurrentSceneNumber(newScene.sceneNumber);
    setEditingScenes(updatedScenes.map(scene => ({
      ...scene,
      content: Array.isArray(scene.content) ? scene.content.map(block => ({ ...block })) : [],
    })));

    const origMap = {};
    updatedScenes.forEach(scene => {
      origMap[scene.sceneNumber] = Array.isArray(scene.content)
        ? scene.content.map(block => ({ ...block }))
        : [];
    });
    setOriginalContent(origMap);
    setIsEditMode(true);

	    saveScenesDatabase(updatedScenes).catch((err) => {
	      console.error("Error creating scene from writing:", err);
	      void showScriptAlert("Could not create scene: " + err.message);
	    });
	  }, [editingScenes, scenes, isScriptEditable, saveScenesDatabase, setScenes, setCurrentIndex, showScriptAlert]);

  const handleInsertScene = async (insertAtIndex) => {
    const baseScenes = isScriptEditable ? editingScenes : scenes;
    const clampedIdx = Math.max(0, Math.min(insertAtIndex, baseScenes.length));

    const nextSceneNumber = getNextSceneNumber(baseScenes);
    const prevScene = clampedIdx > 0 ? baseScenes[clampedIdx - 1] : null;
    const prevStart = prevScene && Number.isFinite(Number(prevScene.timelineStartPage))
      ? Number(prevScene.timelineStartPage) : 0;
    const timelineStartPage = prevScene
      ? Math.min(Math.max(0, prevStart + getSceneEstimatedPageLength(prevScene)), 89)
      : 0;

    const newScene = {
      ...createBlankScene(nextSceneNumber, timelineStartPage),
      metadata: {
        intExt: "INT.",
        location: "LOCATION",
        timeOfDay: "DAY",
        replacementLetter: "A",
        originalScriptOrder: clampedIdx,
      },
    };

    const splicedScenes = normalizeSceneIds([
      ...baseScenes.slice(0, clampedIdx),
      newScene,
      ...baseScenes.slice(clampedIdx),
    ]);
    const updatedScenes = resequenceInsertedGroupLetters(splicedScenes, clampedIdx);

    setScenes(updatedScenes);
    syncLocalStripboardFromScenes(updatedScenes);
    setCurrentIndex(clampedIdx);
    setCurrentSceneNumber(newScene.sceneNumber);
    setEditingScenes(updatedScenes.map(s => ({
      ...s,
      content: Array.isArray(s.content) ? s.content.map(b => ({ ...b })) : [],
    })));

    const origMap = {};
    updatedScenes.forEach(s => {
      origMap[s.sceneNumber] = Array.isArray(s.content) ? s.content.map(b => ({ ...b })) : [];
    });
    setOriginalContent(origMap);

    try {
      await saveScenesDatabase(updatedScenes);
    } catch (err) {
      console.error("Error inserting scene:", err);
      void showScriptAlert("Could not insert scene: " + err.message);
    }

    setTimeout(() => {
      sceneRefs.current[clampedIdx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleDeleteScene = async (sceneIndex) => {
    const baseScenes = isScriptEditable ? editingScenes : scenes;
    const sceneToDelete = baseScenes[sceneIndex];
    if (!sceneToDelete) return;

	    const confirmed = await showScriptConfirm(`Delete Scene ${getSceneDisplayLabel(sceneToDelete, displayLabelMap)}? This cannot be undone.`, "Delete");
	    if (!confirmed) return;

    const deletedIsInserted = Boolean(sceneToDelete.metadata?.replacementLetter);
    const filteredScenes = baseScenes.filter((_, index) => index !== sceneIndex);

    let resequencedScenes = filteredScenes;
    if (deletedIsInserted) {
      // Find an anchor inside the remaining group around the deletion point.
      // Elements before sceneIndex keep their positions; elements at/after shift left by 1.
      const anchorBefore = sceneIndex - 1;
      const anchorAt = sceneIndex;
      let anchor = -1;
      if (anchorBefore >= 0 && Boolean(filteredScenes[anchorBefore]?.metadata?.replacementLetter)) {
        anchor = anchorBefore;
      } else if (anchorAt < filteredScenes.length && Boolean(filteredScenes[anchorAt]?.metadata?.replacementLetter)) {
        anchor = anchorAt;
      }
      if (anchor >= 0) {
        resequencedScenes = resequenceInsertedGroupLetters(filteredScenes, anchor);
      }
    }

    const updatedScenes = reflowScenesSequentially(resequencedScenes);
    const nextIndex = updatedScenes.length === 0 ? 0 : Math.min(currentIndex >= sceneIndex ? Math.max(0, currentIndex - 1) : currentIndex, updatedScenes.length - 1);

    setScenes(updatedScenes);
    syncLocalStripboardFromScenes(updatedScenes);
    setCurrentIndex(nextIndex);
    setCurrentSceneNumber(updatedScenes[nextIndex]?.sceneNumber || null);
    setEditingScenes(updatedScenes.map(scene => ({
      ...scene,
      content: Array.isArray(scene.content) ? scene.content.map(block => ({ ...block })) : [],
    })));
    setOriginalContent(buildOriginalContentMap(updatedScenes));
    setActiveBlock(null);

    try {
      if (selectedProject?.id) {
        let deleteQuery = supabase
          .from("scenes")
          .delete()
          .eq("project_id", selectedProject.id);

        if (isValidSceneId(sceneToDelete.id)) {
          deleteQuery = deleteQuery.eq("id", sceneToDelete.id);
        } else if (sceneToDelete.sceneNumber !== undefined && sceneToDelete.sceneNumber !== null) {
          deleteQuery = deleteQuery.eq("scene_number", sceneToDelete.sceneNumber);
        } else {
          deleteQuery = null;
        }

        if (deleteQuery) {
          const { error } = await deleteQuery;
          if (error) throw error;
        }
      }

      await saveScenesDatabase(updatedScenes);
	    } catch (err) {
	      console.error("Error deleting scene:", err);
	      void showScriptAlert("Could not delete scene: " + err.message);
	    }
  };

  const handleSceneListReorder = async (draggedKey, targetKey, position = "before") => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;

    const getSceneReorderKey = (scene, index) => {
      return `${scene?.id || scene?.sceneId || scene?.sceneNumber || "scene"}-${index}`;
    };
    const baseScenes = isScriptEditable ? editingScenes : scenes;
    const draggedIndex = baseScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(draggedKey));
    const targetIndex = baseScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(targetKey));
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;

    const currentSceneKey = baseScenes[currentIndex]
      ? getSceneReorderKey(baseScenes[currentIndex], currentIndex)
      : null;
    const nextOrder = [...baseScenes];
    const [draggedScene] = nextOrder.splice(draggedIndex, 1);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) insertIndex -= 1;
    if (position === "after") insertIndex += 1;
    insertIndex = Math.max(0, Math.min(insertIndex, nextOrder.length));
    nextOrder.splice(insertIndex, 0, draggedScene);

    // When dragging an inserted scene, resequence the groups it left and joined
    // so no two scenes in the same derived-label group share the same letter.
    // Normal scenes are never affected (they have no replacementLetter).
    let finalOrder = nextOrder;
    if (Boolean(draggedScene?.metadata?.replacementLetter)) {
      // Resequence the group the dragged scene landed in (A, B, C… by position)
      finalOrder = resequenceInsertedGroupLetters(finalOrder, insertIndex);
      // Resequence the source group if any sibling inserted scenes remain there.
      // After the two splice operations the source area sits at:
      //   draggedIndex + 1  when dragging upward (draggedIndex > targetIndex)
      //   draggedIndex      when dragging downward (draggedIndex < targetIndex)
      const sourceAreaIndex = draggedIndex > targetIndex ? draggedIndex + 1 : draggedIndex;
      if (
        sourceAreaIndex >= 0 &&
        sourceAreaIndex < finalOrder.length &&
        Boolean(finalOrder[sourceAreaIndex]?.metadata?.replacementLetter)
      ) {
        finalOrder = resequenceInsertedGroupLetters(finalOrder, sourceAreaIndex);
      }
    }

    const updatedScenes = reflowScenesSequentially(finalOrder);

    const nextIndex = currentSceneKey
      ? Math.max(0, updatedScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === currentSceneKey))
      : Math.min(currentIndex, updatedScenes.length - 1);
    const safeNextIndex = nextIndex >= 0 ? nextIndex : 0;

    setScenes(updatedScenes);
    syncLocalStripboardFromScenes(updatedScenes);
    setCurrentIndex(safeNextIndex);
    setCurrentSceneNumber(updatedScenes[safeNextIndex]?.sceneNumber || null);
    setEditingScenes(updatedScenes.map(scene => ({
      ...scene,
      content: Array.isArray(scene.content) ? scene.content.map(block => ({ ...block })) : [],
    })));
    setOriginalContent(buildOriginalContentMap(updatedScenes));
    setActiveBlock(null);

    try {
      await saveScenesDatabase(updatedScenes);
      if (onScenesReordered) onScenesReordered(updatedScenes);
      if (!isEditMode) setEditingScenes([]);
	    } catch (err) {
	      console.error("Error saving scene list reorder:", err);
	      void showScriptAlert("Could not reorder scenes: " + err.message);
	    }
  };

  const handleUpdateSceneMetadataField = async (sceneIndex, updates) => {
    const baseScenes = isEditMode ? editingScenes : scenes;
    const targetScene = baseScenes[sceneIndex];
    if (!targetScene) return;
    const updatedScenes = baseScenes.map((scene, idx) =>
      idx !== sceneIndex ? scene : {
        ...scene,
        metadata: { ...(scene.metadata || {}), ...updates },
      }
    );
    setScenes(updatedScenes);
    setEditingScenes(updatedScenes.map(s => ({
      ...s,
      content: Array.isArray(s.content) ? s.content.map(b => ({ ...b })) : [],
    })));
    try {
      await saveScenesDatabase(updatedScenes);
    } catch (err) {
      console.error("Error updating scene metadata:", err);
      void showScriptAlert("Could not save scene metadata: " + err.message);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
      await new Promise(r => setTimeout(r, 50));
    }
    setIsSaving(true);
    try {
      const diffs = [];
      editingScenes.forEach(scene => {
        const orig = originalContent[scene.sceneNumber] || [];
        scene.content.forEach((block, bi) => {
          const oldText = orig[bi]?.text || "";
          const newText = block.text || "";
          if (oldText !== newText) diffs.push({ scene_number: scene.sceneNumber, block_index: bi, block_type: block.type, old_text: oldText, new_text: newText, timestamp: new Date().toISOString() });
        });
        for (let bi = orig.length; bi < scene.content.length; bi++) {
          diffs.push({ scene_number: scene.sceneNumber, block_index: bi, block_type: scene.content[bi].type, old_text: "", new_text: scene.content[bi].text || "", timestamp: new Date().toISOString() });
        }
      });
      const normalizedScenes = normalizeSceneIds(editingScenes);
      setScenes(normalizedScenes);
      await saveScenesDatabase(normalizedScenes);
      if (diffs.length > 0) await savePendingDiffs(diffs);
      const newOrig = {};
      normalizedScenes.forEach(s => { newOrig[s.sceneNumber] = s.content.map(b => ({ ...b })); });
      setOriginalContent(newOrig);
      setIsEditMode(false); setActiveBlock(null);
	    } catch (err) { console.error("Save error:", err); void showScriptAlert("Save failed: " + err.message); }
    finally { setIsSaving(false); }
  };

  const savePendingDiffs = async (newDiffs) => {
    try {
      if (pendingRecord) {
        const merged = [...(pendingRecord.changes || []), ...newDiffs];
        const { data, error } = await supabase.from("script_revisions").update({ changes: merged }).eq("id", pendingRecord.id).select().single();
        if (error) throw error;
        setPendingRecord(data);
      } else {
        const { data, error } = await supabase.from("script_revisions").insert({ project_id: selectedProject.id, round_number: 0, round_name: "Pending", round_color: "#FFFFFF", is_pending: true, created_by: user?.id, changes: newDiffs }).select().single();
        if (error) throw error;
        setPendingRecord(data);
      }
    } catch (err) { console.error("Error saving pending diffs:", err); }
  };

  const handleCommitRevision = async (recordId, roundNumber, roundName, colorObj) => {
    try {
      const { error } = await supabase.from("script_revisions").update({ is_pending: false, round_number: roundNumber, round_name: roundName, round_color: colorObj.hex, round_color_name: colorObj.name, round_color_text: colorObj.textHex }).eq("id", recordId);
      if (error) throw error;
      await loadRevisions();
      setShowRevisionModal(false);
	    } catch (err) { console.error("Revision commit error:", err); void showScriptAlert("Error creating revision round: " + err.message); }
  };

  const handleRevert = async () => {
    if (!pendingRecord) return;
	    if (!await showScriptConfirm("Revert all pending changes? The script will be restored to its state before these changes were saved.", "Revert")) return;
    try {
      const revertedScenes = scenes.map(scene => {
        const changes = (pendingRecord.changes || []).filter(c => c.scene_number === scene.sceneNumber);
        if (changes.length === 0) return scene;
        const content = [...scene.content];
        changes.forEach(ch => {
          if (content[ch.block_index]) content[ch.block_index] = { ...content[ch.block_index], text: ch.old_text };
        });
        return { ...scene, content };
      });
      setScenes(revertedScenes);
      await saveScenesDatabase(revertedScenes);
      const { error } = await supabase.from("script_revisions").delete().eq("id", pendingRecord.id);
      if (error) throw error;
      setPendingRecord(null);
	    } catch (err) { console.error("Revert error:", err); void showScriptAlert("Revert failed: " + err.message); }
  };

  const handleReplaceConfirm = () => {
    if (replaceTargetIdx === null) return;
    setCurrentIndex(replaceTargetIdx);
    setShowReplaceDialog(false);
    setTimeout(() => { replaceInputRef.current?.click(); }, 50);
  };

  const handleReplaceFile = (e) => {
    if (e.target.files[0]) {
      handleSingleSceneUpload(e.target.files[0]);
      e.target.value = "";
      setReplaceTargetIdx(null);
    }
  };

  const getSceneStatusColor = (sceneNumber) => {
    const s = stripboardScenes?.find(s => s.sceneNumber === sceneNumber);
    return getSceneStatusPresentation(s?.status || "Not Scheduled");
  };

  const handleToolbarTypeChange = (si, bi, newType) => {
    setEditingScenes(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : { ...b, type: newType, text: newType === "Character" ? b.text.toUpperCase() : b.text }) }
    ));
  };

  const handleSceneHeadingChange = async (sceneIndex, rawHeading) => {
    const nextHeading = String(rawHeading || "").trim().toUpperCase();
    if (!nextHeading) return;

    const baseScenes = isScriptEditable ? editingScenes : scenes;
    const targetScene = baseScenes[sceneIndex];
    if (!targetScene) return;

    const nextMetadata = parseSceneHeading(nextHeading);
    const sceneNumber = targetScene.sceneNumber;

    const patchScene = (scene) =>
      String(scene.sceneNumber) !== String(sceneNumber)
        ? scene
        : {
            ...scene,
            heading: nextHeading,
            metadata: {
              ...(scene.metadata || {}),
              ...nextMetadata,
            },
          };

    setEditingScenes(prev =>
      prev.map(patchScene).map(scene => ({
        ...scene,
        content: Array.isArray(scene.content) ? scene.content.map(block => ({ ...block })) : [],
      }))
    );

    setScenes(prev => prev.map(patchScene));

    if (setStripboardScenes) {
      setStripboardScenes(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;

        const index = prev.findIndex(scene => String(scene.sceneNumber) === String(sceneNumber));
        if (index === -1) return prev;

        const next = [...prev];
        next[index] = patchScene(next[index]);

        return next;
      });
    }

    try {
      const parsed = {
        intExt: nextMetadata?.intExt || "",
        location: nextMetadata?.location || "",
        timeOfDay: nextMetadata?.timeOfDay || "",
        modifier: nextMetadata?.modifier || "",
      };

      await supabase.rpc("update_scene_heading", {
        p_project_id: selectedProject.id,
        p_scene_number: String(sceneNumber),
        p_heading: nextHeading,
        p_int_ext: parsed.intExt,
        p_location: parsed.location,
        p_time_of_day: parsed.timeOfDay,
        p_modifier: parsed.modifier,
      });
	    } catch (err) {
	      console.error("Atomic scene heading save failed:", err);
	      void showScriptAlert("Could not save scene heading: " + err.message);
	    }
  };

  const cleanCharacterName = (rawName) => {
    if (!rawName) return null;

    let cleaned = String(rawName).replace(/\s*\([^)]*\)/g, "");
    cleaned = cleaned.replace(/[.,!?;:]$/, "");
    cleaned = cleaned.trim().toUpperCase();

    const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];

    if (cleaned.length < 1 || excludeWords.includes(cleaned)) return null;

    return cleaned;
  };

  const detectCharactersFromScenes = (sceneList = []) => {
    const detectedCharacters = {};
    let characterOrder = 1;

    sceneList.forEach((scene) => {
      (scene.content || []).forEach((block) => {
        if (block.type === "Character") {
          const characterName = cleanCharacterName(block.text);

          if (characterName) {
            if (!detectedCharacters[characterName]) {
              detectedCharacters[characterName] = {
                name: characterName,
                scenes: [],
                chronologicalNumber: characterOrder++,
              };
            }

            if (!detectedCharacters[characterName].scenes.includes(scene.sceneNumber)) {
              detectedCharacters[characterName].scenes.push(scene.sceneNumber);
            }
          }
        }
      });
    });

    sceneList.forEach((scene) => {
      (scene.content || []).forEach((block) => {
        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((characterName) => {
            const regex = new RegExp(`\\b${characterName}\\b`, "i");

            if (regex.test(block.text || "")) {
              if (!detectedCharacters[characterName].scenes.includes(scene.sceneNumber)) {
                detectedCharacters[characterName].scenes.push(scene.sceneNumber);
              }
            }
          });
        }
      });
    });

    return detectedCharacters;
  };

  const syncWritingModeCharacters = async (sceneList = []) => {
    if (!setCharacters || !syncCharactersToDatabase) return;

    const detectedCharacters = detectCharactersFromScenes(sceneList);

    setCharacters(detectedCharacters);

    if (Object.keys(detectedCharacters).length > 0) {
      try {
        await syncCharactersToDatabase(detectedCharacters);
      } catch (err) {
        console.error("Writing mode character sync failed:", err);
      }
    }
  };

  const getSceneCardCharacters = (scene) => {
    if (!scene) return [];

    const sceneNumber = String(scene.sceneNumber);

    const fromCharacters = Object.values(characters || {})
      .filter((character) =>
        (character.scenes || []).some((s) => String(s) === sceneNumber)
      )
      .map((character) => character.name);

    const fromScript = [];

    (scene.content || []).forEach((block) => {
      if (block.type === "Character") {
        const name = cleanCharacterName(block.text);
        if (name) fromScript.push(name);
      }
    });

    return [...new Set([...fromCharacters, ...fromScript])];
  };

  const getSceneCardTaggedItems = (sceneNumber) => {
    const result = {
      props: [],
      makeup: [],
      productionDesign: [],
      wardrobe: [],
      other: [],
    };

    Object.entries(taggedItems || {}).forEach(([word, item]) => {
      const isInScene = (item.scenes || []).some((s) => String(s) === String(sceneNumber));
      if (!isInScene) return;

      const name = item.customTitle || item.displayName || word;
      const category = (item.category || "").toLowerCase().replace(/\s/g, "");

      if (category === "props") result.props.push(name);
      else if (category === "makeup") result.makeup.push(name);
      else if (category === "productiondesign") result.productionDesign.push(name);
      else if (category === "wardrobe") result.wardrobe.push(name);
      else result.other.push(`${item.category || "Item"}: ${name}`);
    });

    return result;
  };

  const displaySceneNumber = currentSceneNumber || scenes[currentIndex]?.sceneNumber;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        {/* Left section — controls stay above Scene Timeline and script viewer */}
        <div
          style={{
            flex: "0 0 calc(8.5in + 520px)",
            width: "calc(8.5in + 520px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              minHeight: "38px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {/* Script-viewer-width column: heading left, buttons right */}
            <div
              style={{
                flex: "0 0 8.5in",
                width: "8.5in",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "5px 12px",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold", flexShrink: 0 }}>SCRIPT BREAKDOWN</h2>

              {isProductionMode && isEditMode && (
                <ElementTypeToolbar activeBlock={activeBlock} editingScenes={editingScenes} onTypeChange={handleToolbarTypeChange} />
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                {scenes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportBreakdownPdf}
                    disabled={isPdfExporting}
                    title="Export Script Breakdown to PDF"
                    style={{ padding: "4px 9px", fontSize: "11px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", color: "#555", cursor: isPdfExporting ? "default" : "pointer", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", opacity: isPdfExporting ? 0.6 : 1, whiteSpace: "nowrap" }}
                  >
                    {isPdfExporting ? "Exporting…" : "Export PDF"}
                  </button>
                )}
                {canEdit && isProductionMode && !isScriptEditable && scenes.length === 0 && (
                  <>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept=".fdx,.pdf,application/pdf"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      style={{ padding: "6px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                    >
                      Upload Script
                    </button>
                  </>
                )}

                {isProductionMode && pendingRecord && !isEditMode && (
                  <>
                    <button onClick={() => setShowRevisionModal(true)} style={{ padding: "6px 14px", backgroundColor: "#FF5722", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>● Pending Changes</button>
                    <button onClick={handleRevert} style={{ padding: "6px 14px", backgroundColor: "#795548", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Revert</button>
                  </>
                )}

                {isProductionMode && committedRounds.length > 0 && !isEditMode && (
                  <select value={viewingRevision || ""} onChange={(e) => setViewingRevision(e.target.value || null)} style={{ padding: "5px 10px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                    <option value="">Current Script</option>
                    {committedRounds.map(r => <option key={r.id} value={r.id}>Rev {r.round_number} — {r.round_name} ({r.round_color_name})</option>)}
                  </select>
                )}

                {canEdit && isProductionMode && !isEditMode && (
                  <button onClick={() => setShowReplaceDialog(true)} style={{ padding: "6px 14px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                    Replace Scene
                  </button>
                )}

                {canEdit && isProductionMode && !isEditMode && (
                  <button onClick={enterEditMode} style={{ padding: "6px 14px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                    Edit
                  </button>
                )}

                {isProductionMode && isEditMode && (
                  <>
                    <button onClick={handleSave} disabled={isSaving} style={{ padding: "6px 18px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", opacity: isSaving ? 0.7 : 1 }}>
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={cancelEditMode} style={{ padding: "6px 18px", backgroundColor: "#F44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                      Cancel
                    </button>
                  </>
                )}

                {isViewOnly && <div style={{ padding: "6px 12px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontWeight: "bold", fontSize: "13px" }}>VIEW ONLY</div>}
              </div>
            </div>
            {/* Spacer matching the scene panel column */}
            <div style={{ flex: 1 }} />
          </div>
        </div>

        {/* Right section reserved for future controls; panel tabs live with the visible side panel. */}
        <div style={{ flex: 1, backgroundColor: "white" }} />
      </div>

      {showRevisionModal && pendingRecord && <RevisionRoundModal pendingRecord={pendingRecord} committedRounds={committedRounds} onCommit={handleCommitRevision} onClose={() => setShowRevisionModal(false)} />}

      {editingSceneIndex !== null && scenes[editingSceneIndex] && (
        <SceneDetailModal
          scene={scenes[editingSceneIndex]}
          displayLabel={getSceneDisplayLabel(scenes[editingSceneIndex], displayLabelMap)}
          onClose={() => setEditingSceneIndex(null)}
          headingForm={scriptHeadingForm}
          onHeadingFormChange={(updates) => setScriptHeadingForm((p) => ({ ...p, ...updates }))}
          onSave={(form) => {
            handleSceneHeadingChange(editingSceneIndex, buildHeadingString(form));
            setEditingSceneIndex(null);
          }}
          isViewOnly={isViewOnly}
          onDelete={!isViewOnly ? () => { const idx = editingSceneIndex; setEditingSceneIndex(null); handleDeleteScene(idx); } : null}
          onInsertBefore={!isViewOnly ? () => { const idx = editingSceneIndex; setEditingSceneIndex(null); setPendingInsertIndex(idx); setShowInsertSourceModal(true); } : null}
          disableInsertBefore={editingSceneIndex === 0}
          onInsertAfter={!isViewOnly ? () => { const idx = editingSceneIndex; setEditingSceneIndex(null); setPendingInsertIndex(idx + 1); setShowInsertSourceModal(true); } : null}
          tagged={getSceneCardTaggedItems(scenes[editingSceneIndex].sceneNumber)}
          sceneCharacters={getSceneCardCharacters(scenes[editingSceneIndex])}
        />
      )}

      {showInsertSourceModal && (
        <>
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex: 21800 }}
            onClick={() => { setShowInsertSourceModal(false); setPendingInsertIndex(null); }}
          />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "360px", maxWidth: "calc(100vw - 40px)", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 21801, fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", padding: "28px" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "17px" }}>Insert Scene</h3>
            <p style={{ margin: "0 0 22px", fontSize: "13px", color: "#666" }}>Choose how to add the new scene.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => { const idx = pendingInsertIndex; setShowInsertSourceModal(false); setPendingInsertIndex(null); handleInsertScene(idx); }}
                style={{ padding: "12px 16px", backgroundColor: "#1e40af", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", textAlign: "left" }}
              >
                Create Blank Scene
              </button>
              <button
                disabled
                title="Coming soon"
                style={{ padding: "12px 16px", backgroundColor: "#f3f4f6", color: "#9ca3af", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "not-allowed", fontSize: "14px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                Import Scene From FDX
                <span style={{ fontSize: "11px", fontWeight: "bold", backgroundColor: "#e5e7eb", color: "#6b7280", borderRadius: "3px", padding: "2px 6px", flexShrink: 0 }}>Coming Soon</span>
              </button>
              <button
                onClick={() => { setShowInsertSourceModal(false); setPendingInsertIndex(null); }}
                style={{ padding: "10px 16px", backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", marginTop: "4px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {showReplaceDialog && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10000 }} onClick={() => { setShowReplaceDialog(false); setReplaceTargetIdx(null); }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 10001, minWidth: "440px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Replace Scene</h3>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>SELECT SCENE TO REPLACE</div>
              <select
                value={replaceTargetIdx ?? ""}
                onChange={(e) => setReplaceTargetIdx(e.target.value === "" ? null : parseInt(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace" }}
              >
                <option value="">Choose a scene…</option>
                {scenes.map((scene, idx) => (
                  <option key={idx} value={idx}>{getSceneDisplayLabel(scene, displayLabelMap)} – {scene.heading}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginBottom: "20px" }}>You'll be prompted to select the .fdx file after confirming.</div>
            <input ref={replaceInputRef} type="file" accept=".fdx" onChange={handleReplaceFile} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleReplaceConfirm}
                disabled={replaceTargetIdx === null}
                style={{ flex: 1, padding: "9px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: replaceTargetIdx === null ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px", opacity: replaceTargetIdx === null ? 0.5 : 1 }}
              >
                Choose .fdx File…
              </button>
              <button onClick={() => { setShowReplaceDialog(false); setReplaceTargetIdx(null); }} style={{ padding: "9px 18px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

<div style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0, position: "relative", isolation: "isolate", width: "calc(8.5in + 520px)", maxWidth: "calc(8.5in + 520px)", alignSelf: "flex-start", paddingTop: "5px", boxSizing: "border-box" }}>
<div
  style={{
    width: "8.5in",
    flex: "0 0 8.5in",
    minHeight: "11in",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #d8dde3",
    boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
    position: "relative",
    zIndex: 1,
    backgroundColor: "white",
    boxSizing: "border-box",
  }}
>
        <style>{`
          .script-edit-block { outline: none; caret-color: red; }
          .script-edit-block:focus { outline: none !important; background-color: transparent !important; caret-color: red; }

          @keyframes moodImageFade {
            0%   { opacity: 0; }
            15%  { opacity: 1; }
            75%  { opacity: 1; }
            90%  { opacity: 0; }
            100% { opacity: 0; }
          }
          .mood-image-wrap {
            animation: moodImageFade var(--fade-duration, 12s) ease-in-out var(--fade-delay, 0s) infinite;
            break-inside: avoid;
            margin-bottom: 10px;
          }
        `}</style>
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: `${SCRIPT_PAGE_LAYOUT.pageMarginTop} ${SCRIPT_PAGE_LAYOUT.pageMarginRight} ${SCRIPT_PAGE_LAYOUT.pageMarginBottom} ${SCRIPT_PAGE_LAYOUT.pageMarginLeft}`,
            backgroundColor: "white",
            boxSizing: "border-box",
            fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
            fontSize: "12pt",
            lineHeight: "12pt",
            position: "relative",
          }}
        >
        <div style={{ position: "relative", zIndex: 1, color: "#000", minHeight: "9in" }}>
            <ContinuousScript
              scenes={scenes} sceneRefs={sceneRefs} isEditMode={isScriptEditable}
              editingScenes={editingScenes} setEditingScenes={setEditingScenes}
              activeBlock={activeBlock} setActiveBlock={setActiveBlock}
              taggedItems={taggedItems} tagCategories={tagCategories}
              characters={characters}
              showTagDropdown={showTagDropdown} setShowTagDropdown={setShowTagDropdown}
              tagWord={tagWord} untagWordInstance={untagWordInstance}
              isWordInstanceTagged={isWordInstanceTagged}
              getSceneStatusColor={getSceneStatusColor}
              committedRounds={committedRounds} viewingRevision={viewingRevision}
              setCurrentIndex={setCurrentIndex}
              onSceneHeadingChange={handleSceneHeadingChange}
              onCreateSceneAfter={handleCreateSceneAfter}
              onPageStatsChange={handleViewerPageStatsChange}
            />
          </div>
          {showTagDropdown && !isEditMode && (
            <>
              <div style={{ position: "fixed", left: showTagDropdown.x, top: showTagDropdown.y, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 8px rgba(0,0,0,0.2)", zIndex: 1000, minWidth: "150px" }}>
                {showTagDropdown.isTagged ? (
                  <div onClick={() => untagWordInstance(showTagDropdown.tagKey || showTagDropdown.cleanWord || showTagDropdown.word, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex)} style={{ padding: "8px 12px", cursor: "pointer" }}>Remove Tag ({showTagDropdown.category})</div>
                ) : (
                  tagCategories.map((cat, i) => (
                    <div key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); tagWord(showTagDropdown.word, cat.name, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: i < tagCategories.length - 1 ? "1px solid #eee" : "none", display: "flex", alignItems: "center" }}>
                      <div style={{ width: "12px", height: "12px", backgroundColor: cat.color, marginRight: "8px", borderRadius: "2px" }} />{cat.name}
                    </div>
                  ))
                )}
              </div>
              <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowTagDropdown(null)} />
            </>
          )}
        </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, backgroundColor: "white", minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <SceneList
              scenes={scenes}
              currentSceneNumber={displaySceneNumber}
              sceneRefs={sceneRefs}
              getSceneStatusColor={getSceneStatusColor}
              selectedProject={selectedProject}
              user={user}
              onSceneNumberChange={onSceneNumberChange}
              setCurrentIndex={setCurrentIndex}
              canDeleteScene={!isViewOnly}
              onDeleteScene={handleDeleteScene}
              onReorderScene={!isViewOnly ? handleSceneListReorder : null}
              onUpdateSceneMetadata={!isViewOnly ? handleUpdateSceneMetadataField : null}
              onInsertScene={!isViewOnly ? handleInsertScene : null}
              onOpenSceneDetail={setEditingSceneIndex}
              onRequestInsert={!isViewOnly ? (insertAtIndex) => { setPendingInsertIndex(insertAtIndex); setShowInsertSourceModal(true); } : null}
              pageStatsBySceneId={viewerPageStatsBySceneId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Script;
