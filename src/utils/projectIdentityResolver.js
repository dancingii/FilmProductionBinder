// Project Identity Resolver
//
// Builds a multi-identifier index for Supabase projects so that backup script
// candidates can be matched against a project even when the candidate's UUID
// differs from the current Supabase project.id (e.g., post-migration drift,
// renamed projects, legacy key suffixes, orphan IDB records, etc.).
//
// READ-ONLY. Never writes, never opens projects, never calls setSelectedProject.
//
// Identity sources collected per project:
//   • project.id                          (Supabase UUID — authoritative)
//   • project.name                        (display name)
//   • normalized/lowercased/slug forms    (fuzzy name matching)
//   • IDs found in current localStorage keys scoped to this project
//   • IDs found in current IDB WritingDrafts records
//   • IDs found in current ProjectCache records
//   • IDs found in current emergency backup markers
//
// Scoring tiers:
//   high      — exact UUID match via key/payload/entry projectId
//   medium    — exact project name match, or UUID found in a related key
//   low       — fuzzy name match, orphan candidate with plausible timeframe
//   none      — marker-only, 0 nodes, or no detectable connection

import { supabase } from "../supabase";

// ─── IDB helpers (read-only) ──────────────────────────────────────────────────

const WRITING_DRAFT_DB_NAME = "FilmProductionBinderWritingDrafts";
const PROJECT_CACHE_DB_NAME = "FilmProductionBinderProjectCache";
const EMERGENCY_DB_NAME    = "FilmProductionBinderEmergencyBackups";

function openIdbRO(dbName) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {};
    req.onerror = () => reject(req.error || new Error(`IDB open failed: ${dbName}`));
    req.onblocked = () => reject(new Error(`IDB blocked: ${dbName}`));
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

// ─── Slug / normalize helpers ─────────────────────────────────────────────────

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProjectName(name) {
  return String(name || "").trim().toLowerCase();
}

// ─── Source A: localStorage ───────────────────────────────────────────────────

function collectLocalStorageIds(projectId, projectName) {
  const ids = new Set();
  if (typeof localStorage === "undefined") return ids;

  const nameSlug = slugify(projectName);
  const nameLower = normalizeProjectName(projectName);

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.startsWith("sb-")) continue;

      // Keys like writingScriptDraft:<uuid> — extract the UUID part
      const colonIdx = key.indexOf(":");
      if (colonIdx !== -1) {
        const suffix = key.slice(colonIdx + 1);
        if (suffix && suffix !== projectId) {
          // Only add if this key is actually related to this project
          if (
            key.includes(projectId) ||
            (nameSlug && key.toLowerCase().includes(nameSlug)) ||
            (nameLower && key.toLowerCase().includes(nameLower))
          ) {
            ids.add(suffix);
          }
        }
      }
    }
  } catch {}

  return ids;
}

// ─── Source B: IDB WritingDrafts ──────────────────────────────────────────────

async function collectIdbWritingDraftIds(projectId, projectName) {
  const ids = new Set();
  let db;
  try { db = await openIdbRO(WRITING_DRAFT_DB_NAME); } catch { return ids; }

  let records = [];
  try { records = await idbGetAll(db, "drafts"); } catch {}
  db.close();

  const nameLower = normalizeProjectName(projectName);

  for (const rec of records) {
    if (!rec.key) continue;
    // Key like writingScriptDraft:<id>
    const colonIdx = rec.key.indexOf(":");
    const keySuffix = colonIdx !== -1 ? rec.key.slice(colonIdx + 1) : null;

    // Payload projectId
    let payloadPid = null;
    try {
      const p = typeof rec.payload === "object" ? rec.payload : JSON.parse(rec.payload || "null");
      payloadPid = p?.projectId || null;
    } catch {}

    // Collect if this record is associated with this project by any identifier
    const associatedByKey = keySuffix && (
      keySuffix === projectId ||
      (nameLower && keySuffix.toLowerCase() === nameLower)
    );
    const associatedByPayload = payloadPid && (
      payloadPid === projectId ||
      (nameLower && payloadPid.toLowerCase() === nameLower)
    );

    if (associatedByKey || associatedByPayload) {
      if (keySuffix) ids.add(keySuffix);
      if (payloadPid) ids.add(payloadPid);
    }
  }

  return ids;
}

// ─── Source C: ProjectCache ───────────────────────────────────────────────────

