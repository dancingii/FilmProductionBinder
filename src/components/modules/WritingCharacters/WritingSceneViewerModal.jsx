// Full paginated script viewer for Writing Characters module.
// Read-only — committed Writing nodes only. No live editor dependency.
// No screenplay text mutation. No save triggered. No WritingScript dependency.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  paginateScreenplayNodes,
  getScreenplayNodeStyle,
  normalizeScreenplayNodeType,
} from "../../../utils/screenplayPagination";

// ─── Screenplay rendering constants ───────────────────────────────────────────

const PAGE_WIDTH = "8.5in";
const PAGE_PADDING_V = "1in";
const PAGE_PADDING_H_LEFT = "1.4in";
const PAGE_PADDING_H_RIGHT = "1in";

// Strip trailing scene-number stamp (#N#) from heading text.
const cleanText = (text) => String(text || "").replace(/#\d+#\s*$/, "").trimEnd();

// ─── ScreenplayNode ────────────────────────────────────────────────────────────

function ScreenplayNode({ node, prevNode, nextNode, isHighlighted }) {
  const type = normalizeScreenplayNodeType(node?.type);
  const style = getScreenplayNodeStyle(node, prevNode, nextNode);
  const text = cleanText(node?.text);

  return (
    <div
      data-node-index={node?.__viewerIndex}
      data-scene-index={node?.__sceneHeadingIndex}
      style={{
        ...style,
        fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
        fontSize: "12pt",
        lineHeight: "12pt",
        color: "#000",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        boxSizing: "border-box",
        backgroundColor: isHighlighted ? "rgba(26,26,46,0.07)" : "transparent",
        borderRadius: isHighlighted ? "2px" : 0,
        outline: isHighlighted ? "2px solid rgba(26,26,46,0.18)" : "none",
      }}
    >
      {text || " "}
    </div>
  );
}

// ─── WritingSceneViewerModal ───────────────────────────────────────────────────
// Props:
//   allNodes              — committed Writing draft nodes (read-only)
//   characterSceneIndices — sorted array of scene-heading indices for this character
//   initialSceneIndexPos  — index within characterSceneIndices to open at
//   scenes                — scene objects (for heading/number display)
//   characterName         — displayed in header
//   onClose

export default function WritingSceneViewerModal({
  allNodes,
  characterSceneIndices,
  initialSceneIndexPos,
  scenes,
  characterName,
  onClose,
}) {
  const safeNodes = Array.isArray(allNodes) ? allNodes : [];
  const safeIndices = Array.isArray(characterSceneIndices) && characterSceneIndices.length > 0
    ? characterSceneIndices : [];

  // pos = index within safeIndices (character's scenes)
  const [pos, setPos] = useState(initialSceneIndexPos ?? 0);
  const currentSceneIndex = safeIndices[pos] ?? -1;
  const scrollAreaRef = useRef(null);

  // ── Paginate once ──────────────────────────────────────────────────────────
  // Annotate nodes with __viewerIndex for DOM targeting.
  const annotatedNodes = useMemo(() =>
    safeNodes.map((node, i) => ({ ...node, __viewerIndex: i })),
    [safeNodes]
  );

  const pages = useMemo(
    () => paginateScreenplayNodes(annotatedNodes),
    [annotatedNodes]
  );

  // Build map: sceneHeadingIndex (0-based count of Scene Heading nodes) → nodeIndex
  // Also build reverse: nodeIndex → sceneHeadingIndex
  const { headingIndexToNodeIndex, nodeIndexToHeadingIndex } = useMemo(() => {
    const h2n = {}; // headingIndex → nodeIndex
    const n2h = {}; // nodeIndex → headingIndex
    let count = 0;
    for (let i = 0; i < safeNodes.length; i++) {
      if (safeNodes[i]?.type === "Scene Heading") {
        h2n[count] = i;
        n2h[i] = count;
        count++;
      }
    }
    return { headingIndexToNodeIndex: h2n, nodeIndexToHeadingIndex: n2h };
  }, [safeNodes]);

  // The node index of the currently selected scene heading
  const selectedNodeIndex = currentSceneIndex >= 0
    ? (headingIndexToNodeIndex[currentSceneIndex] ?? -1)
    : -1;

  // Current scene display info
  const currentScene = currentSceneIndex >= 0 && Array.isArray(scenes)
    ? scenes[currentSceneIndex] : null;
  const currentHeadingText = currentScene?.heading
    || (selectedNodeIndex >= 0 ? cleanText(safeNodes[selectedNodeIndex]?.text) : "");

  // ── Scroll to selected scene heading ──────────────────────────────────────
  useEffect(() => {
    if (selectedNodeIndex < 0 || !scrollAreaRef.current) return;
    // Small delay so the DOM has painted
    const t = setTimeout(() => {
      const el = scrollAreaRef.current?.querySelector(
        `[data-node-index="${selectedNodeIndex}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [selectedNodeIndex]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && pos > 0) setPos((p) => p - 1);
      if (e.key === "ArrowRight" && pos < safeIndices.length - 1) setPos((p) => p + 1);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose, pos, safeIndices.length]);

  const canPrev = pos > 0;
  const canNext = pos < safeIndices.length - 1;

  // ── Render pages ───────────────────────────────────────────────────────────
  const renderedPages = useMemo(() => {
    return pages.map((pageEntries, pageIdx) => {
      // Get the full node list for this page (entries carry node + original index)
      const pageNodes = pageEntries.map((entry) => annotatedNodes[entry.index]);
      return { pageIdx, pageNodes, pageEntries };
    });
  }, [pages, annotatedNodes]);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100010,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", boxSizing: "border-box",
        fontFamily: "'Questrial','Futura','Arial',sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "white", borderRadius: "8px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.38)",
          width: "min(900px, calc(100vw - 48px))",
          maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header bar ── */}
        <div style={{
          backgroundColor: "#1a1a2e", color: "white",
          padding: "12px 18px",
          display: "flex", alignItems: "center", gap: "12px",
          flexShrink: 0,
        }}>
          {/* Prev */}
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setPos((p) => p - 1)}
            title="Previous scene (←)"
            style={{
              fontSize: "13px", padding: "4px 12px", cursor: canPrev ? "pointer" : "default",
              border: `1px solid ${canPrev ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}`,
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: canPrev ? "white" : "rgba(255,255,255,0.3)",
              flexShrink: 0,
            }}
          >← Prev</button>

          {/* Scene info */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {characterName}
              {currentScene ? ` — Scene ${currentScene.sceneNumber ?? currentSceneIndex + 1}` : ""}
            </div>
            {currentHeadingText && (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentHeadingText}
              </div>
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setPos((p) => p + 1)}
            title="Next scene (→)"
            style={{
              fontSize: "13px", padding: "4px 12px", cursor: canNext ? "pointer" : "default",
              border: `1px solid ${canNext ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"}`,
              borderRadius: "4px",
              backgroundColor: "transparent",
              color: canNext ? "white" : "rgba(255,255,255,0.3)",
              flexShrink: 0,
            }}
          >Next →</button>

          {/* Counter */}
          {safeIndices.length > 0 && (
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {pos + 1} / {safeIndices.length}
            </span>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: "18px", lineHeight: 1, padding: "2px 6px", cursor: "pointer",
              border: "none", backgroundColor: "transparent", color: "rgba(255,255,255,0.7)",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* ── Script area ── */}
        <div
          ref={scrollAreaRef}
          style={{
            flex: 1, overflowY: "auto", overflowX: "auto",
            backgroundColor: "#e8e8e8",
            padding: "24px 20px",
            boxSizing: "border-box",
          }}
        >
          {renderedPages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#aaa", fontSize: "13px", marginTop: "40px" }}>
              No script content.
            </div>
          ) : (
            renderedPages.map(({ pageIdx, pageNodes, pageEntries }) => (
              <ScriptPage
                key={pageIdx}
                pageNumber={pageIdx + 1}
                pageNodes={pageNodes}
                allAnnotatedNodes={annotatedNodes}
                pageEntries={pageEntries}
                selectedNodeIndex={selectedNodeIndex}
              />
            ))
          )}
        </div>

        {/* ── Footer nav ── */}
        {safeIndices.length > 1 && (
          <div style={{
            padding: "10px 18px", borderTop: "1px solid #e0e0e0", flexShrink: 0,
            display: "flex", gap: "10px", alignItems: "center", backgroundColor: "white",
          }}>
            <button type="button" disabled={!canPrev} onClick={() => setPos((p) => p - 1)}
              style={{ fontSize: "12px", padding: "5px 16px", cursor: canPrev ? "pointer" : "default", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: canPrev ? "#f5f5f5" : "#fafafa", color: canPrev ? "#222" : "#bbb" }}>
              ← Prev Scene
            </button>
            <span style={{ fontSize: "11px", color: "#888", flex: 1, textAlign: "center" }}>
              {safeIndices.length} scene{safeIndices.length !== 1 ? "s" : ""} for {characterName} · scene {pos + 1} of {safeIndices.length}
            </span>
            <button type="button" disabled={!canNext} onClick={() => setPos((p) => p + 1)}
              style={{ fontSize: "12px", padding: "5px 16px", cursor: canNext ? "pointer" : "default", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: canNext ? "#f5f5f5" : "#fafafa", color: canNext ? "#222" : "#bbb" }}>
              Next Scene →
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── ScriptPage ────────────────────────────────────────────────────────────────
// Renders one paginated page as a white "sheet" with page number.

function ScriptPage({ pageNumber, pageNodes, allAnnotatedNodes, pageEntries, selectedNodeIndex }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      {/* Page number marker */}
      <div style={{
        textAlign: "right", fontSize: "10px", color: "#aaa",
        fontFamily: "'Questrial','Futura','Arial',sans-serif",
        paddingRight: "4px", marginBottom: "4px",
        userSelect: "none",
      }}>
        {pageNumber}
      </div>

      {/* Page sheet */}
      <div style={{
        backgroundColor: "white",
        width: PAGE_WIDTH,
        maxWidth: "100%",
        minHeight: "11in",
        padding: `${PAGE_PADDING_V} ${PAGE_PADDING_H_RIGHT} ${PAGE_PADDING_V} ${PAGE_PADDING_H_LEFT}`,
        boxSizing: "border-box",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        borderRadius: "2px",
        margin: "0 auto",
        overflowX: "auto",
      }}>
        {pageNodes.map((node, i) => {
          if (!node) return null;
          const nodeIdx = node.__viewerIndex;
          const prevNode = nodeIdx > 0 ? allAnnotatedNodes[nodeIdx - 1] : null;
          const nextNode = nodeIdx < allAnnotatedNodes.length - 1 ? allAnnotatedNodes[nodeIdx + 1] : null;
          const isHighlighted = node?.type === "Scene Heading" && nodeIdx === selectedNodeIndex;
          return (
            <ScreenplayNode
              key={nodeIdx}
              node={node}
              prevNode={prevNode}
              nextNode={nextNode}
              isHighlighted={isHighlighted}
            />
          );
        })}
      </div>
    </div>
  );
}
