import React, { useRef, useState } from "react";
import WritingBeatsPanel from "./WritingBeatsPanel";
import WritingSceneList from "./WritingSceneList";
import WritingScriptEditor from "./WritingScriptEditor";
import WritingSettingsModal from "./WritingSettingsModal";
import WritingTimelinePanel from "./WritingTimelinePanel";
import { SCRIPT_WRITING_NODE_TYPES, createEmptySceneHeadingNode, createEmptyWritingNode } from "./writingDraftModel";
import useWritingDraftState from "./useWritingDraftState";

const WRITING_SCRIPT_SURFACES = [
  { name: "WritingTimelinePanel", Component: WritingTimelinePanel },
  { name: "WritingScriptEditor", Component: WritingScriptEditor },
  { name: "WritingSceneList", Component: WritingSceneList },
  { name: "WritingBeatsPanel", Component: WritingBeatsPanel },
  { name: "WritingSettingsModal", Component: WritingSettingsModal },
];

// Future isolated writing/draft script shell.
// This is not routed yet; active runtime still lives in the legacy mixed Script module.
// When activated later, this component must receive writing-safe props only.
function WritingScript({ selectedProject = null, previewMode = null, previewShell = false }) {
  const isEditorPreview = previewMode === "editor";
  const sceneRefs = useRef([]);
  const [activeElementType, setActiveElementType] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [, setWritingScenePageStats] = useState({});
  const {
    writingDraftNodes,
    writingDraftSaveStatus,
    handleWritingDraftNodesChange,
  } = useWritingDraftState(isEditorPreview ? selectedProject : null);

  if (!isEditorPreview && !previewShell) return null;

  if (!isEditorPreview) {
    return (
      <div data-writing-script-shell="preview" style={{ display: "none" }}>
        {WRITING_SCRIPT_SURFACES.map(({ name }) => (
          <span key={name} data-writing-script-surface={name} />
        ))}
      </div>
    );
  }

  const hasScript = writingDraftNodes.length > 0;

  const handleCreateWritingDraft = () => {
    const headingNode = createEmptySceneHeadingNode();
    const bodyNode = createEmptyWritingNode("Action", headingNode.sceneId);
    handleWritingDraftNodesChange([headingNode, bodyNode]);
  };

  const saveStatusLabel =
    writingDraftSaveStatus === "saving"
      ? "Saving..."
      : writingDraftSaveStatus === "unsaved"
        ? "Unsaved"
        : writingDraftSaveStatus === "error"
          ? "Save error"
          : "Saved";

  return (
    <div
      data-writing-script-shell="editor-preview"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
      }}
    >
      {/* Writing toolbar */}
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "40px",
          minHeight: "40px",
          padding: "0 12px",
          borderBottom: "1px solid #e0e0e0",
          boxSizing: "border-box",
          backgroundColor: "#fafafa",
        }}
      >
        {/* Left: New Script or Element selector */}
        {!hasScript ? (
          <button
            type="button"
            onClick={handleCreateWritingDraft}
            style={{
              padding: "4px 12px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            New Script
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                fontSize: "11px",
                color: "#777",
                fontWeight: "bold",
                fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Element
            </span>
            <select
              value={activeElementType || ""}
              disabled={!activeElementType}
              onChange={(e) => setActiveElementType(e.target.value)}
              style={{
                fontSize: "11px",
                padding: "3px 5px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                minWidth: "120px",
                backgroundColor: activeElementType ? "white" : "#f5f5f5",
                fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
              }}
            >
              {!activeElementType && <option value="">—</option>}
              {SCRIPT_WRITING_NODE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Page count */}
        {pageCount > 0 && (
          <span
            style={{
              fontSize: "11px",
              color: "#999",
              minWidth: "44px",
              textAlign: "right",
              whiteSpace: "nowrap",
              fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
            }}
          >
            {pageCount} {pageCount === 1 ? "pg" : "pgs"}
          </span>
        )}

        {/* Save status — fixed width to prevent layout shift */}
        <span
          style={{
            width: "68px",
            minWidth: "68px",
            fontSize: "11px",
            color: writingDraftSaveStatus === "error" ? "#c62828" : "#999",
            whiteSpace: "nowrap",
            textAlign: "right",
            fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
          }}
        >
          {saveStatusLabel}
        </span>
      </div>

      {/* Editor area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
          fontSize: "12pt",
          lineHeight: "12pt",
        }}
      >
        <WritingScriptEditor
          initialNodes={writingDraftNodes}
          activeElementType={activeElementType}
          onActiveElementTypeChange={setActiveElementType}
          onNodesChange={handleWritingDraftNodesChange}
          onPageCountChange={setPageCount}
          sceneRefs={sceneRefs}
          onSceneStatsChange={setWritingScenePageStats}
          showSceneNumbers
          showFloatingElementSelector={false}
        />
      </div>
    </div>
  );
}

export default WritingScript;
