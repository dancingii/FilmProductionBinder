import React, { useState, useEffect } from "react";
import { parseSceneHeading, getElementStyle } from "../../../utils.js";

function LocationsModule({
  scenes,
  mainScenes,
  setMainScenes,
  saveScenesDatabase,
  scriptLocations,
  setScriptLocations,
  actualLocations,
  setActualLocations,
  setActiveModule,
  setCurrentIndex,
  onSyncScriptLocations,
  onSyncActualLocations,
  selectedProject,
  onUpdateSceneHeading,
  onUpdateSceneTimeOfDay,
}) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAddActualLocation, setShowAddActualLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [editingParentName, setEditingParentName] = useState(null);
  const [editParentValue, setEditParentValue] = useState("");
  const [editingSubLocation, setEditingSubLocation] = React.useState(null);
  const [editSubLocationValue, setEditSubLocationValue] = React.useState("");
  const [editingHeading, setEditingHeading] = React.useState(null);
  const [recentlyRemovedScenes, setRecentlyRemovedScenes] = React.useState(
    () => {
      const initial = {};
      return initial;
    }
  );

  React.useEffect(() => {
    if (scriptLocations && scriptLocations.length > 0) {
      const fromDb = {};
      scriptLocations.forEach((loc) => {
        if (loc.removedScenes && loc.removedScenes.length > 0) {
          fromDb[loc.id] = new Set(loc.removedScenes.map(String));
        }
      });
      setRecentlyRemovedScenes(fromDb);
    }
  }, [scriptLocations.length]);

  const [editHeadingIntExt, setEditHeadingIntExt] = React.useState("EXT.");
  const [editHeadingLocation, setEditHeadingLocation] = React.useState("");
  const [editHeadingTimeOfDay, setEditHeadingTimeOfDay] = React.useState("DAY");
  const [editHeadingCustomTime, setEditHeadingCustomTime] = React.useState("");
  React.useState(null);
  const [showReassignSubDialog, setShowReassignSubDialog] = React.useState(null);
  const [reassignSubTarget, setReassignSubTarget] = React.useState("");
  const [showReassignDialog, setShowReassignDialog] = useState(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [showLocationScenesPopup, setShowLocationScenesPopup] = useState(null);
  const [locationSceneIndex, setLocationSceneIndex] = useState(0);
  const [locationScenesFullMode, setLocationScenesFullMode] = useState(false);
  const [locationScenesFullIndex, setLocationScenesFullIndex] = useState(0);
  const [unassignedFullMode, setUnassignedFullMode] = useState(false);
  const [unassignedFullIndex, setUnassignedFullIndex] = useState(0);
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [newLocationHeading, setNewLocationHeading] = useState("");
  const [manualLocationIds, setManualLocationIds] = useState(new Set());
  const [showSceneBadgePopup, setShowSceneBadgePopup] = useState(null);
  const [sceneBadgeReassignTarget, setSceneBadgeReassignTarget] = useState("");
  const [unassignedScenesPopupScenes, setUnassignedScenesPopupScenes] = useState(null);
  const [unassignedSceneIndex, setUnassignedSceneIndex] = useState(0);
  const [unassignedReassignScene, setUnassignedReassignScene] = useState(null);
  const [unassignedReassignTarget, setUnassignedReassignTarget] = useState("");
  const [todCollapsed, setTodCollapsed] = useState({});
  const [todAssignPopup, setTodAssignPopup] = useState(null);

  const TIME_OF_DAY_ORDER = ["DAWN", "DAY", "DUSK", "NIGHT", "OTHER", "UNASSIGNED"];

  const getSceneTimeOfDay = (sceneNum) => {
    const scene = (mainScenes || scenes).find(
      (s) => String(s.sceneNumber) === String(sceneNum)
    );
    const tod =
      scene?.manualTimeOfDay != null && scene.manualTimeOfDay !== ""
        ? scene.manualTimeOfDay
        : scene?.metadata?.timeOfDay || "";
    if (!tod) return "UNASSIGNED";
    const upper = tod.toUpperCase();
    if (["DAWN", "DAY", "DUSK", "NIGHT"].includes(upper)) return upper;
    return "OTHER";
  };

  const toggleTod = (locationId, tod) => {
    setTodCollapsed((prev) => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] || {}),
        [tod]: !(prev[locationId]?.[tod] ?? true),
      },
    }));
  };

  const isTodCollapsed = (locationId, tod) =>
    todCollapsed[locationId]?.[tod] ?? true;

  const [newActualLocation, setNewActualLocation] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    contactPerson: "",
    phone: "",
    category: "Practical",
    permitRequired: false,
    parkingInfo: "",
    notes: "",
  });

  useEffect(() => {
    if (scenes.length > 0 && scriptLocations.length === 0) {
      autoExtractAndGroupLocations();
    }
  }, [scenes, scriptLocations.length]);

  const autoExtractAndGroupLocations = () => {
    const locationMap = new Map();
    let locationId = 1;

    scenes.forEach((scene) => {
      if (scene.metadata && scene.metadata.location) {
        const fullLocation = scene.metadata.location.toUpperCase().trim();
        const intExt = scene.metadata.intExt || "";

        let parentLocation = "";
        let subLocation = fullLocation;

        if (fullLocation.includes("'S ")) {
          const parts = fullLocation.split("'S ");
          parentLocation = parts[0] + "'S";
          subLocation = parts[1].trim();
        } else if (
          /\b(HOUSE|APARTMENT|BUILDING|OFFICE|SCHOOL|HOSPITAL|STORE|SHOP|RESTAURANT|BAR|CLUB)\b/.test(fullLocation)
        ) {
          const words = fullLocation.split(" ");
          const buildingIndex = words.findIndex((word) =>
            ["HOUSE","APARTMENT","BUILDING","OFFICE","SCHOOL","HOSPITAL","STORE","SHOP","RESTAURANT","BAR","CLUB"].includes(word)
          );
          if (buildingIndex !== -1 && buildingIndex < words.length - 1) {
            parentLocation = words.slice(0, buildingIndex + 1).join(" ");
            subLocation = words.slice(buildingIndex + 1).join(" ");
          }
        } else if (/\b(CAR|TRUCK|VAN|SUV|MOTORCYCLE|BIKE|VEHICLE)\b/.test(fullLocation)) {
          const words = fullLocation.split(" ");
          const vehicleIndex = words.findIndex((word) =>
            ["CAR","TRUCK","VAN","SUV","MOTORCYCLE","BIKE","VEHICLE"].includes(word)
          );
          if (vehicleIndex > 0) {
            parentLocation = words.slice(0, vehicleIndex + 1).join(" ");
            subLocation = vehicleIndex === words.length - 1 ? fullLocation : words.slice(vehicleIndex + 1).join(" ");
          }
        } else {
          const rooms = ["BEDROOM","BATHROOM","KITCHEN","LIVING ROOM","DINING ROOM","OFFICE","GARAGE","BASEMENT","ATTIC","HALLWAY","LOBBY","ENTRANCE"];
          const foundRoom = rooms.find((room) => fullLocation.includes(room));
          if (foundRoom && fullLocation !== foundRoom) {
            parentLocation = fullLocation.replace(foundRoom, "").trim().replace(/\s+/g, " ");
            subLocation = foundRoom;
            if (parentLocation === "") {
              const words = fullLocation.split(" ");
              const roomIndex = words.findIndex((word) => foundRoom.split(" ").includes(word));
              if (roomIndex > 0) {
                parentLocation = words.slice(0, roomIndex).join(" ");
                subLocation = words.slice(roomIndex).join(" ");
              }
            }
          }
        }

        if (!parentLocation && /\b(STREET|AVENUE|ROAD|PARK|PLAZA|SQUARE)\b/.test(fullLocation)) {
          parentLocation = fullLocation;
          subLocation = "EXTERIOR";
        }

        if (!parentLocation || parentLocation.trim() === "") {
          parentLocation = fullLocation;
          subLocation = fullLocation;
        }

        const locationKey = `${parentLocation}|${subLocation}`;

        if (locationMap.has(locationKey)) {
          locationMap.get(locationKey).scenes.push(scene.sceneNumber);
        } else {
          locationMap.set(locationKey, {
            id: `script_location_${Date.now()}_${locationId++}`,
            parentLocation,
            subLocation,
            fullName: fullLocation,
            intExt,
            scenes: [scene.sceneNumber],
            actualLocationId: null,
            category: intExt === "INT." ? "Interior" : "Exterior",
          });
        }
      }
    });

    const extractedLocations = Array.from(locationMap.values());
    setScriptLocations(extractedLocations);
    if (onSyncScriptLocations) onSyncScriptLocations(extractedLocations);
  };

  const toggleSceneAssignment = (locationId, sceneNumber) => {
    setScriptLocations((prev) => {
      const updated = prev.map((location) => {
        if (location.id === locationId) {
          const sceneNumStr = String(sceneNumber);
          const sceneIndex = location.scenes.findIndex((s) => String(s) === sceneNumStr);
          if (sceneIndex > -1) {
            const newScenes = location.scenes.filter((s, i) => i !== sceneIndex);
            setRecentlyRemovedScenes((prev) => {
              const existing = new Set(prev[locationId] || []);
              existing.add(String(sceneNumber));
              return { ...prev, [locationId]: existing };
            });
            return { ...location, scenes: newScenes, removedScenes: [...new Set([...(location.removedScenes || []), String(sceneNumber)])] };
          } else {
            const newScenes = [...location.scenes, sceneNumber].sort((a, b) => {
              const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
              const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
              return aNum - bNum;
            });
            setRecentlyRemovedScenes((prev) => {
              const existing = new Set(prev[locationId] || []);
              existing.delete(String(sceneNumber));
              return { ...prev, [locationId]: existing };
            });
            return { ...location, scenes: newScenes, removedScenes: (location.removedScenes || []).filter((s) => String(s) !== String(sceneNumber)) };
          }
        }
        return location;
      });
      if (onSyncScriptLocations) onSyncScriptLocations(updated);
      return updated;
    });
  };

  const addManualLocation = (headingStr) => {
    if (!headingStr.trim()) return;
    const upper = headingStr.toUpperCase().trim();
    const parsed = parseSceneHeading(upper);
    const intExt = upper.startsWith("INT.") ? "INT." : upper.startsWith("EXT.") ? "EXT." : "";
    const fullLocation = parsed.location ? parsed.location.trim() : upper;

    let parentLocation = fullLocation;
    let subLocation = fullLocation;

    if (fullLocation.includes("'S ")) {
      const parts = fullLocation.split("'S ");
      parentLocation = parts[0] + "'S";
      subLocation = parts[1].trim();
    } else if (/\b(HOUSE|APARTMENT|BUILDING|OFFICE|SCHOOL|HOSPITAL|STORE|SHOP|RESTAURANT|BAR|CLUB)\b/.test(fullLocation)) {
      const words = fullLocation.split(" ");
      const idx = words.findIndex((w) => ["HOUSE","APARTMENT","BUILDING","OFFICE","SCHOOL","HOSPITAL","STORE","SHOP","RESTAURANT","BAR","CLUB"].includes(w));
      if (idx !== -1 && idx < words.length - 1) {
        parentLocation = words.slice(0, idx + 1).join(" ");
        subLocation = words.slice(idx + 1).join(" ");
      }
    }

    const newId = `script_location_manual_${Date.now()}`;
    const newLoc = { id: newId, parentLocation, subLocation, fullName: fullLocation, intExt, scenes: [], actualLocationId: null, category: intExt === "INT." ? "Interior" : "Exterior", isManual: true };
    const updated = [...scriptLocations, newLoc];
    setScriptLocations(updated);
    setManualLocationIds((prev) => new Set([...prev, newId]));
    if (onSyncScriptLocations) onSyncScriptLocations(updated);
    setShowAddLocationDialog(false);
    setNewLocationHeading("");
  };

  const reassignSceneToLocation = (sceneNumber, fromLocationId, toLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => {
        if (loc.id === fromLocationId) return { ...loc, scenes: loc.scenes.filter((s) => String(s) !== String(sceneNumber)) };
        if (loc.id === toLocationId) {
          const newScenes = [...loc.scenes, sceneNumber].sort((a, b) => parseFloat(String(a).replace(/[^0-9.]/g, "")) - parseFloat(String(b).replace(/[^0-9.]/g, "")));
          return { ...loc, scenes: newScenes };
        }
        return loc;
      });
      if (onSyncScriptLocations) onSyncScriptLocations(updated);
      return updated;
    });
  };

  const assignUnassignedScene = (sceneNumber, toLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => {
        if (loc.id === toLocationId) {
          const newScenes = [...loc.scenes, sceneNumber].sort((a, b) => parseFloat(String(a).replace(/[^0-9.]/g, "")) - parseFloat(String(b).replace(/[^0-9.]/g, "")));
          return { ...loc, scenes: newScenes };
        }
        return loc;
      });
      if (onSyncScriptLocations) onSyncScriptLocations(updated);
      return updated;
    });
  };

  const allSceneNumbers = scenes.map((scene) => scene.sceneNumber).sort((a, b) => {
    const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
    const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
    return aNum - bNum;
  });

  const groupedLocations = scriptLocations.reduce((groups, location) => {
    const parent = location.parentLocation;
    if (!groups[parent]) groups[parent] = [];
    groups[parent].push(location);
    return groups;
  }, {});

  const sortedGroupEntries = Object.entries(groupedLocations).sort(([, aLocs], [, bLocs]) => {
    const aMin = Math.min(...aLocs.flatMap((l) => l.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999)));
    const bMin = Math.min(...bLocs.flatMap((l) => l.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999)));
    return aMin - bMin;
  });

  const assignedSceneNumbers = new Set(scriptLocations.flatMap((loc) => loc.scenes.map((s) => String(s))));
  const unassignedScenes = scenes.filter((s) => !assignedSceneNumbers.has(String(s.sceneNumber)));

  const toggleGroup = (parentLocation) => {
    setExpandedGroups((prev) => ({ ...prev, [parentLocation]: !prev[parentLocation] }));
  };

  const assignActualLocation = (scriptLocationId, actualLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => loc.id === scriptLocationId ? { ...loc, actualLocationId: actualLocationId || null } : loc);
      if (onSyncScriptLocations) onSyncScriptLocations(updated);
      return updated;
    });
  };

  const assignActualToGroup = (parentLocation, actualLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => loc.parentLocation === parentLocation ? { ...loc, actualLocationId: actualLocationId || null } : loc);
      if (onSyncScriptLocations) onSyncScriptLocations(updated);
      return updated;
    });
  };

  const startEditingParentName = (parentLocation) => { setEditingParentName(parentLocation); setEditParentValue(parentLocation); };
  const saveParentNameEdit = () => {
    if (editParentValue.trim() && editingParentName) {
      setScriptLocations((prev) => {
        const updated = prev.map((loc) => loc.parentLocation === editingParentName ? { ...loc, parentLocation: editParentValue.trim() } : loc);
        if (onSyncScriptLocations) onSyncScriptLocations(updated);
        return updated;
      });
    }
    setEditingParentName(null); setEditParentValue("");
  };
  const cancelParentNameEdit = () => { setEditingParentName(null); setEditParentValue(""); };

  const startEditingSubLocation = (locationId, currentSubLocation) => { setEditingSubLocation(locationId); setEditSubLocationValue(currentSubLocation); };
  const saveSubLocationEdit = () => {
    if (editSubLocationValue.trim() && editingSubLocation) {
      setScriptLocations((prev) => {
        const updated = prev.map((loc) => loc.id === editingSubLocation ? { ...loc, subLocation: editSubLocationValue.trim() } : loc);
        if (onSyncScriptLocations) onSyncScriptLocations(updated);
        return updated;
      });
    }
    setEditingSubLocation(null); setEditSubLocationValue("");
  };
  const cancelSubLocationEdit = () => { setEditingSubLocation(null); setEditSubLocationValue(""); };

  const startEditingHeading = (location) => {
    setEditingHeading(location.id);
    setEditHeadingIntExt(location.intExt || "EXT.");
    setEditHeadingLocation(location.subLocation || "");
    const tod = location.scenes.length > 0 ? (() => {
      const s = (mainScenes || scenes).find((sc) => String(sc.sceneNumber) === String(location.scenes[0]));
      if (!s) return "DAY";
      const h = s.heading || "";
      const match = h.match(/\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|SAME|MOMENTS LATER)$/i);
      return match ? match[1].toUpperCase() : "OTHER";
    })() : "DAY";
    const standardTimes = ["DAY", "NIGHT", "DAWN", "DUSK"];
    if (standardTimes.includes(tod)) { setEditHeadingTimeOfDay(tod); setEditHeadingCustomTime(""); }
    else { setEditHeadingTimeOfDay("OTHER"); setEditHeadingCustomTime(tod); }
  };

  const saveHeadingEdit = () => {
    if (!editingHeading || !editHeadingLocation.trim()) { setEditingHeading(null); return; }
    const timeOfDay = editHeadingTimeOfDay === "OTHER" ? editHeadingCustomTime.trim() : editHeadingTimeOfDay;
    const newHeading = `${editHeadingIntExt} ${editHeadingLocation.trim().toUpperCase()} - ${timeOfDay}`;
    const newSubLocation = editHeadingLocation.trim().toUpperCase();
    const newParentLocation = editHeadingLocation.trim().toUpperCase();

    const updatedLocations = scriptLocations.map((loc) => {
      if (loc.id === editingHeading) return { ...loc, intExt: editHeadingIntExt, subLocation: newSubLocation, parentLocation: newParentLocation, fullName: newSubLocation, category: editHeadingIntExt === "INT." ? "Interior" : "Exterior" };
      return loc;
    });
    setScriptLocations(updatedLocations);
    if (onSyncScriptLocations) onSyncScriptLocations(updatedLocations);

    const location = scriptLocations.find((l) => l.id === editingHeading);
    if (location && location.scenes.length > 0 && mainScenes && setMainScenes) {
      const updatedScenes = mainScenes.map((scene) => {
        if (location.scenes.some((sn) => String(sn) === String(scene.sceneNumber))) {
          return { ...scene, heading: newHeading, metadata: { ...scene.metadata, intExt: editHeadingIntExt, location: newSubLocation, timeOfDay, modifier: scene.metadata?.modifier || "" } };
        }
        return scene;
      });
      setMainScenes(updatedScenes);
      if (onUpdateSceneHeading) {
        location.scenes.forEach((sceneNum) => {
          const scene = mainScenes.find((s) => String(s.sceneNumber) === String(sceneNum));
          onUpdateSceneHeading(sceneNum, newHeading, editHeadingIntExt, newSubLocation, timeOfDay, scene?.metadata?.modifier || "");
        });
      }
    }
    setEditingHeading(null);
  };

  const startReassignSubLocation = (locationId, subLocationName) => {
    const location = scriptLocations.find((loc) => loc.id === locationId);
    setShowReassignSubDialog({ locationId, subLocationName, parentLocation: location.parentLocation });
    setReassignSubTarget("");
  };

  const confirmReassignSubLocation = () => {
    if (reassignSubTarget && showReassignSubDialog) {
      const { locationId } = showReassignSubDialog;
      const locationToReassign = scriptLocations.find((loc) => loc.id === locationId);
      setScriptLocations((prev) => {
        let updated = [...prev];
        if (reassignSubTarget.startsWith("merge:")) {
          const targetLocationId = reassignSubTarget.replace("merge:", "");
          const targetLocation = prev.find((loc) => loc.id === targetLocationId);
          if (targetLocation) {
            const mergedScenes = [...new Set([...targetLocation.scenes, ...locationToReassign.scenes])];
            const updatedLocations = prev.map((loc) => loc.id === targetLocationId ? { ...loc, scenes: mergedScenes } : loc);
            updated = updatedLocations.filter((loc) => loc.id !== locationId);
          }
        } else if (reassignSubTarget.startsWith("parent:")) {
          const newParent = reassignSubTarget.replace("parent:", "");
          updated = prev.map((loc) => loc.id === locationId ? { ...loc, parentLocation: newParent } : loc);
        } else if (reassignSubTarget.trim()) {
          updated = prev.map((loc) => loc.id === locationId ? { ...loc, parentLocation: reassignSubTarget.trim() } : loc);
        }
        if (onSyncScriptLocations) onSyncScriptLocations(updated);
        return updated;
      });
    }
    setShowReassignSubDialog(null); setReassignSubTarget("");
  };

  const cancelReassignSubLocation = () => { setShowReassignSubDialog(null); setReassignSubTarget(""); };

  const startReassignParent = (parentLocation) => { setShowReassignDialog(parentLocation); setReassignTarget(""); };

  const confirmReassignParent = () => {
    if (reassignTarget && showReassignDialog) {
      setScriptLocations((prev) => {
        const locationsToReassign = prev.filter((loc) => loc.parentLocation === showReassignDialog);
        const otherLocations = prev.filter((loc) => loc.parentLocation !== showReassignDialog);
        const reassignedLocations = locationsToReassign.map((loc) => ({ ...loc, parentLocation: reassignTarget }));
        const updated = [...otherLocations, ...reassignedLocations];
        setShowReassignDialog(null); setReassignTarget("");
        if (onSyncScriptLocations) onSyncScriptLocations(updated);
        return updated;
      });
    } else { setShowReassignDialog(null); setReassignTarget(""); }
  };

  const addActualLocation = () => {
    if (!newActualLocation.name.trim()) return;
    const location = { id: `actual_location_${Date.now()}`, ...newActualLocation };
    setActualLocations((prev) => {
      const updated = [...prev, location];
      if (onSyncActualLocations) onSyncActualLocations(updated);
      return updated;
    });
    setNewActualLocation({ name: "", address: "", city: "", state: "", zipCode: "", contactPerson: "", phone: "", category: "Practical", permitRequired: false, parkingInfo: "", notes: "" });
    setShowAddActualLocation(false);
  };

  const editActualLocation = (locationId, updatedLocation) => {
    setActualLocations((prev) => {
      const updated = prev.map((location) => location.id === locationId ? { ...location, ...updatedLocation } : location);
      if (onSyncActualLocations) onSyncActualLocations(updated);
      return updated;
    });
  };

  const deleteActualLocation = (locationId) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
      setScriptLocations((prev) => {
        const updated = prev.map((loc) => loc.actualLocationId === locationId ? { ...loc, actualLocationId: null } : loc);
        if (onSyncScriptLocations) onSyncScriptLocations(updated);
        return updated;
      });
      setActualLocations((prev) => {
        const updated = prev.filter((location) => location.id !== locationId);
        if (onSyncActualLocations) onSyncActualLocations(updated);
        return updated;
      });
    }
  };

  const actualLocationCategories = ["Studio", "Practical", "Location", "Backlot"];

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowAddLocationDialog(false);
      setShowEditLocationDialog(false);
      setShowReassignDialog(null);
      setShowReassignSubDialog(null);
      setShowLocationScenesPopup(null);
      setShowSceneBadgePopup(null);
      setShowAddActualLocation(false);
      setUnassignedScenesPopupScenes(null);
      setUnassignedReassignScene(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div style={{ padding: "20px", minHeight: "100vh", width: "100%", maxWidth: "100vw", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Locations</h2>
      </div>

      <div style={{ display: "flex", gap: "20px", height: "calc(100vh - 164px)" }}>
        {/* Left Panel */}
        <div style={{ flex: "1", borderRight: "1px solid #ddd", paddingRight: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0 }}>Script Locations ({scriptLocations.length} total)</h3>
            <button onClick={() => { setNewLocationHeading(""); setShowAddLocationDialog(true); }}
              style={{ backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>
              + Add Location
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "30px" }}>
            {sortedGroupEntries.map(([parentLocation, subLocations]) => {
              const isExpanded = expandedGroups[parentLocation];
              const totalScenes = subLocations.reduce((total, loc) => total + loc.scenes.length, 0);
              const assignedActual = actualLocations.find((actual) => actual.id === subLocations[0]?.actualLocationId);

              return (
                <div key={parentLocation} style={{ marginBottom: "15px" }}>
                  <div style={{ backgroundColor: manualLocationIds.has(subLocations[0]?.id) ? "#fde8e8" : assignedActual ? "#e8f5e8" : "#f0f0f0", border: `2px solid ${manualLocationIds.has(subLocations[0]?.id) ? "#e57373" : "#ddd"}`, borderRadius: "6px", padding: "12px", cursor: "pointer" }}
                    onClick={() => toggleGroup(parentLocation)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {editingParentName === parentLocation ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                          <input type="text" value={editParentValue} onChange={(e) => setEditParentValue(e.target.value)}
                            onBlur={saveParentNameEdit}
                            onKeyPress={(e) => { if (e.key === "Enter") saveParentNameEdit(); if (e.key === "Escape") cancelParentNameEdit(); }}
                            autoFocus style={{ fontSize: "16px", fontWeight: "bold", border: "2px solid #2196F3", borderRadius: "3px", padding: "4px 8px", flex: 1 }} />
                        </div>
                      ) : (
                        <h4 style={{ margin: 0, fontSize: "16px", flex: 1 }} onDoubleClick={() => startEditingParentName(parentLocation)}>
                          {isExpanded ? "▼" : "▶"} {parentLocation}
                        </h4>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#666" }}>{subLocations.length} locations, {totalScenes} scenes</span>
                        <button onClick={(e) => { e.stopPropagation(); startReassignParent(parentLocation); }}
                          style={{ backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontSize: "10px" }}>Reassign</button>
                        {subLocations.some((loc) => loc.scenes && loc.scenes.length > 0) && (
                          <button onClick={(e) => { e.stopPropagation(); const allScenes = subLocations.flatMap((loc) => loc.scenes || []); setLocationSceneIndex(0); setShowLocationScenesPopup(allScenes); }}
                            style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontSize: "10px", marginLeft: "6px" }}>📄 Scenes</button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: "10px" }}>
                      <label style={{ display: "block", marginBottom: "5px", fontSize: "12px", fontWeight: "bold" }}>Assign all to location:</label>
                      <select value={assignedActual?.id || ""} onChange={(e) => { e.stopPropagation(); assignActualToGroup(parentLocation, e.target.value); }} onClick={(e) => e.stopPropagation()}
                        style={{ width: "100%", padding: "4px", border: "1px solid #ccc", borderRadius: "3px", fontSize: "12px" }}>
                        <option value="">Select actual location...</option>
                        {actualLocations.map((actual) => (<option key={actual.id} value={actual.id}>{actual.name}</option>))}
                      </select>
                    </div>

                    {assignedActual && (
                      <div style={{ backgroundColor: "#f0f8f0", padding: "8px", borderRadius: "3px", fontSize: "12px", marginTop: "8px" }}>
                        <strong>Assigned to:</strong> {assignedActual.name}<br />
                        <strong>Address:</strong> {assignedActual.address}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ marginLeft: "20px", marginTop: "10px" }}>
                      {subLocations.map((location) => (
                        <div key={location.id} style={{ border: "1px solid #ddd", margin: "8px 0", padding: "10px", backgroundColor: "#fff", borderRadius: "4px", fontSize: "14px" }}>
                          <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                            {editingHeading === location.id ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <select value={editHeadingIntExt} onChange={(e) => setEditHeadingIntExt(e.target.value)}
                                  style={{ padding: "3px 6px", border: "2px solid #2196F3", borderRadius: "3px", fontSize: "13px", fontWeight: "bold" }}>
                                  <option value="INT.">INT.</option>
                                  <option value="EXT.">EXT.</option>
                                </select>
                                <input type="text" value={editHeadingLocation} onChange={(e) => setEditHeadingLocation(e.target.value)}
                                  style={{ padding: "3px 6px", border: "2px solid #2196F3", borderRadius: "3px", fontSize: "13px", fontWeight: "bold", minWidth: "140px" }} placeholder="LOCATION NAME" />
                                <span style={{ fontWeight: "bold" }}>-</span>
                                <select value={editHeadingTimeOfDay} onChange={(e) => setEditHeadingTimeOfDay(e.target.value)}
                                  style={{ padding: "3px 6px", border: "2px solid #2196F3", borderRadius: "3px", fontSize: "13px", fontWeight: "bold" }}>
                                  <option value="DAY">DAY</option>
                                  <option value="NIGHT">NIGHT</option>
                                  <option value="DAWN">DAWN</option>
                                  <option value="DUSK">DUSK</option>
                                  <option value="OTHER">OTHER...</option>
                                </select>
                                {editHeadingTimeOfDay === "OTHER" && (
                                  <input type="text" value={editHeadingCustomTime} onChange={(e) => setEditHeadingCustomTime(e.target.value)}
                                    placeholder="e.g. CONTINUOUS" style={{ padding: "3px 6px", border: "2px solid #FF9800", borderRadius: "3px", fontSize: "13px", fontWeight: "bold", width: "120px" }} />
                                )}
                                <button onClick={saveHeadingEdit} style={{ backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "3px", padding: "3px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>✓ Save</button>
                                <button onClick={() => setEditingHeading(null)} style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "3px", padding: "3px 10px", cursor: "pointer", fontSize: "12px" }}>✕</button>
                              </div>
                            ) : (
                              <span onDoubleClick={() => startEditingHeading(location)} style={{ cursor: "pointer", padding: "2px 4px", borderRadius: "3px" }}
                                onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
                                onMouseOut={(e) => (e.target.style.backgroundColor = "transparent")}
                                title="Double-click to edit heading">
                                {location.intExt} {location.subLocation}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                            <strong>Assigned Scenes</strong> ({location.scenes.length})
                            {location.scenes.length === 0 && <span style={{ color: "#999", fontStyle: "italic", marginLeft: "6px" }}>No scenes assigned</span>}
                          </div>

                          {location.scenes.length > 0 && (() => {
                            const groups = {};
                            location.scenes.forEach((sceneNum) => {
                              const tod = getSceneTimeOfDay(sceneNum);
                              if (!groups[tod]) groups[tod] = [];
                              groups[tod].push(sceneNum);
                            });

                            return TIME_OF_DAY_ORDER.filter((tod) => groups[tod]?.length > 0).map((tod) => {
                              const todScenes = groups[tod] || [];
                              const collapsed = isTodCollapsed(location.id, tod);
                              const labelColor = tod === "UNASSIGNED" ? "#FF9800" : tod === "DAY" ? "#F57F17" : tod === "NIGHT" ? "#283593" : tod === "DAWN" ? "#E91E63" : tod === "DUSK" ? "#6A1B9A" : "#555";

                              return (
                                <div key={tod} style={{ marginBottom: "6px", border: `1px solid ${labelColor}22`, borderRadius: "4px", overflow: "hidden" }}>
                                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px", padding: "4px 8px", backgroundColor: `${labelColor}18`, borderBottom: collapsed ? "none" : `1px solid ${labelColor}33` }}>
                                    <span onClick={() => toggleTod(location.id, tod)} style={{ fontWeight: "bold", fontSize: "11px", color: labelColor, cursor: "pointer", whiteSpace: "nowrap", marginRight: "4px", flexShrink: 0 }}>
                                      {collapsed ? "▶" : "▼"}{" "}
                                      {tod === "UNASSIGNED" ? "⚠ Unassigned Time of Day" : (() => {
                                        const sample = (mainScenes || scenes).find((s) => String(s.sceneNumber) === String(todScenes[0]));
                                        const intExt = sample?.metadata?.intExt || location.intExt || "";
                                        const loc = sample?.metadata?.location || location.subLocation || "";
                                        return `${intExt} ${loc} - ${tod}`.trim();
                                      })()}
                                    </span>
                                    {todScenes.sort((a, b) => parseFloat(String(a).replace(/[^0-9.]/g, "")) - parseFloat(String(b).replace(/[^0-9.]/g, ""))).map((sceneNum) => {
                                      const scene = scenes.find((s) => s.sceneNumber == sceneNum);
                                      const status = scene?.status || "Not Scheduled";
                                      const statusColor = status === "Scheduled" ? "#2196F3" : status === "Shot" ? "#4CAF50" : status === "Pickups" ? "#FFC107" : status === "Reshoot" ? "#F44336" : "#e0e0e0";
                                      const textColor = status === "Pickups" ? "black" : status === "Not Scheduled" ? "#555" : "white";
                                      return (
                                        <span key={sceneNum}
                                          onClick={(e) => { e.stopPropagation(); if (tod === "UNASSIGNED") setTodAssignPopup({ sceneNumber: sceneNum, locationId: location.id }); }}
                                          style={{ backgroundColor: statusColor, color: textColor, padding: "1px 5px", borderRadius: "3px", fontSize: "10px", fontWeight: "bold", cursor: tod === "UNASSIGNED" ? "pointer" : "default", border: `1px solid ${statusColor === "#e0e0e0" ? "#ccc" : statusColor}` }}
                                          title={tod === "UNASSIGNED" ? `Scene ${sceneNum} — click to assign time of day` : `Scene ${sceneNum} — ${status}`}>
                                          {sceneNum}{tod === "UNASSIGNED" && <span style={{ marginLeft: "2px", fontSize: "8px", color: "#FF9800" }}>▾</span>}
                                        </span>
                                      );
                                    })}
                                    <span onClick={() => toggleTod(location.id, tod)} style={{ marginLeft: "auto", color: labelColor, cursor: "pointer", fontSize: "10px", flexShrink: 0 }}>{collapsed ? "▼" : "▲"}</span>
                                  </div>

                                  {!collapsed && (
                                    <div style={{ padding: "6px 8px", backgroundColor: "#fafafa" }}>
                                      <div style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}>Click to manage scene:</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", lineHeight: "1.8" }}>
                                        {allSceneNumbers.map((sceneNum) => {
                                          const isAssigned = todScenes.some((s) => String(s) === String(sceneNum));
                                          const isAssignedElsewhere = !isAssigned && location.scenes.some((s) => String(s) === String(sceneNum));
                                          const isRecentlyRemoved = !isAssigned && !isAssignedElsewhere && (recentlyRemovedScenes[location.id] || new Set()).has(String(sceneNum));
                                          return (
                                            <span key={sceneNum}
                                              style={{ backgroundColor: isAssigned ? "#4CAF50" : isAssignedElsewhere ? "#90CAF9" : isRecentlyRemoved ? "#FFF176" : "#f0f0f0", color: isAssigned ? "white" : isAssignedElsewhere ? "#1565C0" : isRecentlyRemoved ? "#333" : "#666", padding: "2px 6px", borderRadius: "3px", marginBottom: "2px", fontSize: "11px", fontWeight: "bold", cursor: isAssignedElsewhere ? "not-allowed" : "pointer", border: isAssigned ? "1px solid #4CAF50" : isAssignedElsewhere ? "1px solid #90CAF9" : "1px solid #ddd", display: "inline-block", opacity: isAssignedElsewhere ? 0.5 : 1 }}
                                              onClick={(e) => { e.stopPropagation(); if (isAssignedElsewhere) return; setSceneBadgeReassignTarget(""); setShowSceneBadgePopup({ sceneNumber: sceneNum, locationId: location.id, parentLocation: location.parentLocation, currentTod: tod, isAssigned }); }}>
                                              {sceneNum}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}

                          {todAssignPopup && (
                            <>
                              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 2000 }} onClick={() => setTodAssignPopup(null)} />
                              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", border: "2px solid #FF9800", borderRadius: "8px", padding: "20px", zIndex: 2001, minWidth: "260px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                                <h4 style={{ margin: "0 0 12px", color: "#FF9800" }}>Assign Time of Day — Scene {todAssignPopup.sceneNumber}</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {["DAWN", "DAY", "DUSK", "NIGHT", "OTHER"].map((tod) => (
                                    <button key={tod} onClick={() => { if (onUpdateSceneTimeOfDay) onUpdateSceneTimeOfDay(todAssignPopup.sceneNumber, tod); setTodAssignPopup(null); }}
                                      style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", backgroundColor: tod === "DAY" ? "#FFF9C4" : tod === "NIGHT" ? "#E8EAF6" : tod === "DAWN" ? "#FCE4EC" : tod === "DUSK" ? "#EDE7F6" : "#f5f5f5", fontWeight: "bold", fontSize: "13px", textAlign: "left" }}>{tod}</button>
                                  ))}
                                  <button onClick={() => setTodAssignPopup(null)} style={{ padding: "6px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", backgroundColor: "#f5f5f5", marginTop: "4px" }}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}

                          <button onClick={(e) => { e.stopPropagation(); startReassignSubLocation(location.id, location.subLocation); }}
                            style={{ backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "3px", padding: "2px 6px", cursor: "pointer", fontSize: "10px", marginBottom: "8px" }}>
                            Reassign Sub-Location
                          </button>

                          <select value={location.actualLocationId || ""} onChange={(e) => assignActualLocation(location.id, e.target.value)}
                            style={{ width: "100%", padding: "4px", border: "1px solid #ccc", borderRadius: "3px", fontSize: "11px" }}>
                            <option value="">Override group assignment...</option>
                            {actualLocations.map((actual) => (<option key={actual.id} value={actual.id}>{actual.name}</option>))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {unassignedScenes.length > 0 && (
              <div style={{ marginTop: "15px", border: "2px solid #FF9800", borderRadius: "6px", padding: "12px", backgroundColor: "#fff8e1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "14px" }}>⚠️ Unassigned Scenes ({unassignedScenes.length})</strong>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setUnassignedSceneIndex(0); setUnassignedScenesPopupScenes(unassignedScenes.map((s) => s.sceneNumber)); }}
                      style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}>📄 Scenes</button>
                    <button onClick={() => { setNewLocationHeading(""); setShowAddLocationDialog(true); }}
                      style={{ backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}>+ Add Location</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {unassignedScenes.map((scene) => (
                    <span key={scene.sceneNumber} onClick={() => { setUnassignedReassignTarget(""); setUnassignedReassignScene(scene.sceneNumber); }}
                      style={{ backgroundColor: "#FF9800", color: "white", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", border: "1px solid #F57C00" }}>
                      {scene.sceneNumber}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Actual Locations */}
        <div style={{ flex: "1", paddingLeft: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3>Actual Locations ({actualLocations.length})</h3>
            <button onClick={() => setShowAddActualLocation(true)}
              style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              + Add Location
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "30px" }}>
            {actualLocations.map((location) => (
              <div key={location.id} style={{ border: "1px solid #ddd", margin: "10px 0", padding: "15px", backgroundColor: "#fff", borderRadius: "4px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <h4 style={{ margin: 0 }}>{location.name}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ backgroundColor: "#2196F3", color: "white", padding: "2px 8px", borderRadius: "12px", fontSize: "10px" }}>{location.category}</span>
                    <button onClick={() => { setEditingLocation(location); setShowEditLocationDialog(true); }}
                      style={{ backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "3px", padding: "4px 8px", cursor: "pointer", fontSize: "10px" }}>Edit</button>
                    <button onClick={() => deleteActualLocation(location.id)}
                      style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "3px", padding: "4px 8px", cursor: "pointer", fontSize: "10px" }}>Delete</button>
                  </div>
                </div>
                <p style={{ margin: "5px 0", fontSize: "14px" }}>
                  <strong>Address:</strong> {location.address}
                  {(location.city || location.state || location.zipCode) && <br />}
                  {location.city && `${location.city}, `}{location.state && `${location.state} `}{location.zipCode && location.zipCode}
                </p>
                {location.contactPerson && <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Contact:</strong> {location.contactPerson} {location.phone && `- ${location.phone}`}</p>}
                {location.parkingInfo && <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Parking:</strong> {location.parkingInfo}</p>}
                {location.permitRequired && <p style={{ margin: "5px 0", fontSize: "12px", color: "#f44336" }}>⚠️ Permit Required</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unassigned Scene Reassign Popup */}
      {unassignedReassignScene && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setUnassignedReassignScene(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "24px", zIndex: 1000, minWidth: "360px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginTop: 0 }}>Assign Scene {unassignedReassignScene}</h3>
            <p style={{ fontSize: "13px", color: "#666" }}>{scenes.find((s) => String(s.sceneNumber) === String(unassignedReassignScene))?.heading}</p>
            <div style={{ marginBottom: "12px" }}>
              <button onClick={() => { setLocationSceneIndex(0); setShowLocationScenesPopup([unassignedReassignScene]); }}
                style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>📄 View Scene</button>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "bold" }}>Assign to location:</label>
              <select value={unassignedReassignTarget} onChange={(e) => setUnassignedReassignTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px" }}>
                <option value="">Select a location...</option>
                {sortedGroupEntries.flatMap(([parent, locs]) => [...locs].sort((a, b) => {
                  const aMin = Math.min(...(a.scenes.length ? a.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999) : [9999]));
                  const bMin = Math.min(...(b.scenes.length ? b.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999) : [9999]));
                  return aMin - bMin;
                }).map((loc) => (<option key={loc.id} value={loc.id}>{loc.intExt} {loc.subLocation} ({loc.parentLocation})</option>)))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setNewLocationHeading(scenes.find((s) => String(s.sceneNumber) === String(unassignedReassignScene))?.heading || ""); setShowAddLocationDialog(true); }}
                style={{ backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>+ New Location</button>
              <button onClick={() => setUnassignedReassignScene(null)} style={{ backgroundColor: "#ccc", color: "#333", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button onClick={() => { if (unassignedReassignTarget) { assignUnassignedScene(unassignedReassignScene, unassignedReassignTarget); setUnassignedReassignScene(null); setUnassignedReassignTarget(""); } }}
                disabled={!unassignedReassignTarget}
                style={{ backgroundColor: unassignedReassignTarget ? "#2196F3" : "#ccc", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: unassignedReassignTarget ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "bold" }}>Assign</button>
            </div>
          </div>
        </>
      )}

      {/* Scene Badge Manage Popup */}
      {showSceneBadgePopup && (() => {
        const { sceneNumber, locationId, parentLocation } = showSceneBadgePopup;
        const scene = scenes.find((s) => String(s.sceneNumber) === String(sceneNumber));
        const currentLoc = scriptLocations.find((l) => l.id === locationId);
        return (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowSceneBadgePopup(null)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "24px", zIndex: 1000, minWidth: "380px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <h3 style={{ marginTop: 0 }}>{showSceneBadgePopup?.isAssigned ? "Manage" : "Assign"} Scene {sceneNumber}</h3>
              <p style={{ fontSize: "13px", color: "#555", marginBottom: "4px" }}><strong>{scene?.heading}</strong></p>
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>Currently in: {currentLoc?.intExt} {currentLoc?.subLocation} ({parentLocation})</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button onClick={() => { setLocationSceneIndex(0); setShowLocationScenesPopup([sceneNumber]); setShowSceneBadgePopup(null); }}
                  style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>📄 View Script</button>
              </div>
              {!showSceneBadgePopup?.isAssigned && (
                <div style={{ marginBottom: "16px" }}>
                  <button onClick={() => {
                    const { sceneNumber, locationId, currentTod } = showSceneBadgePopup;
                    if (!currentLoc?.scenes?.some((s) => String(s) === String(sceneNumber))) toggleSceneAssignment(locationId, sceneNumber);
                    if (currentTod && currentTod !== "UNASSIGNED" && onUpdateSceneTimeOfDay) onUpdateSceneTimeOfDay(sceneNumber, currentTod);
                    setShowSceneBadgePopup(null);
                  }} style={{ backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%" }}>
                    ✓ Assign to {currentLoc?.intExt} {currentLoc?.subLocation} as {showSceneBadgePopup?.currentTod}
                  </button>
                </div>
              )}
              {showSceneBadgePopup?.isAssigned && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "bold" }}>Reassign Time of Day:</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {["DAWN", "DAY", "DUSK", "NIGHT", "OTHER"].map((t) => (
                      <button key={t} onClick={() => { if (onUpdateSceneTimeOfDay) onUpdateSceneTimeOfDay(sceneNumber, t); setShowSceneBadgePopup(null); }}
                        style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", backgroundColor: t === showSceneBadgePopup?.currentTod ? "#2196F3" : "#f5f5f5", color: t === showSceneBadgePopup?.currentTod ? "white" : "#333" }}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "bold" }}>Reassign to different location:</label>
                <select value={sceneBadgeReassignTarget} onChange={(e) => setSceneBadgeReassignTarget(e.target.value)}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px" }}>
                  <option value="">Select a location...</option>
                  {sortedGroupEntries.flatMap(([parent, locs]) => [...locs].sort((a, b) => {
                    const aMin = Math.min(...(a.scenes.length ? a.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999) : [9999]));
                    const bMin = Math.min(...(b.scenes.length ? b.scenes.map((s) => parseFloat(String(s).replace(/[^0-9.]/g, "")) || 9999) : [9999]));
                    return aMin - bMin;
                  }).map((loc) => (<option key={loc.id} value={loc.id}>{loc.intExt} {loc.subLocation} ({loc.parentLocation})</option>)))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
                <button onClick={() => { toggleSceneAssignment(locationId, sceneNumber); setShowSceneBadgePopup(null); }}
                  style={{ backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>Remove from Location</button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setShowSceneBadgePopup(null)} style={{ backgroundColor: "#ccc", color: "#333", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
                  <button onClick={() => { if (sceneBadgeReassignTarget) { reassignSceneToLocation(sceneNumber, locationId, sceneBadgeReassignTarget); setShowSceneBadgePopup(null); setSceneBadgeReassignTarget(""); } }}
                    disabled={!sceneBadgeReassignTarget}
                    style={{ backgroundColor: sceneBadgeReassignTarget ? "#FF9800" : "#ccc", color: "white", border: "none", borderRadius: "4px", padding: "8px 14px", cursor: sceneBadgeReassignTarget ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "bold" }}>Reassign</button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Add Location Dialog */}
      {showAddLocationDialog && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowAddLocationDialog(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "24px", zIndex: 1000, minWidth: "420px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginTop: 0 }}>Add New Location</h3>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "bold" }}>Full Scene Heading:</label>
              <input type="text" value={newLocationHeading} onChange={(e) => setNewLocationHeading(e.target.value)}
                placeholder="e.g. EXT. FARMHOUSE - DAY"
                style={{ width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                onKeyDown={(e) => { if (e.key === "Enter") addManualLocation(newLocationHeading); }} autoFocus />
              <p style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>Include INT./EXT. and time of day (DAY/NIGHT/DAWN/DUSK).</p>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowAddLocationDialog(false); setNewLocationHeading(""); }}
                style={{ backgroundColor: "#ccc", color: "#333", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button onClick={() => addManualLocation(newLocationHeading)} disabled={!newLocationHeading.trim()}
                style={{ backgroundColor: newLocationHeading.trim() ? "#4CAF50" : "#ccc", color: "white", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: newLocationHeading.trim() ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "bold" }}>Add Location</button>
            </div>
          </div>
        </>
      )}

      {/* Reassign Parent Dialog */}
      {showReassignDialog && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowReassignDialog(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Reassign Parent Location</h3>
            <p>Reassign "{showReassignDialog}" and all its sub-locations to another parent group:</p>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Select target parent location:</label>
              <select value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }}>
                <option value="">Select parent location...</option>
                {sortedGroupEntries.map(([parent]) => parent).filter((parent) => parent !== showReassignDialog).map((parent) => (<option key={parent} value={parent}>{parent}</option>))}
              </select>
              <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Or create new parent name:</label>
                <input type="text" value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} placeholder="Enter new parent location name"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={confirmReassignParent} disabled={!reassignTarget}
                style={{ backgroundColor: reassignTarget ? "#FF9800" : "#ccc", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: reassignTarget ? "pointer" : "not-allowed" }}>Reassign</button>
              <button onClick={() => setShowReassignDialog(null)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Reassign Sub-Location Dialog */}
      {showReassignSubDialog && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={cancelReassignSubLocation} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Reassign Sub-Location</h3>
            <p>Reassign or merge "{showReassignSubDialog.subLocationName}" from "{showReassignSubDialog.parentLocation}":</p>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Merge with sub-location in same parent:</label>
              <select value={reassignSubTarget} onChange={(e) => setReassignSubTarget(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "15px" }}>
                <option value="">Select sub-location to merge with...</option>
                {groupedLocations[showReassignSubDialog?.parentLocation]?.filter((loc) => loc.id !== showReassignSubDialog?.locationId).map((location) => (
                  <option key={location.id} value={`merge:${location.id}`}>Merge with: {location.subLocation}</option>
                ))}
              </select>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Or move to different parent location:</label>
              <select value={reassignSubTarget} onChange={(e) => setReassignSubTarget(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }}>
                <option value="">Select parent location...</option>
                {sortedGroupEntries.map(([parent]) => parent).filter((parent) => parent !== showReassignSubDialog?.parentLocation).map((parent) => (
                  <option key={parent} value={`parent:${parent}`}>Move to: {parent}</option>
                ))}
              </select>
              <div style={{ marginTop: "10px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Or create new parent name:</label>
                <input type="text" value={reassignSubTarget} onChange={(e) => setReassignSubTarget(e.target.value)} placeholder="Enter new parent location name"
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={confirmReassignSubLocation} disabled={!reassignSubTarget}
                style={{ backgroundColor: reassignSubTarget ? "#FF9800" : "#ccc", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: reassignSubTarget ? "pointer" : "not-allowed" }}>Reassign</button>
              <button onClick={cancelReassignSubLocation} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Add Actual Location Modal */}
      {showAddActualLocation && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowAddActualLocation(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "500px", maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0 }}>Add New Actual Location</h3>
            {[["Location Name:", "name"], ["Street Address:", "address"], ["Contact Person:", "contactPerson"], ["Phone:", "phone"], ["Parking Info:", "parkingInfo"]].map(([label, field]) => (
              <div key={field} style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>{label}</label>
                <input type="text" value={newActualLocation[field]} onChange={(e) => setNewActualLocation((prev) => ({ ...prev, [field]: e.target.value }))}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              {[["City:", "city", 2], ["State:", "state", 1], ["Zip Code:", "zipCode", 1]].map(([label, field, flex]) => (
                <div key={field} style={{ flex: `${flex}`, minWidth: 0 }}>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>{label}</label>
                  <input type="text" value={newActualLocation[field]} onChange={(e) => setNewActualLocation((prev) => ({ ...prev, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Category:</label>
              <select value={newActualLocation.category} onChange={(e) => setNewActualLocation((prev) => ({ ...prev, category: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }}>
                {actualLocationCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" checked={newActualLocation.permitRequired} onChange={(e) => setNewActualLocation((prev) => ({ ...prev, permitRequired: e.target.checked }))} />
                <span style={{ fontWeight: "bold" }}>Permit Required</span>
              </label>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Notes:</label>
              <textarea value={newActualLocation.notes} onChange={(e) => setNewActualLocation((prev) => ({ ...prev, notes: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px", minHeight: "60px" }} />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddActualLocation(false)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
              <button onClick={addActualLocation} style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add Location</button>
            </div>
          </div>
        </>
      )}

      {/* Edit Actual Location Modal */}
      {showEditLocationDialog && editingLocation && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => { setShowEditLocationDialog(false); setEditingLocation(null); }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "30px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "500px", maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0 }}>Edit Location: {editingLocation.name}</h3>
            {[["Location Name:", "name"], ["Street Address:", "address"], ["Contact Person:", "contactPerson"], ["Phone:", "phone"], ["Parking Info:", "parkingInfo"]].map(([label, field]) => (
              <div key={field} style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>{label}</label>
                <input type="text" value={editingLocation[field] || ""} onChange={(e) => setEditingLocation((prev) => ({ ...prev, [field]: e.target.value }))}
                  style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }} />
              </div>
            ))}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Category:</label>
              <select value={editingLocation.category} onChange={(e) => setEditingLocation((prev) => ({ ...prev, category: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px" }}>
                {actualLocationCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" checked={editingLocation.permitRequired} onChange={(e) => setEditingLocation((prev) => ({ ...prev, permitRequired: e.target.checked }))} />
                <span style={{ fontWeight: "bold" }}>Permit Required</span>
              </label>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Notes:</label>
              <textarea value={editingLocation.notes || ""} onChange={(e) => setEditingLocation((prev) => ({ ...prev, notes: e.target.value }))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px", minHeight: "60px" }} />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowEditLocationDialog(false); setEditingLocation(null); }} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { editActualLocation(editingLocation.id, editingLocation); setShowEditLocationDialog(false); setEditingLocation(null); }}
                style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Save Changes</button>
            </div>
          </div>
        </>
      )}

      {/* Unassigned Scenes Script Viewer */}
      {unassignedScenesPopupScenes && (() => {
        const assignedScenes = scenes.filter((s) => unassignedScenesPopupScenes.some((n) => String(n) === String(s.sceneNumber)));
        if (assignedScenes.length === 0) return null;
        const activeUnassigned = unassignedFullMode ? scenes[unassignedFullIndex] || assignedScenes[unassignedSceneIndex] : assignedScenes[unassignedSceneIndex];
        const currentScene = activeUnassigned;
        return (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => { setUnassignedScenesPopupScenes(null); setUnassignedFullMode(false); }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", border: "2px solid #FF9800", borderRadius: "8px", padding: "0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "900px", maxWidth: "90vw", height: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "15px 20px", backgroundColor: "#FF9800", color: "white", borderRadius: "8px 8px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => unassignedFullMode ? setUnassignedFullIndex(Math.max(0, unassignedFullIndex - 1)) : setUnassignedSceneIndex(Math.max(0, unassignedSceneIndex - 1))}
                    disabled={unassignedFullMode ? unassignedFullIndex === 0 : unassignedSceneIndex === 0}
                    style={{ backgroundColor: (unassignedFullMode ? unassignedFullIndex === 0 : unassignedSceneIndex === 0) ? "#ccc" : "white", color: (unassignedFullMode ? unassignedFullIndex === 0 : unassignedSceneIndex === 0) ? "#666" : "#FF9800", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>← Prev</button>
                  <div style={{ fontWeight: "bold" }}>Scene {currentScene.sceneNumber} ({unassignedFullMode ? `${unassignedFullIndex + 1} of ${scenes.length}` : `${unassignedSceneIndex + 1} of ${assignedScenes.length}`})</div>
                  <button onClick={() => unassignedFullMode ? setUnassignedFullIndex(Math.min(scenes.length - 1, unassignedFullIndex + 1)) : setUnassignedSceneIndex(Math.min(assignedScenes.length - 1, unassignedSceneIndex + 1))}
                    disabled={unassignedFullMode ? unassignedFullIndex === scenes.length - 1 : unassignedSceneIndex === assignedScenes.length - 1}
                    style={{ backgroundColor: (unassignedFullMode ? unassignedFullIndex === scenes.length - 1 : unassignedSceneIndex === assignedScenes.length - 1) ? "#ccc" : "white", color: (unassignedFullMode ? unassignedFullIndex === scenes.length - 1 : unassignedSceneIndex === assignedScenes.length - 1) ? "#666" : "#FF9800", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>Next →</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", userSelect: "none", color: "white" }}>
                    <input type="checkbox" checked={unassignedFullMode} onChange={(e) => { if (e.target.checked) { const fi = (scenes || []).findIndex((s) => String(s.sceneNumber) === String(currentScene.sceneNumber)); setUnassignedFullIndex(fi >= 0 ? fi : 0); } else { const curNum = scenes[unassignedFullIndex]?.sceneNumber; const fi = assignedScenes.findIndex((s) => String(s.sceneNumber) === String(curNum)); setUnassignedSceneIndex(fi >= 0 ? fi : 0); } setUnassignedFullMode(e.target.checked); }} style={{ cursor: "pointer", accentColor: "white" }} />
                    Full Script
                  </label>
                  <button onClick={() => { setUnassignedScenesPopupScenes(null); setUnassignedFullMode(false); }}
                    style={{ backgroundColor: "#f44336", color: "white", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>✕ Close</button>
                </div>
              </div>
              <div style={{ padding: "12px 20px", backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd", fontFamily: "Courier New, monospace", fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase" }}>{currentScene.heading}</div>
              <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: "white", boxSizing: "border-box", fontFamily: "Courier New, monospace" }}>
                <div style={getElementStyle("Scene Heading")}>{currentScene.heading}</div>
                <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                  {(currentScene.content || []).map((block, i) => (<div key={i} style={getElementStyle(block.type)}>{block.text}</div>))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Location Scenes Popup */}
      {showLocationScenesPopup && (() => {
        const assignedScenes = scenes.filter((s) => showLocationScenesPopup.some((n) => String(n) === String(s.sceneNumber)));
        if (assignedScenes.length === 0) {
          return (
            <>
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowLocationScenesPopup(null)} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", zIndex: 1000, minWidth: "300px" }}>
                <h3>No Scenes Found</h3>
                <button onClick={() => setShowLocationScenesPopup(null)} style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Close</button>
              </div>
            </>
          );
        }
        const activeLocationScene = locationScenesFullMode ? scenes[locationScenesFullIndex] || assignedScenes[locationSceneIndex] : assignedScenes[locationSceneIndex];
        const currentScene = activeLocationScene;
        return (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowLocationScenesPopup(null)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", border: "2px solid #2196F3", borderRadius: "8px", padding: "0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "900px", maxWidth: "90vw", height: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "15px 20px", backgroundColor: "#2196F3", color: "white", borderRadius: "8px 8px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => locationScenesFullMode ? setLocationScenesFullIndex(Math.max(0, locationScenesFullIndex - 1)) : setLocationSceneIndex(Math.max(0, locationSceneIndex - 1))}
                    disabled={locationScenesFullMode ? locationScenesFullIndex === 0 : locationSceneIndex === 0}
                    style={{ backgroundColor: (locationScenesFullMode ? locationScenesFullIndex === 0 : locationSceneIndex === 0) ? "#ccc" : "white", color: (locationScenesFullMode ? locationScenesFullIndex === 0 : locationSceneIndex === 0) ? "#666" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>← Prev</button>
                  <div style={{ fontWeight: "bold" }}>Scene {currentScene.sceneNumber} ({locationScenesFullMode ? `${locationScenesFullIndex + 1} of ${scenes.length}` : `${locationSceneIndex + 1} of ${assignedScenes.length}`})</div>
                  <button onClick={() => locationScenesFullMode ? setLocationScenesFullIndex(Math.min(scenes.length - 1, locationScenesFullIndex + 1)) : setLocationSceneIndex(Math.min(assignedScenes.length - 1, locationSceneIndex + 1))}
                    disabled={locationScenesFullMode ? locationScenesFullIndex === scenes.length - 1 : locationSceneIndex === assignedScenes.length - 1}
                    style={{ backgroundColor: (locationScenesFullMode ? locationScenesFullIndex === scenes.length - 1 : locationSceneIndex === assignedScenes.length - 1) ? "#ccc" : "white", color: (locationScenesFullMode ? locationScenesFullIndex === scenes.length - 1 : locationSceneIndex === assignedScenes.length - 1) ? "#666" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>Next →</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", userSelect: "none", color: "white" }}>
                    <input type="checkbox" checked={locationScenesFullMode} onChange={(e) => { if (e.target.checked) { const fi = (scenes || []).findIndex((s) => String(s.sceneNumber) === String(currentScene.sceneNumber)); setLocationScenesFullIndex(fi >= 0 ? fi : 0); } else { const curNum = scenes[locationScenesFullIndex]?.sceneNumber; const fi = assignedScenes.findIndex((s) => String(s.sceneNumber) === String(curNum)); setLocationSceneIndex(fi >= 0 ? fi : 0); } setLocationScenesFullMode(e.target.checked); }} style={{ cursor: "pointer", accentColor: "white" }} />
                    Full Script
                  </label>
                  <button onClick={() => { setShowLocationScenesPopup(null); setLocationScenesFullMode(false); }}
                    style={{ backgroundColor: "#f44336", color: "white", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>✕ Close</button>
                </div>
              </div>
              <div style={{ padding: "12px 20px", backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd", fontFamily: "Courier New, monospace", fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase" }}>{currentScene.heading}</div>
              <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: "white", boxSizing: "border-box", fontFamily: "Courier New, monospace" }}>
                <div style={getElementStyle("Scene Heading")}>{currentScene.heading}</div>
                <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                  {(currentScene.content || []).map((block, i) => (<div key={i} style={getElementStyle(block.type)}>{block.text}</div>))}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default LocationsModule;