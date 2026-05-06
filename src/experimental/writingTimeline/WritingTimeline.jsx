import React, { useMemo, useRef, useState } from "react";
import {
  DEFAULT_TARGET_PAGES,
  getSceneTimelineData,
  getSourceClosedTimelineScenes,
  getTotalWrittenPages,
  rippleTimelineSceneMove,
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
    const timelineScrollRef = useRef(null);
    const [draggingSceneKey, setDraggingSceneKey] = useState(null);
    const [dragPreview, setDragPreview] = useState(null);
    const [snapIndicatorPage, setSnapIndicatorPage] = useState(null);
    const [zoomWindowRange, setZoomWindowRange] = useState(null);
    const [timelineZoom, setTimelineZoom] = useState(1);
    const dragOffsetRef = useRef(0);
    const ZOOM_FACTOR = 10;
    const ZOOM_LENS_WIDTH_PERCENT = 40;
    const DRAG_START_THRESHOLD_PX = 4;
    const MIN_TIMELINE_ZOOM = 1;
    const MAX_TIMELINE_ZOOM = 6;
    const TIMELINE_ZOOM_STEP = 0.5;
    const TIMELINE_BAR_HEIGHT = 60;
    const SCROLLBAR_GUTTER_PX = 14;
    const SCENE_LABEL_MIN_WIDTH_PX = 22;
    const lensDelayRef = useRef(null);

  const timelineData = useMemo(() => {
    return getSceneTimelineData(scenes, targetPages);
  }, [scenes, targetPages]);

  const totalWrittenPages = useMemo(() => {
    return getTotalWrittenPages(scenes);
  }, [scenes]);

  const renderTimelineData = useMemo(() => {
    if (!dragPreview) return timelineData;

    const previewScenes = rippleTimelineSceneMove(
      scenes,
      dragPreview.sceneIndex,
      dragPreview.startPage
    );

    return getSceneTimelineData(previewScenes, targetPages);
  }, [dragPreview, scenes, targetPages, timelineData]);

  const snapTimelineData = useMemo(() => {
    if (!dragPreview) return timelineData;

    const sourceClosedScenes = getSourceClosedTimelineScenes(
      scenes,
      dragPreview.sceneIndex
    );

    return getSceneTimelineData(sourceClosedScenes, targetPages);
  }, [dragPreview, scenes, targetPages, timelineData]);

  const remainingPages = Math.max(0, targetPages - totalWrittenPages);
  const writtenPercent = Math.min(100, (totalWrittenPages / targetPages) * 100);

  const pageTicks = useMemo(() => {
    const safeTargetPages = Math.max(1, Math.round(Number(targetPages) || DEFAULT_TARGET_PAGES));
    const showFiveLabels = timelineZoom >= 2;
    const showAllLabels = timelineZoom >= 4;

    return Array.from({ length: safeTargetPages }, (_, index) => {
      const page = index + 1;
      const isFirst = page === 1;
      const isLast = page === safeTargetPages;
      const isTen = page % 10 === 0;
      const isFive = page % 5 === 0;
      const showLabel =
        isFirst ||
        isLast ||
        isTen ||
        showAllLabels ||
        (showFiveLabels && isFive);

      return {
        page,
        isFirst,
        isLast,
        isTen,
        isFive,
        showLabel,
        tickHeight: isTen ? 8 : isFive ? 6 : 4,
        tickWidth: isTen ? 2 : 1,
        fontSize: isTen ? 10 : isFive ? 9 : 8,
        color: isTen ? "#555" : isFive ? "#777" : "#aaa",
        fontWeight: isTen ? "bold" : isFive ? "600" : "normal",
      };
    });
  }, [targetPages, timelineZoom]);

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

  const SNAP_THRESHOLD = 0.5; // pages (tweak later)

  const getSceneKey = (scene, index) => scene?.id || `${scene?.sceneNumber}-${index}`;

  const updateTimelineZoom = (direction) => {
    const scrollEl = timelineScrollRef.current;
    const currentScrollWidth = scrollEl?.scrollWidth || 0;
    const currentClientWidth = scrollEl?.clientWidth || 0;
    const currentCenterPercent =
      currentScrollWidth > 0
        ? (scrollEl.scrollLeft + currentClientWidth / 2) / currentScrollWidth
        : 0.5;

    const nextZoom = Math.min(
      MAX_TIMELINE_ZOOM,
      Math.max(
        MIN_TIMELINE_ZOOM,
        timelineZoom + direction * TIMELINE_ZOOM_STEP
      )
    );

    if (nextZoom === timelineZoom) return;

    setTimelineZoom(nextZoom);

    window.requestAnimationFrame(() => {
      const nextScrollEl = timelineScrollRef.current;
      if (!nextScrollEl) return;

      const nextScrollLeft =
        currentCenterPercent * nextScrollEl.scrollWidth -
        nextScrollEl.clientWidth / 2;

      nextScrollEl.scrollLeft = Math.min(
        Math.max(0, nextScrollLeft),
        Math.max(0, nextScrollEl.scrollWidth - nextScrollEl.clientWidth)
      );
    });
  };

  const getPageFromPointer = (clientX, zoomRange = null) => {
    const rect = timelineBarRef.current?.getBoundingClientRect();
    if (!rect) return 0;

    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const pointerPercent = rect.width > 0 ? x / rect.width : 0;

    const activeZoomRange = zoomRange || zoomWindowRange;
    const visibleStart = activeZoomRange?.start ?? 0;
    const visibleEnd = activeZoomRange?.end ?? targetPages;
    const visibleRange = Math.max(1, visibleEnd - visibleStart);

    const rawPage = visibleStart + pointerPercent * visibleRange;

    return Math.max(0, rawPage);
  };

  const getDragStartPageFromPointer = (clientX, item) => {
    const pointerPage = getPageFromPointer(clientX);
    const roundedPointerPage = Math.round(pointerPage * 8) / 8;
    const candidateStartPage = roundedPointerPage - dragOffsetRef.current;
    const clampedCandidateStart = Math.min(
      Math.max(0, candidateStartPage),
      Math.max(0, targetPages - item.pageLength)
    );
    const candidateEndPage = clampedCandidateStart + item.pageLength;
    const sceneKey = getSceneKey(item.scene, item.index);
    let bestSnap = null;

    const activeSnapTimelineData = dragPreview ? snapTimelineData : timelineData;

    for (const other of activeSnapTimelineData) {
      const otherKey = getSceneKey(other.scene, other.index);
      if (sceneKey === otherKey) continue;

      const leftToRightDistance = Math.abs(clampedCandidateStart - other.endPage);
      if (
        leftToRightDistance < SNAP_THRESHOLD &&
        (!bestSnap || leftToRightDistance < bestSnap.distance)
      ) {
        bestSnap = {
          distance: leftToRightDistance,
          startPage: other.endPage,
          indicatorPage: other.endPage,
        };
      }

      const rightToLeftDistance = Math.abs(candidateEndPage - other.startPage);
      if (
        rightToLeftDistance < SNAP_THRESHOLD &&
        (!bestSnap || rightToLeftDistance < bestSnap.distance)
      ) {
        bestSnap = {
          distance: rightToLeftDistance,
          startPage: other.startPage - item.pageLength,
          indicatorPage: other.startPage,
        };
      }
    }

    if (bestSnap) {
      setSnapIndicatorPage(bestSnap.indicatorPage);
      return Math.min(
        Math.max(0, bestSnap.startPage),
        Math.max(0, targetPages - item.pageLength)
      );
    }

    setSnapIndicatorPage(null);
    return clampedCandidateStart;
  };
  const startDrag = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.detail >= 2) {
      onSceneOpen?.(item);
      return;
    }

    const sceneKey = getSceneKey(item.scene, item.index);
    if (lensDelayRef.current) {
        clearTimeout(lensDelayRef.current);
        lensDelayRef.current = null;
      }
    const rect = timelineBarRef.current?.getBoundingClientRect();

    let offset = 0;
    if (rect) {
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const pointerPage = (x / rect.width) * targetPages;
      offset = pointerPage - item.startPage;
    }
    
    dragOffsetRef.current = offset;

    const mouseDownX = e.clientX;
    const mouseDownY = e.clientY;
    let hasStartedDragging = false;

    document.body.style.cursor = "grab";
  
    const handleMove = (moveEvent) => {
        const movementDistance = Math.hypot(moveEvent.clientX - mouseDownX, moveEvent.clientY - mouseDownY);

        if (!hasStartedDragging && movementDistance < DRAG_START_THRESHOLD_PX) {
          return;
        }

        if (!hasStartedDragging) {
          hasStartedDragging = true;
          setDraggingSceneKey(sceneKey);
          setDragPreview({
            sceneKey,
            sceneIndex: item.index,
            startPage: item.startPage,
          });
          document.body.style.cursor = "grabbing";
        }

        const rect = timelineBarRef.current?.getBoundingClientRect();
  
        if (rect && timelineZoom === MIN_TIMELINE_ZOOM) {
          const x = Math.min(Math.max(moveEvent.clientX - rect.left, 0), rect.width);
          const pointerPercent = rect.width > 0 ? x / rect.width : 0;
          const pointerPage = pointerPercent * targetPages;
          const zoomSize = targetPages / ZOOM_FACTOR;
          const zoomStart = Math.min(Math.max(0, pointerPage - zoomSize / 2), Math.max(0, targetPages - zoomSize));
  
          setZoomWindowRange({
            start: zoomStart,
            end: zoomStart + zoomSize,
            pointerPercent,
          });
        } else {
          setZoomWindowRange(null);
        }
  
        const nextStartPage = getDragStartPageFromPointer(moveEvent.clientX, item);
  
        setDragPreview({
          sceneKey,
          sceneIndex: item.index,
          startPage: nextStartPage,
        });
    };

    const handleUp = (upEvent) => {
      if (lensDelayRef.current) {
        clearTimeout(lensDelayRef.current);
        lensDelayRef.current = null;
      }

      if (hasStartedDragging) {
        const nextStartPage = getDragStartPageFromPointer(upEvent.clientX, item);
        onSceneMove?.(item.index, nextStartPage, true);
      }

      setDraggingSceneKey(null);
      setDragPreview(null);
      setSnapIndicatorPage(null);
      setZoomWindowRange(null);
      dragOffsetRef.current = 0;

      document.body.style.cursor = "";

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
          <button
            type="button"
            onClick={() => updateTimelineZoom(-1)}
            disabled={timelineZoom <= MIN_TIMELINE_ZOOM}
            style={{
              padding: "2px 7px",
              border: "1px solid #ccc",
              borderRadius: "3px",
              backgroundColor: timelineZoom <= MIN_TIMELINE_ZOOM ? "#eee" : "#f7f7f7",
              color: timelineZoom <= MIN_TIMELINE_ZOOM ? "#999" : "#333",
              cursor: timelineZoom <= MIN_TIMELINE_ZOOM ? "default" : "pointer",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            Zoom Out
          </button>
          <button
            type="button"
            onClick={() => updateTimelineZoom(1)}
            disabled={timelineZoom >= MAX_TIMELINE_ZOOM}
            style={{
              padding: "2px 7px",
              border: "1px solid #ccc",
              borderRadius: "3px",
              backgroundColor: timelineZoom >= MAX_TIMELINE_ZOOM ? "#eee" : "#f7f7f7",
              color: timelineZoom >= MAX_TIMELINE_ZOOM ? "#999" : "#333",
              cursor: timelineZoom >= MAX_TIMELINE_ZOOM ? "default" : "pointer",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            Zoom In
          </button>
        </div>

        <div style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>
          {totalWrittenPages.toFixed(1)} written · {remainingPages.toFixed(1)} remaining ·{" "}
          {writtenPercent.toFixed(0)}%
        </div>
      </div>

      <div
        ref={timelineScrollRef}
        style={{
          width: "100%",
          height: `${TIMELINE_BAR_HEIGHT + SCROLLBAR_GUTTER_PX}px`,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: `${SCROLLBAR_GUTTER_PX}px`,
          boxSizing: "border-box",
          scrollbarGutter: "stable",
        }}
      >
      <div
        ref={timelineBarRef}
        style={{
          position: "relative",
          height: `${TIMELINE_BAR_HEIGHT}px`,
          width: `${timelineZoom * 100}%`,
          minWidth: "100%",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "34px",
            background:
              "repeating-linear-gradient(45deg, #ffdddd, #ffdddd 7px, #ff8f8f 7px, #ff8f8f 14px)",
            border: "1px solid #d5d5d5",
            borderRadius: "4px",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        />

{zoomWindowRange !== null && (
          <div
            style={{
              position: "absolute",
              top: "-3px",
              left: `${Math.min(
                Math.max(0, (zoomWindowRange.pointerPercent * 100) - (ZOOM_LENS_WIDTH_PERCENT / 2)),
                100 - ZOOM_LENS_WIDTH_PERCENT
              )}%`,
              width: `${ZOOM_LENS_WIDTH_PERCENT}%`,
              height: "58px",
              border: "4px solid rgb(255, 204, 0)",
              backgroundColor: "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              zIndex: 20,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {snapIndicatorPage !== null && snapIndicatorPage >= zoomWindowRange.start && snapIndicatorPage <= zoomWindowRange.end && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${((snapIndicatorPage - zoomWindowRange.start) / Math.max(1, zoomWindowRange.end - zoomWindowRange.start)) * 100}%`,
                  width: "3px",
                  height: "100%",
                  backgroundColor: "#ff0000",
                  boxShadow: "0 0 4px rgba(255,0,0,0.7)",
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              />
            )}

            {renderTimelineData.map((lensItem) => {
              const { scene, index, pageLength, startPage } = lensItem;
              const sceneKey = getSceneKey(scene, index);
              const previewStartPage = startPage;
              const visibleRange = Math.max(1, zoomWindowRange.end - zoomWindowRange.start);
              const lensLeftPercent = ((previewStartPage - zoomWindowRange.start) / visibleRange) * 100;
              const lensWidthPercent = (pageLength / visibleRange) * 100;
              const isCurrent = String(scene.sceneNumber) === String(currentSceneNumber);
              const isDragging = draggingSceneKey === sceneKey;

              if (lensLeftPercent > 100 || lensLeftPercent + lensWidthPercent < 0) return null;

              return (
                <div
                  key={`lens-${sceneKey}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${lensLeftPercent}%`,
                    width: `${Math.max(0.5, lensWidthPercent)}%`,
                    height: "36px",
                    backgroundColor: isCurrent ? "#316AC5" : "#9d9d9d",
                    opacity: isDragging ? 0.85 : 0.95,
                    borderLeft: "1px solid rgba(255,255,255,0.95)",
                    borderRight: "1px solid rgba(0,0,0,0.45)",
                    boxShadow: "inset 1px 0 rgba(0,0,0,0.22), inset -1px 0 rgba(255,255,255,0.75)",
                    zIndex: 5,
                  }}
                >
                  {lensWidthPercent > 4 && (
                    <span
                      style={{
                        position: "absolute",
                        left: "4px",
                        top: "4px",
                        fontSize: "9px",
                        color: isCurrent ? "white" : "#222",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {scene.sceneNumber}
                    </span>
                  )}
                </div>
              );
            })}

            {pageTicks.map((tick) => {
              const { page } = tick;
              if (page < zoomWindowRange.start || page > zoomWindowRange.end) return null;

              const visibleRange = Math.max(1, zoomWindowRange.end - zoomWindowRange.start);
              const tickLeftPercent = ((page - zoomWindowRange.start) / visibleRange) * 100;

              return (
                <div
                  key={`lens-tick-${page}`}
                  style={{
                    position: "absolute",
                    left: `${tickLeftPercent}%`,
                    bottom: 0,
                    transform: "translateX(-50%)",
                    fontSize: `${tick.fontSize}px`,
                    color: tick.color,
                    fontWeight: tick.fontWeight,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <div
                    style={{
                      width: `${tick.tickWidth}px`,
                      height: `${tick.tickHeight}px`,
                      backgroundColor: tick.isTen ? "#666" : tick.isFive ? "#888" : "#bbb",
                      margin: "0 auto 1px",
                    }}
                  />
                  {tick.showLabel ? page : null}
                </div>
              );
            })}
          </div>
        )}

{pageTicks.map((tick) => {
          const { page } = tick;
          const leftPercent = targetPages <= 1 ? 0 : ((page - 1) / (targetPages - 1)) * 100;
          const isFirst = page === 1;
          const isLast = tick.isLast;

          return (
            <div
              key={`main-tick-${page}`}
              style={{
                position: "absolute",
                left: `${leftPercent}%`,
                top: "38px",
                transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                textAlign: "center",
                minWidth: "18px",
                fontSize: `${tick.fontSize}px`,
                color: tick.color,
                fontWeight: tick.fontWeight,
                fontVariantNumeric: "tabular-nums",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: `${tick.tickWidth}px`,
                  height: `${tick.tickHeight}px`,
                  backgroundColor: tick.isTen ? "#666" : tick.isFive ? "#888" : "#bbb",
                  margin: isFirst ? "0 auto 2px 0" : isLast ? "0 0 2px auto" : "0 auto 2px",
                }}
              />
              <span>{tick.showLabel ? page : ""}</span>
            </div>
          );
        })}

        {renderTimelineData.map((item) => {
          const { scene, index, pageLength, startPage, label } = item;
          const sceneKey = getSceneKey(scene, index);
          const isCurrent =
            String(scene.sceneNumber) === String(currentSceneNumber);
          const isDragging = draggingSceneKey === sceneKey;

          const previewStartPage = startPage;

            const leftPercent = Math.min(100, (previewStartPage / targetPages) * 100);
            const rawWidthPercent = (pageLength / targetPages) * 100;
          const widthPercent = Math.max(0.15, rawWidthPercent);
          const timelineWidth = timelineBarRef.current?.clientWidth || 0;
          const blockPixelWidth = (rawWidthPercent / 100) * timelineWidth;
          const canShowSceneNumber = blockPixelWidth >= SCENE_LABEL_MIN_WIDTH_PX;

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
                height: "34px",
                padding: 0,
                margin: 0,
                border: "none",
                borderRight: "1px solid #e8e8e8",
                backgroundColor: isCurrent ? "#316AC5" : "#b8b8b8",
                opacity: isDragging ? 0.7 : isCurrent ? 1 : 0.95,
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: isDragging ? 5 : 2,
              }}
            >
              {(canShowSceneNumber || isDragging) && (
                <span
                  style={{
                    position: "absolute",
                    left: isDragging ? "50%" : "4px",
                    top: isDragging ? "-18px" : "4px",
                    transform: isDragging ? "translateX(-50%)" : "none",
                    fontSize: "9px",
                    color: isDragging ? "#111" : isCurrent ? "white" : "#333",
                    backgroundColor: isDragging ? "rgb(255, 204, 0)" : "transparent",
                    border: isDragging ? "1px solid #111" : "none",
                    borderRadius: isDragging ? "3px" : 0,
                    padding: isDragging ? "1px 5px" : 0,
                    whiteSpace: "nowrap",
                    overflow: "visible",
                    textOverflow: "clip",
                    maxWidth: isDragging ? "none" : "calc(100% - 8px)",
                    fontWeight: "bold",
                    pointerEvents: "none",
                    zIndex: 30,
                  }}
                >
                  {scene.sceneNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

export default WritingTimeline;