async function collectProjectCacheIds(projectId) {
  const ids = new Set();
  let db;
  try { db = await openIdbRO(PROJECT_CACHE_DB_NAME); } catch { return ids; }

  try {
    const currentRecs = await idbGetAll(db, "currentProjectCache");
    for (const rec of currentRecs) {
      // Key format: cache:<projectId>:<moduleKey>
      if (rec.key && rec.key.includes(projectId)) {
        ids.add(projectId); // already the canonical ID, but confirm it's present
      }
    }
  } catch {}

  try {
    const versionRecs = await idbGetAll(db, "projectCacheVersions");
    for (const rec of versionRecs) {
      if (rec.projectId === projectId) ids.add(rec.projectId);
    }
  } catch {}

  db.close();
  return ids;
}

// ─── Source D: Emergency backup markers ──────────────────────────────────────

function collectEmergencyMarkerIds(projectId) {
  const ids = new Set();
  if (typeof localStorage === "undefined") return ids;
  const prefix = "fpb:emergencyBackup:";
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const markerPid = key.slice(prefix.length);
      if (markerPid === projectId) ids.add(markerPid);
    }
  } catch {}
  return ids;
}

// ─── Build identity index for a single project ────────────────────────────────

/**
 * Collect all known identifiers for a project from live storage.
 * READ-ONLY. Never writes.
 * @param {object} project — { id, name }
 * @returns {Promise<ProjectIdentity>}
 */
export async function collectKnownProjectIdentifiers(project) {
  const id = project?.id || "";
  const name = project?.name || "";

  const [lsIds, idbIds, cacheIds] = await Promise.all([
    Promise.resolve(collectLocalStorageIds(id, name)),
    collectIdbWritingDraftIds(id, name).catch(() => new Set()),
    collectProjectCacheIds(id).catch(() => new Set()),
  ]);
  const emergencyIds = collectEmergencyMarkerIds(id);

  const allKnownIds = new Set([id, ...lsIds, ...idbIds, ...cacheIds, ...emergencyIds]);
  allKnownIds.delete(""); // never include empty string

  return {
    id,
    name,
    nameLower: normalizeProjectName(name),
    nameSlug: slugify(name),
    allKnownIds,
    lsIds,
    idbIds,
    cacheIds,
    emergencyIds,
  };
}

// ─── Build index for all projects ────────────────────────────────────────────

/**
 * Build identity index for all provided Supabase projects.
 * @param {object[]} projects
 * @returns {Promise<ProjectIdentity[]>}
 */
export async function buildProjectIdentityIndex(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return [];
  return Promise.all(projects.map(p => collectKnownProjectIdentifiers(p).catch(() => ({
    id: p.id,
    name: p.name,
    nameLower: normalizeProjectName(p.name),
    nameSlug: slugify(p.name),
    allKnownIds: new Set([p.id]),
    lsIds: new Set(),
    idbIds: new Set(),
    cacheIds: new Set(),
    emergencyIds: new Set(),
  }))));
}

// ─── Resolve a project by name (for targeted search) ─────────────────────────

/**
 * Find the best-matching Supabase project for a display name.
 * Returns { project, matchType, score } or null if not found.
 */
export function resolveProjectIdentityForName(projects, targetName) {
  if (!Array.isArray(projects) || !targetName) return null;
  const lower = normalizeProjectName(targetName);
  const slug  = slugify(targetName);

  // 1. Exact name match
  const exact = projects.find(p => normalizeProjectName(p.name) === lower);
  if (exact) return { project: exact, matchType: "exact_name", score: 100 };

  // 2. Slug match
  const slugMatch = projects.find(p => slugify(p.name) === slug);
  if (slugMatch) return { project: slugMatch, matchType: "slug_name", score: 80 };

  // 3. Substring match (project name contains target)
  const subMatch = projects.find(p => normalizeProjectName(p.name).includes(lower));
  if (subMatch) return { project: subMatch, matchType: "substring_name", score: 60 };

  // 4. Target name contains project name
  const reverseMatch = projects.find(p => lower.includes(normalizeProjectName(p.name)));
  if (reverseMatch) return { project: reverseMatch, matchType: "reverse_substring", score: 40 };

  // 5. Word overlap
  const targetWords = lower.split(/\s+/).filter(w => w.length > 2);
  let bestScore = 0;
  let bestProject = null;
  for (const p of projects) {
    const pWords = normalizeProjectName(p.name).split(/\s+/).filter(w => w.length > 2);
    const overlap = targetWords.filter(w => pWords.includes(w)).length;
    if (overlap > 0) {
      const score = (overlap / Math.max(targetWords.length, pWords.length)) * 30;
      if (score > bestScore) { bestScore = score; bestProject = p; }
    }
  }
  if (bestProject) return { project: bestProject, matchType: "word_overlap", score: bestScore };

  return null;
}

