import React from "react";

function Dashboard({
  user,
  selectedProject,
  todoItems,
  shootingDays,
  scheduledScenes,
  stripboardScenes,
  callSheetData,
  castCrew,
  scenes,
  costCategories,
  characters,
  userRole,
  setActiveModule,
  canEdit,
  isViewOnly,
  projectSettings,
  setProjectSettings,
  syncProjectSettingsToDatabase,
}) {
  const [editingSettings, setEditingSettings] = React.useState(false);
  const [producerLines, setProducerLines] = React.useState([""]);
  const [execProducerLines, setExecProducerLines] = React.useState([""]);

  React.useEffect(() => {
    if (editingSettings) {
      const raw = projectSettings.producer || "";
      setProducerLines(raw ? raw.split("\n") : [""]);
      const rawExec = projectSettings.executiveProducer || "";
      setExecProducerLines(rawExec ? rawExec.split("\n") : [""]);
    }
  }, [editingSettings]); // intentionally omits projectSettings from deps — only re-init on modal open

  const updateProjectSettings = (field, value) => {
    setProjectSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Get user's person record from cast_crew
  const userPerson = castCrew.find((p) => p.user_id === user?.id);

  // Filter user's tasks
  const myTasks = userPerson
    ? todoItems
        .filter((task) => {
          const assigned = task.assignedTo?.split(",") || [];
          return assigned.includes(userPerson.id) && !task.completed;
        })
        .sort((a, b) => {
          const dateA = new Date(a.dueDate);
          const dateB = new Date(b.dueDate);
          const today = new Date();
          // Sort: overdue first, then by due date
          if (dateA < today && dateB >= today) return -1;
          if (dateA >= today && dateB < today) return 1;
          return dateA - dateB;
        })
    : []; // Show no tasks if not linked

  // Get next shoot day (use local date to avoid timezone issues)
  const today = new Date();
  const localToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
    .toISOString()
    .split("T")[0];

  const nextShootDay = shootingDays
    .filter((day) => day.date >= localToday && !day.isShot)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  // Get scenes for next shoot day (scheduledScenes is an object keyed by date)
  // Extract scene numbers from either objects or strings
  const nextShootScenesRaw = nextShootDay
    ? scheduledScenes[nextShootDay.date] || []
    : [];

  const nextShootScenes = nextShootScenesRaw.map((item) =>
    typeof item === "string" ? item : item.sceneNumber
  );

  // Calculate production stats
  const totalScenes = stripboardScenes.length;
  const shotScenes = stripboardScenes.filter((s) => s.status === "Shot").length;
  const totalDays = shootingDays.length;

  const shotDays = shootingDays.filter((d) => d.isLocked && d.isShot).length;
  const percentComplete =
    totalScenes > 0 ? Math.round((shotScenes / totalScenes) * 100) : 0;

  // Get upcoming shoot days
  const upcomingDays = shootingDays
    .filter((day) => day.date >= localToday && !day.isShot)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Get cast for next shoot day
  const getScheduledCast = () => {
    if (!nextShootDay || nextShootScenes.length === 0) {
      return [];
    }

    // Find all characters that appear in the scheduled scenes
    const castSet = new Set();
    Object.values(characters).forEach((character) => {
      const appearsInScheduledScenes = character.scenes.some((sceneNum) =>
        nextShootScenes.includes(sceneNum.toString())
      );
      if (appearsInScheduledScenes) {
        castSet.add(character.name);
      }
    });

    const scheduledCast = Array.from(castSet)
      .map((characterName) => {
        const person = castCrew.find(
          (p) => p.role === characterName && p.type === "cast"
        );

        // Get call time from callSheetData
        // First check for day-specific override
        const daySpecificTimes =
          callSheetData.castCallTimes?.[nextShootDay.day_id]?.[characterName];
        const characterTimes = callSheetData.castCallTimes?.[characterName];
        const generalCallTime =
          callSheetData.callTimeByDay?.[nextShootDay.day_id] ||
          callSheetData.callTime;

        // Use set time if available, otherwise makeup time, otherwise general call time
        let callTime = "TBD";
        if (daySpecificTimes) {
          callTime =
            daySpecificTimes.set || daySpecificTimes.makeup || generalCallTime;
        } else if (characterTimes) {
          callTime =
            characterTimes.set || characterTimes.makeup || generalCallTime;
        } else {
          callTime = generalCallTime || "TBD";
        }

        return {
          name: person?.name || characterName,
          character: characterName,
          callTime: callTime,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return scheduledCast;
  };

  const scheduledCast = getScheduledCast();

  // Helper function to parse page length as eighths (same as CallSheet)
  const parsePageLengthToEighths = (pageStr) => {
    if (!pageStr) return 0;

    const parts = String(pageStr).trim().split(" ");

    if (parts.length === 1) {
      // Just a fraction like "6/8" or whole number like "2"
      if (parts[0].includes("/")) {
        const [num] = parts[0].split("/").map(Number);
        return num; // Return numerator (already in eighths)
      }
      return parseInt(parts[0]) * 8; // Whole number to eighths
    } else {
      // Mixed number like "1 6/8"
      const wholeNumber = parseInt(parts[0]);
      const [num] = parts[1].split("/").map(Number);
      return wholeNumber * 8 + num;
    }
  };

  // Convert eighths back to display format
  const eighthsToDisplayFormat = (eighths) => {
    const wholePages = Math.floor(eighths / 8);
    const remainderEighths = eighths % 8;

    if (remainderEighths === 0) {
      return wholePages.toString();
    } else if (wholePages === 0) {
      return `${remainderEighths}/8`;
    } else {
      return `${wholePages} ${remainderEighths}/8`;
    }
  };

  // Calculate total pages for next shoot day
  const totalEighths = nextShootScenes.reduce((total, sceneNum) => {
    // Use loose equality to handle string/number mismatch
    const scene = stripboardScenes.find((s) => s.sceneNumber == sceneNum);
    // Check both property names (page_length and pageLength)
    const pageLength = scene?.pageLength || scene?.page_length;
    return total + parsePageLengthToEighths(pageLength);
  }, 0);

  const totalPages = eighthsToDisplayFormat(totalEighths);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
      {/* Header bar — same structure as Script Breakdown */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ flex: 1, display: "flex", minHeight: "38px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center", padding: "5px 12px", boxSizing: "border-box" }}>
            <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold", flexShrink: 0 }}>PRODUCTION DASHBOARD</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
              {canEdit(userRole) && (
                <button
                  onClick={() => setEditingSettings(true)}
                  style={{ padding: "6px 14px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
                >
                  PROJECT SETTINGS
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px 20px 12px", boxSizing: "border-box" }}>

      {/* Top Row: My Tasks and Next Shoot Day */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* My Tasks */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "15px" }}>MY TASKS</h3>
          {myTasks.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              No tasks assigned
            </p>
          ) : (
            <>
              {myTasks.slice(0, 5).map((task) => {
                // Parse date in local timezone to avoid UTC conversion issues
                const [year, month, day] = task.dueDate.split("-");
                const dueDate = new Date(year, month - 1, day);
                const today = new Date();
                const localToday = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                );

                const isOverdue = dueDate < localToday;
                const isDueToday =
                  dueDate.toDateString() === localToday.toDateString();
                const bgColor = isOverdue
                  ? "#ffebee"
                  : isDueToday
                  ? "#fff3e0"
                  : "#f9f9f9";

                // Priority badge colors
                const getPriorityColor = (priority) => {
                  switch (priority) {
                    case "High":
                      return "#f44336"; // Red
                    case "Medium":
                      return "#FF9800"; // Yellow/Orange
                    case "Low":
                      return "#4CAF50"; // Green
                    default:
                      return "#757575"; // Gray for no priority
                  }
                };

                return (
                  <div
                    key={task.id}
                    style={{
                      padding: "10px",
                      marginBottom: "8px",
                      backgroundColor: bgColor,
                      borderRadius: "4px",
                      borderLeft: isOverdue
                        ? "4px solid #f44336"
                        : isDueToday
                        ? "4px solid #FF9800"
                        : "4px solid #4CAF50",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: task.completed ? "normal" : "bold",
                            textDecoration: task.completed
                              ? "line-through"
                              : "none",
                            color: task.completed ? "#999" : "#333",
                          }}
                        >
                          {task.task}
                        </div>
                        {isOverdue && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "12px",
                              backgroundColor: "#f44336",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            OVERDUE
                          </span>
                        )}
                        {isDueToday && !isOverdue && (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "12px",
                              backgroundColor: "#FF9800",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            DUE TODAY
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          backgroundColor: getPriorityColor(task.priority),
                          color: "white",
                          fontSize: "10px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          marginLeft: "10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.priority || "Normal"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      Due: {dueDate.toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setActiveModule("ToDoList")}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                View All Tasks →
              </button>
            </>
          )}
        </div>

        {/* Next Shoot Day Summary */}
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "15px" }}>NEXT SHOOT DAY</h3>
          {!nextShootDay ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              No upcoming shoot days scheduled
            </p>
          ) : (
            <>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                  color: "#2196F3",
                }}
              >
                Day {nextShootDay.day_number} -{" "}
                {(() => {
                  const [year, month, day] = nextShootDay.date.split("-");
                  const localDate = new Date(year, month - 1, day);
                  return localDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  });
                })()}
              </div>
              <div style={{ marginBottom: "15px", fontSize: "14px" }}>
                <strong>Scenes:</strong> {nextShootScenes.length} scenes,{" "}
                {totalPages} pages
              </div>
              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  marginBottom: "15px",
                }}
              >
                {nextShootScenes.map((sceneNum) => {
                  const scene = stripboardScenes.find(
                    (s) => s.sceneNumber === sceneNum
                  );
                  return scene ? (
                    <div
                      key={sceneNum}
                      style={{
                        padding: "6px",
                        borderBottom: "1px solid #eee",
                        fontSize: "12px",
                      }}
                    >
                      <strong>Scene {scene.sceneNumber}</strong> -{" "}
                      {scene.heading} ({scene.pageLength || scene.page_length})
                    </div>
                  ) : null;
                })}
              </div>
              <button
                onClick={() => setActiveModule("StripboardSchedule")}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                View Full Schedule →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Call Sheet Preview */}
      {nextShootDay && (
        <div
          onClick={() => setActiveModule("CallSheet")}
          style={{
            backgroundColor: "white",
            border: "2px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "20px",
            cursor: "pointer",
            transition: "all 0.2s",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f5f5f5";
            e.currentTarget.style.borderColor = "#2196F3";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.borderColor = "#ddd";
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "15px" }}>
            CALL SHEET PREVIEW — Day {nextShootDay.day_number} (
            {(() => {
              const [year, month, day] = nextShootDay.date.split("-");
              const localDate = new Date(year, month - 1, day);
              return localDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            })()}
            )
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", marginBottom: "10px" }}>
                <strong>General Call:</strong>{" "}
                {callSheetData.callTimeByDay?.[nextShootDay.day_id] ||
                  callSheetData.callTime ||
                  "7:00 AM"}
              </div>
              <div style={{ fontSize: "14px", marginBottom: "10px" }}>
                <strong>Scenes:</strong> {nextShootScenes.join(", ") || "None"}
              </div>
              <div style={{ fontSize: "14px" }}>
                <strong>Pages:</strong> {totalPages}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                <strong>Cast Call Times:</strong>
                <div style={{ maxHeight: "120px", overflowY: "auto" }}>
                  {scheduledCast.length === 0 ? (
                    <div style={{ fontStyle: "italic", marginTop: "5px" }}>
                      No cast scheduled
                    </div>
                  ) : (
                    scheduledCast.slice(0, 6).map((person, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "4px 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {person.name} ({person.character}) - {person.callTime}
                      </div>
                    ))
                  )}
                  {scheduledCast.length > 6 && (
                    <div
                      style={{
                        fontStyle: "italic",
                        marginTop: "5px",
                        color: "#999",
                      }}
                    >
                      ...and {scheduledCast.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Click hint */}
          <div
            style={{
              position: "absolute",
              bottom: "15px",
              right: "20px",
              fontSize: "12px",
              color: "#2196F3",
              fontWeight: "bold",
            }}
          >
            Click to view full call sheet →
          </div>
        </div>
      )}

      {/* Production Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "36px", fontWeight: "bold", color: "#4CAF50" }}
          >
            {shotScenes}/{totalScenes}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Scenes Shot
          </div>
        </div>

        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "36px", fontWeight: "bold", color: "#2196F3" }}
          >
            {shotDays}/{totalDays}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Days Shot
          </div>
        </div>

        <div
          style={{
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "36px", fontWeight: "bold", color: "#FF9800" }}
          >
            {percentComplete}%
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Complete
          </div>
        </div>
      </div>

      {/* Upcoming Events */}
      <div
        style={{
          backgroundColor: "white",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "15px" }}>UPCOMING EVENTS</h3>

        {upcomingDays.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>
            No upcoming shoot days scheduled
          </p>
        ) : (
          <div style={{ fontSize: "14px" }}>
            {upcomingDays.map((day) => {
              const dayScenes = scheduledScenes[day.date] || [];
              const [year, month, dayNum] = day.date.split("-");
              const localDate = new Date(year, month - 1, dayNum);

              return (
                <div
                  key={day.day_id || day.id || `${day.date}-${day.day_number}`}
                  style={{
                    padding: "10px",
                    marginBottom: "8px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "4px",
                    borderLeft: "4px solid #2196F3",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    Day {day.day_number} -{" "}
                    {localDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {dayScenes.length} scenes scheduled
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>{/* end scrollable content area */}

      {/* Project Settings Modal */}
      {editingSettings && (
        <>
          <div
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.45)", zIndex: 999 }}
            onClick={() => setEditingSettings(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "24px 28px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              zIndex: 1000,
              width: "700px",
              maxWidth: "calc(100vw - 40px)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxSizing: "border-box",
              fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif",
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold" }}>PROJECT SETTINGS</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
              {/* Left column — core credits */}
              <div>
                {/* Film Title */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>FILM TITLE</div>
                  <input
                    type="text"
                    value={projectSettings.filmTitle || ""}
                    onChange={(e) => updateProjectSettings("filmTitle", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Director */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>DIRECTOR</div>
                  <input
                    type="text"
                    value={projectSettings.director || ""}
                    onChange={(e) => updateProjectSettings("director", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Producer — multi-line */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em" }}>PRODUCER</div>
                    <button
                      type="button"
                      onClick={() => setProducerLines((l) => [...l, ""])}
                      style={{ fontSize: "11px", padding: "2px 9px", backgroundColor: "#f3f4f6", border: "1px solid #ddd", borderRadius: "3px", cursor: "pointer", color: "#374151" }}
                    >
                      + Add
                    </button>
                  </div>
                  {producerLines.map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", marginBottom: i < producerLines.length - 1 ? "6px" : 0 }}>
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => {
                          const next = [...producerLines];
                          next[i] = e.target.value;
                          setProducerLines(next);
                        }}
                        style={{ flex: 1, padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setProducerLines((l) => l.filter((_, idx) => idx !== i))}
                          style={{ padding: "4px 9px", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", color: "#dc2626", fontSize: "13px", lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Executive Producer — multi-line */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em" }}>EXECUTIVE PRODUCER</div>
                    <button
                      type="button"
                      onClick={() => setExecProducerLines((l) => [...l, ""])}
                      style={{ fontSize: "11px", padding: "2px 9px", backgroundColor: "#f3f4f6", border: "1px solid #ddd", borderRadius: "3px", cursor: "pointer", color: "#374151" }}
                    >
                      + Add
                    </button>
                  </div>
                  {execProducerLines.map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", marginBottom: i < execProducerLines.length - 1 ? "6px" : 0 }}>
                      <input
                        type="text"
                        value={line}
                        onChange={(e) => {
                          const next = [...execProducerLines];
                          next[i] = e.target.value;
                          setExecProducerLines(next);
                        }}
                        style={{ flex: 1, padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px" }}
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setExecProducerLines((l) => l.filter((_, idx) => idx !== i))}
                          style={{ padding: "4px 9px", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", color: "#dc2626", fontSize: "13px", lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column — production metadata */}
              <div>
                {/* Production Company */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>PRODUCTION COMPANY</div>
                  <input
                    type="text"
                    value={projectSettings.productionCompany || ""}
                    onChange={(e) => updateProjectSettings("productionCompany", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Format */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>FORMAT</div>
                  <input
                    type="text"
                    value={projectSettings.format || ""}
                    onChange={(e) => updateProjectSettings("format", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    placeholder="e.g. 4K UHD, HD 1920x1080"
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Camera Type */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>CAMERA TYPE</div>
                  <input
                    type="text"
                    value={projectSettings.cameraType || ""}
                    onChange={(e) => updateProjectSettings("cameraType", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    placeholder="e.g. ARRI Alexa Mini, RED Komodo"
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Estimated Length */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>ESTIMATED LENGTH</div>
                  <input
                    type="text"
                    value={projectSettings.estimatedLength || ""}
                    onChange={(e) => updateProjectSettings("estimatedLength", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    placeholder="e.g. 95min"
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Shooting Ratio */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>SHOOTING RATIO</div>
                  <input
                    type="text"
                    value={projectSettings.shootingRatio || ""}
                    onChange={(e) => updateProjectSettings("shootingRatio", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    placeholder="e.g. 7:1"
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Distribution */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>DISTRIBUTION</div>
                  <input
                    type="text"
                    value={projectSettings.distribution || ""}
                    onChange={(e) => updateProjectSettings("distribution", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    placeholder="e.g. Theatrical, Streaming, VOD"
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Date Prepared */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", letterSpacing: "0.05em", marginBottom: "6px" }}>DATE PREPARED</div>
                  <input
                    type="date"
                    value={projectSettings.datePrepared || ""}
                    onChange={(e) => updateProjectSettings("datePrepared", e.target.value)}
                    style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                onClick={() => setEditingSettings(false)}
                style={{ padding: "7px 16px", backgroundColor: "#f3f4f6", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const updatedSettings = {
                    ...projectSettings,
                    producer: producerLines.filter((l) => l.trim()).join("\n"),
                    executiveProducer: execProducerLines.filter((l) => l.trim()).join("\n"),
                    lastUpdate: new Date().toISOString().split("T")[0],
                  };
                  setProjectSettings(updatedSettings);
                  await syncProjectSettingsToDatabase(updatedSettings);
                  alert("Settings saved!");
                  setEditingSettings(false);
                }}
                style={{ padding: "7px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
