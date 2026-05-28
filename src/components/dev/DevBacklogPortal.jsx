import React, { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "filmProductionBinder:devBacklog";
const SHOW_COMPLETED_KEY = "filmProductionBinder:devBacklog:showCompleted";
const DEV_USER_EMAIL = "joshuachiara@gmail.com";

const SEED_DATA = {
  categories: [
    {
      id: "workflow-architecture",
      title: "Workflow / App Architecture",
      items: [
        { id: "wa-1", text: "Continue phase-based workflow architecture with Writing, Pitching, Pre-Production, Production, Post-Production", done: false },
        { id: "wa-2", text: "Keep Writing insulated from Production/Script Breakdown", done: false },
        { id: "wa-3", text: "Continue module header/layout unification", done: false },
        { id: "wa-4", text: "Audit sceneNumber identity usage and migrate to stable scene IDs", done: false },
      ],
    },
    {
      id: "writing-script-share",
      title: "Writing / Script Share",
      items: [
        { id: "wss-1", text: "Add public Script share stale-content indicator with Refresh button", done: false },
        { id: "wss-2", text: "Preserve mobile edge-to-edge public Script share behavior", done: false },
        { id: "wss-3", text: "Preserve full-window desktop watermark coverage", done: false },
      ],
    },
    {
      id: "writing-import",
      title: "Writing / Import / Script Data",
      items: [
        { id: "wi-1", text: "Improve screenplay import/parsing for FDX/PDF/plain text", done: false },
        { id: "wi-2", text: "Add AI one-line production-focused scene summaries", done: false },
        { id: "wi-3", text: "Continue Writing pagination/page-stats stability", done: false },
      ],
    },
    {
      id: "writing-characters",
      title: "Writing Characters",
      items: [
        { id: "wc-1", text: "Implement Phase 1 Writing Characters tab", done: false },
        { id: "wc-2", text: "Expand Writing Character profiles later", done: false },
        { id: "wc-3", text: "Add Writing-to-Breakdown character handoff later", done: false },
      ],
    },
    {
      id: "moodboard",
      title: "MoodBoard",
      items: [
        { id: "mb-1", text: "Add MoodBoard character assignment foundation", done: false },
        { id: "mb-2", text: "Add BOARDS | Characters tab later", done: false },
        { id: "mb-3", text: "Keep MoodBoard share links rasterized/snapshot-based", done: false },
      ],
    },
    {
      id: "stripboard",
      title: "Stripboard / Scheduling / Calendar",
      items: [
        { id: "sb-1", text: "Continue Script/Breakdown → Stripboard → Schedule → Calendar → Call Sheets workflow", done: false },
        { id: "sb-2", text: "Add conflict detection, day/night grouping, location batching, page count/day", done: false },
      ],
    },
    {
      id: "dood",
      title: "Day Out of Days",
      items: [
        { id: "dood-1", text: "Continue DOOD data model/manual generator", done: false },
        { id: "dood-2", text: "Add scene-driven auto-population", done: false },
        { id: "dood-3", text: "Add revision tracking/diffing and PDF export later", done: false },
      ],
    },
    {
      id: "call-sheets",
      title: "Call Sheets",
      items: [
        { id: "cs-1", text: "Continue call sheet generation from schedule data", done: false },
        { id: "cs-2", text: "Add weather/sunrise/sunset and PDF export polish", done: false },
      ],
    },
    {
      id: "budget",
      title: "Budget",
      items: [
        { id: "budget-1", text: "Continue Budget row layout refinements", done: false },
        { id: "budget-2", text: "Add schedule/DOOD/cast-fed cost projections later", done: false },
      ],
    },
    {
      id: "ui-layout",
      title: "UI / Layout System",
      items: [
        { id: "ui-1", text: "Add temporary layout tuning sliders/panels for spacing, offsets, sizing", done: false },
        { id: "ui-2", text: "Preserve app-wide Questrial/Century-Gothic-like font styling", done: false },
        { id: "ui-3", text: "Avoid layout shifts, toolbar jumps, and scrollbar geometry changes", done: false },
      ],
    },
  ],
};

function loadBacklog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_DATA;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) return SEED_DATA;
    return parsed;
  } catch {
    return SEED_DATA;
  }
}

