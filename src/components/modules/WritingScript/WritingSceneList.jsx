import React from "react";

const formatScenePageLength = (pageLength) => {
  const numericLength = Number(pageLength);
  if (!Number.isFinite(numericLength) || numericLength <= 0) return null;
  const eighths = Math.max(1, Math.round(numericLength * 8));
  const wholePages = Math.floor(eighths / 8);
  const remainingEighths = eighths % 8;
  if (wholePages > 0 && remainingEighths > 0) return `${wholePages} ${remainingEighths}/8`;
  if (wholePages > 0) return String(wholePages);
  return `${remainingEighths}/8`;
};

function WritingSceneList({ scenes = [], scenePageStats = {}, sceneRefs = null }) {
  const handleSceneClick = (index) => {
    if (!sceneRefs?.current) return;
    const el = sceneRefs.current[index];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (scenes.length === 0) {
    return (
      <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            width: "492px",
            border: "2px inset #ccc",
            backgroundColor: "white",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
            fontSize: "12px",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "18px",
            boxSizing: "border-box",
            color: "#555",
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#222", marginBottom: "8px" }}>
            No scenes yet
          </div>
          <div>Use New Script to create the first scene.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          width: "492px",
          border: "2px inset #ccc",
          backgroundColor: "white",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          fontSize: "12px",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {scenes.map((scene, index) => {
          const stats = scenePageStats[scene.id] || null;
          const pageNumber = stats?.pageNumber ?? null;
          const pageLength = formatScenePageLength(stats?.timelinePageLength ?? stats?.pageLength ?? null);

          return (
            <div
              key={scene.id || index}
              onClick={() => handleSceneClick(index)}
              style={{
                padding: "3px 8px",
                cursor: "pointer",
                userSelect: "none",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "white",
                color: "#222",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#E3F2FD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <strong style={{ fontSize: "13px" }}>{scene.sceneNumber}</strong>
                {" – "}
                {scene.heading || <em style={{ color: "#aaa", fontWeight: "normal" }}>Untitled</em>}
              </span>
              {pageNumber !== null && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "#888",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    flexShrink: 0,
                    textAlign: "right",
                    minWidth: "28px",
                  }}
                >
                  Pg {pageNumber}
                </span>
              )}
              {pageLength !== null && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "#888",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    flexShrink: 0,
                    textAlign: "right",
                    minWidth: "28px",
                  }}
                >
                  {pageLength}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WritingSceneList;
