import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TARGET_PAGES,
  getSceneTimelineData,
  getSourceClosedTimelineScenes,
  getTotalWrittenPages,
} from "./writingTimelineUtils";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../utils/sceneDisplayLabel";

function WritingTimeline({
  scenes = [],
  beats = [],
  showSceneTrack = true,
  showBeatsTrack = false,
  beatTrackZoom = 1,
  currentSceneNumber,
  setCurrentIndex,
  sceneRefs,
  targetPages = DEFAULT_TARGET_PAGES,
  onSceneMove,
  onSceneOpen,
  onBeatOpen,
  onBeatColorChange,
  onBeatTrackZoomChange,
}) {
    const timelineBarRef = useRef(null);
    const timelineScrollRef = useRef(null);
    const beatScrollRef = useRef(null);
    const [draggingSceneKey, setDraggingSceneKey] = useState(null);
    const [dragPreview, setDragPreview] = useState(null);
    const [snapIndicatorPage, setSnapIndicatorPage] = useState(null);
    const [zoomWindowRange, setZoomWindowRange] = useState(null);
    const [timelineZoom, setTimelineZoom] = useState(1);
    const [contextMenu, setContextMenu] = useState(null);
    const [beatColorMenu, setBeatColorMenu] = useState(null);
    const dragOffsetRef = useRef(0);
    const ZOOM_FACTOR = 10;
    const ZOOM_LENS_WIDTH_PERCENT = 40;
    const DRAG_START_THRESHOLD_PX = 4;
    const MIN_TIMELINE_ZOOM = 1;
    const MAX_TIMELINE_ZOOM = 6;
    const TIMELINE_ZOOM_STEP = 0.5;
    const hasVisibleBeatsTrack = showBeatsTrack;
    const hasBeats = Array.isArray(beats) && beats.length > 0;
    const safeBeatTrackZoom = Math.min(3, Math.max(1, Number(beatTrackZoom) || 1));
    const SCENE_TRACK_HEIGHT_PX = 34;
    const ZOOM_LENS_HEIGHT_PX = 58;
    const BEAT_TRACK_HEIGHT_PX = 32;
    const SCENE_RULER_TOP_PX = SCENE_TRACK_HEIGHT_PX + 2;
    const SCENE_LAYER_HEIGHT = 42;
    const BEAT_MARKER_OVERHANG_PX = 18;
    const BEAT_LAYER_HEIGHT = BEAT_MARKER_OVERHANG_PX + BEAT_TRACK_HEIGHT_PX + 2 + 12;
    const SCROLLBAR_GUTTER_PX = 0;
    const SCENE_LABEL_MIN_WIDTH_PX = 22;
    const lensDelayRef = useRef(null);

    function getSceneKey(scene, index) {
      return `${scene?.id || scene?.sceneId || scene?.sceneNumber || "scene"}-${index}`;
    }

  const timelineData = useMemo(() => {
    return getSceneTimelineData(scenes, targetPages);
  }, [scenes, targetPages]);
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);

  const totalWrittenPages = useMemo(() => {
    return getTotalWrittenPages(scenes);
  }, [scenes]);

  const renderPageCount = useMemo(() => {
    const safeTargetPages = Math.max(1, Number(targetPages) || DEFAULT_TARGET_PAGES);
    const maxTimelineEndPage = timelineData.reduce((maxPage, item) => {
      const endPage = Number(item.endPage);
      return Number.isFinite(endPage) ? Math.max(maxPage, endPage) : maxPage;
    }, 0);

    return Math.max(
      safeTargetPages,
      Math.ceil(totalWrittenPages || 0),
      Math.ceil(maxTimelineEndPage || 0),
      1
    );
  }, [targetPages, timelineData, totalWrittenPages]);

  const resolveOverlappingTimelineData = (items = []) => {
    const EPSILON = 0.001;
    let previousEndPage = 0;

    const sortedItems = [...items].sort((a, b) => {
      if (a.startPage !== b.startPage) return a.startPage - b.startPage;
      return a.index - b.index;
    });

    const adjustedByIndex = new Map();

    sortedItems.forEach((item) => {
      const adjustedStartPage =
        item.startPage < previousEndPage - EPSILON
          ? previousEndPage
          : item.startPage;
      const adjustedEndPage = adjustedStartPage + item.pageLength;

      adjustedByIndex.set(item.index, {
        ...item,
        startPage: adjustedStartPage,
        endPage: adjustedEndPage,
      });

      previousEndPage = Math.max(previousEndPage, adjustedEndPage);
    });

    return items.map(item => adjustedByIndex.get(item.index) || item);
  };

  const renderTimelineData = useMemo(() => {
    if (!dragPreview) return timelineData;

    return timelineData.map((item) => {
      const sceneKey = getSceneKey(item.scene, item.index);

      if (sceneKey !== dragPreview.sceneKey) return item;

      const startPage = dragPreview.startPage;

      return {
        ...item,
        startPage,
        endPage: startPage + item.pageLength,
      };
    });
  }, [dragPreview, timelineData]);

  const snapTimelineData = useMemo(() => {
    if (!dragPreview) {
      return resolveOverlappingTimelineData(timelineData);
    }

    const sourceClosedScenes = getSourceClosedTimelineScenes(
      scenes,
      dragPreview.sceneIndex
    );

    return resolveOverlappingTimelineData(
      getSceneTimelineData(sourceClosedScenes, renderPageCount)
    );
  }, [dragPreview, renderPageCount, scenes, timelineData]);

  const beatItemCount = useMemo(() => {
    return (beats || []).filter(item => item.type !== "act").length;
  }, [beats]);
  const actItemCount = useMemo(() => {
    return (beats || []).filter(item => item.type === "act").length;
  }, [beats]);

  const beatMarkerColors = {
    default: { label: "Default slate", fill: "#C9D6DE", border: "#90A4AE", text: "#6F8796" },
    red: { label: "Red", fill: "#EF9A9A", border: "#C62828", text: "#B71C1C" },
    orange: { label: "Orange", fill: "#FFCC80", border: "#EF6C00", text: "#E65100" },
    yellow: { label: "Yellow", fill: "#FFE082", border: "#F9A825", text: "#795548" },
    green: { label: "Green", fill: "#A5D6A7", border: "#2E7D32", text: "#1B5E20" },
    blue: { label: "Blue", fill: "#90CAF9", border: "#1565C0", text: "#0D47A1" },
    purple: { label: "Purple", fill: "#CE93D8", border: "#7B1FA2", text: "#4A148C" },
  };

    const beatMarkerColorOptions = [
    "default",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
  ];

  const sceneTimelineColors = {
    red: { fill: "#EF9A9A", text: "#7F1D1D" },
    orange: { fill: "#FFCC80", text: "#7C2D12" },
    yellow: { fill: "#FFE082", text: "#713F12" },
    green: { fill: "#A5D6A7", text: "#14532D" },
    blue: { fill: "#90CAF9", text: "#0D47A1" },
    purple: { fill: "#CE93D8", text: "#4A148C" },
  };

  const getSceneTimelineColor = (scene, isCurrent, isInserted) => {
    const custom = sceneTimelineColors[scene?.metadata?.color];
    if (isCurrent) return { fill: "#316AC5", text: "white" };
    if (custom) return { fill: custom.fill, text: custom.text };
    if (isInserted) return { fill: "#fdba74", text: "#92400e" };
    return { fill: "#b8b8b8", text: "#333" };
  };

  const getBeatMarkerColor = (item, isConverted) => {
    const explicitColor = item?.markerColor && beatMarkerColors[item.markerColor]
      ? beatMarkerColors[item.markerColor]
      : null;

    if (explicitColor) return explicitColor;
    if (isConverted) return { label: "Converted", fill: "#81C784", border: "#2E7D32", text: "#1B5E20" };
    if (item?.verified) return { label: "Verified", fill: "#9BB6C8", border: "#607D8B", text: "#3F5F73" };
    return beatMarkerColors.default;
  };

  const outlineTimelineData = useMemo(() => {
    const orderedItems = [...(beats || [])].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });

    const count = Math.max(1, orderedItems.length);
    let beatNumber = 0;

    return orderedItems.map((item, index) => {
      const isAct = item.type === "act";
      let currentBeatNumber = null;

      if (!isAct) {
        beatNumber += 1;
        currentBeatNumber = beatNumber;
      }

      const nextActIndex = isAct
        ? orderedItems.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.type === "act")
        : -1;
      const groupEndIndex = nextActIndex === -1 ? orderedItems.length : nextActIndex;
      const startPercent = (index / count) * 100;
      const endPercent = isAct ? (groupEndIndex / count) * 100 : ((index + 1) / count) * 100;
      const containedBeatCount = isAct
        ? orderedItems.slice(index + 1, groupEndIndex).filter(candidate => candidate.type !== "act").length
        : 0;

      return {
        item,
        beatNumber: currentBeatNumber,
        containedBeatCount,
        leftPercent: startPercent + ((endPercent - startPercent) / 2),
        startPercent,
        endPercent,
      };
    });
  }, [beats]);

  const getPageTicksForZoom = (zoomLevel, pageCount = targetPages) => {
    const safeTargetPages = Math.max(1, Math.round(Number(pageCount) || DEFAULT_TARGET_PAGES));
    const showFiveLabels = zoomLevel >= 2;
    const showAllLabels = zoomLevel >= 4;

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
  };

  const pageTicks = useMemo(() => {
    return getPageTicksForZoom(timelineZoom, renderPageCount);
  }, [renderPageCount, timelineZoom]);

  const beatPageTicks = useMemo(() => {
    return getPageTicksForZoom(safeBeatTrackZoom, renderPageCount);
  }, [renderPageCount, safeBeatTrackZoom]);

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

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("mousedown", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!beatColorMenu) return;

    const closeBeatColorMenu = () => setBeatColorMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeBeatColorMenu();
    };

    window.addEventListener("mousedown", closeBeatColorMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", closeBeatColorMenu, true);

    return () => {
      window.removeEventListener("mousedown", closeBeatColorMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", closeBeatColorMenu, true);
    };
  }, [beatColorMenu]);

  const getTimelineGaps = () => {
    const sortedItems = [...renderTimelineData].sort((a, b) => {
      if (a.startPage !== b.startPage) return a.startPage - b.startPage;
      return a.index - b.index;
    });
    const gaps = [];
    const EPSILON = 0.001;

    if (sortedItems.length === 0) return gaps;

    if (sortedItems[0].startPage > EPSILON) {
      gaps.push({
        startPage: 0,
        endPage: sortedItems[0].startPage,
        length: sortedItems[0].startPage,
        previousSceneIndex: null,
        nextSceneIndex: sortedItems[0].index,
      });
    }

    for (let i = 0; i < sortedItems.length - 1; i += 1) {
      const current = sortedItems[i];
      const next = sortedItems[i + 1];

      if (next.startPage > current.endPage + EPSILON) {
        gaps.push({
          startPage: current.endPage,
          endPage: next.startPage,
          length: next.startPage - current.endPage,
          previousSceneIndex: current.index,
          nextSceneIndex: next.index,
        });
      }
    }

    return gaps;
  };

  const getGapAtPage = (page) => {
    return getTimelineGaps().find(
      (gap) => page >= gap.startPage && page <= gap.endPage
    ) || null;
  };

  const openContextMenu = (event, menuData) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      ...menuData,
    });
  };

  const handleTimelineContextMenu = (event) => {
    const page = getPageFromPointer(event.clientX);
    const gap = getGapAtPage(page);

    openContextMenu(event, {
      page,
      targetType: gap ? "gap" : "background",
      gap,
      sceneKey: null,
      sceneIndex: null,
      sceneNumber: null,
    });
  };

  const handleSceneContextMenu = (event, item) => {
    event.stopPropagation();

    const sceneKey = getSceneKey(item.scene, item.index);

    openContextMenu(event, {
      page: item.startPage,
      targetType: "scene",
      gap: null,
      sceneKey,
      sceneIndex: item.index,
      sceneNumber: item.scene?.sceneNumber ?? null,
    });
  };

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
    const visibleEnd = activeZoomRange?.end ?? renderPageCount;
    const visibleRange = Math.max(1, visibleEnd - visibleStart);

    const rawPage = visibleStart + pointerPercent * visibleRange;

    return Math.max(0, rawPage);
  };

  const getSnapCandidates = (snapData = []) => {
    const sortedItems = [...snapData].sort((a, b) => {
      if (a.startPage !== b.startPage) return a.startPage - b.startPage;
      return a.index - b.index;
    });
    const candidates = [];
    const clusters = [];
    const EPSILON = 0.001;

    sortedItems.forEach((item) => {
      candidates.push(
        { page: item.startPage, type: "scene-start", priority: 1 },
        { page: item.endPage, type: "scene-end", priority: 1 }
      );

      const currentCluster = clusters[clusters.length - 1];
      if (!currentCluster || item.startPage > currentCluster.endPage + EPSILON) {
        clusters.push({
          startPage: item.startPage,
          endPage: item.endPage,
        });
        return;
      }

      currentCluster.endPage = Math.max(currentCluster.endPage, item.endPage);
    });

    clusters.forEach((cluster) => {
      candidates.push(
        { page: cluster.startPage, type: "cluster-start", priority: 2 },
        { page: cluster.endPage, type: "cluster-end", priority: 2 }
      );
    });

    return candidates;
  };

  const getDragStartPageFromPointer = (clientX, item) => {
    const pointerPage = getPageFromPointer(clientX);
    const roundedPointerPage = Math.round(pointerPage * 8) / 8;
    const candidateStartPage = roundedPointerPage - dragOffsetRef.current;
    const clampedCandidateStart = Math.min(
      Math.max(0, candidateStartPage),
      Math.max(0, renderPageCount - item.pageLength)
    );
    const candidateEndPage = clampedCandidateStart + item.pageLength;
    const sceneKey = getSceneKey(item.scene, item.index);
    let bestSnap = null;

    const sourceClosedScenes = getSourceClosedTimelineScenes(scenes, item.index);
    const activeSnapTimelineData = resolveOverlappingTimelineData(
      getSceneTimelineData(sourceClosedScenes, renderPageCount)
    );
    const snapCandidates = getSnapCandidates(
      activeSnapTimelineData.filter((other) => {
        return getSceneKey(other.scene, other.index) !== sceneKey;
      })
    );

    const chooseClosestSnap = (snapOptions) => {
      return snapOptions.reduce((closest, option) => {
        if (option.distance >= SNAP_THRESHOLD) return closest;

        if (!closest) return option;

        if (option.priority > closest.priority) {
          return option;
        }

        if (option.priority === closest.priority && option.distance < closest.distance) {
          return option;
        }

        return closest;
      }, null);
    };

    bestSnap = chooseClosestSnap(
      snapCandidates.flatMap((candidate) => {
        if (candidate.type === "scene-end" || candidate.type === "cluster-end") {
          return [{
            distance: Math.abs(clampedCandidateStart - candidate.page),
            startPage: candidate.page,
            indicatorPage: candidate.page,
            priority: candidate.priority,
          }];
        }

        if (candidate.type === "scene-start" || candidate.type === "cluster-start") {
          return [{
            distance: Math.abs(candidateEndPage - candidate.page),
            startPage: candidate.page - item.pageLength,
            indicatorPage: candidate.page,
            priority: candidate.priority,
          }];
        }

        return [];
      })
    );

    if (bestSnap) {
      setSnapIndicatorPage(bestSnap.indicatorPage);
      return Math.min(
        Math.max(0, bestSnap.startPage),
        Math.max(0, renderPageCount - item.pageLength)
      );
    }

    setSnapIndicatorPage(null);
    return clampedCandidateStart;
  };
  const startDrag = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);

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
      const pointerPage = (x / rect.width) * renderPageCount;
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
          const pointerPage = pointerPercent * renderPageCount;
          const zoomSize = renderPageCount / ZOOM_FACTOR;
          const zoomStart = Math.min(Math.max(0, pointerPage - zoomSize / 2), Math.max(0, renderPageCount - zoomSize));

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

  const hasAnythingToShow = (showSceneTrack && scenes.length > 0) || showBeatsTrack;
  if (!hasAnythingToShow) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        backgroundColor: "white",
        borderBottom: "1px solid #e5e5e5",
        color: "#222",
        padding: "8px 0 6px 16px",
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
          {showSceneTrack && <strong style={{ color: "#222" }}>Scene Timeline</strong>}
          {!showSceneTrack && showBeatsTrack && <strong style={{ color: "#222" }}>Beats Timeline</strong>}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            {showSceneTrack && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "9px", color: "#777", fontWeight: "bold", lineHeight: "10px" }}>Scenes Zoom</span>
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
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
                  -
                </button>
                <span style={{ minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: "10px", color: "#555" }}>{timelineZoom.toFixed(2).replace(/\.00$/, "")}x</span>
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
                  +
                </button>
              </div>
            </div>
            )}
            {hasVisibleBeatsTrack && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "9px", color: "#777", fontWeight: "bold", lineHeight: "10px" }}>Beat Zoom</span>
                <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <button
                    type="button"
                    onClick={() => onBeatTrackZoomChange?.(Math.max(1, Number((safeBeatTrackZoom - 0.25).toFixed(2))))}
                    disabled={safeBeatTrackZoom <= 1 || !onBeatTrackZoomChange}
                    style={{
                      padding: "2px 7px",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      backgroundColor: safeBeatTrackZoom <= 1 || !onBeatTrackZoomChange ? "#eee" : "#f7f7f7",
                      color: safeBeatTrackZoom <= 1 || !onBeatTrackZoomChange ? "#999" : "#333",
                      cursor: safeBeatTrackZoom <= 1 || !onBeatTrackZoomChange ? "default" : "pointer",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    -
                  </button>
                  <span style={{ minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: "10px", color: "#555" }}>{safeBeatTrackZoom.toFixed(2).replace(/\.00$/, "")}x</span>
                  <button
                    type="button"
                    onClick={() => onBeatTrackZoomChange?.(Math.min(3, Number((safeBeatTrackZoom + 0.25).toFixed(2))))}
                    disabled={safeBeatTrackZoom >= 3 || !onBeatTrackZoomChange}
                    style={{
                      padding: "2px 7px",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      backgroundColor: safeBeatTrackZoom >= 3 || !onBeatTrackZoomChange ? "#eee" : "#f7f7f7",
                      color: safeBeatTrackZoom >= 3 || !onBeatTrackZoomChange ? "#999" : "#333",
                      cursor: safeBeatTrackZoom >= 3 || !onBeatTrackZoomChange ? "default" : "pointer",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontVariantNumeric: "tabular-nums", color: "#666" }}>
          {showBeatsTrack && hasBeats ? `${beatItemCount} beats${actItemCount ? ` / ${actItemCount} acts` : ""}` : ""}
        </div>
      </div>

      {showSceneTrack && <div
        ref={timelineScrollRef}
        className="fpb-auto-scrollbar"
        style={{
          width: "100%",
          height: `${SCENE_LAYER_HEIGHT + 4}px`,
          overflowX: timelineZoom > MIN_TIMELINE_ZOOM ? "auto" : "hidden",
          overflowY: "hidden",
          paddingBottom: "4px",
          boxSizing: "border-box",
        }}
      >
      <div
        ref={timelineBarRef}
        onContextMenu={handleTimelineContextMenu}
        style={{
          position: "relative",
          height: `${SCENE_LAYER_HEIGHT}px`,
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
            height: `${SCENE_TRACK_HEIGHT_PX}px`,
            background:
              "repeating-linear-gradient(45deg, #ffdddd, #ffdddd 7px, #ff8f8f 7px, #ff8f8f 14px)",
            border: "1px solid #d5d5d5",
            borderRadius: "4px",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        />

        {pageTicks.map((tick) => {
          const { page } = tick;
          const leftPercent = renderPageCount <= 1 ? 0 : ((page - 1) / (renderPageCount - 1)) * 100;
          const isFirst = page === 1;
          const isLast = tick.isLast;

          if (!tick.showLabel) {
            return (
              <div
                key={`scene-ruler-tick-${page}`}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  top: `${SCENE_RULER_TOP_PX}px`,
                  transform: "translateX(-50%)",
                  width: `${tick.tickWidth}px`,
                  height: `${tick.isFive ? 3 : 2}px`,
                  backgroundColor: tick.isFive ? "#c0c0c0" : "#ddd",
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              />
            );
          }

          return (
            <div
              key={`scene-ruler-tick-${page}`}
              style={{
                position: "absolute",
                left: `${leftPercent}%`,
                top: `${SCENE_RULER_TOP_PX}px`,
                transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                textAlign: "center",
                minWidth: "12px",
                fontSize: `${Math.max(7, tick.fontSize - 2)}px`,
                color: tick.isTen ? "#666" : tick.isFive ? "#888" : "#b0b0b0",
                fontWeight: tick.isTen ? "600" : "normal",
                fontVariantNumeric: "tabular-nums",
                lineHeight: "9px",
                zIndex: 1,
                pointerEvents: "none",
              }}
            >
              {page}
            </div>
          );
        })}

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
              height: `${ZOOM_LENS_HEIGHT_PX}px`,
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
              const isInserted = Boolean(scene.metadata?.replacementLetter);
              const sceneColor = getSceneTimelineColor(scene, isCurrent, isInserted);

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
                    backgroundColor: sceneColor.fill,
                    opacity: isDragging ? 0.85 : 0.95,
                    borderLeft: "1px solid rgba(0,0,0,0.34)",
                    borderRight: "1px solid rgba(0,0,0,0.34)",
                    borderTop: isInserted ? "3px solid #f59e0b" : undefined,
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
                        color: sceneColor.text,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getSceneDisplayLabel(scene, displayLabelMap)}
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

        {renderTimelineData.map((item) => {
          const { scene, index, pageLength, startPage, label } = item;
          const sceneKey = getSceneKey(scene, index);
          const isCurrent =
            String(scene.sceneNumber) === String(currentSceneNumber);
          const isDragging = draggingSceneKey === sceneKey;
          const isInserted = Boolean(scene.metadata?.replacementLetter);
          const sceneColor = getSceneTimelineColor(scene, isCurrent, isInserted);

          const previewStartPage = startPage;

            const leftPercent = (previewStartPage / renderPageCount) * 100;
            const rawWidthPercent = (pageLength / renderPageCount) * 100;
          const widthPercent = Math.max(0.15, rawWidthPercent);
          const timelineWidth = timelineBarRef.current?.clientWidth || 0;
          const blockPixelWidth = (rawWidthPercent / 100) * timelineWidth;
          const canShowSceneNumber = blockPixelWidth >= SCENE_LABEL_MIN_WIDTH_PX;

          return (
            <button
              key={sceneKey}
              type="button"
              onMouseDown={(e) => startDrag(e, item)}
              onContextMenu={(e) => handleSceneContextMenu(e, item)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSceneOpen?.(item);
              }}
              title={`Scene ${getSceneDisplayLabel(scene, displayLabelMap)}: ${scene.heading || "Untitled"} | Starts Page ${startPage.toFixed(
                1
              )} | Length ${label}`}
              style={{
                position: "absolute",
                top: 0,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: `${SCENE_TRACK_HEIGHT_PX}px`,
                padding: 0,
                margin: 0,
                border: "none",
                borderLeft: "1px solid rgba(0,0,0,0.3)",
                borderRight: "1px solid rgba(0,0,0,0.34)",
                borderTop: isInserted ? "3px solid #f59e0b" : "none",
                backgroundColor: sceneColor.fill,
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
                    color: isDragging ? "#111" : sceneColor.text,
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
                  {getSceneDisplayLabel(scene, displayLabelMap)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>}

      {hasVisibleBeatsTrack && (
        <div
          ref={beatScrollRef}
          className="fpb-auto-scrollbar"
          style={{
            marginTop: "0px",
            width: "100%",
            height: `${BEAT_LAYER_HEIGHT}px`,
            overflowX: safeBeatTrackZoom > 1 ? "auto" : "hidden",
            overflowY: "hidden",
            paddingBottom: 0,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "relative",
              height: `${BEAT_LAYER_HEIGHT}px`,
              width: `${safeBeatTrackZoom * 100}%`,
              minWidth: "100%",
              overflow: "visible",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: `${BEAT_MARKER_OVERHANG_PX}px`,
                left: 0,
                right: 0,
                height: `${BEAT_TRACK_HEIGHT_PX}px`,
                backgroundColor: "#F6F0DF",
                border: "1px solid #d8cda7",
                borderRadius: "4px",
                boxSizing: "border-box",
                overflow: "visible",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  overflow: "visible",
                }}
              >
              {outlineTimelineData.map(({ item, beatNumber, containedBeatCount, leftPercent, startPercent, endPercent }) => {
                const isAct = item.type === "act";
                const isConverted = item.status === "converted" || item.convertedSceneId;
                const markerColor = getBeatMarkerColor(item, isConverted);

                if (isAct) {
                  return (
                    <div
                      key={item.id}
                      title={`${item.title || "Act"}${containedBeatCount ? `\n${containedBeatCount} beat${containedBeatCount === 1 ? "" : "s"}` : ""}`}
                      style={{
                        position: "absolute",
                        left: `${startPercent}%`,
                        bottom: "0",
                        width: `${Math.max(1, endPercent - startPercent)}%`,
                        height: "35%",
                        backgroundColor: "rgba(84, 110, 122, 0.16)",
                        borderLeft: "1px solid rgba(84, 110, 122, 0.45)",
                        boxSizing: "border-box",
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: "4px",
                          bottom: "1px",
                          maxWidth: "120px",
                          color: "#37474F",
                          fontSize: "9px",
                          fontWeight: "bold",
                          lineHeight: "12px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title || "ACT"}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onBeatOpen?.(item.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!onBeatColorChange) return;
                      setContextMenu(null);
                      setBeatColorMenu({
                        x: event.clientX,
                        y: event.clientY,
                        beatId: item.id,
                        currentColor: item.markerColor || "default",
                      });
                    }}
                    title={[
                      `Beat #${beatNumber}`,
                      item.title || "Untitled Beat",
                      item.originalBeatNumber ? `Original imported beat #${item.originalBeatNumber}` : null,
                      isConverted ? "Converted" : null,
                      item.convertedSceneId ? `Linked scene: ${item.convertedSceneId}` : null,
                    ].filter(Boolean).join("\n")}
                    style={{
                      position: "absolute",
                      left: `${leftPercent}%`,
                      top: beatNumber % 2 === 0 ? "-16px" : "-10px",
                      width: "24px",
                      height: "32px",
                      transform: "translateX(-50%)",
                      border: "none",
                      backgroundColor: "transparent",
                      color: markerColor.text,
                      fontSize: "8px",
                      fontWeight: "bold",
                      lineHeight: "8px",
                      padding: 0,
                      boxSizing: "border-box",
                      cursor: onBeatOpen ? "pointer" : "default",
                      zIndex: 5,
                    }}
                  >
                    <span style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", fontVariantNumeric: "tabular-nums" }}>{beatNumber}</span>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "10px",
                        width: "9px",
                        height: "11px",
                        transform: "translateX(-50%)",
                        borderRadius: "7px 7px 4px 4px",
                        backgroundColor: markerColor.fill,
                        border: `1px solid ${markerColor.border}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        boxSizing: "border-box",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "-8px",
                          width: 0,
                          height: 0,
                          transform: "translateX(-50%)",
                          borderLeft: "3px solid transparent",
                          borderRight: "3px solid transparent",
                          borderTop: `9px solid ${markerColor.fill}`,
                          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.18))",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${BEAT_MARKER_OVERHANG_PX + BEAT_TRACK_HEIGHT_PX + 2}px`,
                height: "12px",
                overflow: "visible",
                zIndex: 1,
                pointerEvents: "none",
              }}
            >
              {beatPageTicks.map((tick) => {
                const { page } = tick;
                const leftPercent = renderPageCount <= 1 ? 0 : ((page - 1) / (renderPageCount - 1)) * 100;
                const isFirst = page === 1;
                const isLast = tick.isLast;

                if (!tick.showLabel) {
                  return (
                    <div
                      key={`beat-page-ruler-tick-${page}`}
                      style={{
                        position: "absolute",
                        left: `${leftPercent}%`,
                        top: 0,
                        transform: "translateX(-50%)",
                        width: `${tick.tickWidth}px`,
                        height: `${tick.isFive ? 3 : 2}px`,
                        backgroundColor: tick.isFive ? "#C0CDD3" : "#DDE4E8",
                        pointerEvents: "none",
                      }}
                    />
                  );
                }

                return (
                  <div
                    key={`beat-page-ruler-tick-${page}`}
                    title={`Page ${page}`}
                    style={{
                      position: "absolute",
                      left: `${leftPercent}%`,
                      top: 0,
                      transform: isFirst ? "translateX(0)" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                      textAlign: "center",
                      minWidth: "12px",
                      fontSize: `${Math.max(7, tick.fontSize - 2)}px`,
                      color: tick.isTen ? "#6F8796" : tick.isFive ? "#8EA0AA" : "#B8C3C9",
                      fontWeight: tick.isTen ? "600" : "normal",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: "9px",
                    }}
                  >
                    {page}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {beatColorMenu && (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: `${beatColorMenu.x}px`,
            top: `${beatColorMenu.y}px`,
            minWidth: "142px",
            backgroundColor: "white",
            border: "1px solid #bbb",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            zIndex: 1001,
            padding: "4px",
            fontSize: "11px",
            color: "#222",
          }}
        >
          {beatMarkerColorOptions.map((colorKey) => {
            const option = beatMarkerColors[colorKey];
            const isSelected = (beatColorMenu.currentColor || "default") === colorKey;

            return (
              <button
                key={colorKey}
                type="button"
                onClick={() => {
                  onBeatColorChange?.(beatColorMenu.beatId, colorKey);
                  setBeatColorMenu(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  width: "100%",
                  padding: "5px 7px",
                  border: "none",
                  borderRadius: "3px",
                  backgroundColor: isSelected ? "#ECEFF1" : "transparent",
                  color: "#222",
                  textAlign: "left",
                  fontSize: "11px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: option.fill,
                    border: `1px solid ${option.border}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{option.label}</span>
                {isSelected && <span style={{ color: "#607D8B", fontWeight: "bold" }}>Selected</span>}
              </button>
            );
          })}
        </div>
      )}
      {contextMenu && (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            minWidth: "160px",
            backgroundColor: "white",
            border: "1px solid #bbb",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            zIndex: 1000,
            padding: "4px 0",
            fontSize: "11px",
            color: "#222",
          }}
        >
          {[
            {
              label: "Close Gap",
              enabled: contextMenu.targetType === "gap",
            },
            {
              label: "Insert Gap (coming soon)",
              enabled: false,
            },
            {
              label: "Select All Before",
              enabled: false,
            },
            {
              label: "Select All After",
              enabled: false,
            },
            {
              label: "Change Scene Color",
              enabled: contextMenu.targetType === "scene",
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={!item.enabled}
              onClick={() => setContextMenu(null)}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 10px",
                border: "none",
                backgroundColor: "transparent",
                color: item.enabled ? "#222" : "#999",
                textAlign: "left",
                fontSize: "11px",
                fontFamily: "inherit",
                cursor: item.enabled ? "pointer" : "default",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default WritingTimeline;
