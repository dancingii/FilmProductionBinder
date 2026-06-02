import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { readProjectCacheForDiagnostics } from "../../utils/projectCacheManager";
import StorageRecoveryImportModal from "./StorageRecoveryImportModal";

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

// ─── Storage Diagnostics ─────────────────────────────────────────────────────

// Registry: maps key prefixes to human-readable module names and expected sizes.
// "large" = can be hundreds of KB or more; "tiny" = always small.
// Order matters: first matching prefix wins.
const KEY_REGISTRY = [
  // Auth — protected, never show value
  { prefix: "sb-",                                    module: "Auth / Supabase",         workflow: "Core",          size: "tiny",  critical: true,  auth: true,  projectScoped: false },
  // Writing Script — draft nodes
  { prefix: "writingScriptDraft:",                    module: "Writing Script",          workflow: "Writing",       size: "large", critical: false, legacy: false, projectScoped: true  },
  { prefix: "scriptWritingDraft:",                    module: "Writing Script",          workflow: "Writing",       size: "large", critical: false, legacy: true,  projectScoped: true  },
  // Writing Script — prefs/settings
  { prefix: "writingScriptBeats:",                    module: "Writing Script",          workflow: "Writing",       size: "medium", critical: false, projectScoped: true  },
  { prefix: "scriptBeats:",                           module: "Writing Script",          workflow: "Writing",       size: "medium", critical: false, legacy: true,  projectScoped: true  },
  { prefix: "writingScriptSidePanelTab:",             module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "writingScriptCollapsedActs:",            module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "writingScriptTimelineSettings:",         module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "writingScriptMoodOverlay:",              module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "writingScriptTargetPageCount:",          module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "writingScriptEditorPosition:",           module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  // Writing Script — dictionary / title page
  { prefix: "writingSpellcheckDictionary:",           module: "Writing Script",          workflow: "Writing",       size: "medium", critical: false, projectScoped: true  },
  { prefix: "writingTitlePageSettings:",              module: "Writing Script",          workflow: "Writing",       size: "tiny",  critical: false, projectScoped: true  },
  // Writing Characters
  { prefix: "writingCharacterProfiles:",              module: "Writing Characters",      workflow: "Writing",       size: "medium", critical: false, projectScoped: true  },
  // MoodBoard
  { prefix: "filmProductionBinder:moodboard:",        module: "MoodBoard",               workflow: "Pre-Production", size: "large", critical: false, projectScoped: true  },
  // Script (production)
  { prefix: "scriptMoodOverlayEnabled",               module: "Script (Production)",     workflow: "Production",    size: "tiny",  critical: false, legacy: true,  projectScoped: false },
  { prefix: "scriptMoodOverlaySettings",              module: "Script (Production)",     workflow: "Production",    size: "tiny",  critical: false, legacy: true,  projectScoped: false },
  { prefix: "scriptMoodOverlayEnabled:",              module: "Script (Production)",     workflow: "Production",    size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "scriptMoodOverlaySettings:",             module: "Script (Production)",     workflow: "Production",    size: "tiny",  critical: false, projectScoped: true  },
  { prefix: "scriptTimelinePositions:",               module: "Script (Production)",     workflow: "Production",    size: "medium", critical: false, projectScoped: true  },
  // Stripboard
  { prefix: "stripboard_prefs_v1",                    module: "Stripboard",              workflow: "Production",    size: "tiny",  critical: false, projectScoped: false },
  // Calendar
  { prefix: "calendarExpandedSections",               module: "Calendar",                workflow: "Production",    size: "tiny",  critical: false, projectScoped: false },
  // Timeline
  { prefix: "timeline-view-collapsed-",               module: "Timeline",                workflow: "Production",    size: "tiny",  critical: false, projectScoped: true  },
  // Database maintenance
  { prefix: "lastAvailabilityCleanup_",               module: "Database Maintenance",    workflow: "Core",          size: "tiny",  critical: false, projectScoped: true  },
  // Dev tools
  { prefix: "filmProductionBinder:devBacklog",        module: "Dev Backlog",             workflow: "Dev",           size: "tiny",  critical: false, projectScoped: false },
  // Emergency backups — local-only project backup markers written during failed project exit flush
  { prefix: "fpb:emergencyBackup:",                   module: "Emergency Backup",        workflow: "Core",          size: "tiny",  critical: true,  emergencyBackup: true, projectScoped: true },
];

// Prefixes that embed project ID after the colon — extract it for project-scope labeling.
const PROJECT_ID_SEPARATOR_PREFIXES = [
  "writingScriptDraft:",
  "scriptWritingDraft:",
  "writingScriptBeats:",
  "scriptBeats:",
  "writingScriptSidePanelTab:",
  "writingScriptCollapsedActs:",
  "writingScriptTimelineSettings:",
  "writingScriptMoodOverlay:",
  "writingScriptTargetPageCount:",
  "writingScriptEditorPosition:",
  "writingSpellcheckDictionary:",
  "writingTitlePageSettings:",
  "writingCharacterProfiles:",
  "filmProductionBinder:moodboard:",
  "scriptMoodOverlayEnabled:",
  "scriptMoodOverlaySettings:",
  "scriptTimelinePositions:",
  "lastAvailabilityCleanup_",
  "timeline-view-collapsed-",
  "fpb:emergencyBackup:",
];

const QUOTA_WARNING_BYTES = 4_000_000; // warn if >4MB used (5MB typical limit)
const LARGE_KEY_BYTES     = 100_000;   // flag individual keys >100KB

function classifyKey(key) {
  for (const entry of KEY_REGISTRY) {
    if (key.startsWith(entry.prefix)) return entry;
  }
  return null;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// Extract project ID from a key, if that key embeds one after a prefix separator.
function inferProjectId(key) {
  for (const prefix of PROJECT_ID_SEPARATOR_PREFIXES) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length);
      // Some keys use : as a second separator (e.g. writingSpellcheckDictionary:user:userId)
      // In that case we don't want to infer a project ID — return null.
      if (prefix === "writingSpellcheckDictionary:" && rest.startsWith("user:")) return null;
      return rest || null;
    }
  }
  return null;
}

