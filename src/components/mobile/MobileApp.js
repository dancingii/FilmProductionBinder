import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabase";
import * as database from "../../services/database";
import {
  uploadWardrobeImage,
} from "../../utils/imageStorage";

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULES = [
  { name: "Wardrobe", active: true },
  { name: "Script", active: false },
  { name: "Stripboard", active: false },
  { name: "Shot List", active: false },
  { name: "Call Sheet", active: false },
  { name: "Cast & Crew", active: false },
  { name: "Characters", active: false },
  { name: "Locations", active: false },
  { name: "Props", active: false },
  { name: "Makeup", active: false },
  { name: "Budget", active: false },
  { name: "Cost Report", active: false },
  { name: "Timeline", active: false },
  { name: "Calendar", active: false },
  { name: "Day Out of Days", active: false },
  { name: "Production Design", active: false },
  { name: "Reports", active: false },
  { name: "Dashboard", active: false },
];

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    app: {
      minHeight: "100vh",
      backgroundColor: "#ffffff",
      color: "#222222",
      fontFamily: "Arial, sans-serif",
      maxWidth: "100vw",
      overflowX: "hidden",
    },
    header: {
      backgroundColor: "#2196F3",
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    headerTitle: {
      fontSize: "14px",
      fontWeight: "bold",
      letterSpacing: "0.05em",
      color: "#ffffff",
    },
    headerProject: {
      fontSize: "11px",
      color: "rgba(255,255,255,0.75)",
      marginTop: "2px",
    },
    signOutBtn: {
      background: "none",
      border: "1px solid rgba(255,255,255,0.5)",
      color: "#ffffff",
      padding: "6px 12px",
      borderRadius: "4px",
      fontSize: "11px",
      cursor: "pointer",
    },
    content: {
        padding: "10px 14px",
        paddingBottom: "30px",
        backgroundColor: "#ffffff",
      },
    moduleSelect: {
      width: "100%",
      backgroundColor: "#fff9e6",
      border: "1px solid #e0c97f",
      color: "#222222",
      padding: "8px 12px",
      borderRadius: "6px",
      fontSize: "14px",
      marginBottom: "10px",
      appearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 12px center",
      paddingRight: "36px",
      fontWeight: "bold",
    },
    card: {
      backgroundColor: "#ffffff",
      border: "1px solid #dddddd",
      borderRadius: "6px",
      marginBottom: "10px",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
    cardHeader: {
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      backgroundColor: "#fff9e6",
      borderBottom: "1px solid #eeeeee",
    },
    cardTitle: {
      fontSize: "14px",
      fontWeight: "bold",
      color: "#222222",
    },
    cardSubtitle: {
      fontSize: "11px",
      color: "#888888",
      marginTop: "2px",
    },
    chevron: (open) => ({
      color: "#888888",
      fontSize: "12px",
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s",
    }),
    cardBody: {
      padding: "14px 16px",
      backgroundColor: "#ffffff",
    },
    label: {
      fontSize: "11px",
      color: "#666666",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: "5px",
      display: "block",
      fontWeight: "bold",
    },
    input: {
      width: "100%",
      backgroundColor: "#ffffff",
      border: "1px solid #cccccc",
      borderRadius: "4px",
      color: "#222222",
      padding: "10px 12px",
      fontSize: "14px",
      marginBottom: "12px",
      boxSizing: "border-box",
      fontFamily: "Arial, sans-serif",
    },
    textarea: {
      width: "100%",
      backgroundColor: "#ffffff",
      border: "1px solid #cccccc",
      borderRadius: "4px",
      color: "#222222",
      padding: "10px 12px",
      fontSize: "14px",
      marginBottom: "12px",
      boxSizing: "border-box",
      fontFamily: "Arial, sans-serif",
      minHeight: "80px",
      resize: "vertical",
    },
    select: {
      width: "100%",
      backgroundColor: "#ffffff",
      border: "1px solid #cccccc",
      borderRadius: "4px",
      color: "#222222",
      padding: "10px 12px",
      fontSize: "14px",
      marginBottom: "12px",
      boxSizing: "border-box",
    },
    btn: (variant = "primary") => ({
      backgroundColor:
        variant === "primary"
          ? "#4CAF50"
          : variant === "danger"
          ? "#e53935"
          : variant === "lock"
          ? "#2196F3"
          : "#f0e6cc",
      color: variant === "primary" || variant === "danger" || variant === "lock"
        ? "#ffffff"
        : "#222222",
      border: "none",
      borderRadius: "6px",
      padding: "10px 16px",
      fontSize: "13px",
      fontWeight: "bold",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    }),
    btnSmall: (variant = "default") => ({
      backgroundColor: variant === "danger" ? "#e53935" : "#f0e6cc",
      color: variant === "danger" ? "#ffffff" : "#222222",
      border: "none",
      borderRadius: "4px",
      padding: "6px 10px",
      fontSize: "11px",
      cursor: "pointer",
      fontWeight: "bold",
    }),
    lockBadge: (locked) => ({
      backgroundColor: locked ? "#e53935" : "#2196F3",
      color: "#ffffff",
      fontSize: "10px",
      padding: "4px 8px",
      borderRadius: "3px",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      cursor: "pointer",
      border: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontWeight: "bold",
    }),
    imageGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "6px",
      marginTop: "10px",
    },
    imageThumbnail: {
      width: "100%",
      aspectRatio: "1",
      objectFit: "cover",
      borderRadius: "4px",
      border: "1px solid #dddddd",
    },
    uploadArea: {
      border: "2px dashed #cccccc",
      borderRadius: "8px",
      padding: "20px",
      textAlign: "center",
      marginTop: "10px",
      cursor: "pointer",
      color: "#888888",
      fontSize: "13px",
    },
    tag: {
      display: "inline-block",
      backgroundColor: "#fff9e6",
      color: "#666666",
      fontSize: "10px",
      padding: "3px 8px",
      borderRadius: "3px",
      marginRight: "4px",
      marginBottom: "4px",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      border: "1px solid #e0c97f",
    },
    divider: {
      height: "1px",
      backgroundColor: "#eeeeee",
      margin: "12px 0",
    },
    projectCard: {
      backgroundColor: "#fff9e6",
      border: "1px solid #e0c97f",
      borderRadius: "6px",
      padding: "16px",
      marginBottom: "10px",
      cursor: "pointer",
    },
    spinner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      color: "#888888",
      fontSize: "14px",
    },
  };

