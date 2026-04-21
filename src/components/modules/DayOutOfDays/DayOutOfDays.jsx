import React from "react";
import EditableInput from "../../shared/EditableInput";

// Import DOOD core functions
import {
  generateCalendarDays,
  generateCodesForEvent,
  generateDoodMatrix,
  calculateDoodTotals,
  buildDoodReportView,
  formatDate,
  formatDateWithDay,
  getSpanLength,
} from "./doodCore";

// Day code constants
const DayCodes = {
  SW: "SW",
  W: "W",
  WF: "WF",
  SWF: "SWF",
  H: "H",
  R: "R",
  F: "F",
  T: "T",
  RT: "RT",
  P: "P",
  O: "O",
  D: "D",
  BLANK: "",
};

const EventTypes = {
  WORK: "work",
  REHEARSAL: "rehearsal",
  FITTING: "fitting",
  TRAVEL: "travel",
  RETURN_TRAVEL: "return_travel",
  HOLD: "hold",
  PICKUP: "pickup",
  OFF: "off",
};

const DEFAULT_SETTINGS = {
  autoGenerateHolds: false,
  includeDarkDaysInHoldSpan: false,
  maxGapDaysToAutoHold: 2,
  showDarkDaysAsCode: true,
  blankForNoActivity: false,
};