// Determine the project scope label for an entry relative to the current project.
function projectScopeLabel(entry, currentProjectId) {
  const info = entry.info;
  if (info?.auth) return "auth";
  if (info?.emergencyBackup) return "emergency-backup";
  if (!info?.projectScoped) return "global";
  const pid = entry.projectId;
  if (!pid) return "global";
  if (!currentProjectId) return "project";
  return pid === currentProjectId ? "current" : "other";
}

function scanLocalStorage(currentProjectId) {
  const entries = [];
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      let valueLen = 0;
      let valueSample = "";
      let rawValue = null;
      try {
        rawValue = localStorage.getItem(key);
        valueLen = rawValue ? rawValue.length : 0;
        const info = classifyKey(key);
        if (info?.auth) {
          valueSample = "[auth token — hidden]";
        } else {
          valueSample = rawValue ? rawValue.slice(0, 120) + (rawValue.length > 120 ? "…" : "") : "";
        }
      } catch {}
      total += key.length + valueLen;
      const info = classifyKey(key);
      const projectId = inferProjectId(key);
      entries.push({ key, valueLen, valueSample, rawValue, info, projectId, scopeLabel: projectScopeLabel({ info, projectId }, currentProjectId) });
    }
  } catch {}
  return { entries, total };
}

// ── IndexedDB reader (read-only, for backup/diagnostics) ──────────────────────

function openIdbReadOnly(dbName, version) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(dbName, version);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => { /* read-only open, should not upgrade */ };
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
    req.onblocked = () => reject(new Error("IDB open blocked"));
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("IDB getAll failed"));
    } catch (e) {
      reject(e);
    }
  });
}

async function readIndexedDbForBackup() {
  const DB_METAS = [
    { name: "FilmProductionBinderWritingDrafts",  version: 1, stores: ["drafts"] },
    { name: "FilmProductionBinderEmergencyBackups", version: 1, stores: ["backups"] },
    { name: "FilmProductionBinderProjectCache",    version: 1, stores: ["currentProjectCache", "projectCacheVersions", "projectCacheConflicts"] },
  ];
  const result = { databases: [] };
  for (const dbMeta of DB_METAS) {
    try {
      const db = await openIdbReadOnly(dbMeta.name, dbMeta.version);
      const storeResults = [];
      for (const storeName of dbMeta.stores) {
        try {
          const records = await idbGetAll(db, storeName);
          const serialized = JSON.stringify(records);
          storeResults.push({
            store: storeName,
            recordCount: records.length,
            sizeBytes: serialized.length,
            records,
          });
        } catch (e) {
          storeResults.push({ store: storeName, error: String(e), recordCount: 0, records: [] });
        }
      }
      db.close();
      result.databases.push({ name: dbMeta.name, stores: storeResults });
    } catch (e) {
      result.databases.push({ name: dbMeta.name, error: String(e), stores: [] });
    }
  }
  return result;
}

