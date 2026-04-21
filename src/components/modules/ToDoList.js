import React from "react";
import EditableInput from "../shared/EditableInput";
import { usePresence } from "../../hooks/usePresence";
import PresenceIndicator from "../shared/PresenceIndicator";

// Priority color helper function - shared between components
const getPriorityColor = (priority) => {
  switch (priority) {
    case "High":
      return "#f44336";
    case "Medium":
      return "#FF9800";
    case "Low":
      return "#4CAF50";
    default:
      return "#9E9E9E";
  }
};

// URL detection and rendering helper
const renderTextWithLinks = (text) => {
  if (!text) return null;

  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      return React.createElement(
        "a",
        {
          key: index,
          href: part,
          target: "_blank",
          rel: "noopener noreferrer",
          style: {
            color: "#2196F3",
            textDecoration: "underline",
            wordBreak: "break-all",
          },
          onClick: (e) => e.stopPropagation(),
        },
        part
      );
    }
    return React.createElement("span", { key: index }, part);
  });
};

// TaskDatePicker component - specific to ToDo module
function TaskDatePicker({ value, onChange, todoItems }) {
  const [showCalendar, setShowCalendar] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const getDateTaskInfo = (dateStr) => {
    const tasksForDate = todoItems.filter((task) => task.dueDate === dateStr);
    if (tasksForDate.length === 0) return null;

    // Get highest priority task for color
    const priorities = ["High", "Medium", "Low"];
    const highestPriorityTask = tasksForDate.reduce((highest, current) => {
      const currentPriorityIndex = priorities.indexOf(current.priority);
      const highestPriorityIndex = priorities.indexOf(highest.priority);
      return currentPriorityIndex < highestPriorityIndex ? current : highest;
    }, tasksForDate[0]);

    return {
      color: getPriorityColor(highestPriorityTask.priority),
      count: tasksForDate.length,
    };
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

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

  const handleDateSelect = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    onChange(dateStr);
    setShowCalendar(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        value={value || ""}
        onClick={() => setShowCalendar(!showCalendar)}
        placeholder="Select date"
        readOnly
        style={{
          fontSize: "12px",
          padding: "4px",
          border: "1px solid #ccc",
          borderRadius: "3px",
          width: "100%",
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      />

      {showCalendar && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.3)",
              zIndex: 999,
            }}
            onClick={() => setShowCalendar(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: 0,
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "280px",
            }}
          >
            {/* Calendar Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <button
                onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ←
              </button>
              <span style={{ fontWeight: "bold", fontSize: "14px" }}>
                {monthNames[month]} {year}
              </span>
              <button
                onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                style={{
                  padding: "5px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                →
              </button>
            </div>

            {/* Days of week */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "2px",
                marginBottom: "5px",
              }}
            >
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    fontSize: "10px",
                    fontWeight: "bold",
                    padding: "2px",
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "2px",
              }}
            >
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startDay }, (_, i) => (
                <div key={`empty-${i}`} style={{ height: "25px" }} />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(
                  2,
                  "0"
                )}-${String(day).padStart(2, "0")}`;
                const taskInfo = getDateTaskInfo(dateStr);

                return (
                  <div
                    key={day}
                    onClick={() => handleDateSelect(day)}
                    style={{
                      height: "25px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      cursor: "pointer",
                      borderRadius: "3px",
                      backgroundColor: taskInfo
                        ? taskInfo.color
                        : "transparent",
                      color: taskInfo ? "white" : "#333",
                      fontWeight: taskInfo ? "bold" : "normal",
                      position: "relative",
                    }}
                  >
                    {day}
                    {taskInfo && taskInfo.count > 1 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-2px",
                          right: "-2px",
                          backgroundColor: "rgba(0,0,0,0.7)",
                          color: "white",
                          borderRadius: "50%",
                          width: "12px",
                          height: "12px",
                          fontSize: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {taskInfo.count}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select assignee component
function MultiSelectAssignee({ task, crewMembers, updateTask }) {
  const [showDropdown, setShowDropdown] = React.useState(false);

  // Parse assignedTo as array if it's a string
  const assignedArray = task.assignedTo
    ? typeof task.assignedTo === "string"
      ? task.assignedTo.split(",").filter(Boolean)
      : task.assignedTo
    : [];

  const handleTogglePerson = (personId) => {
    const currentAssigned = [...assignedArray];
    const index = currentAssigned.indexOf(personId);

    if (index > -1) {
      currentAssigned.splice(index, 1);
    } else {
      currentAssigned.push(personId);
    }

    const newAssignedString = currentAssigned.join(",");
    console.log("🔧 Toggling person:", personId);
    console.log("🔧 Current assigned array:", currentAssigned);
    console.log("🔧 New assignedTo string:", newAssignedString);
    console.log("🔧 Task ID:", task.id);

    updateTask(task.id, "assignedTo", newAssignedString);
    // Don't close dropdown to allow multi-selection
  };

  const getDisplayText = () => {
    if (assignedArray.length === 0) return "Unassigned";

    const names = assignedArray
      .map((id) => {
        const person = crewMembers.find((p) => p.id === id);
        return person ? person.displayName : null;
      })
      .filter(Boolean);

    if (names.length === 0) return "Unassigned";
    return names.join(", ");
  };

  // Group crew by department maintaining the sort order from crewMembers
  const crewByDept = React.useMemo(() => {
    const grouped = {};
    const deptOrder = [];

    crewMembers.forEach((person) => {
      const dept = person.crewDepartment || "Other";
      if (!grouped[dept]) {
        grouped[dept] = [];
        deptOrder.push(dept);
      }
      grouped[dept].push(person);
    });

    return { grouped, deptOrder };
  }, [crewMembers]);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          fontSize: "12px",
          padding: "4px",
          border: "1px solid #ccc",
          borderRadius: "3px",
          cursor: "pointer",
          backgroundColor: "white",
          minHeight: "20px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {getDisplayText()}
      </div>

      {showDropdown && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 999,
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "3px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000,
              minWidth: "200px",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            <div
              onClick={() => {
                updateTask(task.id, "assignedTo", "");
                setShowDropdown(false);
              }}
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                backgroundColor:
                  assignedArray.length === 0 ? "#e3f2fd" : "white",
              }}
            >
              Unassigned
            </div>

            {/* Crew Sections by Department in correct order */}
            {crewByDept.deptOrder.map((department) => (
              <React.Fragment key={department}>
                <div
                  style={{
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                    color: "#666",
                  }}
                >
                  {department.toUpperCase()}
                </div>
                {crewByDept.grouped[department].map((person) => (
                  <div
                    key={person.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePerson(person.id);
                    }}
                    style={{
                      padding: "6px 10px 6px 20px",
                      fontSize: "12px",
                      cursor: "pointer",
                      backgroundColor: assignedArray.includes(person.id)
                        ? "#e3f2fd"
                        : "white",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={assignedArray.includes(person.id)}
                      readOnly
                      style={{ pointerEvents: "none" }}
                    />
                    {person.displayName}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Main ToDo List Module
function ToDoListModule({
  todoItems,
  setTodoItems,
  todoCategories,
  setTodoCategories,
  castCrew,
  syncTodoItemsToDatabase,
  userRole,
  canEdit,
  isViewOnly,
  selectedProject,
  user,
}) {
  const [editingTaskId, setEditingTaskId] = React.useState(null);
  const { otherUsers } = usePresence(
    selectedProject?.id,
    user,
    "todo",
    editingTaskId
  );
  // Debug: Log todoItems on every render
  // React.useEffect(() => {
  //   console.log("🔍 ToDoList todoItems:", todoItems);
  //   console.log("🔍 Sample task assignedTo:", todoItems[0]?.assignedTo);
  // }, [todoItems]);
  React.useEffect(() => {
    console.log(
      "🔍 First 3 crew member IDs:",
      castCrew.slice(0, 3).map((p) => ({ name: p.displayName, id: p.id }))
    );
  }, [castCrew]);
  const [selectedFilters, setSelectedFilters] = React.useState({
    status: "all",
    assignedTo: "all",
    category: "all",
  });
  const [showCompleted, setShowCompleted] = React.useState(false);

  const priorityOptions = ["Low", "Medium", "High"];
  const recurringOptions = ["None", "Daily", "Weekly", "Monthly"];

  // Filter and sort crew members by department hierarchy, then alphabetically
  const crewMembers = React.useMemo(() => {
    const crew = castCrew.filter((person) => person.type === "crew");

    console.log("🔍 All castCrew:", castCrew);
    console.log("🔍 Filtered crew only:", crew);
    console.log(
      "🔍 People with 'Principal Crew' in position:",
      castCrew.filter((p) => p.position?.includes("Principal"))
    );
    console.log(
      "🔍 People with 'Principal Crew' in department:",
      castCrew.filter((p) => p.department?.includes("Principal"))
    );

    // Define department order matching Cast & Crew module
    const departmentOrder = [
      "Principal Crew",
      "Producer",
      "Production",
      "Camera",
      "G&E",
      "Art",
      "Wardrobe",
      "Makeup",
      "Sound",
      "Script",
      "Stunts",
      "BTS",
      "Transportation",
      "Craft Services",
      "Other",
    ];

    return crew.sort((a, b) => {
      const deptA = a.crewDepartment || "Other";
      const deptB = b.crewDepartment || "Other";

      // Get department order indices
      let indexA = departmentOrder.indexOf(deptA);
      let indexB = departmentOrder.indexOf(deptB);

      // If department not in list, put at end
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;

      // First sort by department order
      if (indexA !== indexB) return indexA - indexB;

      // Then alphabetically within department
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
  }, [castCrew]);
  const addNewTask = () => {
    const newTask = {
      id: `task_${Date.now()}`,
      completed: false,
      task: "New Task",
      description: "",
      additionalDetails: "",
      assignedTo: "",
      dueDate: "",
      priority: "Medium",
      category: "Pre-Production",
      recurring: "None",
      isOverdue: false,
      createdDate: new Date().toISOString().split("T")[0],
    };
    setTodoItems((prev) => {
      const updatedItems = [newTask, ...prev];
      // Sync to database after adding
      if (typeof syncTodoItemsToDatabase === "function") {
        syncTodoItemsToDatabase(updatedItems).catch((error) => {
          console.error("Error syncing todos:", error);
        });
      }
      return updatedItems;
    });
  };

  const deleteTask = (taskId) => {
    setTodoItems((prev) => {
      const updatedItems = prev.filter((task) => task.id !== taskId);
      // Sync to database after deletion
      if (typeof syncTodoItemsToDatabase === "function") {
        syncTodoItemsToDatabase(updatedItems);
      }
      return updatedItems;
    });
  };

  const updateTask = React.useCallback(
    (taskId, field, value) => {
      setTodoItems((prev) => {
        const updatedItems = prev.map((task) =>
          task.id === taskId ? { ...task, [field]: value } : task
        );
        // Sync to database after state update
        if (typeof syncTodoItemsToDatabase === "function") {
          syncTodoItemsToDatabase(updatedItems);
        }
        return updatedItems;
      });
    },
    [syncTodoItemsToDatabase]
  );

  const toggleTaskComplete = (taskId) => {
    setTodoItems((prev) => {
      // Find the task being toggled
      const taskIndex = prev.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) return prev;

      const task = prev[taskIndex];
      const updatedTask = { ...task, completed: !task.completed };

      // Create new array without the toggled task
      const otherTasks = prev.filter((t) => t.id !== taskId);

      // If completing the task, move to bottom; if uncompleting, move to top
      const updatedItems = updatedTask.completed
        ? [...otherTasks, updatedTask]
        : [updatedTask, ...otherTasks];

      // Sync to database after completion toggle
      if (typeof syncTodoItemsToDatabase === "function") {
        syncTodoItemsToDatabase(updatedItems);
      }
      return updatedItems;
    });
  };

  const filteredTasks = todoItems
    .filter((task) => {
      // Hide completed tasks unless showCompleted is true
      if (task.completed && !showCompleted) return false;

      const statusMatch =
        selectedFilters.status === "all" ||
        (selectedFilters.status === "active" && !task.completed) ||
        (selectedFilters.status === "completed" && task.completed);

      const assignedMatch =
        selectedFilters.assignedTo === "all" ||
        (selectedFilters.assignedTo === "unassigned" && !task.assignedTo) ||
        selectedFilters.assignedTo === task.assignedTo;

      const categoryMatch =
        selectedFilters.category === "all" ||
        task.category === selectedFilters.category;

      return statusMatch && assignedMatch && categoryMatch;
    })
    .sort((a, b) => {
      // Completed tasks always go to bottom
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;

      // If both completed or both active, sort by due date
      // Tasks without due dates go to the end
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      // Sort by due date ascending (earliest first)
      return a.dueDate.localeCompare(b.dueDate);
    });

  // Count of hidden completed tasks
  const completedCount = todoItems.filter((task) => task.completed).length;

  const renderEditableField = (
    task,
    field,
    placeholder = "",
    type = "text",
    options = null
  ) => {
    const value = task[field] || "";

    if (options) {
      return (
        <select
          value={value}
          onChange={(e) => updateTask(task.id, field, e.target.value)}
          style={{
            fontSize: "12px",
            padding: "4px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            width: "100%",
          }}
        >
          {field === "assignedTo" && <option value="">Unassigned</option>}
          {options.map((option) => (
            <option key={option.id || option} value={option.id || option}>
              {option.displayName || option}
            </option>
          ))}
        </select>
      );
    }

    if (field === "dueDate") {
      return (
        <TaskDatePicker
          value={value}
          onChange={(newDate) => updateTask(task.id, field, newDate)}
          todoItems={todoItems}
        />
      );
    }

    return (
      <EditableInput
        variant="todo"
        type={type}
        value={value}
        onSave={(newValue) => updateTask(task.id, field, newValue)}
        placeholder={placeholder}
      />
    );
  };

  const getMainDisplayRowColor = (task) => {
    if (task.completed) return "#f5f5f5";
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = task.dueDate && task.dueDate < today;

    // If overdue, use red tint
    if (isOverdue) return "#ffebee";

    // Otherwise use priority-based background colors (lighter tints)
    switch (task.priority) {
      case "High":
        return "#ffebee"; // Light red
      case "Medium":
        return "#fff3e0"; // Light orange
      case "Low":
        return "#e8f5e9"; // Light green
      default:
        return "#fff"; // White for no priority
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 40px)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Fixed header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          zIndex: 100,
          padding: "20px 20px 15px 20px",
          borderBottom: "1px solid #ddd",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h2 style={{ margin: 0 }}>ToDo List</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              style={{
                backgroundColor: showCompleted ? "#4CAF50" : "#9E9E9E",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {showCompleted ? "Hide" : "Show"} Completed ({completedCount})
            </button>
            <button
              onClick={addNewTask}
              style={{
                backgroundColor: "#2196F3",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginRight: "5px",
              }}
            >
              Status:
            </label>
            <select
              value={selectedFilters.status}
              onChange={(e) =>
                setSelectedFilters((prev) => ({
                  ...prev,
                  status: e.target.value,
                }))
              }
              style={{
                fontSize: "12px",
                padding: "4px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginRight: "5px",
              }}
            >
              Assigned To:
            </label>
            <select
              value={selectedFilters.assignedTo}
              onChange={(e) =>
                setSelectedFilters((prev) => ({
                  ...prev,
                  assignedTo: e.target.value,
                }))
              }
              style={{
                fontSize: "12px",
                padding: "4px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {crewMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginRight: "5px",
              }}
            >
              Category:
            </label>
            <select
              value={selectedFilters.category}
              onChange={(e) =>
                setSelectedFilters((prev) => ({
                  ...prev,
                  category: e.target.value,
                }))
              }
              style={{
                fontSize: "12px",
                padding: "4px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              <option value="all">All</option>
              {todoCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          padding: "0 20px 20px 20px",
          height: "calc(100% - 120px)",
          overflowY: "auto",
        }}
      >
        {/* Column Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "40px 1fr 1.2fr 0.7fr 200px 120px 100px 120px 100px 40px",
            gap: "8px",
            backgroundColor: "#2196F3",
            color: "white",
            fontWeight: "bold",
            fontSize: "11px",
            padding: "8px",
            marginBottom: "1px",
          }}
        >
          <div>✓</div>
          <div>Task</div>
          <div>Description</div>
          <div>Additional Details / Links</div>
          <div>Assigned To</div>
          <div>Due Date</div>
          <div>Priority</div>
          <div>Category</div>
          <div>Recurring</div>
          <div>Del</div>
        </div>

        {/* Task Rows */}
        {filteredTasks.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
            No tasks found. Click "Add Task" to create your first task.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <PresenceIndicator
              key={task.id}
              itemId={task.id}
              otherUsers={otherUsers}
              position="top"
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "40px 1fr 1.2fr 0.7fr 200px 120px 100px 120px 100px 40px",
                  gap: "8px",
                  backgroundColor: getMainDisplayRowColor(task),
                  border: "1px solid #ddd",
                  fontSize: "12px",
                  padding: "6px",
                  marginBottom: "1px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTaskComplete(task.id)}
                    style={{ cursor: "pointer" }}
                  />
                </div>
                <div>
                  {renderEditableField(task, "task", "Enter task name")}
                </div>
                <div>
                  {renderEditableField(
                    task,
                    "description",
                    "Enter description"
                  )}
                </div>
                <div>
                  {editingTaskId === task.id ? (
                    <input
                      type="text"
                      value={task.additionalDetails || ""}
                      onChange={(e) =>
                        updateTask(task.id, "additionalDetails", e.target.value)
                      }
                      onBlur={() => setEditingTaskId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setEditingTaskId(null);
                        }
                      }}
                      autoFocus
                      placeholder="Enter additional details or link"
                      style={{
                        width: "100%",
                        fontSize: "12px",
                        padding: "4px",
                        border: "1px solid #2196F3",
                        borderRadius: "3px",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => setEditingTaskId(task.id)}
                      style={{
                        minHeight: "24px",
                        padding: "4px",
                        cursor: "text",
                        wordBreak: "break-word",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {(() => {
                        const urlPattern = /(https?:\/\/[^\s]+)/g;
                        const hasUrl =
                          task.additionalDetails?.match(urlPattern);
                        const firstUrl = hasUrl ? hasUrl[0] : null;

                        if (firstUrl) {
                          const remainingText =
                            task.additionalDetails
                              .replace(urlPattern, "")
                              .trim() || "Click to edit";
                          return React.createElement(
                            React.Fragment,
                            null,
                            React.createElement(
                              "a",
                              {
                                href: firstUrl,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                onClick: (e) => e.stopPropagation(),
                                style: {
                                  backgroundColor: "#2196F3",
                                  color: "white",
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  textDecoration: "none",
                                  fontSize: "11px",
                                  fontWeight: "bold",
                                  flexShrink: 0,
                                },
                              },
                              "LINK"
                            ),
                            React.createElement(
                              "span",
                              { style: { fontSize: "12px", color: "#666" } },
                              remainingText
                            )
                          );
                        }

                        if (task.additionalDetails) {
                          return React.createElement(
                            "span",
                            null,
                            task.additionalDetails
                          );
                        }

                        return React.createElement(
                          "span",
                          { style: { color: "#999" } },
                          "Enter additional details or link"
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div>
                  <MultiSelectAssignee
                    task={task}
                    crewMembers={crewMembers}
                    updateTask={updateTask}
                  />
                </div>
                <div>{renderEditableField(task, "dueDate", "", "date")}</div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: getPriorityColor(task.priority),
                      flexShrink: 0,
                    }}
                  />
                  {renderEditableField(
                    task,
                    "priority",
                    "",
                    "text",
                    priorityOptions
                  )}
                </div>
                <div>
                  {renderEditableField(
                    task,
                    "category",
                    "",
                    "text",
                    todoCategories
                  )}
                </div>
                <div>
                  {renderEditableField(
                    task,
                    "recurring",
                    "",
                    "text",
                    recurringOptions
                  )}
                </div>
                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => deleteTask(task.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                      padding: "2px 4px",
                      width: "20px",
                      height: "20px",
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </PresenceIndicator>
          ))
        )}
      </div>
    </div>
  );
}

export default ToDoListModule;
