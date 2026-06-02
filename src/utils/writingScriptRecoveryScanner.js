// Writing Script Recovery Scanner
//
// Searches every available storage source for actual Writing Script node payloads
// for a given project, before the project is opened.
//
// Distinguishes real payloads (arrays of nodes with content) from markers
// (tiny JSON pointers to IDB records).
//
// This module is READ-ONLY. It never writes, hydrates, clears, or migrates anything.

import { supabase } from "../supabase";
import {
  saveWritingDraftPayloadToDatabase,
  saveWritingDraftPayloadToIndexedDb,
  writeWritingDraftMarker,
  getWritingDraftProjectId,
} from "../components/modules/WritingScript/writingDraftPersistence";
import {
  saveCurrentProjectCache,
  createProjectCacheVersion,
  CACHE_SOURCES,
  CACHE_VERSION_REASONS,
} from "./projectCacheManager";

export const WRITING_SCRIPT_MODULE_KEY = "writingScript";

// ─── IDB helpers ─────────────────────────────────────────────────────────────

const WRITING_DRAFT_DB_NAME = "FilmProductionBinderWritingDrafts";
const WRITING_DRAFT_STORE_NAME = "drafts";
const PROJECT_CACHE_DB_NAME = "FilmProductionBinderProjectCache";

function openIdbRO(dbName, version) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(dbName, version);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {};
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
    req.onblocked = () => reject(new Error("IDB open blocked"));
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

function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

// ─── Payload classifier ───────────────────────────────────────────────────────

// Accepts any raw value and tries to extract a Writing Script payload.
// Returns { isPayload, isMarker, nodes, nodeCount, hasUserCreatedScript,
//           hasSceneHeadings, hasMeaningfulText, elementTypeSummary, payloadShape }
function classifyRawValue(raw) {
  if (!raw) return { isPayload: false, isMarker: false, nodeCount: 0, payloadShape: "null" };

  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { isPayload: false, isMarker: false, nodeCount: 0, payloadShape: "unparseable" };
  }

  // Marker: small object with storage:"indexedDB"
  if (parsed?.storage === "indexedDB") {
    return {
      isPayload: false, isMarker: true,
      markerNodeCount: parsed?.nodeCount ?? 0,
      markerIndexedDbKey: parsed?.indexedDbKey || null,
      markerSavedAt: parsed?.savedAt || null,
      nodeCount: 0,
      payloadShape: "marker_indexedDB",
    };
  }

  // Full payload: object with nodes array
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : (Array.isArray(parsed) ? parsed : null);
  if (!nodes) return { isPayload: false, isMarker: false, nodeCount: 0, payloadShape: "unknown" };

  const nodeCount = nodes.length;
  const hasSceneHeadings = nodes.some(n => n?.type === "Scene Heading");
  const hasMeaningfulText = nodes.some(n => String(n?.text || "").trim().length > 0);
  const hasUserCreatedScript = parsed?.hasUserCreatedScript === true || hasSceneHeadings || hasMeaningfulText;

  // Element type summary — safe (types only, no text content)
  const typeCounts = {};
  for (const n of nodes) {
    const t = n?.type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const elementTypeSummary = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t, n]) => `${t}(${n})`)
    .join(", ");

  return {
    isPayload: nodeCount > 0,
    isMarker: false,
    nodeCount,
    hasUserCreatedScript,
    hasSceneHeadings,
    hasMeaningfulText,
    elementTypeSummary,
    savedAt: parsed?.savedAt || null,
    projectId: parsed?.projectId || null,
    nodes,
    payloadShape: `nodes[${nodeCount}]`,
  };
}

function matchConfidence(key, payloadProjectId, projectId, projectName) {
  if (payloadProjectId === projectId) return "high";
  if (projectName && payloadProjectId === projectName) return "medium";
  if (key && projectId && key.includes(projectId)) return "high";
  if (projectName && key && key.toLowerCase().includes(projectName.toLowerCase())) return "medium";
  return "low";
}

