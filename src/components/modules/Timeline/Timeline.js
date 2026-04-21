import React, { useState } from "react";

// Timeline Module
function TimelineModule({
  scenes,
  characters,
  castCrew,
  stripboardScenes,
  timelineData,
  setTimelineData,
  continuityElements,
  setContinuityElements,
  onSyncTimelineData,
  onSyncContinuityElements,
  onUpdateScenes,
}) {
  const [selectedTimeline, setSelectedTimeline] = React.useState("main");
  const [showAddElement, setShowAddElement] = React.useState(false);
  const [editingStoryDay, setEditingStoryDay] = React.useState(null);
  const [viewMode, setViewMode] = React.useState("timeline");
  const [selectedElement, setSelectedElement] = React.useState(null);
  const [showDayManagement, setShowDayManagement] = React.useState(false);
  const [dayAction, setDayAction] = React.useState("add"); // "add" or "remove"
  const [insertPosition, setInsertPosition] = React.useState(1);
  const [startScene, setStartScene] = React.useState("");
  const [endScene, setEndScene] = React.useState("");
  const [selectedSceneForEdit, setSelectedSceneForEdit] = React.useState(null);
  const [hasImportedData, setHasImportedData] = React.useState(false);
  const [isTimelineLocked, setIsTimelineLocked] = React.useState(false);
  const [showContinuityModal, setShowContinuityModal] = React.useState(false);
  const [editingElement, setEditingElement] = React.useState(null);
  const [elementForm, setElementForm] = React.useState({
    name: "",
    type: "injury",
    timeline: "main",
    startScene: "",
    endScene: "",
    startDay: "",
    endDay: "",
    characterId: "",
    dailyNotes: {},
  });

  // Timeline collapse state management with persistence
  const [isTimelineCollapsed, setIsTimelineCollapsed] = React.useState(() => {
    const saved = localStorage.getItem(
      `timeline-view-collapsed-${selectedTimeline}`
    );
    return saved ? JSON.parse(saved) : false;
  });

  // Persist timeline collapse state when it changes
  React.useEffect(() => {
    localStorage.setItem(
      `timeline-view-collapsed-${selectedTimeline}`,
      JSON.stringify(isTimelineCollapsed)
    );
  }, [isTimelineCollapsed, selectedTimeline]);

  // Toggle timeline collapse state
  const toggleTimelineCollapse = () => {
    setIsTimelineCollapsed((prev) => !prev);
  };

  // Get timeline scene range for collapsed view
  const getTimelineSceneRange = () => {
    const allScenes = getAllScenesInOrder();
    if (allScenes.length === 0) return { first: null, last: null };

    const sortedScenes = allScenes.sort(
      (a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber)
    );
    return {
      first: sortedScenes[0],
      last: sortedScenes[sortedScenes.length - 1],
    };
  };

  // Timeline types and element types
  const timelineTypes = [
    { value: "main", label: "Main Timeline" },
    { value: "flashback", label: "Flashbacks" },
    { value: "dream", label: "Dreams" },
    { value: "other", label: "Other" },
  ];

  const elementTypes = [
    "injury",
    "makeup",
    "costume",
    "props",
    "hair",
    "aging",
    "weather_effects",
    "vehicle_damage",
    "custom",
  ];

  // Initialize timeline data if not present - but only if truly empty, not during loading
  React.useEffect(() => {
    // Don't initialize if we're just loading data or if data already exists
    if (!timelineData || Object.keys(timelineData).length === 0) {
      // Wait a moment to see if data is being loaded from database
      const timer = setTimeout(() => {
        if (!timelineData || Object.keys(timelineData).length === 0) {
          const initialData = {
            main: { day1: { scenes: [], elements: [] } },
            flashback: {},
            dream: {},
            other: {},
          };
          setTimelineData(initialData);
          if (onSyncTimelineData) {
            onSyncTimelineData(initialData);
          }
        }
      }, 500); // Wait 500ms for database load to complete

      return () => clearTimeout(timer);
    }
  }, [timelineData, setTimelineData, onSyncTimelineData]);

  // Initialize continuity elements if not present
  React.useEffect(() => {
    if (!continuityElements) {
      setContinuityElements([]);
    }
  }, [continuityElements, setContinuityElements]);

  // Run story day detection when scenes change (but not if timeline data already exists or was imported)
  React.useEffect(() => {
    if (
      scenes &&
      scenes.length > 0 &&
      !hasImportedData &&
      (!timelineData ||
        Object.keys(timelineData).every(
          (timeline) => Object.keys(timelineData[timeline]).length === 0
        ))
    ) {
      detectStoryDays();
    }
  }, [scenes, hasImportedData]);

  // Check if timeline data was imported (has existing content)
  React.useEffect(() => {
    if (
      timelineData &&
      Object.keys(timelineData).some(
        (timeline) => Object.keys(timelineData[timeline]).length > 0
      )
    ) {
      setHasImportedData(true);
    }
  }, [timelineData]);

  // Add manual day break with popup interface
  const addManualDay = () => {
    setShowDayManagement(true);
  };

  // Get all scenes in timeline order
  const getAllScenesInOrder = () => {
    const currentData = getCurrentTimelineData();
    const storyDays = getStoryDays();
    const allScenes = [];

    storyDays.forEach((dayKey) => {
      const dayData = currentData[dayKey];
      if (dayData && dayData.scenes) {
        dayData.scenes.forEach((sceneNum) => {
          const scene = scenes.find((s) => s.sceneNumber == sceneNum);
          if (scene) allScenes.push(scene);
        });
      }
    });

    return allScenes.sort(
      (a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber)
    );
  };

  // Handle day creation
  const handleCreateDay = () => {
    createNewDay();
    setShowDayManagement(false);
    resetDayManagementForm();
  };

  // Create new empty day
  const createNewDay = () => {
    const currentData = getCurrentTimelineData();
    const storyDays = getStoryDays();
    const nextDayNumber = storyDays.length + 1;
    const newDayKey = `day${nextDayNumber}`;

    const updatedData = {
      ...timelineData,
      [selectedTimeline]: {
        ...timelineData[selectedTimeline],
        [newDayKey]: {
          scenes: [],
          elements: [],
          detectedFromScenes: [],
          manuallyCreated: true,
        },
      },
    };

    setTimelineData(updatedData);

    if (onSyncTimelineData) {
      onSyncTimelineData(updatedData);
    }

    // Day created silently
  };

  // Remove day
  const handleRemoveDay = () => {
    const storyDays = getStoryDays();
    const dayToRemove = `day${insertPosition}`;

    if (!storyDays.includes(dayToRemove)) {
      alert("Invalid day number.");
      return;
    }

    const currentData = getCurrentTimelineData();

    // Check if the day being removed has scenes
    const removedDayScenes = currentData[dayToRemove]?.scenes || [];
    if (removedDayScenes.length > 0) {
      const sceneList = removedDayScenes.join(", ");
      if (
        !confirm(
          `Day ${insertPosition} contains ${removedDayScenes.length} scene(s): ${sceneList}.\n\nThese scenes will be moved to the previous day. Continue?`
        )
      ) {
        return;
      }
    }

    const updatedDays = {};
    let dayCounter = 1;

    // Clone scenes array to avoid direct mutation
    const updatedScenes = scenes.map((scene) => ({ ...scene }));

    // Determine target day for orphaned scenes (previous day or next day)
    const removedDayNumber = parseInt(dayToRemove.replace("day", ""));
    const targetDayForOrphans =
      removedDayNumber > 1
        ? removedDayNumber - 1
        : storyDays.length > 1
        ? 2
        : 1;

    storyDays.forEach((dayKey) => {
      if (dayKey !== dayToRemove) {
        const newDayKey = `day${dayCounter}`;
        const dayNumber = parseInt(dayKey.replace("day", ""));

        // If this is the target day for orphaned scenes, merge them in
        if (dayNumber === targetDayForOrphans) {
          const existingScenes = currentData[dayKey]?.scenes || [];
          const mergedScenes = [...existingScenes, ...removedDayScenes];
          updatedDays[newDayKey] = {
            ...currentData[dayKey],
            scenes: mergedScenes,
          };

          // Update storyDay for all scenes in this merged day
          mergedScenes.forEach((sceneNumber) => {
            const sceneIndex = updatedScenes.findIndex(
              (s) => s.sceneNumber.toString() === sceneNumber.toString()
            );
            if (sceneIndex !== -1) {
              updatedScenes[sceneIndex].storyDay = dayCounter;
            }
          });
        } else {
          updatedDays[newDayKey] = currentData[dayKey];

          // Update storyDay property for all scenes in this renamed day
          if (currentData[dayKey] && currentData[dayKey].scenes) {
            currentData[dayKey].scenes.forEach((sceneNumber) => {
              const sceneIndex = updatedScenes.findIndex(
                (s) => s.sceneNumber.toString() === sceneNumber.toString()
              );
              if (sceneIndex !== -1) {
                updatedScenes[sceneIndex].storyDay = dayCounter;
              }
            });
          }
        }

        dayCounter++;
      }
    });

    const finalData = {
      ...timelineData,
      [selectedTimeline]: updatedDays,
    };

    setTimelineData(finalData);

    if (onSyncTimelineData) {
      onSyncTimelineData(finalData);
    }

    // Sync updated scenes to database
    if (onUpdateScenes) {
      onUpdateScenes(updatedScenes);
    }

    setShowDayManagement(false);
    resetDayManagementForm();
    // Day removed silently
  };

  // Reset form
  const resetDayManagementForm = () => {
    setDayAction("add");
    setInsertPosition(1);
    setStartScene("");
    setEndScene("");
  };

  // Move scene from one day to another
  const moveSceneToDay = (
    sceneNumber,
    sourceDay,
    targetDay,
    insertIndex = -1
  ) => {
    // Get current timeline data
    const currentData = getCurrentTimelineData();

    // Create completely new object structure to ensure React detects changes
    const updatedData = {};

    // Deep clone all days
    Object.keys(currentData).forEach((dayKey) => {
      updatedData[dayKey] = {
        ...currentData[dayKey],
        scenes: [...(currentData[dayKey].scenes || [])],
        elements: [...(currentData[dayKey].elements || [])],
        detectedFromScenes: [...(currentData[dayKey].detectedFromScenes || [])],
      };
    });

    // Remove scene from source day
    if (updatedData[sourceDay]) {
      updatedData[sourceDay] = {
        ...updatedData[sourceDay],
        scenes: updatedData[sourceDay].scenes.filter((s) => s !== sceneNumber),
      };
    }

    // Add scene to target day and sort by scene number
    if (updatedData[targetDay]) {
      const targetScenes = [...updatedData[targetDay].scenes];

      // Add the scene
      if (insertIndex >= 0 && insertIndex < targetScenes.length) {
        targetScenes.splice(insertIndex, 0, sceneNumber);
      } else {
        targetScenes.push(sceneNumber);
      }

      // Sort scenes numerically and alphabetically (17 → 17A → 17B → 18)
      targetScenes.sort((a, b) => {
        const aStr = a.toString();
        const bStr = b.toString();
        const numA = parseInt(aStr.replace(/[^0-9]/g, "")) || 0;
        const numB = parseInt(bStr.replace(/[^0-9]/g, "")) || 0;

        // If numbers are different, sort by number
        if (numA !== numB) {
          return numA - numB;
        }

        // If numbers are the same, sort alphabetically (17A before 17B)
        return aStr.localeCompare(bStr, undefined, { numeric: true });
      });

      updatedData[targetDay] = {
        ...updatedData[targetDay],
        scenes: targetScenes,
      };
    } else {
      updatedData[targetDay] = {
        scenes: [sceneNumber],
        elements: [],
        detectedFromScenes: [],
        manuallyCreated: true,
      };
    }

    // Clone scenes array and update the scene object's storyDay property
    const updatedScenes = scenes.map((scene) => ({ ...scene }));
    const sceneIndex = updatedScenes.findIndex(
      (s) => s.sceneNumber.toString() === sceneNumber.toString()
    );
    if (sceneIndex !== -1) {
      const targetDayNumber = parseInt(targetDay.replace("day", ""));
      updatedScenes[sceneIndex].storyDay = targetDayNumber;
    }

    // Create completely new timeline data object
    const finalData = {
      main:
        selectedTimeline === "main" ? updatedData : { ...timelineData.main },
      flashback:
        selectedTimeline === "flashback"
          ? updatedData
          : { ...timelineData.flashback },
      dream:
        selectedTimeline === "dream" ? updatedData : { ...timelineData.dream },
      other:
        selectedTimeline === "other" ? updatedData : { ...timelineData.other },
    };

    setTimelineData(finalData);

    if (onSyncTimelineData) {
      onSyncTimelineData(finalData);
    }

    // Sync updated scenes to database
    if (onUpdateScenes) {
      onUpdateScenes(updatedScenes);
    }

    console.log(
      `Scene ${sceneNumber} moved from ${sourceDay} to ${targetDay}${
        insertIndex >= 0 ? ` at position ${insertIndex}` : ""
      } - storyDay updated`
    );
  };

  // Reorder days in timeline
  const reorderDays = (sourceIndex, targetIndex) => {
    const currentData = getCurrentTimelineData();
    const storyDays = getStoryDays();

    if (sourceIndex === targetIndex) return;

    // Create new array with reordered days
    const reorderedDays = [...storyDays];
    const [movedDay] = reorderedDays.splice(sourceIndex, 1);
    reorderedDays.splice(targetIndex, 0, movedDay);

    // Rebuild timeline data with new day order
    const newTimelineData = {};
    reorderedDays.forEach((dayKey, index) => {
      const newDayKey = `day${index + 1}`;
      const newDayNumber = index + 1;

      newTimelineData[newDayKey] = {
        ...currentData[dayKey],
        reordered: true,
      };

      // Update storyDay property for all scenes in this day
      if (currentData[dayKey] && currentData[dayKey].scenes) {
        currentData[dayKey].scenes.forEach((sceneNumber) => {
          const sceneIndex = scenes.findIndex(
            (s) => s.sceneNumber.toString() === sceneNumber.toString()
          );
          if (sceneIndex !== -1) {
            scenes[sceneIndex].storyDay = newDayNumber;
          }
        });
      }
    });

    const finalData = {
      ...timelineData,
      [selectedTimeline]: newTimelineData,
    };

    setTimelineData(finalData);

    if (onSyncTimelineData) {
      onSyncTimelineData(finalData);
    }

    // Sync updated scenes to database
    if (onUpdateScenes) {
      onUpdateScenes(updatedScenes);
    }

    console.log(
      `Days reordered: moved ${movedDay} from position ${sourceIndex} to ${targetIndex}`
    );
  };

  // Reorder scenes within the same day
  const reorderSceneInDay = (sceneNumber, dayKey, sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) return;

    const currentData = getCurrentTimelineData();
    const updatedData = { ...currentData };

    if (updatedData[dayKey]) {
      const scenes = [...updatedData[dayKey].scenes];
      const [movedScene] = scenes.splice(sourceIndex, 1);
      scenes.splice(targetIndex, 0, movedScene);

      updatedData[dayKey] = {
        ...updatedData[dayKey],
        scenes: scenes,
      };

      const finalData = {
        ...timelineData,
        [selectedTimeline]: updatedData,
      };

      setTimelineData(finalData);

      if (onSyncTimelineData) {
        onSyncTimelineData(finalData);
      }

      console.log(
        `Scene ${sceneNumber} reordered in ${dayKey} from position ${sourceIndex} to ${targetIndex}`
      );
    }
  };

  // Handle scene timeline assignment
  const handleSceneTimelineChange = (
    sceneNumber,
    newTimelineType,
    newColor
  ) => {
    // Update scene object
    const sceneIndex = scenes.findIndex((s) => s.sceneNumber === sceneNumber);
    if (sceneIndex !== -1) {
      scenes[sceneIndex].timelineType = newTimelineType;
      if (newColor !== undefined) {
        scenes[sceneIndex].sceneColor = newColor;
      }
    }

    // Find which timeline currently contains this scene
    let sourceTimelineType = null;
    Object.keys(timelineData).forEach((timelineType) => {
      const timelineInfo = timelineData[timelineType];
      Object.keys(timelineInfo).forEach((dayKey) => {
        if (
          timelineInfo[dayKey].scenes &&
          timelineInfo[dayKey].scenes.includes(sceneNumber.toString())
        ) {
          sourceTimelineType = timelineType;
        }
      });
    });

    if (!sourceTimelineType) {
      console.log("Scene not found in any timeline");
      return;
    }

    if (sourceTimelineType === newTimelineType) {
      console.log("Scene already in target timeline");
      setSelectedSceneForEdit(null);
      return;
    }

    // Remove from source timeline
    const updatedSourceTimeline = { ...timelineData[sourceTimelineType] };
    Object.keys(updatedSourceTimeline).forEach((dayKey) => {
      if (updatedSourceTimeline[dayKey].scenes) {
        const remainingScenes = updatedSourceTimeline[dayKey].scenes.filter(
          (sceneNum) => sceneNum !== sceneNumber.toString()
        );

        if (remainingScenes.length > 0) {
          updatedSourceTimeline[dayKey] = {
            ...updatedSourceTimeline[dayKey],
            scenes: remainingScenes,
          };
        } else {
          // Remove empty day if no scenes left
          delete updatedSourceTimeline[dayKey];
        }
      }
    });

    // Add to new timeline in chronological order
    const updatedNewTimeline = { ...timelineData[newTimelineType] };

    // Find the correct day and position for this scene
    const targetSceneNum = parseInt(sceneNumber);
    let insertedInExistingDay = false;

    // Check existing days to find chronological position
    Object.keys(updatedNewTimeline).forEach((dayKey) => {
      if (!insertedInExistingDay && updatedNewTimeline[dayKey].scenes) {
        const dayScenes = updatedNewTimeline[dayKey].scenes
          .map((s) => parseInt(s))
          .sort((a, b) => a - b);
        const minScene = Math.min(...dayScenes);
        const maxScene = Math.max(...dayScenes);

        // If scene fits chronologically in this day
        if (targetSceneNum >= minScene && targetSceneNum <= maxScene) {
          // Insert in correct position
          const sceneNums = updatedNewTimeline[dayKey].scenes.map((s) =>
            parseInt(s)
          );
          sceneNums.push(targetSceneNum);
          sceneNums.sort((a, b) => a - b);

          updatedNewTimeline[dayKey] = {
            ...updatedNewTimeline[dayKey],
            scenes: sceneNums.map((s) => s.toString()),
          };
          insertedInExistingDay = true;
        }
      }
    });

    // If not inserted in existing day, create new day or add to appropriate day
    if (!insertedInExistingDay) {
      const newTimelineKey = "day1";
      if (!updatedNewTimeline[newTimelineKey]) {
        updatedNewTimeline[newTimelineKey] = { scenes: [], elements: [] };
      }

      // Add to day1 and sort all scenes
      const existingScenes = updatedNewTimeline[newTimelineKey].scenes.map(
        (s) => parseInt(s)
      );
      existingScenes.push(targetSceneNum);
      existingScenes.sort((a, b) => a - b);

      updatedNewTimeline[newTimelineKey] = {
        ...updatedNewTimeline[newTimelineKey],
        scenes: existingScenes.map((s) => s.toString()),
      };
    }

    // Update timeline data
    const finalData = {
      ...timelineData,
      [sourceTimelineType]: updatedSourceTimeline,
      [newTimelineType]: updatedNewTimeline,
    };

    setTimelineData(finalData);

    if (onSyncTimelineData) {
      onSyncTimelineData(finalData);
    }

    setSelectedSceneForEdit(null);
    console.log(
      `Scene ${sceneNumber} moved from ${sourceTimelineType} to ${newTimelineType} timeline`
    );
  };

  // Get story days for current timeline
  const getCurrentTimelineData = () => {
    return timelineData?.[selectedTimeline] || {};
  };

  const getStoryDays = () => {
    const currentData = getCurrentTimelineData();
    return Object.keys(currentData).sort((a, b) => {
      const dayA = parseInt(a.replace("day", ""));
      const dayB = parseInt(b.replace("day", ""));
      return dayA - dayB;
    });
  };

  // Get scenes for a specific story day
  const getScenesForDay = (storyDay) => {
    const currentData = getCurrentTimelineData();
    const dayData = currentData[storyDay];
    if (!dayData || !dayData.scenes) return [];

    return dayData.scenes
      .map((sceneNumber) =>
        scenes.find((scene) => scene.sceneNumber === sceneNumber)
      )
      .filter(Boolean);
  };

  // Get continuity elements for current timeline
  const getCurrentElements = () => {
    if (!continuityElements) return [];
    return continuityElements.filter(
      (element) => element.timeline === selectedTimeline
    );
  };

  // These functions are no longer needed - positioning calculated inline

  const getElementColor = (type) => {
    const colors = {
      injury: "#F44336",
      makeup: "#E91E63",
      costume: "#9C27B0",
      props: "#673AB7",
      hair: "#3F51B5",
      aging: "#2196F3",
      weather_effects: "#03A9F4",
      vehicle_damage: "#00BCD4",
      custom: "#009688",
    };
    return colors[type] || "#757575";
  };

  // Get scene background color
  const getSceneColor = (sceneColor) => {
    const colors = {
      red: "#ffebee",
      blue: "#e3f2fd",
      green: "#e8f5e8",
      yellow: "#fffde7",
      purple: "#f3e5f5",
    };
    return colors[sceneColor] || "#f8f8f8";
  };

  // Story day detection algorithm
  const detectStoryDays = () => {
    if (!scenes || scenes.length === 0) return;

    let currentStoryDay = 1;
    let currentTimelineType = "main";
    let lastDefinitiveTime = null;
    const updatedTimelineData = {
      main: {},
      flashback: {},
      dream: {},
      other: {},
    };

    // Create updatedScenes array to avoid mutation
    const updatedScenes = scenes.map((scene, index) => {
      const timeOfDay = scene.metadata?.timeOfDay;
      let sceneStoryDay = currentStoryDay;
      let confidence = "medium";

      // Story day progression logic for main timeline
      if (currentTimelineType === "main") {
        if (timeOfDay === "DAY" || timeOfDay === "DAWN") {
          if (lastDefinitiveTime === "NIGHT" || lastDefinitiveTime === "DUSK") {
            currentStoryDay++;
            sceneStoryDay = currentStoryDay;
            confidence = "high";
          } else {
            sceneStoryDay = currentStoryDay;
            confidence = "high";
          }
          lastDefinitiveTime = timeOfDay;
        } else if (timeOfDay === "NIGHT" || timeOfDay === "DUSK") {
          sceneStoryDay = currentStoryDay;
          lastDefinitiveTime = timeOfDay;
          confidence = "high";
        } else if (timeOfDay === "" || !timeOfDay) {
          const nextDefinitiveScene = findNextDefinitiveTime(index);
          if (nextDefinitiveScene) {
            if (
              nextDefinitiveScene.timeOfDay === "DAY" ||
              nextDefinitiveScene.timeOfDay === "DAWN"
            ) {
              if (
                lastDefinitiveTime === "NIGHT" ||
                lastDefinitiveTime === "DUSK"
              ) {
                currentStoryDay++;
                sceneStoryDay = currentStoryDay;
              } else {
                sceneStoryDay = currentStoryDay;
              }
            } else {
              sceneStoryDay = currentStoryDay;
            }
            confidence = "medium";
          } else {
            sceneStoryDay = currentStoryDay;
            confidence = "low";
          }
        }
      }

      // Add scene to timeline data
      const dayKey = `day${sceneStoryDay}`;
      if (!updatedTimelineData[currentTimelineType][dayKey]) {
        updatedTimelineData[currentTimelineType][dayKey] = {
          scenes: [],
          elements: [],
          detectedFromScenes: [],
        };
      }

      updatedTimelineData[currentTimelineType][dayKey].scenes.push(
        scene.sceneNumber
      );

      if (confidence === "high") {
        updatedTimelineData[currentTimelineType][
          dayKey
        ].detectedFromScenes.push(scene.sceneNumber);
      }

      // Return updated scene object with storyDay property
      return {
        ...scene,
        storyDay: sceneStoryDay,
        timelineType: currentTimelineType,
        detectionConfidence: confidence,
      };
    });

    setTimelineData(updatedTimelineData);

    if (onSyncTimelineData) {
      onSyncTimelineData(updatedTimelineData);
    }

    // Sync updated scenes to database with storyDay properties
    if (onUpdateScenes) {
      onUpdateScenes(updatedScenes);
    }

    console.log("Story days detected:", updatedTimelineData);
    console.log(
      "Scenes updated with storyDay properties:",
      updatedScenes.length
    );
  };

  // Helper function to find next scene with definitive time
  const findNextDefinitiveTime = (startIndex) => {
    for (let i = startIndex + 1; i < scenes.length; i++) {
      const timeOfDay = scenes[i].metadata?.timeOfDay;
      if (
        timeOfDay === "DAY" ||
        timeOfDay === "DAWN" ||
        timeOfDay === "NIGHT" ||
        timeOfDay === "DUSK"
      ) {
        return { timeOfDay, sceneIndex: i };
      }
    }
    return null;
  };

  // Open continuity element modal
  const addContinuityElement = () => {
    setEditingElement(null);
    setElementForm({
      name: "",
      type: "injury",
      timeline: selectedTimeline,
      startScene: "",
      endScene: "",
      startDay: "",
      endDay: "",
      characterId: "",
      dailyNotes: {},
    });
    setShowContinuityModal(true);
  };

  // Edit existing continuity element
  const editContinuityElement = (element) => {
    setEditingElement(element);

    // Use saved scene numbers if they exist, otherwise reconstruct from days
    let startSceneNumber = element.startScene || "";
    let endSceneNumber = element.endScene || "";

    // If no saved scene numbers, reconstruct from day numbers (backward compatibility)
    if (!startSceneNumber || !endSceneNumber) {
      const startDayScenes = scenes.filter(
        (s) =>
          s.storyDay === element.startDay &&
          (s.timelineType === element.timeline ||
            (!s.timelineType && element.timeline === "main"))
      );
      const endDayScenes = scenes.filter(
        (s) =>
          s.storyDay === element.endDay &&
          (s.timelineType === element.timeline ||
            (!s.timelineType && element.timeline === "main"))
      );

      const sortedStartScenes = startDayScenes.sort(
        (a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber)
      );
      const sortedEndScenes = endDayScenes.sort(
        (a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber)
      );

      startSceneNumber = sortedStartScenes[0]?.sceneNumber.toString() || "";
      endSceneNumber =
        sortedEndScenes[sortedEndScenes.length - 1]?.sceneNumber.toString() ||
        "";
    }

    setElementForm({
      name: element.name,
      type: element.type,
      timeline: element.timeline,
      startScene: startSceneNumber,
      endScene: endSceneNumber,
      startDay: element.startDay ? element.startDay.toString() : "",
      endDay: element.endDay ? element.endDay.toString() : "",
      characterId: element.characterId || "",
      dailyNotes: element.dailyTracking || {},
    });
    setShowContinuityModal(true);
  };

  // Save continuity element
  const saveContinuityElement = () => {
    if (!elementForm.name || !elementForm.startScene || !elementForm.endScene) {
      alert("Please fill in name, start scene, and end scene.");
      return;
    }

    // Validate that we have day numbers
    if (!elementForm.startDay || !elementForm.endDay) {
      alert(
        "Error: Selected scenes don't have story day assignments. Please run 'Analyze Script' first in the Timeline module, then try again."
      );
      return;
    }

    const startDay = parseInt(elementForm.startDay);
    const endDay = parseInt(elementForm.endDay);

    if (isNaN(startDay) || isNaN(endDay)) {
      alert(
        "Error: Invalid day numbers. Please select different scenes or re-run 'Analyze Script'."
      );
      return;
    }

    if (startDay > endDay) {
      alert("Start day must be before or equal to end day.");
      return;
    }

    // Generate daily tracking entries
    const dailyTracking = {};
    for (let day = startDay; day <= endDay; day++) {
      const dayKey = `day${day}`;
      dailyTracking[dayKey] = elementForm.dailyNotes[dayKey] || {
        status: "",
        notes: "",
      };
    }

    const elementData = {
      id: editingElement ? editingElement.id : `element_${Date.now()}`,
      name: elementForm.name,
      type: elementForm.type,
      timeline: elementForm.timeline,
      startDay: startDay,
      endDay: endDay,
      startScene: elementForm.startScene, // Save the actual scene numbers
      endScene: elementForm.endScene,
      characterId: elementForm.characterId,
      dailyTracking: dailyTracking,
    };

    let updatedElements;
    if (editingElement) {
      // Update existing element
      updatedElements = continuityElements.map((el) =>
        el.id === editingElement.id ? elementData : el
      );
    } else {
      // Add new element
      updatedElements = [...(continuityElements || []), elementData];
    }

    setContinuityElements(updatedElements);

    if (onSyncContinuityElements) {
      onSyncContinuityElements(updatedElements);
    }

    setShowContinuityModal(false);
  };

  // Delete continuity element
  const deleteContinuityElement = (elementId) => {
    if (confirm("Are you sure you want to delete this continuity element?")) {
      const updatedElements = continuityElements.filter(
        (el) => el.id !== elementId
      );
      setContinuityElements(updatedElements);

      if (onSyncContinuityElements) {
        onSyncContinuityElements(updatedElements);
      }

      setShowContinuityModal(false);
    }
  };

  // Get available scenes for dropdowns
  const getAvailableScenes = () => {
    return (scenes || [])
      .filter(
        (scene) =>
          scene.timelineType === elementForm.timeline ||
          (!scene.timelineType && elementForm.timeline === "main")
      )
      .sort((a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber));
  };

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 40px)",
        boxSizing: "border-box",
        position: "relative",
        backgroundColor: "#f9f9f9",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "white",
          borderBottom: "1px solid #ddd",
          padding: "15px 20px",
          zIndex: 100,
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
          <h2 style={{ margin: 0 }}>Timeline</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => {
                if (scenes && scenes.length > 0) {
                  detectStoryDays();
                  setHasImportedData(false); // Reset the imported flag to allow re-analysis
                } else {
                  alert("No scenes loaded. Please load a script first.");
                }
              }}
              style={{
                backgroundColor: "#FF9800",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Analyze Script
            </button>
            <button
              onClick={() => setIsTimelineLocked(!isTimelineLocked)}
              style={{
                backgroundColor: isTimelineLocked ? "#f44336" : "#9E9E9E",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {isTimelineLocked ? "🔒 Unlock Timeline" : "🔓 Lock Timeline"}
            </button>
            <button
              onClick={addManualDay}
              disabled={isTimelineLocked}
              style={{
                backgroundColor: isTimelineLocked ? "#ccc" : "#2196F3",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: isTimelineLocked ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              + / - Day
            </button>
            <button
              onClick={addContinuityElement}
              style={{
                backgroundColor: "#4CAF50",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              + Add Continuity Element
            </button>
          </div>
        </div>

        {/* Controls Row */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {/* Timeline Type Selector */}
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginRight: "8px",
              }}
            >
              Timeline:
            </label>
            <select
              value={selectedTimeline}
              onChange={(e) => setSelectedTimeline(e.target.value)}
              style={{
                fontSize: "12px",
                padding: "4px 8px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              {timelineTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Tabs */}
          <div style={{ display: "flex", gap: "5px" }}>
            {["timeline", "elements", "analysis"].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  backgroundColor: viewMode === mode ? "#2196F3" : "#f0f0f0",
                  color: viewMode === mode ? "white" : "black",
                  border: "1px solid #ccc",
                  padding: "6px 12px",
                  borderRadius: "3px",
                  cursor: "pointer",
                  fontSize: "11px",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Detection Status */}
          <div style={{ fontSize: "11px", color: "#666" }}>
            Status: Story day detection not yet implemented
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 160px)",
          overflow: "hidden",
        }}
      >
        {/* Timeline Display */}
        {viewMode === "timeline" && (
          <div
            style={{
              flex: 1,
              overflowX: "auto",
              overflowY: "auto",
              padding: "20px",
            }}
          >
            {getStoryDays().length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                No story days detected. Story day detection will analyze scene
                headers to identify timeline progression.
              </div>
            ) : (
              <>
                {/* Timeline Header with Collapse Control */}
                <div
                  style={{
                    backgroundColor: "#2196F3",
                    color: "white",
                    padding: "12px",
                    marginBottom: "10px",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={toggleTimelineCollapse}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>Timeline View</span>
                    {!isTimelineCollapsed && (
                      <span style={{ fontSize: "12px", opacity: 0.8 }}>
                        ({getStoryDays().length} story days)
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {isTimelineCollapsed &&
                      (() => {
                        const range = getTimelineSceneRange();
                        return range.first && range.last ? (
                          <span style={{ fontSize: "11px", opacity: 0.9 }}>
                            {range.first.sceneNumber === range.last.sceneNumber
                              ? `Scene ${range.first.sceneNumber}`
                              : `Scene ${range.first.sceneNumber} - ${range.last.sceneNumber}`}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", opacity: 0.9 }}>
                            No scenes
                          </span>
                        );
                      })()}
                    <span style={{ fontSize: "16px" }}>
                      {isTimelineCollapsed ? "▶" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Story Days Container */}
                <div
                  style={{
                    display: "flex",
                    minWidth: "fit-content",
                    gap: "2px",
                    marginBottom: "20px",
                  }}
                >
                  {isTimelineCollapsed
                    ? // Collapsed view - show story day headers with scene ranges
                      getStoryDays().map((storyDay) => {
                        const dayScenes = getScenesForDay(storyDay);
                        const sortedScenes = dayScenes.sort(
                          (a, b) =>
                            parseInt(a.sceneNumber) - parseInt(b.sceneNumber)
                        );
                        const firstScene = sortedScenes[0];
                        const lastScene = sortedScenes[sortedScenes.length - 1];

                        return (
                          <div
                            key={`collapsed-${storyDay}`}
                            style={{
                              minWidth: "180px",
                              border: "1px solid #ddd",
                              backgroundColor: "white",
                              borderRadius: "4px",
                            }}
                          >
                            {/* Day Header */}
                            <div
                              style={{
                                backgroundColor: "#2196F3",
                                color: "white",
                                padding: "8px",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontSize: "12px",
                              }}
                            >
                              {storyDay.replace("day", "Story Day ")}
                            </div>

                            {/* Scene Range */}
                            <div
                              style={{
                                padding: "10px",
                                backgroundColor: "#f0f0f0",
                                textAlign: "center",
                                fontSize: "11px",
                                color: "#666",
                                minHeight: "40px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {firstScene && lastScene
                                ? firstScene.sceneNumber ===
                                  lastScene.sceneNumber
                                  ? `Scene ${firstScene.sceneNumber}`
                                  : `Scene ${firstScene.sceneNumber} - ${lastScene.sceneNumber}`
                                : "No scenes assigned"}
                            </div>
                          </div>
                        );
                      })
                    : // Expanded view - show full story days
                      getStoryDays().map((storyDay, dayIndex) => {
                        return (
                          <div
                            key={storyDay}
                            draggable={!isTimelineLocked}
                            onDragStart={(e) => {
                              if (isTimelineLocked) {
                                e.preventDefault();
                                return;
                              }
                              e.dataTransfer.setData("dayKey", storyDay);
                              e.dataTransfer.setData("dayIndex", dayIndex);
                              e.stopPropagation();
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const isDayDrag =
                                e.dataTransfer.getData("dayKey");
                              const isSceneDrag =
                                e.dataTransfer.getData("sceneNumber");

                              // Show visual feedback for both day and scene drops
                              if (isDayDrag || isSceneDrag) {
                                e.currentTarget.style.backgroundColor =
                                  "#e3f2fd";
                              }
                            }}
                            onDragLeave={(e) => {
                              // Reset background when drag leaves
                              e.currentTarget.style.backgroundColor = "white";
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              // Reset background
                              e.currentTarget.style.backgroundColor = "white";

                              const sourceDayKey =
                                e.dataTransfer.getData("dayKey");
                              const sourceDayIndex = parseInt(
                                e.dataTransfer.getData("dayIndex")
                              );
                              const sceneNumber =
                                e.dataTransfer.getData("sceneNumber");
                              const sourceDay =
                                e.dataTransfer.getData("sourceDay");

                              if (sourceDayKey && sourceDayKey !== storyDay) {
                                // Day reordering
                                reorderDays(sourceDayIndex, dayIndex);
                              } else if (
                                sceneNumber &&
                                sourceDay &&
                                sourceDay !== storyDay
                              ) {
                                // Scene moving between days
                                moveSceneToDay(
                                  sceneNumber,
                                  sourceDay,
                                  storyDay
                                );
                              }
                            }}
                            style={{
                              minWidth: "180px",
                              border: "1px solid #ddd",
                              backgroundColor: "white",
                              borderRadius: "4px",
                              cursor: isTimelineLocked ? "default" : "grab",
                              position: "relative",
                            }}
                          >
                            {/* Day Header */}
                            <div
                              style={{
                                backgroundColor: "#2196F3",
                                color: "white",
                                padding: "8px",
                                textAlign: "center",
                                fontWeight: "bold",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                cursor: "grab",
                              }}
                              onMouseDown={() => {
                                // Visual feedback that day is draggable
                                document.body.style.cursor = "grabbing";
                              }}
                              onMouseUp={() => {
                                document.body.style.cursor = "default";
                              }}
                            >
                              <span style={{ fontSize: "10px" }}>⋮⋮</span>
                              {storyDay.replace("day", "Story Day ")}
                              <span style={{ fontSize: "10px" }}>⋮⋮</span>
                            </div>

                            {/* Scenes in this day */}
                            <div
                              style={{ padding: "10px", minHeight: "150px" }}
                            >
                              {getScenesForDay(storyDay).length === 0 ? (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#999",
                                    fontStyle: "italic",
                                  }}
                                >
                                  No scenes assigned
                                </div>
                              ) : (
                                getScenesForDay(storyDay).map((scene) => (
                                  <div
                                    key={scene.sceneNumber}
                                    draggable={!isTimelineLocked}
                                    onDragStart={(e) => {
                                      if (isTimelineLocked) {
                                        e.preventDefault();
                                        return;
                                      }
                                      e.dataTransfer.setData(
                                        "sceneNumber",
                                        scene.sceneNumber
                                      );
                                      e.dataTransfer.setData(
                                        "sourceDay",
                                        storyDay
                                      );
                                      e.dataTransfer.setData(
                                        "sceneIndex",
                                        getScenesForDay(storyDay).findIndex(
                                          (s) =>
                                            s.sceneNumber === scene.sceneNumber
                                        )
                                      );
                                      e.stopPropagation(); // Prevent day drag when dragging scene
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const draggedSceneNumber =
                                        e.dataTransfer.getData("sceneNumber");
                                      const sourceDay =
                                        e.dataTransfer.getData("sourceDay");
                                      const sourceIndex = parseInt(
                                        e.dataTransfer.getData("sceneIndex")
                                      );

                                      if (
                                        draggedSceneNumber &&
                                        sourceDay === storyDay &&
                                        draggedSceneNumber !== scene.sceneNumber
                                      ) {
                                        // Reordering within same day
                                        const targetIndex = getScenesForDay(
                                          storyDay
                                        ).findIndex(
                                          (s) =>
                                            s.sceneNumber === scene.sceneNumber
                                        );
                                        reorderSceneInDay(
                                          draggedSceneNumber,
                                          storyDay,
                                          sourceIndex,
                                          targetIndex
                                        );
                                      } else if (
                                        draggedSceneNumber &&
                                        sourceDay !== storyDay
                                      ) {
                                        // Moving between days - insert at specific position
                                        const targetIndex = getScenesForDay(
                                          storyDay
                                        ).findIndex(
                                          (s) =>
                                            s.sceneNumber === scene.sceneNumber
                                        );
                                        moveSceneToDay(
                                          draggedSceneNumber,
                                          sourceDay,
                                          storyDay,
                                          targetIndex
                                        );
                                      }
                                    }}
                                    style={{
                                      backgroundColor: getSceneColor(
                                        scene.sceneColor
                                      ),
                                      border: "1px solid #ddd",
                                      padding: "4px",
                                      margin: "1px 0",
                                      fontSize: "9px",
                                      borderRadius: "2px",
                                      cursor: "grab",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                    }}
                                    onDoubleClick={() => {
                                      if (!isTimelineLocked) {
                                        setSelectedSceneForEdit(scene);
                                      }
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        flex: 1,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: "bold",
                                          marginRight: "4px",
                                        }}
                                      >
                                        {scene.sceneNumber}
                                      </span>
                                      <span
                                        style={{
                                          color: "#666",
                                          marginRight: "4px",
                                          fontSize: "8px",
                                        }}
                                      >
                                        {scene.metadata?.location || "No loc"}
                                      </span>
                                      <span
                                        style={{
                                          color: "#999",
                                          fontSize: "8px",
                                        }}
                                      >
                                        {scene.metadata?.timeOfDay || "No time"}
                                      </span>
                                    </div>
                                    {scene.timelineType &&
                                      scene.timelineType !== "main" && (
                                        <span
                                          style={{
                                            padding: "1px 3px",
                                            backgroundColor:
                                              scene.timelineType === "flashback"
                                                ? "#FF9800"
                                                : scene.timelineType === "dream"
                                                ? "#9C27B0"
                                                : "#607D8B",
                                            color: "white",
                                            fontSize: "7px",
                                            borderRadius: "2px",
                                            marginLeft: "4px",
                                          }}
                                        >
                                          {scene.timelineType
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                </div>

                {/* Continuity Elements Overlay - Always Visible */}
                <div
                  style={{
                    borderTop: "2px solid #333",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "4px",
                    padding: "10px",
                    width: "100%",
                    minHeight: "200px",
                  }}
                >
                  {/* Mirrored Day Blocks */}
                  <div
                    style={{
                      display: "flex",
                      minWidth: "fit-content",
                      gap: "2px",
                      marginBottom: "10px",
                    }}
                  >
                    {getStoryDays().map((storyDay) => (
                      <div
                        key={`mirror-${storyDay}`}
                        style={{
                          minWidth: "180px",
                          border: "1px solid #ccc",
                          backgroundColor: "#e0e0e0",
                          borderRadius: "4px",
                          opacity: 0.6,
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: "#9e9e9e",
                            color: "white",
                            padding: "8px",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontSize: "12px",
                          }}
                        >
                          {storyDay.replace("day", "Story Day ")}
                        </div>
                        <div style={{ height: "20px" }}></div>
                      </div>
                    ))}
                  </div>

                  {/* Continuity Elements */}
                  <div
                    style={{
                      position: "relative",
                      minHeight: "150px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "10px",
                        color: "#333",
                      }}
                    >
                      Continuity Elements
                    </div>
                    {(() => {
                      const elements = getCurrentElements();
                      const storyDays = getStoryDays();

                      if (elements.length === 0) {
                        return (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#999",
                              fontStyle: "italic",
                            }}
                          >
                            No continuity elements added yet
                          </div>
                        );
                      }

                      // Filter elements that have at least some overlap with current timeline
                      const visibleElements = elements.filter((element) => {
                        // Ensure we're working with numbers
                        const startDay = parseInt(element.startDay);
                        const endDay = parseInt(element.endDay);

                        // Check if any day from the element's range exists in the timeline
                        for (let day = startDay; day <= endDay; day++) {
                          const dayKey = `day${day}`;
                          if (storyDays.includes(dayKey)) {
                            return true;
                          }
                        }
                        return false;
                      });

                      if (visibleElements.length === 0) {
                        // Check if elements have null days (broken data)
                        const hasBrokenElements = elements.some(
                          (e) => e.startDay === null || e.endDay === null
                        );

                        return (
                          <div
                            style={{
                              fontSize: "11px",
                              color: hasBrokenElements ? "#f44336" : "#999",
                              fontStyle: "italic",
                              padding: "10px",
                              backgroundColor: hasBrokenElements
                                ? "#ffebee"
                                : "transparent",
                              borderRadius: "4px",
                            }}
                          >
                            {hasBrokenElements ? (
                              <>
                                <strong>
                                  ⚠️ Error: Continuity elements have missing day
                                  information
                                </strong>
                                <br />
                                <br />
                                {elements.length} continuity element(s) were
                                created before scenes had story day assignments.
                                <br />
                                <br />
                                <strong>To fix:</strong>
                                <br />
                                1. Switch to the "Elements" view tab above
                                <br />
                                2. Delete the broken elements
                                <br />
                                3. Make sure "Analyze Script" has been run
                                (check that scenes are in story days above)
                                <br />
                                4. Recreate the continuity elements
                              </>
                            ) : (
                              <>
                                {elements.length} continuity element(s) exist
                                but are not visible in current timeline days.
                                <br />
                                Elements may be for different story days or
                                timeline type.
                              </>
                            )}
                          </div>
                        );
                      }

                      return visibleElements.map((element, index) => {
                        // Adjust positioning if element starts before timeline
                        const firstTimelineDay = parseInt(
                          storyDays[0].replace("day", "")
                        );
                        const lastTimelineDay = parseInt(
                          storyDays[storyDays.length - 1].replace("day", "")
                        );

                        // Clamp element to visible range
                        const displayStartDay = Math.max(
                          element.startDay,
                          firstTimelineDay
                        );
                        const displayEndDay = Math.min(
                          element.endDay,
                          lastTimelineDay
                        );

                        const startDayIndex = storyDays.findIndex(
                          (day) => day === `day${displayStartDay}`
                        );
                        const endDayIndex = storyDays.findIndex(
                          (day) => day === `day${displayEndDay}`
                        );

                        if (startDayIndex === -1 || endDayIndex === -1)
                          return null;

                        const leftPosition = startDayIndex * (180 + 2);
                        const numDays = endDayIndex - startDayIndex + 1;
                        const width = numDays * 180 + (numDays - 1) * 2;

                        return (
                          <div
                            key={element.id}
                            style={{
                              position: "absolute",
                              left: `${leftPosition}px`,
                              top: `${30 + index * 35}px`,
                              width: `${width}px`,
                              height: "30px",
                              backgroundColor: getElementColor(element.type),
                              border: "1px solid #333",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              padding: "0 8px",
                              fontSize: "10px",
                              color: "white",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                            onClick={() => editContinuityElement(element)}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                height: "100%",
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "9px",
                                  marginBottom: "3px",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {element.characterId
                                  ? `${element.characterId}: ${element.name}`
                                  : element.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "9px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginTop: "auto",
                                  width: "100%",
                                }}
                              >
                                <span>
                                  Scene{" "}
                                  {element.startScene ||
                                    scenes
                                      .filter(
                                        (s) =>
                                          s.storyDay === element.startDay &&
                                          (s.timelineType ===
                                            element.timeline ||
                                            (!s.timelineType &&
                                              element.timeline === "main"))
                                      )
                                      .sort(
                                        (a, b) =>
                                          parseInt(a.sceneNumber) -
                                          parseInt(b.sceneNumber)
                                      )[0]?.sceneNumber ||
                                    "?"}
                                </span>
                                <span
                                  style={{ position: "absolute", right: "2px" }}
                                >
                                  Scene{" "}
                                  {element.endScene ||
                                    scenes
                                      .filter(
                                        (s) =>
                                          s.storyDay === element.endDay &&
                                          (s.timelineType ===
                                            element.timeline ||
                                            (!s.timelineType &&
                                              element.timeline === "main"))
                                      )
                                      .sort(
                                        (a, b) =>
                                          parseInt(a.sceneNumber) -
                                          parseInt(b.sceneNumber)
                                      )
                                      .slice(-1)[0]?.sceneNumber ||
                                    "?"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Elements List View */}
        {viewMode === "elements" && (
          <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
            <h3>Continuity Elements</h3>
            {getCurrentElements().length === 0 ? (
              <div style={{ color: "#666", fontStyle: "italic" }}>
                No continuity elements added yet.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {getCurrentElements().map((element) => (
                  <div
                    key={element.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      padding: "10px",
                      backgroundColor: "white",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      position: "relative",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                        {element.characterId
                          ? `${element.characterId}: ${element.name}`
                          : element.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        Type: {element.type} | Days:{" "}
                        {element.startDay || "null"}-{element.endDay || "null"}
                        {(element.startDay === null ||
                          element.endDay === null) && (
                          <span
                            style={{
                              color: "#f44336",
                              marginLeft: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            ⚠️ Missing day info
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => editContinuityElement(element)}
                        style={{
                          backgroundColor: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                        title="Edit element"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${element.name}"?`
                            )
                          ) {
                            deleteContinuityElement(element.id);
                          }
                        }}
                        style={{
                          backgroundColor: "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold",
                        }}
                        title="Delete element"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analysis View */}
        {viewMode === "analysis" && (
          <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
            <h3>Timeline Analysis</h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div
                style={{
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Story Day Statistics</h4>
                <div>Total Story Days: {getStoryDays().length}</div>
                <div>Total Scenes: {scenes?.length || 0}</div>
                <div>Continuity Elements: {getCurrentElements().length}</div>
              </div>

              <div
                style={{
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Detection Status</h4>
                <div style={{ color: "#666" }}>
                  Story day detection algorithm not yet implemented.
                  <br />
                  Will analyze scene headers for day/night transitions.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scene Edit Modal */}
      {selectedSceneForEdit && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setSelectedSceneForEdit(null)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "350px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Edit Scene {selectedSceneForEdit.sceneNumber}
            </h3>

            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                Location:
              </div>
              <div style={{ color: "#666", marginBottom: "10px" }}>
                {selectedSceneForEdit.metadata?.location || "No location"}
              </div>

              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                Time:
              </div>
              <div style={{ color: "#666", marginBottom: "15px" }}>
                {selectedSceneForEdit.metadata?.timeOfDay || "No time"}
              </div>

              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Timeline Assignment:
              </label>
              <select
                value={selectedSceneForEdit.timelineType || "main"}
                onChange={(e) =>
                  handleSceneTimelineChange(
                    selectedSceneForEdit.sceneNumber,
                    e.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  marginBottom: "15px",
                }}
              >
                <option value="main">Main Timeline</option>
                <option value="flashback">Flashback</option>
                <option value="dream">Dream/Vision</option>
                <option value="other">Other</option>
              </select>

              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Scene Color:
              </label>
              <div
                style={{ display: "flex", gap: "8px", marginBottom: "15px" }}
              >
                {[
                  { name: "Default", color: null, bg: "#f8f8f8" },
                  { name: "Red", color: "red", bg: "#ffebee" },
                  { name: "Blue", color: "blue", bg: "#e3f2fd" },
                  { name: "Green", color: "green", bg: "#e8f5e8" },
                  { name: "Yellow", color: "yellow", bg: "#fffde7" },
                  { name: "Purple", color: "purple", bg: "#f3e5f5" },
                ].map((colorOption) => (
                  <div
                    key={colorOption.name}
                    onClick={() => {
                      const sceneIndex = scenes.findIndex(
                        (s) =>
                          s.sceneNumber === selectedSceneForEdit.sceneNumber
                      );
                      if (sceneIndex !== -1) {
                        scenes[sceneIndex].sceneColor = colorOption.color;
                        setSelectedSceneForEdit({
                          ...selectedSceneForEdit,
                          sceneColor: colorOption.color,
                        });
                      }
                    }}
                    style={{
                      width: "40px",
                      height: "40px",
                      backgroundColor: colorOption.bg,
                      border:
                        selectedSceneForEdit.sceneColor === colorOption.color
                          ? "3px solid #333"
                          : "1px solid #ddd",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    {colorOption.name === "Default"
                      ? "DEF"
                      : colorOption.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setSelectedSceneForEdit(null)}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Continuity Element Modal */}
      {showContinuityModal && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setShowContinuityModal(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "500px",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {editingElement ? "Edit" : "Add"} Continuity Element
            </h3>

            {/* Name */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Name:
              </label>
              <input
                type="text"
                value={elementForm.name}
                onChange={(e) =>
                  setElementForm((prev) => ({ ...prev, name: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
                placeholder="e.g., Character A facial wound"
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Type:
              </label>
              <select
                value={elementForm.type}
                onChange={(e) =>
                  setElementForm((prev) => ({ ...prev, type: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                <option value="injury">Injury</option>
                <option value="makeup">Makeup</option>
                <option value="costume">Costume</option>
                <option value="props">Props</option>
                <option value="hair">Hair</option>
                <option value="aging">Aging</option>
                <option value="weather effects">Weather Effects</option>
                <option value="vehicle damage">Vehicle Damage</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Timeline */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Timeline:
              </label>
              <select
                value={elementForm.timeline}
                onChange={(e) =>
                  setElementForm((prev) => ({
                    ...prev,
                    timeline: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                <option value="main">Main Timeline</option>
                <option value="flashback">Flashback</option>
                <option value="dream">Dream</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Character */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Character (Optional):
              </label>
              <select
                value={elementForm.characterId}
                onChange={(e) =>
                  setElementForm((prev) => ({
                    ...prev,
                    characterId: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                <option value="">No specific character</option>
                {characters && typeof characters === "object" ? (
                  Object.keys(characters).map((charName) => (
                    <option key={charName} value={charName}>
                      {charName}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No characters available
                  </option>
                )}
              </select>
            </div>

            {/* Scene Range */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Start Scene:
                </label>
                <select
                  value={elementForm.startScene}
                  onChange={(e) => {
                    const sceneNumber = e.target.value;
                    const scene = scenes.find(
                      (s) => s.sceneNumber.toString() === sceneNumber
                    );
                    const dayNumber = scene ? scene.storyDay : null;
                    setElementForm((prev) => ({
                      ...prev,
                      startScene: sceneNumber,
                      startDay: dayNumber,
                    }));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                >
                  <option value="">Select start scene...</option>
                  {getAvailableScenes().map((scene) => (
                    <option key={scene.sceneNumber} value={scene.sceneNumber}>
                      Scene {scene.sceneNumber} -{" "}
                      {scene.metadata?.location || "No location"} (Day{" "}
                      {scene.storyDay || "?"})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  End Scene:
                </label>
                <select
                  key={`end-scene-${elementForm.endScene}`}
                  value={elementForm.endScene || ""}
                  onChange={(e) => {
                    const sceneNumber = e.target.value;
                    console.log("Selected scene number:", sceneNumber);
                    console.log(
                      "Available scenes:",
                      getAvailableScenes().map(
                        (s) => `${s.sceneNumber} (Day ${s.storyDay})`
                      )
                    );

                    setElementForm((prev) => {
                      const scene = scenes.find(
                        (s) => s.sceneNumber.toString() === sceneNumber
                      );
                      console.log("Found scene:", scene);
                      const dayNumber = scene ? scene.storyDay : null;
                      console.log(
                        "Setting endScene to:",
                        sceneNumber,
                        "endDay to:",
                        dayNumber
                      );

                      const newForm = {
                        ...prev,
                        endScene: sceneNumber,
                        endDay: dayNumber,
                      };
                      console.log("New form state:", newForm);
                      return newForm;
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                >
                  <option value="">Select end scene...</option>
                  {getAvailableScenes().map((scene) => (
                    <option key={scene.sceneNumber} value={scene.sceneNumber}>
                      Scene {scene.sceneNumber} -{" "}
                      {scene.metadata?.location || "No location"} (Day{" "}
                      {scene.storyDay || "?"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Daily Notes */}
            {elementForm.startDay && elementForm.endDay && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "10px",
                    fontWeight: "bold",
                  }}
                >
                  Daily Tracking Notes:
                </label>
                {Array.from(
                  {
                    length:
                      parseInt(elementForm.endDay) -
                      parseInt(elementForm.startDay) +
                      1,
                  },
                  (_, i) => {
                    const dayNum = parseInt(elementForm.startDay) + i;
                    const dayKey = `day${dayNum}`;
                    return (
                      <div
                        key={dayKey}
                        style={{
                          marginBottom: "10px",
                          padding: "10px",
                          border: "1px solid #eee",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{ fontWeight: "bold", marginBottom: "5px" }}
                        >
                          Day {dayNum}:
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              placeholder="Status"
                              value={
                                elementForm.dailyNotes[dayKey]?.status || ""
                              }
                              onChange={(e) =>
                                setElementForm((prev) => ({
                                  ...prev,
                                  dailyNotes: {
                                    ...prev.dailyNotes,
                                    [dayKey]: {
                                      ...prev.dailyNotes[dayKey],
                                      status: e.target.value,
                                    },
                                  },
                                }))
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                border: "1px solid #ddd",
                                borderRadius: "3px",
                                fontSize: "12px",
                              }}
                            />
                          </div>
                          <div style={{ flex: 2 }}>
                            <input
                              type="text"
                              placeholder="Notes"
                              value={
                                elementForm.dailyNotes[dayKey]?.notes || ""
                              }
                              onChange={(e) =>
                                setElementForm((prev) => ({
                                  ...prev,
                                  dailyNotes: {
                                    ...prev.dailyNotes,
                                    [dayKey]: {
                                      ...prev.dailyNotes[dayKey],
                                      notes: e.target.value,
                                    },
                                  },
                                }))
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                border: "1px solid #ddd",
                                borderRadius: "3px",
                                fontSize: "12px",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "space-between",
              }}
            >
              <div>
                {editingElement && (
                  <button
                    onClick={() => deleteContinuityElement(editingElement.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={saveContinuityElement}
                  style={{
                    backgroundColor: "#4CAF50",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {editingElement ? "Update" : "Add"} Element
                </button>
                <button
                  onClick={() => setShowContinuityModal(false)}
                  style={{
                    backgroundColor: "#ccc",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Day Management Modal */}
      {showDayManagement && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setShowDayManagement(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "400px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Day Management</h3>

            {/* Action Selection */}
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Action:
              </label>
              <select
                value={dayAction}
                onChange={(e) => setDayAction(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                <option value="add">Add New Day</option>
                <option value="remove">Remove Day</option>
              </select>
            </div>

            {dayAction === "add" && (
              <div
                style={{
                  marginBottom: "15px",
                  padding: "15px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Create Empty Day
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  A new empty story day will be created. You can then drag
                  scenes from other days to assign them to the new day.
                </div>
              </div>
            )}

            {dayAction === "remove" && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Day to Remove:
                </label>
                <select
                  value={insertPosition}
                  onChange={(e) => setInsertPosition(parseInt(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                >
                  {getStoryDays().map((dayKey, index) => (
                    <option key={dayKey} value={index + 1}>
                      Day {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={
                  dayAction === "add" ? handleCreateDay : handleRemoveDay
                }
                style={{
                  backgroundColor: dayAction === "add" ? "#4CAF50" : "#f44336",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {dayAction === "add" ? "Create Day" : "Remove Day"}
              </button>
              <button
                onClick={() => setShowDayManagement(false)}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TimelineModule;
