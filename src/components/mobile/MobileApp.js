import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabase";
import * as database from "../../services/database";
import { uploadImage } from "../../utils/imageStorage";
import {
  uploadWardrobeImage,
  uploadGarmentImage,
  uploadPropImage,
  deleteMultipleImages,
} from "../../utils/imageStorage";

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULES = [
  { name: "Dashboard", active: true },
  { name: "Wardrobe", active: true },
  { name: "Script", active: false },
  { name: "Stripboard", active: false },
  { name: "Shot List", active: false },
  { name: "Call Sheet", active: true },
  { name: "Cast & Crew", active: false },
  { name: "Characters", active: false },
  { name: "Locations", active: false },
  { name: "Props", active: true },
  { name: "Makeup", active: false },
  { name: "Budget", active: false },
  { name: "Cost Report", active: true },
  { name: "Timeline", active: false },
  { name: "Calendar", active: false },
  { name: "Day Out of Days", active: false },
  { name: "Production Design", active: false },
  { name: "Reports", active: false },
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
  characterScenes = [],
  scriptScenes = [],
  onToggleScene,
}) {
  const [expanded, setExpanded] = useState(false);
  const [locked, setLocked] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localData, setLocalData] = useState(item);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [showGarmentPicker, setShowGarmentPicker] = useState(false);
  const [scenesExpanded, setScenesExpanded] = useState(false);
  const [showScriptViewer, setShowScriptViewer] = useState(false);
  const [scriptViewerIndex, setScriptViewerIndex] = useState(0);
  const [scriptFullMode, setScriptFullMode] = useState(false);
  const [scriptFullIndex, setScriptFullIndex] = useState(0);
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
              {(localData.scenes || []).length > 0
                ? ` · ${(localData.scenes || []).length} scene${
                    (localData.scenes || []).length !== 1 ? "s" : ""
                  }`
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

          {/* Scene Assignment */}
          <div style={styles.divider} />

          {/* Accordion header */}
          <div
            onClick={() => setScenesExpanded((v) => !v)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              padding: "4px 0",
              marginBottom: "6px",
            }}
          >
            <label
              style={{ ...styles.label, marginBottom: 0, cursor: "pointer" }}
            >
              🎬 Scenes ({(localData.scenes || []).length} assigned)
            </label>
            <span style={{ fontSize: "12px", color: "#888" }}>
              {scenesExpanded ? "▲" : "▼"}
            </span>
          </div>

          {/* Assigned badges — always visible */}
          {(localData.scenes || []).length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "3px",
                marginBottom: "8px",
              }}
            >
              {[...(localData.scenes || [])]
                .map(Number)
                .filter((n) => !isNaN(n))
                .sort((a, b) => a - b)
                .map((n) => (
                  <span
                    key={n}
                    style={{
                      backgroundColor: "#c8e6c9",
                      border: "1px solid #a5d6a7",
                      borderRadius: "3px",
                      padding: "1px 6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#1b5e20",
                    }}
                  >
                    {n}
                  </span>
                ))}
            </div>
          )}

          {/* Expanded: scene toggles + View Script button */}
          {scenesExpanded && (
            <div
              style={{
                backgroundColor: "#f9f9f9",
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                padding: "10px",
                marginBottom: "8px",
              }}
            >
              {characterScenes.length === 0 ? (
                <div
                  style={{
                    color: "#aaa",
                    fontSize: "12px",
                    fontStyle: "italic",
                  }}
                >
                  No scenes found for {characterName}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginBottom: "10px",
                    }}
                  >
                    {characterScenes.map((sceneNum) => {
                      const isAssigned = (localData.scenes || [])
                        .map(Number)
                        .includes(sceneNum);
                      return (
                        <button
                          key={sceneNum}
                          onClick={() => {
                            if (onToggleScene)
                              onToggleScene(localData.id, sceneNum);
                            const cur = (localData.scenes || []).map(Number);
                            const buildR = (arr) => {
                              if (!arr.length) return "";
                              const s = [...arr].sort((a, b) => a - b);
                              const r = [];
                              let st = s[0],
                                en = s[0];
                              for (let i = 1; i <= s.length; i++) {
                                if (s[i] === en + 1) {
                                  en = s[i];
                                } else {
                                  r.push(st === en ? `${st}` : `${st}-${en}`);
                                  st = en = s[i];
                                }
                              }
                              return r.join(", ");
                            };
                            const ns = cur.includes(sceneNum)
                              ? cur.filter((x) => x !== sceneNum)
                              : [...cur, sceneNum].sort((a, b) => a - b);
                            const updated = {
                              ...localData,
                              scenes: ns,
                              sceneRanges: buildR(ns),
                            };
                            setLocalData(updated);
                            onUpdate(updated);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "4px",
                            border: isAssigned
                              ? "1px solid #388E3C"
                              : "1px solid #bdbdbd",
                            backgroundColor: isAssigned ? "#4CAF50" : "#f5f5f5",
                            color: isAssigned ? "white" : "#444",
                            fontWeight: isAssigned ? "bold" : "normal",
                            cursor: "pointer",
                            fontSize: "14px",
                            minWidth: "40px",
                          }}
                        >
                          {sceneNum}
                        </button>
                      );
                    })}
                  </div>

                  {characterScenes.length > 0 && (
                    <button
                      onClick={() => {
                        setScriptViewerIndex(0);
                        setShowScriptViewer(true);
                      }}
                      style={{
                        ...styles.btn("default"),
                        fontSize: "12px",
                        justifyContent: "center",
                        width: "100%",
                      }}
                    >
                      📄 View Script ({characterScenes.length} scene
                      {characterScenes.length !== 1 ? "s" : ""})
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Mobile Script Viewer — all character scenes with assigned indicator */}
          {showScriptViewer &&
            (() => {
              const allSceneData = characterScenes
                .map((n) =>
                  scriptScenes.find((s) => parseInt(s.sceneNumber) === n)
                )
                .filter(Boolean);
              if (allSceneData.length === 0) return null;
              const assignedNums = (localData.scenes || []).map(Number);
              const filteredIdx = Math.min(
                scriptViewerIndex,
                allSceneData.length - 1
              );
              const activeIdx = scriptFullMode
                ? Math.min(scriptFullIndex, scriptScenes.length - 1)
                : filteredIdx;
              const sd = scriptFullMode
                ? scriptScenes[activeIdx] || allSceneData[filteredIdx]
                : allSceneData[filteredIdx];
              const isAssigned = assignedNums.includes(
                parseInt(sd.sceneNumber)
              );
              return (
                <>
                  <div
                    onClick={() => {
                      setShowScriptViewer(false);
                      setScriptFullMode(false);
                    }}
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      zIndex: 300,
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
                      zIndex: 301,
                      height: "88vh",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        borderRadius: "16px 16px 0 0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() =>
                          scriptFullMode
                            ? setScriptFullIndex(Math.max(0, activeIdx - 1))
                            : setScriptViewerIndex(Math.max(0, filteredIdx - 1))
                        }
                        disabled={
                          scriptFullMode ? activeIdx === 0 : filteredIdx === 0
                        }
                        style={{
                          backgroundColor: (
                            scriptFullMode ? activeIdx === 0 : filteredIdx === 0
                          )
                            ? "rgba(255,255,255,0.3)"
                            : "white",
                          color: (
                            scriptFullMode ? activeIdx === 0 : filteredIdx === 0
                          )
                            ? "rgba(255,255,255,0.6)"
                            : "#4CAF50",
                          border: "none",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          cursor: (
                            scriptFullMode ? activeIdx === 0 : filteredIdx === 0
                          )
                            ? "not-allowed"
                            : "pointer",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        ← Prev
                      </button>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                          Scene {sd.sceneNumber} (
                          {scriptFullMode
                            ? `${activeIdx + 1}/${scriptScenes.length}`
                            : `${filteredIdx + 1}/${allSceneData.length}`}
                          )
                        </div>
                        <div
                          style={{
                            fontSize: "9px",
                            fontWeight: "bold",
                            padding: "1px 6px",
                            borderRadius: "8px",
                            backgroundColor: isAssigned
                              ? "rgba(255,255,255,0.3)"
                              : "rgba(0,0,0,0.2)",
                            color: "white",
                          }}
                        >
                          {isAssigned ? "✓ In this look" : "○ Not in this look"}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            scriptFullMode
                              ? setScriptFullIndex(
                                  Math.min(
                                    scriptScenes.length - 1,
                                    activeIdx + 1
                                  )
                                )
                              : setScriptViewerIndex(
                                  Math.min(
                                    allSceneData.length - 1,
                                    filteredIdx + 1
                                  )
                                )
                          }
                          disabled={
                            scriptFullMode
                              ? activeIdx === scriptScenes.length - 1
                              : filteredIdx === allSceneData.length - 1
                          }
                          style={{
                            backgroundColor: (
                              scriptFullMode
                                ? activeIdx === scriptScenes.length - 1
                                : filteredIdx === allSceneData.length - 1
                            )
                              ? "rgba(255,255,255,0.3)"
                              : "white",
                            color: (
                              scriptFullMode
                                ? activeIdx === scriptScenes.length - 1
                                : filteredIdx === allSceneData.length - 1
                            )
                              ? "rgba(255,255,255,0.6)"
                              : "#4CAF50",
                            border: "none",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            cursor: (
                              scriptFullMode
                                ? activeIdx === scriptScenes.length - 1
                                : filteredIdx === allSceneData.length - 1
                            )
                              ? "not-allowed"
                              : "pointer",
                            fontWeight: "bold",
                            fontSize: "12px",
                          }}
                        >
                          Next →
                        </button>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            cursor: "pointer",
                            fontSize: "10px",
                            userSelect: "none",
                            color: "white",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={scriptFullMode}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const fi = scriptScenes.findIndex(
                                  (s) =>
                                    String(s.sceneNumber) ===
                                    String(sd.sceneNumber)
                                );
                                setScriptFullIndex(fi >= 0 ? fi : 0);
                              } else {
                                const curNum =
                                  scriptScenes[activeIdx]?.sceneNumber;
                                const fi = allSceneData.findIndex(
                                  (s) =>
                                    String(s.sceneNumber) === String(curNum)
                                );
                                setScriptViewerIndex(fi >= 0 ? fi : 0);
                              }
                              setScriptFullMode(e.target.checked);
                            }}
                            style={{ cursor: "pointer", accentColor: "white" }}
                          />
                          Full
                        </label>
                        <button
                          onClick={() => {
                            setShowScriptViewer(false);
                            setScriptFullMode(false);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "22px",
                            cursor: "pointer",
                            lineHeight: 1,
                            padding: "0 4px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#f5f5f5",
                        borderBottom: "1px solid #ddd",
                        flexShrink: 0,
                        fontFamily: "Courier New, monospace",
                        fontSize: "10pt",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}
                    >
                      {sd.heading}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "16px",
                        fontFamily: "Courier New, monospace",
                        fontSize: "12px",
                        lineHeight: "1.6",
                      }}
                    >
                      {(sd.content || []).map((block, i) => (
                        <div key={i} style={{ marginBottom: "8px" }}>
                          {block.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

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
const SIZING_FIELDS = [
  { key: "pants", label: "Pants" },
  { key: "shirt", label: "Shirt" },
  { key: "dress", label: "Dress" },
  { key: "shoe", label: "Shoe" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
];

function MobileWardrobeModule({
  selectedProject,
  characters,
  castCrew = [],
  setCastCrew,
}) {
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [garmentInventory, setGarmentInventory] = useState([]);
  const [scriptScenes, setScriptScenes] = useState([]);
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
    database.loadScenesFromDatabase(
      selectedProject,
      setScriptScenes,
      () => {},
      null
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

  const safeCharacters = Array.isArray(characters)
    ? characters
    : Object.values(characters || {});
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
          {/* Sizing Row */}
          {(() => {
            const actor = castCrew.find(
              (p) => p.type === "cast" && p.character === selectedCharacterName
            );
            const sizing = actor?.wardrobe || {};
            return (
              <div
                style={{
                  backgroundColor: "#f0f4ff",
                  border: "1px solid #c5d0e8",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  marginBottom: "10px",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#3a4a7a",
                    marginBottom: "6px",
                  }}
                >
                  👔 {selectedCharacterName} sizing
                </div>
                {!actor ? (
                  <div
                    style={{
                      color: "#aaa",
                      fontStyle: "italic",
                      fontSize: "11px",
                    }}
                  >
                    No cast member assigned — add in Cast &amp; Crew to edit
                    sizing
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {SIZING_FIELDS.map(({ key, label }) => (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          minWidth: "60px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#888",
                            marginBottom: "1px",
                          }}
                        >
                          {label}
                        </span>
                        <input
                          value={sizing[key] || ""}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            const updated = castCrew.map((p) =>
                              p.id === actor.id
                                ? {
                                    ...p,
                                    wardrobe: { ...p.wardrobe, [key]: newVal },
                                  }
                                : p
                            );
                            setCastCrew(updated);
                          }}
                          onBlur={(e) => {
                            const updated = castCrew.map((p) =>
                              p.id === actor.id
                                ? {
                                    ...p,
                                    wardrobe: {
                                      ...p.wardrobe,
                                      [key]: e.target.value,
                                    },
                                  }
                                : p
                            );
                            const updatedPerson = updated.find(
                              (p) => p.id === actor.id
                            );
                            database
                              .updateSingleCastCrewPerson(
                                selectedProject,
                                updatedPerson
                              )
                              .catch((err) =>
                                console.error("Sizing save failed:", err)
                              );
                          }}
                          placeholder="—"
                          style={{
                            width: "100%",
                            fontSize: "12px",
                            padding: "3px 6px",
                            border: "1px solid #c5d0e8",
                            borderRadius: "4px",
                            backgroundColor: "white",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Character scene reference — above all looks */}
          {(() => {
            const charObj = characters.find
              ? characters.find((c) => c.name === selectedCharacterName)
              : characters[selectedCharacterName];
            const charScenes = (charObj?.scenes || [])
              .map((s) => parseInt(s))
              .filter((n) => !isNaN(n))
              .sort((a, b) => a - b);
            return (
              <div
                style={{
                  backgroundColor:
                    charScenes.length > 0 ? "#e8f5e9" : "#f5f5f5",
                  border: `1px solid ${
                    charScenes.length > 0 ? "#c8e6c9" : "#e0e0e0"
                  }`,
                  borderRadius: "6px",
                  padding: "8px 12px",
                  marginBottom: "12px",
                  fontSize: "12px",
                }}
              >
                <span
                  style={{
                    fontWeight: "bold",
                    color: "#2e7d32",
                    marginRight: "6px",
                  }}
                >
                  📋 {selectedCharacterName} appears in:
                </span>
                {charScenes.length === 0 ? (
                  <span style={{ color: "#aaa", fontStyle: "italic" }}>
                    No scenes detected in script yet
                  </span>
                ) : (
                  <>
                    <span
                      style={{
                        display: "inline-flex",
                        flexWrap: "wrap",
                        gap: "3px",
                      }}
                    >
                      {charScenes.map((n) => (
                        <span
                          key={n}
                          style={{
                            backgroundColor: "#fff",
                            border: "1px solid #a5d6a7",
                            borderRadius: "3px",
                            padding: "0 5px",
                            color: "#1b5e20",
                            fontWeight: "600",
                            fontSize: "11px",
                          }}
                        >
                          {n}
                        </span>
                      ))}
                    </span>
                    <span style={{ color: "#888", marginLeft: "6px" }}>
                      ({charScenes.length} scene
                      {charScenes.length !== 1 ? "s" : ""})
                    </span>
                  </>
                )}
              </div>
            );
          })()}

          <div
            style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}
          >
            {currentItems.length} look{currentItems.length !== 1 ? "s" : ""} for{" "}
            {selectedCharacterName}
          </div>

          {currentItems.map((item) => {
            const charObj = characters.find
              ? characters.find((c) => c.name === selectedCharacterName)
              : characters[selectedCharacterName];
            const rawScenes = charObj?.scenes || [];
            const charScenes = rawScenes
              .map((s) => parseInt(s))
              .filter((n) => !isNaN(n))
              .sort((a, b) => a - b);
            return (
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
                  removeGarmentFromLook(
                    selectedCharacterName,
                    lookId,
                    garmentId
                  )
                }
                onCreateGarment={(lookId, garmentData) =>
                  createGarment(lookId, garmentData)
                }
                selectedProject={selectedProject}
                garmentInventory={garmentInventory}
                characterScenes={charScenes}
                scriptScenes={scriptScenes}
                onToggleScene={(lookId, sceneNum) => {
                  const buildRanges = (arr) => {
                    if (!arr || arr.length === 0) return "";
                    const s = [...arr].sort((a, b) => a - b);
                    const r = [];
                    let st = s[0],
                      en = s[0];
                    for (let i = 1; i <= s.length; i++) {
                      if (s[i] === en + 1) {
                        en = s[i];
                      } else {
                        r.push(st === en ? `${st}` : `${st}-${en}`);
                        st = en = s[i];
                      }
                    }
                    return r.join(", ");
                  };
                  const updated = wardrobeItems.map((c) =>
                    c.characterName === selectedCharacterName
                      ? {
                          ...c,
                          items: c.items.map((it) => {
                            if (it.id !== lookId) return it;
                            const cur = (it.scenes || []).map(Number);
                            const ns = cur.includes(sceneNum)
                              ? cur.filter((x) => x !== sceneNum)
                              : [...cur, sceneNum].sort((a, b) => a - b);
                            return {
                              ...it,
                              scenes: ns,
                              sceneRanges: buildRanges(ns),
                            };
                          }),
                        }
                      : c
                  );
                  setWardrobeItems(updated);
                  saveWardrobe(updated);
                }}
              />
            );
          })}

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

// ─── Mobile Props Module ──────────────────────────────────────────────────────
const MOBILE_PROP_SUBCATEGORIES = [
  { key: "hand",        label: "Hand Props",     prefix: "HP", color: "#FF6B6B" },
  { key: "weapons",     label: "Weapons",        prefix: "WP", color: "#D32F2F" },
  { key: "food",        label: "Food & Drink",   prefix: "FD", color: "#8D6E63" },
  { key: "documents",   label: "Documents",      prefix: "DC", color: "#1565C0" },
  { key: "furniture",   label: "Furniture",      prefix: "FN", color: "#5D4037" },
  { key: "electronics", label: "Electronics",    prefix: "EL", color: "#0288D1" },
  { key: "vehicles",    label: "Vehicles",       prefix: "VH", color: "#37474F" },
  { key: "medical",     label: "Medical",        prefix: "MD", color: "#00838F" },
  { key: "money",       label: "Money",          prefix: "MN", color: "#2E7D32" },
  { key: "misc",        label: "Miscellaneous",  prefix: "MS", color: "#757575" },
];
const MOBILE_SUBCATEGORY_MAP = Object.fromEntries(MOBILE_PROP_SUBCATEGORIES.map((s) => [s.key, s]));

function MobilePropsModule({ selectedProject, scenes = [], characters = {}, initialPropId }) {
  const [taggedItems, setTaggedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("props"); // "props" | "scenes"
  const [characterFilter, setCharacterFilter] = useState([]);
  const [subcategoryFilter, setSubcategoryFilter] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [categoryAccordionOpen, setCategoryAccordionOpen] = useState(true);
  const [characterAccordionOpen, setCharacterAccordionOpen] = useState(true);
  const [newPropSubcategory, setNewPropSubcategory] = useState("misc");
  const [expandedProp, setExpandedProp] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [uploading, setUploading] = useState(null); // propWord being uploaded
  // Add prop workflow
  const [showAddProp, setShowAddProp] = useState(false);
  const [propSearchQuery, setPropSearchQuery] = useState("");
  const [propSearchResults, setPropSearchResults] = useState(null);
  const [showScriptViewer, setShowScriptViewer] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [instanceStatuses, setInstanceStatuses] = useState({});
  const [instanceCharacters, setInstanceCharacters] = useState({});
  const [instancePopup, setInstancePopup] = useState(null);
  const [viewerSceneIdx, setViewerSceneIdx] = useState(0);
  const [viewerInstIdx, setViewerInstIdx] = useState(0);
  const [pendingScenes, setPendingScenes] = useState([]);
  const [primarySessionChar, setPrimarySessionChar] = useState(null);
  const [sessionVariants, setSessionVariants] = useState({});
  const [fullScriptMode, setFullScriptMode] = useState(false);
  const [fullScriptIdx, setFullScriptIdx] = useState(0);
  const [instanceMultiSelect, setInstanceMultiSelect] = useState(false);
  const [instanceMultiChars, setInstanceMultiChars] = useState([]);
  const scrollRef = useRef(null);

  // ── stemWord (inlined from App.js) ────────────────────────────────────────
  const stemWord = useCallback((word) => {
    const rules = [
      { pattern: /^children$/, stem: "child" },
      { pattern: /^people$/, stem: "person" },
      { pattern: /^men$/, stem: "man" },
      { pattern: /^women$/, stem: "woman" },
      { pattern: /^feet$/, stem: "foot" },
      { pattern: /^teeth$/, stem: "tooth" },
      { pattern: /^geese$/, stem: "goose" },
      { pattern: /^mice$/, stem: "mouse" },
      { pattern: /ies$/, stem: (w) => w.slice(0, -3) + "y" },
      { pattern: /ves$/, stem: (w) => w.slice(0, -3) + "f" },
      { pattern: /(s|x|z|ch|sh)es$/, stem: (w) => w.slice(0, -2) },
      { pattern: /s$/, stem: (w) => w.slice(0, -1) },
      { pattern: /ing$/, stem: (w) => {
        const b = w.slice(0, -3);
        return b.length >= 2 && b[b.length - 1] === b[b.length - 2] ? b.slice(0, -1) : b;
      }},
      { pattern: /ed$/, stem: (w) => {
        const b = w.slice(0, -2);
        return b.length >= 2 && b[b.length - 1] === b[b.length - 2] ? b.slice(0, -1) : b;
      }},
    ];
    for (const r of rules) {
      if (typeof r.stem === "string") { if (r.pattern.test(word)) return r.stem; }
      else { if (r.pattern.test(word)) return r.stem(word); }
    }
    return word;
  }, []);

  // ── searchScript ──────────────────────────────────────────────────────────
  const searchScript = useCallback((query) => {
    if (!query?.trim()) { setPropSearchResults(null); return; }
    const qWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const isMulti = qWords.length > 1;
    const stemmedQ = qWords.map((w) => stemWord(w.replace(/[^\w]/g, "")));
    const instancesByScene = {};
    for (let si = 0; si < scenes.length; si++) {
      const scene = scenes[si];
      if (!scene.content) continue;
      for (let bi = 0; bi < scene.content.length; bi++) {
        const block = scene.content[bi];
        const rawWords = block.text.split(/(\s+)/);
        const tokens = [];
        for (let wi = 0; wi < rawWords.length; wi++) {
          if (rawWords[wi].trim()) tokens.push({ wi, text: rawWords[wi] });
        }
        for (let ti = 0; ti < tokens.length; ti++) {
          const tok = tokens[ti];
          const clean = tok.text.toLowerCase().replace(/[^\w]/g, "");
          const stemmed = stemWord(clean);
          if (isMulti) {
            if (!stemmed.startsWith(stemmedQ[0])) continue;
            let ok = true;
            for (let qi = 1; qi < stemmedQ.length; qi++) {
              const nt = tokens[ti + qi];
              if (!nt) { ok = false; break; }
              const nc = nt.text.toLowerCase().replace(/[^\w]/g, "");
              if (!stemWord(nc).startsWith(stemmedQ[qi])) { ok = false; break; }
            }
            if (!ok) continue;
            if (!instancesByScene[si]) instancesByScene[si] = [];
            const groupIds = [];
            for (let qi = 0; qi < stemmedQ.length; qi++) {
              groupIds.push(`${si}-${bi}-${tokens[ti + qi].wi}`);
            }
            instancesByScene[si].push(groupIds[0]);
            instancesByScene[`_group_${groupIds[0]}`] = groupIds;
          } else {
            if (stemmed.startsWith(stemmedQ[0]) || clean.startsWith(qWords[0])) {
              if (!instancesByScene[si]) instancesByScene[si] = [];
              instancesByScene[si].push(`${si}-${bi}-${tok.wi}`);
            }
          }
        }
      }
    }
    const sceneIndices = Object.keys(instancesByScene)
      .filter((k) => !k.startsWith("_group_"))
      .map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    setPropSearchResults({ instancesByScene, sceneIndices });
  }, [scenes, stemWord]);

  useEffect(() => {
    if (showAddProp) searchScript(propSearchQuery);
  }, [propSearchQuery, showAddProp, searchScript]);

  // ── Load taggedItems ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    database.loadTaggedItemsFromDatabase(
      selectedProject,
      (items) => {
        setTaggedItems(items || {});
        setLoading(false);
      },
      (items) => items // identity — no category number recalculation needed on mobile
    );
  }, [selectedProject?.id]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const ch = supabase
      .channel(`tagged_items_mobile_${selectedProject.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "tagged_items",
        filter: `project_id=eq.${selectedProject.id}`,
      }, () => {
        database.loadTaggedItemsFromDatabase(
          selectedProject,
          (items) => { setTaggedItems(items || {}); },
          (items) => items
        );
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedProject?.id]);

  // Deep link: auto-expand prop matching initialPropId
  useEffect(() => {
    if (!initialPropId || Object.keys(taggedItems).length === 0) return;
    const entry = Object.entries(taggedItems).find(([, item]) => item.propId === initialPropId);
    if (entry) setExpandedProp(entry[0]);
  }, [initialPropId, Object.keys(taggedItems).join(",")]);

  const syncItems = useCallback(async (updated) => {
    await database.syncTaggedItemsToDatabase(selectedProject, updated);
    // Patch extended fields
    const arr = Object.entries(updated).map(([word, item]) => ({
      project_id: selectedProject.id, word,
      display_name: item.displayName, custom_title: item.customTitle || null,
      category: item.category, color: item.color,
      chronological_number: item.chronologicalNumber, position: item.position || 0,
      scenes: item.scenes || [], instances: item.instances || [],
      assigned_characters: item.assignedCharacters || [],
      manually_created: item.manuallyCreated || false,
      original_prop: item.originalProp || null,
      default_character: item.defaultCharacter || false,
      scenes_before_default: item.scenesBeforeDefault ?? null,
      photos: item.photos || [],
      prop_id: item.propId || null,
      prop_subcategory: item.propSubcategory || null,
      prop_id_locked: item.propIdLocked || false,
    }));
    await supabase.from("tagged_items")
      .upsert(arr, { onConflict: "project_id,word" });
  }, [selectedProject]);

  // ── Prop sorting helpers ──────────────────────────────────────────────────
  const getEarliestScene = (prop) => {
    const nums = (prop.scenes || []).map((n) => parseFloat(n)).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : Infinity;
  };

  const propItems = Object.entries(taggedItems)
    .filter(([, item]) => item.category === "Props")
    .sort((a, b) => {
      const d = getEarliestScene(a[1]) - getEarliestScene(b[1]);
      return d !== 0 ? d : (a[1].chronologicalNumber || 0) - (b[1].chronologicalNumber || 0);
    });

    const propNumberMap = Object.fromEntries(propItems.map(([w], i) => [w, i + 1]));

    const generatePropId = (subcategoryKey) => {
      const sub = MOBILE_SUBCATEGORY_MAP[subcategoryKey] || MOBILE_SUBCATEGORY_MAP["misc"];
      const prefix = sub.prefix;
      const existing = Object.values(taggedItems)
        .filter((item) => item.category === "Props" && item.propId && item.propId.startsWith(prefix + "_"))
        .map((item) => parseInt(item.propId.split("_")[1]) || 0)
        .sort((a, b) => b - a);
      const next = existing.length > 0 ? existing[0] + 1 : 1;
      return `${prefix}_${String(next).padStart(3, "0")}`;
    };
  
    // propId auto-assign removed — IDs are now manually assigned and locked by user

  const getPropsForScene = (sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return [];
    return propItems
      .filter(([, prop]) =>
        (prop.scenes || []).some((s) => String(s) === String(scene.sceneNumber)) ||
        (prop.instances || []).some((inst) => parseInt(inst.split("-")[0]) === sceneIndex)
      )
      .map(([word, prop]) => ({ word, ...prop }));
  };

  const filteredProps = propItems.filter(([, item]) =>
    (characterFilter.length === 0 || (item.assignedCharacters || []).some((c) => characterFilter.includes(c))) &&
    (subcategoryFilter.length === 0 || subcategoryFilter.includes(item.propSubcategory || "misc"))
  );

  // ── Script viewer helpers ─────────────────────────────────────────────────
  const currentSceneIndex = fullScriptMode
    ? fullScriptIdx
    : (propSearchResults?.sceneIndices[viewerSceneIdx] ?? 0);
  const currentScene = scenes[currentSceneIndex];
  const currentInstances = propSearchResults?.instancesByScene[currentSceneIndex] || [];

  const advanceToNext = useCallback((sIdx, iIdx, statuses) => {
    if (!propSearchResults) return;
    const { instancesByScene, sceneIndices } = propSearchResults;
    for (let s = sIdx; s < sceneIndices.length; s++) {
      const insts = instancesByScene[sceneIndices[s]] || [];
      const startI = s === sIdx ? iIdx + 1 : 0;
      for (let i = startI; i < insts.length; i++) {
        if (statuses[insts[i]] !== "confirmed" && statuses[insts[i]] !== "rejected") {
          setViewerSceneIdx(s); setViewerInstIdx(i); return;
        }
      }
    }
  }, [propSearchResults]);

  const openScriptViewer = () => {
    if (!propSearchResults) return;
    const { instancesByScene, sceneIndices } = propSearchResults;
    const init = {};
    sceneIndices.forEach((si) => {
      (instancesByScene[si] || []).forEach((id) => { init[id] = "pending"; });
    });
    setInstanceStatuses(init);
    setInstanceCharacters({});
    setPrimarySessionChar(null);
    setSessionVariants({});
    setPendingScenes([]);
    setViewerSceneIdx(0); setViewerInstIdx(0);
    setFullScriptMode(false); setFullScriptIdx(0);
    setShowScriptViewer(true);
  };

  const saveProp = () => {
    if (!propSearchResults || !newPropName.trim()) return;
    const { instancesByScene, sceneIndices } = propSearchResults;
    const mainScenes = [];
    sceneIndices.forEach((si) => {
      (instancesByScene[si] || []).forEach((id) => {
        if (!id.startsWith("_group_") && instanceStatuses[id] === "confirmed") {
          const char = instanceCharacters[id];
          if (!char || char === primarySessionChar) {
            const sceneNum = scenes[si]?.sceneNumber;
            if (sceneNum && !mainScenes.includes(sceneNum)) mainScenes.push(sceneNum);
          }
        }
      });
    });
    const propColor = Object.values(taggedItems).find((i) => i.category === "Props")?.color || "#FF6B6B";
    const nextNum = propItems.length + 1;
    const cleanWord = `custom_prop_${newPropName.toLowerCase().replace(/[^\w]/g, "_")}_${Date.now()}`;
    const newPropId = generatePropId(newPropSubcategory);
    const newItem = {
      displayName: newPropName, customTitle: newPropName,
      category: "Props", color: propColor,
      chronologicalNumber: nextNum, position: 0,
      scenes: mainScenes, instances: [],
      assignedCharacters: primarySessionChar ? [primarySessionChar] : [],
      manuallyCreated: true, photos: [],
      propSubcategory: newPropSubcategory,
      propId: newPropId,
      propIdLocked: false,
    };
    const updated = { ...taggedItems, [cleanWord]: newItem };
    // Add variants from sessionVariants
    Object.entries(sessionVariants).forEach(([char, word]) => {
      if (!updated[word]) {
        const variantScenes = [];
        sceneIndices.forEach((si) => {
          (instancesByScene[si] || []).forEach((id) => {
            if (instanceStatuses[id] === "confirmed" && instanceCharacters[id] === char) {
              const sn = scenes[si]?.sceneNumber;
              if (sn && !variantScenes.includes(sn)) variantScenes.push(sn);
            }
          });
        });
        updated[word] = {
          displayName: newPropName, customTitle: newPropName,
          category: "Props", color: propColor,
          chronologicalNumber: nextNum + Object.keys(sessionVariants).indexOf(char) + 1,
          position: 0, scenes: variantScenes, instances: [],
          assignedCharacters: [char], manuallyCreated: true, photos: [],
          propSubcategory: newPropSubcategory,
          propId: generatePropId(newPropSubcategory),
        };
      }
    });
    setTaggedItems(updated);
    syncItems(updated);
    setShowScriptViewer(false);
    setShowAddProp(false);
    setPropSearchQuery(""); setPropSearchResults(null);
    setNewPropName(""); setInstanceStatuses({});
    setInstanceCharacters({}); setPendingScenes([]);
    setPrimarySessionChar(null); setSessionVariants({});
    setNewPropSubcategory("misc");
  };

  const getElementStyle = (type) => {
    const base = { fontFamily: "Courier New, monospace", marginBottom: "4px", whiteSpace: "pre-wrap", wordBreak: "break-word" };
    switch (type) {
      case "Scene Heading": return { ...base, fontWeight: "bold", textTransform: "uppercase", fontSize: "11px" };
      case "Action": return { ...base, fontSize: "11px" };
      case "Character": return { ...base, textAlign: "center", fontWeight: "bold", fontSize: "11px", textTransform: "uppercase" };
      case "Dialogue": return { ...base, marginLeft: "20px", marginRight: "20px", fontSize: "11px" };
      case "Parenthetical": return { ...base, textAlign: "center", fontSize: "11px" };
      default: return { ...base, fontSize: "11px" };
    }
  };

  if (loading) return <div style={styles.spinner}><span>Loading props…</span></div>;

  return (
    <div style={{ padding: "12px", paddingBottom: "40px" }}>
      {/* Lightbox */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={lightboxImg} alt="prop" style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "6px" }} />
          <button onClick={() => setLightboxImg(null)} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "white", fontSize: "32px", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {["props", "scenes"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "6px 14px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold", backgroundColor: activeTab === tab ? "#2196F3" : "#eeeeee", color: activeTab === tab ? "white" : "#444" }}>
              {tab === "props" ? "Props" : "Scenes"}
            </button>
          ))}
        </div>
        {activeTab === "props" && (
          <button onClick={() => { setShowAddProp(true); setPropSearchQuery(""); setPropSearchResults(null); setNewPropName(""); }}
            style={{ padding: "6px 12px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>
            + Add Prop
          </button>
        )}
      </div>

      {/* Combined filter dropdown */}
      {activeTab === "props" && (() => {
        const hasAnyFilter = subcategoryFilter.length > 0 || characterFilter.length > 0;
        const activeCount = subcategoryFilter.length + characterFilter.length;
        const activeCatsWithProps = MOBILE_PROP_SUBCATEGORIES.filter((sub) =>
          Object.values(taggedItems).some(
            (item) => item.category === "Props" && (item.propSubcategory || "misc") === sub.key
          )
        );
        const hasChars = Object.keys(characters || {}).length > 0;
        return (
          <div style={{ marginBottom: "10px", position: "relative" }}>
            <button onClick={() => setShowFilterDropdown((p) => !p)}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${hasAnyFilter ? "#1976d2" : "#ccc"}`, borderRadius: "4px", backgroundColor: hasAnyFilter ? "#e3f2fd" : "white", cursor: "pointer", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
              <span style={{ color: hasAnyFilter ? "#1565c0" : "#555", fontWeight: hasAnyFilter ? "bold" : "normal" }}>
                {hasAnyFilter ? `${activeCount} filter${activeCount !== 1 ? "s" : ""} active` : "Filter props…"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {hasAnyFilter && (
                  <span onClick={(e) => { e.stopPropagation(); setSubcategoryFilter([]); setCharacterFilter([]); }}
                    style={{ fontSize: "12px", color: "#1976d2", fontWeight: "bold", cursor: "pointer", lineHeight: 1 }}>✕</span>
                )}
                <span style={{ fontSize: "10px", opacity: 0.5 }}>{showFilterDropdown ? "▲" : "▼"}</span>
              </div>
            </button>
            {showFilterDropdown && (
              <>
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 299 }} onClick={() => setShowFilterDropdown(false)} />
                <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", zIndex: 300, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", boxSizing: "border-box", maxHeight: "320px", overflowY: "auto" }}>
                  {/* Categories accordion */}
                  <div onClick={() => setCategoryAccordionOpen((p) => !p)}
                    style={{ padding: "8px 10px", backgroundColor: "#f5f5f5", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Categories{subcategoryFilter.length > 0 && <span style={{ marginLeft: "6px", color: "#1976d2" }}>({subcategoryFilter.length})</span>}
                    </span>
                    <span style={{ fontSize: "10px", color: "#888" }}>{categoryAccordionOpen ? "▲" : "▼"}</span>
                  </div>
                  {categoryAccordionOpen && activeCatsWithProps.map((sub) => {
                    const count = Object.values(taggedItems).filter(
                      (item) => item.category === "Props" && (item.propSubcategory || "misc") === sub.key
                    ).length;
                    const checked = subcategoryFilter.includes(sub.key);
                    return (
                      <label key={sub.key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", cursor: "pointer", backgroundColor: checked ? "#fff8e1" : "transparent" }}>
                        <input type="checkbox" checked={checked}
                          onChange={(e) => setSubcategoryFilter((prev) => e.target.checked ? [...prev, sub.key] : prev.filter((k) => k !== sub.key))}
                          style={{ cursor: "pointer", flexShrink: 0 }} />
                        <span style={{ fontSize: "9px", fontWeight: "bold", color: "white", backgroundColor: sub.color, borderRadius: "3px", padding: "1px 5px", fontFamily: "monospace", flexShrink: 0 }}>{sub.prefix}</span>
                        <span style={{ flex: 1, fontSize: "13px", color: checked ? "#333" : "#555", fontWeight: checked ? "bold" : "normal" }}>{sub.label}</span>
                        <span style={{ fontSize: "11px", color: "#999" }}>{count}</span>
                      </label>
                    );
                  })}
                  {/* Characters accordion */}
                  {hasChars && (
                    <>
                      <div onClick={() => setCharacterAccordionOpen((p) => !p)}
                        style={{ padding: "8px 10px", backgroundColor: "#f5f5f5", borderTop: "1px solid #e0e0e0", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Characters{characterFilter.length > 0 && <span style={{ marginLeft: "6px", color: "#1976d2" }}>({characterFilter.length})</span>}
                        </span>
                        <span style={{ fontSize: "10px", color: "#888" }}>{characterAccordionOpen ? "▲" : "▼"}</span>
                      </div>
                      {characterAccordionOpen && Object.keys(characters).sort().map((c) => {
                        const checked = characterFilter.includes(c);
                        return (
                          <label key={c} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", cursor: "pointer", backgroundColor: checked ? "#e3f2fd" : "transparent" }}>
                            <input type="checkbox" checked={checked}
                              onChange={(e) => setCharacterFilter((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c))}
                              style={{ cursor: "pointer", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px", color: checked ? "#1565c0" : "#555", fontWeight: checked ? "bold" : "normal" }}>{c}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
      {/* ── PROPS TAB ── */}
      {activeTab === "props" && (
        <div>
          {filteredProps.length === 0 ? (
            <div style={{ color: "#888", textAlign: "center", padding: "40px 0", fontSize: "13px", fontStyle: "italic" }}>No props found.</div>
          ) : (
            filteredProps.map(([word, item]) => {
              const isExpanded = expandedProp === word;
              const rawName = item.customTitle || item.displayName || word;
              const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
              const chars = item.assignedCharacters || [];
              const photos = item.photos || [];
              return (
                <div key={word} style={{ marginBottom: "6px", borderRadius: "6px", overflow: "hidden", border: `2px solid ${item.color}`, backgroundColor: `${item.color}18` }}>
                  {/* Collapsed header */}
                  <div onClick={() => setExpandedProp(isExpanded ? null : word)}
                    style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Line 1: title + spacer + ID badge */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "3px" }}>
                        <span style={{
                          fontWeight: "bold", fontSize: "14px",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          alignSelf: "flex-start", position: "relative", top: "-2px",
                        }}>
                          {propNumberMap[word]}. {name}
                        </span>
                        {item.defaultCharacter && (
                          <span style={{ fontSize: "9px", fontWeight: "bold", color: item.color, backgroundColor: "white", border: `1.5px solid ${item.color}`, borderRadius: "4px", padding: "1px 5px", textTransform: "uppercase", flexShrink: 0 }}>Default</span>
                        )}
                        {/* Spacer pushes ID badge right */}
                        <span style={{ flex: 1 }} />
                        {/* ID badge + lock */}
                        {item.propId ? (
                          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative" }}>
                            <span style={{
                              fontSize: "9px", fontWeight: "bold", color: "white",
                              backgroundColor: (MOBILE_SUBCATEGORY_MAP[item.propSubcategory || "misc"] || MOBILE_SUBCATEGORY_MAP["misc"]).color,
                              borderRadius: "3px", padding: "1px 6px", fontFamily: "monospace",
                              position: "relative", top: "-2px",
                            }}>
                              {item.propId}
                            </span>
                            {item.propIdLocked && (
                              <span style={{ position: "absolute", bottom: "-22px", fontSize: "14px", lineHeight: 1 }}>🔒</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontSize: "9px", fontWeight: "bold", color: "#888", backgroundColor: "#eee", borderRadius: "3px", padding: "1px 6px", flexShrink: 0, fontFamily: "monospace" }}>
                            unassigned
                          </span>
                        )}
                      </div>
                      {/* Line 2: character pills */}
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                        {chars.map((c) => (
                          <span key={c} style={{ backgroundColor: item.color, color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "9px", fontWeight: "bold" }}>{c}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {photos.length > 0 && (
                        <img src={photos[0]} alt="" style={{ width: "36px", height: "36px", objectFit: "cover", border: `2px solid ${item.color}`, borderRadius: "3px" }} />
                      )}
                      <span style={{ fontSize: "16px", color: "#666" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: "10px", borderTop: `1px solid ${item.color}40`, backgroundColor: "white" }}>
                      {/* Prop Type (subcategory) */}
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Prop Type</div>
                        <select
                          value={item.propSubcategory || "misc"}
                          disabled={!!item.propIdLocked}
                          onChange={(e) => {
                            if (item.propIdLocked) return;
                            const newSub = e.target.value;
                            const currentId = item.propId || "";
                            const newPrefix = (MOBILE_SUBCATEGORY_MAP[newSub] || MOBILE_SUBCATEGORY_MAP["misc"]).prefix;
                            const newId = currentId.startsWith(newPrefix + "_") ? currentId : generatePropId(newSub);
                            const updated = { ...taggedItems, [word]: { ...item, propSubcategory: newSub, propId: newId } };
                            setTaggedItems(updated);
                            syncItems(updated);
                          }}
                          style={{ width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", opacity: item.propIdLocked ? 0.6 : 1 }}
                        >
                          {MOBILE_PROP_SUBCATEGORIES.map((sub) => (
                            <option key={sub.key} value={sub.key}>{sub.prefix} — {sub.label}</option>
                          ))}
                        </select>
                        {/* ID badge + lock */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                          {item.propId ? (
                            <span style={{
                              fontSize: "11px", fontWeight: "bold", color: "white",
                              backgroundColor: (MOBILE_SUBCATEGORY_MAP[item.propSubcategory || "misc"] || MOBILE_SUBCATEGORY_MAP["misc"]).color,
                              borderRadius: "3px", padding: "3px 10px", fontFamily: "monospace",
                            }}>
                              {item.propId}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#888", backgroundColor: "#eee", borderRadius: "3px", padding: "3px 10px", fontFamily: "monospace" }}>
                              unassigned
                            </span>
                          )}
                          {item.propId && (
                            item.propIdLocked ? (
                              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#4CAF50", display: "flex", alignItems: "center", gap: "4px" }}>
                                🔒 ID Locked
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  const updated = { ...taggedItems, [word]: { ...item, propIdLocked: true } };
                                  setTaggedItems(updated);
                                  syncItems(updated);
                                }}
                                style={{ backgroundColor: "#1976d2", color: "white", border: "none", borderRadius: "4px", padding: "6px 14px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
                                title="Verify this ID and lock it permanently"
                              >
                                Verify & Lock
                              </button>
                            )
                          )}
                        </div>
                        {item.propIdLocked && (
                          <div style={{ fontSize: "10px", color: "#888", marginTop: "4px", fontStyle: "italic" }}>
                            ID is permanently locked and cannot be changed.
                          </div>
                        )}
                      </div>
                      {/* Scenes list */}
                      {(item.scenes || []).length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                          <div style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px" }}>Scenes</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {[...(item.scenes || [])].sort((a, b) => parseFloat(a) - parseFloat(b)).map((s) => (
                              <span key={s} style={{ backgroundColor: item.color, color: "white", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", fontWeight: "bold" }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Photos */}
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "6px" }}>
                          Photos ({photos.length}/10)
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "8px" }}>
                          {photos.map((photo, idx) => (
                            <div key={idx} style={{ position: "relative" }}>
                              <img src={photo} alt="" onClick={() => setLightboxImg(photo)}
                                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "4px", border: `2px solid ${item.color}`, cursor: "pointer" }} />
                              <button onClick={async () => {
                                await deleteMultipleImages([photo]);
                                const newPhotos = photos.filter((_, i) => i !== idx);
                                const updated = { ...taggedItems, [word]: { ...item, photos: newPhotos } };
                                setTaggedItems(updated);
                                syncItems(updated);
                              }} style={{ position: "absolute", top: "-6px", right: "-6px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>×</button>
                            </div>
                          ))}
                        </div>
                        {photos.length < 10 && (
                          <>
                            <input type="file" accept="image/*" id={`prop-upload-${word}`} style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                setUploading(word);
                                try {
                                  const result = await uploadPropImage(file, selectedProject.id, word, `prop_${Date.now()}.jpg`);
                                  if (result?.url) {
                                    const newPhotos = [...photos, result.url];
                                    const updated = { ...taggedItems, [word]: { ...item, photos: newPhotos } };
                                    setTaggedItems(updated);
                                    syncItems(updated);
                                  }
                                } finally { setUploading(null); e.target.value = ""; }
                              }} />
                            <button disabled={uploading === word} onClick={() => document.getElementById(`prop-upload-${word}`).click()}
                              style={{ width: "100%", padding: "8px", backgroundColor: uploading === word ? "#aaa" : "#4CAF50", color: "white", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: uploading === word ? "not-allowed" : "pointer" }}>
                              {uploading === word ? "Uploading…" : "📷 Upload Photo"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── SCENES TAB ── */}
      {activeTab === "scenes" && (
        <div>
          {scenes.map((scene, si) => {
            const sceneProps = getPropsForScene(si);
            if (sceneProps.length === 0) return null;
            const isInt = scene.heading?.toUpperCase().startsWith("INT");
            const isExt = scene.heading?.toUpperCase().startsWith("EXT");
            const borderColor = isInt ? "#4A90D9" : isExt ? "#5cb85c" : "#aaa";
            return (
              <div key={si} style={{ marginBottom: "8px", borderRadius: "6px", border: `2px solid ${borderColor}`, overflow: "hidden" }}>
                <div style={{ backgroundColor: borderColor, padding: "6px 10px" }}>
                  <span style={{ color: "white", fontWeight: "bold", fontSize: "12px" }}>Scene {scene.sceneNumber}</span>
                  {scene.heading && <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "10px", marginLeft: "8px" }}>{scene.heading}</span>}
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "white" }}>
                  {sceneProps.map((prop) => (
                    <div key={prop.word} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: prop.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{propNumberMap[prop.word]}. {prop.customTitle || prop.displayName}</span>
                      {(prop.assignedCharacters || []).map((c) => (
                        <span key={c} style={{ backgroundColor: prop.color, color: "white", borderRadius: "8px", padding: "1px 6px", fontSize: "9px", fontWeight: "bold" }}>{c}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD PROP OVERLAY ── */}
      {showAddProp && !showScriptViewer && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "white", zIndex: 500, display: "flex", flexDirection: "column" }}>
          <div style={{ backgroundColor: "#2196F3", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "white", fontWeight: "bold", fontSize: "14px" }}>Add New Prop</span>
            <button onClick={() => { setShowAddProp(false); setPropSearchQuery(""); setPropSearchResults(null); setNewPropName(""); }}
              style={{ background: "transparent", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* Subcategory picker */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Prop Type</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <select
                  value={newPropSubcategory}
                  onChange={(e) => setNewPropSubcategory(e.target.value)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px" }}
                >
                  {MOBILE_PROP_SUBCATEGORIES.map((sub) => (
                    <option key={sub.key} value={sub.key}>{sub.prefix} — {sub.label}</option>
                  ))}
                </select>
                <span style={{
                  fontSize: "11px", fontWeight: "bold", color: "white",
                  backgroundColor: (MOBILE_SUBCATEGORY_MAP[newPropSubcategory] || MOBILE_SUBCATEGORY_MAP["misc"]).color,
                  borderRadius: "3px", padding: "4px 10px", fontFamily: "monospace", flexShrink: 0,
                }}>
                  {(MOBILE_SUBCATEGORY_MAP[newPropSubcategory] || MOBILE_SUBCATEGORY_MAP["misc"]).prefix}
                </span>
              </div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", fontWeight: "bold", color: "#555", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Prop Name / Search Script</label>
              <input type="text" value={propSearchQuery}
                onChange={(e) => { setPropSearchQuery(e.target.value); setNewPropName(e.target.value); }}
                placeholder="e.g. rifle, cigarette holder…"
                style={{ width: "100%", padding: "10px", border: "1px solid #90caf9", borderRadius: "6px", fontSize: "16px", boxSizing: "border-box" }} />
            </div>
            {propSearchResults && propSearchResults.sceneIndices.length > 0 && (
              <div style={{ backgroundColor: "#f0f7ff", border: "1px solid #bbdefb", borderRadius: "6px", padding: "10px", marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                  Found in <strong>{propSearchResults.sceneIndices.length}</strong> scene{propSearchResults.sceneIndices.length !== 1 ? "s" : ""}
                </div>
                <button onClick={openScriptViewer}
                  style={{ width: "100%", padding: "10px", backgroundColor: "#1976d2", color: "white", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>
                  📄 View & Assign
                </button>
              </div>
            )}
            {propSearchResults && propSearchResults.sceneIndices.length === 0 && propSearchQuery && (
              <div style={{ fontSize: "12px", color: "#e53935", marginBottom: "12px" }}>No matches found in script.</div>
            )}
          </div>
        </div>
      )}

      {/* ── SCRIPT VIEWER ── */}
      {showScriptViewer && propSearchResults && currentScene && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "white", zIndex: 600, display: "flex", flexDirection: "column" }}>
          {/* Viewer header */}
          <div style={{ backgroundColor: "#1976d2", padding: "10px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "white", fontWeight: "bold", fontSize: "13px" }}>{newPropName || "New Prop"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "white", cursor: "pointer" }}>
                  <input type="checkbox" checked={fullScriptMode} onChange={(e) => {
                    const on = e.target.checked;
                    setFullScriptMode(on);
                    if (on) setFullScriptIdx(currentSceneIndex);
                    else {
                      let closest = 0, dist = Infinity;
                      (propSearchResults.sceneIndices || []).forEach((si, idx) => {
                        const d = Math.abs(si - fullScriptIdx);
                        if (d < dist) { dist = d; closest = idx; }
                      });
                      setViewerSceneIdx(closest);
                    }
                    setInstancePopup(null);
                  }} />
                  Full script
                </label>
                <button onClick={() => { setShowScriptViewer(false); setInstancePopup(null); }}
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.5)", color: "white", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer" }}>
                  ✓ Done
                </button>
              </div>
            </div>
            {/* Scene navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => {
                if (fullScriptMode) setFullScriptIdx((p) => Math.max(0, p - 1));
                else { setViewerSceneIdx((p) => Math.max(0, p - 1)); setViewerInstIdx(0); }
                setInstancePopup(null);
              }} disabled={fullScriptMode ? fullScriptIdx === 0 : viewerSceneIdx === 0}
                style={{ background: "none", border: "none", color: (fullScriptMode ? fullScriptIdx === 0 : viewerSceneIdx === 0) ? "rgba(255,255,255,0.3)" : "white", fontSize: "18px", cursor: "pointer", padding: "0 4px" }}>‹</button>
              <span style={{ color: "white", fontSize: "12px", fontWeight: "bold" }}>
                Scene {currentScene.sceneNumber} ({fullScriptMode ? `${fullScriptIdx + 1}/${scenes.length}` : `${viewerSceneIdx + 1}/${propSearchResults.sceneIndices.length}`})
              </span>
              <button onClick={() => {
                if (fullScriptMode) setFullScriptIdx((p) => Math.min(scenes.length - 1, p + 1));
                else { setViewerSceneIdx((p) => Math.min(propSearchResults.sceneIndices.length - 1, p + 1)); setViewerInstIdx(0); }
                setInstancePopup(null);
              }} disabled={fullScriptMode ? fullScriptIdx === scenes.length - 1 : viewerSceneIdx === propSearchResults.sceneIndices.length - 1}
                style={{ background: "none", border: "none", color: (fullScriptMode ? fullScriptIdx === scenes.length - 1 : viewerSceneIdx === propSearchResults.sceneIndices.length - 1) ? "rgba(255,255,255,0.3)" : "white", fontSize: "18px", cursor: "pointer", padding: "0 4px" }}>›</button>
            </div>
            {/* Word navigation */}
            {currentInstances.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                <button onClick={() => { setViewerInstIdx((p) => Math.max(0, p - 1)); setInstancePopup(null); }}
                  disabled={viewerInstIdx === 0}
                  style={{ background: "none", border: "none", color: viewerInstIdx === 0 ? "rgba(255,255,255,0.3)" : "white", fontSize: "13px", cursor: "pointer" }}>← Word</button>
                <span style={{ color: "white", fontSize: "11px" }}>{viewerInstIdx + 1}/{currentInstances.length}</span>
                <button onClick={() => { setViewerInstIdx((p) => Math.min(currentInstances.length - 1, p + 1)); setInstancePopup(null); }}
                  disabled={viewerInstIdx === currentInstances.length - 1}
                  style={{ background: "none", border: "none", color: viewerInstIdx === currentInstances.length - 1 ? "rgba(255,255,255,0.3)" : "white", fontSize: "13px", cursor: "pointer" }}>Word →</button>
              </div>
            )}
          </div>

          {/* Script content */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", fontFamily: "Courier New, monospace", backgroundColor: "white" }}
            onClick={() => setInstancePopup(null)}>
            <div style={getElementStyle("Scene Heading")}>{currentScene.heading}</div>
            {(currentScene.content || []).map((block, bi) => {
              const words = block.text.split(/(\s+)/);
              const sceneInsts = propSearchResults.instancesByScene[currentSceneIndex] || [];
              return (
                <div key={bi} style={getElementStyle(block.type)}>
                  {words.map((word, wi) => {
                    if (!word.trim()) return word;
                    const id = `${currentSceneIndex}-${bi}-${wi}`;
                    const groupKey = `_group_${currentInstances[viewerInstIdx]}`;
                    const groupIds = propSearchResults.instancesByScene[groupKey] || [];
                    const isCurrentWord = groupIds.includes(id) || id === currentInstances[viewerInstIdx];
                    const isAnyInstance = sceneInsts.some((iid) => {
                      const grp = propSearchResults.instancesByScene[`_group_${iid}`] || [iid];
                      return grp.includes(id);
                    });
                    const status = instanceStatuses[currentInstances[viewerInstIdx]];
                    const bgColor = isCurrentWord
                      ? status === "confirmed" ? "#4CAF50" : status === "rejected" ? "#f44336" : "#FFC107"
                      : isAnyInstance ? (instanceStatuses[sceneInsts.find((iid) => { const g = propSearchResults.instancesByScene[`_group_${iid}`] || [iid]; return g.includes(id); })] === "confirmed" ? "#a5d6a7" : "#fff9c4")
                      : "transparent";
                    return (
                      <span key={wi}
                        onClick={(e) => {
                          if (!isAnyInstance) return;
                          e.stopPropagation();
                          const clickedIid = sceneInsts.find((iid) => {
                            const g = propSearchResults.instancesByScene[`_group_${iid}`] || [iid];
                            return g.includes(id);
                          });
                          if (clickedIid) {
                            const idx = sceneInsts.indexOf(clickedIid);
                            setViewerInstIdx(idx);
                            setInstancePopup({ instanceId: clickedIid, sceneIdx: currentSceneIndex });
                            setInstanceMultiSelect(false);
                            setInstanceMultiChars([]);
                          }
                        }}
                        style={{ backgroundColor: bgColor, borderRadius: bgColor !== "transparent" ? "2px" : 0, cursor: isAnyInstance ? "pointer" : "default", padding: bgColor !== "transparent" ? "0 1px" : 0 }}>
                        {word}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Instance popup */}
          {instancePopup && (
            <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", backgroundColor: "white", borderTop: "2px solid #1976d2", zIndex: 700, display: "flex", flexDirection: "column", maxHeight: "55vh", boxSizing: "border-box" }}
              onClick={(e) => e.stopPropagation()}>

              {/* Sticky header — always visible */}
              <div style={{ flexShrink: 0, padding: "10px 14px", borderBottom: "1px solid #e0e0e0", backgroundColor: "white" }}>
                {/* Row 1: label + Reject + Confirm */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1976d2" }}>Assign instance</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => {
                      const newSt = { ...instanceStatuses, [instancePopup.instanceId]: "rejected" };
                      setInstanceStatuses(newSt);
                      setInstancePopup(null);
                      advanceToNext(viewerSceneIdx, viewerInstIdx, newSt);
                    }} style={{ padding: "8px 14px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>✗ Reject</button>
                    <button onClick={() => {
                      const charsToApply = instanceMultiSelect ? instanceMultiChars : instanceCharacters[instancePopup.instanceId] ? [instanceCharacters[instancePopup.instanceId]] : [];
                      if (charsToApply.length > 0) {
                        const primary = charsToApply[0];
                        if (!primarySessionChar) setPrimarySessionChar(primary);
                        setInstanceCharacters((prev) => ({ ...prev, [instancePopup.instanceId]: primary }));
                        charsToApply.slice(1).forEach((char) => {
                          if (!sessionVariants[char]) {
                            const vWord = `custom_prop_${(newPropName || "prop").toLowerCase().replace(/[^\w]/g, "_")}_${char.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
                            setSessionVariants((prev) => ({ ...prev, [char]: vWord }));
                          }
                        });
                        const sceneNum = scenes[instancePopup.sceneIdx]?.sceneNumber;
                        if (sceneNum) setPendingScenes((prev) => prev.includes(sceneNum) ? prev : [...prev, sceneNum]);
                      }
                      const newSt = { ...instanceStatuses, [instancePopup.instanceId]: "confirmed" };
                      setInstanceStatuses(newSt);
                      setInstancePopup(null);
                      advanceToNext(viewerSceneIdx, viewerInstIdx, newSt);
                    }} style={{ padding: "8px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>✓ Confirm</button>
                  </div>
                </div>
                {/* Row 2: multiple characters toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#555", cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={instanceMultiSelect}
                    onChange={(e) => { setInstanceMultiSelect(e.target.checked); setInstanceMultiChars([]); }}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  Multiple characters
                </label>
              </div>

              {/* Scrollable character list */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {!instanceMultiSelect ? (
                  <div>
                    <div onClick={() => setInstanceCharacters((prev) => ({ ...prev, [instancePopup.instanceId]: "" }))}
                      style={{ padding: "12px 14px", fontSize: "14px", cursor: "pointer", color: "#aaa", fontStyle: "italic", borderBottom: "1px solid #eee", backgroundColor: !instanceCharacters[instancePopup.instanceId] ? "#e3f2fd" : "white" }}>
                      Select character…
                    </div>
                    {Object.keys(characters).sort().map((c) => (
                      <div key={c} onClick={() => setInstanceCharacters((prev) => ({ ...prev, [instancePopup.instanceId]: c }))}
                        style={{ padding: "12px 14px", fontSize: "14px", cursor: "pointer", backgroundColor: instanceCharacters[instancePopup.instanceId] === c ? "#e3f2fd" : "white", fontWeight: instanceCharacters[instancePopup.instanceId] === c ? "bold" : "normal", color: instanceCharacters[instancePopup.instanceId] === c ? "#1565c0" : "#333", borderBottom: "1px solid #f5f5f5" }}>
                        {c}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "6px 8px", backgroundColor: "#f0f7ff" }}>
                    {Object.keys(characters).sort().map((c) => (
                      <label key={c} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "8px 6px", cursor: "pointer", fontWeight: instanceMultiChars[0] === c ? "bold" : "normal", color: instanceMultiChars[0] === c ? "#1565c0" : "#333", borderBottom: "1px solid #e8f0fe" }}>
                        <input type="checkbox" checked={instanceMultiChars.includes(c)}
                          onChange={(e) => setInstanceMultiChars((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c))}
                          style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        {c}
                        {instanceMultiChars[0] === c && <span style={{ fontSize: "10px", color: "#1976d2", marginLeft: "2px" }}>(primary)</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save bar */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #eee", backgroundColor: "#f9f9f9", display: "flex", gap: "8px" }}>
            <button onClick={saveProp} disabled={!newPropName.trim()}
              style={{ flex: 1, padding: "12px", backgroundColor: !newPropName.trim() ? "#aaa" : "#1976d2", color: "white", border: "none", borderRadius: "6px", fontSize: "14px", fontWeight: "bold", cursor: !newPropName.trim() ? "not-allowed" : "pointer" }}>
              💾 Save Prop
            </button>
            <button onClick={() => { setShowScriptViewer(false); setInstancePopup(null); }}
              style={{ padding: "12px 16px", backgroundColor: "#eee", color: "#444", border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
// ─── Mobile Call Sheet ────────────────────────────────────────────────────────
function MobileCallSheetModule({
  selectedProject,
  shootingDays,
  scheduledScenes,
  scenes,
  castCrew,
  characters,
  wardrobeItems,
  actualLocations,
  scriptLocations,
  callSheetData,
  projectSettings,
}) {
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [scale, setScale] = React.useState(1);
  const containerRef = React.useRef(null);
  const dropdownRef = React.useRef(null);

  // Smart default day selection
  React.useEffect(() => {
    if (shootingDays.length > 0 && selectedDay === null) {
      const today = new Date().toISOString().split("T")[0];
      const todayMatch = shootingDays.find((d) => d.date === today);
      if (todayMatch) {
        setSelectedDay(todayMatch);
        return;
      }
      const future = shootingDays
        .filter((d) => d.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (future.length > 0) {
        setSelectedDay(future[0]);
        return;
      }
      const past = shootingDays
        .filter((d) => d.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
      setSelectedDay(past.length > 0 ? past[0] : shootingDays[0]);
    }
  }, [shootingDays]);

  // Compute scale so sheet fills the container with no scrolling
  React.useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.offsetWidth;
      const dropdownH = dropdownRef.current
        ? dropdownRef.current.offsetHeight + 12
        : 70;
      // Full available height: viewport minus sticky header (~60px) minus dropdown
      const availableH = window.innerHeight - 60 - dropdownH - 8;
      const sheetW = 816; // 8.5in @ 96dpi
      const sheetH = 1056; // 11in @ 96dpi
      const scaleW = containerW / sheetW;
      const scaleH = availableH / sheetH;
      setScale(Math.min(scaleW, scaleH));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [selectedDay]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });
  };

  const formatDateLong = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getSceneCast = (sceneNumber) => {
    if (!characters) return "";
    return Object.values(characters)
      .filter((char) =>
        (char.scenes || []).some((s) => parseInt(s) === parseInt(sceneNumber))
      )
      .sort((a, b) => a.chronologicalNumber - b.chronologicalNumber)
      .map((char) => {
        const actor = castCrew.find(
          (p) => p.type === "cast" && p.character === char.name
        );
        return `${char.chronologicalNumber}. ${actor?.displayName || "TBD"}`;
      })
      .join(", ");
  };

  const getSceneWardrobe = (sceneNumber) => {
    const result = [];
    (wardrobeItems || []).forEach((char) => {
      (char.items || []).forEach((item) => {
        if ((item.scenes || []).includes(parseInt(sceneNumber)))
          result.push(`${char.characterName} ${item.number}`);
      });
    });
    return result.join(", ");
  };

  const getAddress = (sceneNumber) => {
    const sl = scriptLocations.find(
      (l) =>
        l.scenes &&
        (l.scenes.includes(parseInt(sceneNumber)) ||
          l.scenes.includes(String(sceneNumber)))
    );
    if (sl?.actualLocationId) {
      const a = actualLocations.find((x) => x.id === sl.actualLocationId);
      if (a?.address)
        return [a.address, a.city, a.state, a.zipCode]
          .filter(Boolean)
          .join(", ");
    }
    return null;
  };

  const getScheduledScenes = () => {
    if (!selectedDay) return [];
    if (selectedDay.scheduleBlocks && selectedDay.scheduleBlocks.length > 0) {
      return selectedDay.scheduleBlocks
        .filter((b) => b.scene || b.isLunch || b.customItem)
        .map((b) => {
          if (b.isLunch)
            return {
              scene: "LUNCH",
              ie: "",
              location: "LUNCH",
              cast: "",
              dn: "",
              pages: "",
              wardrobe: "",
            };
          if (b.customItem)
            return {
              scene: b.customItem.toUpperCase(),
              ie: "",
              location: b.customItem,
              cast: "",
              dn: "",
              pages: "",
              wardrobe: "",
            };
          const s = b.scene;
          const mainScene = scenes.find(
            (sc) => sc.sceneNumber == s.sceneNumber
          );
          return {
            scene: s.sceneNumber,
            ie: s.metadata?.intExt || "",
            location: s.shootingLocation || s.metadata?.location || "",
            cast: getSceneCast(s.sceneNumber),
            dn: s.metadata?.timeOfDay || "",
            pages: mainScene?.pageLength || s.pageLength || "1/8",
            wardrobe: getSceneWardrobe(s.sceneNumber),
          };
        });
    }
    return (scheduledScenes[selectedDay.date] || []).map((item) => {
      const sceneNum = typeof item === "string" ? item : item.sceneNumber;
      const s = scenes.find(
        (sc) => String(sc.sceneNumber) === String(sceneNum)
      );
      return {
        scene: sceneNum,
        ie: s?.metadata?.intExt || "",
        location: s?.metadata?.location || "",
        cast: getSceneCast(sceneNum),
        dn: s?.metadata?.timeOfDay || "",
        pages: s?.pageLength || "1/8",
        wardrobe: getSceneWardrobe(sceneNum),
      };
    });
  };

  const currentDayId = selectedDay?.id;
  const callTime =
    callSheetData?.callTimeByDay?.[currentDayId] ||
    callSheetData?.callTime ||
    "TBD";
  const dayNotes =
    callSheetData?.notesByDay?.[currentDayId] || callSheetData?.notes || "";
  const scheduledScenesForDay = getScheduledScenes();

  // Build cast list for day
  const castForDay = (() => {
    const list = [];
    const seen = new Set();
    scheduledScenesForDay.forEach((scene) => {
      if (!scene.cast) return;
      scene.cast.split(", ").forEach((entry) => {
        const match = entry.match(/^(\d+)\.\s*(.+)/);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          const charNum = parseInt(match[1]);
          const charEntry = Object.values(characters || {}).find(
            (c) => c.chronologicalNumber === charNum
          );
          const actor = charEntry
            ? castCrew.find(
                (p) => p.type === "cast" && p.character === charEntry.name
              )
            : null;
          const castTimes = callSheetData?.castCallTimes?.[charEntry?.name];
          list.push({
            num: charNum,
            character: charEntry?.name || "",
            actor: actor?.displayName || "TBD",
            makeup: castTimes?.makeup || "",
            onSet: castTimes?.set || callTime,
          });
        }
      });
    });
    return list.sort((a, b) => a.num - b.num);
  })();

  // Build crew tables (left + right split)
  const crewForDay = (() => {
    const assigned =
      callSheetData?.crewByDay?.[currentDayId]?.assignedCrew || [];
    const grouped = {};
    const deptOrder = [
      "Principal Crew",
      "Producer",
      "Camera",
      "G&E",
      "Art",
      "Wardrobe",
      "Makeup",
      "Sound",
      "Script",
      "Production",
      "Transportation",
      "Craft Services",
      "Stunts",
      "Other",
    ];
    assigned.forEach((crew) => {
      const dept = crew.department || crew.crewDepartment || "Other";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(crew);
    });
    const leftRows = [];
    const rightRows = [];
    const allDepts = deptOrder.filter((d) => grouped[d]);
    const half = Math.ceil(allDepts.length / 2);
    allDepts.slice(0, half).forEach((dept) => {
      leftRows.push({ type: "header", dept });
      (grouped[dept] || []).forEach((m) =>
        leftRows.push({ type: "member", ...m })
      );
    });
    allDepts.slice(half).forEach((dept) => {
      rightRows.push({ type: "header", dept });
      (grouped[dept] || []).forEach((m) =>
        rightRows.push({ type: "member", ...m })
      );
    });
    return { leftRows, rightRows };
  })();

  const cellStyle = {
    border: "1px solid black",
    padding: "2px 3px",
    fontSize: "8px",
  };
  const headerCellStyle = {
    ...cellStyle,
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {/* Day Selector */}
      <div ref={dropdownRef} style={{ marginBottom: "12px" }}>
        <label style={styles.label}>Shooting Day</label>
        <select
          style={{ ...styles.select, marginBottom: 0 }}
          value={selectedDay?.id || ""}
          onChange={(e) => {
            const day = shootingDays.find(
              (d) => String(d.id) === e.target.value
            );
            setSelectedDay(day || null);
          }}
        >
          {shootingDays.map((day) => {
            const date = new Date(day.date + "T00:00:00");
            const dayName = date.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const formatted = date.toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            });
            return (
              <option key={day.id} value={day.id}>
                Day {day.dayNumber} — {dayName} {formatted}
              </option>
            );
          })}
        </select>
      </div>

      {!selectedDay ? (
        <div
          style={{
            textAlign: "center",
            color: "#aaa",
            padding: "40px 0",
            fontStyle: "italic",
          }}
        >
          No shooting days available
        </div>
      ) : (
        <div
          style={{
            width: "816px",
            height: "1056px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: `${1056 * scale - 1056}px`,
            backgroundColor: "white",
            border: "2px solid black",
            boxSizing: "border-box",
            padding: "0.2in",
            fontFamily: "Arial, sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid black",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "4px",
                borderRight: "1px solid black",
                fontSize: "8px",
              }}
            >
              <div>
                <strong>Producer:</strong>{" "}
                {projectSettings?.producer ||
                  selectedProject?.producer ||
                  "TBD"}
              </div>
              <div>
                <strong>Director:</strong>{" "}
                {projectSettings?.director ||
                  selectedProject?.director ||
                  "TBD"}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ccc",
                fontWeight: "bold",
                fontSize: "14px",
                padding: "4px",
              }}
            >
              {projectSettings?.filmTitle ||
                selectedProject?.name ||
                "FILM TITLE"}
            </div>
            <div
              style={{
                flex: 1,
                padding: "4px",
                borderLeft: "1px solid black",
                fontSize: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {formatDate(selectedDay.date)}
                </span>
                <span>
                  Day {selectedDay.dayNumber} of {shootingDays.length}
                </span>
              </div>
              <div style={{ color: "#555", marginTop: "2px", fontSize: "7px" }}>
                {formatDateLong(selectedDay.date)}
              </div>
            </div>
          </div>

          {/* Notes + General Call */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid black",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                flex: 2,
                padding: "4px",
                borderRight: "1px solid black",
                minHeight: "36px",
              }}
            >
              <strong style={{ fontSize: "8px" }}>NOTES:</strong>
              <div
                style={{
                  marginTop: "2px",
                  fontSize: "8px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {dayNotes || "—"}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "7px", fontWeight: "bold" }}>
                GENERAL CALL
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  border: "2px solid black",
                  padding: "2px 8px",
                  marginTop: "2px",
                }}
              >
                {callTime}
              </div>
            </div>
          </div>

          {/* Scene Schedule */}
          <div style={{ borderBottom: "1px solid black", marginBottom: "4px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "44px 28px 110px 60px 150px 170px 44px 44px",
                backgroundColor: "#333",
                color: "white",
                fontWeight: "bold",
                fontSize: "7px",
                padding: "2px 3px",
              }}
            >
              <div>SCENE</div>
              <div>I/E</div>
              <div>SET</div>
              <div>D/N</div>
              <div>CAST</div>
              <div>LOCATION</div>
              <div>PAGES</div>
              <div>WD</div>
            </div>
            {scheduledScenesForDay.length === 0 ? (
              <div
                style={{
                  padding: "6px",
                  color: "#aaa",
                  fontStyle: "italic",
                  fontSize: "8px",
                }}
              >
                No scenes scheduled
              </div>
            ) : (
              scheduledScenesForDay.map((scene, i) => {
                const isLunch = scene.scene === "LUNCH";
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "44px 28px 110px 60px 150px 170px 44px 44px",
                      backgroundColor: isLunch
                        ? "#e8e8e8"
                        : i % 2 === 0
                        ? "#fff"
                        : "#f9f9f9",
                      borderBottom: "1px solid #ccc",
                      fontSize: "7px",
                      padding: "2px 3px",
                      fontWeight: isLunch ? "bold" : "normal",
                      fontStyle: isLunch ? "italic" : "normal",
                    }}
                  >
                    <div>{scene.scene}</div>
                    <div>{scene.ie}</div>
                    <div>{scene.location}</div>
                    <div>{scene.dn}</div>
                    <div>{scene.cast}</div>
                    <div>
                      {scene.scene !== "LUNCH"
                        ? getAddress(scene.scene) || "—"
                        : ""}
                    </div>
                    <div>{scene.pages}</div>
                    <div>{scene.wardrobe}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cast */}
          {castForDay.length > 0 && (
            <div
              style={{ borderBottom: "1px solid black", marginBottom: "4px" }}
            >
              <div
                style={{
                  backgroundColor: "#333",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "8px",
                  padding: "2px 4px",
                }}
              >
                CAST
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 1fr 64px 64px",
                  backgroundColor: "#888",
                  color: "white",
                  fontSize: "7px",
                  fontWeight: "bold",
                  padding: "1px 3px",
                }}
              >
                <div>#</div>
                <div>CHARACTER</div>
                <div>ACTOR</div>
                <div>MAKEUP</div>
                <div>ON SET</div>
              </div>
              {castForDay.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr 1fr 64px 64px",
                    backgroundColor: i % 2 === 0 ? "#fff" : "#f5f5f5",
                    fontSize: "7px",
                    padding: "1px 3px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>{c.num}</div>
                  <div>{c.character}</div>
                  <div>{c.actor}</div>
                  <div>{c.makeup || "—"}</div>
                  <div>{c.onSet}</div>
                </div>
              ))}
            </div>
          )}

          {/* Crew — two column split */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
            {[crewForDay.leftRows, crewForDay.rightRows].map(
              (rows, tableIdx) => (
                <div key={tableIdx} style={{ flex: 1 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "7px",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f0f0f0" }}>
                        <th style={headerCellStyle}>POSITION</th>
                        <th style={headerCellStyle}>NAME</th>
                        <th style={headerCellStyle}>PHONE</th>
                        <th style={headerCellStyle}>CALL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              ...cellStyle,
                              color: "#aaa",
                              fontStyle: "italic",
                              textAlign: "center",
                            }}
                          >
                            No crew assigned
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, i) =>
                          row.type === "header" ? (
                            <tr key={i} style={{ backgroundColor: "#e0e0e0" }}>
                              <td
                                colSpan={4}
                                style={{
                                  ...cellStyle,
                                  fontWeight: "bold",
                                  textAlign: "center",
                                }}
                              >
                                {row.dept.toUpperCase()}
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={i}
                              style={{
                                backgroundColor:
                                  i % 2 === 0 ? "#fff" : "#fafafa",
                              }}
                            >
                              <td style={cellStyle}>
                                {row.position || row.crewDepartment || ""}
                              </td>
                              <td style={cellStyle}>
                                {row.displayName || row.name || ""}
                              </td>
                              <td style={cellStyle}>{row.phone || "—"}</td>
                              <td style={cellStyle}>
                                {callSheetData?.crewCallTimes?.[row.id] ||
                                  callSheetData?.crewCallTimes?.[
                                    row.personId
                                  ] ||
                                  callTime}
                              </td>
                            </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              fontSize: "7px",
              color: "#888",
              textAlign: "center",
              borderTop: "1px solid #ccc",
              paddingTop: "3px",
            }}
          >
            View only — edit on desktop
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Dashboard ─────────────────────────────────────────────────────────
function MobileDashboard({
  todoItems,
  shootingDays,
  scheduledScenes,
  scenes,
  actualLocations,
  scriptLocations,
  callSheetData,
  onToggleTodo,
  onNavigate,
}) {
  const today = new Date();
  const localToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
    .toISOString()
    .split("T")[0];

  const nextShootDay = shootingDays
    .filter((d) => d.date >= localToday && !d.isShot)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const nextShootScenesRaw = nextShootDay
    ? scheduledScenes[nextShootDay.date] || []
    : [];

  const nextShootScenes = nextShootScenesRaw.map((item) =>
    typeof item === "string" ? item : item.sceneNumber
  );

  const parseEighths = (pageStr) => {
    if (!pageStr) return 0;
    const parts = String(pageStr).trim().split(" ");
    if (parts.length === 1) {
      if (parts[0].includes("/")) return parseInt(parts[0].split("/")[0]);
      return parseInt(parts[0]) * 8;
    }
    return parseInt(parts[0]) * 8 + parseInt(parts[1].split("/")[0]);
  };

  const eighthsToStr = (e) => {
    const w = Math.floor(e / 8),
      r = e % 8;
    if (r === 0) return `${w}`;
    if (w === 0) return `${r}/8`;
    return `${w} ${r}/8`;
  };

  const totalEighths = nextShootScenes.reduce((total, sceneNum) => {
    const scene = scenes.find(
      (s) => String(s.sceneNumber) === String(sceneNum)
    );
    return total + parseEighths(scene?.pageLength || scene?.page_length);
  }, 0);
  const totalPages = eighthsToStr(totalEighths);

  const getFirstAddress = () => {
    for (const sceneNum of nextShootScenes) {
      const scriptLoc = scriptLocations.find(
        (sl) =>
          sl.scenes &&
          (sl.scenes.includes(parseInt(sceneNum)) ||
            sl.scenes.includes(String(sceneNum)))
      );
      if (scriptLoc?.actualLocationId) {
        const actual = actualLocations.find(
          (a) => a.id === scriptLoc.actualLocationId
        );
        if (actual?.address) {
          return [actual.address, actual.city, actual.state, actual.zipCode]
            .filter(Boolean)
            .join(", ");
        }
      }
    }
    return null;
  };
  const firstAddress = getFirstAddress();

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return new Date(
      parseInt(y),
      parseInt(m) - 1,
      parseInt(d)
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const incompleteTodos = (todoItems || []).filter((t) => !t.completed);

  return (
    <div>
      {/* Next Shoot Day */}
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: "bold",
            letterSpacing: "0.1em",
            color: "#2196F3",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Next Shoot Day
        </div>
        {!nextShootDay ? (
          <div
            style={{
              ...styles.card,
              padding: "20px",
              textAlign: "center",
              color: "#aaa",
              fontSize: "13px",
              fontStyle: "italic",
            }}
          >
            No upcoming shoot days scheduled
          </div>
        ) : (
          <div style={{ ...styles.card, border: "2px solid #2196F3" }}>
            <div
              style={{
                backgroundColor: "#2196F3",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Day {nextShootDay.dayNumber}
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "11px",
                    marginTop: "2px",
                  }}
                >
                  {formatDate(nextShootDay.date)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    color: "white",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {nextShootScenes.length} scene
                  {nextShootScenes.length !== 1 ? "s" : ""}
                </div>
                <div
                  style={{ color: "rgba(255,255,255,0.85)", fontSize: "11px" }}
                >
                  {totalPages} pages
                </div>
              </div>
            </div>
            {firstAddress && (
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid #e3f2fd",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "14px", flexShrink: 0 }}>📍</span>
                <div
                  style={{ fontSize: "12px", color: "#333", lineHeight: "1.4" }}
                >
                  {firstAddress}
                </div>
              </div>
            )}
            {nextShootScenes.length > 0 && (
              <div style={{ padding: "8px 14px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#888",
                    marginBottom: "5px",
                    fontWeight: "bold",
                  }}
                >
                  SCENES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {nextShootScenes.map((s) => (
                    <span
                      key={s}
                      style={{
                        backgroundColor: "#e3f2fd",
                        border: "1px solid #90caf9",
                        borderRadius: "3px",
                        padding: "2px 7px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#1565c0",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Sheet */}
      {nextShootDay && (
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              letterSpacing: "0.1em",
              color: "#2196F3",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Call Sheet
          </div>
          <div
            style={{ ...styles.card, cursor: "pointer" }}
            onClick={() => onNavigate("Call Sheet")}
          >
            <div
              style={{
                ...styles.cardHeader,
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={styles.cardTitle}>
                  Day {nextShootDay.dayNumber} Call Sheet
                </div>
                <div style={styles.cardSubtitle}>
                  {callSheetData?.callTime
                    ? `General Call: ${callSheetData.callTime}`
                    : "Tap to view call sheet"}
                </div>
              </div>
              <span style={{ fontSize: "18px", color: "#2196F3" }}>→</span>
            </div>
          </div>
        </div>
      )}

      {/* To-Do */}
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: "bold",
            letterSpacing: "0.1em",
            color: "#2196F3",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          To-Do ({incompleteTodos.length})
        </div>
        {incompleteTodos.length === 0 ? (
          <div
            style={{
              ...styles.card,
              padding: "20px",
              textAlign: "center",
              color: "#aaa",
              fontSize: "13px",
              fontStyle: "italic",
            }}
          >
            All tasks complete 🎉
          </div>
        ) : (
          <div style={styles.card}>
            {incompleteTodos.map((task, i) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  borderBottom:
                    i < incompleteTodos.length - 1 ? "1px solid #eee" : "none",
                }}
              >
                <div
                  onClick={() => onToggleTodo(task.id)}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "2px solid #2196F3",
                    flexShrink: 0,
                    marginTop: "1px",
                    cursor: "pointer",
                    backgroundColor: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#222",
                      marginBottom: "2px",
                    }}
                  >
                    {task.title || task.task || "Untitled"}
                  </div>
                  {task.dueDate && (
                    <div
                      style={{
                        fontSize: "11px",
                        color:
                          new Date(task.dueDate) < today ? "#e53935" : "#888",
                      }}
                    >
                      Due {formatDate(task.dueDate)}
                    </div>
                  )}
                  {task.priority && task.priority !== "Low" && (
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: "bold",
                        letterSpacing: "0.05em",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        marginTop: "3px",
                        display: "inline-block",
                        backgroundColor:
                          task.priority === "High" ? "#ffebee" : "#fff8e1",
                        color: task.priority === "High" ? "#c62828" : "#f57f17",
                      }}
                    >
                      {task.priority.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MobileApp({ initialPropId }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeModule, setActiveModule] = useState(initialPropId ? "Props" : "Dashboard");
  const [castCrew, setCastCrew] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [shootingDays, setShootingDays] = useState([]);
  const [scheduledScenes, setScheduledScenes] = useState({});
  const [scenes, setScenes] = useState([]);
  const [actualLocations, setActualLocations] = useState([]);
  const [scriptLocations, setScriptLocations] = useState([]);
  const [callSheetData, setCallSheetData] = useState({});
  const [characters, setCharacters] = useState({});
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [projectSettings, setProjectSettings] = useState({});
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
    database.loadCharactersFromDatabase(selectedProject, setCharacters);
  }, [selectedProject?.id]);

  // Load cast crew when project selected
  useEffect(() => {
    if (!selectedProject) return;
    database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    database.loadTodoItemsFromDatabase(selectedProject, setTodoItems);
    database.loadShootingDaysFromDatabase(selectedProject, setShootingDays);
    database.loadScheduledScenesFromDatabase(
      selectedProject,
      setScheduledScenes
    );
    database.loadScenesFromDatabase(selectedProject, setScenes, () => {}, null);
    database.loadActualLocationsFromDatabase(
      selectedProject,
      setActualLocations
    );
    database.loadScriptLocationsFromDatabase(
      selectedProject,
      setScriptLocations
    );
    database.loadCallSheetDataFromDatabase(selectedProject, setCallSheetData);
    database.loadWardrobeItemsFromDatabase(selectedProject, (items) =>
      setWardrobeItems(items || [])
    );
    database.loadProjectSettingsFromDatabase(
      selectedProject,
      setProjectSettings,
      () => {}
    );
  }, [selectedProject?.id]);

  const handleToggleTodo = async (taskId) => {
    const updated = todoItems.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTodoItems(updated);
    try {
      await database.syncTodoItemsToDatabase(selectedProject, updated);
    } catch (e) {
      console.error("Failed to toggle todo:", e);
    }
  };

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
        {activeModule === "Dashboard" && (
          <MobileDashboard
            selectedProject={selectedProject}
            todoItems={todoItems}
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            scenes={scenes}
            actualLocations={actualLocations}
            scriptLocations={scriptLocations}
            callSheetData={callSheetData}
            onToggleTodo={handleToggleTodo}
            onNavigate={(module) => setActiveModule(module)}
          />
        )}
        {activeModule === "Call Sheet" && (
          <MobileCallSheetModule
            selectedProject={selectedProject}
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            scenes={scenes}
            castCrew={castCrew}
            characters={characters}
            wardrobeItems={wardrobeItems}
            actualLocations={actualLocations}
            scriptLocations={scriptLocations}
            callSheetData={callSheetData}
            projectSettings={projectSettings}
          />
        )}
        {activeModule === "Wardrobe" && (
          <MobileWardrobeModule
            selectedProject={selectedProject}
            characters={characters}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
          />
        )}
        {activeModule === "Props" && (
          <MobilePropsModule
            selectedProject={selectedProject}
            scenes={scenes}
            characters={characters}
            initialPropId={initialPropId}
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
