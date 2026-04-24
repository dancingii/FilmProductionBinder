import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabase";
import * as database from "../../services/database";
import { uploadImage } from "../../utils/imageStorage";
import {
  uploadWardrobeImage,
  uploadGarmentImage,
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
  { name: "Cost Report", active: true },
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
    color:
      variant === "primary" || variant === "danger" || variant === "lock"
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div
      style={{
        ...styles.app,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        backgroundColor: "#ffffff",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "#2196F3",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            Production Binder
          </div>
          <div
            style={{ fontSize: "22px", fontWeight: "bold", color: "#222222" }}
          >
            Sign In
          </div>
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
          {error && (
            <div
              style={{
                color: "#e05555",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn("primary"),
              width: "100%",
              justifyContent: "center",
              padding: "14px",
              fontSize: "14px",
            }}
          >
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
          ...(memberProjects || []).map((m) => ({
            ...m.projects,
            role: m.role,
          })),
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
        <button onClick={onSignOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </div>
      <div style={styles.content}>
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            color: "#c9a96e",
            textTransform: "uppercase",
            marginBottom: "20px",
          }}
        >
          Select Project
        </div>
        {loading ? (
          <div style={styles.spinner}>Loading projects...</div>
        ) : projects.length === 0 ? (
          <div
            style={{ color: "#666", textAlign: "center", padding: "40px 0" }}
          >
            No projects found.
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              style={styles.projectCard}
              onClick={() => onSelectProject(project)}
              onTouchStart={(e) =>
                (e.currentTarget.style.borderColor = "#c9a96e")
              }
              onTouchEnd={(e) =>
                (e.currentTarget.style.borderColor = "#2a2a2a")
              }
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  marginBottom: "4px",
                }}
              >
                {project.name}
              </div>
              {project.director && (
                <div style={{ fontSize: "12px", color: "#888" }}>
                  Dir. {project.director}
                </div>
              )}
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => cameraRef.current?.click()}
        disabled={uploading}
        style={{
          ...styles.btn("default"),
          flex: 1,
          justifyContent: "center",
          fontSize: "12px",
        }}
      >
        📷 Camera
      </button>
      <button
        onClick={() => libraryRef.current?.click()}
        disabled={uploading}
        style={{
          ...styles.btn("default"),
          flex: 1,
          justifyContent: "center",
          fontSize: "12px",
        }}
      >
        🖼 Library
      </button>
    </div>
  );
}

// ─── Garment helpers ──────────────────────────────────────────────────────────
const GARMENT_CATEGORIES = [
  "shirt",
  "pants",
  "dress",
  "skirt",
  "shoes",
  "coat/sweater",
  "socks/tights",
  "underwear",
  "misc",
];
const GARMENT_CONDITIONS = ["excellent", "good", "fair", "poor"];
const CATEGORY_PREFIX = {
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
const generateGarmentId = (category, inventory) => {
  const prefix = CATEGORY_PREFIX[category] || "GM";
  const nums = inventory
    .filter((g) => g.id && g.id.startsWith(prefix))
    .map((g) => parseInt(g.id.split("_")[1]) || 0)
    .sort((a, b) => b - a);
  const next = nums.length > 0 ? nums[0] + 1 : 1;
  return `${prefix}_${String(next).padStart(3, "0")}`;
};

// ─── Inventory-only add button (header level) ─────────────────────────────────
function InventoryAddButton({ garmentInventory, selectedProject, onAdd }) {
  const [open, setOpen] = useState(false);
  if (!selectedProject) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          ...styles.btnSmall("default"),
          backgroundColor: "#2196F3",
          color: "#fff",
          fontSize: "10px",
        }}
      >
        + Inventory
      </button>
      {open && (
        <GarmentPickerModal
          garmentInventory={garmentInventory}
          assignedGarmentIds={[]}
          selectedProject={selectedProject}
          onPickExisting={() => {}}
          onCreateNew={async (garmentData) => {
            await onAdd(garmentData);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─── Garment Picker / Creator Modal ──────────────────────────────────────────
function GarmentPickerModal({
  garmentInventory,
  assignedGarmentIds = [],
  selectedProject,
  onPickExisting,
  onCreateNew,
  onClose,
}) {
  const [tab, setTab] = useState(
    garmentInventory.length > 0 ? "existing" : "new"
  );
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "misc",
    size: "",
    color: "",
    condition: "excellent",
    photos: [],
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  const unassigned = garmentInventory.filter(
    (g) => !assignedGarmentIds.includes(g.id)
  );
  const filtered = filter
    ? unassigned.filter(
        (g) =>
          g.name?.toLowerCase().includes(filter.toLowerCase()) ||
          g.category?.toLowerCase().includes(filter.toLowerCase())
      )
    : unassigned;

  const handlePhotoUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const tmpId = `new_garment_${Date.now()}`;
      const urls = [];
      for (const file of Array.from(files)) {
        const result = await uploadGarmentImage(
          file,
          selectedProject.id,
          tmpId
        );
        const url = result?.url || result;
        if (url) urls.push(url);
      }
      if (urls.length > 0)
        setForm((prev) => ({ ...prev, photos: [...prev.photos, ...urls] }));
    } catch (e) {
      console.error("Garment photo upload error:", e);
    }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const newGarment = {
      id: generateGarmentId(form.category, garmentInventory),
      name: form.name.trim(),
      category: form.category,
      size: form.size.trim(),
      color: form.color.trim(),
      condition: form.condition,
      photos: form.photos,
      createdDate: new Date().toISOString().split("T")[0],
    };
    await onCreateNew(newGarment);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 200,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#fff",
          borderRadius: "16px 16px 0 0",
          zIndex: 201,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <div
            style={{
              width: "40px",
              height: "4px",
              backgroundColor: "#ddd",
              borderRadius: "2px",
              margin: "0 auto 12px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontWeight: "bold", fontSize: "15px" }}>
              Add Garment
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "22px",
                cursor: "pointer",
                color: "#888",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[
              {
                key: "existing",
                label: `From Inventory (${unassigned.length})`,
              },
              { key: "new", label: "Create New" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: "8px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "12px",
                  backgroundColor: tab === key ? "#2196F3" : "#f0f0f0",
                  color: tab === key ? "#fff" : "#555",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 32px" }}>
          {tab === "existing" ? (
            <>
              <input
                style={{ ...styles.input, marginBottom: "10px" }}
                placeholder="Search inventory..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              {filtered.length === 0 ? (
                <div
                  style={{
                    color: "#aaa",
                    textAlign: "center",
                    padding: "30px 0",
                    fontSize: "13px",
                  }}
                >
                  {unassigned.length === 0
                    ? "All inventory garments are already in this look"
                    : "No garments match your search"}
                </div>
              ) : (
                filtered.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      onPickExisting(g.id);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px",
                      borderRadius: "8px",
                      marginBottom: "8px",
                      border: "1px solid #eee",
                      cursor: "pointer",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    {g.photos?.length > 0 ? (
                      <img
                        src={g.photos[0]}
                        alt={g.name}
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "6px",
                          backgroundColor: "#e8e8e8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "22px",
                          flexShrink: 0,
                        }}
                      >
                        👗
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "14px",
                          color: "#222",
                        }}
                      >
                        {g.name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#888",
                          marginTop: "2px",
                        }}
                      >
                        {[g.category, g.size, g.color]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <span
                      style={{
                        color: "#2196F3",
                        fontSize: "22px",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      +
                    </span>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <label style={styles.label}>Name *</label>
              <input
                style={styles.input}
                placeholder="e.g. White dress shirt"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <label style={styles.label}>Category</label>
              <select
                style={styles.select}
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
              >
                {GARMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Size</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. M, 32x30"
                    value={form.size}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, size: e.target.value }))
                    }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Color</label>
                  <input
                    style={styles.input}
                    placeholder="e.g. Navy"
                    value={form.color}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, color: e.target.value }))
                    }
                  />
                </div>
              </div>

              <label style={styles.label}>Condition</label>
              <select
                style={styles.select}
                value={form.condition}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, condition: e.target.value }))
                }
              >
                {GARMENT_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Photo</label>
              {form.photos.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {form.photos.map((url, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: "64px",
                          height: "64px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                        }}
                      />
                      <button
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            photos: prev.photos.filter((_, idx) => idx !== i),
                          }))
                        }
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          backgroundColor: "rgba(229,57,53,0.9)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: "18px",
                          height: "18px",
                          fontSize: "10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
              <input
                ref={libraryRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
              <div
                style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
              >
                <button
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading}
                  style={{
                    ...styles.btn("default"),
                    flex: 1,
                    justifyContent: "center",
                    fontSize: "12px",
                  }}
                >
                  📷 Camera
                </button>
                <button
                  onClick={() => libraryRef.current?.click()}
                  disabled={uploading}
                  style={{
                    ...styles.btn("default"),
                    flex: 1,
                    justifyContent: "center",
                    fontSize: "12px",
                  }}
                >
                  🖼 Library
                </button>
              </div>
              {uploading && (
                <div
                  style={{
                    color: "#2196F3",
                    fontSize: "12px",
                    marginBottom: "8px",
                  }}
                >
                  Uploading photo...
                </div>
              )}
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || saving || uploading}
                style={{
                  ...styles.btn("primary"),
                  width: "100%",
                  justifyContent: "center",
                  opacity: !form.name.trim() || saving || uploading ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Create Garment"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Wardrobe Item Card (maps to desktop "look" / item) ──────────────────────
function WardrobeItemCard({
  item,
  characterName,
  onUpdate,
  onDelete,
  onAddGarment,
  onRemoveGarment,
  onCreateGarment,
  selectedProject,
  garmentInventory = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const [locked, setLocked] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localData, setLocalData] = useState(item);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [showGarmentPicker, setShowGarmentPicker] = useState(false);
  const lockTimerRef = useRef(null);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setLocked(true), AUTO_LOCK_MS);
  }, []);

  const unlock = () => {
    setLocked(false);
    resetLockTimer();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setLocked(true);
    };
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
        const updated = {
          ...localData,
          photos: [...(localData.photos || []), ...uploaded],
        };
        setLocalData(updated);
        onUpdate(updated);
      }
    } catch (e) {
      console.error("Upload error:", e);
    }
    setUploading(false);
  };

  const photos = localData.photos || [];

  return (
    <div
      style={{
        ...styles.card,
        marginBottom: "8px",
        border: locked ? "1px solid #dddddd" : "1px solid #2196F3",
      }}
    >
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={lightboxImg}
            alt="wardrobe"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {/* Card Header */}
      <div style={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {photos.length > 0 && (
            <img
              src={photos[0]}
              alt="look"
              style={{
                width: "44px",
                height: "44px",
                objectFit: "cover",
                borderRadius: "4px",
                border: "1px solid #ddd",
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div style={styles.cardTitle}>
              Look {localData.number}
              {localData.description ? ` — ${localData.description}` : ""}
            </div>
            <div style={styles.cardSubtitle}>
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
              {localData.sceneRanges
                ? ` · Scenes: ${localData.sceneRanges}`
                : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              locked ? unlock() : setLocked(true);
            }}
            style={styles.lockBadge(locked)}
          >
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
                          const updated = {
                            ...localData,
                            photos: photos.filter((_, idx) => idx !== i),
                          };
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
          <ImageUploadButton
            onUpload={handleImageUpload}
            uploading={uploading}
          />
          {uploading && (
            <div
              style={{ color: "#2196F3", fontSize: "12px", marginTop: "6px" }}
            >
              Uploading...
            </div>
          )}

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

          {/* Garments */}
          {(() => {
            const assignedIds = localData.assignedGarments || [];
            const garments = assignedIds
              .map((id) => garmentInventory.find((g) => g.id === id))
              .filter(Boolean);
            return (
              <>
                <div style={styles.divider} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <label style={{ ...styles.label, marginBottom: 0 }}>
                    Garments ({garments.length})
                  </label>
                  {!locked && (
                    <button
                      onClick={() => setShowGarmentPicker(true)}
                      style={{
                        ...styles.btnSmall("default"),
                        backgroundColor: "#2196F3",
                        color: "#fff",
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>

                {garments.length === 0 ? (
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: "12px",
                      fontStyle: "italic",
                      paddingBottom: "4px",
                    }}
                  >
                    No garments assigned to this look
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {garments.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          backgroundColor: "#f9f9f9",
                          borderRadius: "6px",
                          padding: "8px",
                          border: "1px solid #eee",
                        }}
                      >
                        {g.photos?.length > 0 ? (
                          <img
                            src={g.photos[0]}
                            alt={g.name}
                            style={{
                              width: "48px",
                              height: "48px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid #ddd",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "4px",
                              backgroundColor: "#e0e0e0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "20px",
                              flexShrink: 0,
                            }}
                          >
                            👗
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "13px",
                              color: "#222",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {g.name}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#888",
                              marginTop: "2px",
                            }}
                          >
                            {[g.category, g.size, g.color]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          {g.condition && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#aaa",
                                marginTop: "1px",
                              }}
                            >
                              {g.condition}
                            </div>
                          )}
                        </div>
                        {!locked && (
                          <button
                            onClick={() => onRemoveGarment(item.id, g.id)}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              color: "#e53935",
                              fontSize: "18px",
                              cursor: "pointer",
                              flexShrink: 0,
                              padding: "4px",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {showGarmentPicker && (
            <GarmentPickerModal
              garmentInventory={garmentInventory}
              assignedGarmentIds={localData.assignedGarments || []}
              selectedProject={selectedProject}
              onPickExisting={(garmentId) => onAddGarment(item.id, garmentId)}
              onCreateNew={(garmentData) =>
                onCreateGarment(item.id, garmentData)
              }
              onClose={() => setShowGarmentPicker(false)}
            />
          )}

          {!locked && (
            <button
              onClick={() => {
                if (window.confirm("Delete this look?")) onDelete(item.id);
              }}
              style={{ ...styles.btnSmall("danger"), marginTop: "12px" }}
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
  const [garmentInventory, setGarmentInventory] = useState([]);
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
    database.loadGarmentInventoryFromDatabase(
      selectedProject,
      setGarmentInventory
    );
  }, [selectedProject?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedProject) return;
    const channel = supabase
      .channel(`wardrobe_mobile_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wardrobe_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        () => {
          database.loadWardrobeItemsFromDatabase(
            selectedProject,
            setWardrobeItems
          );
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedProject?.id]);

  const saveWardrobe = useCallback(
    async (updated) => {
      setSaving(true);
      // Brief delay to let React state settle before DB write
      await new Promise((r) => setTimeout(r, 50));
      try {
        await database.syncWardrobeItemsToDatabase(selectedProject, updated);
      } catch (e) {
        console.error(e);
      }
      setSaving(false);
    },
    [selectedProject]
  );

  // Get or create the character entry
  const getCharacterEntry = (name) =>
    wardrobeItems.find((c) => c.characterName === name);

  const getCharacterItems = (name) => {
    const entry = getCharacterEntry(name);
    return entry ? entry.items || [] : [];
  };

  const updateItem = (characterName, itemId, updatedItem) => {
    let updated;
    const existingEntry = wardrobeItems.find(
      (c) => c.characterName === characterName
    );
    if (existingEntry) {
      updated = wardrobeItems.map((c) =>
        c.characterName === characterName
          ? {
              ...c,
              items: c.items.map((i) => (i.id === itemId ? updatedItem : i)),
            }
          : c
      );
    } else {
      return;
    }
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const deleteItem = (characterName, itemId) => {
    const updated = wardrobeItems.map((c) =>
      c.characterName === characterName
        ? { ...c, items: (c.items || []).filter((i) => i.id !== itemId) }
        : c
    );
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const addLook = () => {
    if (!selectedCharacterName) return;
    const existingEntry = wardrobeItems.find(
      (c) => c.characterName === selectedCharacterName
    );
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
      updated = wardrobeItems.map((c) =>
        c.characterName === selectedCharacterName
          ? { ...c, items: [...(c.items || []), newItem] }
          : c
      );
    } else {
      updated = [
        ...wardrobeItems,
        { characterName: selectedCharacterName, items: [newItem] },
      ];
    }
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const saveGarmentInventory = useCallback(
    async (updated) => {
      try {
        await database.syncGarmentInventoryToDatabase(selectedProject, updated);
      } catch (e) {
        console.error("Garment inventory sync error:", e);
      }
    },
    [selectedProject]
  );

  const addGarmentToLook = (characterName, lookId, garmentId) => {
    const updated = wardrobeItems.map((c) =>
      c.characterName === characterName
        ? {
            ...c,
            items: c.items.map((i) => {
              if (i.id !== lookId) return i;
              const current = i.assignedGarments || [];
              if (current.includes(garmentId)) return i;
              return { ...i, assignedGarments: [...current, garmentId] };
            }),
          }
        : c
    );
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  const removeGarmentFromLook = (characterName, lookId, garmentId) => {
    const updated = wardrobeItems.map((c) =>
      c.characterName === characterName
        ? {
            ...c,
            items: c.items.map((i) =>
              i.id === lookId
                ? {
                    ...i,
                    assignedGarments: (i.assignedGarments || []).filter(
                      (id) => id !== garmentId
                    ),
                  }
                : i
            ),
          }
        : c
    );
    setWardrobeItems(updated);
    saveWardrobe(updated);
  };

  // Create new garment in inventory; optionally assign to a look
  const createGarment = async (lookId, garmentData) => {
    const updatedInventory = [...garmentInventory, garmentData];
    setGarmentInventory(updatedInventory);
    await saveGarmentInventory(updatedInventory);
    if (lookId) {
      addGarmentToLook(selectedCharacterName, lookId, garmentData.id);
    }
  };

  // Add garment to inventory only (no look assignment)
  const addToInventoryOnly = async (garmentData) => {
    const updatedInventory = [...garmentInventory, garmentData];
    setGarmentInventory(updatedInventory);
    await saveGarmentInventory(updatedInventory);
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];
  const selectedCharacter = safeCharacters.find(
    (c) => c.name === selectedCharacterName
  );
  const currentItems = getCharacterItems(selectedCharacterName);

  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.1em",
          color: "#2196F3",
          textTransform: "uppercase",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: "bold",
        }}
      >
        <span>Wardrobe</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {saving && (
            <span
              style={{ color: "#888", fontSize: "10px", fontWeight: "normal" }}
            >
              Saving...
            </span>
          )}
          <InventoryAddButton
            garmentInventory={garmentInventory}
            selectedProject={selectedProject}
            onAdd={addToInventoryOnly}
          />
        </div>
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
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      {loading ? (
        <div style={styles.spinner}>Loading wardrobe...</div>
      ) : !selectedCharacterName ? (
        <div
          style={{
            color: "#888",
            textAlign: "center",
            padding: "40px 0",
            fontSize: "14px",
          }}
        >
          Select a character to view their wardrobe
        </div>
      ) : (
        <>
          <div
            style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}
          >
            {currentItems.length} look{currentItems.length !== 1 ? "s" : ""} for{" "}
            {selectedCharacterName}
          </div>

          {currentItems.map((item) => (
            <WardrobeItemCard
              key={item.id}
              item={item}
              characterName={selectedCharacterName}
              onUpdate={(updated) =>
                updateItem(selectedCharacterName, item.id, updated)
              }
              onDelete={(itemId) => deleteItem(selectedCharacterName, itemId)}
              onAddGarment={(lookId, garmentId) =>
                addGarmentToLook(selectedCharacterName, lookId, garmentId)
              }
              onRemoveGarment={(lookId, garmentId) =>
                removeGarmentFromLook(selectedCharacterName, lookId, garmentId)
              }
              onCreateGarment={(lookId, garmentData) =>
                createGarment(lookId, garmentData)
              }
              selectedProject={selectedProject}
              garmentInventory={garmentInventory}
            />
          ))}

          <button
            onClick={addLook}
            style={{
              ...styles.btn("primary"),
              width: "100%",
              justifyContent: "center",
              marginTop: "8px",
            }}
          >
            + Add Look for {selectedCharacterName}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Mobile Cost Report Module ────────────────────────────────────────────────
function MobileCostReportModule({ selectedProject }) {
  const [costCategories, setCostCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSubCategories, setExpandedSubCategories] = useState({});
  const [addingExpense, setAddingExpense] = useState(null); // { categoryId, subId }
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    description: "",
    cost: "",
    quantity: 1,
    payment: "",
    scene: "",
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [pendingReceiptFile, setPendingReceiptFile] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    database.loadCostCategoriesFromDatabase(selectedProject, (cats) => {
      setCostCategories(cats || []);
      setLoading(false);
    });
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!selectedProject) return;
    const channel = supabase
      .channel(`cost_cat_mobile_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_categories",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        () => {
          database.loadCostCategoriesFromDatabase(
            selectedProject,
            setCostCategories
          );
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedProject?.id]);

  const saveCategories = useCallback(
    async (updated) => {
      setSaving(true);
      try {
        await database.syncCostCategoriesToDatabase(selectedProject, updated);
      } catch (e) {
        console.error(e);
      }
      setSaving(false);
    },
    [selectedProject]
  );

  const getSubTotal = (sub) =>
    (sub.expenses || []).reduce(
      (t, e) => t + (parseFloat(e.cost) || 0) * (parseFloat(e.quantity) || 1),
      0
    );

  const getCatSpent = (cat) => {
    const direct = (cat.expenses || []).reduce(
      (t, e) => t + (parseFloat(e.cost) || 0) * (parseFloat(e.quantity) || 1),
      0
    );
    const subs = (cat.subCategories || []).reduce(
      (t, s) => t + getSubTotal(s),
      0
    );
    return direct + subs;
  };

  const submitExpense = async () => {
    if (!addingExpense) return;
    if (
      !newExpense.cost ||
      !newExpense.vendor ||
      !newExpense.description ||
      !newExpense.date
    ) {
      alert(
        "Please fill in all required fields: date, vendor, description, and amount."
      );
      return;
    }

    let receiptUrl = "";
    if (pendingReceiptFile) {
      setUploadingReceipt(true);
      try {
        const result = await uploadImage(
          pendingReceiptFile,
          selectedProject.id,
          "receipts",
          addingExpense.categoryId,
          `receipt_${Date.now()}.jpg`
        );
        if (result?.url) receiptUrl = result.url;
      } catch (e) {
        console.error(e);
      }
      setUploadingReceipt(false);
    }

    const expense = {
      id: Date.now().toString(),
      ...newExpense,
      cost: parseFloat(newExpense.cost) || 0,
      quantity: parseFloat(newExpense.quantity) || 1,
      receipt: receiptUrl,
      submittedFromMobile: true,
      submittedAt: new Date().toISOString(),
    };

    const { categoryId, subId } = addingExpense;
    const updated = costCategories.map((cat) => {
      if (cat.id !== categoryId) return cat;
      if (subId) {
        return {
          ...cat,
          subCategories: (cat.subCategories || []).map((sub) =>
            sub.id === subId
              ? { ...sub, expenses: [...(sub.expenses || []), expense] }
              : sub
          ),
        };
      }
      return { ...cat, expenses: [...(cat.expenses || []), expense] };
    });

    setCostCategories(updated);
    saveCategories(updated);
    setNewExpense({
      date: new Date().toISOString().split("T")[0],
      vendor: "",
      description: "",
      cost: "",
      quantity: 1,
      payment: "",
      scene: "",
    });
    setPendingReceiptFile(null);
    setAddingExpense(null);
  };

  if (loading) return <div style={styles.spinner}>Loading cost report...</div>;

  return (
    <div>
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={lightboxUrl}
            alt="receipt"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      <div
        style={{
          fontSize: "11px",
          letterSpacing: "0.1em",
          color: "#2196F3",
          textTransform: "uppercase",
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
        }}
      >
        <span>Cost Report</span>
        {saving && (
          <span
            style={{ color: "#888", fontSize: "10px", fontWeight: "normal" }}
          >
            Saving...
          </span>
        )}
      </div>

      {/* Add Expense Form */}
      {addingExpense && (
        <div
          style={{
            ...styles.card,
            border: "2px solid #2196F3",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              ...styles.cardHeader,
              backgroundColor: "#2196F3",
              color: "white",
            }}
          >
            <div style={styles.cardTitle}>
              <span style={{ color: "white" }}>New Expense</span>
            </div>
            <button
              onClick={() => {
                setAddingExpense(null);
                setPendingReceiptFile(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <div style={styles.cardBody}>
            <label style={styles.label}>Date *</label>
            <input
              type="date"
              value={newExpense.date}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, date: e.target.value }))
              }
              style={styles.input}
            />
            <label style={styles.label}>Vendor *</label>
            <input
              type="text"
              value={newExpense.vendor}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, vendor: e.target.value }))
              }
              style={styles.input}
              placeholder="Vendor name"
            />
            <label style={styles.label}>Description *</label>
            <input
              type="text"
              value={newExpense.description}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, description: e.target.value }))
              }
              style={styles.input}
              placeholder="What was purchased"
            />
            <label style={styles.label}>Amount *</label>
            <input
              type="number"
              step="0.01"
              value={newExpense.cost}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, cost: e.target.value }))
              }
              style={styles.input}
              placeholder="0.00"
            />
            <label style={styles.label}>Qty</label>
            <input
              type="number"
              value={newExpense.quantity}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, quantity: e.target.value }))
              }
              style={styles.input}
            />
            <label style={styles.label}>Payment Method</label>
            <select
              value={newExpense.payment}
              onChange={(e) =>
                setNewExpense((p) => ({ ...p, payment: e.target.value }))
              }
              style={styles.select}
            >
              <option value="">Select...</option>
              {[
                "Cash",
                "Credit Card",
                "Debit Card",
                "Check",
                "Bank Transfer",
                "PayPal",
                "Venmo",
                "Other",
              ].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>

            <label style={styles.label}>Receipt Photo (optional)</label>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files[0]) setPendingReceiptFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files[0]) setPendingReceiptFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                onClick={() => cameraRef.current?.click()}
                style={{
                  ...styles.btn("default"),
                  flex: 1,
                  justifyContent: "center",
                  fontSize: "12px",
                }}
              >
                📷 Camera
              </button>
              <button
                onClick={() => libraryRef.current?.click()}
                style={{
                  ...styles.btn("default"),
                  flex: 1,
                  justifyContent: "center",
                  fontSize: "12px",
                }}
              >
                🖼 Library
              </button>
            </div>
            {pendingReceiptFile && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#4CAF50",
                  marginBottom: "12px",
                }}
              >
                ✓ {pendingReceiptFile.name}
                <button
                  onClick={() => setPendingReceiptFile(null)}
                  style={{
                    marginLeft: "8px",
                    background: "none",
                    border: "none",
                    color: "#f44336",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <button
              onClick={submitExpense}
              disabled={uploadingReceipt}
              style={{
                ...styles.btn("primary"),
                width: "100%",
                justifyContent: "center",
                marginTop: "4px",
              }}
            >
              {uploadingReceipt ? "Uploading receipt..." : "✓ Submit Expense"}
            </button>
          </div>
        </div>
      )}

      {/* Categories */}
      {(costCategories || []).map((cat) => {
        const spent = getCatSpent(cat);
        const remaining = (cat.budget || 0) - spent;
        const isExpanded = expandedCategories[cat.id];

        return (
          <div
            key={cat.id}
            style={{
              ...styles.card,
              border: `2px solid ${cat.color || "#2196F3"}`,
            }}
          >
            <div
              style={{
                ...styles.cardHeader,
                backgroundColor: cat.color || "#2196F3",
                cursor: "pointer",
              }}
              onClick={() =>
                setExpandedCategories((p) => ({ ...p, [cat.id]: !p[cat.id] }))
              }
            >
              <div>
                <div style={{ ...styles.cardTitle, color: "white" }}>
                  {cat.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.85)",
                    marginTop: "2px",
                  }}
                >
                  Budget: ${(cat.budget || 0).toFixed(2)} · Spent: $
                  {spent.toFixed(2)} · Remaining:{" "}
                  <span
                    style={{ color: remaining < 0 ? "#ffcdd2" : "#c8e6c9" }}
                  >
                    ${remaining.toFixed(2)}
                  </span>
                </div>
              </div>
              <span style={{ color: "white", fontSize: "12px" }}>
                {isExpanded ? "▼" : "▶"}
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: "10px" }}>
                {/* Sub-categories */}
                {(cat.subCategories || []).map((sub) => {
                  const subSpent = getSubTotal(sub);
                  const isSubExpanded = expandedSubCategories[sub.id];

                  return (
                    <div
                      key={sub.id}
                      style={{
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        marginBottom: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#f5f5f5",
                          borderLeft: `4px solid ${cat.color || "#2196F3"}`,
                          padding: "8px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setExpandedSubCategories((p) => ({
                            ...p,
                            [sub.id]: !p[sub.id],
                          }))
                        }
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "bold",
                              color: "#333",
                            }}
                          >
                            {sub.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#888" }}>
                            Spent: ${subSpent.toFixed(2)} ·{" "}
                            {(sub.expenses || []).length} items
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingExpense({
                                categoryId: cat.id,
                                subId: sub.id,
                              });
                            }}
                            style={{
                              ...styles.btn("primary"),
                              padding: "4px 10px",
                              fontSize: "11px",
                            }}
                          >
                            + Add
                          </button>
                          <span style={{ color: "#666", fontSize: "11px" }}>
                            {isSubExpanded ? "▼" : "▶"}
                          </span>
                        </div>
                      </div>

                      {isSubExpanded && (
                        <div style={{ padding: "8px" }}>
                          {(sub.expenses || []).length === 0 ? (
                            <div
                              style={{
                                color: "#999",
                                fontSize: "12px",
                                fontStyle: "italic",
                                padding: "6px",
                              }}
                            >
                              No expenses yet.
                            </div>
                          ) : (
                            (sub.expenses || []).map((exp) => (
                              <div
                                key={exp.id}
                                style={{
                                  backgroundColor: exp.editedAfterSubmit
                                    ? "#fff8e1"
                                    : exp.submittedFromMobile
                                    ? "#f1f8e9"
                                    : "#fafafa",
                                  border: "1px solid #eee",
                                  borderRadius: "4px",
                                  padding: "8px",
                                  marginBottom: "6px",
                                  fontSize: "12px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "4px",
                                  }}
                                >
                                  <span style={{ fontWeight: "bold" }}>
                                    $
                                    {(
                                      (exp.cost || 0) * (exp.quantity || 1)
                                    ).toFixed(2)}
                                  </span>
                                  <span style={{ color: "#888" }}>
                                    {exp.date}
                                  </span>
                                </div>
                                <div style={{ color: "#555" }}>
                                  {exp.vendor} — {exp.description}
                                </div>
                                {exp.receipt && (
                                  <div style={{ marginTop: "6px" }}>
                                    <img
                                      src={exp.receipt}
                                      alt="receipt"
                                      onClick={() =>
                                        setLightboxUrl(exp.receipt)
                                      }
                                      style={{
                                        width: "60px",
                                        height: "60px",
                                        objectFit: "cover",
                                        borderRadius: "4px",
                                        border: "1px solid #ddd",
                                        cursor: "pointer",
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Direct expenses on category */}
                {(cat.expenses || []).length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#888",
                        marginBottom: "6px",
                        fontWeight: "bold",
                      }}
                    >
                      Direct Expenses
                    </div>
                    {(cat.expenses || []).map((exp) => (
                      <div
                        key={exp.id}
                        style={{
                          backgroundColor: exp.editedAfterSubmit
                            ? "#fff8e1"
                            : "#fafafa",
                          border: "1px solid #eee",
                          borderRadius: "4px",
                          padding: "8px",
                          marginBottom: "6px",
                          fontSize: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <span style={{ fontWeight: "bold" }}>
                            $
                            {((exp.cost || 0) * (exp.quantity || 1)).toFixed(2)}
                          </span>
                          <span style={{ color: "#888" }}>{exp.date}</span>
                        </div>
                        <div style={{ color: "#555" }}>
                          {exp.vendor} — {exp.description}
                        </div>
                        {exp.receipt && (
                          <img
                            src={exp.receipt}
                            alt="receipt"
                            onClick={() => setLightboxUrl(exp.receipt)}
                            style={{
                              width: "60px",
                              height: "60px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid #ddd",
                              cursor: "pointer",
                              marginTop: "6px",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(cat.subCategories || []).length === 0 &&
                  (cat.expenses || []).length === 0 && (
                    <div
                      style={{
                        color: "#999",
                        fontSize: "12px",
                        fontStyle: "italic",
                        padding: "6px 0",
                      }}
                    >
                      No sub-categories or expenses.
                    </div>
                  )}

                {/* Add direct expense button for categories without sub-categories */}
                {(cat.subCategories || []).length === 0 && (
                  <button
                    onClick={() =>
                      setAddingExpense({ categoryId: cat.id, subId: null })
                    }
                    style={{
                      ...styles.btn("primary"),
                      width: "100%",
                      justifyContent: "center",
                      marginTop: "8px",
                      fontSize: "12px",
                    }}
                  >
                    + Add Expense to {cat.name}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {costCategories.length === 0 && (
        <div
          style={{
            color: "#888",
            textAlign: "center",
            padding: "40px 0",
            fontSize: "14px",
          }}
        >
          No cost categories yet. Add them from the desktop app.
        </div>
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
          setCharacters(data.map((row) => row.character_data || row));
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

  if (authLoading)
    return <div style={{ ...styles.app, ...styles.spinner }}>Loading...</div>;
  if (!session) return <MobileLogin onLogin={() => {}} />;
  if (!selectedProject)
    return (
      <MobileProjectSelector
        user={session.user}
        onSelectProject={setSelectedProject}
        onSignOut={handleSignOut}
      />
    );

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>{selectedProject.name}</div>
          <div style={styles.headerProject}>Production Binder Mobile</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setSelectedProject(null)}
            style={styles.signOutBtn}
          >
            Projects
          </button>
          <button onClick={handleSignOut} style={styles.signOutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Module Navigation */}
      <div
        style={{
          padding: "14px 14px",
          backgroundColor: "#fff9e6",
          borderBottom: "1px solid #e0c97f",
        }}
      >
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
        {activeModule === "Cost Report" && (
          <MobileCostReportModule selectedProject={selectedProject} />
        )}
        {MODULES.find((m) => m.name === activeModule && !m.active) && (
          <div
            style={{ color: "#444", textAlign: "center", padding: "60px 20px" }}
          >
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔒</div>
            <div style={{ fontSize: "14px", letterSpacing: "0.05em" }}>
              {activeModule} is not yet available on mobile.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
