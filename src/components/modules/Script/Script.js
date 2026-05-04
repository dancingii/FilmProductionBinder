import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { supabase } from "../../../supabase";

const WGA_COLORS = [
  { name: "White",     hex: "#FFFFFF", textHex: "#000000" },
  { name: "Blue",      hex: "#B8D4E8", textHex: "#1a3a5c" },
  { name: "Pink",      hex: "#F4C2C2", textHex: "#7a1a1a" },
  { name: "Yellow",    hex: "#F5F5A0", textHex: "#5c5c00" },
  { name: "Green",     hex: "#B8E0B8", textHex: "#1a4c1a" },
  { name: "Goldenrod", hex: "#DAA520", textHex: "#3c2800" },
  { name: "Buff",      hex: "#F0DC82", textHex: "#4c3c00" },
  { name: "Salmon",    hex: "#FA8072", textHex: "#5c0000" },
  { name: "Cherry",    hex: "#DE3163", textHex: "#FFFFFF" },
  { name: "Tan",       hex: "#D2B48C", textHex: "#3c2a1a" },
];
const getRevisionColor = (n) => WGA_COLORS[n % WGA_COLORS.length] || WGA_COLORS[1];

const ELEMENT_TYPES = ["Scene Heading","Action","Character","Dialogue","Parenthetical","Transition","Shot"];

const TAB_CYCLE = {
  "Scene Heading":"Action","Action":"Character","Character":"Dialogue",
  "Dialogue":"Parenthetical","Parenthetical":"Action","Transition":"Scene Heading","Shot":"Action",
};
const SHIFT_TAB_CYCLE = {
  "Scene Heading":"Transition","Action":"Parenthetical","Character":"Action",
  "Dialogue":"Character","Parenthetical":"Dialogue","Transition":"Action","Shot":"Action",
};
const ENTER_NEXT_TYPE = {
  "Scene Heading":"Action","Action":"Action","Character":"Dialogue",
  "Dialogue":"Character","Parenthetical":"Dialogue","Transition":"Scene Heading","Shot":"Action",
};
const TYPE_SHORTCUTS = {
  "1":"Scene Heading","2":"Action","3":"Character",
  "4":"Dialogue","5":"Parenthetical","6":"Transition",
};

