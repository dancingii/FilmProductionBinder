import React, { useState } from "react";
import { PDFExporter } from "../../../utils/pdfExport";
import ImageViewer from "../../shared/ImageViewer";

function ReportsModule({
  shootingDays,
  scheduledScenes,
  stripboardScenes,
  taggedItems,
  wardrobeItems,
  garmentInventory,
  scenes,
  projectSettings,
}) {
  // Smart default selection function
  // Build the same scene-sorted prop number map as the Props module
  // so report numbers always match what's on the props badge
  const getPropNumberMap = () => {
    const getEarliestScene = (prop) => {
      const nums = (prop.scenes || [])
        .map((n) => parseFloat(n))
        .filter((n) => !isNaN(n));
      return nums.length > 0 ? Math.min(...nums) : Infinity;
    };
    const sorted = Object.entries(taggedItems)
      .filter(([, item]) => item.category === "Props")
      .sort((a, b) => {
        const d = getEarliestScene(a[1]) - getEarliestScene(b[1]);
        return d !== 0
          ? d
          : (a[1].chronologicalNumber || 0) - (b[1].chronologicalNumber || 0);
      });
    return Object.fromEntries(sorted.map(([word], idx) => [word, idx + 1]));
  };
  const propNumberMap = getPropNumberMap();

  const getSmartDefaultDay = (shootingDays) => {
    if (!shootingDays || shootingDays.length === 0) return "";

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // If today matches a shooting day, select it
    const todayMatch = shootingDays.find((day) => day.date === todayStr);
    if (todayMatch) return todayMatch.id.toString();

    // Find closest future day
    const futureDays = shootingDays
      .filter((day) => day.date > todayStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (futureDays.length > 0) return futureDays[0].id.toString();

    // Fallback to most recent past day
    const pastDays = shootingDays
      .filter((day) => day.date < todayStr)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return pastDays.length > 0
      ? pastDays[0].id.toString()
      : shootingDays[0].id.toString();
  };

  const [selectedDayId, setSelectedDayId] = useState("");
  const [activeTab, setActiveTab] = useState("props");
  const [checkedItems, setCheckedItems] = useState({});
  // Local image viewer state (replaces App-level state dependency)
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Get available shooting days for dropdown
  const availableDays = shootingDays.filter((day) => {
    const dayScenes = scheduledScenes[day.date];
    const hasScenes = dayScenes && dayScenes.length > 0;
    return hasScenes;
  });

  // Auto-select smart default day
  React.useEffect(() => {
    if (availableDays.length > 0 && !selectedDayId) {
      const smartDefault = getSmartDefaultDay(availableDays);
      setSelectedDayId(smartDefault);
    }
  }, [availableDays.length, selectedDayId]);

  // Get scenes for selected day using CallSheet's two-tier approach
  const getSelectedDayScenes = () => {
    if (!selectedDayId || selectedDayId === "") return [];

    const selectedDay = shootingDays.find((day) => {
      return (
        day.id === selectedDayId ||
        day.id === parseInt(selectedDayId) ||
        day.id.toString() === selectedDayId
      );
    });

    if (!selectedDay) return [];

    // Priority 1: Use scheduleBlocks from shooting day (like CallSheet)
    if (selectedDay.scheduleBlocks && selectedDay.scheduleBlocks.length > 0) {
      const sceneObjects = selectedDay.scheduleBlocks
        .filter((block) => block.scene && !block.isLunch && !block.customItem)
        .map((block) => block.scene);

      return sceneObjects;
    }

    // Fallback: Use scheduledScenes object only if no scheduleBlocks
    const daySceneIds = scheduledScenes[selectedDay.date] || [];

    const sceneObjects = daySceneIds
      .map((sceneNumber) => {
        const foundScene = stripboardScenes.find(
          (scene) =>
            scene.sceneNumber === sceneNumber ||
            scene.sceneNumber === parseInt(sceneNumber) ||
            scene.sceneNumber.toString() === sceneNumber.toString()
        );
        return foundScene;
      })
      .filter(Boolean);

    return sceneObjects;
  };

  // Get props for selected scenes
  const getPropsReport = () => {
    const dayScenes = getSelectedDayScenes();
    const propsData = [];

    dayScenes.forEach((scene) => {
        const sceneProps = [];
        const sceneArrayIndex = scenes.findIndex(
          (s) => String(s.sceneNumber) === String(scene.sceneNumber)
        );
  
        Object.entries(taggedItems).forEach(([word, item]) => {
          if (item.category && item.category.toLowerCase() === "props") {
            const inScenesArray = (item.scenes || []).some(
              (s) => String(s) === String(scene.sceneNumber)
            );
            const matchingInstances = (item.instances || []).filter((instance) => {
              if (typeof instance === "string") {
                return parseInt(instance.split("-")[0]) === sceneArrayIndex;
              } else if (instance.sceneNumber) {
                return (
                  parseInt(instance.sceneNumber) === parseInt(scene.sceneNumber) &&
                  !instance.excluded
                );
              }
              return false;
            });
            if (inScenesArray || matchingInstances.length > 0) {
              sceneProps.push({
                word,
                instances: Math.max(matchingInstances.length, 1),
                description: item.description || "",
              });
            }
          }
        });

      if (sceneProps.length > 0) {
        propsData.push({
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.heading,
          props: sceneProps,
        });
      }
    });

    return propsData;
  };

  // Get production design for selected scenes
  const getProductionDesignReport = () => {
    const dayScenes = getSelectedDayScenes();
    const productionDesignData = [];

    dayScenes.forEach((scene) => {
        const sceneProductionDesign = [];
        const sceneArrayIndex = scenes.findIndex(
          (s) => String(s.sceneNumber) === String(scene.sceneNumber)
        );
  
        Object.entries(taggedItems).forEach(([word, item]) => {
          if (item.category && item.category.toLowerCase() === "production design") {
            const inScenesArray = (item.scenes || []).some(
              (s) => String(s) === String(scene.sceneNumber)
            );
            const matchingInstances = (item.instances || []).filter((instance) => {
              if (typeof instance === "string") {
                return parseInt(instance.split("-")[0]) === sceneArrayIndex;
              } else if (instance.sceneNumber) {
                return (
                  parseInt(instance.sceneNumber) === parseInt(scene.sceneNumber) &&
                  !instance.excluded
                );
              }
              return false;
            });
            if (inScenesArray || matchingInstances.length > 0) {
              sceneProductionDesign.push({
                word,
                instances: Math.max(matchingInstances.length, 1),
                description: item.description || "",
              });
            }
          }
        });

      if (sceneProductionDesign.length > 0) {
        productionDesignData.push({
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.heading,
          items: sceneProductionDesign,
        });
      }
    });

    return productionDesignData;
  };

  // Get makeup for selected scenes
  const getMakeupReport = () => {
    const dayScenes = getSelectedDayScenes();
    const makeupData = [];

    dayScenes.forEach((scene) => {
        const sceneMakeup = [];
        const sceneArrayIndex = scenes.findIndex(
          (s) => String(s.sceneNumber) === String(scene.sceneNumber)
        );
  
        Object.entries(taggedItems).forEach(([word, item]) => {
          if (item.category && item.category.toLowerCase() === "makeup") {
            const inScenesArray = (item.scenes || []).some(
              (s) => String(s) === String(scene.sceneNumber)
            );
            const matchingInstances = (item.instances || []).filter((instance) => {
              if (typeof instance === "string") {
                return parseInt(instance.split("-")[0]) === sceneArrayIndex;
              } else if (instance.sceneNumber) {
                return (
                  parseInt(instance.sceneNumber) === parseInt(scene.sceneNumber) &&
                  !instance.excluded
                );
              }
              return false;
            });
            if (inScenesArray || matchingInstances.length > 0) {
              sceneMakeup.push({
                word,
                instances: Math.max(matchingInstances.length, 1),
                description: item.description || "",
              });
            }
          }
        });

      if (sceneMakeup.length > 0) {
        makeupData.push({
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.heading,
          items: sceneMakeup,
        });
      }
    });

    return makeupData;
  };

  // Get wardrobe for selected scenes
  const getWardrobeReport = () => {
    const dayScenes = getSelectedDayScenes();
    const wardrobeData = [];

    dayScenes.forEach((scene) => {
      const sceneWardrobe = [];

      wardrobeItems.forEach((character) => {
        character.items.forEach((wardrobeItem) => {
          if (
            wardrobeItem.scenes &&
            wardrobeItem.scenes.includes(parseInt(scene.sceneNumber))
          ) {
            const assignedGarments = (wardrobeItem.assignedGarments || [])
              .map((garmentId) =>
                garmentInventory.find((g) => g.id === garmentId)
              )
              .filter(Boolean);

            sceneWardrobe.push({
              character: character.characterName,
              wardrobeNumber: wardrobeItem.number,
              wardrobeDescription: wardrobeItem.description || "Untitled",
              garments: assignedGarments,
            });
          }
        });
      });

      if (sceneWardrobe.length > 0) {
        wardrobeData.push({
          sceneNumber: scene.sceneNumber,
          sceneHeading: scene.heading,
          wardrobe: sceneWardrobe,
        });
      }
    });

    return wardrobeData;
  };

  // Toggle checklist item
  const toggleCheckItem = (category, sceneNumber, itemId) => {
    const key = `${category}_${sceneNumber}_${itemId}`;
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Export report as PDF with visual styling
  const exportDepartmentReportPDF = (department) => {
    const selectedDay = shootingDays.find((day) => {
      const dayId = day.id.toString();
      const searchId = selectedDayId.toString();
      return dayId === searchId;
    });

    if (!selectedDay) {
      alert(
        "Selected shooting day not found. Please try selecting a day again."
      );
      return;
    }

    let reportData;
    let departmentName;

    switch (department) {
      case "props":
        reportData = getPropsReport();
        departmentName = "Props";
        break;
      case "productiondesign":
        reportData = getProductionDesignReport();
        departmentName = "Production Design";
        break;
      case "makeup":
        reportData = getMakeupReport();
        departmentName = "Makeup";
        break;
      case "wardrobe":
        reportData = getWardrobeReport();
        departmentName = "Wardrobe";
        break;
      default:
        return;
    }

    const content = [];

    content.push(
      PDFExporter.createProjectHeader(
        `${departmentName} Report`,
        null,
        projectSettings?.filmTitle || "Film Production"
      )
    );

    content.push(
      PDFExporter.createProjectInfo(
        projectSettings?.filmTitle || "Film Production",
        `Shooting Day: ${selectedDay.date} - Day ${selectedDay.dayNumber}`,
        selectedDay.location
      )
    );

    if (reportData.length > 0) {
      reportData.forEach((sceneData) => {
        content.push(
          PDFExporter.createSceneHeader(
            sceneData.sceneNumber,
            sceneData.sceneHeading
          )
        );

        if (department === "wardrobe") {
          sceneData.wardrobe.forEach((item, wardrobeIndex) => {
            const wardrobeSection = {
              stack: [
                {
                  text: `W_${String(wardrobeIndex + 1).padStart(2, "0")} - ${
                    item.character
                  } - Wardrobe #${item.wardrobeNumber}`,
                  fontSize: 10,
                  bold: true,
                  color: "#2196F3",
                  margin: [0, 0, 0, 5],
                },
              ],
              margin: [15, 0, 0, 10],
            };

            if (item.wardrobeDescription) {
              wardrobeSection.stack.push({
                text: item.wardrobeDescription,
                fontSize: 9,
                color: "#666666",
                margin: [0, 0, 0, 5],
              });
            }

            if (item.garments && item.garments.length > 0) {
              const garmentRows = [];
              for (let i = 0; i < item.garments.length; i += 3) {
                const rowGarments = item.garments.slice(i, i + 3);
                const row = rowGarments.map((garment) => ({
                  stack: [
                    {
                      text: `${garment.id} - ${garment.name}`,
                      fontSize: 8,
                      bold: true,
                    },
                    {
                      text: `${garment.category} | ${garment.size} | ${garment.color}`,
                      fontSize: 7,
                      color: "#666666",
                    },
                  ],
                  border: [true, true, true, true],
                  margin: [3, 3, 3, 3],
                }));

                while (row.length < 3) {
                  row.push({
                    text: "",
                    border: [true, true, true, true],
                    margin: [3, 3, 3, 3],
                  });
                }

                garmentRows.push(row);
              }

              wardrobeSection.stack.push({
                table: {
                  widths: ["*", "*", "*"],
                  body: garmentRows,
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                },
                margin: [0, 5, 0, 0],
              });
            } else {
              wardrobeSection.stack.push({
                text: "No garments assigned",
                fontSize: 9,
                italics: true,
                color: "#666666",
              });
            }

            content.push(wardrobeSection);
          });
        } else {
          const items = sceneData.props || sceneData.items || [];

          if (items.length > 0) {
            const tableRows = items.map((item) => {
              let itemText = item.word;
              let instancesText =
                item.instances > 1 ? `${item.instances}x` : "1x";
              let descText = item.description || "";
              return [itemText, instancesText, descText];
            });

            content.push(
              PDFExporter.createTable(
                ["Item", "Qty", "Description"],
                tableRows,
                [150, 40, "*"]
              )
            );
          }
        }
      });
    } else {
      content.push({
        text: `No ${departmentName.toLowerCase()} items assigned for scenes on this shooting day.`,
        fontSize: 12,
        italics: true,
        color: "#666666",
        margin: [0, 20, 0, 0],
      });
    }

    const docDef = PDFExporter.getBaseDocDef("portrait");
    docDef.content = content;
    docDef.footer = PDFExporter.createFooterFunction(
      projectSettings?.filmTitle || "Film Production"
    );

    const date = new Date(selectedDay.date);
    const dateStr = date.toISOString().split("T")[0];
    const filename = `${departmentName.toLowerCase()}-report-${dateStr}.pdf`;
    PDFExporter.download(docDef, filename);

    alert(`${departmentName} PDF report exported as: ${filename}`);
  };

  const selectedDay = shootingDays.find(
    (day) => day.id === parseInt(selectedDayId)
  );
  const dayScenes = getSelectedDayScenes();

  if (availableDays.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Production Reports</h2>
        <p>No shooting days with scheduled scenes found.</p>
        <p>Please schedule scenes in the Stripboard Schedule module first.</p>
      </div>
    );
  }

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
      {/* Local image viewer */}
      {showImageViewer && (
        <ImageViewer
          images={selectedImages}
          currentIndex={currentImageIndex}
          onClose={() => setShowImageViewer(false)}
          onNavigate={setCurrentImageIndex}
        />
      )}

      <h2>Production Reports</h2>

      {/* Day Selection */}
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "15px",
        }}
      >
        <label style={{ fontWeight: "bold" }}>Shooting Day:</label>
        <select
          value={selectedDayId}
          onChange={(e) => setSelectedDayId(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
            minWidth: "200px",
          }}
        >
          <option value="">Select a shooting day</option>
          {availableDays.map((day) => {
            const date = new Date(day.date + "T00:00:00");
            const dayName = date.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const formattedDate = date.toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            });
            return (
              <option key={day.id} value={day.id}>
                Day {day.dayNumber || "?"} {dayName} {formattedDate}
              </option>
            );
          })}
        </select>
      </div>

      {selectedDay && (
        <div
          style={{
            backgroundColor: "#f0f8ff",
            border: "1px solid #0066cc",
            borderRadius: "6px",
            padding: "15px",
            marginBottom: "25px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", color: "#0066cc" }}>
            {selectedDay.date} - Shooting Day {selectedDay.dayNumber || "?"}
          </h3>
          {selectedDay.location && (
            <p style={{ margin: "5px 0", fontWeight: "bold" }}>
              Location: {selectedDay.location}
            </p>
          )}
          <p style={{ margin: "5px 0" }}>
            <strong>Scenes:</strong>{" "}
            {dayScenes.map((s) => s.sceneNumber).join(", ")}
          </p>
          <p style={{ margin: "5px 0" }}>
            <strong>Total Scenes:</strong> {dayScenes.length}
          </p>
        </div>
      )}

      {/* Department Tabs */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", borderBottom: "2px solid #ddd" }}>
          {[
            { id: "props", label: "Props" },
            { id: "productiondesign", label: "Production Design" },
            { id: "makeup", label: "Makeup" },
            { id: "wardrobe", label: "Wardrobe" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 20px",
                border: "none",
                backgroundColor:
                  activeTab === tab.id ? "#2196F3" : "transparent",
                color: activeTab === tab.id ? "white" : "#666",
                cursor: "pointer",
                borderRadius: "6px 6px 0 0",
                fontWeight: activeTab === tab.id ? "bold" : "normal",
                marginRight: "2px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div style={{ minHeight: "400px" }}>

        {/* Props Report */}
        {activeTab === "props" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Props Report</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => exportDepartmentReportPDF("props")}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {getPropsReport().length > 0 ? (
              getPropsReport().map((sceneData) => (
                <div
                  key={sceneData.sceneNumber}
                  style={{
                    marginBottom: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "15px",
                  }}
                >
                  <h4 style={{ color: "#2196F3", marginBottom: "10px" }}>
                    Scene {sceneData.sceneNumber}: {sceneData.sceneHeading}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(125px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {sceneData.props.map((prop, index) => {
                      const checkKey = `props_${sceneData.sceneNumber}_${prop.word}`;
                      return (
                        <div
                          key={prop.word}
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            padding: "8px",
                            fontSize: "12px",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            {(() => {
                              const fullTaggedItem = taggedItems[prop.word];
                              const displayName =
                                fullTaggedItem?.customTitle ||
                                fullTaggedItem?.displayName ||
                                prop.word;
                              const number =
                                propNumberMap[prop.word] ||
                                fullTaggedItem?.chronologicalNumber ||
                                index + 1;
                              return `${number}. ${displayName}`;
                            })()}
                          </div>
                          {(() => {
                            const chars = taggedItems[prop.word]?.assignedCharacters || [];
                            const color = taggedItems[prop.word]?.color || "#999";
                            return chars.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "4px" }}>
                                {chars.map((c) => (
                                  <span key={c} style={{
                                    backgroundColor: color,
                                    color: "white",
                                    borderRadius: "10px",
                                    padding: "1px 7px",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                  }}>{c}</span>
                                ))}
                              </div>
                            ) : null;
                          })()}
                          {prop.instances > 1 && (
                            <div
                              style={{
                                color: "#666",
                                fontSize: "11px",
                                marginBottom: "2px",
                              }}
                            >
                              ({prop.instances} instances)
                            </div>
                          )}
                          {prop.description && (
                            <div style={{ color: "#666", marginBottom: "4px" }}>
                              {prop.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checkedItems[checkKey] || false}
                              onChange={() =>
                                toggleCheckItem(
                                  "props",
                                  sceneData.sceneNumber,
                                  prop.word
                                )
                              }
                            />
                            <label style={{ fontSize: "11px", color: "#666" }}>
                              Acquired
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No props tagged for scenes on this shooting day.
              </p>
            )}
          </div>
        )}

        {/* Production Design Report */}
        {activeTab === "productiondesign" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Production Design Report</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => exportDepartmentReportPDF("productiondesign")}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {getProductionDesignReport().length > 0 ? (
              getProductionDesignReport().map((sceneData) => (
                <div
                  key={sceneData.sceneNumber}
                  style={{
                    marginBottom: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "15px",
                  }}
                >
                  <h4 style={{ color: "#2196F3", marginBottom: "10px" }}>
                    Scene {sceneData.sceneNumber}: {sceneData.sceneHeading}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {sceneData.items.map((item, index) => {
                      const checkKey = `productiondesign_${sceneData.sceneNumber}_${item.word}`;
                      return (
                        <div
                          key={item.word}
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            padding: "8px",
                            fontSize: "12px",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            {(() => {
                              const fullTaggedItem = taggedItems[item.word];
                              const displayName =
                                fullTaggedItem?.customTitle ||
                                fullTaggedItem?.displayName ||
                                item.word;
                              const number =
                                propNumberMap[item.word] ||
                                fullTaggedItem?.chronologicalNumber ||
                                index + 1;
                              return `${number}. ${displayName}`;
                            })()}
                          </div>
                          {item.instances > 1 && (
                            <div
                              style={{
                                color: "#666",
                                fontSize: "11px",
                                marginBottom: "2px",
                              }}
                            >
                              ({item.instances} instances)
                            </div>
                          )}
                          {item.description && (
                            <div style={{ color: "#666", marginBottom: "4px" }}>
                              {item.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checkedItems[checkKey] || false}
                              onChange={() =>
                                toggleCheckItem(
                                  "productiondesign",
                                  sceneData.sceneNumber,
                                  item.word
                                )
                              }
                            />
                            <label style={{ fontSize: "11px", color: "#666" }}>
                              Ready
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No production design items tagged for scenes on this shooting
                day.
              </p>
            )}
          </div>
        )}

        {/* Makeup Report */}
        {activeTab === "makeup" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Makeup Report</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => exportDepartmentReportPDF("makeup")}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {getMakeupReport().length > 0 ? (
              getMakeupReport().map((sceneData) => (
                <div
                  key={sceneData.sceneNumber}
                  style={{
                    marginBottom: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "15px",
                  }}
                >
                  <h4 style={{ color: "#2196F3", marginBottom: "10px" }}>
                    Scene {sceneData.sceneNumber}: {sceneData.sceneHeading}
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(250px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {sceneData.items.map((item, index) => {
                      const checkKey = `makeup_${sceneData.sceneNumber}_${item.word}`;
                      return (
                        <div
                          key={item.word}
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            padding: "8px",
                            fontSize: "12px",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{ fontWeight: "bold", marginBottom: "4px" }}
                          >
                            {(() => {
                              const fullTaggedItem = taggedItems[item.word];
                              const displayName =
                                fullTaggedItem?.customTitle ||
                                fullTaggedItem?.displayName ||
                                item.word;
                              const number =
                                propNumberMap[item.word] ||
                                fullTaggedItem?.chronologicalNumber ||
                                index + 1;
                              return `${number}. ${displayName}`;
                            })()}
                          </div>
                          {item.instances > 1 && (
                            <div
                              style={{
                                color: "#666",
                                fontSize: "11px",
                                marginBottom: "2px",
                              }}
                            >
                              ({item.instances} instances)
                            </div>
                          )}
                          {item.description && (
                            <div style={{ color: "#666", marginBottom: "4px" }}>
                              {item.description}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checkedItems[checkKey] || false}
                              onChange={() =>
                                toggleCheckItem(
                                  "makeup",
                                  sceneData.sceneNumber,
                                  item.word
                                )
                              }
                            />
                            <label style={{ fontSize: "11px", color: "#666" }}>
                              Applied
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No makeup items tagged for scenes on this shooting day.
              </p>
            )}
          </div>
        )}

        {/* Wardrobe Report */}
        {activeTab === "wardrobe" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Wardrobe Report</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => exportDepartmentReportPDF("wardrobe")}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {getWardrobeReport().length > 0 ? (
              getWardrobeReport().map((sceneData) => (
                <div
                  key={sceneData.sceneNumber}
                  style={{
                    marginBottom: "20px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "15px",
                  }}
                >
                  <h4 style={{ color: "#2196F3", marginBottom: "10px" }}>
                    Scene {sceneData.sceneNumber}: {sceneData.sceneHeading}
                  </h4>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {sceneData.wardrobe.map((wardrobeItem, index) => {
                      const checkKey = `wardrobe_${sceneData.sceneNumber}_${wardrobeItem.character}_${wardrobeItem.wardrobeNumber}`;
                      return (
                        <div
                          key={index}
                          style={{
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            padding: "15px",
                            backgroundColor: "white",
                          }}
                        >
                          {/* Wardrobe Header */}
                          <div style={{ marginBottom: "10px" }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                                color: "#2196F3",
                              }}
                            >
                              W_{String(index + 1).padStart(2, "0")} -{" "}
                              {wardrobeItem.character} #
                              {wardrobeItem.wardrobeNumber}
                            </div>
                            <div
                              style={{
                                color: "#666",
                                marginBottom: "8px",
                                fontSize: "12px",
                              }}
                            >
                              {wardrobeItem.wardrobeDescription}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "4px",
                                alignItems: "center",
                                marginBottom: "10px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checkedItems[checkKey] || false}
                                onChange={() =>
                                  toggleCheckItem(
                                    "wardrobe",
                                    sceneData.sceneNumber,
                                    `${wardrobeItem.character}_${wardrobeItem.wardrobeNumber}`
                                  )
                                }
                              />
                              <label
                                style={{ fontSize: "11px", color: "#666" }}
                              >
                                Wardrobe Ready
                              </label>
                            </div>
                          </div>

                          {/* Individual Garments */}
                          {wardrobeItem.garments.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fill, minmax(250px, 1fr))",
                                gap: "8px",
                              }}
                            >
                              {wardrobeItem.garments.map(
                                (garment, garmentIndex) => (
                                  <div
                                    key={garment.id}
                                    style={{
                                      backgroundColor: "white",
                                      border: "1px solid #ddd",
                                      borderRadius: "4px",
                                      padding: "8px",
                                      fontSize: "12px",
                                      position: "relative",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: "bold",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          {garment.id} - {garment.name}
                                        </div>
                                        <div
                                          style={{
                                            color: "#666",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          {garment.category} | {garment.size} |{" "}
                                          {garment.color}
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: "4px",
                                            alignItems: "center",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={
                                              checkedItems[
                                                `garment_${sceneData.sceneNumber}_${wardrobeItem.character}_${wardrobeItem.wardrobeNumber}_${garment.id}`
                                              ] || false
                                            }
                                            onChange={() =>
                                              toggleCheckItem(
                                                "garment",
                                                sceneData.sceneNumber,
                                                `${wardrobeItem.character}_${wardrobeItem.wardrobeNumber}_${garment.id}`
                                              )
                                            }
                                          />
                                          <label
                                            style={{
                                              fontSize: "11px",
                                              color: "#666",
                                            }}
                                          >
                                            Acquired
                                          </label>
                                        </div>
                                      </div>

                                      {/* Image on right */}
                                      <div style={{ flexShrink: 0 }}>
                                        {garment.photos &&
                                        garment.photos.length > 0 ? (
                                          <img
                                            src={garment.photos[0]}
                                            alt={`${garment.name} preview`}
                                            style={{
                                              width: "60px",
                                              height: "75px",
                                              objectFit: "cover",
                                              borderRadius: "3px",
                                              cursor: "pointer",
                                              border: "1px solid #ddd",
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedImages(garment.photos);
                                              setCurrentImageIndex(0);
                                              setShowImageViewer(true);
                                            }}
                                            title="Click to view all photos"
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              width: "60px",
                                              height: "75px",
                                              backgroundColor: "#f0f0f0",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              borderRadius: "3px",
                                              border: "1px solid #ddd",
                                              fontSize: "8px",
                                              color: "#666",
                                              textAlign: "center",
                                            }}
                                          >
                                            No Photo
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            <div
                              style={{
                                color: "#666",
                                fontStyle: "italic",
                                fontSize: "12px",
                              }}
                            >
                              No garments assigned to this wardrobe
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No wardrobe items assigned for scenes on this shooting day.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsModule;