import React, { useState, useEffect } from "react";

function CalendarModule({
  scheduledScenes,
  todoItems,
  castCrew,
  shootingDays,
  stripboardScenes,
  doodCastEvents,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem("calendarExpandedSections");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(
      "calendarExpandedSections",
      JSON.stringify(expandedSections)
    );
  }, [expandedSections]);

  const toggleSection = (dateStr, section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [`${dateStr}-${section}`]: !prev[`${dateStr}-${section}`],
    }));
  };

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isShootingDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    return shootingDays && shootingDays.some((sd) => sd.date === dateStr);
  };

  const getDayItems = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    const shootingDay = shootingDays?.find((sd) => sd.date === dateStr);

    let scenes = [];
    if (shootingDay?.scheduleBlocks?.length > 0) {
      scenes = shootingDay.scheduleBlocks
        .filter((block) => block.scene && !block.isLunch && !block.customItem)
        .map((block) => block.scene);
    } else {
      scenes = scheduledScenes[dateStr] || [];
    }

    const assignedTodos = todoItems
      ? todoItems.filter(
          (item) => item.assignedDate === dateStr && !item.completed
        )
      : [];
    const dueTodos = todoItems
      ? todoItems.filter((item) => item.dueDate === dateStr && !item.completed)
      : [];
    const unavailablePeople = castCrew
      ? castCrew.filter((p) =>
          p.availability?.unavailableDates?.includes(dateStr)
        )
      : [];
    const availablePeople = castCrew
      ? castCrew.filter((p) =>
          p.availability?.availableDates?.includes(dateStr)
        )
      : [];
    const bookedPeople = castCrew
      ? castCrew.filter((p) => p.availability?.bookedDates?.includes(dateStr))
      : [];
    const manualEvents = doodCastEvents
      ? doodCastEvents.filter(
          (event) =>
            event.source === "manual" &&
            event.eventType !== "work" &&
            event.startDate <= dateStr &&
            event.endDate >= dateStr
        )
      : [];

    return {
      scenes,
      assignedTodos,
      dueTodos,
      unavailablePeople,
      availablePeople,
      bookedPeople,
      manualEvents,
    };
  };

  const isToday = (day) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(year, month + direction, 1));
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "100%",
        height: "calc(100vh - 40px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ← Previous
        </button>
        <h2 style={{ margin: 0, fontSize: "28px" }}>
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={() => navigateMonth(1)}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Next →
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          marginBottom: "10px",
          width: "100%",
        }}
      >
        {daysOfWeek.map((day) => (
          <div
            key={day}
            style={{
              padding: "15px",
              textAlign: "center",
              fontWeight: "bold",
              backgroundColor: "#2E7D32",
              color: "white",
              fontSize: "14px",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          width: "100%",
        }}
      >
        {Array.from({ length: firstDayWeekday }, (_, i) => (
          <div
            key={`empty-${i}`}
            style={{
              height: "160px",
              backgroundColor: "#fafafa",
              border: "1px solid #ddd",
            }}
          />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const { scenes, unavailablePeople, availablePeople, bookedPeople } =
            getDayItems(day);
          const isTodayDate = isToday(day);
          const isShootingDayDate = isShootingDay(day);

          return (
            <div
              key={day}
              style={{
                height: "160px",
                border: isTodayDate ? "3px solid #FF5722" : "1px solid #ddd",
                backgroundColor: isShootingDayDate
                  ? "#c8e6c9"
                  : isTodayDate
                  ? "#fff3e0"
                  : "white",
                padding: "8px",
                overflow: "hidden",
                fontSize: "12px",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "8px",
                  fontSize: "16px",
                  color: isTodayDate ? "#FF5722" : "#333",
                }}
              >
                {day}
                {isTodayDate && (
                  <span
                    style={{
                      fontSize: "10px",
                      backgroundColor: "#FF5722",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      marginLeft: "5px",
                    }}
                  >
                    TODAY
                  </span>
                )}
              </div>

              {(() => {
                const dateStr = `${year}-${String(month + 1).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const { assignedTodos, dueTodos, manualEvents } =
                  getDayItems(day);
                const scheduledScenesForDay = [];
                const shotScenesForDay = [];

                scenes.forEach((scene) => {
                  const sceneNumber =
                    typeof scene === "object" ? scene.sceneNumber : scene;
                  const stripboardScene = stripboardScenes?.find(
                    (s) => s.sceneNumber === sceneNumber
                  );
                  const status = stripboardScene?.status || "Not Scheduled";
                  if (status === "Shot") shotScenesForDay.push(sceneNumber);
                  else if (status === "Scheduled")
                    scheduledScenesForDay.push(sceneNumber);
                });

                const allTasks = [...assignedTodos, ...dueTodos];
                const tasksCount = allTasks.length;
                const bookedCount = bookedPeople.length;
                const availableCount = availablePeople.length;
                const unavailableCount = unavailablePeople.length;
                const manualEventsCount = manualEvents?.length || 0;

                return (
                  <>
                    {tasksCount > 0 && (
                      <div style={{ marginBottom: "3px" }}>
                        <div
                          onClick={() => toggleSection(dateStr, "tasks")}
                          style={{
                            backgroundColor: "#E1BEE7",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#4A148C",
                            userSelect: "none",
                          }}
                        >
                          {expandedSections[`${dateStr}-tasks`] ? "▼" : "►"}{" "}
                          Tasks ({tasksCount})
                        </div>
                        {expandedSections[`${dateStr}-tasks`] && (
                          <div style={{ marginTop: "2px" }}>
                            {assignedTodos.map((todo, index) => (
                              <div
                                key={`assigned-${index}`}
                                style={{
                                  backgroundColor: "#9C27B0",
                                  color: "white",
                                  padding: "2px 4px",
                                  margin: "1px 0",
                                  borderRadius: "2px",
                                  fontSize: "9px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                📋 {todo.task}
                              </div>
                            ))}
                            {dueTodos.map((todo, index) => (
                              <div
                                key={`due-${index}`}
                                style={{
                                  backgroundColor: "#FF9800",
                                  color: "white",
                                  padding: "2px 4px",
                                  margin: "1px 0",
                                  borderRadius: "2px",
                                  fontSize: "9px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                ⚠️ DUE: {todo.task}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {manualEventsCount > 0 &&
                      (() => {
                        const eventsByType = {};
                        manualEvents.forEach((event) => {
                          if (!eventsByType[event.eventType])
                            eventsByType[event.eventType] = [];
                          eventsByType[event.eventType].push(event);
                        });

                        return Object.entries(eventsByType).map(
                          ([eventType, events]) => {
                            const eventIcon =
                              {
                                rehearsal: "🎭",
                                fitting: "👔",
                                travel: "✈️",
                                return_travel: "🔙",
                                hold: "⏸️",
                                pickup: "📹",
                                off: "🏖️",
                              }[eventType] || "📅";
                            const eventLabel = eventType
                              .replace(/_/g, " ")
                              .toUpperCase();

                            return (
                              <div
                                key={eventType}
                                style={{ marginBottom: "3px" }}
                              >
                                <div
                                  onClick={() =>
                                    toggleSection(dateStr, `event-${eventType}`)
                                  }
                                  style={{
                                    backgroundColor: "#BBDEFB",
                                    padding: "2px 4px",
                                    borderRadius: "3px",
                                    cursor: "pointer",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    color: "#0D47A1",
                                    userSelect: "none",
                                  }}
                                >
                                  {expandedSections[
                                    `${dateStr}-event-${eventType}`
                                  ]
                                    ? "▼"
                                    : "►"}{" "}
                                  {eventIcon} {eventLabel} ({events.length})
                                </div>
                                {expandedSections[
                                  `${dateStr}-event-${eventType}`
                                ] && (
                                  <div style={{ marginTop: "2px" }}>
                                    {events.map((event, index) => {
                                      const castMember = castCrew?.find(
                                        (p) => p.id === event.castMemberId
                                      );
                                      const castName =
                                        castMember?.name || "Unknown";
                                      return (
                                        <div
                                          key={`event-${index}`}
                                          style={{
                                            backgroundColor: "#2196F3",
                                            color: "white",
                                            padding: "2px 4px",
                                            margin: "1px 0",
                                            borderRadius: "2px",
                                            fontSize: "9px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                        >
                                          👤 {castName}
                                          {event.notes && ` - ${event.notes}`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        );
                      })()}

                    {bookedCount > 0 && (
                      <div style={{ marginBottom: "3px" }}>
                        <div
                          onClick={() => toggleSection(dateStr, "booked")}
                          style={{
                            backgroundColor: "#FFE0B2",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#E65100",
                            userSelect: "none",
                          }}
                        >
                          {expandedSections[`${dateStr}-booked`] ? "▼" : "►"}{" "}
                          Booked ({bookedCount})
                        </div>
                        {expandedSections[`${dateStr}-booked`] && (
                          <div style={{ marginTop: "2px" }}>
                            {bookedPeople.map((person, index) => (
                              <div
                                key={`booked-${index}`}
                                style={{
                                  backgroundColor: "#FF9800",
                                  color: "white",
                                  padding: "2px 4px",
                                  margin: "1px 0",
                                  borderRadius: "2px",
                                  fontSize: "9px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                📅 {person.displayName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {availableCount > 0 && (
                      <div style={{ marginBottom: "3px" }}>
                        <div
                          onClick={() => toggleSection(dateStr, "available")}
                          style={{
                            backgroundColor: "#C8E6C9",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#1B5E20",
                            userSelect: "none",
                          }}
                        >
                          {expandedSections[`${dateStr}-available`] ? "▼" : "►"}{" "}
                          Available ({availableCount})
                        </div>
                        {expandedSections[`${dateStr}-available`] && (
                          <div style={{ marginTop: "2px" }}>
                            {availablePeople.map((person, index) => (
                              <div
                                key={`available-${index}`}
                                style={{
                                  backgroundColor: "#4CAF50",
                                  color: "white",
                                  padding: "2px 4px",
                                  margin: "1px 0",
                                  borderRadius: "2px",
                                  fontSize: "9px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                ✅ {person.displayName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {unavailableCount > 0 && (
                      <div style={{ marginBottom: "3px" }}>
                        <div
                          onClick={() => toggleSection(dateStr, "unavailable")}
                          style={{
                            backgroundColor: "#FFCDD2",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#B71C1C",
                            userSelect: "none",
                          }}
                        >
                          {expandedSections[`${dateStr}-unavailable`]
                            ? "▼"
                            : "►"}{" "}
                          Unavailable ({unavailableCount})
                        </div>
                        {expandedSections[`${dateStr}-unavailable`] && (
                          <div style={{ marginTop: "2px" }}>
                            {unavailablePeople.map((person, index) => (
                              <div
                                key={`unavailable-${index}`}
                                style={{
                                  backgroundColor: "#f44336",
                                  color: "white",
                                  padding: "2px 4px",
                                  margin: "1px 0",
                                  borderRadius: "2px",
                                  fontSize: "9px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                ❌ {person.displayName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {scheduledScenesForDay.length > 0 && (
                      <div
                        style={{
                          backgroundColor: "#4CAF50",
                          color: "white",
                          padding: "3px 6px",
                          margin: "2px 0",
                          borderRadius: "3px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          wordWrap: "break-word",
                          lineHeight: "1.2",
                        }}
                      >
                        🎬 Scenes:{" "}
                        {scheduledScenesForDay
                          .map((s) => s.sceneNumber || s)
                          .join(", ")}
                      </div>
                    )}

                    {shotScenesForDay.length > 0 && (
                      <div
                        style={{
                          backgroundColor: "#00E676",
                          color: "white",
                          padding: "3px 6px",
                          margin: "2px 0",
                          borderRadius: "3px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          wordWrap: "break-word",
                          lineHeight: "1.2",
                        }}
                      >
                        ✅ Shot:{" "}
                        {shotScenesForDay
                          .map((s) => s.sceneNumber || s)
                          .join(", ")}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarModule;
