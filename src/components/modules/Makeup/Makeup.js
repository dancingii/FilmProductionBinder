import React, { useState, useEffect } from "react";

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
  stemWord,
}) {
  const [showScenesWithoutMakeup, setShowScenesWithoutMakeup] = useState(false);
  const [selectedMakeupItem, setSelectedMakeupItem] = useState(null);
  const [showScenePreview, setShowScenePreview] = useState(false);

  const makeupItems = Object.entries(taggedItems)
    .filter(([word, item]) => item.category === "Makeup")
    .sort((a, b) => a[1].chronologicalNumber - b[1].chronologicalNumber);

  const getMakeupForScene = (sceneIndex) => {
    const sceneMakeup = [];
    const sceneNum = scenes[sceneIndex]?.sceneNumber;
    makeupItems.forEach(([word, makeupItem]) => {
      const inInstances = (makeupItem.instances || []).some((instance) => {
        return parseInt(instance.split("-")[0]) === sceneIndex;
      });
      const inScenes =
        sceneNum !== undefined &&
        (makeupItem.scenes || []).some((s) => String(s) === String(sceneNum));
      if (inInstances || inScenes) {
        sceneMakeup.push({ word, ...makeupItem });
      }
    });
    return sceneMakeup.sort(
      (a, b) => a.chronologicalNumber - b.chronologicalNumber
    );
  };

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
    const pastelR = Math.round(r + (255 - r) * 0.7);
    const pastelG = Math.round(g + (255 - g) * 0.7);
    const pastelB = Math.round(b + (255 - b) * 0.7);
    return `rgb(${pastelR}, ${pastelG}, ${pastelB})`;
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
          <h2 style={{ margin: 0 }}>Makeup</h2>
          <button
            onClick={() => {
              const tempMakeup = {
                word: `custom_${Date.now()}`,
                displayName: "New Custom Makeup",
                customTitle: "New Custom Makeup",
                category: "Makeup",
                color: "#FF9F43",
                chronologicalNumber: makeupItems.length + 1,
                scenes: [],
                contextScene: null,
                isNewCustomMakeup: true,
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
            const assignedCharacters = item.assignedCharacters || [];
            const hasMultipleCharacters = assignedCharacters.length > 1;
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
              checked={showScenesWithoutMakeup}
              onChange={(e) => setShowScenesWithoutMakeup(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Show scenes without makeup items
          </label>
        </div>
        <div>
          {filteredScenes.map((scene) => {
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
                        const assignedCharacters =
                          makeupItem.assignedCharacters || [];
                        const hasMultipleCharacters =
                          assignedCharacters.length > 1;
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
                onChange={(e) =>
                  setSelectedMakeupItem((prev) => ({
                    ...prev,
                    customTitle: e.target.value,
                  }))
                }
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
                    if (onRemoveMakeupFromScene)
                      onRemoveMakeupFromScene(
                        selectedMakeupItem.word,
                        selectedMakeupItem.contextScene
                      );
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
                    const v = prompt(
                      `Create variant of "${
                        selectedMakeupItem.customTitle ||
                        selectedMakeupItem.displayName
                      }":`
                    );
                    if (v && onCreateMakeupVariant)
                      onCreateMakeupVariant(selectedMakeupItem.word, v);
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
                {selectedMakeupItem.contextScene !== null
                  ? "Add Items to Scene"
                  : "Manage Scenes for This Item"}
              </h4>
              {selectedMakeupItem.contextScene === null ? (
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
                        selectedMakeupItem.instances.some(
                          (instance) =>
                            parseInt(instance.split("-")[0]) ===
                            scenes.indexOf(scene)
                        );
                      return (
                        <button
                          key={sceneIndex}
                          onClick={() => {
                            if (isAssigned && onRemoveMakeupFromScene)
                              onRemoveMakeupFromScene(
                                selectedMakeupItem.word,
                                sceneIndex
                              );
                            else if (!isAssigned && onAddMakeupToScene)
                              onAddMakeupToScene(
                                selectedMakeupItem.word,
                                sceneIndex
                              );
                            setSelectedMakeupItem((prev) => {
                              const updatedScenes = [...(prev.scenes || [])];
                              if (isAssigned) {
                                const idx = updatedScenes.indexOf(
                                  scene.sceneNumber
                                );
                                if (idx > -1) updatedScenes.splice(idx, 1);
                              } else if (
                                !updatedScenes.includes(scene.sceneNumber)
                              ) {
                                updatedScenes.push(scene.sceneNumber);
                                updatedScenes.sort((a, b) => a - b);
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
                            const currentAssignments =
                              selectedMakeupItem.assignedCharacters || [];
                            const newAssignments = isAssigned
                              ? currentAssignments.filter(
                                  (c) => c !== characterName
                                )
                              : [...currentAssignments, characterName].sort();
                            const updatedTaggedItems = { ...taggedItems };
                            const makeupData =
                              updatedTaggedItems[selectedMakeupItem.word];
                            if (makeupData) {
                              updatedTaggedItems[selectedMakeupItem.word] = {
                                ...makeupData,
                                assignedCharacters: newAssignments,
                              };
                              if (onUpdateTaggedItems)
                                onUpdateTaggedItems(updatedTaggedItems);
                              if (onSyncTaggedItems)
                                onSyncTaggedItems(updatedTaggedItems);
                            }
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
                  const v = prompt(
                    `Create variant of "${
                      selectedMakeupItem.customTitle ||
                      selectedMakeupItem.displayName
                    }":`
                  );
                  if (v && onCreateMakeupVariant)
                    onCreateMakeupVariant(selectedMakeupItem.word, v);
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
                        setSelectedMakeupItem((prev) => ({
                          ...prev,
                          viewingSceneNumber: selectedMakeupItem.scenes[0],
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

              {selectedMakeupItem.isNewCustomMakeup && (
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "10px" }}
                >
                  <button
                    onClick={() => {
                      if (
                        selectedMakeupItem.customTitle?.trim() &&
                        onCreateNewMakeup
                      )
                        onCreateNewMakeup(
                          selectedMakeupItem.customTitle.trim(),
                          null
                        );
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
                                  const ci = selectedMakeupItem.scenes.indexOf(
                                    selectedMakeupItem.viewingSceneNumber ||
                                      selectedMakeupItem.scenes[0]
                                  );
                                  const pi =
                                    ci > 0
                                      ? ci - 1
                                      : selectedMakeupItem.scenes.length - 1;
                                  setSelectedMakeupItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedMakeupItem.scenes[pi],
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
                                  const ci = selectedMakeupItem.scenes.indexOf(
                                    selectedMakeupItem.viewingSceneNumber ||
                                      selectedMakeupItem.scenes[0]
                                  );
                                  return `${ci + 1} of ${
                                    selectedMakeupItem.scenes.length
                                  }`;
                                })()}
                              </span>
                              <button
                                onClick={() => {
                                  const ci = selectedMakeupItem.scenes.indexOf(
                                    selectedMakeupItem.viewingSceneNumber ||
                                      selectedMakeupItem.scenes[0]
                                  );
                                  const ni =
                                    ci < selectedMakeupItem.scenes.length - 1
                                      ? ci + 1
                                      : 0;
                                  setSelectedMakeupItem((prev) => ({
                                    ...prev,
                                    viewingSceneNumber:
                                      selectedMakeupItem.scenes[ni],
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
                                stemmedWord === selectedMakeupItem.word;
                              const isTagged = Object.keys(taggedItems).some(
                                (tw) => stemmedWord === tw
                              );
                              if (isCurrentItem)
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

export default MakeupModule;
