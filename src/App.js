import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  stemWord,
  measureSceneInDOM,
  calculateScenePageStats,
  estimateSceneLines,
  updateScenesWithPageData,
  parseSceneHeading,
  extractLocations,
  extractLocationsHierarchical,
  getElementStyle,
  formatElementText,
  calculateBlockLines,
  LINES_PER_PAGE,
} from "./utils.js";
import { PDFExporter } from "./utils/pdfExport";
import ToDoListModule from "./components/modules/ToDoList";
import BudgetModule from "./components/modules/Budget/Budget";
import ShotListModule from "./components/modules/ShotList/ShotList";
import TimelineModule from "./components/modules/Timeline/Timeline";
import Dashboard from "./components/modules/Dashboard/Dashboard";
import CostReportModule from "./components/modules/CostReport/CostReport";
import EditableInput from "./components/shared/EditableInput";
import ImageUpload from "./components/shared/ImageUpload";
import MultiImageUpload from "./components/shared/MultiImageUpload";
import ImageViewer from "./components/shared/ImageViewer";
import AuthWrapper from "./components/auth/AuthWrapper";
import { supabase } from "./supabase";
import * as database from "./services/database";
import {
  uploadImage,
  deleteImage,
  extractPathFromUrl,
  uploadWardrobeImage,
  uploadGarmentImage,
  uploadMultipleWardrobeImages,
  uploadMultipleGarmentImages,
  deleteMultipleImages,
} from "./utils/imageStorage";
import { usePresence } from "./hooks/usePresence";
import PresenceIndicator from "./components/shared/PresenceIndicator";
import DayOutOfDaysModule from "./components/modules/DayOutOfDays/DayOutOfDays";

// Script Component
function Script({
  scenes,
  currentIndex,
  setCurrentIndex,
  handleFileUpload,
  handleSingleSceneUpload,
  taggedItems,
  tagCategories,
  showTagDropdown,
  setShowTagDropdown,
  tagWord,
  untagWordInstance,
  isWordInstanceTagged,
  onSceneNumberChange,
  stripboardScenes,
  userRole,
  canEdit,
  isViewOnly,
  selectedProject,
  user,
}) {
  // Helper function to get pastel status colors
  const getSceneStatusColor = (sceneNumber) => {
    const stripboardScene = stripboardScenes?.find(
      (s) => s.sceneNumber === sceneNumber
    );
    const status = stripboardScene?.status || "Not Scheduled";

    const statusColors = {
      Scheduled: "#e8f5e9", // Desaturated green (same as stripboard but lighter)
      Shot: "#e8f5e9", // Same desaturated green as scheduled
      Pickups: "#fff8e1", // Desaturated yellow/orange
      Reshoot: "#ffebee", // Desaturated red
      Complete: "#e3f2fd", // Desaturated blue
      "In Progress": "#f3e5f5", // Desaturated purple
      "Not Scheduled": "transparent", // No background
    };

    return statusColors[status] || "transparent";
  };
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFullScript, setShowFullScript] = useState(false);

  return (
    <>
      <div
        style={{
          margin: "20px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {isViewOnly && (
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: "#FF9800",
              color: "white",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            VIEW ONLY MODE
          </div>
        )}

        {canEdit && (
          <input type="file" accept=".fdx" onChange={handleFileUpload} />
        )}

        {canEdit && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            style={{
              padding: "8px 16px",
              backgroundColor: isEditMode ? "#F44336" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {isEditMode ? "View" : "Edit"}
          </button>
        )}

        {isEditMode && canEdit && (
          <button
            onClick={() => {
              // Exit edit mode - changes are automatically saved
              setIsEditMode(false);
              alert("Scene changes saved!");
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Save
          </button>
        )}

        {canEdit && (
          <label>
            <input
              type="file"
              accept=".fdx"
              onChange={(e) => {
                if (e.target.files[0]) {
                  handleSingleSceneUpload(e.target.files[0]);
                  e.target.value = ""; // Clear input for repeated uploads
                }
              }}
              style={{ display: "none" }}
            />
            <div
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF9800",
                color: "white",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Replace Scene
            </div>
          </label>
        )}

        <button
          onClick={() => setShowFullScript(true)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#9C27B0",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          Full Script
        </button>
      </div>

      {/* Full Script Popup Modal */}
      {showFullScript && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
          }}
          onClick={() => setShowFullScript(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              width: "95%",
              maxWidth: "9.28in",
              maxHeight: "90vh",
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
                backgroundColor: "#9C27B0",
                color: "white",
                padding: "15px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px" }}>
                Full Script - All Scenes
              </h3>
              <button
                onClick={() => setShowFullScript(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "white",
                  fontSize: "28px",
                  cursor: "pointer",
                  padding: "0 5px",
                  lineHeight: "1",
                }}
              >
                ×
              </button>
            </div>

            {/* Full Script Content */}
            <div
              style={{
                flex: 1,
                padding: "1.5in",
                overflow: "auto",
                backgroundColor: "white",
                boxSizing: "border-box",
                textAlign: "left",
                fontFamily: "Courier New, monospace",
              }}
            >
              {(() => {
                const linesPerPage = LINES_PER_PAGE;
                let currentLine = 0;
                let currentPage = 1;
                const elements = [];

                // Filter out title page - only filter if heading doesn't contain INT/EXT
                const scriptScenes = scenes.filter((scene) => {
                  const heading = scene.heading?.toUpperCase() || "";
                  const hasIntExt =
                    heading.includes("INT.") || heading.includes("EXT.");

                  // Only filter out if it lacks INT/EXT AND has "written by"
                  if (!hasIntExt) {
                    const hasWrittenBy = scene.content?.some((block) =>
                      block.text?.toLowerCase().includes("written by")
                    );
                    return !hasWrittenBy;
                  }

                  return true; // Keep all scenes with INT/EXT
                });

                scriptScenes.forEach((scene, sceneIndex) => {
                  // Check if scene heading needs a page break (heading = 3 lines)
                  if (currentLine > 0 && currentLine + 3 > linesPerPage) {
                    currentPage++;
                    currentLine = 0;
                    elements.push(
                      <div
                        key={`pagebreak-${currentPage}`}
                        style={{
                          borderTop: "2px dashed #ccc",
                          margin: "24pt 0",
                          paddingTop: "12pt",
                          fontSize: "10pt",
                          color: "#999",
                          textAlign: "right",
                        }}
                      >
                        Page {currentPage}
                      </div>
                    );
                  }

                  // Scene Heading with scene numbers in margins
                  elements.push(
                    <div
                      key={`scene-heading-${scene.sceneNumber}`}
                      style={{
                        fontFamily: "Courier New, monospace",
                        fontSize: "12pt",
                        lineHeight: "12pt",
                        marginBottom: "12pt",
                        marginTop: sceneIndex === 0 ? "0" : "24pt",
                        color: "#000",
                        textTransform: "uppercase",
                        fontWeight: "bold",
                        backgroundColor: getSceneStatusColor(scene.sceneNumber),
                        padding: "4px 0",
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: "-60px",
                          fontWeight: "normal",
                        }}
                      >
                        {scene.sceneNumber}
                      </span>
                      {scene.heading}
                      <span
                        style={{
                          position: "absolute",
                          right: "-60px",
                          fontWeight: "normal",
                        }}
                      >
                        {scene.sceneNumber}
                      </span>
                    </div>
                  );
                  currentLine += 3;

                  // Scene content blocks
                  if (scene.content) {
                    scene.content.forEach((block, blockIndex) => {
                      // Use calculation from utils.js
                      const blockLines = calculateBlockLines(block);

                      // Check if we need a page break before this block
                      if (currentLine + blockLines > linesPerPage) {
                        currentPage++;
                        currentLine = 0;
                        elements.push(
                          <div
                            key={`pagebreak-${currentPage}-${blockIndex}`}
                            style={{
                              borderTop: "2px dashed #ccc",
                              margin: "24pt 0",
                              paddingTop: "12pt",
                              fontSize: "10pt",
                              color: "#999",
                              textAlign: "right",
                            }}
                          >
                            Page {currentPage}
                          </div>
                        );
                      }

                      const style = getElementStyle(block.type);
                      elements.push(
                        <div
                          key={`block-${scene.sceneNumber}-${blockIndex}`}
                          style={style}
                        >
                          {formatElementText(block)}
                        </div>
                      );

                      currentLine += blockLines;
                    });
                  }
                });

                return elements;
              })()}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          minWidth: "100%",
          overflow: "visible",
        }}
      >
        <div
          id="script-viewer-container"
          style={{
            width: "100%",
            maxWidth: "9.28in",
            minWidth: "300px",
            height: "1000px",
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid #ccc",
            padding: "1.5in",
            backgroundColor: getSceneStatusColor(
              scenes[currentIndex]?.sceneNumber
            ),
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
            boxSizing: "border-box",
            textAlign: "left",
            fontFamily: "Courier New, monospace",
          }}
        >
          <Slideshow
            scenes={scenes}
            currentIndex={currentIndex}
            taggedItems={taggedItems}
            tagCategories={tagCategories}
            showTagDropdown={showTagDropdown}
            setShowTagDropdown={setShowTagDropdown}
            tagWord={tagWord}
            untagWordInstance={untagWordInstance}
            isWordInstanceTagged={isWordInstanceTagged}
            getSceneStatusColor={getSceneStatusColor}
            isEditMode={isEditMode}
            onSceneContentChange={(newContent) => {
              // This will update the scene content
              const updatedScenes = [...scenes];
              updatedScenes[currentIndex].content = newContent;
              setScenes(updatedScenes);
            }}
          />
        </div>
        <SceneDropdown
          scenes={scenes}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          onSceneNumberChange={onSceneNumberChange}
          getSceneStatusColor={getSceneStatusColor}
          selectedProject={selectedProject}
          user={user}
        />
      </div>

      <NavigationButtons scenes={scenes} setCurrentIndex={setCurrentIndex} />
    </>
  );
}

// Makeup Module
function MakeupModule({
  taggedItems,
  scenes,
  characters,
  setActiveModule,
  setCurrentIndex,
  onUpdateMakeupTitle,
  onRemoveMakeupFromScene,
  onCreateMakeupVariant,
  onAddMakeupToScene,
  onCreateNewMakeup,
  onUpdateTaggedItems,
  onSyncTaggedItems,
}) {
  const [showScenesWithoutMakeup, setShowScenesWithoutMakeup] = useState(false);
  const [selectedMakeupItem, setSelectedMakeupItem] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);

  const makeupItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Makeup")
    .sort((a, b) => a[1].chronologicalNumber - b[1].chronologicalNumber);

  // Get makeup requirements for a specific scene (based on cast)
  const getMakeupForScene = (sceneIndex) => {
    const sceneMakeup = [];
    makeupItems.forEach(([word, makeupItem]) => {
      // Check instances instead of scenes array to respect exclusions
      if (makeupItem.instances) {
        const hasActiveInstance = makeupItem.instances.some((instance) => {
          const sceneNumber = parseInt(instance.split("-")[0]); // Instance format is already scene number - 1
          return sceneNumber === sceneIndex && !instance.excluded;
        });

        if (hasActiveInstance) {
          sceneMakeup.push({ word, ...makeupItem });
        }
      }
    });
    return sceneMakeup.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

  // Filter scenes based on whether they have makeup requirements
  const filteredScenes = scenes.filter((scene, index) => {
    const sceneMakeup = getMakeupForScene(index);
    return showScenesWithoutMakeup || sceneMakeup.length > 0;
  });

  const handleMakeupClick = (makeupItem, sceneIndex) => {
    setSelectedMakeupItem({ ...makeupItem, contextScene: sceneIndex });
  };

  const handleMakeupDoubleClick = (makeupItem, sceneIndex) => {
    setCurrentIndex(sceneIndex);
    setActiveModule("Script");
  };

  if (makeupItems.length === 0) {
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
        <h2>Makeup</h2>
        <p>
          No makeup items have been tagged yet. Double-click words in the Script
          module to tag them as makeup.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        gap: "15px",
        maxWidth: "100%",
        overflowX: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Left Column - Cast/Makeup List */}
      <div
        style={{
          flex: "0 0 400px",
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
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
          <h2 style={{ margin: 0 }}>Makeup</h2>
          <button
            onClick={() => {
              // Create a temporary makeup object to open the popup
              const tempMakeup = {
                word: `custom_${Date.now()}`, // Temporary unique identifier
                displayName: "New Custom Makeup",
                customTitle: "New Custom Makeup",
                category: "Makeup",
                color: "#FF9F43",
                chronologicalNumber: makeupItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomMakeup: true, // Flag to identify this as a new custom makeup item
              };
              setSelectedMakeupItem(tempMakeup);
            }}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            + Add Custom Makeup
          </button>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <p>Total Makeup Items: {makeupItems.length}</p>
        </div>

        <div style={{ width: "100%" }}>
          {makeupItems.map(([word, item]) => {
            // Convert hex color to more pastel version
            const getPastelColor = (hexColor) => {
              const r = parseInt(hexColor.slice(1, 3), 16);
              const g = parseInt(hexColor.slice(3, 5), 16);
              const b = parseInt(hexColor.slice(5, 7), 16);
              // Blend with white to create pastel effect
              const pastelR = Math.round(r + (255 - r) * 0.7);
              const pastelG = Math.round(g + (255 - g) * 0.7);
              const pastelB = Math.round(b + (255 - b) * 0.7);
              return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
            };

            // Get character assignments for this makeup item
            const assignedCharacters = item.assignedCharacters || [];
            const hasMultipleCharacters = assignedCharacters.length > 1;

            // Capitalize first letter of makeup item name
            const capitalizedName =
              (item.customTitle || item.displayName).charAt(0).toUpperCase() +
              (item.customTitle || item.displayName).slice(1);

            return (
              <div
                key={word}
                style={{
                  backgroundColor: getPastelColor(item.color),
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px",
                  margin: "5px 0",
                  fontSize: "12px",
                  position: "relative",
                  maxWidth: "285px", // 25% narrower than 380px
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "20px", // 8pts bigger than 12px base
                    marginBottom: "4px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedMakeupItem({ word, ...item, contextScene: null })
                  }
                >
                  {item.categoryNumber || item.chronologicalNumber}.{" "}
                  {capitalizedName}
                  {hasMultipleCharacters && (
                    <span
                      style={{
                        display: "inline-block",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        borderRadius: "50%",
                        width: "14px",
                        height: "14px",
                        textAlign: "center",
                        fontSize: "10px",
                        lineHeight: "14px",
                        marginLeft: "4px",
                        cursor: "pointer",
                      }}
                      title="Assigned to multiple characters"
                    >
                      !
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", marginBottom: "6px" }}>
                  Category: {item.category}
                  {assignedCharacters.length > 0 && (
                    <span style={{ marginLeft: "12px" }}>
                      Characters: {assignedCharacters.join(", ")}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                  <button
                    onClick={() =>
                      setSelectedMakeupItem({
                        word,
                        ...item,
                        contextScene: null,
                      })
                    }
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Right Column - Scene Breakdown */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2>Scene Breakdown</h2>
          <label style={{ fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={showScenesWithoutMakeup}
              onChange={(e) => setShowScenesWithoutMakeup(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Show scenes without makeup items
          </label>
        </div>

        <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
          {filteredScenes.map((scene, originalIndex) => {
            const sceneIndex = scenes.indexOf(scene);
            const sceneMakeup = getMakeupForScene(sceneIndex);

            return (
              <div
                key={sceneIndex}
                style={{
                  border: "1px solid #ddd",
                  margin: "10px 0",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    borderBottom:
                      sceneMakeup.length > 0 ? "1px solid #ddd" : "none",
                  }}
                >
                  Scene {scene.sceneNumber}: {scene.heading}
                </div>

                {sceneMakeup.length > 0 && (
                  <div style={{ padding: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "8px",
                      }}
                    >
                      Cast requiring makeup ({sceneMakeup.length}):
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {sceneMakeup.map((makeupItem) => {
                        // Convert hex color to more pastel version
                        const getPastelColor = (hexColor) => {
                          const r = parseInt(hexColor.slice(1, 3), 16);
                          const g = parseInt(hexColor.slice(3, 5), 16);
                          const b = parseInt(hexColor.slice(5, 7), 16);
                          const pastelR = Math.round(r + (255 - r) * 0.7);
                          const pastelG = Math.round(g + (255 - g) * 0.7);
                          const pastelB = Math.round(b + (255 - b) * 0.7);
                          return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
                        };

                        const assignedCharacters =
                          makeupItem.assignedCharacters || [];
                        const hasMultipleCharacters =
                          assignedCharacters.length > 1;

                        // Capitalize first letter of makeup item name
                        const capitalizedName =
                          (makeupItem.customTitle || makeupItem.displayName)
                            .charAt(0)
                            .toUpperCase() +
                          (
                            makeupItem.customTitle || makeupItem.displayName
                          ).slice(1);

                        return (
                          <div
                            key={`${sceneIndex}-${makeupItem.word}`}
                            onClick={() =>
                              handleMakeupClick(makeupItem, sceneIndex)
                            }
                            onDoubleClick={() =>
                              handleMakeupDoubleClick(makeupItem, sceneIndex)
                            }
                            style={{
                              backgroundColor: getPastelColor(makeupItem.color),
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              padding: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11px",
                                marginBottom: "2px",
                              }}
                            >
                              {makeupItem.categoryNumber ||
                                makeupItem.chronologicalNumber}
                              . {capitalizedName}
                              {hasMultipleCharacters && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    borderRadius: "50%",
                                    width: "10px",
                                    height: "10px",
                                    textAlign: "center",
                                    fontSize: "7px",
                                    lineHeight: "10px",
                                    marginLeft: "3px",
                                  }}
                                  title="Assigned to multiple characters"
                                >
                                  !
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                color: "#666",
                                marginBottom: "2px",
                                fontSize: "9px",
                              }}
                            >
                              {makeupItem.category}
                            </div>
                            {assignedCharacters.length > 0 && (
                              <div style={{ color: "#666", fontSize: "9px" }}>
                                {assignedCharacters.join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Makeup Details Popup */}
      {selectedMakeupItem && (
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
            onClick={() => setSelectedMakeupItem(null)}
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
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Makeup Details</h3>
            <div style={{ marginBottom: "15px" }}>
              <strong>Name:</strong>
              <input
                type="text"
                value={
                  selectedMakeupItem.customTitle ||
                  selectedMakeupItem.displayName
                }
                onChange={(e) => {
                  setSelectedMakeupItem((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }));
                }}
                onBlur={() => {
                  if (
                    onUpdateMakeupTitle &&
                    selectedMakeupItem.customTitle !==
                      selectedMakeupItem.displayName
                  ) {
                    onUpdateMakeupTitle(
                      selectedMakeupItem.word,
                      selectedMakeupItem.customTitle
                    );
                  }
                }}
                style={{
                  marginLeft: "10px",
                  padding: "4px 8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  width: "200px",
                }}
                placeholder={selectedMakeupItem.displayName}
              />
            </div>
            <p>
              <strong>Original Word:</strong> {selectedMakeupItem.displayName}
            </p>
            <p>
              <strong>Category:</strong> {selectedMakeupItem.category}
            </p>
            <p>
              <strong>Number:</strong> {selectedMakeupItem.chronologicalNumber}
            </p>
            <p>
              <strong>Scenes:</strong>{" "}
              {selectedMakeupItem.scenes
                ? selectedMakeupItem.scenes.join(", ")
                : "None"}
            </p>
            <p style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}>
              Future: Makeup requirements, call times, special effects,
              prosthetics, etc.
            </p>

            {/* Scene Context Actions - only show if opened from scene context */}
            {selectedMakeupItem.contextScene !== null && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Scene Actions</h4>
                <button
                  onClick={() => {
                    if (onRemoveMakeupFromScene) {
                      onRemoveMakeupFromScene(
                        selectedMakeupItem.word,
                        selectedMakeupItem.contextScene
                      );
                    }
                    setSelectedMakeupItem(null);
                  }}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Remove from Scene
                </button>
                <button
                  onClick={() => {
                    const variantName = prompt(
                      `Create variant of "${
                        selectedMakeupItem.customTitle ||
                        selectedMakeupItem.displayName
                      }":`
                    );
                    if (variantName && onCreateMakeupVariant) {
                      onCreateMakeupVariant(
                        selectedMakeupItem.word,
                        variantName
                      );
                    }
                  }}
                  style={{
                    backgroundColor: "#FF9800",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Create Variant
                </button>
              </div>
            )}

            {/* Add to Scenes - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#e8f5e8",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>
                {selectedMakeupItem.contextScene !== null
                  ? "Add Items to Scene"
                  : "Manage Scenes for This Item"}
              </h4>

              {selectedMakeupItem.contextScene === null ? (
                // Left panel context - multi-select scenes for this item
                <div>
                  <div
                    style={{
                      marginBottom: "10px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Click scene numbers to add/remove this item. Green =
                    assigned, Gray = not assigned.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {scenes.map((scene, sceneIndex) => {
                      const isAssigned =
                        selectedMakeupItem.instances &&
                        selectedMakeupItem.instances.some((instance) => {
                          const sceneIndex = parseInt(instance.split("-")[0]);
                          return sceneIndex === scenes.indexOf(scene);
                        });
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (isAssigned && onRemoveMakeupFromScene) {
                              onRemoveMakeupFromScene(
                                selectedMakeupItem.word,
                                sceneIndex
                              );
                            } else if (!isAssigned && onAddMakeupToScene) {
                              onAddMakeupToScene(
                                selectedMakeupItem.word,
                                sceneIndex
                              );
                            }
                            // Update the local selectedMakeupItem state to reflect the change immediately
                            setSelectedMakeupItem((prev) => {
                              const updatedScenes = [...(prev.scenes || [])];
                              if (isAssigned) {
                                const index = updatedScenes.indexOf(
                                  scene.sceneNumber
                                );
                                if (index > -1) updatedScenes.splice(index, 1);
                              } else {
                                if (
                                  !updatedScenes.includes(scene.sceneNumber)
                                ) {
                                  updatedScenes.push(scene.sceneNumber);
                                  updatedScenes.sort((a, b) => a - b);
                                }
                              }
                              return { ...prev, scenes: updatedScenes };
                            });
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {scene.sceneNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Scene context - add other items to this scene
                <div>
                  <select
                    style={{
                      padding: "4px 8px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                    onChange={(e) => {
                      if (e.target.value && onAddMakeupToScene) {
                        onAddMakeupToScene(
                          e.target.value,
                          selectedMakeupItem.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Select existing item...</option>
                    {makeupItems.map(([word, item]) => (
                      <option key={word} value={word}>
                        {item.customTitle || item.displayName}
                      </option>
                    ))}
                  </select>
                  <br />
                  <input
                    type="text"
                    placeholder="Or type new item name..."
                    style={{
                      marginTop: "8px",
                      padding: "4px 8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                      width: "150px",
                    }}
                    onKeyPress={(e) => {
                      if (
                        e.key === "Enter" &&
                        e.target.value.trim() &&
                        onCreateNewMakeup
                      ) {
                        onCreateNewMakeup(
                          e.target.value.trim(),
                          selectedMakeupItem.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Character Assignment */}
            {characters && Object.keys(characters).length > 0 && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#e8f5e8",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Character Assignment</h4>
                <div
                  style={{
                    marginBottom: "10px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Assign this makeup to characters. Green = assigned, Gray = not
                  assigned.
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {Object.keys(characters)
                    .sort()
                    .map((characterName) => {
                      const isAssigned = (
                        selectedMakeupItem.assignedCharacters || []
                      ).includes(characterName);
                      return (
                        <button
                          key={characterName}
                          onClick={() => {
                            // Toggle character assignment
                            const currentAssignments =
                              selectedMakeupItem.assignedCharacters || [];
                            let newAssignments;

                            if (isAssigned) {
                              // Remove character
                              newAssignments = currentAssignments.filter(
                                (char) => char !== characterName
                              );
                            } else {
                              // Add character
                              newAssignments = [
                                ...currentAssignments,
                                characterName,
                              ].sort();
                            }

                            // Create updated taggedItems with character assignment change
                            const updatedTaggedItems = { ...taggedItems };
                            const makeupData =
                              updatedTaggedItems[selectedMakeupItem.word];

                            if (makeupData) {
                              updatedTaggedItems[selectedMakeupItem.word] = {
                                ...makeupData,
                                assignedCharacters: newAssignments,
                              };

                              // Update the main taggedItems state
                              if (onUpdateTaggedItems) {
                                onUpdateTaggedItems(updatedTaggedItems);
                              }

                              // Sync to database
                              if (onSyncTaggedItems) {
                                onSyncTaggedItems(updatedTaggedItems);
                              }
                            }

                            // Update the selected makeup item to reflect the change
                            setSelectedMakeupItem((prev) => ({
                              ...prev,
                              assignedCharacters: newAssignments,
                            }));
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {characterName}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Create Variant - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#fff3e0",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>Makeup Management</h4>
              <button
                onClick={() => {
                  const variantName = prompt(
                    `Create variant of "${
                      selectedMakeupItem.customTitle ||
                      selectedMakeupItem.displayName
                    }":`
                  );
                  if (variantName && onCreateMakeupVariant) {
                    onCreateMakeupVariant(selectedMakeupItem.word, variantName);
                  }
                }}
                style={{
                  backgroundColor: "#FF9800",
                  color: "white",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Create Variant
              </button>
            </div>

            <div style={{ marginTop: "15px" }}>
              {selectedMakeupItem.contextScene === null &&
                selectedMakeupItem.scenes &&
                selectedMakeupItem.scenes.length > 0 && (
                  <div
                    style={{
                      marginBottom: "10px",
                      padding: "8px",
                      backgroundColor: "#f0f8ff",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Browse Scenes with This Item (
                      {selectedMakeupItem.scenes.length} scenes)
                    </div>
                    <button
                      onClick={() => {
                        // Initialize viewing scene to first scene in the list
                        const firstSceneNumber = selectedMakeupItem.scenes[0];
                        setSelectedMakeupItem((prev) => ({
                          ...prev,
                          viewingSceneNumber: firstSceneNumber,
                        }));
                        setShowScenePreview(true);
                      }}
                      style={{
                        backgroundColor: "#2196F3",
                        color: "white",
                        padding: "6px 12px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "8px",
                        fontSize: "12px",
                      }}
                    >
                      View Scenes
                    </button>
                  </div>
                )}

              {/* Save/Cancel buttons for new custom makeup items */}
              {selectedMakeupItem.isNewCustomMakeup && (
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <button
                    onClick={() => {
                      if (
                        selectedMakeupItem.customTitle &&
                        selectedMakeupItem.customTitle.trim() &&
                        onCreateNewMakeup
                      ) {
                        onCreateNewMakeup(
                          selectedMakeupItem.customTitle.trim(),
                          null
                        );
                      }
                      setSelectedMakeupItem(null);
                    }}
                    style={{
                      backgroundColor: "#FF9F43",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Save Makeup Item
                  </button>
                  <button
                    onClick={() => setSelectedMakeupItem(null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {selectedMakeupItem.contextScene !== null &&
                !selectedMakeupItem.isNewCustomMakeup && (
                  <button
                    onClick={() => setShowScenePreview(true)}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginRight: "10px",
                    }}
                  >
                    View Scene
                  </button>
                )}

              {!selectedMakeupItem.isNewCustomMakeup && (
                <button
                  onClick={() => setSelectedMakeupItem(null)}
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
              )}
            </div>
          </div>
        </>
      )}
      {/* Scene Preview Popup */}
      {selectedMakeupItem &&
        showScenePreview &&
        (selectedMakeupItem.contextScene !== null ||
          (selectedMakeupItem.contextScene === null &&
            selectedMakeupItem.viewingSceneNumber)) && (
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
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1002,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  // Define scene at the top so it's available to header and content
                  let scene;
                  if (selectedMakeupItem.contextScene !== null) {
                    scene = scenes[selectedMakeupItem.contextScene];
                  } else {
                    const viewingSceneNumber =
                      selectedMakeupItem.viewingSceneNumber ||
                      selectedMakeupItem.scenes[0];
                    scene = scenes.find(
                      (s) => s.sceneNumber === String(viewingSceneNumber)
                    );
                  }

                  if (!scene) {
                    return (
                      <div style={{ padding: "20px" }}>Scene not found</div>
                    );
                  }

                  return (
                    <>
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
                        <div
                          style={{
                            margin: 0,
                            fontSize: "12pt",
                            fontFamily: "Courier New, monospace",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scene.sceneNumber}. {scene.heading}
                        </div>

                        {/* Navigation controls for left panel context */}
                        {selectedMakeupItem.contextScene === null &&
                          selectedMakeupItem.scenes &&
                          selectedMakeupItem.scenes.length > 1 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedMakeupItem.scenes.indexOf(
                                      selectedMakeupItem.viewingSceneNumber ||
                                        selectedMakeupItem.scenes[0]
                                    );
                                  const prevIndex =
                                    currentIndex > 0
                                      ? currentIndex - 1
                                      : selectedMakeupItem.scenes.length - 1;
                                  setSelectedMakeupItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedMakeupItem.scenes[prevIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "#4CAF50",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                ← Prev
                              </button>
                              <span style={{ fontSize: "12px", color: "#666" }}>
                                {(() => {
                                  const currentIndex =
                                    selectedMakeupItem.scenes.indexOf(
                                      selectedMakeupItem.viewingSceneNumber ||
                                        selectedMakeupItem.scenes[0]
                                    );
                                  return `${currentIndex + 1} of ${
                                    selectedMakeupItem.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedMakeupItem.scenes.indexOf(
                                      selectedMakeupItem.viewingSceneNumber ||
                                        selectedMakeupItem.scenes[0]
                                    );
                                  const nextIndex =
                                    currentIndex <
                                    selectedMakeupItem.scenes.length - 1
                                      ? currentIndex + 1
                                      : 0;
                                  setSelectedMakeupItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedMakeupItem.scenes[nextIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "#4CAF50",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}

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

                      {/* Scene Content */}
                      <div
                        style={{
                          flex: 1,
                          padding: "1.5in",
                          overflow: "auto",
                          backgroundColor: "white",
                          boxSizing: "border-box",
                          textAlign: "left",
                          fontFamily: "Courier New, monospace",
                          lineHeight: "1.6",
                          fontSize: "14px",
                        }}
                      >
                        {scene.content.map((block, blockIndex) => {
                          const renderContent = () => {
                            const words = block.text.split(/(\s+)/);
                            return words.map((word, wordIndex) => {
                              if (!word.trim()) return word;

                              const cleanWord = word
                                .toLowerCase()
                                .replace(/[^\w]/g, "");
                              const stemmedWord = stemWord
                                ? stemWord(cleanWord)
                                : cleanWord;

                              const isCurrentItem =
                                stemmedWord === selectedMakeupItem.word;
                              const isTagged = Object.keys(taggedItems).some(
                                (taggedWord) => stemmedWord === taggedWord
                              );

                              if (isCurrentItem) {
                                return (
                                  <span
                                    key={wordIndex}
                                    style={{
                                      backgroundColor: selectedMakeupItem.color,
                                      color: "white",
                                      padding: "2px 4px",
                                      borderRadius: "3px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {word}
                                  </span>
                                );
                              } else if (isTagged) {
                                const taggedItem = Object.entries(
                                  taggedItems
                                ).find(([key]) => stemmedWord === key);
                                return (
                                  <span
                                    key={wordIndex}
                                    style={{
                                      backgroundColor:
                                        taggedItem?.[1]?.color || "#ccc",
                                      color: "white",
                                      padding: "1px 2px",
                                      borderRadius: "2px",
                                      opacity: 0.7,
                                    }}
                                  >
                                    {word}
                                  </span>
                                );
                              }

                              return word;
                            });
                          };

                          return (
                            <div
                              key={blockIndex}
                              style={{
                                marginBottom: "15px",
                                textAlign:
                                  block.type === "Scene Heading"
                                    ? "center"
                                    : "left",
                                fontWeight:
                                  block.type === "Scene Heading"
                                    ? "bold"
                                    : "normal",
                                fontSize:
                                  block.type === "Scene Heading"
                                    ? "16px"
                                    : "14px",
                                marginLeft:
                                  block.type === "Character"
                                    ? "200px"
                                    : block.type === "Dialogue"
                                    ? "100px"
                                    : block.type === "Parenthetical"
                                    ? "150px"
                                    : "0px",
                                marginRight:
                                  block.type === "Dialogue" ? "100px" : "0px",
                                textTransform:
                                  block.type === "Character"
                                    ? "uppercase"
                                    : "none",
                                fontStyle:
                                  block.type === "Parenthetical"
                                    ? "italic"
                                    : "normal",
                              }}
                            >
                              {renderContent()}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
    </div>
  );
}

// Production Design Module
function ProductionDesignModule({
  taggedItems,
  scenes,
  scriptLocations,
  actualLocations,
  setActiveModule,
  setCurrentIndex,
  onUpdatePDTitle,
  onRemovePDFromScene,
  onCreatePDVariant,
  onAddPDToScene,
  onCreateNewPD,
}) {
  const [showScenesWithoutPD, setShowScenesWithoutPD] = useState(false);
  const [selectedPDItem, setSelectedPDItem] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);

  const pdItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Production Design")
    .sort((a, b) => a[1].chronologicalNumber - b[1].chronologicalNumber);

  // Get production design items for a specific scene
  const getPDForScene = (sceneIndex) => {
    const scenePD = [];
    pdItems.forEach(([word, pdItem]) => {
      // Check instances instead of scenes array to respect exclusions
      if (pdItem.instances) {
        const hasActiveInstance = pdItem.instances.some((instance) => {
          const sceneNumber = parseInt(instance.split("-")[0]); // Instance format is already scene number - 1
          return sceneNumber === sceneIndex && !instance.excluded;
        });

        if (hasActiveInstance) {
          scenePD.push({ word, ...pdItem });
        }
      }
    });
    return scenePD.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

  // Filter scenes based on whether they have production design items
  const filteredScenes = scenes.filter((scene, index) => {
    const scenePD = getPDForScene(index);
    return showScenesWithoutPD || scenePD.length > 0;
  });

  const handlePDClick = (pdItem, sceneIndex) => {
    setSelectedPDItem({ ...pdItem, contextScene: sceneIndex });
  };

  const handlePDDoubleClick = (pdItem, sceneIndex) => {
    setCurrentIndex(sceneIndex);
    setActiveModule("Script");
  };

  if (pdItems.length === 0) {
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
        <h2>Production Design</h2>
        <p>
          No production design items have been tagged yet. Double-click words in
          the Script module to tag them as production design.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        gap: "15px",
        maxWidth: "100%",
        overflowX: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Left Column - Production Design List */}
      <div
        style={{
          flex: "0 0 400px",
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
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
          <h2 style={{ margin: 0 }}>Production Design</h2>
          <button
            onClick={() => {
              // Create a temporary PD object to open the popup
              const tempPD = {
                word: `custom_${Date.now()}`, // Temporary unique identifier
                displayName: "New Custom PD Item",
                customTitle: "New Custom PD Item",
                category: "Production Design",
                color: "#4ECDC4",
                chronologicalNumber: pdItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomPD: true, // Flag to identify this as a new custom PD item
              };
              setSelectedPDItem(tempPD);
            }}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            + Add Custom PD Item
          </button>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <p>Total Items: {pdItems.length}</p>
        </div>

        <div style={{ width: "100%" }}>
          {pdItems.map(([word, item]) => {
            // Convert hex color to more pastel version
            const getPastelColor = (hexColor) => {
              const r = parseInt(hexColor.slice(1, 3), 16);
              const g = parseInt(hexColor.slice(3, 5), 16);
              const b = parseInt(hexColor.slice(5, 7), 16);
              // Blend with white to create pastel effect
              const pastelR = Math.round(r + (255 - r) * 0.7);
              const pastelG = Math.round(g + (255 - g) * 0.7);
              const pastelB = Math.round(b + (255 - b) * 0.7);
              return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
            };

            // Capitalize first letter of PD item name
            const capitalizedName =
              (item.customTitle || item.displayName).charAt(0).toUpperCase() +
              (item.customTitle || item.displayName).slice(1);

            return (
              <div
                key={word}
                style={{
                  backgroundColor: getPastelColor(item.color),
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px",
                  margin: "5px 0",
                  fontSize: "12px",
                  position: "relative",
                  maxWidth: "285px", // 25% narrower than 380px
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "20px", // 8pts bigger than 12px base
                    marginBottom: "4px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedPDItem({ word, ...item, contextScene: null })
                  }
                >
                  {item.categoryNumber || item.chronologicalNumber}.{" "}
                  {capitalizedName}
                </div>
                <div style={{ color: "#666", marginBottom: "6px" }}>
                  Category: {item.category}
                  {item.scenes &&
                    item.scenes.length > 0 &&
                    ` | Appears in ${item.scenes.length} scene(s)`}
                </div>
                <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                  <button
                    onClick={() =>
                      setSelectedPDItem({ word, ...item, contextScene: null })
                    }
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Right Column - Scene Breakdown */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2>Scene Breakdown</h2>
          <label style={{ fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={showScenesWithoutPD}
              onChange={(e) => setShowScenesWithoutPD(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Show scenes without production design
          </label>
        </div>

        <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
          {filteredScenes.map((scene, originalIndex) => {
            const sceneIndex = scenes.indexOf(scene);
            const scenePD = getPDForScene(sceneIndex);

            return (
              <div
                key={sceneIndex}
                style={{
                  border: "1px solid #ddd",
                  margin: "10px 0",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    borderBottom:
                      scenePD.length > 0 ? "1px solid #ddd" : "none",
                  }}
                >
                  Scene {scene.sceneNumber}: {scene.heading}
                </div>

                {scenePD.length > 0 && (
                  <div style={{ padding: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "8px",
                      }}
                    >
                      Production design items ({scenePD.length}):
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {scenePD.map((pdItem) => {
                        // Convert hex color to more pastel version
                        const getPastelColor = (hexColor) => {
                          const r = parseInt(hexColor.slice(1, 3), 16);
                          const g = parseInt(hexColor.slice(3, 5), 16);
                          const b = parseInt(hexColor.slice(5, 7), 16);
                          const pastelR = Math.round(r + (255 - r) * 0.7);
                          const pastelG = Math.round(g + (255 - g) * 0.7);
                          const pastelB = Math.round(b + (255 - b) * 0.7);
                          return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
                        };

                        // Capitalize first letter of PD item name
                        const capitalizedName =
                          (pdItem.customTitle || pdItem.displayName)
                            .charAt(0)
                            .toUpperCase() +
                          (pdItem.customTitle || pdItem.displayName).slice(1);

                        return (
                          <div
                            key={`${sceneIndex}-${pdItem.word}`}
                            onClick={() => handlePDClick(pdItem, sceneIndex)}
                            onDoubleClick={() =>
                              handlePDDoubleClick(pdItem, sceneIndex)
                            }
                            style={{
                              backgroundColor: getPastelColor(pdItem.color),
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              padding: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11px",
                                marginBottom: "2px",
                              }}
                            >
                              {pdItem.categoryNumber ||
                                pdItem.chronologicalNumber}
                              . {capitalizedName}
                            </div>
                            <div
                              style={{
                                color: "#666",
                                marginBottom: "2px",
                                fontSize: "9px",
                              }}
                            >
                              {pdItem.category}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Production Design Details Popup */}
      {selectedPDItem && (
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
            onClick={() => setSelectedPDItem(null)}
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
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Production Design Details</h3>
            <div style={{ marginBottom: "15px" }}>
              <strong>Name:</strong>
              <input
                type="text"
                value={selectedPDItem.customTitle || selectedPDItem.displayName}
                onChange={(e) => {
                  setSelectedPDItem((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }));
                }}
                onBlur={() => {
                  if (
                    onUpdatePDTitle &&
                    selectedPDItem.customTitle !== selectedPDItem.displayName
                  ) {
                    onUpdatePDTitle(
                      selectedPDItem.word,
                      selectedPDItem.customTitle
                    );
                  }
                }}
                style={{
                  marginLeft: "10px",
                  padding: "4px 8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  width: "200px",
                }}
                placeholder={selectedPDItem.displayName}
              />
            </div>
            <p>
              <strong>Original Word:</strong> {selectedPDItem.displayName}
            </p>
            <p>
              <strong>Category:</strong> {selectedPDItem.category}
            </p>
            <p>
              <strong>Number:</strong> {selectedPDItem.chronologicalNumber}
            </p>
            <p>
              <strong>Scenes:</strong>{" "}
              {selectedPDItem.scenes
                ? selectedPDItem.scenes.join(", ")
                : "None"}
            </p>
            <p style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}>
              Future: Design references, color palettes, materials, vendor info,
              etc.
            </p>

            {/* Location Assignment */}
            {scriptLocations && scriptLocations.length > 0 && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#e8f5e8",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Location Assignment</h4>
                <div
                  style={{
                    marginBottom: "10px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Assign this PD item to specific locations. Green = assigned,
                  Gray = not assigned.
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {(() => {
                    // Group script locations by parent to get unique parent locations
                    const parentLocations = {};
                    scriptLocations.forEach((location) => {
                      if (!parentLocations[location.parentLocation]) {
                        parentLocations[location.parentLocation] = {
                          name: location.parentLocation,
                          subLocations: [],
                          totalScenes: 0,
                        };
                      }
                      parentLocations[
                        location.parentLocation
                      ].subLocations.push(location);
                      parentLocations[location.parentLocation].totalScenes +=
                        location.scenes.length;
                    });

                    return Object.values(parentLocations)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((parentLoc) => {
                        const isAssigned = (
                          selectedPDItem.assignedLocations || []
                        ).includes(parentLoc.name);
                        return (
                          <button
                            key={parentLoc.name}
                            onClick={() => {
                              // Toggle parent location assignment
                              const currentAssignments =
                                selectedPDItem.assignedLocations || [];
                              let newAssignments;

                              if (isAssigned) {
                                // Remove parent location
                                newAssignments = currentAssignments.filter(
                                  (loc) => loc !== parentLoc.name
                                );
                              } else {
                                // Add parent location
                                newAssignments = [
                                  ...currentAssignments,
                                  parentLoc.name,
                                ].sort();
                              }

                              // Update the selected PD item to reflect the change
                              setSelectedPDItem((prev) => ({
                                ...prev,
                                assignedLocations: newAssignments,
                              }));

                              // Here you would also update the main taggedItems state
                              // This would need an onUpdateTaggedItems callback like Props module has
                            }}
                            style={{
                              padding: "6px 8px",
                              fontSize: "11px",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              cursor: "pointer",
                              backgroundColor: isAssigned
                                ? "#4CAF50"
                                : "#f5f5f5",
                              color: isAssigned ? "white" : "#333",
                              fontWeight: isAssigned ? "bold" : "normal",
                              maxWidth: "120px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`${parentLoc.name} (${parentLoc.subLocations.length} locations, ${parentLoc.totalScenes} scenes)`}
                          >
                            {parentLoc.name}
                          </button>
                        );
                      });
                  })()}
                </div>
              </div>
            )}

            {/* Scene Context Actions - only show if opened from scene context */}
            {selectedPDItem.contextScene !== null && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Scene Actions</h4>
                <button
                  onClick={() => {
                    if (onRemovePDFromScene) {
                      onRemovePDFromScene(
                        selectedPDItem.word,
                        selectedPDItem.contextScene
                      );
                    }
                    setSelectedPDItem(null);
                  }}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Remove from Scene
                </button>
                <button
                  onClick={() => {
                    const variantName = prompt(
                      `Create variant of "${
                        selectedPDItem.customTitle || selectedPDItem.displayName
                      }":`
                    );
                    if (variantName && onCreatePDVariant) {
                      onCreatePDVariant(selectedPDItem.word, variantName);
                    }
                  }}
                  style={{
                    backgroundColor: "#FF9800",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Create Variant
                </button>
              </div>
            )}

            {/* Add to Scenes - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#e8f5e8",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>
                {selectedPDItem.contextScene !== null
                  ? "Add Items to Scene"
                  : "Manage Scenes for This Item"}
              </h4>

              {selectedPDItem.contextScene === null ? (
                // Left panel context - multi-select scenes for this item
                <div>
                  <div
                    style={{
                      marginBottom: "10px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Click scene numbers to add/remove this item. Green =
                    assigned, Gray = not assigned.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {scenes.map((scene, sceneIndex) => {
                      const isAssigned =
                        selectedPDItem.instances &&
                        selectedPDItem.instances.some((instance) => {
                          const sceneIndex = parseInt(instance.split("-")[0]);
                          return sceneIndex === scenes.indexOf(scene);
                        });
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (isAssigned && onRemovePDFromScene) {
                              onRemovePDFromScene(
                                selectedPDItem.word,
                                sceneIndex
                              );
                            } else if (!isAssigned && onAddPDToScene) {
                              onAddPDToScene(selectedPDItem.word, sceneIndex);
                            }
                            // Update the local selectedPDItem state to reflect the change immediately
                            setSelectedPDItem((prev) => {
                              const updatedScenes = [...(prev.scenes || [])];
                              if (isAssigned) {
                                const index = updatedScenes.indexOf(
                                  scene.sceneNumber
                                );
                                if (index > -1) updatedScenes.splice(index, 1);
                              } else {
                                if (
                                  !updatedScenes.includes(scene.sceneNumber)
                                ) {
                                  updatedScenes.push(scene.sceneNumber);
                                  updatedScenes.sort((a, b) => a - b);
                                }
                              }
                              return { ...prev, scenes: updatedScenes };
                            });
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {scene.sceneNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Scene context - add other items to this scene
                <div>
                  <select
                    style={{
                      padding: "4px 8px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                    onChange={(e) => {
                      if (e.target.value && onAddPDToScene) {
                        onAddPDToScene(
                          e.target.value,
                          selectedPDItem.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Select existing item...</option>
                    {pdItems.map(([word, item]) => (
                      <option key={word} value={word}>
                        {item.customTitle || item.displayName}
                      </option>
                    ))}
                  </select>
                  <br />
                  <input
                    type="text"
                    placeholder="Or type new item name..."
                    style={{
                      marginTop: "8px",
                      padding: "4px 8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                      width: "150px",
                    }}
                    onKeyPress={(e) => {
                      if (
                        e.key === "Enter" &&
                        e.target.value.trim() &&
                        onCreateNewPD
                      ) {
                        onCreateNewPD(
                          e.target.value.trim(),
                          selectedPDItem.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Create Variant - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#fff3e0",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>Item Management</h4>
              <button
                onClick={() => {
                  const variantName = prompt(
                    `Create variant of "${
                      selectedPDItem.customTitle || selectedPDItem.displayName
                    }":`
                  );
                  if (variantName && onCreatePDVariant) {
                    onCreatePDVariant(selectedPDItem.word, variantName);
                  }
                }}
                style={{
                  backgroundColor: "#FF9800",
                  color: "white",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Create Variant
              </button>
            </div>

            <div style={{ marginTop: "15px" }}>
              {selectedPDItem.contextScene === null &&
                selectedPDItem.scenes &&
                selectedPDItem.scenes.length > 0 && (
                  <div
                    style={{
                      marginBottom: "10px",
                      padding: "8px",
                      backgroundColor: "#f0f8ff",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Browse Scenes with This Item (
                      {selectedPDItem.scenes.length} scenes)
                    </div>
                    <button
                      onClick={() => {
                        // Initialize viewing scene to first scene in the list
                        const firstSceneNumber = selectedPDItem.scenes[0];
                        setSelectedPDItem((prev) => ({
                          ...prev,
                          viewingSceneNumber: firstSceneNumber,
                        }));
                        setShowScenePreview(true);
                      }}
                      style={{
                        backgroundColor: "#2196F3",
                        color: "white",
                        padding: "6px 12px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "8px",
                        fontSize: "12px",
                      }}
                    >
                      View Scenes
                    </button>
                  </div>
                )}

              {/* Save/Cancel buttons for new custom PD items */}
              {selectedPDItem.isNewCustomPD && (
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <button
                    onClick={() => {
                      if (
                        selectedPDItem.customTitle &&
                        selectedPDItem.customTitle.trim() &&
                        onCreateNewPD
                      ) {
                        onCreateNewPD(selectedPDItem.customTitle.trim(), null);
                      }
                      setSelectedPDItem(null);
                    }}
                    style={{
                      backgroundColor: "#4ECDC4",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Save PD Item
                  </button>
                  <button
                    onClick={() => setSelectedPDItem(null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {selectedPDItem.contextScene !== null &&
                !selectedPDItem.isNewCustomPD && (
                  <button
                    onClick={() => setShowScenePreview(true)}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginRight: "10px",
                    }}
                  >
                    View Scene
                  </button>
                )}

              {!selectedPDItem.isNewCustomPD && (
                <button
                  onClick={() => setSelectedPDItem(null)}
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
              )}
            </div>
          </div>
        </>
      )}
      {/* Scene Preview Popup */}
      {selectedPDItem &&
        showScenePreview &&
        (selectedPDItem.contextScene !== null ||
          (selectedPDItem.contextScene === null &&
            selectedPDItem.viewingSceneNumber)) && (
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
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1002,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  let scene;
                  if (selectedPDItem.contextScene !== null) {
                    scene = scenes[selectedPDItem.contextScene];
                  } else {
                    const viewingSceneNumber =
                      selectedPDItem.viewingSceneNumber ||
                      selectedPDItem.scenes[0];
                    scene = scenes.find(
                      (s) => s.sceneNumber === String(viewingSceneNumber)
                    );
                  }

                  if (!scene) {
                    return (
                      <div style={{ padding: "20px" }}>Scene not found</div>
                    );
                  }

                  return (
                    <>
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
                        <div
                          style={{
                            margin: 0,
                            fontSize: "12pt",
                            fontFamily: "Courier New, monospace",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scene.sceneNumber}. {scene.heading}
                        </div>

                        {selectedPDItem.contextScene === null &&
                          selectedPDItem.scenes &&
                          selectedPDItem.scenes.length > 1 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                marginLeft: "15px",
                              }}
                            >
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedPDItem.scenes.indexOf(
                                      selectedPDItem.viewingSceneNumber ||
                                        selectedPDItem.scenes[0]
                                    );
                                  const prevIndex =
                                    currentIndex > 0
                                      ? currentIndex - 1
                                      : selectedPDItem.scenes.length - 1;
                                  setSelectedPDItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedPDItem.scenes[prevIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                ← Prev
                              </button>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "rgba(255,255,255,0.8)",
                                }}
                              >
                                {(() => {
                                  const currentIndex =
                                    selectedPDItem.scenes.indexOf(
                                      selectedPDItem.viewingSceneNumber ||
                                        selectedPDItem.scenes[0]
                                    );
                                  return `${currentIndex + 1} of ${
                                    selectedPDItem.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedPDItem.scenes.indexOf(
                                      selectedPDItem.viewingSceneNumber ||
                                        selectedPDItem.scenes[0]
                                    );
                                  const nextIndex =
                                    currentIndex <
                                    selectedPDItem.scenes.length - 1
                                      ? currentIndex + 1
                                      : 0;
                                  setSelectedPDItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedPDItem.scenes[nextIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}

                        <button
                          onClick={() => setShowScenePreview(false)}
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "white",
                            fontSize: "24px",
                            cursor: "pointer",
                            padding: "0 5px",
                            marginLeft: "15px",
                          }}
                        >
                          ×
                        </button>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          padding: "1.5in",
                          overflow: "auto",
                          backgroundColor: "white",
                          boxSizing: "border-box",
                          textAlign: "left",
                          fontFamily: "Courier New, monospace",
                          lineHeight: "1.6",
                          fontSize: "14px",
                        }}
                      >
                        {scene.content.map((block, blockIndex) => {
                          const renderContent = () => {
                            const words = block.text.split(/(\s+)/);
                            return words.map((word, wordIndex) => {
                              if (!word.trim()) return word;

                              const cleanWord = word
                                .toLowerCase()
                                .replace(/[^\w]/g, "");
                              const stemmedWord = stemWord
                                ? stemWord(cleanWord)
                                : cleanWord;

                              const isCurrentItem =
                                stemmedWord === selectedPDItem.word;
                              const isTagged = Object.keys(taggedItems).some(
                                (taggedWord) => stemmedWord === taggedWord
                              );

                              if (isCurrentItem) {
                                return (
                                  <span
                                    key={wordIndex}
                                    style={{
                                      backgroundColor: selectedPDItem.color,
                                      color: "white",
                                      padding: "2px 4px",
                                      borderRadius: "3px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {word}
                                  </span>
                                );
                              } else if (isTagged) {
                                const taggedItem = Object.entries(
                                  taggedItems
                                ).find(([key]) => stemmedWord === key);
                                return (
                                  <span
                                    key={wordIndex}
                                    style={{
                                      backgroundColor:
                                        taggedItem?.[1]?.color || "#ccc",
                                      color: "white",
                                      padding: "1px 2px",
                                      borderRadius: "2px",
                                      opacity: 0.7,
                                    }}
                                  >
                                    {word}
                                  </span>
                                );
                              }

                              return word;
                            });
                          };

                          return (
                            <div
                              key={blockIndex}
                              style={{
                                marginBottom: "15px",
                                textAlign:
                                  block.type === "Scene Heading"
                                    ? "center"
                                    : "left",
                                fontWeight:
                                  block.type === "Scene Heading"
                                    ? "bold"
                                    : "normal",
                                fontSize:
                                  block.type === "Scene Heading"
                                    ? "16px"
                                    : "14px",
                                marginLeft:
                                  block.type === "Character"
                                    ? "200px"
                                    : block.type === "Dialogue"
                                    ? "100px"
                                    : block.type === "Parenthetical"
                                    ? "150px"
                                    : "0px",
                                marginRight:
                                  block.type === "Dialogue" ? "100px" : "0px",
                                textTransform:
                                  block.type === "Character"
                                    ? "uppercase"
                                    : "none",
                                fontStyle:
                                  block.type === "Parenthetical"
                                    ? "italic"
                                    : "normal",
                              }}
                            >
                              {renderContent()}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
    </div>
  );
}

// Slideshow Component
function Slideshow({
  scenes,
  currentIndex,
  taggedItems,
  tagCategories,
  showTagDropdown,
  setShowTagDropdown,
  tagWord,
  untagWordInstance,
  isWordInstanceTagged,
  getSceneStatusColor,
  isEditMode,
  onSceneContentChange,
}) {
  // Add this useEffect to scroll to top when scene changes
  useEffect(() => {
    const scriptContainer = document.getElementById("script-viewer-container");
    if (scriptContainer) {
      scriptContainer.scrollTop = 0;
    }
  }, [currentIndex]); // Trigger whenever currentIndex changes

  const [editingContent, setEditingContent] = useState([]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);

  const elementTypes = [
    "Scene Heading",
    "Action",
    "Character",
    "Dialogue",
    "Parenthetical",
    "Transition",
  ];

  // Initialize editing content when entering edit mode
  useEffect(() => {
    if (isEditMode && scenes[currentIndex]) {
      setEditingContent([...scenes[currentIndex].content]);
    }
  }, [isEditMode, currentIndex, scenes]);

  const updateBlockText = (blockIndex, newText) => {
    const updatedContent = [...editingContent];
    updatedContent[blockIndex].text = newText;
    setEditingContent(updatedContent);
  };

  const updateBlockType = (blockIndex, newType) => {
    const updatedContent = [...editingContent];
    updatedContent[blockIndex].type = newType;

    // Auto-format based on type
    if (newType === "Character") {
      updatedContent[blockIndex].text =
        updatedContent[blockIndex].text.toUpperCase();
    }

    setEditingContent(updatedContent);
  };

  const addNewBlock = (afterIndex) => {
    const updatedContent = [...editingContent];
    const newBlock = {
      type: "Action",
      text: "",
      formatting: null,
    };
    updatedContent.splice(afterIndex + 1, 0, newBlock);
    setEditingContent(updatedContent);
    setSelectedBlockIndex(afterIndex + 1);
  };

  const deleteBlock = (blockIndex) => {
    if (editingContent.length > 1) {
      const updatedContent = [...editingContent];
      updatedContent.splice(blockIndex, 1);
      setEditingContent(updatedContent);
      setSelectedBlockIndex(null);
    }
  };

  const saveChanges = () => {
    if (onSceneContentChange) {
      onSceneContentChange(editingContent);
    }
  };

  if (scenes.length === 0) {
    return (
      <div style={{ fontStyle: "italic" }}>
        No project loaded. Please upload a .fdx file to begin.
      </div>
    );
  }

  const scene = scenes[currentIndex];

  const handleWordDoubleClick = (event, word, blockIndex, wordIndex) => {
    event.preventDefault();
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const isTagged = isWordInstanceTagged(
      cleanWord,
      currentIndex,
      blockIndex,
      wordIndex
    );

    if (isTagged) {
      // Show dropdown for untagging this specific instance
      setShowTagDropdown({
        x: event.clientX,
        y: event.clientY,
        word: word,
        cleanWord: cleanWord,
        sceneIndex: currentIndex,
        blockIndex: blockIndex,
        wordIndex: wordIndex,
        isTagged: true,
        category: taggedItems[cleanWord].category,
      });
    } else {
      // Show dropdown for tagging
      setShowTagDropdown({
        x: event.clientX,
        y: event.clientY,
        word: word,
        cleanWord: cleanWord,
        sceneIndex: currentIndex,
        blockIndex: blockIndex,
        wordIndex: wordIndex,
        isTagged: false,
      });
    }
  };

  const renderTextWithTags = (text, blockIndex, block) => {
    // Handle formatted text elements first
    if (block && block.formatting) {
      const formattedElement = formatElementText(block);
      if (React.isValidElement(formattedElement)) {
        return formattedElement;
      }
    }

    const words = text.split(/(\s+)/);
    return words.map((word, wordIndex) => {
      if (word.trim() === "") return word; // Preserve whitespace

      const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
      const taggedItem = taggedItems[cleanWord];
      const isThisInstanceTagged = isWordInstanceTagged(
        cleanWord,
        currentIndex,
        blockIndex,
        wordIndex
      );

      return (
        <span
          key={wordIndex}
          onDoubleClick={(e) =>
            handleWordDoubleClick(e, word, blockIndex, wordIndex)
          }
          style={{
            backgroundColor: isThisInstanceTagged
              ? taggedItem.color
              : "transparent",
            cursor: "pointer",
            padding: isThisInstanceTagged ? "1px 2px" : "0",
            borderRadius: isThisInstanceTagged ? "2px" : "0",
          }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div style={{ minWidth: "6.1in", width: "6.1in" }}>
      <h2
        style={{
          marginBottom: "20px",
          textTransform: "uppercase",
          backgroundColor: getSceneStatusColor(scene.sceneNumber),
          padding:
            getSceneStatusColor(scene.sceneNumber) !== "transparent"
              ? "8px 12px"
              : "0",
          borderRadius:
            getSceneStatusColor(scene.sceneNumber) !== "transparent"
              ? "4px"
              : "0",
          display: "inline-block",
        }}
      >
        {scene.sceneNumber}: {scene.heading}
      </h2>

      {scene.metadata && (
        <div
          style={{
            backgroundColor: "#f0f0f0",
            padding: "10px",
            marginBottom: "20px",
            fontSize: "12px",
            border: "1px solid #ddd",
          }}
        >
          <strong>Scene Info:</strong>
          {scene.metadata.location && ` Location: ${scene.metadata.location}`}
          {scene.metadata.timeOfDay && ` | Time: ${scene.metadata.timeOfDay}`}
          {scene.metadata.intExt && ` | ${scene.metadata.intExt}`}
          {(() => {
            try {
              const sceneStats = calculateScenePageStats(
                currentIndex,
                scenes,
                107
              );
              return ` | Page ${sceneStats.startPage} | Length: ${sceneStats.pageLength}`;
            } catch (error) {
              return ` | Page calc error: ${error.message}`;
            }
          })()}
        </div>
      )}

      <div>
        {isEditMode
          ? // Edit Mode Rendering
            editingContent.map((block, blockIndex) => {
              const style = getElementStyle(block.type);
              const isSelected = selectedBlockIndex === blockIndex;

              return (
                <div style={{ position: "relative" }}>
                  {/* Element Type Selector - only show when selected */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-30px",
                        left: "0",
                        display: "flex",
                        gap: "5px",
                        zIndex: 100,
                        backgroundColor: "white",
                        padding: "2px",
                        border: "1px solid #ccc",
                        borderRadius: "3px",
                      }}
                    >
                      <select
                        value={block.type}
                        onChange={(e) =>
                          updateBlockType(blockIndex, e.target.value)
                        }
                        style={{
                          fontSize: "10px",
                          padding: "2px",
                          backgroundColor: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "2px",
                        }}
                      >
                        {elementTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addNewBlock(blockIndex);
                        }}
                        style={{
                          fontSize: "10px",
                          padding: "2px 4px",
                          backgroundColor: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                        title="Add block after this one"
                      >
                        +
                      </button>

                      {editingContent.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBlock(blockIndex);
                          }}
                          style={{
                            fontSize: "10px",
                            padding: "2px 4px",
                            backgroundColor: "#F44336",
                            color: "white",
                            border: "none",
                            borderRadius: "2px",
                            cursor: "pointer",
                          }}
                          title="Delete this block"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}

                  {/* Editable Content */}
                  <div
                    key={blockIndex}
                    style={{
                      ...style,
                      border: isSelected
                        ? "2px solid #2196F3"
                        : "1px solid transparent",
                      position: "relative",
                      cursor: "text",
                      minHeight: "12pt",
                    }}
                    contentEditable
                    suppressContentEditableWarning={true}
                    onInput={(e) =>
                      updateBlockText(blockIndex, e.target.textContent)
                    }
                    onClick={() => setSelectedBlockIndex(blockIndex)}
                    dangerouslySetInnerHTML={{ __html: block.text }}
                  />
                </div>
              );
            })
          : // View Mode Rendering with proper formatting
            scene.content.map((block, blockIndex) => {
              const style = getElementStyle(block.type);
              return (
                <div key={blockIndex} style={style}>
                  {block.formatting
                    ? formatElementText(block)
                    : renderTextWithTags(block.text, blockIndex, block)}
                </div>
              );
            })}
      </div>

      {/* Tag Dropdown */}
      {showTagDropdown && (
        <div
          style={{
            position: "fixed",
            left: showTagDropdown.x,
            top: showTagDropdown.y,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            minWidth: "150px",
          }}
        >
          {showTagDropdown.isTagged ? (
            <div
              onClick={() =>
                untagWordInstance(
                  showTagDropdown.word,
                  showTagDropdown.sceneIndex,
                  showTagDropdown.blockIndex,
                  showTagDropdown.wordIndex
                )
              }
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
            >
              Remove Tag ({showTagDropdown.category})
            </div>
          ) : (
            tagCategories.map((category, index) => (
              <div
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tagWord(
                    showTagDropdown.word,
                    category.name,
                    showTagDropdown.sceneIndex,
                    showTagDropdown.blockIndex,
                    showTagDropdown.wordIndex
                  );
                }}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom:
                    index < tagCategories.length - 1
                      ? "1px solid #eee"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseOver={(e) =>
                  (e.target.style.backgroundColor = "#f0f0f0")
                }
                onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: category.color,
                    marginRight: "8px",
                    borderRadius: "2px",
                  }}
                ></div>
                {category.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showTagDropdown && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 999,
          }}
          onClick={() => setShowTagDropdown(null)}
        />
      )}
    </div>
  );
}

// getElementStyle function moved to utils.js

// formatElementText function moved to utils.js

// Scene Dropdown
function SceneDropdown({
  scenes,
  currentIndex,
  setCurrentIndex,
  onSceneNumberChange,
  getSceneStatusColor,
  selectedProject,
  user,
}) {
  const [viewingSceneIndex, setViewingSceneIndex] = React.useState(null);
  const { otherUsers } = usePresence(
    selectedProject?.id,
    user,
    "script",
    viewingSceneIndex !== null ? scenes[viewingSceneIndex]?.sceneNumber : null
  );
  const [editingScene, setEditingScene] = useState(null);
  const [newSceneNumber, setNewSceneNumber] = useState("");

  if (scenes.length === 0) return null;

  const handleSceneNumberEdit = (sceneIndex) => {
    setEditingScene(sceneIndex);
    setNewSceneNumber(scenes[sceneIndex].sceneNumber);
  };

  const handleSceneNumberSave = () => {
    if (editingScene !== null && newSceneNumber.trim()) {
      onSceneNumberChange(editingScene, newSceneNumber.trim());
    }
    setEditingScene(null);
    setNewSceneNumber("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSceneNumberSave();
    } else if (e.key === "Escape") {
      setEditingScene(null);
      setNewSceneNumber("");
    }
  };

  return (
    <div style={{ marginLeft: "20px", height: "1000px" }}>
      <div
        style={{
          height: "1000px",
          width: "500px",
          border: "2px inset #ccc",
          backgroundColor: "white",
          fontFamily: "monospace",
          fontSize: "12px",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {scenes.map((scene, index) => {
          const statusColor = getSceneStatusColor(scene.sceneNumber);
          const isCurrentScene = currentIndex === index;

          return (
            <PresenceIndicator
              key={index}
              itemId={scene.sceneNumber}
              otherUsers={otherUsers}
              position="top"
            >
              <div
                onClick={() => {
                  setCurrentIndex(index);
                  setViewingSceneIndex(index);
                }}
                onDoubleClick={() => handleSceneNumberEdit(index)}
                style={{
                  padding: "2px 8px",
                  cursor: "pointer",
                  backgroundColor: isCurrentScene
                    ? "#316AC5"
                    : statusColor !== "transparent"
                    ? statusColor
                    : "white",
                  color: isCurrentScene ? "white" : "black",
                  borderBottom: "1px solid #f0f0f0",
                  userSelect: "none",
                }}
              >
                <strong style={{ fontSize: "14px" }}>
                  {String(scene.sceneNumber).padStart(3, "0")}
                </strong>
                {" - "}
                {scene.heading}
              </div>
            </PresenceIndicator>
          );
        })}
      </div>

      {/* Scene Number Edit Modal */}
      {editingScene !== null && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 1000,
            }}
            onClick={() => setEditingScene(null)}
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
              zIndex: 1001,
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Edit Scene Number</h3>
            <p>Current: Scene {scenes[editingScene].sceneNumber}</p>
            <div style={{ marginBottom: "15px" }}>
              <label>
                <strong>New Scene Number:</strong>
                <input
                  type="text"
                  value={newSceneNumber}
                  onChange={(e) => setNewSceneNumber(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., 29A, 15B"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "5px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                />
              </label>
            </div>
            <div>
              <button
                onClick={handleSceneNumberSave}
                style={{
                  backgroundColor: "#2196F3",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginRight: "10px",
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingScene(null)}
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

// Navigation Buttons
function NavigationButtons({ scenes, setCurrentIndex }) {
  if (scenes.length === 0) return null;

  return (
    <div style={{ textAlign: "right", marginTop: "10px", width: "1000px" }}>
      <button
        onClick={() =>
          setCurrentIndex((prev) => (prev - 1 + scenes.length) % scenes.length)
        }
        style={{ padding: "8px 16px", marginRight: "10px" }}
      >
        ← Previous
      </button>
      <button
        onClick={() => setCurrentIndex((prev) => (prev + 1) % scenes.length)}
        style={{ padding: "8px 16px" }}
      >
        Next →
      </button>
    </div>
  );
}

function StripboardModule({
  scenes,
  onLocationClick,
  taggedItems,
  characters,
  castCrew,
  wardrobeItems,
  onUpdateScene,
}) {
  const [selectedScenes, setSelectedScenes] = React.useState([]);
  const [editingTime, setEditingTime] = React.useState(null);
  const [editingStatus, setEditingStatus] = React.useState(null);
  const [editingDescription, setEditingDescription] = React.useState(null);
  const [editingNotes, setEditingNotes] = React.useState(null);
  const [showLocationPopup, setShowLocationPopup] = React.useState(null);
  const [showScriptPopup, setShowScriptPopup] = React.useState(false);
  const [selectedSceneForScript, setSelectedSceneForScript] =
    React.useState(null);
  const scrollContainerRef = useRef(null);

  const handleSceneClick = (scene) => {
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
  };

  const getSceneStatusColor = (status) => {
    const colors = {
      Scheduled: "#e8f5e9",
      Shot: "#e8f5e9",
      Pickups: "#fff8e1",
      Reshoot: "#ffebee",
      "Not Scheduled": "transparent",
    };
    return colors[status] || "transparent";
  };

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
        return { ...baseStyle, marginLeft: "100px", marginRight: "100px" };
      case "Parenthetical":
        return { ...baseStyle, marginLeft: "150px", fontStyle: "italic" };
      case "Action":
        return { ...baseStyle, marginLeft: "0", marginRight: "0" };
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

  const formatElementText = (block) => {
    let text = block.text;
    if (block.formatting) {
      if (block.formatting.bold)
        return React.createElement("strong", null, text);
      if (block.formatting.italic) return React.createElement("em", null, text);
      if (block.formatting.underline)
        return React.createElement("u", null, text);
    }
    if (block.type === "Character" && text.includes("(")) {
      const parts = text.split("(");
      const name = parts[0].trim();
      const extension = parts[1] ? `(${parts[1]}` : "";
      return React.createElement(
        "span",
        null,
        name,
        extension &&
          React.createElement(
            "span",
            { style: { fontWeight: "normal" } },
            ` ${extension}`
          )
      );
    }
    return text;
  };

  // Restore scroll position on mount
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const savedPosition = sessionStorage.getItem("stripboard-scroll-position");
    if (savedPosition !== null) {
      scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
    }
  }, []);

  // Save scroll position when user scrolls
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(
        "stripboard-scroll-position",
        scrollContainerRef.current.scrollTop.toString()
      );
    }
  };

  // Status counter function
  const getStatusCounts = (scenes) => {
    const counts = {
      total: scenes.length,
      "Not Scheduled": 0,
      Scheduled: 0,
      Shot: 0,
      Pickups: 0,
      Reshoots: 0,
      Removed: 0,
    };

    scenes.forEach((scene) => {
      const status = scene.status || "Not Scheduled";

      if (status.includes("Pickups")) {
        counts["Pickups"]++;
        if (status.includes("Scheduled")) counts["Scheduled"]++;
        if (status.includes("Shot")) counts["Shot"]++;
      } else if (status.includes("Reshoot")) {
        counts["Reshoots"]++;
        if (status.includes("Scheduled")) counts["Scheduled"]++;
        if (status.includes("Shot")) counts["Shot"]++;
      } else {
        counts[status] = (counts[status] || 0) + 1;
      }
    });

    return counts;
  };

  // Function to get all tagged items for a scene
  const getSceneTaggedItems = (sceneNumber) => {
    const sceneItems = {
      props: [],
      makeup: [],
      productionDesign: [],
      wardrobe: [],
      locations: [],
      cast: [],
      vehicles: [],
      specialEffects: [],
      stunts: [],
      extras: [],
      animals: [],
    };

    if (!taggedItems) return sceneItems;

    Object.entries(taggedItems).forEach(([word, item]) => {
      if (item.scenes && item.scenes.includes(sceneNumber)) {
        const category = item.category.toLowerCase().replace(" ", "");
        if (category === "productiondesign") {
          sceneItems.productionDesign.push(item.displayName);
        } else if (sceneItems[category]) {
          sceneItems[category].push(item.displayName);
        }
      }
    });

    // Override wardrobe with data from Wardrobe module
    const wardrobeData = getSceneWardrobe(sceneNumber);
    if (wardrobeData) {
      sceneItems.wardrobe = wardrobeData
        .split(", ")
        .filter((item) => item.trim() !== "");
    }

    return sceneItems;
  };

  // Function to get characters for a scene
  const getSceneCharacters = (sceneNumber) => {
    if (!characters) return [];

    return Object.values(characters)
      .filter((char) => char.scenes && char.scenes.includes(sceneNumber))
      .sort(
        (a, b) =>
          (a.chronologicalNumber || 999) - (b.chronologicalNumber || 999)
      )
      .map((char) => `${char.chronologicalNumber}. ${char.name}`);
  };

  const getSceneWardrobe = (sceneNumber) => {
    if (!wardrobeItems || wardrobeItems.length === 0) {
      return "";
    }

    const wardrobeForScene = [];

    wardrobeItems.forEach((character) => {
      if (character.items) {
        character.items.forEach((item) => {
          if (item.scenes && item.scenes.includes(parseInt(sceneNumber))) {
            wardrobeForScene.push(`${character.characterName} ${item.number}`);
          }
        });
      }
    });

    return wardrobeForScene.join(", ");
  };

  const getSceneCastCrew = (sceneNumber) => {
    if (!castCrew || !characters) {
      return [];
    }

    const result = castCrew
      .filter((person) => {
        if (person.type !== "cast") {
          return false;
        }
        const characterName = person.character;

        if (characterName && characters[characterName]) {
          const hasScene =
            characters[characterName].scenes &&
            characters[characterName].scenes.includes(sceneNumber);
          return hasScene;
        }
        return false;
      })
      .map((person) => {
        const character = characters[person.character];
        const characterNumber = character ? character.chronologicalNumber : "";
        return {
          name: person.displayName,
          character: person.character,
          characterNumber: characterNumber,
          displayText: characterNumber
            ? `${characterNumber}. ${person.displayName}`
            : person.displayName,
        };
      })
      .sort((a, b) => (a.characterNumber || 999) - (b.characterNumber || 999));

    return result;
  };

  const getStatusColor = (status, isScheduled = false) => {
    // For scheduled Pickups and Reshoots, use blue background with colored border
    if (isScheduled && (status === "Pickups" || status === "Reshoot")) {
      return "#2196F3"; // Blue background for scheduled items
    }

    switch (status) {
      case "Scheduled":
        return "#2196F3"; // Vivid blue
      case "Shot":
        return "#4CAF50"; // Vivid green
      case "Pickups":
        return "#FFC107"; // Vivid yellow/amber
      case "Reshoot":
        return "#F44336"; // Vivid red
      case "Removed":
        return "#FF00FF"; // Magenta for removed scenes
      default:
        return "#f0f0f0"; // Light gray for "Not Scheduled"
    }
  };

  const getStatusBorder = (status, isScheduled = false) => {
    // For scheduled Pickups and Reshoots, add colored border
    if (isScheduled && status === "Pickups") {
      return "5px solid #FFC107"; // Yellow border for Pickups (increased from 3px to 5px)
    }
    if (isScheduled && status === "Reshoot") {
      return "5px solid #F44336"; // Red border for Reshoots (increased from 3px to 5px)
    }
    return "1px solid #ddd"; // Default border
  };

  if (scenes.length === 0) {
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
        <h2>Stripboard</h2>
        <p>No scenes loaded. Please upload a script first.</p>
      </div>
    );
  }

  const timeOptions = [];
  for (let hours = 0; hours < 8; hours++) {
    for (let mins = 0; mins < 60; mins += 15) {
      const totalMins = hours * 60 + mins;
      const label =
        totalMins === 0
          ? "0 min"
          : totalMins < 60
          ? `${totalMins} min`
          : totalMins === 60
          ? "1 hour"
          : totalMins % 60 === 0
          ? `${Math.floor(totalMins / 60)} hours`
          : `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
      timeOptions.push({ value: label, label });
    }
  }

  const statusOptions = [
    "Not Scheduled",
    "Scheduled",
    "Shot",
    "Pickups",
    "Reshoot",
    "Removed",
  ];

  const toggleSceneSelection = (index) => {
    setSelectedScenes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleLocationClick = (location, scene) => {
    setShowLocationPopup({ location, scene });
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        padding: "20px",
        width: "100%",
        height: "calc(100vh - 40px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <h2>Stripboard - Scene Breakdown</h2>
      <div
        style={{
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#f5f5f5",
          borderRadius: "5px",
          fontWeight: "bold",
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
          alignItems: "center",
        }}
      >
        {(() => {
          const statusCounts = getStatusCounts(scenes);
          return (
            <>
              <span style={{ color: "#333" }}>Total: {statusCounts.total}</span>
              <span
                style={{
                  color: "#666",
                  backgroundColor: "#f0f0f0",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Not Scheduled: {statusCounts["Not Scheduled"]}
              </span>
              <span
                style={{
                  color: "white",
                  backgroundColor: "#2196F3",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Scheduled: {statusCounts["Scheduled"]}
              </span>
              <span
                style={{
                  color: "white",
                  backgroundColor: "#4CAF50",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Shot: {statusCounts["Shot"]}
              </span>
              <span
                style={{
                  color: "black",
                  backgroundColor: "#FFC107",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Pickups: {statusCounts["Pickups"]}
              </span>
              <span
                style={{
                  color: "white",
                  backgroundColor: "#F44336",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Reshoots: {statusCounts["Reshoots"]}
              </span>
              <span
                style={{
                  color: "white",
                  backgroundColor: "#9E9E9E",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                Removed: {statusCounts["Removed"]}
              </span>
            </>
          );
        })()}
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          maxWidth: "calc(100vw - 160px)",
        }}
      >
        {/* Header Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "50px 80px 40px 40px 120px 250px 40px 110px 100px 50px 50px 70px 100px 130px",
            gap: "5px",
            padding: "8px",
            backgroundColor: "#4CAF50",
            color: "white",
            fontWeight: "bold",
            fontSize: "8px",
            borderBottom: "2px solid #388E3C",
            minWidth: "1150px",
          }}
        >
          <div>Script</div>
          <div>Status</div>
          <div>Scene</div>
          <div>I/E</div>
          <div>Scene Settings</div>
          <div>Description</div>
          <div>D/N</div>
          <div>Cast</div>
          <div>Location</div>
          <div>Page #</div>
          <div>Pages</div>
          <div>Wardrobe</div>
          <div>Props</div>
          <div>Notes</div>
        </div>

        {/* Scene Rows */}
        {scenes.map((scene, index) => {
          const sceneCharacters = getSceneCharacters(scene.sceneNumber);
          const sceneCastCrew = getSceneCastCrew(scene.sceneNumber);
          const sceneItems = getSceneTaggedItems(scene.sceneNumber);
          // Override wardrobe with our wardrobe module data
          sceneItems.wardrobe = getSceneWardrobe(scene.sceneNumber)
            .split(", ")
            .filter((item) => item.trim() !== "");
          const isScheduled = !!scene.scheduledDate; // Check if scene is scheduled

          return (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "50px 80px 40px 40px 120px 250px 40px 110px 100px 50px 50px 70px 100px 130px",
                gap: "5px",
                padding: "8px",
                backgroundColor: getStatusColor(
                  scene.status || "Not Scheduled",
                  isScheduled
                ),
                outline: getStatusBorder(
                  scene.status || "Not Scheduled",
                  isScheduled
                ),
                borderBottom: "1px solid #ddd",
                fontSize: "9px",
                minHeight: "25px",
                alignItems: "start",
                minWidth: "1150px",
              }}
            >
              <div>
                <button
                  onClick={() => handleSceneClick(scene)}
                  style={{
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "2px",
                    padding: "2px 5px",
                    fontSize: "8px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                  }}
                >
                  Script
                </button>
              </div>
              <div>
                <select
                  value={scene.status || "Not Scheduled"}
                  onChange={(e) => {
                    if (onUpdateScene) {
                      onUpdateScene(index, "status", e.target.value);
                    }
                  }}
                  style={{
                    width: "75px",
                    fontSize: "8px",
                    padding: "1px 14px 1px 2px",
                    border: "1px solid #ccc",
                    borderRadius: "2px",
                    backgroundColor: "white",
                  }}
                >
                  <option value="Not Scheduled">Unscheduled</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Shot">Shot</option>
                  <option value="Pickups">Pickups</option>
                  <option value="Reshoot">Reshoot</option>
                  <option value="Removed">Removed</option>
                </select>
              </div>
              <div style={{ fontWeight: "bold" }}>{scene.sceneNumber}</div>
              <div>{scene.metadata?.intExt || ""}</div>
              <div>{scene.metadata?.location || ""}</div>
              <div style={{ lineHeight: "1.3" }}>
                {editingDescription === index ? (
                  <input
                    type="text"
                    value={scene.description || ""}
                    onChange={(e) => {
                      if (onUpdateScene) {
                        onUpdateScene(index, "description", e.target.value);
                      }
                    }}
                    onBlur={() => setEditingDescription(null)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        setEditingDescription(null);
                      }
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      padding: "2px",
                      border: "1px solid #2196F3",
                      borderRadius: "2px",
                    }}
                  />
                ) : (
                  <div
                    onDoubleClick={() => setEditingDescription(index)}
                    style={{
                      cursor: "text",
                      minHeight: "16px",
                      padding: "2px",
                      borderRadius: "2px",
                    }}
                    onMouseOver={(e) =>
                      (e.target.style.backgroundColor = "#f5f5f5")
                    }
                    onMouseOut={(e) =>
                      (e.target.style.backgroundColor = "transparent")
                    }
                    title="Double-click to edit"
                  >
                    {scene.description || "Double-click to add description"}
                  </div>
                )}
              </div>
              <div>
                {scene.metadata?.timeOfDay ? (
                  // Display the detected time of day
                  scene.metadata.timeOfDay
                ) : (
                  // Show dropdown when no time of day is detected
                  <select
                    value={scene.manualTimeOfDay || ""}
                    onChange={(e) => {
                      if (onUpdateScene) {
                        onUpdateScene(index, "manualTimeOfDay", e.target.value);
                      }
                    }}
                    style={{
                      width: "35px",
                      fontSize: "9px",
                      padding: "1px",
                      border: "1px solid #ccc",
                      borderRadius: "2px",
                      backgroundColor: "white",
                    }}
                  >
                    <option value="">--</option>
                    <option value="DAY">DAY</option>
                    <option value="NIGHT">NIGHT</option>
                    <option value="DAWN">DAWN</option>
                    <option value="DUSK">DUSK</option>
                  </select>
                )}
              </div>
              <div style={{ lineHeight: "1.2" }}>
                {sceneCastCrew.map((p, index) => (
                  <div
                    key={index}
                    style={{ fontSize: "10px", marginBottom: "1px" }}
                  >
                    {p.displayText}
                  </div>
                ))}
              </div>
              <div>{scene.metadata?.location || ""}</div>
              <div>{scene.pageNumber || "1"}</div>
              <div>{scene.pageLength || "1/8"}</div>
              <div>{sceneItems.wardrobe.join(", ")}</div>
              <div>{sceneItems.props.join(", ")}</div>
              <div style={{ lineHeight: "1.3" }}>
                {editingNotes === index ? (
                  <input
                    type="text"
                    value={scene.notes || ""}
                    onChange={(e) => {
                      if (onUpdateScene) {
                        onUpdateScene(index, "notes", e.target.value);
                      }
                    }}
                    onBlur={() => setEditingNotes(null)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        setEditingNotes(null);
                      }
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      padding: "2px",
                      border: "1px solid #2196F3",
                      borderRadius: "2px",
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setEditingNotes(index)}
                    style={{
                      cursor: "pointer",
                      minHeight: "16px",
                      padding: "2px",
                      borderRadius: "2px",
                    }}
                    onMouseOver={(e) =>
                      (e.target.style.backgroundColor = "#f5f5f5")
                    }
                    onMouseOut={(e) =>
                      (e.target.style.backgroundColor = "transparent")
                    }
                  >
                    {scene.notes || "Add notes"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showLocationPopup && (
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
            onClick={() => setShowLocationPopup(null)}
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
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Location Details</h3>
            <p>
              <strong>Script Location:</strong> {showLocationPopup.location}
            </p>
            <p>
              <strong>Type:</strong> {showLocationPopup.scene.metadata?.intExt}
            </p>
            <p>
              <strong>Scene:</strong> {showLocationPopup.scene.sceneNumber} -{" "}
              {showLocationPopup.scene.heading}
            </p>

            <div style={{ marginTop: "15px" }}>
              <button
                onClick={() => {
                  setShowLocationPopup(null);
                  onLocationClick && onLocationClick();
                }}
                style={{
                  backgroundColor: "#2196F3",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginRight: "10px",
                }}
              >
                Go to Locations
              </button>
              <button
                onClick={() => setShowLocationPopup(null)}
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

      {/* Script Popup Modal */}
      {showScriptPopup && selectedSceneForScript && (
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
            onClick={closeScriptPopup}
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
                  Scene {selectedSceneForScript.sceneNumber} —{" "}
                  {selectedSceneForScript.heading}
                </h3>
                <button
                  onClick={closeScriptPopup}
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
              <div
                style={{
                  flex: 1,
                  padding: "1.5in",
                  overflow: "auto",
                  backgroundColor: getSceneStatusColor(
                    selectedSceneForScript.status || "Not Scheduled"
                  ),
                  boxSizing: "border-box",
                  textAlign: "left",
                  fontFamily: "Courier New, monospace",
                }}
              >
                <div style={getElementStyle("Scene Heading")}>
                  {selectedSceneForScript.heading}
                </div>
                {selectedSceneForScript.content &&
                  selectedSceneForScript.content.map((block, blockIndex) => (
                    <div key={blockIndex} style={getElementStyle(block.type)}>
                      {formatElementText(block)}
                    </div>
                  ))}
                {!selectedSceneForScript.content && (
                  <div style={getElementStyle("Action")}>
                    {selectedSceneForScript.text ||
                      "Scene content not available"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Enhanced Stripboard Schedule Module with Fixed Available Scenes Panel
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

  // Queue system for batch lock operations
  const lockQueue = useRef([]);
  const lockTimeout = useRef(null);

  // Auto-scroll to first unlocked/uncollapsed day on module load
  useEffect(() => {
    if (!scrollContainerRef.current || !shootingDays.length) return;

    const storageKey = "stripboard-schedule-scroll-position";
    const hasAutoScrolledKey = "stripboard-schedule-has-auto-scrolled";

    // Check if we have a saved scroll position from previous visit
    const savedPosition = sessionStorage.getItem(storageKey);
    const hasAutoScrolled = sessionStorage.getItem(hasAutoScrolledKey);

    if (savedPosition !== null) {
      // Restore saved position
      scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
      return;
    }

    // Only auto-scroll if we haven't done it this session
    if (hasAutoScrolled === "true") {
      return;
    }

    // Find first day that is both unlocked AND uncollapsed
    const firstActiveDay = shootingDays.find(
      (day) => !day.isLocked && !day.isCollapsed
    );

    if (firstActiveDay) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const dayElement = document.getElementById(`day-${firstActiveDay.id}`);
        if (dayElement && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = dayElement.offsetTop - 20;
          sessionStorage.setItem(hasAutoScrolledKey, "true");
        }
      }, 0);
    } else {
      // All days are locked/collapsed, stay at top
      scrollContainerRef.current.scrollTop = 0;
      sessionStorage.setItem(hasAutoScrolledKey, "true");
    }
  }, [shootingDays]);

  // Save scroll position when user scrolls manually
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
      // Find the script scene that matches this scene number
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
  };

  // Helper function to get scene status color (matching Script module)
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

  // Element styling function (from utils.js)
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

  const formatElementText = (block) => {
    let text = block.text;

    if (block.formatting) {
      if (block.formatting.bold) {
        return React.createElement("strong", null, text);
      }
      if (block.formatting.italic) {
        return React.createElement("em", null, text);
      }
      if (block.formatting.underline) {
        return React.createElement("u", null, text);
      }
    }

    if (block.type === "Character" && text.includes("(")) {
      const parts = text.split("(");
      const name = parts[0].trim();
      const extension = parts[1] ? `(${parts[1]}` : "";
      return React.createElement(
        "span",
        null,
        name,
        extension &&
          React.createElement(
            "span",
            { style: { fontWeight: "normal" } },
            ` ${extension}`
          )
      );
    }

    return text;
  };

  const createDefaultScheduleBlocks = () => {
    const blocks = [];

    // 6 initial scene slots
    for (let i = 0; i < 6; i++) {
      blocks.push({
        id: crypto.randomUUID(),
        scene: null,
        time: "8:00 AM",
        type: "scene",
      });
    }

    // Lunch break
    blocks.push({
      id: crypto.randomUUID(),
      scene: null,
      time: "12:00 PM",
      type: "lunch",
      isLunch: true,
    });

    // 2 more scene slots
    blocks.push({
      id: crypto.randomUUID(),
      scene: null,
      time: "1:00 PM",
      type: "scene",
    });

    blocks.push({
      id: crypto.randomUUID(),
      scene: null,
      time: "2:00 PM",
      type: "scene",
    });

    // End of day
    blocks.push({
      id: crypto.randomUUID(),
      scene: null,
      time: "END OF DAY",
      type: "endofday",
      isEndOfDay: true,
    });

    return blocks;
  };

  // DISABLED: Auto-creation of first day (project already has shooting days established)
  // This useEffect was creating phantom days on refresh
  /*
  React.useEffect(() => {
    console.log(
      "🔄 StripboardSchedule useEffect - shootingDays.length:",
      shootingDays.length
    );
    console.log(
      "🔄 StripboardSchedule stripboardScenes.length:",
      stripboardScenes.length
    );
    console.log(
      "🔄 StripboardSchedule available scenes:",
      stripboardScenes.filter((scene) => !scene.scheduledDate).length
    );

    if (shootingDays.length === 0) {
      // No days exist - create the first day
      const firstDay = {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split("T")[0],
        dayNumber: 1,
        scheduleBlocks: createDefaultScheduleBlocks(),
      };
      setShootingDays([firstDay]);

      // Sync to database
      if (onSyncAllShootingDays) {
        onSyncAllShootingDays();
        console.log("✅ First day created and synced to database");
      }
    } else if (
      shootingDays.length > 0 &&
      shootingDays[0].scheduleBlocks.length === 0
    ) {
      // First day exists but has no schedule blocks - initialize them
      const updatedDays = [...shootingDays];
      updatedDays[0].scheduleBlocks = createDefaultScheduleBlocks();
      setShootingDays(updatedDays);

      // Sync to database
      if (onSyncAllShootingDays) {
        onSyncAllShootingDays();
        console.log("✅ First day schedule blocks initialized and synced");
      }
    }
  }, [shootingDays.length]);
  */

  const addShootingDay = () => {
    let nextDate;

    if (shootingDays.length === 0) {
      // No days exist - start with today's date
      nextDate = new Date();
    } else {
      // Days exist - add one day after the last day
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

    if (!dayToRemove) {
      alert("Day not found.");
      return;
    }

    const confirmMessage = `Remove Day ${dayToRemove.dayNumber} (${dayToRemove.date})?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const updatedDays = shootingDays.filter((day) => day.id !== dayId);
    const renumberedDays = updatedDays
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((day, index) => ({ ...day, dayNumber: index + 1 }));

    console.log(
      `🗑️ Removing day: ${shootingDays.length} -> ${renumberedDays.length} days`
    );
    setShootingDays(renumberedDays);

    // ATOMIC DELETE - Delete only this day, update only affected day numbers
    database
      .deleteShootingDay(selectedProject, dayId)
      .then(() => {
        // Update day numbers for remaining days
        const dayNumberUpdates = renumberedDays.map((day) => ({
          dayId: day.id,
          dayNumber: day.dayNumber,
        }));
        return database.batchUpdateDayNumbers(
          selectedProject,
          dayNumberUpdates
        );
      })
      .then(() => {
        console.log("✅ Remove day synced successfully (atomic)");
      })
      .catch((error) => {
        console.error("❌ Atomic remove failed:", error);
        alert("⚠️ Failed to remove day. Please try again.");
      });
  };

  const updateShootingDayDate = (dayId, newDate) => {
    setShootingDays((days) => {
      // Check for duplicate dates
      const duplicateDay = days.find(
        (day) => day.id !== dayId && day.date === newDate
      );
      if (duplicateDay) {
        alert(
          `Error: Day ${duplicateDay.dayNumber} is already scheduled for ${newDate}. Please choose a different date.`
        );
        return days; // Return unchanged days
      }

      const updatedDays = days.map((day) =>
        day.id === dayId ? { ...day, date: newDate } : day
      );

      // Sort days chronologically by date
      const sortedDays = [...updatedDays].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      // Renumber the days sequentially
      const renumberedDays = sortedDays.map((day, index) => ({
        ...day,
        dayNumber: index + 1,
      }));

      setShootingDays(renumberedDays);

      // Sync to database
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
          newScheduledScenes[oldDay.date] = newScheduledScenes[
            oldDay.date
          ].filter(
            (scene) =>
              !dayScenes.some(
                (dayScene) => dayScene.sceneNumber === scene.sceneNumber
              )
          );
          if (newScheduledScenes[oldDay.date].length === 0) {
            delete newScheduledScenes[oldDay.date];
          }
        }

        if (dayScenes.length > 0) {
          if (!newScheduledScenes[newDate]) {
            newScheduledScenes[newDate] = [];
          }
          dayScenes.forEach((scene) => {
            const sceneIndex = stripboardScenes.findIndex(
              (s) => s.sceneNumber === scene.sceneNumber
            );
            if (sceneIndex !== -1) {
              const updatedStripboard = [...stripboardScenes];
              updatedStripboard[sceneIndex].scheduledDate = newDate;
              setStripboardScenes(updatedStripboard);
            }

            if (
              !newScheduledScenes[newDate].some(
                (s) => s.sceneNumber === scene.sceneNumber
              )
            ) {
              newScheduledScenes[newDate].push(scene);
            }
          });
        }

        setScheduledScenes(newScheduledScenes);
      } // <-- ADDED THIS CLOSING BRACE

      return updatedDays;
    });
  };

  const getLocationHierarchy = () => {
    const hierarchy = {};

    if (scriptLocations) {
      scriptLocations.forEach((location) => {
        const parent = location.parentLocation;
        const sub = location.subLocation;

        if (!hierarchy[parent]) {
          hierarchy[parent] = [];
        }

        if (!hierarchy[parent].includes(sub)) {
          hierarchy[parent].push(sub);
        }
      });
    }

    return hierarchy;
  };

  const locationHierarchy = getLocationHierarchy();
  const statusOptions = [
    "Not Scheduled",
    "Scheduled",
    "Shot",
    "Pickups",
    "Reshoot",
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Scheduled":
        return "#2196F3";
      case "Shot":
        return "#4CAF50";
      case "Pickups":
        return "#FFC107";
      case "Reshoot":
        return "#F44336";
      default:
        return "#f0f0f0";
    }
  };

  const getStatusTextColor = (status) => {
    return status === "Pickups"
      ? "black"
      : status === "Not Scheduled"
      ? "#666"
      : "white";
  };

  const getSceneBlockColor = (scene, isOddRow) => {
    if (!scene) return "transparent";

    // Get the latest status from stripboardScenes array to ensure we have current data
    const currentScene = stripboardScenes.find(
      (s) => s.sceneNumber === scene.sceneNumber
    );
    const status = currentScene?.status || scene.status || "Not Scheduled";

    // Only apply special colors for Reshoot and Pickups
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "#F44336"; // Red
      case "Pickups":
      case "Scheduled Pickups":
      case "Shot Pickups":
        return "#FFC107"; // Yellow
      default:
        // Use original alternating row colors for all other scenes
        return isOddRow ? "#FFCDD2" : "#BBDEFB";
    }
  };

  const getSceneBlockTextColor = (scene) => {
    if (!scene) return "black";

    const status = scene.status || "Not Scheduled";

    // Only change text color for Reshoot (red background needs white text)
    switch (status) {
      case "Reshoot":
      case "Scheduled Reshoot":
      case "Shot Reshoot":
        return "white"; // White text on red background
      default:
        return "black"; // Black text for all other scenes (including Pickups)
    }
  };

  const handleParentLocationChange = (parentLocation) => {
    setSelectedParentLocation(parentLocation);
    setSelectedSubLocations([]); // Clear sub-locations when parent changes
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
        if (hour === 0) {
          const timeStr = `12:${minute.toString().padStart(2, "0")} AM`;
          options.push(timeStr);
        } else if (hour < 12) {
          const timeStr = `${hour}:${minute.toString().padStart(2, "0")} AM`;
          options.push(timeStr);
        } else if (hour === 12) {
          const timeStr = `12:${minute.toString().padStart(2, "0")} PM`;
          options.push(timeStr);
        } else {
          const timeStr = `${hour - 12}:${minute
            .toString()
            .padStart(2, "0")} PM`;
          options.push(timeStr);
        }
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const getFilteredScenes = () => {
    let filtered = stripboardScenes;

    // Filter by status - hide scheduled Pickups and Reshoots
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((scene) => {
        const status = scene.status || "Not Scheduled";
        const isScheduled = !!scene.scheduledDate;

        // Hide Pickups and Reshoots that are currently scheduled
        if (isScheduled && (status === "Pickups" || status === "Reshoot")) {
          return false;
        }

        return selectedStatuses.includes(status);
      });
    }

    // Filter by location
    if (selectedParentLocation) {
      filtered = filtered.filter((scene) => {
        const sceneLocation = scene.metadata?.location || "";

        // First check if it matches the parent location
        const matchesParent = sceneLocation
          .toUpperCase()
          .includes(selectedParentLocation.toUpperCase());

        if (selectedSubLocations.length > 0) {
          // If sub-locations are selected, scene must match parent AND sub-location
          const matchesSubLocation = selectedSubLocations.some((subLoc) =>
            sceneLocation.toUpperCase().includes(subLoc.toUpperCase())
          );
          return matchesParent && matchesSubLocation;
        } else {
          // If no sub-locations selected, show all scenes from the parent location
          return matchesParent;
        }
      });
    }

    return filtered;
  };

  const availableScenes = getFilteredScenes();

  // Enhanced drag start to handle both available and scheduled scenes
  const handleDragStart = (
    e,
    scene,
    source,
    sourceDayId = null,
    sourceBlockId = null
  ) => {
    setDraggedItem({
      scene,
      source,
      sourceDayId,
      sourceBlockId,
    });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Enhanced drop handler for both available scenes, scheduled scenes, and lunch blocks
  const handleDrop = (e, dayId, blockId) => {
    e.preventDefault();
    if (!draggedItem) return;

    const updatedDays = [...shootingDays];
    const targetDayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (targetDayIndex === -1) {
      setDraggedItem(null);
      return;
    }

    const targetBlocks = updatedDays[targetDayIndex].scheduleBlocks;
    const targetBlockIndex = targetBlocks.findIndex(
      (block) => block.id === blockId
    );

    if (targetBlockIndex === -1) {
      setDraggedItem(null);
      return;
    }

    const targetBlock = targetBlocks[targetBlockIndex];

    // Handle dragging from available scenes
    if (draggedItem.source === "available") {
      // Can only drop available scenes onto scene-type blocks
      if (targetBlock.type !== "scene") {
        setDraggedItem(null);
        return;
      }

      // Handle displacement if target already has a scene
      if (targetBlock.scene) {
        const displacedScene = targetBlock.scene;
        const emptyBlockIndex = targetBlocks.findIndex(
          (block) => block.type === "scene" && block.scene === null
        );

        if (emptyBlockIndex !== -1) {
          targetBlocks[emptyBlockIndex].scene = displacedScene;
        } else {
          if (onUnscheduleScene) {
            onUnscheduleScene(stripboardScenes.indexOf(displacedScene));
          }
        }
      }

      // Get the latest scene data with current status
      const latestScene =
        stripboardScenes.find(
          (s) => s.sceneNumber === draggedItem.scene.sceneNumber
        ) || draggedItem.scene;
      targetBlock.scene = latestScene;
      setShootingDays(updatedDays);

      onScheduleScene(
        stripboardScenes.indexOf(latestScene),
        updatedDays[targetDayIndex].date,
        targetBlock.time
      );

      // ATOMIC: Update only this day's schedule blocks
      syncLocks.current.shootingDays = true;

      database
        .updateShootingDayScheduleBlocks(
          selectedProject,
          dayId,
          updatedDays[targetDayIndex].scheduleBlocks
        )
        .then(() => {
          syncLocks.current.shootingDays = false;
          console.log(
            "✅ Scene scheduled - atomic schedule blocks update complete"
          );
        })
        .catch((error) => {
          console.error("❌ Atomic schedule blocks update failed:", error);
          syncLocks.current.shootingDays = false;
        });
    }
    // Handle dragging from scheduled items (scenes or lunch)
    else if (draggedItem.source === "scheduled") {
      const sourceDayIndex = updatedDays.findIndex(
        (day) => day.id === draggedItem.sourceDayId
      );

      if (sourceDayIndex === -1) {
        setDraggedItem(null);
        return;
      }

      const sourceBlocks = updatedDays[sourceDayIndex].scheduleBlocks;
      const sourceBlockIndex = sourceBlocks.findIndex(
        (block) => block.id === draggedItem.sourceBlockId
      );

      if (sourceBlockIndex === -1) {
        setDraggedItem(null);
        return;
      }

      const sourceBlock = sourceBlocks[sourceBlockIndex];

      // If dropping on the same block, do nothing
      if (
        draggedItem.sourceDayId === dayId &&
        draggedItem.sourceBlockId === blockId
      ) {
        setDraggedItem(null);
        return;
      }

      // Handle lunch block dragging - special case
      if (draggedItem.scene.isLunch) {
        // Lunch can only be dropped onto scene blocks (to reorder position)
        if (targetBlock.type !== "scene") {
          setDraggedItem(null);
          return;
        }

        // For lunch, we swap the entire blocks rather than moving content
        const sourceLunchBlock = { ...sourceBlock };
        const targetSceneBlock = { ...targetBlock };

        // Swap the blocks completely
        sourceBlocks[sourceBlockIndex] = {
          ...targetSceneBlock,
          id: sourceBlock.id, // Keep original IDs
        };

        targetBlocks[targetBlockIndex] = {
          ...sourceLunchBlock,
          id: targetBlock.id, // Keep original IDs
        };

        setShootingDays(updatedDays);
      }
      // Handle custom item dragging - similar to lunch
      else if (draggedItem.scene.isCustom) {
        // Custom items can only be dropped onto scene blocks (to reorder position)
        if (targetBlock.type !== "scene") {
          setDraggedItem(null);
          return;
        }

        // For custom items, we handle like scenes but without stripboard updates
        const customItemToMove = sourceBlock.customItem;
        const displacedScene = targetBlock.scene;
        const displacedCustomItem = targetBlock.customItem;

        // Clear source
        delete sourceBlock.customItem;

        // Place custom item in target
        if (targetBlock.scene) {
          // Target has a scene - need to displace it
          targetBlock.scene = null;
        }
        if (targetBlock.customItem) {
          // Target has custom item - will be displaced
          delete targetBlock.customItem;
        }
        targetBlock.customItem = customItemToMove;

        // Handle displaced content
        if (displacedScene || displacedCustomItem) {
          // Try to find an empty slot first
          let emptyBlockIndex = targetBlocks.findIndex(
            (block) =>
              block.type === "scene" && !block.scene && !block.customItem
          );

          if (emptyBlockIndex !== -1) {
            if (displacedScene) {
              targetBlocks[emptyBlockIndex].scene = displacedScene;
            }
            if (displacedCustomItem) {
              targetBlocks[emptyBlockIndex].customItem = displacedCustomItem;
            }
          } else {
            // Put displaced content back in source slot
            if (displacedScene) {
              sourceBlock.scene = displacedScene;
            }
            if (displacedCustomItem) {
              sourceBlock.customItem = displacedCustomItem;
            }
          }
        }

        setShootingDays(updatedDays);
      }
      // Handle regular scene dragging
      else {
        // Scenes can only be dropped onto scene-type blocks
        if (targetBlock.type !== "scene") {
          setDraggedItem(null);
          return;
        }

        const sceneToMove = sourceBlock.scene;
        const displacedScene = targetBlock.scene;

        // Remove scene from source
        sourceBlock.scene = null;

        // Place scene in target
        targetBlock.scene = sceneToMove;

        // Handle displaced scene
        if (displacedScene) {
          // Try to find an empty slot first
          let emptyBlockIndex = targetBlocks.findIndex(
            (block) => block.type === "scene" && block.scene === null
          );

          if (emptyBlockIndex !== -1) {
            targetBlocks[emptyBlockIndex].scene = displacedScene;
          } else {
            // Try source day blocks if it's a different day
            if (sourceDayIndex !== targetDayIndex) {
              emptyBlockIndex = sourceBlocks.findIndex(
                (block) => block.type === "scene" && block.scene === null
              );
              if (emptyBlockIndex !== -1) {
                sourceBlocks[emptyBlockIndex].scene = displacedScene;
              } else {
                // Put displaced scene back where the moved scene came from
                sourceBlock.scene = displacedScene;
              }
            } else {
              // Same day, put displaced scene in source slot
              sourceBlock.scene = displacedScene;
            }
          }
        }

        // Update the scheduled dates if scenes moved between days
        if (
          sourceDayIndex !== targetDayIndex &&
          sceneToMove &&
          !sceneToMove.isLunch
        ) {
          const sourceDate = updatedDays[sourceDayIndex].date;
          const targetDate = updatedDays[targetDayIndex].date;

          // Update stripboard scenes
          const updatedStripboard = [...stripboardScenes];
          const movedSceneIndex = updatedStripboard.findIndex(
            (s) => s.sceneNumber === sceneToMove.sceneNumber
          );
          if (movedSceneIndex !== -1) {
            updatedStripboard[movedSceneIndex].scheduledDate = targetDate;
            setStripboardScenes(updatedStripboard);
          }

          // Update scheduledScenes object
          const newScheduledScenes = { ...scheduledScenes };

          // Remove from old date
          if (newScheduledScenes[sourceDate]) {
            newScheduledScenes[sourceDate] = newScheduledScenes[
              sourceDate
            ].filter((scene) => scene.sceneNumber !== sceneToMove.sceneNumber);
            if (newScheduledScenes[sourceDate].length === 0) {
              delete newScheduledScenes[sourceDate];
            }
          }

          // Add to new date
          if (!newScheduledScenes[targetDate]) {
            newScheduledScenes[targetDate] = [];
          }
          if (
            !newScheduledScenes[targetDate].some(
              (scene) => scene.sceneNumber === sceneToMove.sceneNumber
            )
          ) {
            newScheduledScenes[targetDate].push(sceneToMove);
          }

          setScheduledScenes(newScheduledScenes);

          // Sync scheduledScenes to database after cross-day move
          if (onSyncScheduledScenes) {
            onSyncScheduledScenes(newScheduledScenes);
          }
        }

        setShootingDays(updatedDays);

        // ATOMIC: Update only affected day(s)
        syncLocks.current.shootingDays = true;

        if (sourceDayIndex !== targetDayIndex) {
          // Cross-day move: update both days atomically
          database
            .updateTwoShootingDaySchedules(
              selectedProject,
              updatedDays[sourceDayIndex].id,
              updatedDays[sourceDayIndex].scheduleBlocks,
              updatedDays[targetDayIndex].id,
              updatedDays[targetDayIndex].scheduleBlocks
            )
            .then(() => {
              syncLocks.current.shootingDays = false;
              console.log(
                "✅ Cross-day scene move - atomic two-day update complete"
              );
            })
            .catch((error) => {
              console.error("❌ Atomic two-day update failed:", error);
              syncLocks.current.shootingDays = false;
            });
        } else {
          // Same-day reorder: update single day atomically
          database
            .updateShootingDayScheduleBlocks(
              selectedProject,
              dayId,
              updatedDays[targetDayIndex].scheduleBlocks
            )
            .then(() => {
              syncLocks.current.shootingDays = false;
              console.log(
                "✅ Same-day scene reorder - atomic schedule blocks update complete"
              );
            })
            .catch((error) => {
              console.error("❌ Atomic schedule blocks update failed:", error);
              syncLocks.current.shootingDays = false;
            });
        }
      }
    }

    setDraggedItem(null);
  };

  const removeScene = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      const blocks = updatedDays[dayIndex].scheduleBlocks;
      const blockIndex = blocks.findIndex((block) => block.id === blockId);

      if (blockIndex !== -1 && blocks[blockIndex].scene) {
        const scene = blocks[blockIndex].scene;
        blocks[blockIndex].scene = null;
        setShootingDays(updatedDays);

        // CRITICAL FIX: Update stripboard scene status back to "Not Scheduled"
        const updatedStripboard = [...stripboardScenes];
        const stripboardIndex = updatedStripboard.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );

        if (stripboardIndex !== -1) {
          const originalStatus = updatedStripboard[stripboardIndex].status;

          // Only change to "Not Scheduled" if currently "Scheduled"
          // Preserve "Pickups" and "Reshoot" statuses
          const newStatus =
            originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;

          updatedStripboard[stripboardIndex] = {
            ...updatedStripboard[stripboardIndex],
            status: newStatus,
            scheduledDate: null,
            scheduledTime: null,
          };
          setStripboardScenes(updatedStripboard);

          // ATOMIC SYNC - Update only this scene with preserved status
          database
            .updateStripboardSceneSchedule(
              selectedProject,
              scene.sceneNumber.toString(),
              newStatus, // Use preserved status
              null, // Clear date
              null // Clear time
            )
            .catch((error) => {
              console.error("❌ Atomic scene update failed:", error);
              alert("⚠️ Failed to update scene schedule. Please try again.");
            });
        }

        // Update main scenes array to match
        const updatedMainScenes = [...scenes];
        const mainSceneIndex = updatedMainScenes.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );

        if (mainSceneIndex !== -1) {
          const originalStatus = updatedMainScenes[mainSceneIndex].status;
          const newStatus =
            originalStatus === "Scheduled" ? "Not Scheduled" : originalStatus;

          updatedMainScenes[mainSceneIndex] = {
            ...updatedMainScenes[mainSceneIndex],
            status: newStatus,
          };
          setScenes(updatedMainScenes);

          // ATOMIC: Update only this scene's status with preserved status
          database
            .updateSceneStatus(
              selectedProject,
              scene.sceneNumber.toString(),
              newStatus
            )
            .catch((error) => {
              console.error("❌ Atomic scene status update failed:", error);
            });
        }

        console.log("✅ Scene removal complete - using atomic updates");

        // ATOMIC: Update only this day's schedule blocks
        syncLocks.current.shootingDays = true;

        database
          .updateShootingDayScheduleBlocks(
            selectedProject,
            dayId,
            updatedDays[dayIndex].scheduleBlocks
          )
          .then(() => {
            syncLocks.current.shootingDays = false;
            console.log(
              "✅ Scene removal - atomic schedule blocks update complete"
            );
          })
          .catch((error) => {
            console.error("❌ Atomic schedule blocks update failed:", error);
            syncLocks.current.shootingDays = false;
          });

        // Clean up scheduledScenes object
        const dayDate = updatedDays[dayIndex].date;
        const newScheduledScenes = { ...scheduledScenes };
        if (newScheduledScenes[dayDate]) {
          newScheduledScenes[dayDate] = newScheduledScenes[dayDate].filter(
            (s) => s.sceneNumber !== scene.sceneNumber
          );
          if (newScheduledScenes[dayDate].length === 0) {
            delete newScheduledScenes[dayDate];
          }
          setScheduledScenes(newScheduledScenes);

          // Sync to database after cleanup
          if (onSyncScheduledScenes) {
            onSyncScheduledScenes(newScheduledScenes);
          }
        }
      }
    }
  };

  const removeBlock = (dayId, blockId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      const blocks = updatedDays[dayIndex].scheduleBlocks;
      const sceneBlocks = blocks.filter((block) => block.type === "scene");

      // Prevent removing if it would go below minimum (2 scene blocks + lunch)
      if (sceneBlocks.length <= 2) {
        alert("Must have at least 2 scene blocks per day");
        return;
      }

      const blockIndex = blocks.findIndex((block) => block.id === blockId);
      if (blockIndex !== -1) {
        const blockToRemove = blocks[blockIndex];

        // If removing a scheduled scene, unschedule it first
        if (blockToRemove.scene && onUnscheduleScene) {
          const sceneIndex = stripboardScenes.findIndex(
            (s) => s.sceneNumber === blockToRemove.scene.sceneNumber
          );
          if (sceneIndex !== -1) {
            onUnscheduleScene(sceneIndex);
          }
        }

        // Remove the block
        blocks.splice(blockIndex, 1);
        setShootingDays(updatedDays);

        // ✅ FIXED: Sync to database after removing block
        if (onSyncAllShootingDays) {
          onSyncAllShootingDays();
        }
      }
    }
  };

  const addBlock = (dayId) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      const blocks = updatedDays[dayIndex].scheduleBlocks;

      // Find the last scene block to get the next time
      const sceneBlocks = blocks.filter((block) => block.type === "scene");
      const lastSceneBlock = sceneBlocks[sceneBlocks.length - 1];

      // Auto-increment time by 15 minutes from last scene block
      let newTime = "8:00 AM";
      if (lastSceneBlock && lastSceneBlock.time) {
        const timeStr = lastSceneBlock.time;
        const [time, period] = timeStr.split(" ");
        const [hours, minutes] = time.split(":").map(Number);

        let newMinutes = minutes + 15;
        let newHours = hours;

        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours += 1;
        }

        // Handle 12-hour format
        let newPeriod = period;
        if (newHours > 12) {
          newHours -= 12;
          newPeriod = period === "AM" ? "PM" : "AM";
        } else if (newHours === 12 && period === "AM") {
          newPeriod = "PM";
        }

        newTime = `${newHours}:${newMinutes
          .toString()
          .padStart(2, "0")} ${newPeriod}`;
      }

      // Create new block
      const newBlock = {
        id: Date.now(),
        scene: null,
        time: newTime,
        type: "scene",
      };

      // Insert before END OF DAY block
      const endOfDayIndex = blocks.findIndex((block) => block.isEndOfDay);
      if (endOfDayIndex !== -1) {
        blocks.splice(endOfDayIndex, 0, newBlock);
      } else {
        blocks.push(newBlock);
      }

      setShootingDays(updatedDays);
    }
  };

  const updateBlockTime = (dayId, blockId, newTime, syncFunction) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      const blocks = updatedDays[dayIndex].scheduleBlocks;
      const blockIndex = blocks.findIndex((block) => block.id === blockId);

      if (blockIndex !== -1) {
        blocks[blockIndex].time = newTime;
        setShootingDays(updatedDays);

        // ATOMIC: Update only this day's schedule blocks
        const changedDay = updatedDays[dayIndex];
        console.log(
          "⏰ Syncing time change for day:",
          changedDay.date,
          "block:",
          blockId,
          "to:",
          newTime
        );

        syncLocks.current.shootingDays = true;

        database
          .updateShootingDayScheduleBlocks(
            selectedProject,
            dayId,
            changedDay.scheduleBlocks
          )
          .then(() => {
            syncLocks.current.shootingDays = false;
            console.log(
              "✅ Time change - atomic schedule blocks update complete"
            );
          })
          .catch((error) => {
            console.error("❌ Atomic time change update failed:", error);
            syncLocks.current.shootingDays = false;
          });
      }
    }
  };

  const updateDayCollapse = (dayId, isCollapsed) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      updatedDays[dayIndex] = { ...updatedDays[dayIndex], isCollapsed };
      setShootingDays(updatedDays);
    }
  };

  // CRITICAL: Deep UUID conversion to fix all bigint IDs
  const ensureAllUUIDs = (obj) => {
    if (!obj) return obj;

    // Helper to check if string is valid UUID
    const isValidUUID = (str) => {
      if (typeof str !== "string") return false;
      return str.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    };

    // Helper to convert any ID to UUID
    const toUUID = (id) => {
      if (isValidUUID(id)) return id;
      return crypto.randomUUID();
    };

    if (Array.isArray(obj)) {
      return obj.map((item) => ensureAllUUIDs(item));
    }

    if (typeof obj === "object" && obj !== null) {
      const newObj = { ...obj };

      // Convert any 'id' field to UUID
      if (newObj.id !== undefined) {
        newObj.id = toUUID(newObj.id);
      }

      // Recursively convert nested objects
      Object.keys(newObj).forEach((key) => {
        if (typeof newObj[key] === "object" && newObj[key] !== null) {
          newObj[key] = ensureAllUUIDs(newObj[key]);
        }
      });

      return newObj;
    }

    return obj;
  };

  const lockDayAndMarkShot = (dayId) => {
    console.log(`🔒 Adding day ${dayId} to lock queue`);

    // Add to queue
    lockQueue.current.push(dayId);

    // Clear existing timeout
    if (lockTimeout.current) {
      clearTimeout(lockTimeout.current);
    }

    // Process queue after 500ms of no new clicks
    lockTimeout.current = setTimeout(() => {
      processBatchLock();
    }, 500);
  };

  const processBatchLock = () => {
    if (lockQueue.current.length === 0) return;

    console.log(`🔒 BATCH LOCK: Processing ${lockQueue.current.length} days`);

    const daysToLock = [...lockQueue.current];
    lockQueue.current = []; // Clear queue

    // Process all days in the batch
    const updatedDays = [...shootingDays];
    const allScenesUpdated = [];
    const allStripboardUpdated = [...stripboardScenes];

    daysToLock.forEach((dayId) => {
      const dayIndex = updatedDays.findIndex((day) => day.id === dayId);
      if (dayIndex === -1) return;

      console.log(`🔒 Locking day ${updatedDays[dayIndex].dayNumber}`);

      // Lock the day
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        isLocked: true,
        isCollapsed: true,
        isShot: true,
      };

      // Get scenes for this day
      const scheduledScenesForDay = updatedDays[dayIndex].scheduleBlocks
        .filter(
          (block) =>
            block.scene && !block.scene.isLunch && !block.scene.isCustom
        )
        .map((block) => block.scene);

      allScenesUpdated.push(...scheduledScenesForDay);
    });

    // Update stripboard scenes (batch)
    allScenesUpdated.forEach((scene) => {
      const sceneIndex = allStripboardUpdated.findIndex(
        (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
      );
      if (sceneIndex !== -1) {
        allStripboardUpdated[sceneIndex] = {
          ...allStripboardUpdated[sceneIndex],
          status: "Shot",
          scheduledDate: null,
          scheduledTime: null,
        };
      }
    });

    // Update main scenes (batch)
    const updatedMainScenes = [...scenes];
    allScenesUpdated.forEach((scene) => {
      const mainSceneIndex = updatedMainScenes.findIndex(
        (s) => s.sceneNumber === scene.sceneNumber
      );
      if (mainSceneIndex !== -1) {
        updatedMainScenes[mainSceneIndex] = {
          ...updatedMainScenes[mainSceneIndex],
          status: "Shot",
        };
      }
    });

    // Apply all state updates
    setShootingDays(updatedDays);
    setStripboardScenes(allStripboardUpdated);
    setScenes(updatedMainScenes);

    // ATOMIC BATCH SYNC - Update only changed days, not all 43 days
    console.log(
      `📤 ATOMIC BATCH SYNC: Updating ${daysToLock.length} days atomically`
    );

    // Build atomic update requests
    const dayUpdates = daysToLock.map((dayId) => ({
      dayId: dayId,
      isLocked: true,
      isShot: true,
      isCollapsed: true,
    }));

    // Execute atomic batch update
    database
      .batchUpdateShootingDayStatuses(selectedProject, dayUpdates)
      .catch((error) => {
        console.error("❌ Atomic batch update failed:", error);
        alert("⚠️ Failed to save day lock status. Please try again.");
        if (loadShootingDaysFromDatabase) {
          loadShootingDaysFromDatabase();
        }
      });

    // Background sync for scenes (single operation)
    setTimeout(() => {
      // ATOMIC BATCH SYNC - Update only changed main scenes, not all 165
      const mainSceneUpdates = allScenesUpdated.map((scene) =>
        database.updateSceneStatus(
          selectedProject,
          scene.sceneNumber.toString(),
          "Shot"
        )
      );

      Promise.all(mainSceneUpdates).catch((error) => {
        console.error("❌ Atomic main scenes batch update failed:", error);
      });

      // ATOMIC BATCH SYNC - Update only changed scenes, not all 165
      const sceneUpdates = allScenesUpdated.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Shot",
        scheduled_date: null,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .then(() => {
          console.log(
            `✅ BATCH COMPLETE: ${daysToLock.length} days processed, ${sceneUpdates.length} scenes updated atomically`
          );
        })
        .catch((error) => {
          console.error("❌ Atomic stripboard batch update failed:", error);
          alert("⚠️ Failed to save scene statuses. Please try again.");
        });
    }, 100);

    // Show confirmation
    alert(
      `Batch locked ${daysToLock.length} days! ${allScenesUpdated.length} scenes marked as Shot.`
    );
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
      // Get all scenes scheduled for this day from schedule blocks
      const dayScenes = day.scheduleBlocks
        .filter(
          (block) =>
            block.scene && !block.scene.isLunch && !block.scene.isCustom
        )
        .map((block) => block.scene);

      // Update stripboard scenes back to "Scheduled" status
      const updatedStripboard = [...stripboardScenes];
      dayScenes.forEach((scene) => {
        const sceneIndex = updatedStripboard.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );
        if (sceneIndex !== -1) {
          updatedStripboard[sceneIndex] = {
            ...updatedStripboard[sceneIndex],
            status: "Scheduled",
            scheduledDate: day.date,
          };
        }
      });
      setStripboardScenes(updatedStripboard);

      // ATOMIC BATCH SYNC - Update only scenes on this day, not all 165
      const sceneUpdates = dayScenes.map((scene) => ({
        scene_number: scene.sceneNumber.toString(),
        status: "Scheduled",
        scheduled_date: day.date,
        scheduled_time: null,
      }));

      database
        .batchUpdateStripboardSceneStatuses(selectedProject, sceneUpdates)
        .catch((error) => {
          console.error("❌ Atomic stripboard update failed:", error);
          alert("⚠️ Failed to update scene statuses. Please try again.");
        });

      // CRITICAL: Also update main scenes array to match stripboard changes
      const updatedMainScenes = [...scenes];
      dayScenes.forEach((scene) => {
        const mainSceneIndex = updatedMainScenes.findIndex(
          (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
        );
        if (mainSceneIndex !== -1) {
          updatedMainScenes[mainSceneIndex] = {
            ...updatedMainScenes[mainSceneIndex],
            status: "Scheduled",
          };
        }
      });

      setScenes(updatedMainScenes);

      // ATOMIC BATCH SYNC - Update only changed main scenes, not all 165
      const mainSceneUpdates = dayScenes.map((scene) =>
        database.updateSceneStatus(
          selectedProject,
          scene.sceneNumber.toString(),
          "Scheduled"
        )
      );

      Promise.all(mainSceneUpdates).catch((error) => {
        console.error("❌ Atomic main scenes unlock failed:", error);
      });

      // Unlock the day in local state
      updatedDays[dayIndex] = { ...day, isLocked: false, isShot: false };
      setShootingDays(updatedDays);

      // ATOMIC UNLOCK - Update only this day
      Promise.all([
        database.updateShootingDayLockStatus(selectedProject, dayId, false),
        database.updateShootingDayShotStatus(selectedProject, dayId, false),
      ]).catch((error) => {
        console.error("❌ Atomic unlock failed:", error);
        alert("⚠️ Failed to save unlock status. Please try again.");
        if (loadShootingDaysFromDatabase) {
          loadShootingDaysFromDatabase();
        }
      });

      alert(
        `Day ${day.dayNumber} unlocked! Scenes restored to Scheduled status.`
      );
    }
  };

  const resetSceneToUnscheduled = (sceneNumber) => {
    const confirmReset = window.confirm(
      `Reset Scene ${sceneNumber} to completely unscheduled state?\n\nThis will:\n- Set status to "Not Scheduled"\n- Clear scheduled date and time\n- Remove from all shooting days\n- Make scene available for scheduling again`
    );

    if (!confirmReset) return;

    // Update stripboard scenes
    const updatedStripboard = [...stripboardScenes];
    const stripboardIndex = updatedStripboard.findIndex(
      (s) => s.sceneNumber.toString() === sceneNumber.toString()
    );

    if (stripboardIndex !== -1) {
      updatedStripboard[stripboardIndex] = {
        ...updatedStripboard[stripboardIndex],
        status: "Not Scheduled",
        scheduledDate: null,
        scheduledTime: null,
      };
      setStripboardScenes(updatedStripboard);

      // ATOMIC SYNC - Update only this scene, not all 165
      database
        .clearStripboardSceneSchedule(selectedProject, sceneNumber.toString())
        .catch((error) => {
          console.error("❌ Atomic scene reset failed:", error);
          alert("⚠️ Failed to reset scene. Please try again.");
        });
    }

    // Update main scenes array
    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex(
      (s) => s.sceneNumber.toString() === sceneNumber.toString()
    );

    if (mainSceneIndex !== -1) {
      updatedMainScenes[mainSceneIndex] = {
        ...updatedMainScenes[mainSceneIndex],
        status: "Not Scheduled",
      };
      setScenes(updatedMainScenes);

      if (saveScenesDatabase) {
        saveScenesDatabase(updatedMainScenes);
      }
    }

    // Remove from all shooting days
    const updatedDays = shootingDays.map((day) => ({
      ...day,
      scheduleBlocks: day.scheduleBlocks.map((block) => {
        if (
          block.scene &&
          block.scene.sceneNumber.toString() === sceneNumber.toString()
        ) {
          return { ...block, scene: null };
        }
        return block;
      }),
    }));

    setShootingDays(updatedDays);

    // Sync all shooting days to database
    if (onSyncAllShootingDays) {
      onSyncAllShootingDays();
    }

    // Clean up scheduledScenes object
    const newScheduledScenes = { ...scheduledScenes };
    Object.keys(newScheduledScenes).forEach((date) => {
      newScheduledScenes[date] = newScheduledScenes[date].filter(
        (s) => s.sceneNumber.toString() !== sceneNumber.toString()
      );
      if (newScheduledScenes[date].length === 0) {
        delete newScheduledScenes[date];
      }
    });

    setScheduledScenes(newScheduledScenes);

    if (onSyncScheduledScenes) {
      onSyncScheduledScenes(newScheduledScenes);
    }

    alert(`Scene ${sceneNumber} reset to unscheduled state.`);
  };

  const updateCustomItem = (dayId, blockId, customText) => {
    const updatedDays = [...shootingDays];
    const dayIndex = updatedDays.findIndex((day) => day.id === dayId);

    if (dayIndex !== -1) {
      const blocks = updatedDays[dayIndex].scheduleBlocks;
      const blockIndex = blocks.findIndex((block) => block.id === blockId);

      if (blockIndex !== -1) {
        if (customText) {
          // Add custom item
          blocks[blockIndex].customItem = customText;
        } else {
          // Remove custom item (when clicking red X)
          delete blocks[blockIndex].customItem;
        }
        setShootingDays(updatedDays);
      }
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100vw",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "15px",
          width: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Available Scenes Panel - Now Fixed Position */}
        <div
          style={{
            width: "300px",
            border: "1px solid #ccc",
            position: "sticky",
            top: "20px",
            alignSelf: "flex-start",
            maxHeight: "calc(100vh - 40px)",
            overflow: "hidden",
            flexShrink: 0,
            zIndex: 100,
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "10px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              Available Scenes ({availableScenes.length})
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {/* Status Filter */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Status ({selectedStatuses.length})
                </button>

                {showStatusDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      zIndex: 1000,
                      minWidth: "150px",
                      color: "black",
                    }}
                  >
                    {statusOptions.map((status) => (
                      <label
                        key={status}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "4px 8px",
                          fontSize: "10px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStatuses([
                                ...selectedStatuses,
                                status,
                              ]);
                            } else {
                              setSelectedStatuses(
                                selectedStatuses.filter((s) => s !== status)
                              );
                            }
                          }}
                          style={{ marginRight: "4px" }}
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Location Filter */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Location{" "}
                  {selectedParentLocation ? `(${selectedParentLocation})` : ""}
                </button>

                {showLocationDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                      zIndex: 1000,
                      width: "280px",
                      color: "black",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      style={{
                        padding: "4px 8px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <button
                        onClick={() => {
                          setSelectedParentLocation("");
                          setSelectedSubLocations([]);
                        }}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          fontSize: "10px",
                          cursor: "pointer",
                          color: selectedParentLocation ? "black" : "blue",
                        }}
                      >
                        All Locations
                      </button>
                    </div>

                    {Object.keys(locationHierarchy).map((parent) => (
                      <div key={parent}>
                        <div
                          style={{
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            backgroundColor:
                              selectedParentLocation === parent
                                ? "#e3f2fd"
                                : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            if (selectedParentLocation === parent) {
                              // Clicking the same parent collapses it
                              setSelectedParentLocation("");
                              setSelectedSubLocations([]);
                            } else {
                              // Clicking a different parent expands it
                              handleParentLocationChange(parent);
                            }
                          }}
                        >
                          📍 {parent}
                        </div>

                        {selectedParentLocation === parent && (
                          <div
                            style={{
                              paddingLeft: "16px",
                              backgroundColor: "#f9f9f9",
                            }}
                          >
                            <div style={{ padding: "2px 4px" }}>
                              <button
                                onClick={handleSelectAllSubLocations}
                                style={{
                                  backgroundColor: "transparent",
                                  border: "1px solid #ccc",
                                  fontSize: "9px",
                                  cursor: "pointer",
                                  padding: "2px 4px",
                                  marginBottom: "4px",
                                }}
                              >
                                Select All
                              </button>
                            </div>

                            {locationHierarchy[parent].map((sub) => (
                              <label
                                key={sub}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "2px 4px",
                                  fontSize: "9px",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSubLocations.includes(sub)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSubLocations([
                                        ...selectedSubLocations,
                                        sub,
                                      ]);
                                    } else {
                                      setSelectedSubLocations(
                                        selectedSubLocations.filter(
                                          (s) => s !== sub
                                        )
                                      );
                                    }
                                  }}
                                  style={{ marginRight: "4px" }}
                                />
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

              {/* Clear Filters */}
              <button
                onClick={() => {
                  setSelectedStatuses(["Not Scheduled"]);
                  setSelectedParentLocation("");
                  setSelectedSubLocations([]);
                }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
          {/* Click outside to close location dropdown */}
          {showLocationDropdown && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 999,
              }}
              onClick={() => setShowLocationDropdown(false)}
            />
          )}

          {/* Click outside to close status dropdown */}
          {showStatusDropdown && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 999,
              }}
              onClick={() => setShowStatusDropdown(false)}
            />
          )}
          <div
            style={{
              height: "calc(100vh - 120px)",
              overflowY: "auto",
              padding: "10px",
            }}
          >
            {availableScenes.map((scene, index) => {
              const isScheduled = !!scene.scheduledDate;
              return (
                <div
                  key={scene.sceneNumber}
                  style={{
                    padding: "8px",
                    margin: "4px 0",
                    backgroundColor: isScheduled
                      ? "#e0e0e0"
                      : getStatusColor(scene.status || "Not Scheduled"),
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "12px",
                    opacity: isScheduled ? 0.6 : 1,
                    position: "relative",
                  }}
                >
                  <div
                    draggable={!isScheduled}
                    onDragStart={(e) =>
                      !isScheduled && handleDragStart(e, scene, "available")
                    }
                    onDoubleClick={() => handleSceneDoubleClick(scene)}
                    title="Double-click to view script"
                    style={{
                      cursor: isScheduled ? "not-allowed" : "grab",
                      color: isScheduled
                        ? "#666"
                        : getStatusTextColor(scene.status || "Not Scheduled"),
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>
                        Scene {scene.sceneNumber}:{" "}
                        {scene.metadata?.intExt || ""} -{" "}
                        {scene.metadata?.location || ""}
                      </span>
                      {isScheduled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resetSceneToUnscheduled(scene.sceneNumber);
                          }}
                          title="Reset scene to unscheduled"
                          style={{
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "2px",
                            cursor: "pointer",
                            fontSize: "10px",
                            padding: "2px 6px",
                            marginLeft: "4px",
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div style={{ color: isScheduled ? "#888" : "#666" }}>
                      {scene.metadata?.timeOfDay} | {scene.estimatedDuration}
                      {isScheduled && (
                        <span style={{ fontSize: "10px", marginLeft: "8px" }}>
                          (Scheduled)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Blocks Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
            width: "calc(100% - 315px)",
            maxHeight: "calc(100vh - 40px)",
          }}
        >
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
            />
          ))}

          {/* Add Shooting Day Button */}
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "20px",
              textAlign: "center",
              borderTop: "2px solid #ddd",
              marginTop: "20px",
            }}
          >
            <button
              onClick={addShootingDay}
              style={{
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "12px 24px",
                fontSize: "14px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              + Add Shooting Day {shootingDays.length + 1}
            </button>
          </div>
        </div>

        {/* Script Popup Modal with exact Script module styling */}
        {showScriptPopup && selectedSceneForScript && (
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
              onClick={closeScriptPopup}
            >
              <div
                style={{
                  backgroundColor: "white",
                  width: "90%",
                  maxWidth: "9.28in", // Match Script module width
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
                    Scene {selectedSceneForScript.sceneNumber} -{" "}
                    {selectedSceneForScript.heading}
                  </h3>
                  <button
                    onClick={closeScriptPopup}
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
                    padding: "1.5in", // Match Script module padding
                    overflow: "auto",
                    backgroundColor: getSceneStatusColor(
                      selectedSceneForScript.sceneNumber
                    ),
                    boxSizing: "border-box",
                    textAlign: "left",
                    fontFamily: "Courier New, monospace",
                  }}
                >
                  {/* Scene Heading */}
                  <div
                    style={getElementStyle("Scene Heading")}
                    data-scene-index={
                      scenes
                        ? scenes.findIndex(
                            (s) =>
                              s.sceneNumber ===
                              selectedSceneForScript.sceneNumber
                          )
                        : 0
                    }
                  >
                    {selectedSceneForScript.heading}
                  </div>

                  {/* Scene Content with exact element styling */}
                  {selectedSceneForScript.content &&
                    selectedSceneForScript.content.map((block, blockIndex) => (
                      <div key={blockIndex} style={getElementStyle(block.type)}>
                        {formatElementText(block)}
                      </div>
                    ))}

                  {/* Fallback if content structure is different */}
                  {!selectedSceneForScript.content && (
                    <div style={getElementStyle("Action")}>
                      {selectedSceneForScript.text ||
                        "Scene content not available"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Individual Day Block Component - Complete Version with Custom Items
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
        day.scheduleBlocks.map((block, index) => {
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
                {/* No remove button for lunch - it's permanent */}
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
              {/* Removed arrow buttons section completely */}
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
                    onClick={() => {
                      console.log(
                        "🔍 REMOVING SCENE from day:",
                        day.id,
                        "block:",
                        block.id
                      );

                      if (scene && scene.sceneNumber) {
                        console.log("🔍 Scene to remove:", scene.sceneNumber);
                        removeScene(day.id, block.id);
                      } else {
                        console.warn("⚠️ No scene found to remove");
                      }
                    }}
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
                    onClick={() => {
                      console.log(
                        "🔍 REMOVING EMPTY BLOCK from day:",
                        day.id,
                        "block:",
                        block.id
                      );
                      removeBlock(day.id, block.id);
                    }}
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
    // Load from localStorage
    const saved = localStorage.getItem("calendarExpandedSections");
    return saved ? JSON.parse(saved) : {};
  });

  // Save to localStorage whenever expandedSections changes
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
    return (
      shootingDays &&
      shootingDays.some((shootingDay) => shootingDay.date === dateStr)
    );
  };

  const getDayItems = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;

    // Find shooting day for this date
    const shootingDay = shootingDays?.find(
      (shootingDay) => shootingDay.date === dateStr
    );

    // Get scenes using CallSheet's two-tier approach
    let scenes = [];

    if (
      shootingDay &&
      shootingDay.scheduleBlocks &&
      shootingDay.scheduleBlocks.length > 0
    ) {
      // Priority: Use scheduleBlocks from shooting day (like CallSheet)
      scenes = shootingDay.scheduleBlocks
        .filter((block) => block.scene && !block.isLunch && !block.customItem)
        .map((block) => block.scene);
    } else {
      // Fallback: Use scheduledScenes object only if no scheduleBlocks
      const scheduledScenesForDay = scheduledScenes[dateStr] || [];
      scenes = scheduledScenesForDay;
    }

    // Filter out completed todo items - only show active tasks
    const assignedTodos = todoItems
      ? todoItems.filter(
          (item) => item.assignedDate === dateStr && !item.completed
        )
      : [];
    const dueTodos = todoItems
      ? todoItems.filter((item) => item.dueDate === dateStr && !item.completed)
      : [];

    // Add unavailable cast/crew for this date
    const unavailablePeople = castCrew
      ? castCrew.filter(
          (person) =>
            person.availability?.unavailableDates &&
            person.availability?.unavailableDates.includes(dateStr)
        )
      : [];

    // Add available cast/crew for this date
    const availablePeople = castCrew
      ? castCrew.filter(
          (person) =>
            person.availability?.availableDates &&
            person.availability?.availableDates.includes(dateStr)
        )
      : [];

    // Add booked cast/crew for this date - NEW
    const bookedPeople = castCrew
      ? castCrew.filter(
          (person) =>
            person.availability?.bookedDates &&
            person.availability?.bookedDates.includes(dateStr)
        )
      : [];

    // Add manual events for this date (exclude 'work' events - those are in DOOD matrix)
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

  const isToday = (day) => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

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
          ></div>
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
                const dayItems = getDayItems(day);
                const { assignedTodos, dueTodos, manualEvents } = dayItems;

                // Separate scheduled vs shot scenes
                const scheduledScenesForDay = [];
                const shotScenesForDay = [];

                scenes.forEach((scene) => {
                  const sceneNumber =
                    typeof scene === "object" ? scene.sceneNumber : scene;
                  const stripboardScene = stripboardScenes?.find(
                    (s) => s.sceneNumber === sceneNumber
                  );
                  const status = stripboardScene?.status || "Not Scheduled";

                  if (status === "Shot") {
                    shotScenesForDay.push(sceneNumber);
                  } else if (status === "Scheduled") {
                    scheduledScenesForDay.push(sceneNumber);
                  }
                });

                const allTasks = [...assignedTodos, ...dueTodos];
                const tasksCount = allTasks.length;
                const bookedCount = bookedPeople.length;
                const availableCount = availablePeople.length;
                const unavailableCount = unavailablePeople.length;
                const manualEventsCount = manualEvents?.length || 0;

                return (
                  <>
                    {/* Tasks Accordion */}
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

                    {/* Manual Events - Grouped by Event Type */}
                    {manualEventsCount > 0 &&
                      (() => {
                        // Group events by type
                        const eventsByType = {};
                        manualEvents.forEach((event) => {
                          if (!eventsByType[event.eventType]) {
                            eventsByType[event.eventType] = [];
                          }
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
                                      // Find cast member name
                                      const castMember = castCrew?.find(
                                        (person) =>
                                          person.id === event.castMemberId
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

                    {/* Booked Accordion */}
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

                    {/* Available Accordion */}
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

                    {/* Unavailable Accordion */}
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

                    {/* Show scenes (not in accordion - always visible) */}
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
                          .map((scene) => scene.sceneNumber || scene)
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
                          .map((scene) => scene.sceneNumber || scene)
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

// Locations Module - Enhanced Hierarchical Structure
function LocationsModule({
  scenes,
  scriptLocations,
  setScriptLocations,
  actualLocations,
  setActualLocations,
  setActiveModule,
  setCurrentIndex,
  onSyncScriptLocations,
  onSyncActualLocations,
}) {
  console.log(
    "📍 LocationsModule RENDERED - scriptLocations count:",
    scriptLocations.length
  );

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAddActualLocation, setShowAddActualLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [editingParentName, setEditingParentName] = useState(null);
  const [editParentValue, setEditParentValue] = useState("");
  const [editingSubLocation, setEditingSubLocation] = React.useState(null);
  const [editSubLocationValue, setEditSubLocationValue] = React.useState("");
  const [showReassignSubDialog, setShowReassignSubDialog] =
    React.useState(null);
  const [reassignSubTarget, setReassignSubTarget] = React.useState("");
  const [showReassignDialog, setShowReassignDialog] = useState(null);
  const [reassignTarget, setReassignTarget] = useState("");
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

  // Auto-extract and group locations on first load
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

        // Enhanced pattern matching
        // Pattern 1: Possessive (SADIE'S BEDROOM, JOHN'S CAR)
        if (fullLocation.includes("'S ")) {
          const parts = fullLocation.split("'S ");
          parentLocation = parts[0] + "'S";
          subLocation = parts[1].trim();
        }
        // Pattern 2: Building types (SMITH HOUSE KITCHEN, OFFICE BUILDING LOBBY)
        else if (
          /\b(HOUSE|APARTMENT|BUILDING|OFFICE|SCHOOL|HOSPITAL|STORE|SHOP|RESTAURANT|BAR|CLUB)\b/.test(
            fullLocation
          )
        ) {
          const words = fullLocation.split(" ");
          const buildingIndex = words.findIndex((word) =>
            [
              "HOUSE",
              "APARTMENT",
              "BUILDING",
              "OFFICE",
              "SCHOOL",
              "HOSPITAL",
              "STORE",
              "SHOP",
              "RESTAURANT",
              "BAR",
              "CLUB",
            ].includes(word)
          );
          if (buildingIndex !== -1 && buildingIndex < words.length - 1) {
            parentLocation = words.slice(0, buildingIndex + 1).join(" ");
            subLocation = words.slice(buildingIndex + 1).join(" ");
          }
        }
        // Pattern 3: Vehicle types (POLICE CAR, JOHN'S TRUCK)
        else if (
          /\b(CAR|TRUCK|VAN|SUV|MOTORCYCLE|BIKE|VEHICLE)\b/.test(fullLocation)
        ) {
          const words = fullLocation.split(" ");
          const vehicleIndex = words.findIndex((word) =>
            [
              "CAR",
              "TRUCK",
              "VAN",
              "SUV",
              "MOTORCYCLE",
              "BIKE",
              "VEHICLE",
            ].includes(word)
          );
          if (vehicleIndex > 0) {
            parentLocation = words.slice(0, vehicleIndex + 1).join(" ");
            subLocation =
              vehicleIndex === words.length - 1
                ? fullLocation
                : words.slice(vehicleIndex + 1).join(" ");
          }
        }
        // Pattern 4: Room patterns (BEDROOM, KITCHEN in longer names)
        else {
          const rooms = [
            "BEDROOM",
            "BATHROOM",
            "KITCHEN",
            "LIVING ROOM",
            "DINING ROOM",
            "OFFICE",
            "GARAGE",
            "BASEMENT",
            "ATTIC",
            "HALLWAY",
            "LOBBY",
            "ENTRANCE",
          ];
          const foundRoom = rooms.find((room) => fullLocation.includes(room));
          if (foundRoom && fullLocation !== foundRoom) {
            parentLocation = fullLocation
              .replace(foundRoom, "")
              .trim()
              .replace(/\s+/g, " ");
            subLocation = foundRoom;
            // Handle cases like "MAIN BEDROOM" -> parent should include MAIN
            if (parentLocation === "") {
              const words = fullLocation.split(" ");
              const roomIndex = words.findIndex((word) =>
                room.split(" ").includes(word)
              );
              if (roomIndex > 0) {
                parentLocation = words.slice(0, roomIndex).join(" ");
                subLocation = words.slice(roomIndex).join(" ");
              }
            }
          }
        }

        // Pattern 5: Street/Address patterns (123 MAIN STREET, CENTRAL PARK)
        if (
          !parentLocation &&
          /\b(STREET|AVENUE|ROAD|PARK|PLAZA|SQUARE)\b/.test(fullLocation)
        ) {
          parentLocation = fullLocation;
          subLocation = "EXTERIOR";
        }

        // If no pattern found, treat as standalone location
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
            parentLocation: parentLocation,
            subLocation: subLocation,
            fullName: fullLocation,
            intExt: intExt,
            scenes: [scene.sceneNumber],
            actualLocationId: null,
            category: intExt === "INT." ? "Interior" : "Exterior",
          });
        }
      }
    });

    const extractedLocations = Array.from(locationMap.values());
    setScriptLocations(extractedLocations);

    // Sync to database after extraction (matches character detection pattern)
    if (onSyncScriptLocations) {
      console.log(
        "🔵 SYNC CALLED from autoExtractAndGroupLocations with",
        extractedLocations.length,
        "locations"
      );
      console.trace();
      onSyncScriptLocations(extractedLocations);
    }
  };

  // Toggle scene assignment for location
  const toggleSceneAssignment = (locationId, sceneNumber) => {
    console.log(
      "🔄 TOGGLE SCENE - Location:",
      locationId,
      "Scene:",
      sceneNumber
    );

    setScriptLocations((prev) => {
      const updated = prev.map((location) => {
        if (location.id === locationId) {
          const sceneNumStr = String(sceneNumber);
          const sceneIndex = location.scenes.findIndex(
            (s) => String(s) === sceneNumStr
          );

          if (sceneIndex > -1) {
            // Remove scene - create new array without mutation
            const newScenes = location.scenes.filter(
              (s, i) => i !== sceneIndex
            );
            console.log("➖ Removing scene", sceneNumber, "from location");
            return { ...location, scenes: newScenes };
          } else {
            // Add scene - create new sorted array without mutation
            const newScenes = [...location.scenes, sceneNumber].sort((a, b) => {
              const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
              const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
              return aNum - bNum;
            });
            console.log("➕ Adding scene", sceneNumber, "to location");
            return { ...location, scenes: newScenes };
          }
        }
        return location;
      });

      if (onSyncScriptLocations) {
        console.log("💾 Syncing locations to database...");
        onSyncScriptLocations(updated);
      }

      return updated;
    });
  };

  // Get all available scene numbers for manual assignment
  const allSceneNumbers = scenes
    .map((scene) => scene.sceneNumber)
    .sort((a, b) => {
      const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
      const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
      return aNum - bNum;
    });

  // Group locations by parent
  const groupedLocations = scriptLocations.reduce((groups, location) => {
    const parent = location.parentLocation;
    if (!groups[parent]) {
      groups[parent] = [];
    }
    groups[parent].push(location);
    return groups;
  }, {});

  const toggleGroup = (parentLocation) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [parentLocation]: !prev[parentLocation],
    }));
  };

  const assignActualLocation = (scriptLocationId, actualLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => {
        if (loc.id === scriptLocationId) {
          return { ...loc, actualLocationId: actualLocationId || null };
        }
        return loc;
      });
      if (onSyncScriptLocations) {
        console.log(
          "🔵 SYNC CALLED from assignActualLocation with",
          updated.length,
          "locations"
        );
        console.trace();
        onSyncScriptLocations(updated);
      }
      return updated;
    });
  };

  const assignActualToGroup = (parentLocation, actualLocationId) => {
    setScriptLocations((prev) => {
      const updated = prev.map((loc) => {
        if (loc.parentLocation === parentLocation) {
          return { ...loc, actualLocationId: actualLocationId || null };
        }
        return loc;
      });
      if (onSyncScriptLocations) {
        console.log(
          "🔵 SYNC CALLED from assignActualToGroup with",
          updated.length,
          "locations"
        );
        console.trace();
        onSyncScriptLocations(updated);
      }
      return updated;
    });
  };

  const startEditingParentName = (parentLocation) => {
    setEditingParentName(parentLocation);
    setEditParentValue(parentLocation);
  };

  const saveParentNameEdit = () => {
    if (editParentValue.trim() && editingParentName) {
      setScriptLocations((prev) => {
        const updated = prev.map((loc) => {
          if (loc.parentLocation === editingParentName) {
            return { ...loc, parentLocation: editParentValue.trim() };
          }
          return loc;
        });
        if (onSyncScriptLocations) {
          console.log(
            "🔵 SYNC CALLED from saveParentNameEdit with",
            updated.length,
            "locations"
          );
          console.trace();
          onSyncScriptLocations(updated);
        }
        return updated;
      });
    }
    setEditingParentName(null);
    setEditParentValue("");
  };

  const cancelParentNameEdit = () => {
    setEditingParentName(null);
    setEditParentValue("");
  };

  const startEditingSubLocation = (locationId, currentSubLocation) => {
    setEditingSubLocation(locationId);
    setEditSubLocationValue(currentSubLocation);
  };

  const saveSubLocationEdit = () => {
    if (editSubLocationValue.trim() && editingSubLocation) {
      setScriptLocations((prev) => {
        const updated = prev.map((loc) => {
          if (loc.id === editingSubLocation) {
            return { ...loc, subLocation: editSubLocationValue.trim() };
          }
          return loc;
        });
        if (onSyncScriptLocations) {
          console.log(
            "🔵 SYNC CALLED from saveSubLocationEdit with",
            updated.length,
            "locations"
          );
          console.trace();
          onSyncScriptLocations(updated);
        }
        return updated;
      });
    }
    setEditingSubLocation(null);
    setEditSubLocationValue("");
  };

  const cancelSubLocationEdit = () => {
    setEditingSubLocation(null);
    setEditSubLocationValue("");
  };

  const startReassignSubLocation = (locationId, subLocationName) => {
    const location = scriptLocations.find((loc) => loc.id === locationId);
    setShowReassignSubDialog({
      locationId,
      subLocationName,
      parentLocation: location.parentLocation,
    });
    setReassignSubTarget("");
  };

  const confirmReassignSubLocation = () => {
    if (reassignSubTarget && showReassignSubDialog) {
      const { locationId, subLocationName } = showReassignSubDialog;

      // Find the location to reassign
      const locationToReassign = scriptLocations.find(
        (loc) => loc.id === locationId
      );

      setScriptLocations((prev) => {
        let updated = [...prev]; // Create a copy of the array

        if (reassignSubTarget.startsWith("merge:")) {
          // Merge with another sub-location
          const targetLocationId = reassignSubTarget.replace("merge:", "");
          const targetLocation = prev.find(
            (loc) => loc.id === targetLocationId
          );

          if (targetLocation) {
            // Combine scenes from both locations
            const mergedScenes = [
              ...new Set([
                ...targetLocation.scenes,
                ...locationToReassign.scenes,
              ]),
            ];

            // Update target location with merged scenes
            console.log("🔍 MERGE - Target location BEFORE:", targetLocation);
            console.log("🔍 MERGE - Source location:", locationToReassign);
            console.log("🔍 MERGE - Merged scenes:", mergedScenes);

            const updatedLocations = prev.map((loc) => {
              if (loc.id === targetLocationId) {
                return { ...loc, scenes: mergedScenes }; // Creates new object with merged scenes
              }
              return loc;
            });

            // Remove the original location
            updated = updatedLocations.filter((loc) => loc.id !== locationId);

            console.log("🔍 MERGE - Updated array length:", updated.length);
            console.log("🔍 MERGE - Original array length:", prev.length);
            console.log(
              "🔍 MERGE - Target location AFTER:",
              updated.find((loc) => loc.id === targetLocationId)
            );
            console.log(
              "🔍 MERGE - Target scenes AFTER merge:",
              updated.find((loc) => loc.id === targetLocationId)?.scenes
            );
            console.log("🔍 MERGE - Expected merged scenes:", mergedScenes);
            console.log("🔍 CURRENT MERGE TARGET ID:", targetLocationId);
          }
        } else if (reassignSubTarget.startsWith("parent:")) {
          // Move to different parent
          const newParent = reassignSubTarget.replace("parent:", "");
          updated = prev.map((loc) => {
            if (loc.id === locationId) {
              return {
                ...loc,
                parentLocation: newParent,
              };
            }
            return loc;
          });
        } else if (reassignSubTarget.trim()) {
          // Create new parent
          updated = prev.map((loc) => {
            if (loc.id === locationId) {
              return {
                ...loc,
                parentLocation: reassignSubTarget.trim(),
              };
            }
            return loc;
          });
        }

        // Sync after reassignment
        if (onSyncScriptLocations) {
          console.log(
            "🔵 SYNC CALLED from confirmReassignSubLocation with",
            updated.length,
            "locations"
          );
          console.trace();
          onSyncScriptLocations(updated);
        }

        return updated;
      });
    }
    setShowReassignSubDialog(null);
    setReassignSubTarget("");
  };

  const cancelReassignSubLocation = () => {
    setShowReassignSubDialog(null);
    setReassignSubTarget("");
  };

  const startReassignParent = (parentLocation) => {
    setShowReassignDialog(parentLocation);
    setReassignTarget("");
  };

  const confirmReassignParent = () => {
    if (reassignTarget && showReassignDialog) {
      setScriptLocations((prev) => {
        const locationsToReassign = prev.filter(
          (loc) => loc.parentLocation === showReassignDialog
        );
        const otherLocations = prev.filter(
          (loc) => loc.parentLocation !== showReassignDialog
        );

        const reassignedLocations = locationsToReassign.map((loc) => ({
          ...loc,
          parentLocation: reassignTarget,
        }));

        const updated = [...otherLocations, ...reassignedLocations];

        // Close dialog BEFORE syncing to prevent race conditions
        setShowReassignDialog(null);
        setReassignTarget("");

        if (onSyncScriptLocations) {
          console.log(
            "🔵 SYNC CALLED from confirmReassignParent with",
            updated.length,
            "locations"
          );
          console.trace();
          onSyncScriptLocations(updated);
        }
        return updated;
      });
    } else {
      setShowReassignDialog(null);
      setReassignTarget("");
    }
  };

  const addActualLocation = () => {
    if (!newActualLocation.name.trim()) return;

    const location = {
      id: `actual_location_${Date.now()}`,
      ...newActualLocation,
    };

    setActualLocations((prev) => {
      const updated = [...prev, location];
      if (onSyncActualLocations) {
        onSyncActualLocations(updated);
      }
      return updated;
    });
    setNewActualLocation({
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
    setShowAddActualLocation(false);
  };

  const editActualLocation = (locationId, updatedLocation) => {
    setActualLocations((prev) => {
      const updated = prev.map((location) =>
        location.id === locationId
          ? { ...location, ...updatedLocation }
          : location
      );
      if (onSyncActualLocations) {
        onSyncActualLocations(updated);
      }
      return updated;
    });
  };

  const deleteActualLocation = (locationId) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
      // Remove assignments from script locations
      setScriptLocations((prev) => {
        const updated = prev.map((loc) =>
          loc.actualLocationId === locationId
            ? { ...loc, actualLocationId: null }
            : loc
        );
        if (onSyncScriptLocations) {
          console.log(
            "🔵 SYNC CALLED from deleteActualLocation with",
            updated.length,
            "locations"
          );
          console.trace();
          onSyncScriptLocations(updated);
        }
        return updated;
      });

      // Remove the actual location
      setActualLocations((prev) => {
        const updated = prev.filter((location) => location.id !== locationId);
        if (onSyncActualLocations) {
          onSyncActualLocations(updated);
        }
        return updated;
      });
    }
  };

  const actualLocationCategories = [
    "Studio",
    "Practical",
    "Location",
    "Backlot",
  ];

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100vw",
        overflow: "hidden",
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
        <h2>Locations</h2>
        <button
          onClick={() => autoExtractAndGroupLocations()}
          style={{
            backgroundColor: "#2196F3",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Refresh Location Detection
        </button>
      </div>

      <div
        style={{ display: "flex", gap: "20px", height: "calc(100vh - 120px)" }}
      >
        {/* Left Panel - Grouped Script Locations */}
        <div
          style={{
            flex: "1",
            borderRight: "1px solid #ddd",
            paddingRight: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3>Script Locations ({scriptLocations.length} total)</h3>

          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "30px" }}>
            {Object.entries(groupedLocations).map(
              ([parentLocation, subLocations]) => {
                const isExpanded = expandedGroups[parentLocation];
                const totalScenes = subLocations.reduce(
                  (total, loc) => total + loc.scenes.length,
                  0
                );
                const assignedActual = actualLocations.find(
                  (actual) => actual.id === subLocations[0]?.actualLocationId
                );

                return (
                  <div key={parentLocation} style={{ marginBottom: "15px" }}>
                    {/* Parent Location Header */}
                    <div
                      style={{
                        backgroundColor: assignedActual ? "#e8f5e8" : "#f0f0f0",
                        border: "2px solid #ddd",
                        borderRadius: "6px",
                        padding: "12px",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleGroup(parentLocation)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        {editingParentName === parentLocation ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flex: 1,
                            }}
                          >
                            <input
                              type="text"
                              value={editParentValue}
                              onChange={(e) =>
                                setEditParentValue(e.target.value)
                              }
                              onBlur={saveParentNameEdit}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") saveParentNameEdit();
                                if (e.key === "Escape") cancelParentNameEdit();
                              }}
                              autoFocus
                              style={{
                                fontSize: "16px",
                                fontWeight: "bold",
                                border: "2px solid #2196F3",
                                borderRadius: "3px",
                                padding: "4px 8px",
                                flex: 1,
                              }}
                            />
                          </div>
                        ) : (
                          <h4
                            style={{ margin: 0, fontSize: "16px", flex: 1 }}
                            onDoubleClick={() =>
                              startEditingParentName(parentLocation)
                            }
                          >
                            {isExpanded ? "▼" : "▶"} {parentLocation}
                          </h4>
                        )}

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "12px", color: "#666" }}>
                            {subLocations.length} locations, {totalScenes}{" "}
                            scenes
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startReassignParent(parentLocation);
                            }}
                            style={{
                              backgroundColor: "#FF9800",
                              color: "white",
                              border: "none",
                              borderRadius: "3px",
                              padding: "2px 6px",
                              cursor: "pointer",
                              fontSize: "10px",
                            }}
                          >
                            Reassign
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: "10px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "5px",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          Assign all to location:
                        </label>
                        <select
                          value={assignedActual?.id || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            assignActualToGroup(parentLocation, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: "100%",
                            padding: "4px",
                            border: "1px solid #ccc",
                            borderRadius: "3px",
                            fontSize: "12px",
                          }}
                        >
                          <option value="">Select actual location...</option>
                          {actualLocations.map((actual) => (
                            <option key={actual.id} value={actual.id}>
                              {actual.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {assignedActual && (
                        <div
                          style={{
                            backgroundColor: "#f0f8f0",
                            padding: "8px",
                            borderRadius: "3px",
                            fontSize: "12px",
                            marginTop: "8px",
                          }}
                        >
                          <strong>Assigned to:</strong> {assignedActual.name}
                          <br />
                          <strong>Address:</strong> {assignedActual.address}
                        </div>
                      )}
                    </div>

                    {/* Sub-locations (when expanded) */}
                    {isExpanded && (
                      <div style={{ marginLeft: "20px", marginTop: "10px" }}>
                        {subLocations.map((location) => (
                          <div
                            key={location.id}
                            style={{
                              border: "1px solid #ddd",
                              margin: "8px 0",
                              padding: "10px",
                              backgroundColor: "#fff",
                              borderRadius: "4px",
                              fontSize: "14px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "5px",
                              }}
                            >
                              {location.intExt}{" "}
                              {editingSubLocation === location.id ? (
                                <input
                                  type="text"
                                  value={editSubLocationValue}
                                  onChange={(e) =>
                                    setEditSubLocationValue(e.target.value)
                                  }
                                  onBlur={saveSubLocationEdit}
                                  onKeyPress={(e) => {
                                    if (e.key === "Enter")
                                      saveSubLocationEdit();
                                    if (e.key === "Escape")
                                      cancelSubLocationEdit();
                                  }}
                                  autoFocus
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: "bold",
                                    border: "2px solid #2196F3",
                                    borderRadius: "3px",
                                    padding: "2px 6px",
                                    minWidth: "120px",
                                  }}
                                />
                              ) : (
                                <span
                                  onDoubleClick={() =>
                                    startEditingSubLocation(
                                      location.id,
                                      location.subLocation
                                    )
                                  }
                                  style={{
                                    cursor: "pointer",
                                    padding: "2px 4px",
                                    borderRadius: "3px",
                                  }}
                                  onMouseOver={(e) =>
                                    (e.target.style.backgroundColor = "#f0f0f0")
                                  }
                                  onMouseOut={(e) =>
                                    (e.target.style.backgroundColor =
                                      "transparent")
                                  }
                                  title="Double-click to edit sub-location name"
                                >
                                  {location.subLocation}
                                </span>
                              )}
                            </div>
                            {/* Assigned Scenes */}
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#666",
                                marginBottom: "8px",
                              }}
                            >
                              <strong>Assigned Scenes:</strong>{" "}
                              {location.scenes.length > 0 ? (
                                <>
                                  {location.scenes.map((sceneNum, index) => {
                                    const scene = scenes.find(
                                      (s) => s.sceneNumber == sceneNum
                                    );
                                    const status =
                                      scene?.status || "Not Scheduled";
                                    const statusColor =
                                      status === "Scheduled"
                                        ? "#2196F3"
                                        : status === "Shot"
                                        ? "#4CAF50"
                                        : status === "Pickups"
                                        ? "#FFC107"
                                        : status === "Reshoot"
                                        ? "#F44336"
                                        : "#f0f0f0";
                                    const textColor =
                                      status === "Pickups"
                                        ? "black"
                                        : status === "Not Scheduled"
                                        ? "#666"
                                        : "white";

                                    return (
                                      <span key={sceneNum}>
                                        <span
                                          style={{
                                            backgroundColor: statusColor,
                                            color: textColor,
                                            padding: "2px 6px",
                                            borderRadius: "3px",
                                            marginRight: "4px",
                                            fontSize: "11px",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            border: "1px solid #ddd",
                                          }}
                                          title={`Scene ${sceneNum} - ${status} (Double-click to remove)`}
                                          onDoubleClick={() => {
                                            toggleSceneAssignment(
                                              location.id,
                                              sceneNum
                                            );
                                          }}
                                        >
                                          {sceneNum}
                                        </span>
                                        {index < location.scenes.length - 1
                                          ? " "
                                          : ""}
                                      </span>
                                    );
                                  })}{" "}
                                  ({location.scenes.length} scenes)
                                </>
                              ) : (
                                <span
                                  style={{ color: "#999", fontStyle: "italic" }}
                                >
                                  No scenes assigned
                                </span>
                              )}
                            </div>

                            {/* All Available Scenes for Manual Assignment */}
                            <div
                              style={{
                                fontSize: "12px",
                                marginBottom: "8px",
                                padding: "8px",
                                backgroundColor: "#f9f9f9",
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0",
                              }}
                            >
                              <strong>
                                All Scenes (Double-click to add/remove):
                              </strong>
                              <div
                                style={{ marginTop: "4px", lineHeight: "1.8" }}
                              >
                                {allSceneNumbers.map((sceneNum) => {
                                  const isAssigned =
                                    location.scenes.includes(sceneNum);
                                  const scene = scenes.find(
                                    (s) => s.sceneNumber == sceneNum
                                  );
                                  const status =
                                    scene?.status || "Not Scheduled";

                                  return (
                                    <span
                                      key={sceneNum}
                                      style={{
                                        backgroundColor: isAssigned
                                          ? "#4CAF50"
                                          : "#f0f0f0",
                                        color: isAssigned ? "white" : "#666",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                        marginRight: "4px",
                                        marginBottom: "3px",
                                        fontSize: "11px",
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        border: isAssigned
                                          ? "1px solid #4CAF50"
                                          : "1px solid #ddd",
                                        display: "inline-block",
                                      }}
                                      title={
                                        isAssigned
                                          ? `Scene ${sceneNum} - ASSIGNED (Double-click to remove)`
                                          : `Scene ${sceneNum} - Available (Double-click to add)`
                                      }
                                      onDoubleClick={() => {
                                        toggleSceneAssignment(
                                          location.id,
                                          sceneNum
                                        );
                                      }}
                                    >
                                      {sceneNum}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startReassignSubLocation(
                                  location.id,
                                  location.subLocation
                                );
                              }}
                              style={{
                                backgroundColor: "#FF9800",
                                color: "white",
                                border: "none",
                                borderRadius: "3px",
                                padding: "2px 6px",
                                cursor: "pointer",
                                fontSize: "10px",
                                marginBottom: "8px",
                              }}
                            >
                              Reassign Sub-Location
                            </button>

                            <select
                              value={location.actualLocationId || ""}
                              onChange={(e) =>
                                assignActualLocation(
                                  location.id,
                                  e.target.value
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px",
                                border: "1px solid #ccc",
                                borderRadius: "3px",
                                fontSize: "11px",
                              }}
                            >
                              <option value="">
                                Override group assignment...
                              </option>
                              {actualLocations.map((actual) => (
                                <option key={actual.id} value={actual.id}>
                                  {actual.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Right Panel - Actual Locations (same as before) */}
        <div
          style={{
            flex: "1",
            paddingLeft: "20px",
            display: "flex",
            flexDirection: "column",
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
            <h3>Actual Locations ({actualLocations.length})</h3>
            <button
              onClick={() => setShowAddActualLocation(true)}
              style={{
                backgroundColor: "#4CAF50",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + Add Location
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingBottom: "30px" }}>
            {actualLocations.map((location) => (
              <div
                key={location.id}
                style={{
                  border: "1px solid #ddd",
                  margin: "10px 0",
                  padding: "15px",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h4 style={{ margin: 0 }}>{location.name}</h4>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#2196F3",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "10px",
                      }}
                    >
                      {location.category}
                    </span>
                    <button
                      onClick={() => {
                        setEditingLocation(location);
                        setShowEditLocationDialog(true);
                      }}
                      style={{
                        backgroundColor: "#FF9800",
                        color: "white",
                        border: "none",
                        borderRadius: "3px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteActualLocation(location.id)}
                      style={{
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "3px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "10px",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p style={{ margin: "5px 0", fontSize: "14px" }}>
                  <strong>Address:</strong> {location.address}
                  {(location.city || location.state || location.zipCode) && (
                    <br />
                  )}
                  {location.city && `${location.city}, `}
                  {location.state && `${location.state} `}
                  {location.zipCode && location.zipCode}
                </p>

                {location.contactPerson && (
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Contact:</strong> {location.contactPerson}{" "}
                    {location.phone && `- ${location.phone}`}
                  </p>
                )}

                {location.parkingInfo && (
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Parking:</strong> {location.parkingInfo}
                  </p>
                )}

                {location.permitRequired && (
                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "12px",
                      color: "#f44336",
                    }}
                  >
                    ⚠️ Permit Required
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reassign Parent Dialog */}
      {showReassignDialog && (
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
            onClick={() => setShowReassignDialog(null)}
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
            <h3 style={{ marginTop: 0 }}>Reassign Parent Location</h3>
            <p>
              Reassign "{showReassignDialog}" and all its sub-locations to
              another parent group:
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "10px",
                  fontWeight: "bold",
                }}
              >
                Select target parent location:
              </label>
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
              >
                <option value="">Select parent location...</option>
                {Object.keys(groupedLocations)
                  .filter((parent) => parent !== showReassignDialog)
                  .map((parent) => (
                    <option key={parent} value={parent}>
                      {parent}
                    </option>
                  ))}
              </select>

              <div style={{ marginTop: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Or create new parent name:
                </label>
                <input
                  type="text"
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  placeholder="Enter new parent location name"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={confirmReassignParent}
                disabled={!reassignTarget}
                style={{
                  backgroundColor: reassignTarget ? "#FF9800" : "#ccc",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: reassignTarget ? "pointer" : "not-allowed",
                }}
              >
                Reassign
              </button>
              <button
                onClick={() => setShowReassignDialog(null)}
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

      {/* Reassign Sub-Location Dialog */}
      {showReassignSubDialog && (
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
            onClick={cancelReassignSubLocation}
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
            <h3 style={{ marginTop: 0 }}>Reassign Sub-Location</h3>
            <p>
              Reassign or merge "{showReassignSubDialog.subLocationName}" from "
              {showReassignSubDialog.parentLocation}":
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "10px",
                  fontWeight: "bold",
                }}
              >
                Merge with sub-location in same parent:
              </label>
              <select
                value={reassignSubTarget}
                onChange={(e) => setReassignSubTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", marginBottom: "15px" }}
              >
                <option value="">Select sub-location to merge with...</option>
                {groupedLocations[showReassignSubDialog?.parentLocation]
                  ?.filter(
                    (loc) => loc.id !== showReassignSubDialog?.locationId
                  )
                  .map((location) => (
                    <option key={location.id} value={`merge:${location.id}`}>
                      Merge with: {location.subLocation}
                    </option>
                  ))}
              </select>

              <label
                style={{
                  display: "block",
                  marginBottom: "10px",
                  fontWeight: "bold",
                }}
              >
                Or move to different parent location:
              </label>
              <select
                value={reassignSubTarget}
                onChange={(e) => setReassignSubTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
              >
                <option value="">Select parent location...</option>
                {Object.keys(groupedLocations)
                  .filter(
                    (parent) => parent !== showReassignSubDialog?.parentLocation
                  )
                  .map((parent) => (
                    <option key={parent} value={`parent:${parent}`}>
                      Move to: {parent}
                    </option>
                  ))}
              </select>

              <div style={{ marginTop: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Or create new parent name:
                </label>
                <input
                  type="text"
                  value={reassignSubTarget}
                  onChange={(e) => setReassignSubTarget(e.target.value)}
                  placeholder="Enter new parent location name"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={confirmReassignSubLocation}
                disabled={!reassignSubTarget}
                style={{
                  backgroundColor: reassignSubTarget ? "#FF9800" : "#ccc",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: reassignSubTarget ? "pointer" : "not-allowed",
                }}
              >
                Reassign
              </button>
              <button
                onClick={cancelReassignSubLocation}
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

      {/* Add Actual Location Modal (same as before with fixed layout) */}
      {showAddActualLocation && (
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
            onClick={() => setShowAddActualLocation(false)}
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
              padding: "30px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              width: "500px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add New Actual Location</h3>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Location Name:
              </label>
              <input
                type="text"
                value={newActualLocation.name}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Street Address:
              </label>
              <input
                type="text"
                value={newActualLocation.address}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <div style={{ flex: "2", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  City:
                </label>
                <input
                  type="text"
                  value={newActualLocation.city}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "1", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  State:
                </label>
                <input
                  type="text"
                  value={newActualLocation.state}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "1", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Zip Code:
                </label>
                <input
                  type="text"
                  value={newActualLocation.zipCode}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      zipCode: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Contact Person:
              </label>
              <input
                type="text"
                value={newActualLocation.contactPerson}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    contactPerson: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  marginBottom: "10px",
                }}
              />

              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Phone:
              </label>
              <input
                type="text"
                value={newActualLocation.phone}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Category:
              </label>
              <select
                value={newActualLocation.category}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                {actualLocationCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
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
                Parking Info:
              </label>
              <input
                type="text"
                value={newActualLocation.parkingInfo}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    parkingInfo: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={newActualLocation.permitRequired}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      permitRequired: e.target.checked,
                    }))
                  }
                />
                <span style={{ fontWeight: "bold" }}>Permit Required</span>
              </label>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Notes:
              </label>
              <textarea
                value={newActualLocation.notes}
                onChange={(e) =>
                  setNewActualLocation((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  minHeight: "60px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowAddActualLocation(false)}
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
              <button
                onClick={addActualLocation}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Add Location
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Actual Location Modal */}
      {showEditLocationDialog && editingLocation && (
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
            onClick={() => {
              setShowEditLocationDialog(false);
              setEditingLocation(null);
            }}
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
              padding: "30px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              width: "500px",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Edit Location: {editingLocation.name}
            </h3>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Location Name:
              </label>
              <input
                type="text"
                value={editingLocation.name}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Street Address:
              </label>
              <input
                type="text"
                value={editingLocation.address}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <div style={{ flex: "2", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  City:
                </label>
                <input
                  type="text"
                  value={newActualLocation.city}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "1", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  State:
                </label>
                <input
                  type="text"
                  value={newActualLocation.state}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "1", minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Zip Code:
                </label>
                <input
                  type="text"
                  value={newActualLocation.zipCode}
                  onChange={(e) =>
                    setNewActualLocation((prev) => ({
                      ...prev,
                      zipCode: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Contact Person:
              </label>
              <input
                type="text"
                value={editingLocation.contactPerson}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    contactPerson: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  marginBottom: "10px",
                }}
              />

              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Phone:
              </label>
              <input
                type="text"
                value={editingLocation.phone}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Category:
              </label>
              <select
                value={editingLocation.category}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              >
                {actualLocationCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
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
                Parking Info:
              </label>
              <input
                type="text"
                value={editingLocation.parkingInfo}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    parkingInfo: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={editingLocation.permitRequired}
                  onChange={(e) =>
                    setEditingLocation((prev) => ({
                      ...prev,
                      permitRequired: e.target.checked,
                    }))
                  }
                />
                <span style={{ fontWeight: "bold" }}>Permit Required</span>
              </label>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Notes:
              </label>
              <textarea
                value={editingLocation.notes}
                onChange={(e) =>
                  setEditingLocation((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  minHeight: "60px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowEditLocationDialog(false);
                  setEditingLocation(null);
                }}
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
              <button
                onClick={() => {
                  editActualLocation(editingLocation.id, editingLocation);
                  setShowEditLocationDialog(false);
                  setEditingLocation(null);
                }}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Permission helper functions
const canEdit = (userRole) => ["owner", "editor"].includes(userRole);
const canDelete = (userRole) => userRole === "owner";
const canManageTeam = (userRole) => userRole === "owner";
const isViewOnly = (userRole) => userRole === "viewer";

function App({ selectedProject, userRole, user }) {
  // Removed app render logging - causing sync loops
  // console.log("🔄 App render:", { projectId: selectedProject?.id, userRole });
  // Database-synced scenes state
  const [scenes, setScenes] = useState([]);
  const [scenesLoaded, setScenesLoaded] = useState(false);
  const [isSavingScenes, setIsSavingScenes] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeProgress, setSummarizeProgress] = useState({
    current: 0,
    total: 0,
  });

  // Sync lock flags to prevent realtime reload loops
  const syncLocks = useRef({
    castCrew: false,
    scenes: false,
    stripboardScenes: false,
    shootingDays: false,
    scheduledScenes: false,
    characters: false,
    taggedItems: false,
    scriptLocations: false,
    actualLocations: false,
    callSheet: false,
    wardrobe: false,
    garmentInventory: false,
    costCategories: false,
    costVendors: false,
    budget: false,
    shotList: false,
    timeline: false,
    continuity: false,
    todoItems: false,
  });

  const initialLoadComplete = useRef(false);

  // Clear scroll position flags on page load/refresh
  useEffect(() => {
    // Clear Stripboard Schedule flags so it auto-scrolls on reload
    sessionStorage.removeItem("stripboard-schedule-scroll-position");
    sessionStorage.removeItem("stripboard-schedule-has-auto-scrolled");
    // Clear Stripboard position so it starts at top on reload
    sessionStorage.removeItem("stripboard-scroll-position");
  }, []); // Empty array = runs once on page load

  // Load scenes from database when project is selected
  useEffect(() => {
    console.log("🚨 USEEFFECT TRIGGERED - selectedProject:", selectedProject);
    if (!selectedProject) return;

    // Check if daily availability cleanup is needed
    database.checkAndRunDailyAvailabilityCleanup(selectedProject);

    // Skip reload if initial load is complete and any sync is active
    if (initialLoadComplete.current) {
      const anySyncActive = Object.values(syncLocks.current).some(
        (lock) => lock === true
      );
      if (anySyncActive) {
        console.log("⏸️ SKIPPING data reload - sync in progress");
        return;
      }
    }
    database.loadScenesFromDatabase(
      selectedProject,
      setScenes,
      setScenesLoaded,
      (loadedScenes) => {
        database.loadStripboardScenesAfterScenes(
          selectedProject,
          loadedScenes,
          setStripboardScenes
        );
      }
    );
    database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    database.loadTaggedItemsFromDatabase(
      selectedProject,
      setTaggedItems,
      calculateCategoryNumbers
    );
    database.loadProjectSettingsFromDatabase(
      selectedProject,
      setProjectSettings,
      setCharacterSceneOverrides
    );
    database.loadShootingDaysFromDatabase(selectedProject, setShootingDays);
    database.loadCharactersFromDatabase(selectedProject, setCharacters);
    database.loadScriptLocationsFromDatabase(
      selectedProject,
      setScriptLocations
    );
    database.loadActualLocationsFromDatabase(
      selectedProject,
      setActualLocations
    );
    database.loadCallSheetDataFromDatabase(selectedProject, setCallSheetData);
    database.loadWardrobeItemsFromDatabase(selectedProject, setWardrobeItems);
    database.loadGarmentInventoryFromDatabase(
      selectedProject,
      setGarmentInventory
    );
    database.loadCostCategoriesFromDatabase(selectedProject, setCostCategories);
    database.loadCostVendorsFromDatabase(selectedProject, setCostVendors);
    database.loadBudgetDataFromDatabase(selectedProject, setBudgetData);
    database.loadTodoItemsFromDatabase(selectedProject, setTodoItems);
    database.loadShotListDataFromDatabase(
      selectedProject,
      setShotListData,
      setSceneNotes
    );
    database.loadScheduledScenesFromDatabase(
      selectedProject,
      setScheduledScenes
    );
    database.loadContinuityElementsFromDatabase(
      selectedProject,
      setContinuityElements
    );
    database.loadDoodCastEvents(selectedProject, setDoodCastEvents);
    database.loadDoodOverrides(selectedProject, setDoodOverrides);
    database.loadDoodSettings(selectedProject, setDoodSettings);

    // Mark initial load as complete
    initialLoadComplete.current = true;

    // Set up real-time subscriptions for all 20 tables
    console.log(
      "🔴 Setting up realtime subscriptions for project:",
      selectedProject.id
    );

    const channels = [];

    // 1. Scenes
    const scenesChannel = supabase
      .channel(`scenes_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Scenes changed by another user");

          if (syncLocks.current.scenes) {
            console.log("⏭️ SKIPPING Scenes reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.scenesReloadTimeout) {
            clearTimeout(window.scenesReloadTimeout);
          }

          window.scenesReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Scenes from database (after 500ms debounce)"
            );
            database.loadScenesFromDatabase(
              selectedProject,
              setScenes,
              setScenesLoaded,
              (loadedScenes) => {
                database.loadStripboardScenesAfterScenes(
                  selectedProject,
                  loadedScenes,
                  setStripboardScenes
                );
              }
            );
            window.scenesReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(scenesChannel);

    // 2. Stripboard scenes
    const stripboardChannel = supabase
      .channel(`stripboard_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stripboard_scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Stripboard changed");

          // EMERGENCY: Check ALL sync locks to prevent cascading loops
          if (
            syncLocks.current.stripboardScenes ||
            syncLocks.current.scenes ||
            syncLocks.current.shootingDays ||
            syncLocks.current.scheduledScenes
          ) {
            console.log(
              "⏭️ SKIPPING Stripboard reload - sync operations active"
            );
            return;
          }

          if (window.stripboardReloadTimeout) {
            clearTimeout(window.stripboardReloadTimeout);
          }

          window.stripboardReloadTimeout = setTimeout(() => {
            // Double-check locks before executing
            if (
              syncLocks.current.stripboardScenes ||
              syncLocks.current.scenes ||
              syncLocks.current.shootingDays ||
              syncLocks.current.scheduledScenes
            ) {
              console.log("⏭️ ABORTING Stripboard reload - sync still active");
              window.stripboardReloadTimeout = null;
              return;
            }

            console.log(
              "✅ Loading Stripboard from database (after 500ms debounce)"
            );
            database.loadStripboardScenesAfterScenes(
              selectedProject,
              scenes,
              setStripboardScenes
            );
            window.stripboardReloadTimeout = null;
          }, 1000); // Increased debounce to 1 second
        }
      )
      .subscribe();
    channels.push(stripboardChannel);

    // 3. Shooting days
    const shootingDaysChannel = supabase
      .channel(`shooting_days_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shooting_days",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Shooting days changed");

          // ✅ CHECK SYNC LOCK FIRST - BEFORE ANY DEBOUNCE
          if (syncLocks.current.shootingDays) {
            console.log("⏭️ SKIPPING reload - shooting days sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.shootingDaysReloadTimeout) {
            clearTimeout(window.shootingDaysReloadTimeout);
          }

          window.shootingDaysReloadTimeout = setTimeout(() => {
            // ✅ DOUBLE-CHECK SYNC LOCK AGAIN INSIDE TIMEOUT
            if (syncLocks.current.shootingDays) {
              console.log("⏭️ ABORTING reload - sync lock still active");
              window.shootingDaysReloadTimeout = null;
              return;
            }

            console.log(
              "✅ Loading Shooting days from database (after 500ms debounce)"
            );
            database.loadShootingDaysFromDatabase(
              selectedProject,
              setShootingDays
            );
            window.shootingDaysReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(shootingDaysChannel);

    // 4. Scheduled scenes - WITH DEBOUNCING
    const scheduledChannel = supabase
      .channel(`scheduled_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Scheduled scenes changed");
          if (syncLocks.current.scheduledScenes) {
            console.log(
              "⏭️ SKIPPING Scheduled scenes reload - sync lock active"
            );
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.scheduledScenesReloadTimeout) {
            clearTimeout(window.scheduledScenesReloadTimeout);
          }

          window.scheduledScenesReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Scheduled scenes from database (debounced)"
            );
            database.loadScheduledScenesFromDatabase(
              selectedProject,
              setScheduledScenes
            );
            window.scheduledScenesReloadTimeout = null;
          }, 500); // Wait 500ms after last change before reloading
        }
      )
      .subscribe();
    channels.push(scheduledChannel);

    // 5. Cast & Crew - WITH SYNC LOCK FIX
    const castCrewChannel = supabase
      .channel(`cast_crew_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cast_crew",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cast/Crew changed");

          if (syncLocks.current.castCrew) {
            console.log("⏭️ SKIPPING Cast/Crew reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.castCrewReloadTimeout) {
            clearTimeout(window.castCrewReloadTimeout);
          }

          window.castCrewReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Cast/Crew from database (another user changed it)"
            );
            database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
            window.castCrewReloadTimeout = null;
          }, 500); // Wait 500ms after last change before reloading
        }
      )
      .subscribe();
    channels.push(castCrewChannel);

    // 5b. Cast/Crew Availability - Separate channel for availability changes
    const availabilityChannel = supabase
      .channel(`cast_crew_availability_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cast_crew_availability",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Availability changed");

          if (syncLocks.current.castCrew) {
            console.log("⏭️ SKIPPING Availability reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.availabilityReloadTimeout) {
            clearTimeout(window.availabilityReloadTimeout);
          }

          window.availabilityReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Reloading Cast/Crew (availability changed by another user)"
            );
            database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
            window.availabilityReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(availabilityChannel);

    // 6. Characters
    const charactersChannel = supabase
      .channel(`characters_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "characters",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Characters changed");
          if (syncLocks.current.characters) {
            console.log("⏭️ SKIPPING Characters reload - sync lock active");
            return;
          }
          database.loadCharactersFromDatabase(selectedProject, setCharacters);
        }
      )
      .subscribe();
    channels.push(charactersChannel);

    // 7. Tagged items
    const taggedItemsChannel = supabase
      .channel(`tagged_items_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tagged_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Tagged items changed");
          if (syncLocks.current.taggedItems) {
            console.log("⏭️ SKIPPING Tagged items reload - sync lock active");
            return;
          }

          console.log("✅ Loading Tagged items from database IMMEDIATELY");
          database.loadTaggedItemsFromDatabase(
            selectedProject,
            setTaggedItems,
            calculateCategoryNumbers
          );
        }
      )
      .subscribe();
    channels.push(taggedItemsChannel);

    // 8. Script locations
    const scriptLocChannel = supabase
      .channel(`script_loc_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "script_locations",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Script locations changed");

          if (syncLocks.current.scriptLocations) {
            console.log(
              "⏭️ SKIPPING Script locations reload - sync lock active"
            );
            return;
          }

          if (window.scriptLocationsReloadTimeout) {
            clearTimeout(window.scriptLocationsReloadTimeout);
          }

          window.scriptLocationsReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Script locations from database (after 500ms debounce)"
            );
            database.loadScriptLocationsFromDatabase(
              selectedProject,
              setScriptLocations
            );
            window.scriptLocationsReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(scriptLocChannel);

    // Set up global reload function for post-sync forced reloads
    window.forceScriptLocationsReload = () => {
      if (!syncLocks.current.scriptLocations) {
        console.log("✅ Force-reloading Script locations from database");
        database.loadScriptLocationsFromDatabase(
          selectedProject,
          setScriptLocations
        );
      } else {
        console.log("⏭️ SKIPPING force reload - sync lock active");
      }
    };

    // 9. Actual locations
    const actualLocChannel = supabase
      .channel(`actual_loc_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "actual_locations",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Actual locations changed");

          if (syncLocks.current.actualLocations) {
            console.log(
              "⏭️ SKIPPING Actual locations reload - sync lock active"
            );
            return;
          }

          console.log("✅ Loading Actual locations from database IMMEDIATELY");
          database.loadActualLocationsFromDatabase(
            selectedProject,
            setActualLocations
          );
        }
      )
      .subscribe();
    channels.push(actualLocChannel);

    // 10. Call sheet
    const callSheetChannel = supabase
      .channel(`call_sheet_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sheet_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Call sheet changed");

          // Check if we're currently syncing - if so, skip reload to prevent race condition
          if (syncLocks.current.callSheet) {
            console.log("⏸️ SKIPPING reload - sync in progress");
            return;
          }

          console.log("✅ Loading Call sheet from database IMMEDIATELY");
          database.loadCallSheetDataFromDatabase(
            selectedProject,
            setCallSheetData
          );
        }
      )
      .subscribe();
    channels.push(callSheetChannel);

    // 11. Wardrobe
    const wardrobeChannel = supabase
      .channel(`wardrobe_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wardrobe_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Wardrobe changed");
          if (syncLocks.current.wardrobeItems) {
            console.log("⏭️ SKIPPING wardrobe reload - sync lock active");
            return;
          }
          database.loadWardrobeItemsFromDatabase(
            selectedProject,
            setWardrobeItems
          );
        }
      )
      .subscribe();
    channels.push(wardrobeChannel);

    // 12. Garment inventory
    const garmentChannel = supabase
      .channel(`garment_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garment_inventory",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Garment inventory changed");
          if (syncLocks.current.garmentInventory) {
            console.log("⏭️ SKIPPING garment reload - sync lock active");
            return;
          }

          // Add debounce to prevent infinite loops
          if (window.garmentInventoryReloadTimeout) {
            clearTimeout(window.garmentInventoryReloadTimeout);
          }

          window.garmentInventoryReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading garment inventory from database (after 500ms debounce)"
            );
            database.loadGarmentInventoryFromDatabase(
              selectedProject,
              setGarmentInventory
            );
            window.garmentInventoryReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(garmentChannel);

    // 13. Cost categories
    const costCatChannel = supabase
      .channel(`cost_cat_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_categories",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cost categories changed");
          database.loadCostCategoriesFromDatabase(
            selectedProject,
            setCostCategories
          );
        }
      )
      .subscribe();
    channels.push(costCatChannel);

    // 14. Cost vendors
    const costVendChannel = supabase
      .channel(`cost_vend_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_vendors",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cost vendors changed");
          database.loadCostVendorsFromDatabase(selectedProject, setCostVendors);
        }
      )
      .subscribe();
    channels.push(costVendChannel);

    // 15. Budget
    const budgetChannel = supabase
      .channel(`budget_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Budget changed");
          if (syncLocks.current.budget) {
            console.log("⏭️ SKIPPING budget reload - sync lock active");
            return;
          }
          database.loadBudgetDataFromDatabase(selectedProject, setBudgetData);
        }
      )
      .subscribe();
    channels.push(budgetChannel);

    // 16. Shot list
    const shotListChannel = supabase
      .channel(`shot_list_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shot_list_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Shot list changed");

          if (syncLocks.current.shotList) {
            console.log("⏭️ SKIPPING Shot list reload - sync lock active");
            return;
          }

          if (window.shotListReloadTimeout) {
            clearTimeout(window.shotListReloadTimeout);
          }

          window.shotListReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Shot list from database (after 500ms debounce)"
            );
            database.loadShotListDataFromDatabase(
              selectedProject,
              setShotListData,
              setSceneNotes
            );
            window.shotListReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(shotListChannel);

    // 17. Timeline
    const timelineChannel = supabase
      .channel(`timeline_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timeline_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Timeline changed");
          database.loadTimelineDataFromDatabase(
            selectedProject,
            setTimelineData
          );
        }
      )
      .subscribe();
    channels.push(timelineChannel);

    // 18. Continuity
    const continuityChannel = supabase
      .channel(`continuity_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "continuity_elements",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Continuity changed");
          database.loadContinuityElementsFromDatabase(
            selectedProject,
            setContinuityElements
          );
        }
      )
      .subscribe();
    channels.push(continuityChannel);

    // 19. Todo items
    const todoChannel = supabase
      .channel(`todo_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todo_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Todo items changed");
          if (syncLocks.current.todoItems) {
            console.log("⏭️ SKIPPING todo reload - sync lock active");
            return;
          }
          database.loadTodoItemsFromDatabase(selectedProject, setTodoItems);
        }
      )
      .subscribe();
    channels.push(todoChannel);

    // 20. Project members
    const membersChannel = supabase
      .channel(`members_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_members",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Project members changed");
        }
      )
      .subscribe();
    channels.push(membersChannel);

    console.log("🔴 All 20 realtime channels subscribed");

    // Debug: Check subscription status
    setTimeout(() => {
      console.log("🔴 REALTIME DEBUG: Checking channel statuses...");
      channels.forEach((channel, index) => {
        console.log(
          `Channel ${index + 1}: ${channel.topic}, State: ${channel.state}`
        );
      });
    }, 3000);

    return () => {
      console.log("🔴 Unsubscribing from all realtime channels");
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [selectedProject?.id]);

  const saveScenesDatabase = async (updatedScenes) => {
    syncLocks.current.scenes = true;
    console.log("🔒 Scenes sync lock ENABLED");

    await database.saveScenesDatabase(
      selectedProject,
      updatedScenes,
      scenesLoaded,
      isSavingScenes,
      setIsSavingScenes
    );

    syncLocks.current.scenes = false;
    console.log("🔓 Scenes sync lock RELEASED");
  };

  const syncShootingDaysToDatabase = async (updatedShootingDays) => {
    syncLocks.current.shootingDays = true;
    console.log("🔒 Shooting days sync lock ENABLED");

    try {
      await database.syncShootingDaysToDatabase(
        selectedProject,
        updatedShootingDays
      );
      // Release lock immediately after sync completes
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED (immediate)");
    } catch (error) {
      // Release immediately on error
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED (error)");
      throw error;
    }
  };

  const syncStripboardScenesToDatabase = async (updatedStripboardScenes) => {
    syncLocks.current.stripboardScenes = true;
    console.log("🔒 Stripboard scenes sync lock ENABLED");

    await database.syncStripboardScenesToDatabase(
      selectedProject,
      updatedStripboardScenes
    );

    syncLocks.current.stripboardScenes = false;
    console.log("🔓 Stripboard scenes sync lock RELEASED");
  };

  const syncScheduledScenesToDatabase = async (updatedScheduledScenes) => {
    syncLocks.current.scheduledScenes = true;
    console.log("🔒 Scheduled scenes sync lock ENABLED");

    await database.syncScheduledScenesToDatabase(
      selectedProject,
      updatedScheduledScenes
    );

    syncLocks.current.scheduledScenes = false;
    console.log("🔓 Scheduled scenes sync lock RELEASED");
  };

  const syncScriptLocationsToDatabase = async (updatedLocations) => {
    syncLocks.current.scriptLocations = true;
    console.log("🔒 Script locations sync lock ENABLED");

    await database.syncScriptLocationsToDatabase(
      selectedProject,
      updatedLocations
    );

    syncLocks.current.scriptLocations = false;
    console.log("🔓 Script locations sync lock RELEASED");
  };

  const syncActualLocationsToDatabase = async (updatedLocations) => {
    syncLocks.current.actualLocations = true;
    console.log("🔒 Actual locations sync lock ENABLED");

    await database.syncActualLocationsToDatabase(
      selectedProject,
      updatedLocations
    );

    syncLocks.current.actualLocations = false;
    console.log("🔓 Actual locations sync lock RELEASED");
  };

  const syncCastCrewToDatabase = async (updatedCastCrew) => {
    syncLocks.current.castCrew = true;
    console.log("🔒 Cast/Crew sync lock ENABLED");

    try {
      await database.syncCastCrewToDatabase(selectedProject, updatedCastCrew);

      // Release lock immediately after sync completes
      syncLocks.current.castCrew = false;
      console.log("🔓 Cast/Crew sync lock RELEASED (immediate)");
    } catch (error) {
      console.error("❌ Error syncing Cast/Crew:", error);
      syncLocks.current.castCrew = false;
      console.log("🔓 Cast/Crew sync lock RELEASED (error)");
    }
  };

  const syncCallSheetDataToDatabase = async (updatedCallSheetData) => {
    syncLocks.current.callSheet = true;
    console.log("🔒 CallSheet sync lock ENABLED");

    try {
      await database.syncCallSheetDataToDatabase(
        selectedProject,
        updatedCallSheetData
      );
      console.log("✅ CallSheet sync completed");
    } catch (error) {
      console.error("❌ CallSheet sync failed:", error);
    } finally {
      syncLocks.current.callSheet = false;
      console.log("🔓 CallSheet sync lock RELEASED");
    }
  };

  const syncAllShootingDaysToDatabase = async (daysToSync = null) => {
    syncLocks.current.shootingDays = true;
    console.log("🔒 Shooting days sync lock ENABLED");

    try {
      // CRITICAL: Use provided data or fall back to state
      const dataToSync = daysToSync || shootingDays;
      console.log(
        `🔧 Syncing ${dataToSync.length} shooting days (${
          daysToSync ? "FRESH DATA" : "from state"
        })`
      );

      // CRITICAL: Deep UUID conversion before database sync
      console.log("🔧 Converting all shooting day IDs to UUIDs before sync...");

      const ensureAllUUIDs = (obj) => {
        if (!obj) return obj;

        const isValidUUID = (str) => {
          if (typeof str !== "string") return false;
          return str.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        };

        const toUUID = (id) => {
          if (isValidUUID(id)) return id;
          return crypto.randomUUID();
        };

        // Check if value is a bigint ID (from Date.now())
        const isBigintID = (val) => {
          return typeof val === "number" && val > 1000000000000;
        };

        if (Array.isArray(obj)) {
          return obj.map((item) => ensureAllUUIDs(item));
        }

        if (typeof obj === "object" && obj !== null) {
          const newObj = { ...obj };

          Object.keys(newObj).forEach((key) => {
            const value = newObj[key];

            // AGGRESSIVE: Convert ANY number > 1000000000000 to UUID
            if (typeof value === "number" && value > 1000000000000) {
              console.log(`🔧 AGGRESSIVE: Converting ${key}: ${value} to UUID`);
              newObj[key] = toUUID(value);
            }
            // Convert ALL potential ID fields to UUID
            else if (
              key === "id" ||
              key.endsWith("Id") ||
              key.endsWith("_id") ||
              key === "blockId" ||
              key.includes("id") ||
              key.includes("Id")
            ) {
              if (!isValidUUID(value)) {
                console.log(`🔧 Converting ID field ${key}: ${value} to UUID`);
                newObj[key] = toUUID(value);
              }
            }
            // Recursively convert nested objects
            else if (typeof value === "object" && value !== null) {
              newObj[key] = ensureAllUUIDs(value);
            }
          });

          return newObj;
        }

        return obj;
      };

      const uuidConvertedShootingDays = ensureAllUUIDs(dataToSync);
      console.log("✅ UUID conversion complete - syncing to database");

      // EMERGENCY DEBUG: Dump ENTIRE structure to find hidden bigints
      console.log("🚨 Syncing shooting days - bigint check complete");

      const checkForBigints = (obj, path = "") => {
        if (typeof obj === "number" && obj > 1000000000000) {
          console.error(`🚨 BIGINT FOUND at ${path}: ${obj} (${typeof obj})`);
        }

        if (typeof obj === "object" && obj !== null) {
          Object.keys(obj).forEach((key) => {
            checkForBigints(obj[key], `${path}.${key}`);
          });
        }
      };

      console.log(
        `🔍 Bigint structure check complete for ${uuidConvertedShootingDays.length} days`
      );
      // Run bigint check silently
      uuidConvertedShootingDays.forEach((day, index) => {
        checkForBigints(day, `day[${index}]`);
      });

      // Also dump first day as JSON to see full structure
      if (uuidConvertedShootingDays.length > 0) {
        console.log("🔍 FIRST DAY SUMMARY:", {
          id: uuidConvertedShootingDays[0]?.id,
          date: uuidConvertedShootingDays[0]?.date,
          dayNumber: uuidConvertedShootingDays[0]?.dayNumber,
          blocksCount:
            uuidConvertedShootingDays[0]?.scheduleBlocks?.length || 0,
        });
      }

      await database.syncShootingDaysToDatabase(
        selectedProject,
        uuidConvertedShootingDays
      );
      console.log("✅ Shooting days synced successfully");
    } catch (error) {
      console.error("❌ CRITICAL: Shooting days sync failed:", error);
      // Continue without throwing to prevent cascade failures
    } finally {
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED");
    }
  };

  const syncTimelineDataToDatabase = async (updatedTimelineData) => {
    await database.syncTimelineDataToDatabase(
      selectedProject,
      updatedTimelineData
    );
  };

  const syncContinuityElementsToDatabase = async (
    updatedContinuityElements
  ) => {
    await database.syncContinuityElementsToDatabase(
      selectedProject,
      updatedContinuityElements
    );
  };

  const syncTodoItemsToDatabase = async (updatedTodoItems) => {
    syncLocks.current.todoItems = true;
    console.log("🔒 Todo items sync lock ENABLED");

    try {
      await database.syncTodoItemsToDatabase(selectedProject, updatedTodoItems);
    } finally {
      syncLocks.current.todoItems = false;
      console.log("🔓 Todo items sync lock RELEASED");
    }
  };

  const syncProjectSettingsToDatabase = async (updatedProjectSettings) => {
    await database.syncProjectSettingsToDatabase(
      selectedProject,
      updatedProjectSettings
    );
  };

  const syncCharactersToDatabase = async (updatedCharacters) => {
    syncLocks.current.characters = true;
    console.log("🔒 Characters sync lock ENABLED");

    await database.syncCharactersToDatabase(selectedProject, updatedCharacters);

    syncLocks.current.characters = false;
    console.log("🔓 Characters sync lock RELEASED");
  };

  const syncCharacterOverridesToDatabase = async (updatedOverrides) => {
    await database.syncCharacterOverridesToDatabase(
      selectedProject,
      updatedOverrides
    );
  };

  const syncWardrobeItemsToDatabase = async (updatedWardrobeItems) => {
    await database.syncWardrobeItemsToDatabase(
      selectedProject,
      updatedWardrobeItems
    );
  };

  const syncGarmentInventoryToDatabase = async (updatedGarmentInventory) => {
    // Enable sync lock
    syncLocks.current.garmentInventory = true;
    console.log("🔒 Garment inventory sync lock ENABLED");

    await database.syncGarmentInventoryToDatabase(
      selectedProject,
      updatedGarmentInventory
    );

    // Release sync lock immediately
    syncLocks.current.garmentInventory = false;
    console.log("🔓 Garment inventory sync lock RELEASED");
  };

  const syncCostCategoriesToDatabase = async (updatedCostCategories) => {
    await database.syncCostCategoriesToDatabase(
      selectedProject,
      updatedCostCategories
    );
  };

  const syncCostVendorsToDatabase = async (updatedCostVendors) => {
    await database.syncCostVendorsToDatabase(
      selectedProject,
      updatedCostVendors
    );
  };

  const syncTaggedItemsToDatabase = async (updatedTaggedItems) => {
    syncLocks.current.taggedItems = true;
    console.log("🔒 Tagged items sync lock ENABLED");

    await database.syncTaggedItemsToDatabase(
      selectedProject,
      updatedTaggedItems
    );

    syncLocks.current.taggedItems = false;
    console.log("🔓 Tagged items sync lock RELEASED");
  };

  const syncBudgetDataToDatabase = async (updatedBudgetData) => {
    syncLocks.current.budget = true;
    console.log("🔒 Budget sync lock ENABLED");

    try {
      await database.syncBudgetDataToDatabase(
        selectedProject,
        updatedBudgetData
      );
    } finally {
      syncLocks.current.budget = false;
      console.log("🔓 Budget sync lock RELEASED");
    }
  };

  const syncShotListDataToDatabase = async (
    updatedShotListData,
    updatedSceneNotes
  ) => {
    syncLocks.current.shotList = true;
    console.log("🔒 Shot list sync lock ENABLED");

    await database.syncShotListDataToDatabase(
      selectedProject,
      updatedShotListData,
      updatedSceneNotes
    );

    syncLocks.current.shotList = false;
    console.log("🔓 Shot list sync lock RELEASED");
  };

  const cleanupDuplicateShootingDays = async () => {
    await database.cleanupDuplicateShootingDays(selectedProject);
  };

  const debugShootingDaysState = () => {
    console.log("🔍 LOCAL SHOOTING DAYS STATE DEBUG:");
    console.log("Total shootingDays length:", shootingDays.length);
    console.log(
      "Shooting days by ID:",
      shootingDays.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        isLocked: day.isLocked,
        isShot: day.isShot,
      }))
    );

    // Group by day number to find local duplicates
    const dayGroups = {};
    shootingDays.forEach((day) => {
      if (!dayGroups[day.dayNumber]) {
        dayGroups[day.dayNumber] = [];
      }
      dayGroups[day.dayNumber].push(day);
    });

    console.log(
      "Days grouped by dayNumber:",
      Object.keys(dayGroups).map(
        (dayNum) => `Day ${dayNum}: ${dayGroups[dayNum].length} copies`
      )
    );

    // Find duplicates
    const duplicates = Object.entries(dayGroups).filter(
      ([dayNum, days]) => days.length > 1
    );
    if (duplicates.length > 0) {
      console.log("🚨 FOUND LOCAL DUPLICATES:");
      duplicates.forEach(([dayNum, days]) => {
        console.log(
          `Day ${dayNum} has ${days.length} copies with IDs:`,
          days.map((d) => d.id)
        );
      });
    }

    alert(
      `Local state has ${shootingDays.length} shooting days. Check console for details.`
    );
  };

  const auditAllDatabaseTables = async () => {
    await database.auditAllDatabaseTables(selectedProject);
  };

  const emergencyDatabaseCleanup = async () => {
    await database.emergencyDatabaseCleanup(selectedProject);
  };

  // Shooting days sync removed - will be implemented properly with existing database pattern

  const syncImportedDataToDatabase = async (projectData) => {
    await database.syncImportedDataToDatabase(selectedProject, projectData);
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeModule, setActiveModule] = React.useState("Dashboard");
  const [stripboardScenes, setStripboardScenes] = useState([]);
  const [scheduledScenes, setScheduledScenes] = useState({});
  React.useEffect(() => {
    console.log(
      "🔍 scheduledScenes type:",
      Array.isArray(scheduledScenes) ? "ARRAY (WRONG)" : "OBJECT (CORRECT)"
    );
    console.log("🔍 scheduledScenes keys:", Object.keys(scheduledScenes));
  }, [scheduledScenes]);
  const [scriptLocations, setScriptLocations] = useState([]);
  const [taggedItems, setTaggedItems] = useState({});
  const [showTagDropdown, setShowTagDropdown] = useState(null);
  const [actualLocations, setActualLocations] = useState([]);
  const [shootingDays, setShootingDays] = useState([
    {
      id: 1,
      date: new Date().toISOString().split("T")[0],
      dayNumber: 1,
      scheduleBlocks: [],
    },
  ]);
  const [castCrew, setCastCrew] = useState([]);
  const [doodCastEvents, setDoodCastEvents] = useState([]);
  const [doodOverrides, setDoodOverrides] = useState([]);
  const [doodSettings, setDoodSettings] = useState(null);
  const [crewSortOrder, setCrewSortOrder] = useState([
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
  ]);
  const [characters, setCharacters] = useState({});
  const [characterSceneOverrides, setCharacterSceneOverrides] = useState({});
  const [shotListData, setShotListData] = useState({});
  const [sceneNotes, setSceneNotes] = useState({});
  const [todoItems, setTodoItems] = useState([]);
  const [todoCategories, setTodoCategories] = useState([
    "Pre-Production",
    "Production",
    "Post-Production",
    "Art",
    "Stunts",
    "Locations",
    "Leads",
    "Office",
    "Rentals",
  ]);
  const [timelineData, setTimelineData] = useState({});
  const [continuityElements, setContinuityElements] = useState([]);
  const [budgetData, setBudgetData] = useState({
    projectInfo: {},
    atlItems: [],
    btlItems: [],
    weeklyReports: [],
    customCategories: [],
    totals: {
      atlTotal: 0,
      btlTotal: 0,
      grandTotal: 0,
      paidTotal: 0,
      unpaidTotal: 0,
    },
  });

  // Add this diagnostic useEffect right after state declarations
  React.useEffect(() => {
    console.log("📝 todoItems state changed:", todoItems);
    console.log("📝 todoItems length:", todoItems.length);
  }, [todoItems]);
  const [projectSettings, setProjectSettings] = useState({
    filmTitle: "",
    producer: "",
    director: "",
  });
  const [costCategories, setCostCategories] = useState([
    {
      id: "general",
      name: "General",
      color: "#2196F3",
      expenses: [],
      budget: 0,
    },
    {
      id: "meals",
      name: "Meals/Crafty",
      color: "#2E7D32",
      expenses: [],
      budget: 0,
    },
    {
      id: "equipment",
      name: "Equipment",
      color: "#FF9800",
      expenses: [],
      budget: 0,
    },
    {
      id: "wardrobe",
      name: "Wardrobe",
      color: "#9C27B0",
      expenses: [],
      budget: 0,
    },
    {
      id: "proddesign",
      name: "Production Design",
      color: "#F44336",
      expenses: [],
      budget: 0,
    },
    { id: "misc", name: "Misc", color: "#607D8B", expenses: [], budget: 0 },
  ]);
  const [costVendors, setCostVendors] = useState([
    "Cash",
    "Credit Card",
    "Check",
    "Venmo",
    "PayPal",
  ]);

  const [callSheetData, setCallSheetData] = React.useState({
    callTime: "7:30 AM",
    castCallTimes: {},
    customNotes: {},
    crewByDay: {}, // Object with dayId as key, crew data as value
    tableSizesByDay: {}, // Object with dayId as key, table sizes as value
    callTimeByDay: {},
    notesByDay: {},
    crewCallTimes: {},
    hiddenCastByDay: {},
  });

  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [garmentInventory, setGarmentInventory] = useState([]);
  const [garmentCategories, setGarmentCategories] = useState([
    "shirt",
    "pants",
    "dress",
    "skirt",
    "shoes",
    "coat/sweater",
    "socks/tights",
    "underwear",
    "misc",
  ]);

  // Global editing state tracker for real-time collaboration
  const [editingLocks, setEditingLocks] = useState({});
  // Structure: { 'tableName_recordId': { userId, timestamp, fieldName } }

  // Lock a record for editing
  const lockRecordForEditing = (tableName, recordId, fieldName = null) => {
    const lockKey = `${tableName}_${recordId}`;
    setEditingLocks((prev) => ({
      ...prev,
      [lockKey]: {
        userId: user?.id,
        timestamp: Date.now(),
        fieldName: fieldName,
      },
    }));
    console.log(`🔒 Locked ${tableName} record ${recordId} for editing`);
  };

  // Release edit lock after save completes
  const releaseEditLock = (tableName, recordId) => {
    const lockKey = `${tableName}_${recordId}`;
    setEditingLocks((prev) => {
      const updated = { ...prev };
      delete updated[lockKey];
      return updated;
    });
    console.log(`🔓 Released lock on ${tableName} record ${recordId}`);
  };

  // Check if a record is being edited locally
  const isRecordLocked = (tableName, recordId) => {
    const lockKey = `${tableName}_${recordId}`;
    const lock = editingLocks[lockKey];

    // Clean up stale locks (older than 30 seconds)
    if (lock && Date.now() - lock.timestamp > 30000) {
      releaseEditLock(tableName, recordId);
      return false;
    }

    return !!lock;
  };

  // Load jsPDF and html2pdf libraries dynamically
  React.useEffect(() => {
    if (!window.jspdf) {
      console.log("Loading jsPDF library...");
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.async = true;
      script.onload = () => {
        console.log("jsPDF library loaded successfully");
      };
      script.onerror = () => {
        console.error("Failed to load jsPDF library");
      };
      document.head.appendChild(script);
    }

    if (!window.html2pdf) {
      console.log("Loading html2pdf library...");
      const script2 = document.createElement("script");
      script2.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script2.async = true;
      script2.onload = () => {
        console.log("html2pdf library loaded successfully");
      };
      script2.onerror = () => {
        console.error("Failed to load html2pdf library");
      };
      document.head.appendChild(script2);
    }
  }, []);

  // updateScenesWithPageData function moved to utils.js

  const autoDetectCharacters = () => {
    const detectedCharacters = {};
    let characterOrder = 1;

    const cleanCharacterName = (rawName) => {
      let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
      cleaned = cleaned.replace(/[.,!?;:]$/, "");
      cleaned = cleaned.trim().toUpperCase();
      const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
      if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
        return null;
      }
      return cleaned;
    };

    // PASS 1: Scan ALL dialogue blocks in script order
    scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const characterName = cleanCharacterName(block.text);
          if (characterName) {
            if (!detectedCharacters[characterName]) {
              detectedCharacters[characterName] = {
                name: characterName,
                scenes: [],
                chronologicalNumber: characterOrder++,
              };
            }
            if (
              !detectedCharacters[characterName].scenes.includes(
                scene.sceneNumber
              )
            ) {
              detectedCharacters[characterName].scenes.push(scene.sceneNumber);
            }
          }
        }
      });
    });

    // PASS 2: Scan action lines for character mentions
    scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((characterName) => {
            const regex = new RegExp(`\\b${characterName}\\b`, "i");
            if (regex.test(block.text)) {
              if (
                !detectedCharacters[characterName].scenes.includes(
                  scene.sceneNumber
                )
              ) {
                detectedCharacters[characterName].scenes.push(
                  scene.sceneNumber
                );
              }
            }
          });
        }
      });
    });

    setCharacters(detectedCharacters);
    console.log("Characters detected:", detectedCharacters);
  };

  const getFinalCharacterScenes = (characterName) => {
    const autoDetectedScenes = characters[characterName]?.scenes || [];
    const overrides = characterSceneOverrides[characterName] || {};

    let finalScenes = [...autoDetectedScenes];

    // Apply removals
    if (overrides.removedScenes) {
      finalScenes = finalScenes.filter(
        (scene) => !overrides.removedScenes.includes(scene)
      );
    }

    // Apply additions
    if (overrides.addedScenes) {
      overrides.addedScenes.forEach((scene) => {
        if (!finalScenes.includes(scene)) {
          finalScenes.push(scene);
        }
      });
    }

    return finalScenes.sort((a, b) => a - b);
  };

  // No auto-saving for shooting days - sync only on specific actions

  const tagCategories = [
    { name: "Props", color: "#FF6B6B" },
    { name: "Production Design", color: "#4ECDC4" },
    { name: "Makeup", color: "#FF9F43" },
    { name: "Locations", color: "#45B7D1" },
    { name: "Vehicles", color: "#96CEB4" },
    { name: "Wardrobe", color: "#FFEAA7" },
    { name: "Cast", color: "#DDA0DD" },
    { name: "Animals", color: "#98D8C8" },
    { name: "Special Effects", color: "#F7DC6F" },
    { name: "Stunts", color: "#BB8FCE" },
    { name: "Extras", color: "#85C1E9" },
  ];

  const untagWordInstance = (word, sceneIndex, blockIndex, wordIndex) => {
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;

    if (taggedItems[cleanWord]) {
      const currentItem = taggedItems[cleanWord];
      const updatedInstances = currentItem.instances.filter(
        (id) => id !== instanceId
      );

      setTaggedItems((prev) => {
        const newTaggedItems = { ...prev };

        if (updatedInstances.length === 0) {
          // If no instances left, remove the entire word
          delete newTaggedItems[cleanWord];
        } else {
          // Update with remaining instances
          newTaggedItems[cleanWord] = {
            ...currentItem,
            instances: updatedInstances,
          };
        }

        return newTaggedItems;
      });
    }
    setShowTagDropdown(null);
  };

  const getWordPosition = (word) => {
    // Find the position of this word in the entire script
    let position = 0;
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex];
      for (
        let blockIndex = 0;
        blockIndex < scene.content.length;
        blockIndex++
      ) {
        const block = scene.content[blockIndex];
        const words = block.text.split(/(\s+)/).filter((w) => w.trim() !== "");
        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const currentWord = words[wordIndex]
            .toLowerCase()
            .replace(/[^\w]/g, "");
          if (currentWord === word.toLowerCase().replace(/[^\w]/g, "")) {
            return position;
          }
          if (currentWord !== "") {
            position++;
          }
        }
      }
    }
    return position;
  };

  const findAllWordInstances = (targetWord) => {
    const cleanTargetWord = stemWord(
      targetWord.toLowerCase().replace(/[^\w]/g, "")
    );
    const instances = [];
    const foundScenes = [];

    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex];
      let sceneHasWord = false;

      for (
        let blockIndex = 0;
        blockIndex < scene.content.length;
        blockIndex++
      ) {
        const block = scene.content[blockIndex];
        const words = block.text.split(/(\s+)/);

        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const word = words[wordIndex];
          if (word.trim() === "") continue; // Skip whitespace

          const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
          if (cleanWord === cleanTargetWord) {
            const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
            instances.push(instanceId);
            if (!sceneHasWord) {
              foundScenes.push(scene.sceneNumber);
              sceneHasWord = true;
            }
          }
        }
      }
    }

    return { instances, scenes: foundScenes };
  };

  const stemWord = (word) => {
    // Simple English stemming rules for common plurals and variations
    const stemmingRules = [
      // Irregular plurals (handle these first)
      { pattern: /^children$/, stem: "child" },
      { pattern: /^people$/, stem: "person" },
      { pattern: /^men$/, stem: "man" },
      { pattern: /^women$/, stem: "woman" },
      { pattern: /^feet$/, stem: "foot" },
      { pattern: /^teeth$/, stem: "tooth" },
      { pattern: /^geese$/, stem: "goose" },
      { pattern: /^mice$/, stem: "mouse" },

      // -ies endings (ladies -> lady, stories -> story)
      { pattern: /ies$/, stem: (word) => word.slice(0, -3) + "y" },

      // -ves endings (knives -> knife, wolves -> wolf)
      { pattern: /ves$/, stem: (word) => word.slice(0, -3) + "f" },

      // -es endings (boxes -> box, glasses -> glass)
      { pattern: /(s|x|z|ch|sh)es$/, stem: (word) => word.slice(0, -2) },

      // Regular -s plurals (cars -> car, dogs -> dog)
      { pattern: /s$/, stem: (word) => word.slice(0, -1) },

      // -ing endings (running -> run, walking -> walk)
      {
        pattern: /ing$/,
        stem: (word) => {
          const base = word.slice(0, -3);
          // Handle doubled consonants (running -> run, not runn)
          if (
            base.length >= 2 &&
            base[base.length - 1] === base[base.length - 2]
          ) {
            return base.slice(0, -1);
          }
          return base;
        },
      },

      // -ed endings (walked -> walk, moved -> move)
      {
        pattern: /ed$/,
        stem: (word) => {
          const base = word.slice(0, -2);
          // Handle doubled consonants (stopped -> stop, not stopp)
          if (
            base.length >= 2 &&
            base[base.length - 1] === base[base.length - 2]
          ) {
            return base.slice(0, -1);
          }
          return base;
        },
      },
    ];

    // Apply stemming rules in order
    for (const rule of stemmingRules) {
      if (typeof rule.stem === "string") {
        // Direct replacement for irregular words
        if (rule.pattern.test(word)) {
          return rule.stem;
        }
      } else {
        // Function-based stemming
        if (rule.pattern.test(word)) {
          return rule.stem(word);
        }
      }
    }

    // If no rules match, return the original word
    return word;
  };

  const calculateCategoryNumbers = (taggedItems) => {
    console.log(
      "🔧 Starting category number calculation for",
      Object.keys(taggedItems).length,
      "items"
    );

    const categoryCounts = {};
    const updatedItems = {};

    // Sort all items by chronological order to maintain creation sequence
    const sortedEntries = Object.entries(taggedItems).sort(
      (a, b) =>
        (a[1].chronologicalNumber || 999) - (b[1].chronologicalNumber || 999)
    );

    console.log("🔧 Sorted entries count:", sortedEntries.length);

    sortedEntries.forEach(([word, item]) => {
      const category = item.category || "Uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      updatedItems[word] = {
        ...item,
        categoryNumber: categoryCounts[category],
      };

      // Debug first few items
      if (categoryCounts[category] <= 3) {
        console.log(
          `🔧 ${category} #${categoryCounts[category]}: ${word} (was #${item.chronologicalNumber})`
        );
      }
    });

    console.log("🔧 Final category counts:", categoryCounts);
    console.log("🔧 Updated items count:", Object.keys(updatedItems).length);

    return updatedItems;
  };

  const tagWord = (word, category) => {
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const categoryData = tagCategories.find((cat) => cat.name === category);

    if (!taggedItems[cleanWord]) {
      const wordPosition = getWordPosition(word);

      // Find all instances of this word
      const { instances, scenes: foundScenes } = findAllWordInstances(word);

      console.log(`Found instances for "${cleanWord}":`, instances);

      // Calculate new chronological number based on position
      const existingItems = Object.entries(taggedItems);
      let chronologicalNumber = 1;

      for (const [existingWord, existingItem] of existingItems) {
        const existingPosition = getWordPosition(existingItem.displayName);
        if (existingPosition < wordPosition) {
          chronologicalNumber++;
        }
      }

      // Create new tagged item with all instances
      const newItem = {
        displayName: word,
        category: category,
        color: categoryData.color,
        chronologicalNumber: chronologicalNumber,
        position: wordPosition,
        scenes: foundScenes,
        instances: instances,
      };

      // Update existing items that come after this position
      const updatedItems = { ...taggedItems };
      for (const [existingWord, existingItem] of Object.entries(updatedItems)) {
        const existingPosition = getWordPosition(existingItem.displayName);
        if (existingPosition > wordPosition) {
          updatedItems[existingWord] = {
            ...existingItem,
            chronologicalNumber: existingItem.chronologicalNumber + 1,
          };
        }
      }

      // Add new item
      updatedItems[cleanWord] = newItem;

      // Calculate category numbers for all items
      const itemsWithCategoryNumbers = calculateCategoryNumbers(updatedItems);
      setTaggedItems(itemsWithCategoryNumbers);
    }

    setShowTagDropdown(null);
  };

  const isWordInstanceTagged = (
    cleanWord,
    sceneIndex,
    blockIndex,
    wordIndex
  ) => {
    const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
    return (
      taggedItems[cleanWord] &&
      taggedItems[cleanWord].instances.includes(instanceId)
    );
  };

  // parseSceneHeading and extractLocations functions moved to utils.js

  const scheduleScene = (sceneIndex, date, time = null) => {
    const updatedStripboard = [...stripboardScenes];
    const scene = updatedStripboard[sceneIndex];
    updatedStripboard[sceneIndex].scheduledDate = date;
    updatedStripboard[sceneIndex].scheduledTime = time;

    // Only change status to "Scheduled" if it's currently "Not Scheduled"
    // Preserve "Pickups" and "Reshoot" statuses
    const newStatus =
      scene.status === "Not Scheduled" ? "Scheduled" : scene.status;
    updatedStripboard[sceneIndex].status = newStatus;

    setStripboardScenes(updatedStripboard);

    // ATOMIC: Update only this scene's schedule
    database
      .updateStripboardSceneSchedule(
        selectedProject,
        scene.sceneNumber.toString(),
        newStatus,
        date,
        time
      )
      .catch((error) => {
        console.error("❌ Atomic scene schedule update failed:", error);
      });

    // Also update main scenes status
    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex(
      (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
    );
    if (mainSceneIndex !== -1) {
      updatedMainScenes[mainSceneIndex].status = newStatus;
      setScenes(updatedMainScenes);

      database
        .updateSceneStatus(
          selectedProject,
          scene.sceneNumber.toString(),
          newStatus
        )
        .catch((error) => {
          console.error("❌ Atomic main scene status update failed:", error);
        });
    }

    const newScheduled = { ...scheduledScenes };

    // Remove scene from ALL dates first (prevents duplicates)
    Object.keys(newScheduled).forEach((existingDate) => {
      newScheduled[existingDate] = newScheduled[existingDate].filter(
        (s) => s.sceneNumber !== scene.sceneNumber
      );
      if (newScheduled[existingDate].length === 0) {
        delete newScheduled[existingDate];
      }
    });

    // Add scene to new date
    if (!newScheduled[date]) {
      newScheduled[date] = [];
    }
    newScheduled[date].push(updatedStripboard[sceneIndex]);

    setScheduledScenes(newScheduled);

    // Sync to database
    syncScheduledScenesToDatabase(newScheduled);
  };

  const unscheduleScene = (sceneIndex) => {
    // Check if sceneIndex is valid
    if (sceneIndex === -1 || !stripboardScenes[sceneIndex]) {
      console.warn("Scene not found for unscheduling");
      return;
    }

    const updatedStripboard = [...stripboardScenes];
    const scene = updatedStripboard[sceneIndex];
    const preservedStatus = scene.status; // Capture current status

    updatedStripboard[sceneIndex].scheduledDate = null;
    updatedStripboard[sceneIndex].scheduledTime = null;

    // Only reset status to "Not Scheduled" if it was "Scheduled"
    // Preserve "Pickups" and "Reshoot" statuses
    if (updatedStripboard[sceneIndex].status === "Scheduled") {
      updatedStripboard[sceneIndex].status = "Not Scheduled";
    }

    setStripboardScenes(updatedStripboard);

    // Use atomic update instead of full sync - this preserves status correctly
    database.updateStripboardSceneSchedule(
      selectedProject,
      scene.sceneNumber.toString(),
      updatedStripboard[sceneIndex].status, // Use the preserved/updated status
      null, // Clear date
      null // Clear time
    );

    const newScheduled = { ...scheduledScenes };
    Object.keys(newScheduled).forEach((date) => {
      newScheduled[date] = newScheduled[date].filter(
        (scene) =>
          scene.sceneNumber !== updatedStripboard[sceneIndex].sceneNumber
      );
      if (newScheduled[date].length === 0) {
        delete newScheduled[date];
      }
    });

    setScheduledScenes(newScheduled);

    // Sync to database
    syncScheduledScenesToDatabase(newScheduled);
  };

  const summarizeScenesWithAI = async (scenesToSummarize) => {
    setIsSummarizing(true);
    setSummarizeProgress({ current: 0, total: scenesToSummarize.length });
    console.log(
      "🎬 Starting AI summarization for",
      scenesToSummarize.length,
      "scenes"
    );

    // Give React time to render the progress toast before starting
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedScenes = scenesToSummarize.map((s) => ({ ...s }));

    for (let i = 0; i < scenesToSummarize.length; i++) {
      const scene = scenesToSummarize[i];
      setSummarizeProgress({ current: i + 1, total: scenesToSummarize.length });

      try {
        const sceneText = (scene.content || [])
          .map((block) => block.text || "")
          .join("\n")
          .trim();

        if (!sceneText) continue;

        const response = await fetch("/.netlify/functions/summarize-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heading: scene.heading,
            content: sceneText,
          }),
        });

        const data = await response.json();
        const summary = (data.summary || "").replace(/^#+\s.*\n*/gm, "").trim();

        if (summary) {
          updatedScenes[i] = { ...updatedScenes[i], description: summary };

          // Update state incrementally so descriptions appear live
          setScenes((prev) =>
            prev.map((s) =>
              s.sceneNumber === scene.sceneNumber
                ? { ...s, description: summary }
                : s
            )
          );
        }
      } catch (err) {
        console.error(
          `❌ Failed to summarize scene ${scene.sceneNumber}:`,
          err
        );
      }
    }

    // Final save to database with all descriptions
    // Keep sync lock active during the entire save + reload cycle
    syncLocks.current.scenes = true;
    console.log("🔒 Summarization: Scenes sync lock ENABLED for final save");

    await database.saveScenesDatabase(
      selectedProject,
      updatedScenes,
      scenesLoaded,
      false,
      setIsSavingScenes
    );

    console.log("✅ Descriptions saved — reloading scenes from database");

    // Force reload scenes from DB so UI reflects saved descriptions
    await database.loadScenesFromDatabase(
      selectedProject,
      setScenes,
      setScenesLoaded,
      (loadedScenes) => {
        database.loadStripboardScenesAfterScenes(
          selectedProject,
          loadedScenes,
          setStripboardScenes
        );
      }
    );

    syncLocks.current.scenes = false;
    console.log("🔓 Summarization: Scenes sync lock RELEASED");

    setIsSummarizing(false);
    setSummarizeProgress({ current: 0, total: 0 });
    console.log("✅ AI scene summarization complete — descriptions loaded");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const paragraphs = Array.from(xmlDoc.getElementsByTagName("Paragraph"));

        const parsedScenes = [];
        let currentScene = null;
        let sceneNumber = 1;

        paragraphs.forEach((para) => {
          const type = para.getAttribute("Type");
          let content = para.textContent.trim();

          if (!content) return;

          // Debug: Log ALL paragraph types to find title page
          console.log(
            "Paragraph type:",
            type,
            "| Content:",
            content.substring(0, 40)
          );

          // Filter out title page elements (including null types)
          const titlePageTypes = [
            "Title",
            "Credit",
            "Author",
            "Contact",
            "Copyright",
            "Draft date",
            "More Title",
            null, // Add null to catch title page elements with no type
          ];
          if (titlePageTypes.includes(type)) {
            console.log("🚫 FILTERED OUT:", type, content.substring(0, 40));
            return; // Skip title page elements
          }

          const formatting = {};
          const textElements = para.getElementsByTagName("Text");
          if (textElements.length > 0) {
            const textElement = textElements[0];
            if (textElement.getAttribute("Style")) {
              const style = textElement.getAttribute("Style");
              formatting.bold = style.includes("Bold");
              formatting.italic = style.includes("Italic");
              formatting.underline = style.includes("Underline");
            }
          }

          if (type === "Scene Heading") {
            if (currentScene) {
              currentScene.sceneNumber = sceneNumber++;
              parsedScenes.push(currentScene);
            }

            const headingText = content.toUpperCase();
            const metadata = parseSceneHeading(headingText);
            currentScene = {
              heading: headingText,
              content: [],
              metadata: metadata,
              sceneNumber: sceneNumber,
              estimatedDuration: "30 min",
              status: "Not Scheduled",
            };
          } else if (currentScene) {
            // Don't add null-type paragraphs to scene content (title page elements)
            if (type === null) {
              console.log(
                "🚫 SKIPPING null-type content:",
                content.substring(0, 40)
              );
              return;
            }

            if (type === "Character") {
              content = content.toUpperCase();
            }

            currentScene.content.push({
              type,
              text: content,
              formatting:
                Object.keys(formatting).length > 0 ? formatting : null,
            });
          }
        });

        if (currentScene) {
          currentScene.sceneNumber = sceneNumber;
          parsedScenes.push(currentScene);
        }

        // Calculate page data for all scenes
        const scenesWithPageData = parsedScenes.map((scene, index) => {
          try {
            const sceneStats = calculateScenePageStats(
              index,
              parsedScenes,
              107
            );
            return {
              ...scene,
              pageNumber: sceneStats.startPage,
              pageLength: sceneStats.pageLength,
            };
          } catch (error) {
            console.warn(
              `Error calculating page stats for scene ${index}:`,
              error
            );
            return {
              ...scene,
              pageNumber: 1,
              pageLength: "1/8",
            };
          }
        });

        setScenes(scenesWithPageData);
        setStripboardScenes([...scenesWithPageData]); // Initial setup with page data
        saveScenesDatabase(scenesWithPageData);

        const detectedLocations = extractLocationsHierarchical(parsedScenes);
        setScriptLocations(detectedLocations);
        syncScriptLocationsToDatabase(detectedLocations);
        console.log(
          `Auto-detected ${detectedLocations.length} locations on script upload`
        );

        // Auto-detect characters after loading scenes
        const detectedCharacters = {};
        let characterOrder = 1;

        const cleanCharacterName = (rawName) => {
          let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
          cleaned = cleaned.replace(/[.,!?;:]$/, "");
          cleaned = cleaned.trim().toUpperCase();
          const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
          if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
            return null;
          }
          return cleaned;
        };

        // PASS 1: Scan dialogue blocks
        parsedScenes.forEach((scene) => {
          scene.content.forEach((block) => {
            if (block.type === "Character") {
              const characterName = cleanCharacterName(block.text);
              if (characterName) {
                if (!detectedCharacters[characterName]) {
                  detectedCharacters[characterName] = {
                    name: characterName,
                    scenes: [],
                    chronologicalNumber: characterOrder++,
                  };
                }
                if (
                  !detectedCharacters[characterName].scenes.includes(
                    scene.sceneNumber
                  )
                ) {
                  detectedCharacters[characterName].scenes.push(
                    scene.sceneNumber
                  );
                }
              }
            }
          });
        });

        // PASS 2: Scan action lines
        parsedScenes.forEach((scene) => {
          scene.content.forEach((block) => {
            if (block.type === "Action") {
              Object.keys(detectedCharacters).forEach((characterName) => {
                const regex = new RegExp(`\\b${characterName}\\b`, "i");
                if (regex.test(block.text)) {
                  if (
                    !detectedCharacters[characterName].scenes.includes(
                      scene.sceneNumber
                    )
                  ) {
                    detectedCharacters[characterName].scenes.push(
                      scene.sceneNumber
                    );
                  }
                }
              });
            }
          });
        });

        setCharacters(detectedCharacters);
        syncCharactersToDatabase(detectedCharacters);
        console.log(
          `Auto-detected ${
            Object.keys(detectedCharacters).length
          } characters on script upload`
        );

        setCurrentIndex(0);

        // Offer AI summarization
        const confirmed = window.confirm(
          `Script imported successfully — ${
            scenesWithPageData.length
          } scenes loaded.\n\nWould you like Claude to automatically summarize each scene and populate the description column?\n\nThis runs in the background and takes about ${Math.ceil(
            (scenesWithPageData.length * 1.5) / 60
          )} minute(s). You can keep using the app while it runs.`
        );
        if (confirmed) {
          setTimeout(() => {
            summarizeScenesWithAI(scenesWithPageData);
          }, 50);
        }
      } catch (err) {
        alert("Failed to parse .fdx file. Please check the file format.");
      }
    };

    reader.readAsText(file);
  };

  const handleSingleSceneUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const paragraphs = Array.from(xmlDoc.getElementsByTagName("Paragraph"));

        const parsedScenes = [];
        let currentScene = null;

        paragraphs.forEach((para) => {
          const type = para.getAttribute("Type");
          let content = para.textContent.trim();

          if (!content) return;

          // Debug: Log ALL paragraph types to find title page
          console.log(
            "Paragraph type:",
            type,
            "| Content:",
            content.substring(0, 40)
          );

          // Filter out title page elements (including null types)
          const titlePageTypes = [
            "Title",
            "Credit",
            "Author",
            "Contact",
            "Copyright",
            "Draft date",
            "More Title",
            null, // Add null to catch title page elements with no type
          ];
          if (titlePageTypes.includes(type)) {
            console.log("🚫 FILTERED OUT:", type, content.substring(0, 40));
            return; // Skip title page elements
          }

          const formatting = {};
          const textElements = para.getElementsByTagName("Text");
          if (textElements.length > 0) {
            const textElement = textElements[0];
            if (textElement.getAttribute("Style")) {
              const style = textElement.getAttribute("Style");
              formatting.bold = style.includes("Bold");
              formatting.italic = style.includes("Italic");
              formatting.underline = style.includes("Underline");
            }
          }

          if (type === "Scene Heading") {
            if (currentScene) {
              parsedScenes.push(currentScene);
            }

            const headingText = content.toUpperCase();
            const metadata = parseSceneHeading(headingText);
            currentScene = {
              heading: headingText,
              content: [],
              metadata: metadata,
              sceneNumber: scenes[currentIndex].sceneNumber, // Keep original scene number
              estimatedDuration: "30 min",
              status: "Not Scheduled",
            };
          } else if (currentScene) {
            // Don't add null-type paragraphs to scene content (title page elements)
            if (type === null) {
              console.log(
                "🚫 SKIPPING null-type content:",
                content.substring(0, 40)
              );
              return;
            }

            if (type === "Character") {
              content = content.toUpperCase();
            }

            currentScene.content.push({
              type,
              text: content,
              formatting:
                Object.keys(formatting).length > 0 ? formatting : null,
            });
          }
        });

        if (currentScene) {
          parsedScenes.push(currentScene);
        }

        if (parsedScenes.length === 1) {
          // Replace current scene with uploaded scene
          const newScene = parsedScenes[0];

          // Preserve original scene metadata
          const originalScene = scenes[currentIndex];
          newScene.sceneNumber = originalScene.sceneNumber;
          newScene.status = originalScene.status;
          newScene.pageNumber = originalScene.pageNumber;
          newScene.pageLength = originalScene.pageLength;

          // Update scenes array
          const updatedScenes = [...scenes];
          updatedScenes[currentIndex] = newScene;
          setScenes(updatedScenes);

          // Update stripboard scenes
          const updatedStripboard = [...stripboardScenes];
          updatedStripboard[currentIndex] = {
            ...updatedStripboard[currentIndex],
            ...newScene,
          };
          setStripboardScenes(updatedStripboard);

          // Recalculate page data for the replaced scene
          const updatedScenesWithPageData = updatedScenes.map(
            (scene, index) => {
              if (index === currentIndex) {
                try {
                  const sceneStats = calculateScenePageStats(
                    index,
                    updatedScenes,
                    107
                  );
                  return {
                    ...scene,
                    pageNumber: sceneStats.startPage,
                    pageLength: sceneStats.pageLength,
                  };
                } catch (error) {
                  return scene;
                }
              }
              return scene;
            }
          );

          setScenes(updatedScenesWithPageData);

          console.log(
            "Original scene content blocks:",
            originalScene.content.length
          );
          console.log("New scene content blocks:", newScene.content.length);
          console.log(
            "Scene replacement completed for scene:",
            newScene.sceneNumber
          );
          alert(
            `Scene ${newScene.sceneNumber} replaced successfully!\nOriginal: ${originalScene.content.length} blocks\nNew: ${newScene.content.length} blocks`
          );
        } else {
          alert("Error: The uploaded file must contain exactly one scene.");
        }
      } catch (err) {
        alert("Failed to parse .fdx file. Please check the file format.");
      }
    };

    reader.readAsText(file);
  };

  const autoDetectCharactersFromScenes = (scenesToProcess) => {
    const detectedCharacters = {};
    let characterOrder = 1;

    // Clean character name function
    const cleanCharacterName = (rawName) => {
      let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
      cleaned = cleaned.replace(/[.,!?;:]$/, "");
      cleaned = cleaned.trim().toUpperCase();

      const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
      if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
        return null;
      }
      return cleaned;
    };

    // PASS 1: Scan ALL dialogue blocks in script order
    scenesToProcess.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const characterName = cleanCharacterName(block.text);

          if (characterName) {
            if (!detectedCharacters[characterName]) {
              detectedCharacters[characterName] = {
                name: characterName,
                scenes: [],
                chronologicalNumber: characterOrder++,
              };
            }

            if (
              !detectedCharacters[characterName].scenes.includes(
                scene.sceneNumber
              )
            ) {
              detectedCharacters[characterName].scenes.push(scene.sceneNumber);
            }
          }
        }
      });
    });

    // PASS 2: Scan action lines for character mentions
    scenesToProcess.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((characterName) => {
            const regex = new RegExp(`\\b${characterName}\\b`, "i");
            if (regex.test(block.text)) {
              if (
                !detectedCharacters[characterName].scenes.includes(
                  scene.sceneNumber
                )
              ) {
                detectedCharacters[characterName].scenes.push(
                  scene.sceneNumber
                );
              }
            }
          });
        }
      });
    });

    setCharacters(detectedCharacters);
    console.log("Characters auto-detected:", detectedCharacters);
  };

  // ADD THESE FUNCTIONS RIGHT HERE (after line 2615):
  const exportProject = () => {
    const appData = {
      scenes,
      taggedItems,
      stripboardScenes,
      scheduledScenes,
      shootingDays,
      scriptLocations,
      actualLocations,
      currentIndex,
      castCrew,
      characters,
      shotListData,
      sceneNotes,
      projectSettings,
      costCategories,
      costVendors,
      callSheetData,
      wardrobeItems,
      garmentInventory,
      garmentCategories,
      todoItems,
      todoCategories,
      timelineData,
      continuityElements,
      budgetData,
      exportInfo: {
        exportDate: new Date().toISOString(),
        version: "1.0",
        appName: "Film Production Binder",
      },
    };

    // Generate timestamp filename (e.g., "sep-7-25-850pm")
    const now = new Date();
    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // 12 hour format

    const timestamp = `${month}-${day}-${year}-${hours}${minutes}${ampm}`;
    const filename = `film-project-${timestamp}.json`;

    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a download link with the timestamped filename
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // For modern browsers, this should trigger the save dialog
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    // Show confirmation with the filename
    alert(`Project exported as: ${filename}`);
  };

  const importProject = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const projectData = JSON.parse(e.target.result);

        // Validate the data structure
        if (
          !projectData.exportInfo ||
          projectData.exportInfo.appName !== "Film Production Binder"
        ) {
          alert("Invalid project file format");
          return;
        }

        // Restore all state
        if (projectData.scenes) {
          setScenes(projectData.scenes);
        }

        // Restore stripboard scenes with their status data
        if (projectData.stripboardScenes) {
          console.log(
            "📋 Stripboard scene statuses in import:",
            projectData.stripboardScenes
              .slice(0, 5)
              .map((s) => `Scene ${s.sceneNumber}: ${s.status}`)
          );
          // Use stripboard scenes directly - they contain the correct status information
          setStripboardScenes(projectData.stripboardScenes);
          console.log(
            "✅ Restored stripboard scenes with statuses:",
            projectData.stripboardScenes
              .filter((s) => s.status !== "Not Scheduled")
              .slice(0, 5)
              .map((s) => `Scene ${s.sceneNumber}: ${s.status}`)
          );
        } else if (projectData.scenes) {
          // Fallback: create stripboard scenes from main scenes if no stripboard data exists
          setStripboardScenes([...projectData.scenes]);
          console.log(
            "⚠️ No stripboard scenes found, using main scenes as fallback"
          );
        }
        if (projectData.taggedItems) setTaggedItems(projectData.taggedItems);
        if (projectData.scheduledScenes)
          setScheduledScenes(projectData.scheduledScenes);
        if (projectData.shootingDays) setShootingDays(projectData.shootingDays);
        if (projectData.scriptLocations)
          setScriptLocations(projectData.scriptLocations);
        if (projectData.castCrew) setCastCrew(projectData.castCrew);
        if (projectData.currentIndex !== undefined)
          setCurrentIndex(projectData.currentIndex);
        if (projectData.actualLocations)
          setActualLocations(projectData.actualLocations);
        if (projectData.characters) setCharacters(projectData.characters);
        if (projectData.shotListData) setShotListData(projectData.shotListData);
        if (projectData.sceneNotes) setSceneNotes(projectData.sceneNotes);
        if (projectData.projectSettings)
          setProjectSettings(projectData.projectSettings);
        if (projectData.costCategories)
          setCostCategories(projectData.costCategories);
        if (projectData.costVendors) setCostVendors(projectData.costVendors);
        if (projectData.wardrobeItems)
          setWardrobeItems(projectData.wardrobeItems);
        if (projectData.garmentInventory)
          setGarmentInventory(projectData.garmentInventory);
        if (projectData.garmentCategories)
          setGarmentCategories(projectData.garmentCategories);
        if (projectData.todoItems) setTodoItems(projectData.todoItems);
        if (projectData.todoCategories)
          setTodoCategories(projectData.todoCategories);
        if (projectData.timelineData) setTimelineData(projectData.timelineData);
        if (projectData.continuityElements)
          setContinuityElements(projectData.continuityElements);
        if (projectData.budgetData) setBudgetData(projectData.budgetData);
        if (projectData.callSheetData)
          setCallSheetData(projectData.callSheetData);

        // Sync imported data to database
        try {
          console.log("🔄 Starting database sync for imported data...");
          await database.syncImportedDataToDatabase(
            selectedProject,
            projectData
          );
          console.log("✅ Database sync completed successfully");
        } catch (syncError) {
          console.error("❌ Database sync failed:", syncError);
          alert(
            `Import completed but database sync failed: ${syncError.message}`
          );
          return;
        }

        alert(
          `Project imported successfully!\nExported: ${new Date(
            projectData.exportInfo.exportDate
          ).toLocaleDateString()}\nData synced to cloud database.`
        );
      } catch (error) {
        alert("Failed to import project file. Please check the file format.");
        console.error("Import error:", error);
      }
    };

    reader.readAsText(file);

    // Clear the input so the same file can be imported again
    event.target.value = "";
  };

  const repairScheduledScenesFromStripboard = async () => {
    if (!selectedProject || !stripboardScenes.length || !shootingDays.length) {
      alert("Data not loaded yet. Please wait and try again.");
      return;
    }

    try {
      console.log(
        "REPAIRING: Clearing and rebuilding scheduled_scenes from actual schedule data..."
      );

      // Step 1: Clear existing scheduled_scenes data completely
      await supabase
        .from("scheduled_scenes")
        .delete()
        .eq("project_id", selectedProject.id);

      console.log("REPAIRING: Cleared existing scheduled scenes data");

      // Step 2: Only use scenes that have EXPLICIT scheduledDate
      const scheduledScenesMap = {};

      stripboardScenes.forEach((scene) => {
        // Only include scenes with explicit scheduled dates that exist in shooting days
        if (
          scene.scheduledDate &&
          shootingDays.some((day) => day.date === scene.scheduledDate)
        ) {
          if (!scheduledScenesMap[scene.scheduledDate]) {
            scheduledScenesMap[scene.scheduledDate] = [];
          }
          scheduledScenesMap[scene.scheduledDate].push(scene.sceneNumber);
          console.log(
            `REPAIRING: Scene ${scene.sceneNumber} scheduled for ${scene.scheduledDate}`
          );
        }
      });

      console.log(
        "REPAIRING: Found explicit scheduled scenes for",
        Object.keys(scheduledScenesMap).length,
        "dates"
      );

      console.log("REPAIR: Found scheduled scenes map:", scheduledScenesMap);

      if (Object.keys(scheduledScenesMap).length > 0) {
        // Clear existing scheduled_scenes data
        await supabase
          .from("scheduled_scenes")
          .delete()
          .eq("project_id", selectedProject.id);

        // Insert rebuilt data
        const scheduledScenesData = Object.entries(scheduledScenesMap).map(
          ([date, scenes]) => ({
            project_id: selectedProject.id,
            shoot_date: date,
            scenes: scenes || [],
          })
        );

        const { error } = await supabase
          .from("scheduled_scenes")
          .insert(scheduledScenesData);

        if (error) throw error;

        // Update local state
        setScheduledScenes(scheduledScenesMap);

        console.log(
          `REPAIR COMPLETED: Rebuilt ${scheduledScenesData.length} scheduled scene mappings`
        );
        alert(
          `Repair completed! Found ${scheduledScenesData.length} scheduled shooting days. Check Reports module now.`
        );
      } else {
        console.log("REPAIR: No scheduled scenes with dates found");
        alert(
          "No scheduled scenes with dates found. Your scenes may need to be re-scheduled in StripboardSchedule module."
        );
      }
    } catch (error) {
      console.error("REPAIR ERROR:", error);
      alert(`Repair failed: ${error.message}`);
    }
  };

  const handleSceneNumberChange = (sceneIndex, newSceneNumber) => {
    const updatedScenes = [...scenes];
    const oldSceneNumber = updatedScenes[sceneIndex].sceneNumber;

    // Parse scene numbers to understand the change
    const parseSceneNumber = (sceneNum) => {
      const sceneStr = String(sceneNum);
      const match = sceneStr.match(/^(\d+)([A-Z]*)$/);
      return match
        ? { base: parseInt(match[1]), suffix: match[2] || "" }
        : { base: parseInt(sceneStr) || 999, suffix: "" };
    };

    const oldParsed = parseSceneNumber(oldSceneNumber);
    const newParsed = parseSceneNumber(newSceneNumber);

    // Update the selected scene's number
    updatedScenes[sceneIndex].sceneNumber = newSceneNumber;

    // If we're inserting a scene (like 30 becomes 29A), renumber subsequent scenes
    if (newParsed.base < oldParsed.base) {
      // Renumber scenes after the current one
      for (let i = sceneIndex + 1; i < updatedScenes.length; i++) {
        const currentParsed = parseSceneNumber(updatedScenes[i].sceneNumber);

        // Only renumber scenes with numeric-only numbers (no suffix)
        if (
          currentParsed.suffix === "" &&
          currentParsed.base >= newParsed.base
        ) {
          const newNumber = currentParsed.base - 1;
          if (newNumber > 0) {
            updatedScenes[i].sceneNumber = newNumber.toString();
          }
        }
      }
    }

    // Update the scenes state with recalculated page data
    const scenesWithPageData = updateScenesWithPageData(updatedScenes);
    setScenes(scenesWithPageData);
    setStripboardScenes([...scenesWithPageData]); //Keep stripboard in sync with page data

    // Cross-module references commented out for now
    // updateCrossModuleReferences(oldSceneNumber, newSceneNumber);
  };

  const updateCrossModuleReferences = (oldSceneNumber, newSceneNumber) => {
    // Update tagged items scene references
    const updatedTaggedItems = { ...taggedItems };
    Object.keys(updatedTaggedItems).forEach((key) => {
      const item = updatedTaggedItems[key];
      if (item.scenes) {
        item.scenes = item.scenes.map((sceneNum) =>
          sceneNum.toString() === oldSceneNumber.toString()
            ? newSceneNumber
            : sceneNum
        );
      }
    });
    setTaggedItems(updatedTaggedItems);

    // Update characters scene references
    const updatedCharacters = { ...characters };
    Object.keys(updatedCharacters).forEach((key) => {
      const character = updatedCharacters[key];
      if (character.scenes) {
        character.scenes = character.scenes.map((sceneNum) =>
          sceneNum.toString() === oldSceneNumber.toString()
            ? newSceneNumber
            : sceneNum
        );
      }
    });
    setCharacters(updatedCharacters);

    // Update scheduled scenes
    const updatedScheduledScenes = { ...scheduledScenes };
    Object.keys(updatedScheduledScenes).forEach((date) => {
      updatedScheduledScenes[date] = updatedScheduledScenes[date].map((scene) =>
        scene.sceneNumber.toString() === oldSceneNumber.toString()
          ? { ...scene, sceneNumber: newSceneNumber }
          : scene
      );
    });
    setScheduledScenes(updatedScheduledScenes);
  };

  const updateStripboardScene = (sceneIndex, field, value) => {
    setStripboardScenes((prevScenes) => {
      const updatedScenes = [...prevScenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        [field]: value,
      };

      // Update the main scenes array and save to database
      if (
        field === "status" ||
        field === "manualTimeOfDay" ||
        field === "description" ||
        field === "notes"
      ) {
        console.log(`🔄 Updating scene ${sceneIndex} ${field} to: ${value}`);
        setScenes((prevMainScenes) => {
          const updatedMainScenes = [...prevMainScenes];

          if (field === "status") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              status: value,
            };
          } else if (field === "manualTimeOfDay") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              manualTimeOfDay: value,
              metadata: {
                ...updatedMainScenes[sceneIndex].metadata,
                timeOfDay: value,
              },
            };
          } else if (field === "description") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              description: value,
            };
          } else if (field === "notes") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              notes: value,
            };
          }

          console.log(
            `💾 Saving scene ${field} update to database for scene: ${updatedMainScenes[sceneIndex]?.sceneNumber}`
          );
          const sceneNumber = updatedMainScenes[sceneIndex]?.sceneNumber;
          console.log(
            `💾 Saving scene ${field} update to database for scene: ${sceneNumber}`
          );

          // ATOMIC SYNC - Update only this scene in BOTH tables
          if (field === "status") {
            Promise.all([
              database.updateSceneStatus(selectedProject, sceneNumber, value),
              database.updateStripboardSceneStatus(
                selectedProject,
                sceneNumber,
                value
              ),
            ]).catch((error) => {
              console.error("❌ Atomic scene status update failed:", error);
              alert("⚠️ Failed to save scene status. Please try again.");
            });
          } else if (field === "manualTimeOfDay") {
            database
              .updateSceneTimeOfDay(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error(
                  "❌ Atomic scene time of day update failed:",
                  error
                );
                alert("⚠️ Failed to save time of day. Please try again.");
              });
          } else if (field === "description") {
            database
              .updateSceneDescription(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error(
                  "❌ Atomic scene description update failed:",
                  error
                );
                alert("⚠️ Failed to save description. Please try again.");
              });
          } else if (field === "notes") {
            database
              .updateSceneNotes(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error("❌ Atomic scene notes update failed:", error);
                alert("⚠️ Failed to save notes. Please try again.");
              });
          }

          return updatedMainScenes;
        });
      }

      return updatedScenes;
    });
  };

  const syncPageDataToStripboard = () => {
    if (scenes.length > 0 && stripboardScenes.length > 0) {
      setStripboardScenes((prevStripboard) => {
        return prevStripboard.map((stripboardScene) => {
          // Find matching scene by sceneNumber
          const matchingScene = scenes.find(
            (scene) => scene.sceneNumber === stripboardScene.sceneNumber
          );

          if (
            matchingScene &&
            (matchingScene.pageNumber || matchingScene.pageLength)
          ) {
            // Only update page data, preserve all stripboard-specific data
            return {
              ...stripboardScene, // Preserve status, scheduledDate, etc.
              pageNumber: matchingScene.pageNumber,
              pageLength: matchingScene.pageLength,
            };
          }

          return stripboardScene; // No changes if no page data found
        });
      });
    }
  };

  // Props module callback functions
  const onUpdatePropTitle = (propWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [propWord]: {
          ...prev[propWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemovePropFromScene = (propWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[propWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[propWord];
      } else {
        updated = {
          ...prev,
          [propWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreatePropVariant = (originalPropWord, variantName) => {
    const originalItem = taggedItems[originalPropWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalPropWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddPropToScene = (propWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[propWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [propWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewProp = (propName, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const cleanWord = stemWord(propName.toLowerCase().replace(/[^\w]/g, ""));

    if (taggedItems[cleanWord]) {
      onAddPropToScene(cleanWord, sceneIndex);
      return;
    }

    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const position = getWordPosition(propName);
    const propsCategory = tagCategories.find((cat) => cat.name === "Props");
    const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;

    const newItem = {
      displayName: propName,
      category: "Props",
      color: propsCategory?.color || "#FF6B6B",
      chronologicalNumber: chronologicalNumber,
      position: position,
      scenes: [scene.sceneNumber],
      instances: [syntheticInstanceId],
      customTitle: propName,
      manuallyCreated: true,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  // Production Design module callback functions
  const onUpdatePDTitle = (pdWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [pdWord]: {
          ...prev[pdWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemovePDFromScene = (pdWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[pdWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[pdWord];
      } else {
        updated = {
          ...prev,
          [pdWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreatePDVariant = (originalPDWord, variantName) => {
    const originalItem = taggedItems[originalPDWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalPDWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddPDToScene = (pdWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[pdWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [pdWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewPD = (itemName, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const cleanWord = stemWord(itemName.toLowerCase().replace(/[^\w]/g, ""));

    if (taggedItems[cleanWord]) {
      onAddPDToScene(cleanWord, sceneIndex);
      return;
    }

    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const position = getWordPosition(itemName);
    const pdCategory = tagCategories.find(
      (cat) => cat.name === "Production Design"
    );
    const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;

    const newItem = {
      displayName: itemName,
      category: "Production Design",
      color: pdCategory?.color || "#9C27B0",
      chronologicalNumber: chronologicalNumber,
      position: position,
      scenes: [scene.sceneNumber],
      instances: [syntheticInstanceId],
      customTitle: itemName,
      manuallyCreated: true,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  // Makeup module callback functions
  const onUpdateMakeupTitle = (makeupWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [makeupWord]: {
          ...prev[makeupWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemoveMakeupFromScene = (makeupWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[makeupWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[makeupWord];
      } else {
        updated = {
          ...prev,
          [makeupWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateMakeupVariant = (originalMakeupWord, variantName) => {
    const originalItem = taggedItems[originalMakeupWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalMakeupWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddMakeupToScene = (makeupWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[makeupWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [makeupWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewMakeup = (itemName, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const cleanWord = stemWord(itemName.toLowerCase().replace(/[^\w]/g, ""));

    if (taggedItems[cleanWord]) {
      onAddMakeupToScene(cleanWord, sceneIndex);
      return;
    }

    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const position = getWordPosition(itemName);
    const makeupCategory = tagCategories.find((cat) => cat.name === "Makeup");
    const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;

    const newItem = {
      displayName: itemName,
      category: "Makeup",
      color: makeupCategory?.color || "#FF9F43",
      chronologicalNumber: chronologicalNumber,
      position: position,
      scenes: [scene.sceneNumber],
      instances: [syntheticInstanceId],
      customTitle: itemName,
      manuallyCreated: true,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onSceneNumberChange = async (sceneIndex, newNumber) => {
    console.log(
      "🎬 Scene renumbering:",
      scenes[sceneIndex].sceneNumber,
      "→",
      newNumber
    );

    const oldSceneNumber = scenes[sceneIndex].sceneNumber;

    // Parse scene numbers to handle letters (29A, 30B, etc.)
    const parseSceneNumber = (sceneNum) => {
      const match = String(sceneNum).match(/^(\d+)([A-Z]*)$/);
      if (match) {
        return {
          numeric: parseInt(match[1]),
          letter: match[2] || "",
          full: String(sceneNum),
        };
      }
      return {
        numeric: parseInt(sceneNum) || 1,
        letter: "",
        full: String(sceneNum),
      };
    };

    const oldParsed = parseSceneNumber(oldSceneNumber);
    const newParsed = parseSceneNumber(newNumber);

    // Determine if this creates an insertion (like 30→29A)
    const isInsertion =
      newParsed.numeric < oldParsed.numeric ||
      (newParsed.numeric === oldParsed.numeric &&
        newParsed.letter &&
        !oldParsed.letter);

    // Update scenes with proper shifting logic
    const updatedScenes = scenes.map((scene, index) => {
      if (index === sceneIndex) {
        // Target scene gets the new number
        return { ...scene, sceneNumber: newNumber };
      }

      if (isInsertion) {
        // Scenes AFTER the target scene (higher index) shift DOWN by 1
        if (index > sceneIndex) {
          const sceneNum = parseSceneNumber(scene.sceneNumber);
          return {
            ...scene,
            sceneNumber: (sceneNum.numeric - 1).toString() + sceneNum.letter,
          };
        }
      }

      return scene;
    });

    // Sort scenes by scene number for proper order
    updatedScenes.sort((a, b) => {
      const aNum = parseSceneNumber(a.sceneNumber);
      const bNum = parseSceneNumber(b.sceneNumber);

      if (aNum.numeric === bNum.numeric) {
        return aNum.letter.localeCompare(bNum.letter);
      }
      return aNum.numeric - bNum.numeric;
    });

    // Update scenes state
    setScenes(updatedScenes);

    // Update stripboard scenes with the same logic
    const updatedStripboard = stripboardScenes.map((stripScene) => {
      if (stripScene.sceneNumber === oldSceneNumber) {
        return { ...stripScene, sceneNumber: newNumber };
      }

      if (isInsertion) {
        // Find the original scene index to determine what to shift
        const originalSceneIndex = scenes.findIndex(
          (s) => s.sceneNumber === stripScene.sceneNumber
        );
        if (originalSceneIndex > sceneIndex) {
          const sceneNum = parseSceneNumber(stripScene.sceneNumber);
          return {
            ...stripScene,
            sceneNumber: (sceneNum.numeric - 1).toString() + sceneNum.letter,
          };
        }
      }

      return stripScene;
    });

    setStripboardScenes(updatedStripboard);

    // Sync both to database
    await saveScenesDatabase(updatedScenes);
    await syncStripboardScenesToDatabase(updatedStripboard);

    console.log("✅ Scene renumbering complete with proper shifting");
  };

  const updateCrewCallTime = (crewId, newCallTime) => {
    const newCallSheetData = {
      ...callSheetData,
      crewCallTimes: {
        ...callSheetData.crewCallTimes,
        [crewId]: newCallTime,
      },
    };

    setCallSheetData(newCallSheetData);

    // ADD SYNC CALL
    syncCallSheetDataToDatabase(newCallSheetData);
  };

  const renderModule = () => {
    if (!activeModule || activeModule === "Dashboard") {
      return (
        <Dashboard
          user={user}
          selectedProject={selectedProject}
          todoItems={todoItems}
          shootingDays={shootingDays}
          scheduledScenes={scheduledScenes}
          stripboardScenes={stripboardScenes}
          callSheetData={callSheetData}
          castCrew={castCrew}
          scenes={scenes}
          costCategories={costCategories}
          characters={characters}
          userRole={userRole}
          setActiveModule={setActiveModule}
          canEdit={canEdit}
          isViewOnly={isViewOnly}
          projectSettings={projectSettings}
          setProjectSettings={setProjectSettings}
          syncProjectSettingsToDatabase={syncProjectSettingsToDatabase}
        />
      );
    }

    switch (activeModule) {
      case "Script":
        return (
          <Script
            scenes={scenes}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            handleFileUpload={handleFileUpload}
            handleSingleSceneUpload={handleSingleSceneUpload}
            taggedItems={taggedItems}
            tagCategories={tagCategories}
            showTagDropdown={showTagDropdown}
            setShowTagDropdown={setShowTagDropdown}
            tagWord={tagWord}
            untagWordInstance={untagWordInstance}
            isWordInstanceTagged={isWordInstanceTagged}
            onSceneNumberChange={onSceneNumberChange}
            stripboardScenes={stripboardScenes}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
          />
        );
      case "Stripboard":
        return (
          <StripboardModule
            scenes={stripboardScenes}
            onLocationClick={() => setActiveModule("Locations")}
            taggedItems={taggedItems}
            characters={characters}
            castCrew={castCrew}
            wardrobeItems={wardrobeItems}
            onUpdateScene={updateStripboardScene}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "StripboardSchedule":
        return (
          <StripboardScheduleModule
            selectedProject={selectedProject}
            syncLocks={syncLocks}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            onScheduleScene={scheduleScene}
            onUnscheduleScene={unscheduleScene}
            shootingDays={shootingDays}
            setShootingDays={setShootingDays}
            setScheduledScenes={setScheduledScenes}
            setStripboardScenes={setStripboardScenes}
            scriptLocations={scriptLocations}
            scenes={scenes}
            setScenes={setScenes}
            onUpdateScene={updateStripboardScene}
            onSyncAllShootingDays={syncAllShootingDaysToDatabase}
            saveScenesDatabase={saveScenesDatabase}
            onSyncStripboardScenes={syncStripboardScenesToDatabase}
            onSyncScheduledScenes={syncScheduledScenesToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            syncShootingDays={syncShootingDaysToDatabase}
          />
        );
      case "Calendar":
        return (
          <CalendarModule
            scheduledScenes={scheduledScenes}
            todoItems={todoItems}
            castCrew={castCrew}
            shootingDays={shootingDays}
            stripboardScenes={stripboardScenes}
            doodCastEvents={doodCastEvents}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "Day Out of Days":
        return (
          <DayOutOfDaysModule
            selectedProject={selectedProject}
            castCrew={castCrew}
            shootingDays={shootingDays}
            characters={characters}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            doodCastEvents={doodCastEvents}
            setDoodCastEvents={setDoodCastEvents}
            doodOverrides={doodOverrides}
            setDoodOverrides={setDoodOverrides}
            doodSettings={doodSettings}
            setDoodSettings={setDoodSettings}
            onSyncDoodCastEvent={(event) =>
              database.syncDoodCastEvent(selectedProject, event)
            }
            onSyncDoodOverride={(override) =>
              database.syncDoodOverride(selectedProject, override)
            }
            onSyncDoodSettings={(settings) =>
              database.syncDoodSettings(selectedProject, settings)
            }
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "CallSheet":
        // Debug log removed

        return (
          <CallSheetModule
            scenes={scenes}
            shootingDays={shootingDays}
            castCrew={castCrew}
            onUpdateCastCrew={(updatedCastCrew) => {
              setCastCrew(updatedCastCrew);
            }}
            characters={characters}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            projectSettings={projectSettings}
            setProjectSettings={setProjectSettings}
            callSheetData={callSheetData}
            setCallSheetData={setCallSheetData}
            updateCrewCallTime={updateCrewCallTime}
            wardrobeItems={wardrobeItems}
            scriptLocations={scriptLocations}
            actualLocations={actualLocations}
            getFinalCharacterScenes={getFinalCharacterScenes}
            syncCallSheetData={syncCallSheetDataToDatabase}
            selectedProject={selectedProject}
          />
        );

      case "Cast & Crew":
        return (
          <CastCrewModule
            scenes={scenes}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
            crewSortOrder={crewSortOrder}
            setCrewSortOrder={setCrewSortOrder}
            onSyncCastCrew={syncCastCrewToDatabase}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
            moduleCharacters={characters}
          />
        );

      case "Characters":
        return (
          <CharactersModule
            characters={characters}
            setCharacters={setCharacters}
            characterSceneOverrides={characterSceneOverrides}
            setCharacterSceneOverrides={setCharacterSceneOverrides}
            getFinalCharacterScenes={getFinalCharacterScenes}
            scenes={scenes}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
            wardrobeItems={wardrobeItems}
            garmentInventory={garmentInventory}
            taggedItems={taggedItems}
            continuityElements={continuityElements}
            stripboardScenes={stripboardScenes}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdateCharacters={syncCharactersToDatabase}
            onUpdateCharacterOverrides={syncCharacterOverridesToDatabase}
            syncCastCrewToDatabase={syncCastCrewToDatabase}
            selectedProject={selectedProject}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "Props":
        return (
          <PropsModule
            taggedItems={taggedItems}
            scenes={scenes}
            characters={characters}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdatePropTitle={onUpdatePropTitle}
            onRemovePropFromScene={onRemovePropFromScene}
            onCreatePropVariant={onCreatePropVariant}
            onAddPropToScene={onAddPropToScene}
            onCreateNewProp={onCreateNewProp}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            stemWord={stemWord}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Makeup":
        return (
          <MakeupModule
            taggedItems={taggedItems}
            scenes={scenes}
            characters={characters}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdateMakeupTitle={onUpdateMakeupTitle}
            onRemoveMakeupFromScene={onRemoveMakeupFromScene}
            onCreateMakeupVariant={onCreateMakeupVariant}
            onAddMakeupToScene={onAddMakeupToScene}
            onCreateNewMakeup={onCreateNewMakeup}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Production Design":
        return (
          <ProductionDesignModule
            taggedItems={taggedItems}
            scenes={scenes}
            scriptLocations={scriptLocations}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdatePDTitle={onUpdatePDTitle}
            onRemovePDFromScene={onRemovePDFromScene}
            onCreatePDVariant={onCreatePDVariant}
            onAddPDToScene={onAddPDToScene}
            onCreateNewPD={onCreateNewPD}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "ShotList":
        return (
          <ShotListModule
            stripboardScenes={stripboardScenes}
            characters={characters}
            castCrew={castCrew}
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            shotListData={shotListData}
            setShotListData={setShotListData}
            sceneNotes={sceneNotes}
            setSceneNotes={setSceneNotes}
            onSyncShotListData={syncShotListDataToDatabase}
            userRole={userRole}
            canEdit={canEdit}
            isViewOnly={isViewOnly}
            selectedProject={selectedProject}
            user={user}
          />
        );
      case "Locations":
        return (
          <LocationsModule
            scenes={stripboardScenes}
            scriptLocations={scriptLocations}
            setScriptLocations={setScriptLocations}
            actualLocations={actualLocations}
            setActualLocations={setActualLocations}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onSyncScriptLocations={syncScriptLocationsToDatabase}
            onSyncActualLocations={syncActualLocationsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Cost Report":
        return (
          <CostReportModule
            costCategories={costCategories}
            setCostCategories={setCostCategories}
            costVendors={costVendors}
            setCostVendors={setCostVendors}
            scenes={scenes}
            shootingDays={shootingDays}
            castCrew={castCrew}
            crewSortOrder={crewSortOrder}
            onSyncCostCategories={syncCostCategoriesToDatabase}
            onSyncCostVendors={syncCostVendorsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Wardrobe":
        return (
          <WardrobeModule
            scenes={scenes}
            characters={characters}
            wardrobeItems={wardrobeItems}
            setWardrobeItems={setWardrobeItems}
            garmentInventory={garmentInventory}
            setGarmentInventory={setGarmentInventory}
            garmentCategories={garmentCategories}
            setGarmentCategories={setGarmentCategories}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onSyncWardrobeItems={syncWardrobeItemsToDatabase}
            onSyncGarmentInventory={syncGarmentInventoryToDatabase}
            selectedProject={selectedProject}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Reports":
        return (
          <ReportsModule
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            stripboardScenes={stripboardScenes}
            taggedItems={taggedItems}
            wardrobeItems={wardrobeItems}
            garmentInventory={garmentInventory}
            scenes={scenes}
            projectSettings={projectSettings}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "ToDoList":
        return (
          <ToDoListModule
            todoItems={todoItems}
            setTodoItems={setTodoItems}
            todoCategories={todoCategories}
            setTodoCategories={setTodoCategories}
            castCrew={castCrew}
            syncTodoItemsToDatabase={syncTodoItemsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
          />
        );
      case "Timeline":
        return (
          <TimelineModule
            scenes={scenes}
            characters={characters}
            castCrew={castCrew}
            stripboardScenes={stripboardScenes}
            timelineData={timelineData}
            setTimelineData={setTimelineData}
            continuityElements={continuityElements}
            setContinuityElements={setContinuityElements}
            onSyncTimelineData={syncTimelineDataToDatabase}
            onSyncContinuityElements={syncContinuityElementsToDatabase}
            onUpdateScenes={(updatedScenes) => {
              setScenes(updatedScenes);
              saveScenesDatabase(updatedScenes);
            }}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Budget":
        return (
          <BudgetModule
            budgetData={budgetData}
            setBudgetData={setBudgetData}
            onSyncBudgetData={syncBudgetDataToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      default:
        return <div>Select a module</div>;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "120px",
          backgroundColor: "#FFE5B4",
          paddingTop: "10px",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "fixed",
          left: 0,
          top: "44px",
          bottom: 0,
          zIndex: 1000,
          overflowY: "auto",
        }}
      >
        {/* Export/Import Section */}
        {canEdit(userRole) && (
          <div
            style={{
              marginBottom: "10px",
              borderBottom: "1px solid #ccc",
              paddingBottom: "10px",
            }}
          >
            <button
              onClick={exportProject}
              style={{
                margin: "2px 0",
                padding: "6px 4px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "1px solid #45a049",
                cursor: "pointer",
                fontSize: "10px",
                width: "100px",
                fontWeight: "bold",
              }}
            >
              Export
            </button>

            <label style={{ display: "block" }}>
              <input
                type="file"
                accept=".json"
                onChange={importProject}
                style={{ display: "none" }}
              />
              <div
                style={{
                  margin: "2px 0",
                  padding: "6px 4px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "1px solid #1976D2",
                  cursor: "pointer",
                  fontSize: "10px",
                  width: "100px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                Import
              </div>
            </label>
          </div>
        )}

        {/* Maintenance & Debug Buttons - Commented out for production */}
        {/* DEBUG & MAINTENANCE BUTTONS - Hidden in production but preserved for emergency use */}
        {/* Uncomment buttons below for debugging or maintenance operations */}
        {/*
          <button
            onClick={cleanupDuplicateShootingDays}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#9C27B0",
              color: "white",
              border: "1px solid #7B1FA2",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Cleanup Days
          </button>

          <button
            onClick={debugShootingDaysState}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#FF5722",
              color: "white",
              border: "1px solid #D84315",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Debug Days
          </button>

          <button
            onClick={auditAllDatabaseTables}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#FF5722",
              color: "white",
              border: "1px solid #D84315",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Audit DB
          </button>

          <button
            onClick={emergencyDatabaseCleanup}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#F44336",
              color: "white",
              border: "1px solid #D32F2F",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Emergency Cleanup
          </button>
          */}

        {/*
<button
  onClick={repairScheduledScenesFromStripboard}
  style={{
    margin: "2px 0",
    padding: "6px 4px",
    backgroundColor: "#FF9800",
    color: "white",
    border: "1px solid #F57C00",
    cursor: "pointer",
    fontSize: "10px",
    width: "100px",
    fontWeight: "bold",
  }}
>
  Repair Reports
</button>

<button
  onClick={() => {
    console.log("=== BEFORE CALCULATION ===");
    console.log("TaggedItems count:", Object.keys(taggedItems).length);
    console.log("Sample items:", Object.entries(taggedItems).slice(0,3).map(([word, item]) => ({
      word,
      category: item.category,
      chronologicalNumber: item.chronologicalNumber,
      categoryNumber: item.categoryNumber
    })));
    
    const itemsWithCategoryNumbers = calculateCategoryNumbers(taggedItems);
    
    console.log("=== AFTER CALCULATION ===");
    console.log("Sample items with category numbers:", Object.entries(itemsWithCategoryNumbers).slice(0,3).map(([word, item]) => ({
      word,
      category: item.category,
      chronologicalNumber: item.chronologicalNumber,
      categoryNumber: item.categoryNumber
    })));
    
    setTaggedItems(itemsWithCategoryNumbers);
    alert("Category numbers recalculated! Check console for details.");
  }}
  style={{
    margin: "2px 0",
    padding: "6px 4px",
    backgroundColor: "#9C27B0",
    color: "white",
    border: "1px solid #7B1FA2",
    cursor: "pointer",
    fontSize: "10px",
    width: "100px",
    fontWeight: "bold",
  }}
>
  Fix Numbers
</button>
*/}

        <div style={{ marginBottom: "10px" }}>
          <strong>Modules:</strong>
        </div>

        <div
          style={{
            fontSize: "9px",
            color: "#666",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          v
          {localStorage.getItem("appVersion")
            ? new Date(
                parseInt(localStorage.getItem("appVersion"))
              ).toLocaleDateString()
            : "loading..."}
        </div>

        <button
          onClick={() => setActiveModule("Dashboard")}
          style={{
            margin: "5px 0",
            padding: "8px 4px",
            backgroundColor:
              activeModule === "Dashboard" ? "#ddd" : "transparent",
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: activeModule === "Dashboard" ? "bold" : "normal",
            fontSize: "11px",
            width: "100px",
          }}
        >
          🏠 Home
        </button>

        {[
          "Script",
          "Stripboard",
          "StripboardSchedule",
          "Calendar",
          "Day Out of Days",
          "Cast & Crew",
          "Characters",
          "Locations",
          "CallSheet",
          "ShotList",
          "ToDoList",
          "Timeline",
          "Props",
          "Makeup",
          "Production Design",
          "Wardrobe",
          "Cost Report",
          "Reports",
          "Budget",
        ]
          .filter((mod) => mod !== "Dashboard")
          .map((mod) => (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              style={{
                margin: "5px 0",
                padding: "8px 4px",
                backgroundColor: activeModule === mod ? "#ddd" : "transparent",
                border: "1px solid #ccc",
                cursor: "pointer",
                fontWeight: activeModule === mod ? "bold" : "normal",
                fontSize: "11px",
                width: "100px",
              }}
            >
              {mod}
            </button>
          ))}
      </div>

      <div
        style={{
          marginLeft: "120px",
          width: "calc(100vw - 120px)",
          maxWidth: "calc(100vw - 120px)",
          padding: activeModule === "Script" ? "10px" : "0",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          boxSizing: "border-box",
          position: "fixed",
          top: "44px",
          right: "0",
          bottom: "0",
          overflow: "hidden",
        }}
      >
        {renderModule()}
      </div>

      {/* AI Summarization Progress Toast */}
      {isSummarizing && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#1a1a2e",
            color: "white",
            padding: "14px 18px",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 99999,
            minWidth: "260px",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✨</span>
            AI Summarizing Scenes...
          </div>
          <div style={{ marginBottom: "8px", color: "#ccc", fontSize: "12px" }}>
            Scene {summarizeProgress.current} of {summarizeProgress.total}
          </div>
          <div
            style={{
              backgroundColor: "#333",
              borderRadius: "4px",
              height: "6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                backgroundColor: "#2196F3",
                height: "100%",
                width: `${
                  summarizeProgress.total > 0
                    ? Math.round(
                        (summarizeProgress.current / summarizeProgress.total) *
                          100
                      )
                    : 0
                }%`,
                transition: "width 0.3s ease",
                borderRadius: "4px",
              }}
            />
          </div>
          <div style={{ marginTop: "6px", color: "#aaa", fontSize: "11px" }}>
            You can keep working — descriptions will appear as they complete.
          </div>
        </div>
      )}
    </div>
  );
}

// Props Module
const EditablePropTitle = React.memo(
  ({ propWord, item, onTitleUpdate, onClick }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(
      item.customTitle || item.displayName
    );

    const handleSave = () => {
      if (editValue.trim() !== item.displayName && editValue.trim() !== "") {
        onTitleUpdate(editValue.trim());
      }
      setIsEditing(false);
    };

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setEditValue(item.customTitle || item.displayName);
        setIsEditing(false);
      }
    };

    if (isEditing) {
      return (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          autoFocus
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: item.color,
            color: "white",
            padding: "6px 12px",
            borderRadius: "12px",
            border: "2px solid white",
            outline: "none",
            width: "200px",
          }}
        />
      );
    }

    return (
      <div
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "5px",
          cursor: "pointer",
          backgroundColor: item.color,
          color: "white",
          padding: "6px 12px",
          borderRadius: "12px",
          display: "inline-block",
          userSelect: "none",
          position: "relative",
        }}
        onClick={onClick}
        onDoubleClick={() => setIsEditing(true)}
      >
        {item.chronologicalNumber}. {item.customTitle || item.displayName}
        <span
          style={{
            fontSize: "10px",
            opacity: 0.7,
            marginLeft: "8px",
            fontStyle: "italic",
          }}
        >
          (double-click to edit)
        </span>
      </div>
    );
  }
);

function PropsModule({
  taggedItems,
  scenes,
  stripboardScenes, // Add stripboardScenes prop for scene status
  characters, // Add characters prop
  setActiveModule,
  setCurrentIndex,
  onUpdatePropTitle,
  onRemovePropFromScene,
  onCreatePropVariant,
  onAddPropToScene,
  onCreateNewProp,
  onUpdateTaggedItems, // Add callback to update taggedItems
  onSyncTaggedItems, // Add callback to sync to database
}) {
  const [showScenesWithoutProps, setShowScenesWithoutProps] = useState(false);
  const [selectedProp, setSelectedProp] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);

  const propItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Props")
    .sort((a, b) => a[1].chronologicalNumber - b[1].chronologicalNumber);

  // Get props for a specific scene
  const getPropsForScene = (sceneIndex) => {
    const sceneProps = [];
    propItems.forEach(([word, prop]) => {
      // Check instances instead of scenes array to respect exclusions
      if (prop.instances) {
        const hasActiveInstance = prop.instances.some((instance) => {
          const sceneNumber = parseInt(instance.split("-")[0]); // Instance format is already scene number - 1
          return sceneNumber === sceneIndex && !instance.excluded;
        });

        if (hasActiveInstance) {
          sceneProps.push({ word, ...prop });
        }
      }
    });
    return sceneProps.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

  // Filter scenes based on whether they have props
  const filteredScenes = scenes.filter((scene, index) => {
    const sceneProps = getPropsForScene(index);
    return showScenesWithoutProps || sceneProps.length > 0;
  });

  const handlePropClick = (prop, sceneIndex) => {
    // Single click - show prop details popup (placeholder for future)
    setSelectedProp({ ...prop, contextScene: sceneIndex });
  };

  const handlePropDoubleClick = (prop, sceneIndex) => {
    // Double click - navigate to scene in script module
    setCurrentIndex(sceneIndex);
    setActiveModule("Script");
  };

  const handleRemovePropFromScene = (propWord, sceneIndex) => {
    // This would need to be implemented in the parent component
    // For now, just close any open popups
    setSelectedProp(null);
  };

  // Character assignment is now handled directly in the onClick handlers

  if (propItems.length === 0) {
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
        <h2>Props</h2>
        <p>
          No props have been tagged yet. Double-click words in the Script module
          to tag them as props.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        gap: "15px",
        maxWidth: "100%",
        overflowX: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Left Column - Props List */}
      <div
        style={{
          flex: "0 0 400px",
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
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
          <h2 style={{ margin: 0 }}>Props</h2>
          <button
            onClick={() => {
              // Create a temporary prop object to open the popup
              const tempProp = {
                word: `custom_${Date.now()}`, // Temporary unique identifier
                displayName: "New Custom Prop",
                customTitle: "New Custom Prop",
                category: "Props",
                color: "#4CAF50",
                chronologicalNumber: propItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomProp: true, // Flag to identify this as a new custom prop
              };
              setSelectedProp(tempProp);
            }}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            + Add Custom Prop
          </button>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <p>Total Props: {propItems.length}</p>
        </div>

        <div style={{ width: "100%" }}>
          {propItems.map(([word, item]) => {
            // Convert hex color to more pastel version
            const getPastelColor = (hexColor) => {
              const r = parseInt(hexColor.slice(1, 3), 16);
              const g = parseInt(hexColor.slice(3, 5), 16);
              const b = parseInt(hexColor.slice(5, 7), 16);
              // Blend with white to create pastel effect
              const pastelR = Math.round(r + (255 - r) * 0.7);
              const pastelG = Math.round(g + (255 - g) * 0.7);
              const pastelB = Math.round(b + (255 - b) * 0.7);
              return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
            };

            // Get character assignments for this prop
            const assignedCharacters = item.assignedCharacters || [];
            const hasMultipleCharacters = assignedCharacters.length > 1;

            // Capitalize first letter of prop name
            const capitalizedName =
              (item.customTitle || item.displayName).charAt(0).toUpperCase() +
              (item.customTitle || item.displayName).slice(1);

            return (
              <div
                key={word}
                style={{
                  backgroundColor: getPastelColor(item.color),
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px",
                  margin: "5px 0",
                  fontSize: "12px",
                  position: "relative",
                  maxWidth: "285px", // 25% narrower than 380px
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "20px", // 8pts bigger than 12px base
                    marginBottom: "4px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setSelectedProp({ word, ...item, contextScene: null })
                  }
                >
                  {item.categoryNumber || item.chronologicalNumber}.{" "}
                  {capitalizedName}
                  {hasMultipleCharacters && (
                    <span
                      style={{
                        display: "inline-block",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        borderRadius: "50%",
                        width: "14px",
                        height: "14px",
                        textAlign: "center",
                        fontSize: "10px",
                        lineHeight: "14px",
                        marginLeft: "4px",
                        cursor: "pointer",
                      }}
                      title="Assigned to multiple characters"
                    >
                      !
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", marginBottom: "6px" }}>
                  Category: {item.category}
                  {assignedCharacters.length > 0 && (
                    <span style={{ marginLeft: "12px" }}>
                      Characters: {assignedCharacters.join(", ")}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                  <button
                    onClick={() =>
                      setSelectedProp({ word, ...item, contextScene: null })
                    }
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column - Scene Breakdown */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2>Scene Breakdown</h2>
          <label style={{ fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={showScenesWithoutProps}
              onChange={(e) => setShowScenesWithoutProps(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Show scenes without props
          </label>
        </div>

        <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
          {filteredScenes.map((scene, originalIndex) => {
            const sceneIndex = scenes.indexOf(scene);
            const sceneProps = getPropsForScene(sceneIndex);

            return (
              <div
                key={sceneIndex}
                style={{
                  border: "1px solid #ddd",
                  margin: "10px 0",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f5f5f5",
                    padding: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    borderBottom:
                      sceneProps.length > 0 ? "1px solid #ddd" : "none",
                  }}
                >
                  Scene {scene.sceneNumber}: {scene.heading}
                </div>

                {sceneProps.length > 0 && (
                  <div style={{ padding: "12px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "8px",
                      }}
                    >
                      Props needed ({sceneProps.length}):
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {sceneProps.map((prop) => {
                        // Convert hex color to more pastel version
                        const getPastelColor = (hexColor) => {
                          const r = parseInt(hexColor.slice(1, 3), 16);
                          const g = parseInt(hexColor.slice(3, 5), 16);
                          const b = parseInt(hexColor.slice(5, 7), 16);
                          const pastelR = Math.round(r + (255 - r) * 0.7);
                          const pastelG = Math.round(g + (255 - g) * 0.7);
                          const pastelB = Math.round(b + (255 - b) * 0.7);
                          return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
                        };

                        const assignedCharacters =
                          prop.assignedCharacters || [];
                        const hasMultipleCharacters =
                          assignedCharacters.length > 1;

                        // Capitalize first letter of prop name
                        const capitalizedName =
                          (prop.customTitle || prop.displayName)
                            .charAt(0)
                            .toUpperCase() +
                          (prop.customTitle || prop.displayName).slice(1);

                        return (
                          <div
                            key={`${sceneIndex}-${prop.word}`}
                            onClick={() => handlePropClick(prop, sceneIndex)}
                            onDoubleClick={() =>
                              handlePropDoubleClick(prop, sceneIndex)
                            }
                            style={{
                              backgroundColor: getPastelColor(prop.color),
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              padding: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                fontSize: "11px", // Back to original size
                                marginBottom: "2px",
                              }}
                            >
                              {prop.categoryNumber || prop.chronologicalNumber}.{" "}
                              {capitalizedName}
                              {hasMultipleCharacters && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    borderRadius: "50%",
                                    width: "10px",
                                    height: "10px",
                                    textAlign: "center",
                                    fontSize: "7px",
                                    lineHeight: "10px",
                                    marginLeft: "3px",
                                  }}
                                  title="Assigned to multiple characters"
                                >
                                  !
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                color: "#666",
                                marginBottom: "2px",
                                fontSize: "9px",
                              }}
                            >
                              {prop.category}
                            </div>
                            {assignedCharacters.length > 0 && (
                              <div style={{ color: "#666", fontSize: "9px" }}>
                                {assignedCharacters.join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedProp && (
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
            onClick={() => setSelectedProp(null)}
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
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Prop Details</h3>
            <div style={{ marginBottom: "15px" }}>
              <strong>Name:</strong>
              <input
                type="text"
                value={selectedProp.customTitle || selectedProp.displayName}
                onChange={(e) => {
                  setSelectedProp((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }));
                }}
                onBlur={() => {
                  if (
                    onUpdatePropTitle &&
                    selectedProp.customTitle !== selectedProp.displayName
                  ) {
                    onUpdatePropTitle(
                      selectedProp.word,
                      selectedProp.customTitle
                    );
                  }
                }}
                style={{
                  marginLeft: "10px",
                  padding: "4px 8px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  width: "200px",
                }}
                placeholder={selectedProp.displayName}
              />
            </div>
            <p>
              <strong>Original Word:</strong> {selectedProp.displayName}
            </p>
            <p>
              <strong>Category:</strong> {selectedProp.category}
            </p>
            <p>
              <strong>Number:</strong> {selectedProp.chronologicalNumber}
            </p>
            <p>
              <strong>Scenes:</strong>{" "}
              {selectedProp.scenes ? selectedProp.scenes.join(", ") : "None"}
            </p>
            <p>
              <strong>Assigned Characters:</strong>{" "}
              {selectedProp.assignedCharacters &&
              selectedProp.assignedCharacters.length > 0
                ? selectedProp.assignedCharacters.join(", ")
                : "None"}
            </p>

            {/* Character Assignment */}
            {characters && Object.keys(characters).length > 0 && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#e8f5e8",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Character Assignment</h4>
                <div
                  style={{
                    marginBottom: "10px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Assign this prop to characters. Green = assigned, Gray = not
                  assigned.
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {Object.keys(characters)
                    .sort()
                    .map((characterName) => {
                      const isAssigned = (
                        selectedProp.assignedCharacters || []
                      ).includes(characterName);
                      return (
                        <button
                          key={characterName}
                          onClick={() => {
                            // Create updated taggedItems with character assignment change
                            const updatedTaggedItems = { ...taggedItems };
                            const propData =
                              updatedTaggedItems[selectedProp.word];

                            if (propData) {
                              const currentAssignments =
                                propData.assignedCharacters || [];
                              let newAssignments;

                              if (isAssigned) {
                                // Remove character
                                newAssignments = currentAssignments.filter(
                                  (char) => char !== characterName
                                );
                              } else {
                                // Add character
                                newAssignments = [
                                  ...currentAssignments,
                                  characterName,
                                ].sort();
                              }

                              updatedTaggedItems[selectedProp.word] = {
                                ...propData,
                                assignedCharacters: newAssignments,
                              };

                              // Update the main taggedItems state
                              if (onUpdateTaggedItems) {
                                onUpdateTaggedItems(updatedTaggedItems);
                              }

                              // Sync to database
                              if (onSyncTaggedItems) {
                                onSyncTaggedItems(updatedTaggedItems);
                              }

                              // Update the selected prop to reflect the change
                              setSelectedProp((prev) => ({
                                ...prev,
                                assignedCharacters: newAssignments,
                              }));
                            }
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {characterName}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
            <p style={{ fontSize: "12px", color: "#666", fontStyle: "italic" }}>
              Future: Cost, status, vendor info, photos, etc.
            </p>

            {/* Scene Context Actions - only show if opened from scene context */}
            {selectedProp.contextScene !== null && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>Scene Actions</h4>
                <button
                  onClick={() => {
                    if (onRemovePropFromScene) {
                      onRemovePropFromScene(
                        selectedProp.word,
                        selectedProp.contextScene
                      );
                    }
                    setSelectedProp(null);
                  }}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Remove from Scene
                </button>
                <button
                  onClick={() => {
                    const variantName = prompt(
                      `Create variant of "${
                        selectedProp.customTitle || selectedProp.displayName
                      }":`
                    );
                    if (variantName && onCreatePropVariant) {
                      onCreatePropVariant(selectedProp.word, variantName);
                    }
                  }}
                  style={{
                    backgroundColor: "#FF9800",
                    color: "white",
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px",
                    fontSize: "12px",
                  }}
                >
                  Create Variant
                </button>
              </div>
            )}

            {/* Add to Scenes - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#e8f5e8",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>
                {selectedProp.contextScene !== null
                  ? "Add Props to Scene"
                  : "Manage Scenes for This Prop"}
              </h4>

              {selectedProp.contextScene === null ? (
                // Left panel context - multi-select scenes for this prop
                <div>
                  <div
                    style={{
                      marginBottom: "10px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Click scene numbers to add/remove this prop. Green =
                    assigned, Gray = not assigned.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      maxHeight: "120px",
                      overflowY: "auto",
                    }}
                  >
                    {scenes.map((scene, sceneIndex) => {
                      const isAssigned =
                        selectedProp.instances &&
                        selectedProp.instances.some((instance) => {
                          const sceneIndex = parseInt(instance.split("-")[0]);
                          return sceneIndex === scenes.indexOf(scene);
                        });
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (onAddPropToScene && !isAssigned) {
                              onAddPropToScene(selectedProp.word, sceneIndex);
                            }
                            // Note: Scene removal functionality would need onRemovePropFromScene callback
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: "12px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#333",
                            fontWeight: isAssigned ? "bold" : "normal",
                          }}
                        >
                          {scene.sceneNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Scene context - add other props to this scene
                <div>
                  <select
                    style={{
                      padding: "4px 8px",
                      marginRight: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                    onChange={(e) => {
                      if (e.target.value && onAddPropToScene) {
                        onAddPropToScene(
                          e.target.value,
                          selectedProp.contextScene
                        );
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Select existing prop...</option>
                    {propItems.map(([word, item]) => (
                      <option key={word} value={word}>
                        {item.customTitle || item.displayName}
                      </option>
                    ))}
                  </select>
                  <br />
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      marginTop: "8px",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Create new prop..."
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "12px",
                        width: "150px",
                      }}
                      onKeyPress={(e) => {
                        if (
                          e.key === "Enter" &&
                          e.target.value.trim() &&
                          onCreateNewProp
                        ) {
                          onCreateNewProp(
                            e.target.value.trim(),
                            selectedProp.contextScene
                          );
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input =
                          e.target.parentElement.querySelector("input");
                        if (input.value.trim() && onCreateNewProp) {
                          onCreateNewProp(
                            input.value.trim(),
                            selectedProp.contextScene
                          );
                          input.value = "";
                        }
                      }}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        padding: "4px 8px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Variant - show for both contexts */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#fff3e0",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>Prop Management</h4>
              <button
                onClick={() => {
                  const variantName = prompt(
                    `Create variant of "${
                      selectedProp.customTitle || selectedProp.displayName
                    }":`
                  );
                  if (variantName && onCreatePropVariant) {
                    onCreatePropVariant(selectedProp.word, variantName);
                  }
                }}
                style={{
                  backgroundColor: "#FF9800",
                  color: "white",
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Create Variant
              </button>
            </div>

            <div style={{ marginTop: "15px" }}>
              {selectedProp.contextScene === null &&
                selectedProp.scenes &&
                selectedProp.scenes.length > 0 && (
                  <div
                    style={{
                      marginBottom: "10px",
                      padding: "8px",
                      backgroundColor: "#f0f8ff",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      Browse Scenes with This Prop ({selectedProp.scenes.length}{" "}
                      scenes)
                    </div>
                    <button
                      onClick={() => {
                        // Initialize viewing scene to first scene in the list
                        const firstSceneNumber = selectedProp.scenes[0];
                        setSelectedProp((prev) => ({
                          ...prev,
                          viewingSceneNumber: firstSceneNumber,
                        }));
                        setShowScenePreview(true);
                      }}
                      style={{
                        backgroundColor: "#2196F3",
                        color: "white",
                        padding: "6px 12px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "8px",
                        fontSize: "12px",
                      }}
                    >
                      View Scenes
                    </button>
                  </div>
                )}

              {selectedProp.contextScene !== null &&
                !selectedProp.isNewCustomProp && (
                  <button
                    onClick={() => setShowScenePreview(true)}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginRight: "10px",
                    }}
                  >
                    View Scene
                  </button>
                )}

              {/* Save/Cancel buttons for new custom props */}
              {selectedProp.isNewCustomProp && (
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <button
                    onClick={() => {
                      if (
                        selectedProp.customTitle &&
                        selectedProp.customTitle.trim() &&
                        onCreateNewProp
                      ) {
                        onCreateNewProp(selectedProp.customTitle.trim(), null);
                      }
                      setSelectedProp(null);
                    }}
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
                    Save Prop
                  </button>
                  <button
                    onClick={() => setSelectedProp(null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {!selectedProp.isNewCustomProp && (
                <button
                  onClick={() => setSelectedProp(null)}
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
              )}
            </div>
          </div>
        </>
      )}

      {/* Script Popup Modal with exact Script module styling */}
      {selectedProp &&
        showScenePreview &&
        (selectedProp.contextScene !== null ||
          (selectedProp.contextScene === null &&
            selectedProp.viewingSceneNumber)) && (
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
                {(() => {
                  // Define scene at the top so it's available to header and content
                  let scene;
                  if (selectedProp.contextScene !== null) {
                    scene = scenes[selectedProp.contextScene];
                  } else {
                    const viewingSceneNumber =
                      selectedProp.viewingSceneNumber || selectedProp.scenes[0];
                    scene = scenes.find(
                      (s) => s.sceneNumber === String(viewingSceneNumber)
                    );
                  }

                  if (!scene) {
                    return (
                      <div style={{ padding: "20px" }}>Scene not found</div>
                    );
                  }

                  return (
                    <>
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
                        <div
                          style={{
                            margin: 0,
                            fontSize: "12pt",
                            fontFamily: "Courier New, monospace",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scene.sceneNumber}. {scene.heading}
                        </div>

                        {/* Navigation controls for left panel context */}
                        {selectedProp.contextScene === null &&
                          selectedProp.scenes &&
                          selectedProp.scenes.length > 1 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  const prevIndex =
                                    currentIndex > 0
                                      ? currentIndex - 1
                                      : selectedProp.scenes.length - 1;
                                  setSelectedProp((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedProp.scenes[prevIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                ← Prev
                              </button>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "rgba(255,255,255,0.8)",
                                }}
                              >
                                {(() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  return `${currentIndex + 1} of ${
                                    selectedProp.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const currentIndex =
                                    selectedProp.scenes.indexOf(
                                      selectedProp.viewingSceneNumber ||
                                        selectedProp.scenes[0]
                                    );
                                  const nextIndex =
                                    currentIndex <
                                    selectedProp.scenes.length - 1
                                      ? currentIndex + 1
                                      : 0;
                                  setSelectedProp((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedProp.scenes[nextIndex],
                                  }));
                                }}
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.2)",
                                  color: "white",
                                  border: "1px solid rgba(255,255,255,0.3)",
                                  borderRadius: "4px",
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Next →
                              </button>
                            </div>
                          )}

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
                          backgroundColor: "white",
                          boxSizing: "border-box",
                          textAlign: "left",
                          fontFamily: "Courier New, monospace",
                        }}
                      >
                        {/* Scene Heading */}
                        <div style={getElementStyle("Scene Heading")}>
                          {scene.heading}
                        </div>

                        {/* Scene Content */}
                        <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                          {scene.content.map((block, blockIndex) => {
                            const renderContent = () => {
                              const words = block.text.split(/(\s+)/);
                              return words.map((word, wordIndex) => {
                                if (!word.trim()) return word;

                                const cleanWord = word
                                  .toLowerCase()
                                  .replace(/[^\w]/g, "");
                                const stemmedWord = stemWord(cleanWord);

                                const isCurrentProp =
                                  stemmedWord === selectedProp.word;
                                const isTagged = Object.keys(taggedItems).some(
                                  (taggedWord) => stemmedWord === taggedWord
                                );

                                if (isCurrentProp) {
                                  return (
                                    <span
                                      key={wordIndex}
                                      style={{
                                        backgroundColor: selectedProp.color,
                                        color: "white",
                                        padding: "2px 4px",
                                        borderRadius: "3px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                } else if (isTagged) {
                                  const taggedItem = Object.entries(
                                    taggedItems
                                  ).find(([key]) => stemmedWord === key);
                                  return (
                                    <span
                                      key={wordIndex}
                                      style={{
                                        backgroundColor:
                                          taggedItem?.[1]?.color || "#ccc",
                                        color: "white",
                                        padding: "1px 2px",
                                        borderRadius: "2px",
                                        opacity: 0.7,
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                }

                                return word;
                              });
                            };

                            return (
                              <div
                                key={blockIndex}
                                style={getElementStyle(block.type)}
                              >
                                {renderContent()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
    </div>
  );
}

// Characters Module - Card Grid Redesign
function CharactersModule({
  characters,
  setCharacters,
  characterSceneOverrides,
  setCharacterSceneOverrides,
  getFinalCharacterScenes,
  scenes,
  castCrew,
  setCastCrew,
  wardrobeItems,
  garmentInventory,
  taggedItems,
  continuityElements,
  stripboardScenes,
  setActiveModule,
  setCurrentIndex,
  onUpdateCharacters,
  onUpdateCharacterOverrides,
  syncCastCrewToDatabase,
  selectedProject,
  userRole,
  canEdit,
  isViewOnly,
}) {
  console.log("👤 CHARACTERS MODULE LOADED");
  console.log("👤 Characters data:", characters);
  console.log("👤 Characters count:", Object.keys(characters || {}).length);

  const [showDeleteDialog, setShowDeleteDialog] = useState(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [showDetailsPopup, setShowDetailsPopup] = useState(null);
  const [showScenesPopup, setShowScenesPopup] = useState(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    castAssignment: true,
    scenes: false,
    wardrobe: false,
    props: false,
    makeup: false,
    continuity: false,
  });

  // Image upload handlers
  const handleImageUpload = async (characterName, file) => {
    const actor = getActorForCharacter(characterName);
    if (!actor) return;

    // Upload image
    const result = await uploadImage(
      file,
      selectedProject.id,
      "actors",
      actor.id,
      `${actor.displayName.replace(/\s+/g, "_")}.jpg`
    );

    if (result.error) {
      alert(`Upload failed: ${result.error}`);
      return;
    }

    // Update castCrew state with new photo URL
    const updatedCastCrew = castCrew.map((person) =>
      person.id === actor.id ? { ...person, photoUrl: result.url } : person
    );

    setCastCrew(updatedCastCrew);
    syncCastCrewToDatabase(updatedCastCrew);
  };

  const handleImageDelete = async (characterName) => {
    const actor = getActorForCharacter(characterName);
    if (!actor || !actor.photoUrl) return;

    // Extract file path from URL and delete
    const filePath = extractPathFromUrl(actor.photoUrl);
    if (filePath) {
      await deleteImage(filePath);
    }

    // Update castCrew state to remove photo URL
    const updatedCastCrew = castCrew.map((person) =>
      person.id === actor.id ? { ...person, photoUrl: null } : person
    );

    setCastCrew(updatedCastCrew);
    syncCastCrewToDatabase(updatedCastCrew);
  };

  const cleanCharacterName = (rawName) => {
    let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
    cleaned = cleaned.replace(/[.,!?;:]$/, "");
    cleaned = cleaned.trim().toUpperCase();

    const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];

    if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
      return null;
    }

    return cleaned;
  };

  const deleteCharacter = (characterName) => {
    const character = characters[characterName];
    if (character.scenes.length > 0) {
      setShowDeleteDialog({ characterName, scenes: character.scenes });
    } else {
      const updated = { ...characters };
      delete updated[characterName];
      setCharacters(updated);
      if (onUpdateCharacters) {
        onUpdateCharacters(updated);
      }
    }
  };

  const confirmDelete = () => {
    const { characterName } = showDeleteDialog;
    const updated = { ...characters };

    if (reassignTarget && updated[reassignTarget]) {
      const scenesToReassign = updated[characterName].scenes;
      scenesToReassign.forEach((sceneNum) => {
        if (!updated[reassignTarget].scenes.includes(sceneNum)) {
          updated[reassignTarget].scenes.push(sceneNum);
        }
      });
    } else if (reassignTarget && !updated[reassignTarget]) {
      updated[reassignTarget] = {
        name: reassignTarget,
        scenes: [...updated[characterName].scenes],
        chronologicalNumber: 999,
      };
    }

    delete updated[characterName];

    const characterFirstAppearance = {};

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const cleanName = cleanCharacterName(block.text);
          if (
            cleanName &&
            updated[cleanName] &&
            !characterFirstAppearance[cleanName]
          ) {
            characterFirstAppearance[cleanName] = i;
          }
        }

        if (block.type === "Action") {
          Object.keys(updated).forEach((charName) => {
            if (!characterFirstAppearance[charName]) {
              const regex = new RegExp(`\\b${charName}\\b`, "i");
              if (regex.test(block.text)) {
                characterFirstAppearance[charName] = i;
              }
            }
          });
        }
      });
    }

    const sortedCharacters = Object.keys(updated).sort((a, b) => {
      const aFirstScene = characterFirstAppearance[a] || 999;
      const bFirstScene = characterFirstAppearance[b] || 999;
      return aFirstScene - bFirstScene;
    });

    sortedCharacters.forEach((charName, index) => {
      updated[charName].chronologicalNumber = index + 1;
    });

    setCharacters(updated);

    if (onUpdateCharacters) {
      onUpdateCharacters(updated);
    }

    setShowDeleteDialog(null);
    setReassignTarget("");
  };

  const cancelDelete = () => {
    setShowDeleteDialog(null);
    setReassignTarget("");
  };

  const searchScriptForCharacter = (characterName) => {
    const foundScenes = [];

    scenes.forEach((scene) => {
      let sceneHasCharacter = false;

      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const cleanName = cleanCharacterName(block.text);
          if (cleanName === characterName.toUpperCase()) {
            sceneHasCharacter = true;
          }
        } else if (block.type === "Action") {
          const regex = new RegExp(`\\b${characterName}\\b`, "i");
          if (regex.test(block.text)) {
            sceneHasCharacter = true;
          }
        }
      });

      if (sceneHasCharacter) {
        foundScenes.push(scene.sceneNumber);
      }
    });

    return foundScenes;
  };

  const addCharacter = () => {
    if (!newCharacterName.trim()) return;

    const characterName = newCharacterName.trim().toUpperCase();

    if (characters[characterName]) {
      alert(`Character "${characterName}" already exists.`);
      return;
    }

    const foundScenes = searchScriptForCharacter(characterName);

    if (foundScenes.length === 0) {
      alert(
        "Character not found in script. Please check spelling or add scenes manually after creating the character."
      );
    }

    const updatedCharacters = { ...characters };
    updatedCharacters[characterName] = {
      name: characterName,
      scenes: foundScenes,
      chronologicalNumber: 999,
    };

    const characterFirstAppearance = {};

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const cleanName = cleanCharacterName(block.text);
          if (
            cleanName &&
            updatedCharacters[cleanName] &&
            !characterFirstAppearance[cleanName]
          ) {
            characterFirstAppearance[cleanName] = i;
          }
        }

        if (block.type === "Action") {
          Object.keys(updatedCharacters).forEach((charName) => {
            if (!characterFirstAppearance[charName]) {
              const regex = new RegExp(`\\b${charName}\\b`, "i");
              if (regex.test(block.text)) {
                characterFirstAppearance[charName] = i;
              }
            }
          });
        }
      });
    }

    const sortedCharacters = Object.keys(updatedCharacters).sort((a, b) => {
      const aFirstScene = characterFirstAppearance[a] || 999;
      const bFirstScene = characterFirstAppearance[b] || 999;
      return aFirstScene - bFirstScene;
    });

    sortedCharacters.forEach((charName, index) => {
      updatedCharacters[charName].chronologicalNumber = index + 1;
    });

    setCharacters(updatedCharacters);

    if (onUpdateCharacters) {
      onUpdateCharacters(updatedCharacters);
    }

    setShowAddDialog(false);
    setNewCharacterName("");
  };

  const refreshCharacterDetection = () => {
    console.log("🔍 REFRESH DETECTION STARTING...");
    setCharacters({});

    const detectedCharacters = {};
    const characterFirstAppearance = {};

    scenes.forEach((scene, sceneIndex) => {
      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const cleanName = cleanCharacterName(block.text);
          if (cleanName) {
            if (!detectedCharacters[cleanName]) {
              detectedCharacters[cleanName] = {
                name: cleanName,
                scenes: [],
                chronologicalNumber: 999,
              };
              characterFirstAppearance[cleanName] = sceneIndex;
            }
            if (
              !detectedCharacters[cleanName].scenes.includes(scene.sceneNumber)
            ) {
              detectedCharacters[cleanName].scenes.push(scene.sceneNumber);
            }
          }
        }

        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((charName) => {
            const regex = new RegExp(`\\b${charName}\\b`, "i");
            if (regex.test(block.text)) {
              if (!characterFirstAppearance[charName]) {
                characterFirstAppearance[charName] = sceneIndex;
              }
              if (
                !detectedCharacters[charName].scenes.includes(scene.sceneNumber)
              ) {
                detectedCharacters[charName].scenes.push(scene.sceneNumber);
              }
            }
          });
        }
      });
    });

    const sortedCharacters = Object.keys(detectedCharacters).sort((a, b) => {
      const aFirstScene = characterFirstAppearance[a] || 999;
      const bFirstScene = characterFirstAppearance[b] || 999;
      return aFirstScene - bFirstScene;
    });

    sortedCharacters.forEach((charName, index) => {
      detectedCharacters[charName].chronologicalNumber = index + 1;
    });

    console.log("🔍 DETECTED CHARACTERS:", detectedCharacters);
    console.log("🔍 Character count:", Object.keys(detectedCharacters).length);

    setCharacters(detectedCharacters);

    if (onUpdateCharacters) {
      console.log("💾 Calling onUpdateCharacters to sync to database...");
      onUpdateCharacters(detectedCharacters);
      console.log("✅ Sync call completed");
    } else {
      console.log("❌ onUpdateCharacters is not defined!");
    }
  };

  // Toggle scene assignment for character
  const toggleSceneAssignment = (characterName, sceneNumber) => {
    console.log(
      "🔄 TOGGLE SCENE - Character:",
      characterName,
      "Scene:",
      sceneNumber
    );
    console.log("🔄 Current characters object:", characters);
    console.log(
      "🔄 Characters count BEFORE:",
      Object.keys(characters || {}).length
    );

    const updated = { ...characters };
    const character = updated[characterName];

    if (!character) {
      console.log("❌ Character not found:", characterName);
      return;
    }

    const sceneNumStr = String(sceneNumber);
    const sceneIndex = character.scenes.findIndex(
      (s) => String(s) === sceneNumStr
    );

    if (sceneIndex > -1) {
      // Remove scene - create new array without mutation
      updated[characterName] = {
        ...character,
        scenes: character.scenes.filter((s, i) => i !== sceneIndex),
      };
      console.log("➖ Removing scene", sceneNumber, "from", characterName);
    } else {
      // Add scene - create new sorted array without mutation
      const newScenes = [...character.scenes, sceneNumber].sort((a, b) => {
        const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
        const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
        return aNum - bNum;
      });
      updated[characterName] = {
        ...character,
        scenes: newScenes,
      };
      console.log("➕ Adding scene", sceneNumber, "to", characterName);
    }

    console.log("🔄 Updated object:", updated);
    console.log(
      "🔄 Characters count AFTER:",
      Object.keys(updated || {}).length
    );

    setCharacters(updated);

    // Sync ONLY the changed character to database (GRANULAR)
    console.log("💾 Syncing single character to database...");
    const characterToSync = updated[characterName];
    database
      .upsertCharacter(selectedProject, characterName, characterToSync)
      .catch((error) => {
        console.error("Failed to update character:", error);
        alert("Failed to update character. Error: " + error.message);
      });
  };

  // Get actor info from castCrew
  const getActorForCharacter = (characterName) => {
    return castCrew.find(
      (person) => person.type === "cast" && person.character === characterName
    );
  };

  const characterList = Object.values(characters).sort(
    (a, b) => (a.chronologicalNumber || 999) - (b.chronologicalNumber || 999)
  );

  const existingCharacters = Object.keys(characters).filter(
    (name) => name !== showDeleteDialog?.characterName
  );

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
            marginBottom: "10px",
          }}
        >
          <h2 style={{ margin: 0 }}>Characters</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {canEdit && (
              <>
                <button
                  onClick={() => setShowAddDialog(true)}
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
                  + Add Character
                </button>
                <button
                  onClick={refreshCharacterDetection}
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
                  Refresh Detection
                </button>
              </>
            )}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
          Total Characters: {characterList.length}
        </p>
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          padding: "20px",
          height: "calc(100% - 100px)",
          overflowY: "auto",
        }}
      >
        {/* Card Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "15px",
          }}
        >
          {characterList.map((character) => {
            const actor = getActorForCharacter(character.name);
            const finalScenes = getFinalCharacterScenes(character.name);

            return (
              <div
                key={`${character.name}-${actor?.photoUrl || "no-photo"}`}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "15px",
                  backgroundColor: "#fff",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                {/* Delete button */}
                {canEdit && (
                  <button
                    onClick={() => deleteCharacter(character.name)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "10px",
                      padding: "4px 8px",
                      fontWeight: "bold",
                    }}
                  >
                    Delete
                  </button>
                )}

                {/* Character Number */}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#2196F3",
                  }}
                >
                  {character.chronologicalNumber}.
                </div>

                {/* Actor Photo */}
                <div
                  style={{
                    width: "100%",
                    height: "200px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {actor?.photoUrl ? (
                    <img
                      src={actor.photoUrl}
                      alt={actor.displayName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: "48px",
                        color: "#ccc",
                      }}
                    >
                      👤
                    </div>
                  )}
                </div>

                {/* Character Name */}
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {character.name}
                </div>

                {/* Actor Name */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    textAlign: "center",
                    fontStyle: "italic",
                  }}
                >
                  {actor
                    ? `Played by ${actor.displayName}`
                    : "No actor assigned"}
                </div>

                {/* Scene Count */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "#999",
                    textAlign: "center",
                  }}
                >
                  {finalScenes.length} scene
                  {finalScenes.length !== 1 ? "s" : ""}
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => setShowDetailsPopup(character.name)}
                  style={{
                    backgroundColor: "#2196F3",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginTop: "5px",
                  }}
                >
                  View Details
                </button>
              </div>
            );
          })}
        </div>

        {characterList.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#999",
              fontSize: "16px",
            }}
          >
            No characters detected. Click "Refresh Detection" to scan your
            script.
          </div>
        )}
      </div>

      {/* Add Character Dialog */}
      {showAddDialog && (
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
            onClick={() => setShowAddDialog(false)}
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
            <h3 style={{ marginTop: 0 }}>Add New Character</h3>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}>
                <strong>Character Name:</strong>
              </label>
              <input
                type="text"
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder="Enter character name"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={addCharacter}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Add Character
              </button>
              <button
                onClick={() => setShowAddDialog(false)}
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

      {/* Delete Character Dialog */}
      {showDeleteDialog && (
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
            onClick={cancelDelete}
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
            <h3 style={{ marginTop: 0 }}>
              Delete Character: {showDeleteDialog.characterName}
            </h3>
            <p>
              This character appears in {showDeleteDialog.scenes.length}{" "}
              scene(s). What should happen to these scenes?
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="radio"
                  name="reassign"
                  value="existing"
                  onChange={() => setReassignTarget("")}
                  style={{ marginRight: "8px" }}
                />
                Reassign to existing character:
              </label>
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
              >
                <option value="">Select character...</option>
                {existingCharacters.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="radio"
                  name="reassign"
                  value="new"
                  onChange={() => setReassignTarget("")}
                  style={{ marginRight: "8px" }}
                />
                Create new character:
              </label>
              <input
                type="text"
                placeholder="Enter new character name"
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
              />

              <label style={{ display: "block" }}>
                <input
                  type="radio"
                  name="reassign"
                  value="none"
                  onChange={() => setReassignTarget("")}
                  style={{ marginRight: "8px" }}
                />
                Don't reassign (scenes will be lost)
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={confirmDelete}
                style={{
                  backgroundColor: "#f44336",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Confirm Delete
              </button>
              <button
                onClick={cancelDelete}
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

      {/* Character Details Popup */}
      {showDetailsPopup &&
        (() => {
          const character = characters[showDetailsPopup];
          const actor = getActorForCharacter(showDetailsPopup);
          const finalScenes = getFinalCharacterScenes(showDetailsPopup);

          // Get wardrobe for this character
          const wardrobeForCharacter = Array.isArray(wardrobeItems)
            ? wardrobeItems.find(
                (item) => item.characterName === showDetailsPopup
              )
            : null;
          const characterWardrobe = wardrobeForCharacter?.items || [];

          // Get props assigned to this character
          const characterProps = Object.values(taggedItems || {}).filter(
            (item) =>
              item.category === "Props" &&
              item.assignedCharacters &&
              item.assignedCharacters.includes(showDetailsPopup)
          );

          // Get makeup/hair assigned to this character
          const characterMakeup = Object.values(taggedItems || {}).filter(
            (item) =>
              item.category === "Makeup" &&
              item.assignedCharacters &&
              item.assignedCharacters.includes(showDetailsPopup)
          );

          // Get continuity elements for this character
          const characterContinuity = Array.isArray(continuityElements)
            ? continuityElements.filter(
                (element) => element.characterId === showDetailsPopup
              )
            : [];

          const toggleSection = (section) => {
            setExpandedSections((prev) => ({
              ...prev,
              [section]: !prev[section],
            }));
          };

          return (
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
                onClick={() => setShowDetailsPopup(null)}
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
                  padding: "0",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  zIndex: 1000,
                  width: "900px",
                  maxWidth: "90vw",
                  height: "90vh",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                {/* Header - Fixed */}
                <div
                  style={{
                    padding: "20px",
                    borderBottom: "1px solid #ddd",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px 8px 0 0",
                  }}
                >
                  <div>
                    <h2 style={{ margin: "0 0 5px 0" }}>{showDetailsPopup}</h2>
                    <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
                      Character #{character?.chronologicalNumber} •{" "}
                      {finalScenes.length} scenes
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailsPopup(null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      padding: "6px 12px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Content */}
                <div
                  style={{
                    padding: "20px",
                  }}
                >
                  {/* Cast Assignment Section - Always Visible */}
                  <div
                    style={{
                      marginBottom: "20px",
                      padding: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      backgroundColor: "#fff",
                    }}
                  >
                    {actor ? (
                      <>
                        <div
                          style={{
                            display: "flex",
                            gap: "15px",
                            marginBottom: "15px",
                          }}
                        >
                          {/* Image Upload Component */}
                          <div style={{ flexShrink: 0 }}>
                            <ImageUpload
                              currentImageUrl={actor.photoUrl}
                              onUpload={(file) =>
                                handleImageUpload(showDetailsPopup, file)
                              }
                              onDelete={() =>
                                handleImageDelete(showDetailsPopup)
                              }
                              label="Actor Photo"
                              disabled={isViewOnly}
                              compact={false}
                            />
                          </div>

                          {/* Actor Info */}
                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: "0 0 10px 0" }}>
                              {actor.displayName}
                            </h3>
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#666",
                                lineHeight: "1.6",
                              }}
                            >
                              {actor.email && (
                                <div>
                                  <strong>Email:</strong> {actor.email}
                                </div>
                              )}
                              {actor.phone && (
                                <div>
                                  <strong>Phone:</strong> {actor.phone}
                                </div>
                              )}
                              {actor.dietary && (
                                <div>
                                  <strong>Dietary:</strong>{" "}
                                  {typeof actor.dietary === "object"
                                    ? JSON.stringify(actor.dietary)
                                    : actor.dietary}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Go to Cast/Crew Button */}
                        <button
                          onClick={() => {
                            setShowDetailsPopup(null);
                            setActiveModule("Cast & Crew");
                          }}
                          style={{
                            backgroundColor: "#2196F3",
                            color: "white",
                            padding: "8px 16px",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          → Go to Cast & Crew
                        </button>

                        {/* Availability Summary */}
                        {(actor.availableDates?.length > 0 ||
                          actor.unavailableDates?.length > 0) && (
                          <div
                            style={{
                              marginTop: "15px",
                              padding: "10px",
                              backgroundColor: "#f9f9f9",
                              borderRadius: "4px",
                            }}
                          >
                            <strong style={{ fontSize: "12px" }}>
                              Availability Summary:
                            </strong>
                            <div style={{ fontSize: "12px", marginTop: "5px" }}>
                              {actor.availableDates?.length > 0 && (
                                <div style={{ color: "#4CAF50" }}>
                                  ✓ Available: {actor.availableDates.length}{" "}
                                  days
                                </div>
                              )}
                              {actor.unavailableDates?.length > 0 && (
                                <div style={{ color: "#f44336" }}>
                                  ✕ Unavailable: {actor.unavailableDates.length}{" "}
                                  days
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p style={{ color: "#999", fontStyle: "italic" }}>
                        No actor assigned to this character. Go to Cast & Crew
                        to assign an actor.
                      </p>
                    )}
                  </div>

                  {/* Scenes Section - Grid of Small Squares */}
                  <div
                    style={{
                      marginBottom: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: "6px 6px 0 0",
                      }}
                    >
                      <span
                        onClick={() => toggleSection("scenes")}
                        style={{ cursor: "pointer", flex: 1 }}
                      >
                        🎬 Scenes ({finalScenes.length} of {scenes.length})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowScenesPopup(showDetailsPopup);
                          setCurrentSceneIndex(0);
                        }}
                        style={{
                          backgroundColor: "white",
                          color: "#2196F3",
                          border: "none",
                          padding: "4px 12px",
                          borderRadius: "3px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          cursor: "pointer",
                          marginRight: "10px",
                        }}
                      >
                        View Scenes
                      </button>
                      <span
                        onClick={() => toggleSection("scenes")}
                        style={{ cursor: "pointer" }}
                      >
                        {expandedSections.scenes ? "▼" : "▶"}
                      </span>
                    </div>
                    {expandedSections.scenes && (
                      <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          {scenes.map((scene) => {
                            // Normalize both to strings for comparison
                            const sceneNumStr = String(scene.sceneNumber);
                            const isAssigned = finalScenes.some(
                              (s) => String(s) === sceneNumStr
                            );
                            return (
                              <div
                                key={scene.sceneNumber}
                                onDoubleClick={() => {
                                  if (!isViewOnly) {
                                    toggleSceneAssignment(
                                      showDetailsPopup,
                                      scene.sceneNumber
                                    );
                                  }
                                }}
                                style={{
                                  width: "25px",
                                  height: "25px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "1px solid #ddd",
                                  borderRadius: "3px",
                                  backgroundColor: isAssigned
                                    ? "#4CAF50"
                                    : "#f0f0f0",
                                  color: isAssigned ? "white" : "#666",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  cursor: isViewOnly ? "default" : "pointer",
                                }}
                                title={`${scene.heading}${
                                  isViewOnly
                                    ? ""
                                    : " (double-click to " +
                                      (isAssigned ? "remove" : "add") +
                                      ")"
                                }`}
                              >
                                {scene.sceneNumber}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Wardrobe Section */}
                  <div
                    style={{
                      marginBottom: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      onClick={() => toggleSection("wardrobe")}
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#9C27B0",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: "6px 6px 0 0",
                      }}
                    >
                      <span>
                        👔 Wardrobe ({characterWardrobe.length} looks)
                      </span>
                      <span>{expandedSections.wardrobe ? "▼" : "▶"}</span>
                    </div>
                    {expandedSections.wardrobe && (
                      <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                        {characterWardrobe.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {characterWardrobe.map((item, idx) => {
                              // Get garment details for this wardrobe item
                              const assignedGarments =
                                item.assignedGarments || [];
                              const garmentDetails = assignedGarments
                                .map((garmentId) => {
                                  if (Array.isArray(garmentInventory)) {
                                    return garmentInventory.find(
                                      (g) => g.id === garmentId
                                    );
                                  }
                                  return null;
                                })
                                .filter(Boolean);

                              const wardrobeKey = `wardrobe_${idx}`;
                              const isExpanded = expandedSections[wardrobeKey];

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    overflow: "hidden",
                                  }}
                                >
                                  {/* Wardrobe Look Header - Clickable */}
                                  <div
                                    onClick={() => toggleSection(wardrobeKey)}
                                    style={{
                                      padding: "10px 12px",
                                      backgroundColor: "#f5f5f5",
                                      cursor: "pointer",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          fontWeight: "bold",
                                          color: "#9C27B0",
                                        }}
                                      >
                                        #{item.number}:{" "}
                                        {item.description || "Untitled"}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "11px",
                                          color: "#666",
                                          marginTop: "2px",
                                        }}
                                      >
                                        {item.sceneRanges &&
                                          `Scenes: ${item.sceneRanges}`}
                                        {item.sceneRanges &&
                                          garmentDetails.length > 0 &&
                                          " • "}
                                        {garmentDetails.length} garment
                                        {garmentDetails.length !== 1 ? "s" : ""}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: "12px" }}>
                                      {isExpanded ? "▼" : "▶"}
                                    </span>
                                  </div>

                                  {/* Assigned Garments - Expandable */}
                                  {isExpanded && (
                                    <div
                                      style={{
                                        padding: "12px",
                                        backgroundColor: "#fafafa",
                                      }}
                                    >
                                      {garmentDetails.length > 0 ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "6px",
                                          }}
                                        >
                                          {garmentDetails.map(
                                            (garment, gIdx) => (
                                              <div
                                                key={gIdx}
                                                style={{
                                                  padding: "8px",
                                                  backgroundColor: "white",
                                                  border: "1px solid #ddd",
                                                  borderRadius: "4px",
                                                  fontSize: "11px",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    fontWeight: "bold",
                                                    marginBottom: "3px",
                                                  }}
                                                >
                                                  {garment.id} - {garment.name}
                                                </div>
                                                <div style={{ color: "#666" }}>
                                                  {garment.category} |{" "}
                                                  {garment.size} |{" "}
                                                  {garment.color} |{" "}
                                                  {garment.condition}
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      ) : (
                                        <div
                                          style={{
                                            fontSize: "11px",
                                            color: "#999",
                                            fontStyle: "italic",
                                          }}
                                        >
                                          No garments assigned to this wardrobe
                                          look
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: "#999", fontStyle: "italic" }}>
                            No wardrobe items assigned to this character.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Props Section */}
                  <div
                    style={{
                      marginBottom: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      onClick={() => toggleSection("props")}
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#FF9800",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: "6px 6px 0 0",
                      }}
                    >
                      <span>📦 Props ({characterProps.length})</span>
                      <span>{expandedSections.props ? "▼" : "▶"}</span>
                    </div>
                    {expandedSections.props && (
                      <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                        {characterProps.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            {characterProps.map((prop, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: "10px",
                                  border: "1px solid #eee",
                                  borderRadius: "4px",
                                  backgroundColor: "#fafafa",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    marginBottom: "5px",
                                  }}
                                >
                                  {prop.chronologicalNumber}.{" "}
                                  {prop.customTitle ||
                                    prop.displayName ||
                                    prop.word}
                                </div>
                                {prop.scenes && prop.scenes.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#999",
                                      marginTop: "5px",
                                    }}
                                  >
                                    Scenes: {prop.scenes.join(", ")}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "#999", fontStyle: "italic" }}>
                            No props assigned to this character.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Makeup/Hair Section */}
                  <div
                    style={{
                      marginBottom: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      onClick={() => toggleSection("makeup")}
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#E91E63",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: "6px 6px 0 0",
                      }}
                    >
                      <span>💄 Makeup/Hair ({characterMakeup.length})</span>
                      <span>{expandedSections.makeup ? "▼" : "▶"}</span>
                    </div>
                    {expandedSections.makeup && (
                      <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                        {characterMakeup.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            {characterMakeup.map((item, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: "10px",
                                  border: "1px solid #eee",
                                  borderRadius: "4px",
                                  backgroundColor: "#fafafa",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    marginBottom: "5px",
                                  }}
                                >
                                  {item.chronologicalNumber}.{" "}
                                  {item.customTitle ||
                                    item.displayName ||
                                    item.word}
                                </div>
                                {item.instances &&
                                  item.instances.length > 0 && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#666",
                                        marginTop: "5px",
                                      }}
                                    >
                                      {item.instances.length} variant(s)
                                    </div>
                                  )}
                                {item.scenes && item.scenes.length > 0 && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#999",
                                      marginTop: "5px",
                                    }}
                                  >
                                    Scenes: {item.scenes.join(", ")}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "#999", fontStyle: "italic" }}>
                            No makeup/hair items assigned to this character.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Continuity Elements Section */}
                  <div
                    style={{
                      marginBottom: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      onClick={() => toggleSection("continuity")}
                      style={{
                        padding: "12px 15px",
                        backgroundColor: "#607D8B",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: "6px 6px 0 0",
                      }}
                    >
                      <span>
                        📋 Continuity Elements ({characterContinuity.length})
                      </span>
                      <span>{expandedSections.continuity ? "▼" : "▶"}</span>
                    </div>
                    {expandedSections.continuity && (
                      <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                        {characterContinuity.length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            {characterContinuity.map((element, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: "10px",
                                  border: "1px solid #eee",
                                  borderRadius: "4px",
                                  backgroundColor: "#fafafa",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: "bold",
                                    marginBottom: "5px",
                                  }}
                                >
                                  {element.name || `Element ${idx + 1}`}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#666",
                                    marginBottom: "5px",
                                  }}
                                >
                                  Type: {element.type}
                                </div>
                                <div
                                  style={{ fontSize: "11px", color: "#999" }}
                                >
                                  Days {element.startDay} - {element.endDay}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "#999", fontStyle: "italic" }}>
                            No continuity elements tracked for this character.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

      {/* View Scenes Popup */}
      {showScenesPopup &&
        (() => {
          console.log("🎬 VIEW SCENES POPUP OPENING for:", showScenesPopup);
          const character = characters[showScenesPopup];
          const finalScenes = getFinalCharacterScenes(showScenesPopup);
          console.log("🎬 Character:", character);
          console.log("🎬 Final scenes:", finalScenes);

          const assignedScenes = scenes.filter((scene) =>
            finalScenes.some((s) => String(s) === String(scene.sceneNumber))
          );

          if (assignedScenes.length === 0) {
            return (
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
                  onClick={() => setShowScenesPopup(null)}
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
                  <h3>No Scenes Assigned</h3>
                  <p>This character has no scenes assigned yet.</p>
                  <button
                    onClick={() => setShowScenesPopup(null)}
                    style={{
                      backgroundColor: "#2196F3",
                      color: "white",
                      padding: "8px 16px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            );
          }

          const currentScene = assignedScenes[currentSceneIndex];

          return (
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
                onClick={() => setShowScenesPopup(null)}
              />
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: "white",
                  border: "2px solid #2196F3",
                  borderRadius: "8px",
                  padding: "0",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  zIndex: 1000,
                  width: "900px",
                  maxWidth: "90vw",
                  height: "80vh",
                  maxHeight: "80vh",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: "15px 20px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    borderRadius: "8px 8px 0 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <button
                      onClick={() =>
                        setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))
                      }
                      disabled={currentSceneIndex === 0}
                      style={{
                        backgroundColor:
                          currentSceneIndex === 0 ? "#ccc" : "white",
                        color: currentSceneIndex === 0 ? "#666" : "#2196F3",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "3px",
                        cursor:
                          currentSceneIndex === 0 ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      ← Prev
                    </button>
                    <div style={{ fontWeight: "bold" }}>
                      Scene {currentScene.sceneNumber} ({currentSceneIndex + 1}{" "}
                      of {assignedScenes.length})
                    </div>
                    <button
                      onClick={() =>
                        setCurrentSceneIndex(
                          Math.min(
                            assignedScenes.length - 1,
                            currentSceneIndex + 1
                          )
                        )
                      }
                      disabled={currentSceneIndex === assignedScenes.length - 1}
                      style={{
                        backgroundColor:
                          currentSceneIndex === assignedScenes.length - 1
                            ? "#ccc"
                            : "white",
                        color:
                          currentSceneIndex === assignedScenes.length - 1
                            ? "#666"
                            : "#2196F3",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "3px",
                        cursor:
                          currentSceneIndex === assignedScenes.length - 1
                            ? "not-allowed"
                            : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                  <button
                    onClick={() => setShowScenesPopup(null)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Scene Heading */}
                <div
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                    fontFamily: "Courier New, monospace",
                    fontSize: "12pt",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  {currentScene.heading}
                </div>

                {/* Script Content with exact Script module styling */}
                <div
                  style={{
                    flex: 1,
                    padding: "1.5in",
                    overflow: "auto",
                    backgroundColor: "white",
                    boxSizing: "border-box",
                    textAlign: "left",
                    fontFamily: "Courier New, monospace",
                  }}
                >
                  {/* Scene Heading */}
                  <div style={getElementStyle("Scene Heading")}>
                    {currentScene.heading}
                  </div>

                  {/* Scene Content */}
                  <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                    {currentScene.content.map((block, blockIndex) => (
                      <div key={blockIndex} style={getElementStyle(block.type)}>
                        {block.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          );
        })()}
    </div>
  );
}

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
  const [expandedDateSections, setExpandedDateSections] = React.useState({}); // For accordion collapses
  const [calendarDate, setCalendarDate] = React.useState(new Date());
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [newPersonId, setNewPersonId] = React.useState(null);
  const editableFieldsRef = React.useRef([]);

  // Build editable fields reference for tab navigation
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

  const dietaryOptions = [
    "None",
    "Pescatarian",
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Dairy-Free",
    "Nut Allergy",
    "Shellfish Allergy",
    "Kosher",
    "Halal",
    "Custom",
  ];

  const unionOptions = [
    "Non-Union",
    "SAG-AFTRA",
    "IATSE",
    "DGA",
    "WGA",
    "Teamsters Local 399",
    "Other Union",
  ];

  // Use Characters module data instead of extracting from scenes
  const characters =
    moduleCharacters && typeof moduleCharacters === "object"
      ? Object.keys(moduleCharacters).map((charName) => ({
          name: charName,
          type: "character",
        }))
      : [];

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const navigateMonth = (direction) => {
    setCalendarDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const selectDate = (day) => {
    console.log("selectDate called with day:", day);

    const selectedDate = new Date(
      calendarDate.getFullYear(),
      calendarDate.getMonth(),
      day
    );

    const dateStr = selectedDate.toISOString().split("T")[0];

    if (!showDatePicker) return;

    const personId = showDatePicker
      .replace("-availability", "")
      .replace("-booked", "");
    const person = castCrew.find((p) => p.id === personId);

    // Handle different modes
    if (showDatePicker.endsWith("-availability")) {
      // Cycle logic: White → Available (green) → Unavailable (red) → White
      const isAvailable =
        person?.availability?.availableDates?.includes(dateStr);
      const isUnavailable =
        person?.availability?.unavailableDates?.includes(dateStr);

      if (!isAvailable && !isUnavailable) {
        // State: White → Add Available (green)
        console.log("Adding to Available");
        addAvailableDate(personId, dateStr);
      } else if (isAvailable) {
        // State: Available → Change to Unavailable (red)
        console.log("Removing from Available, Adding to Unavailable");
        removeAvailableDate(personId, dateStr);
        addUnavailableDate(personId, dateStr);
      } else if (isUnavailable) {
        // State: Unavailable → Clear (white)
        console.log("Removing from Unavailable");
        removeUnavailableDate(personId, dateStr);
      }
    } else if (showDatePicker.endsWith("-booked")) {
      console.log("Toggling booked date");
      // Toggle booked date - remove if exists, add if doesn't
      const isAlreadyBooked =
        person?.availability?.bookedDates?.includes(dateStr);

      if (isAlreadyBooked) {
        removeBookedDate(personId, dateStr);
      } else {
        addBookedDate(personId, dateStr);
      }
    }
  };

  const addDateRange = async () => {
    if (!startDate || !endDate || !showDatePicker) return;

    const personId = showDatePicker
      .replace("-availability", "")
      .replace("-booked", "");
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    if (start > end) {
      alert("Start date must be before or equal to end date");
      return;
    }

    // Determine date type from picker mode
    let dateType = "available";
    if (showDatePicker.endsWith("-unavailable")) {
      dateType = "unavailable";
    } else if (showDatePicker.endsWith("-booked")) {
      dateType = "booked";
    }

    // Build date array for local state update
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          const fieldName = `${dateType}Dates`;
          const currentDates = person.availability?.[fieldName] || [];
          const newDates = dates.filter((date) => !currentDates.includes(date));

          return {
            ...person,
            availability: {
              ...person.availability,
              [fieldName]: [...currentDates, ...newDates].sort(),
            },
          };
        }
        return person;
      });
    });

    // ATOMIC SYNC - bulk date range operation
    try {
      await database.addAvailabilityDateRange(
        selectedProject,
        personId,
        startDate,
        endDate,
        dateType
      );
      console.log(`✅ ${dateType} date range synced to database`);
    } catch (error) {
      console.error("❌ Failed to sync date range:", error);
      alert(
        "⚠️ Failed to save date range.\n\nYour changes were not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }

    // Clear the date inputs and close picker
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

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Get the current person's dates for highlighting
    const personId = showDatePicker
      ? showDatePicker.replace("-availability", "").replace("-booked", "")
      : null;
    const currentPerson = personId
      ? castCrew.find((p) => p.id === personId)
      : null;
    const bookedDates =
      currentPerson?.availability?.bookedDates ||
      currentPerson?.bookedDates ||
      [];
    const availableDates =
      currentPerson?.availability?.availableDates ||
      currentPerson?.availableDates ||
      [];
    const unavailableDates =
      currentPerson?.availability?.unavailableDates ||
      currentPerson?.unavailableDates ||
      [];

    const calendar = [];

    // Header with month/year and navigation
    calendar.push(
      <div
        key="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
          padding: "0 5px",
        }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateMonth(-1);
          }}
          style={{
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ←
        </button>
        <div style={{ fontWeight: "bold", fontSize: "16px" }}>
          {monthNames[month]} {year}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateMonth(1);
          }}
          style={{
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          →
        </button>
      </div>
    );

    // Day names header
    calendar.push(
      <div
        key="daynames"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          marginBottom: "5px",
        }}
      >
        {dayNames.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontWeight: "bold",
              padding: "5px",
              fontSize: "12px",
              color: "#666",
            }}
          >
            {day}
          </div>
        ))}
      </div>
    );

    // Calendar grid
    const calendarGrid = [];
    let day = 1;

    for (let week = 0; week < 6; week++) {
      const weekRow = [];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (week === 0 && dayOfWeek < firstDay) {
          // Empty cells before month starts
          weekRow.push(
            <div key={`empty-${dayOfWeek}`} style={{ padding: "8px" }}></div>
          );
        } else if (day <= daysInMonth) {
          const currentDay = day; // Capture the current day value
          const currentDate = new Date(year, month, currentDay);
          const currentDateStr = currentDate.toISOString().split("T")[0];
          const isPast = currentDateStr < todayStr;
          const isBooked = bookedDates.includes(currentDateStr);
          const isAvailable = availableDates.includes(currentDateStr);
          const isUnavailable = unavailableDates.includes(currentDateStr);

          // Determine background color priority: unavailable > available > booked > default
          let bgColor = "white";
          if (isPast) {
            bgColor = "#f0f0f0";
          } else if (isUnavailable) {
            bgColor = "#ffcdd2"; // Light red
          } else if (isAvailable) {
            bgColor = "#c8e6c9"; // Light green
          } else if (isBooked) {
            bgColor = "#FFF59D"; // Light yellow
          }

          weekRow.push(
            <button
              key={currentDay}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isPast) selectDate(currentDay);
              }}
              disabled={isPast}
              style={{
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: isPast ? "not-allowed" : "pointer",
                backgroundColor: bgColor,
                color: isPast ? "#999" : "black",
                fontWeight:
                  isBooked || isAvailable || isUnavailable ? "bold" : "normal",
              }}
            >
              {currentDay}
            </button>
          );
          day++;
        } else {
          // Empty cells after month ends
          weekRow.push(
            <div
              key={`empty-end-${dayOfWeek}`}
              style={{ padding: "8px" }}
            ></div>
          );
        }
      }

      if (weekRow.some((cell) => cell.key && !cell.key.includes("empty"))) {
        calendarGrid.push(
          <div
            key={`week-${week}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "2px",
              marginBottom: "2px",
            }}
          >
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
    let currentValue = "";

    if (subField) {
      currentValue = person[field]?.[subField] || "";
    } else {
      currentValue = person[field] || "";
    }

    // Clear default placeholder text when starting to edit
    if (
      currentValue === "New Person" ||
      currentValue === "Enter name" ||
      currentValue === "Enter position"
    ) {
      currentValue = "";
    }

    setEditValue(currentValue);
    setEditingField({ personId, field, subField });
  };

  const saveEdit = () => {
    if (!editingField) return;

    const { personId, field, subField } = editingField;

    // Get original value to check if anything actually changed
    const originalPerson = castCrew.find((p) => p.id === personId);
    const originalValue = subField
      ? originalPerson?.[field]?.[subField]
      : originalPerson?.[field];

    // If no change made, just cancel editing
    if (editValue === originalValue) {
      setEditingField(null);
      setEditValue("");
      return;
    }

    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        if (person.id === personId) {
          if (subField) {
            return {
              ...person,
              [field]: {
                ...person[field],
                [subField]: editValue,
              },
            };
          } else {
            return {
              ...person,
              [field]: editValue,
            };
          }
        }
        return person;
      });

      // Update only the changed person to database (efficient single update)
      const changedPerson = updatedPeople.find((p) => p.id === personId);
      if (changedPerson) {
        database
          .updateSingleCastCrewPerson(selectedProject, changedPerson)
          .catch((error) => {
            console.error("Failed to update person:", error);
            alert(
              "Failed to update " +
                changedPerson.displayName +
                ".\n\n" +
                "Error: " +
                error.message +
                "\n\n" +
                "Please try again."
            );
            // Revert local state on error
            loadCastCrewFromDatabase();
          });
      }

      return updatedPeople;
    });

    // If this was a new person being edited on the name field, allow sorting
    if (newPersonId === personId && field === "displayName") {
      setNewPersonId(null);
    }

    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      saveEdit();
      // If this was a new person, allow sorting now
      if (newPersonId === editingField?.personId) {
        setNewPersonId(null);
      }
    } else if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Tab") {
      e.preventDefault();

      // Find current field index
      const currentField = editableFieldsRef.current.find(
        (f) =>
          f.personId === editingField?.personId &&
          f.field === editingField?.field &&
          f.subField === editingField?.subField
      );

      if (currentField) {
        const currentIndex = editableFieldsRef.current.indexOf(currentField);
        const nextIndex = (currentIndex + 1) % editableFieldsRef.current.length;
        const nextField = editableFieldsRef.current[nextIndex];

        // Save current edit
        saveEdit();

        // Start editing next field
        setTimeout(() => {
          startEdit(nextField.personId, nextField.field, nextField.subField);
        }, 0);
      }
    }
  };

  const addUnavailableDate = async (personId, date) => {
    if (!date) return;

    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];

    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          const currentDates = person.availability?.unavailableDates || [];
          if (!currentDates.includes(localDate)) {
            return {
              ...person,
              availability: {
                ...person.availability,
                unavailableDates: [...currentDates, localDate].sort(),
              },
            };
          }
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date
    try {
      await database.addAvailabilityDateSafe(
        selectedProject,
        personId,
        localDate,
        "unavailable"
      );
      console.log("✅ Unavailable date synced to database");
    } catch (error) {
      console.error("❌ Failed to sync unavailable date:", error);
      alert(
        "⚠️ Failed to save unavailability date.\n\nYour change was not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeUnavailableDate = async (personId, dateToRemove) => {
    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          return {
            ...person,
            availability: {
              ...person.availability,
              unavailableDates: (
                person.availability?.unavailableDates || []
              ).filter((date) => date !== dateToRemove),
            },
          };
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date removal
    try {
      await database.removeAvailabilityDateSafe(
        selectedProject,
        personId,
        dateToRemove,
        "unavailable"
      );
      console.log("✅ Unavailable date removal synced to database");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert(
        "⚠️ Failed to remove unavailability date.\n\nYour change was not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const addAvailableDate = async (personId, date) => {
    console.log("addAvailableDate called with:", { personId, date });
    if (!date) return;

    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];
    console.log("localDate calculated as:", localDate);

    // Update local state immediately for UI responsiveness
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          const currentDates = person.availability?.availableDates || [];
          if (!currentDates.includes(localDate)) {
            return {
              ...person,
              availability: {
                ...person.availability,
                availableDates: [...currentDates, localDate].sort(),
              },
            };
          }
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date
    try {
      await database.addAvailabilityDateSafe(
        selectedProject,
        personId,
        localDate,
        "available"
      );
      console.log("✅ Available date synced to database");
    } catch (error) {
      console.error("❌ Failed to sync available date:", error);
      alert(
        "⚠️ Failed to save availability date.\n\nYour change was not saved. Please try again."
      );
      // Reload from database to restore correct state
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeAvailableDate = async (personId, dateToRemove) => {
    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          return {
            ...person,
            availability: {
              ...person.availability,
              availableDates: (
                person.availability?.availableDates || []
              ).filter((date) => date !== dateToRemove),
            },
          };
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date removal
    try {
      await database.removeAvailabilityDateSafe(
        selectedProject,
        personId,
        dateToRemove,
        "available"
      );
      console.log("✅ Available date removal synced to database");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert(
        "⚠️ Failed to remove availability date.\n\nYour change was not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  // NEW: Add Booked Date functions
  const addBookedDate = async (personId, date) => {
    if (!date) return;

    const localDate = new Date(date + "T00:00:00").toISOString().split("T")[0];

    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          const currentDates = person.availability?.bookedDates || [];
          if (!currentDates.includes(localDate)) {
            return {
              ...person,
              availability: {
                ...person.availability,
                bookedDates: [...currentDates, localDate].sort(),
              },
            };
          }
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date
    try {
      await database.addAvailabilityDateSafe(
        selectedProject,
        personId,
        localDate,
        "booked"
      );
      console.log("✅ Booked date synced to database");
    } catch (error) {
      console.error("❌ Failed to sync booked date:", error);
      alert(
        "⚠️ Failed to save booked date.\n\nYour change was not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  const removeBookedDate = async (personId, dateToRemove) => {
    // Update local state immediately
    setCastCrew((prevPeople) => {
      return prevPeople.map((person) => {
        if (person.id === personId) {
          return {
            ...person,
            availability: {
              ...person.availability,
              bookedDates: (person.availability?.bookedDates || []).filter(
                (date) => date !== dateToRemove
              ),
            },
          };
        }
        return person;
      });
    });

    // ATOMIC SYNC - only this specific date removal
    try {
      await database.removeAvailabilityDateSafe(
        selectedProject,
        personId,
        dateToRemove,
        "booked"
      );
      console.log("✅ Booked date removal synced to database");
    } catch (error) {
      console.error("❌ Failed to sync date removal:", error);
      alert(
        "⚠️ Failed to remove booked date.\n\nYour change was not saved. Please try again."
      );
      database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    }
  };

  // Toggle accordion for date sections
  const toggleDateSection = (personId, section) => {
    setExpandedDateSections((prev) => ({
      ...prev,
      [`${personId}-${section}`]: !prev[`${personId}-${section}`],
    }));
  };

  const deletePerson = async (personId) => {
    // Update local state first
    const updatedPeople = castCrew.filter((person) => person.id !== personId);
    setCastCrew(updatedPeople);

    // Delete ONLY this person from database (GRANULAR)
    try {
      await database.deleteCastCrewPerson(selectedProject, personId);
      console.log("✅ Person deleted successfully");
    } catch (error) {
      console.error("❌ Failed to delete person:", error);
      // Revert local state on error
      setCastCrew(castCrew);
      alert("Failed to delete person. Please try again.");
    }
  };

  const linkUserToPerson = (personId) => {
    if (!user?.id) {
      alert("User ID not found. Please try logging out and back in.");
      return;
    }

    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        // Unlink all other people first
        if (person.user_id === user.id && person.id !== personId) {
          return {
            ...person,
            user_id: null,
          };
        }
        // Link this person
        if (person.id === personId) {
          return {
            ...person,
            user_id: user.id,
          };
        }
        return person;
      });

      // Immediate sync for user linking (GRANULAR - only this person)
      const linkedPerson = updatedPeople.find((p) => p.id === personId);
      if (linkedPerson) {
        database
          .updateCastCrewPerson(selectedProject, linkedPerson)
          .catch((error) => {
            console.error("Failed to link user:", error);
            alert("Failed to link user. Error: " + error.message);
          });
      }

      return updatedPeople;
    });

    alert(
      `Successfully linked your account to ${
        castCrew.find((p) => p.id === personId)?.displayName || "this person"
      }!`
    );
  };

  const unlinkUserFromPerson = (personId) => {
    setCastCrew((prevPeople) => {
      const updatedPeople = prevPeople.map((person) => {
        if (person.id === personId) {
          return {
            ...person,
            user_id: null,
          };
        }
        return person;
      });

      // Immediate sync for user unlinking (GRANULAR - only this person)
      const unlinkedPerson = updatedPeople.find((p) => p.id === personId);
      if (unlinkedPerson) {
        database
          .updateCastCrewPerson(selectedProject, unlinkedPerson)
          .catch((error) => {
            console.error("Failed to unlink user:", error);
            alert("Failed to unlink user. Error: " + error.message);
          });
      }

      return updatedPeople;
    });

    alert("Successfully unlinked your account!");
  };

  // Modal state for adding new person
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonForm, setNewPersonForm] = useState({
    name: "",
    type: "cast",
    department: "Other",
    character: "",
    position: "",
    phone: "",
    email: "",
    isInternational: false,
  });

  const openAddPersonModal = () => {
    setNewPersonForm({
      name: "",
      type: "cast",
      department: "Other",
      character: "",
      position: "",
      phone: "",
      email: "",
      isInternational: false,
    });
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
    // Validate required fields
    if (!newPersonForm.name.trim()) {
      alert("Name is required");
      return;
    }

    if (newPersonForm.type === "crew" && !newPersonForm.department.trim()) {
      alert("Department is required for crew members");
      return;
    }

    if (newPersonForm.type === "cast" && !newPersonForm.character.trim()) {
      alert("Character is required for cast members");
      return;
    }

    const newPersonIdValue = crypto.randomUUID();
    const newPerson = {
      id: newPersonIdValue,
      displayName: newPersonForm.name.trim(),
      position:
        newPersonForm.type === "cast"
          ? newPersonForm.character.trim()
          : newPersonForm.position.trim(),
      type: newPersonForm.type,
      character:
        newPersonForm.type === "cast" ? newPersonForm.character.trim() : "",
      crewDepartment:
        newPersonForm.type === "crew" ? newPersonForm.department : "Other",
      email: newPersonForm.email.trim(),
      phone: newPersonForm.phone.trim(),
      height: "",
      weight: "",
      emergencyContact: {
        name: "",
        phone: "",
        relationship: "",
      },
      wardrobe: {
        chest: "",
        waist: "",
        hips: "",
        shoe: "",
        pants: "",
        shirt: "",
        dress: "",
      },
      dietary: { restrictions: "None", customRestriction: "" },
      unionStatus: "Non-Union",
      unionNumber: "",
      unavailableDates: [],
      availableDates: [],
      bookedDates: [],
      notes: "",
    };

    setNewPersonId(newPersonIdValue);

    // Add to local state
    const updatedPeople = [newPerson, ...castCrew];
    setCastCrew(updatedPeople);

    // Add ONLY this person to database (GRANULAR)
    database
      .addCastCrewPerson(selectedProject, newPerson)
      .then(() => {
        console.log("✅ Person added successfully");
      })
      .catch((error) => {
        console.error("❌ Failed to add person:", error);
        // Revert local state on error
        setCastCrew(castCrew);
        alert("Failed to add person. Please try again.");
      });

    // Close modal and reset form
    setShowAddPersonModal(false);
    setNewPersonForm({
      name: "",
      type: "cast",
      department: "Other",
      character: "",
      position: "",
      phone: "",
      email: "",
      isInternational: false,
    });
  };

  const renderCharacterDropdown = (person) => {
    const isEditing =
      editingField?.personId === person.id &&
      editingField?.field === "character";

    const displayValue = person.character || "";
    const bgColor = displayValue ? "#4CAF50" : "#757575";

    if (isEditing) {
      return (
        <div style={{ position: "relative", display: "inline-block" }}>
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyPress}
            autoFocus
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              fontSize: "12px",
              padding: "2px 4px",
              border: "1px solid #2196F3",
              borderRadius: "3px",
              minWidth: "120px",
              backgroundColor: "white",
              zIndex: 1000,
            }}
          >
            <option value="">Select character...</option>
            {characters.map((char) => (
              <option key={char.name} value={char.name}>
                {char.name}
              </option>
            ))}
          </select>
          {/* Invisible placeholder to maintain layout */}
          <span
            style={{
              visibility: "hidden",
              padding: "2px 6px",
              borderRadius: "8px",
              backgroundColor: bgColor,
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
              minWidth: "80px",
              display: "inline-block",
              textAlign: "center",
            }}
          >
            {displayValue || "No Character"}
          </span>
        </div>
      );
    }

    return (
      <span
        onClick={() => startEdit(person.id, "character")}
        style={{
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: "8px",
          backgroundColor: bgColor,
          color: "white",
          fontSize: "10px",
          fontWeight: "bold",
          minWidth: "80px",
          display: "inline-block",
          textAlign: "center",
        }}
        title="Click to edit"
      >
        {displayValue || "No Character"}
      </span>
    );
  };

  const renderEditableField = (
    person,
    field,
    subField = null,
    placeholder = "",
    type = "text",
    options = null
  ) => {
    const isEditing =
      editingField?.personId === person.id &&
      editingField?.field === field &&
      editingField?.subField === subField;

    let displayValue = subField ? person[field]?.[subField] : person[field];
    if (!displayValue) displayValue = "";

    if (isEditing) {
      if (options) {
        return (
          <div style={{ position: "relative", display: "inline-block" }}>
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyPress}
              autoFocus
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                fontSize: "12px",
                padding: "2px 4px",
                border: "1px solid #2196F3",
                borderRadius: "3px",
                minWidth: "120px",
                backgroundColor: "white",
                zIndex: 1000,
              }}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {/* Invisible placeholder to maintain layout */}
            <span
              style={{
                visibility: "hidden",
                fontSize: "12px",
                padding: "2px 4px",
              }}
            >
              {displayValue || placeholder}
            </span>
          </div>
        );
      } else {
        return (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            autoFocus
            style={{
              fontSize: "12px",
              padding: "2px 4px",
              border: "1px solid #2196F3",
              borderRadius: "3px",
              minWidth: "60px",
              width: "auto",
            }}
          />
        );
      }
    }

    if (field === "type") {
      const bgColor =
        displayValue === "cast"
          ? "#4CAF50"
          : displayValue === "crew"
          ? "#2196F3"
          : "#FF9800";
      return (
        <span
          onClick={() => startEdit(person.id, field, subField)}
          style={{
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: "12px",
            backgroundColor: bgColor,
            color: "white",
            fontSize: "11px",
            textTransform: "uppercase",
            fontWeight: "bold",
          }}
          title="Click to edit"
        >
          {displayValue || "CAST"}
        </span>
      );
    }

    if (field === "crewDepartment") {
      const bgColor = "#FF6B35";
      return (
        <span
          onClick={() => startEdit(person.id, field, subField)}
          style={{
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: "8px",
            backgroundColor: bgColor,
            color: "white",
            fontSize: "10px",
            fontWeight: "bold",
          }}
          title="Click to edit"
        >
          {displayValue || "Other"}
        </span>
      );
    }

    if (field === "unionStatus") {
      const bgColor = displayValue === "Non-Union" ? "#757575" : "#4CAF50";
      return (
        <span
          onClick={() => startEdit(person.id, field, subField)}
          style={{
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: "8px",
            backgroundColor: bgColor,
            color: "white",
            fontSize: "10px",
            fontWeight: "bold",
          }}
          title="Click to edit"
        >
          {displayValue || "Non-Union"}
        </span>
      );
    }

    return (
      <span
        onClick={() => startEdit(person.id, field, subField)}
        style={{
          cursor: "pointer",
          padding: "1px 3px",
          borderRadius: "2px",
          fontSize: "12px",
          minHeight: "16px",
          display: "inline-block",
        }}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#f5f5f5")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "transparent")}
        title="Click to edit"
      >
        {displayValue || (
          <span style={{ color: "#ccc", fontStyle: "italic" }}>
            {placeholder}
          </span>
        )}
      </span>
    );
  };

  const renderPersonCard = (person) => {
    const isExpanded = expandedCards[person.id] || false;

    const toggleExpanded = () => {
      setExpandedCards((prev) => ({
        ...prev,
        [person.id]: !prev[person.id],
      }));
    };

    return (
      <PresenceIndicator
        key={person.id}
        itemId={person.id}
        otherUsers={otherUsers}
        position="top"
      >
        <div
          style={{
            border: "1px solid #ddd",
            padding: "5px",
            margin: "3px 0",
            borderRadius: "4px",
            backgroundColor: "#fff",
            position: "relative",
            fontSize: "12px",
          }}
        >
          {canEdit && (
            <button
              onClick={() => deletePerson(person.id)}
              style={{
                position: "absolute",
                top: "6px",
                right: "20px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                fontSize: "10px",
                padding: "2px 4px",
                width: "16px",
                height: "16px",
              }}
            >
              ×
            </button>
          )}

          {/* Link/Unlink button */}
          {(() => {
            const userIsLinked = castCrew.some((p) => p.user_id === user?.id);

            if (person.user_id === user?.id) {
              // This person is linked to current user - show Unlink
              return (
                <button
                  onClick={() => unlinkUserFromPerson(person.id)}
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "40px",
                    backgroundColor: "#FF9800",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "9px",
                    padding: "3px 6px",
                    fontWeight: "bold",
                  }}
                  title="Unlink your account from this person"
                >
                  Unlink
                </button>
              );
            } else if (!userIsLinked && !person.user_id) {
              // User not linked to anyone, and this person not linked - show Link to Me
              return (
                <button
                  onClick={() => linkUserToPerson(person.id)}
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "40px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "9px",
                    padding: "3px 6px",
                    fontWeight: "bold",
                  }}
                  title="Link this person to your user account"
                >
                  Link to Me
                </button>
              );
            }
            return null;
          })()}

          {/* Row 1: Name, Position, Type, Character/Department, Email, Phone, Date Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "3px",
              paddingRight: "25px",
            }}
          >
            {/* Name — fixed 150px */}
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                width: "150px",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {renderEditableField(person, "displayName", null, "Enter name")}
            </div>

            {/* Position — fixed 140px, always rendered */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                width: "140px",
                flexShrink: 0,
              }}
            >
              <strong
                style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}
              >
                POS:
              </strong>
              {person.type !== "cast" ? (
                renderEditableField(person, "position", null, "Enter position")
              ) : (
                <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>
              )}
            </div>

            {/* Type badge — fixed 52px */}
            <div style={{ width: "52px", flexShrink: 0 }}>
              {renderEditableField(person, "type", null, "cast", "text", [
                "cast",
                "crew",
                "misc",
              ])}
            </div>

            {/* Character / Dept — fixed 170px, always rendered */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                width: "170px",
                flexShrink: 0,
              }}
            >
              {person.type === "cast" && (
                <>
                  <strong
                    style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}
                  >
                    CHAR:
                  </strong>
                  {renderCharacterDropdown(person)}
                </>
              )}
              {person.type === "crew" && (
                <>
                  <strong
                    style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}
                  >
                    DEPT:
                  </strong>
                  {renderEditableField(
                    person,
                    "crewDepartment",
                    null,
                    "Other",
                    "text",
                    crewDepartments
                  )}
                </>
              )}
              {person.type === "misc" && (
                <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>
              )}
            </div>

            {/* Email — fixed 255px */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                width: "255px",
                flexShrink: 0,
              }}
            >
              <strong
                style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}
              >
                EMAIL:
              </strong>
              {renderEditableField(
                person,
                "email",
                null,
                "Enter Email",
                "email"
              )}
            </div>

            {/* Spacer to push right side */}
            <div style={{ flex: 1 }}></div>

            {/* Phone — right justified, before date buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                width: "150px",
                flexShrink: 0,
              }}
            >
              <strong
                style={{ color: "#888", fontSize: "10px", flexShrink: 0 }}
              >
                PHONE:
              </strong>
              {renderEditableField(person, "phone", null, "Enter Phone")}
            </div>

            {/* Date Buttons - Right aligned */}
            {canEdit && (
              <div style={{ display: "flex", gap: "8px", marginRight: "60px" }}>
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setShowDatePicker(`${person.id}-booked`);
                  }}
                  style={{
                    backgroundColor: "#FF9800",
                    color: "white",
                    padding: "2px 6px",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "10px",
                  }}
                >
                  Add Booked
                </button>
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setShowDatePicker(`${person.id}-availability`);
                  }}
                  style={{
                    background:
                      "linear-gradient(to right, #4CAF50 50%, #f44336 50%)",
                    color: "white",
                    padding: "2px 6px",
                    border: "none",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "10px",
                  }}
                  title="Click to open calendar. Click dates to cycle through: Available → Unavailable → Clear"
                >
                  Add Availability
                </button>
              </div>
            )}
          </div>

          {/* Accordion-Style Date Sections */}
          <div style={{ marginBottom: "3px" }}>
            {/* Booked Dates Accordion */}
            {(person.availability?.bookedDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div
                  onClick={() => toggleDateSection(person.id, "booked")}
                  style={{
                    backgroundColor: "#FFF3E0",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "#E65100",
                    border: "1px solid #FFB74D",
                    userSelect: "none",
                  }}
                >
                  {expandedDateSections[`${person.id}-booked`] ? "▼" : "►"}{" "}
                  Booked ({(person.availability?.bookedDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-booked`] && (
                  <div
                    style={{
                      marginTop: "3px",
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    {(person.availability?.bookedDates || []).map((date) => (
                      <span
                        key={`booked-${date}`}
                        style={{
                          display: "inline-block",
                          backgroundColor: "#FFF3E0",
                          color: "#E65100",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          border: "1px solid #FFB74D",
                          cursor: "pointer",
                        }}
                        onClick={() => removeBookedDate(person.id, date)}
                        title="Click to remove booked date"
                      >
                        📅 {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Available Dates Accordion */}
            {(person.availability?.availableDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div
                  onClick={() => toggleDateSection(person.id, "available")}
                  style={{
                    backgroundColor: "#e8f5e8",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "#2e7d32",
                    border: "1px solid #4caf50",
                    userSelect: "none",
                  }}
                >
                  {expandedDateSections[`${person.id}-available`] ? "▼" : "►"}{" "}
                  Available (
                  {(person.availability?.availableDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-available`] && (
                  <div
                    style={{
                      marginTop: "3px",
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    {(person.availability?.availableDates || []).map((date) => (
                      <span
                        key={`available-${date}`}
                        style={{
                          display: "inline-block",
                          backgroundColor: "#e8f5e8",
                          color: "#2e7d32",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontSize: "10px",
                          border: "1px solid #4caf50",
                          cursor: "pointer",
                        }}
                        onClick={() => removeAvailableDate(person.id, date)}
                        title="Click to remove available date"
                      >
                        ✅ {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Unavailable Dates Accordion */}
            {(person.availability?.unavailableDates || []).length > 0 && (
              <div style={{ marginBottom: "5px" }}>
                <div
                  onClick={() => toggleDateSection(person.id, "unavailable")}
                  style={{
                    backgroundColor: "#ffebee",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "#c62828",
                    border: "1px solid #ef5350",
                    userSelect: "none",
                  }}
                >
                  {expandedDateSections[`${person.id}-unavailable`] ? "▼" : "►"}{" "}
                  Unavailable (
                  {(person.availability?.unavailableDates || []).length})
                </div>
                {expandedDateSections[`${person.id}-unavailable`] && (
                  <div
                    style={{
                      marginTop: "3px",
                      display: "flex",
                      gap: "4px",
                      flexWrap: "wrap",
                    }}
                  >
                    {(person.availability?.unavailableDates || []).map(
                      (date) => (
                        <span
                          key={`unavailable-${date}`}
                          style={{
                            display: "inline-block",
                            backgroundColor: "#ffebee",
                            color: "#c62828",
                            padding: "2px 6px",
                            borderRadius: "8px",
                            fontSize: "10px",
                            border: "1px solid #ef5350",
                            cursor: "pointer",
                          }}
                          onClick={() => removeUnavailableDate(person.id, date)}
                          title="Click to remove unavailable date"
                        >
                          ❌ {formatDate(date)}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <div style={{ marginBottom: "3px" }}>
            <button
              onClick={toggleExpanded}
              style={{
                backgroundColor: "#2196F3",
                color: "white",
                padding: "2px 8px",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "10px",
              }}
            >
              {isExpanded ? "Show Less" : "Show More"}
            </button>
          </div>

          {isExpanded && (
            <div>
              {/* Height, Weight, Wardrobe - Modified based on person type */}
              <div style={{ marginBottom: "3px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    marginBottom: "2px",
                  }}
                >
                  {/* Height and Weight only for cast */}
                  {person.type === "cast" && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <strong>Height:</strong>{" "}
                        {renderEditableField(person, "height", null, "5'10\"")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <strong>Weight:</strong>{" "}
                        {renderEditableField(person, "weight", null, "150 lbs")}
                      </div>
                    </>
                  )}
                </div>

                {/* Wardrobe Sizes (Cast Only) */}
                {person.type === "cast" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontSize: "11px",
                    }}
                  >
                    <strong style={{ fontSize: "12px" }}>Wardrobe:</strong>
                    <span>
                      Pants:{" "}
                      {renderEditableField(person, "wardrobe", "pants", "32")}
                    </span>
                    <span>
                      Shirt:{" "}
                      {renderEditableField(person, "wardrobe", "shirt", "M")}
                    </span>
                    <span>
                      Dress:{" "}
                      {renderEditableField(person, "wardrobe", "dress", "8")}
                    </span>
                    <span>
                      Shoe:{" "}
                      {renderEditableField(person, "wardrobe", "shoe", "9")}
                    </span>
                    <span>
                      Chest:{" "}
                      {renderEditableField(person, "wardrobe", "chest", "40")}
                    </span>
                    <span>
                      Waist:{" "}
                      {renderEditableField(person, "wardrobe", "waist", "32")}
                    </span>
                    <span>
                      Hips:{" "}
                      {renderEditableField(person, "wardrobe", "hips", "36")}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "3px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <strong>Dietary/Allergies:</strong>{" "}
                  {renderEditableField(
                    person,
                    "dietary",
                    "restrictions",
                    "None",
                    "text",
                    dietaryOptions
                  )}
                  {person.dietary?.restrictions === "Custom" && (
                    <span style={{ marginLeft: "4px" }}>
                      {renderEditableField(
                        person,
                        "dietary",
                        "customRestriction",
                        "Enter specific dietary/allergy details"
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: "3px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <strong>Union:</strong>{" "}
                  {renderEditableField(
                    person,
                    "unionStatus",
                    null,
                    "Non-Union",
                    "text",
                    unionOptions
                  )}
                </div>
              </div>

              {person.unionStatus && person.unionStatus !== "Non-Union" && (
                <div style={{ marginBottom: "3px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <strong>Union #:</strong>{" "}
                    {renderEditableField(
                      person,
                      "unionNumber",
                      null,
                      "Enter info"
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              <div style={{ marginBottom: "3px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "15px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <strong>Emergency Contact:</strong>{" "}
                    {renderEditableField(
                      person,
                      "emergencyContact",
                      "name",
                      "Contact Name"
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <strong>Phone:</strong>{" "}
                    {renderEditableField(
                      person,
                      "emergencyContact",
                      "phone",
                      "Phone Number"
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <strong>Relationship:</strong>{" "}
                    {renderEditableField(
                      person,
                      "emergencyContact",
                      "relationship",
                      "Spouse, Parent, etc."
                    )}
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

  // Helper function to extract last name
  const getLastName = (displayName) => {
    if (!displayName) return "";
    const parts = displayName.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  };

  // Fixed the grouped constant with last name sorting
  const grouped = {
    cast: castCrew
      .filter((p) => p.type === "cast")
      .sort((a, b) => {
        // Keep new person at top
        if (a.id === newPersonId) return -1;
        if (b.id === newPersonId) return 1;

        // Sort by character chronological number (same as Characters tab)
        const characterA = moduleCharacters[a.character];
        const characterB = moduleCharacters[b.character];

        const numberA = characterA?.chronologicalNumber || 999;
        const numberB = characterB?.chronologicalNumber || 999;

        if (numberA !== numberB) {
          return numberA - numberB;
        }

        // Fallback to alphabetical by character name if numbers are same
        return (a.character || "").localeCompare(b.character || "");
      }),
    crew: castCrew
      .filter((p) => p.type === "crew")
      .sort((a, b) => {
        // Keep new person at top
        if (a.id === newPersonId) return -1;
        if (b.id === newPersonId) return 1;

        // Sort by last name alphabetically
        const lastNameA = getLastName(a.displayName);
        const lastNameB = getLastName(b.displayName);
        return lastNameA.localeCompare(lastNameB);
      }),
    misc: castCrew
      .filter((p) => p.type === "misc")
      .sort((a, b) => {
        // Keep new person at top
        if (a.id === newPersonId) return -1;
        if (b.id === newPersonId) return 1;

        // Sort by last name alphabetically
        const lastNameA = getLastName(a.displayName);
        const lastNameB = getLastName(b.displayName);
        return lastNameA.localeCompare(lastNameB);
      }),
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
      {/* Fixed header with Add Person button */}
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
          }}
        >
          <h2 style={{ margin: 0 }}>Cast & Crew</h2>
          {isViewOnly && (
            <div
              style={{
                padding: "8px 16px",
                backgroundColor: "#FF9800",
                color: "white",
                borderRadius: "4px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              VIEW ONLY MODE
            </div>
          )}
          {canEdit && (
            <button
              onClick={openAddPersonModal}
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
              + Add Person
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content area */}
      <div
        style={{
          padding: "0 20px 20px 20px",
          height: "calc(100% - 80px)",
          overflowY: "auto",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            color: "#666",
            fontStyle: "italic",
            marginBottom: "15px",
          }}
        >
          Click any field to edit • Use Tab to navigate between fields •
          Availability: Click dates to cycle White → Green (Available) → Red
          (Unavailable) → White
        </p>

        {/* Cast Section */}
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              fontSize: "24px",
              color: "#333",
              marginBottom: "5px",
              padding: "8px",
              backgroundColor: "#A5D6A7",
              textAlign: "center",
              fontWeight: "bold",
              borderRadius: "4px",
            }}
          >
            Cast ({grouped.cast.length})
          </div>
          {grouped.cast.length === 0 ? (
            <p>No cast members added yet.</p>
          ) : (
            grouped.cast.map(renderPersonCard)
          )}
        </div>

        {/* Crew Section - Subdivided by Department */}
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              fontSize: "24px",
              color: "#333",
              marginBottom: "5px",
              padding: "8px",
              backgroundColor: "#A5D6A7",
              textAlign: "center",
              fontWeight: "bold",
              borderRadius: "4px",
            }}
          >
            Crew ({grouped.crew.length})
          </div>
          {grouped.crew.length === 0 ? (
            <p>No crew members added yet.</p>
          ) : (
            crewSortOrder.map((department) => {
              const departmentCrew = grouped.crew.filter(
                (person) => (person.crewDepartment || "Other") === department
              );

              if (departmentCrew.length === 0) return null;

              return (
                <div key={department} style={{ marginBottom: "20px" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "white",
                      marginBottom: "5px",
                      padding: "8px",
                      backgroundColor: "#FFC107",
                      textAlign: "center",
                      fontWeight: "bold",
                      borderRadius: "4px",
                    }}
                  >
                    {department} ({departmentCrew.length})
                  </div>
                  {departmentCrew.map(renderPersonCard)}
                </div>
              );
            })
          )}
        </div>

        {/* Misc Section */}
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              fontSize: "24px",
              color: "#333",
              marginBottom: "5px",
              padding: "8px",
              backgroundColor: "#A5D6A7",
              textAlign: "center",
              fontWeight: "bold",
              borderRadius: "4px",
            }}
          >
            Misc ({grouped.misc.length})
          </div>
          {grouped.misc.length === 0 ? (
            <p>No misc contacts added yet.</p>
          ) : (
            grouped.misc.map(renderPersonCard)
          )}
        </div>

        {/* Date Picker Modal Popup */}
        {showDatePicker && (
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
              onClick={() => setShowDatePicker(null)}
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
                width: "400px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: "15px" }}>
                {showDatePicker.endsWith("-unavailable")
                  ? "Add Unavailable Date(s)"
                  : showDatePicker.endsWith("-booked")
                  ? "Add Booked Date(s)"
                  : "Add Available Date(s)"}
              </h3>

              {/* Instructions */}
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginBottom: "10px",
                  padding: "8px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                }}
              >
                <strong>Instructions:</strong>{" "}
                {showDatePicker.endsWith("-availability")
                  ? "Click dates to cycle: White → Green (Available) → Red (Unavailable) → White"
                  : "Double-click any date to add/remove it."}{" "}
                <br />
                Green = Available, Red = Unavailable, Yellow = Booked.
              </div>

              {/* Custom Calendar */}
              <div style={{ marginBottom: "15px" }}>{renderCalendar()}</div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowDatePicker(null)}
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
                  Done
                </button>
              </div>
            </div>
          </>
        )}

        {/* Add Person Modal */}
        {showAddPersonModal && (
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
              onClick={() => setShowAddPersonModal(false)}
            />
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                zIndex: 1000,
                minWidth: "400px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0, marginBottom: "20px" }}>
                Add New Person
              </h3>

              {/* Name Field */}
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Name *
                </label>
                <input
                  type="text"
                  value={newPersonForm.name}
                  onChange={(e) =>
                    setNewPersonForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter person's name"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Type Dropdown */}
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Type *
                </label>
                <select
                  value={newPersonForm.type}
                  onChange={(e) =>
                    setNewPersonForm((prev) => ({
                      ...prev,
                      type: e.target.value,
                      department: e.target.value === "crew" ? "Other" : "",
                      character: e.target.value === "cast" ? "" : "",
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="cast">Cast</option>
                  <option value="crew">Crew</option>
                </select>
              </div>

              {/* Conditional Character/Department Field */}
              <div style={{ marginBottom: "20px" }}>
                {newPersonForm.type === "cast" ? (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      Character *
                    </label>
                    <input
                      type="text"
                      value={newPersonForm.character}
                      onChange={(e) =>
                        setNewPersonForm((prev) => ({
                          ...prev,
                          character: e.target.value,
                        }))
                      }
                      placeholder="Enter character name"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    />
                  </>
                ) : (
                  <>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "bold",
                      }}
                    >
                      Department *
                    </label>
                    <select
                      value={newPersonForm.department}
                      onChange={(e) =>
                        setNewPersonForm((prev) => ({
                          ...prev,
                          department: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "14px",
                        boxSizing: "border-box",
                      }}
                    >
                      {crewDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Position Field (for crew only) */}
              {newPersonForm.type === "crew" && (
                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "bold",
                    }}
                  >
                    Position
                  </label>
                  <input
                    type="text"
                    value={newPersonForm.position}
                    onChange={(e) =>
                      setNewPersonForm((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                    placeholder="e.g., Gaffer, 1st AC, Producer"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Phone Field */}
              <div style={{ marginBottom: "15px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "5px",
                  }}
                >
                  <label style={{ fontWeight: "bold" }}>Phone</label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: "normal",
                      fontSize: "12px",
                      color: "#555",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newPersonForm.isInternational}
                      onChange={(e) =>
                        setNewPersonForm((prev) => ({
                          ...prev,
                          isInternational: e.target.checked,
                          phone: "",
                        }))
                      }
                    />
                    International
                  </label>
                </div>
                <input
                  type="tel"
                  value={newPersonForm.phone}
                  onChange={(e) =>
                    setNewPersonForm((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(
                        e.target.value,
                        prev.isInternational
                      ),
                    }))
                  }
                  placeholder={
                    newPersonForm.isInternational
                      ? "+1 (555) 555-5555 or +44 20 7946 0958"
                      : "(555) 555-5555"
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Email Field */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={newPersonForm.email}
                  onChange={(e) =>
                    setNewPersonForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowAddPersonModal(false)}
                  style={{
                    backgroundColor: "#ccc",
                    color: "#333",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addNewPerson}
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

// CallSheet Module
function CallSheetModule({
  scenes: callSheetScenes,
  shootingDays,
  castCrew,
  onUpdateCastCrew,
  characters,
  stripboardScenes,
  scheduledScenes,
  projectSettings,
  setProjectSettings,
  callSheetData,
  setCallSheetData,
  updateCrewCallTime,
  wardrobeItems,
  scriptLocations,
  actualLocations,
  getFinalCharacterScenes,
  syncCallSheetData,
  selectedProject,
}) {
  const exportCallSheetPDF = async () => {
    if (!selectedDay) return;

    if (!window.pdfMake) {
      alert("PDF library not available. Please refresh the page.");
      return;
    }

    try {
      const scenes = getScheduledScenes();

      // Build location groups for rowSpan
      const locationGroups = [];
      let currentGroup = null;
      let sceneRowIndex = 0;

      scenes.forEach((scene, index) => {
        if (scene.scene === "LUNCH") {
          if (currentGroup) {
            // Extend the group AND increase rowSpan to include LUNCH row
            currentGroup.rowSpan++;
          }
          sceneRowIndex++; // Increment to count LUNCH as a table row
          return;
        }

        // Get physical address
        let physicalAddress = scene.location || "";
        const matchingScriptLocation = scriptLocations.find(
          (scriptLoc) =>
            scriptLoc.scenes &&
            (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
              scriptLoc.scenes.includes(scene.scene.toString()))
        );

        if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
          const actualLocation = actualLocations.find(
            (actual) => actual.id === matchingScriptLocation.actualLocationId
          );
          if (actualLocation && actualLocation.address) {
            const addressParts = [
              actualLocation.address,
              actualLocation.city,
              actualLocation.state,
              actualLocation.zipCode,
            ].filter(Boolean);
            physicalAddress = addressParts.join(", ");
          }
        }

        const normalized = physicalAddress.toLowerCase().trim();

        if (!currentGroup || currentGroup.location !== normalized) {
          if (currentGroup) {
            locationGroups.push(currentGroup);
          }
          currentGroup = {
            location: normalized,
            address: physicalAddress,
            startRow: sceneRowIndex,
            rowSpan: 1,
          };
        } else {
          currentGroup.rowSpan++;
        }

        sceneRowIndex++;
      });

      if (currentGroup) {
        locationGroups.push(currentGroup);
      }

      // Build scenes table body
      const scenesTableBody = [];
      sceneRowIndex = 0;

      scenes.forEach((scene) => {
        if (scene.scene === "LUNCH") {
          const lunchRow = [
            {
              text: scene.time,
              fontSize: 6,
              alignment: "center",
              fillColor: "#90EE90",
            },
            {
              text: "LUNCH",
              colSpan: 9,
              fontSize: 6,
              bold: true,
              alignment: "center",
              fillColor: "#90EE90",
            },
            {},
            {},
            {},
            {},
            {},
            {},
            {},
            {},
          ];

          // Check if location column is covered by rowSpan from above
          const isInRowSpan = locationGroups.some(
            (g) =>
              sceneRowIndex > g.startRow &&
              sceneRowIndex < g.startRow + g.rowSpan
          );

          // If NOT covered by rowSpan, add empty location cell
          if (!isInRowSpan) {
            lunchRow.push({ text: "", fontSize: 6, fillColor: "#90EE90" });
          }

          scenesTableBody.push(lunchRow);
          sceneRowIndex++; // Increment after adding LUNCH row
        } else {
          const stripboardScene = stripboardScenes.find(
            (s) => s.sceneNumber == scene.scene
          );
          const pageNum = stripboardScene?.pageNumber || "1";
          const mainScene = callSheetScenes.find(
            (s) => s.sceneNumber == scene.scene
          );
          const pageLength = mainScene?.pageLength || scene.pages || "1/8";

          const locationGroup = locationGroups.find(
            (g) => g.startRow === sceneRowIndex
          );
          const isInRowSpan =
            !locationGroup &&
            locationGroups.some(
              (g) =>
                sceneRowIndex > g.startRow &&
                sceneRowIndex < g.startRow + g.rowSpan
            );

          const row = [
            { text: scene.time, fontSize: 6, alignment: "center" },
            { text: scene.scene.toString(), fontSize: 6, alignment: "center" },
            { text: scene.ie, fontSize: 6, alignment: "center" },
            { text: scene.location, fontSize: 6 },
            { text: scene.cast, fontSize: 6 },
            { text: scene.dn, fontSize: 6, alignment: "center" },
            { text: pageNum.toString(), fontSize: 6, alignment: "center" },
            { text: pageLength, fontSize: 6, alignment: "center" },
            { text: scene.wardrobe || "", fontSize: 6 },
            { text: scene.props || "", fontSize: 6 },
          ];

          // Only add location cell if starting a rowSpan or not covered by one
          if (locationGroup) {
            row.push({
              text: locationGroup.address,
              fontSize: 6,
              alignment: "center",
              rowSpan: locationGroup.rowSpan,
              valign: "middle", // ← Vertical centering in pdfMake
            });
          } else if (!isInRowSpan) {
            row.push({ text: "", fontSize: 6 });
          }
          // If isInRowSpan is true, don't add anything - the cell is covered by rowSpan from above

          scenesTableBody.push(row);
          sceneRowIndex++;
        }
      });

      // Add total row
      scenesTableBody.push([
        {
          text: "TOTAL PAGES",
          colSpan: 7,
          bold: true,
          alignment: "center",
          fontSize: 8,
        },
        {},
        {},
        {},
        {},
        {},
        {},
        { text: totalPages, bold: true, fontSize: 8 },
        {},
        {},
        {},
      ]);

      // Build cast table
      const castTableBody = daycast.map((cast) => [
        { text: cast.number.toString(), alignment: "center", fontSize: 7 },
        { text: cast.cast, fontSize: 7 },
        { text: cast.character, fontSize: 7 },
        { text: cast.makeup || "", alignment: "center", fontSize: 7 },
        { text: cast.set || "", alignment: "center", fontSize: 7 },
        { text: cast.specialInstructions || "", fontSize: 7 },
      ]);

      // Build crew tables
      const { leftTable, rightTable } = distributeCrewToTables();

      const buildCrewTable = (table) => {
        const rows = [];
        table.forEach((item) => {
          if (item.type === "header") {
            rows.push([
              {
                text: item.department.toUpperCase(),
                colSpan: 4,
                bold: true,
                alignment: "center",
                fillColor: "#f0f0f0",
                fontSize: 7,
              },
              {},
              {},
              {},
            ]);
          } else {
            rows.push([
              { text: item.position, fontSize: 7 },
              { text: item.displayName, fontSize: 7 },
              { text: item.phone, fontSize: 7, alignment: "center" },
              {
                text: callSheetData.crewCallTimes?.[item.id] || "",
                fontSize: 7,
                alignment: "center",
              },
            ]);
          }
        });
        return rows;
      };

      const leftCrewBody = buildCrewTable(leftTable);
      const rightCrewBody = buildCrewTable(rightTable);

      const date = new Date(selectedDay.date + "T00:00:00"); // Force local timezone
      const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate()
      ).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;

      const docDefinition = {
        pageSize: "LETTER",
        pageMargins: [25, 25, 25, 25],
        content: [
          // Header
          {
            table: {
              widths: [177, 178, 177],
              body: [
                [
                  {
                    stack: [
                      {
                        text: [
                          { text: "Producer: ", bold: true },
                          { text: projectSettings.producer || "TBD" },
                        ],
                        fontSize: 8,
                        margin: [0, 1, 0, 1],
                      },
                      {
                        text: [
                          { text: "Director: ", bold: true },
                          { text: projectSettings.director || "TBD" },
                        ],
                        fontSize: 8,
                        margin: [0, 1, 0, 1],
                      },
                      {
                        text: [
                          { text: "Hospital: ", bold: true },
                          {
                            text:
                              projectSettings.nearestHospital?.name || "TBD",
                          },
                        ],
                        fontSize: 8,
                        margin: [0, 1, 0, 1],
                      },
                      {
                        text: [
                          { text: "Phone: ", bold: true },
                          {
                            text: projectSettings.nearestHospital?.phone || "",
                          },
                        ],
                        fontSize: 8,
                        margin: [0, 1, 0, 1],
                      },
                      {
                        text: projectSettings.nearestHospital?.address || "",
                        fontSize: 7,
                        margin: [0, 1, 0, 0],
                      },
                    ],
                    margin: [3, 3, 3, 3],
                  },
                  {
                    text: projectSettings.filmTitle || "FILM TITLE",
                    fontSize: 16,
                    bold: true,
                    alignment: "center",
                    fillColor: "#cccccc",
                    margin: [0, 18, 0, 0],
                  },
                  {
                    stack: [
                      {
                        columns: [
                          {
                            text: dateStr,
                            fontSize: 15,
                            bold: true,
                            width: "auto",
                          },
                          {
                            text: `Day ${selectedDay.dayNumber} of ${shootingDays.length}`,
                            fontSize: 8,
                            alignment: "right",
                            width: "*",
                          },
                        ],
                        margin: [0, 3, 0, 0],
                      },
                      { text: "", margin: [0, 2, 0, 0] },
                      {
                        columns: [
                          { text: "SU", fontSize: 7, width: "auto" },
                          {
                            text: "SUNSET",
                            fontSize: 7,
                            alignment: "right",
                            width: "*",
                          },
                        ],
                      },
                      {
                        columns: [
                          {
                            text: weather?.sunrise || "6:45 AM",
                            fontSize: 7,
                            width: "auto",
                          },
                          {
                            text: weather?.sunset || "7:30 PM",
                            fontSize: 7,
                            alignment: "right",
                            width: "*",
                          },
                        ],
                      },
                      {
                        columns: [
                          {
                            text: `WE ${weather?.temp || 72}°`,
                            fontSize: 7,
                            width: "auto",
                          },
                          {
                            text: `HI ${weather?.temp + 5 || 77}°`,
                            fontSize: 7,
                            alignment: "right",
                            width: "*",
                          },
                        ],
                      },
                      {
                        columns: [
                          { text: "HU 10%", fontSize: 7, width: "auto" },
                          {
                            text: weather?.condition || "Clear",
                            fontSize: 7,
                            alignment: "right",
                            width: "*",
                          },
                        ],
                      },
                    ],
                    margin: [3, 3, 3, 3],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 1.5,
              vLineWidth: () => 1,
            },
            margin: [0, 0, 0, 5],
          },

          // Notes and Call Time - COMPACT
          {
            columns: [
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        stack: [
                          {
                            text: "NOTES:",
                            bold: true,
                            fontSize: 8,
                            margin: [0, 0, 0, 2],
                          },
                          { text: currentDayNotes || "", fontSize: 9 },
                        ],
                        margin: [3, 3, 3, 3],
                      },
                    ],
                  ],
                },
                layout: "noBorders",
                width: 195,
              },
              {
                table: {
                  widths: [65, 107],
                  body: [
                    [
                      {
                        text: "CALL",
                        fontSize: 14,
                        bold: true,
                        alignment: "center",
                        margin: [0, 15, 0, 15],
                      },
                      {
                        text: callTime,
                        fontSize: 14,
                        bold: true,
                        alignment: "center",
                        margin: [0, 15, 0, 15],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 1.5,
                  vLineWidth: () => 1.5,
                },
                width: 172,
              },
              {
                text: "",
                width: 195,
              },
            ],
            margin: [0, 0, 0, 5],
          },

          // Scenes Table
          {
            table: {
              headerRows: 1,
              widths: [30, 16, 16, 46, 100, 18, 16, 20, 40, 40, 126],
              body: [
                [
                  {
                    text: "TIME",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "SC",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "I/E",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "LOCATION/DESC",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "CAST",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "D/N",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "PG#",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "PGS",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "WARDROBE",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "PROPS",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                  {
                    text: "LOCATION",
                    fontSize: 6,
                    bold: true,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                ],
                ...scenesTableBody,
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingTop: () => 1,
              paddingBottom: () => 1,
            },
            margin: [0, 0, 0, 5],
          },

          // Cast Table
          {
            table: {
              headerRows: 1,
              widths: [25, 95, 95, 48, 48, 200],
              body: [
                [
                  {
                    text: "#",
                    alignment: "center",
                    fillColor: "#f0f0f0",
                    fontSize: 7,
                  },
                  { text: "CAST", fillColor: "#f0f0f0", fontSize: 7 },
                  { text: "CHARACTER", fillColor: "#f0f0f0", fontSize: 7 },
                  {
                    text: "MU",
                    alignment: "center",
                    fillColor: "#f0f0f0",
                    fontSize: 7,
                  },
                  {
                    text: "SET",
                    alignment: "center",
                    fillColor: "#f0f0f0",
                    fontSize: 7,
                  },
                  {
                    text: "SPECIAL INSTRUCTIONS",
                    fillColor: "#f0f0f0",
                    fontSize: 7,
                  },
                ],
                ...castTableBody,
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
            margin: [0, 0, 0, 5],
          },

          // Production Notes
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "PRODUCTION NOTES",
                    bold: true,
                    fontSize: 9,
                    alignment: "center",
                    fillColor: "#f0f0f0",
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
            },
            margin: [0, 0, 0, 0],
          },
          {
            columns: [
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        stack: productionNotes.slice(0, 2).map((note) => ({
                          text: [
                            { text: `${note}: `, bold: true },
                            { text: customNotes[note] || "" },
                          ],
                          fontSize: 8,
                          margin: [0, 1, 0, 1],
                        })),
                        margin: [3, 3, 3, 3],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                },
                width: "50%",
              },
              {
                table: {
                  widths: ["*"],
                  body: [
                    [
                      {
                        stack: productionNotes.slice(2).map((note) => ({
                          text: [
                            { text: `${note}: `, bold: true },
                            { text: customNotes[note] || "" },
                          ],
                          fontSize: 8,
                          margin: [0, 1, 0, 1],
                        })),
                        margin: [3, 3, 3, 3],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                },
                width: "50%",
              },
            ],
            margin: [0, 0, 0, 5],
          },

          // Crew Tables - Side by Side with Gap
          {
            columns: [
              {
                table: {
                  headerRows: 1,
                  widths: [55, 75, 55, 52],
                  body:
                    leftCrewBody.length > 0
                      ? [
                          [
                            {
                              text: "POSITION",
                              fillColor: "#f0f0f0",
                              fontSize: 7,
                            },
                            { text: "NAME", fillColor: "#f0f0f0", fontSize: 7 },
                            {
                              text: "PHONE",
                              fillColor: "#f0f0f0",
                              fontSize: 7,
                            },
                            { text: "IN", fillColor: "#f0f0f0", fontSize: 7 },
                          ],
                          ...leftCrewBody,
                        ]
                      : [[{ text: "", colSpan: 4 }, {}, {}, {}]],
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  paddingTop: () => 1,
                  paddingBottom: () => 1,
                },
                width: 275,
              },
              {
                table: {
                  headerRows: 1,
                  widths: [55, 75, 55, 52],
                  body:
                    rightCrewBody.length > 0
                      ? [
                          [
                            {
                              text: "POSITION",
                              fillColor: "#f0f0f0",
                              fontSize: 7,
                            },
                            { text: "NAME", fillColor: "#f0f0f0", fontSize: 7 },
                            {
                              text: "PHONE",
                              fillColor: "#f0f0f0",
                              fontSize: 7,
                            },
                            { text: "IN", fillColor: "#f0f0f0", fontSize: 7 },
                          ],
                          ...rightCrewBody,
                        ]
                      : [[{ text: "", colSpan: 4 }, {}, {}, {}]],
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  paddingTop: () => 1,
                  paddingBottom: () => 1,
                },
                width: 275,
              },
            ],
            columnGap: 15,
          },
        ],
      };

      const filename = `call-sheet-${selectedDay.date}.pdf`;
      PDFExporter.download(docDefinition, filename);

      alert(`Call sheet exported as: ${filename}`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Error: " + error.message);
    }
  };
  const exportSidesPDF = () => {
    if (!selectedDay) return;

    const jsPDF = window.jspdf?.jsPDF || window.jsPDF?.jsPDF || window.jsPDF;

    if (!jsPDF) {
      alert(
        "PDF export library not available. Please add jsPDF to your project."
      );
      return;
    }

    // Get scenes for this day
    const dayScenes = getScheduledScenes()
      .filter((scene) => scene.scene !== "LUNCH" && scene.scene !== "ADR")
      .map((scene) => callSheetScenes.find((s) => s.sceneNumber == scene.scene))
      .filter(Boolean)
      .filter((scene) => {
        const heading = scene.heading?.toUpperCase() || "";
        const hasIntExt = heading.includes("INT.") || heading.includes("EXT.");
        if (!hasIntExt) {
          const hasWrittenBy = scene.content?.some((block) =>
            block.text?.toLowerCase().includes("written by")
          );
          return !hasWrittenBy;
        }
        return true;
      })
      .sort((a, b) => {
        const aNum = parseInt(a.sceneNumber);
        const bNum = parseInt(b.sceneNumber);
        if (aNum !== bNum) return aNum - bNum;
        return String(a.sceneNumber).localeCompare(String(b.sceneNumber));
      });

    if (dayScenes.length === 0) {
      alert("No scenes scheduled for this day.");
      return;
    }

    const doc = new jsPDF("portrait", "pt", "letter");
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 72;
    const lineHeight = 12;
    const maxLinesPerPage = 59;

    let yPos = margin;
    let currentLine = 0;

    doc.setFont("Courier", "normal");
    doc.setFontSize(12);

    // Header
    const headerText = `Shoot Day ${selectedDay.dayNumber} - ${formatDate(
      selectedDay.date
    )}`;
    doc.setFont("Courier", "bold");
    doc.setFontSize(10);
    doc.text(headerText, pageWidth / 2, yPos, { align: "center" });
    doc.setFont("Courier", "normal");
    doc.setFontSize(12);
    yPos += 24;
    currentLine += 2;

    // Process each scene
    dayScenes.forEach((scene, sceneIndex) => {
      // Check for page break before scene
      if (currentLine + 3 > maxLinesPerPage) {
        doc.addPage();
        yPos = margin;
        currentLine = 0;
      }

      // Scene heading
      doc.setFont("Courier", "bold");
      yPos += lineHeight;
      currentLine++;
      doc.text(String(scene.sceneNumber), margin - 50, yPos);
      doc.text(scene.heading.toUpperCase(), margin, yPos);
      doc.text(String(scene.sceneNumber), pageWidth - margin + 10, yPos);

      yPos += lineHeight * 2;
      currentLine += 2;
      doc.setFont("Courier", "normal");

      // Process content blocks
      scene.content.forEach((block) => {
        const style = getElementStyle(block.type);
        const leftMargin = margin + (parseInt(style.marginLeft) || 0);
        const rightMargin = parseInt(style.marginRight) || 5;
        const maxWidth =
          pageWidth -
          margin * 2 -
          (parseInt(style.marginLeft) || 0) -
          rightMargin;

        let text = block.text;
        if (block.type === "Character") {
          text = text.toUpperCase();
        }

        // Split text into lines using maxWidth
        const lines = doc.splitTextToSize(text, maxWidth);

        // Check if block fits on page
        if (currentLine + lines.length + 1 > maxLinesPerPage) {
          doc.addPage();
          yPos = margin;
          currentLine = 0;
        }

        // Render each line
        lines.forEach((line) => {
          yPos += lineHeight;
          currentLine++;
          doc.text(line, leftMargin, yPos);
        });

        // Spacing after block
        yPos += lineHeight;
        currentLine++;
      });
    });

    // Save
    const date = new Date(selectedDay.date);
    const dateStr = date.toISOString().split("T")[0];
    const filename = `sides-day-${selectedDay.dayNumber}-${dateStr}.pdf`;
    doc.save(filename);

    alert(`Sides exported as: ${filename}`);
  };

  // Smart default selection function
  const getSmartDefaultDay = (shootingDays) => {
    if (!shootingDays || shootingDays.length === 0) return null;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // If today matches a shooting day, select it
    const todayMatch = shootingDays.find((day) => day.date === todayStr);
    if (todayMatch) return todayMatch;

    // Find closest future day
    const futureDays = shootingDays
      .filter((day) => day.date > todayStr)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (futureDays.length > 0) return futureDays[0];

    // Fallback to most recent past day
    const pastDays = shootingDays
      .filter((day) => day.date < todayStr)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return pastDays.length > 0 ? pastDays[0] : shootingDays[0];
  };

  const [selectedDay, setSelectedDay] = React.useState(null);
  const [weather, setWeather] = React.useState(null);
  const [removalModal, setRemovalModal] = React.useState(null); // { crewMember, isBooked }
  const [manualCast, setManualCast] = React.useState([]);
  const [productionNotes, setProductionNotes] = React.useState([
    "Allowed Guests",
    "No. of Stand-ins",
    "Special Props",
    "Special Atmosphere",
  ]);
  const autoPopulatedDays = React.useRef(new Set()); // Track which days have been auto-populated

  // LA Area Hospital Database
  const LA_AREA_HOSPITALS = {
    hollywood: {
      name: "Hollywood Presbyterian Medical Center",
      phone: "(323) 413-3000",
      address: "1300 N Vermont Ave, Los Angeles, CA 90027",
    },
    "beverly hills": {
      name: "Cedars-Sinai Medical Center",
      phone: "(310) 423-5000",
      address: "8700 Beverly Blvd, Los Angeles, CA 90048",
    },
    "west hollywood": {
      name: "Cedars-Sinai Medical Center",
      phone: "(310) 423-5000",
      address: "8700 Beverly Blvd, Los Angeles, CA 90048",
    },
    "santa monica": {
      name: "Santa Monica Hospital",
      phone: "(310) 319-4000",
      address: "1250 16th St, Santa Monica, CA 90404",
    },
    venice: {
      name: "Santa Monica Hospital",
      phone: "(310) 319-4000",
      address: "1250 16th St, Santa Monica, CA 90404",
    },
    "culver city": {
      name: "Southern California Hospital",
      phone: "(310) 558-6200",
      address: "3828 Delmas Terrace, Culver City, CA 90232",
    },
    downtown: {
      name: "Good Samaritan Hospital",
      phone: "(213) 977-2121",
      address: "1225 Wilshire Blvd, Los Angeles, CA 90017",
    },
    "los angeles": {
      name: "Good Samaritan Hospital",
      phone: "(213) 977-2121",
      address: "1225 Wilshire Blvd, Los Angeles, CA 90017",
    },
    pasadena: {
      name: "Huntington Hospital",
      phone: "(626) 397-5000",
      address: "100 W California Blvd, Pasadena, CA 91105",
    },
    burbank: {
      name: "Providence Saint Joseph Medical Center",
      phone: "(818) 843-5111",
      address: "501 S Buena Vista St, Burbank, CA 91505",
    },
    glendale: {
      name: "Glendale Memorial Hospital",
      phone: "(818) 502-1900",
      address: "1420 S Central Ave, Glendale, CA 91204",
    },
    "long beach": {
      name: "Long Beach Memorial Medical Center",
      phone: "(562) 933-2000",
      address: "2801 Atlantic Ave, Long Beach, CA 90806",
    },
    "orange county": {
      name: "UC Irvine Medical Center",
      phone: "(714) 456-6011",
      address: "101 The City Dr S, Orange, CA 92868",
    },
    anaheim: {
      name: "Anaheim Regional Medical Center",
      phone: "(714) 774-1450",
      address: "1111 W La Palma Ave, Anaheim, CA 92801",
    },
    valencia: {
      name: "Henry Mayo Newhall Hospital",
      phone: "(661) 253-8000",
      address: "23845 McBean Pkwy, Valencia, CA 91355",
    },
    palmdale: {
      name: "Palmdale Regional Medical Center",
      phone: "(661) 382-5000",
      address: "38600 Medical Center Dr, Palmdale, CA 93551",
    },
    malibu: {
      name: "Santa Monica Hospital",
      phone: "(310) 319-4000",
      address: "1250 16th St, Santa Monica, CA 90404",
    },
  };

  // Use day-specific crew assignment data from callSheetData
  const currentDayId = selectedDay?.id;
  const currentDayCrewData = callSheetData.crewByDay?.[currentDayId] || {
    assignedCrew: [],
  };
  const currentDayTableSizes = callSheetData.tableSizesByDay?.[
    currentDayId
  ] || { left: 8, right: 8 };

  const assignedCrew = currentDayCrewData.assignedCrew || [];
  const leftTableSize = currentDayTableSizes.left || 8;
  const rightTableSize = currentDayTableSizes.right || 8;

  // Use persistent data from props - with day-specific call time and notes
  const currentDayCallTime =
    callSheetData.callTimeByDay?.[currentDayId] || "7:30 AM";
  const currentDayNotes = callSheetData.notesByDay?.[currentDayId] || "";
  const castCallTimes = callSheetData.castCallTimes;
  const customNotes = callSheetData.customNotes;

  const setAssignedCrew = (newCrew) => {
    if (!currentDayId) return;

    const updatedCrew =
      typeof newCrew === "function"
        ? newCrew(callSheetData.crewByDay?.[currentDayId]?.assignedCrew || [])
        : newCrew;

    const newCallSheetData = {
      ...callSheetData,
      crewByDay: {
        ...callSheetData.crewByDay,
        [currentDayId]: {
          ...callSheetData.crewByDay?.[currentDayId],
          assignedCrew: updatedCrew,
        },
      },
    };

    setCallSheetData(newCallSheetData);

    // Sync to database for manual crew changes (add/remove)
    console.log(
      "🔍 setAssignedCrew called, syncCallSheetData exists?",
      !!syncCallSheetData
    );
    if (syncCallSheetData) {
      console.log("🔄 Calling syncCallSheetData...");
      syncCallSheetData(newCallSheetData);
    } else {
      console.error("❌ syncCallSheetData is undefined!");
    }
  };

  const setLeftTableSize = (newSize) => {
    if (!currentDayId) return;

    setCallSheetData((prev) => ({
      ...prev,
      tableSizesByDay: {
        ...prev.tableSizesByDay,
        [currentDayId]: {
          ...prev.tableSizesByDay?.[currentDayId],
          left:
            typeof newSize === "function"
              ? newSize(prev.tableSizesByDay?.[currentDayId]?.left || 8)
              : newSize,
        },
      },
    }));
  };

  const setRightTableSize = (newSize) => {
    if (!currentDayId) return;

    setCallSheetData((prev) => ({
      ...prev,
      tableSizesByDay: {
        ...prev.tableSizesByDay,
        [currentDayId]: {
          ...prev.tableSizesByDay?.[currentDayId],
          right:
            typeof newSize === "function"
              ? newSize(prev.tableSizesByDay?.[currentDayId]?.right || 8)
              : newSize,
        },
      },
    }));
  };

  // Dynamic crew management functions
  const addCrewMember = (personId) => {
    const person = castCrew.find((p) => p.id === personId && p.type === "crew");
    if (person && !assignedCrew.find((c) => c.personId === personId)) {
      const newCrewMember = {
        id: `assigned_${Date.now()}_${personId}`,
        personId: person.id,
        displayName: (() => {
          const name = person.displayName || person.name;
          console.log(
            `🔍 Creating crew object for ${person.name}: displayName = ${name}`
          );
          return name;
        })(),
        position: person.position || person.crewDepartment || person.department,
        department: person.crewDepartment || person.department || "Other",
        phone: person.phone || "",
      };
      setAssignedCrew((prev) => [...prev, newCrewMember]);

      // ADD: Update person's bookedDates to include this shooting day (GRANULAR)
      if (selectedDay) {
        const shootingDate = selectedDay.date;

        // Update local state
        const updatedCastCrew = castCrew.map((p) => {
          if (p.id === personId) {
            const currentDates = p.availability?.bookedDates || [];
            if (!currentDates.includes(shootingDate)) {
              return {
                ...p,
                availability: {
                  ...p.availability,
                  bookedDates: [...currentDates, shootingDate].sort(),
                },
              };
            }
          }
          return p;
        });
        onUpdateCastCrew(updatedCastCrew);

        // Update ONLY this person's booked dates in database (GRANULAR)
        const person = castCrew.find((p) => p.id === personId);
        if (
          person &&
          !person.availability?.bookedDates?.includes(shootingDate)
        ) {
          database
            .addAvailabilityDateSafe(
              selectedProject,
              personId,
              shootingDate,
              "booked"
            )
            .catch((error) => {
              console.error("Failed to add booked date:", error);
            });
        }
      }
    }
  };

  const removeCrewMember = (assignedId) => {
    if (!selectedDay) return;

    // Find the crew member being removed
    const crewMember = assignedCrew.find((c) => c.id === assignedId);
    if (!crewMember) return;

    // Check if this person is booked on this day
    const person = castCrew.find((p) => p.id === crewMember.personId);
    const isBooked =
      person?.availability?.bookedDates?.includes(selectedDay.date) || false;

    if (isBooked) {
      // Show confirmation modal
      setRemovalModal({ crewMember, person, assignedId });
    } else {
      // No booking - remove directly
      setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));
    }
  };

  const handleRemovalYes = () => {
    // Remove from CallSheet AND remove booking
    const { assignedId, person } = removalModal;

    // Remove from assigned crew
    setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));

    // Remove date from bookedDates (GRANULAR)
    if (selectedDay) {
      const shootingDate = selectedDay.date;

      // Update local state
      const updatedCastCrew = castCrew.map((p) => {
        if (p.id === person.id) {
          return {
            ...p,
            availability: {
              ...p.availability,
              bookedDates: (p.availability?.bookedDates || []).filter(
                (date) => date !== shootingDate
              ),
            },
          };
        }
        return p;
      });
      onUpdateCastCrew(updatedCastCrew);

      // Remove ONLY this person's booked date from database (GRANULAR)
      database
        .removeAvailabilityDateSafe(
          selectedProject,
          person.id,
          shootingDate,
          "booked"
        )
        .catch((error) => {
          console.error("Failed to remove booked date:", error);
        });
    }

    setRemovalModal(null);
  };

  const handleRemovalNo = () => {
    // Remove from CallSheet only (booking remains)
    const { assignedId } = removalModal;
    setAssignedCrew((prev) => prev.filter((c) => c.id !== assignedId));
    setRemovalModal(null);
  };

  const handleRemovalCancel = () => {
    // Do nothing
    setRemovalModal(null);
  };

  const getAvailableCrew = () => {
    const assignedPersonIds = assignedCrew.map((c) => c.personId);

    const filtered = castCrew.filter(
      (person) =>
        person.type === "crew" && !assignedPersonIds.includes(person.id)
    );

    return filtered;
  };

  const getCrewByDepartmentGroups = () => {
    const grouped = {};
    assignedCrew.forEach((crew) => {
      const dept = crew.department || "Other";
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(crew);
    });

    // Sort departments by defined order, not alphabetically
    const departmentOrder = [
      "Principal Crew",
      "Producer",
      "Camera",
      "G&E",
      "Art",
      "Wardrobe",
      "Makeup",
      "Sound",
      "Script",
      "Production",
      "Transportation",
      "Craft Services",
      "Stunts",
      "Other",
    ];

    const sortedGroups = {};
    departmentOrder.forEach((dept) => {
      if (grouped[dept]) {
        sortedGroups[dept] = grouped[dept].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );
      }
    });

    return sortedGroups;
  };

  const distributeCrewToTables = () => {
    const groupedCrew = getCrewByDepartmentGroups();
    const leftTable = [];
    const rightTable = [];

    let leftUsed = 0;
    let rightUsed = 0;

    Object.entries(groupedCrew).forEach(([department, crew]) => {
      const deptSize = crew.length + 1; // +1 for header

      // Try to fit in left table first
      if (leftUsed + deptSize <= leftTableSize) {
        leftTable.push({ type: "header", department });
        crew.forEach((member) => leftTable.push({ type: "crew", ...member }));
        leftUsed += deptSize;
      } else if (rightUsed + deptSize <= rightTableSize) {
        rightTable.push({ type: "header", department });
        crew.forEach((member) => rightTable.push({ type: "crew", ...member }));
        rightUsed += deptSize;
      }
    });

    return { leftTable, rightTable, leftUsed, rightUsed };
  };

  // Cast visibility management - day-specific hidden cast
  const currentDayHiddenCast =
    callSheetData.hiddenCastByDay?.[currentDayId] || [];

  const setHiddenCast = (hiddenCastList) => {
    if (!currentDayId) return;

    setCallSheetData((prev) => ({
      ...prev,
      hiddenCastByDay: {
        ...prev.hiddenCastByDay,
        [currentDayId]: hiddenCastList,
      },
    }));
  };

  const toggleCastVisibility = (characterName) => {
    const newHiddenList = currentDayHiddenCast.includes(characterName)
      ? currentDayHiddenCast.filter((name) => name !== characterName)
      : [...currentDayHiddenCast, characterName];
    setHiddenCast(newHiddenList);
  };

  const isCastHidden = (characterName) => {
    return currentDayHiddenCast.includes(characterName);
  };

  const setCallTime = (value) => {
    if (!currentDayId) return;

    const newCallSheetData = {
      ...callSheetData,
      callTimeByDay: {
        ...callSheetData.callTimeByDay,
        [currentDayId]: value,
      },
    };

    setCallSheetData(newCallSheetData);

    if (syncCallSheetData) {
      syncCallSheetData(newCallSheetData);
    }
  };
  const setDayNotes = (value) => {
    if (!currentDayId) return;

    const newCallSheetData = {
      ...callSheetData,
      notesByDay: {
        ...callSheetData.notesByDay,
        [currentDayId]: value,
      },
    };

    setCallSheetData(newCallSheetData);

    // ADD SYNC CALL
    // {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  // Use day-specific call time throughout the component
  const callTime = currentDayCallTime;

  const setCastCallTimes = (value) => {
    const newCallSheetData = { ...callSheetData, castCallTimes: value };
    setCallSheetData(newCallSheetData);

    // ADD SYNC CALL
    //if (syncCallSheetData) {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  const setCustomNotes = (value) => {
    const newCallSheetData = { ...callSheetData, customNotes: value };
    setCallSheetData(newCallSheetData);

    // ADD SYNC CALL
    //if (syncCallSheetData) {
    //  syncCallSheetData(newCallSheetData);
    //}
  };

  // Initialize with smart default only once, then allow manual selection
  React.useEffect(() => {
    if (shootingDays.length > 0 && selectedDay === null) {
      const smartDefault = getSmartDefaultDay(shootingDays);
      setSelectedDay(smartDefault);
    }
  }, [shootingDays]);

  // Auto-populate crew from booked dates and fetch weather when day is selected
  React.useEffect(() => {
    if (selectedDay) {
      // FETCH WEATHER FIRST (before any early returns)
      // Get location from scheduled scenes for weather and hospital
      const scenes = getScheduledScenes();
      let filmingLocation = "Los Angeles, CA, USA"; // Default fallback

      if (scenes.length > 0) {
        const firstScene = scenes[0];

        // Try to get actual location address first
        const matchingScriptLocation = scriptLocations.find(
          (scriptLoc) =>
            scriptLoc.scenes &&
            (scriptLoc.scenes.includes(parseInt(firstScene.scene)) ||
              scriptLoc.scenes.includes(firstScene.scene.toString()))
        );

        if (matchingScriptLocation && matchingScriptLocation.actualLocationId) {
          const actualLocation = actualLocations.find(
            (actual) => actual.id === matchingScriptLocation.actualLocationId
          );
          if (actualLocation) {
            const locationParts = [
              actualLocation.city,
              actualLocation.state,
            ].filter(Boolean);

            if (locationParts.length > 0) {
              filmingLocation = locationParts.join(", ") + ", USA";
            }

            if (actualLocation.address) {
              const fullAddress = [
                actualLocation.address,
                actualLocation.city,
                actualLocation.state,
                actualLocation.zipCode,
              ]
                .filter(Boolean)
                .join(", ");

              findNearestHospital(fullAddress);
            }
          }
        } else if (firstScene.location) {
          filmingLocation = firstScene.location + ", CA, USA";
          findNearestHospital(firstScene.location);
        }
      }

      // Fetch weather with location (happens immediately, not blocked by auto-population)
      fetchWeather(selectedDay.date, filmingLocation);

      // NOW do auto-population check (runs every time to catch newly booked crew)
      const dayKey = `${selectedDay.id}_${selectedDay.date}`;

      // Delay auto-population to ensure database has loaded
      const autoPopulateTimer = setTimeout(() => {
        // Auto-populate crew from booked dates
        const bookedCrew = castCrew.filter(
          (person) =>
            person.type === "crew" &&
            person.availability?.bookedDates &&
            person.availability?.bookedDates.includes(selectedDay.date)
        );

        // Only add crew that aren't already assigned to this day
        const currentAssignedIds = (
          callSheetData.crewByDay?.[selectedDay.id]?.assignedCrew || []
        ).map((c) => c.personId);

        // Compare full person IDs directly (no base ID extraction needed)
        const crewToAdd = bookedCrew.filter(
          (person) => !currentAssignedIds.includes(person.id)
        );

        if (crewToAdd.length > 0) {
          const newCrewMembers = crewToAdd.map((person) => ({
            id: `assigned_${Date.now()}_${person.id}_${Math.random()}`,
            personId: person.id,
            displayName: (() => {
              const name = person.displayName || person.name;
              console.log(
                `🔍 Creating crew object for ${person.name}: displayName = ${name}`
              );
              return name;
            })(),
            position:
              person.position || person.crewDepartment || person.department,
            department: person.crewDepartment || person.department || "Other",
            phone: person.phone || "",
          }));

          console.log(
            "💾 Auto-populating crew with functional state update..."
          );

          setCallSheetData((prevData) => {
            const defaultCallTime =
              prevData.callTimeByDay?.[selectedDay.id] || "7:00 AM";

            const updatedCrewList = [
              ...(prevData.crewByDay?.[selectedDay.id]?.assignedCrew || []),
              ...newCrewMembers,
            ];

            // Set default call times for new crew members in SAME update
            const updatedCrewCallTimes = { ...prevData.crewCallTimes };
            newCrewMembers.forEach((crew) => {
              updatedCrewCallTimes[crew.id] = defaultCallTime;
            });

            const newCallSheetData = {
              ...prevData,
              crewByDay: {
                ...prevData.crewByDay,
                [selectedDay.id]: {
                  ...prevData.crewByDay?.[selectedDay.id],
                  assignedCrew: updatedCrewList,
                },
              },
              crewCallTimes: updatedCrewCallTimes,
            };

            if (syncCallSheetData) {
              syncCallSheetData(newCallSheetData).catch((error) => {
                console.error("❌ Failed to sync auto-populated crew:", error);
              });
            }

            console.log(
              "✅ State updated with auto-populated crew AND call times"
            );
            return newCallSheetData;
          });
        }
      }, 500);

      // Cleanup timer on unmount or day change
      return () => clearTimeout(autoPopulateTimer);
    }
  }, [selectedDay]);

  const findNearestHospital = (locationAddress) => {
    if (!locationAddress) return;

    const location = locationAddress.toLowerCase();

    // Sort areas by specificity (longer/more specific matches first)
    const sortedAreas = Object.entries(LA_AREA_HOSPITALS).sort(
      ([a], [b]) => b.length - a.length
    );

    // Find the most specific match
    for (const [area, hospital] of sortedAreas) {
      if (location.includes(area)) {
        setProjectSettings((prev) => ({
          ...prev,
          nearestHospital: hospital,
        }));
        return;
      }
    }

    // Default to central LA hospital if no specific match
    setProjectSettings((prev) => ({
      ...prev,
      nearestHospital: {
        name: "Good Samaritan Hospital",
        phone: "(213) 977-2121",
        address: "1225 Wilshire Blvd, Los Angeles, CA 90017",
      },
    }));
  };

  const fetchWeather = async (date, location = "Los Angeles, CA, USA") => {
    try {
      // Ensure date is in YYYY-MM-DD format
      const formattedDate = date.includes("T") ? date.split("T")[0] : date;

      console.log("Fetching weather for date:", formattedDate);
      console.log("Fetching weather for location:", location);

      // Visual Crossing Weather API - works for ANY date (past, present, future)
      // Free tier: 1000 calls/day, no API key required
      // For future dates beyond forecast, uses climatological data
      const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(
        location
      )}/${formattedDate}?unitGroup=us&include=days&key=72QJGX7PW23X2MGU44ZCN4756&contentType=json`;

      console.log("Weather API URL:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API response not ok: ${response.status}`);
      }

      const data = await response.json();
      console.log("Weather API response:", data);

      if (data.days && data.days.length > 0) {
        const dayData = data.days[0];

        // Parse sunrise/sunset times (already in local time, format: "HH:MM:SS")
        const sunriseTime = dayData.sunrise; // e.g., "06:45:30"
        const sunsetTime = dayData.sunset; // e.g., "18:30:45"

        // Format to 12-hour time
        const formatTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(":");
          const hour = parseInt(hours);
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
          const period = hour >= 12 ? "PM" : "AM";
          return `${displayHour}:${minutes} ${period}`;
        };

        const sunrise = formatTime(sunriseTime);
        const sunset = formatTime(sunsetTime);

        console.log("Formatted sunrise:", sunrise);
        console.log("Formatted sunset:", sunset);

        // Temperature (already averaged in the API response)
        const temp = Math.round(dayData.temp || 72);

        // Weather condition
        const conditions = dayData.conditions || "Clear";
        let condition = "Clear";

        const conditionsLower = conditions.toLowerCase();
        if (
          conditionsLower.includes("rain") ||
          conditionsLower.includes("shower")
        ) {
          condition = "Rainy";
        } else if (
          conditionsLower.includes("cloud") ||
          conditionsLower.includes("overcast")
        ) {
          condition = "Partly Cloudy";
        } else if (
          conditionsLower.includes("clear") ||
          conditionsLower.includes("sun")
        ) {
          condition = "Clear";
        } else if (
          conditionsLower.includes("fog") ||
          conditionsLower.includes("mist")
        ) {
          condition = "Foggy";
        } else if (conditionsLower.includes("snow")) {
          condition = "Snowy";
        } else if (
          conditionsLower.includes("storm") ||
          conditionsLower.includes("thunder")
        ) {
          condition = "Stormy";
        } else {
          condition = conditions; // Use as-is if no match
        }

        const weatherData = {
          temp,
          condition,
          sunrise,
          sunset,
        };

        console.log("Setting weather data:", weatherData);
        setWeather(weatherData);
      } else {
        throw new Error("No weather data in response");
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
      // Fallback weather data
      const fallbackWeather = {
        temp: 72,
        condition: "Partly Cloudy",
        sunrise: "6:45 AM",
        sunset: "7:30 PM",
      };
      console.log("Using fallback weather:", fallbackWeather);
      setWeather(fallbackWeather);
    }
  };

  const calculateCallTime = () => {
    // Function removed - main call time should never be auto-populated
    // Production coordinators must manually set the daily call time
    // This preserves the independence of the main call time block
    return;
  };

  const getScheduledScenes = () => {
    if (!selectedDay) return [];

    // Get scenes scheduled for this specific date from scheduledScenes object
    const scheduledScenesForDate = scheduledScenes[selectedDay.date] || [];

    // Also check the scheduleBlocks if they exist
    const scheduleBlockScenes = selectedDay.scheduleBlocks
      ? selectedDay.scheduleBlocks
          .filter((block) => block.scene || block.isLunch || block.customItem)
          .map((block) => {
            if (block.isLunch) {
              return {
                time: block.time,
                scene: "LUNCH",
                ie: "",
                location: "LUNCH",
                cast: "",
                dn: "",
                pages: "",
                wardrobe: "",
                props: "",
                notes: "",
              };
            }

            // Handle custom items (like ADR)
            if (block.customItem) {
              return {
                time: block.time,
                scene: block.customItem.toUpperCase(),
                ie: "",
                location: block.customItem,
                cast: "",
                dn: "",
                pages: "",
                wardrobe: "",
                props: "",
                notes: "Custom schedule item",
              };
            }

            const scene = block.scene;
            // Get page length from main scenes array for consistency
            const mainScene = callSheetScenes.find(
              (s) => s.sceneNumber == scene.sceneNumber
            );
            return {
              time: block.time,
              scene: scene.sceneNumber,
              ie: scene.metadata?.intExt || "",
              location:
                scene.shootingLocation || scene.metadata?.location || "",
              cast: getSceneCast(scene.sceneNumber),
              dn: scene.metadata?.timeOfDay || "",
              pages: mainScene?.pageLength || scene.pageLength || "1/8",
              wardrobe: getSceneWardrobe(scene.sceneNumber),
              props: getSceneProps(scene.sceneNumber),
              notes: scene.description || "",
            };
          })
      : [];

    // If we have schedule blocks, use them, otherwise fall back to scheduledScenes
    if (scheduleBlockScenes.length > 0) {
      return scheduleBlockScenes;
    }

    // Fallback: convert scheduledScenes to the expected format
    return scheduledScenesForDate.map((scene) => ({
      time: scene.scheduledTime || "8:00 AM",
      scene: scene.sceneNumber,
      ie: scene.metadata?.intExt || "",
      location: scene.shootingLocation || scene.metadata?.location || "",
      cast: getSceneCast(scene.sceneNumber),
      dn: scene.metadata?.timeOfDay || "",
      pages: scene.pageLength || "1/8",
      wardrobe: getSceneWardrobe(scene.sceneNumber),
      props: getSceneProps(scene.sceneNumber),
      notes: scene.description || "",
    }));
  };

  const getSceneCast = (sceneNumber) => {
    if (!characters) return "";

    const sceneCharacters = Object.values(characters)
      .filter((char) => {
        const finalScenes = getFinalCharacterScenes(char.name);
        const sceneNum = parseInt(sceneNumber);
        return finalScenes.includes(sceneNum);
      })
      .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber);

    return sceneCharacters
      .map((char) => {
        const castMember = castCrew.find(
          (person) => person.type === "cast" && person.character === char.name
        );
        const actorName = castMember?.displayName || "TBD";
        return `${char.chronologicalNumber}. ${actorName}`;
      })
      .join(", ");
  };

  const getSceneWardrobe = (sceneNumber) => {
    if (!wardrobeItems || wardrobeItems.length === 0) {
      return "";
    }

    const wardrobeForScene = [];

    wardrobeItems.forEach((character) => {
      if (character.items) {
        character.items.forEach((item) => {
          if (item.scenes && item.scenes.includes(parseInt(sceneNumber))) {
            wardrobeForScene.push(`${character.characterName} ${item.number}`);
          }
        });
      }
    });

    return wardrobeForScene.join(", ");
  };

  const getSceneProps = (sceneNumber) => {
    // This would need taggedItems passed as prop to get props
    return "";
  };

  const getCastForDay = () => {
    const scenes = getScheduledScenes();
    const characterNumbers = new Set();

    scenes.forEach((scene) => {
      if (scene.cast) {
        scene.cast.split(", ").forEach((castEntry) => {
          const match = castEntry.match(/^(\d+)\./);
          if (match) {
            characterNumbers.add(parseInt(match[1]));
          }
        });
      }
    });

    // Add manually added cast character numbers
    manualCast.forEach((castId) => {
      const castMember = castCrew.find(
        (person) => person.type === "cast" && person.id === castId
      );
      if (castMember) {
        console.log(
          "🔍 Processing manual cast:",
          castMember.displayName,
          "Character:",
          castMember.character
        );
        const char = Object.values(characters).find(
          (c) => c.name === castMember.character
        );
        if (char) {
          console.log(
            "✅ Found character:",
            char.name,
            "Number:",
            char.chronologicalNumber
          );
          characterNumbers.add(char.chronologicalNumber);
        } else {
          console.log(
            "❌ Character not found in characters object:",
            castMember.character
          );
        }
      } else {
        console.log("❌ Cast member not found for ID:", castId);
      }
    });

    console.log(
      "📋 Total character numbers in set:",
      characterNumbers.size,
      Array.from(characterNumbers)
    );

    const dayCharacters = Object.values(characters)
      .filter((char) => characterNumbers.has(char.chronologicalNumber))
      .filter((char) => {
        // Check if this character was manually added
        const wasManuallyAdded = manualCast.some((castId) => {
          const castMember = castCrew.find((p) => p.id === castId);
          return castMember?.character === char.name;
        });

        // If manually added, always show (ignore hidden status)
        if (wasManuallyAdded) {
          console.log("✅ Showing manually added cast:", char.name);
          return true;
        }

        // Otherwise, respect hidden status
        const isHidden = isCastHidden(char.name);
        if (isHidden) {
          console.log("⚠️ Character is hidden:", char.name);
        }
        return !isHidden;
      })
      .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber);

    console.log(
      "📋 Final dayCharacters count:",
      dayCharacters.length,
      "Names:",
      dayCharacters.map((c) => c.name)
    );

    return dayCharacters.map((char) => {
      const castMember = castCrew.find(
        (person) => person.type === "cast" && person.character === char.name
      );

      // Auto-populate logic: if no custom times set, use defaults
      const currentCallTimes =
        callSheetData.castCallTimes[currentDayId]?.[char.name] || {};

      // Calculate default makeup time (1 hour before call time)
      const defaultMakeupTime = (() => {
        if (!callTime) return "";
        try {
          const [time, period] = callTime.split(" ");
          const [hours, minutes] = time.split(":").map(Number);
          let totalMinutes = (hours % 12) * 60 + minutes;
          if (period === "PM" && hours !== 12) totalMinutes += 12 * 60;
          if (period === "AM" && hours === 12) totalMinutes = minutes;

          // Subtract 60 minutes for makeup
          totalMinutes -= 60;
          if (totalMinutes < 0) totalMinutes += 24 * 60;

          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          const displayHours =
            newHours === 0 ? 12 : newHours > 12 ? newHours - 12 : newHours;
          const displayPeriod = newHours < 12 ? "AM" : "PM";

          return `${displayHours}:${newMinutes
            .toString()
            .padStart(2, "0")} ${displayPeriod}`;
        } catch (e) {
          return "";
        }
      })();

      return {
        number: char.chronologicalNumber,
        cast: castMember?.displayName || "TBD",
        character: char.name,
        makeup:
          currentCallTimes.makeup !== undefined
            ? currentCallTimes.makeup
            : defaultMakeupTime,
        set:
          currentCallTimes.set !== undefined ? currentCallTimes.set : callTime,
        specialInstructions: castMember?.notes || "",
      };
    });
  };

  const addManualCast = (castId) => {
    if (!castId || manualCast.includes(castId)) return;
    setManualCast((prev) => [...prev, castId]);
  };

  const removeManualCast = (castId) => {
    setManualCast((prev) => prev.filter((id) => id !== castId));
  };

  const getAvailableCast = () => {
    // Get cast members whose characters are already showing
    const dayCharacterNames = daycast.map((c) => c.character);

    // Filter to cast not already showing
    return castCrew.filter(
      (person) =>
        person.type === "cast" &&
        !dayCharacterNames.includes(person.character) &&
        !manualCast.includes(person.id)
    );
  };

  const getCrewByDepartment = () => {
    const departments = [
      "Principal Crew",
      "Producer",
      "Camera",
      "G&E",
      "Art",
      "Wardrobe",
      "Makeup",
      "Sound",
      "Script",
      "Transportation",
      "Craft Services",
      "Other",
    ];

    const organizedCrew = {};

    departments.forEach((dept) => {
      organizedCrew[dept] = castCrew.filter(
        (person) =>
          person.type === "crew" && (person.crewDepartment || "Other") === dept
      );
    });

    return organizedCrew;
  };

  const updateCastCallTime = (characterName, field, value) => {
    if (!currentDayId) return;

    const newCallSheetData = {
      ...callSheetData,
      castCallTimes: {
        ...callSheetData.castCallTimes,
        [currentDayId]: {
          ...callSheetData.castCallTimes[currentDayId],
          [characterName]: {
            ...callSheetData.castCallTimes[currentDayId]?.[characterName],
            [field]: value,
          },
        },
      },
    };

    setCallSheetData(newCallSheetData);

    if (syncCallSheetData) {
      syncCallSheetData(newCallSheetData);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00"); // Force local timezone
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
  };

  const formatDateWithDay = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00"); // Force local timezone
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
    return `${dayName} - ${formattedDate}`;
  };

  const printCallSheet = () => {
    window.print();
  };

  const scenes = getScheduledScenes();
  const daycast = getCastForDay();
  const crewByDept = getCrewByDepartment();
  // Helper function to parse page length as eighths
  const parsePageLengthToEighths = (pageStr) => {
    if (!pageStr) return 0;

    // Handle formats like "1/8", "6/8", "1 6/8", "2 1/8"
    const parts = String(pageStr).trim().split(" ");

    if (parts.length === 1) {
      // Just a fraction like "6/8" or whole number like "2"
      if (parts[0].includes("/")) {
        const [num, denom] = parts[0].split("/").map(Number);
        return num; // Return numerator (already in eighths)
      }
      return parseInt(parts[0]) * 8; // Whole number to eighths
    } else {
      // Mixed number like "1 6/8"
      const wholeNumber = parseInt(parts[0]);
      const [num, denom] = parts[1].split("/").map(Number);
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

  const totalEighths = scenes.reduce((total, scene) => {
    return total + parsePageLengthToEighths(scene.pages);
  }, 0);

  const totalPages = eighthsToDisplayFormat(totalEighths);

  if (shootingDays.length === 0) {
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
        <h2>Call Sheet</h2>
        <p>
          No shooting days scheduled. Please add shooting days in the Schedule
          module first.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        height: "calc(100vh - 44px)",
        width: "100%",
        maxWidth: "100vw",
        overflowY: "auto",
        overflowX: "auto",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Controls */}
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "15px",
          alignItems: "center",
        }}
      >
        <div>
          <label style={{ fontWeight: "bold", marginRight: "8px" }}>
            Shooting Day:
          </label>
          <select
            value={selectedDay?.id || ""}
            onChange={(e) => {
              const dayId = e.target.value;
              const day = shootingDays.find(
                (d) => String(d.id) === String(dayId)
              );
              setSelectedDay(day);
            }}
            style={{ padding: "4px 8px", fontSize: "14px" }}
          >
            {shootingDays.map((day) => {
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
                  Day {day.dayNumber} {dayName} {formattedDate}
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={exportCallSheetPDF}
          style={{
            backgroundColor: "#f44336",
            color: "white",
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export Call Sheet
        </button>

        <button
          onClick={exportSidesPDF}
          style={{
            backgroundColor: "#9C27B0",
            color: "white",
            padding: "6px 12px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export Sides
        </button>
      </div>

      {/* Call Sheet */}
      <div
        style={{
          transform: "scale(1.3)",
          transformOrigin: "top center",
          marginBottom: "30%", // Add extra margin to account for scaling
        }}
      >
        <div
          data-call-sheet="true"
          style={{
            backgroundColor: "white",
            border: "2px solid black",
            fontSize: "10px",
            width: "8.5in",
            minHeight: "11in",
            maxWidth: "8.5in",
            margin: "0 auto",
            boxSizing: "border-box",
            padding: "0.25in",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", borderBottom: "2px solid black" }}>
            {/* Left - Project Info */}
            <div
              style={{
                flex: "1",
                padding: "6px",
                borderRight: "1px solid black",
                fontSize: "9px",
              }}
            >
              <div>
                <strong>Producer:</strong> {projectSettings.producer || "TBD"}
              </div>
              <div>
                <strong>Director:</strong> {projectSettings.director || "TBD"}
              </div>
              <div>
                <strong>Hospital:</strong>{" "}
                {projectSettings.nearestHospital?.name || "Loading..."}
              </div>
              <div>
                <strong>Phone:</strong>{" "}
                {projectSettings.nearestHospital?.phone || "(xxx) xxx-xxxx"}
              </div>
              <div>
                {projectSettings.nearestHospital?.address ||
                  "Fetching nearest hospital..."}
              </div>
            </div>

            {/* Center - Title */}
            <div
              style={{
                flex: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ccc",
                fontWeight: "bold",
                fontSize: "18px",
                padding: "4px",
              }}
            >
              {projectSettings.filmTitle || "FILM TITLE"}
            </div>

            {/* Right - Date/Weather */}
            <div
              style={{
                flex: "1",
                padding: "6px",
                borderLeft: "1px solid black",
                fontSize: "9px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "17px", fontWeight: "bold" }}>
                  {selectedDay ? formatDate(selectedDay.date) : ""}
                </span>
                <span>
                  Day {selectedDay?.dayNumber || 1} of {shootingDays.length}
                </span>
              </div>
              <div style={{ marginTop: "8px" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>SU</span>
                  <span>SUNSET</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{weather?.sunrise || "6:45 AM"}</span>
                  <span>{weather?.sunset || "7:30 PM"}</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>WE {weather?.temp || 72}°</span>
                  <span>HI {weather?.temp + 5 || 77}°</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>HU 10%</span>
                  <span>{weather?.condition || "Sunny"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Call Time */}
          <div style={{ display: "flex", borderBottom: "1px solid black" }}>
            <div
              style={{
                flex: "2",
                padding: "8px",
                borderRight: "1px solid black",
                minHeight: "60px",
              }}
            >
              <div style={{ marginBottom: "4px" }}>
                <strong>NOTES:</strong>
              </div>
              <textarea
                value={currentDayNotes}
                onChange={(e) => setDayNotes(e.target.value)}
                placeholder="Enter notes for this shooting day..."
                style={{
                  width: "calc(100% - 8px)",
                  height: "40px",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                  padding: "4px",
                  fontSize: "11px",
                  fontFamily: "Arial, sans-serif",
                  resize: "none",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid black",
                margin: "10px",
                fontWeight: "bold",
                fontSize: "16px",
              }}
            >
              <span
                style={{ padding: "5px 10px", borderRight: "2px solid black" }}
              >
                CALL
              </span>
              <span style={{ padding: "5px 10px" }}>
                <input
                  type="text"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  style={{
                    border: "none",
                    fontSize: "16px",
                    fontWeight: "bold",
                    width: "80px",
                    textAlign: "center",
                  }}
                />
              </span>
            </div>
            <div style={{ flex: "2" }}></div>
          </div>

          {/* Scenes Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "55px",
                    fontSize: "8px",
                  }}
                >
                  TIME
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "40px",
                    fontSize: "8px",
                  }}
                >
                  SC
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "25px",
                    fontSize: "8px",
                  }}
                >
                  I/E
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "15%",
                  }}
                >
                  LOCATION/DESC
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "14%",
                    fontSize: "8px",
                  }}
                >
                  CAST
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "25px",
                    fontSize: "8px",
                  }}
                >
                  D/N
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "30px",
                    fontSize: "8px",
                  }}
                >
                  PG#
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "40px",
                    fontSize: "8px",
                  }}
                >
                  PGS
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "10.5%",
                    fontSize: "8px",
                  }}
                >
                  WARDROBE
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "10.5%",
                    fontSize: "8px",
                  }}
                >
                  PROPS
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "2px",
                    width: "20%",
                    fontSize: "8px",
                  }}
                >
                  LOCATION
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group CONSECUTIVE scenes by location for merging
                const locationGroups = [];
                let currentGroup = null;

                scenes.forEach((scene, index) => {
                  // LUNCH/ADR participate in rowSpan but don't break groups
                  if (scene.scene === "LUNCH" || scene.scene === "ADR") {
                    if (currentGroup) {
                      // Extend the current group to include this row
                      currentGroup.endIndex = index;
                    }
                    return;
                  }

                  // Get physical address for this scene
                  let physicalAddress = scene.location || "Unknown Location";

                  const matchingScriptLocation = scriptLocations.find(
                    (scriptLoc) =>
                      scriptLoc.scenes &&
                      (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
                        scriptLoc.scenes.includes(scene.scene.toString()))
                  );

                  if (
                    matchingScriptLocation &&
                    matchingScriptLocation.actualLocationId
                  ) {
                    const actualLocation = actualLocations.find(
                      (actual) =>
                        actual.id === matchingScriptLocation.actualLocationId
                    );
                    if (actualLocation && actualLocation.address) {
                      const addressParts = [
                        actualLocation.address,
                        actualLocation.city,
                        actualLocation.state,
                        actualLocation.zipCode,
                      ].filter(Boolean);
                      physicalAddress =
                        addressParts.length > 1
                          ? addressParts.join(", ")
                          : actualLocation.address;
                    }
                  }

                  const normalizedLocation = physicalAddress
                    .toLowerCase()
                    .trim();

                  // If location changed or first scene, start new group
                  if (
                    !currentGroup ||
                    currentGroup.normalizedLocation !== normalizedLocation
                  ) {
                    // Save previous group if exists
                    if (currentGroup) {
                      currentGroup.rowSpan =
                        currentGroup.endIndex - currentGroup.startIndex + 1;
                      locationGroups.push(currentGroup);
                    }
                    // Start new group
                    currentGroup = {
                      normalizedLocation,
                      displayAddress: physicalAddress,
                      startIndex: index,
                      endIndex: index,
                      rowSpan: 1,
                    };
                  } else {
                    // Same location, extend current group
                    currentGroup.endIndex = index;
                  }
                });

                // Save the last group
                if (currentGroup) {
                  currentGroup.rowSpan =
                    currentGroup.endIndex - currentGroup.startIndex + 1;
                  locationGroups.push(currentGroup);
                }

                return scenes.map((scene, index) => {
                  // Handle LUNCH rows differently
                  if (scene.scene === "LUNCH") {
                    return (
                      <tr
                        key={index}
                        style={{
                          backgroundColor: "#90EE90",
                        }}
                      >
                        <td
                          style={{
                            border: "1px solid black",
                            padding: "2px",
                            fontSize: "8px",
                            whiteSpace: "nowrap",
                            textAlign: "center",
                          }}
                        >
                          {scene.time}
                        </td>
                        <td
                          style={{
                            border: "1px solid black",
                            padding: "2px",
                            fontSize: "8px",
                            textAlign: "center",
                            fontWeight: "bold",
                            backgroundColor: "#90EE90",
                          }}
                          colSpan={9}
                        >
                          LUNCH
                        </td>
                      </tr>
                    );
                  }

                  // Get actual physical address from locations module
                  let physicalAddress = scene.location || "Unknown Location";

                  // Try to find matching script location
                  const matchingScriptLocation = scriptLocations.find(
                    (scriptLoc) =>
                      scriptLoc.scenes &&
                      (scriptLoc.scenes.includes(parseInt(scene.scene)) ||
                        scriptLoc.scenes.includes(scene.scene.toString()))
                  );

                  // If found and has actual location assigned, use that address
                  if (
                    matchingScriptLocation &&
                    matchingScriptLocation.actualLocationId
                  ) {
                    const actualLocation = actualLocations.find(
                      (actual) =>
                        actual.id === matchingScriptLocation.actualLocationId
                    );
                    if (actualLocation && actualLocation.address) {
                      // Build full address for display
                      const addressParts = [
                        actualLocation.address,
                        actualLocation.city,
                        actualLocation.state,
                        actualLocation.zipCode,
                      ].filter(Boolean);
                      physicalAddress =
                        addressParts.length > 1
                          ? addressParts.join(", ")
                          : actualLocation.address;
                    }
                  }

                  return (
                    <tr
                      key={index}
                      style={{
                        backgroundColor: "white",
                      }}
                    >
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {scene.time}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                        }}
                      >
                        {scene.scene}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                        }}
                      >
                        {scene.ie}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                        }}
                      >
                        {scene.location}
                        {scene.notes && (
                          <div style={{ fontSize: "7px", color: "#666" }}>
                            {scene.notes}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                        }}
                      >
                        {scene.cast}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                        }}
                      >
                        {scene.dn}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                        }}
                      >
                        {(() => {
                          // Get page number from stripboard scene data
                          const stripboardScene = stripboardScenes.find(
                            (s) => s.sceneNumber == scene.scene
                          );
                          return stripboardScene?.pageNumber || "1";
                        })()}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                          textAlign: "center",
                        }}
                      >
                        {(() => {
                          // Get page length from main scenes array (single source of truth)
                          const mainScene = callSheetScenes.find(
                            (s) => s.sceneNumber == scene.scene
                          );
                          return mainScene?.pageLength || "1/8";
                        })()}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                        }}
                      >
                        {scene.wardrobe}
                      </td>
                      <td
                        style={{
                          border: "1px solid black",
                          padding: "2px",
                          fontSize: "8px",
                        }}
                      >
                        {scene.props}
                      </td>
                      {/* Location column with consecutive merging */}
                      {scene.scene !== "LUNCH" &&
                        scene.scene !== "ADR" &&
                        (() => {
                          // Find if this row is the start of a location group
                          const locationGroup = locationGroups.find(
                            (group) => group.startIndex === index
                          );

                          if (locationGroup) {
                            return (
                              <td
                                style={{
                                  border: "1px solid black",
                                  padding: "2px",
                                  fontSize: "8px",
                                  textAlign: "center",
                                  backgroundColor: "white",
                                  verticalAlign: "middle",
                                }}
                                rowSpan={locationGroup.rowSpan}
                              >
                                {locationGroup.displayAddress}
                              </td>
                            );
                          }
                          // Not the start of a group, cell is covered by rowSpan above
                          return null;
                        })()}
                    </tr>
                  );
                });
              })()}
              <tr>
                <td
                  colSpan="7"
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  TOTAL PAGES
                </td>
                <td
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {totalPages}
                </td>
                <td
                  colSpan="3"
                  style={{ border: "1px solid black", padding: "4px" }}
                ></td>
              </tr>
            </tbody>
          </table>

          {/* Cast Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    width: "40px",
                  }}
                >
                  #
                </th>
                <th style={{ border: "1px solid black", padding: "4px" }}>
                  CAST
                </th>
                <th style={{ border: "1px solid black", padding: "4px" }}>
                  CHARACTER
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    width: "60px",
                  }}
                >
                  MU
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    width: "60px",
                  }}
                >
                  SET
                </th>
                <th style={{ border: "1px solid black", padding: "4px" }}>
                  SPECIAL INSTRUCTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {daycast.map((cast, index) => {
                const isHidden = isCastHidden(cast.character);
                const rowStyle = {
                  backgroundColor: isHidden ? "#f0f0f0" : "white",
                  opacity: isHidden ? 0.6 : 1,
                  textDecoration: isHidden ? "line-through" : "none",
                };

                return (
                  <tr key={index} style={rowStyle}>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      {cast.number}
                      {manualCast.some(
                        (id) =>
                          castCrew.find((p) => p.id === id)?.character ===
                          cast.character
                      ) && (
                        <button
                          onClick={() => {
                            const castMember = castCrew.find(
                              (p) => p.character === cast.character
                            );
                            if (castMember) {
                              removeManualCast(castMember.id);
                            }
                          }}
                          style={{
                            marginLeft: "5px",
                            padding: "1px 4px",
                            fontSize: "8px",
                            backgroundColor: "#ff9800",
                            color: "white",
                            border: "none",
                            borderRadius: "2px",
                            cursor: "pointer",
                          }}
                          title="Remove manually added cast"
                        >
                          −
                        </button>
                      )}
                      <button
                        onClick={() => toggleCastVisibility(cast.character)}
                        style={{
                          marginLeft: "5px",
                          padding: "1px 4px",
                          fontSize: "8px",
                          backgroundColor: isHidden ? "#4CAF50" : "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                        title={
                          isHidden ? "Show cast member" : "Hide cast member"
                        }
                      >
                        {isHidden ? "+" : "×"}
                      </button>
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px",
                        color: isHidden ? "#888" : "black",
                      }}
                    >
                      {cast.cast}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px",
                        color: isHidden ? "#888" : "black",
                      }}
                    >
                      {cast.character}
                    </td>
                    <td style={{ border: "1px solid black", padding: "4px" }}>
                      <input
                        type="text"
                        value={cast.makeup}
                        onChange={(e) =>
                          updateCastCallTime(
                            cast.character,
                            "makeup",
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        style={{
                          width: "50px",
                          border: "none",
                          fontSize: "11px",
                          backgroundColor: isHidden ? "transparent" : "white",
                          color: isHidden ? "#888" : "black",
                        }}
                        disabled={isHidden}
                      />
                    </td>
                    <td style={{ border: "1px solid black", padding: "4px" }}>
                      <input
                        type="text"
                        value={cast.set}
                        onChange={(e) =>
                          updateCastCallTime(
                            cast.character,
                            "set",
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        style={{
                          width: "50px",
                          border: "none",
                          fontSize: "11px",
                          backgroundColor: isHidden ? "transparent" : "white",
                          color: isHidden ? "#888" : "black",
                        }}
                        disabled={isHidden}
                      />
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "4px",
                        color: isHidden ? "#888" : "black",
                      }}
                    >
                      {cast.specialInstructions}
                    </td>
                  </tr>
                );
              })}

              {/* Add Cast Member Row */}
              <tr style={{ backgroundColor: "#e3f2fd" }}>
                <td
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                    textAlign: "center",
                  }}
                >
                  +
                </td>
                <td
                  colSpan="2"
                  style={{
                    border: "1px solid black",
                    padding: "4px",
                  }}
                >
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addManualCast(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    style={{ width: "100%", fontSize: "11px" }}
                  >
                    <option value="">Add cast member...</option>
                    {getAvailableCast().map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.displayName || person.name} ({person.character})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ border: "1px solid black", padding: "4px" }}></td>
                <td style={{ border: "1px solid black", padding: "4px" }}></td>
                <td style={{ border: "1px solid black", padding: "4px" }}>
                  <em style={{ fontSize: "10px", color: "#666" }}>
                    Select to add cast not in scenes
                  </em>
                </td>
              </tr>

              {/* Add empty rows if needed */}
              {[...Array(Math.max(0, 0))].map((_, index) => (
                <tr key={`empty-${index}`}>
                  <td
                    style={{
                      border: "1px solid black",
                      padding: "4px",
                      height: "25px",
                    }}
                  ></td>
                  <td
                    style={{ border: "1px solid black", padding: "4px" }}
                  ></td>
                  <td
                    style={{ border: "1px solid black", padding: "4px" }}
                  ></td>
                  <td
                    style={{ border: "1px solid black", padding: "4px" }}
                  ></td>
                  <td
                    style={{ border: "1px solid black", padding: "4px" }}
                  ></td>
                  <td
                    style={{ border: "1px solid black", padding: "4px" }}
                  ></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Production Notes */}
          <div
            style={{
              borderTop: "1px solid black",
              marginTop: "10px",
              width: "100%",
            }}
          >
            <div
              style={{
                backgroundColor: "#f0f0f0",
                padding: "3px",
                textAlign: "center",
                fontWeight: "bold",
                borderBottom: "1px solid black",
                fontSize: "10px",
                width: "100%",
              }}
            >
              PRODUCTION NOTES
            </div>
            <div style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: "1", padding: "4px" }}>
                {productionNotes.slice(0, 2).map((note, index) => (
                  <div
                    key={index}
                    style={{ marginBottom: "3px", fontSize: "9px" }}
                  >
                    <strong>{note}:</strong>
                    <input
                      type="text"
                      value={customNotes[note] || ""}
                      onChange={(e) =>
                        setCustomNotes((prev) => ({
                          ...prev,
                          [note]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      style={{
                        marginLeft: "4px",
                        border: "none",
                        borderBottom: "1px solid #ccc",
                        fontSize: "9px",
                        width: "120px",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div
                style={{
                  flex: "1",
                  padding: "4px",
                  borderLeft: "1px solid black",
                }}
              >
                {productionNotes.slice(2).map((note, index) => (
                  <div
                    key={index}
                    style={{ marginBottom: "3px", fontSize: "9px" }}
                  >
                    <strong>{note}:</strong>
                    <input
                      type="text"
                      value={customNotes[note] || ""}
                      onChange={(e) =>
                        setCustomNotes((prev) => ({
                          ...prev,
                          [note]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      style={{
                        marginLeft: "4px",
                        border: "none",
                        borderBottom: "1px solid #ccc",
                        fontSize: "9px",
                        width: "120px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Crew Tables with Dropdowns */}
          <div
            style={{
              display: "flex",
              marginTop: "10px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {(() => {
              const { leftTable, rightTable, leftUsed, rightUsed } =
                distributeCrewToTables();

              const availableCrew = getAvailableCrew();

              return (
                <>
                  {/* Left Crew Table */}
                  <div style={{ flex: "1", minWidth: "300px" }}>
                    <div
                      style={{
                        marginBottom: "5px",
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => setLeftTableSize((prev) => prev + 1)}
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                      >
                        + Row
                      </button>
                      <button
                        onClick={() =>
                          setLeftTableSize((prev) => Math.max(1, prev - 1))
                        }
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                      >
                        - Row
                      </button>
                      <span style={{ fontSize: "10px" }}>
                        ({leftUsed}/{leftTableSize})
                      </span>
                    </div>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f0f0f0" }}>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "25%",
                            }}
                          >
                            POSITION
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "29%",
                            }}
                          >
                            NAME
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "26%",
                            }}
                          >
                            PHONE
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "20%",
                            }}
                          >
                            IN
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Render assigned crew and department headers */}
                        {leftTable.map((item, index) => {
                          if (item.type === "header") {
                            return (
                              <tr
                                key={`left-header-${item.department}`}
                                style={{ backgroundColor: "#f0f0f0" }}
                              >
                                <td
                                  colSpan={4}
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                    fontWeight: "bold",
                                    textAlign: "center",
                                  }}
                                >
                                  {item.department.toUpperCase()}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr key={`left-crew-${item.id}`}>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  {item.position}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  {item.displayName}
                                  <button
                                    onClick={() => removeCrewMember(item.id)}
                                    style={{
                                      marginLeft: "5px",
                                      padding: "1px 4px",
                                      fontSize: "8px",
                                      backgroundColor: "#f44336",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "2px",
                                    }}
                                  >
                                    ×
                                  </button>
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                    textAlign: "center",
                                  }}
                                >
                                  {item.phone}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={
                                      callSheetData.crewCallTimes?.[item.id] ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      updateCrewCallTime(
                                        item.id,
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && e.target.blur()
                                    }
                                    style={{
                                      width: "50px",
                                      border: "none",
                                      fontSize: "9px",
                                      textAlign: "center",
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          }
                        })}

                        {/* Empty dropdown rows */}
                        {[...Array(Math.max(0, leftTableSize - leftUsed))].map(
                          (_, index) => (
                            <tr key={`left-empty-${index}`}>
                              <td
                                style={{
                                  border: "1px solid black",
                                  padding: "4px",
                                }}
                              ></td>
                              <td
                                style={{
                                  border: "1px solid black",
                                  padding: "4px",
                                }}
                              >
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addCrewMember(e.target.value);
                                      e.target.value = "";
                                    }
                                  }}
                                  style={{ width: "100%", fontSize: "10px" }}
                                >
                                  <option value="">
                                    Select crew member...
                                  </option>
                                  {availableCrew.map((person) => (
                                    <option key={person.id} value={person.id}>
                                      {person.displayName || person.name} (
                                      {person.crewDepartment ||
                                        person.department}
                                      )
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td
                                style={{
                                  border: "1px solid black",
                                  padding: "4px",
                                }}
                              ></td>
                              <td
                                style={{
                                  border: "1px solid black",
                                  padding: "4px",
                                }}
                              ></td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Right Crew Table */}
                  <div style={{ flex: "1", minWidth: "300px" }}>
                    <div
                      style={{
                        marginBottom: "5px",
                        display: "flex",
                        gap: "5px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => setRightTableSize((prev) => prev + 1)}
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                      >
                        + Row
                      </button>
                      <button
                        onClick={() =>
                          setRightTableSize((prev) => Math.max(1, prev - 1))
                        }
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                      >
                        - Row
                      </button>
                      <span style={{ fontSize: "10px" }}>
                        ({rightUsed}/{rightTableSize})
                      </span>
                    </div>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f0f0f0" }}>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "25%",
                            }}
                          >
                            POSITION
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "29%",
                            }}
                          >
                            NAME
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "26%",
                            }}
                          >
                            PHONE
                          </th>
                          <th
                            style={{
                              border: "1px solid black",
                              padding: "4px",
                              width: "20%",
                            }}
                          >
                            IN
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Render assigned crew and department headers */}
                        {rightTable.map((item, index) => {
                          if (item.type === "header") {
                            return (
                              <tr
                                key={`right-header-${item.department}`}
                                style={{ backgroundColor: "#f0f0f0" }}
                              >
                                <td
                                  colSpan={4}
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                    fontWeight: "bold",
                                    textAlign: "center",
                                  }}
                                >
                                  {item.department.toUpperCase()}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr key={`right-crew-${item.id}`}>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  {item.position}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  {item.displayName}
                                  <button
                                    onClick={() => removeCrewMember(item.id)}
                                    style={{
                                      marginLeft: "5px",
                                      padding: "1px 4px",
                                      fontSize: "8px",
                                      backgroundColor: "#f44336",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "2px",
                                    }}
                                  >
                                    ×
                                  </button>
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                    textAlign: "center",
                                  }}
                                >
                                  {item.phone}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid black",
                                    padding: "4px",
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={
                                      callSheetData.crewCallTimes?.[item.id] ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      updateCrewCallTime(
                                        item.id,
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && e.target.blur()
                                    }
                                    style={{
                                      width: "50px",
                                      border: "none",
                                      fontSize: "9px",
                                      textAlign: "center",
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          }
                        })}

                        {/* Empty dropdown rows */}
                        {[
                          ...Array(Math.max(0, rightTableSize - rightUsed)),
                        ].map((_, index) => (
                          <tr key={`right-empty-${index}`}>
                            <td
                              style={{
                                border: "1px solid black",
                                padding: "4px",
                              }}
                            ></td>
                            <td
                              style={{
                                border: "1px solid black",
                                padding: "4px",
                              }}
                            >
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    addCrewMember(e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                                style={{ width: "100%", fontSize: "10px" }}
                              >
                                <option value="">Select crew member...</option>
                                {availableCrew.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    {person.displayName || person.name} (
                                    {person.crewDepartment || person.department}
                                    )
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td
                              style={{
                                border: "1px solid black",
                                padding: "4px",
                              }}
                            ></td>
                            <td
                              style={{
                                border: "1px solid black",
                                padding: "4px",
                              }}
                            ></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Crew Removal Alert Modal */}
      {removalModal && (
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
            onClick={handleRemovalCancel}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #f44336",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "400px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <span style={{ fontSize: "24px", marginRight: "10px" }}>⚠️</span>
              <h3 style={{ margin: 0 }}>Crew Member Still Booked</h3>
            </div>

            <p style={{ marginBottom: "20px" }}>
              <strong>{removalModal.person.displayName}</strong> is booked on
              this day.
              <br />
              Remove booking as well?
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleRemovalYes}
                style={{
                  backgroundColor: "#f44336",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Yes - Remove from CallSheet and Booking
              </button>
              <button
                onClick={handleRemovalNo}
                style={{
                  backgroundColor: "#FF9800",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                No - Remove from CallSheet Only
              </button>
              <button
                onClick={handleRemovalCancel}
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

// Enhanced Wardrobe Module
function WardrobeModule({
  scenes,
  characters,
  wardrobeItems,
  setWardrobeItems,
  garmentInventory,
  setGarmentInventory,
  garmentCategories,
  setGarmentCategories,
  setActiveModule,
  setCurrentIndex,
  onSyncWardrobeItems,
  onSyncGarmentInventory,
  selectedProject,
}) {
  const [selectedCharacter, setSelectedCharacter] = React.useState("");
  const [viewMode, setViewMode] = React.useState("scenes"); // "scenes" or "characters"
  const [savedScrollPositions, setSavedScrollPositions] = React.useState({
    scenes: 0,
    characters: 0,
  });
  const scrollContainerRef = React.useRef(null);
  const [expandedScenes, setExpandedScenes] = React.useState({});
  const [expandedSceneWardrobes, setExpandedSceneWardrobes] = React.useState(
    {}
  );

  // View mode switch handler
  const handleViewSwitch = (newMode) => {
    // Save current scroll position
    if (scrollContainerRef.current) {
      setSavedScrollPositions((prev) => ({
        ...prev,
        [viewMode]: scrollContainerRef.current.scrollTop,
      }));
    }

    // Switch view
    setViewMode(newMode);

    // Restore saved scroll position for new view
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          savedScrollPositions[newMode] || 0;
      }
    }, 0);
  };

  // Toggle functions for scene breakdown
  const toggleScene = (sceneIndex) => {
    setExpandedScenes((prev) => ({
      ...prev,
      [sceneIndex]: !prev[sceneIndex],
    }));
  };

  const toggleSceneWardrobe = (sceneIndex, wardrobeId) => {
    const key = `scene_${sceneIndex}_wardrobe_${wardrobeId}`;
    setExpandedSceneWardrobes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Image upload handlers
  const updateWardrobePhotos = (wardrobeId, newImages) => {
    setWardrobeItems((prev) => {
      const updated = prev.map((character) => {
        if (character.characterName === selectedCharacter) {
          return {
            ...character,
            items: character.items.map((item) => {
              if (item.id === wardrobeId) {
                return { ...item, photos: newImages };
              }
              return item;
            }),
          };
        }
        return character;
      });
      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(updated);
      }
      return updated;
    });
  };

  const updateGarmentPhotos = (garmentId, newImages) => {
    setGarmentInventory((prev) => {
      const updated = prev.map((garment) => {
        if (garment.id === garmentId) {
          return { ...garment, photos: newImages };
        }
        return garment;
      });
      if (onSyncGarmentInventory) {
        onSyncGarmentInventory(updated);
      }
      return updated;
    });
  };
  const [lastOperation, setLastOperation] = React.useState({
    type: "",
    timestamp: 0,
  });
  const [expandedWardrobes, setExpandedWardrobes] = React.useState({});
  const [showGarmentModal, setShowGarmentModal] = React.useState(false);
  const [currentWardrobeId, setCurrentWardrobeId] = React.useState("");
  const [modalMode, setModalMode] = React.useState(""); // "add-existing", "create-new", "edit"
  const [selectedGarment, setSelectedGarment] = React.useState(null);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [showUsageModal, setShowUsageModal] = React.useState(false);
  const [usageGarment, setUsageGarment] = React.useState(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Get character options
  const characterOptions = Object.keys(characters || {}).sort();

  // Get current character's items
  const getCurrentItems = () => {
    if (!selectedCharacter) return [];
    const character = wardrobeItems.find(
      (char) => char.characterName === selectedCharacter
    );
    return character ? character.items : [];
  };

  // Initialize character with default items if it doesn't exist
  const initializeCharacter = React.useCallback(
    (characterName) => {
      const existingCharacter = wardrobeItems.find(
        (char) => char.characterName === characterName
      );
      if (!existingCharacter) {
        const newCharacter = {
          characterName: characterName,
          items: Array.from({ length: 10 }, (_, index) => ({
            id: `${characterName}_${index + 1}`,
            number: index + 1,
            description: "",
            sceneRanges: "",
            scenes: [],
            assignedGarments: [],
          })),
        };

        setWardrobeItems((prev) => {
          const updatedItems = [...prev, newCharacter];
          if (onSyncWardrobeItems) {
            onSyncWardrobeItems(updatedItems);
          }
          return updatedItems;
        });
        return newCharacter.items;
      }
      return existingCharacter.items;
    },
    [wardrobeItems, onSyncWardrobeItems]
  );

  // Initialize character data when character is selected
  React.useEffect(() => {
    if (selectedCharacter) {
      initializeCharacter(selectedCharacter);
    }
  }, [selectedCharacter, initializeCharacter, onSyncWardrobeItems]);

  // Add new wardrobe item row
  const addWardrobeRow = () => {
    if (!selectedCharacter) return;

    setWardrobeItems((prev) => {
      const characterIndex = prev.findIndex(
        (char) => char.characterName === selectedCharacter
      );

      if (characterIndex === -1) return prev;

      const currentItems = prev[characterIndex].items;
      const nextNumber = currentItems.length + 1;

      const newState = prev.map((char, index) => {
        if (index === characterIndex) {
          return {
            ...char,
            items: [
              ...currentItems,
              {
                id: `${selectedCharacter}_${nextNumber}`,
                number: nextNumber,
                description: "",
                sceneRanges: "",
                scenes: [],
                assignedGarments: [],
              },
            ],
          };
        }
        return char;
      });

      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(newState);
      }
      return newState;
    });
  };

  // Remove wardrobe item row
  const removeWardrobeRow = () => {
    if (!selectedCharacter) return;

    setWardrobeItems((prev) => {
      const characterIndex = prev.findIndex(
        (char) => char.characterName === selectedCharacter
      );

      if (characterIndex === -1) return prev;

      const currentItems = prev[characterIndex].items;
      const currentLength = currentItems.length;

      if (currentLength <= 1) return prev;

      const newState = prev.map((char, index) => {
        if (index === characterIndex) {
          return {
            ...char,
            items: currentItems
              .slice(0, currentLength - 1)
              .map((item, itemIndex) => ({
                id: `${selectedCharacter}_${itemIndex + 1}`,
                number: itemIndex + 1,
                description: item.description,
                sceneRanges: item.sceneRanges,
                scenes: item.scenes,
                assignedGarments: item.assignedGarments || [],
              })),
          };
        }
        return char;
      });

      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(newState);
      }
      return newState;
    });
  };

  // Delete specific wardrobe item row
  const deleteSpecificWardrobeRow = (targetIndex) => {
    if (!selectedCharacter) return;

    setWardrobeItems((prev) => {
      const characterIndex = prev.findIndex(
        (char) => char.characterName === selectedCharacter
      );

      if (characterIndex === -1) return prev;

      const currentItems = prev[characterIndex].items;

      if (currentItems.length <= 1) return prev;

      // Create new state with the specific item removed and renumbered
      const newState = prev.map((char, index) => {
        if (index === characterIndex) {
          return {
            ...char,
            items: currentItems
              .filter((_, itemIndex) => itemIndex !== targetIndex)
              .map((item, newIndex) => ({
                id: `${selectedCharacter}_${newIndex + 1}`,
                number: newIndex + 1,
                description: item.description,
                sceneRanges: item.sceneRanges,
                scenes: item.scenes,
                assignedGarments: item.assignedGarments || [],
                photos: item.photos || [],
              })),
          };
        }
        return char;
      });

      console.log(
        `Deleted row ${targetIndex + 1}, new length: ${
          newState[characterIndex].items.length
        }`
      );

      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(newState);
      }
      return newState;
    });
  };

  // Generate next garment ID for category
  const generateGarmentId = (category) => {
    const categoryPrefix = {
      shirt: "SH",
      pants: "PT",
      dress: "DR",
      skirt: "SK",
      shoes: "SHO",
      "coat/sweater": "CS",
      "socks/tights": "ST",
      underwear: "UW",
      misc: "MI",
    };

    const prefix = categoryPrefix[category] || "GM";
    const existingNumbers = garmentInventory
      .filter((g) => g.id.startsWith(prefix))
      .map((g) => parseInt(g.id.split("_")[1]) || 0)
      .sort((a, b) => b - a);

    const nextNumber = existingNumbers.length > 0 ? existingNumbers[0] + 1 : 1;
    return `${prefix}_${String(nextNumber).padStart(3, "0")}`;
  };

  // Get garments used in multiple wardrobes
  const getGarmentUsage = (garmentId) => {
    const usage = [];
    wardrobeItems.forEach((character) => {
      character.items.forEach((wardrobe) => {
        if (
          wardrobe.assignedGarments &&
          wardrobe.assignedGarments.includes(garmentId)
        ) {
          usage.push({
            character: character.characterName,
            wardrobeNumber: wardrobe.number,
            wardrobeDescription: wardrobe.description,
          });
        }
      });
    });
    return usage;
  };

  // Toggle wardrobe expansion
  const toggleWardrobe = (wardrobeId) => {
    setExpandedWardrobes((prev) => ({
      ...prev,
      [wardrobeId]: !prev[wardrobeId],
    }));
  };

  // Open garment modal
  const openGarmentModal = (mode, wardrobeId, garment = null) => {
    setModalMode(mode);
    setCurrentWardrobeId(wardrobeId);
    setSelectedGarment(garment);
    setShowGarmentModal(true);
  };

  // Add garment to wardrobe
  const addGarmentToWardrobe = (wardrobeId, garmentId) => {
    setWardrobeItems((prev) => {
      const updatedItems = prev.map((character) => {
        if (character.characterName === selectedCharacter) {
          return {
            ...character,
            items: character.items.map((wardrobe) => {
              if (wardrobe.id === wardrobeId) {
                const currentGarments = wardrobe.assignedGarments || [];
                if (!currentGarments.includes(garmentId)) {
                  return {
                    ...wardrobe,
                    assignedGarments: [...currentGarments, garmentId],
                  };
                }
              }
              return wardrobe;
            }),
          };
        }
        return character;
      });
      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(updatedItems);
      }
      return updatedItems;
    });
  };

  // Remove garment from wardrobe
  const removeGarmentFromWardrobe = (wardrobeId, garmentId) => {
    setWardrobeItems((prev) => {
      const updatedItems = prev.map((character) => {
        if (character.characterName === selectedCharacter) {
          return {
            ...character,
            items: character.items.map((wardrobe) => {
              if (wardrobe.id === wardrobeId) {
                return {
                  ...wardrobe,
                  assignedGarments: (wardrobe.assignedGarments || []).filter(
                    (id) => id !== garmentId
                  ),
                };
              }
              return wardrobe;
            }),
          };
        }
        return character;
      });
      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(updatedItems);
      }
      return updatedItems;
    });
  };

  const currentItems = getCurrentItems();

  if (!characters || Object.keys(characters).length === 0) {
    return (
      <div
        ref={scrollContainerRef}
        style={{
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          height: "calc(100vh - 44px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <h2>Wardrobe</h2>
        <p>Please parse a script first to detect characters.</p>
        <button
          onClick={() => setActiveModule("script")}
          style={{
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Go to Script Module
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        height: "calc(100vh - 44px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
          gap: "100px",
          position: "sticky",
          top: 0,
          backgroundColor: "white",
          zIndex: 100,
          paddingBottom: "10px",
          borderBottom: "1px solid #ddd",
        }}
      >
        <h2 style={{ margin: 0 }}>Wardrobe Management</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => handleViewSwitch("scenes")}
            style={{
              backgroundColor: viewMode === "scenes" ? "#2196F3" : "#e0e0e0",
              color: viewMode === "scenes" ? "white" : "#333",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: viewMode === "scenes" ? "bold" : "normal",
            }}
          >
            Scenes
          </button>
          <button
            onClick={() => handleViewSwitch("characters")}
            style={{
              backgroundColor:
                viewMode === "characters" ? "#2196F3" : "#e0e0e0",
              color: viewMode === "characters" ? "white" : "#333",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: viewMode === "characters" ? "bold" : "normal",
            }}
          >
            Characters
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
        }}
      >
        {/* Character View */}
        {viewMode === "characters" && (
          <>
            {/* Controls */}
            <div
              style={{
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <label>Character:</label>
              <select
                value={selectedCharacter}
                onChange={(e) => setSelectedCharacter(e.target.value)}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  minWidth: "150px",
                }}
              >
                <option value="">Select Character</option>
                {characterOptions.map((char) => (
                  <option key={char} value={char}>
                    {char}
                  </option>
                ))}
              </select>

              {selectedCharacter && (
                <>
                  <button
                    onClick={addWardrobeRow}
                    style={{
                      backgroundColor: "#4CAF50",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginLeft: "20px",
                    }}
                  >
                    Add Row
                  </button>
                  <button
                    onClick={removeWardrobeRow}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Remove Row
                  </button>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    style={{
                      backgroundColor: "#9C27B0",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginLeft: "20px",
                    }}
                  >
                    Manage Categories
                  </button>
                </>
              )}
            </div>

            {/* Wardrobe Table */}
            {selectedCharacter && currentItems.length > 0 && (
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "40px 80px 390px 250px 120px 60px 40px",
                    gap: "1px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "12px",
                    padding: "8px",
                    marginBottom: "1px",
                  }}
                >
                  <div></div>
                  <div>Number</div>
                  <div>Description</div>
                  <div>Scene Ranges</div>
                  <div>Garments</div>
                  <div>Photo</div>
                  <div></div>
                </div>

                {/* Table Rows */}
                {currentItems.map((item, index) => {
                  const isExpanded = expandedWardrobes[item.id];
                  const assignedGarments = item.assignedGarments || [];
                  const garmentDetails = assignedGarments
                    .map((id) => garmentInventory.find((g) => g.id === id))
                    .filter(Boolean);

                  return (
                    <div key={item.id}>
                      {/* Main Wardrobe Row */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "40px 80px 390px 250px 120px 60px 40px",
                          gap: "1px",
                          backgroundColor:
                            index % 2 === 0 ? "#f5f5f5" : "white",
                          padding: "8px",
                          borderBottom: "1px solid #ddd",
                          alignItems: "center",
                          minHeight: "30px",
                        }}
                      >
                        {/* Expand/Collapse Button */}
                        <div>
                          <button
                            onClick={() => toggleWardrobe(item.id)}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "16px",
                              padding: "2px",
                            }}
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        </div>

                        {/* Wardrobe Number */}
                        <div
                          style={{ textAlign: "center", fontWeight: "bold" }}
                        >
                          {item.number}
                        </div>

                        {/* Description Field */}
                        <div>
                          <EditableField
                            value={item.description}
                            onSave={(newValue) => {
                              setWardrobeItems((prev) => {
                                const updatedItems = prev.map((character) => {
                                  if (
                                    character.characterName ===
                                    selectedCharacter
                                  ) {
                                    return {
                                      ...character,
                                      items: character.items.map((wardrobe) => {
                                        if (wardrobe.id === item.id) {
                                          return {
                                            ...wardrobe,
                                            description: newValue,
                                          };
                                        }
                                        return wardrobe;
                                      }),
                                    };
                                  }
                                  return character;
                                });
                                if (onSyncWardrobeItems) {
                                  onSyncWardrobeItems(updatedItems);
                                }
                                return updatedItems;
                              });
                            }}
                            placeholder="Enter wardrobe description..."
                            fieldType="description"
                          />
                        </div>

                        {/* Scene Ranges Field */}
                        <div>
                          <EditableField
                            value={item.sceneRanges}
                            onSave={(newValue) => {
                              const parseSceneRanges = (rangeString) => {
                                if (!rangeString.trim()) return [];
                                return rangeString
                                  .split(",")
                                  .flatMap((range) => {
                                    const trimmed = range.trim();
                                    if (trimmed.includes("-")) {
                                      const [start, end] = trimmed
                                        .split("-")
                                        .map((n) => parseInt(n.trim()));
                                      if (isNaN(start) || isNaN(end)) return [];
                                      return Array.from(
                                        { length: end - start + 1 },
                                        (_, i) => start + i
                                      );
                                    } else {
                                      const num = parseInt(trimmed);
                                      return isNaN(num) ? [] : [num];
                                    }
                                  });
                              };

                              setWardrobeItems((prev) => {
                                const updatedItems = prev.map((character) => {
                                  if (
                                    character.characterName ===
                                    selectedCharacter
                                  ) {
                                    return {
                                      ...character,
                                      items: character.items.map((wardrobe) => {
                                        if (wardrobe.id === item.id) {
                                          return {
                                            ...wardrobe,
                                            sceneRanges: newValue,
                                            scenes: parseSceneRanges(newValue),
                                          };
                                        }
                                        return wardrobe;
                                      }),
                                    };
                                  }
                                  return character;
                                });
                                if (onSyncWardrobeItems) {
                                  onSyncWardrobeItems(updatedItems);
                                }
                                return updatedItems;
                              });
                            }}
                            placeholder="e.g., 1-9, 15-20"
                            fieldType="sceneRanges"
                          />
                        </div>

                        {/* Garments Summary */}
                        <div style={{ fontSize: "12px" }}>
                          {garmentDetails.length > 0 ? (
                            <div>
                              {garmentDetails.length} garment
                              {garmentDetails.length !== 1 ? "s" : ""}
                              {assignedGarments.some(
                                (id) => getGarmentUsage(id).length > 1
                              ) && (
                                <span
                                  onClick={() => {
                                    const multiUseGarment =
                                      assignedGarments.find(
                                        (id) => getGarmentUsage(id).length > 1
                                      );
                                    if (multiUseGarment) {
                                      setUsageGarment(
                                        garmentInventory.find(
                                          (g) => g.id === multiUseGarment
                                        )
                                      );
                                      setShowUsageModal(true);
                                    }
                                  }}
                                  style={{
                                    display: "inline-block",
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    borderRadius: "50%",
                                    width: "16px",
                                    height: "16px",
                                    textAlign: "center",
                                    fontSize: "10px",
                                    lineHeight: "16px",
                                    marginLeft: "4px",
                                    cursor: "pointer",
                                  }}
                                  title="Some garments used in multiple wardrobes"
                                >
                                  !
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#666" }}>
                              No garments assigned
                            </span>
                          )}
                        </div>

                        {/* Wardrobe Image */}
                        <div style={{ textAlign: "center" }}>
                          {item.photos && item.photos.length > 0 ? (
                            <img
                              src={item.photos[0]}
                              alt={`Wardrobe ${item.number}`}
                              style={{
                                width: "50px",
                                height: "60px",
                                objectFit: "cover",
                                borderRadius: "3px",
                                cursor: "pointer",
                                border: "1px solid #ddd",
                              }}
                              onClick={() => {
                                setSelectedImages(item.photos);
                                setCurrentImageIndex(0);
                                setShowImageViewer(true);
                              }}
                              title="Click to view all photos"
                            />
                          ) : (
                            <div
                              style={{
                                width: "50px",
                                height: "60px",
                                backgroundColor: "#f0f0f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "3px",
                                border: "1px solid #ddd",
                                fontSize: "10px",
                                color: "#666",
                              }}
                            >
                              No Photo
                            </div>
                          )}
                        </div>

                        {/* Delete Button */}
                        <div style={{ textAlign: "center" }}>
                          <button
                            onClick={() => deleteSpecificWardrobeRow(index)}
                            style={{
                              backgroundColor: "#f44336",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              width: "24px",
                              height: "24px",
                              fontSize: "14px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "bold",
                            }}
                            title="Delete this wardrobe item"
                            onMouseOver={(e) =>
                              (e.target.style.backgroundColor = "#d32f2f")
                            }
                            onMouseOut={(e) =>
                              (e.target.style.backgroundColor = "#f44336")
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* Expanded Garment Details */}
                      {isExpanded && (
                        <div
                          style={{
                            backgroundColor: "#f9f9f9",
                            padding: "10px 20px",
                            borderBottom: "1px solid #ddd",
                          }}
                        >
                          {/* Wardrobe Photos */}
                          <div style={{ marginBottom: "15px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "10px",
                              }}
                            >
                              <label
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                  color: "#333",
                                }}
                              >
                                Wardrobe Photos ({(item.photos || []).length}
                                /10)
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                id={`wardrobe-upload-${item.id}`}
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const result = await uploadWardrobeImage(
                                      file,
                                      selectedProject.id,
                                      item.id,
                                      `wardrobe_${Date.now()}.jpg`
                                    );
                                    if (result && result.url) {
                                      const newImages = [
                                        ...(item.photos || []),
                                        result.url,
                                      ];
                                      updateWardrobePhotos(item.id, newImages);
                                    }
                                  }
                                }}
                              />
                              <button
                                onClick={() =>
                                  document
                                    .getElementById(
                                      `wardrobe-upload-${item.id}`
                                    )
                                    .click()
                                }
                                style={{
                                  backgroundColor: "#4CAF50",
                                  color: "white",
                                  border: "none",
                                  padding: "8px 16px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: "bold",
                                }}
                              >
                                Upload
                              </button>
                            </div>

                            {/* Current Images */}
                            {item.photos && item.photos.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "5px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {item.photos.map((photo, index) => (
                                  <div
                                    key={index}
                                    style={{ position: "relative" }}
                                  >
                                    <img
                                      src={photo}
                                      alt={`Wardrobe ${item.number} - ${
                                        index + 1
                                      }`}
                                      style={{
                                        width: "60px",
                                        height: "80px",
                                        objectFit: "cover",
                                        borderRadius: "3px",
                                        border: "1px solid #ddd",
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const newImages = item.photos.filter(
                                          (_, i) => i !== index
                                        );
                                        updateWardrobePhotos(
                                          item.id,
                                          newImages
                                        );
                                        deleteMultipleImages([photo]);
                                      }}
                                      style={{
                                        position: "absolute",
                                        top: "-5px",
                                        right: "-5px",
                                        backgroundColor: "#f44336",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "50%",
                                        width: "20px",
                                        height: "20px",
                                        fontSize: "12px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Clickable Wardrobe Image Thumbnails */}
                            {item.photos && item.photos.length > 0 && (
                              <div style={{ marginTop: "10px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    marginBottom: "5px",
                                  }}
                                >
                                  Quick View (double-click to enlarge):
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "4px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {item.photos
                                    .slice(0, 4)
                                    .map((photo, index) => (
                                      <img
                                        key={index}
                                        src={photo}
                                        alt={`Wardrobe ${item.number} - ${
                                          index + 1
                                        }`}
                                        style={{
                                          width: "45px",
                                          height: "60px",
                                          objectFit: "cover",
                                          borderRadius: "3px",
                                          cursor: "pointer",
                                          border: "1px solid #ddd",
                                        }}
                                        onDoubleClick={() => {
                                          setSelectedImages(item.photos);
                                          setCurrentImageIndex(index);
                                          setShowImageViewer(true);
                                        }}
                                      />
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              marginBottom: "10px",
                              display: "flex",
                              gap: "10px",
                            }}
                          >
                            <button
                              onClick={() =>
                                openGarmentModal("add-existing", item.id)
                              }
                              style={{
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Add Existing Garment
                            </button>
                            <button
                              onClick={() =>
                                openGarmentModal("create-new", item.id)
                              }
                              style={{
                                backgroundColor: "#4CAF50",
                                color: "white",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Create New Garment
                            </button>
                          </div>

                          {/* Assigned Garments List */}
                          {garmentDetails.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fill, minmax(250px, 1fr))",
                                gap: "8px",
                              }}
                            >
                              {garmentDetails.map((garment) => {
                                const usage = getGarmentUsage(garment.id);
                                const isMultiUse = usage.length > 1;

                                return (
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
                                    {console.log(
                                      "🔍 GARMENT CARD - garment.photos:",
                                      garment.photos
                                    ) && null}
                                    {console.log(
                                      "🔍 GARMENT CARD - garment object:",
                                      garment
                                    ) && null}
                                    {/* Flex container for content and image */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      {/* Content on left */}
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: "bold",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          {garment.name}
                                          {isMultiUse && (
                                            <span
                                              onClick={() => {
                                                setUsageGarment(garment);
                                                setShowUsageModal(true);
                                              }}
                                              style={{
                                                display: "inline-block",
                                                backgroundColor: "#4CAF50",
                                                color: "white",
                                                borderRadius: "50%",
                                                width: "14px",
                                                height: "14px",
                                                textAlign: "center",
                                                fontSize: "10px",
                                                lineHeight: "14px",
                                                marginLeft: "4px",
                                                cursor: "pointer",
                                              }}
                                              title="Used in multiple wardrobes"
                                            >
                                              !
                                            </span>
                                          )}
                                        </div>
                                        <div
                                          style={{
                                            color: "#666",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          {garment.id}
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
                                          }}
                                        >
                                          <button
                                            onClick={() =>
                                              openGarmentModal(
                                                "edit",
                                                item.id,
                                                garment
                                              )
                                            }
                                            style={{
                                              backgroundColor: "#FF9800",
                                              color: "white",
                                              border: "none",
                                              padding: "2px 6px",
                                              borderRadius: "2px",
                                              cursor: "pointer",
                                              fontSize: "10px",
                                            }}
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() =>
                                              removeGarmentFromWardrobe(
                                                item.id,
                                                garment.id
                                              )
                                            }
                                            style={{
                                              backgroundColor: "#f44336",
                                              color: "white",
                                              border: "none",
                                              padding: "2px 6px",
                                              borderRadius: "2px",
                                              cursor: "pointer",
                                              fontSize: "10px",
                                            }}
                                          >
                                            Remove
                                          </button>
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
                                              e.preventDefault();
                                              e.stopPropagation();
                                              console.log(
                                                "🖼️ WARDROBE IMAGE CLICKED - garment.photos:",
                                                garment.photos
                                              );
                                              console.log(
                                                "🖼️ WARDROBE IMAGE CLICKED - setSelectedImages function:",
                                                typeof setSelectedImages
                                              );
                                              setSelectedImages(garment.photos);
                                              setCurrentImageIndex(0);
                                              setShowImageViewer(true);
                                              console.log(
                                                "🖼️ WARDROBE IMAGE CLICKED - Image viewer should open now"
                                              );

                                              // Debug state after setting
                                              setTimeout(() => {
                                                console.log(
                                                  "🖼️ STATE CHECK - showImageViewer:",
                                                  showImageViewer
                                                );
                                                console.log(
                                                  "🖼️ STATE CHECK - selectedImages:",
                                                  selectedImages
                                                );
                                              }, 100);
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
                                );
                              })}
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Scene-by-Scene Breakdown */}
        {viewMode === "scenes" && (
          <div style={{ marginTop: "30px" }}>
            <h3>Scene Breakdown - All Characters</h3>
            <div
              style={{
                backgroundColor: "#f9f9f9",
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "15px",
              }}
            >
              {scenes && scenes.length > 0 ? (
                scenes.map((scene, sceneIndex) => {
                  // Find ALL wardrobe items from ALL characters that appear in this scene
                  const allSceneWardrobeItems = [];
                  wardrobeItems.forEach((character) => {
                    character.items.forEach((item) => {
                      if (
                        item.scenes &&
                        item.scenes.includes(parseInt(scene.sceneNumber))
                      ) {
                        allSceneWardrobeItems.push({
                          ...item,
                          characterName: character.characterName,
                        });
                      }
                    });
                  });

                  if (allSceneWardrobeItems.length === 0) return null;

                  const isSceneExpanded = expandedScenes[sceneIndex];

                  // Handler for character badge clicks
                  const handleCharacterBadgeClick = (e, item) => {
                    e.stopPropagation(); // Prevent scene toggle
                    const wardrobeKey = `scene_${sceneIndex}_wardrobe_${item.id}`;

                    // If scene is not expanded, expand it first
                    if (!isSceneExpanded) {
                      setExpandedScenes((prev) => ({
                        ...prev,
                        [sceneIndex]: true,
                      }));
                    }

                    // Toggle the specific wardrobe
                    setExpandedSceneWardrobes((prev) => ({
                      ...prev,
                      [wardrobeKey]: !prev[wardrobeKey],
                    }));
                  };

                  return (
                    <div
                      key={sceneIndex}
                      style={{
                        marginBottom: "8px",
                        backgroundColor: "white",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
                    >
                      {/* Scene Header - Two Rows */}
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: "#f5f5f5",
                          borderRadius: "4px",
                        }}
                      >
                        {/* Row 1: Arrow + Scene Number + Character Badges */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "6px",
                          }}
                        >
                          {/* Arrow */}
                          <span
                            onClick={() => toggleScene(sceneIndex)}
                            style={{
                              fontSize: "12px",
                              flexShrink: 0,
                              cursor: "pointer",
                            }}
                          >
                            {isSceneExpanded ? "▼" : "▶"}
                          </span>

                          {/* Scene Number */}
                          <div
                            style={{
                              fontWeight: "bold",
                              color: "black",
                              flexShrink: 0,
                            }}
                          >
                            Scene {scene.sceneNumber}
                          </div>

                          {/* Character/Wardrobe Badges (Always Visible) */}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px",
                            }}
                          >
                            {allSceneWardrobeItems.map((item) => (
                              <span
                                key={`${item.characterName}_${item.id}`}
                                onClick={(e) =>
                                  handleCharacterBadgeClick(e, item)
                                }
                                style={{
                                  display: "inline-block",
                                  backgroundColor: "#e3f2fd",
                                  color: "#1976d2",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  fontSize: "11px",
                                  border: "1px solid #bbdefb",
                                  cursor: "pointer",
                                }}
                              >
                                {item.characterName} {item.number}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Row 2: Scene Heading */}
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            paddingLeft: "22px", // Align with scene number
                          }}
                        >
                          {scene.heading}
                        </div>
                      </div>

                      {/* Expanded Wardrobe Rows */}
                      {isSceneExpanded && (
                        <div style={{ padding: "10px" }}>
                          {allSceneWardrobeItems.map((item) => {
                            const wardrobeKey = `scene_${sceneIndex}_wardrobe_${item.id}`;
                            const isWardrobeExpanded =
                              expandedSceneWardrobes[wardrobeKey];
                            const assignedGarments =
                              item.assignedGarments || [];
                            const garmentDetails = assignedGarments
                              .map((id) =>
                                garmentInventory.find((g) => g.id === id)
                              )
                              .filter(Boolean);

                            return (
                              <div
                                key={item.id}
                                style={{
                                  marginBottom: "8px",
                                  border: "1px solid #e0e0e0",
                                  borderRadius: "4px",
                                  backgroundColor: "#fafafa",
                                }}
                              >
                                {/* Wardrobe Row Header */}
                                <div
                                  onClick={() =>
                                    toggleSceneWardrobe(sceneIndex, item.id)
                                  }
                                  style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                  }}
                                >
                                  {/* Arrow */}
                                  <span
                                    style={{ fontSize: "12px", flexShrink: 0 }}
                                  >
                                    {isWardrobeExpanded ? "▼" : "▶"}
                                  </span>

                                  {/* Character Name and Wardrobe Number */}
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "14px",
                                    }}
                                  >
                                    {item.characterName} {item.number}
                                  </div>

                                  {/* Scene Ranges Badge */}
                                  {item.sceneRanges && (
                                    <span
                                      style={{
                                        backgroundColor: "#f3e5f5",
                                        color: "#7b1fa2",
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontSize: "11px",
                                        border: "1px solid #ce93d8",
                                      }}
                                    >
                                      {item.sceneRanges}
                                    </span>
                                  )}
                                </div>

                                {/* Expanded Garment Cards */}
                                {isWardrobeExpanded &&
                                  garmentDetails.length > 0 && (
                                    <div
                                      style={{
                                        padding: "12px",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "12px",
                                      }}
                                    >
                                      {garmentDetails.map((garment) => (
                                        <div
                                          key={garment.id}
                                          style={{
                                            border: "1px solid #ddd",
                                            borderRadius: "4px",
                                            padding: "10px",
                                            backgroundColor: "white",
                                            width: "200px",
                                            fontSize: "12px",
                                          }}
                                        >
                                          {/* Garment Info */}
                                          <div style={{ marginBottom: "8px" }}>
                                            <div
                                              style={{
                                                fontWeight: "bold",
                                                marginBottom: "4px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span>
                                                {garment.name ||
                                                  "Untitled Garment"}
                                              </span>
                                              <span
                                                style={{ fontSize: "11px" }}
                                              >
                                                {garment.id}
                                              </span>
                                            </div>
                                            {garment.category && (
                                              <div
                                                style={{
                                                  color: "#666",
                                                  fontSize: "11px",
                                                }}
                                              >
                                                Category: {garment.category}
                                              </div>
                                            )}
                                            {garment.size && (
                                              <div
                                                style={{
                                                  color: "#666",
                                                  fontSize: "11px",
                                                }}
                                              >
                                                Size: {garment.size}
                                              </div>
                                            )}
                                            {garment.notes && (
                                              <div
                                                style={{
                                                  color: "#666",
                                                  fontSize: "11px",
                                                  marginTop: "4px",
                                                }}
                                              >
                                                {garment.notes}
                                              </div>
                                            )}
                                          </div>

                                          {/* Garment Photo */}
                                          {garment.photos &&
                                          garment.photos.length > 0 ? (
                                            <img
                                              src={garment.photos[0]}
                                              alt={garment.name}
                                              style={{
                                                width: "100%",
                                                height: "120px",
                                                objectFit: "cover",
                                                borderRadius: "3px",
                                                border: "1px solid #ddd",
                                              }}
                                            />
                                          ) : (
                                            <div
                                              style={{
                                                width: "100%",
                                                height: "120px",
                                                backgroundColor: "#f0f0f0",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "3px",
                                                border: "1px solid #ddd",
                                                fontSize: "10px",
                                                color: "#666",
                                              }}
                                            >
                                              No Photo
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                {/* No Garments Message */}
                                {isWardrobeExpanded &&
                                  garmentDetails.length === 0 && (
                                    <div
                                      style={{
                                        padding: "12px",
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
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ color: "#666", fontStyle: "italic" }}>
                  No scenes available. Please parse a script first.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Garment Modal */}
        {showGarmentModal && (
          <GarmentModal
            mode={modalMode}
            wardrobeId={currentWardrobeId}
            garment={selectedGarment}
            garmentInventory={garmentInventory}
            setGarmentInventory={setGarmentInventory}
            garmentCategories={garmentCategories}
            generateGarmentId={generateGarmentId}
            addGarmentToWardrobe={addGarmentToWardrobe}
            onClose={() => setShowGarmentModal(false)}
            onSyncGarmentInventory={onSyncGarmentInventory}
            selectedProject={selectedProject}
          />
        )}

        {/* Category Management Modal */}
        {showCategoryModal && (
          <CategoryModal
            categories={garmentCategories}
            setCategories={setGarmentCategories}
            onClose={() => setShowCategoryModal(false)}
          />
        )}

        {/* Usage Modal */}
        {showUsageModal && usageGarment && (
          <UsageModal
            garment={usageGarment}
            usage={getGarmentUsage(usageGarment.id)}
            onClose={() => setShowUsageModal(false)}
          />
        )}

        {/* Image Lightbox Viewer */}
        {showImageViewer && (
          <div
            ref={(div) => div?.focus()}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImageViewer(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowImageViewer(false);
              }
            }}
            tabIndex={0}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90%",
                maxHeight: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImages[currentImageIndex]}
                style={{
                  maxWidth: "100%",
                  maxHeight: "800px",
                  objectFit: "contain",
                }}
                alt="Garment"
              />
              <button
                onClick={() => setShowImageViewer(false)}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ×
              </button>

              {/* Navigation arrows if multiple images */}
              {selectedImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(Math.max(0, currentImageIndex - 1))
                    }
                    disabled={currentImageIndex === 0}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      cursor:
                        currentImageIndex === 0 ? "not-allowed" : "pointer",
                      fontSize: "18px",
                      opacity: currentImageIndex === 0 ? 0.5 : 1,
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        Math.min(
                          selectedImages.length - 1,
                          currentImageIndex + 1
                        )
                      )
                    }
                    disabled={currentImageIndex === selectedImages.length - 1}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      cursor:
                        currentImageIndex === selectedImages.length - 1
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "18px",
                      opacity:
                        currentImageIndex === selectedImages.length - 1
                          ? 0.5
                          : 1,
                    }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable EditableField component (same as before)
const EditableField = React.memo(
  ({ value, onSave, placeholder, fieldType, style }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState("");
    const [hasOverflow, setHasOverflow] = React.useState(false);
    const [showPreview, setShowPreview] = React.useState(false);
    const textRef = React.useRef(null);

    React.useEffect(() => {
      if (textRef.current) {
        const isOverflowing =
          textRef.current.scrollWidth > textRef.current.clientWidth ||
          textRef.current.scrollHeight > textRef.current.clientHeight;
        setHasOverflow(isOverflowing);
      }
    }, [value]);

    const handleSave = () => {
      onSave(editValue);
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditValue("");
      setIsEditing(false);
    };

    const handleDoubleClick = () => {
      setEditValue(value);
      setIsEditing(true);
    };

    if (isEditing) {
      const minHeight = 20;
      const calculatedHeight = Math.max(
        minHeight,
        Math.min(200, Math.ceil(editValue.length / 50) * 20 + 20)
      );

      return (
        <div style={{ position: "relative", ...style }}>
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            autoFocus
            style={{
              width: "100%",
              height: `${calculatedHeight}px`,
              border: "2px solid #2196F3",
              borderRadius: "4px",
              padding: "4px",
              fontSize: "12px",
              fontFamily: "Arial, sans-serif",
              resize: "none",
              outline: "none",
            }}
          />
        </div>
      );
    }

    const displayHeight = 20;

    return (
      <div
        style={{ position: "relative", ...style }}
        onMouseEnter={() => hasOverflow && setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
      >
        <div
          ref={textRef}
          onDoubleClick={handleDoubleClick}
          style={{
            minHeight: "20px",
            height: `${displayHeight}px`,
            padding: "4px",
            border: "1px solid transparent",
            borderRadius: "4px",
            cursor: "pointer",
            backgroundColor: "transparent",
            fontSize: "12px",
            fontFamily: "Arial, sans-serif",
            overflow: "hidden",
            textOverflow: "ellipsis",
            wordWrap: "break-word",
            lineHeight: "1.2",
            display: "flex",
            alignItems: "flex-start",
            verticalAlign: "top",
          }}
          title="Double-click to edit"
        >
          {value || (
            <span style={{ color: "#999", fontStyle: "italic" }}>
              {placeholder}
            </span>
          )}
        </div>

        {showPreview && hasOverflow && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "0",
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "12px",
              maxWidth: "300px",
              zIndex: 1000,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              wordWrap: "break-word",
            }}
          >
            {value}
          </div>
        )}
      </div>
    );
  }
);

// Garment Management Modal
function GarmentModal({
  mode,
  wardrobeId,
  garment,
  garmentInventory,
  setGarmentInventory,
  garmentCategories,
  generateGarmentId,
  addGarmentToWardrobe,
  onClose,
  onSyncGarmentInventory,
  selectedProject,
}) {
  const [formData, setFormData] = React.useState({
    name: garment?.name || "",
    category: garment?.category || garmentCategories[0] || "",
    size: garment?.size || "",
    color: garment?.color || "",
    condition: garment?.condition || "excellent",
    photos: garment?.photos || [],
  });

  // Update formData when garment prop changes (important for edit mode)
  React.useEffect(() => {
    if (garment) {
      console.log("🔍 EDIT MODE - Loading garment:", garment);
      console.log("🔍 EDIT MODE - garment.photos:", garment.photos);
      setFormData({
        name: garment.name || "",
        category: garment.category || garmentCategories[0] || "",
        size: garment.size || "",
        color: garment.color || "",
        condition: garment.condition || "excellent",
        photos: garment.photos || [],
      });
      console.log("🔍 EDIT MODE - formData after setting:", {
        photos: garment?.photos || [],
      });
    }
  }, [garment, garmentCategories]);
  const [selectedExistingGarment, setSelectedExistingGarment] =
    React.useState("");

  const handleSave = () => {
    console.log("🔍 SAVING GARMENT - formData.photos:", formData.photos);
    console.log("🔍 SAVING GARMENT - full formData:", formData);
    console.log("🔍 SAVING GARMENT - photos length:", formData.photos?.length);
    console.log("🔍 SAVING GARMENT - first photo:", formData.photos?.[0]);

    if (mode === "add-existing") {
      if (selectedExistingGarment) {
        addGarmentToWardrobe(wardrobeId, selectedExistingGarment);
      }
    } else if (mode === "create-new") {
      if (formData.name && formData.category) {
        const newGarment = {
          id: generateGarmentId(formData.category),
          ...formData,
          createdDate: new Date().toISOString().split("T")[0],
        };

        const updatedInventory = [...garmentInventory, newGarment];
        setGarmentInventory(updatedInventory);
        if (onSyncGarmentInventory) {
          onSyncGarmentInventory(updatedInventory);
        }
        addGarmentToWardrobe(wardrobeId, newGarment.id);
      }
    } else if (mode === "edit" && garment) {
      const updatedInventory = garmentInventory.map((g) =>
        g.id === garment.id ? { ...g, ...formData } : g
      );
      setGarmentInventory(updatedInventory);
      if (onSyncGarmentInventory) {
        onSyncGarmentInventory(updatedInventory);
      }
    }
    onClose();
  };

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
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "600px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          {mode === "add-existing"
            ? "Add Existing Garment"
            : mode === "create-new"
            ? "Create New Garment"
            : "Edit Garment"}
        </h3>

        {mode === "add-existing" ? (
          <div>
            <label style={{ display: "block", marginBottom: "10px" }}>
              Select Garment:
              <select
                value={selectedExistingGarment}
                onChange={(e) => setSelectedExistingGarment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
              >
                <option value="">Choose existing garment...</option>
                {garmentCategories.map((category) => {
                  const categoryGarments = garmentInventory.filter(
                    (g) => g.category === category
                  );
                  if (categoryGarments.length === 0) return null;

                  return [
                    <optgroup key={category} label={category.toUpperCase()}>
                      {categoryGarments.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.id} - {g.name} ({g.size}, {g.color})
                        </option>
                      ))}
                    </optgroup>,
                  ];
                })}
              </select>
            </label>
          </div>
        ) : (
          <div>
            <label style={{ display: "block", marginBottom: "10px" }}>
              Name:
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
                placeholder="e.g., Blue dress shirt"
              />
            </label>

            <label style={{ display: "block", marginBottom: "10px" }}>
              Category:
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, category: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
              >
                {garmentCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "block", marginBottom: "10px" }}>
              Size:
              <input
                type="text"
                value={formData.size}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, size: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
                placeholder="e.g., M, L, 32, 8.5"
              />
            </label>

            <label style={{ display: "block", marginBottom: "10px" }}>
              Color:
              <input
                type="text"
                value={formData.color}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, color: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
                placeholder="e.g., Blue, Red, Black"
              />
            </label>

            <label style={{ display: "block", marginBottom: "10px" }}>
              Condition:
              <select
                value={formData.condition}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    condition: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginTop: "4px",
                }}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
            </label>

            {/* Garment Photos */}
            <label style={{ display: "block", marginBottom: "10px" }}>
              Garment Photos:
              <div
                style={{ marginTop: "8px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#333",
                    }}
                  >
                    Images ({(formData.photos || []).length}/5)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    id="garment-modal-upload"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        try {
                          console.log("🎨 UPLOAD STARTING - file:", file);
                          const imageUrl = await uploadGarmentImage(
                            file,
                            selectedProject?.id,
                            garment?.id || `new_garment_${Date.now()}`
                          );
                          console.log(
                            "🎨 UPLOAD COMPLETE - imageUrl:",
                            imageUrl
                          );
                          const imageUrlString = imageUrl.url || imageUrl;
                          const newImages = [
                            ...(formData.photos || []),
                            imageUrlString,
                          ];
                          console.log(
                            "🎨 UPDATING FORMDATA - newImages:",
                            newImages
                          );
                          console.log(
                            "🎨 EXTRACTED URL STRING:",
                            imageUrlString
                          );
                          setFormData((prev) => ({
                            ...prev,
                            photos: newImages,
                          }));
                        } catch (error) {
                          console.error("Upload failed:", error);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() =>
                      document.getElementById("garment-modal-upload").click()
                    }
                    disabled={(formData.photos || []).length >= 5}
                    style={{
                      backgroundColor:
                        (formData.photos || []).length >= 5
                          ? "#ccc"
                          : "#4CAF50",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      cursor:
                        (formData.photos || []).length >= 5
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    Upload
                  </button>
                </div>

                {/* Current Images */}
                {formData.photos && formData.photos.length > 0 && (
                  <div
                    style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}
                  >
                    {formData.photos.map((photo, index) => (
                      <div key={index} style={{ position: "relative" }}>
                        <img
                          src={photo}
                          alt={`Garment photo ${index + 1}`}
                          style={{
                            width: "80px",
                            height: "100px",
                            objectFit: "cover",
                            borderRadius: "3px",
                            border: "1px solid #ddd",
                          }}
                        />
                        <button
                          onClick={() => {
                            const newImages = formData.photos.filter(
                              (_, i) => i !== index
                            );
                            setFormData((prev) => ({
                              ...prev,
                              photos: newImages,
                            }));
                          }}
                          style={{
                            position: "absolute",
                            top: "-5px",
                            right: "-5px",
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={handleSave}
            disabled={
              mode === "add-existing"
                ? !selectedExistingGarment
                : !formData.name || !formData.category
            }
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: "pointer",
              opacity: (
                mode === "add-existing"
                  ? !selectedExistingGarment
                  : !formData.name || !formData.category
              )
                ? 0.5
                : 1,
            }}
          >
            {mode === "add-existing"
              ? "Add to Wardrobe"
              : mode === "create-new"
              ? "Create & Add"
              : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Category Management Modal
function CategoryModal({ categories, setCategories, onClose }) {
  const [newCategory, setNewCategory] = React.useState("");

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories((prev) => [...prev, newCategory.trim()]);
      setNewCategory("");
    }
  };

  const removeCategory = (categoryToRemove) => {
    setCategories((prev) => prev.filter((cat) => cat !== categoryToRemove));
  };

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
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "400px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <h3>Manage Garment Categories</h3>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "10px" }}>
            Add New Category:
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
                placeholder="e.g., accessories, hat"
              />
              <button
                onClick={addCategory}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </div>
          </label>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4>Current Categories:</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {categories.map((category) => (
              <div
                key={category}
                style={{
                  backgroundColor: "#f0f0f0",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "14px",
                }}
              >
                {category}
                <button
                  onClick={() => removeCategory(category)}
                  style={{
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Usage Modal - shows which wardrobes use a specific garment
function UsageModal({ garment, usage, onClose }) {
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
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "500px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <h3>Garment Usage: {garment.name}</h3>

        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
          }}
        >
          <strong>{garment.id}</strong> - {garment.name}
          <br />
          <span style={{ color: "#666" }}>
            {garment.category} | {garment.size} | {garment.color} |{" "}
            {garment.condition}
          </span>
        </div>

        <h4>
          Used in {usage.length} wardrobe{usage.length !== 1 ? "s" : ""}:
        </h4>

        <div style={{ marginBottom: "20px" }}>
          {usage.map((use, index) => (
            <div
              key={index}
              style={{
                padding: "8px 12px",
                marginBottom: "8px",
                backgroundColor: "#e3f2fd",
                borderRadius: "4px",
                borderLeft: "4px solid #2196F3",
              }}
            >
              <strong>{use.character}</strong> - Wardrobe #{use.wardrobeNumber}
              {use.wardrobeDescription && (
                <div
                  style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}
                >
                  {use.wardrobeDescription}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Production Reports Module
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

  const [selectedDayId, setSelectedDayId] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("props");
  const [checkedItems, setCheckedItems] = React.useState({});

  // (Remove debug logging)

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

    // (Remove debug logging)

    dayScenes.forEach((scene) => {
      const sceneProps = [];
      // (Remove scene debug logging)

      // Get tagged props for this scene
      Object.entries(taggedItems).forEach(([word, item]) => {
        // Handle case variations in category names
        if (item.category && item.category.toLowerCase() === "props") {
          const sceneInstances = item.instances.filter((instance) => {
            // Handle different instance formats
            if (typeof instance === "string") {
              const sceneIndex = parseInt(instance.split("-")[0]);
              return sceneIndex === parseInt(scene.sceneNumber);
            } else if (instance.sceneNumber) {
              return (
                parseInt(instance.sceneNumber) ===
                  parseInt(scene.sceneNumber) && !instance.excluded
              );
            }
            return false;
          });
          if (sceneInstances.length > 0) {
            sceneProps.push({
              word,
              instances: sceneInstances.length,
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

      Object.entries(taggedItems).forEach(([word, item]) => {
        if (
          item.category &&
          item.category.toLowerCase() === "production design"
        ) {
          // Check actual case in your data
          const sceneInstances = item.instances.filter((instance) => {
            const sceneIndex = parseInt(instance.split("-")[0]);
            return (
              sceneIndex === parseInt(scene.sceneNumber) && !instance.excluded
            );
          });
          if (sceneInstances.length > 0) {
            sceneProductionDesign.push({
              word,
              instances: sceneInstances.length,
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

      Object.entries(taggedItems).forEach(([word, item]) => {
        if (item.category && item.category.toLowerCase() === "makeup") {
          // Check actual case in your data
          const sceneInstances = item.instances.filter((instance) => {
            const sceneIndex = parseInt(instance.split("-")[0]);
            return (
              sceneIndex === parseInt(scene.sceneNumber) && !instance.excluded
            );
          });
          if (sceneInstances.length > 0) {
            sceneMakeup.push({
              word,
              instances: sceneInstances.length,
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
            // Get individual garments for this wardrobe item
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

    // Build document content
    const content = [];

    // Header
    content.push(
      PDFExporter.createProjectHeader(
        `${departmentName} Report`,
        null,
        projectSettings?.filmTitle || "Film Production"
      )
    );

    // Project info
    content.push(
      PDFExporter.createProjectInfo(
        projectSettings?.filmTitle || "Film Production",
        `Shooting Day: ${selectedDay.date} - Day ${selectedDay.dayNumber}`,
        selectedDay.location
      )
    );

    // Scene breakdown
    if (reportData.length > 0) {
      reportData.forEach((sceneData) => {
        // Scene header
        content.push(
          PDFExporter.createSceneHeader(
            sceneData.sceneNumber,
            sceneData.sceneHeading
          )
        );

        if (department === "wardrobe") {
          // Wardrobe-specific layout
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

                // Pad incomplete rows with empty cells to ensure 3 columns
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
          // Props, Production Design, Makeup - simple table
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

    // Create document definition
    const docDef = PDFExporter.getBaseDocDef("portrait");
    docDef.content = content;
    docDef.footer = PDFExporter.createFooterFunction(
      projectSettings?.filmTitle || "Film Production"
    );

    // Download
    const date = new Date(selectedDay.date);
    const dateStr = date.toISOString().split("T")[0];
    const filename = `${departmentName.toLowerCase()}-report-${dateStr}.pdf`;
    PDFExporter.download(docDef, filename);

    alert(`${departmentName} PDF report exported as: ${filename}`);
  };

  // Get selected day info
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
                  onClick={() => {
                    exportDepartmentReportPDF("props");
                  }}
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
                                fullTaggedItem?.categoryNumber ||
                                fullTaggedItem?.chronologicalNumber ||
                                index + 1;
                              return `${number}. ${displayName}`;
                            })()}
                          </div>
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
                  onClick={() => {
                    exportDepartmentReportPDF("productiondesign");
                  }}
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
                                fullTaggedItem?.categoryNumber ||
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
                  onClick={() => {
                    exportDepartmentReportPDF("makeup");
                  }}
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
                                fullTaggedItem?.categoryNumber ||
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
                  onClick={() => {
                    exportDepartmentReportPDF("wardrobe");
                  }}
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
                                    {/* Flex container for content and image */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      {/* Content on left */}
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

export default App;
