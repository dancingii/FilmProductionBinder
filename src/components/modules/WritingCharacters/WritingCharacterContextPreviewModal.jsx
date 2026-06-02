// Read-only screenplay context preview — no editor mounted, no caret interaction.
import React from "react";
import { createPortal } from "react-dom";

// Mirrors ScreenplayPagePreview type layout constants (no import to keep preview isolated).
const TYPE_LAYOUT = {
  "Scene Heading": { leftIn: 0,    widthIn: 6,    textTransform: "uppercase", textAlign: "left" },
  Action:          { leftIn: 0,    widthIn: 6,    textTransform: "none",      textAlign: "left" },
  Character:       { leftIn: 2.62, widthIn: 2.35, textTransform: "uppercase", textAlign: "left" },
  Parenthetical:   { leftIn: 2.28, widthIn: 2.35, textTransform: "none",      textAlign: "left" },
  Dialogue:        { leftIn: 1.35, widthIn: 3.65, textTransform: "none",      textAlign: "left" },
  Transition:      { leftIn: 4.6,  widthIn: 1.8,  textTransform: "uppercase", textAlign: "right" },
  Shot:            { leftIn: 0,    widthIn: 6,    textTransform: "uppercase", textAlign: "left" },
};

const CHARS_PER_LINE = {
  "Scene Heading": 60, Action: 60, Character: 22,
  Parenthetical: 24, Dialogue: 36, Transition: 18, Shot: 60,
};

// Nodes that get a blank line above them.
const HAS_MARGIN_BEFORE = new Set(["Scene Heading", "Character", "Transition", "Shot"]);

function resolveType(type) {
  return TYPE_LAYOUT[type] ? type : "Action";
}

// Rough word-wrap line count for a given type.
function estimateLines(node) {
  const type = resolveType(node?.type);
  const text = String(node?.text || "").replace(/ /g, " ").trim();
  const cpl = CHARS_PER_LINE[type] || 60;
  if (!text) return 1;

  let lines = 1;
  let len = 0;
  for (const word of text.split(/\s+/)) {
    if (len === 0) { len = word.length; }
    else if (len + 1 + word.length <= cpl) { len += 1 + word.length; }
    else { lines++; len = word.length; }
  }
  return (HAS_MARGIN_BEFORE.has(type) ? 1 : 0) + lines;
}

// Walk backward/forward from targetIndex to collect ~1/4 page of whole nodes.
// LINES_PER_PAGE ≈ 54 → 1/4 page ≈ 13 lines. We gather ~7 lines each direction.
const HALF_BUDGET = 7;

function buildPreviewSlice(nodes, targetIndex) {
  if (!Array.isArray(nodes) || targetIndex < 0 || targetIndex >= nodes.length) return [];

  // Walk backward from targetIndex-1
  const before = [];
  let backBudget = HALF_BUDGET;
  for (let i = targetIndex - 1; i >= 0 && backBudget > 0; i--) {
    before.unshift(nodes[i]);
    backBudget -= estimateLines(nodes[i]);
  }

  // Walk forward from targetIndex (inclusive)
  const after = [];
  let fwdBudget = HALF_BUDGET + 4; // a bit more forward to capture full dialogue exchange
  for (let i = targetIndex; i < nodes.length && fwdBudget > 0; i++) {
    after.push(nodes[i]);
    fwdBudget -= estimateLines(nodes[i]);
  }

  return [...before, ...after];
}

function ScreenplayLine({ node, isTarget }) {
  const type = resolveType(node?.type);
  const layout = TYPE_LAYOUT[type];
  const text = String(node?.text || "").replace(/#\d+#\s*$/, "").trimEnd();
  const hasMargin = HAS_MARGIN_BEFORE.has(type);

  return (
    <div
      style={{
        marginTop: hasMargin ? "12pt" : 0,
        paddingLeft: `${layout.leftIn}in`,
        maxWidth: `${layout.leftIn + layout.widthIn}in`,
        textTransform: layout.textTransform,
        textAlign: layout.textAlign,
        backgroundColor: isTarget ? "rgba(255, 215, 60, 0.35)" : "transparent",
        borderRadius: isTarget ? "2px" : 0,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    >
      {text || " "}
    </div>
  );
}

export default function WritingCharacterContextPreviewModal({
  nodes,
  firstNodeIndex,
  pageNumber,
  characterName,
  onClose,
}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const targetNode = safeNodes[firstNodeIndex] || null;
  const previewSlice = buildPreviewSlice(safeNodes, firstNodeIndex);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100001,
        backgroundColor: "rgba(0,0,0,0.52)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", boxSizing: "border-box",
        fontFamily: "'Questrial','Futura','Arial',sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: "white", borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          width: "min(680px, calc(100vw - 48px))",
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px 10px", borderBottom: "1px solid #e0e0e0", flexShrink: 0,
            display: "flex", alignItems: "baseline", gap: "8px",
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1a1a2e" }}>
            {characterName}
          </span>
          {pageNumber != null && (
            <span style={{ fontSize: "11px", color: "#888" }}>
              — first appears on page {pageNumber}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: "11px", padding: "3px 10px", cursor: "pointer",
              border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5",
            }}
          >
            Close
          </button>
        </div>

        {/* Screenplay preview */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px", backgroundColor: "#f4f5f7" }}>
          <div
            style={{
              backgroundColor: "white",
              padding: "36px 20px 36px 8px",
              borderRadius: "3px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.09)",
              fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
              fontSize: "12pt",
              lineHeight: "12pt",
              color: "#000",
              minWidth: "6in",
              overflowX: "auto",
            }}
          >
            {previewSlice.length === 0 ? (
              <div style={{ color: "#aaa", fontSize: "11px", textAlign: "center" }}>No preview available.</div>
            ) : (
              previewSlice.map((node, i) => (
                <ScreenplayLine
                  key={node?.id || i}
                  node={node}
                  isTarget={node === targetNode}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