// ─── Score a backup candidate against a project identity ─────────────────────

/**
 * Score how well a backup draft candidate matches a project identity.
 * @param {object} candidate — from scanBackupForScriptCandidates
 * @param {ProjectIdentity} identity — from collectKnownProjectIdentifiers
 * @returns {{ score: number, tier: string, reasons: string[] }}
 */
export function scoreCandidateAgainstProject(candidate, identity) {
  if (!candidate || !identity) return { score: 0, tier: "none", reasons: [] };

  const reasons = [];
  let score = 0;

  // Guard: marker-only or 0-node candidates always score 0
  if (candidate._isMarker) return { score: 0, tier: "none", reasons: ["marker_only"] };
  if (candidate.nodeCount === 0) return { score: 0, tier: "none", reasons: ["zero_nodes"] };

  const { projectIdFromKey, projectIdFromPayload, projectIdFromEntry } = candidate;

  // ── HIGH tier: exact UUID match ──────────────────────────────────────────

  if (projectIdFromKey && identity.allKnownIds.has(projectIdFromKey)) {
    if (projectIdFromKey === identity.id) {
      score = Math.max(score, 100);
      reasons.push(`key UUID = Supabase project.id`);
    } else {
      score = Math.max(score, 85);
      reasons.push(`key UUID = known alternate ID for "${identity.name}"`);
    }
  }

  if (projectIdFromPayload && identity.allKnownIds.has(projectIdFromPayload)) {
    if (projectIdFromPayload === identity.id) {
      score = Math.max(score, 95);
      reasons.push(`payload.projectId = Supabase project.id`);
    } else {
      score = Math.max(score, 80);
      reasons.push(`payload.projectId = known alternate ID`);
    }
  }

  if (projectIdFromEntry && identity.allKnownIds.has(projectIdFromEntry)) {
    if (projectIdFromEntry === identity.id) {
      score = Math.max(score, 90);
      reasons.push(`entry.projectId = Supabase project.id`);
    } else {
      score = Math.max(score, 75);
      reasons.push(`entry.projectId = known alternate ID`);
    }
  }

  // IDB key exact match
  if (candidate._fromIdbBackup) {
    const keyUuid = candidate.projectIdFromKey;
    if (keyUuid === identity.id) {
      score = Math.max(score, 98);
      reasons.push(`IDB backup key = writingScriptDraft:${identity.id}`);
    }
  }

  // ── MEDIUM tier: backup context + name matching ──────────────────────────

  // Backup was generated while "I Am Awake" was the active project
  if (candidate.backupCurrentProjectId === identity.id) {
    score = Math.max(score, 70);
    reasons.push(`backup was taken while "${identity.name}" was the active project`);
  }
  if (
    candidate.backupCurrentProjectName &&
    normalizeProjectName(candidate.backupCurrentProjectName) === identity.nameLower
  ) {
    score = Math.max(score, 65);
    reasons.push(`backup active project name = "${identity.name}"`);
  }

  // ── LOW tier: candidate has no UUID match but is an orphan worth showing ─

  if (score === 0 && candidate.recoverable && candidate.nodeCount > 0) {
    score = 5;
    reasons.push(`orphan candidate — no UUID match, manually selectable`);
  }

  const tier =
    score >= 80 ? "high" :
    score >= 60 ? "medium" :
    score >= 20 ? "low" :
    score > 0   ? "orphan" : "none";

  return { score, tier, reasons };
}

/**
 * Explain the match between a candidate and a project identity in human-readable form.
 */
export function explainCandidateMatch(candidate, identity) {
  const { score, tier, reasons } = scoreCandidateAgainstProject(candidate, identity);
  return { score, tier, reasons, summary: reasons.join(" · ") || "No match" };
}

// ─── Live storage scan for a target project ──────────────────────────────────

/**
 * Scan current browser localStorage for all keys associated with a project.
 * READ-ONLY.
 * @param {string} projectId
 * @param {string} projectName
 * @returns {{ draftKeys: string[], markerKeys: string[], relatedKeys: string[], otherKeys: string[] }}
 */