// ─── Scene List ───────────────────────────────────────────────────────────────
function SceneList({ scenes, currentSceneNumber, sceneRefs, getSceneStatusColor, selectedProject, user, onSceneNumberChange, setCurrentIndex }) {
  const { otherUsers } = usePresence(selectedProject?.id, user, "script", currentSceneNumber);
  const [editingScene, setEditingScene] = useState(null);
  const [newSceneNumber, setNewSceneNumber] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const idx = scenes.findIndex(s => s.sceneNumber === currentSceneNumber);
    if (idx >= 0 && listRef.current) {
      const item = listRef.current.children[idx];
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [currentSceneNumber, scenes]);

  const scrollToScene = (index) => {
    setCurrentIndex(index);
    if (sceneRefs.current[index]) {
      sceneRefs.current[index].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const saveSceneNumber = () => {
    if (editingScene !== null && newSceneNumber.trim()) onSceneNumberChange(editingScene, newSceneNumber.trim());
    setEditingScene(null);
    setNewSceneNumber("");
  };

  if (scenes.length === 0) return null;

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div ref={listRef} style={{ flex: 1, width: "500px", border: "2px inset #ccc", backgroundColor: "white", fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden" }}>
        {scenes.map((scene, index) => {
          const statusColor = getSceneStatusColor(scene.sceneNumber);
          const isCurrent = currentSceneNumber === scene.sceneNumber;
          let pageStats = null;
          try { pageStats = calculateScenePageStats(index, scenes, LINES_PER_PAGE); } catch {}
          const statColor = isCurrent ? "rgba(255,255,255,0.72)" : "#bbb";
          return (
            <PresenceIndicator key={index} itemId={scene.sceneNumber} otherUsers={otherUsers} position="top">
              <div
                onClick={() => scrollToScene(index)}
                onDoubleClick={() => { setEditingScene(index); setNewSceneNumber(scene.sceneNumber); }}
                style={{ padding: "3px 8px", cursor: "pointer", userSelect: "none", borderBottom: "1px solid #f0f0f0", backgroundColor: isCurrent ? "#316AC5" : statusColor !== "transparent" ? statusColor : "white", color: isCurrent ? "white" : "black", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "13px" }}>{String(scene.sceneNumber).padStart(3, "0")}</strong>{" – "}{scene.heading}
                </span>
                {pageStats && (
                  <span style={{ display: "flex", flexShrink: 0, alignItems: "center" }}>
                    <span style={{ width: "36px", textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums" }}>Pg {pageStats.startPage}</span>
                    <span style={{ width: "4px", textAlign: "center", fontSize: "10px", color: statColor }}>·</span>
                    <span style={{ width: "36px", textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums" }}>{pageStats.pageLength}</span>
                  </span>
                )}
              </div>
            </PresenceIndicator>
          );
        })}
      </div>
      {editingScene !== null && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={() => setEditingScene(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1001, minWidth: "300px" }}>
            <h3 style={{ marginTop: 0 }}>Edit Scene Number</h3>
            <p>Current: Scene {scenes[editingScene]?.sceneNumber}</p>
            <label style={{ display: "block", marginBottom: "15px" }}>
              <strong>New Scene Number:</strong>
              <input type="text" value={newSceneNumber} autoFocus onChange={(e) => setNewSceneNumber(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveSceneNumber(); else if (e.key === "Escape") setEditingScene(null); }} placeholder="e.g., 29A, 15B" style={{ width: "100%", padding: "8px", marginTop: "5px", border: "1px solid #ddd", borderRadius: "3px" }} />
            </label>
            <button onClick={saveSceneNumber} style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "10px" }}>Save</button>
            <button onClick={() => setEditingScene(null)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Element Type Toolbar ─────────────────────────────────────────────────────
function ElementTypeToolbar({ activeBlock, editingScenes, onTypeChange }) {
  if (!activeBlock) return <span style={{ fontSize: "12px", color: "#999", fontStyle: "italic", padding: "0 8px" }}>Click a block to select</span>;
  const block = editingScenes[activeBlock.si]?.content[activeBlock.bi];
  if (!block) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "11px", color: "#555", fontWeight: "bold" }}>ELEMENT:</span>
      <select value={block.type} onChange={(e) => onTypeChange(activeBlock.si, activeBlock.bi, e.target.value)} style={{ padding: "3px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }}>
        {ELEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <span style={{ fontSize: "10px", color: "#aaa" }}>Tab · Shift+Tab · Ctrl+1-6</span>
    </div>
  );
}

// ─── Revision Round Modal ─────────────────────────────────────────────────────
function RevisionRoundModal({ pendingRecord, committedRounds, onCommit, onClose }) {
  const nextNum = (committedRounds?.length || 0) + 1;
  const autoColor = getRevisionColor(nextNum);
  const [roundNumber, setRoundNumber] = useState(nextNum);
  const [roundName, setRoundName] = useState(`Revision ${nextNum}`);
  const [saving, setSaving] = useState(false);
  const changedScenes = [...new Set((pendingRecord?.changes || []).map(c => c.scene_number))];

  const handleCommit = async () => {
    if (!roundName.trim()) return;
    setSaving(true);
    await onCommit(pendingRecord.id, roundNumber, roundName, autoColor);
    setSaving(false);
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 10000 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "10px", padding: "28px", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", zIndex: 10001, minWidth: "440px", maxWidth: "540px" }}>
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Create Revision Round</h2>
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <div style={{ flex: "0 0 72px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>ROUND #</div>
            <input type="number" value={roundNumber} onChange={(e) => setRoundNumber(parseInt(e.target.value) || 1)} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "16px", fontWeight: "bold" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>ROUND NAME</div>
            <input type="text" value={roundName} onChange={(e) => setRoundName(e.target.value)} style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }} />
          </div>
          <div style={{ flex: "0 0 90px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "5px" }}>COLOR</div>
            <div style={{ backgroundColor: autoColor.hex, border: "2px solid #ccc", borderRadius: "4px", padding: "8px 4px", fontSize: "11px", color: autoColor.textHex, fontWeight: "bold", textAlign: "center", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>{autoColor.name}</div>
          </div>
        </div>
        <div style={{ backgroundColor: "#f7f7f7", borderRadius: "6px", padding: "12px", marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>CHANGED SCENES ({changedScenes.length})</div>
          <div style={{ fontSize: "13px", color: "#333", lineHeight: 1.7 }}>{changedScenes.map(n => `Scene ${n}`).join("  ·  ") || "No changes recorded"}</div>
          <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{(pendingRecord?.changes || []).length} block change{(pendingRecord?.changes || []).length !== 1 ? "s" : ""} total</div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleCommit} disabled={saving || !roundName.trim()} style={{ flex: 1, padding: "10px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating…" : `Create ${autoColor.name} Pages`}
          </button>
          <button onClick={onClose} style={{ padding: "10px 20px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Keep Editing</button>
        </div>
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "10px", textAlign: "center" }}>Your changes are saved. Close this and keep editing — create the revision round when you're ready.</div>
      </div>
    </>
  );
}

// ─── Continuous Script (View + Edit) ─────────────────────────────────────────
const ContinuousScript = React.memo(function ContinuousScript({
  scenes, sceneRefs, isEditMode, editingScenes, setEditingScenes,
  setActiveBlock, taggedItems, tagCategories,
  showTagDropdown, setShowTagDropdown, tagWord, untagWordInstance,
  isWordInstanceTagged, getSceneStatusColor, committedRounds,
  viewingRevision, setCurrentIndex,
}) {
  const blockRefs = useRef({});
  const getKey = (si, bi) => `${si}-${bi}`;
  const lastArrowKey = useRef(null);
  const preArrowCaretRect = useRef(null);
  const preArrowBlockKey = useRef(null);

  // ── Undo stack ────────────────────────────────────────────────────────────
  const undoStack = useRef([]);
  const lastSnapshotText = useRef({});
  const textSnapshotTimer = useRef(null);

  useEffect(() => {
    if (isEditMode && editingScenes.length > 0) {
      undoStack.current = [];
      const init = {};
      editingScenes.forEach((scene, si) => {
        scene.content.forEach((block, bi) => { init[getKey(si, bi)] = block.text || ""; });
      });
      lastSnapshotText.current = init;
      clearTimeout(textSnapshotTimer.current);
    }
  }, [isEditMode]);

  const scheduleTextSnapshot = (si, bi) => {
    const key = getKey(si, bi);
    clearTimeout(textSnapshotTimer.current);
    textSnapshotTimer.current = setTimeout(() => {
      const currentText = blockRefs.current[key]?.textContent ?? "";
      const lastText = lastSnapshotText.current[key] ?? "";
      if (currentText !== lastText) {
        undoStack.current.push({ type: "text", si, bi, text: lastText });
        if (undoStack.current.length > 200) undoStack.current.shift();
        lastSnapshotText.current[key] = currentText;
      }
    }, 1000);
  };

  const pushStructuralSnapshot = (si, bi) => {
    const domText = blockRefs.current[getKey(si, bi)]?.textContent ?? "";
    undoStack.current.push({
      type: "structural",
      scenes: editingScenes.map((s, i) => ({
        ...s, content: s.content.map((b, j) => ({
          ...b, text: i === si && j === bi ? domText : b.text,
        })),
      })),
    });
    if (undoStack.current.length > 200) undoStack.current.shift();
  };

  const undo = () => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    if (entry.type === "text") {
      setEditingScenes(prev => prev.map((s, i) =>
        i !== entry.si ? s : {
          ...s, content: s.content.map((b, j) => j !== entry.bi ? b : { ...b, text: entry.text }),
        }
      ));
      setTimeout(() => {
        const el = blockRefs.current[getKey(entry.si, entry.bi)];
        if (el) {
          el.textContent = entry.text;
          lastSnapshotText.current[getKey(entry.si, entry.bi)] = entry.text;
          el.focus();
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      }, 10);
    } else {
      setEditingScenes(entry.scenes);
    }
  };

  const updateBlockText = useCallback((si, bi, text) => {
    setEditingScenes(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : { ...b, text }) }
    ));
  }, [setEditingScenes]);

  const updateBlockType = useCallback((si, bi, newType) => {
    pushStructuralSnapshot(si, bi);
    const domText = blockRefs.current[getKey(si, bi)]?.textContent || "";
    setEditingScenes(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : {
        ...b, type: newType,
        text: newType === "Character" ? domText.toUpperCase() : domText,
      }) }
    ));
    setTimeout(() => { blockRefs.current[getKey(si, bi)]?.focus(); }, 20);
  }, [setEditingScenes]);

  const addBlock = useCallback((si, afterBi, type = "Action") => {
    pushStructuralSnapshot(si, afterBi);
    const domText = blockRefs.current[getKey(si, afterBi)]?.textContent || "";
    setEditingScenes(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const content = [...s.content];
      content[afterBi] = { ...content[afterBi], text: domText };
      content.splice(afterBi + 1, 0, { type, text: "", formatting: null });
      return { ...s, content };
    }));
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, afterBi + 1)];
      if (el) { el.focus(); setActiveBlock({ si, bi: afterBi + 1 }); }
    }, 30);
  }, [setEditingScenes, setActiveBlock]);

  const deleteBlock = useCallback((si, bi, len) => {
    if (len <= 1) return;
    pushStructuralSnapshot(si, bi);
    setEditingScenes(prev => prev.map((s, i) => {
      if (i !== si) return s;
      const content = [...s.content];
      content.splice(bi, 1);
      return { ...s, content };
    }));
    setTimeout(() => {
      const el = blockRefs.current[getKey(si, Math.max(0, bi - 1))];
      if (el) { el.focus(); setActiveBlock({ si, bi: Math.max(0, bi - 1) }); }
    }, 30);
  }, [setEditingScenes, setActiveBlock]);

  const handleKeyDown = useCallback((e, si, bi, len) => {
    const block = editingScenes[si]?.content[bi];
    if (!block) return;

    const sel = window.getSelection();
    const el = blockRefs.current[getKey(si, bi)];

    // ── Arrow keys: fully native within block, RAF boundary detection ──────
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
        e.key === "ArrowUp"   || e.key === "ArrowDown") {
      lastArrowKey.current = e.key;
      preArrowBlockKey.current = getKey(si, bi);
      if (sel && sel.rangeCount > 0) {
        try { preArrowCaretRect.current = sel.getRangeAt(0).getBoundingClientRect(); }
        catch { preArrowCaretRect.current = null; }
      }
      // No preventDefault — browser handles all within-block movement natively.
      // RAF fires after browser updates selection; we check for boundary crossing.
      requestAnimationFrame(() => {
        const sel2 = window.getSelection();
        if (!sel2 || sel2.rangeCount === 0) return;
        const activeEl = document.activeElement;
        const origEl = blockRefs.current[preArrowBlockKey.current];

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          // If focus moved to a different block naturally, just sync activeBlock
          let movedToSi = si, movedToBi = bi;
          let focusedKey = null;
          Object.entries(blockRefs.current).forEach(([k, refEl]) => {
            if (refEl && refEl === activeEl) {
              focusedKey = k;
              const parts = k.split("-");
              movedToSi = parseInt(parts[0]);
              movedToBi = parseInt(parts[1]);
            }
          });
          if (focusedKey && focusedKey !== preArrowBlockKey.current) {
            setActiveBlock({ si: movedToSi, bi: movedToBi });
            return;
          }
          // Still in same block — check if at boundary
          if (activeEl !== origEl) return;
          const range = sel2.getRangeAt(0);
          if (e.key === "ArrowLeft" && bi > 0) {
            const node = range.startContainer;
            const offset = range.startOffset;
            const atStart = offset === 0 &&
              (node === origEl || node === origEl?.firstChild);
            if (atStart) {
              const prevEl = blockRefs.current[getKey(si, bi - 1)];
              if (prevEl) {
                prevEl.focus();
                const r = document.createRange();
                r.selectNodeContents(prevEl);
                r.collapse(false);
                sel2.removeAllRanges(); sel2.addRange(r);
                setActiveBlock({ si, bi: bi - 1 });
              }
            }
          } else if (e.key === "ArrowRight" && bi < len - 1) {
            const textLen = origEl?.textContent?.length || 0;
            const node = range.endContainer;
            const offset = range.endOffset;
            const atEnd = (node === origEl && offset >= textLen) ||
              (node === origEl?.lastChild && offset >= (origEl?.lastChild?.textContent?.length || 0));
            if (atEnd) {
              const nextEl = blockRefs.current[getKey(si, bi + 1)];
              if (nextEl) {
                nextEl.focus();
                const r = document.createRange();
                r.selectNodeContents(nextEl);
                r.collapse(true);
                sel2.removeAllRanges(); sel2.addRange(r);
                setActiveBlock({ si, bi: bi + 1 });
              }
            }
          }

        } else {
          // ArrowUp / ArrowDown: detect if caret didn't move to a new line
          if (activeEl !== origEl) return; // browser moved focus — already handled
          const newRect = (() => {
            try { return sel2.getRangeAt(0).getBoundingClientRect(); } catch { return null; }
          })();
          const oldRect = preArrowCaretRect.current;
          // Only check vertical — horizontal movement on the same line (browser
          // snapping caret to end of last line) still counts as a boundary hit.
          const sameVisualLine = oldRect && newRect &&
            Math.abs(newRect.top - oldRect.top) < 2;
          if (!sameVisualLine) return; // browser moved caret to a new line — do nothing
          if (e.key === "ArrowUp" && bi > 0) {
            const prevEl = blockRefs.current[getKey(si, bi - 1)];
            if (prevEl) {
              prevEl.focus();
              // Place caret at end of prev block
              const r = document.createRange();
              r.selectNodeContents(prevEl);
              r.collapse(false);
              sel2.removeAllRanges(); sel2.addRange(r);
              setActiveBlock({ si, bi: bi - 1 });
            }
          } else if (e.key === "ArrowDown" && bi < len - 1) {
            const nextEl = blockRefs.current[getKey(si, bi + 1)];
            if (nextEl) {
              nextEl.focus();
              const r = document.createRange();
              r.selectNodeContents(nextEl);
              r.collapse(true);
              sel2.removeAllRanges(); sel2.addRange(r);
              setActiveBlock({ si, bi: bi + 1 });
            }
          }
        }
      });
      return;
    }

    // ── Existing handlers ──────────────────────────────────────────────────
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      updateBlockType(si, bi, e.shiftKey ? (SHIFT_TAB_CYCLE[block.type] || "Action") : (TAB_CYCLE[block.type] || "Action"));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";
      let next = ENTER_NEXT_TYPE[block.type] || "Action";
      if (block.type === "Dialogue" && !txt.trim()) next = "Action";
      addBlock(si, bi, next);
      return;
    }
    if (e.key === "Backspace") {
      const txt = blockRefs.current[getKey(si, bi)]?.textContent || "";
      if (!txt && len > 1) { e.preventDefault(); deleteBlock(si, bi, len); return; }
    }
    if (e.ctrlKey && TYPE_SHORTCUTS[e.key]) {
      e.preventDefault();
      updateBlockType(si, bi, TYPE_SHORTCUTS[e.key]);
    }
  }, [editingScenes, updateBlockType, addBlock, deleteBlock, setActiveBlock]);

  const renderTagged = (text, si, bi, block) => {
    if (block?.formatting) { const fmt = formatElementText(block); if (React.isValidElement(fmt)) return fmt; }
    return text.split(/(\s+)/).map((word, wi) => {
      if (!word.trim()) return word;
      const clean = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
      const tagged = taggedItems[clean];
      const isTag = isWordInstanceTagged(clean, si, bi, wi);
      return (
        <span key={wi}
          onDoubleClick={(e) => { e.preventDefault(); setShowTagDropdown(isTag ? { x: e.clientX, y: e.clientY, word, cleanWord: clean, sceneIndex: si, blockIndex: bi, wordIndex: wi, isTagged: true, category: tagged.category } : { x: e.clientX, y: e.clientY, word, cleanWord: clean, sceneIndex: si, blockIndex: bi, wordIndex: wi, isTagged: false }); }}
          style={{ backgroundColor: isTag ? tagged.color : "transparent", cursor: "pointer", padding: isTag ? "1px 2px" : 0, borderRadius: isTag ? "2px" : 0 }}
        >{word}</span>
      );
    });
  };

  // Revision view
  if (viewingRevision) {
    const round = committedRounds?.find(r => r.id === viewingRevision);
    if (!round) return <div style={{ padding: "40px", color: "#999" }}>Revision not found.</div>;
    const roundTextColor = round.round_color_text || "#cc0000";
    const affected = new Set((round.changes || []).map(c => c.scene_number));
    return (
      <div style={{ fontFamily: "Courier New, monospace", fontSize: "12pt" }}>
        <div style={{ backgroundColor: round.round_color, padding: "10px 16px", borderRadius: "4px", marginBottom: "24px", textAlign: "center", fontWeight: "bold", fontSize: "14px", color: roundTextColor, border: "1px solid rgba(0,0,0,0.1)" }}>
          {round.round_name} — {round.round_color_name} Pages
        </div>
        {scenes.filter(s => affected.has(s.sceneNumber)).map(scene => {
          const sceneChanges = (round.changes || []).filter(c => c.scene_number === scene.sceneNumber);
          const changedIdx = new Set(sceneChanges.map(c => c.block_index));
          return (
            <div key={scene.sceneNumber} style={{ marginBottom: "48pt" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "12pt", borderBottom: "1px solid #ccc", paddingBottom: "4px", marginBottom: "12pt" }}>{scene.sceneNumber}: {scene.heading}</div>
              {scene.content.map((block, bi) => {
                const style = getElementStyle(block.type);
                const change = sceneChanges.find(c => c.block_index === bi);
                const changed = changedIdx.has(bi);
                return (
                  <div key={bi} style={{ position: "relative" }}>
                    {changed && <span style={{ position: "absolute", right: "-28px", top: 0, color: roundTextColor, fontWeight: "bold", fontSize: "16px", lineHeight: 1 }}>*</span>}
                    {changed && change?.old_text && <div style={{ ...style, color: "#aaa", textDecoration: "line-through", marginBottom: "2px" }}>{change.old_text}</div>}
                    <div style={{ ...style, color: changed ? roundTextColor : (style.color || "inherit") }}>{block.text}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Page break pre-pass
  const scenesToRender = isEditMode ? editingScenes : scenes;
  const pageBreakKeys = new Set();
  let gLine = 0;
  scenesToRender.forEach((scene, si) => {
    if (si > 0 && gLine + 3 > LINES_PER_PAGE) { pageBreakKeys.add(`scene-${si}`); gLine = 0; }
    gLine += 3;
    (scene.content || []).forEach((block, bi) => {
      const bl = calculateBlockLines(block);
      if (gLine + bl > LINES_PER_PAGE) { pageBreakKeys.add(`${si}-${bi}`); gLine = 0; }
      gLine += bl;
    });
  });

  let pageLabel = 1;
  const PB_STYLE = { borderTop: "2px dashed #ccc", margin: "24pt 0", paddingTop: "12pt", fontSize: "10pt", color: "#999", textAlign: "right" };

  return (
    <div>
      {scenesToRender.map((scene, si) => {
        const statusColor = getSceneStatusColor(scene.sceneNumber);
        if (pageBreakKeys.has(`scene-${si}`)) pageLabel++;
        return (
          <React.Fragment key={`scene-${scene.sceneNumber}`}>
            {pageBreakKeys.has(`scene-${si}`) && <div style={PB_STYLE}>Page {pageLabel}</div>}
            <div ref={el => { sceneRefs.current[si] = el; }} data-scene-index={si} style={{ marginTop: si === 0 ? 0 : "32pt", paddingTop: si === 0 ? 0 : "8pt", borderTop: si === 0 ? "none" : "1px solid #e8e8e8" }}>
              <h2 style={{ marginBottom: "12pt", fontSize: "12pt", fontFamily: "Courier New, monospace", fontWeight: "bold", textTransform: "uppercase", backgroundColor: statusColor !== "transparent" ? statusColor : "transparent", padding: statusColor !== "transparent" ? "4px 8px" : 0, borderRadius: statusColor !== "transparent" ? "4px" : 0, display: "inline-block" }}>
                {scene.sceneNumber}: {scene.heading}
              </h2>
              {scene.content.map((block, bi) => {
                if (pageBreakKeys.has(`${si}-${bi}`)) pageLabel++;
                const style = getElementStyle(block.type);
                const key = getKey(si, bi);
                return (
                  <React.Fragment key={bi}>
                    {pageBreakKeys.has(`${si}-${bi}`) && <div style={PB_STYLE}>Page {pageLabel}</div>}
                    {isEditMode ? (
                      <div
                        ref={el => { blockRefs.current[key] = el; }}
                        contentEditable suppressContentEditableWarning
                        className="script-edit-block"
                        onFocus={() => setActiveBlock({ si, bi })}
                        onBlur={(e) => updateBlockText(si, bi, e.target.textContent)}
                        onInput={() => scheduleTextSnapshot(si, bi)}
                        onKeyDown={(e) => handleKeyDown(e, si, bi, scene.content.length)}
                        dangerouslySetInnerHTML={{ __html: block.text }}
                        style={{ ...style, minHeight: "14pt", backgroundColor: style.backgroundColor || "transparent", borderRadius: "2px" }}
                      />
                    ) : (
                      <div style={style}>{block.formatting ? formatElementText(block) : renderTagged(block.text, si, bi, block)}</div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}, (prev, next) => (
  prev.scenes === next.scenes &&
  prev.editingScenes === next.editingScenes &&
  prev.isEditMode === next.isEditMode &&
  prev.viewingRevision === next.viewingRevision &&
  prev.committedRounds === next.committedRounds &&
  prev.taggedItems === next.taggedItems &&
  prev.showTagDropdown === next.showTagDropdown
));

// ─── Script (Main) ────────────────────────────────────────────────────────────
function Script({
  scenes, currentIndex, setCurrentIndex, setScenes, saveScenesDatabase,
  handleFileUpload, handleSingleSceneUpload, taggedItems, tagCategories,
  showTagDropdown, setShowTagDropdown, tagWord, untagWordInstance,
  isWordInstanceTagged, onSceneNumberChange, stripboardScenes,
  userRole, canEdit, isViewOnly, selectedProject, user,
}) {
  const [isEditMode,       setIsEditMode]       = useState(false);
  const [editingScenes,    setEditingScenes]    = useState([]);
  const [originalContent,  setOriginalContent]  = useState({});
  const [activeBlock,      setActiveBlock]      = useState(null);
  const [isSaving,         setIsSaving]         = useState(false);
  const [committedRounds,  setCommittedRounds]  = useState([]);
  const [pendingRecord,    setPendingRecord]    = useState(null);
  const [showRevisionModal,setShowRevisionModal]= useState(false);
  const [viewingRevision,  setViewingRevision]  = useState(null);
  const [showReplaceDialog,setShowReplaceDialog]= useState(false);
  const [replaceTargetIdx, setReplaceTargetIdx] = useState(null);
  const [currentSceneNumber,setCurrentSceneNumber] = useState(scenes[0]?.sceneNumber || null);

  const sceneRefs       = useRef([]);
  const containerRef    = useRef(null);
  const observerRef     = useRef(null);
  const replaceInputRef = useRef(null);

  const loadRevisions = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const { data, error } = await supabase.from("script_revisions").select("*").eq("project_id", selectedProject.id).order("created_at", { ascending: true });
      if (error) throw error;
      setPendingRecord(data?.find(r => r.is_pending) || null);
      setCommittedRounds(data?.filter(r => !r.is_pending) || []);
    } catch (err) { console.error("Error loading revisions:", err); }
  }, [selectedProject]);

  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  useEffect(() => {
    if (!containerRef.current || scenes.length === 0) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) {
        const idx = parseInt(visible[0].target.dataset.sceneIndex);
        if (!isNaN(idx) && scenes[idx]) { setCurrentSceneNumber(scenes[idx].sceneNumber); }
      }
    }, { root: containerRef.current, threshold: 0.05 });
    sceneRefs.current.forEach(el => { if (el) observerRef.current.observe(el); });
    return () => observerRef.current?.disconnect();
  }, [scenes, setCurrentIndex]);

  useEffect(() => {
    if (!observerRef.current) return;
    sceneRefs.current.forEach(el => { if (el) observerRef.current.observe(el); });
  }, [scenes.length]);

  const enterEditMode = () => {
    const copy = scenes.map(s => ({ ...s, content: s.content.map(b => ({ ...b })) }));
    const origMap = {};
    scenes.forEach(s => { origMap[s.sceneNumber] = s.content.map(b => ({ ...b })); });
    setEditingScenes(copy); setOriginalContent(origMap); setActiveBlock(null); setIsEditMode(true);
  };

  const cancelEditMode = () => { setIsEditMode(false); setEditingScenes([]); setActiveBlock(null); };

  const handleSave = async () => {
    if (isSaving) return;
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
      await new Promise(r => setTimeout(r, 50));
    }
    setIsSaving(true);
    try {
      const diffs = [];
      editingScenes.forEach(scene => {
        const orig = originalContent[scene.sceneNumber] || [];
        scene.content.forEach((block, bi) => {
          const oldText = orig[bi]?.text || "";
          const newText = block.text || "";
          if (oldText !== newText) diffs.push({ scene_number: scene.sceneNumber, block_index: bi, block_type: block.type, old_text: oldText, new_text: newText, timestamp: new Date().toISOString() });
        });
        for (let bi = orig.length; bi < scene.content.length; bi++) {
          diffs.push({ scene_number: scene.sceneNumber, block_index: bi, block_type: scene.content[bi].type, old_text: "", new_text: scene.content[bi].text || "", timestamp: new Date().toISOString() });
        }
      });
      setScenes(editingScenes);
      await saveScenesDatabase(editingScenes);
      if (diffs.length > 0) await savePendingDiffs(diffs);
      const newOrig = {};
      editingScenes.forEach(s => { newOrig[s.sceneNumber] = s.content.map(b => ({ ...b })); });
      setOriginalContent(newOrig);
      setIsEditMode(false); setActiveBlock(null);
    } catch (err) { console.error("Save error:", err); alert("Save failed: " + err.message); }
    finally { setIsSaving(false); }
  };

  const savePendingDiffs = async (newDiffs) => {
    try {
      if (pendingRecord) {
        const merged = [...(pendingRecord.changes || []), ...newDiffs];
        const { data, error } = await supabase.from("script_revisions").update({ changes: merged }).eq("id", pendingRecord.id).select().single();
        if (error) throw error;
        setPendingRecord(data);
      } else {
        const { data, error } = await supabase.from("script_revisions").insert({ project_id: selectedProject.id, round_number: 0, round_name: "Pending", round_color: "#FFFFFF", is_pending: true, created_by: user?.id, changes: newDiffs }).select().single();
        if (error) throw error;
        setPendingRecord(data);
      }
    } catch (err) { console.error("Error saving pending diffs:", err); }
  };

  const handleCommitRevision = async (recordId, roundNumber, roundName, colorObj) => {
    try {
      const { error } = await supabase.from("script_revisions").update({ is_pending: false, round_number: roundNumber, round_name: roundName, round_color: colorObj.hex, round_color_name: colorObj.name, round_color_text: colorObj.textHex }).eq("id", recordId);
      if (error) throw error;
      await loadRevisions();
      setShowRevisionModal(false);
    } catch (err) { console.error("Revision commit error:", err); alert("Error creating revision round: " + err.message); }
  };

  const handleRevert = async () => {
    if (!pendingRecord) return;
    if (!window.confirm("Revert all pending changes? The script will be restored to its state before these changes were saved.")) return;
    try {
      const revertedScenes = scenes.map(scene => {
        const changes = (pendingRecord.changes || []).filter(c => c.scene_number === scene.sceneNumber);
        if (changes.length === 0) return scene;
        const content = [...scene.content];
        changes.forEach(ch => {
          if (content[ch.block_index]) content[ch.block_index] = { ...content[ch.block_index], text: ch.old_text };
        });
        return { ...scene, content };
      });
      setScenes(revertedScenes);
      await saveScenesDatabase(revertedScenes);
      const { error } = await supabase.from("script_revisions").delete().eq("id", pendingRecord.id);
      if (error) throw error;
      setPendingRecord(null);
    } catch (err) { console.error("Revert error:", err); alert("Revert failed: " + err.message); }
  };

  const handleReplaceConfirm = () => {
    if (replaceTargetIdx === null) return;
    setCurrentIndex(replaceTargetIdx);
    setShowReplaceDialog(false);
    setTimeout(() => { replaceInputRef.current?.click(); }, 50);
  };

  const handleReplaceFile = (e) => {
    if (e.target.files[0]) {
      handleSingleSceneUpload(e.target.files[0]);
      e.target.value = "";
      setReplaceTargetIdx(null);
    }
  };

  const getSceneStatusColor = (sceneNumber) => {
    const s = stripboardScenes?.find(s => s.sceneNumber === sceneNumber);
    return { Scheduled:"#e8f5e9",Shot:"#e8f5e9",Pickups:"#fff8e1",Reshoot:"#ffebee",Complete:"#e3f2fd","In Progress":"#f3e5f5","Not Scheduled":"transparent" }[s?.status || "Not Scheduled"] || "transparent";
  };

  const handleToolbarTypeChange = (si, bi, newType) => {
    setEditingScenes(prev => prev.map((s, i) =>
      i !== si ? s : { ...s, content: s.content.map((b, j) => j !== bi ? b : { ...b, type: newType, text: newType === "Character" ? b.text.toUpperCase() : b.text }) }
    ));
  };

  const displaySceneNumber = currentSceneNumber || scenes[currentIndex]?.sceneNumber;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 44px)", overflow: "hidden" }}>
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", minHeight: "48px" }}>
        {/* Left section — sits above the 9.28in script viewer */}
        <div style={{ flex: "0 0 9.28in", display: "flex", gap: "8px", alignItems: "center", padding: "8px 16px", overflow: "hidden" }}>
          {isViewOnly && <div style={{ padding: "6px 12px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontWeight: "bold", fontSize: "13px" }}>VIEW ONLY</div>}
          {canEdit && !isEditMode && <input type="file" accept=".fdx" onChange={handleFileUpload} style={{ fontSize: "12px" }} />}
          {canEdit && !isEditMode && (
            <button onClick={() => setShowReplaceDialog(true)} style={{ padding: "6px 14px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Replace Scene</button>
          )}
          {pendingRecord && !isEditMode && (
            <>
              <button onClick={() => setShowRevisionModal(true)} style={{ padding: "6px 14px", backgroundColor: "#FF5722", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>● Pending Changes</button>
              <button onClick={handleRevert} style={{ padding: "6px 14px", backgroundColor: "#795548", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Revert</button>
            </>
          )}
          {committedRounds.length > 0 && !isEditMode && (
            <select value={viewingRevision || ""} onChange={(e) => setViewingRevision(e.target.value || null)} style={{ padding: "5px 10px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }}>
              <option value="">Current Script</option>
              {committedRounds.map(r => <option key={r.id} value={r.id}>Rev {r.round_number} — {r.round_name} ({r.round_color_name})</option>)}
            </select>
          )}
          {canEdit && !isEditMode && (
            <button onClick={enterEditMode} style={{ padding: "6px 14px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Edit</button>
          )}
          {isEditMode && (
            <>
              <ElementTypeToolbar activeBlock={activeBlock} editingScenes={editingScenes} onTypeChange={handleToolbarTypeChange} />
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <button onClick={handleSave} disabled={isSaving} style={{ padding: "6px 18px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", opacity: isSaving ? 0.7 : 1 }}>{isSaving ? "Saving…" : "Save"}</button>
                <button onClick={cancelEditMode} style={{ padding: "6px 18px", backgroundColor: "#F44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>Cancel</button>
              </div>
            </>
          )}
        </div>
        {/* Right section — sits above the scene list panel */}
        <div style={{ flex: 1 }} />
      </div>

      {showRevisionModal && pendingRecord && <RevisionRoundModal pendingRecord={pendingRecord} committedRounds={committedRounds} onCommit={handleCommitRevision} onClose={() => setShowRevisionModal(false)} />}

      {showReplaceDialog && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10000 }} onClick={() => { setShowReplaceDialog(false); setReplaceTargetIdx(null); }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "white", borderRadius: "8px", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", zIndex: 10001, minWidth: "440px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Replace Scene</h3>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", marginBottom: "6px" }}>SELECT SCENE TO REPLACE</div>
              <select
                value={replaceTargetIdx ?? ""}
                onChange={(e) => setReplaceTargetIdx(e.target.value === "" ? null : parseInt(e.target.value))}
                style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", fontFamily: "monospace" }}
              >
                <option value="">Choose a scene…</option>
                {scenes.map((scene, idx) => (
                  <option key={idx} value={idx}>{String(scene.sceneNumber).padStart(3, "0")} – {scene.heading}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginBottom: "20px" }}>You'll be prompted to select the .fdx file after confirming.</div>
            <input ref={replaceInputRef} type="file" accept=".fdx" onChange={handleReplaceFile} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleReplaceConfirm}
                disabled={replaceTargetIdx === null}
                style={{ flex: 1, padding: "9px", backgroundColor: "#FF9800", color: "white", border: "none", borderRadius: "4px", cursor: replaceTargetIdx === null ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "13px", opacity: replaceTargetIdx === null ? 0.5 : 1 }}
              >
                Choose .fdx File…
              </button>
              <button onClick={() => { setShowReplaceDialog(false); setReplaceTargetIdx(null); }} style={{ padding: "9px 18px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0 }}>
        <div style={{ maxWidth: "9.28in", flex: "0 0 9.28in", display: "flex", flexDirection: "column", border: "1px solid #ccc", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
        <style>{`.script-edit-block { outline: none; caret-color: red; } .script-edit-block:focus { outline: none !important; background-color: transparent !important; caret-color: red; }`}</style>
        <div ref={containerRef} style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "1.5in", backgroundColor: "white", boxSizing: "border-box", fontFamily: "Courier New, monospace" }}>
        <ContinuousScript
            scenes={scenes} sceneRefs={sceneRefs} isEditMode={isEditMode}
            editingScenes={editingScenes} setEditingScenes={setEditingScenes}
            setActiveBlock={setActiveBlock}
            taggedItems={taggedItems} tagCategories={tagCategories}
            showTagDropdown={showTagDropdown} setShowTagDropdown={setShowTagDropdown}
            tagWord={tagWord} untagWordInstance={untagWordInstance}
            isWordInstanceTagged={isWordInstanceTagged}
            getSceneStatusColor={getSceneStatusColor}
            committedRounds={committedRounds} viewingRevision={viewingRevision}
            setCurrentIndex={setCurrentIndex}
          />
          {showTagDropdown && !isEditMode && (
            <>
              <div style={{ position: "fixed", left: showTagDropdown.x, top: showTagDropdown.y, backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 8px rgba(0,0,0,0.2)", zIndex: 1000, minWidth: "150px" }}>
                {showTagDropdown.isTagged ? (
                  <div onClick={() => untagWordInstance(showTagDropdown.word, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex)} style={{ padding: "8px 12px", cursor: "pointer" }}>Remove Tag ({showTagDropdown.category})</div>
                ) : (
                  tagCategories.map((cat, i) => (
                    <div key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); tagWord(showTagDropdown.word, cat.name, showTagDropdown.sceneIndex, showTagDropdown.blockIndex, showTagDropdown.wordIndex); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: i < tagCategories.length - 1 ? "1px solid #eee" : "none", display: "flex", alignItems: "center" }}>
                      <div style={{ width: "12px", height: "12px", backgroundColor: cat.color, marginRight: "8px", borderRadius: "2px" }} />{cat.name}
                    </div>
                  ))
                )}
              </div>
              <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowTagDropdown(null)} />
            </>
          )}
        </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <SceneList scenes={scenes} currentSceneNumber={displaySceneNumber} sceneRefs={sceneRefs} getSceneStatusColor={getSceneStatusColor} selectedProject={selectedProject} user={user} onSceneNumberChange={onSceneNumberChange} setCurrentIndex={setCurrentIndex} />
        </div>
      </div>
    </div>
  );
}

export default Script;