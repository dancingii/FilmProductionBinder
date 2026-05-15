import React from "react";
import LegacyScriptModule from "../Script/Script";

// Temporary compatibility wrapper. Production-facing Script Breakdown still
// renders the legacy mixed Script module until the production logic is extracted.
function ScriptBreakdown(props) {
  return <LegacyScriptModule {...props} />;
}

export default ScriptBreakdown;