// ─── Source A: Supabase ───────────────────────────────────────────────────────

async function scanSupabaseSource(projectId, projectName) {
  const candidates = [];
  // Keys to check in project settings
  const SETTINGS_KEYS = [
    "writingScriptDraft", "scriptWritingDraft", "writingDraft", "scriptDraft",
    "writingScript", "writingScriptNodes", "screenplay", "screenplayDraft",
  ];

  let settings = null;
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("settings")
      .eq("id", projectId)
      .single();
    if (!error) settings = data?.settings || {};
  } catch {}

  if (settings === null) {
    candidates.push({
      candidateId: "supabase_error",
      sourceType: "supabase",
      sourceLocation: "projects.settings",
      key: "N/A",
      recoverable: false,
      confidence: "error",
      nodeCount: 0,
      warnings: ["Could not read Supabase project settings."],
      classification: { isPayload: false, isMarker: false, payloadShape: "error" },
    });
    return candidates;
  }

  for (const settingsKey of SETTINGS_KEYS) {
    const raw = settings[settingsKey];
    if (raw === undefined) continue;
    const cls = classifyRawValue(raw);
    if (!cls.isPayload && !cls.isMarker) continue;

    const conf = cls.isPayload
      ? matchConfidence(null, cls.projectId, projectId, projectName)
      : "invalid";

    candidates.push({
      candidateId: `supabase_${settingsKey}`,
      sourceType: "supabase",
      sourceLocation: `projects.settings.${settingsKey}`,
      key: `settings.${settingsKey}`,
      projectId: cls.projectId || null,
      savedAt: cls.savedAt || null,
      recoverable: cls.isPayload && cls.nodeCount > 0,
      confidence: cls.isPayload ? conf : "invalid",
      nodeCount: cls.nodeCount,
      hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
      hasSceneHeadings: cls.hasSceneHeadings ?? false,
      hasMeaningfulText: cls.hasMeaningfulText ?? false,
      elementTypeSummary: cls.elementTypeSummary || null,
      payloadShape: cls.payloadShape,
      warnings: [
        ...(cls.isMarker ? ["This Supabase settings key contains a localStorage marker, not a payload."] : []),
        ...(cls.isPayload && cls.nodeCount === 0 ? ["Payload has 0 nodes."] : []),
      ],
      classification: cls,
      // For recovery action: attach these nodes to this project
      _nodes: cls.isPayload ? cls.nodes : null,
    });
  }

  return candidates;
}

// ─── Source B: FilmProductionBinderWritingDrafts/drafts ──────────────────────

