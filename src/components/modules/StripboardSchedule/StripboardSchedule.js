import React, { useState, useRef, useEffect } from "react";
import * as database from "../../../services/database";

function DayBlock({
  day,
  timeOptions,
  onDrop,
  handleDragOver,
  handleDragStart,
  removeScene,
  removeBlock,
  addBlock,
  updateShootingDayDate,
  removeShootingDay,
  updateBlockTime,
  updateCustomItem,
  lockDayAndMarkShot,
  unlockDay,
  getSceneBlockColor,
  getSceneBlockTextColor,
  updateDayCollapse,
  handleSceneDoubleClick,
  syncShootingDays,
  canEdit,
}) {
  const [editingBlock, setEditingBlock] = React.useState(null);
  const [editValue, setEditValue] = React.useState("");

  const isCollapsed = day.isCollapsed || false;

  const handleDoubleClickEmpty = (blockId) => {
    setEditingBlock(blockId);
    setEditValue("");
  };

  const saveCustomItem = () => {
    if (editValue.trim() && editingBlock) {
      updateCustomItem(day.id, editingBlock, editValue.trim());
      setEditingBlock(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingBlock(null);
    setEditValue("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      saveCustomItem();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <div
      id={`day-${day.id}`}
      style={{ marginBottom: "30px", border: "1px solid #000" }}
    >
      {/* Day Header */}
      <div
        style={{
          backgroundColor: day.isLocked ? "#1B5E20" : "#2E7D32",
          color: "white",
          fontWeight: "bold",
          fontSize: "14px",
          padding: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => updateDayCollapse(day.id, !isCollapsed)}
          style={{
            backgroundColor: "transparent",
            border: "1px solid white",
            color: "white",
            borderRadius: "3px",
            cursor: "pointer",
            fontSize: "12px",
            padding: "4px 8px",
            fontWeight: "bold",
          }}
        >
          {isCollapsed ? "+" : "−"}
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          DAY {day.dayNumber} -{" "}
          {(() => {
            if (!day.date) return null;
            const [year, month, dayNum] = day.date.split("-");
            const date = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(dayNum)
            );
            return date.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          })()}
          {day.isLocked && (
            <span style={{ marginLeft: "10px" }}>🔒 LOCKED</span>
          )}
        </div>

        <div style={{ width: "60px" }}></div>
      </div>

      {/* Collapsed State Summary */}
      {isCollapsed && (
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "15px",
            textAlign: "center",
            fontSize: "12px",
            color: "#666",
            borderBottom: "1px solid #ddd",
          }}
        >
          {(() => {
            const sceneCount = day.scheduleBlocks.filter(
              (block) => block.scene && !block.isLunch
            ).length;
            const hasLunch = day.scheduleBlocks.some((block) => block.isLunch);
            return `${sceneCount} scenes scheduled${
              hasLunch ? " + lunch break" : ""
            }`;
          })()}
          {day.isLocked && (
            <span
              style={{
                marginLeft: "10px",
                color: "#4CAF50",
                fontWeight: "bold",
              }}
            >
              ✓ Completed
            </span>
          )}
        </div>
      )}

      {/* Schedule Blocks - only show if not collapsed */}
      {!isCollapsed &&
        (day.scheduleBlocks || []).map((block, index) => {
          if (block.isEndOfDay) {
            return (
              <div
                key={block.id}
                style={{
                  backgroundColor: "#000",
                  color: "white",
                  textAlign: "center",
                  padding: "15px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {canEdit && !day.isLocked && (
                    <button
                      onClick={() => removeShootingDay(day.id)}
                      style={{
                        background: "#ff4444",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                      title="Remove this day"
                    >
                      ✖ Remove Day
                    </button>
                  )}
                  <span>END OF DAY {day.dayNumber} - </span>
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) =>
                      updateShootingDayDate(day.id, e.target.value)
                    }
                    style={{
                      border: "1px solid #ccc",
                      padding: "2px 4px",
                      fontSize: "12px",
                      backgroundColor: day.isLocked ? "#f5f5f5" : "white",
                    }}
                    disabled={day.isLocked || !canEdit}
                  />
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <button
                    onClick={() => addBlock(day.id)}
                    disabled={day.isLocked}
                    style={{
                      backgroundColor: day.isLocked ? "#ccc" : "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: day.isLocked ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                      fontWeight: "bold",
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={() =>
                      day.isLocked
                        ? unlockDay(day.id)
                        : lockDayAndMarkShot(day.id)
                    }
                    style={{
                      backgroundColor: day.isLocked ? "#666" : "#FF6B35",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 8px",
                      fontWeight: "bold",
                    }}
                  >
                    {day.isLocked ? "Unlock Day" : "Lock & Mark Shot"}
                  </button>
                </div>
              </div>
            );
          }

          if (block.isLunch) {
            return (
              <div
                key={block.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#757575",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  minHeight: "40px",
                  padding: "5px",
                }}
              >
                <div style={{ width: "80px", padding: "0 8px", flexShrink: 0 }}>
                  <select
                    value={block.time}
                    onChange={(e) =>
                      updateBlockTime(
                        day.id,
                        block.id,
                        e.target.value,
                        syncShootingDays
                      )
                    }
                    style={{ width: "100%", fontSize: "11px" }}
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    const lunchScene = {
                      sceneNumber: "LUNCH",
                      metadata: { intExt: "", location: "", timeOfDay: "" },
                      heading: "LUNCH BREAK",
                      estimatedDuration: "60min",
                      isLunch: true,
                    };
                    handleDragStart(
                      e,
                      lunchScene,
                      "scheduled",
                      day.id,
                      block.id
                    );
                  }}
                  onDrop={(e) => onDrop(e, day.id, block.id)}
                  onDragOver={handleDragOver}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    cursor: "grab",
                    padding: "5px",
                    borderRadius: "3px",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "rgba(255,255,255,0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "transparent";
                  }}
                >
                  LUNCH
                </div>
                <div style={{ width: "35px", flexShrink: 0 }}></div>
              </div>
            );
          }

          const scene = block.scene;
          const isOddRow = index % 2 === 1;
          const backgroundColor = scene
            ? getSceneBlockColor(scene, isOddRow)
            : block.customItem
            ? isOddRow
              ? "#FFCDD2"
              : "#BBDEFB"
            : isOddRow
            ? "#FCE4EC"
            : "#E3F2FD";

          return (
            <div
              key={block.id}
              onDrop={day.isLocked ? null : (e) => onDrop(e, day.id, block.id)}
              onDragOver={day.isLocked ? null : handleDragOver}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: backgroundColor,
                border: "1px solid #ddd",
                minHeight: "40px",
                fontSize: "12px",
                padding: "5px",
                minWidth: 0,
                overflowX: "hidden",
              }}
            >
              <div style={{ width: "80px", padding: "0 8px", flexShrink: 0 }}>
                <select
                  value={block.time}
                  onChange={(e) =>
                    updateBlockTime(
                      day.id,
                      block.id,
                      e.target.value,
                      syncShootingDays
                    )
                  }
                  style={{ width: "100%", fontSize: "11px" }}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "0 8px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {scene ? (
                  <div
                    draggable={true}
                    onDragStart={(e) =>
                      handleDragStart(e, scene, "scheduled", day.id, block.id)
                    }
                    onDoubleClick={() => handleSceneDoubleClick(scene)}
                    title="Double-click to view script"
                    style={{
                      cursor: "grab",
                      padding: "4px",
                      borderRadius: "3px",
                      border: "1px dashed rgba(0,0,0,0.2)",
                      color: getSceneBlockTextColor(scene),
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "rgba(255,255,255,0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "transparent";
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Scene {scene.sceneNumber}: {scene.metadata?.intExt} -{" "}
                      {scene.metadata?.location}
                    </strong>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {scene.heading} | {scene.metadata?.timeOfDay} |{" "}
                      {scene.estimatedDuration}
                    </div>
                  </div>
                ) : block.customItem ? (
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      const customScene = {
                        sceneNumber: "CUSTOM",
                        metadata: { intExt: "", location: "", timeOfDay: "" },
                        heading: block.customItem,
                        estimatedDuration: "TBD",
                        isCustom: true,
                      };
                      handleDragStart(
                        e,
                        customScene,
                        "scheduled",
                        day.id,
                        block.id
                      );
                    }}
                    style={{
                      cursor: "grab",
                      padding: "4px",
                      borderRadius: "3px",
                      border: "1px dashed #FF9800",
                      backgroundColor: "rgba(255, 152, 0, 0.1)",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 152, 0, 0.2)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 152, 0, 0.1)";
                    }}
                  >
                    <strong style={{ color: "#FF6F00" }}>
                      📝 {block.customItem}
                    </strong>
                    <div style={{ fontSize: "11px", color: "#BF5F00" }}>
                      Custom Schedule Item
                    </div>
                  </div>
                ) : editingBlock === block.id ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter custom item..."
                      autoFocus
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: "12px",
                        border: "2px solid #2196F3",
                        borderRadius: "3px",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={saveCustomItem}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        padding: "4px 8px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <em
                    style={{ color: "#999", cursor: "pointer" }}
                    onDoubleClick={() => handleDoubleClickEmpty(block.id)}
                    title="Double-click to add custom item"
                  >
                    Empty time slot
                  </em>
                )}
              </div>

              <div
                style={{ width: "35px", textAlign: "center", flexShrink: 0 }}
              >
                {scene ? (
                  <button
                    onClick={() => removeScene(day.id, block.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                ) : block.customItem ? (
                  <button
                    onClick={() => updateCustomItem(day.id, block.id, null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                ) : (
                  <button
                    onClick={() => removeBlock(day.id, block.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "4px 6px",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function StripboardScheduleModule({
  selectedProject,
  syncLocks,
  stripboardScenes,
  scheduledScenes,
  onScheduleScene,
  onUnscheduleScene,
  shootingDays,
  setShootingDays,
  setScheduledScenes,
  setStripboardScenes,
  scriptLocations,
  scenes,
  setScenes,
  onUpdateScene,
  onSyncAllShootingDays,
  saveScenesDatabase,
  onSyncStripboardScenes,
  onSyncScheduledScenes,
  syncShootingDays,
  canEdit,
}) {
  const [draggedItem, setDraggedItem] = useState(null);
  const scrollContainerRef = useRef(null);
  const [selectedStatuses, setSelectedStatuses] = React.useState([
    "Not Scheduled",
    "Reshoot",
    "Pickups",
  ]);
  const [selectedParentLocation, setSelectedParentLocation] = useState("");
  const [selectedSubLocations, setSelectedSubLocations] = useState([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showScriptPopup, setShowScriptPopup] = useState(false);
  const [selectedSceneForScript, setSelectedSceneForScript] = useState(null);
  const [scriptFullMode, setScriptFullMode] = useState(false);
  const [scriptFullIndex, setScriptFullIndex] = useState(0);

  const lockQueue = useRef([]);
  const lockTimeout = useRef(null);

  useEffect(() => {
    if (!scrollContainerRef.current || !shootingDays.length) return;

    const storageKey = "stripboard-schedule-scroll-position";
    const hasAutoScrolledKey = "stripboard-schedule-has-auto-scrolled";

    const savedPosition = sessionStorage.getItem(storageKey);
    const hasAutoScrolled = sessionStorage.getItem(hasAutoScrolledKey);

    if (savedPosition !== null) {
      scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
      return;
    }

    if (hasAutoScrolled === "true") return;

    const firstActiveDay = shootingDays.find(
      (day) => !day.isLocked && !day.isCollapsed
    );

    if (firstActiveDay) {
      setTimeout(() => {
        const dayElement = document.getElementById(`day-${firstActiveDay.id}`);
        if (dayElement && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = dayElement.offsetTop - 20;
          sessionStorage.setItem(hasAutoScrolledKey, "true");
        }
      }, 0);
    } else {
      scrollContainerRef.current.scrollTop = 0;
      sessionStorage.setItem(hasAutoScrolledKey, "true");
    }
  }, [shootingDays]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        "stripboard-schedule-scroll-position",
        scrollContainerRef.current.scrollTop.toString()
      );
    }
  };

  const handleSceneDoubleClick = (scene) => {
    if (scene && scene.sceneNumber && scenes) {
      const scriptScene = scenes.find(
        (s) => s.sceneNumber === scene.sceneNumber
      );
      if (scriptScene) {
        setSelectedSceneForScript(scriptScene);
        setShowScriptPopup(true);
      }
    }
  };

  const closeScriptPopup = () => {
    setShowScriptPopup(false);
    setSelectedSceneForScript(null);
    setScriptFullMode(false);
  };

  const getSceneStatusColor = (sceneNumber) => {
    const stripboardScene = stripboardScenes?.find(
      (s) => s.sceneNumber === sceneNumber
    );
    const status = stripboardScene?.status || "Not Scheduled";
    const statusColors = {
      Scheduled: "#e8f5e9",
      Shot: "#e8f5e9",
      Pickups: "#fff8e1",
      Reshoot: "#ffebee",
      Complete: "#e3f2fd",
      "In Progress": "#f3e5f5",
      "Not Scheduled": "transparent",
    };
    return statusColors[status] || "transparent";
  };

  const getScheduleElementStyle = (type) => {
    const baseStyle = {
      fontFamily: "Courier New, monospace",
      fontSize: "12pt",
      lineHeight: "12pt",
      marginBottom: "12pt",
      color: "#000",
    };
    switch (type) {
      case "Character":
        return { ...baseStyle, marginLeft: "200px", textTransform: "uppercase", fontWeight: "normal" };
      case "Dialogue":
        return { ...baseStyle, marginLeft: "100px", marginRight: "100px" };
      case "Parenthetical":
        return { ...baseStyle, marginLeft: "150px", fontStyle: "italic" };
      case "Action":
        return { ...baseStyle, marginLeft: "0", marginRight: "0" };
      case "Scene Heading":
        return { ...baseStyle, marginLeft: "0", marginRight: "0", textTransform: "uppercase", fontWeight: "bold", marginTop: "24pt" };
      default:
        return baseStyle;
    }
  };

  const formatScheduleElementText = (block) => {
    let text = block.text;
    if (block.formatting) {
      if (block.formatting.bold) return React.createElement("strong", null, text);
      if (block.formatting.italic) return React.createElement("em", null, text);
      if (block.formatting.underline) return React.createElement("u", null, text);
    }
    if (block.type === "Character" && text.includes("(")) {
      const parts = text.split("(");
      const name = parts[0].trim();
      const extension = parts[1] ? `(${parts[1]}` : "";
      return React.createElement("span", null, name, extension && React.createElement("span", { style: { fontWeight: "normal" } }, ` ${extension}`));
    }
    return text;
  };

  const createDefaultScheduleBlocks = () => {
    const blocks = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({ id: crypto.randomUUID(), scene: null, time: "8:00 AM", type: "scene" });
    }
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "12:00 PM", type: "lunch", isLunch: true });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "1:00 PM", type: "scene" });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "2:00 PM", type: "scene" });
    blocks.push({ id: crypto.randomUUID(), scene: null, time: "END OF DAY", type: "endofday", isEndOfDay: true });
    return blocks;
  };

  const addShootingDay = () => {
    let nextDate;
    if (shootingDays.length === 0) {
      nextDate = new Date();
    } else {
      const lastDay = shootingDays[shootingDays.length - 1];
      nextDate = new Date(lastDay.date);
      nextDate.setDate(nextDate.getDate() + 1);
    }
    const newDay = {
      id: crypto.randomUUID(),
      date: nextDate.toISOString().split("T")[0],
      dayNumber: shootingDays.length + 1,
      scheduleBlocks: createDefaultScheduleBlocks(),
    };
    setShootingDays([...shootingDays, newDay]);
  };

  const removeShootingDay = (dayId) => {
    const dayToRemove = shootingDays.find((day) => day.id === dayId);
    if (!dayToRemove) { alert("Day not found."); return; }

    const confirmMessage = `Remove Day ${dayToRemove.dayNumber} (${dayToRemove.date})?`;
    if (!window.confirm(confirmMessage)) return;

    const updatedDays = shootingDays.filter((day) => day.id !== dayId);
    const renumberedDays = updatedDays
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((day, index) => ({ ...day, dayNumber: index + 1 }));

    setShootingDays(renumberedDays);

    database
      .deleteShootingDay(selectedProject, dayId)
      .then(() => {
        const dayNumberUpdates = renumberedDays.map((day) => ({ dayId: day.id, dayNumber: day.dayNumber }));
        return database.batchUpdateDayNumbers(selectedProject, dayNumberUpdates);
      })
      .then(() => {})
      .catch((error) => {
        console.error("❌ Atomic remove failed:", error);
        alert("⚠️ Failed to remove day. Please try again.");
      });
  };

  const updateShootingDayDate = (dayId, newDate) => {
    setShootingDays((days) => {
      const duplicateDay = days.find((day) => day.id !== dayId && day.date === newDate);
      if (duplicateDay) {
        alert(`Error: Day ${duplicateDay.dayNumber} is already scheduled for ${newDate}. Please choose a different date.`);
        return days;
      }

      const updatedDays = days.map((day) =>
        day.id === dayId ? { ...day, date: newDate } : day
      );
      const sortedDays = [...updatedDays].sort((a, b) => new Date(a.date) - new Date(b.date));
      const renumberedDays = sortedDays.map((day, index) => ({ ...day, dayNumber: index + 1 }));

      setShootingDays(renumberedDays);

      if (typeof onSyncAllShootingDays === "function") {
        onSyncAllShootingDays(renumberedDays);
      }

      const updatedDay = updatedDays.find((day) => day.id === dayId);
      const oldDay = days.find((day) => day.id === dayId);

      if (updatedDay && oldDay && updatedDay.date !== oldDay.date) {
        const newScheduledScenes = { ...scheduledScenes };
        const dayScenes = updatedDay.scheduleBlocks
          .filter((block) => block.scene !== null)
          .map((block) => block.scene);

        if (newScheduledScenes[oldDay.date]) {
          newScheduledScenes[oldDay.date] = newScheduledScenes[oldDay.date].filter(
            (scene) => !dayScenes.some((dayScene) => dayScene.sceneNumber === scene.sceneNumber)
          );
          if (newScheduledScenes[oldDay.date].length === 0) delete newScheduledScenes[oldDay.date];
        }

        if (dayScenes.length > 0) {
          if (!newScheduledScenes[newDate]) newScheduledScenes[newDate] = [];
          dayScenes.forEach((scene) => {
            const sceneIndex = stripboardScenes.findIndex((s) => s.sceneNumber === scene.sceneNumber);
            if (sceneIndex !== -1) {
              const updatedStripboard = [...stripboardScenes];
              updatedStripboard[sceneIndex].scheduledDate = newDate;
              setStripboardScenes(updatedStripboard);
            }
            if (!newScheduledScenes[newDate].some((s) => s.sceneNumber === scene.sceneNumber)) {
              newScheduledScenes[newDate].push(scene);
            }
          });
        }

        setScheduledScenes(newScheduledScenes);
      }

      return updatedDays;
    });
  };

  const getLocationHierarchy = () => {
    const hierarchy = {};
    if (scriptLocations) {
      scriptLocations.forEach((location) => {
        const parent = location.parentLocation;
        const sub = location.subLocation;
        if (!hierarchy[parent]) hierarchy[parent] = [];
        if (!hierarchy[parent].includes(sub)) hierarchy[parent].push(sub);
      });
    }
    return hierarchy;
  };

  const locationHierarchy = getLocationHierarchy();
  const statusOptions = ["Not Scheduled", "Scheduled", "Shot", "Pickups", "Reshoot"];

  const getStatusColor = (status) => {
    switch (status) {
      case "Scheduled": return "#2196F3";
      case "Shot": return "#4CAF50";
      case "Pickups": return "#FFC107";
      case "Reshoot": return "#F44336";
      default: return "#f0f0f0";
    }
  };

  const getStatusTextColor = (status) => {
    return status === "Pickups" ? "black" : status === "Not Scheduled" ? "#666" : "white";
  };

  const getSceneBlockColor = (scene, isOddRow) => {
    if (!scene) return "transparent";
    const currentScene = stripboardScenes.find((s) => s.sceneNumber === scene.sceneNumber);
    const status = currentScene?.status || scene.status || "Not Scheduled";
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "#F44336";
      case "Pickups":
      case "Scheduled Pickups":
      case "Shot Pickups":
        return "#FFC107";
      default:
        return isOddRow ? "#FFCDD2" : "#BBDEFB";
    }
  };

  const getSceneBlockTextColor = (scene) => {
    if (!scene) return "black";
    const status = scene.status || "Not Scheduled";
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "white";
      default:
        return "black";
    }
  };

  const handleParentLocationChange = (parentLocation) => {
    setSelectedParentLocation(parentLocation);
    setSelectedSubLocations([]);
  };

  const handleSelectAllSubLocations = () => {
    if (selectedParentLocation && locationHierarchy[selectedParentLocation]) {
      setSelectedSubLocations([...locationHierarchy[selectedParentLocation]]);
    }
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === 0) options.push(`12:${minute.toString().padStart(2, "0")} AM`);
        else if (hour < 12) options.push(`${hour}:${minute.toString().padStart(2, "0")} AM`);
        else if (hour === 12) options.push(`12:${minute.toString().padStart(2, "0")} PM`);
        else options.push(`${hour - 12}:${minute.toString().padStart(2, "0")} PM`);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const getFilteredScenes = () => {
    let filtered = stripboardScenes;
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((scene) => {
        const status = scene.status || "Not Scheduled";
        const isScheduled = !!scene.scheduledDate;
        if (isScheduled && (status === "Pickups" || status === "Reshoot")) return false;
        return selectedStatuses.includes(status);
      });
    }
    if (selectedParentLocation) {
      filtered = filtered.filter((scene) => {
        const sceneLocation = scene.metadata?.location || "";
        const matchesParent = sceneLocation.toUpperCase().includes(selectedParentLocation.toUpperCase());
        if (selectedSubLocations.length > 0) {
          const matchesSubLocation = selectedSubLocations.some((subLoc) =>
            sceneLocation.toUpperCase().includes(subLoc.toUpperCase())
          );
          return matchesParent && matchesSubLocation;
        }
        return matchesParent;
      });
    }
    return filtered;
  };

  const availableScenes = getFilteredScenes();

  const handleDragStart = (e, scene, source, sourceDayId = null, sourceBlockId = null) => {
    setDraggedItem({ scene, source, sourceDayId, sourceBlockId });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dayId, blockId) => {
    e.preventDefault();
    if (!draggedItem) return;

    const updatedDays = [...shootingDays];
    const targetDayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (targetDayIndex === -1) { setDraggedItem(null); return; }

    const targetBlocks = updatedDays[targetDayIndex].scheduleBlocks;
    const targetBlockIndex = targetBlocks.findIndex((block) => block.id === blockId);
    if (targetBlockIndex === -1) { setDraggedItem(null); return; }

    const targetBlock = targetBlocks[targetBlockIndex];

    if (draggedItem.source === "available") {
      if (targetBlock.type !== "scene") { setDraggedItem(null); return; }

      if (targetBlock.scene) {
        const displacedScene = targetBlock.scene;
        const emptyBlockIndex = targetBlocks.findIndex((block) => block.type === "scene" && block.scene === null);
        if (emptyBlockIndex !== -1) {
          targetBlocks[emptyBlockIndex].scene = displacedScene;
        } else {
          if (onUnscheduleScene) onUnscheduleScene(stripboardScenes.indexOf(displacedScene));
        }
      }

      const latestScene = stripboardScenes.find((s) => s.sceneNumber === draggedItem.scene.sceneNumber) || draggedItem.scene;
      targetBlock.scene = latestScene;
      setShootingDays(updatedDays);

      onScheduleScene(stripboardScenes.indexOf(latestScene), updatedDays[targetDayIndex].date, targetBlock.time);

      syncLocks.current.shootingDays = true;
      database
        .updateShootingDayScheduleBlocks(selectedProject, dayId, updatedDays[targetDayIndex].scheduleBlocks)
        .then(() => { syncLocks.current.shootingDays = false; })
        .catch((error) => { console.error("❌ Atomic schedule blocks update failed:", error); syncLocks.current.shootingDays = false; });

    } else if (draggedItem.source === "scheduled") {
      const sourceDayIndex = updatedDays.findIndex((day) => day.id === draggedItem.sourceDayId);
      if (sourceDayIndex === -1) { setDraggedItem(null); return; }

      const sourceBlocks = updatedDays[sourceDayIndex].scheduleBlocks;
      const sourceBlockIndex = sourceBlocks.findIndex((block) => block.id === draggedItem.sourceBlockId);
      if (sourceBlockIndex === -1) { setDraggedItem(null); return; }

      const sourceBlock = sourceBlocks[sourceBlockIndex];

      if (draggedItem.sourceDayId === dayId && draggedItem.sourceBlockId === blockId) {
        setDraggedItem(null);
        return;
      }

      if (draggedItem.scene.isLunch) {
        if (targetBlock.type !== "scene") { setDraggedItem(null); return; }
        const sourceLunchBlock = { ...sourceBlock };
        const targetSceneBlock = { ...targetBlock };
        sourceBlocks[sourceBlockIndex] = { ...targetSceneBlock, id: sourceBlock.id };
        targetBlocks[targetBlockIndex] = { ...sourceLunchBlock, id: targetBlock.id };
        setShootingDays(updatedDays);
      } else if (draggedItem.scene.isCustom) {
        if (targetBlock.type !== "scene") { setDraggedItem(null); return; }
        const customItemToMove = sourceBlock.customItem;
        const displacedScene = targetBlock.scene;
        const displacedCustomItem = targetBlock.customItem;
        delete sourceBlock.customItem;
        if (targetBlock.scene) targetBlock.scene = null;
        if (targetBlock.customItem) delete targetBlock.customItem;
        targetBlock.customItem = customItemToMove;
        if (displacedScene || displacedCustomItem) {
          let emptyBlockIndex = targetBlocks.findIndex((block) => block.type === "scene" && !block.scene && !block.customItem);
          if (emptyBlockIndex !== -1) {
            if (displacedScene) targetBlocks[emptyBlockIndex].scene = displacedScene;
            if (displacedCustomItem) targetBlocks[emptyBlockIndex].customItem = displacedCustomItem;
          } else {
            if (displacedScene) sourceBlock.scene = displacedScene;
            if (displacedCustomItem) sourceBlock.customItem = displacedCustomItem;
          }
        }
        setShootingDays(updatedDays);
      } else {
        if (targetBlock.type !== "scene") { setDraggedItem(null); return; }

        const sceneToMove = sourceBlock.scene;
        const displacedScene = targetBlock.scene;
        sourceBlock.scene = null;
        targetBlock.scene = sceneToMove;

        if (displacedScene) {
          let emptyBlockIndex = targetBlocks.findIndex((block) => block.type === "scene" && block.scene === null);
          if (emptyBlockIndex !== -1) {
            targetBlocks[emptyBlockIndex].scene = displacedScene;
          } else {
            if (sourceDayIndex !== targetDayIndex) {
              emptyBlockIndex = sourceBlocks.findIndex((block) => block.type === "scene" && block.scene === null);
              if (emptyBlockIndex !== -1) sourceBlocks[emptyBlockIndex].scene = displacedScene;
              else sourceBlock.scene = displacedScene;
            } else {
              sourceBlock.scene = displacedScene;
            }
          }
        }

        if (sourceDayIndex !== targetDayIndex && sceneToMove && !sceneToMove.isLunch) {
          const sourceDate = updatedDays[sourceDayIndex].date;
          const targetDate = updatedDays[targetDayIndex].date;
          const updatedStripboard = [...stripboardScenes];
          const movedSceneIndex = updatedStripboard.findIndex((s) => s.sceneNumber === sceneToMove.sceneNumber);
          if (movedSceneIndex !== -1) {
            updatedStripboard[movedSceneIndex].scheduledDate = targetDate;
            setStripboardScenes(updatedStripboard);
          }
          const newScheduledScenes = { ...scheduledScenes };
          if (newScheduledScenes[sourceDate]) {
            newScheduledScenes[sourceDate] = newScheduledScenes[sourceDate].filter((scene) => scene.sceneNumber !== sceneToMove.sceneNumber);
            if (newScheduledScenes[sourceDate].length === 0) delete newScheduledScenes[sourceDate];
          }
          if (!newScheduledScenes[targetDate]) newScheduledScenes[targetDate] = [];
          if (!newScheduledScenes[targetDate].some((scene) => scene.sceneNumber === sceneToMove.sceneNumber)) {
            newScheduledScenes[targetDate].push(sceneToMove);
          }
          setScheduledScenes(newScheduledScenes);
          if (onSyncScheduledScenes) onSyncScheduledScenes(newScheduledScenes);
        }

        setShootingDays(updatedDays);

        syncLocks.current.shootingDays = true;
        if (sourceDayIndex !== targetDayIndex) {
          database
            .updateTwoShootingDaySchedules(
              selectedProject,
              updatedDays[sourceDayIndex].id, updatedDays[sourceDayIndex].scheduleBlocks,
              updatedDays[targetDayIndex].id, updatedDays[targetDayIndex].scheduleBlocks
            )
            .then(() => { syncLocks.current.shootingDays = false; })
            .catch((error) => { console.error("❌ Atomic two-day update failed:", error); syncLocks.current.shootingDays = false; });
        } else {
          database
            .updateShootingDayScheduleBlocks(selectedProject, dayId, updatedDays[targetDayIndex].scheduleBlocks)
            .then(() => { syncLocks.current.shootingDays = false; })
            .catch((error) => { console.error("❌ Atomic schedule blocks update failed:", error); syncLocks.current.shootingDays = false; });
        }
      }
    }

    setDraggedItem(null);
  };

  const removeScene = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1 || !blocks[blockIndex].scene) return;

    const scene = blocks[blockIndex].scene;
    blocks[blockIndex].scene = null;
    setShootingDays(updatedDays);

    const updatedStripboard = [...stripboardScenes];
    const stripboardIndex = updatedStripboard.findIndex(
      (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
    );

    if (stripboardIndex !== -1) {
      const originalStatus = updatedStripboard[stripboardIndex].status;
      const newStatus = originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;
      updatedStripboard[stripboardIndex] = { ...updatedStripboard[stripboardIndex], status: newStatus, scheduledDate: null, scheduledTime: null };
      setStripboardScenes(updatedStripboard);

      database
        .updateStripboardSceneSchedule(selectedProject, scene.sceneNumber.toString(), newStatus, null, null)
        .catch((error) => { console.error("❌ Atomic scene update failed:", error); alert("⚠️ Failed to update scene schedule. Please try again."); });
    }

    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex(
      (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
    );
    if (mainSceneIndex !== -1) {
      const originalStatus = updatedMainScenes[mainSceneIndex].status;
      const newStatus = originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;
      updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: newStatus };
      setScenes(updatedMainScenes);
      database
        .updateSceneStatus(selectedProject, scene.sceneNumber.toString(), newStatus)
        .catch((error) => { console.error("❌ Atomic scene status update failed:", error); });
    }

    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, updatedDays[dayIndex].scheduleBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((error) => { console.error("❌ Atomic schedule blocks update failed:", error); syncLocks.current.shootingDays = false; });

    const dayDate = updatedDays[dayIndex].date;
    const newScheduledScenes = { ...scheduledScenes };
    if (newScheduledScenes[dayDate]) {
      newScheduledScenes[dayDate] = newScheduledScenes[dayDate].filter((s) => s.sceneNumber !== scene.sceneNumber);
      if (newScheduledScenes[dayDate].length === 0) delete newScheduledScenes[dayDate];
      setScheduledScenes(newScheduledScenes);
      if (onSyncScheduledScenes) onSyncScheduledScenes(newScheduledScenes);
    }
  };

  const removeBlock = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const sceneBlocks = blocks.filter((block) => block.type === "scene");
    if (sceneBlocks.length <= 2) { alert("Must have at least 2 scene blocks per day"); return; }

    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex !== -1) {
      const blockToRemove = blocks[blockIndex];
      if (blockToRemove.scene && onUnscheduleScene) {
        const sceneIndex = stripboardScenes.findIndex((s) => s.sceneNumber === blockToRemove.scene.sceneNumber);
        if (sceneIndex !== -1) onUnscheduleScene(sceneIndex);
      }
      blocks.splice(blockIndex, 1);
      setShootingDays(updatedDays);
      if (onSyncAllShootingDays) onSyncAllShootingDays();
    }
  };

  const addBlock = (dayId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const sceneBlocks = blocks.filter((block) => block.type === "scene");
    const lastSceneBlock = sceneBlocks[sceneBlocks.length - 1];

    let newTime = "8:00 AM";
    if (lastSceneBlock && lastSceneBlock.time) {
      const timeStr = lastSceneBlock.time;
      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      let newMinutes = minutes + 15;
      let newHours = hours;
      if (newMinutes >= 60) { newMinutes = 0; newHours += 1; }
      let newPeriod = period;
      if (newHours > 12) { newHours -= 12; newPeriod = period === "AM" ? "PM" : "AM"; }
      else if (newHours === 12 && period === "AM") newPeriod = "PM";
      newTime = `${newHours}:${newMinutes.toString().padStart(2, "0")} ${newPeriod}`;
    }

    const newBlock = { id: Date.now(), scene: null, time: newTime, type: "scene" };
    const endOfDayIndex = blocks.findIndex((block) => block.isEndOfDay);
    if (endOfDayIndex !== -1) blocks.splice(endOfDayIndex, 0, newBlock);
    else blocks.push(newBlock);
    setShootingDays(updatedDays);
  };

  const updateBlockTime = (dayId, blockId, newTime, syncFunction) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex === -1) return;

    blocks[blockIndex].time = newTime;
    setShootingDays(updatedDays);

    const changedDay = updatedDays[dayIndex];
    syncLocks.current.shootingDays = true;
    database
      .updateShootingDayScheduleBlocks(selectedProject, dayId, changedDay.scheduleBlocks)
      .then(() => { syncLocks.current.shootingDays = false; })
      .catch((error) => { console.error("❌ Atomic time change update failed:", error); syncLocks.current.shootingDays = false; });
  };

  const updateDayCollapse = (dayId, isCollapsed) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex !== -1) {
      updatedDays[dayIndex] = { ...updatedDays[dayIndex], isCollapsed };
      setShootingDays(updatedDays);
    }
  };

  const lockDayAndMarkShot = (dayId) => {
    lockQueue.current.push(dayId);
    if (lockTimeout.current) clearTimeout(lockTimeout.current);
    lockTimeout.current = setTimeout(() => { processBatchLock(); }, 500);
  };

  const processBatchLock = () => {
    if (lockQueue.current.length === 0) return;

    const daysToLock = [...lockQueue.current];
    lockQueue.current = [];

    const updatedDays = [...shootingDays];
    const allScenesUpdated = [];
    const allStripboardUpdated = [...stripboardScenes];

    daysToLock.forEach((dayId) => {
      const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
      if (dayIndex === -1) return;

      updatedDays[dayIndex] = { ...updatedDays[dayIndex], isLocked: true, isCollapsed: true, isShot: true };

      const scheduledScenesForDay = updatedDays[dayIndex].scheduleBlocks
        .filter((block) => block.scene && !block.scene.isLunch && !block.scene.isCustom)
        .map((block) => block.scene);

      allScenesUpdated.push(...scheduledScenesForDay);
    });

    allScenesUpdated.forEach((scene) => {
      const sceneIndex = allStripboardUpdated.findIndex(
        (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
      );
      if (sceneIndex !== -1) {
        allStripboardUpdated[sceneIndex] = { ...allStripboardUpdated[sceneIndex], status: "Shot", scheduledDate: null, scheduledTime: null };
      }
    });

    const updatedMainScenes = [...scenes];
    allScenesUpdated.forEach((scene) => {
      const mainSceneIndex = updatedMainScenes.findIndex((s) => s.sceneNumber === scene.sceneNumber);
      if (mainSceneIndex !== -1) {
        updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Shot" };
      }
    });

    setShootingDays(updatedDays);
    setStripboardScenes(allStripboardUpdated);
    setScenes(updatedMainScenes);

    const dayUpdates = daysToLock.map((dayId) => ({ dayId, isLocked: true, isShot: true, isCollapsed: true }));

    database
      .batchUpdateShootingDayStatuses(selectedProject, dayUpdates)
      .catch((error) => {
        console.error("❌ Atomic batch update failed:", error);
        alert("⚠️ Failed to save day lock status. Please try again.");
      });

    setTimeout(() => {
      const mainSceneUpdates = allScenesUpdated.map((scene) =>
        database.updateSceneStatus(selectedProject, scene.sceneNumber.toString(), "Shot")
      );
      Promise.all(mainSceneUpdates).catch((error) => { console.error("❌ Atomic main scenes batch update failed:", error); });

      const sceneUpdates = allScenesUpdated.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Shot",
        scheduled_date: null,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .catch((error) => { console.error("❌ Atomic stripboard batch update failed:", error); alert("⚠️ Failed to save scene statuses. Please try again."); });
    }, 100);

    alert(`Batch locked ${daysToLock.length} days! ${allScenesUpdated.length} scenes marked as Shot.`);
  };

  const unlockDay = (dayId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const day = updatedDays[dayIndex];
    const confirmUnlock = window.confirm(
      `Are you sure you want to unlock Day ${day.dayNumber}? This will change scene statuses back to "Scheduled".`
    );

    if (confirmUnlock) {
      const dayScenes = day.scheduleBlocks
        .filter((block) => block.scene && !block.scene.isLunch && !block.scene.isCustom)
        .map((block) => block.scene);

      const updatedStripboard = [...stripboardScenes];
      dayScenes.forEach((scene) => {
        const sceneIndex = updatedStripboard.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );
        if (sceneIndex !== -1) {
          updatedStripboard[sceneIndex] = { ...updatedStripboard[sceneIndex], status: "Scheduled", scheduledDate: day.date };
        }
      });
      setStripboardScenes(updatedStripboard);

      const sceneUpdates = dayScenes.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Scheduled",
        scheduled_date: day.date,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .catch((error) => { console.error("❌ Atomic stripboard update failed:", error); alert("⚠️ Failed to update scene statuses. Please try again."); });

      const updatedMainScenes = [...scenes];
      dayScenes.forEach((scene) => {
        const mainSceneIndex = updatedMainScenes.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );
        if (mainSceneIndex !== -1) {
          updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Scheduled" };
        }
      });
      setScenes(updatedMainScenes);

      const mainSceneUpdates = dayScenes.map((scene) =>
        database.updateSceneStatus(selectedProject, scene.sceneNumber.toString(), "Scheduled")
      );
      Promise.all(mainSceneUpdates).catch((error) => { console.error("❌ Atomic main scenes unlock failed:", error); });

      updatedDays[dayIndex] = { ...day, isLocked: false, isShot: false };
      setShootingDays(updatedDays);

      Promise.all([
        database.updateShootingDayLockStatus(selectedProject, dayId, false),
        database.updateShootingDayShotStatus(selectedProject, dayId, false),
      ]).catch((error) => { console.error("❌ Atomic unlock failed:", error); alert("⚠️ Failed to save unlock status. Please try again."); });

      alert(`Day ${day.dayNumber} unlocked! Scenes restored to Scheduled status.`);
    }
  };

  const resetSceneToUnscheduled = (sceneNumber) => {
    const confirmReset = window.confirm(
      `Reset Scene ${sceneNumber} to completely unscheduled state?\n\nThis will:\n- Set status to "Not Scheduled"\n- Clear scheduled date and time\n- Remove from all shooting days\n- Make scene available for scheduling again`
    );
    if (!confirmReset) return;

    const updatedStripboard = [...stripboardScenes];
    const stripboardIndex = updatedStripboard.findIndex(
      (s) => s.sceneNumber.toString() === sceneNumber.toString()
    );
    if (stripboardIndex !== -1) {
      updatedStripboard[stripboardIndex] = { ...updatedStripboard[stripboardIndex], status: "Not Scheduled", scheduledDate: null, scheduledTime: null };
      setStripboardScenes(updatedStripboard);
      database
        .clearStripboardSceneSchedule(selectedProject, sceneNumber.toString())
        .catch((error) => { console.error("❌ Atomic scene reset failed:", error); alert("⚠️ Failed to reset scene. Please try again."); });
    }

    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex((s) => s.sceneNumber.toString() === sceneNumber.toString());
    if (mainSceneIndex !== -1) {
      updatedMainScenes[mainSceneIndex] = { ...updatedMainScenes[mainSceneIndex], status: "Not Scheduled" };
      setScenes(updatedMainScenes);
      if (saveScenesDatabase) saveScenesDatabase(updatedMainScenes);
    }

    const updatedDays = shootingDays.map((day) => ({
      ...day,
      scheduleBlocks: day.scheduleBlocks.map((block) => {
        if (block.scene && block.scene.sceneNumber.toString() === sceneNumber.toString()) {
          return { ...block, scene: null };
        }
        return block;
      }),
    }));
    setShootingDays(updatedDays);
    if (onSyncAllShootingDays) onSyncAllShootingDays();

    const newScheduledScenes = { ...scheduledScenes };
    Object.keys(newScheduledScenes).forEach((date) => {
      newScheduledScenes[date] = newScheduledScenes[date].filter((s) => s.sceneNumber.toString() !== sceneNumber.toString());
      if (newScheduledScenes[date].length === 0) delete newScheduledScenes[date];
    });
    setScheduledScenes(newScheduledScenes);
    if (onSyncScheduledScenes) onSyncScheduledScenes(newScheduledScenes);

    alert(`Scene ${sceneNumber} reset to unscheduled state.`);
  };

  const updateCustomItem = (dayId, blockId, customText) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
    if (dayIndex === -1) return;

    const blocks = updatedDays[dayIndex].scheduleBlocks;
    const blockIndex = blocks.findIndex((block) => block.id === blockId);
    if (blockIndex !== -1) {
      if (customText) blocks[blockIndex].customItem = customText;
      else delete blocks[blockIndex].customItem;
      setShootingDays(updatedDays);
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowScriptPopup(false);
      setSelectedSceneForScript(null);
      setShowStatusDropdown(false);
      setShowLocationDropdown(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div style={{ padding: "20px", minHeight: "100vh", width: "100%", maxWidth: "100vw", fontFamily: "Arial, sans-serif", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: "15px", width: "100%", overflow: "hidden", boxSizing: "border-box" }}>
        {/* Available Scenes Panel */}
        <div style={{ width: "300px", border: "1px solid #ccc", position: "sticky", top: "20px", alignSelf: "flex-start", maxHeight: "calc(100vh - 40px)", overflow: "hidden", flexShrink: 0, zIndex: 100, backgroundColor: "white" }}>
          <div style={{ backgroundColor: "#4CAF50", color: "white", padding: "10px", fontWeight: "bold", textAlign: "center" }}>
            <div style={{ marginBottom: "8px" }}>Available Scenes ({availableScenes.length})</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {/* Status Filter */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                  Status ({selectedStatuses.length})
                </button>
                {showStatusDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "3px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 1000, minWidth: "150px", color: "black" }}>
                    {statusOptions.map((status) => (
                      <label key={status} style={{ display: "flex", alignItems: "center", padding: "4px 8px", fontSize: "10px", cursor: "pointer" }}>
                        <input type="checkbox" checked={selectedStatuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStatuses([...selectedStatuses, status]);
                            else setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                          }}
                          style={{ marginRight: "4px" }} />
                        {status}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Filter */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                  Location {selectedParentLocation ? `(${selectedParentLocation})` : ""}
                </button>
                {showLocationDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "3px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 1000, width: "280px", color: "black", maxHeight: "300px", overflowY: "auto" }}>
                    <div style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                      <button onClick={() => { setSelectedParentLocation(""); setSelectedSubLocations([]); }}
                        style={{ backgroundColor: "transparent", border: "none", fontSize: "10px", cursor: "pointer", color: selectedParentLocation ? "black" : "blue" }}>
                        All Locations
                      </button>
                    </div>
                    {Object.keys(locationHierarchy).map((parent) => (
                      <div key={parent}>
                        <div style={{ padding: "4px 8px", fontSize: "10px", fontWeight: "bold", backgroundColor: selectedParentLocation === parent ? "#e3f2fd" : "transparent", cursor: "pointer" }}
                          onClick={() => {
                            if (selectedParentLocation === parent) { setSelectedParentLocation(""); setSelectedSubLocations([]); }
                            else handleParentLocationChange(parent);
                          }}>
                          📍 {parent}
                        </div>
                        {selectedParentLocation === parent && (
                          <div style={{ paddingLeft: "16px", backgroundColor: "#f9f9f9" }}>
                            <div style={{ padding: "2px 4px" }}>
                              <button onClick={handleSelectAllSubLocations}
                                style={{ backgroundColor: "transparent", border: "1px solid #ccc", fontSize: "9px", cursor: "pointer", padding: "2px 4px", marginBottom: "4px" }}>
                                Select All
                              </button>
                            </div>
                            {locationHierarchy[parent].map((sub) => (
                              <label key={sub} style={{ display: "flex", alignItems: "center", padding: "2px 4px", fontSize: "9px", cursor: "pointer" }}>
                                <input type="checkbox" checked={selectedSubLocations.includes(sub)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedSubLocations([...selectedSubLocations, sub]);
                                    else setSelectedSubLocations(selectedSubLocations.filter((s) => s !== sub));
                                  }}
                                  style={{ marginRight: "4px" }} />
                                {sub}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => { setSelectedStatuses(["Not Scheduled"]); setSelectedParentLocation(""); setSelectedSubLocations([]); }}
                style={{ backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}>
                Clear
              </button>
            </div>
          </div>

          {showLocationDropdown && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }} onClick={() => setShowLocationDropdown(false)} />
          )}
          {showStatusDropdown && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }} onClick={() => setShowStatusDropdown(false)} />
          )}

          <div style={{ height: "calc(100vh - 120px)", overflowY: "auto", padding: "10px" }}>
            {availableScenes.map((scene, index) => {
              const isScheduled = !!scene.scheduledDate;
              return (
                <div key={scene.sceneNumber} style={{ padding: "8px", margin: "4px 0", backgroundColor: isScheduled ? "#e0e0e0" : getStatusColor(scene.status || "Not Scheduled"), border: "1px solid #ddd", borderRadius: "4px", fontSize: "12px", opacity: isScheduled ? 0.6 : 1, position: "relative" }}>
                  <div draggable={!isScheduled} onDragStart={(e) => !isScheduled && handleDragStart(e, scene, "available")}
                    onDoubleClick={() => handleSceneDoubleClick(scene)} title="Double-click to view script"
                    style={{ cursor: isScheduled ? "not-allowed" : "grab", color: isScheduled ? "#666" : getStatusTextColor(scene.status || "Not Scheduled") }}>
                    <div style={{ fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Scene {scene.sceneNumber}: {scene.metadata?.intExt || ""} - {scene.metadata?.location || ""}</span>
                      {isScheduled && (
                        <button onClick={(e) => { e.stopPropagation(); resetSceneToUnscheduled(scene.sceneNumber); }}
                          title="Reset scene to unscheduled"
                          style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", fontSize: "10px", padding: "2px 6px", marginLeft: "4px" }}>
                          Reset
                        </button>
                      )}
                    </div>
                    <div style={{ color: isScheduled ? "#888" : "#666" }}>
                      {scene.metadata?.timeOfDay} | {scene.estimatedDuration}
                      {isScheduled && <span style={{ fontSize: "10px", marginLeft: "8px" }}>(Scheduled)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Blocks Container */}
        <div ref={scrollContainerRef} onScroll={handleScroll}
          style={{ flex: 1, minWidth: 0, overflow: "auto", width: "calc(100% - 315px)", maxHeight: "calc(100vh - 40px)" }}>
          {shootingDays.map((day) => (
            <DayBlock
              key={day.id}
              day={day}
              timeOptions={timeOptions}
              onDrop={handleDrop}
              handleDragOver={handleDragOver}
              handleDragStart={handleDragStart}
              removeScene={removeScene}
              removeBlock={removeBlock}
              addBlock={addBlock}
              updateShootingDayDate={updateShootingDayDate}
              removeShootingDay={removeShootingDay}
              updateBlockTime={updateBlockTime}
              syncShootingDays={syncShootingDays}
              updateCustomItem={updateCustomItem}
              lockDayAndMarkShot={lockDayAndMarkShot}
              unlockDay={unlockDay}
              getSceneBlockColor={getSceneBlockColor}
              getSceneBlockTextColor={getSceneBlockTextColor}
              updateDayCollapse={updateDayCollapse}
              handleSceneDoubleClick={handleSceneDoubleClick}
              canEdit={canEdit}
            />
          ))}

          <div style={{ backgroundColor: "#f5f5f5", padding: "20px", textAlign: "center", borderTop: "2px solid #ddd", marginTop: "20px" }}>
            <button onClick={addShootingDay}
              style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "12px 24px", fontSize: "14px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              + Add Shooting Day {shootingDays.length + 1}
            </button>
          </div>
        </div>

        {/* Script Popup Modal */}
        {showScriptPopup && selectedSceneForScript && (() => {
          const activeScene = scriptFullMode ? scenes[scriptFullIndex] || selectedSceneForScript : selectedSceneForScript;
          return (
            <>
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeScriptPopup}>
                <div style={{ backgroundColor: "white", width: "90%", maxWidth: "9.28in", height: "85%", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ backgroundColor: "#2196F3", color: "white", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {scriptFullMode && (
                        <button onClick={() => setScriptFullIndex(Math.max(0, scriptFullIndex - 1))} disabled={scriptFullIndex === 0}
                          style={{ backgroundColor: scriptFullIndex === 0 ? "#ccc" : "white", color: scriptFullIndex === 0 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === 0 ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                          ← Prev
                        </button>
                      )}
                      <h3 style={{ margin: 0, fontSize: "16px" }}>
                        Scene {activeScene.sceneNumber}
                        {scriptFullMode && ` (${scriptFullIndex + 1} of ${scenes.length})`}
                        {" - "}{activeScene.heading}
                      </h3>
                      {scriptFullMode && (
                        <button onClick={() => setScriptFullIndex(Math.min(scenes.length - 1, scriptFullIndex + 1))} disabled={scriptFullIndex === scenes.length - 1}
                          style={{ backgroundColor: scriptFullIndex === scenes.length - 1 ? "#ccc" : "white", color: scriptFullIndex === scenes.length - 1 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === scenes.length - 1 ? "not-allowed" : "pointer", fontWeight: "bold" }}>
                          Next →
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", userSelect: "none", color: "white" }}>
                        <input type="checkbox" checked={scriptFullMode}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const fi = (scenes || []).findIndex((s) => String(s.sceneNumber) === String(selectedSceneForScript.sceneNumber));
                              setScriptFullIndex(fi >= 0 ? fi : 0);
                            }
                            setScriptFullMode(e.target.checked);
                          }}
                          style={{ cursor: "pointer", accentColor: "white" }} />
                        Full Script
                      </label>
                      <button onClick={closeScriptPopup} style={{ backgroundColor: "transparent", border: "none", color: "white", fontSize: "24px", cursor: "pointer", padding: "0 5px" }}>×</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: getSceneStatusColor(activeScene.sceneNumber), boxSizing: "border-box", textAlign: "left", fontFamily: "Courier New, monospace" }}>
                    <div style={getScheduleElementStyle("Scene Heading")}>{activeScene.heading}</div>
                    {activeScene.content && activeScene.content.map((block, blockIndex) => (
                      <div key={blockIndex} style={getScheduleElementStyle(block.type)}>{formatScheduleElementText(block)}</div>
                    ))}
                    {!activeScene.content && <div style={getScheduleElementStyle("Action")}>{activeScene.text || "Scene content not available"}</div>}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

export default StripboardScheduleModule;