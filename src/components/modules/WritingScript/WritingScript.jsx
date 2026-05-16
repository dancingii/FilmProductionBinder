// ═══ WritingScript.jsx ════════════════════════════════════════════════════════
// Writing-only implementation. Copied/adapted from the Script.js writing mode.
// Production mutation paths (saveScenesDatabase, setScenes, stripboard, etc.)
// are intentionally absent. Beat Convert to Scene is disabled.
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePresence } from "../../../hooks/usePresence";
import PresenceIndicator from "../../shared/PresenceIndicator";
import { calculateScenePageStats, LINES_PER_PAGE } from "../../../utils.js";
import { createSceneId } from "../../../utils/sceneIdentity";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../../utils/sceneDisplayLabel";
import {
  getSceneRowPresentation,
  getSceneMetadataColumns,
  SCENE_METADATA_COLUMN_WIDTHS,
} from "../../../utils/scenePresentation";
import WritingTimeline from "../../../experimental/writingTimeline/WritingTimeline";
import ScriptWritingEditor from "../Script/ScriptWritingEditor";
import {
  documentNodesFromScenes,
  scenesFromDocumentNodes,
  createEmptySceneHeadingNode,
} from "./writingDraftModel";

// ─── Constants ────────────────────────────────────────────────────────────────
const ENABLE_WRITING_TIMELINE = true;
const ELEMENT_TYPES = ["Scene Heading", "Action", "Character", "Dialogue", "Parenthetical", "Transition", "Shot"];

const BEAT_MENU_COLORS = {
  default: { label: "Default slate", background: "white", border: "#e5e5e5", swatch: "#C9D6DE" },
  red:    { label: "Red",    background: "#FFEBEE", border: "#EF9A9A", swatch: "#EF9A9A" },
  orange: { label: "Orange", background: "#FFF3E0", border: "#FFCC80", swatch: "#FFCC80" },
  yellow: { label: "Yellow", background: "#FFFDE7", border: "#FFE082", swatch: "#FFE082" },
  green:  { label: "Green",  background: "#E8F5E9", border: "#A5D6A7", swatch: "#A5D6A7" },
  blue:   { label: "Blue",   background: "#E3F2FD", border: "#90CAF9", swatch: "#90CAF9" },
  purple: { label: "Purple", background: "#F3E5F5", border: "#CE93D8", swatch: "#CE93D8" },
};

// ─── Beat Sheet Helpers (copied from Script.js lines 361–575) ─────────────────
const BEAT_TITLE_WORD_LIMIT = 10;
const normalizeBeatText = (text = "") => String(text || "").trim().replace(/\s+/g, " ");

