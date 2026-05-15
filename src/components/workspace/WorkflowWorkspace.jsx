import React from "react";
import ComingSoonWorkspace from "./ComingSoonWorkspace";
import PreProductionWorkspace from "./PreProductionWorkspace";
import ProductionWorkspace from "./ProductionWorkspace";
import WritingWorkspace from "./WritingWorkspace";
import { getWorkflowById } from "./workflowConfig";

function WorkflowWorkspace({ activeWorkflow, children }) {
  const workflow = getWorkflowById(activeWorkflow);

  if (!workflow?.enabled) {
    return <ComingSoonWorkspace title={workflow?.label || "Workflow"} />;
  }

  switch (workflow.id) {
    case "writing":
      return <WritingWorkspace>{children}</WritingWorkspace>;
    case "preProduction":
      return <PreProductionWorkspace>{children}</PreProductionWorkspace>;
    case "production":
      return <ProductionWorkspace>{children}</ProductionWorkspace>;
    default:
      return <>{children}</>;
  }
}

export default WorkflowWorkspace;