async function scanWritingDraftIdb(projectId, projectName) {
  const candidates = [];
  let db;
  try { db = await openIdbRO(WRITING_DRAFT_DB_NAME, 1); } catch { return candidates; }

  let all = [];
  try { all = await idbGetAll(db, WRITING_DRAFT_STORE_NAME); } catch {}
  db.close();

  const exactKey = `writingScriptDraft:${projectId}`;
  const legacyKey = `scriptWritingDraft:${projectId}`;
  const nameKey = projectName ? `writingScriptDraft:${projectName}` : null;
  const legacyNameKey = projectName ? `scriptWritingDraft:${projectName}` : null;

  for (const rec of all) {
    const cls = classifyRawValue(rec.payload);

    let matchType = null;
    if (rec.key === exactKey) matchType = "exactProjectId";
    else if (rec.key === legacyKey) matchType = "legacyProjectId";
    else if (nameKey && rec.key === nameKey) matchType = "exactProjectName";
    else if (legacyNameKey && rec.key === legacyNameKey) matchType = "legacyProjectName";
    else if (cls.projectId === projectId) matchType = "payloadProjectId";
    else if (projectName && cls.projectId === projectName) matchType = "payloadProjectName";
    else if (projectName && rec.key.toLowerCase().includes(projectName.toLowerCase())) matchType = "looseName";
    else if (rec.key.includes(projectId)) matchType = "keyContainsId";
    else continue;

    const isExact = ["exactProjectId", "legacyProjectId", "payloadProjectId"].includes(matchType);
    const conf = isExact ? "high" : (matchType.startsWith("exact") || matchType === "payloadProjectName" ? "medium" : "low");
    const isOrphan = !["exactProjectId", "legacyProjectId"].includes(matchType);

    candidates.push({
      candidateId: `idb_drafts_${rec.key}`,
      sourceType: "indexedDB_writingDrafts",
      sourceLocation: `FilmProductionBinderWritingDrafts/drafts/${rec.key}`,
      key: rec.key,
      matchType,
      isOrphan,
      projectId: cls.projectId || null,
      savedAt: cls.savedAt || null,
      recoverable: !isOrphan && cls.isPayload && cls.nodeCount > 0,
      orphanRecoverable: isOrphan && cls.isPayload && cls.nodeCount > 0,
      confidence: cls.isPayload ? conf : "invalid",
      nodeCount: cls.nodeCount,
      hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
      hasSceneHeadings: cls.hasSceneHeadings ?? false,
      hasMeaningfulText: cls.hasMeaningfulText ?? false,
      elementTypeSummary: cls.elementTypeSummary || null,
      payloadShape: cls.payloadShape,
      warnings: [
        ...(isOrphan ? [`Orphan: key "${rec.key}" matched by ${matchType} — not loaded automatically.`] : []),
        ...(cls.nodeCount === 0 ? ["IDB record has 0 nodes."] : []),
        ...(cls.isMarker ? ["IDB record is a marker, not a payload."] : []),
      ],
      classification: cls,
      _nodes: cls.isPayload ? cls.nodes : null,
    });
  }

  // If no record found at exact key, report that explicitly
  if (!all.find(r => r.key === exactKey)) {
    candidates.push({
      candidateId: "idb_drafts_missing",
      sourceType: "indexedDB_writingDrafts",
      sourceLocation: `FilmProductionBinderWritingDrafts/drafts/${exactKey}`,
      key: exactKey,
      recoverable: false,
      confidence: "none",
      nodeCount: 0,
      payloadShape: "missing",
      warnings: [`No record found at key "${exactKey}".`],
      classification: { isPayload: false, isMarker: false, payloadShape: "missing" },
      _nodes: null,
    });
  }

  return candidates;
}

// ─── Source C: FilmProductionBinderProjectCache ───────────────────────────────

