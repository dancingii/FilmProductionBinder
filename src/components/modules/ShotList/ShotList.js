import React from "react";
import { usePresence } from "../../../hooks/usePresence";
import PresenceIndicator from "../../shared/PresenceIndicator";
import EditableInput from "../../shared/EditableInput";
import jsPDF from "jspdf";

function ShotListModule({
  stripboardScenes,
  characters,
  castCrew,
  shootingDays,
  scheduledScenes,
  shotListData,
  setShotListData,
  sceneNotes,
  setSceneNotes,
  onSyncShotListData,
  userRole,
  canEdit,
  isViewOnly,
  selectedProject,
  user,
}) {
  const [editingShotId, setEditingShotId] = React.useState(null);
  const { otherUsers } = usePresence(
    selectedProject?.id,
    user,
    "shot_list",
    editingShotId
  );

  // Debug presence system (commented out to reduce re-renders)
  // console.log("🔍 Shot List Presence Debug:", {
  //   hasOtherUsers: Object.keys(otherUsers).length,
  //   otherUsers: otherUsers,
  //   editingShotId: editingShotId,
  //   userId: user?.id,
  //   projectId: selectedProject?.id,
  // });

  const [selectedDate, setSelectedDate] = React.useState("all");
  // Remove these global editing states - we'll use individual field components instead

  const shotTypeOptions = React.useMemo(
    () => ["EW", "W", "MW", "M", "MCU", "CU", "ECU"],
    []
  );
  const equipmentOptions = React.useMemo(
    () => [
      "Handheld",
      "Tripod",
      "Steadicam",
      "Dolly",
      "Crane",
      "Drone",
      "Gimbal",
      "Slider",
      "Custom",
    ],
    []
  );

  // Color options with good contrast for black text
  const colorOptions = React.useMemo(
    () => [
      { value: "", color: "transparent", border: "#ccc" },
      { value: "priority", color: "#F44336" }, // Bright red
      { value: "setup", color: "#FF9800" }, // Bright orange
      { value: "pickup", color: "#FFEB3B" }, // Bright yellow
      { value: "complete", color: "#4CAF50" }, // Bright green
    ],
    []
  );

  const initializeSceneShots = React.useCallback(
    (sceneNumber) => {
      // Just return existing shots or create initial structure WITHOUT calling setState
      if (!shotListData[sceneNumber]) {
        const newShots = [];
        for (let i = 0; i < 5; i++) {
          newShots.push({
            id: `${sceneNumber}${String.fromCharCode(97 + i)}`,
            colorCode: "",
            shotType: "",
            customShotType: "",
            lens: "",
            setup: "",
            angle: "",
            movement: "",
            equipment: "",
            customEquipment: "",
            description: "",
            additionalNotes: "",
          });
        }
        return newShots;
      }
      return shotListData[sceneNumber];
    },
    [shotListData]
  );

  // Initialize shots for all scenes ONCE on mount - DO NOT SYNC TO DATABASE
  React.useEffect(() => {
    if (!stripboardScenes || stripboardScenes.length === 0) return;

    // Defer initialization so the module renders immediately first
    const timer = setTimeout(() => {
      let needsInitialization = false;
      const updatedData = { ...shotListData };

      stripboardScenes.forEach((scene) => {
        if (!updatedData[scene.sceneNumber]) {
          needsInitialization = true;
          const newShots = [];
          for (let i = 0; i < 5; i++) {
            newShots.push({
              id: `${scene.sceneNumber}${String.fromCharCode(97 + i)}`,
              colorCode: "",
              shotType: "",
              customShotType: "",
              lens: "",
              setup: "",
              angle: "",
              movement: "",
              equipment: "",
              customEquipment: "",
              description: "",
              additionalNotes: "",
            });
          }
          updatedData[scene.sceneNumber] = newShots;
        }
      });

      if (needsInitialization) {
        setShotListData(updatedData);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only run ONCE on mount

  const getSceneCastNumbers = React.useCallback(
    (sceneNumber) => {
      if (!characters) return "";

      const sceneCharacters = Object.values(characters)
        .filter((char) => char.scenes && char.scenes.includes(sceneNumber))
        .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber);

      return sceneCharacters.map((char) => char.chronologicalNumber).join(", ");
    },
    [characters]
  );

  // Generate proper shot ID with alphabet pattern
  const generateShotId = React.useCallback((sceneNumber, shotIndex) => {
    const getLetterSequence = (index) => {
      if (index < 26) {
        // a, b, c, ..., z (indices 0-25)
        return String.fromCharCode(97 + index);
      } else {
        // aa, ab, ac, ..., az, ba, bb, bc, ... (indices 26+)
        const firstLetter = Math.floor((index - 26) / 26);
        const secondLetter = (index - 26) % 26;
        return (
          String.fromCharCode(97 + firstLetter) +
          String.fromCharCode(97 + secondLetter)
        );
      }
    };

    return `${sceneNumber}${getLetterSequence(shotIndex)}`;
  }, []);

  const addShotRow = React.useCallback(
    (sceneNumber) => {
      const currentShots = shotListData[sceneNumber] || [];
      const newShotId = generateShotId(sceneNumber, currentShots.length);
      const newShot = {
        id: newShotId,
        colorCode: "",
        shotType: "",
        customShotType: "",
        lens: "",
        setup: "",
        angle: "",
        movement: "",
        equipment: "",
        customEquipment: "",
        description: "",
        additionalNotes: "",
      };

      const updatedData = {
        ...shotListData,
        [sceneNumber]: [...currentShots, newShot],
      };
      setShotListData(updatedData);

      if (onSyncShotListData) {
        onSyncShotListData(updatedData, sceneNotes);
      }
    },
    [shotListData, setShotListData, generateShotId]
  );

  const removeShotRow = React.useCallback(
    (sceneNumber, shotIndex) => {
      const currentShots = shotListData[sceneNumber] || [];
      if (currentShots.length <= 1) return;

      const updatedShots = currentShots.filter(
        (_, index) => index !== shotIndex
      );
      const renumberedShots = updatedShots.map((shot, index) => ({
        ...shot,
        id: generateShotId(sceneNumber, index),
      }));

      const updatedData = {
        ...shotListData,
        [sceneNumber]: renumberedShots,
      };
      setShotListData(updatedData);

      if (onSyncShotListData) {
        onSyncShotListData(updatedData, sceneNotes);
      }
    },
    [shotListData, setShotListData, generateShotId]
  );

  // Drag and drop functionality
  const [draggedShot, setDraggedShot] = React.useState(null);
  const [dragOverIndex, setDragOverIndex] = React.useState(null);

  // Scene preview popup state
  const [showScenePreview, setShowScenePreview] = React.useState(false);
  const [previewSceneNumber, setPreviewSceneNumber] = React.useState(null);

  // Remove the PDF export function from here - we'll move it below

  const handleDragStart = React.useCallback((e, sceneNumber, shotIndex) => {
    setDraggedShot({ sceneNumber, shotIndex });
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = "0.5";
  }, []);

  const handleDragEnd = React.useCallback((e) => {
    e.currentTarget.style.opacity = "1";
    setDraggedShot(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = React.useCallback(
    (e, sceneNumber, shotIndex) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedShot && draggedShot.sceneNumber === sceneNumber) {
        setDragOverIndex(shotIndex);
      }
    },
    [draggedShot]
  );

  const handleDragLeave = React.useCallback((e) => {
    // Only clear if we're leaving the shot row entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = React.useCallback(
    (e, sceneNumber, targetIndex) => {
      e.preventDefault();

      if (!draggedShot || draggedShot.sceneNumber !== sceneNumber) return;

      const sourceIndex = draggedShot.shotIndex;
      if (sourceIndex === targetIndex) return;

      const currentShots = shotListData[sceneNumber] || [];
      const updatedShots = [...currentShots];

      // Remove the dragged shot from its original position
      const [movedShot] = updatedShots.splice(sourceIndex, 1);

      // Insert it at the new position
      updatedShots.splice(targetIndex, 0, movedShot);

      // Renumber all shots with proper IDs
      const renumberedShots = updatedShots.map((shot, index) => ({
        ...shot,
        id: generateShotId(sceneNumber, index),
      }));

      const updatedData = {
        ...shotListData,
        [sceneNumber]: renumberedShots,
      };
      setShotListData(updatedData);

      if (onSyncShotListData) {
        onSyncShotListData(updatedData, sceneNotes);
      }

      setDraggedShot(null);
      setDragOverIndex(null);
    },
    [draggedShot, shotListData, setShotListData, generateShotId]
  );

  const syncTimeoutRef = React.useRef(null);

  const updateShotField = React.useCallback(
    (sceneNumber, shotIndex, field, value) => {
      const currentShots = shotListData[sceneNumber] || [];
      const updatedShots = [...currentShots];
      updatedShots[shotIndex] = {
        ...updatedShots[shotIndex],
        [field]: value,
      };
      const updatedData = {
        ...shotListData,
        [sceneNumber]: updatedShots,
      };
      setShotListData(updatedData);

      if (onSyncShotListData) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          onSyncShotListData(updatedData, sceneNotes);
        }, 500);
      }
    },
    [shotListData, sceneNotes, setShotListData, onSyncShotListData]
  );

  const updateSceneNotes = React.useCallback(
    (sceneNumber, value) => {
      const updatedNotes = {
        ...sceneNotes,
        [sceneNumber]: value,
      };
      setSceneNotes(updatedNotes);

      if (onSyncShotListData) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          onSyncShotListData(shotListData, updatedNotes);
        }, 500);
      }
    },
    [sceneNotes, shotListData, setSceneNotes, onSyncShotListData]
  );

  const renderShotTypeField = React.useCallback(
    (sceneNumber, shotIndex, shot) => {
      const isCustom = shot.shotType === "Custom";

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <select
            value={shot.shotType || ""}
            onChange={(e) =>
              updateShotField(
                sceneNumber,
                shotIndex,
                "shotType",
                e.target.value
              )
            }
            style={{
              fontSize: "10px",
              padding: "2px",
              border: "1px solid #ccc",
              borderRadius: "2px",
              minWidth: "60px",
            }}
          >
            <option value="">--</option>
            {shotTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {shotTypeOptions.map((option1, i) =>
              shotTypeOptions.slice(i + 1).map((option2) => (
                <option
                  key={`${option1}>${option2}`}
                  value={`${option1} > ${option2}`}
                >
                  {option1} &gt; {option2}
                </option>
              ))
            )}
            <option value="Custom">Custom</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={shot.customShotType || ""}
              onChange={(e) =>
                updateShotField(
                  sceneNumber,
                  shotIndex,
                  "customShotType",
                  e.target.value
                )
              }
              placeholder="Enter custom shot type"
              style={{
                fontSize: "10px",
                padding: "2px",
                border: "1px solid #ccc",
                borderRadius: "2px",
                minWidth: "60px",
              }}
            />
          )}
        </div>
      );
    },
    [shotTypeOptions, updateShotField]
  );

  const renderEquipmentField = React.useCallback(
    (sceneNumber, shotIndex, shot) => {
      const isCustom = shot.equipment === "Custom";

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <select
            value={shot.equipment || ""}
            onChange={(e) =>
              updateShotField(
                sceneNumber,
                shotIndex,
                "equipment",
                e.target.value
              )
            }
            style={{
              fontSize: "10px",
              padding: "2px",
              border: "1px solid #ccc",
              borderRadius: "2px",
              minWidth: "80px",
            }}
          >
            <option value="">--</option>
            {equipmentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {isCustom && (
            <input
              type="text"
              value={shot.customEquipment || ""}
              onChange={(e) =>
                updateShotField(
                  sceneNumber,
                  shotIndex,
                  "customEquipment",
                  e.target.value
                )
              }
              placeholder="Enter custom equipment"
              style={{
                fontSize: "10px",
                padding: "2px",
                border: "1px solid #ccc",
                borderRadius: "2px",
                minWidth: "80px",
              }}
            />
          )}
        </div>
      );
    },
    [equipmentOptions, updateShotField]
  );

  const getScheduledDates = React.useCallback(() => {
    if (!shootingDays) return [];
    // Show ALL shooting days, not just ones with scheduled scenes
    return shootingDays
      .map((day) => ({
        date: day.date,
        dayNumber: day.dayNumber || day.day_number || "?",
      }))
      .sort((a, b) => {
        // Sort by dayNumber first, then by date
        if (a.dayNumber !== "?" && b.dayNumber !== "?") {
          return a.dayNumber - b.dayNumber;
        }
        // Fallback to date sorting if dayNumbers are missing
        return new Date(a.date) - new Date(b.date);
      });
  }, [shootingDays]);

  const getFilteredScenes = React.useCallback(() => {
    if (selectedDate === "all") return stripboardScenes;

    // Find the shooting day for this date
    const shootingDay = shootingDays?.find((day) => day.date === selectedDate);

    // Priority: Use scheduleBlocks from shooting day (like CallSheet)
    if (
      shootingDay &&
      shootingDay.scheduleBlocks &&
      shootingDay.scheduleBlocks.length > 0
    ) {
      const sceneNumbersForDate = shootingDay.scheduleBlocks
        .filter((block) => block.scene && !block.isLunch && !block.customItem)
        .map((block) => block.scene.sceneNumber);

      return stripboardScenes.filter((scene) =>
        sceneNumbersForDate.includes(scene.sceneNumber)
      );
    }

    // Fallback: Use scheduledScenes object only if no scheduleBlocks
    const scenesForDate = scheduledScenes[selectedDate] || [];
    const scheduledSceneNumbers = scenesForDate;

    return stripboardScenes.filter((scene) =>
      scheduledSceneNumbers.includes(scene.sceneNumber)
    );
  }, [selectedDate, stripboardScenes, scheduledScenes, shootingDays]);

  const scheduledDates = React.useMemo(
    () => getScheduledDates(),
    [getScheduledDates]
  );
  const filteredScenes = React.useMemo(
    () => getFilteredScenes(),
    [getFilteredScenes]
  );

  // PDF Export function - moved here after scheduledDates is defined
  const exportToPDF = React.useCallback(() => {
    if (!window.jspdf) {
      alert("PDF library not loaded. Please try again.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("portrait", "pt", "letter"); // Portrait orientation

    const dayInfo = scheduledDates.find((d) => d.date === selectedDate);
    const title =
      selectedDate === "all"
        ? "Shot List - All Scenes"
        : `Shot List - Day ${dayInfo?.dayNumber || "?"} (${new Date(
            selectedDate + "T12:00:00"
          ).toLocaleDateString()})`;

    // Title
    doc.setFontSize(11); // 30% smaller
    doc.setFont(undefined, "bold");
    doc.text(title, 50, 40);

    let yPosition = 70;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    // Column positions and widths (proportional to module: 35px 60px 40px 80px 60px 60px 80px 80px 100px 325px 325px)
    // Total module width ≈ 1245px, scaling to fit portrait page ≈ 500px usable width
    const scale = 0.38; // Scale factor to fit portrait page (smaller than landscape)
    const baseX = 30; // Smaller left margin for portrait
    const colPositions = {
      color: baseX,
      shot: baseX + 35 * scale,
      cast: baseX + 95 * scale,
      shotType: baseX + 135 * scale,
      lens: baseX + 215 * scale,
      setup: baseX + 275 * scale,
      angle: baseX + 335 * scale,
      movement: baseX + 415 * scale,
      equipment: baseX + 495 * scale,
      description: baseX + 595 * scale,
      notes: baseX + 920 * scale,
    };

    const colWidths = {
      color: 35 * scale,
      shot: 60 * scale,
      cast: 40 * scale,
      shotType: 80 * scale,
      lens: 60 * scale,
      setup: 60 * scale,
      angle: 80 * scale,
      movement: 80 * scale,
      equipment: 100 * scale,
      description: 325 * scale,
      notes: 325 * scale,
    };

    filteredScenes.forEach((scene) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 150) {
        doc.addPage();
        yPosition = 50;
      }

      // Scene header
      doc.setFillColor(76, 175, 80); // Green background
      doc.rect(baseX - 10, yPosition - 15, 500, 25, "F");

      doc.setTextColor(255, 255, 255); // White text
      doc.setFontSize(8); // 30% smaller
      doc.setFont(undefined, "bold");
      doc.text(`Scene ${scene.sceneNumber}`, baseX, yPosition);
      doc.text(`${scene.metadata?.intExt || ""}`, baseX + 100, yPosition);
      doc.text(`${scene.metadata?.location || ""}`, baseX + 180, yPosition);
      doc.text(`${scene.pageNumber || "1"}`, baseX + 350, yPosition);
      doc.text(`${scene.pageLength || "1/8"}`, baseX + 420, yPosition);

      yPosition += 35;

      // Column headers
      doc.setFillColor(33, 150, 243); // Blue background
      doc.rect(baseX - 10, yPosition - 15, 500, 20, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6); // 30% smaller
      doc.setFont(undefined, "bold");
      doc.text("Color", colPositions.color, yPosition);
      doc.text("Shot", colPositions.shot, yPosition);
      doc.text("Cast", colPositions.cast, yPosition);
      doc.text("Shot Type", colPositions.shotType, yPosition);
      doc.text("Lens", colPositions.lens, yPosition);
      doc.text("Setup", colPositions.setup, yPosition);
      doc.text("Angle", colPositions.angle, yPosition);
      doc.text("Movement", colPositions.movement, yPosition);
      doc.text("Equipment", colPositions.equipment, yPosition);
      doc.text("Description", colPositions.description, yPosition);
      doc.text("Notes", colPositions.notes, yPosition);

      yPosition += 25;

      // Shot rows
      const shots =
        shotListData[scene.sceneNumber] ||
        initializeSceneShots(scene.sceneNumber);
      const castNumbers = getSceneCastNumbers(scene.sceneNumber);

      shots.forEach((shot) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 50;
        }

        // Handle long text fields with full text wrapping and dynamic row height
        const wrapText = (text, maxWidth, fontSize = 6) => {
          if (!text) return [""];
          const words = text.split(" ");
          const lines = [];
          let currentLine = "";
          const avgCharWidth = fontSize * 0.6;
          const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

          for (let word of words) {
            const testLine =
              currentLine === "" ? word : currentLine + " " + word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
              } else {
                // Single word is too long, truncate it
                lines.push(word.substring(0, maxCharsPerLine - 3) + "...");
                currentLine = "";
              }
            }
          }
          if (currentLine !== "") {
            lines.push(currentLine);
          }
          return lines.length > 0 ? lines : [""];
        };

        const descLines = wrapText(
          shot.description || "",
          colWidths.description,
          6
        );
        const notesLines = wrapText(
          shot.additionalNotes || "",
          colWidths.notes,
          6
        );
        const maxLines = Math.max(descLines.length, notesLines.length, 1);
        const lineHeight = 8; // Reduced from 10
        const minRowHeight = 12; // Reduced from 18 (40% shorter)
        const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 4); // +4 for padding

        // Get color info once and reuse
        const selectedColor = colorOptions.find(
          (c) => c.value === shot.colorCode
        );
        const hexToRgb = (hex) => {
          if (!hex || hex === "transparent") return null;
          // Remove # if present
          hex = hex.replace("#", "");
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return [r, g, b];
        };

        // Row background with dynamic height
        if (
          selectedColor &&
          selectedColor.color &&
          selectedColor.color !== "transparent"
        ) {
          const rgbValues = hexToRgb(selectedColor.color);
          if (rgbValues) {
            const [r, g, b] = rgbValues;
            doc.setFillColor(r, g, b);
            doc.rect(baseX - 10, yPosition - 12, 500, rowHeight, "F");
          }
        }

        // Row border with dynamic height
        doc.setDrawColor(221, 221, 221);
        doc.rect(baseX - 10, yPosition - 12, 500, rowHeight);

        // Draw individual cell borders for better visibility with variable heights
        doc.setDrawColor(221, 221, 221);
        const cellPositions = [
          colPositions.color - 10,
          colPositions.shot,
          colPositions.cast,
          colPositions.shotType,
          colPositions.lens,
          colPositions.setup,
          colPositions.angle,
          colPositions.movement,
          colPositions.equipment,
          colPositions.description,
          colPositions.notes,
          // Removed the right edge line - the outer rectangle already provides this
        ];

        // Draw vertical lines for cell separation (but not the final right edge)
        cellPositions.forEach((x) => {
          doc.line(x, yPosition - 12, x, yPosition - 12 + rowHeight);
        });

        doc.setTextColor(0, 0, 0); // Black text
        doc.setFontSize(6); // 30% smaller
        doc.setFont(undefined, "normal");

        // Color indicator (small circle) - centered vertically
        if (
          selectedColor &&
          selectedColor.color &&
          selectedColor.color !== "transparent"
        ) {
          const rgbValues = hexToRgb(selectedColor.color);
          if (rgbValues) {
            const [r, g, b] = rgbValues;
            doc.setFillColor(r, g, b);
            const circleY = yPosition - 12 + rowHeight / 2; // Center vertically in row
            doc.circle(colPositions.color + 8, circleY, 3, "F"); // Slightly smaller circle
          }
        }

        // Shot data (single line items) - centered vertically with left padding
        const singleLineY = yPosition - 12 + rowHeight / 2; // Center vertically in row
        doc.text(shot.id || "", colPositions.shot + 3, singleLineY);
        doc.text(castNumbers || "", colPositions.cast + 3, singleLineY);

        const shotTypeText =
          shot.shotType === "Custom"
            ? shot.customShotType || ""
            : shot.shotType || "";
        doc.text(shotTypeText, colPositions.shotType + 3, singleLineY);

        doc.text(shot.lens || "", colPositions.lens + 3, singleLineY);
        doc.text(shot.setup || "", colPositions.setup + 3, singleLineY);
        doc.text(shot.angle || "", colPositions.angle + 3, singleLineY);
        doc.text(shot.movement || "", colPositions.movement + 3, singleLineY);

        const equipmentText =
          shot.equipment === "Custom"
            ? shot.customEquipment || ""
            : shot.equipment || "";
        doc.text(equipmentText, colPositions.equipment + 3, singleLineY);

        // Multi-line description and notes - centered vertically with left padding
        const totalTextHeight =
          Math.max(descLines.length, notesLines.length) * lineHeight;
        const textStartY =
          yPosition - 12 + (rowHeight - totalTextHeight) / 2 + lineHeight; // Center the text block

        // Ensure both description and notes are handled identically
        descLines.forEach((line, index) => {
          doc.text(
            line,
            colPositions.description + 3,
            textStartY + index * lineHeight
          );
        });

        notesLines.forEach((line, index) => {
          doc.text(
            line,
            colPositions.notes + 3,
            textStartY + index * lineHeight
          );
        });

        yPosition += rowHeight + 2;
      });

      // Scene notes
      const sceneNote = sceneNotes[scene.sceneNumber];
      if (sceneNote && sceneNote.trim()) {
        yPosition += 5;
        doc.setFillColor(240, 240, 240);
        doc.rect(40, yPosition - 12, pageWidth - 80, 18, "F");
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(6); // 30% smaller
        doc.setFont(undefined, "bold");
        doc.text("Scene Notes:", 50, yPosition);
        doc.setFont(undefined, "normal");
        // Use full scene notes without truncation
        doc.text(sceneNote, 130, yPosition);
        yPosition += 25;
      } else {
        yPosition += 15;
      }
    });

    // Save the PDF
    const filename =
      selectedDate === "all"
        ? "shot-list-all-scenes.pdf"
        : `shot-list-day-${dayInfo?.dayNumber || "unknown"}.pdf`;
    doc.save(filename);
  }, [
    selectedDate,
    scheduledDates,
    filteredScenes,
    shotListData,
    sceneNotes,
    getSceneCastNumbers,
    initializeSceneShots,
    colorOptions,
  ]);

  if (!stripboardScenes || stripboardScenes.length === 0) {
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
        <h2>Shot List</h2>
        <p>No scenes available. Please load scenes in the Stripboard first.</p>
      </div>
    );
  }

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
        <h2>Shot List</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontWeight: "bold" }}>Filter by Date:</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              border: "1px solid #ccc",
              borderRadius: "3px",
            }}
          >
            <option value="all">All Scenes</option>
            {scheduledDates.map((dayInfo) => (
              <option key={dayInfo.date} value={dayInfo.date}>
                Day {dayInfo.dayNumber}{" "}
                {new Date(dayInfo.date + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "short" }
                )}{" "}
                {new Date(dayInfo.date + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { month: "2-digit", day: "2-digit", year: "numeric" }
                )}
              </option>
            ))}
          </select>
          <button
            onClick={exportToPDF}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              border: "1px solid #45a049",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            Export PDF
          </button>
        </div>
      </div>

      {filteredScenes.map((scene) => {
        const shots =
          shotListData[scene.sceneNumber] ||
          initializeSceneShots(scene.sceneNumber);
        const sceneCastNumbers = getSceneCastNumbers(scene.sceneNumber);

        return (
          <div key={scene.sceneNumber} style={{ marginBottom: "5px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#4CAF50",
                color: "white",
                fontWeight: "bold",
                fontSize: "12px",
                padding: "8px",
                marginBottom: "1px",
              }}
            >
              <div style={{ display: "flex", gap: "20px" }}>
                <div
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => {
                    setPreviewSceneNumber(scene.sceneNumber);
                    setShowScenePreview(true);
                  }}
                >
                  Scene {scene.sceneNumber}
                </div>
                <div>{scene.metadata?.intExt || ""}</div>
                <div>{scene.metadata?.location || ""}</div>
                <div>{scene.pageNumber || "1"}</div>
                <div>{scene.pageLength || "1/8"}</div>
              </div>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <button
                  onClick={() => {
                    setPreviewSceneNumber(scene.sceneNumber);
                    setShowScenePreview(true);
                  }}
                  style={{
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "1px solid #1976D2",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "10px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  View Scene
                </button>
                <button
                  onClick={() => addShotRow(scene.sceneNumber)}
                  style={{
                    backgroundColor: "#2E7D32",
                    color: "white",
                    border: "1px solid #1B5E20",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "35px 60px 40px 80px 60px 60px 80px 80px 100px 325px 325px",
                gap: "1px",
                backgroundColor: "#2196F3",
                color: "white",
                fontWeight: "bold",
                fontSize: "11px",
                padding: "6px",
                marginBottom: "1px",
              }}
            >
              <div>Color</div>
              <div>Shot</div>
              <div>Cast</div>
              <div>Shot Type</div>
              <div>Lens</div>
              <div>Setup</div>
              <div>Angle</div>
              <div>Movement</div>
              <div>Equipment</div>
              <div>Description</div>
              <div>Additional Notes</div>
            </div>

            {shots.map((shot, shotIndex) => (
              <PresenceIndicator
                key={shot.id}
                itemId={shot.id}
                otherUsers={otherUsers}
                position="top"
              >
                <div
                  draggable="true"
                  onDragStart={(e) =>
                    handleDragStart(e, scene.sceneNumber, shotIndex)
                  }
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) =>
                    handleDragOver(e, scene.sceneNumber, shotIndex)
                  }
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, scene.sceneNumber, shotIndex)}
                  style={{
                    display: "flex",
                    gap: "1px",
                    backgroundColor: (() => {
                      if (dragOverIndex === shotIndex && draggedShot?.sceneNumber === scene.sceneNumber) return "#e3f2fd";
                      const colorMatch = colorOptions.find((c) => c.value === shot.colorCode)?.color;
                      if (shot.colorCode && colorMatch && colorMatch !== "transparent") return colorMatch;
                      return shotIndex % 2 === 0 ? "#E3F2FD" : "#FFE0E0";
                    })(),
                    border:
                      dragOverIndex === shotIndex &&
                      draggedShot?.sceneNumber === scene.sceneNumber
                        ? "2px solid #2196F3"
                        : "1px solid #ddd",
                    fontSize: "10px",
                    padding: "2px",
                    marginBottom: "1px",
                    alignItems: "stretch",
                    minWidth: "0",
                    overflowX: "auto",
                    flexWrap: "nowrap",
                    minHeight: "20px",
                    cursor: "grab",
                    transition: "background-color 0.2s, border 0.2s",
                    position: "relative",
                    zIndex: "1",
                  }}
                >
                  <div
                    style={{
                      width: "35px",
                      minHeight: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: "35px",
                        minHeight: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          backgroundColor:
                            colorOptions.find((c) => c.value === shot.colorCode)?.color || "transparent",
                          border:
                            shot.colorCode === ""
                              ? "1px dashed #ccc"
                              : "1px solid #999",
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();

                          // Remove any existing dropdown
                          const existingDropdown = document.querySelector(
                            ".color-dropdown-overlay"
                          );
                          if (existingDropdown) {
                            existingDropdown.remove();
                          }

                          // Get button position relative to viewport
                          const rect = e.currentTarget.getBoundingClientRect();

                          // Create dropdown as overlay
                          const dropdown = document.createElement("div");
                          dropdown.className = "color-dropdown-overlay";
                          dropdown.style.cssText = `
                          position: fixed;
                          top: ${rect.bottom + 2}px;
                          left: ${rect.left}px;
                          background-color: white;
                          border: 1px solid #ccc;
                          border-radius: 4px;
                          padding: 4px;
                          z-index: 99999;
                          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                          display: flex;
                          flex-direction: column;
                          gap: 2px;
                        `;

                          // Add color options
                          colorOptions.forEach((option) => {
                            const colorDiv = document.createElement("div");
                            colorDiv.style.cssText = `
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background-color: ${option.color};
                            border: ${
                              option.value === ""
                                ? "1px dashed #ccc"
                                : "1px solid #999"
                            };
                            cursor: pointer;
                            margin: 1px;
                          `;
                            colorDiv.addEventListener("click", () => {
                              updateShotField(
                                scene.sceneNumber,
                                shotIndex,
                                "colorCode",
                                option.value
                              );
                              dropdown.remove();
                            });
                            dropdown.appendChild(colorDiv);
                          });

                          // Add to body and auto-remove on outside click
                          document.body.appendChild(dropdown);

                          const removeDropdown = (e) => {
                            if (!dropdown.contains(e.target)) {
                              dropdown.remove();
                              document.removeEventListener(
                                "click",
                                removeDropdown
                              );
                            }
                          };

                          setTimeout(() => {
                            document.addEventListener("click", removeDropdown);
                          }, 0);
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ width: "80px", minHeight: "16px" }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        paddingTop: "4px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {shots.length > 1 && (
                        <button
                          onClick={() =>
                            removeShotRow(scene.sceneNumber, shotIndex)
                          }
                          style={{
                            marginRight: "4px",
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "2px",
                            cursor: "pointer",
                            fontSize: "8px",
                            padding: "1px 3px",
                          }}
                        >
                          ×
                        </button>
                      )}
                      {shot.id}
                    </div>
                  </div>

                  <div style={{ width: "40px", minHeight: "16px" }}>
                  <div style={{ fontSize: "10px", paddingTop: "4px" }}>
                      {sceneCastNumbers}
                    </div>
                  </div>

                  <div style={{ width: "80px", minHeight: "16px" }}>
                    {renderShotTypeField(scene.sceneNumber, shotIndex, shot)}
                  </div>

                  <div style={{ width: "60px", minHeight: "16px" }}>
                    <EditableInput
                      variant="shotlist"
                      shotId={shot.id}
                      value={shot.lens}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "lens",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Lens"
                    />
                  </div>

                  <div style={{ width: "60px", minHeight: "16px" }}>
                    <EditableInput
                      variant="shotlist"
                      shotId={shot.id}
                      value={shot.setup}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "setup",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Setup"
                    />
                  </div>

                  <div style={{ width: "80px", minHeight: "16px" }}>
                    <EditableInput
                      variant="shotlist"
                      shotId={shot.id}
                      value={shot.angle}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "angle",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Angle"
                    />
                  </div>

                  <div style={{ width: "80px", minHeight: "16px" }}>
                    <EditableInput
                      variant="shotlist"
                      shotId={shot.id}
                      value={shot.movement}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "movement",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Movement"
                    />
                  </div>

                  <div style={{ width: "100px", minHeight: "16px" }}>
                    {renderEquipmentField(scene.sceneNumber, shotIndex, shot)}
                  </div>

                  <div style={{ width: "325px", minHeight: "auto" }}>
                    <EditableInput
                      variant="shotlist-multiline"
                      shotId={shot.id}
                      value={shot.description}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "description",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Description"
                    />
                  </div>

                  <div style={{ width: "325px", minHeight: "auto" }}>
                    <EditableInput
                      variant="shotlist-multiline"
                      shotId={shot.id}
                      value={shot.additionalNotes}
                      onSave={(value) =>
                        updateShotField(
                          scene.sceneNumber,
                          shotIndex,
                          "additionalNotes",
                          value
                        )
                      }
                      onFocusShot={setEditingShotId}
                      onBlurShot={() => setEditingShotId(null)}
                      placeholder="Additional Notes"
                    />
                  </div>
                </div>
              </PresenceIndicator>
            ))}

            <div
              style={{
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                padding: "8px",
                marginBottom: "2px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  minWidth: "75px",
                  flexShrink: 0,
                }}
              >
                Scene Notes:
              </div>
              <div style={{ flex: 1 }}>
                <EditableInput
                  value={sceneNotes[scene.sceneNumber]}
                  onSave={(value) => updateSceneNotes(scene.sceneNumber, value)}
                  placeholder="Add notes for this scene..."
                  style={{
                    border: "1px solid #ccc",
                    backgroundColor: "white",
                    width: "100%",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Script Popup Modal with exact Script module styling */}
      {showScenePreview && previewSceneNumber && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.7)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowScenePreview(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                width: "90%",
                maxWidth: "9.28in",
                height: "85%",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  backgroundColor: "#2196F3",
                  color: "white",
                  padding: "15px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  Scene {previewSceneNumber} -{" "}
                  {stripboardScenes.find(
                    (s) => s.sceneNumber === previewSceneNumber
                  )?.heading || "Scene Preview"}
                </h3>
                <button
                  onClick={() => setShowScenePreview(false)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: "24px",
                    cursor: "pointer",
                    padding: "0 5px",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Script Content with exact Script module styling */}
              <div
                style={{
                  flex: 1,
                  padding: "1.5in",
                  overflow: "auto",
                  backgroundColor: (() => {
                    const stripboardScene = stripboardScenes?.find(
                      (s) => s.sceneNumber === previewSceneNumber
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
                  })(),
                  boxSizing: "border-box",
                  textAlign: "left",
                  fontFamily: "Courier New, monospace",
                }}
              >
                {(() => {
                  const scene = stripboardScenes.find(
                    (s) => s.sceneNumber === previewSceneNumber
                  );
                  if (!scene)
                    return (
                      <div
                        style={{
                          fontFamily: "Courier New, monospace",
                          fontSize: "12pt",
                          lineHeight: "12pt",
                          marginBottom: "12pt",
                        }}
                      >
                        Scene not found
                      </div>
                    );

                  const getElementStyle = (type) => {
                    const baseStyle = {
                      fontFamily: "Courier New, monospace",
                      fontSize: "12pt",
                      lineHeight: "12pt",
                      marginBottom: "12pt",
                      color: "#000",
                    };

                    switch (type) {
                      case "Character":
                        return {
                          ...baseStyle,
                          marginLeft: "200px",
                          textTransform: "uppercase",
                          fontWeight: "normal",
                        };
                      case "Dialogue":
                        return {
                          ...baseStyle,
                          marginLeft: "100px",
                          marginRight: "100px",
                        };
                      case "Parenthetical":
                        return {
                          ...baseStyle,
                          marginLeft: "150px",
                          fontStyle: "italic",
                        };
                      case "Action":
                        return {
                          ...baseStyle,
                          marginLeft: "0",
                          marginRight: "0",
                        };
                      case "Scene Heading":
                        return {
                          ...baseStyle,
                          marginLeft: "0",
                          marginRight: "0",
                          textTransform: "uppercase",
                          fontWeight: "bold",
                          marginTop: "24pt",
                        };
                      default:
                        return baseStyle;
                    }
                  };

                  return (
                    <>
                      {/* Scene Heading */}
                      <div style={getElementStyle("Scene Heading")}>
                        {scene.heading}
                      </div>

                      {/* Scene Content with exact element styling */}
                      {scene.content &&
                        scene.content.map((block, blockIndex) => (
                          <div
                            key={blockIndex}
                            style={getElementStyle(block.type)}
                          >
                            {block.text}
                          </div>
                        ))}

                      {/* Fallback if content structure is different */}
                      {!scene.content && (
                        <div style={getElementStyle("Action")}>
                          {scene.text || "Scene content not available"}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ShotListModule;
