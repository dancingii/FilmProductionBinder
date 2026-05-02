import React, { useState } from "react";
import * as database from "../../../services/database";
import { usePresence } from "../../../hooks/usePresence";
import PresenceIndicator from "../../shared/PresenceIndicator";

function CastCrewModule({
  scenes,
  castCrew,
  setCastCrew,
  crewSortOrder,
  setCrewSortOrder,
  onSyncCastCrew,
  setActiveModule,
  setCurrentIndex,
  userRole,
  canEdit,
  isViewOnly,
  selectedProject,
  user,
  moduleCharacters,
}) {
  const [editingPersonId, setEditingPersonId] = React.useState(null);
  const { otherUsers } = usePresence(
    selectedProject?.id,
    user,
    "cast_crew",
    editingPersonId
  );
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showDatePicker, setShowDatePicker] = React.useState(null);
  const [expandedCards, setExpandedCards] = React.useState({});
  const [expandedDateSections, setExpandedDateSections] = React.useState({});
  const [calendarDate, setCalendarDate] = React.useState(new Date());
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [newPersonId, setNewPersonId] = React.useState(null);
  const editableFieldsRef = React.useRef([]);

  React.useEffect(() => {
    editableFieldsRef.current = [];
    castCrew.forEach((person) => {
      editableFieldsRef.current.push(
        { personId: person.id, field: "name", subField: null },
        { personId: person.id, field: "email", subField: null },
        { personId: person.id, field: "phone", subField: null }
      );
    });
  }, [castCrew]);

  const crewDepartments = [
    "Principal Crew", "Producer", "Production", "Camera", "G&E", "Art",
    "Wardrobe", "Makeup", "Sound", "Script", "Stunts", "BTS",
    "Transportation", "Craft Services", "Other",
  ];

  const dietaryOptions = [
    "None", "Pescatarian", "Vegetarian", "Vegan", "Gluten-Free",
    "Dairy-Free", "Nut Allergy", "Shellfish Allergy", "Kosher", "Halal", "Custom",
  ];

  const unionOptions = [
    "Non-Union", "SAG-AFTRA", "IATSE", "DGA", "WGA", "Teamsters Local 399", "Other Union",
  ];

  const characters =
    moduleCharacters && typeof moduleCharacters === "object"
      ? Object.keys(moduleCharacters).map((charName) => ({ name: charName, type: "character" }))
      : [];

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const navigateMonth = (direction) => {
    setCalendarDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const selectDate = (day) => {
    const selectedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split("T")[0];
    if (!showDatePicker) return;

    const personId = showDatePicker.replace("-availability", "").replace("-booked", "");
    const person = castCrew.find((p) => p.id === personId);

    if (showDatePicker.endsWith("-availability")) {
      const isAvailable = person?.availability?.availableDates?.includes(dateStr);
      const isUnavailable = person?.availability?.unavailableDates?.includes(dateStr);
      if (!isAvailable && !isUnavailable) {
        addAvailableDate(personId, dateStr);
      } else if (isAvailable) {
        removeAvailableDate(personId, dateStr);
        addUnavailableDate(personId, dateStr);
      } else if (isUnavailable) {
        removeUnavailableDate(personId, dateStr);
      }
    } else if (showDatePicker.endsWith("-booked")) {
      const isAlreadyBooked = person?.availability?.bookedDates?.includes(dateStr);
      if (isAlreadyBooked) removeBookedDate(personId, dateStr);
      else addBookedDate(personId, dateStr);
    }
  };

  const addDateRange = async () => {
    if (!startDate || !endDate || !showDatePicker) return;
    const personId = showDatePicker.replace("-availability", "").replace("-booked", "");
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (start > end) { alert("Start date must be before or equal to end date"); return; }

    let dateType = "available";
    if (showDatePicker.endsWith("-unavailable")) dateType = "unavailable";
    else if (showDatePicker.endsWith("-booked")) dateType = "booked";

    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) {
        const fieldName = `${dateType}Dates`;
        const currentDates = person.availability?.[fieldName] || [];
        const newDates = dates.filter((date) => !currentDates.includes(date));
        return { ...person, availability: { ...person.availability, [fieldName]: [...currentDates, ...newDates].sort() } };
      }
      return person;
    }));

    try {
      await database.addAvailabilityDateRange(selectedProject, personId, startDate, endDate, dateType);
    } catch (error) {
      console.error("❌ Failed to sync date range:", error);
      alert("⚠️ Failed to save date range.\n\nYour changes were not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }

    setStartDate("");
    setEndDate("");
    setShowDatePicker(null);
  };

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    const personId = showDatePicker ? showDatePicker.replace("-availability","").replace("-booked","") : null;
    const currentPerson = personId ? castCrew.find((p) => p.id === personId) : null;
    const bookedDates = currentPerson?.availability?.bookedDates || currentPerson?.bookedDates || [];
    const availableDates = currentPerson?.availability?.availableDates || currentPerson?.availableDates || [];
    const unavailableDates = currentPerson?.availability?.unavailableDates || currentPerson?.unavailableDates || [];

    const calendar = [];

    calendar.push(
      <div key="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", padding: "0 5px" }}>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigateMonth(-1); }}
          style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", cursor: "pointer", fontSize: "14px" }}>←</button>
        <div style={{ fontWeight: "bold", fontSize: "16px" }}>{monthNames[month]} {year}</div>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigateMonth(1); }}
          style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "5px 10px", cursor: "pointer", fontSize: "14px" }}>→</button>
      </div>
    );

    calendar.push(
      <div key="daynames" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "5px" }}>
        {dayNames.map((day) => (
          <div key={day} style={{ textAlign: "center", fontWeight: "bold", padding: "5px", fontSize: "12px", color: "#666" }}>{day}</div>
        ))}
      </div>
    );

    const calendarGrid = [];
    let day = 1;

    for (let week = 0; week < 6; week++) {
      const weekRow = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (week === 0 && dayOfWeek < firstDay) {
          weekRow.push(<div key={`empty-${dayOfWeek}`} style={{ padding: "8px" }}></div>);
        } else if (day <= daysInMonth) {
          const currentDay = day;
          const currentDate = new Date(year, month, currentDay);
          const currentDateStr = currentDate.toISOString().split("T")[0];
          const isPast = currentDateStr < todayStr;
          const isBooked = bookedDates.includes(currentDateStr);
          const isAvailable = availableDates.includes(currentDateStr);
          const isUnavailable = unavailableDates.includes(currentDateStr);

          let bgColor = "white";
          if (isPast) bgColor = "#f0f0f0";
          else if (isUnavailable) bgColor = "#ffcdd2";
          else if (isAvailable) bgColor = "#c8e6c9";
          else if (isBooked) bgColor = "#FFF59D";

          weekRow.push(
            <button key={currentDay}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isPast) selectDate(currentDay); }}
              disabled={isPast}
              style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", cursor: isPast ? "not-allowed" : "pointer", backgroundColor: bgColor, color: isPast ? "#999" : "black", fontWeight: isBooked || isAvailable || isUnavailable ? "bold" : "normal" }}>
              {currentDay}
            </button>
          );
          day++;
        } else {
          weekRow.push(<div key={`empty-end-${dayOfWeek}`} style={{ padding: "8px" }}></div>);
        }
      }
      if (weekRow.some((cell) => cell.key && !cell.key.includes("empty"))) {
        calendarGrid.push(
          <div key={`week-${week}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "2px" }}>
            {weekRow}
          </div>
        );
      }
    }

    calendar.push(<div key="grid">{calendarGrid}</div>);
    return calendar;
  };

  const startEdit = (personId, field, subField = null) => {
    if (isViewOnly) return;
    const person = castCrew.find((p) => p.id === personId);
    let currentValue = subField ? person[field]?.[subField] || "" : person[field] || "";
    if (currentValue === "New Person" || currentValue === "Enter name" || currentValue === "Enter position") currentValue = "";
    setEditValue(currentValue);
    setEditingField({ personId, field, subField });
  };

  const saveEdit = () => {
    if (!editingField) return;
    const { personId, field, subField } = editingField;
    const originalPerson = castCrew.find((p) => p.id === personId);
    const originalValue = subField ? originalPerson?.[field]?.[subField] : originalPerson?.[field];
    if (editValue === originalValue) { setEditingField(null); setEditValue(""); return; }

    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        if (person.id === personId) {
          if (subField) return { ...person, [field]: { ...person[field], [subField]: editValue } };
          else return { ...person, [field]: editValue };
        }
        return person;
      });

      const changedPerson = updatedPeople.find((p) => p.id === personId);
      if (changedPerson) {
        database.updateSingleCastCrewPerson(selectedProject, changedPerson)
          .catch((error) => {
            console.error("Failed to update person:", error);
            alert("Failed to update " + changedPerson.displayName + ".\n\nError: " + error.message + "\n\nPlease try again.");
            database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
          });
      }
      return updatedPeople;
    });

    if (newPersonId === personId && field === "displayName") setNewPersonId(null);
    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => { setEditingField(null); setEditValue(""); };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      saveEdit();
      if (newPersonId === editingField?.personId) setNewPersonId(null);
    } else if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const currentField = editableFieldsRef.current.find(
        (f) => f.personId === editingField?.personId && f.field === editingField?.field && f.subField === editingField?.subField
      );
      if (currentField) {
        const currentIndex = editableFieldsRef.current.indexOf(currentField);
        const nextIndex = (currentIndex + 1) % editableFieldsRef.current.length;
        const nextField = editableFieldsRef.current[nextIndex];
        saveEdit();
        setTimeout(() => { startEdit(nextField.personId, nextField.field, nextField.subField); }, 0);
      }
    }
  };

  const addUnavailableDate = async (personId, date) => {
    if (!date) return;
    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) {
        const currentDates = person.availability?.unavailableDates || [];
        if (!currentDates.includes(localDate)) return { ...person, availability: { ...person.availability, unavailableDates: [...currentDates, localDate].sort() } };
      }
      return person;
    }));
    try {
      await database.addAvailabilityDateSafe(selectedProject, personId, localDate, "unavailable");
    } catch (error) {
      console.error("❌ Failed to sync unavailable date:", error);
      alert("⚠️ Failed to save unavailability date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeUnavailableDate = async (personId, dateToRemove) => {
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) return { ...person, availability: { ...person.availability, unavailableDates: (person.availability?.unavailableDates || []).filter((date) => date !== dateToRemove) } };
      return person;
    }));
    try {
      await database.removeAvailabilityDateSafe(selectedProject, personId, dateToRemove, "unavailable");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert("⚠️ Failed to remove unavailability date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const addAvailableDate = async (personId, date) => {
    if (!date) return;
    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) {
        const currentDates = person.availability?.availableDates || [];
        if (!currentDates.includes(localDate)) return { ...person, availability: { ...person.availability, availableDates: [...currentDates, localDate].sort() } };
      }
      return person;
    }));
    try {
      await database.addAvailabilityDateSafe(selectedProject, personId, localDate, "available");
    } catch (error) {
      console.error("❌ Failed to sync available date:", error);
      alert("⚠️ Failed to save availability date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeAvailableDate = async (personId, dateToRemove) => {
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) return { ...person, availability: { ...person.availability, availableDates: (person.availability?.availableDates || []).filter((date) => date !== dateToRemove) } };
      return person;
    }));
    try {
      await database.removeAvailabilityDateSafe(selectedProject, personId, dateToRemove, "available");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert("⚠️ Failed to remove availability date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const addBookedDate = async (personId, date) => {
    if (!date) return;
    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) {
        const currentDates = person.availability?.bookedDates || [];
        if (!currentDates.includes(localDate)) return { ...person, availability: { ...person.availability, bookedDates: [...currentDates, localDate].sort() } };
      }
      return person;
    }));
    try {
      await database.addAvailabilityDateSafe(selectedProject, personId, localDate, "booked");
    } catch (error) {
      console.error("❌ Failed to sync booked date:", error);
      alert("⚠️ Failed to save booked date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeBookedDate = async (personId, dateToRemove) => {
    setCastCrew((prevPeople) => prevPeople.map((person) => {
      if (person.id === personId) return { ...person, availability: { ...person.availability, bookedDates: (person.availability?.bookedDates || []).filter((date) => date !== dateToRemove) } };
      return person;
    }));
    try {
      await database.removeAvailabilityDateSafe(selectedProject, personId, dateToRemove, "booked");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert("⚠️ Failed to remove booked date.\n\nYour change was not saved. Please try again.");
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const toggleDateSection = (personId, section) => {
    setExpandedDateSections((prev) => ({ ...prev, [`${personId}-${section}`]: !prev[`${personId}-${section}`] }));
  };

  const deletePerson = async (personId) => {
    const updatedPeople = castCrew.filter((person) => person.id !== personId);
    setCastCrew(updatedPeople);
    try {
      await database.deleteCastCrewPerson(selectedProject, personId);
    } catch (error) {
      console.error("❌ Failed to delete person:", error);
      setCastCrew(castCrew);
      alert("Failed to delete person. Please try again.");
    }
  };

  const linkUserToPerson = (personId) => {
    if (!user?.id) { alert("User ID not found. Please try logging out and back in."); return; }
    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        if (person.user_id === user.id && person.id !== personId) return { ...person, user_id: null };
        if (person.id === personId) return { ...person, user_id: user.id };
        return person;
      });
      const linkedPerson = updatedPeople.find((p) => p.id === personId);
      if (linkedPerson) {
        database.updateCastCrewPerson(selectedProject, linkedPerson)
          .catch((error) => { console.error("Failed to link user:", error); alert("Failed to link user. Error: " + error.message); });
      }
      return updatedPeople;
    });
    alert(`Successfully linked your account to ${castCrew.find((p) => p.id === personId)?.displayName || "this person"}!`);
  };

  const unlinkUserFromPerson = (personId) => {
    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        if (person.id === personId) return { ...person, user_id: null };
        return person;
      });
      const unlinkedPerson = updatedPeople.find((p) => p.id === personId);
      if (unlinkedPerson) {
        database.updateCastCrewPerson(selectedProject, unlinkedPerson)
          .catch((error) => { console.error("Failed to unlink user:", error); alert("Failed to unlink user. Error: " + error.message); });
      }
      return updatedPeople;
    });
    alert("Successfully unlinked your account!");
  };

  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState({
    name: "", type: "cast", department: "Other", character: "",
    position: "", phone: "", email: "", isInternational: false,
  });

  const openAddPersonModal = () => {
    setNewPersonForm({ name: "", type: "cast", department: "Other", character: "", position: "", phone: "", email: "", isInternational: false });
    setShowAddPersonModal(true);
  };

  const formatPhoneNumber = (value, isIntl) => {
    if (isIntl) return value;
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const addNewPerson = () => {
    if (!newPersonForm.name.trim()) { alert("Name is required"); return; }
    if (newPersonForm.type === "crew" && !newPersonForm.department.trim()) { alert("Department is required for crew members"); return; }
    if (newPersonForm.type === "cast" && !newPersonForm.character.trim()) { alert("Character is required for cast members"); return; }

    const newPersonIdValue = crypto.randomUUID();
    const newPerson = {
      id: newPersonIdValue,
      displayName: newPersonForm.name.trim(),
      position: newPersonForm.type === "cast" ? newPersonForm.character.trim() : newPersonForm.position.trim(),
      type: newPersonForm.type,
      character: newPersonForm.type === "cast" ? newPersonForm.character.trim() : "",
      crewDepartment: newPersonForm.type === "crew" ? newPersonForm.department : "Other",
      email: newPersonForm.email.trim(),
      phone: newPersonForm.phone.trim(),
      height: "", weight: "",
      emergencyContact: { name: "", phone: "", relationship: "" },
      wardrobe: { chest: "", waist: "", hips: "", shoe: "", pants: "", shirt: "", dress: "" },
      dietary: { restrictions: "None", customRestriction: "" },
      unionStatus: "Non-Union", unionNumber: "",
      unavailableDates: [], availableDates: [], bookedDates: [], notes: "",
    };

    setNewPersonId(newPersonIdValue);
    const updatedPeople = [newPerson, ...castCrew];
    setCastCrew(updatedPeople);

    database.addCastCrewPerson(selectedProject, newPerson)
      .then(() => {})
      .catch((error) => {
        console.error("❌ Failed to add person:", error);
        setCastCrew(castCrew);
        alert("Failed to add person. Please try again.");
      });

    setShowAddPersonModal(false);
    setNewPersonForm({ name: "", type: "cast", department: "Other", character: "", position: "", phone: "", email: "", isInternational: false });
  };

  const renderCharacterDropdown = (person) => {
    const isEditing = editingField?.personId === person.id && editingField?.field === "character";
    const displayValue = person.character || "";
    const bgColor = displayValue ? "#4CAF50" : "#757575";

    if (isEditing) {
      return (
        <div style={{ position: "relative", display: "inline-block" }}>
          <select value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyPress} autoFocus
            style={{ position: "absolute", top: 0, left: 0, fontSize: "12px", padding: "2px 4px", border: "1px solid #2196F3", borderRadius: "3px", minWidth: "120px", backgroundColor: "white", zIndex: 1000 }}>
            <option value="">Select character...</option>
            {characters.map((char) => (<option key={char.name} value={char.name}>{char.name}</option>))}
          </select>
          <span style={{ visibility: "hidden", padding: "2px 6px", borderRadius: "8px", backgroundColor: bgColor, color: "white", fontSize: "10px", fontWeight: "bold", minWidth: "80px", display: "inline-block", textAlign: "center" }}>
            {displayValue || "No Character"}
          </span>
        </div>
      );
    }

    return (
      <span onClick={() => startEdit(person.id, "character")}
        style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "8px", backgroundColor: bgColor, color: "white", fontSize: "10px", fontWeight: "bold", minWidth: "80px", display: "inline-block", textAlign: "center" }}
        title="Click to edit">
        {displayValue || "No Character"}
      </span>
    );
  };

  const renderEditableField = (person, field, subField = null, placeholder = "", type = "text", options = null) => {
    const isEditing = editingField?.personId === person.id && editingField?.field === field && editingField?.subField === subField;
    let displayValue = subField ? person[field]?.[subField] : person[field];
    if (!displayValue) displayValue = "";
    if (field === "phone" && displayValue) displayValue = formatPhoneNumber(displayValue, person.isInternational);

    if (isEditing) {
      if (options) {
        return (
          <div style={{ position: "relative", display: "inline-block" }}>
            <select value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyPress} autoFocus
              style={{ position: "absolute", top: 0, left: 0, fontSize: "12px", padding: "2px 4px", border: "1px solid #2196F3", borderRadius: "3px", minWidth: "120px", backgroundColor: "white", zIndex: 1000 }}>
              {options.map((option) => (<option key={option} value={option}>{option}</option>))}
            </select>
            <span style={{ visibility: "hidden", fontSize: "12px", padding: "2px 4px" }}>{displayValue || placeholder}</span>
          </div>
        );
      } else {
        return (
          <input type={type} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyPress} placeholder={placeholder} autoFocus
            style={{ fontSize: "12px", padding: "2px 4px", border: "1px solid #2196F3", borderRadius: "3px", minWidth: "60px", width: "auto" }} />
        );
      }
    }

    if (field === "type") {
      const bgColor = displayValue === "cast" ? "#4CAF50" : displayValue === "crew" ? "#2196F3" : "#FF9800";
      return (
        <span onClick={() => startEdit(person.id, field, subField)}
          style={{ cursor: "pointer", padding: "3px 8px", borderRadius: "12px", backgroundColor: bgColor, color: "white", fontSize: "11px", textTransform: "uppercase", fontWeight: "bold" }}
          title="Click to edit">
          {displayValue || "CAST"}
        </span>
      );
    }

    if (field === "crewDepartment") {
      return (
        <span onClick={() => startEdit(person.id, field, subField)}
          style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "8px", backgroundColor: "#FF6B35", color: "white", fontSize: "10px", fontWeight: "bold" }}
          title="Click to edit">
          {displayValue || "Other"}
        </span>
      );
    }

    if (field === "unionStatus") {
      const bgColor = displayValue === "Non-Union" ? "#757575" : "#4CAF50";
      return (
        <span onClick={() => startEdit(person.id, field, subField)}
          style={{ cursor: "pointer", padding: "2px 6px", borderRadius: "8px", backgroundColor: bgColor, color: "white", fontSize: "10px", fontWeight: "bold" }}
          title="Click to edit">
          {displayValue || "Non-Union"}
        </span>
      );
    }

    return (
      <span onClick={() => startEdit(person.id, field, subField)}
        style={{ cursor: "pointer", padding: "1px 3px", borderRadius: "2px", fontSize: "12px", minHeight: "16px", display: "inline-block" }}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#f5f5f5")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "transparent")}
        title="Click to edit">
        {displayValue || <span style={{ color: "#ccc", fontStyle: "italic" }}>{placeholder}</span>}
      </span>
    );
  };

  const renderPersonCard = (person) => {
    const isExpanded = expandedCards[person.id] || false;
    const toggleExpanded = () => {
      setExpandedCards((prev) => ({ ...prev, [person.id]: !prev[person.id] }));
    };

    return (
      <PresenceIndicator key={person.id} itemId={person.id} otherUsers={otherUsers} position="top">
        <div style={{ border: "1px solid #ddd", padding: "5px", margin: "3px 0", borderRadius: "4px", backgroundColor: "#fff", position: "relative", fontSize: "12px" }}>
          {canEdit && (
            <button onClick={() => deletePerson(person.id)}
              style={{ position: "absolute", top: "6px", right: "20px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "2px", cursor: "pointer", fontSize: "10px", padding: "2px 4px", width: "16px", height: "16px" }}>
              ×
            </button>
          )}

          {(() => {
            const userIsLinked = castCrew.some((p) => p.user_id === user?.id);
            if (person.user_id === user?.id) {
              return (
                <button onClick={() => unlinkUserFromPerson(person.id)}
                  style={{ position: "absolute", top: "6px", right: "40px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "9px", padding: "3px 6px", fontWeight: "bold" }}
                  title="Unlink your account from this person">
                  Unlink
                </button>
              );
            } else if (!userIsLinked && !person.user_id) {
              return (
                <button onClick={() => linkUserToPerson(person.id)}
                  style={{ position: "absolute", top: "6px", right: "40px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "9px", padding: "3px 6px", fontWeight: "bold" }}
                  title="Link this person to your user account">
                  Link to Me
                </button>
              );
            }
            return null;
          })()}

          {/* Row 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", paddingRight: "25px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", width: "150px", flexShrink: 0, overflow: "hidden" }}>
              {renderEditableField(person, "displayName", null, "Enter name")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "140px", flexShrink: 0 }}>
              <strong style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>POS:</strong>
              {person.type !== "cast" ? renderEditableField(person, "position", null, "Enter position") : <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>}
            </div>
            <div style={{ width: "52px", flexShrink: 0 }}>
              {renderEditableField(person, "type", null, "cast", "text", ["cast", "crew", "misc"])}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "170px", flexShrink: 0 }}>
              {person.type === "cast" && (<><strong style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>CHAR:</strong>{renderCharacterDropdown(person)}</>)}
              {person.type === "crew" && (<><strong style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>DEPT:</strong>{renderEditableField(person, "crewDepartment", null, "Other", "text", crewDepartments)}</>)}
              {person.type === "misc" && <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "255px", flexShrink: 0 }}>
              <strong style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>EMAIL:</strong>
              {renderEditableField(person, "email", null, "Enter Email", "email")}
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "150px", flexShrink: 0 }}>
              <strong style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}>PHONE:</strong>
              {renderEditableField(person, "phone", null, "Enter Phone")}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: "8px", marginRight: "60px" }}>
                <button onClick={() => { setStartDate(""); setEndDate(""); setShowDatePicker(`${person.id}-booked`); }}
                  style={{ backgroundColor: "#FF9800", color: "white", padding: "2px 6px", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px" }}>
                  Add Booked
                </button>
                <button onClick={() => { setStartDate(""); setEndDate(""); setShowDatePicker(`${person.id}-availability`); }}
                  style={{ background: "linear-gradient(to right, #4CAF50 50%, #f44336 50%)", color: "white", padding: "2px 6px", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px" }}
                  title="Click to open calendar. Click dates to cycle through: Available → Unavailable → Clear">
                  Add Availability
                </button>
              </div>
            )}
          </div>

          {/* Accordion Date Sections */}
          <div style={{ marginBottom: "3px" }}>
            {(person.availability?.bookedDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div onClick={() => toggleDateSection(person.id, "booked")}
                  style={{ backgroundColor: "#FFF3E0", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", color: "#E65100", border: "1px solid #FFB74D", userSelect: "none" }}>
                  {expandedDateSections[`${person.id}-booked`] ? "▼" : "►"} Booked ({(person.availability?.bookedDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-booked`] && (
                  <div style={{ marginTop: "3px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {(person.availability?.bookedDates || []).map((date) => (
                      <span key={`booked-${date}`} onClick={() => removeBookedDate(person.id, date)} title="Click to remove booked date"
                        style={{ display: "inline-block", backgroundColor: "#FFF3E0", color: "#E65100", padding: "2px 6px", borderRadius: "8px", fontSize: "10px", border: "1px solid #FFB74D", cursor: "pointer" }}>
                        📅 {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(person.availability?.availableDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div onClick={() => toggleDateSection(person.id, "available")}
                  style={{ backgroundColor: "#e8f5e8", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", color: "#2e7d32", border: "1px solid #4caf50", userSelect: "none" }}>
                  {expandedDateSections[`${person.id}-available`] ? "▼" : "►"} Available ({(person.availability?.availableDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-available`] && (
                  <div style={{ marginTop: "3px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {(person.availability?.availableDates || []).map((date) => (
                      <span key={`available-${date}`} onClick={() => removeAvailableDate(person.id, date)} title="Click to remove available date"
                        style={{ display: "inline-block", backgroundColor: "#e8f5e8", color: "#2e7d32", padding: "2px 6px", borderRadius: "8px", fontSize: "10px", border: "1px solid #4caf50", cursor: "pointer" }}>
                        ✅ {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(person.availability?.unavailableDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div onClick={() => toggleDateSection(person.id, "unavailable")}
                  style={{ backgroundColor: "#ffebee", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "bold", color: "#c62828", border: "1px solid #ef5350", userSelect: "none" }}>
                  {expandedDateSections[`${person.id}-unavailable`] ? "▼" : "►"} Unavailable ({(person.availability?.unavailableDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-unavailable`] && (
                  <div style={{ marginTop: "3px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {(person.availability?.unavailableDates || []).map((date) => (
                      <span key={`unavailable-${date}`} onClick={() => removeUnavailableDate(person.id, date)} title="Click to remove unavailable date"
                        style={{ display: "inline-block", backgroundColor: "#ffebee", color: "#c62828", padding: "2px 6px", borderRadius: "8px", fontSize: "10px", border: "1px solid #ef5350", cursor: "pointer" }}>
                        ❌ {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: "3px" }}>
            <button onClick={toggleExpanded}
              style={{ backgroundColor: "#2196F3", color: "white", padding: "2px 8px", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px" }}>
              {isExpanded ? "Show Less" : "Show More"}
            </button>
          </div>

          {isExpanded && (
            <div>
              <div style={{ marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "2px" }}>
                  {person.type === "cast" && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <strong>Height:</strong> {renderEditableField(person, "height", null, "5'10\"")}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <strong>Weight:</strong> {renderEditableField(person, "weight", null, "150 lbs")}
                      </div>
                    </>
                  )}
                </div>
                {person.type === "cast" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px" }}>
                    <strong style={{ fontSize: "12px" }}>Wardrobe:</strong>
                    <span>Pants: {renderEditableField(person, "wardrobe", "pants", "32")}</span>
                    <span>Shirt: {renderEditableField(person, "wardrobe", "shirt", "M")}</span>
                    <span>Dress: {renderEditableField(person, "wardrobe", "dress", "8")}</span>
                    <span>Shoe: {renderEditableField(person, "wardrobe", "shoe", "9")}</span>
                    <span>Chest: {renderEditableField(person, "wardrobe", "chest", "40")}</span>
                    <span>Waist: {renderEditableField(person, "wardrobe", "waist", "32")}</span>
                    <span>Hips: {renderEditableField(person, "wardrobe", "hips", "36")}</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <strong>Dietary/Allergies:</strong>{" "}
                  {renderEditableField(person, "dietary", "restrictions", "None", "text", dietaryOptions)}
                  {person.dietary?.restrictions === "Custom" && (
                    <span style={{ marginLeft: "4px" }}>
                      {renderEditableField(person, "dietary", "customRestriction", "Enter specific dietary/allergy details")}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <strong>Union:</strong>{" "}
                  {renderEditableField(person, "unionStatus", null, "Non-Union", "text", unionOptions)}
                </div>
              </div>

              {person.unionStatus && person.unionStatus !== "Non-Union" && (
                <div style={{ marginBottom: "3px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <strong>Union #:</strong>{" "}
                    {renderEditableField(person, "unionNumber", null, "Enter info")}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <strong>Emergency Contact:</strong>{" "}
                    {renderEditableField(person, "emergencyContact", "name", "Contact Name")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <strong>Phone:</strong>{" "}
                    {renderEditableField(person, "emergencyContact", "phone", "Phone Number")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <strong>Relationship:</strong>{" "}
                    {renderEditableField(person, "emergencyContact", "relationship", "Spouse, Parent, etc.")}
                  </div>
                </div>
              </div>

              <div>
                <strong>Notes:</strong>
                <span style={{ marginLeft: "4px" }}>
                  {renderEditableField(person, "notes", null, "Add notes...")}
                </span>
              </div>
            </div>
          )}
        </div>
      </PresenceIndicator>
    );
  };

  const getLastName = (displayName) => {
    if (!displayName) return "";
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].toLowerCase();
    return parts[parts.length - 1].toLowerCase();
  };

  const getFirstName = (displayName) => {
    if (!displayName) return "";
    return displayName.trim().split(/\s+/)[0].toLowerCase();
  };

  const grouped = {
    cast: castCrew.filter((p) => p.type === "cast").sort((a, b) => {
      if (a.id === newPersonId) return -1;
      if (b.id === newPersonId) return 1;
      const lastCmp = getLastName(a.displayName).localeCompare(getLastName(b.displayName));
      if (lastCmp !== 0) return lastCmp;
      return getFirstName(a.displayName).localeCompare(getFirstName(b.displayName));
    }),
    crew: castCrew.filter((p) => p.type === "crew").sort((a, b) => {
      if (a.id === newPersonId) return -1;
      if (b.id === newPersonId) return 1;
      const lastCmp = getLastName(a.displayName).localeCompare(getLastName(b.displayName));
      if (lastCmp !== 0) return lastCmp;
      return getFirstName(a.displayName).localeCompare(getFirstName(b.displayName));
    }),
    misc: castCrew.filter((p) => p.type === "misc").sort((a, b) => {
      if (a.id === newPersonId) return -1;
      if (b.id === newPersonId) return 1;
      const lastCmp = getLastName(a.displayName).localeCompare(getLastName(b.displayName));
      if (lastCmp !== 0) return lastCmp;
      return getFirstName(a.displayName).localeCompare(getFirstName(b.displayName));
    }),
  };

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowAddPersonModal(false);
      setShowDatePicker(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 40px)", boxSizing: "border-box", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, left: 0, right: 0, backgroundColor: "white", zIndex: 100, padding: "20px 20px 15px 20px", borderBottom: "1px solid #ddd", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Cast & Crew</h2>
          {isViewOnly && (
            <div style={{ padding: "8px 16px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontWeight: "bold", fontSize: "14px" }}>VIEW ONLY MODE</div>
          )}
          {canEdit && (
            <button onClick={openAddPersonModal}
              style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
              + Add Person
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "0 20px 20px 20px", height: "calc(100% - 80px)", overflowY: "auto" }}>
        <p style={{ fontSize: "13px", color: "#666", fontStyle: "italic", marginBottom: "15px" }}>
          Click any field to edit • Use Tab to navigate between fields • Availability: Click dates to cycle White → Green (Available) → Red (Unavailable) → White
        </p>

        <div style={{ marginTop: "15px" }}>
          <div style={{ fontSize: "24px", color: "#333", marginBottom: "5px", padding: "8px", backgroundColor: "#A5D6A7", textAlign: "center", fontWeight: "bold", borderRadius: "4px" }}>
            Cast ({grouped.cast.length})
          </div>
          {grouped.cast.length === 0 ? <p>No cast members added yet.</p> : grouped.cast.map(renderPersonCard)}
        </div>

        <div style={{ marginTop: "15px" }}>
          <div style={{ fontSize: "24px", color: "#333", marginBottom: "5px", padding: "8px", backgroundColor: "#A5D6A7", textAlign: "center", fontWeight: "bold", borderRadius: "4px" }}>
            Crew ({grouped.crew.length})
          </div>
          {grouped.crew.length === 0 ? (
            <p>No crew members added yet.</p>
          ) : (
            crewSortOrder.map((department) => {
              const departmentCrew = grouped.crew.filter((person) => (person.crewDepartment || "Other") === department);
              if (departmentCrew.length === 0) return null;
              return (
                <div key={department} style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "14px", color: "white", marginBottom: "5px", padding: "8px", backgroundColor: "#FFC107", textAlign: "center", fontWeight: "bold", borderRadius: "4px" }}>
                    {department} ({departmentCrew.length})
                  </div>
                  {departmentCrew.map(renderPersonCard)}
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: "15px" }}>
          <div style={{ fontSize: "24px", color: "#333", marginBottom: "5px", padding: "8px", backgroundColor: "#A5D6A7", textAlign: "center", fontWeight: "bold", borderRadius: "4px" }}>
            Misc ({grouped.misc.length})
          </div>
          {grouped.misc.length === 0 ? <p>No misc contacts added yet.</p> : grouped.misc.map(renderPersonCard)}
        </div>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowDatePicker(null)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "400px" }}
              onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>
                {(() => {
                  const personId = showDatePicker.replace(/-unavailable$/, "").replace(/-booked$/, "").replace(/-availability$/, "");
                  const person = castCrew.find((p) => p.id === personId);
                  const personName = person?.displayName || "";
                  const label = showDatePicker.endsWith("-unavailable") ? "Unavailable Dates" : showDatePicker.endsWith("-booked") ? "Booked Dates" : "Availability";
                  return personName ? `${personName} — ${label}` : label;
                })()}
              </h3>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "10px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                <strong>Instructions:</strong>{" "}
                {showDatePicker.endsWith("-availability")
                  ? "Click a date to cycle availability: White → Green (Available) → Red (Unavailable) → White."
                  : "Click a date to book it. Click again to unbook. Yellow = Booked, White = Not booked."}
              </div>
              <div style={{ marginBottom: "15px" }}>{renderCalendar()}</div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowDatePicker(null)}
                  style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  Done
                </button>
              </div>
            </div>
          </>
        )}

        {/* Add Person Modal */}
        {showAddPersonModal && (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowAddPersonModal(false)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", padding: "30px", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}
              onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Add New Person</h3>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Name *</label>
                <input type="text" value={newPersonForm.name} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter person's name" autoFocus
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Type *</label>
                <select value={newPersonForm.type}
                  onChange={(e) => setNewPersonForm((prev) => ({ ...prev, type: e.target.value, department: e.target.value === "crew" ? "Other" : "", character: e.target.value === "cast" ? "" : "" }))}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}>
                  <option value="cast">Cast</option>
                  <option value="crew">Crew</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                {newPersonForm.type === "cast" ? (
                  <>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Character *</label>
                    {moduleCharacters && Object.keys(moduleCharacters).length > 0 ? (
                      <select value={newPersonForm.character} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, character: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}>
                        <option value="">Select a character...</option>
                        {Object.values(moduleCharacters)
                          .sort((a, b) => (a.chronologicalNumber || 999) - (b.chronologicalNumber || 999))
                          .filter((char) => !castCrew.some((p) => p.type === "cast" && p.character === char.name))
                          .map((char) => (<option key={char.name} value={char.name}>{char.chronologicalNumber}. {char.name}</option>))}
                      </select>
                    ) : (
                      <input type="text" value={newPersonForm.character} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, character: e.target.value }))}
                        placeholder="Enter character name (parse script first to auto-populate)"
                        style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
                    )}
                  </>
                ) : (
                  <>
                    <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Department *</label>
                    <select value={newPersonForm.department} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, department: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}>
                      {crewDepartments.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
                    </select>
                  </>
                )}
              </div>

              {newPersonForm.type === "crew" && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Position</label>
                  <input type="text" value={newPersonForm.position} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, position: e.target.value }))}
                    placeholder="e.g., Gaffer, 1st AC, Producer"
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
              )}

              <div style={{ marginBottom: "15px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                  <label style={{ fontWeight: "bold" }}>Phone</label>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: "normal", fontSize: "12px", color: "#555", cursor: "pointer" }}>
                    <input type="checkbox" checked={newPersonForm.isInternational}
                      onChange={(e) => setNewPersonForm((prev) => ({ ...prev, isInternational: e.target.checked, phone: "" }))} />
                    International
                  </label>
                </div>
                <input type="tel" value={newPersonForm.phone}
                  onChange={(e) => setNewPersonForm((prev) => ({ ...prev, phone: formatPhoneNumber(e.target.value, prev.isInternational) }))}
                  placeholder={newPersonForm.isInternational ? "+1 (555) 555-5555 or +44 20 7946 0958" : "(555) 555-5555"}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Email</label>
                <input type="email" value={newPersonForm.email} onChange={(e) => setNewPersonForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => setShowAddPersonModal(false)}
                  style={{ backgroundColor: "#ccc", color: "#333", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  Cancel
                </button>
                <button onClick={addNewPerson}
                  style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  Add Person
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CastCrewModule;