// ─── Login Screen ─────────────────────────────────────────────────────────────
function MobileLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ ...styles.app, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", backgroundColor: "#ffffff" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#2196F3", textTransform: "uppercase", marginBottom: "8px", fontWeight: "bold" }}>Production Binder</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#222222" }}>Sign In</div>
        </div>

        <form onSubmit={handleLogin}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="your@email.com"
            autoComplete="email"
          />
          <label style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {error && <div style={{ color: "#e05555", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...styles.btn("primary"), width: "100%", justifyContent: "center", padding: "14px", fontSize: "14px" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Project Selector ─────────────────────────────────────────────────────────
function MobileProjectSelector({ user, onSelectProject, onSignOut }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
        try {
          // Get projects user owns
          const { data: ownedProjects } = await supabase
            .from("projects")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
  
          // Get projects user is a member of
          const { data: memberProjects } = await supabase
            .from("project_members")
            .select("project_id, role, projects(*)")
            .eq("user_id", user.id);
  
          const allProjects = [
            ...(ownedProjects || []).map((p) => ({ ...p, role: "owner" })),
            ...(memberProjects || []).map((m) => ({ ...m.projects, role: m.role })),
          ];
  
          // Remove duplicates by project ID
          const unique = allProjects.reduce((acc, project) => {
            if (!acc.find((p) => p.id === project.id)) acc.push(project);
            return acc;
          }, []);
  
          setProjects(unique);
        } catch (e) {
          console.error(e);
        }
        setLoading(false);
      };
    loadProjects();
  }, [user.id]);

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>Production Binder</div>
          <div style={styles.headerProject}>{user.email}</div>
        </div>
        <button onClick={onSignOut} style={styles.signOutBtn}>Sign Out</button>
      </div>
      <div style={styles.content}>
        <div style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#c9a96e", textTransform: "uppercase", marginBottom: "20px" }}>Select Project</div>
        {loading ? (
          <div style={styles.spinner}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <div style={{ color: "#666", textAlign: "center", padding: "40px 0" }}>No projects found.</div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              style={styles.projectCard}
              onClick={() => onSelectProject(project)}
              onTouchStart={(e) => (e.currentTarget.style.borderColor = "#c9a96e")}
              onTouchEnd={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}>{project.name}</div>
              {project.director && <div style={{ fontSize: "12px", color: "#888" }}>Dir. {project.director}</div>}
              <div style={{ marginTop: "8px" }}>
                <span style={styles.tag}>{project.role}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Image Upload Button ──────────────────────────────────────────────────────
function ImageUploadButton({ onUpload, uploading }) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    onUpload(Array.from(files));
  };

  return (
    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
      <input ref={libraryRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
      <button onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ ...styles.btn("default"), flex: 1, justifyContent: "center", fontSize: "12px" }}>
        📷 Camera
      </button>
      <button onClick={() => libraryRef.current?.click()} disabled={uploading} style={{ ...styles.btn("default"), flex: 1, justifyContent: "center", fontSize: "12px" }}>
        🖼 Library
      </button>
    </div>
  );
}

