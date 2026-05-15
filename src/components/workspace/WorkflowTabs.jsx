import React from "react";
import { WORKFLOWS } from "./workflowConfig";

function WorkflowTabs({ activeWorkflow, onWorkflowChange }) {
  return (
    <div
      role="tablist"
      aria-label="Workflow phases"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${WORKFLOWS.length}, 128px)`,
        gap: "4px",
        alignItems: "center",
        justifyContent: "center",
        height: "28px",
      }}
    >
      {WORKFLOWS.map((workflow) => {
        const isActive = workflow.id === activeWorkflow;
        const isDisabled = !workflow.enabled;

        return (
          <button
            key={workflow.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            title={isDisabled ? `${workflow.label} - ${workflow.badge}` : workflow.label}
            onClick={() => {
              if (!isDisabled) onWorkflowChange(workflow.id);
            }}
            style={{
              width: "128px",
              height: "28px",
              padding: "0 8px",
              borderRadius: "4px",
              border: isActive ? "1px solid white" : "1px solid rgba(255,255,255,0.55)",
              backgroundColor: isActive ? "white" : "rgba(255,255,255,0.12)",
              color: isActive ? "#1976D2" : isDisabled ? "rgba(255,255,255,0.5)" : "white",
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: 1,
              boxSizing: "border-box",
              fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
              fontSize: "12px",
              fontWeight: "bold",
              lineHeight: 1,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
            }}
          >
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
              {workflow.label}
            </span>
            {isDisabled && (
              <span
                style={{
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: "8px",
                  lineHeight: 1,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {workflow.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default WorkflowTabs;