const createBeatId = (sourceText, order, type = "beat") => {
  const input = `${type}|${order}|${sourceText || ""}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `${type}-${order}-${Math.abs(hash).toString(36)}`;
};

const stripBeatMarker = (line = "") =>
  normalizeBeatText(line)
    .replace(/^\s*(?:[-*]|•)\s+/, "")
    .replace(/^\d+[\.)]\s+/, "")
    .replace(/^beat\s+\d+\s*[:.)-]\s*/i, "")
    .trim();

const extractOriginalBeatNumber = (line = "") => {
  const text = normalizeBeatText(line);
  const directMatch = text.match(/^(\d+)[\.)]\s+\S+/);
  if (directMatch) return Number(directMatch[1]);
  const beatMatch = text.match(/^beat\s+(\d+)\s*[:.)-]\s*\S+/i);
  if (beatMatch) return Number(beatMatch[1]);
  return null;
};

const isBeatSectionHeader = (block = "") => {
  const text = normalizeBeatText(block);
  if (!text || text.length > 90) return false;
  if (/\bACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V|\d+)\b/i.test(text)) return true;
  if (/\b(PROLOGUE|EPILOGUE|TEASER|TAG|SECTION|PART)\b/i.test(text) && text.length <= 80) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return false;
  if (text.split(/\s+/).length < 2) return false;
  return text === text.toUpperCase();
};

const isActHeading = (block = "") => {
  const text = normalizeBeatText(block);
  if (!text || text.length > 90) return false;
  if (!/^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V|\d+)\b/i.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return text === text.toUpperCase() || /^ACT\s+/i.test(text);
};

const isNumberedBeatTitle = (line = "") => {
  const text = normalizeBeatText(line);
  return /^\d+[\.)]\s+\S+/.test(text) || /^beat\s+\d+\s*[:.)-]\s*\S+/i.test(text);
};

const isBulletBeatTitle = (line = "") => /^(?:[-*]|•)\s+\S+/.test(normalizeBeatText(line));

const isLikelyBeatTitle = (line = "") => {
  const text = normalizeBeatText(line);
  if (!text || text.length > 80) return false;
  if (isNumberedBeatTitle(text) || isBulletBeatTitle(text)) return true;
  if (/[.!?]$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > BEAT_TITLE_WORD_LIMIT) return false;
  const titleCaseWords = words.filter(word => /^[A-Z0-9]/.test(word));
  return titleCaseWords.length >= Math.max(1, Math.ceil(words.length * 0.6));
};

const createAutoBeatTitle = (text = "", order = 1) => {
  const words = normalizeBeatText(text).split(/\s+/).filter(Boolean).slice(0, 6);
  return words.length ? words.join(" ") : `Beat ${order}`;
};

const normalizeOutlineItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item, index) => {
    const type = item?.type === "act" ? "act" : "beat";
    const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1;
    if (type === "act") {
      return {
        id: item.id || createBeatId(item.sourceText || item.title || "", order, "act"),
        type: "act",
        title: String(item.title || "ACT").trim(),
        order,
        sourceText: item.sourceText || item.title || "",
      };
    }
    return {
      id: item.id || createBeatId(item.sourceText || item.title || "", order, "beat"),
      type: "beat",
      title: String(item.title || `Beat ${order}`).trim(),
      description: String(item.description || "").trim(),
      order,
      verified: Boolean(item.verified),
      convertedSceneId: item.convertedSceneId || null,
      originalBeatNumber: Number.isFinite(Number(item.originalBeatNumber)) ? Number(item.originalBeatNumber) : null,
      markerColor: item.markerColor || null,
      sourceText: item.sourceText || "",
    };
  });

const parseBeatSheetText = (rawText = "") => {
  const warnings = [];
  const blocks = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const items = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const lines = block.split("\n").map(normalizeBeatText).filter(Boolean);
    const firstLine = lines[0] || "";

    if (isActHeading(firstLine)) {
      const order = items.length + 1;
      items.push({ id: createBeatId(firstLine, order, "act"), type: "act", title: firstLine, order, sourceText: firstLine });
      if (lines.length > 1) blocks.splice(i + 1, 0, lines.slice(1).join("\n"));
      i += 1;
      continue;
    }

    let title = "", description = "", sourceText = block, originalBeatNumber = null;

    if (isNumberedBeatTitle(firstLine) || isBulletBeatTitle(firstLine)) {
      originalBeatNumber = extractOriginalBeatNumber(firstLine);
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
      if (!description && blocks[i + 1]) {
        const nextFirstLine = blocks[i + 1].split("\n").map(normalizeBeatText).filter(Boolean)[0] || "";
        if (!isBeatSectionHeader(blocks[i + 1]) && !isNumberedBeatTitle(nextFirstLine) && !isBulletBeatTitle(nextFirstLine)) {
          description = blocks[i + 1].trim();
          sourceText = `${block}\n\n${blocks[i + 1].trim()}`;
          i += 1;
        }
      }
    } else if (lines.length === 1 && isLikelyBeatTitle(firstLine) && blocks[i + 1] && !isBeatSectionHeader(blocks[i + 1])) {
      title = stripBeatMarker(firstLine);
      description = blocks[i + 1].trim();
      sourceText = `${block}\n\n${blocks[i + 1].trim()}`;
      i += 1;
    } else if (lines.length > 1 && isLikelyBeatTitle(firstLine)) {
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
    } else if (lines.length > 1 && !/[.!?]$/.test(firstLine) && firstLine.split(/\s+/).filter(Boolean).length <= BEAT_TITLE_WORD_LIMIT) {
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
    } else {
      title = createAutoBeatTitle(block, items.length + 1);
      description = block;
      warnings.push(`Auto-generated title for beat ${items.length + 1}.`);
    }

    const order = items.length + 1;
    items.push({
      id: createBeatId(sourceText, order, "beat"),
      type: "beat",
      order,
      title: title || `Beat ${order}`,
      description,
      verified: false,
      convertedSceneId: null,
      originalBeatNumber,
      sourceText,
    });
    i += 1;
  }

  const beats = items.filter(item => item.type === "beat");
  const acts = items.filter(item => item.type === "act");
  if (items.length === 0 && rawText.trim()) warnings.push("No outline items were detected.");
  return { items, beats, acts, warnings };
};

// ─── BeatsList (copied from Script.js lines 577–736; onConvertItem disabled in writing mode) ──
function BeatsList({ beats, onDeleteItem = null, onReorderItem = null, onOpenItem = null, onConvertItem = null, onColorItem = null, collapsedActIds = {}, onToggleAct = null }) {
  const orderedItems = normalizeOutlineItems(beats).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  const beatCount = orderedItems.filter(item => item.type === "beat").length;
  const actCount = orderedItems.filter(item => item.type === "act").length;
  const [dragState, setDragState] = useState({ draggedId: null, overId: null, position: "before" });
  const [beatContextMenu, setBeatContextMenu] = useState(null);
  let beatDisplayNumber = 0;

  useEffect(() => {
    if (!beatContextMenu) return;
    const handleEsc = (e) => { if (e.key === "Escape") setBeatContextMenu(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [beatContextMenu]);

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (itemId, position) => {
    if (dragState.overId !== itemId || dragState.position !== position) return undefined;
    return "2px solid #316AC5";
  };

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ width: "492px", border: "2px inset #ccc", backgroundColor: "white", fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden", flex: 1 }}>
        <div style={{ padding: "8px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <strong>Outline</strong>
          <span style={{ fontSize: "11px", color: "#777" }}>{beatCount} beats{actCount ? `, ${actCount} acts` : ""}</span>
        </div>
        {orderedItems.length === 0 ? (
          <div style={{ padding: "16px", color: "#777", lineHeight: 1.45 }}>No beats imported yet. Use the Import Beats button above to paste and review a beat sheet.</div>
        ) : (
          orderedItems.map((item, index) => {
            const previousAct = orderedItems.slice(0, index).reverse().find(outlineItem => outlineItem.type === "act");
            const isHiddenByCollapsedAct = item.type === "beat" && previousAct && collapsedActIds[previousAct.id];

            if (item.type === "act") {
              const isCollapsed = Boolean(collapsedActIds[item.id]);
              return (
                <div key={item.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); setDragState({ draggedId: item.id, overId: null, position: "before" }); }}
                  onDragOver={(e) => { e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overId === item.id && prev.position === pos ? prev : { ...prev, overId: item.id, position: pos }); }}
                  onDrop={(e) => { e.preventDefault(); const dragged = dragState.draggedId || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedId: null, overId: null, position: "before" }); onReorderItem?.(dragged, item.id, pos); }}
                  onDragEnd={() => setDragState({ draggedId: null, overId: null, position: "before" })}
                  style={{ padding: "10px", borderTop: getDropBorderStyle(item.id, "before"), borderBottom: getDropBorderStyle(item.id, "after") || "1px solid #b0bec5", backgroundColor: dragState.draggedId === item.id ? "#B0BEC5" : "#CFD8DC", color: "#263238", fontWeight: "bold", letterSpacing: "0.02em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px", cursor: "grab" }}
                >
                  <button type="button" onClick={() => onToggleAct?.(item.id)} style={{ width: "22px", height: "22px", border: "1px solid #90A4AE", borderRadius: "3px", backgroundColor: "white", color: "#455A64", cursor: "pointer", fontSize: "12px", fontWeight: "bold", lineHeight: "18px", padding: 0, flexShrink: 0 }}>
                    {isCollapsed ? ">" : "v"}
                  </button>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                  <button type="button" onClick={() => onDeleteItem?.(item.id)} style={{ width: "22px", height: "22px", border: "1px solid #c62828", borderRadius: "3px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: "bold", lineHeight: "18px", padding: 0 }}>x</button>
                </div>
              );
            }

            const isConverted = item.convertedSceneId;
            beatDisplayNumber += 1;
            if (isHiddenByCollapsedAct) return null;
            const beatColor = BEAT_MENU_COLORS[item.markerColor] || null;

            return (
              <div key={item.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); setDragState({ draggedId: item.id, overId: null, position: "before" }); }}
                onDragOver={(e) => { e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overId === item.id && prev.position === pos ? prev : { ...prev, overId: item.id, position: pos }); }}
                onDrop={(e) => { e.preventDefault(); const dragged = dragState.draggedId || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedId: null, overId: null, position: "before" }); onReorderItem?.(dragged, item.id, pos); }}
                onDragEnd={() => setDragState({ draggedId: null, overId: null, position: "before" })}
                onDoubleClick={() => onOpenItem?.(item.id)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setBeatContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id, title: item.title, isConverted: Boolean(item.convertedSceneId) }); }}
                title="Double-click to edit beat"
                style={{ padding: "10px", borderTop: getDropBorderStyle(item.id, "before"), borderBottom: getDropBorderStyle(item.id, "after") || `1px solid ${beatColor?.border || "#eee"}`, borderLeft: beatColor ? `3px solid ${beatColor.border}` : undefined, backgroundColor: dragState.draggedId === item.id ? "#ECEFF1" : beatColor?.background || (isConverted ? "#E8F5E9" : item.verified ? "#F1F8E9" : "white"), cursor: "grab" }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "8px", color: "#777", fontVariantNumeric: "tabular-nums", minWidth: "22px" }}>#{beatDisplayNumber}</span>
                  {item.originalBeatNumber && item.originalBeatNumber !== beatDisplayNumber && (
                    <span style={{ fontSize: "6px", color: "#c62828", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: "bold" }}>{item.originalBeatNumber}</span>
                  )}
                  <strong style={{ flex: 1, minWidth: 0, fontSize: "11px", color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || `Beat ${beatDisplayNumber}`}</strong>
                  {/* Convert to Scene is disabled in Writing mode — onConvertItem is always null here */}
                  <button type="button" disabled style={{ padding: "3px 6px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#f5f5f5", color: "#bbb", cursor: "default", fontSize: "8px", fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {isConverted ? "Converted" : "Convert to Scene"}
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteItem?.(item.id); }} onDoubleClick={(e) => e.stopPropagation()} style={{ width: "20px", height: "20px", border: "1px solid #c62828", borderRadius: "3px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontSize: "10px", fontWeight: "bold", lineHeight: "16px", padding: 0, flexShrink: 0 }}>x</button>
                </div>
                <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#444", whiteSpace: "pre-wrap" }}>{item.description || "No description."}</div>
              </div>
            );
          })
        )}
      </div>
      {beatContextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 2999 }} onClick={() => setBeatContextMenu(null)} />
          <div style={{ position: "fixed", left: beatContextMenu.x, top: beatContextMenu.y, zIndex: 3000, backgroundColor: "white", border: "1px solid #e0e0e0", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", minWidth: "190px", overflow: "hidden", fontFamily: "'Century Gothic','Futura',Arial,sans-serif", fontSize: "12px" }}>
            <div style={{ padding: "6px 12px 5px", fontSize: "11px", color: "#999", borderBottom: "1px solid #f0f0f0", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
              {beatContextMenu.title || "Untitled Beat"}
            </div>
            <div onClick={() => { setBeatContextMenu(null); onOpenItem?.(beatContextMenu.itemId); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}>Open Details</div>
            {/* Convert to Scene context item disabled in writing mode */}
            <div style={{ padding: "7px 12px", cursor: "not-allowed", color: "#bbb", borderBottom: "1px solid #f5f5f5" }}>
              {beatContextMenu.isConverted ? "Converted" : "Convert to Scene"}
            </div>
            {onColorItem && (
              <>
                <div onClick={() => setBeatContextMenu(prev => ({ ...prev, showColors: !prev.showColors }))} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: beatContextMenu.showColors ? "none" : "1px solid #f5f5f5" }}>Change Color</div>
                {beatContextMenu.showColors && (
                  <div style={{ padding: "4px 0", borderBottom: "1px solid #f5f5f5", backgroundColor: "#fafafa" }}>
                    {Object.entries(BEAT_MENU_COLORS).map(([colorKey, option]) => {
                      const beat = orderedItems.find(outlineItem => outlineItem.id === beatContextMenu.itemId);
                      const selected = (beat?.markerColor || "default") === colorKey;
                      return (
                        <div key={colorKey} onClick={() => { setBeatContextMenu(null); onColorItem(beatContextMenu.itemId, colorKey); }} style={{ padding: "5px 12px 5px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", backgroundColor: selected ? "#eef5ff" : "transparent" }}>
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
            <div onClick={() => { setBeatContextMenu(null); onDeleteItem?.(beatContextMenu.itemId); }} style={{ padding: "7px 12px", cursor: "pointer", color: "#c62828" }}>Delete Beat</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SceneList (copied from Script.js; writing-mode props only) ───────────────
function SceneList({ scenes, currentSceneNumber, sceneRefs, getSceneStatusColor, selectedProject, user, onSceneNumberChange, setCurrentIndex, showMoodOverlay, canCreateScene = false, onCreateFirstScene = null, canDeleteScene = false, onDeleteScene = null, onReorderScene = null, pageStatsBySceneId = null }) {
  const { otherUsers } = usePresence(selectedProject?.id, user, "script", currentSceneNumber);
  const [dragState, setDragState] = useState({ draggedKey: null, overKey: null, position: "before" });
  const listRef = useRef(null);
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);

  useEffect(() => {
    const idx = scenes.findIndex(s => s.sceneNumber === currentSceneNumber);
    if (idx >= 0 && listRef.current) {
      const item = listRef.current.children[idx];
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [currentSceneNumber, scenes]);

  const getSceneDragKey = (scene, index) =>
    `${scene.id || scene.sceneId || scene.sceneNumber || "scene"}-${index}`;

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (sceneKey, position) => {
    if (dragState.overKey !== sceneKey || dragState.position !== position) return undefined;
    return "2px solid #316AC5";
  };

  const scrollToScene = (index) => {
    setCurrentIndex(index);
    if (sceneRefs.current[index]) {
      sceneRefs.current[index].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (scenes.length === 0) {
    return (
      <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: showMoodOverlay ? "rgba(255,255,255,0.15)" : "white", fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden", padding: "18px", boxSizing: "border-box", color: "#555", lineHeight: 1.45 }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#222", marginBottom: "8px" }}>No scenes yet</div>
          <div style={{ marginBottom: "14px" }}>Create a starter scene to begin writing.</div>
          {canCreateScene && (
            <button type="button" onClick={onCreateFirstScene} style={{ padding: "8px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              New Script
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={listRef} style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: showMoodOverlay ? "rgba(255,255,255,0.15)" : "white", fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden" }}>
        {scenes.map((scene, index) => {
          const sceneKey = getSceneDragKey(scene, index);
          const statusPresentation = getSceneStatusColor(scene.sceneNumber);
          const isCurrent = currentSceneNumber === scene.sceneNumber;
          const displayLabel = getSceneDisplayLabel(scene, displayLabelMap);
          let pageStats = pageStatsBySceneId?.[scene.id] || null;
          if (!pageStats) {
            try { pageStats = calculateScenePageStats(index, scenes, LINES_PER_PAGE); } catch {}
          }
          const rowPresentation = getSceneRowPresentation(scene, { status: statusPresentation.statusLabel, isCurrent, isDragging: dragState.draggedKey === sceneKey, displayLabel });
          const metadataColumns = getSceneMetadataColumns(scene, { displayLabel, pageStats });
          const statColor = rowPresentation.metadataTextColor;
          const sceneHeadingDisplayText = scene.metadata?.writingDraft
            ? String(scene.heading || "").toUpperCase()
            : scene.heading;

          return (
            <PresenceIndicator key={sceneKey} itemId={sceneKey} otherUsers={otherUsers} position="top">
              <div
                draggable={Boolean(onReorderScene)}
                onDragStart={(e) => { if (!onReorderScene) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", sceneKey); setDragState({ draggedKey: sceneKey, overKey: null, position: "before" }); }}
                onDragOver={(e) => { if (!onReorderScene) return; e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overKey === sceneKey && prev.position === pos ? prev : { ...prev, overKey: sceneKey, position: pos }); }}
                onDrop={(e) => { if (!onReorderScene) return; e.preventDefault(); const draggedKey = dragState.draggedKey || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedKey: null, overKey: null, position: "before" }); onReorderScene(draggedKey, sceneKey, pos); }}
                onDragEnd={() => setDragState({ draggedKey: null, overKey: null, position: "before" })}
                onClick={() => scrollToScene(index)}
                style={{ padding: "3px 8px", cursor: onReorderScene ? "grab" : "pointer", userSelect: "none", borderTop: getDropBorderStyle(sceneKey, "before"), borderBottom: getDropBorderStyle(sceneKey, "after") || "1px solid #f0f0f0", backgroundColor: rowPresentation.rowBackgroundColor, color: rowPresentation.rowTextColor, display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "13px" }}>{displayLabel}</strong>
                  {" – "}{sceneHeadingDisplayText}
                </span>
                <span style={{ display: "grid", gridTemplateColumns: `${SCENE_METADATA_COLUMN_WIDTHS.customColor} ${SCENE_METADATA_COLUMN_WIDTHS.originalNumber} ${SCENE_METADATA_COLUMN_WIDTHS.pageNumber} ${SCENE_METADATA_COLUMN_WIDTHS.pageLength}`, alignItems: "center", columnGap: "4px", flexShrink: 0 }}>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.customColor, textAlign: "center", lineHeight: 0 }}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: metadataColumns.customColor.hasCustomColor ? metadataColumns.customColor.swatch : "transparent", border: metadataColumns.customColor.hasCustomColor ? `1px solid ${isCurrent ? "rgba(255,255,255,0.7)" : metadataColumns.customColor.border}` : "1px solid transparent", visibility: metadataColumns.customColor.hasCustomColor ? "visible" : "hidden" }} />
                  </span>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.originalNumber, textAlign: "right", fontSize: "9px", color: "#c62828", fontWeight: "bold", fontVariantNumeric: "tabular-nums", visibility: metadataColumns.originalNumber.showOriginal ? "visible" : "hidden" }}>
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
    </div>
  );
}

// ═══ WritingScript ════════════════════════════════════════════════════════════
function WritingScript({ selectedProject = null, user = null, userRole = null, previewMode = null, previewShell = false }) {
  const isEditorPreview = previewMode === "editor";
  const isViewOnly = userRole === "viewer";

  // ─── State ──────────────────────────────────────────────────────────────────
  const [writingDraftNodes, setWritingDraftNodes] = useState([]);
  const [writingDraftSaveStatus, setWritingDraftSaveStatus] = useState("saved");
  const [writingScenePageStats, setWritingScenePageStats] = useState({});
  const [showWritingSceneNumbers, setShowWritingSceneNumbers] = useState(false);
  const [showWritingTimeline, setShowWritingTimeline] = useState(false);
  const [targetPageCount, setTargetPageCount] = useState(90);
  const [showTargetPageDialog, setShowTargetPageDialog] = useState(false);
  const [showMoodOverlay, setShowMoodOverlay] = useState(() =>
    localStorage.getItem("scriptMoodOverlayEnabled") === "true"
  );
  const [moodOverlaySettings, setMoodOverlaySettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("scriptMoodOverlaySettings")) || { opacity: 0.5, columnWidth: 220, columns: 4, refreshSeconds: 0 };
    } catch {
      return { opacity: 0.5, columnWidth: 220, columns: 4, refreshSeconds: 0 };
    }
  });
  const [showMoodOverlaySettings, setShowMoodOverlaySettings] = useState(false);
  const [showInlineMoodOverlaySettings, setShowInlineMoodOverlaySettings] = useState(false);
  const [beats, setBeats] = useState([]);
  const [activeSidePanelTab, setActiveSidePanelTab] = useState("scenes");
  const [showBeatsTrack, setShowBeatsTrack] = useState(false);
  const [beatTrackZoom, setBeatTrackZoom] = useState(1);
  const [showBeatImportDialog, setShowBeatImportDialog] = useState(false);
  const [beatImportText, setBeatImportText] = useState("");
  const [beatImportDraft, setBeatImportDraft] = useState(null);
  const [selectedBeatDetailId, setSelectedBeatDetailId] = useState(null);
  const [collapsedActIds, setCollapsedActIds] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const [writingEditorElementType, setWritingEditorElementType] = useState("");

  const sceneRefs = useRef([]);
  const writingDraftSaveTimerRef = useRef(null);
  const lastWritingDraftPayloadRef = useRef("");
  const skipNextBeatPersistRef = useRef(false);
  const skipNextTabPersistRef = useRef(false);
  const skipNextCollapsedActsPersistRef = useRef(false);

  // ─── Storage keys ────────────────────────────────────────────────────────────
  const getProjectStorageKey = useCallback((key) => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `${key}:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getBeatsStorageKey = useCallback(() => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `scriptBeats:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getWritingDraftStorageKey = useCallback(() => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `scriptWritingDraft:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  // ─── Load writing draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) {
      setWritingDraftNodes([]);
      setWritingDraftSaveStatus("saved");
      lastWritingDraftPayloadRef.current = "";
      return;
    }
    try {
      const saved = localStorage.getItem(getWritingDraftStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        if (parsed?.hasUserCreatedScript === true && savedNodes.length) {
          setWritingDraftNodes(savedNodes);
          lastWritingDraftPayloadRef.current = JSON.stringify(savedNodes);
          setWritingDraftSaveStatus("saved");
          return;
        }
      }
      setWritingDraftNodes([]);
      lastWritingDraftPayloadRef.current = JSON.stringify([]);
      setWritingDraftSaveStatus("saved");
    } catch (err) {
      console.warn("Could not load writing draft:", err);
      setWritingDraftNodes([]);
      lastWritingDraftPayloadRef.current = JSON.stringify([]);
      setWritingDraftSaveStatus("error");
    }
  }, [getWritingDraftStorageKey, selectedProject]);

  useEffect(() => () => { clearTimeout(writingDraftSaveTimerRef.current); }, []);

  // ─── Load/save beats ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    try {
      const storedBeats = JSON.parse(localStorage.getItem(getBeatsStorageKey()) || "[]");
      skipNextBeatPersistRef.current = true;
      setBeats(normalizeOutlineItems(storedBeats));
    } catch (err) {
      console.warn("Could not load beats:", err);
      skipNextBeatPersistRef.current = true;
      setBeats([]);
    }
  }, [selectedProject?.id, selectedProject?.name, getBeatsStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextBeatPersistRef.current) { skipNextBeatPersistRef.current = false; return; }
    try { localStorage.setItem(getBeatsStorageKey(), JSON.stringify(beats)); } catch (err) { console.warn("Could not persist beats:", err); }
  }, [beats, selectedProject?.id, selectedProject?.name, getBeatsStorageKey]);

  // ─── Load/save active tab ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const storedTab = localStorage.getItem(getProjectStorageKey("scriptSidePanelTab"));
    skipNextTabPersistRef.current = true;
    setActiveSidePanelTab(storedTab === "beats" ? "beats" : "scenes");
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextTabPersistRef.current) { skipNextTabPersistRef.current = false; return; }
    localStorage.setItem(getProjectStorageKey("scriptSidePanelTab"), activeSidePanelTab === "beats" ? "beats" : "scenes");
  }, [activeSidePanelTab, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Load/save collapsed acts ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    try {
      const stored = JSON.parse(localStorage.getItem(getProjectStorageKey("scriptCollapsedActs")) || "{}");
      skipNextCollapsedActsPersistRef.current = true;
      setCollapsedActIds(stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {});
    } catch (err) {
      skipNextCollapsedActsPersistRef.current = true;
      setCollapsedActIds({});
    }
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextCollapsedActsPersistRef.current) { skipNextCollapsedActsPersistRef.current = false; return; }
    try { localStorage.setItem(getProjectStorageKey("scriptCollapsedActs"), JSON.stringify(collapsedActIds)); } catch {}
  }, [collapsedActIds, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Load/save timeline visibility ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const key = getProjectStorageKey("scriptTimelineVisible:writing");
    const stored = localStorage.getItem(key);
    setShowWritingTimeline(stored === null ? false : stored === "true");
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    localStorage.setItem(getProjectStorageKey("scriptTimelineVisible:writing"), showWritingTimeline ? "true" : "false");
  }, [showWritingTimeline, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Load/save target page count ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const stored = localStorage.getItem(getProjectStorageKey("scriptTargetPageCount"));
    const parsed = Number(stored);
    setTargetPageCount(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 90);
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    const safe = Number(targetPageCount);
    if (!Number.isFinite(safe) || safe < 1) return;
    localStorage.setItem(getProjectStorageKey("scriptTargetPageCount"), String(Math.round(safe)));
  }, [targetPageCount, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Keyboard shortcuts for modals ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedBeatDetailId) return;
    const handler = (e) => { if (e.key === "Escape") setSelectedBeatDetailId(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBeatDetailId]);

  // ─── Derived data ────────────────────────────────────────────────────────────
  const writingDraftScenes = useMemo(() => {
    const headingNodes = writingDraftNodes.filter(node => node?.type === "Scene Heading");
    return scenesFromDocumentNodes(writingDraftNodes).map((scene, index) => {
      const headingNode = headingNodes[index] || {};
      const stableSceneId =
        headingNode.id ||
        headingNode.sceneId ||
        scene.sceneId ||
        scene.id ||
        `writing-scene-${index + 1}`;

      const stats =
        writingScenePageStats[headingNode.id] ||
        writingScenePageStats[headingNode.sceneId] ||
        writingScenePageStats[scene.id] ||
        writingScenePageStats[stableSceneId] ||
        {};

      const explicitTargetPage = Number(headingNode.metadata?.targetPage ?? scene.metadata?.targetPage);
      const hasExplicitTargetPage = Number.isFinite(explicitTargetPage) && explicitTargetPage > 0;
      const statsTimelineStartPage = Number(stats.timelineStartPage);
      const fallbackStartPage = Number.isFinite(statsTimelineStartPage)
        ? Math.max(0, statsTimelineStartPage)
        : Math.max(0, (stats.pageNumber || 1) - 1);
      const timelinePageLength = Number(stats.timelinePageLength);

      return {
        ...scene,
        id: stableSceneId,
        sceneId: stableSceneId,
        sceneNumber: index + 1,
        timelineStartPage: hasExplicitTargetPage ? Math.max(0, explicitTargetPage - 1) : fallbackStartPage,
        metadata: {
          ...(scene.metadata || {}),
          ...(headingNode.metadata || {}),
          scriptOrder: index + 1,
          writingDraft: true,
          targetPage: hasExplicitTargetPage ? explicitTargetPage : null,
          writingPageNumber: stats.pageNumber || null,
          writingPageLength: stats.pageLength || null,
          writingTimelinePageLength: Number.isFinite(timelinePageLength) && timelinePageLength > 0 ? timelinePageLength : null,
        },
      };
    });
  }, [writingDraftNodes, writingScenePageStats]);

  const displaySceneNumber = writingDraftScenes[currentIndex]?.sceneNumber || 1;

  const writingWrittenPages = useMemo(() =>
    writingDraftScenes.reduce((sum, scene) => {
      const pl = Number(scene.metadata?.writingPageLength);
      return sum + (Number.isFinite(pl) && pl > 0 ? pl : 0);
    }, 0),
    [writingDraftScenes]
  );
  const writingRemainingPages = Math.max(0, Number(targetPageCount || 90) - writingWrittenPages);
  const writingWrittenPercent = Math.min(100, Number(targetPageCount || 90) > 0 ? (writingWrittenPages / Number(targetPageCount || 90)) * 100 : 0);

  // ─── handleWritingDraftNodesChange ──────────────────────────────────────────
  const handleWritingDraftNodesChange = useCallback((nextNodes = []) => {
    const safeNodes = Array.isArray(nextNodes) ? nextNodes : [];
    const payload = JSON.stringify(safeNodes);
    setWritingDraftNodes(safeNodes);

    if (payload === lastWritingDraftPayloadRef.current) {
      setWritingDraftSaveStatus("saved");
      return;
    }

    setWritingDraftSaveStatus("unsaved");
    clearTimeout(writingDraftSaveTimerRef.current);

    writingDraftSaveTimerRef.current = setTimeout(() => {
      try {
        setWritingDraftSaveStatus("saving");
        localStorage.setItem(getWritingDraftStorageKey(), JSON.stringify({
          projectId: selectedProject?.id || selectedProject?.name || "default-project",
          savedAt: new Date().toISOString(),
          hasUserCreatedScript: safeNodes.some(node => node?.type === "Scene Heading"),
          nodes: safeNodes,
        }));
        lastWritingDraftPayloadRef.current = payload;
        setWritingDraftSaveStatus("saved");
      } catch (err) {
        console.error("Could not save writing draft:", err);
        setWritingDraftSaveStatus("error");
      }
    }, 650);
  }, [getWritingDraftStorageKey, selectedProject?.id, selectedProject?.name]);

  // ─── handleStartNewScript (writing-only, no DB) ──────────────────────────────
  const handleStartNewScript = () => {
    const headingNode = createEmptySceneHeadingNode();
    const newNodes = [headingNode];
    handleWritingDraftNodesChange(newNodes);
    setCurrentIndex(0);
    setCurrentSceneNumber(1);
  };

  // ─── Beat handlers ───────────────────────────────────────────────────────────
  const appendOutlineItem = (type) => {
    setBeats(prevBeats => {
      const existingItems = normalizeOutlineItems(prevBeats);
      const order = existingItems.length + 1;
      const itemType = type === "act" ? "act" : "beat";
      const actNumber = existingItems.filter(item => item.type === "act").length + 1;
      const sourceText = `${itemType}-${order}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newItem = itemType === "act"
        ? { id: createBeatId(sourceText, order, "act"), type: "act", title: `ACT ${actNumber}`, order, sourceText: "" }
        : { id: createBeatId(sourceText, order, "beat"), type: "beat", title: `Beat ${order}`, description: "", order, verified: false, convertedSceneId: null, originalBeatNumber: null, markerColor: null, sourceText: "" };
      return [...existingItems, newItem];
    });
    setActiveSidePanelTab("beats");
  };

  const deleteOutlineItem = (itemId) => {
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats)
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index + 1 }))
    );
    setCollapsedActIds(prev => {
      if (!prev?.[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const toggleCollapsedAct = (actId) => {
    setCollapsedActIds(prev => ({ ...prev, [actId]: !prev?.[actId] }));
  };

  const reorderOutlineItem = (draggedId, targetId, position = "before") => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setBeats(prevBeats => {
      const orderedItems = normalizeOutlineItems(prevBeats).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
      const currentIdx = orderedItems.findIndex(item => item.id === draggedId);
      const targetIdx = orderedItems.findIndex(item => item.id === targetId);
      if (currentIdx === -1 || targetIdx === -1) return orderedItems;

      const draggedItem = orderedItems[currentIdx];
      const groupEndIndex = draggedItem.type === "act"
        ? orderedItems.findIndex((item, i) => i > currentIdx && item.type === "act")
        : currentIdx + 1;
      const safeGroupEndIndex = groupEndIndex === -1 ? orderedItems.length : groupEndIndex;
      const movingItems = orderedItems.slice(currentIdx, safeGroupEndIndex);
      const movingIds = new Set(movingItems.map(item => item.id));
      if (movingIds.has(targetId)) return orderedItems;

      const nextItems = [...orderedItems];
      nextItems.splice(currentIdx, movingItems.length);
      const targetIndexAfterRemoval = nextItems.findIndex(item => item.id === targetId);
      if (targetIndexAfterRemoval === -1) return orderedItems;

      const targetItemAfterRemoval = nextItems[targetIndexAfterRemoval];
      const nextTargetActIndex = targetItemAfterRemoval?.type === "act"
        ? nextItems.findIndex((item, i) => i > targetIndexAfterRemoval && item.type === "act")
        : -1;
      const targetGroupEndIndex = nextTargetActIndex === -1 ? nextItems.length : nextTargetActIndex;
      const insertIndex = draggedItem.type === "act" && targetItemAfterRemoval?.type === "act" && position === "after"
        ? targetGroupEndIndex
        : position === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;

      nextItems.splice(insertIndex, 0, ...movingItems);
      return nextItems.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const updateOutlineBeat = (itemId, patch) => {
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats).map(item => {
        if (item.id !== itemId || item.type === "act") return item;
        return {
          ...item,
          title: patch.title !== undefined ? String(patch.title) : item.title,
          description: patch.description !== undefined ? String(patch.description) : item.description,
          verified: patch.verified !== undefined ? Boolean(patch.verified) : Boolean(item.verified),
        };
      })
    );
  };

  const handleBeatMarkerColorChange = (itemId, markerColor) => {
    const nextColor = markerColor && markerColor !== "default" ? markerColor : null;
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats).map(item =>
        item.id === itemId && item.type === "beat" ? { ...item, markerColor: nextColor } : item
      )
    );
  };

  // ─── Beat import handlers ────────────────────────────────────────────────────
  const handleOpenBeatImport = () => {
    setBeatImportText("");
    setBeatImportDraft(null);
    setShowBeatImportDialog(true);
    setActiveSidePanelTab("beats");
  };

  const handleParseBeatImport = () => setBeatImportDraft(parseBeatSheetText(beatImportText));

  const handleCancelBeatImport = () => {
    setShowBeatImportDialog(false);
    setBeatImportText("");
    setBeatImportDraft(null);
  };

  const updateDraftBeat = (beatId, patch) => {
    setBeatImportDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.map(beat =>
        beat.id === beatId ? {
          ...beat,
          ...patch,
          description: patch.type === "beat" && beat.description === undefined ? "" : (patch.description !== undefined ? patch.description : beat.description),
          verified: patch.type === "act" ? false : (patch.verified !== undefined ? patch.verified : Boolean(beat.verified)),
        } : beat
      );
      return { ...prev, items: nextItems, beats: nextItems.filter(item => item.type === "beat"), acts: nextItems.filter(item => item.type === "act") };
    });
  };

  const removeDraftBeat = (itemId) => {
    setBeatImportDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.filter(item => item.id !== itemId).map((item, index) => ({ ...item, order: index + 1 }));
      return { ...prev, items: nextItems, beats: nextItems.filter(item => item.type === "beat"), acts: nextItems.filter(item => item.type === "act") };
    });
  };

  const handleConfirmBeatImport = () => {
    if (!beatImportDraft || !Array.isArray(beatImportDraft.items)) return;
    setBeats(prevBeats => {
      const existingBeats = normalizeOutlineItems(prevBeats);
      const startOrder = existingBeats.length;
      const importedBeats = beatImportDraft.items.map((beat, index) => {
        const order = startOrder + index + 1;
        if (beat.type === "act") {
          return { id: createBeatId(beat.sourceText || beat.title || "", order, "act"), type: "act", order, title: String(beat.title || `Act ${order}`).trim(), sourceText: beat.sourceText || "" };
        }
        return {
          id: createBeatId(beat.sourceText || beat.title || "", order, "beat"),
          type: "beat", order,
          title: String(beat.title || `Beat ${order}`).trim(),
          description: String(beat.description || "").trim(),
          verified: Boolean(beat.verified),
          convertedSceneId: beat.convertedSceneId || null,
          originalBeatNumber: Number.isFinite(Number(beat.originalBeatNumber)) ? Number(beat.originalBeatNumber) : null,
          markerColor: beat.markerColor || null,
          sourceText: beat.sourceText || "",
        };
      });
      return [...existingBeats, ...importedBeats];
    });
    setShowBeatsTrack(true);
    setActiveSidePanelTab("beats");
    handleCancelBeatImport();
  };

  // ─── Beat detail ─────────────────────────────────────────────────────────────
  const orderedOutlineItemsForDetail = normalizeOutlineItems(beats).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  let detailBeatNumber = 0;
  let detailCurrentAct = "";
  const selectedBeatDetail = orderedOutlineItemsForDetail.reduce((match, item) => {
    if (item.type === "act") { detailCurrentAct = item.title || ""; return match; }
    detailBeatNumber += 1;
    if (item.id !== selectedBeatDetailId) return match;
    return { ...item, beatNumber: detailBeatNumber, currentActTitle: detailCurrentAct, originalBeatNumber: Number.isFinite(Number(item.originalBeatNumber)) ? Number(item.originalBeatNumber) : null };
  }, null);

  const handleDeleteBeatDetail = () => {
    if (!selectedBeatDetail?.id) return;
    deleteOutlineItem(selectedBeatDetail.id);
    setSelectedBeatDetailId(null);
  };

  // ─── Timeline scene move (writing branch from Script.js lines 4350–4462) ────
  const handleTimelineSceneMove = useCallback((sceneIndex, nextStartPage) => {
    const movedScene = writingDraftScenes[sceneIndex];
    if (!movedScene) return;

    const clearTimelineTargetPage = (node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage: null } };
    };

    const sourceNodes = Array.isArray(writingDraftNodes) ? writingDraftNodes : [];
    const headingEntries = sourceNodes.map((node, index) => ({ node, index })).filter(({ node }) => node?.type === "Scene Heading");
    if (headingEntries.length < 1) return;

    const prefixNodes = sourceNodes.slice(0, headingEntries[0].index);
    const sceneBlocks = headingEntries.map((headingEntry, headingIndex) => {
      const nextHeadingEntry = headingEntries[headingIndex + 1];
      return sourceNodes.slice(headingEntry.index, nextHeadingEntry ? nextHeadingEntry.index : sourceNodes.length);
    });

    const timelineItems = writingDraftScenes.map((scene, index) => {
      const pageLength = Number(scene.metadata?.writingTimelinePageLength ?? scene.metadata?.writingPageLength);
      return { index, startPage: Number(scene.timelineStartPage) || 0, pageLength: Number.isFinite(pageLength) && pageLength > 0 ? pageLength : 0.125 };
    });

    const remainingTimelineItems = timelineItems.filter(item => item.index !== sceneIndex).sort((a, b) => a.startPage !== b.startPage ? a.startPage - b.startPage : a.index - b.index);
    let insertSceneIndex = remainingTimelineItems.length;
    for (let i = 0; i < remainingTimelineItems.length; i += 1) {
      const item = remainingTimelineItems[i];
      if (nextStartPage < item.startPage + item.pageLength / 2) { insertSceneIndex = i; break; }
    }

    const nextSceneBlocks = [...sceneBlocks];
    const [movingBlock] = nextSceneBlocks.splice(sceneIndex, 1);
    if (!movingBlock) return;

    const movedHeadingNode = movingBlock.find(node => node?.type === "Scene Heading");
    const movedHeadingId = movedHeadingNode?.id || null;
    const movedSceneId = movedHeadingNode?.sceneId || movedScene.id || null;
    const targetPage = Math.max(1, nextStartPage + 1);

    const movingBlockWithTargetPage = movingBlock.map((node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage } };
    });

    insertSceneIndex = Math.max(0, Math.min(insertSceneIndex, nextSceneBlocks.length));
    nextSceneBlocks.splice(insertSceneIndex, 0, movingBlockWithTargetPage);

    const nextNodes = [...prefixNodes, ...nextSceneBlocks.flat()].map((node) => {
      if (node?.type !== "Scene Heading") return node;
      const isMovedHeading = (movedHeadingId && node.id === movedHeadingId) || (movedSceneId && node.sceneId === movedSceneId);
      return isMovedHeading ? node : clearTimelineTargetPage(node);
    });

    handleWritingDraftNodesChange(nextNodes);
    setCurrentIndex(insertSceneIndex);
    setCurrentSceneNumber(insertSceneIndex + 1);
    requestAnimationFrame(() => { sceneRefs.current[insertSceneIndex]?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, [writingDraftNodes, writingDraftScenes, handleWritingDraftNodesChange, sceneRefs]);

  // ─── Scene list reorder (from Script.js lines 4937–5013) ─────────────────────
  const handleWritingSceneListReorder = useCallback((draggedKey, targetKey, position = "before") => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;

    const getSceneReorderKey = (scene, index) =>
      `${scene?.id || scene?.sceneId || scene?.sceneNumber || "scene"}-${index}`;

    const clearTimelineTargetPage = (node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage: null } };
    };

    const sourceNodes = Array.isArray(writingDraftNodes) ? writingDraftNodes : [];
    const headingEntries = sourceNodes.map((node, index) => ({ node, index })).filter(({ node }) => node?.type === "Scene Heading");
    if (headingEntries.length < 2) return;

    const prefixNodes = sourceNodes.slice(0, headingEntries[0].index);
    const sceneBlocks = headingEntries.map((headingEntry, headingIndex) => {
      const nextHeadingEntry = headingEntries[headingIndex + 1];
      return sourceNodes.slice(headingEntry.index, nextHeadingEntry ? nextHeadingEntry.index : sourceNodes.length);
    });

    const draggedSceneIndex = writingDraftScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(draggedKey));
    const targetSceneIndex = writingDraftScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(targetKey));
    if (draggedSceneIndex < 0 || targetSceneIndex < 0 || draggedSceneIndex === targetSceneIndex) return;

    const nextSceneBlocks = [...sceneBlocks];
    const [movingBlock] = nextSceneBlocks.splice(draggedSceneIndex, 1);
    let insertSceneIndex = targetSceneIndex;
    if (draggedSceneIndex < targetSceneIndex) insertSceneIndex -= 1;
    if (position === "after") insertSceneIndex += 1;
    insertSceneIndex = Math.max(0, Math.min(insertSceneIndex, nextSceneBlocks.length));
    nextSceneBlocks.splice(insertSceneIndex, 0, movingBlock);

    const nextNodes = [...prefixNodes, ...nextSceneBlocks.flat()].map(clearTimelineTargetPage);
    handleWritingDraftNodesChange(nextNodes);
    setCurrentIndex(insertSceneIndex);
    setCurrentSceneNumber(insertSceneIndex + 1);
    requestAnimationFrame(() => { sceneRefs.current[insertSceneIndex]?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, [handleWritingDraftNodesChange, sceneRefs, writingDraftNodes, writingDraftScenes]);

  // ─── Guards ──────────────────────────────────────────────────────────────────
  if (!isEditorPreview && !previewShell) return null;
  if (!isEditorPreview) {
    return <div data-writing-script-shell="preview" style={{ display: "none" }} />;
  }

  const noScript = writingDraftScenes.length === 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>

      {/* ── Toolbar (mirrors Script.js writing-mode toolbar, lines 5015–5263) ─── */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ flex: "0 0 calc(8.5in + 520px)", width: "calc(8.5in + 520px)", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "white" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "5px 0 5px 12px", minHeight: "38px", boxSizing: "border-box", overflow: "hidden" }}>

            <button
              type="button"
              onClick={() => setShowTargetPageDialog(true)}
              title={`${writingWrittenPages.toFixed(1)} written · ${writingRemainingPages.toFixed(1)} remaining · ${writingWrittenPercent.toFixed(0)}%`}
              style={{ padding: "5px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", color: "#333", cursor: "pointer", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", fontWeight: "bold", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
            >
              Target: {targetPageCount || 90}
            </button>

            <span style={{ fontSize: "11px", color: "#607D8B", fontWeight: "bold", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif" }}>
              Writing Editor
            </span>

            <select
              value={writingEditorElementType}
              onChange={(e) => setWritingEditorElementType(e.target.value)}
              disabled={!writingEditorElementType}
              style={{ padding: "5px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", opacity: writingEditorElementType ? 1 : 0.55, cursor: writingEditorElementType ? "pointer" : "default" }}
            >
              <option value="">Element</option>
              {ELEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>

            <span
              title="Writing draft saves locally per project. It does not update production scenes yet."
              style={{ width: "64px", minWidth: "64px", textAlign: "left", fontSize: "11px", color: writingDraftSaveStatus === "error" ? "#c62828" : "#777", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", whiteSpace: "nowrap", overflow: "hidden" }}
            >
              {writingDraftSaveStatus === "saving" ? "Saving…" : writingDraftSaveStatus === "unsaved" ? "Unsaved" : writingDraftSaveStatus === "error" ? "Save error" : "Saved"}
            </span>

            <span style={{ fontSize: "11px", color: "#555", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {writingWrittenPages.toFixed(1)} written · {writingRemainingPages.toFixed(1)} remaining · {writingWrittenPercent.toFixed(0)}%
            </span>

            {!isViewOnly && noScript && (
              <button
                onClick={handleStartNewScript}
                style={{ padding: "6px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
              >
                New Script
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMoodOverlaySettings(true)}
              style={{ marginLeft: "auto", marginRight: 0, padding: "5px 10px", backgroundColor: "#f7f7f7", color: "#333", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}
            >
              Settings
            </button>
          </div>

          {/* Scene / Beats timeline */}
          {ENABLE_WRITING_TIMELINE && (showWritingTimeline || showBeatsTrack) && (
            <WritingTimeline
              scenes={writingDraftScenes}
              beats={beats}
              onBeatOpen={setSelectedBeatDetailId}
              onBeatColorChange={handleBeatMarkerColorChange}
              onBeatTrackZoomChange={setBeatTrackZoom}
              showSceneTrack={showWritingTimeline}
              showBeatsTrack={showBeatsTrack}
              beatTrackZoom={beatTrackZoom}
              currentSceneNumber={displaySceneNumber}
              setCurrentIndex={setCurrentIndex}
              sceneRefs={sceneRefs}
              targetPages={targetPageCount}
              onSceneMove={handleTimelineSceneMove}
              onSceneOpen={(item) => {
                setCurrentIndex(item.index);
                sceneRefs.current[item.index]?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, backgroundColor: "white" }} />
      </div>

      {/* ── Beat Import Modal ─────────────────────────────────────────────────── */}
      {showBeatImportDialog && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 22000 }} onClick={handleCancelBeatImport} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "760px", maxWidth: "calc(100vw - 40px)", maxHeight: "82vh", overflow: "hidden", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 22001, fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Import Beat Sheet</h2>
                <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>Paste semi-structured beat sheet text, review the parsed beats, then confirm.</div>
              </div>
              <button type="button" onClick={handleCancelBeatImport} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>x</button>
            </div>

            {!beatImportDraft ? (
              <>
                <div style={{ padding: "18px 20px", overflow: "auto" }}>
                  <textarea value={beatImportText} onChange={(e) => setBeatImportText(e.target.value)} placeholder="Paste beat sheet text here..." autoFocus style={{ width: "100%", height: "360px", resize: "vertical", border: "1px solid #ccc", borderRadius: "4px", padding: "10px", boxSizing: "border-box", fontSize: "13px", lineHeight: 1.45, fontFamily: "inherit" }} />
                </div>
                <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={handleCancelBeatImport} style={{ padding: "9px 16px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="button" onClick={handleParseBeatImport} disabled={!beatImportText.trim()} style={{ padding: "9px 18px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: beatImportText.trim() ? "pointer" : "not-allowed", fontWeight: "bold", opacity: beatImportText.trim() ? 1 : 0.5 }}>Parse Beats</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <div style={{ fontSize: "12px", color: "#555" }}>
                    Detected <strong>{beatImportDraft.items.length}</strong> outline item{beatImportDraft.items.length === 1 ? "" : "s"}: <strong>{beatImportDraft.acts.length}</strong> act{beatImportDraft.acts.length === 1 ? "" : "s"} and <strong>{beatImportDraft.beats.length}</strong> beat{beatImportDraft.beats.length === 1 ? "" : "s"}. Import will append after existing outline items.
                  </div>
                  <button type="button" onClick={() => setBeatImportDraft(null)} style={{ padding: "7px 12px", backgroundColor: "#f5f5f5", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Back to Text</button>
                </div>

                {beatImportDraft.warnings.length > 0 && (
                  <div style={{ padding: "10px 20px", backgroundColor: "#FFF8E1", borderBottom: "1px solid #F3E0A1", color: "#665200", fontSize: "12px" }}>
                    {beatImportDraft.warnings.slice(0, 3).join(" ")}
                    {beatImportDraft.warnings.length > 3 ? ` ${beatImportDraft.warnings.length - 3} more warning(s).` : ""}
                  </div>
                )}

                <div style={{ padding: "16px 20px", overflow: "auto", display: "grid", gap: "10px" }}>
                  {(() => {
                    let reviewBeatNumber = 0;
                    return beatImportDraft.items.map((item) => {
                      const isAct = item.type === "act";
                      if (!isAct) reviewBeatNumber += 1;
                      const descriptionRows = Math.max(2, Math.min(10, String(item.description || "").split("\n").length + Math.ceil(String(item.description || "").length / 80)));
                      return (
                        <div key={item.id} style={{ border: isAct ? "1px solid #90A4AE" : "1px solid #ddd", borderRadius: "6px", padding: isAct ? "10px 12px" : "12px", backgroundColor: isAct ? "#ECEFF1" : "#fafafa" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: isAct ? 0 : "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: isAct ? "#455A64" : "#777", minWidth: "82px" }}>{isAct ? "ACT HEADING" : `BEAT #${reviewBeatNumber}`}</span>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777" }}>TYPE</span>
                              <select value={item.type === "act" ? "act" : "beat"} onChange={(e) => updateDraftBeat(item.id, { type: e.target.value, description: e.target.value === "beat" ? (item.description || "") : item.description })} style={{ padding: "6px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", backgroundColor: "white" }}>
                                <option value="act">Act</option>
                                <option value="beat">Beat</option>
                              </select>
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777", width: "34px", textAlign: "left" }}>TITLE</span>
                              <input type="text" value={item.title} onChange={(e) => updateDraftBeat(item.id, { title: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "7px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", fontWeight: isAct ? "bold" : "normal", textTransform: isAct ? "uppercase" : "none" }} />
                            </label>
                            {!isAct && (
                              <button type="button" onClick={() => updateDraftBeat(item.id, { verified: !item.verified })} style={{ width: "28px", height: "28px", border: `1px solid ${item.verified ? "#4CAF50" : "#ccc"}`, borderRadius: "4px", backgroundColor: item.verified ? "#4CAF50" : "white", color: item.verified ? "white" : "#777", cursor: "pointer", fontWeight: "bold" }}>✓</button>
                            )}
                            <button type="button" onClick={() => updateDraftBeat(item.id, { showSourceText: !item.showSourceText })} style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: item.showSourceText ? "#FFF8E1" : "white", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}>Original</button>
                            <button type="button" onClick={() => removeDraftBeat(item.id)} style={{ width: "28px", height: "28px", border: "1px solid #c62828", borderRadius: "4px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontWeight: "bold" }}>x</button>
                          </div>
                          {!isAct && (
                            <label style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: "8px", alignItems: "start", margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777", paddingTop: "8px", textAlign: "left" }}>DESCRIPTION</span>
                              <textarea rows={descriptionRows} value={item.description || ""} onChange={(e) => updateDraftBeat(item.id, { description: e.target.value })} style={{ width: "100%", resize: "none", overflow: "hidden", boxSizing: "border-box", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", lineHeight: 1.4, fontFamily: "inherit" }} />
                            </label>
                          )}
                          {item.showSourceText && (
                            <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "white", border: "1px dashed #bbb", borderRadius: "4px", color: "#555", fontSize: "11px", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                              {item.sourceText || "No original text captured."}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={handleCancelBeatImport} style={{ padding: "9px 16px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="button" onClick={handleConfirmBeatImport} disabled={beatImportDraft.items.length === 0} style={{ padding: "9px 18px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: beatImportDraft.items.length ? "pointer" : "not-allowed", fontWeight: "bold", opacity: beatImportDraft.items.length ? 1 : 0.5 }}>Confirm Import</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Beat Detail Modal ─────────────────────────────────────────────────── */}
      {selectedBeatDetail && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex: 21900 }} onClick={() => setSelectedBeatDetailId(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "640px", maxWidth: "calc(100vw - 40px)", maxHeight: "82vh", overflow: "hidden", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 21901, fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Beat Detail</h2>
                <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>
                  Current Beat #{selectedBeatDetail.beatNumber}{selectedBeatDetail.currentActTitle ? ` · ${selectedBeatDetail.currentActTitle}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedBeatDetailId(null)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>x</button>
            </div>

            <div style={{ padding: "18px 20px", overflow: "auto", display: "grid", gap: "14px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "#555" }}>
                <span><strong>Current Beat #:</strong> {selectedBeatDetail.beatNumber}</span>
                <span><strong>Original Imported Beat #:</strong> {selectedBeatDetail.originalBeatNumber || "None"}</span>
              </div>
              <label style={{ display: "grid", gap: "6px", margin: 0 }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>Title</span>
                <input type="text" value={selectedBeatDetail.title || ""} onChange={(e) => updateOutlineBeat(selectedBeatDetail.id, { title: e.target.value })} autoFocus style={{ width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit" }} />
              </label>
              <label style={{ display: "grid", gap: "6px", margin: 0 }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>Description</span>
                <textarea value={selectedBeatDetail.description || ""} onChange={(e) => updateOutlineBeat(selectedBeatDetail.id, { description: e.target.value })} rows={12} style={{ width: "100%", minHeight: "240px", boxSizing: "border-box", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", resize: "vertical", fontSize: "13px", lineHeight: 1.45, fontFamily: "inherit" }} />
              </label>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <button type="button" onClick={handleDeleteBeatDetail} style={{ padding: "9px 14px", backgroundColor: "#c62828", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Delete Beat</button>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {/* Convert to Scene is DISABLED in writing mode */}
                <button type="button" disabled style={{ padding: "9px 14px", backgroundColor: "#f5f5f5", color: "#bbb", border: "1px solid #ddd", borderRadius: "4px", cursor: "default", fontWeight: "bold" }}>
                  Convert to Scene
                </button>
                <button type="button" onClick={() => updateOutlineBeat(selectedBeatDetail.id, { verified: !selectedBeatDetail.verified })} style={{ padding: "9px 14px", backgroundColor: selectedBeatDetail.verified ? "#4CAF50" : "#f5f5f5", color: selectedBeatDetail.verified ? "white" : "#555", border: selectedBeatDetail.verified ? "none" : "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  {selectedBeatDetail.verified ? "Verified" : "Mark Verified"}
                </button>
                <button type="button" onClick={() => setSelectedBeatDetailId(null)} style={{ padding: "9px 16px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Close</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Target Page Dialog ────────────────────────────────────────────────── */}
      {showTargetPageDialog && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 10000 }} onClick={() => setShowTargetPageDialog(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "22px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 10001, minWidth: "320px", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif" }}>
            <h3 style={{ marginTop: 0, marginBottom: "14px" }}>Timeline Target Page Count</h3>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>TARGET SCRIPT PAGES</label>
            <input
              type="number"
              min="1"
              value={targetPageCount === "" ? "" : targetPageCount}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (rawValue === "") { setTargetPageCount(""); return; }
                const parsedValue = parseInt(rawValue, 10);
                if (!Number.isNaN(parsedValue)) setTargetPageCount(parsedValue);
              }}
              onBlur={() => { if (targetPageCount === "" || Number(targetPageCount) < 1) setTargetPageCount(1); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { if (targetPageCount === "" || Number(targetPageCount) < 1) setTargetPageCount(1); setShowTargetPageDialog(false); }
                if (e.key === "Escape") setShowTargetPageDialog(false);
              }}
              autoFocus
              style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box", marginBottom: "16px" }}
            />
            <button onClick={() => setShowTargetPageDialog(false)} style={{ width: "100%", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Done</button>
          </div>
        </>
      )}

      {/* ── Settings Modal ────────────────────────────────────────────────────── */}
      {showMoodOverlaySettings && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 21000 }} onClick={() => setShowMoodOverlaySettings(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "440px", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "22px", zIndex: 21001, fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Settings</h2>
              <button type="button" onClick={() => setShowMoodOverlaySettings(false)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>×</button>
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
                <input type="checkbox" checked={showWritingTimeline} onChange={(e) => setShowWritingTimeline(e.target.checked)} />
                Scene Timeline
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
                <input type="checkbox" checked={showBeatsTrack} onChange={(e) => setShowBeatsTrack(e.target.checked)} />
                Beats Timeline
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
                <input type="checkbox" checked={showWritingSceneNumbers} onChange={(e) => setShowWritingSceneNumbers(e.target.checked)} />
                Scene Numbers
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
                <input type="checkbox" checked={showMoodOverlay} onChange={(e) => setShowMoodOverlay(e.target.checked)} />
                Mood Overlay
              </label>
              <button
                type="button"
                onClick={() => setShowInlineMoodOverlaySettings(prev => !prev)}
                style={{ padding: "8px 10px", backgroundColor: "#f7f7f7", border: "1px solid #ddd", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", color: "#333", textAlign: "left" }}
              >
                {showInlineMoodOverlaySettings ? "Hide" : "Show"} Mood Overlay Settings
              </button>
              {showInlineMoodOverlaySettings && (
                <div style={{ display: "grid", gap: "16px", padding: "12px", border: "1px solid #eee", borderRadius: "6px", backgroundColor: "#fafafa" }}>
                  <label style={{ display: "grid", gridTemplateColumns: "95px 1fr 48px", alignItems: "center", gap: "10px", fontSize: "12px", color: "#555" }}>
                    <strong>Opacity</strong>
                    <input type="range" min="0" max="1" step="0.01" value={moodOverlaySettings.opacity} onChange={(e) => setMoodOverlaySettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))} />
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(moodOverlaySettings.opacity * 100)}%</span>
                  </label>
                  <label style={{ display: "grid", gridTemplateColumns: "95px 1fr 48px", alignItems: "center", gap: "10px", fontSize: "12px", color: "#555" }}>
                    <strong>Columns</strong>
                    <input type="range" min="2" max="10" step="1" value={moodOverlaySettings.columns ?? 4} onChange={(e) => setMoodOverlaySettings(prev => ({ ...prev, columns: parseInt(e.target.value, 10) }))} />
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{moodOverlaySettings.columns ?? 4}</span>
                  </label>
                  <label style={{ display: "grid", gridTemplateColumns: "95px 1fr 48px", alignItems: "center", gap: "10px", fontSize: "12px", color: "#555" }}>
                    <strong>Cycle</strong>
                    <input type="range" min="0" max="60" step="5" value={moodOverlaySettings.refreshSeconds} onChange={(e) => setMoodOverlaySettings(prev => ({ ...prev, refreshSeconds: parseInt(e.target.value, 10) }))} />
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{moodOverlaySettings.refreshSeconds}s</span>
                  </label>
                  <div style={{ fontSize: "11px", color: "#888", lineHeight: 1.45 }}>Cycle set to 0 means the image order will stay fixed.</div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowMoodOverlaySettings(false)} style={{ width: "100%", marginTop: "18px", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Done</button>
          </div>
        </>
      )}

      {/* ── Main layout (mirrors Script.js lines 5732–5958) ─────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0, position: "relative", isolation: "isolate", width: "calc(8.5in + 520px)", maxWidth: "calc(8.5in + 520px)", alignSelf: "flex-start", paddingTop: "5px", boxSizing: "border-box" }}>

        {/* Script editor column */}
        <div style={{ width: "8.5in", flex: "0 0 8.5in", minHeight: "auto", display: "flex", flexDirection: "column", border: "none", boxShadow: "none", position: "relative", zIndex: 1, backgroundColor: "transparent", boxSizing: "border-box" }}>
          <div
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0", backgroundColor: "transparent", boxSizing: "border-box", fontFamily: "'Courier Prime', Courier, 'Courier New', monospace", fontSize: "12pt", lineHeight: "12pt", position: "relative" }}
          >
            <div style={{ position: "relative", zIndex: 1, color: "#000", minHeight: "auto" }}>
              <ScriptWritingEditor
                initialNodes={writingDraftNodes}
                activeElementType={writingEditorElementType}
                onActiveElementTypeChange={setWritingEditorElementType}
                onNodesChange={handleWritingDraftNodesChange}
                sceneRefs={sceneRefs}
                onSceneStatsChange={setWritingScenePageStats}
                showSceneNumbers={showWritingSceneNumbers}
              />
            </div>
          </div>
        </div>

        {/* Right panel: Scenes + Beats */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, backgroundColor: "white", minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ marginLeft: "20px", width: "492px", display: "flex", flexShrink: 0, gap: "6px", padding: "0 0 5px", boxSizing: "border-box", fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif" }}>
            <button type="button" onClick={() => setActiveSidePanelTab("scenes")} style={{ padding: "6px 12px", border: "1px solid #ccc", borderBottomColor: activeSidePanelTab === "scenes" ? "#316AC5" : "#ccc", backgroundColor: activeSidePanelTab === "scenes" ? "#316AC5" : "#f5f5f5", color: activeSidePanelTab === "scenes" ? "white" : "#222", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              Scenes
            </button>
            <button type="button" onClick={() => setActiveSidePanelTab("beats")} style={{ padding: "6px 12px", border: "1px solid #ccc", borderBottomColor: activeSidePanelTab === "beats" ? "#316AC5" : "#ccc", backgroundColor: activeSidePanelTab === "beats" ? "#316AC5" : "#f5f5f5", color: activeSidePanelTab === "beats" ? "white" : "#222", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              Beats{beats.filter(item => (item.type || "beat") === "beat").length ? ` (${beats.filter(item => (item.type || "beat") === "beat").length})` : ""}
            </button>
            {!isViewOnly && activeSidePanelTab === "beats" && (
              <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                <button type="button" onClick={() => appendOutlineItem("act")} style={{ padding: "6px 8px", backgroundColor: "#607D8B", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Add Act</button>
                <button type="button" onClick={() => appendOutlineItem("beat")} style={{ padding: "6px 8px", backgroundColor: "#6D4C41", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Add Beat</button>
                <button type="button" onClick={handleOpenBeatImport} style={{ padding: "6px 10px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Import Beats</button>
              </div>
            )}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {activeSidePanelTab === "scenes" ? (
              <SceneList
                scenes={writingDraftScenes}
                currentSceneNumber={displaySceneNumber}
                sceneRefs={sceneRefs}
                getSceneStatusColor={() => ({ statusLabel: null })}
                selectedProject={selectedProject}
                user={user}
                onSceneNumberChange={null}
                setCurrentIndex={setCurrentIndex}
                showMoodOverlay={showMoodOverlay}
                canCreateScene={false}
                onCreateFirstScene={null}
                canDeleteScene={false}
                onDeleteScene={null}
                onReorderScene={handleWritingSceneListReorder}
                pageStatsBySceneId={writingScenePageStats}
              />
            ) : (
              <BeatsList
                beats={beats}
                onDeleteItem={deleteOutlineItem}
                onReorderItem={reorderOutlineItem}
                onOpenItem={setSelectedBeatDetailId}
                onConvertItem={null}
                onColorItem={!isViewOnly ? handleBeatMarkerColorChange : null}
                collapsedActIds={collapsedActIds}
                onToggleAct={toggleCollapsedAct}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WritingScript;
