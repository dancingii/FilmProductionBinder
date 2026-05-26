import React from "react";
import { INSERTED_BORDER_COLOR, INSERTED_LABEL_COLOR } from "../../utils/scenePresentation";
import { buildHeadingString } from "../../utils";

/**
 * Shared scene detail / heading-editor modal.
 *
 * Used by both Script (rich read + heading edit) and Stripboard (heading edit + View Script).
 * Parent modules own all state and callbacks — this component is pure presentation + controller.
 *
 * Required props:
 *   scene            — scene object
 *   displayLabel     — string from getSceneDisplayLabel(scene, labelMap)
 *   onClose          — () => void
 *
 * Heading editing (all three required together, or omit all three for read-only heading):
 *   headingForm          — { intExt, location, timeOfDay, modifier }
 *   onHeadingFormChange  — (partialUpdate) => void   (merges into parent's headingForm state)
 *   onSave               — (headingForm) => void     (called on Save button click)
 *
 * Optional actions:
 *   isViewOnly           — hides delete/insert buttons (default false)
 *   onDelete             — () => void
 *   onInsertBefore       — () => void
 *   disableInsertBefore  — bool (disables the Insert Before button, e.g. at index 0)
 *   onInsertAfter        — () => void
 *   onViewScript         — () => void  ("View Script Page" button, used by Stripboard)
 *
 * Optional supplemental data:
 *   tagged           — { props, makeup, wardrobe, productionDesign, other }
 *   sceneCharacters  — string[]
 *   sceneMoodImages  — image[]
 *
 *   zIndex           — backdrop z-index (default 21800; modal is zIndex+1)
 */