// ─── Wardrobe Item Card (maps to desktop "look" / item) ──────────────────────
function WardrobeItemCard({ item, characterName, onUpdate, onDelete, selectedProject }) {
  const [expanded, setExpanded] = useState(false);
  const [locked, setLocked] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localData, setLocalData] = useState(item);
  const [lightboxImg, setLightboxImg] = useState(null);
  const lockTimerRef = useRef(null);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setLocked(true), AUTO_LOCK_MS);
  }, []);

  const unlock = () => { setLocked(false); resetLockTimer(); };

  useEffect(() => {
    const handleVisibilityChange = () => { if (document.hidden) setLocked(true); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  const handleChange = (field, value) => {
    resetLockTimer();
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    onUpdate(updated);
  };

  const handleImageUpload = async (files) => {
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const result = await uploadWardrobeImage(
          file,
          selectedProject.id,
          item.id,
          `wardrobe_${Date.now()}.jpg`
        );
        if (result && result.url) uploaded.push(result.url);
      }
      if (uploaded.length > 0) {
        const updated = { ...localData, photos: [...(localData.photos || []), ...uploaded] };
        setLocalData(updated);
        onUpdate(updated);
      }
    } catch (e) { console.error("Upload error:", e); }
    setUploading(false);
  };

  const photos = localData.photos || [];

  return (
    <div style={{ ...styles.card, marginBottom: "8px", border: locked ? "1px solid #dddddd" : "1px solid #2196F3" }}>
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.95)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={lightboxImg} alt="wardrobe" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }} />
        </div>
      )}

      {/* Card Header */}
      <div style={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {photos.length > 0 && (
            <img src={photos[0]} alt="look" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ddd", flexShrink: 0 }} />
          )}
          <div>
            <div style={styles.cardTitle}>
              Look {localData.number}{localData.description ? ` — ${localData.description}` : ""}
            </div>
            <div style={styles.cardSubtitle}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
              {localData.sceneRanges ? ` · Scenes: ${localData.sceneRanges}` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={(e) => { e.stopPropagation(); locked ? unlock() : setLocked(true); }} style={styles.lockBadge(locked)}>
            {locked ? "🔒" : "🔓"}
          </button>
          <span style={styles.chevron(expanded)}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.cardBody}>
          {/* Photos */}
          {photos.length > 0 && (
            <div style={styles.imageGrid}>
              {photos.map((img, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={img}
                    alt={`look-${i}`}
                    style={styles.imageThumbnail}
                    onClick={() => setLightboxImg(img)}
                  />
                  {!locked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this photo?")) {
                          const updated = { ...localData, photos: photos.filter((_, idx) => idx !== i) };
                          setLocalData(updated);
                          onUpdate(updated);
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: "3px",
                        right: "3px",
                        backgroundColor: "rgba(229,57,53,0.9)",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "22px",
                        height: "22px",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <ImageUploadButton onUpload={handleImageUpload} uploading={uploading} />
          {uploading && <div style={{ color: "#2196F3", fontSize: "12px", marginTop: "6px" }}>Uploading...</div>}

          <div style={styles.divider} />

          <label style={styles.label}>Description</label>
          <input
            style={{ ...styles.input, opacity: locked ? 0.5 : 1 }}
            value={localData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={locked}
            onClick={locked ? unlock : undefined}
            placeholder="Look description"
          />

          <label style={styles.label}>Scene Ranges</label>
          <input
            style={{ ...styles.input, opacity: locked ? 0.5 : 1 }}
            value={localData.sceneRanges || ""}
            onChange={(e) => handleChange("sceneRanges", e.target.value)}
            disabled={locked}
            onClick={locked ? unlock : undefined}
            placeholder="e.g. 1-5, 10, 15-20"
          />

          {!locked && (
            <button
              onClick={() => { if (window.confirm("Delete this look?")) onDelete(item.id); }}
              style={{ ...styles.btnSmall("danger"), marginTop: "4px" }}
            >
              Delete Look
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Wardrobe Module ───────────────────────────────────────────────────
function MobileWardrobeModule({ selectedProject, characters }) {
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [saving, setSaving] = useState(false);

  // Load wardrobe data
  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    database.loadWardrobeItemsFromDatabase(selectedProject, (items) => {
      setWardrobeItems(items || []);
      setLoading(false);
    });
  }, [selectedProject?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedProject) return;
    const channel = supabase
      .channel(`wardrobe_mobile_${selectedProject.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wardrobe_items", filter: `project_id=eq.${selectedProject.id}` }, () => {
        database.loadWardrobeItemsFromDatabase(selectedProject, setWardrobeItems);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedProject?.id]);

  const saveWardrobe = useCallback(async (updated) => {
    setSaving(true);
    // Brief delay to let React state settle before DB write
    await new Promise(r => setTimeout(r, 50));
    try {
      await database.syncWardrobeItemsToDatabase(selectedProject, updated);
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [selectedProject]);

  // Get or create the character entry
  const getCharacterEntry = (name) => wardrobeItems.find(c => c.characterName === name);

  const getCharacterItems = (name) => {
    const entry = getCharacterEntry(name);
    return entry ? entry.items || [] : [];
  };

  const updateItem = (characterName, itemId, updatedItem) => {
    let updated;
    const existingEntry = wardrobeItems.find(c => c.characterName === characterName);
    if (existingEntry) {
      updated = wardrobeItems.map(c =>
        c.characterName === characterName
          ? { ...c, items: c.items.map(i => i.id === itemId ? updatedItem : i) }
          : c
      );
    } else {
      return;
    }
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const deleteItem = (characterName, itemId) => {
    const updated = wardrobeItems.map(c =>
      c.characterName === characterName
        ? { ...c, items: (c.items || []).filter(i => i.id !== itemId) }
        : c
    );
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const addLook = () => {
    if (!selectedCharacterName) return;
    const existingEntry = wardrobeItems.find(c => c.characterName === selectedCharacterName);
    const existingItems = existingEntry ? existingEntry.items || [] : [];
    const newItem = {
      id: `${selectedCharacterName}_mobile_${Date.now()}`,
      number: existingItems.length + 1,
      description: "",
      sceneRanges: "",
      scenes: [],
      assignedGarments: [],
      photos: [],
    };

    let updated;
    if (existingEntry) {
      updated = wardrobeItems.map(c =>
        c.characterName === selectedCharacterName
          ? { ...c, items: [...(c.items || []), newItem] }
          : c
      );
    } else {
      updated = [...wardrobeItems, { characterName: selectedCharacterName, items: [newItem] }];
    }
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];
  const selectedCharacter = safeCharacters.find(c => c.name === selectedCharacterName);
  const currentItems = getCharacterItems(selectedCharacterName);

  return (
    <div>
      <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#2196F3", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: "bold" }}>
        <span>Wardrobe</span>
        {saving && <span style={{ color: "#888", fontSize: "10px", fontWeight: "normal" }}>Saving...</span>}
      </div>

      {/* Character selector */}
      <label style={styles.label}>Character</label>
      <select
        style={styles.select}
        value={selectedCharacterName}
        onChange={(e) => setSelectedCharacterName(e.target.value)}
      >
        <option value="">Select a character...</option>
        {safeCharacters.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      {loading ? (
        <div style={styles.spinner}>Loading wardrobe...</div>
      ) : !selectedCharacterName ? (
        <div style={{ color: "#888", textAlign: "center", padding: "40px 0", fontSize: "14px" }}>
          Select a character to view their wardrobe
        </div>
      ) : (
        <>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
            {currentItems.length} look{currentItems.length !== 1 ? "s" : ""} for {selectedCharacterName}
          </div>

          {currentItems.map((item) => (
            <WardrobeItemCard
              key={item.id}
              item={item}
              characterName={selectedCharacterName}
              onUpdate={(updated) => updateItem(selectedCharacterName, item.id, updated)}
              onDelete={(itemId) => deleteItem(selectedCharacterName, itemId)}
              selectedProject={selectedProject}
            />
          ))}

          <button
            onClick={addLook}
            style={{ ...styles.btn("primary"), width: "100%", justifyContent: "center", marginTop: "8px" }}
          >
            + Add Look for {selectedCharacterName}
          </button>
        </>
      )}
    </div>
  );
}


// ─── Main Mobile App ──────────────────────────────────────────────────────────
export default function MobileApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeModule, setActiveModule] = useState("Wardrobe");
  const [characters, setCharacters] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load characters when project selected
  useEffect(() => {
    if (!selectedProject) return;
    const loadChars = async () => {
      try {
        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .eq("project_id", selectedProject.id);
        if (!error && data) {
          setCharacters(data.map(row => row.character_data || row));
        }
      } catch (e) {
        console.error("Error loading characters:", e);
      }
    };
    loadChars();
  }, [selectedProject?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSelectedProject(null);
    setSession(null);
  };

  if (authLoading) return <div style={{ ...styles.app, ...styles.spinner }}>Loading...</div>;
  if (!session) return <MobileLogin onLogin={() => {}} />;
  if (!selectedProject) return <MobileProjectSelector user={session.user} onSelectProject={setSelectedProject} onSignOut={handleSignOut} />;

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>{selectedProject.name}</div>
          <div style={styles.headerProject}>Production Binder Mobile</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setSelectedProject(null)} style={styles.signOutBtn}>Projects</button>
          <button onClick={handleSignOut} style={styles.signOutBtn}>Sign Out</button>
        </div>
      </div>

      {/* Module Navigation */}
      <div style={{ padding: "14px 14px", backgroundColor: "#fff9e6", borderBottom: "1px solid #e0c97f" }}>
        <select
          style={{ ...styles.moduleSelect, marginBottom: 0 }}
          value={activeModule}
          onChange={(e) => {
            const mod = MODULES.find((m) => m.name === e.target.value);
            if (mod?.active) setActiveModule(e.target.value);
          }}
        >
          {MODULES.map((mod) => (
            <option
              key={mod.name}
              value={mod.name}
              disabled={!mod.active}
              style={{ color: mod.active ? "#f0ede8" : "#444" }}
            >
              {mod.active ? mod.name : `${mod.name} — coming soon`}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeModule === "Wardrobe" && (
          <MobileWardrobeModule
            selectedProject={selectedProject}
            characters={characters}
          />
        )}
        {MODULES.find((m) => m.name === activeModule && !m.active) && (
          <div style={{ color: "#444", textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔒</div>
            <div style={{ fontSize: "14px", letterSpacing: "0.05em" }}>{activeModule} is not yet available on mobile.</div>
          </div>
        )}
      </div>
    </div>
  );
}