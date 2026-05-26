import React from "react";

function ComingSoonWorkspace({ title = "Workflow" }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "44px",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f7f9fc",
        fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "360px",
          maxWidth: "calc(100vw - 48px)",
          padding: "24px",
          border: "1px solid #d9e2ef",
          borderRadius: "8px",
          backgroundColor: "white",
          textAlign: "center",
          boxSizing: "border-box",
          boxShadow: "0 6px 20px rgba(25, 80, 140, 0.08)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#263238" }}>
          {title}
        </h2>
        <div style={{ fontSize: "13px", color: "#607D8B", fontWeight: "bold" }}>
          Coming Soon
        </div>
      </div>
    </div>
  );
}

export default ComingSoonWorkspace;

