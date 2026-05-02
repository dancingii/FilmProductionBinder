import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Column Definitions ──────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: "script",           label: "Script",       defaultWidth: 52,  defaultVisible: true,  resizable: false },
  { key: "status",           label: "Status",       defaultWidth: 88,  defaultVisible: true,  resizable: true  },
  { key: "scene",            label: "Scene #",      defaultWidth: 52,  defaultVisible: true,  resizable: true  },
  { key: "ie",               label: "I/E",          defaultWidth: 42,  defaultVisible: true,  resizable: true  },
  { key: "location",         label: "Location",     defaultWidth: 130, defaultVisible: true,  resizable: true  },
  { key: "description",      label: "Description",  defaultWidth: 240, defaultVisible: true,  resizable: true  },
  { key: "dn",               label: "D/N",          defaultWidth: 42,  defaultVisible: true,  resizable: true  },
  { key: "cast",             label: "Cast",         defaultWidth: 115, defaultVisible: true,  resizable: true  },
  { key: "pageNum",          label: "Page #",       defaultWidth: 52,  defaultVisible: true,  resizable: true  },
  { key: "pages",            label: "Pages",        defaultWidth: 52,  defaultVisible: true,  resizable: true  },
  { key: "wardrobe",         label: "Wardrobe",     defaultWidth: 80,  defaultVisible: true,  resizable: true  },
  { key: "props",            label: "Props",        defaultWidth: 100, defaultVisible: true,  resizable: true  },
  { key: "notes",            label: "Notes",        defaultWidth: 130, defaultVisible: true,  resizable: true  },
  { key: "makeup",           label: "Makeup",       defaultWidth: 90,  defaultVisible: false, resizable: true  },
  { key: "productionDesign", label: "Prod. Design", defaultWidth: 100, defaultVisible: false, resizable: true  },
  { key: "scheduledDate",    label: "Shoot Date",   defaultWidth: 90,  defaultVisible: false, resizable: true  },
  { key: "modifier",         label: "Modifier",     defaultWidth: 90,  defaultVisible: false, resizable: true  },
];

const PREFS_KEY   = "stripboard_prefs_v1";
const FONT_SIZES  = [7, 8, 9, 10, 11, 12];

const defaultPrefs = () => ({
  visibleColumns: ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
  columnWidths:   Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultWidth])),
  fontSize:       9,
});

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    const saved = JSON.parse(raw);
    const def   = defaultPrefs();
    return {
      visibleColumns: saved.visibleColumns || def.visibleColumns,
      columnWidths:   { ...def.columnWidths, ...(saved.columnWidths || {}) },
      fontSize:       saved.fontSize || def.fontSize,
    };
  } catch {
    return defaultPrefs();
  }
};

