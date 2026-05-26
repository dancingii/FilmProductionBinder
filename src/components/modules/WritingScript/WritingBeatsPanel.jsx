import React, { useEffect, useState } from "react";
import { APP_TAB_BLUE } from "../../../utils/scenePresentation";

// Color system mirrors Script Breakdown's BEAT_MENU_COLORS exactly.
const BEAT_MENU_COLORS = {
  default: { label: "Default", background: "white", border: "#e5e5e5", swatch: "#C9D6DE" },
  red: { label: "Red", background: "#FFEBEE", border: "#EF9A9A", swatch: "#EF9A9A" },
  orange: { label: "Orange", background: "#FFF3E0", border: "#FFCC80", swatch: "#FFCC80" },
  yellow: { label: "Yellow", background: "#FFFDE7", border: "#FFE082", swatch: "#FFE082" },
  green: { label: "Green", background: "#E8F5E9", border: "#A5D6A7", swatch: "#A5D6A7" },
  blue: { label: "Blue", background: "#E3F2FD", border: "#90CAF9", swatch: "#90CAF9" },
  purple: { label: "Purple", background: "#F3E5F5", border: "#CE93D8", swatch: "#CE93D8" },
};

// Pure display component — state is owned by WritingScript.
// Mirrors Script Breakdown's BeatsList, omitting "Convert to Scene" (Writing-only).
function WritingBeatsPanel({
  beats = [],
  onDeleteItem = null,
  onReorderItem = null,
  onOpenItem = null,
  onColorItem = null,
  collapsedActIds = {},
  onToggleAct = null,
}) {
  const orderedItems = [...beats].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  const beatCount = orderedItems.filter(item => (item.type || "beat") === "beat").length;
  const actCount = orderedItems.filter(item => item.type === "act").length;

  const [dragState, setDragState] = useState({ draggedId: null, overId: null, position: "before" });
  const [beatContextMenu, setBeatContextMenu] = useState(null);

  useEffect(() => {
    if (!beatContextMenu) return;
    const handleEsc = (e) => { if (e.key === "Escape") setBeatContextMenu(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [beatContextMenu]);

  let beatDisplayNumber = 0;

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (itemId, position) => {
    if (dragState.overId !== itemId || dragState.position !== position) return undefined;
    return `2px solid ${APP_TAB_BLUE}`;
  };

  const handleDragStart = (event, itemId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDragState({ draggedId: itemId, overId: null, position: "before" });
  };

  const handleDragOver = (event, itemId) => {
    event.preventDefault();
    const position = getDropPosition(event);
    setDragState(prev =>
      prev.overId === itemId && prev.position === position
        ? prev
        : { ...prev, overId: itemId, position }
    );
  };

  const handleDrop = (event, targetId) => {
    event.preventDefault();
    const draggedId = dragState.draggedId || event.dataTransfer.getData("text/plain");
    const position = getDropPosition(event);
    setDragState({ draggedId: null, overId: null, position: "before" });
    onReorderItem?.(draggedId, targetId, position);
  };

  const clearDragState = () => {
    setDragState({ draggedId: null, overId: null, position: "before" });
  };

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        style={{
          width: "492px",
          border: "2px inset #ccc",
          backgroundColor: "white",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          fontSize: "12px",
          overflowY: "auto",
          overflowX: "hidden",
          flex: 1,
        }}
      >
        {/* Panel header — matches BeatsList header */}
        <div
          style={{
            padding: "8px",
            borderBottom: "1px solid #e5e5e5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <strong>Outline</strong>
          <span style={{ fontSize: "11px", color: "#777" }}>
            {beatCount} beats{actCount ? `, ${actCount} acts` : ""}
          </span>
        </div>

        {orderedItems.length === 0 ? (
          <div style={{ padding: "16px", color: "#777", lineHeight: 1.45 }}>
            No beats yet. Use Add Beat above to start outlining.
          </div>
        ) : (
          orderedItems.map((item, index) => {
            const previousAct = orderedItems.slice(0, index).reverse().find(o => o.type === "act");
            const isHiddenByCollapsedAct = (item.type || "beat") === "beat" && previousAct && collapsedActIds[previousAct.id];

            if (item.type === "act") {
              const isCollapsed = Boolean(collapsedActIds[item.id]);
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, item.id)}
                  onDragOver={(event) => handleDragOver(event, item.id)}
                  onDrop={(event) => handleDrop(event, item.id)}
                  onDragEnd={clearDragState}
                  style={{
                    padding: "10px 10px",
                    borderTop: getDropBorderStyle(item.id, "before"),
                    borderBottom: getDropBorderStyle(item.id, "after") || "1px solid #b0bec5",
                    backgroundColor: dragState.draggedId === item.id ? "#B0BEC5" : "#CFD8DC",
                    color: "#263238",
                    fontWeight: "bold",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "grab",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleAct?.(item.id)}
                    title={isCollapsed ? "Expand act" : "Collapse act"}
                    style={{
                      width: "22px",
                      height: "22px",
                      border: "1px solid #90A4AE",
                      borderRadius: "3px",
                      backgroundColor: "white",
                      color: "#455A64",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                      lineHeight: "18px",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    {isCollapsed ? ">" : "v"}
                  </button>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteItem?.(item.id)}
                    title="Delete act"
                    style={{
                      width: "22px",
                      height: "22px",
                      border: "1px solid #c62828",
                      borderRadius: "3px",
                      backgroundColor: "#c62828",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                      lineHeight: "18px",
                      padding: 0,
                    }}
                  >
                    x
                  </button>
                </div>
              );
            }

            beatDisplayNumber += 1;
            if (isHiddenByCollapsedAct) return null;
            const beatColor = BEAT_MENU_COLORS[item.markerColor] || null;

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(event) => handleDragStart(event, item.id)}
                onDragOver={(event) => handleDragOver(event, item.id)}
                onDrop={(event) => handleDrop(event, item.id)}
                onDragEnd={clearDragState}
                onDoubleClick={() => onOpenItem?.(item.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBeatContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id, title: item.title });
                }}
                title="Double-click to edit beat"
                style={{
                  padding: "10px",
                  borderTop: getDropBorderStyle(item.id, "before"),
                  borderBottom: getDropBorderStyle(item.id, "after") || `1px solid ${beatColor?.border || "#eee"}`,
                  borderLeft: beatColor ? `3px solid ${beatColor.border}` : undefined,
                  backgroundColor: dragState.draggedId === item.id
                    ? "#ECEFF1"
                    : beatColor?.background || "white",
                  cursor: "grab",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "5px" }}>
                  <span
                    style={{
                      fontSize: "8px",
                      color: "#777",
                      fontVariantNumeric: "tabular-nums",
                      minWidth: "22px",
                    }}
                  >
                    #{beatDisplayNumber}
                  </span>
                  <strong
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "11px",
                      color: "#222",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title || `Beat ${beatDisplayNumber}`}
                  </strong>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onDeleteItem?.(item.id); }}
                    onDoubleClick={(event) => event.stopPropagation()}
                    title="Delete beat"
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "1px solid #c62828",
                      borderRadius: "3px",
                      backgroundColor: "#c62828",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontWeight: "bold",
                      lineHeight: "16px",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    x
                  </button>
                </div>
                <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#444", whiteSpace: "pre-wrap" }}>
                  {item.description || ""}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Context menu — right-click on beat row */}
      {beatContextMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 2999 }}
            onClick={() => setBeatContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: beatContextMenu.x,
              top: beatContextMenu.y,
              zIndex: 3000,
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              minWidth: "190px",
              overflow: "hidden",
              fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
              fontSize: "12px",
            }}
          >
            <div
              style={{
                padding: "6px 12px 5px",
                fontSize: "11px",
                color: "#999",
                borderBottom: "1px solid #f0f0f0",
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "220px",
              }}
            >
              {beatContextMenu.title || "Untitled Beat"}
            </div>
            <div
              onClick={() => { setBeatContextMenu(null); onOpenItem?.(beatContextMenu.itemId); }}
              style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
            >
              Open Details
            </div>
            {onColorItem && (
              <>
                <div
                  onClick={() => setBeatContextMenu(prev => ({ ...prev, showColors: !prev.showColors }))}
                  style={{
                    padding: "7px 12px",
                    cursor: "pointer",
                    borderBottom: beatContextMenu.showColors ? "none" : "1px solid #f5f5f5",
                  }}
                >
                  Change Color
                </div>
                {beatContextMenu.showColors && (
                  <div style={{ padding: "4px 0", borderBottom: "1px solid #f5f5f5", backgroundColor: "#fafafa" }}>
                    {Object.entries(BEAT_MENU_COLORS).map(([colorKey, option]) => {
                      const beat = orderedItems.find(o => o.id === beatContextMenu.itemId);
                      const selected = (beat?.markerColor || "default") === colorKey;
                      return (
                        <div
                          key={colorKey}
                          onClick={() => { setBeatContextMenu(null); onColorItem(beatContextMenu.itemId, colorKey); }}
                          style={{
                            padding: "5px 12px 5px 18px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "11px",
                            backgroundColor: selected ? "#eef5ff" : "transparent",
                          }}
                        >
                          <span
                            style={{
                              width: "11px",
                              height: "11px",
                              borderRadius: "50%",
                              backgroundColor: option.swatch,
                              border: `1px solid ${option.border}`,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1 }}>{option.label}</span>
                          {selected && <span style={{ color: "#607D8B", fontWeight: "bold" }}>Selected</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <div
              onClick={() => { setBeatContextMenu(null); onDeleteItem?.(beatContextMenu.itemId); }}
              style={{ padding: "7px 12px", cursor: "pointer", color: "#c62828" }}
            >
              Delete Beat
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WritingBeatsPanel;
