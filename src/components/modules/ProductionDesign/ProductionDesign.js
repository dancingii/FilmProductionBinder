import React, { useState, useEffect } from "react";

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
  onUpdateTaggedItems,
  onSyncTaggedItems,
  stemWord,
}) {
  const [showScenesWithoutPD, setShowScenesWithoutPD] = useState(false);
  const [selectedPDItem, setSelectedPDItem] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);

  const pdItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Production Design")
    .sort((a, b) => a[1].chronologicalNumber - b[1].chronologicalNumber);

  const getPDForScene = (sceneIndex) => {
    const scenePD = [];
    const sceneNum = scenes[sceneIndex]?.sceneNumber;
    pdItems.forEach(([word, pdItem]) => {
      const inInstances = (pdItem.instances || []).some(
        (instance) => parseInt(instance.split("-")[0]) === sceneIndex
      );
      const inScenes =
        sceneNum !== undefined &&
        (pdItem.scenes || []).some((s) => String(s) === String(sceneNum));
      if (inInstances || inScenes) scenePD.push({ word, ...pdItem });
    });
    return scenePD.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

  const filteredScenes = scenes.filter(
    (scene, index) => showScenesWithoutPD || getPDForScene(index).length > 0
  );

  const handlePDClick = (pdItem, sceneIndex) =>
    setSelectedPDItem({ ...pdItem, contextScene: sceneIndex });
  const handlePDDoubleClick = (pdItem, sceneIndex) => {
    setCurrentIndex(sceneIndex);
    setActiveModule("Script");
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowScenePreview(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const getPastelColor = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgb(${Math.round(r + (255 - r) * 0.7)}, ${Math.round(
      g + (255 - g) * 0.7
    )}, ${Math.round(b + (255 - b) * 0.7)})`;
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
      {/* Left Column */}
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
            onClick={() =>
              setSelectedPDItem({
                word: `custom_${Date.now()}`,
                displayName: "New Custom PD Item",
                customTitle: "New Custom PD Item",
                category: "Production Design",
                color: "#4ECDC4",
                chronologicalNumber: pdItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomPD: true,
              })
            }
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
                  maxWidth: "285px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "20px",
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

      {/* Right Column */}
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
        <div>
          {filteredScenes.map((scene) => {
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

      {/* PD Details Popup */}
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
                onChange={(e) =>
                  setSelectedPDItem((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }))
                }
                onBlur={() => {
                  if (
                    onUpdatePDTitle &&
                    selectedPDItem.customTitle !== selectedPDItem.displayName
                  )
                    onUpdatePDTitle(
                      selectedPDItem.word,
                      selectedPDItem.customTitle
                    );
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
                    const parentLocations = {};
                    scriptLocations.forEach((loc) => {
                      if (!parentLocations[loc.parentLocation])
                        parentLocations[loc.parentLocation] = {
                          name: loc.parentLocation,
                          subLocations: [],
                          totalScenes: 0,
                        };
                      parentLocations[loc.parentLocation].subLocations.push(
                        loc
                      );
                      parentLocations[loc.parentLocation].totalScenes +=
                        loc.scenes.length;
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
                              const current =
                                selectedPDItem.assignedLocations || [];
                              const newAssignments = isAssigned
                                ? current.filter((l) => l !== parentLoc.name)
                                : [...current, parentLoc.name].sort();
                              setSelectedPDItem((prev) => ({
                                ...prev,
                                assignedLocations: newAssignments,
                              }));
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
                    if (onRemovePDFromScene)
                      onRemovePDFromScene(
                        selectedPDItem.word,
                        selectedPDItem.contextScene
                      );
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
                    const v = prompt(
                      `Create variant of "${
                        selectedPDItem.customTitle || selectedPDItem.displayName
                      }":`
                    );
                    if (v && onCreatePDVariant)
                      onCreatePDVariant(selectedPDItem.word, v);
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
                        selectedPDItem.instances.some(
                          (inst) =>
                            parseInt(inst.split("-")[0]) ===
                            scenes.indexOf(scene)
                        );
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (isAssigned && onRemovePDFromScene)
                              onRemovePDFromScene(
                                selectedPDItem.word,
                                sceneIndex
                              );
                            else if (!isAssigned && onAddPDToScene)
                              onAddPDToScene(selectedPDItem.word, sceneIndex);
                            setSelectedPDItem((prev) => {
                              const us = [...(prev.scenes || [])];
                              if (isAssigned) {
                                const i = us.indexOf(scene.sceneNumber);
                                if (i > -1) us.splice(i, 1);
                              } else if (!us.includes(scene.sceneNumber)) {
                                us.push(scene.sceneNumber);
                                us.sort((a, b) => a - b);
                              }
                              return { ...prev, scenes: us };
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
                  const v = prompt(
                    `Create variant of "${
                      selectedPDItem.customTitle || selectedPDItem.displayName
                    }":`
                  );
                  if (v && onCreatePDVariant)
                    onCreatePDVariant(selectedPDItem.word, v);
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
                        setSelectedPDItem((prev) => ({
                          ...prev,
                          viewingSceneNumber: selectedPDItem.scenes[0],
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

              {selectedPDItem.isNewCustomPD && (
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <button
                    onClick={() => {
                      if (selectedPDItem.customTitle?.trim() && onCreateNewPD)
                        onCreateNewPD(selectedPDItem.customTitle.trim(), null);
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
                    const vsn =
                      selectedPDItem.viewingSceneNumber ||
                      selectedPDItem.scenes[0];
                    scene = scenes.find((s) => s.sceneNumber === String(vsn));
                  }
                  if (!scene)
                    return (
                      <div style={{ padding: "20px" }}>Scene not found</div>
                    );
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
                                  const ci = selectedPDItem.scenes.indexOf(
                                    selectedPDItem.viewingSceneNumber ||
                                      selectedPDItem.scenes[0]
                                  );
                                  const pi =
                                    ci > 0
                                      ? ci - 1
                                      : selectedPDItem.scenes.length - 1;
                                  setSelectedPDItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedPDItem.scenes[pi],
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
                                  const ci = selectedPDItem.scenes.indexOf(
                                    selectedPDItem.viewingSceneNumber ||
                                      selectedPDItem.scenes[0]
                                  );
                                  return `${ci + 1} of ${
                                    selectedPDItem.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const ci = selectedPDItem.scenes.indexOf(
                                    selectedPDItem.viewingSceneNumber ||
                                      selectedPDItem.scenes[0]
                                  );
                                  const ni =
                                    ci < selectedPDItem.scenes.length - 1
                                      ? ci + 1
                                      : 0;
                                  setSelectedPDItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedPDItem.scenes[ni],
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
                                (tw) => stemmedWord === tw
                              );
                              if (isCurrentItem)
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
                              if (isTagged) {
                                const ti = Object.entries(taggedItems).find(
                                  ([k]) => stemmedWord === k
                                );
                                return (
                                  <span
                                    key={wordIndex}
                                    style={{
                                      backgroundColor: ti?.[1]?.color || "#ccc",
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

export default ProductionDesignModule;
