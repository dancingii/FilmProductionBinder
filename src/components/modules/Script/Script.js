import React, { useState, useEffect } from "react";
import {
    stemWord,
    calculateScenePageStats,
    getElementStyle,
    formatElementText,
    calculateBlockLines,
    LINES_PER_PAGE,
  } from "../../../utils.js";
  import { usePresence } from "../../../hooks/usePresence";
  import PresenceIndicator from "../../shared/PresenceIndicator";
// ─── Navigation Buttons ───────────────────────────────────────────────────────
function NavigationButtons({ scenes, setCurrentIndex }) {
  if (scenes.length === 0) return null;
  return (
    <div style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee" }}>
      <button
        onClick={() => setCurrentIndex((prev) => (prev - 1 + scenes.length) % scenes.length)}
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

// ─── Scene Dropdown ───────────────────────────────────────────────────────────
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
    if (e.key === "Enter") handleSceneNumberSave();
    else if (e.key === "Escape") { setEditingScene(null); setNewSceneNumber(""); }
  };

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, width: "500px", border: "2px inset #ccc", backgroundColor: "white", fontFamily: "monospace", fontSize: "12px", overflowY: "auto", overflowX: "hidden" }}>
        {scenes.map((scene, index) => {
          const statusColor = getSceneStatusColor(scene.sceneNumber);
          const isCurrentScene = currentIndex === index;
          return (
            <PresenceIndicator key={index} itemId={scene.sceneNumber} otherUsers={otherUsers} position="top">
              <div
                onClick={() => { setCurrentIndex(index); setViewingSceneIndex(index); }}
                onDoubleClick={() => handleSceneNumberEdit(index)}
                style={{ padding: "2px 8px", cursor: "pointer", backgroundColor: isCurrentScene ? "#316AC5" : statusColor !== "transparent" ? statusColor : "white", color: isCurrentScene ? "white" : "black", borderBottom: "1px solid #f0f0f0", userSelect: "none" }}
              >
                <strong style={{ fontSize: "14px" }}>{String(scene.sceneNumber).padStart(3, "0")}</strong>
                {" - "}
                {scene.heading}
              </div>
            </PresenceIndicator>
          );
        })}
      </div>

      {editingScene !== null && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={() => setEditingScene(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1001, minWidth: "300px" }}>
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
                  style={{ width: "100%", padding: "8px", marginTop: "5px", border: "1px solid #ddd", borderRadius: "3px" }}
                />
              </label>
            </div>
            <div>
              <button onClick={handleSceneNumberSave} style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "10px" }}>Save</button>
              <button onClick={() => setEditingScene(null)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Slideshow ────────────────────────────────────────────────────────────────
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
  useEffect(() => {
    const scriptContainer = document.getElementById("script-viewer-container");
    if (scriptContainer) scriptContainer.scrollTop = 0;
  }, [currentIndex]);

  const [editingContent, setEditingContent] = useState([]);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(null);

  const elementTypes = ["Scene Heading", "Action", "Character", "Dialogue", "Parenthetical", "Transition"];

  useEffect(() => {
    if (isEditMode && scenes[currentIndex]) {
      setEditingContent([...scenes[currentIndex].content]);
    }
  }, [isEditMode, currentIndex, scenes]);

  const updateBlockText = (blockIndex, newText) => {
    const updated = [...editingContent];
    updated[blockIndex].text = newText;
    setEditingContent(updated);
  };

  const updateBlockType = (blockIndex, newType) => {
    const updated = [...editingContent];
    updated[blockIndex].type = newType;
    if (newType === "Character") updated[blockIndex].text = updated[blockIndex].text.toUpperCase();
    setEditingContent(updated);
  };

  const addNewBlock = (afterIndex) => {
    const updated = [...editingContent];
    updated.splice(afterIndex + 1, 0, { type: "Action", text: "", formatting: null });
    setEditingContent(updated);
    setSelectedBlockIndex(afterIndex + 1);
  };

  const deleteBlock = (blockIndex) => {
    if (editingContent.length > 1) {
      const updated = [...editingContent];
      updated.splice(blockIndex, 1);
      setEditingContent(updated);
      setSelectedBlockIndex(null);
    }
  };

  const saveChanges = () => {
    if (onSceneContentChange) onSceneContentChange(editingContent);
  };

  if (scenes.length === 0) {
    return <div style={{ fontStyle: "italic" }}>No project loaded. Please upload a .fdx file to begin.</div>;
  }

  const scene = scenes[currentIndex];

  const handleWordDoubleClick = (event, word, blockIndex, wordIndex) => {
    event.preventDefault();
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const isTagged = isWordInstanceTagged(cleanWord, currentIndex, blockIndex, wordIndex);
    if (isTagged) {
      setShowTagDropdown({ x: event.clientX, y: event.clientY, word, cleanWord, sceneIndex: currentIndex, blockIndex, wordIndex, isTagged: true, category: taggedItems[cleanWord].category });
    } else {
      setShowTagDropdown({ x: event.clientX, y: event.clientY, word, cleanWord, sceneIndex: currentIndex, blockIndex, wordIndex, isTagged: false });
    }
  };

  const renderTextWithTags = (text, blockIndex, block) => {
    if (block && block.formatting) {
      const formatted = formatElementText(block);
      if (React.isValidElement(formatted)) return formatted;
    }
    const words = text.split(/(\s+)/);
    return words.map((word, wordIndex) => {
      if (word.trim() === "") return word;
      const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
      const taggedItem = taggedItems[cleanWord];
      const isThisInstanceTagged = isWordInstanceTagged(cleanWord, currentIndex, blockIndex, wordIndex);
      return (
        <span
          key={wordIndex}
          onDoubleClick={(e) => handleWordDoubleClick(e, word, blockIndex, wordIndex)}
          style={{ backgroundColor: isThisInstanceTagged ? taggedItem.color : "transparent", cursor: "pointer", padding: isThisInstanceTagged ? "1px 2px" : "0", borderRadius: isThisInstanceTagged ? "2px" : "0" }}
        >
          {word}
        </span>
      );
    });
  };

  return (
    <div style={{ minWidth: "6.1in", width: "6.1in" }}>
      <h2 style={{ marginBottom: "20px", textTransform: "uppercase", backgroundColor: getSceneStatusColor(scene.sceneNumber), padding: getSceneStatusColor(scene.sceneNumber) !== "transparent" ? "8px 12px" : "0", borderRadius: getSceneStatusColor(scene.sceneNumber) !== "transparent" ? "4px" : "0", display: "inline-block" }}>
        {scene.sceneNumber}: {scene.heading}
      </h2>

      {scene.metadata && (
        <div style={{ backgroundColor: "#f0f0f0", padding: "10px", marginBottom: "20px", fontSize: "12px", border: "1px solid #ddd" }}>
          <strong>Scene Info:</strong>
          {scene.metadata.location && ` Location: ${scene.metadata.location}`}
          {scene.metadata.timeOfDay && ` | Time: ${scene.metadata.timeOfDay}`}
          {scene.metadata.intExt && ` | ${scene.metadata.intExt}`}
          {(() => {
            try {
              const sceneStats = calculateScenePageStats(currentIndex, scenes, 107);
              return ` | Page ${sceneStats.startPage} | Length: ${sceneStats.pageLength}`;
            } catch (error) {
              return ` | Page calc error: ${error.message}`;
            }
          })()}
        </div>
      )}

      <div>
        {isEditMode
          ? editingContent.map((block, blockIndex) => {
              const style = getElementStyle(block.type);
              const isSelected = selectedBlockIndex === blockIndex;
              return (
                <div key={blockIndex} style={{ position: "relative" }}>
                  {isSelected && (
                    <div style={{ position: "absolute", top: "-30px", left: "0", display: "flex", gap: "5px", zIndex: 100, backgroundColor: "white", padding: "2px", border: "1px solid #ccc", borderRadius: "3px" }}>
                      <select value={block.type} onChange={(e) => updateBlockType(blockIndex, e.target.value)} style={{ fontSize: "10px", padding: "2px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "2px" }}>
                        {elementTypes.map((type) => (<option key={type} value={type}>{type}</option>))}
                      </select>
                      <button onClick={(e) => { e.stopPropagation(); addNewBlock(blockIndex); }} style={{ fontSize: "10px", padding: "2px 4px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "2px", cursor: "pointer" }} title="Add block after this one">+</button>
                      {editingContent.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); deleteBlock(blockIndex); }} style={{ fontSize: "10px", padding: "2px 4px", backgroundColor: "#F44336", color: "white", border: "none", borderRadius: "2px", cursor: "pointer" }} title="Delete this block">×</button>
                      )}
                    </div>
                  )}
                  <div
                    style={{ ...style, border: isSelected ? "2px solid #2196F3" : "1px solid transparent", position: "relative", cursor: "text", minHeight: "12pt" }}
                    contentEditable
                    suppressContentEditableWarning={true}
                    onInput={(e) => updateBlockText(blockIndex, e.target.textContent)}
                    onClick={() => setSelectedBlockIndex(blockIndex)}
                    dangerouslySetInnerHTML={{ __html: block.text }}
                  />
                </div>
              );
            })
            : (() => {
                let currentLine = 0;
                let currentPage = 1;
                const elements = [];
                scene.content.forEach((block, blockIndex) => {
                  const blockLines = calculateBlockLines(block);
                  if (blockIndex > 0 && currentLine + blockLines > LINES_PER_PAGE) {
                    currentPage++;
                    currentLine = 0;
                    elements.push(
                      <div key={`pb-${blockIndex}`} style={{ borderTop: "2px dashed #ccc", margin: "24pt 0", paddingTop: "12pt", fontSize: "10pt", color: "#999", textAlign: "right" }}>
                        Page {currentPage}
                      </div>
                    );
                  }
                  const style = getElementStyle(block.type);
                  elements.push(
                    <div key={blockIndex} style={style}>
                      {block.formatting ? formatElementText(block) : renderTextWithTags(block.text, blockIndex, block)}
                    </div>
                  );
                  currentLine += blockLines;
                });
                return elements;
              })()}
      </div>

      {showTagDropdown && (
        <div style={{ position: "fixed", left: showTagDropdown.x, top: showTagDropdown.y, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 8px rgba(0,0,0,0.2)", zIndex: 1000, minWidth: "150px" }}>
          {showTagDropdown.isTagged ? (
            <div
              onClick={() => untagWordInstance(showTagDropdown.word, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex)}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #eee" }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
            >
              Remove Tag ({showTagDropdown.category})
            </div>
          ) : (
            tagCategories.map((category, index) => (
              <div
                key={index}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); tagWord(showTagDropdown.word, category.name, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex); }}
                style={{ padding: "8px 12px", cursor: "pointer", borderBottom: index < tagCategories.length - 1 ? "1px solid #eee" : "none", display: "flex", alignItems: "center" }}
                onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
                onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
              >
                <div style={{ width: "12px", height: "12px", backgroundColor: category.color, marginRight: "8px", borderRadius: "2px" }} />
                {category.name}
              </div>
            ))
          )}
        </div>
      )}

      {showTagDropdown && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }} onClick={() => setShowTagDropdown(null)} />
      )}
    </div>
  );
}

