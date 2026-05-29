import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function WritingCharacterSuggestionsModal({ suggestions, onConfirm, onDismiss }) {
  const [selected, setSelected] = useState(() => new Set(suggestions.map((s) => s.normalizedKey)));

  // Dismiss on Escape
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onDismiss(suggestions.map((s) => s.normalizedKey)); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [suggestions, onDismiss]);

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const selectedArr = Array.from(selected);

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100000,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", boxSizing: "border-box",
        fontFamily: "'Questrial','Futura','Arial',sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(suggestions.map((s) => s.normalizedKey)); }}
    >
      <div style={{
        backgroundColor: "white", borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
        width: "min(460px, calc(100vw - 48px))",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px 10px", borderBottom: "1px solid #e0e0e0", flexShrink: 0,
        }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#1a1a2e" }}>
            New characters detected
          </div>
          <div style={{ fontSize: "12px", color: "#777", marginTop: "3px" }}>
            Select profiles to create:
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {suggestions.map((s) => (
            <label
              key={s.normalizedKey}
              style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "7px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(s.normalizedKey)}
                onChange={() => toggle(s.normalizedKey)}
                style={{ marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#222" }}>
                  {s.displayName}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                  {s.sceneCount} scene{s.sceneCount !== 1 ? "s" : ""}
                  {s.firstAppearanceSceneHeading
                    ? ` · first: ${s.firstAppearanceSceneHeading}`
                    : ""}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 16px", borderTop: "1px solid #e0e0e0", flexShrink: 0,
          display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
        }}>
          <button
            type="button"
            onClick={() => setSelected(new Set(suggestions.map((s) => s.normalizedKey)))}
            style={{ fontSize: "11px", padding: "4px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}
          >Select All</button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{ fontSize: "11px", padding: "4px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}
          >Select None</button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => onDismiss(suggestions.map((s) => s.normalizedKey))}
            style={{ fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5", color: "#555" }}
          >Skip For Now</button>
          <button
            type="button"
            disabled={selectedArr.length === 0}
            onClick={() => onConfirm(selectedArr)}
            style={{
              fontSize: "12px", padding: "5px 14px", cursor: selectedArr.length === 0 ? "default" : "pointer",
              border: "none", borderRadius: "4px",
              backgroundColor: selectedArr.length === 0 ? "#e0e0e0" : "#1a1a2e",
              color: selectedArr.length === 0 ? "#aaa" : "white", fontWeight: "bold",
            }}
          >Create Selected ({selectedArr.length})</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