// ── Backup generation ─────────────────────────────────────────────────────────

async function generateBackup(currentProjectId, currentProjectName, lsScan) {
  const { entries, total } = lsScan;

  const lsEntries = entries.map(e => {
    const isAuth = e.info?.auth || e.key.startsWith("sb-");
    return {
      key: e.key,
      sizeBytes: e.valueLen,
      module: e.info?.module || "unknown",
      workflow: e.info?.workflow || "unknown",
      projectId: e.projectId || null,
      scopeLabel: e.scopeLabel,
      flags: {
        auth: isAuth || false,
        legacy: e.info?.legacy || false,
        oversized: e.valueLen >= LARGE_KEY_BYTES,
        unregistered: !e.info,
        projectScoped: e.info?.projectScoped || false,
      },
      value: isAuth ? "[hidden-auth-token]" : e.rawValue,
    };
  });

  const ssEntries = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      const isAuth = key.startsWith("sb-");
      let value = null;
      let sizeBytes = 0;
      try {
        const raw = sessionStorage.getItem(key);
        sizeBytes = raw ? raw.length : 0;
        value = isAuth ? "[hidden-auth-token]" : raw;
      } catch {}
      ssEntries.push({ key, sizeBytes, value, flags: { auth: isAuth } });
    }
  } catch {}

  const idbData = await readIndexedDbForBackup();

  return {
    meta: {
      tool: "FilmProductionBinder Storage Backup",
      generatedAt: new Date().toISOString(),
      currentProjectId: currentProjectId || null,
      currentProjectName: currentProjectName || null,
      localStorageTotalBytes: total,
    },
    localStorage: {
      totalBytes: total,
      keyCount: lsEntries.length,
      entries: lsEntries,
    },
    sessionStorage: {
      keyCount: ssEntries.length,
      entries: ssEntries,
    },
    indexedDB: idbData,
  };
}

function downloadJson(obj, filename) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── Main StorageDiagnosticsTab ────────────────────────────────────────────────