function SceneDetailModal({
  scene,
  displayLabel,
  onClose,
  headingForm = null,
  onHeadingFormChange = null,
  onSave = null,
  isViewOnly = false,
  onDelete = null,
  onInsertBefore = null,
  disableInsertBefore = false,
  onInsertAfter = null,
  onViewScript = null,
  tagged = null,
  sceneCharacters = null,
  sceneMoodImages = null,
  zIndex = 21800,
}) {
  if (!scene) return null;

  const isInserted = Boolean(scene.metadata?.replacementLetter);
  const hasHeadingEdit = Boolean(onSave && headingForm && onHeadingFormChange);

  const previewHeading = headingForm ? buildHeadingString(headingForm) : scene.heading || "";

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "560px",
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "88vh",
          overflow: "hidden",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          zIndex: zIndex + 1,
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", padding: "20px 22px 14px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>
              Scene {displayLabel}
              {isInserted && (
                <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: "bold", color: INSERTED_LABEL_COLOR, backgroundColor: "#fff7ed", border: `1px solid ${INSERTED_BORDER_COLOR}`, borderRadius: "3px", padding: "1px 5px", verticalAlign: "middle" }}>INS</span>
              )}
            </h2>
            <div style={{ fontSize: "13px", fontWeight: "bold", textTransform: "uppercase", color: "#333" }}>
              {previewHeading || "Untitled Scene"}
            </div>
            <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>Status: {scene.status || "Not Scheduled"}</div>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold", flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: "auto", padding: "18px 22px", flex: 1 }}>

          {/* Heading editor — only rendered when all three heading props are provided */}
          {hasHeadingEdit && (
            <div style={{ marginBottom: "20px", padding: "14px 16px", backgroundColor: "#f8f9fa", borderRadius: "6px", border: "1px solid #e9ecef" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Edit Heading</div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>INT/EXT</label>
                  <select
                    value={headingForm.intExt}
                    onChange={(e) => onHeadingFormChange({ intExt: e.target.value })}
                    style={{ padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", fontWeight: "bold" }}
                  >
                    <option value="INT.">INT.</option>
                    <option value="EXT.">EXT.</option>
                    <option value="I/E">I/E</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Location</label>
                  <input
                    type="text"
                    value={headingForm.location}
                    onChange={(e) => onHeadingFormChange({ location: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                    placeholder="LOCATION NAME"
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Time of Day</label>
                  <select
                    value={headingForm.timeOfDay}
                    onChange={(e) => onHeadingFormChange({ timeOfDay: e.target.value })}
                    style={{ padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", fontWeight: "bold" }}
                  >
                    <option value="DAY">DAY</option>
                    <option value="NIGHT">NIGHT</option>
                    <option value="DAWN">DAWN</option>
                    <option value="DUSK">DUSK</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Modifier</label>
                  <input
                    type="text"
                    value={headingForm.modifier}
                    onChange={(e) => onHeadingFormChange({ modifier: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }}
                    placeholder="e.g. CONTINUOUS, LATER"
                  />
                </div>
              </div>
              <div style={{ backgroundColor: "#fff", padding: "8px 12px", borderRadius: "4px", border: "1px solid #dee2e6", fontSize: "13px", fontWeight: "bold", fontFamily: "monospace", color: "#333" }}>
                {previewHeading || <span style={{ color: "#aaa", fontWeight: "normal" }}>—</span>}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>SUMMARY</div>
            <div style={{ fontSize: "13px", lineHeight: 1.45, padding: "10px", backgroundColor: "#f7f7f7", borderRadius: "6px" }}>
              {scene.description || "No summary yet."}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>NOTES</div>
            <div style={{ fontSize: "13px", lineHeight: 1.45, padding: "10px", backgroundColor: "#f7f7f7", borderRadius: "6px" }}>
              {scene.notes || "No notes yet."}
            </div>
          </div>

          {/* Metadata grid — characters (if provided), location (always), tagged items (if provided) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            {sceneCharacters !== null && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>CHARACTERS</div>
                <div style={{ fontSize: "13px" }}>{sceneCharacters.length ? sceneCharacters.join(", ") : "—"}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>LOCATION</div>
              <div style={{ fontSize: "13px" }}>{scene.metadata?.location || scene.heading || "—"}</div>
            </div>
            {tagged !== null && (
              <>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>PROPS</div>
                  <div style={{ fontSize: "13px" }}>{tagged.props.length ? tagged.props.join(", ") : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>WARDROBE</div>
                  <div style={{ fontSize: "13px" }}>{tagged.wardrobe.length ? tagged.wardrobe.join(", ") : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>MAKEUP</div>
                  <div style={{ fontSize: "13px" }}>{tagged.makeup.length ? tagged.makeup.join(", ") : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>PRODUCTION DESIGN</div>
                  <div style={{ fontSize: "13px" }}>{tagged.productionDesign.length ? tagged.productionDesign.join(", ") : "—"}</div>
                </div>
              </>
            )}
          </div>

          {tagged?.other?.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "5px" }}>OTHER TAGGED ITEMS</div>
              <div style={{ fontSize: "13px" }}>{tagged.other.join(", ")}</div>
            </div>
          )}

          {sceneMoodImages?.length > 0 && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#777", marginBottom: "8px" }}>SCENE MOOD REFERENCES</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {sceneMoodImages.slice(0, 6).map((image) => (
                  <img
                    key={image.id || image.url}
                    src={image.url}
                    alt={image.title || "Mood reference"}
                    title={image.title || ""}
                    style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: "5px", border: "1px solid #ddd" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: "flex", gap: "8px", padding: "14px 22px", borderTop: "1px solid #eee", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
          {!isViewOnly && onDelete && (
            <button
              onClick={onDelete}
              style={{ padding: "8px 14px", backgroundColor: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              Delete Scene
            </button>
          )}
          {!isViewOnly && onInsertBefore && (
            <button
              disabled={disableInsertBefore}
              onClick={disableInsertBefore ? undefined : onInsertBefore}
              title={disableInsertBefore ? "Cannot insert before the first scene" : undefined}
              style={{ padding: "8px 14px", backgroundColor: disableInsertBefore ? "#f3f4f6" : "#f0f9ff", color: disableInsertBefore ? "#9ca3af" : "#0369a1", border: `1px solid ${disableInsertBefore ? "#d1d5db" : "#7dd3fc"}`, borderRadius: "4px", cursor: disableInsertBefore ? "not-allowed" : "pointer", fontSize: "13px" }}
            >
              Insert Before
            </button>
          )}
          {!isViewOnly && onInsertAfter && (
            <button
              onClick={onInsertAfter}
              style={{ padding: "8px 14px", backgroundColor: "#f0f9ff", color: "#0369a1", border: "1px solid #7dd3fc", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}
            >
              Insert After
            </button>
          )}
          {onViewScript && (
            <button
              onClick={onViewScript}
              style={{ padding: "8px 14px", backgroundColor: "#e8f5e9", color: "#1b5e20", border: "1px solid #a5d6a7", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}
            >
              View Script Page
            </button>
          )}
          {hasHeadingEdit && (
            <button
              onClick={() => onSave(headingForm)}
              style={{ padding: "8px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}
            >
              ✓ Save
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: "8px 14px", backgroundColor: "#eee", color: "#333", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", marginLeft: "auto" }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export default SceneDetailModal;
