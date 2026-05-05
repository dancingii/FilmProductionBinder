import React, { useMemo, useRef, useState } from "react";
import {
  DEFAULT_TARGET_PAGES,
  getSceneTimelineData,
  getTotalWrittenPages,
} from "./writingTimelineUtils";

function WritingTimeline({
  scenes = [],
  currentSceneNumber,
  setCurrentIndex,
  sceneRefs,
  targetPages = DEFAULT_TARGET_PAGES,
  onEditTargetPages,
  onSceneMove,
  onSceneOpen,
}) {
  const timelineBarRef = useRef(null);
  const [draggingSceneKey, setDraggingSceneKey] = useState(null);

  const timelineData = useMemo(() => {
    return getSceneTimelineData(scenes, targetPages);
  }, [scenes, targetPages]);

  const totalWrittenPages = useMemo(() => {
    return getTotalWrittenPages(scenes);
  }, [scenes]);

  const remainingPages = Math.max(0, targetPages - totalWrittenPages);
  const writtenPercent = Math.min(100, (totalWrittenPages / targetPages) * 100);

  const scrollToScene = (index) => {
    setCurrentIndex?.(index);

    const el = sceneRefs?.current?.[index];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const getPageFromPointer = (clientX, pageLength = 0) => {
    const rect = timelineBarRef.current?.getBoundingClientRect();
    if (!rect) return 0;

    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const rawPage = (x / rect.width) * targetPages;
    const clampedPage = Math.min(
      Math.max(0, rawPage),
      Math.max(0, targetPages - pageLength)
    );

    return Math.round(clampedPage * 8) / 8;
  };

  const startDrag = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    const sceneKey = `${item.scene.sceneNumber}-${item.index}`;
    setDraggingSceneKey(sceneKey);

    const handleMove = (moveEvent) => {
      const nextStartPage = getPageFromPointer(moveEvent.clientX, item.pageLength);
      onSceneMove?.(item.index, nextStartPage);
    };

    const handleUp = (upEvent) => {
      const nextStartPage = getPageFromPointer(upEvent.clientX, item.pageLength);
      onSceneMove?.(item.index, nextStartPage, true);
      setDraggingSceneKey(null);

      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  if (!scenes.length) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: "white",
        borderBottom: "1px solid #e5e5e5",
        color: "#222",
        padding: "8px 16px 6px",
        boxSizing: "border-box",
        fontFamily: "'Century Gothic', 'Futura', Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          marginBottom: "6px",
          color: "#555",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <strong style={{ color: "#222" }}>Writing Timeline</strong>
          <span>Target: {targetPages} pages</span>
          <button
            type="button"
            onClick={onEditTargetPages}
            style={{
              padding: "2px 7px",
              border: "1px solid #ccc",
              borderRadius: "3px",
              backgroundColor: "#f7f7f7",
              color: "#333",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            Edit Target
          </button>
        </div>

        <div style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>
          {totalWrittenPages.toFixed(1)} written · {remainingPages.toFixed(1)} remaining ·{" "}
          {writtenPercent.toFixed(0)}%
        </div>
      </div>

      <div
        ref={timelineBarRef}
        style={{
          position: "relative",
          height: "34px",
          width: "100%",
          background:
            "repeating-linear-gradient(45deg, #ffdddd, #ffdddd 7px, #ff8f8f 7px, #ff8f8f 14px)",
          border: "1px solid #d5d5d5",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {timelineData.map((item) => {
          const { scene, index, pageLength, startPage, label } = item;
          const sceneKey = `${scene.sceneNumber}-${index}`;
          const isCurrent =
            String(scene.sceneNumber) === String(currentSceneNumber);
          const isDragging = draggingSceneKey === sceneKey;

          const leftPercent = Math.min(100, (startPage / targetPages) * 100);
          const rawWidthPercent = (pageLength / targetPages) * 100;
          const widthPercent = Math.max(0.15, rawWidthPercent);

          return (
            <button
              key={sceneKey}
              type="button"
              onMouseDown={(e) => startDrag(e, item)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSceneOpen?.(item);
              }}
              title={`Scene ${scene.sceneNumber}: ${scene.heading || "Untitled"} | Starts Page ${startPage.toFixed(
                1
              )} | Length ${label}`}
              style={{
                position: "absolute",
                top: 0,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: "100%",
                padding: 0,
                margin: 0,
                border: "none",
                borderRight: "1px solid #e8e8e8",
                backgroundColor: isCurrent ? "#316AC5" : "#b8b8b8",
                opacity: isDragging ? 0.7 : isCurrent ? 1 : 0.95,
                cursor: "grab",
                zIndex: isDragging ? 5 : 2,
              }}
            >
              {rawWidthPercent > 3 && (
                <span
                  style={{
                    position: "absolute",
                    left: "4px",
                    top: "4px",
                    fontSize: "9px",
                    color: isCurrent ? "white" : "#333",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "calc(100% - 8px)",
                    fontWeight: isCurrent ? "bold" : "normal",
                    pointerEvents: "none",
                  }}
                >
                  {scene.sceneNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "#888",
          marginTop: "4px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>Page 1</span>
        <span>Midpoint: {Math.round(targetPages / 2)}</span>
        <span>Page {targetPages}</span>
      </div>
    </div>
  );
}

export default WritingTimeline;