function StorageDiagnosticsTab({ currentProject }) {
  const currentProjectId = currentProject?.id || null;
  const currentProjectName = currentProject?.name || null;

  const [scan, setScan] = useState(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [sortBy, setSortBy] = useState("size-desc");
  const [filterBy, setFilterBy] = useState("all");
  const [idbDiag, setIdbDiag] = useState(null);
  const [idbDiagLoading, setIdbDiagLoading] = useState(false);

  const refresh = useCallback(() => setScan(scanLocalStorage(currentProjectId)), [currentProjectId]);

  const refreshIdbDiag = useCallback(async () => {
    setIdbDiagLoading(true);
    try {
      const diag = await readProjectCacheForDiagnostics();
      setIdbDiag(diag);
    } catch (err) {
      setIdbDiag({ currentCache: [], versions: [], conflicts: [], error: err?.message });
    } finally {
      setIdbDiagLoading(false);
    }
  }, []);

  // Load IDB diagnostics once on mount.
  useEffect(() => { refreshIdbDiag(); }, [refreshIdbDiag]);

  const hasScanned = useRef(false);
  if (!hasScanned.current) {
    hasScanned.current = true;
    setScan(scanLocalStorage(currentProjectId));
  }

  const handleExport = useCallback(async () => {
    if (!scan) return;
    setExporting(true);
    try {
      const backup = await generateBackup(currentProjectId, currentProjectName, scan);
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const projSlug = currentProjectId ? `-${currentProjectId.slice(0, 8)}` : "";
      downloadJson(backup, `fpb-storage-backup${projSlug}-${ts}.json`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[StorageDiagnostics] Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [scan, currentProjectId, currentProjectName]);

  if (!scan) return <div style={{ padding: "20px", color: "#888", fontSize: "12px" }}>Scanning…</div>;

  const { entries, total } = scan;
  const overQuota = total >= QUOTA_WARNING_BYTES;
  const unknown = entries.filter(e => !e.info);
  const oversized = entries.filter(e => e.valueLen >= LARGE_KEY_BYTES && !e.info?.auth);

  // Apply filter
  const filteredEntries = entries.filter(e => {
    if (filterBy === "all") return true;
    if (filterBy === "current") return e.scopeLabel === "current";
    if (filterBy === "other") return e.scopeLabel === "other";
    if (filterBy === "global") return e.scopeLabel === "global";
    if (filterBy === "auth") return e.scopeLabel === "auth";
    if (filterBy === "unknown") return !e.info;
    if (filterBy === "oversized") return e.valueLen >= LARGE_KEY_BYTES && !e.info?.auth;
    if (filterBy === "legacy") return e.info?.legacy;
    if (filterBy === "emergency") return e.scopeLabel === "emergency-backup";
    return true;
  });

  // Apply sort
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === "size-desc") return b.valueLen - a.valueLen;
    if (sortBy === "size-asc") return a.valueLen - b.valueLen;
    if (sortBy === "key-az") return a.key.localeCompare(b.key);
    if (sortBy === "module") return (a.info?.module || "zzz").localeCompare(b.info?.module || "zzz");
    if (sortBy === "workflow") return (a.info?.workflow || "zzz").localeCompare(b.info?.workflow || "zzz");
    if (sortBy === "project") return (a.projectId || "zzz").localeCompare(b.projectId || "zzz");
    if (sortBy === "risk") {
      const risk = (e) => (e.valueLen >= LARGE_KEY_BYTES ? 4 : 0) + (!e.info ? 2 : 0) + (e.info?.legacy ? 1 : 0);
      return risk(b) - risk(a);
    }
    return 0;
  });

  // For the grouped view (only when sort=workflow or no specific sort override)
  const useGrouped = sortBy === "workflow";
  const groups = {};
  if (useGrouped) {
    for (const entry of sortedEntries) {
      const wf = entry.info?.workflow || "Unknown / Unregistered";
      if (!groups[wf]) groups[wf] = [];
      groups[wf].push(entry);
    }
  }

  const buildReport = () => {
    const lines = [
      `FilmProductionBinder Storage Diagnostics`,
      `Generated: ${new Date().toISOString()}`,
      `Current project: ${currentProjectId ? `${currentProjectName || ""} (${currentProjectId})` : "none"}`,
      `Total localStorage usage: ${fmtBytes(total)}`,
      `Quota warning: ${overQuota ? "YES — approaching 5MB limit" : "No"}`,
      `Unregistered keys: ${unknown.length}`,
      `Oversized keys (>100KB): ${oversized.length}`,
      `Total keys: ${entries.length}`,
      "",
    ];
    // Group by workflow for report
    const reportGroups = {};
    for (const e of entries) {
      const wf = e.info?.workflow || "Unknown / Unregistered";
      if (!reportGroups[wf]) reportGroups[wf] = [];
      reportGroups[wf].push(e);
    }
    for (const [wf, items] of Object.entries(reportGroups)) {
      lines.push(`=== ${wf} ===`);
      for (const e of items) {
        const flags = [
          e.info?.legacy ? "LEGACY" : null,
          e.info?.auth ? "AUTH-PROTECTED" : null,
          e.info?.emergencyBackup ? "EMERGENCY-BACKUP" : null,
          e.valueLen >= LARGE_KEY_BYTES ? "OVERSIZED" : null,
          !e.info ? "UNREGISTERED" : null,
          e.scopeLabel === "current" ? "CURRENT-PROJECT" : null,
          e.scopeLabel === "other" ? `OTHER-PROJECT(${e.projectId || "?"})` : null,
        ].filter(Boolean).join(", ");
        lines.push(`  ${e.key}`);
        lines.push(`    Size: ${fmtBytes(e.valueLen)}  Module: ${e.info?.module || "unknown"}${flags ? `  Flags: ${flags}` : ""}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  };

  const copyReport = () => {
    try {
      navigator.clipboard.writeText(buildReport()).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {}
  };

  const scopeBadgeStyle = (label) => {
    const colors = {
      current: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7" },
      other: { bg: "#fce4ec", color: "#880e4f", border: "#f48fb1" },
      global: { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9" },
      auth: { bg: "#fff3e0", color: "#e65100", border: "#ffcc80" },
      project: { bg: "#f3e5f5", color: "#6a1b9a", border: "#ce93d8" },
      "emergency-backup": { bg: "#fbe9e7", color: "#bf360c", border: "#ff8a65" },
    };
    const c = colors[label] || { bg: "#f5f5f5", color: "#555", border: "#ccc" };
    return {
      display: "inline-block", padding: "1px 5px", borderRadius: "3px", fontSize: "9px",
      fontWeight: "bold", backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`,
      marginLeft: "5px", verticalAlign: "middle", textTransform: "uppercase", letterSpacing: "0.03em",
    };
  };

  const rowStyle = (entry) => ({
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "4px 12px",
    padding: "4px 6px",
    borderRadius: "3px",
    marginBottom: "2px",
    backgroundColor: entry.info?.emergencyBackup
      ? "#fbe9e7"
      : entry.info?.auth
        ? "#fff3e0"
        : entry.valueLen >= LARGE_KEY_BYTES
          ? "#ffebee"
          : entry.info?.legacy
            ? "#f3f3f3"
            : !entry.info
              ? "#fff8e1"
              : "transparent",
    fontSize: "11px",
    fontFamily: "monospace",
    wordBreak: "break-all",
  });

  const btnBase = { fontSize: "11px", padding: "3px 8px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" };

  return (
    <>
      <StorageRecoveryImportModal open={showImport} onClose={() => setShowImport(false)} currentProject={currentProject} context="devBacklog" />
      <div style={{ padding: "10px 14px", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}>

        {/* Summary bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
          padding: "8px 10px", borderRadius: "6px", marginBottom: "8px",
          backgroundColor: overQuota ? "#ffebee" : "#e8f5e9",
          border: `1px solid ${overQuota ? "#ef9a9a" : "#a5d6a7"}`,
          fontSize: "11px",
        }}>
          <span style={{ fontWeight: "bold", fontSize: "12px" }}>
            localStorage: {fmtBytes(total)}
          </span>
          {overQuota && <span style={{ color: "#c62828", fontWeight: "bold" }}>⚠ Approaching 5MB quota — auth at risk</span>}
          <span style={{ color: "#555" }}>{entries.length} keys</span>
          {currentProjectId && <span style={{ color: "#1565c0" }}>Project: {currentProjectName || currentProjectId.slice(0, 8)}</span>}
          {oversized.length > 0 && <span style={{ color: "#e65100" }}>{oversized.length} oversized</span>}
          {unknown.length > 0 && <span style={{ color: "#6a1b9a" }}>{unknown.length} unregistered</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <button onClick={refresh} style={btnBase}>Refresh</button>
            <button onClick={copyReport} style={btnBase}>{copied ? "Copied!" : "Copy Report"}</button>
            <button onClick={handleExport} disabled={exporting} style={{ ...btnBase, backgroundColor: "#e3f2fd", borderColor: "#90caf9", color: "#0d47a1" }}>
              {exporting ? "Exporting…" : "Export Backup"}
            </button>
            <button onClick={() => setShowImport(true)} style={{ ...btnBase, backgroundColor: "#f3e5f5", borderColor: "#ce93d8", color: "#6a1b9a" }}>
              Import Preview
            </button>
          </div>
        </div>

        {/* Sort + Filter controls */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "8px", alignItems: "center", fontSize: "11px" }}>
          <span style={{ color: "#888", fontWeight: "bold" }}>Sort:</span>
          {[
            { v: "size-desc", label: "Size ↓" },
            { v: "size-asc", label: "Size ↑" },
            { v: "key-az", label: "Key A–Z" },
            { v: "module", label: "Module" },
            { v: "workflow", label: "Workflow (grouped)" },
            { v: "project", label: "Project ID" },
            { v: "risk", label: "Risk" },
          ].map(opt => (
            <button key={opt.v} onClick={() => setSortBy(opt.v)} style={{
              ...btnBase, padding: "2px 6px",
              backgroundColor: sortBy === opt.v ? "#1a1a2e" : "#f5f5f5",
              color: sortBy === opt.v ? "white" : "#333",
              borderColor: sortBy === opt.v ? "#1a1a2e" : "#ccc",
            }}>{opt.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center", fontSize: "11px" }}>
          <span style={{ color: "#888", fontWeight: "bold" }}>Filter:</span>
          {[
            { v: "all", label: `All (${entries.length})` },
            { v: "current", label: `Current project (${entries.filter(e => e.scopeLabel === "current").length})` },
            { v: "other", label: `Other projects (${entries.filter(e => e.scopeLabel === "other").length})` },
            { v: "global", label: `Global (${entries.filter(e => e.scopeLabel === "global").length})` },
            { v: "auth", label: `Auth (${entries.filter(e => e.scopeLabel === "auth").length})` },
            { v: "unknown", label: `Unknown (${unknown.length})` },
            { v: "oversized", label: `Oversized (${oversized.length})` },
            { v: "legacy", label: `Legacy (${entries.filter(e => e.info?.legacy).length})` },
            { v: "emergency", label: `Emergency Backup (${entries.filter(e => e.scopeLabel === "emergency-backup").length})` },
          ].map(opt => (
            <button key={opt.v} onClick={() => setFilterBy(opt.v)} style={{
              ...btnBase, padding: "2px 6px",
              backgroundColor: filterBy === opt.v ? "#e3f2fd" : "#f5f5f5",
              color: filterBy === opt.v ? "#0d47a1" : "#333",
              borderColor: filterBy === opt.v ? "#90caf9" : "#ccc",
            }}>{opt.label}</button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px", fontSize: "10px" }}>
          {[
            { color: "#ffebee", label: "Oversized (>100KB)" },
            { color: "#fff3e0", label: "Auth (value hidden)" },
            { color: "#fff8e1", label: "Unregistered" },
            { color: "#f3f3f3", label: "Legacy key" },
            { color: "#fbe9e7", label: "Emergency Backup" },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "12px", height: "12px", backgroundColor: color, border: "1px solid #ddd", borderRadius: "2px", display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>

        {/* Entry list */}
        {filteredEntries.length === 0 && (
          <div style={{ color: "#888", fontSize: "12px", padding: "20px 0" }}>No entries match this filter.</div>
        )}

        {useGrouped ? (
          Object.entries(groups).map(([wf, items]) => {
            const wfTotal = items.reduce((n, e) => n + e.valueLen, 0);
            return (
              <div key={wf} style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span>{wf}</span>
                  <span style={{ fontWeight: "normal", color: "#888" }}>{fmtBytes(wfTotal)} — {items.length} key{items.length !== 1 ? "s" : ""}</span>
                </div>
                {items.map(entry => <EntryRow key={entry.key} entry={entry} scopeBadgeStyle={scopeBadgeStyle} rowStyle={rowStyle} />)}
              </div>
            );
          })
        ) : (
          <div>
            {sortedEntries.map(entry => <EntryRow key={entry.key} entry={entry} scopeBadgeStyle={scopeBadgeStyle} rowStyle={rowStyle} />)}
          </div>
        )}

        {/* ── IndexedDB Project Cache diagnostics ─── */}
        <div style={{ marginTop: "16px", borderTop: "1px solid #e0e0e0", paddingTop: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>
              IndexedDB — FilmProductionBinderProjectCache
            </span>
            <button onClick={refreshIdbDiag} disabled={idbDiagLoading} style={{ ...btnBase, padding: "2px 7px", fontSize: "10px" }}>
              {idbDiagLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {!idbDiag && !idbDiagLoading && (
            <div style={{ fontSize: "11px", color: "#aaa" }}>Not yet loaded.</div>
          )}
          {idbDiagLoading && (
            <div style={{ fontSize: "11px", color: "#888" }}>Reading IndexedDB…</div>
          )}
          {idbDiag && !idbDiagLoading && (
            <>
              {idbDiag.error && (
                <div style={{ fontSize: "11px", color: "#c62828", marginBottom: "6px" }}>
                  Error reading project cache DB: {idbDiag.error}
                </div>
              )}
              {!idbDiag.error && (
                <div style={{ fontSize: "11px", display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <span><strong>{idbDiag.currentCache.length}</strong> current-cache records</span>
                  <span><strong>{idbDiag.versions.length}</strong> version snapshots</span>
                  <span style={{ color: idbDiag.conflicts.filter(c => c.status === "unresolved").length > 0 ? "#c62828" : "#555" }}>
                    <strong>{idbDiag.conflicts.filter(c => c.status === "unresolved").length}</strong> unresolved conflicts
                    {idbDiag.conflicts.length > 0 && ` (${idbDiag.conflicts.length} total)`}
                  </span>
                </div>
              )}

              {/* Current cache records */}
              {idbDiag.currentCache.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>Current Cache</div>
                  <div style={{ border: "1px solid #e8e8e8", borderRadius: "4px", overflow: "hidden" }}>
                    {idbDiag.currentCache.map(r => (
                      <div key={r.id} style={{ display: "flex", gap: "8px", padding: "3px 8px", borderBottom: "1px solid #f0f0f0", fontSize: "10px", fontFamily: "monospace", alignItems: "center" }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.projectId === currentProjectId ? "#2e7d32" : "#555" }}>
                          {r.moduleKey}
                        </span>
                        <span style={{ color: "#888", whiteSpace: "nowrap" }}>{r.projectId?.slice(0, 8) || "?"}</span>
                        <span style={{ color: "#999", whiteSpace: "nowrap" }}>{r.sizeBytes != null ? fmtBytes(r.sizeBytes) : "—"}</span>
                        <span style={{ color: "#bbb", whiteSpace: "nowrap" }}>{r.updatedAt ? r.updatedAt.slice(0, 16).replace("T", " ") : "—"}</span>
                        <span style={{ color: "#aaa", whiteSpace: "nowrap", fontSize: "9px" }}>{r.source || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Version snapshots */}
              {idbDiag.versions.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#666", textTransform: "uppercase", marginBottom: "3px" }}>Version Snapshots (newest first, max 3/module)</div>
                  <div style={{ border: "1px solid #e8e8e8", borderRadius: "4px", overflow: "hidden" }}>
                    {[...idbDiag.versions].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map(r => (
                      <div key={r.id} style={{ display: "flex", gap: "8px", padding: "3px 8px", borderBottom: "1px solid #f0f0f0", fontSize: "10px", fontFamily: "monospace", alignItems: "center" }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.moduleKey}</span>
                        <span style={{ color: "#888", whiteSpace: "nowrap" }}>{r.projectId?.slice(0, 8) || "?"}</span>
                        <span style={{ color: "#1565c0", fontSize: "9px", whiteSpace: "nowrap" }}>{r.reason || "—"}</span>
                        <span style={{ color: "#999", whiteSpace: "nowrap" }}>{r.sizeBytes != null ? fmtBytes(r.sizeBytes) : "—"}</span>
                        <span style={{ color: "#bbb", whiteSpace: "nowrap" }}>{r.createdAt ? r.createdAt.slice(0, 16).replace("T", " ") : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflict records */}
              {idbDiag.conflicts.length > 0 && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#c62828", textTransform: "uppercase", marginBottom: "3px" }}>Conflicts</div>
                  <div style={{ border: "1px solid #ef9a9a", borderRadius: "4px", overflow: "hidden" }}>
                    {idbDiag.conflicts.map(r => (
                      <div key={r.id} style={{ display: "flex", gap: "8px", padding: "3px 8px", borderBottom: "1px solid #fce4ec", fontSize: "10px", fontFamily: "monospace", alignItems: "center", backgroundColor: r.status === "unresolved" ? "#fff8f8" : "transparent" }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.moduleKey}</span>
                        <span style={{ color: "#888", whiteSpace: "nowrap" }}>{r.projectId?.slice(0, 8) || "?"}</span>
                        <span style={{ color: "#e53935", fontSize: "9px", whiteSpace: "nowrap" }}>{r.reason || "—"}</span>
                        <span style={{ color: r.status === "unresolved" ? "#c62828" : "#4caf50", fontWeight: "bold", fontSize: "9px", whiteSpace: "nowrap" }}>{r.status}</span>
                        <span style={{ color: "#bbb", whiteSpace: "nowrap" }}>{r.createdAt ? r.createdAt.slice(0, 16).replace("T", " ") : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {idbDiag.currentCache.length === 0 && idbDiag.versions.length === 0 && idbDiag.conflicts.length === 0 && !idbDiag.error && (
                <div style={{ fontSize: "11px", color: "#aaa" }}>No records yet — DB is empty. Project cache records appear here after the first cache write.</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function EntryRow({ entry, scopeBadgeStyle, rowStyle }) {
  return (
    <div style={rowStyle(entry)}>
      <div>
        <div style={{ fontWeight: "bold", fontSize: "10px", marginBottom: "1px" }}>
          {entry.key}
          {entry.scopeLabel && entry.scopeLabel !== "auth" && (
            <span style={scopeBadgeStyle(entry.scopeLabel)}>{entry.scopeLabel}</span>
          )}
          {entry.info?.legacy && <span style={{ marginLeft: "6px", color: "#888", fontWeight: "normal", fontSize: "9px" }}>[legacy]</span>}
          {entry.info?.auth && <span style={{ marginLeft: "6px", color: "#e65100", fontWeight: "normal", fontSize: "9px" }}>[auth — value hidden]</span>}
          {entry.info?.emergencyBackup && <span style={{ marginLeft: "6px", color: "#bf360c", fontWeight: "bold", fontSize: "9px" }}>⚠ LOCAL BACKUP — pending sync</span>}
          {!entry.info && <span style={{ marginLeft: "6px", color: "#6a1b9a", fontWeight: "normal", fontSize: "9px" }}>[unregistered]</span>}
          {entry.valueLen >= LARGE_KEY_BYTES && !entry.info?.auth && (
            <span style={{ marginLeft: "6px", color: "#c62828", fontWeight: "bold", fontSize: "9px" }}>⚠ LARGE</span>
          )}
        </div>
        {!entry.info?.auth && entry.valueSample && (
          <div style={{ fontSize: "10px", color: "#777", fontFamily: "monospace", marginTop: "1px" }}>
            {entry.valueSample}
          </div>
        )}
        <div style={{ fontSize: "10px", color: "#aaa", marginTop: "1px" }}>
          {entry.info?.module || "unknown module"}{entry.projectId ? ` · ${entry.projectId}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", whiteSpace: "nowrap", color: entry.valueLen >= LARGE_KEY_BYTES ? "#c62828" : "#555" }}>
        {fmtBytes(entry.valueLen)}
      </div>
    </div>
  );
}

export default function DevBacklogPortal({ userEmail, currentProject = null, open: controlledOpen = null, onOpenChange = null, hideTrigger = false }) {
  const isDev =
    process.env.NODE_ENV === "development" ||
    userEmail === DEV_USER_EMAIL;

  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("backlog");
  const [backlog, setBacklog] = useState(() => loadBacklog());
  const [newItemText, setNewItemText] = useState({});
  const [newCatText, setNewCatText] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editItemText, setEditItemText] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryTitle, setEditCategoryTitle] = useState("");
  const [showCompleted, setShowCompletedState] = useState(() => loadShowCompleted());
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
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
              height: "80vh",
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
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {[
                  { id: "backlog", label: `Backlog ${doneItems}/${totalItems}` },
                  { id: "storage", label: "Storage" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "4px 10px", border: "none", borderRadius: "4px", cursor: "pointer",
                      fontSize: "11px", fontWeight: "bold", fontFamily: "inherit",
                      backgroundColor: activeTab === tab.id ? "rgba(255,255,255,0.2)" : "transparent",
                      color: activeTab === tab.id ? "white" : "#aaaacc",
                    }}
                  >{tab.label}</button>
                ))}
                {activeTab === "backlog" && (
                  <label style={{ marginLeft: "10px", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#d8d8ff", fontWeight: "normal" }}>
                    <input
                      type="checkbox"
                      checked={showCompleted}
                      onChange={e => setShowCompleted(e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    Show completed
                  </label>
                )}
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
            {activeTab === "storage" ? (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <StorageDiagnosticsTab currentProject={currentProject} />
              </div>
            ) : null}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: activeTab === "backlog" ? undefined : "none" }}>

              {/* Category filter tabs */}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginBottom: "12px",
                paddingBottom: "10px",
                borderBottom: "1px solid #eee",
              }}>
                {[{ id: "all", title: "All" }, ...backlog.categories].map(cat => {
                  const isAll = cat.id === "all";
                  const tabDone = isAll
                    ? backlog.categories.reduce((n, c) => n + c.items.filter(i => i.done).length, 0)
                    : cat.items.filter(i => i.done).length;
                  const tabTotal = isAll
                    ? backlog.categories.reduce((n, c) => n + c.items.length, 0)
                    : cat.items.length;
                  const isActive = activeCategoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategoryFilter(cat.id)}
                      style={{
                        fontSize: "10px",
                        padding: "3px 8px",
                        border: `1px solid ${isActive ? "#1a1a2e" : "#ccc"}`,
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: isActive ? "#1a1a2e" : "#f5f5f5",
                        color: isActive ? "white" : "#333",
                        fontFamily: "inherit",
                        fontWeight: isActive ? "bold" : "normal",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.title} {tabDone}/{tabTotal}
                    </button>
                  );
                })}
              </div>

              {backlog.categories
                .filter(cat => activeCategoryFilter === "all" || cat.id === activeCategoryFilter)
                .map(cat => {
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
