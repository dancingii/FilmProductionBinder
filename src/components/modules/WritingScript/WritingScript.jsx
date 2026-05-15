import React from "react";
import WritingBeatsPanel from "./WritingBeatsPanel";
import WritingSceneList from "./WritingSceneList";
import WritingScriptEditor from "./WritingScriptEditor";
import WritingSettingsModal from "./WritingSettingsModal";
import WritingTimelinePanel from "./WritingTimelinePanel";

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
function WritingScript({ previewShell = false }) {
  if (!previewShell) return null;

  return (
    <div data-writing-script-shell="preview" style={{ display: "none" }}>
      {WRITING_SCRIPT_SURFACES.map(({ name }) => (
        <span key={name} data-writing-script-surface={name} />
      ))}
    </div>
  );
}

export default WritingScript;