async function scanProjectCacheSource(projectId) {
  const candidates = [];
  let db;
  try { db = await openIdbRO(PROJECT_CACHE_DB_NAME, 1); } catch { return candidates; }

  // Check currentProjectCache for moduleKey "writingScript"
  try {
    const wsKey = `cache:${projectId}:writingScript`;
    const rec = await idbGet(db, "currentProjectCache", wsKey);
    if (rec) {
      const cls = classifyRawValue(rec.payload);
      candidates.push({
        candidateId: "projectCache_current_writingScript",
        sourceType: "projectCache_current",
        sourceLocation: `FilmProductionBinderProjectCache/currentProjectCache/cache:${projectId}:writingScript`,
        key: wsKey,
        updatedAt: rec.updatedAt || null,
        recoverable: cls.isPayload && cls.nodeCount > 0,
        confidence: cls.isPayload ? "high" : "invalid",
        nodeCount: cls.nodeCount,
        hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
        elementTypeSummary: cls.elementTypeSummary || null,
        payloadShape: cls.payloadShape,
        warnings: cls.nodeCount === 0 ? ["ProjectCache writingScript snapshot has 0 nodes."] : [],
        classification: cls,
        _nodes: cls.isPayload ? cls.nodes : null,
      });
    }
  } catch {}

  // Check projectCacheVersions for moduleKey "writingScript"
  try {
    const allVersions = await idbGetAll(db, "projectCacheVersions");
    const wsVersions = allVersions.filter(r => r.projectId === projectId && r.moduleKey === WRITING_SCRIPT_MODULE_KEY);
    for (const ver of wsVersions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 3)) {
      const cls = classifyRawValue(ver.payload);
      candidates.push({
        candidateId: `projectCache_version_writingScript_${ver.id}`,
        sourceType: "projectCache_version",
        sourceLocation: `FilmProductionBinderProjectCache/projectCacheVersions/${ver.id}`,
        key: ver.id,
        createdAt: ver.createdAt || null,
        reason: ver.reason || null,
        recoverable: cls.isPayload && cls.nodeCount > 0,
        confidence: cls.isPayload ? "medium" : "invalid",
        nodeCount: cls.nodeCount,
        hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
        elementTypeSummary: cls.elementTypeSummary || null,
        payloadShape: cls.payloadShape,
        warnings: cls.nodeCount === 0 ? ["Version snapshot has 0 nodes."] : [],
        classification: cls,
        _nodes: cls.isPayload ? cls.nodes : null,
      });
    }
  } catch {}

  // Check currentProjectCache localStorageMirror — look inside for ws marker vs payload
  try {
    const mirrorKey = `cache:${projectId}:localStorageMirror`;
    const mirrorRec = await idbGet(db, "currentProjectCache", mirrorKey);
    if (mirrorRec?.payload?.keys) {
      const keys = mirrorRec.payload.keys;
      const wsMarkerKey = `writingScriptDraft:${projectId}`;
      const wsRaw = keys[wsMarkerKey];
      if (wsRaw) {
        const cls = classifyRawValue(wsRaw);
        candidates.push({
          candidateId: "projectCache_mirror_writingScriptKey",
          sourceType: "projectCache_mirror_key",
          sourceLocation: `FilmProductionBinderProjectCache/currentProjectCache/mirror/${wsMarkerKey}`,
          key: wsMarkerKey,
          updatedAt: mirrorRec.updatedAt || mirrorRec.payload.capturedAt || null,
          recoverable: cls.isPayload && cls.nodeCount > 0,
          confidence: cls.isPayload ? "medium" : "invalid",
          nodeCount: cls.isMarker ? (cls.markerNodeCount ?? 0) : cls.nodeCount,
          payloadShape: cls.payloadShape,
          markerNodeCount: cls.isMarker ? cls.markerNodeCount : null,
          markerIdbKey: cls.isMarker ? cls.markerIndexedDbKey : null,
          warnings: [
            ...(cls.isMarker ? [`Mirror contains marker only (claimed ${cls.markerNodeCount ?? 0} nodes). Actual IDB payload may be missing.`] : []),
            ...(cls.isPayload && cls.nodeCount === 0 ? ["Mirror writing script key has 0 nodes."] : []),
          ],
          classification: cls,
          _nodes: cls.isPayload ? cls.nodes : null,
        });
      }
    }
  } catch {}

  db.close();
  return candidates;
}

// ─── Source D: localStorage ───────────────────────────────────────────────────

function scanLocalStorageSource(projectId, projectName) {
  const candidates = [];
  if (typeof localStorage === "undefined") return candidates;

  const keysToCheck = [
    `writingScriptDraft:${projectId}`,
    `scriptWritingDraft:${projectId}`,
    ...(projectName && projectName !== projectId ? [
      `writingScriptDraft:${projectName}`,
      `scriptWritingDraft:${projectName}`,
    ] : []),
  ];

  // Also scan for any key containing projectId and "script"
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (keysToCheck.includes(key)) continue;
      if (key.startsWith("sb-")) continue;
      if (key.includes(projectId) && key.toLowerCase().includes("script")) {
        keysToCheck.push(key);
      }
    }
  } catch {}

  for (const key of keysToCheck) {
    const raw = (() => { try { return localStorage.getItem(key); } catch { return null; } })();
    if (!raw) continue;

    const cls = classifyRawValue(raw);
    const isExact = key === `writingScriptDraft:${projectId}` || key === `scriptWritingDraft:${projectId}`;

    candidates.push({
      candidateId: `localStorage_${key}`,
      sourceType: "localStorage",
      sourceLocation: `localStorage/${key}`,
      key,
      recoverable: cls.isPayload && cls.nodeCount > 0,
      confidence: cls.isPayload ? (isExact ? "high" : "medium") : "invalid",
      nodeCount: cls.isMarker ? (cls.markerNodeCount ?? 0) : cls.nodeCount,
      payloadShape: cls.payloadShape,
      markerNodeCount: cls.isMarker ? cls.markerNodeCount : null,
      markerIdbKey: cls.isMarker ? cls.markerIndexedDbKey : null,
      savedAt: cls.savedAt || null,
      warnings: [
        ...(cls.isMarker ? [`Marker only (claimed ${cls.markerNodeCount ?? 0} nodes). Full payload is in IndexedDB.`] : []),
        ...(cls.isPayload && cls.nodeCount === 0 ? ["localStorage payload has 0 nodes."] : []),
      ],
      classification: cls,
      _nodes: cls.isPayload ? cls.nodes : null,
    });
  }

  return candidates;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Scan all available sources for actual Writing Script node payloads.
 * Returns a structured report with candidates classified by recoverability.
 * READ-ONLY. Never writes anything.
 */
