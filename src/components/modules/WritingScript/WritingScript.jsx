import React, { useRef, useState } from "react";
import WritingBeatsPanel from "./WritingBeatsPanel";
import WritingSceneList from "./WritingSceneList";
import WritingScriptEditor from "./WritingScriptEditor";
import WritingSettingsModal from "./WritingSettingsModal";
import WritingTimelinePanel from "./WritingTimelinePanel";
import { createEmptySceneHeadingNode, createEmptyWritingNode } from "./writingDraftModel";
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

  const handleCreateWritingDraft = () => {
    const headingNode = createEmptySceneHeadingNode();
    const bodyNode = createEmptyWritingNode("Action", headingNode.sceneId);
    handleWritingDraftNodesChange([headingNode, bodyNode]);
  };

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
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minHeight: "38px",
          padding: "5px 12px",
          borderBottom: "1px solid #eee",
          boxSizing: "border-box",
        }}
      >
        {writingDraftNodes.length === 0 && (
          <button
            type="button"
            onClick={handleCreateWritingDraft}
            style={{
              padding: "6px 14px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
            }}
          >
            New Script
          </button>
        )}
        <span
          style={{
            width: "72px",
            minWidth: "72px",
            fontSize: "11px",
            color: writingDraftSaveStatus === "error" ? "#c62828" : "#777",
            whiteSpace: "nowrap",
          }}
        >
          {writingDraftSaveStatus === "saving"
            ? "Saving..."
            : writingDraftSaveStatus === "unsaved"
              ? "Unsaved"
              : writingDraftSaveStatus === "error"
                ? "Save error"
                : "Saved"}
        </span>
      </div>

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
          sceneRefs={sceneRefs}
          onSceneStatsChange={setWritingScenePageStats}
          showSceneNumbers
        />
      </div>
    </div>
  );
}

export default WritingScript;
