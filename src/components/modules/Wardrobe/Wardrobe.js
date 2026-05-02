import React, { useState } from "react";
import * as database from "../../../services/database";
import {
  uploadWardrobeImage,
  uploadGarmentImage,
  deleteMultipleImages,
} from "../../../utils/imageStorage";

const SIZING_FIELDS = [
  { key: "pants", label: "Pants" },
  { key: "shirt", label: "Shirt" },
  { key: "dress", label: "Dress" },
  { key: "shoe", label: "Shoe" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
];

// Reusable EditableField component
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

  React.useEffect(() => {
    if (garment) {
      setFormData({
        name: garment.name || "",
        category: garment.category || garmentCategories[0] || "",
        size: garment.size || "",
        color: garment.color || "",
        condition: garment.condition || "excellent",
        photos: garment.photos || [],
      });
    }
  }, [garment, garmentCategories]);

  const [selectedExistingGarment, setSelectedExistingGarment] =
    React.useState("");

  const handleSave = () => {
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
                          const imageUrl = await uploadGarmentImage(
                            file,
                            selectedProject?.id,
                            garment?.id || `new_garment_${Date.now()}`
                          );
                          const imageUrlString = imageUrl.url || imageUrl;
                          const newImages = [
                            ...(formData.photos || []),
                            imageUrlString,
                          ];
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

// Usage Modal
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

// Main Wardrobe Module
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
  castCrew,
  setCastCrew,
  selectedProject,
}) {
  const [selectedCharacter, setSelectedCharacter] = React.useState("");
  const [viewMode, setViewMode] = React.useState("characters");
  const [savedScrollPositions, setSavedScrollPositions] = React.useState({
    scenes: 0,
    characters: 0,
  });
  const scrollContainerRef = React.useRef(null);
  const [expandedScenes, setExpandedScenes] = React.useState({});
  const [expandedSceneWardrobes, setExpandedSceneWardrobes] = React.useState({});

  const handleViewSwitch = (newMode) => {
    if (scrollContainerRef.current) {
      setSavedScrollPositions((prev) => ({
        ...prev,
        [viewMode]: scrollContainerRef.current.scrollTop,
      }));
    }
    setViewMode(newMode);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          savedScrollPositions[newMode] || 0;
      }
    }, 0);
  };

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
  const [modalMode, setModalMode] = React.useState("");
  const [selectedGarment, setSelectedGarment] = React.useState(null);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [showUsageModal, setShowUsageModal] = React.useState(false);
  const [usageGarment, setUsageGarment] = React.useState(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingSizingField, setEditingSizingField] = React.useState(null);
  const [sizingEditValue, setSizingEditValue] = React.useState("");

  const [showSceneAssignPopup, setShowSceneAssignPopup] = React.useState(null);
  const [showSceneScriptViewer, setShowSceneScriptViewer] =
    React.useState(false);
  const [sceneScriptViewerIndex, setSceneScriptViewerIndex] = React.useState(0);
  const [wardrobeScriptFullMode, setWardrobeScriptFullMode] =
    React.useState(false);
  const [wardrobeScriptFullIndex, setWardrobeScriptFullIndex] =
    React.useState(0);

  const saveSizing = (key, value) => {
    if (!castCrew) return;
    const actor = castCrew.find(
      (p) => p.type === "cast" && p.character === selectedCharacter
    );
    if (!actor) return;
    const updated = castCrew.map((p) =>
      p.id === actor.id
        ? { ...p, wardrobe: { ...p.wardrobe, [key]: value } }
        : p
    );
    setCastCrew(updated);
    const updatedPerson = updated.find((p) => p.id === actor.id);
    database
      .updateSingleCastCrewPerson(selectedProject, updatedPerson)
      .catch((e) => console.error("Sizing save failed:", e));
    setEditingSizingField(null);
    setSizingEditValue("");
  };

  const buildSceneRanges = (arr) => {
    if (!arr || arr.length === 0) return "";
    const sorted = [...arr]
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0],
      end = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = end = sorted[i];
      }
    }
    return ranges.join(", ");
  };

  const toggleSceneForItem = (itemId, sceneNum) => {
    setWardrobeItems((prev) => {
      const updated = prev.map((char) => {
        if (char.characterName !== selectedCharacter) return char;
        return {
          ...char,
          items: char.items.map((it) => {
            if (it.id !== itemId) return it;
            const cur = (it.scenes || []).map(Number);
            const newScenes = cur.includes(sceneNum)
              ? cur.filter((s) => s !== sceneNum)
              : [...cur, sceneNum].sort((a, b) => a - b);
            return {
              ...it,
              scenes: newScenes,
              sceneRanges: buildSceneRanges(newScenes),
            };
          }),
        };
      });
      if (onSyncWardrobeItems) onSyncWardrobeItems(updated);
      return updated;
    });
  };

  const wardrobeGetElementStyle = (type) => {
    const base = {
      fontFamily: "Courier New, monospace",
      fontSize: "12pt",
      lineHeight: "12pt",
      marginBottom: "12pt",
      color: "#000",
    };
    switch (type) {
      case "Character":
        return { ...base, marginLeft: "200px", textTransform: "uppercase" };
      case "Dialogue":
        return { ...base, marginLeft: "100px", marginRight: "100px" };
      case "Parenthetical":
        return { ...base, marginLeft: "150px", fontStyle: "italic" };
      case "Action":
        return { ...base, marginLeft: "0" };
      case "Scene Heading":
        return {
          ...base,
          textTransform: "uppercase",
          fontWeight: "bold",
          marginTop: "24pt",
        };
      default:
        return base;
    }
  };

  const characterOptions = Object.keys(characters || {}).sort();

  const getCurrentItems = () => {
    if (!selectedCharacter) return [];
    const character = wardrobeItems.find(
      (char) => char.characterName === selectedCharacter
    );
    return character ? character.items : [];
  };

  const initializeCharacter = React.useCallback(
    (characterName) => {
      const existingCharacter = wardrobeItems.find(
        (char) => char.characterName === characterName
      );
      if (!existingCharacter) {
        const newCharacter = {
          characterName: characterName,
          items: Array.from({ length: 1 }, (_, index) => ({
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

  React.useEffect(() => {
    if (selectedCharacter) {
      initializeCharacter(selectedCharacter);
    }
  }, [selectedCharacter, initializeCharacter, onSyncWardrobeItems]);

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

  const deleteSpecificWardrobeRow = (targetIndex) => {
    if (!selectedCharacter) return;

    setWardrobeItems((prev) => {
      const characterIndex = prev.findIndex(
        (char) => char.characterName === selectedCharacter
      );

      if (characterIndex === -1) return prev;

      const currentItems = prev[characterIndex].items;

      if (currentItems.length <= 1) return prev;

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

      if (onSyncWardrobeItems) {
        onSyncWardrobeItems(newState);
      }
      return newState;
    });
  };

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

  const toggleWardrobe = (wardrobeId) => {
    setExpandedWardrobes((prev) => ({
      ...prev,
      [wardrobeId]: !prev[wardrobeId],
    }));
  };

  const openGarmentModal = (mode, wardrobeId, garment = null) => {
    setModalMode(mode);
    setCurrentWardrobeId(wardrobeId);
    setSelectedGarment(garment);
    setShowGarmentModal(true);
  };

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
        REPLACE:
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

  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      if (showSceneScriptViewer) {
        setShowSceneScriptViewer(false);
        setWardrobeScriptFullMode(false);
        return;
      }
      if (showSceneAssignPopup !== null) {
        setShowSceneAssignPopup(null);
        return;
      }
      setShowGarmentModal(false);
      setShowCategoryModal(false);
      setShowUsageModal(false);
      setShowImageViewer(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showSceneScriptViewer, showSceneAssignPopup]);

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

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto" }}>
        {/* Character View */}
        {viewMode === "characters" && (
          <>
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
                    Add Look
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
                    Remove Look
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

            {/* Character Scene Reference */}
            {selectedCharacter &&
              (() => {
                const charScenes = (
                  (characters && characters[selectedCharacter]?.scenes) ||
                  []
                )
                  .map((s) => parseInt(s))
                  .filter((n) => !isNaN(n))
                  .sort((a, b) => a - b);

                if (charScenes.length === 0)
                  return (
                    <div
                      style={{
                        backgroundColor: "#f5f5f5",
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        padding: "8px 12px",
                        marginBottom: "14px",
                        fontSize: "12px",
                        color: "#aaa",
                        fontStyle: "italic",
                      }}
                    >
                      📋 {selectedCharacter} — no scenes detected in script yet
                    </div>
                  );

                const ranges = [];
                let rangeStart = charScenes[0];
                let prev = charScenes[0];
                for (let i = 1; i <= charScenes.length; i++) {
                  const curr = charScenes[i];
                  if (curr === prev + 1) {
                    prev = curr;
                  } else {
                    ranges.push(
                      rangeStart === prev
                        ? `${rangeStart}`
                        : `${rangeStart}–${prev}`
                    );
                    rangeStart = curr;
                    prev = curr;
                  }
                }

                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      backgroundColor: "#e8f5e9",
                      border: "1px solid #c8e6c9",
                      borderRadius: "4px",
                      padding: "8px 12px",
                      marginBottom: "14px",
                      fontSize: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "#2e7d32",
                        whiteSpace: "nowrap",
                        marginTop: "1px",
                      }}
                    >
                      📋 {selectedCharacter} appears in:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px",
                      }}
                    >
                      {charScenes.map((sceneNum) => {
                        const sceneData =
                          scenes &&
                          scenes.find(
                            (s) => parseInt(s.sceneNumber) === sceneNum
                          );
                        const tooltip = sceneData
                          ? sceneData.description ||
                            sceneData.metadata?.location ||
                            ""
                          : "";
                        return (
                          <span
                            key={sceneNum}
                            title={tooltip}
                            style={{
                              backgroundColor: "#fff",
                              border: "1px solid #a5d6a7",
                              borderRadius: "3px",
                              padding: "1px 6px",
                              color: "#1b5e20",
                              fontWeight: "600",
                              cursor: tooltip ? "help" : "default",
                            }}
                          >
                            {sceneNum}
                          </span>
                        );
                      })}
                    </div>
                    <span
                      style={{
                        color: "#666",
                        whiteSpace: "nowrap",
                        marginTop: "1px",
                      }}
                    >
                      ({charScenes.length} scene
                      {charScenes.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                );
              })()}

            {/* Sizing Row */}
            {selectedCharacter &&
              (() => {
                const actor =
                  castCrew &&
                  castCrew.find(
                    (p) =>
                      p.type === "cast" && p.character === selectedCharacter
                  );
                const sizing = actor?.wardrobe || {};
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "6px",
                      backgroundColor: "#f0f4ff",
                      border: "1px solid #c5d0e8",
                      borderRadius: "4px",
                      padding: "7px 12px",
                      marginBottom: "14px",
                      fontSize: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "#3a4a7a",
                        marginRight: "4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      👔 {selectedCharacter} sizing:
                    </span>
                    {!actor ? (
                      <span style={{ color: "#aaa", fontStyle: "italic" }}>
                        No cast member assigned — assign an actor in Cast &amp;
                        Crew to add sizing
                      </span>
                    ) : (
                      SIZING_FIELDS.map(({ key, label }) => (
                        <span
                          key={key}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ color: "#666" }}>{label}:</span>
                          {editingSizingField === key ? (
                            <input
                              autoFocus
                              value={sizingEditValue}
                              onChange={(e) =>
                                setSizingEditValue(e.target.value)
                              }
                              onBlur={() => saveSizing(key, sizingEditValue)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  saveSizing(key, sizingEditValue);
                                if (e.key === "Escape") {
                                  setEditingSizingField(null);
                                  setSizingEditValue("");
                                }
                              }}
                              style={{
                                width: "50px",
                                fontSize: "11px",
                                padding: "1px 4px",
                                border: "1px solid #2196F3",
                                borderRadius: "3px",
                              }}
                            />
                          ) : (
                            <span
                              onClick={() => {
                                setEditingSizingField(key);
                                setSizingEditValue(sizing[key] || "");
                              }}
                              title="Click to edit"
                              style={{
                                cursor: "pointer",
                                fontWeight: "600",
                                color: sizing[key] ? "#1a237e" : "#bbb",
                                fontStyle: sizing[key] ? "normal" : "italic",
                                borderBottom: "1px dashed #aaa",
                                paddingBottom: "1px",
                                minWidth: "24px",
                                display: "inline-block",
                              }}
                            >
                              {sizing[key] || "—"}
                            </span>
                          )}
                          {key !== "waist" && (
                            <span style={{ color: "#ddd", marginLeft: "3px" }}>
                              ·
                            </span>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                );
              })()}

            {/* Wardrobe Table */}
            {selectedCharacter && currentItems.length > 0 && (
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
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
                  <div>Scenes</div>
                  <div>Garments</div>
                  <div>Photo</div>
                  <div></div>
                </div>

                {currentItems.map((item, index) => {
                  const isExpanded = expandedWardrobes[item.id];
                  const assignedGarments = item.assignedGarments || [];
                  const garmentDetails = assignedGarments
                    .map((id) => garmentInventory.find((g) => g.id === id))
                    .filter(Boolean);

                  return (
                    <div key={item.id}>
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

                        <div
                          style={{ textAlign: "center", fontWeight: "bold" }}
                        >
                          {item.number}
                        </div>

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

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <button
                            onClick={() => setShowSceneAssignPopup(item.id)}
                            style={{
                              backgroundColor: "#4CAF50",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              cursor: "pointer",
                              alignSelf: "flex-start",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ＋ Assign Scenes
                          </button>
                          {(item.scenes || []).length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "2px",
                              }}
                            >
                              {[...(item.scenes || [])]
                                .map(Number)
                                .filter((n) => !isNaN(n))
                                .sort((a, b) => a - b)
                                .map((s) => (
                                  <span
                                    key={s}
                                    style={{
                                      backgroundColor: "#c8e6c9",
                                      border: "1px solid #a5d6a7",
                                      borderRadius: "3px",
                                      padding: "0 4px",
                                      fontSize: "10px",
                                      color: "#1b5e20",
                                      fontWeight: "600",
                                    }}
                                  >
                                    {s}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span
                              style={{
                                color: "#bbb",
                                fontSize: "10px",
                                fontStyle: "italic",
                              }}
                            >
                              No scenes
                            </span>
                          )}
                        </div>

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

                      {isExpanded && (
                        <div
                          style={{
                            backgroundColor: "#f9f9f9",
                            padding: "10px 20px",
                            borderBottom: "1px solid #ddd",
                          }}
                        >
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

                  const handleCharacterBadgeClick = (e, item) => {
                    e.stopPropagation();
                    const wardrobeKey = `scene_${sceneIndex}_wardrobe_${item.id}`;

                    if (!isSceneExpanded) {
                      setExpandedScenes((prev) => ({
                        ...prev,
                        [sceneIndex]: true,
                      }));
                    }

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
                      <div
                        style={{
                          padding: "10px",
                          backgroundColor: "#f5f5f5",
                          borderRadius: "4px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "6px",
                          }}
                        >
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

                          <div
                            style={{
                              fontWeight: "bold",
                              color: "black",
                              flexShrink: 0,
                            }}
                          >
                            Scene {scene.sceneNumber}
                          </div>

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

                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            paddingLeft: "22px",
                          }}
                        >
                          {scene.heading}
                        </div>
                      </div>

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
                                  <span
                                    style={{ fontSize: "12px", flexShrink: 0 }}
                                  >
                                    {isWardrobeExpanded ? "▼" : "▶"}
                                  </span>

                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "14px",
                                    }}
                                  >
                                    {item.characterName} {item.number}
                                  </div>

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

        {showCategoryModal && (
          <CategoryModal
            categories={garmentCategories}
            setCategories={setGarmentCategories}
            onClose={() => setShowCategoryModal(false)}
          />
        )}

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
                    › ›
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Scene Assignment Popup */}
        {showSceneAssignPopup &&
          (() => {
            const popupItem = (() => {
              for (const char of wardrobeItems) {
                const found =
                  char.items &&
                  char.items.find((it) => it.id === showSceneAssignPopup);
                if (found) return found;
              }
              return null;
            })();
            if (!popupItem) return null;
            const charData = characters && characters[selectedCharacter];
            const charScenes = charData
              ? [...(charData.scenes || [])]
                  .map(Number)
                  .filter((n) => !isNaN(n))
                  .sort((a, b) => a - b)
              : [];
            const assignedScenes = (popupItem.scenes || [])
              .map(Number)
              .sort((a, b) => a - b);
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
                    zIndex: 1000,
                  }}
                  onClick={() => setShowSceneAssignPopup(null)}
                />
                <div
                  style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    padding: 0,
                    zIndex: 1001,
                    width: "620px",
                    maxWidth: "90vw",
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      padding: "15px 20px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      borderRadius: "8px 8px 0 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Assign Scenes — Look {popupItem.number} (
                      {selectedCharacter})
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setSceneScriptViewerIndex(0);
                          setShowSceneScriptViewer(true);
                        }}
                        disabled={charScenes.length === 0}
                        style={{
                          backgroundColor:
                            charScenes.length === 0
                              ? "rgba(255,255,255,0.4)"
                              : "white",
                          color:
                            charScenes.length === 0
                              ? "rgba(76,175,80,0.5)"
                              : "#4CAF50",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "3px",
                          cursor:
                            charScenes.length === 0
                              ? "not-allowed"
                              : "pointer",
                          fontWeight: "bold",
                        }}
                        title={
                          charScenes.length === 0
                            ? "No scenes detected for this character"
                            : "Browse all scenes this character appears in"
                        }
                      >
                        📄 View Script
                      </button>
                      <button
                        onClick={() => setShowSceneAssignPopup(null)}
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
                  </div>
                  <div
                    style={{
                      padding: "8px 20px",
                      backgroundColor: "#f5f5f5",
                      borderBottom: "1px solid #ddd",
                      fontSize: "12px",
                      color: "#555",
                    }}
                  >
                    {assignedScenes.length} scene
                    {assignedScenes.length !== 1 ? "s" : ""} assigned · Click
                    to toggle · 📄 browses all {charScenes.length} character
                    scenes
                  </div>
                  <div
                    style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}
                  >
                    {charScenes.length === 0 ? (
                      <div
                        style={{
                          color: "#aaa",
                          fontStyle: "italic",
                          textAlign: "center",
                          padding: "20px 0",
                        }}
                      >
                        No scenes found for {selectedCharacter}. Parse your
                        script first.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        {charScenes.map((sceneNum) => {
                          const isAssigned = assignedScenes.includes(sceneNum);
                          const sceneData =
                            scenes &&
                            scenes.find(
                              (s) => parseInt(s.sceneNumber) === sceneNum
                            );
                          return (
                            <button
                              key={sceneNum}
                              onClick={() =>
                                toggleSceneForItem(popupItem.id, sceneNum)
                              }
                              title={
                                sceneData?.description ||
                                sceneData?.metadata?.location ||
                                ""
                              }
                              style={{
                                padding: "6px 14px",
                                borderRadius: "4px",
                                border: isAssigned
                                  ? "1px solid #388E3C"
                                  : "1px solid #bdbdbd",
                                backgroundColor: isAssigned
                                  ? "#4CAF50"
                                  : "#f5f5f5",
                                color: isAssigned ? "white" : "#444",
                                fontWeight: isAssigned ? "bold" : "normal",
                                cursor: "pointer",
                                fontSize: "14px",
                                minWidth: "44px",
                              }}
                            >
                              {sceneNum}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

        {/* Scene Script Viewer */}
        {showSceneScriptViewer &&
          (() => {
            const popupItem = (() => {
              for (const char of wardrobeItems) {
                const found =
                  char.items &&
                  char.items.find((it) => it.id === showSceneAssignPopup);
                if (found) return found;
              }
              return null;
            })();
            if (!popupItem) return null;
            const charData = characters && characters[selectedCharacter];
            const allCharScenes = charData
              ? [...(charData.scenes || [])]
                  .map(Number)
                  .filter((n) => !isNaN(n))
                  .sort((a, b) => a - b)
              : [];
            const allCharSceneData = allCharScenes
              .map(
                (n) =>
                  scenes && scenes.find((s) => parseInt(s.sceneNumber) === n)
              )
              .filter(Boolean);
            if (allCharSceneData.length === 0) return null;
            const assignedSceneNums = (popupItem.scenes || []).map(Number);
            const filteredIdx = Math.min(
              sceneScriptViewerIndex,
              allCharSceneData.length - 1
            );
            const activeWardrobeIdx = wardrobeScriptFullMode
              ? Math.min(wardrobeScriptFullIndex, scenes.length - 1)
              : filteredIdx;
            const currentScene = wardrobeScriptFullMode
              ? scenes[activeWardrobeIdx] || allCharSceneData[filteredIdx]
              : allCharSceneData[filteredIdx];
            const isAssigned = assignedSceneNums.includes(
              parseInt(currentScene.sceneNumber)
            );
            return (
              <>
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0,0,0,0.4)",
                    zIndex: 1100,
                  }}
                  onClick={() => {
                    setShowSceneScriptViewer(false);
                    setWardrobeScriptFullMode(false);
                  }}
                />
                <div
                  style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    backgroundColor: "white",
                    border: "2px solid #4CAF50",
                    borderRadius: "8px",
                    padding: 0,
                    zIndex: 1101,
                    width: "900px",
                    maxWidth: "90vw",
                    height: "80vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 20px",
                      backgroundColor: "#4CAF50",
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
                        gap: "12px",
                      }}
                    >
                      <button
                        onClick={() =>
                          wardrobeScriptFullMode
                            ? setWardrobeScriptFullIndex(
                                Math.max(0, activeWardrobeIdx - 1)
                              )
                            : setSceneScriptViewerIndex(
                                Math.max(0, filteredIdx - 1)
                              )
                        }
                        disabled={
                          wardrobeScriptFullMode
                            ? activeWardrobeIdx === 0
                            : filteredIdx === 0
                        }
                        style={{
                          backgroundColor: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === 0
                              : filteredIdx === 0
                          )
                            ? "#ccc"
                            : "white",
                          color: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === 0
                              : filteredIdx === 0
                          )
                            ? "#888"
                            : "#4CAF50",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "3px",
                          cursor: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === 0
                              : filteredIdx === 0
                          )
                            ? "not-allowed"
                            : "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        ← Prev
                      </button>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <div style={{ fontWeight: "bold" }}>
                          Scene {currentScene.sceneNumber} (
                          {wardrobeScriptFullMode
                            ? `${activeWardrobeIdx + 1} of ${scenes.length}`
                            : `${filteredIdx + 1} of ${
                                allCharSceneData.length
                              }`}
                          )
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            padding: "1px 8px",
                            borderRadius: "10px",
                            backgroundColor: isAssigned
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(0,0,0,0.2)",
                            color: "white",
                          }}
                        >
                          {isAssigned ? "✓ In this look" : "○ Not in this look"}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          wardrobeScriptFullMode
                            ? setWardrobeScriptFullIndex(
                                Math.min(
                                  scenes.length - 1,
                                  activeWardrobeIdx + 1
                                )
                              )
                            : setSceneScriptViewerIndex(
                                Math.min(
                                  allCharSceneData.length - 1,
                                  filteredIdx + 1
                                )
                              )
                        }
                        disabled={
                          wardrobeScriptFullMode
                            ? activeWardrobeIdx === scenes.length - 1
                            : filteredIdx === allCharSceneData.length - 1
                        }
                        style={{
                          backgroundColor: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === scenes.length - 1
                              : filteredIdx === allCharSceneData.length - 1
                          )
                            ? "#ccc"
                            : "white",
                          color: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === scenes.length - 1
                              : filteredIdx === allCharSceneData.length - 1
                          )
                            ? "#888"
                            : "#4CAF50",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "3px",
                          cursor: (
                            wardrobeScriptFullMode
                              ? activeWardrobeIdx === scenes.length - 1
                              : filteredIdx === allCharSceneData.length - 1
                          )
                            ? "not-allowed"
                            : "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        Next →
                      </button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          cursor: "pointer",
                          fontSize: "12px",
                          userSelect: "none",
                          color: "white",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={wardrobeScriptFullMode}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const fi = (scenes || []).findIndex(
                                (s) =>
                                  String(s.sceneNumber) ===
                                  String(currentScene.sceneNumber)
                              );
                              setWardrobeScriptFullIndex(fi >= 0 ? fi : 0);
                            } else {
                              const curNum =
                                scenes[activeWardrobeIdx]?.sceneNumber;
                              const fi = allCharSceneData.findIndex(
                                (s) => String(s.sceneNumber) === String(curNum)
                              );
                              setSceneScriptViewerIndex(fi >= 0 ? fi : 0);
                            }
                            setWardrobeScriptFullMode(e.target.checked);
                          }}
                          style={{ cursor: "pointer", accentColor: "white" }}
                        />
                        Full Script
                      </label>
                      <button
                        onClick={() => {
                          setShowSceneScriptViewer(false);
                          setWardrobeScriptFullMode(false);
                        }}
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
                        ✕ Close (ESC)
                      </button>
                    </div>
                  </div>
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
                  <div
                    style={{
                      flex: 1,
                      padding: "1.5in",
                      overflow: "auto",
                      backgroundColor: "white",
                      boxSizing: "border-box",
                      fontFamily: "Courier New, monospace",
                    }}
                  >
                    <div style={wardrobeGetElementStyle("Scene Heading")}>
                      {currentScene.heading}
                    </div>
                    <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                      {(currentScene.content || []).map((block, i) => (
                        <div
                          key={i}
                          style={wardrobeGetElementStyle(block.type)}
                        >
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
    </div>
  );
}

export default WardrobeModule;