export async function scanWritingScriptRecoverySources(project) {
  const projectId = project?.id || project?.name;
  const projectName = project?.name || projectId;

  if (!projectId) return { projectId: null, candidates: [], recoverableCandidates: [] };

  const [supabaseCands, idbCands, projectCacheCands] = await Promise.all([
    scanSupabaseSource(projectId, projectName).catch(() => []),
    scanWritingDraftIdb(projectId, projectName).catch(() => []),
    scanProjectCacheSource(projectId).catch(() => []),
  ]);
  const lsCands = scanLocalStorageSource(projectId, projectName);

  const allCandidates = [
    ...supabaseCands,
    ...idbCands,
    ...projectCacheCands,
    ...lsCands,
  ];

  const recoverableCandidates = allCandidates.filter(c => c.recoverable);
  const orphanCandidates = allCandidates.filter(c => c.orphanRecoverable);

  // Script backup status summary
  const supabaseHasPayload = supabaseCands.some(c => c.recoverable && c.sourceType === "supabase" && c.key === "settings.writingScriptDraft");
  const idbHasPayload = idbCands.some(c => c.recoverable && !c.isOrphan);
  const projectCacheHasSnapshot = projectCacheCands.some(c => c.recoverable && c.sourceType === "projectCache_current" && c.key?.includes(":writingScript"));
  const projectCacheVersionCount = projectCacheCands.filter(c => c.sourceType === "projectCache_version").length;
  const lsMarkerValid = lsCands.some(c => c.classification?.isMarker && c.markerIdbKey && idbCands.find(i => i.key === c.markerIdbKey && i.recoverable));

  if (process.env.NODE_ENV === "development") {
    console.info(`[writingScriptRecoveryScanner] project=${projectId}`, {
      total: allCandidates.length, recoverable: recoverableCandidates.length,
      orphans: orphanCandidates.length,
      supabaseHasPayload, idbHasPayload, projectCacheHasSnapshot, lsMarkerValid,
    });
  }

  return {
    projectId,
    projectName,
    candidates: allCandidates,
    recoverableCandidates,
    orphanCandidates,
    backupStatus: {
      supabaseHasPayload,
      supabaseNodeCount: supabaseCands.find(c => c.key === "settings.writingScriptDraft")?.nodeCount ?? 0,
      idbHasPayload,
      idbNodeCount: idbCands.find(c => !c.isOrphan && c.recoverable)?.nodeCount ?? 0,
      projectCacheHasSnapshot,
      projectCacheVersionCount,
      lsMarkerPresent: lsCands.some(c => c.classification?.isMarker),
      lsMarkerValid,
    },
  };
}

// ─── Recovery attach action ───────────────────────────────────────────────────