function saveBacklog(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadShowCompleted() {
  try {
    const raw = localStorage.getItem(SHOW_COMPLETED_KEY);
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

function saveShowCompleted(value) {
  try {
    localStorage.setItem(SHOW_COMPLETED_KEY, String(value));
  } catch {}
}

function groupIncompleteFirst(items) {
  return [
    ...items.filter(item => !item.done),
    ...items.filter(item => item.done),
  ];
}

function makeId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeCatId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function DevBacklogPortal({ userEmail, open: controlledOpen = null, onOpenChange = null, hideTrigger = false }) {
  const isDev =
    process.env.NODE_ENV === "development" ||
    userEmail === DEV_USER_EMAIL;

  const [internalOpen, setInternalOpen] = useState(false);
  const [backlog, setBacklog] = useState(() => loadBacklog());
  const [newItemText, setNewItemText] = useState({});
  const [newCatText, setNewCatText] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editItemText, setEditItemText] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryTitle, setEditCategoryTitle] = useState("");
  const [showCompleted, setShowCompletedState] = useState(() => loadShowCompleted());
  const addInputRefs = useRef({});
  const open = controlledOpen == null ? internalOpen : controlledOpen;
  const setOpen = useCallback((next) => {
    if (typeof next === "function") {
      const resolved = next(open);
      if (controlledOpen == null) setInternalOpen(resolved);
      onOpenChange?.(resolved);
      return;
    }
    if (controlledOpen == null) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange, open]);

  const update = useCallback((next) => {
    setBacklog(next);
    saveBacklog(next);
  }, []);

  const setShowCompleted = useCallback((next) => {
    setShowCompletedState(next);
    saveShowCompleted(next);
  }, []);

  const toggleItem = useCallback((catId, itemId) => {
    update({
      ...backlog,
      categories: backlog.categories.map(cat =>
        cat.id !== catId ? cat : {
          ...cat,
          items: groupIncompleteFirst(cat.items.map(item =>
            item.id !== itemId ? item : { ...item, done: !item.done }
          )),
        }
      ),
    });
  }, [backlog, update]);

  const addItem = useCallback((catId) => {
    const text = (newItemText[catId] || "").trim();
    if (!text) return;
    update({
      ...backlog,
      categories: backlog.categories.map(cat =>
        cat.id !== catId ? cat : {
          ...cat,
          items: [...cat.items, { id: makeId(), text, done: false }],
        }
      ),
    });
    setNewItemText(prev => ({ ...prev, [catId]: "" }));
  }, [backlog, newItemText, update]);

  const addCategory = useCallback(() => {
    const title = newCatText.trim();
    if (!title) return;
    update({
      ...backlog,
      categories: [...backlog.categories, { id: makeCatId(), title, items: [] }],
    });
    setNewCatText("");
  }, [backlog, newCatText, update]);

  const startEditingItem = useCallback((catId, item) => {
    setEditingItem({ catId, itemId: item.id });
    setEditItemText(item.text || "");
  }, []);

  const cancelEditingItem = useCallback(() => {
    setEditingItem(null);
    setEditItemText("");
  }, []);

  const saveEditingItem = useCallback(() => {
    if (!editingItem) return;
    const text = editItemText.trim();
    if (!text) return;
    update({
      ...backlog,
      categories: backlog.categories.map(cat =>
        cat.id !== editingItem.catId ? cat : {
          ...cat,
          items: cat.items.map(item =>
            item.id !== editingItem.itemId ? item : { ...item, text }
          ),
        }
      ),
    });
    setEditingItem(null);
    setEditItemText("");
  }, [backlog, editItemText, editingItem, update]);

  const startEditingCategory = useCallback((cat) => {
    setEditingCategory(cat.id);
    setEditCategoryTitle(cat.title || "");
  }, []);

  const cancelEditingCategory = useCallback(() => {
    setEditingCategory(null);
    setEditCategoryTitle("");
  }, []);

  const deleteCategory = useCallback((catId) => {
    if (!window.confirm("Delete this category and all of its tasks?")) return;
    update({
      ...backlog,
      categories: backlog.categories.filter(cat => cat.id !== catId),
    });
    if (editingCategory === catId) {
      setEditingCategory(null);
      setEditCategoryTitle("");
    }
  }, [backlog, editingCategory, update]);

  const saveEditingCategory = useCallback(() => {
    if (!editingCategory) return;
    const title = editCategoryTitle.trim();
    if (!title) {
      cancelEditingCategory();
      return;
    }
    update({
      ...backlog,
      categories: backlog.categories.map(cat =>
        cat.id !== editingCategory ? cat : { ...cat, title }
      ),
    });
    setEditingCategory(null);
    setEditCategoryTitle("");
  }, [backlog, cancelEditingCategory, editCategoryTitle, editingCategory, update]);

  if (!isDev) return null;

  const totalItems = backlog.categories.reduce((n, c) => n + c.items.length, 0);
  const doneItems = backlog.categories.reduce((n, c) => n + c.items.filter(i => i.done).length, 0);

  return createPortal(
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(o => !o)}
          title="Dev Backlog"
          style={{
            position: "fixed",
            bottom: "16px",
            right: "16px",
            zIndex: 99998,
            padding: "6px 12px",
            backgroundColor: "#1a1a2e",
            color: "#e0e0ff",
            border: "1px solid #444",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: "'Questrial','Futura','Arial',sans-serif",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          Backlog {doneItems}/{totalItems}
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "min(1260px, calc(100vw - 48px))",
              maxHeight: "80vh",
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'Questrial','Futura','Arial',sans-serif",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid #e0e0e0",
              flexShrink: 0,
              backgroundColor: "#1a1a2e",
              color: "white",
            }}>
              <div>
                <span style={{ fontWeight: "bold", fontSize: "13px" }}>Dev Backlog</span>
                <span style={{ marginLeft: "10px", fontSize: "11px", color: "#aaaacc" }}>
                  {doneItems} / {totalItems} done
                </span>
                <label style={{ marginLeft: "16px", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#d8d8ff", fontWeight: "normal" }}>
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={e => setShowCompleted(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Show completed
                </label>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none", border: "none", color: "#aaa",
                  fontSize: "18px", cursor: "pointer", lineHeight: 1, padding: "0 2px",
                }}
              >×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              {backlog.categories.map(cat => {
                const catDone = cat.items.filter(i => i.done).length;
                const visibleItems = showCompleted ? cat.items : cat.items.filter(item => !item.done);
                const isEditingCategory = editingCategory === cat.id;
                return (
                  <div key={cat.id} style={{ marginBottom: "18px" }}>
                    <div style={{
                      fontSize: "11px",
                      color: "#555",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      justifyContent: "space-between",
                    }}>
                      {isEditingCategory ? (
                        <input
                          type="text"
                          value={editCategoryTitle}
                          onChange={e => setEditCategoryTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEditingCategory();
                            if (e.key === "Escape") cancelEditingCategory();
                          }}
                          onBlur={saveEditingCategory}
                          autoFocus
                          style={{ flex: 1, minWidth: 0, fontSize: "11px", fontWeight: 900, textTransform: "none", letterSpacing: 0, padding: "3px 6px", border: "1px solid #bbb", borderRadius: "4px" }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingCategory(cat)}
                          title="Edit category"
                          style={{ flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent", color: "#333", cursor: "pointer", textAlign: "left", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "inherit" }}
                        >
                          {cat.title}
                        </button>
                      )}
                      {cat.items.length > 0 && (
                        <span style={{ color: "#aaa", fontWeight: "normal", flexShrink: 0 }}>
                          {catDone}/{cat.items.length}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                        title="Delete category"
                        aria-label={`Delete ${cat.title}`}
                        style={{
                          width: "22px",
                          height: "22px",
                          padding: 0,
                          border: "1px solid #ffcdd2",
                          borderRadius: "50%",
                          backgroundColor: "#ffebee",
                          color: "#c62828",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: "14px",
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {visibleItems.map(item => {
                      const isEditing = editingItem?.catId === cat.id && editingItem?.itemId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: "4px 0",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleItem(cat.id, item.id)}
                            style={{ marginTop: "2px", flexShrink: 0, cursor: "pointer" }}
                          />
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editItemText}
                                onChange={e => setEditItemText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") saveEditingItem();
                                  if (e.key === "Escape") cancelEditingItem();
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: "12px",
                                  padding: "3px 6px",
                                  border: "1px solid #bbb",
                                  borderRadius: "4px",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                onClick={saveEditingItem}
                                style={{ fontSize: "11px", padding: "3px 8px", cursor: "pointer", border: "1px solid #9ccc65", borderRadius: "4px", backgroundColor: "#f1f8e9" }}
                              >Save</button>
                              <button
                                type="button"
                                onClick={cancelEditingItem}
                                style={{ fontSize: "11px", padding: "3px 8px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}
                              >Cancel</button>
                            </>
                          ) : (
                            <>
                              <span style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: "12px",
                                color: item.done ? "#aaa" : "#222",
                                textDecoration: item.done ? "line-through" : "none",
                                lineHeight: 1.4,
                              }}>
                                {item.text}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditingItem(cat.id, item)}
                                style={{ fontSize: "11px", padding: "2px 7px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}
                              >Edit</button>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Add item to this category */}
                    <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                      <input
                        ref={el => { addInputRefs.current[cat.id] = el; }}
                        type="text"
                        placeholder="Add item…"
                        value={newItemText[cat.id] || ""}
                        onChange={e => setNewItemText(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") addItem(cat.id); }}
                        style={{
                          flex: 1,
                          fontSize: "11px",
                          padding: "3px 6px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => addItem(cat.id)}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          cursor: "pointer",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          backgroundColor: "#f5f5f5",
                        }}
                      >+</button>
                    </div>
                  </div>
                );
              })}

              {/* Add new category */}
              <div style={{ borderTop: "1px solid #eee", paddingTop: "10px", marginTop: "4px" }}>
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>New category</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    type="text"
                    placeholder="Category name…"
                    value={newCatText}
                    onChange={e => setNewCatText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
                    style={{
                      flex: 1,
                      fontSize: "11px",
                      padding: "3px 6px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={addCategory}
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      cursor: "pointer",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      backgroundColor: "#f5f5f5",
                    }}
                  >+ Cat</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