// ─── Main Component ──────────────────────────────────────────────────────────
function StripboardModule({
    scenes,
    onLocationClick,
    taggedItems,
    characters,
    castCrew,
    wardrobeItems,
    onUpdateScene,
    shootingDays,
    userRole,
    canEdit,
    isViewOnly,
  }) {
  const [prefs,          setPrefs]          = useState(loadPrefs);
  const [savedToast,     setSavedToast]     = useState(false);
  const [showColumnsMenu,setShowColumnsMenu]= useState(false);
  const [editingDescription, setEditingDescription] = useState(null);
  const [editingNotes,       setEditingNotes]        = useState(null);
  const [editingHeadingScene,setEditingHeadingScene] = useState(null);
  const [headingForm, setHeadingForm] = useState({ intExt: "EXT.", location: "", timeOfDay: "DAY", modifier: "" });
  const [showLocationPopup,  setShowLocationPopup]   = useState(null);
  const [showScriptPopup,    setShowScriptPopup]     = useState(false);
  const [selectedSceneForScript, setSelectedSceneForScript] = useState(null);
  const [scriptFullMode,     setScriptFullMode]      = useState(false);
  const [scriptFullIndex,    setScriptFullIndex]     = useState(0);

  const saveTimerRef      = useRef(null);
  const dragState         = useRef(null);
  const scrollContainerRef = useRef(null);

  // ── Restore scroll ──
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const saved = sessionStorage.getItem("stripboard-scroll-position");
    if (saved !== null) scrollContainerRef.current.scrollTop = parseInt(saved, 10);
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current)
      sessionStorage.setItem("stripboard-scroll-position", scrollContainerRef.current.scrollTop.toString());
  };

  // ── Persist prefs ──
  const persistPrefs = useCallback((newPrefs) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
      } catch {}
    }, 600);
  }, []);

  const updatePrefs = useCallback((newPrefs) => {
    setPrefs(newPrefs);
    persistPrefs(newPrefs);
  }, [persistPrefs]);

  const resetPrefs = () => {
    const def = { ...defaultPrefs(), fontSize: prefs.fontSize };
    localStorage.setItem(PREFS_KEY, JSON.stringify(def));
    setPrefs(def);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  // ── Column visibility ──
  const toggleColumn = (key) => {
    const isVisible = prefs.visibleColumns.includes(key);
    if (isVisible) {
      // Remove — preserve existing order
      updatePrefs({ ...prefs, visibleColumns: prefs.visibleColumns.filter((k) => k !== key) });
    } else {
      // Add — insert at its natural position relative to visible columns
      const allKeys    = ALL_COLUMNS.map((c) => c.key);
      const newVisible = [...prefs.visibleColumns, key];
      const ordered    = allKeys.filter((k) => newVisible.includes(k));
      updatePrefs({ ...prefs, visibleColumns: ordered });
    }
  };

  // ── Column reorder ──
  const moveColumn = (key, direction) => {
    const cols = [...prefs.visibleColumns];
    const idx  = cols.indexOf(key);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cols.length) return;
    [cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]];
    updatePrefs({ ...prefs, visibleColumns: cols });
  };

  // ── Font size ──
  const changeFontSize = (delta) => {
    const idx    = FONT_SIZES.indexOf(prefs.fontSize);
    const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
    updatePrefs({ ...prefs, fontSize: FONT_SIZES[newIdx] });
  };

  // ── Column resize ──
  const onResizeStart = useCallback((e, colKey) => {
    e.preventDefault();
    dragState.current = { colKey, startX: e.clientX, startWidth: prefs.columnWidths[colKey] || 100 };

    const onMouseMove = (ev) => {
      if (!dragState.current) return;
      const { colKey: k, startX, startWidth } = dragState.current;
      const newWidth = Math.max(30, startWidth + ev.clientX - startX);
      setPrefs((p) => ({ ...p, columnWidths: { ...p.columnWidths, [k]: newWidth } }));
    };

    const onMouseUp = () => {
      if (!dragState.current) return;
      setPrefs((p) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(p));
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 2000);
          } catch {}
        }, 100);
        return p;
      });
      dragState.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }, [prefs.columnWidths]);

  // ── Grid computation ──
  const visibleCols  = prefs.visibleColumns.map((k) => ALL_COLUMNS.find((c) => c.key === k)).filter(Boolean);
  const gridTemplate = visibleCols.map((c) => `${prefs.columnWidths[c.key] || c.defaultWidth}px`).join(" ");
  const minWidth     = visibleCols.reduce((s, c) => s + (prefs.columnWidths[c.key] || c.defaultWidth), 0) + visibleCols.length * 5;

  // ── Data helpers ──
  const getPropNumberMap = () => {
    const earliest = (prop) => {
      const nums = (prop.scenes || []).map(Number).filter((n) => !isNaN(n));
      return nums.length ? Math.min(...nums) : Infinity;
    };
    const sorted = Object.entries(taggedItems || {})
      .filter(([, item]) => item.category === "Props")
      .sort((a, b) => {
        const d = earliest(a[1]) - earliest(b[1]);
        return d !== 0 ? d : (a[1].chronologicalNumber || 0) - (b[1].chronologicalNumber || 0);
      });
    return Object.fromEntries(sorted.map(([word], idx) => [word, idx + 1]));
  };

  const propNumberMap = getPropNumberMap();

  // Build scene → shoot day map from scheduleBlocks (same source CallSheet uses)
  const sceneShootDayMap = React.useMemo(() => {
    const map = {};
    if (!shootingDays) return map;
    shootingDays.forEach((day) => {
      (day.scheduleBlocks || []).forEach((block) => {
        if (block.scene && block.scene.sceneNumber) {
          map[String(block.scene.sceneNumber)] = { date: day.date, dayNumber: day.dayNumber };
        }
      });
    });
    return map;
  }, [shootingDays]);

  const getSceneTaggedItems = (sceneNumber) => {
    const result = { props: [], makeup: [], productionDesign: [] };
    if (!taggedItems) return result;
    Object.entries(taggedItems).forEach(([word, item]) => {
      if (!item.scenes || !item.scenes.some((s) => String(s) === String(sceneNumber))) return;
      const cat = (item.category || "").toLowerCase().replace(/\s/g, "");
      if (cat === "productiondesign") {
        result.productionDesign.push(item.displayName);
      } else if (cat === "props") {
        const num  = propNumberMap[word] || item.chronologicalNumber || "";
        const name = item.customTitle || item.displayName || word;
        result.props.push(num ? `${num}. ${name}` : name);
      } else if (cat === "makeup") {
        result.makeup.push(item.displayName);
      }
    });
    return result;
  };

  const getSceneWardrobe = (sceneNumber) => {
    if (!wardrobeItems || !wardrobeItems.length) return "";
    const out = [];
    wardrobeItems.forEach((char) => {
      (char.items || []).forEach((item) => {
        if (item.scenes && item.scenes.includes(parseInt(sceneNumber)))
          out.push(`${char.characterName} ${item.number}`);
      });
    });
    return out.join(", ");
  };

  const getSceneCastCrew = (sceneNumber) => {
    if (!castCrew || !characters) return [];
    const sceneStr = String(sceneNumber);
    const findChar = (name) => {
      if (!name) return null;
      if (characters[name]) return characters[name];
      const entry = Object.entries(characters).find(([k]) => k.toLowerCase() === name.toLowerCase());
      return entry ? entry[1] : null;
    };
    return castCrew
      .filter((p) => {
        if (p.type !== "cast") return false;
        const cd = findChar(p.character);
        return cd && cd.scenes && cd.scenes.some((s) => String(s) === sceneStr);
      })
      .map((p) => {
        const cd  = findChar(p.character);
        const num = cd ? cd.chronologicalNumber : "";
        return { displayText: num ? `${num}. ${p.displayName}` : p.displayName, num };
      })
      .sort((a, b) => (a.num || 999) - (b.num || 999));
  };

  const getStatusColor = (status, isScheduled = false) => {
    if (isScheduled && (status === "Pickups" || status === "Reshoot")) return "#8fb8d4";
    const map = { Scheduled: "#8fb8d4", Shot: "#8aba8a", Pickups: "#d4bc7a", Reshoot: "#d49494", Removed: "#c4a0c4" };
    return map[status] || "#e8e8e8";
  };

  const getStatusBorder = (status, isScheduled = false) => {
    if (isScheduled && status === "Pickups") return "5px solid #c4a040";
    if (isScheduled && status === "Reshoot") return "5px solid #c06060";
    return "1px solid #ddd";
  };

  const getStatusCounts = () => {
    const c = { total: scenes.length, "Not Scheduled": 0, Scheduled: 0, Shot: 0, Pickups: 0, Reshoots: 0, Removed: 0 };
    scenes.forEach((scene) => {
      const s = scene.status || "Not Scheduled";
      if (s.includes("Pickups"))  { c.Pickups++;  if (s.includes("Scheduled")) c.Scheduled++; if (s.includes("Shot")) c.Shot++; }
      else if (s.includes("Reshoot")) { c.Reshoots++; if (s.includes("Scheduled")) c.Scheduled++; if (s.includes("Shot")) c.Shot++; }
      else { c[s] = (c[s] || 0) + 1; }
    });
    return c;
  };

  // ── Script popup helpers ──
  const getElementStyle = (type) => {
    const base = { fontFamily: "Courier New, monospace", fontSize: "12pt", lineHeight: "12pt", marginBottom: "12pt", color: "#000" };
    switch (type) {
      case "Character":     return { ...base, marginLeft: "200px", textTransform: "uppercase", fontWeight: "normal" };
      case "Dialogue":      return { ...base, marginLeft: "100px", marginRight: "100px" };
      case "Parenthetical": return { ...base, marginLeft: "150px", fontStyle: "italic" };
      case "Action":        return { ...base, marginLeft: "0", marginRight: "0" };
      case "Scene Heading": return { ...base, marginLeft: "0", textTransform: "uppercase", fontWeight: "bold", marginTop: "24pt" };
      default:              return base;
    }
  };

  const formatBlock = (block) => {
    if (block.formatting?.bold)      return React.createElement("strong", null, block.text);
    if (block.formatting?.italic)    return React.createElement("em",     null, block.text);
    if (block.formatting?.underline) return React.createElement("u",      null, block.text);
    if (block.type === "Character" && block.text.includes("(")) {
      const [name, ...rest] = block.text.split("(");
      return React.createElement("span", null, name.trim(), React.createElement("span", { style: { fontWeight: "normal" } }, ` (${rest.join("(")}`));
    }
    return block.text;
  };

  const handleSceneClick = (scene) => {
    const s = scenes.find((sc) => sc.sceneNumber === scene.sceneNumber);
    if (s) { setSelectedSceneForScript(s); setShowScriptPopup(true); }
  };
  const closeScriptPopup = () => { setShowScriptPopup(false); setSelectedSceneForScript(null); setScriptFullMode(false); };

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      setEditingHeadingScene(null);
      setShowScriptPopup(false);
      setShowLocationPopup(null);
      setShowColumnsMenu(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, []);

  // ── Cell renderer ──
  const renderCell = (scene, index, colKey, sceneItems, sceneCastCrew) => {
    const fs = prefs.fontSize;
    switch (colKey) {
      case "script":
        return (
          <button onClick={() => handleSceneClick(scene)}
            style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "2px", padding: "2px 5px", fontSize: fs - 1, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>
            Script
          </button>
        );

      case "status":
        return (
          <select value={scene.status || "Not Scheduled"}
            onChange={(e) => onUpdateScene && onUpdateScene(index, "status", e.target.value)}
            style={{ width: "100%", fontSize: fs - 1, padding: "1px 14px 1px 2px", border: "1px solid #ccc", borderRadius: "2px", backgroundColor: "white" }}>
            <option value="Not Scheduled">Unscheduled</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Shot">Shot</option>
            <option value="Pickups">Pickups</option>
            <option value="Reshoot">Reshoot</option>
            <option value="Removed">Removed</option>
          </select>
        );

      case "scene":
        return (
          <div style={{ fontWeight: "bold", fontSize: fs }}>
            {scene.sceneNumber}
            <button
              onClick={() => { setHeadingForm({ intExt: scene.metadata?.intExt || "EXT.", location: scene.metadata?.location || "", timeOfDay: scene.metadata?.timeOfDay || scene.manualTimeOfDay || "DAY", modifier: scene.metadata?.modifier || "" }); setEditingHeadingScene(index); }}
              style={{ backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "2px", padding: "1px 4px", fontSize: fs - 2, cursor: "pointer", marginLeft: "3px", verticalAlign: "middle" }}>
              ✎
            </button>
          </div>
        );

      case "ie":
        return <div style={{ fontSize: fs }}>{scene.metadata?.intExt || ""}</div>;

      case "location":
        return <div style={{ fontSize: fs }}>{scene.metadata?.location || ""}</div>;

      case "description":
        return editingDescription === index ? (
          <input type="text" value={scene.description || ""}
            onChange={(e) => onUpdateScene && onUpdateScene(index, "description", e.target.value)}
            onBlur={() => setEditingDescription(null)}
            onKeyPress={(e) => { if (e.key === "Enter") setEditingDescription(null); }}
            autoFocus
            style={{ width: "100%", fontSize: fs + 2, padding: "2px", border: "1px solid #2196F3", borderRadius: "2px" }} />
        ) : (
          <div onDoubleClick={() => setEditingDescription(index)}
            style={{ cursor: "text", minHeight: "14px", fontSize: fs, lineHeight: "1.3", padding: "1px", borderRadius: "2px" }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
            onMouseOut={(e)  => (e.currentTarget.style.backgroundColor = "transparent")}
            title="Double-click to edit">
            {scene.description || <span style={{ color: "#bbb", fontStyle: "italic" }}>Add description</span>}
          </div>
        );

      case "dn":
        return <div style={{ fontSize: fs }}>{scene.manualTimeOfDay || scene.metadata?.timeOfDay || "--"}</div>;

      case "cast":
        return (
          <div style={{ lineHeight: "1.2" }}>
            {sceneCastCrew.map((p, i) => <div key={i} style={{ fontSize: fs, marginBottom: "1px" }}>{p.displayText}</div>)}
          </div>
        );

        case "pageNum":
            return <div style={{ fontSize: fs, textAlign: "center" }}>{scene.pageNumber || "1"}</div>;

      case "pages":
        return <div style={{ fontSize: fs }}>{scene.pageLength || "1/8"}</div>;

      case "wardrobe":
        return <div style={{ fontSize: fs, lineHeight: "1.3" }}>{sceneItems.wardrobe.join(", ")}</div>;

      case "props":
        return <div style={{ fontSize: fs, lineHeight: "1.3" }}>{sceneItems.props.join(", ")}</div>;

      case "notes":
        return editingNotes === index ? (
          <input type="text" value={scene.notes || ""}
            onChange={(e) => onUpdateScene && onUpdateScene(index, "notes", e.target.value)}
            onBlur={() => setEditingNotes(null)}
            onKeyPress={(e) => { if (e.key === "Enter") setEditingNotes(null); }}
            autoFocus
            style={{ width: "100%", fontSize: fs + 2, padding: "2px", border: "1px solid #2196F3", borderRadius: "2px" }} />
        ) : (
          <div onClick={() => setEditingNotes(index)}
            style={{ cursor: "pointer", minHeight: "14px", fontSize: fs, lineHeight: "1.3", padding: "1px", borderRadius: "2px" }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
            onMouseOut={(e)  => (e.currentTarget.style.backgroundColor = "transparent")}>
            {scene.notes || <span style={{ color: "#bbb", fontStyle: "italic" }}>Add notes</span>}
          </div>
        );

      case "makeup":
        return <div style={{ fontSize: fs, lineHeight: "1.3" }}>{sceneItems.makeup.join(", ") || <span style={{ color: "#ccc" }}>—</span>}</div>;

      case "productionDesign":
        return <div style={{ fontSize: fs, lineHeight: "1.3" }}>{sceneItems.productionDesign.join(", ") || <span style={{ color: "#ccc" }}>—</span>}</div>;

        case "scheduledDate": {
            const shootDay = sceneShootDayMap[String(scene.sceneNumber)];
            if (!shootDay) return <div style={{ fontSize: fs, color: "#ccc" }}>—</div>;
            const [y, m, dd] = shootDay.date.split("-");
            const formatted = `${parseInt(m)}/${parseInt(dd)}/${y.slice(-2)}`;
            return (
              <div style={{ fontSize: fs, lineHeight: "1.3" }}>
                <div style={{ fontWeight: "bold" }}>Day {shootDay.dayNumber}</div>
                <div style={{ color: "#666" }}>{formatted}</div>
              </div>
            );
          }

      case "modifier":
        return <div style={{ fontSize: fs }}>{scene.metadata?.modifier || <span style={{ color: "#ccc" }}>—</span>}</div>;

      default:
        return null;
    }
  };

  // ── Empty state ──
  if (!scenes || scenes.length === 0) {
    return (
      <div style={{ padding: "20px", width: "100%", height: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box" }}>
        <h2>Stripboard</h2>
        <p>No scenes loaded. Please upload a script first.</p>
      </div>
    );
  }

  const statusCounts = getStatusCounts();

  return (
    <div ref={scrollContainerRef} onScroll={handleScroll}
      style={{ padding: "20px", width: "100%", height: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box" }}>

      {/* ── Header + Toolbar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ margin: 0 }}>Stripboard — Scene Breakdown</h2>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

          {/* Saved toast — fixed position so it never shifts the toolbar */}
          {savedToast && (
            <div style={{ position: "fixed", bottom: "20px", right: "20px", backgroundColor: "#4CAF50", color: "white", fontSize: "12px", padding: "6px 14px", borderRadius: "4px", fontWeight: "bold", zIndex: 9999, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
              ✓ Layout saved
            </div>
          )}

          {/* Font size */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", padding: "3px 8px" }}>
            <span style={{ fontSize: "11px", color: "#666", marginRight: "2px" }}>Text:</span>
            <button onClick={() => changeFontSize(-1)} disabled={prefs.fontSize <= FONT_SIZES[0]}
              style={{ backgroundColor: "transparent", border: "none", cursor: prefs.fontSize <= FONT_SIZES[0] ? "not-allowed" : "pointer", fontSize: "14px", padding: "0 2px", color: prefs.fontSize <= FONT_SIZES[0] ? "#ccc" : "#333", fontWeight: "bold" }}>−</button>
            <span style={{ fontSize: "12px", minWidth: "24px", textAlign: "center", fontWeight: "bold" }}>{prefs.fontSize}px</span>
            <button onClick={() => changeFontSize(1)} disabled={prefs.fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
              style={{ backgroundColor: "transparent", border: "none", cursor: prefs.fontSize >= FONT_SIZES[FONT_SIZES.length - 1] ? "not-allowed" : "pointer", fontSize: "14px", padding: "0 2px", color: prefs.fontSize >= FONT_SIZES[FONT_SIZES.length - 1] ? "#ccc" : "#333", fontWeight: "bold" }}>+</button>
          </div>

          {/* Columns menu */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowColumnsMenu((v) => !v)}
              style={{ backgroundColor: showColumnsMenu ? "#1976D2" : "#2196F3", color: "white", border: "none", borderRadius: "4px", padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontWeight: "bold" }}>
              Columns ▾ ({prefs.visibleColumns.length}/{ALL_COLUMNS.length})
            </button>

            {showColumnsMenu && (
              <>
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 998 }} onClick={() => setShowColumnsMenu(false)} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, backgroundColor: "white", border: "1px solid #ddd", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 999, minWidth: "210px", padding: "8px 0" }}>
                <div style={{ padding: "4px 14px 8px", borderBottom: "1px solid #eee", fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "bold" }}>Show / Hide · Drag to Reorder</div>
                  {/* Visible columns first (in current order), then hidden columns */}
                  {[
                    ...prefs.visibleColumns.map((k) => ALL_COLUMNS.find((c) => c.key === k)).filter(Boolean),
                    ...ALL_COLUMNS.filter((c) => !prefs.visibleColumns.includes(c.key)),
                  ].map((col) => {
                    const isVisible = prefs.visibleColumns.includes(col.key);
                    const isNew     = !col.defaultVisible;
                    const visIdx    = prefs.visibleColumns.indexOf(col.key);
                    return (
                      <div key={col.key}
                        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px 4px 14px", opacity: isVisible ? 1 : 0.5 }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                        onMouseOut={(e)  => (e.currentTarget.style.backgroundColor = "transparent")}>
                        {/* Reorder arrows — only shown for visible columns */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px", flexShrink: 0 }}>
                          <button
                            onClick={() => moveColumn(col.key, -1)}
                            disabled={!isVisible || visIdx === 0}
                            style={{ backgroundColor: "transparent", border: "none", padding: "0 2px", fontSize: "9px", cursor: (!isVisible || visIdx === 0) ? "default" : "pointer", color: (!isVisible || visIdx === 0) ? "#ddd" : "#666", lineHeight: 1 }}
                            title="Move left">▲</button>
                          <button
                            onClick={() => moveColumn(col.key, 1)}
                            disabled={!isVisible || visIdx === prefs.visibleColumns.length - 1}
                            style={{ backgroundColor: "transparent", border: "none", padding: "0 2px", fontSize: "9px", cursor: (!isVisible || visIdx === prefs.visibleColumns.length - 1) ? "default" : "pointer", color: (!isVisible || visIdx === prefs.visibleColumns.length - 1) ? "#ddd" : "#666", lineHeight: 1 }}
                            title="Move right">▼</button>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, cursor: "pointer" }}>
                          <input type="checkbox" checked={isVisible} onChange={() => toggleColumn(col.key)}
                            style={{ cursor: "pointer", accentColor: "#2196F3" }} />
                          <span style={{ fontSize: "13px", flex: 1 }}>{col.label}</span>
                          {isNew && <span style={{ fontSize: "9px", backgroundColor: "#e3f2fd", color: "#1565C0", padding: "1px 5px", borderRadius: "8px", fontWeight: "bold" }}>NEW</span>}
                        </label>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: "1px solid #eee", margin: "4px 0 0" }}>
                    <button onClick={resetPrefs}
                      style={{ width: "100%", backgroundColor: "transparent", border: "none", padding: "7px 14px", cursor: "pointer", fontSize: "12px", color: "#f44336", textAlign: "left" }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#ffebee")}
                      onMouseOut={(e)  => (e.currentTarget.style.backgroundColor = "transparent")}>
                      ↺ Reset to Default Layout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={{ marginBottom: "12px", padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "5px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", fontSize: "12px" }}>
        <span style={{ color: "#333", fontWeight: "bold" }}>Total: {statusCounts.total}</span>
        <span style={{ color: "#666",  backgroundColor: "#e0e0e0", padding: "3px 8px", borderRadius: "4px" }}>Unscheduled: {statusCounts["Not Scheduled"]}</span>
        <span style={{ color: "white", backgroundColor: "#2196F3", padding: "3px 8px", borderRadius: "4px" }}>Scheduled: {statusCounts.Scheduled}</span>
        <span style={{ color: "white", backgroundColor: "#4CAF50", padding: "3px 8px", borderRadius: "4px" }}>Shot: {statusCounts.Shot}</span>
        <span style={{ color: "black", backgroundColor: "#FFC107", padding: "3px 8px", borderRadius: "4px" }}>Pickups: {statusCounts.Pickups}</span>
        <span style={{ color: "white", backgroundColor: "#F44336", padding: "3px 8px", borderRadius: "4px" }}>Reshoots: {statusCounts.Reshoots}</span>
        <span style={{ color: "white", backgroundColor: "#9E9E9E", padding: "3px 8px", borderRadius: "4px" }}>Removed: {statusCounts.Removed}</span>
        <span style={{ color: "#aaa", fontSize: "11px", marginLeft: "auto" }}>↔ Drag column edges to resize</span>
      </div>

      {/* ── Table ── */}
      <div style={{ width: "100%", overflowX: "auto", maxWidth: "calc(100vw - 160px)" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: "5px", backgroundColor: "#4CAF50", color: "white", fontWeight: "bold", fontSize: prefs.fontSize - 1, borderBottom: "2px solid #388E3C", minWidth: `${minWidth}px`, userSelect: "none" }}>
          {visibleCols.map((col) => (
            <div key={col.key} style={{ position: "relative", padding: "7px 6px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }} title={col.label}>
              {col.label}
              {col.resizable && (
                <div
                  onMouseDown={(e) => onResizeStart(e, col.key)}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.6)")}
                  onMouseOut={(e)  => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.25)")}
                  style={{ position: "absolute", top: "10%", right: 0, width: "3px", height: "80%", cursor: "col-resize", zIndex: 1, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: "2px" }}
                  title="Drag to resize"
                />
              )}
            </div>
          ))}
        </div>

        {/* Rows */}
        {scenes.map((scene, index) => {
          const taggedData    = getSceneTaggedItems(scene.sceneNumber);
          const wardrobeStr   = getSceneWardrobe(scene.sceneNumber);
          const sceneItems    = { ...taggedData, wardrobe: wardrobeStr.split(", ").filter((s) => s.trim()) };
          const sceneCastCrew = getSceneCastCrew(scene.sceneNumber);
          const isScheduled   = !!scene.scheduledDate;

          return (
            <div key={index} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: "5px", padding: "6px", backgroundColor: getStatusColor(scene.status || "Not Scheduled", isScheduled), outline: getStatusBorder(scene.status || "Not Scheduled", isScheduled), borderBottom: "1px solid #ddd", minHeight: "28px", alignItems: "start", minWidth: `${minWidth}px` }}>
              {visibleCols.map((col) => (
                <div key={col.key} style={{ overflow: "hidden", minWidth: 0 }}>
                  {renderCell(scene, index, col.key, sceneItems, sceneCastCrew)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Location popup ── */}
      {showLocationPopup && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setShowLocationPopup(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "300px" }}>
            <h3 style={{ marginTop: 0 }}>Location Details</h3>
            <p><strong>Script Location:</strong> {showLocationPopup.location}</p>
            <p><strong>Type:</strong> {showLocationPopup.scene.metadata?.intExt}</p>
            <p><strong>Scene:</strong> {showLocationPopup.scene.sceneNumber} — {showLocationPopup.scene.heading}</p>
            <div style={{ marginTop: "15px" }}>
              <button onClick={() => { setShowLocationPopup(null); onLocationClick && onLocationClick(); }} style={{ backgroundColor: "#2196F3", color: "white", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "10px" }}>Go to Locations</button>
              <button onClick={() => setShowLocationPopup(null)} style={{ backgroundColor: "#ccc", padding: "8px 16px", border: "none", borderRadius: "4px", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* ── Script popup ── */}
      {showScriptPopup && selectedSceneForScript && (() => {
        const activeScene = scriptFullMode ? (scenes[scriptFullIndex] || selectedSceneForScript) : selectedSceneForScript;
        return (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeScriptPopup}>
            <div style={{ backgroundColor: "white", width: "90%", maxWidth: "9.28in", height: "85%", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ backgroundColor: "#2196F3", color: "white", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {scriptFullMode && <button onClick={() => setScriptFullIndex(Math.max(0, scriptFullIndex - 1))} disabled={scriptFullIndex === 0} style={{ backgroundColor: scriptFullIndex === 0 ? "#ccc" : "white", color: scriptFullIndex === 0 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === 0 ? "not-allowed" : "pointer", fontWeight: "bold" }}>← Prev</button>}
                  <h3 style={{ margin: 0, fontSize: "16px" }}>Scene {activeScene.sceneNumber}{scriptFullMode ? ` (${scriptFullIndex + 1} of ${scenes.length})` : ""} — {activeScene.heading}</h3>
                  {scriptFullMode && <button onClick={() => setScriptFullIndex(Math.min(scenes.length - 1, scriptFullIndex + 1))} disabled={scriptFullIndex === scenes.length - 1} style={{ backgroundColor: scriptFullIndex === scenes.length - 1 ? "#ccc" : "white", color: scriptFullIndex === scenes.length - 1 ? "#888" : "#2196F3", border: "none", padding: "6px 12px", borderRadius: "3px", cursor: scriptFullIndex === scenes.length - 1 ? "not-allowed" : "pointer", fontWeight: "bold" }}>Next →</button>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "12px", userSelect: "none", color: "white" }}>
                    <input type="checkbox" checked={scriptFullMode} onChange={(e) => { if (e.target.checked) { const fi = scenes.findIndex((s) => String(s.sceneNumber) === String(selectedSceneForScript.sceneNumber)); setScriptFullIndex(fi >= 0 ? fi : 0); } setScriptFullMode(e.target.checked); }} style={{ cursor: "pointer", accentColor: "white" }} />
                    Full Script
                  </label>
                  <button onClick={closeScriptPopup} style={{ backgroundColor: "transparent", border: "none", color: "white", fontSize: "24px", cursor: "pointer", padding: "0 5px" }}>×</button>
                </div>
              </div>
              <div style={{ flex: 1, padding: "1.5in", overflow: "auto", backgroundColor: getStatusColor(activeScene.status || "Not Scheduled"), boxSizing: "border-box", fontFamily: "Courier New, monospace" }}>
                <div style={getElementStyle("Scene Heading")}>{activeScene.heading}</div>
                {activeScene.content
                  ? activeScene.content.map((block, i) => <div key={i} style={getElementStyle(block.type)}>{formatBlock(block)}</div>)
                  : <div style={getElementStyle("Action")}>{activeScene.text || "Scene content not available"}</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Heading modal ── */}
      {editingHeadingScene !== null && (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} onClick={() => setEditingHeadingScene(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "white", border: "2px solid #ccc", borderRadius: "8px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 1000, minWidth: "420px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Edit Scene {scenes[editingHeadingScene]?.sceneNumber} Heading</h3>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>INT/EXT</label>
                <select value={headingForm.intExt} onChange={(e) => setHeadingForm((p) => ({ ...p, intExt: e.target.value }))} style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", fontWeight: "bold" }}>
                  <option value="INT.">INT.</option><option value="EXT.">EXT.</option><option value="I/E">I/E</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Location</label>
                <input type="text" value={headingForm.location} onChange={(e) => setHeadingForm((p) => ({ ...p, location: e.target.value.toUpperCase() }))} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }} placeholder="LOCATION NAME" autoFocus />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Time of Day</label>
                <select value={headingForm.timeOfDay} onChange={(e) => setHeadingForm((p) => ({ ...p, timeOfDay: e.target.value }))} style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", fontWeight: "bold" }}>
                  <option value="DAY">DAY</option><option value="NIGHT">NIGHT</option><option value="DAWN">DAWN</option><option value="DUSK">DUSK</option><option value="OTHER">OTHER</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "11px", color: "#666", display: "block", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Modifier</label>
                <input type="text" value={headingForm.modifier} onChange={(e) => setHeadingForm((p) => ({ ...p, modifier: e.target.value.toUpperCase() }))} style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box" }} placeholder="e.g. CONTINUOUS, LATER" />
              </div>
            </div>
            <div style={{ backgroundColor: "#f5f5f5", padding: "10px 14px", borderRadius: "4px", marginBottom: "20px", fontSize: "13px", fontWeight: "bold", fontFamily: "monospace" }}>
              {headingForm.intExt} {headingForm.location}{headingForm.timeOfDay ? ` - ${headingForm.timeOfDay}` : ""}{headingForm.modifier ? ` - ${headingForm.modifier}` : ""}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditingHeadingScene(null)} style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", backgroundColor: "white", fontSize: "13px" }}>Cancel</button>
              <button onClick={() => { if (onUpdateScene) onUpdateScene(editingHeadingScene, "heading", headingForm); setEditingHeadingScene(null); }} style={{ padding: "8px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>✓ Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StripboardModule;