/**
 * Attach a recovered Writing Script payload to a project.
 * Saves to: Supabase → IndexedDB → ProjectCache current snapshot → ProjectCache version → localStorage marker.
 * Guards: nodes.length === 0 throws. Does NOT delete source records.
 *
 * @param {object} project — { id, name }
 * @param {object} candidate — from scanWritingScriptRecoverySources
 * @returns {{ success, storage, error, nodeCount, savedAt, details }}
 */
export async function attachRecoveredWritingScript(project, candidate) {
  const projectId = getWritingDraftProjectId(project);
  const nodes = candidate?._nodes;

  // Hard guard: never attach empty payload
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { success: false, error: "Cannot attach: payload has 0 nodes.", storage: null };
  }

  const now = new Date().toISOString();
  const normalizedPayload = {
    projectId,
    savedAt: now,
    hasUserCreatedScript: true,
    nodes,
    recoveredAt: now,
    recoveredFrom: {
      sourceType: candidate.sourceType,
      sourceLocation: candidate.sourceLocation,
      key: candidate.key,
      originalSavedAt: candidate.savedAt || candidate.createdAt || null,
    },
  };

  const details = {};

  // 1. Supabase — required for full success
  let supabaseOk = false;
  try {
    await saveWritingDraftPayloadToDatabase(project, normalizedPayload);
    supabaseOk = true;
    details.supabase = "saved";
    if (process.env.NODE_ENV === "development") {
      console.info(`[writingScriptRecovery] Saved to Supabase: ${nodes.length} nodes`);
    }
  } catch (err) {
    details.supabase = `failed: ${err?.message}`;
    if (process.env.NODE_ENV === "development") {
      console.warn(`[writingScriptRecovery] Supabase save failed:`, err?.message);
    }
    // Do not continue — require Supabase success
    return {
      success: false,
      error: `Supabase save failed: ${err?.message}`,
      storage: null,
      details,
    };
  }

  // 2. IndexedDB (FilmProductionBinderWritingDrafts/drafts)
  let idbKey = null;
  try {
    idbKey = await saveWritingDraftPayloadToIndexedDb(project, normalizedPayload);
    details.idb = "saved";
    if (process.env.NODE_ENV === "development") {
      console.info(`[writingScriptRecovery] Saved to IDB drafts: key=${idbKey}`);
    }
  } catch (err) {
    details.idb = `failed: ${err?.message}`;
    // Non-fatal after Supabase success — log but continue
    if (process.env.NODE_ENV === "development") {
      console.warn(`[writingScriptRecovery] IDB drafts save failed (non-fatal):`, err?.message);
    }
  }

  // 3. ProjectCache currentProjectCache moduleKey "writingScript"
  try {
    await saveCurrentProjectCache(projectId, WRITING_SCRIPT_MODULE_KEY, normalizedPayload, {
      source: CACHE_SOURCES.SUPABASE,
      updatedAt: now,
    });
    details.projectCacheCurrent = "saved";
  } catch (err) {
    details.projectCacheCurrent = `failed: ${err?.message}`;
  }

  // 4. ProjectCache version checkpoint
  try {
    const versionId = await createProjectCacheVersion(
      projectId,
      WRITING_SCRIPT_MODULE_KEY,
      normalizedPayload,
      "recovery_attach",
      { source: CACHE_SOURCES.SUPABASE }
    );
    details.projectCacheVersion = `created: ${versionId}`;
  } catch (err) {
    details.projectCacheVersion = `failed: ${err?.message}`;
  }

  // 5. localStorage marker (pointing to IDB record if available)
  if (idbKey) {
    const markerOk = writeWritingDraftMarker(project, normalizedPayload, idbKey);
    details.lsMarker = markerOk ? "written" : "failed";
  } else {
    details.lsMarker = "skipped (no IDB key)";
  }

  if (process.env.NODE_ENV === "development") {
    console.info(`[writingScriptRecovery] Attach complete for project ${projectId}:`, details);
  }

  return {
    success: true,
    storage: supabaseOk ? "database" : "indexedDB",
    nodeCount: nodes.length,
    savedAt: now,
    details,
  };
}