export function scanLocalStorageForProject(projectId, projectName) {
  const draftKeys = [];
  const markerKeys = [];
  const relatedKeys = [];
  const otherKeys = [];

  if (typeof localStorage === "undefined") return { draftKeys, markerKeys, relatedKeys, otherKeys };

  const nameLower = normalizeProjectName(projectName);

  const DRAFT_PREFIXES = ["writingScriptDraft:", "scriptWritingDraft:"];
  const RELATED_PREFIXES = [
    "writingScriptBeats:", "scriptBeats:",
    "writingCharacterProfiles:", "filmProductionBinder:moodboard:",
    "writingScriptEditorPosition:", "writingScriptTargetPageCount:",
    "writingScriptCollapsedActs:", "writingScriptTimelineSettings:",
    "writingScriptSidePanelTab:", "writingTitlePageSettings:",
    "writingSpellcheckDictionary:", "scriptMoodOverlaySettings:",
    "scriptMoodOverlayEnabled:", "writingScriptMoodOverlay:",
  ];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key.startsWith("sb-")) continue;

      const isForProject = key.includes(projectId) ||
        (nameLower && key.toLowerCase().includes(nameLower));
      if (!isForProject) continue;

      const isDraft = DRAFT_PREFIXES.some(p => key.startsWith(p));
      const isRelated = RELATED_PREFIXES.some(p => key.startsWith(p));

      if (isDraft) {
        // Check if it's a marker
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.storage === "indexedDB") {
            markerKeys.push(key);
          } else {
            draftKeys.push(key);
          }
        } catch {
          draftKeys.push(key);
        }
      } else if (isRelated) {
        relatedKeys.push(key);
      } else {
        otherKeys.push(key);
      }
    }
  } catch {}

  return { draftKeys, markerKeys, relatedKeys, otherKeys };
}

// ─── Supabase current script status for a project ────────────────────────────

/**
 * Read the current Writing Script status from Supabase for a project, without
 * opening/mounting the project. Returns summary data only — no script text.
 * READ-ONLY.
 * @param {string} projectId
 * @returns {Promise<SupabaseScriptStatus>}
 */
export async function fetchSupabaseScriptStatus(projectId) {
  if (!projectId) return { ok: false, error: "No projectId" };

  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, settings, created_at, updated_at")
      .eq("id", projectId)
      .single();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Project not found" };

    const settings = data.settings || {};
    const raw = settings.writingScriptDraft;

    if (!raw) {
      return {
        ok: true,
        projectId: data.id,
        projectName: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        hasWritingScriptDraft: false,
        nodeCount: 0,
        savedAt: null,
        hasUserCreatedScript: false,
        isMarker: false,
        isEmpty: true,
        payloadShape: "missing",
      };
    }

    // Classify without exposing content
    let parsed;
    try { parsed = typeof raw === "object" ? raw : JSON.parse(raw); } catch {
      return { ok: true, projectId: data.id, projectName: data.name, hasWritingScriptDraft: true, nodeCount: 0, savedAt: null, payloadShape: "unparseable", isEmpty: true };
    }

    if (parsed?.storage === "indexedDB") {
      return {
        ok: true,
        projectId: data.id,
        projectName: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        hasWritingScriptDraft: true,
        nodeCount: 0,
        savedAt: parsed?.savedAt || null,
        hasUserCreatedScript: parsed?.hasUserCreatedScript ?? false,
        isMarker: true,
        isEmpty: true,
        payloadShape: "marker_indexedDB",
        markerNodeCount: parsed?.nodeCount ?? 0,
        markerIdbKey: parsed?.indexedDbKey || null,
      };
    }

    const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : (Array.isArray(parsed) ? parsed : null);
    const nodeCount = nodes ? nodes.length : 0;

    // Element type summary — safe
    let elementTypeSummary = null;
    if (nodes && nodeCount > 0) {
      const tc = {};
      for (const n of nodes) { const t = n?.type || "?"; tc[t] = (tc[t] || 0) + 1; }
      elementTypeSummary = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t}(${n})`).join(", ");
    }

    return {
      ok: true,
      projectId: data.id,
      projectName: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      hasWritingScriptDraft: true,
      nodeCount,
      savedAt: parsed?.savedAt || null,
      hasUserCreatedScript: parsed?.hasUserCreatedScript ?? (nodeCount > 0),
      isMarker: false,
      isEmpty: nodeCount === 0,
      payloadShape: nodes ? `nodes[${nodeCount}]` : "unknown",
      elementTypeSummary,
    };
  } catch (err) {
    return { ok: false, error: err?.message || "Unknown error" };
  }
}