// ─── Script ───────────────────────────────────────────────────────────────────
function Script({
  scenes,
  currentIndex,
  setCurrentIndex,
  setScenes,
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
  const getSceneStatusColor = (sceneNumber) => {
    const stripboardScene = stripboardScenes?.find((s) => s.sceneNumber === sceneNumber);
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

  const [isEditMode, setIsEditMode] = useState(false);
  const [showFullScript, setShowFullScript] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key !== "Escape") return; setShowFullScript(false); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 44px)", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px", display: "flex", gap: "10px", alignItems: "center", flexShrink: 0, borderBottom: "1px solid #eee" }}>
        {isViewOnly && (
          <div style={{ padding: "8px 16px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontWeight: "bold", fontSize: "14px" }}>VIEW ONLY MODE</div>
        )}
        {canEdit && <input type="file" accept=".fdx" onChange={handleFileUpload} />}
        {canEdit && (
          <button onClick={() => setIsEditMode(!isEditMode)} style={{ padding: "8px 16px", backgroundColor: isEditMode ? "#F44336" : "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>
            {isEditMode ? "View" : "Edit"}
          </button>
        )}
        {isEditMode && canEdit && (
          <button onClick={() => { setIsEditMode(false); alert("Scene changes saved!"); }} style={{ padding: "8px 16px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>Save</button>
        )}
        {canEdit && (
          <label>
            <input type="file" accept=".fdx" onChange={(e) => { if (e.target.files[0]) { handleSingleSceneUpload(e.target.files[0]); e.target.value = ""; } }} style={{ display: "none" }} />
            <div style={{ padding: "8px 16px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>Replace Scene</div>
          </label>
        )}
        <button onClick={() => setShowFullScript(true)} style={{ padding: "8px 16px", backgroundColor: "#9C27B0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>Full Script</button>
      </div>

      {showFullScript && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }} onClick={() => setShowFullScript(false)}>
          <div style={{ backgroundColor: "white", width: "95%", maxWidth: "9.28in", maxHeight: "90vh", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ backgroundColor: "#9C27B0", color: "white", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>Full Script - All Scenes</h3>
              <button onClick={() => setShowFullScript(false)} style={{ backgroundColor: "transparent", border: "none", color: "white", fontSize: "28px", cursor: "pointer", padding: "0 5px", lineHeight: "1" }}>×</button>
            </div>
            <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: "white", boxSizing: "border-box", textAlign: "left", fontFamily: "Courier New, monospace" }}>
              {(() => {
                const linesPerPage = LINES_PER_PAGE;
                let currentLine = 0;
                let currentPage = 1;
                const elements = [];
                const scriptScenes = scenes.filter((scene) => {
                  const heading = scene.heading?.toUpperCase() || "";
                  const hasIntExt = heading.includes("INT.") || heading.includes("EXT.");
                  if (!hasIntExt) {
                    const hasWrittenBy = scene.content?.some((block) => block.text?.toLowerCase().includes("written by"));
                    return !hasWrittenBy;
                  }
                  return true;
                });
                scriptScenes.forEach((scene, sceneIndex) => {
                  if (currentLine > 0 && currentLine + 3 > linesPerPage) {
                    currentPage++;
                    currentLine = 0;
                    elements.push(<div key={`pagebreak-${currentPage}`} style={{ borderTop: "2px dashed #ccc", margin: "24pt 0", paddingTop: "12pt", fontSize: "10pt", color: "#999", textAlign: "right" }}>Page {currentPage}</div>);
                  }
                  elements.push(
                    <div key={`scene-heading-${scene.sceneNumber}`} style={{ fontFamily: "Courier New, monospace", fontSize: "12pt", lineHeight: "12pt", marginBottom: "12pt", marginTop: sceneIndex === 0 ? "0" : "24pt", color: "#000", textTransform: "uppercase", fontWeight: "bold", backgroundColor: getSceneStatusColor(scene.sceneNumber), padding: "4px 0", position: "relative" }}>
                      <span style={{ position: "absolute", left: "-60px", fontWeight: "normal" }}>{scene.sceneNumber}</span>
                      {scene.heading}
                      <span style={{ position: "absolute", right: "-60px", fontWeight: "normal" }}>{scene.sceneNumber}</span>
                    </div>
                  );
                  currentLine += 3;
                  if (scene.content) {
                    scene.content.forEach((block, blockIndex) => {
                      const blockLines = calculateBlockLines(block);
                      if (currentLine + blockLines > linesPerPage) {
                        currentPage++;
                        currentLine = 0;
                        elements.push(<div key={`pagebreak-${currentPage}-${blockIndex}`} style={{ borderTop: "2px dashed #ccc", margin: "24pt 0", paddingTop: "12pt", fontSize: "10pt", color: "#999", textAlign: "right" }}>Page {currentPage}</div>);
                      }
                      const style = getElementStyle(block.type);
                      elements.push(<div key={`block-${scene.sceneNumber}-${blockIndex}`} style={style}>{formatElementText(block)}</div>);
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

<div style={{ display: "flex", flexDirection: "row", flex: 1, overflow: "hidden", minWidth: 0 }}>
        {/* Left: script viewer */}
        <div
          id="script-viewer-container"
          style={{ width: "100%", maxWidth: "9.28in", minWidth: "300px", flex: "0 0 9.28in", overflowY: "auto", overflowX: "auto", border: "1px solid #ccc", padding: "1.5in", backgroundColor: getSceneStatusColor(scenes[currentIndex]?.sceneNumber), boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", boxSizing: "border-box", textAlign: "left", fontFamily: "Courier New, monospace" }}
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
              const updatedScenes = [...scenes];
              updatedScenes[currentIndex].content = newContent;
              setScenes(updatedScenes);
            }}
          />
        </div>
        {/* Right: scene list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <NavigationButtons scenes={scenes} setCurrentIndex={setCurrentIndex} />
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
      </div>
    </div>
  );
}

export default Script;