export const WORKFLOWS = [
  { id: "writing", label: "Writing", enabled: true },
  { id: "pitching", label: "Pitching", enabled: false, badge: "Coming Soon" },
  { id: "preProduction", label: "Pre-Production", enabled: true },
  { id: "production", label: "Production", enabled: true },
  { id: "postProduction", label: "Post-Production", enabled: false, badge: "Coming Soon" },
];

export const getWorkflowById = (workflowId) =>
  WORKFLOWS.find((workflow) => workflow.id === workflowId) || WORKFLOWS[0];