// UUID v4 generator fallback for older browsers
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// DOOD Module Component
function DayOutOfDaysModule({
  // Props from app.js
  selectedProject,
  castCrew,
  shootingDays,
  characters,
  stripboardScenes,
  scheduledScenes,

  // DOOD-specific state (will be added to app.js)
  doodCastEvents, // Manual events only (hold, rehearsal, fitting, travel, etc.)
  setDoodCastEvents,
  doodOverrides,
  setDoodOverrides,
  doodSettings,
  setDoodSettings,

  // Sync functions (will be added to app.js)
  onSyncDoodCastEvent,
  onSyncDoodOverride,
  onSyncDoodSettings,

  // User permissions
  userRole,
  canEdit,
  isViewOnly,
}) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [showEventForm, setShowEventForm] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [selectedCastMember, setSelectedCastMember] = React.useState(null);

  // Phase 2: Auto-sync state
  const [showSyncPreview, setShowSyncPreview] = React.useState(false);
  const [syncPreviewData, setSyncPreviewData] = React.useState(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // UI state
  const [showCastEvents, setShowCastEvents] = React.useState(false);
  const [expandedCastMembers, setExpandedCastMembers] = React.useState({});
  const [filterScheduledOnly, setFilterScheduledOnly] = React.useState(false);
  const [filterStartDate, setFilterStartDate] = React.useState("");
  const [filterEndDate, setFilterEndDate] = React.useState("");
  const [filterActiveCastOnly, setFilterActiveCastOnly] = React.useState(true);

  // Override editing state
  const [editingOverride, setEditingOverride] = React.useState(null);
  const [overrideCode, setOverrideCode] = React.useState("");
  const [overrideReason, setOverrideReason] = React.useState("");

  // Event form state
  const [eventForm, setEventForm] = React.useState({
    castMemberId: "",
    eventType: EventTypes.WORK,
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [multipleDate, setMultipleDate] = React.useState(false);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get production dates from project
  const productionStartDate = selectedProject?.production_start_date;
  const productionEndDate = selectedProject?.production_end_date;

  // Auto-detect dates from shooting schedule if not set
  const autoDetectedDates = React.useMemo(() => {
    if (!shootingDays || shootingDays.length === 0) return null;

    const dates = shootingDays.map((day) => day.date).sort();
    return {
      startDate: dates[0],
      endDate: dates[dates.length - 1],
    };
  }, [shootingDays]);

  // Use auto-detected dates if production dates not set
  const effectiveStartDate =
    productionStartDate || autoDetectedDates?.startDate;
  const effectiveEndDate = productionEndDate || autoDetectedDates?.endDate;

  // Expand date range to include manual events outside production dates
  const expandedDateRange = React.useMemo(() => {
    if (!effectiveStartDate || !effectiveEndDate)
      return { start: effectiveStartDate, end: effectiveEndDate };

    let start = effectiveStartDate;
    let end = effectiveEndDate;

    // Check manual events for dates outside production range
    const manualEvents = (doodCastEvents || []).filter(
      (e) => e.source === "manual"
    );
    manualEvents.forEach((event) => {
      if (event.startDate && event.startDate < start) start = event.startDate;
      if (event.endDate && event.endDate > end) end = event.endDate;
    });

    return { start, end };
  }, [effectiveStartDate, effectiveEndDate, doodCastEvents]);

  // Check if production dates are set
  const hasProductionDates = expandedDateRange.start && expandedDateRange.end;

  // Generate calendar if dates are set (deduplicate to avoid key warnings)
  const calendarDays = React.useMemo(() => {
    if (!hasProductionDates) return [];

    const days = generateCalendarDays(
      expandedDateRange.start,
      expandedDateRange.end
    );

    // Deduplicate by date
    const seen = new Set();
    return days.filter((day) => {
      if (seen.has(day.date)) return false;
      seen.add(day.date);
      return true;
    });
  }, [hasProductionDates, expandedDateRange]);

  // Transform cast/crew into DOOD cast members format
  const castMembers = React.useMemo(() => {
    return (castCrew || [])
      .filter((person) => person.type === "cast")
      .map((person) => ({
        castMemberId: person.id,
        castMemberName: person.name,
        characterName: person.character,
        castNumber: person.cast_number || "",
      }));
  }, [castCrew]);

  // Current settings (use defaults if not set)
  const currentSettings = doodSettings || DEFAULT_SETTINGS;

  // Filter calendar days based on selected filters
  const filteredCalendarDays = React.useMemo(() => {
    let filtered = [...calendarDays];

    // Filter by date range
    if (filterStartDate) {
      filtered = filtered.filter((day) => day.date >= filterStartDate);
    }
    if (filterEndDate) {
      filtered = filtered.filter((day) => day.date <= filterEndDate);
    }

    // Filter scheduled days only (include days with shooting schedule OR manual events)
    if (filterScheduledOnly) {
      const scheduledDates = new Set((shootingDays || []).map((d) => d.date));

      // Also include days with manual events
      const manualEventDates = new Set();
      const manualEvents = (doodCastEvents || []).filter(
        (e) => e.source === "manual"
      );
      manualEvents.forEach((event) => {
        // Add all dates in the event's range
        let currentDate = event.startDate;
        while (currentDate <= event.endDate) {
          manualEventDates.add(currentDate);
          // Increment date by 1 day
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);
          currentDate = nextDate.toISOString().split("T")[0];
        }
      });

      filtered = filtered.filter(
        (day) => scheduledDates.has(day.date) || manualEventDates.has(day.date)
      );
    }

    return filtered;
  }, [
    calendarDays,
    filterStartDate,
    filterEndDate,
    filterScheduledOnly,
    shootingDays,
    doodCastEvents,
  ]);

  // (filteredCastMembers moved below calculatedWorkEvents)

  // Calculate work events on-the-fly from shootingDays
  const calculatedWorkEvents = React.useMemo(() => {
    const characterToCastMap = new Map();

    // Map characters to cast members (use castCrew, not castMembers)
    (castCrew || []).forEach((member) => {
      if (
        member.type === "cast" &&
        member.character &&
        member.character.trim()
      ) {
        characterToCastMap.set(member.character, member.id);
      }
    });

    const castWorkDates = new Map();

    // Analyze shootingDays to find who works when
    (shootingDays || []).forEach((shootDay) => {
      if (!shootDay.scheduleBlocks || shootDay.scheduleBlocks.length === 0)
        return;

      const dayDate = shootDay.date;
      const scenesThisDay = new Set();

      // Find all scenes scheduled this day
      shootDay.scheduleBlocks.forEach((block) => {
        if (block.type === "scene" && block.scene) {
          const sceneNum =
            typeof block.scene === "object"
              ? block.scene.sceneNumber
              : block.scene;
          if (sceneNum) scenesThisDay.add(parseInt(sceneNum));
        }
      });

      if (scenesThisDay.size === 0) return;

      // Find characters appearing in those scenes
      const charactersArray = Array.isArray(characters)
        ? characters
        : Object.values(characters || {});

      charactersArray.forEach((character) => {
        if (!character.scenes || character.scenes.length === 0) return;

        const appearsToday = character.scenes.some((sceneNum) =>
          scenesThisDay.has(parseInt(sceneNum))
        );

        if (appearsToday && character.name) {
          const castMemberId = characterToCastMap.get(character.name);
          if (castMemberId) {
            if (!castWorkDates.has(castMemberId)) {
              castWorkDates.set(castMemberId, []);
            }
            castWorkDates.get(castMemberId).push(dayDate);
          }
        }
      });
    });

    // Convert to single-day events format
    const events = [];
    castWorkDates.forEach((dates, castMemberId) => {
      dates.forEach((date) => {
        events.push({
          id: `calc_${date}_${castMemberId}`,
          castMemberId,
          eventType: "work",
          startDate: date,
          endDate: date,
          source: "auto_schedule",
        });
      });
    });

    return events;
  }, [shootingDays, characters, castCrew]);

  // Filter cast members based on calculated events
  const filteredCastMembers = React.useMemo(() => {
    if (!filterActiveCastOnly) return castMembers;

    // Only show cast with events (either auto-calculated OR manual)
    const castWithEvents = new Set();

    // Add cast members from auto-calculated work events
    (calculatedWorkEvents || []).forEach((e) =>
      castWithEvents.add(e.castMemberId)
    );

    // Add cast members from manual events
    const manualEvents = (doodCastEvents || []).filter(
      (e) => e.source === "manual"
    );
    manualEvents.forEach((e) => castWithEvents.add(e.castMemberId));

    return castMembers.filter((member) =>
      castWithEvents.has(member.castMemberId)
    );
  }, [castMembers, filterActiveCastOnly, calculatedWorkEvents, doodCastEvents]);

  const doodMatrix = React.useMemo(() => {
    if (!hasProductionDates || filteredCastMembers.length === 0) return [];

    // Merge auto-calculated work events with manual events
    const manualEvents = (doodCastEvents || []).filter(
      (e) => e.source === "manual"
    );
    const allEvents = [...calculatedWorkEvents, ...manualEvents];

    return generateDoodMatrix({
      calendarDays: filteredCalendarDays,
      castMembers: filteredCastMembers,
      castEvents: allEvents,
      overrides: doodOverrides || [],
      settings: currentSettings,
    });
  }, [
    filteredCalendarDays,
    filteredCastMembers,
    calculatedWorkEvents,
    doodCastEvents,
    doodOverrides,
    currentSettings,
    hasProductionDates,
  ]);

  // Calculate totals
  const doodTotals = React.useMemo(() => {
    return calculateDoodTotals(doodMatrix, filteredCastMembers);
  }, [doodMatrix, filteredCastMembers]);

  // Build report view
  const reportView = React.useMemo(() => {
    if (!hasProductionDates) return null;

    return buildDoodReportView({
      production: {
        title: selectedProject?.name || "Production",
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      },
      calendarDays: filteredCalendarDays,
      castMembers: filteredCastMembers,
      cells: doodMatrix,
      totals: doodTotals,
    });
  }, [
    selectedProject,
    effectiveStartDate,
    effectiveEndDate,
    calendarDays,
    castMembers,
    doodMatrix,
    doodTotals,
  ]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      castMemberId: selectedCastMember || "",
      eventType: EventTypes.WORK,
      startDate: effectiveStartDate || "",
      endDate: effectiveStartDate || "",
      notes: "",
    });
    setShowEventForm(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      castMemberId: event.castMemberId,
      eventType: event.eventType,
      startDate: event.startDate,
      endDate: event.endDate,
      notes: event.notes || "",
    });
    setShowEventForm(true);
  };

  const handleSaveEvent = async () => {
    try {
      // Validate event type - only allow manual event types
      const allowedTypes = [
        "hold",
        "rehearsal",
        "fitting",
        "travel",
        "return_travel",
        "pickup",
        "off",
      ];
      if (!allowedTypes.includes(eventForm.eventType)) {
        alert(
          "Only manual events (Hold, Rehearsal, Fitting, Travel, etc.) can be created. Work days are automatically calculated from the schedule."
        );
        return;
      }

      // Generate proper UUID for new events
      let eventId;
      if (editingEvent) {
        eventId = editingEvent.id;
      } else {
        eventId = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
      }

      const event = {
        id: eventId,
        projectId: selectedProject.id,
        castMemberId: eventForm.castMemberId,
        eventType: eventForm.eventType,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate,
        source: "manual",
        notes: eventForm.notes,
      };

      // Sync to database FIRST (before updating state)
      if (onSyncDoodCastEvent) {
        await onSyncDoodCastEvent(event);
      }

      // Update local state AFTER successful sync
      if (editingEvent) {
        setDoodCastEvents((prev) =>
          prev.map((e) => (e.id === event.id ? event : e))
        );
      } else {
        setDoodCastEvents((prev) => [...prev, event]);
      }

      // Close form
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (error) {
      console.error("Error saving event:", error);
      alert("Failed to save event. Check console for details.");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm("Delete this event?")) return;

    try {
      // Update local state
      setDoodCastEvents((prev) => prev.filter((e) => e.id !== eventId));

      // Sync to database
      if (onSyncDoodCastEvent) {
        await onSyncDoodCastEvent({ id: eventId, _delete: true });
      }

      // Close modal
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event");
    }
  };

  const handleCellClick = (castMemberId, date, currentCode) => {
    if (!canEdit) return;

    // Check if there's a manual event on this cell
    const manualEvent = (doodCastEvents || []).find(
      (e) =>
        e.source === "manual" &&
        e.castMemberId === castMemberId &&
        e.startDate <= date &&
        e.endDate >= date
    );

    if (manualEvent) {
      // Open event form for editing
      setEditingEvent(manualEvent);
      setEventForm({
        castMemberId: manualEvent.castMemberId,
        eventType: manualEvent.eventType,
        startDate: manualEvent.startDate,
        endDate: manualEvent.endDate,
        notes: manualEvent.notes || "",
      });
      setMultipleDate(manualEvent.startDate !== manualEvent.endDate);
      setShowEventForm(true);
    }
  };

  const handleSaveOverride = async () => {
    if (!editingOverride) return;

    try {
      const override = {
        projectId: selectedProject.id,
        castMemberId: editingOverride.castMemberId,
        date: editingOverride.date,
        dayCode: overrideCode,
        reason: overrideReason,
      };

      if (onSyncDoodOverride) {
        await onSyncDoodOverride(override);
      }

      setDoodOverrides((prev) => {
        const existing = (prev || []).findIndex(
          (o) =>
            o.castMemberId === override.castMemberId && o.date === override.date
        );

        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = override;
          return updated;
        } else {
          return [...(prev || []), override];
        }
      });

      setEditingOverride(null);
      setOverrideCode("");
      setOverrideReason("");
    } catch (error) {
      console.error("Error saving override:", error);
      alert("Failed to save override. Check console for details.");
    }
  };

  const handleDeleteOverride = async () => {
    if (!editingOverride) return;

    try {
      setDoodOverrides((prev) =>
        (prev || []).filter(
          (o) =>
            !(
              o.castMemberId === editingOverride.castMemberId &&
              o.date === editingOverride.date
            )
        )
      );

      if (onSyncDoodOverride) {
        await onSyncDoodOverride({
          projectId: selectedProject.id,
          castMemberId: editingOverride.castMemberId,
          date: editingOverride.date,
          _delete: true,
        });
      }

      setEditingOverride(null);
      setOverrideCode("");
      setOverrideReason("");
    } catch (error) {
      console.error("Error deleting override:", error);
      alert("Failed to delete override. Check console for details.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Sync to database
      if (onSyncDoodSettings) {
        await onSyncDoodSettings(currentSettings);
      }

      setShowSettings(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderProductionDateSetup = () => {
    if (hasProductionDates) return null;

    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          margin: "20px",
        }}
      >
        <h3>No Schedule Found</h3>
        <p>To use Day Out of Days, you need production dates.</p>
        <p style={{ color: "#666", fontSize: "14px" }}>
          DOOD will automatically detect dates from your shooting schedule, or
          you can set them manually in your project settings.
        </p>
        <div style={{ marginTop: "20px", fontSize: "14px" }}>
          <strong>Next steps:</strong>
          <ol
            style={{
              textAlign: "left",
              display: "inline-block",
              marginTop: "10px",
            }}
          >
            <li>Go to "StripboardSchedule" module and add shooting days, OR</li>
            <li>Set production dates manually via Supabase SQL (see docs)</li>
          </ol>
        </div>
      </div>
    );
  };

  const renderEventForm = () => {
    if (!showEventForm) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            width: "500px",
            maxWidth: "90%",
          }}
        >
          <h3>{editingEvent ? "Edit Event" : "Add Event"}</h3>

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Cast Member
            </label>
            <select
              value={eventForm.castMemberId}
              onChange={(e) =>
                setEventForm({ ...eventForm, castMemberId: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">Select cast member...</option>
              {castMembers.map((member) => (
                <option key={member.castMemberId} value={member.castMemberId}>
                  {member.characterName} - {member.castMemberName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Event Type
            </label>
            <select
              value={eventForm.eventType}
              onChange={(e) =>
                setEventForm({ ...eventForm, eventType: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value={EventTypes.WORK} disabled>
                Work (Auto-calculated from schedule)
              </option>
              <option value={EventTypes.REHEARSAL}>Rehearsal</option>
              <option value={EventTypes.FITTING}>Fitting</option>
              <option value={EventTypes.TRAVEL}>Travel</option>
              <option value={EventTypes.RETURN_TRAVEL}>Return Travel</option>
              <option value={EventTypes.HOLD}>Hold</option>
              <option value={EventTypes.PICKUP}>Pickup</option>
              <option value={EventTypes.OFF}>Off</option>
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={multipleDate}
                onChange={(e) => {
                  setMultipleDate(e.target.checked);
                  if (!e.target.checked) {
                    // Reset end date to match start date for single date mode
                    setEventForm({
                      ...eventForm,
                      endDate: eventForm.startDate,
                    });
                  }
                }}
                style={{ marginRight: "8px" }}
              />
              <span style={{ fontSize: "13px" }}>
                Multiple Dates or Date Range
              </span>
            </label>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  {multipleDate ? "Start Date" : "Date"}
                </label>
                <input
                  type="date"
                  value={eventForm.startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    setEventForm({
                      ...eventForm,
                      startDate: newStartDate,
                      endDate: multipleDate ? eventForm.endDate : newStartDate,
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
              {multipleDate && (
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endDate: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Notes (optional)
            </label>
            <textarea
              value={eventForm.notes}
              onChange={(e) =>
                setEventForm({ ...eventForm, notes: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                minHeight: "60px",
                resize: "vertical",
              }}
              placeholder="Optional notes..."
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "space-between",
            }}
          >
            <div>
              {editingEvent && (
                <button
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    backgroundColor: "#f44336",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowEventForm(false);
                  setEditingEvent(null);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={
                  !eventForm.castMemberId ||
                  !eventForm.startDate ||
                  !eventForm.endDate
                }
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  cursor:
                    eventForm.castMemberId &&
                    eventForm.startDate &&
                    eventForm.endDate
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    eventForm.castMemberId &&
                    eventForm.startDate &&
                    eventForm.endDate
                      ? 1
                      : 0.5,
                }}
              >
                {editingEvent ? "Save Changes" : "Add Event"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOverrideSelector = () => {
    if (!editingOverride) return null;

    const castMember = castMembers.find(
      (cm) => cm.castMemberId === editingOverride.castMemberId
    );

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
        onClick={() => {
          setEditingOverride(null);
          setOverrideCode("");
          setOverrideReason("");
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "20px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ marginTop: 0 }}>Override Day Code</h3>

          <div
            style={{ marginBottom: "15px", fontSize: "14px", color: "#666" }}
          >
            <div>
              <strong>Cast Member:</strong> {castMember?.characterName} (
              {castMember?.castMemberName})
            </div>
            <div>
              <strong>Date:</strong> {formatDate(editingOverride.date)}
            </div>
            <div>
              <strong>Current Code:</strong>{" "}
              {editingOverride.currentCode || "(blank)"}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Day Code
            </label>
            <select
              value={overrideCode}
              onChange={(e) => setOverrideCode(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">-- Blank --</option>
              <option value="SW">SW - Start-Work</option>
              <option value="W">W - Work</option>
              <option value="WF">WF - Work-Finish</option>
              <option value="SWF">SWF - Start-Work-Finish</option>
              <option value="H">H - Hold</option>
              <option value="R">R - Rehearsal</option>
              <option value="F">F - Fitting</option>
              <option value="T">T - Travel</option>
              <option value="RT">RT - Return Travel</option>
              <option value="P">P - Pickup</option>
              <option value="O">O - Off</option>
              <option value="D">D - Drop/Finish</option>
            </select>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Reason (optional)
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                minHeight: "60px",
                resize: "vertical",
              }}
              placeholder="Why are you overriding this code?"
            />
          </div>

          <div
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
          >
            <button
              onClick={handleDeleteOverride}
              style={{
                padding: "8px 16px",
                border: "1px solid #f44336",
                borderRadius: "4px",
                backgroundColor: "white",
                color: "#f44336",
                cursor: "pointer",
              }}
            >
              Clear Override
            </button>
            <button
              onClick={() => {
                setEditingOverride(null);
                setOverrideCode("");
                setOverrideReason("");
              }}
              style={{
                padding: "8px 16px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveOverride}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: "#2196F3",
                color: "white",
                cursor: "pointer",
              }}
            >
              Save Override
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEventsList = () => {
    if (!doodCastEvents || doodCastEvents.length === 0) {
      return (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#666",
            backgroundColor: "#f9f9f9",
            borderRadius: "4px",
          }}
        >
          No events yet. Click "Add Event" to create cast engagement events.
        </div>
      );
    }

    return (
      <div style={{ marginTop: "20px" }}>
        {doodCastEvents.map((event) => {
          const castMember = castMembers.find(
            (m) => m.castMemberId === event.castMemberId
          );
          const spanLength = getSpanLength(event.startDate, event.endDate);

          return (
            <div
              key={event.id}
              style={{
                padding: "12px",
                marginBottom: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                  {castMember?.characterName || "Unknown"} -{" "}
                  {castMember?.castMemberName || "Unknown"}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {event.eventType.toUpperCase()} •{" "}
                  {formatDate(event.startDate)} - {formatDate(event.endDate)} (
                  {spanLength} day{spanLength > 1 ? "s" : ""})
                  {event.notes && ` • ${event.notes}`}
                </div>
              </div>

              {canEdit && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleEditEvent(event)}
                    style={{
                      padding: "4px 12px",
                      border: "1px solid #2196F3",
                      borderRadius: "4px",
                      backgroundColor: "white",
                      color: "#2196F3",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    style={{
                      padding: "4px 12px",
                      border: "1px solid #f44336",
                      borderRadius: "4px",
                      backgroundColor: "white",
                      color: "#f44336",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================================================
  // PHASE 2: AUTO-SYNC FROM SCHEDULE
  // ============================================================================

  /**
   * Group consecutive dates into spans
   */
  const groupConsecutiveDates = (dates) => {
    if (dates.length === 0) return [];

    const sortedDates = [...dates].sort();
    const spans = [];
    let currentStart = sortedDates[0];
    let currentEnd = sortedDates[0];

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1] + "T00:00:00");
      const currDate = new Date(sortedDates[i] + "T00:00:00");

      const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (dayDiff === 1) {
        currentEnd = sortedDates[i];
      } else {
        spans.push({ startDate: currentStart, endDate: currentEnd });
        currentStart = sortedDates[i];
        currentEnd = sortedDates[i];
      }
    }

    spans.push({ startDate: currentStart, endDate: currentEnd });
    return spans;
  };

  /**
   * Analyze shooting schedule and generate work events
   */
  const analyzeScheduleForWorkEvents = () => {
    console.log("🔍 Starting schedule analysis...");

    const characterToCastMap = new Map();

    castMembers.forEach((member) => {
      if (member.characterName) {
        characterToCastMap.set(member.characterName, member.castMemberId);
      }
    });

    console.log(
      "📋 Character to Cast Map:",
      Object.fromEntries(characterToCastMap)
    );

    const castWorkDates = new Map();

    (shootingDays || []).forEach((shootDay) => {
      if (!shootDay.scheduleBlocks || shootDay.scheduleBlocks.length === 0) {
        return;
      }

      const dayDate = shootDay.date;
      const scenesThisDay = new Set();

      shootDay.scheduleBlocks.forEach((block) => {
        if (block.type === "scene" && block.scene) {
          const sceneNum =
            typeof block.scene === "object"
              ? block.scene.sceneNumber
              : block.scene;

          if (sceneNum) {
            scenesThisDay.add(parseInt(sceneNum));
          }
        }
      });

      console.log(
        `📅 ${dayDate}: Scenes scheduled:`,
        Array.from(scenesThisDay)
      );

      if (scenesThisDay.size === 0) return;

      const charactersThisDay = new Set();

      // Convert characters to array if needed
      const charactersArray = Array.isArray(characters)
        ? characters
        : characters
        ? Object.values(characters)
        : [];

      charactersArray.forEach((character) => {
        if (!character.scenes || character.scenes.length === 0) return;

        const appearsToday = character.scenes.some((sceneNum) =>
          scenesThisDay.has(parseInt(sceneNum))
        );

        if (appearsToday && character.name) {
          charactersThisDay.add(character.name);
        }
      });

      console.log(`  👥 Characters needed:`, Array.from(charactersThisDay));

      charactersThisDay.forEach((characterName) => {
        const castMemberId = characterToCastMap.get(characterName);

        if (castMemberId) {
          if (!castWorkDates.has(castMemberId)) {
            castWorkDates.set(castMemberId, new Set());
          }
          castWorkDates.get(castMemberId).add(dayDate);

          console.log(`    ✅ Mapped ${characterName} -> ${castMemberId}`);
        } else {
          console.log(
            `    ⚠️ No cast member found for character: ${characterName}`
          );
        }
      });
    });

    console.log(
      "📊 Cast Work Dates:",
      Array.from(castWorkDates.entries()).map(
        ([id, dates]) => `${id}: ${dates.size} days`
      )
    );

    const generatedEvents = [];

    castWorkDates.forEach((dates, castMemberId) => {
      const sortedDates = Array.from(dates).sort();
      const spans = groupConsecutiveDates(sortedDates);

      spans.forEach((span) => {
        generatedEvents.push({
          castMemberId,
          eventType: "work",
          startDate: span.startDate,
          endDate: span.endDate,
          source: "manual",
          notes: "Auto-generated from shooting schedule",
        });
      });
    });

    const summary = {
      totalEvents: generatedEvents.length,
      castMembersAffected: castWorkDates.size,
      dateRange:
        shootingDays && shootingDays.length > 0
          ? {
              start: shootingDays[0]?.date,
              end: shootingDays[shootingDays.length - 1]?.date,
            }
          : null,
    };

    console.log("✨ Generated Events:", generatedEvents);
    console.log("📈 Summary:", summary);

    return { events: generatedEvents, summary };
  };

  /**
   * Preview sync - analyze and show what will be created
   */
  const handlePreviewSync = () => {
    try {
      const analysis = analyzeScheduleForWorkEvents();

      if (analysis.events.length === 0) {
        alert(
          "No work events found in shooting schedule.\n\nMake sure:\n1. Shooting days have scheduled scenes\n2. Characters have scenes assigned\n3. Cast members are linked to characters"
        );
        return;
      }

      const enrichedEvents = analysis.events.map((event) => {
        const member = castMembers.find(
          (m) => m.castMemberId === event.castMemberId
        );
        return {
          ...event,
          castMemberName: member?.castMemberName || "Unknown",
          characterName: member?.characterName || "Unknown",
        };
      });

      setSyncPreviewData({
        ...analysis,
        events: enrichedEvents,
      });
      setShowSyncPreview(true);
    } catch (error) {
      console.error("Error analyzing schedule:", error);
      alert("Error analyzing schedule: " + error.message);
    }
  };

  /**
   * Execute sync - create all events
   */
  const handleExecuteSync = async () => {
    if (!syncPreviewData) return;

    setIsSyncing(true);

    try {
      console.log("🚀 Executing sync...");

      const eventsToCreate = syncPreviewData.events;
      const createdEvents = [];

      for (const eventData of eventsToCreate) {
        const eventId = crypto.randomUUID
          ? crypto.randomUUID()
          : generateUUID();

        const event = {
          id: eventId,
          projectId: selectedProject.id,
          castMemberId: eventData.castMemberId,
          eventType: eventData.eventType,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          source: eventData.source,
          notes: eventData.notes,
        };

        if (onSyncDoodCastEvent) {
          await onSyncDoodCastEvent(event);
        }

        createdEvents.push(event);
      }

      setDoodCastEvents((prev) => [...prev, ...createdEvents]);

      console.log(`✅ Created ${createdEvents.length} work events`);

      setShowSyncPreview(false);
      setSyncPreviewData(null);

      alert(
        `✅ Successfully created ${createdEvents.length} work events from shooting schedule!`
      );
    } catch (error) {
      console.error("Error creating events:", error);
      alert("Error creating events: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderDoodGrid = () => {
    if (!reportView || !reportView.rows || reportView.rows.length === 0) {
      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#666",
            backgroundColor: "#f9f9f9",
            borderRadius: "4px",
            margin: "20px 0",
          }}
        >
          <p>Add cast events to generate the Day Out of Days matrix.</p>
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: "30px",
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <h3>Day Out of Days Matrix</h3>

        {/* Horizontal scrollable container */}
        <div
          style={{
            overflowX: "scroll",
            marginTop: "15px",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "15px",
          }}
        >
          <style>{`
          div::-webkit-scrollbar {
            height: 12px;
          }
          div::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          div::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        `}</style>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11px",
              marginTop: "15px",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    ...headerStyle,
                    minWidth: "150px",
                    position: "sticky",
                    left: 0,
                    backgroundColor: "#f5f5f5",
                    zIndex: 2,
                  }}
                >
                  Cast / Character
                </th>
                {reportView.dates.map((date) => (
                  <th key={date} style={{ ...headerStyle, minWidth: "35px" }}>
                    {formatDate(date).split(" ")[1]}
                    <br />
                    <span style={{ fontSize: "9px", color: "#666" }}>
                      {formatDate(date).split(" ")[0]}
                    </span>
                  </th>
                ))}
                <th style={{ ...headerStyle, minWidth: "60px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportView.rows.map((row) => (
                <tr key={row.castMemberId}>
                  <td
                    style={{
                      ...cellStyle,
                      position: "sticky",
                      left: 0,
                      backgroundColor: "white",
                      zIndex: 1,
                      fontWeight: "bold",
                    }}
                  >
                    {row.characterName}
                    <br />
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        fontWeight: "normal",
                      }}
                    >
                      {row.performerName}
                    </span>
                  </td>
                  {row.cells.map((cell) => {
                    const hasOverride = (doodOverrides || []).some(
                      (o) =>
                        o.castMemberId === row.castMemberId &&
                        o.date === cell.date
                    );

                    return (
                      <td
                        key={cell.date}
                        onClick={() =>
                          handleCellClick(
                            row.castMemberId,
                            cell.date,
                            cell.code
                          )
                        }
                        style={{
                          ...cellStyle,
                          backgroundColor: getDayCodeColor(cell.code),
                          fontWeight: cell.code ? "bold" : "normal",
                          textAlign: "center",
                          cursor: canEdit ? "pointer" : "default",
                          position: "relative",
                          userSelect: "none",
                        }}
                        title={
                          canEdit
                            ? hasOverride
                              ? "Click to edit override"
                              : "Click to override"
                            : ""
                        }
                      >
                        {cell.code}
                        {hasOverride && (
                          <span
                            style={{
                              position: "absolute",
                              top: "2px",
                              right: "2px",
                              fontSize: "8px",
                              color: "#2196F3",
                            }}
                            title="Manually overridden"
                          >
                            ✏️
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {row.totals.totalEngagedDays || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* End horizontal scroll */}

        {/* Legend */}
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f9f9f9",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "10px" }}>
            Day Code Legend:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "8px",
              fontSize: "12px",
            }}
          >
            <div key="legend-sw">
              <strong>SW:</strong> Start-Work
            </div>
            <div key="legend-w">
              <strong>W:</strong> Work
            </div>
            <div key="legend-wf">
              <strong>WF:</strong> Work-Finish
            </div>
            <div key="legend-swf">
              <strong>SWF:</strong> Start-Work-Finish
            </div>
            <div key="legend-h">
              <strong>H:</strong> Hold
            </div>
            <div key="legend-r">
              <strong>R:</strong> Rehearsal
            </div>
            <div key="legend-f">
              <strong>F:</strong> Fitting
            </div>
            <div key="legend-t">
              <strong>T:</strong> Travel
            </div>
            <div key="legend-rt">
              <strong>RT:</strong> Return Travel
            </div>
            <div key="legend-p">
              <strong>P:</strong> Pickup
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderManualEvents = () => {
    // Get all manual events (exclude 'work' events since those are auto-calculated)
    const manualEvents = (doodCastEvents || []).filter(
      (e) => e.source === "manual" && e.eventType !== "work"
    );
    if (manualEvents.length === 0) return null;

    // Group by cast member
    const eventsByCast = {};
    manualEvents.forEach((event) => {
      if (!eventsByCast[event.castMemberId]) {
        eventsByCast[event.castMemberId] = [];
      }
      eventsByCast[event.castMemberId].push(event);
    });

    return (
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "10px 15px",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onClick={() => setShowCastEvents(!showCastEvents)}
        >
          <strong>Manual Events ({manualEvents.length})</strong>
          <span>{showCastEvents ? "▼" : "▶"}</span>
        </div>

        {showCastEvents && (
          <div style={{ marginTop: "10px", paddingLeft: "15px" }}>
            {Object.entries(eventsByCast).map(([castMemberId, events]) => {
              const castMember = castMembers.find(
                (m) => m.castMemberId === castMemberId
              );
              const isExpanded = expandedCastMembers[castMemberId] || false;

              return (
                <div key={castMemberId} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      backgroundColor: "#fff",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onClick={() =>
                      setExpandedCastMembers({
                        ...expandedCastMembers,
                        [castMemberId]: !isExpanded,
                      })
                    }
                  >
                    <span>
                      {castMember?.castMemberName || "Unknown"} ({events.length}
                      )
                    </span>
                    <span>{isExpanded ? "▼" : "▶"}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ paddingLeft: "20px", marginTop: "5px" }}>
                      {events.map((event) => (
                        <div
                          key={event.id}
                          style={{
                            padding: "8px",
                            backgroundColor: "#f9f9f9",
                            border: "1px solid #e0e0e0",
                            borderRadius: "4px",
                            marginBottom: "5px",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setEditingEvent(event);
                            setEventForm({
                              castMemberId: event.castMemberId,
                              eventType: event.eventType,
                              startDate: event.startDate,
                              endDate: event.endDate,
                              notes: event.notes || "",
                            });
                            setMultipleDate(event.startDate !== event.endDate);
                            setShowEventForm(true);
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              textTransform: "capitalize",
                            }}
                          >
                            {event.eventType.replace(/_/g, " ")}
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            {formatDate(event.startDate)}
                            {event.startDate !== event.endDate &&
                              ` - ${formatDate(event.endDate)}`}
                          </div>
                          {event.notes && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#888",
                                marginTop: "3px",
                              }}
                            >
                              {event.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        height: "calc(100vh - 44px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Day Out of Days</h2>
          {hasProductionDates && (
            <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>
              {formatDate(effectiveStartDate)} - {formatDate(effectiveEndDate)}(
              {calendarDays.length} days)
              {!productionStartDate && autoDetectedDates && (
                <span
                  style={{
                    marginLeft: "10px",
                    color: "#FF9800",
                    fontSize: "12px",
                  }}
                >
                  ⚠️ Auto-detected from schedule
                </span>
              )}
            </div>
          )}
        </div>

        {hasProductionDates && canEdit && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleAddEvent}
              disabled={isViewOnly || !hasProductionDates}
              style={{
                padding: "10px 20px",
                backgroundColor:
                  isViewOnly || !hasProductionDates ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor:
                  isViewOnly || !hasProductionDates ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              + Add Manual Event
            </button>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: "10px 20px",
                backgroundColor: "#757575",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Settings
            </button>
          </div>
        )}

        {/* Filter Controls */}
        {hasProductionDates && (
          <div
            style={{
              backgroundColor: "#f9f9f9",
              padding: "15px",
              borderRadius: "4px",
              marginTop: "20px",
              border: "1px solid #ddd",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "10px" }}>
              📊 Matrix Filters
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
              }}
            >
              {/* Month Filter */}
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Date Range:
                </label>
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                >
                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      placeholder="Start Date"
                      style={{
                        width: "100%",
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      placeholder="End Date"
                      style={{
                        width: "100%",
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      borderRadius: "3px",
                      border: "1px solid #ddd",
                      backgroundColor:
                        !filterStartDate && !filterEndDate
                          ? "#007bff"
                          : "white",
                      color:
                        !filterStartDate && !filterEndDate ? "white" : "#333",
                      cursor: "pointer",
                    }}
                  >
                    All
                  </button>
                  {calendarDays.length > 0 &&
                    (() => {
                      // Get unique months from calendar
                      const months = new Set();
                      calendarDays.forEach((day) => {
                        const date = new Date(day.date + "T00:00:00");
                        const monthKey = `${date.getFullYear()}-${String(
                          date.getMonth() + 1
                        ).padStart(2, "0")}`;
                        months.add(monthKey);
                      });
                      return Array.from(months)
                        .sort()
                        .map((monthKey) => {
                          const [year, month] = monthKey.split("-");
                          const monthName = new Date(
                            year,
                            parseInt(month) - 1,
                            1
                          ).toLocaleString("default", { month: "short" });
                          const startOfMonth = `${year}-${month}-01`;
                          const endOfMonth = `${year}-${month}-${new Date(
                            year,
                            parseInt(month),
                            0
                          ).getDate()}`;
                          const isActive =
                            filterStartDate === startOfMonth &&
                            filterEndDate === endOfMonth;

                          return (
                            <button
                              key={monthKey}
                              onClick={() => {
                                setFilterStartDate(startOfMonth);
                                setFilterEndDate(endOfMonth);
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                borderRadius: "3px",
                                border: "1px solid #ddd",
                                backgroundColor: isActive ? "#007bff" : "white",
                                color: isActive ? "white" : "#333",
                                cursor: "pointer",
                              }}
                            >
                              {monthName} {year}
                            </button>
                          );
                        });
                    })()}
                </div>
              </div>

              {/* Checkboxes */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  justifyContent: "center",
                }}
              >
                <label
                  style={{
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterScheduledOnly}
                    onChange={(e) => setFilterScheduledOnly(e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />
                  Scheduled Days Only
                </label>
                <label
                  style={{
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterActiveCastOnly}
                    onChange={(e) => setFilterActiveCastOnly(e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />
                  Active Cast Only
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Production Date Setup (if not set) */}
      {renderProductionDateSetup()}

      {/* Events List */}
      {hasProductionDates && (
        <>
          {/* DOOD Matrix */}
          {renderDoodGrid()}

          {/* Manual Events Section */}
          {renderManualEvents()}
        </>
      )}

      {/* Sync Preview Modal */}
      {showSyncPreview && syncPreviewData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowSyncPreview(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "30px",
              maxWidth: "800px",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: "#333" }}>📋 Sync Preview</h2>

            <div
              style={{
                backgroundColor: "#f0f8ff",
                padding: "15px",
                borderRadius: "4px",
                marginBottom: "20px",
              }}
            >
              <p style={{ margin: "5px 0", fontSize: "14px" }}>
                <strong>Total Events:</strong> {syncPreviewData.totalEvents}
              </p>
              <p style={{ margin: "5px 0", fontSize: "14px" }}>
                <strong>Cast Members:</strong>{" "}
                {syncPreviewData.castMembersAffected}
              </p>
              {syncPreviewData.summary.dateRange && (
                <p style={{ margin: "5px 0", fontSize: "14px" }}>
                  <strong>Schedule Range:</strong>{" "}
                  {formatDate(syncPreviewData.summary.dateRange.start)} -{" "}
                  {formatDate(syncPreviewData.summary.dateRange.end)}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
                Work Events to Create:
              </h3>
              <div style={{ maxHeight: "300px", overflow: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Cast Member
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Character
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Start Date
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        End Date
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        Days
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncPreviewData.events.map((event, idx) => {
                      const start = new Date(event.startDate + "T00:00:00");
                      const end = new Date(event.endDate + "T00:00:00");
                      const days =
                        Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr
                          key={idx}
                          style={{ borderBottom: "1px solid #eee" }}
                        >
                          <td style={{ padding: "8px" }}>
                            {event.castMemberName}
                          </td>
                          <td style={{ padding: "8px", color: "#666" }}>
                            {event.characterName}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {formatDate(event.startDate)}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {formatDate(event.endDate)}
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            {days}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {doodCastEvents && doodCastEvents.length > 0 && (
              <div
                style={{
                  backgroundColor: "#fff3cd",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  color: "#856404",
                }}
              >
                ⚠️ You have {doodCastEvents.length} existing event(s).
                Auto-generated events will be added alongside them.
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowSyncPreview(false)}
                disabled={isSyncing}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteSync}
                disabled={isSyncing}
                style={{
                  padding: "10px 20px",
                  backgroundColor: isSyncing ? "#ccc" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {isSyncing
                  ? "Creating..."
                  : `✅ Create ${syncPreviewData.totalEvents} Events`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {renderEventForm()}

      {/* Override Selector Modal */}
      {renderOverrideSelector()}
    </div>
  );
}

// Styles
const headerStyle = {
  padding: "8px",
  borderBottom: "2px solid #ddd",
  backgroundColor: "#f5f5f5",
  fontWeight: "bold",
  textAlign: "left",
  fontSize: "11px",
};

const cellStyle = {
  padding: "8px",
  borderBottom: "1px solid #eee",
  fontSize: "11px",
};

// Day code color helper
function getDayCodeColor(code) {
  const colors = {
    SW: "#e3f2fd",
    W: "#bbdefb",
    WF: "#90caf9",
    SWF: "#64b5f6",
    H: "#fff9c4",
    R: "#f3e5f5",
    F: "#ffe0b2",
    T: "#c8e6c9",
    RT: "#c8e6c9",
    P: "#ffccbc",
    O: "#f5f5f5",
    D: "#fafafa",
  };
  return colors[code] || "transparent";
}

export default DayOutOfDaysModule;
