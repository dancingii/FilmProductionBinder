import React, { useState, useEffect } from "react";
import { getElementStyle, calculateBlockLines, LINES_PER_PAGE } from "../../../utils.js";
import * as database from "../../../services/database";
import { uploadImage, deleteImage, extractPathFromUrl } from "../../../utils/imageStorage";
import ImageUpload from "../../shared/ImageUpload";

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
  onDeleteCharacter,
  onUpdateCharacterOverrides,
  syncCastCrewToDatabase,
  selectedProject,
  userRole,
  canEdit,
  isViewOnly,
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(null);

  const exportCharacterSides = (characterName, finalScenes) => {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF?.jsPDF || window.jsPDF;
    if (!jsPDF) { alert("PDF export library not available."); return; }

    if (finalScenes.length === 0) { alert("No scenes found for this character."); return; }

    const targetNums = new Set(finalScenes.map(String));
    const doc = new jsPDF("portrait", "pt", "letter");
    const PW = 612, LM = 108, RM = 540, TOP = 48, LH = 12, BOTTOM = 756, SLPP = LINES_PER_PAGE;
    const COLS = {
      "Scene Heading": { x: LM,       w: RM - LM },
      "Action":        { x: LM,       w: RM - LM },
      "Character":     { x: LM + 144, w: 216 },
      "Dialogue":      { x: LM + 72,  w: 252 },
      "Parenthetical": { x: LM + 108, w: 216 },
      "Transition":    { x: LM + 144, w: RM - LM - 144 },
    };

    // Build flat content list with exact cumulative line positions
    const sorted = [...scenes]
      .filter(s => s.content)
      .sort((a, b) => parseFloat(a.sceneNumber) - parseFloat(b.sceneNumber));

    let cumLine = 0;
    const flat = [];
    sorted.forEach(scene => {
      flat.push({ sceneNum: scene.sceneNumber, type: "Scene Heading", text: scene.heading?.toUpperCase() || "", startLine: cumLine, lineCount: 2, isHeading: true, isHighlighted: false });
      cumLine += 2;

      let charActive = false;
      (scene.content || []).forEach(block => {
        const lc = calculateBlockLines(block);
        const isTarget = targetNums.has(String(scene.sceneNumber));
        let text = block.text || "";
        if (block.type === "Character") {
          text = text.toUpperCase();
          charActive = isTarget && text.trim() === characterName.toUpperCase();
        }
        const isHighlighted = isTarget && (
          (block.type === "Character" && text.trim() === characterName.toUpperCase()) ||
          ((block.type === "Dialogue" || block.type === "Parenthetical") && charActive)
        );
        if (block.type !== "Dialogue" && block.type !== "Parenthetical" && block.type !== "Character") charActive = false;
        flat.push({ sceneNum: scene.sceneNumber, type: block.type, text, startLine: cumLine, lineCount: lc, isHighlighted });
        cumLine += lc;
      });
      cumLine += 0.5;
    });

    // Find script pages containing target scenes
    const targetPages = new Set();
    flat.forEach(item => {
      if (!targetNums.has(String(item.sceneNum))) return;
      const sp = Math.floor(item.startLine / SLPP);
      const ep = Math.floor((item.startLine + item.lineCount - 0.01) / SLPP);
      for (let p = sp; p <= ep; p++) targetPages.add(p);
    });

    const pages = Array.from(targetPages).sort((a, b) => a - b);
    if (pages.length === 0) { alert("No content found."); return; }

    let firstPDFPage = true;
    pages.forEach((scriptPage, pIdx) => {
      if (!firstPDFPage) doc.addPage();
      firstPDFPage = false;
      const lineStart = scriptPage * SLPP;
      const lineEnd = lineStart + SLPP;

      doc.setFont("Courier", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${scriptPage + 1}.`, PW - 50, TOP - 15);

      if (pIdx === 0) {
        doc.setFont("Courier", "bold");
        doc.setFontSize(11);
        doc.text(`${characterName} — Character Sides`, PW / 2, TOP - 28, { align: "center" });
      }

      const items = flat.filter(item => item.startLine < lineEnd && item.startLine + item.lineCount > lineStart);

      // Render sequentially tracking actual y to avoid overlap from estimation mismatch
      let yPos = TOP;
      items.forEach(item => {
        const isTarget = targetNums.has(String(item.sceneNum));
        const c = COLS[item.type] || COLS["Action"];
        const isBold = item.type === "Scene Heading";
        doc.setFontSize(12);
        doc.setFont("Courier", isBold ? "bold" : "normal");
        const lines = doc.splitTextToSize(item.text, c.w);

        // Add spacing before scene headings (except at top of page)
        if (item.isHeading && yPos > TOP) yPos += LH;

        const baseY = yPos;
        if (baseY > BOTTOM) return;

        if (!isTarget) {
          doc.setFont("Courier", isBold ? "bold" : "normal");
          doc.setTextColor(150, 150, 150);
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.5);
          lines.forEach((line, li) => {
            const y = baseY + li * LH;
            if (y > BOTTOM) return;
            doc.text(line, c.x, y);
            doc.line(c.x, y - 4, c.x + doc.getTextWidth(line), y - 4);
          });
          if (item.isHeading) {
            doc.text(String(item.sceneNum), LM - 30, baseY);
            doc.text(String(item.sceneNum), RM + 5, baseY);
          }
        } else if (item.isHighlighted) {
          doc.setFont("Courier", "bold");
          doc.setTextColor(0, 0, 0);
          lines.forEach((line, li) => {
            const y = baseY + li * LH;
            if (y > BOTTOM) return;
            const w = doc.getTextWidth(line);
            doc.setFillColor(255, 255, 0);
            doc.rect(c.x - 2, y - 10, w + 4, LH, "F");
            doc.setTextColor(0, 0, 0);
            doc.text(line, c.x, y);
          });
          doc.setFont("Courier", "normal");
        } else {
          doc.setFont("Courier", isBold ? "bold" : "normal");
          doc.setTextColor(0, 0, 0);
          lines.forEach((line, li) => {
            const y = baseY + li * LH;
            if (y > BOTTOM) return;
            doc.text(line, c.x, y);
          });
          if (item.isHeading) {
            doc.text(String(item.sceneNum), LM - 30, baseY);
            doc.text(String(item.sceneNum), RM + 5, baseY);
          }
        }

        // Advance yPos by actual rendered lines + 1 spacing line
        yPos += lines.length * LH + LH;
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("Courier", "normal");
    });

    const filename = `${characterName.toLowerCase().replace(/\s+/g, "_")}_sides.pdf`;
    doc.save(filename);
    alert(`Sides exported as: ${filename}`);
  };
  const [editingCharacterNumber, setEditingCharacterNumber] = useState(null);
  const [editingCharacterNumberValue, setEditingCharacterNumberValue] = useState("");
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

  const handleImageUpload = async (characterName, file) => {
    const actor = getActorForCharacter(characterName);
    if (!actor) return;

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

    const updatedCastCrew = castCrew.map((person) =>
      person.id === actor.id ? { ...person, photoUrl: result.url } : person
    );

    setCastCrew(updatedCastCrew);
    syncCastCrewToDatabase(updatedCastCrew);
  };

  const handleImageDelete = async (characterName) => {
    const actor = getActorForCharacter(characterName);
    if (!actor || !actor.photoUrl) return;

    const filePath = extractPathFromUrl(actor.photoUrl);
    if (filePath) {
      await deleteImage(filePath);
    }

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
      if (onDeleteCharacter) {
        onDeleteCharacter(characterName, updated);
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
          if (cleanName && updated[cleanName] && !characterFirstAppearance[cleanName]) {
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

    if (onDeleteCharacter) {
      onDeleteCharacter(characterName, updated);
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
          if (cleanName && updatedCharacters[cleanName] && !characterFirstAppearance[cleanName]) {
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
            if (!detectedCharacters[cleanName].scenes.includes(scene.sceneNumber)) {
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
              if (!detectedCharacters[charName].scenes.includes(scene.sceneNumber)) {
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

    setCharacters(detectedCharacters);

    if (onUpdateCharacters) {
      onUpdateCharacters(detectedCharacters);
    }
  };

  const toggleSceneAssignment = (characterName, sceneNumber) => {
    const updated = { ...characters };
    const character = updated[characterName];

    if (!character) return;

    const sceneNumStr = String(sceneNumber);
    const sceneIndex = character.scenes.findIndex((s) => String(s) === sceneNumStr);

    if (sceneIndex > -1) {
      updated[characterName] = {
        ...character,
        scenes: character.scenes.filter((s, i) => i !== sceneIndex),
      };
    } else {
      const newScenes = [...character.scenes, sceneNumber].sort((a, b) => {
        const aNum = parseFloat(String(a).replace(/[^0-9.]/g, ""));
        const bNum = parseFloat(String(b).replace(/[^0-9.]/g, ""));
        return aNum - bNum;
      });
      updated[characterName] = {
        ...character,
        scenes: newScenes,
      };
    }

    setCharacters(updated);

    const characterToSync = updated[characterName];
    database
      .upsertCharacter(selectedProject, characterName, characterToSync)
      .catch((error) => {
        console.error("Failed to update character:", error);
        alert("Failed to update character. Error: " + error.message);
      });
  };

  const getActorForCharacter = (characterName) => {
    return castCrew.find(
      (person) => person.type === "cast" && person.character === characterName
    );
  };

  const characterList = Object.values(characters).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );

  const existingCharacters = Object.keys(characters).filter(
    (name) => name !== showDeleteDialog?.characterName
  );

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowAddDialog(false);
      setShowDeleteDialog(null);
      setShowDetailsPopup(null);
      setShowScenesPopup(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 40px)", boxSizing: "border-box", position: "relative" }}>
      {/* Fixed header */}
      <div style={{ position: "sticky", top: 0, left: 0, right: 0, backgroundColor: "white", zIndex: 100, padding: "20px 20px 15px 20px", borderBottom: "1px solid #ddd", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h2 style={{ margin: 0 }}>Characters</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            {canEdit && (
              <>
                <button onClick={() => setShowAddDialog(true)}
                  style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  + Add Character
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
      <div style={{ padding: "20px", height: "calc(100% - 100px)", overflowY: "auto" }}>
        {/* Card Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
          {characterList.map((character) => {
            const actor = getActorForCharacter(character.name);
            const finalScenes = getFinalCharacterScenes(character.name);

            return (
              <div key={`${character.name}-${actor?.photoUrl || "no-photo"}`}
                style={{ border: actor ? "1px solid #b2d8b2" : "1px solid #ddd", borderRadius: "8px", padding: "15px", backgroundColor: actor ? "#edf7ed" : "#fff", position: "relative", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                {canEdit && (
                  <button onClick={() => deleteCharacter(character.name)}
                    style={{ position: "absolute", top: "10px", right: "10px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "3px", cursor: "pointer", fontSize: "10px", padding: "4px 8px", fontWeight: "bold" }}>
                    Delete
                  </button>
                )}

                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#2196F3" }}>
                  {editingCharacterNumber === character.name ? (
                    <input type="number" value={editingCharacterNumberValue} autoFocus
                      min={1} max={Object.keys(characters).length}
                      onChange={(e) => setEditingCharacterNumberValue(e.target.value)}
                      onBlur={() => {
                        const newNum = parseInt(editingCharacterNumberValue);
                        const maxNum = Object.keys(characters).length;
                        if (!isNaN(newNum) && newNum >= 1 && newNum <= maxNum) {
                          const current = character.chronologicalNumber;
                          const updated = { ...characters };
                          Object.keys(updated).forEach((name) => {
                            if (name === character.name) return;
                            const c = updated[name];
                            if (newNum < current && c.chronologicalNumber >= newNum && c.chronologicalNumber < current) {
                              updated[name] = { ...c, chronologicalNumber: c.chronologicalNumber + 1 };
                            } else if (newNum > current && c.chronologicalNumber <= newNum && c.chronologicalNumber > current) {
                              updated[name] = { ...c, chronologicalNumber: c.chronologicalNumber - 1 };
                            }
                          });
                          updated[character.name] = { ...updated[character.name], chronologicalNumber: newNum };
                          setCharacters(updated);
                          if (onUpdateCharacters) onUpdateCharacters(updated);
                        }
                        setEditingCharacterNumber(null);
                        setEditingCharacterNumberValue("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") { setEditingCharacterNumber(null); setEditingCharacterNumberValue(""); }
                      }}
                      style={{ width: "48px", fontSize: "14px", fontWeight: "bold", color: "#2196F3", border: "1px solid #2196F3", borderRadius: "3px", padding: "1px 4px", textAlign: "center" }} />
                  ) : (
                    <span onClick={() => { setEditingCharacterNumber(character.name); setEditingCharacterNumberValue(String(character.chronologicalNumber)); }}
                      title="Click to edit number" style={{ cursor: "pointer", borderBottom: "1px dashed #2196F3" }}>
                      {character.chronologicalNumber}.
                    </span>
                  )}
                </div>

                <div style={{ width: "100%", height: "200px", backgroundColor: "#f0f0f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {actor?.photoUrl ? (
                    <img src={actor.photoUrl} alt={actor.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ fontSize: "48px", color: "#ccc" }}>👤</div>
                  )}
                </div>

                <div style={{ fontSize: "18px", fontWeight: "bold", textAlign: "center" }}>{character.name}</div>
                <div style={{ fontSize: "13px", color: "#666", textAlign: "center", fontStyle: "italic" }}>
                  {actor ? `Played by ${actor.displayName}` : "No actor assigned"}
                </div>
                <div style={{ fontSize: "12px", color: "#999", textAlign: "center" }}>
                  {finalScenes.length} scene{finalScenes.length !== 1 ? "s" : ""}
                </div>

                <button onClick={() => setShowDetailsPopup(character.name)}
                  style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginTop: "5px" }}>
                  View Details
                </button>
              </div>
            );
          })}
        </div>

        {characterList.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#999", fontSize: "16px" }}>
            No characters detected. Parse your script to auto-detect characters.
          </div>
        )}
      </div>

      {/* Add Character Dialog */}
      {showAddDialog && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowAddDialog(false)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Add New Character</h3>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px" }}><strong>Character Name:</strong></label>
              <input type="text" value={newCharacterName} onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder="Enter character name"
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "3px", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={addCharacter} style={{ backgroundColor: "#4CAF50", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Add Character</button>
              <button onClick={() => setShowAddDialog(false)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Delete Character Dialog */}
      {showDeleteDialog && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={cancelDelete} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Delete Character: {showDeleteDialog.characterName}</h3>
            <p>This character appears in {showDeleteDialog.scenes.length} scene(s). What should happen to these scenes?</p>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "10px" }}>
                <input type="radio" name="reassign" value="existing" onChange={() => setReassignTarget("")} style={{ marginRight: "8px" }} />
                Reassign to existing character:
              </label>
              <select value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }}>
                <option value="">Select character...</option>
                {existingCharacters.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
              <label style={{ display: "block", marginBottom: "10px" }}>
                <input type="radio" name="reassign" value="new" onChange={() => setReassignTarget("")} style={{ marginRight: "8px" }} />
                Create new character:
              </label>
              <input type="text" placeholder="Enter new character name" value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px" }} />
              <label style={{ display: "block" }}>
                <input type="radio" name="reassign" value="none" onChange={() => setReassignTarget("")} style={{ marginRight: "8px" }} />
                Don't reassign (scenes will be lost)
              </label>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={confirmDelete} style={{ backgroundColor: "#f44336", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Confirm Delete</button>
              <button onClick={cancelDelete} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Character Details Popup */}
      {showDetailsPopup && (() => {
        const character = characters[showDetailsPopup];
        const actor = getActorForCharacter(showDetailsPopup);
        const finalScenes = getFinalCharacterScenes(showDetailsPopup);

        const wardrobeForCharacter = Array.isArray(wardrobeItems) ? wardrobeItems.find((item) => item.characterName === showDetailsPopup) : null;
        const characterWardrobe = wardrobeForCharacter?.items || [];

        const characterProps = Object.values(taggedItems || {}).filter(
          (item) => item.category === "Props" && item.assignedCharacters && item.assignedCharacters.includes(showDetailsPopup)
        );

        const characterMakeup = Object.values(taggedItems || {}).filter(
          (item) => item.category === "Makeup" && item.assignedCharacters && item.assignedCharacters.includes(showDetailsPopup)
        );

        const characterContinuity = Array.isArray(continuityElements)
          ? continuityElements.filter((element) => element.characterId === showDetailsPopup)
          : [];

        const toggleSection = (section) => {
          setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
        };

        return (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowDetailsPopup(null)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "900px", maxWidth: "90vw", height: "90vh", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ padding: "20px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: "8px 8px 0 0" }}>
                <div>
                  <h2 style={{ margin: "0 0 5px 0" }}>{showDetailsPopup}</h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>Character #{character?.chronologicalNumber} • {finalScenes.length} scenes</p>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => exportCharacterSides(showDetailsPopup, finalScenes)}
                    style={{ backgroundColor: "#9C27B0", color: "white", padding: "6px 12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                  >
                    📄 Export Sides
                  </button>
                  <button onClick={() => setShowDetailsPopup(null)} style={{ backgroundColor: "#f44336", color: "white", padding: "6px 12px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>✕ Close</button>
                </div>
              </div>

              <div style={{ padding: "20px" }}>
                {/* Cast Assignment */}
                <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "6px", backgroundColor: "#fff" }}>
                  {actor ? (
                    <>
                      <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
                        <div style={{ flexShrink: 0 }}>
                          <ImageUpload
                            currentImageUrl={actor.photoUrl}
                            onUpload={(file) => handleImageUpload(showDetailsPopup, file)}
                            onDelete={() => handleImageDelete(showDetailsPopup)}
                            label="Actor Photo"
                            disabled={isViewOnly}
                            compact={false}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: "0 0 10px 0" }}>{actor.displayName}</h3>
                          <div style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
                            {actor.email && <div><strong>Email:</strong> {actor.email}</div>}
                            {actor.phone && <div><strong>Phone:</strong> {actor.phone}</div>}
                            {actor.dietary && <div><strong>Dietary:</strong> {typeof actor.dietary === "object" ? JSON.stringify(actor.dietary) : actor.dietary}</div>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => { setShowDetailsPopup(null); setActiveModule("Cast & Crew"); }}
                        style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>
                        → Go to Cast & Crew
                      </button>
                      {(actor.availableDates?.length > 0 || actor.unavailableDates?.length > 0) && (
                        <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                          <strong style={{ fontSize: "12px" }}>Availability Summary:</strong>
                          <div style={{ fontSize: "12px", marginTop: "5px" }}>
                            {actor.availableDates?.length > 0 && <div style={{ color: "#4CAF50" }}>✓ Available: {actor.availableDates.length} days</div>}
                            {actor.unavailableDates?.length > 0 && <div style={{ color: "#f44336" }}>✕ Unavailable: {actor.unavailableDates.length} days</div>}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "#999", fontStyle: "italic" }}>No actor assigned to this character. Go to Cast & Crew to assign an actor.</p>
                  )}
                </div>

                {/* Scenes Section */}
                <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <div style={{ padding: "12px 15px", backgroundColor: "#2196F3", color: "white", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
                    <span onClick={() => toggleSection("scenes")} style={{ cursor: "pointer", flex: 1 }}>
                      🎬 Scenes ({finalScenes.length} of {scenes.length})
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setShowScenesPopup(showDetailsPopup); setCurrentSceneIndex(0); }}
                      style={{ backgroundColor: "white", color: "#2196F3", border: "none", padding: "4px 12px", borderRadius: "3px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", marginRight: "10px" }}>
                      View Scenes
                    </button>
                    <span onClick={() => toggleSection("scenes")} style={{ cursor: "pointer" }}>{expandedSections.scenes ? "▼" : "▶"}</span>
                  </div>
                  {expandedSections.scenes && (
                    <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {scenes.map((scene) => {
                          const sceneNumStr = String(scene.sceneNumber);
                          const isAssigned = finalScenes.some((s) => String(s) === sceneNumStr);
                          return (
                            <div key={scene.sceneNumber}
                              onDoubleClick={() => { if (!isViewOnly) toggleSceneAssignment(showDetailsPopup, scene.sceneNumber); }}
                              style={{ width: "25px", height: "25px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: isAssigned ? "#4CAF50" : "#f0f0f0", color: isAssigned ? "white" : "#666", fontSize: "10px", fontWeight: "bold", cursor: isViewOnly ? "default" : "pointer" }}
                              title={`${scene.heading}${isViewOnly ? "" : " (double-click to " + (isAssigned ? "remove" : "add") + ")"}`}>
                              {scene.sceneNumber}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Wardrobe Section */}
                <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <div onClick={() => toggleSection("wardrobe")} style={{ padding: "12px 15px", backgroundColor: "#9C27B0", color: "white", cursor: "pointer", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
                    <span>👔 Wardrobe ({characterWardrobe.length} looks)</span>
                    <span>{expandedSections.wardrobe ? "▼" : "▶"}</span>
                  </div>
                  {expandedSections.wardrobe && (
                    <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                      {characterWardrobe.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {characterWardrobe.map((item, idx) => {
                            const assignedGarments = item.assignedGarments || [];
                            const garmentDetails = assignedGarments.map((garmentId) => {
                              if (Array.isArray(garmentInventory)) return garmentInventory.find((g) => g.id === garmentId);
                              return null;
                            }).filter(Boolean);
                            const wardrobeKey = `wardrobe_${idx}`;
                            const isExpanded = expandedSections[wardrobeKey];
                            return (
                              <div key={idx} style={{ border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden" }}>
                                <div onClick={() => toggleSection(wardrobeKey)} style={{ padding: "10px 12px", backgroundColor: "#f5f5f5", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: "bold", color: "#9C27B0" }}>#{item.number}: {item.description || "Untitled"}</div>
                                    <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
                                      {item.sceneRanges && `Scenes: ${item.sceneRanges}`}
                                      {item.sceneRanges && garmentDetails.length > 0 && " • "}
                                      {garmentDetails.length} garment{garmentDetails.length !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: "12px" }}>{isExpanded ? "▼" : "▶"}</span>
                                </div>
                                {isExpanded && (
                                  <div style={{ padding: "12px", backgroundColor: "#fafafa" }}>
                                    {garmentDetails.length > 0 ? (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {garmentDetails.map((garment, gIdx) => (
                                          <div key={gIdx} style={{ padding: "8px", backgroundColor: "white", border: "1px solid #ddd", borderRadius: "4px", fontSize: "11px" }}>
                                            <div style={{ fontWeight: "bold", marginBottom: "3px" }}>{garment.id} - {garment.name}</div>
                                            <div style={{ color: "#666" }}>{garment.category} | {garment.size} | {garment.color} | {garment.condition}</div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: "11px", color: "#999", fontStyle: "italic" }}>No garments assigned to this wardrobe look</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: "#999", fontStyle: "italic" }}>No wardrobe items assigned to this character.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Props Section */}
                <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <div onClick={() => toggleSection("props")} style={{ padding: "12px 15px", backgroundColor: "#FF9800", color: "white", cursor: "pointer", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
                    <span>📦 Props ({characterProps.length})</span>
                    <span>{expandedSections.props ? "▼" : "▶"}</span>
                  </div>
                  {expandedSections.props && (
                    <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                      {characterProps.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {characterProps.map((prop, idx) => (
                            <div key={idx} style={{ padding: "10px", border: "1px solid #eee", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                              <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "5px" }}>
                                {prop.chronologicalNumber}. {prop.customTitle || prop.displayName || prop.word}
                              </div>
                              {prop.scenes && prop.scenes.length > 0 && (
                                <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>Scenes: {prop.scenes.join(", ")}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#999", fontStyle: "italic" }}>No props assigned to this character.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Makeup Section */}
                <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <div onClick={() => toggleSection("makeup")} style={{ padding: "12px 15px", backgroundColor: "#E91E63", color: "white", cursor: "pointer", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
                    <span>💄 Makeup/Hair ({characterMakeup.length})</span>
                    <span>{expandedSections.makeup ? "▼" : "▶"}</span>
                  </div>
                  {expandedSections.makeup && (
                    <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                      {characterMakeup.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {characterMakeup.map((item, idx) => (
                            <div key={idx} style={{ padding: "10px", border: "1px solid #eee", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                              <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "5px" }}>
                                {item.chronologicalNumber}. {item.customTitle || item.displayName || item.word}
                              </div>
                              {item.instances && item.instances.length > 0 && (
                                <div style={{ fontSize: "11px", color: "#666", marginTop: "5px" }}>{item.instances.length} variant(s)</div>
                              )}
                              {item.scenes && item.scenes.length > 0 && (
                                <div style={{ fontSize: "11px", color: "#999", marginTop: "5px" }}>Scenes: {item.scenes.join(", ")}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#999", fontStyle: "italic" }}>No makeup/hair items assigned to this character.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Continuity Section */}
                <div style={{ marginBottom: "15px", border: "1px solid #ddd", borderRadius: "6px" }}>
                  <div onClick={() => toggleSection("continuity")} style={{ padding: "12px 15px", backgroundColor: "#607D8B", color: "white", cursor: "pointer", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px 6px 0 0" }}>
                    <span>📋 Continuity Elements ({characterContinuity.length})</span>
                    <span>{expandedSections.continuity ? "▼" : "▶"}</span>
                  </div>
                  {expandedSections.continuity && (
                    <div style={{ padding: "15px", backgroundColor: "#fff" }}>
                      {characterContinuity.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {characterContinuity.map((element, idx) => (
                            <div key={idx} style={{ padding: "10px", border: "1px solid #eee", borderRadius: "4px", backgroundColor: "#fafafa" }}>
                              <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "5px" }}>{element.name || `Element ${idx + 1}`}</div>
                              <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>Type: {element.type}</div>
                              <div style={{ fontSize: "11px", color: "#999" }}>Days {element.startDay} - {element.endDay}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: "#999", fontStyle: "italic" }}>No continuity elements tracked for this character.</p>
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
      {showScenesPopup && (() => {
        const character = characters[showScenesPopup];
        const finalScenes = getFinalCharacterScenes(showScenesPopup);

        const assignedScenes = scenes.filter((scene) =>
          finalScenes.some((s) => String(s) === String(scene.sceneNumber))
        );

        if (assignedScenes.length === 0) {
          return (
            <>
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowScenesPopup(null)} />
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "400px" }}>
                <h3>No Scenes Assigned</h3>
                <p>This character has no scenes assigned yet.</p>
                <button onClick={() => setShowScenesPopup(null)} style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Close</button>
              </div>
            </>
          );
        }

        const currentScene = assignedScenes[currentSceneIndex];

        return (
          <>
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowScenesPopup(null)} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #2196F3", borderRadius: "8px", padding: "0", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, width: "900px", maxWidth: "90vw", height: "80vh", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "15px 20px", backgroundColor: "#2196F3", color: "white", borderRadius: "8px 8px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <button onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))}
                    disabled={currentSceneIndex === 0}
                    style={{ backgroundColor: currentSceneIndex === 0 ? "#ccc" : "white", color: currentSceneIndex === 0 ? "#666" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: currentSceneIndex === 0 ? "not-allowed" : "pointer", fontWeight: "bold" }}>← Prev</button>
                  <div style={{ fontWeight: "bold" }}>Scene {currentScene.sceneNumber} ({currentSceneIndex + 1} of {assignedScenes.length})</div>
                  <button onClick={() => setCurrentSceneIndex(Math.min(assignedScenes.length - 1, currentSceneIndex + 1))}
                    disabled={currentSceneIndex === assignedScenes.length - 1}
                    style={{ backgroundColor: currentSceneIndex === assignedScenes.length - 1 ? "#ccc" : "white", color: currentSceneIndex === assignedScenes.length - 1 ? "#666" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: currentSceneIndex === assignedScenes.length - 1 ? "not-allowed" : "pointer", fontWeight: "bold" }}>Next →</button>
                </div>
                <button onClick={() => setShowScenesPopup(null)} style={{ backgroundColor: "#f44336", color: "white", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: "pointer", fontWeight: "bold" }}>✕ Close</button>
              </div>

              <div style={{ padding: "12px 20px", backgroundColor: "#f5f5f5", borderBottom: "1px solid #ddd", fontFamily: "Courier New, monospace", fontSize: "12pt", fontWeight: "bold", textTransform: "uppercase" }}>
                {currentScene.heading}
              </div>

              <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: "white", boxSizing: "border-box", textAlign: "left", fontFamily: "Courier New, monospace" }}>
                <div style={getElementStyle("Scene Heading")}>{currentScene.heading}</div>
                <div style={{ lineHeight: "1.6", fontSize: "14px" }}>
                  {currentScene.content.map((block, blockIndex) => (
                    <div key={blockIndex} style={getElementStyle(block.type)}>{block.text}</div>
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

export default CharactersModule;