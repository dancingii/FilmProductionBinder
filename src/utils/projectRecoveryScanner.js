// Project Recovery Scanner
//
// Read-only pre-mount scanner that inspects all available storage sources for a
// project BEFORE setSelectedProject is called.
//
// Key improvements over v1:
//  - Distinguishes actual node payloads from localStorage markers (marker ≠ payload).
//  - Reads raw IDB records without parseWritingDraftPayload's empty-filter so
//    "record exists with 0 nodes" is different from "record missing entirely".
//  - Validates payload shapes against what each module loader actually expects.
//  - Searches for orphaned Writing Script IDB records by projectId/name/key.
//  - Reports per-module hasActualPayload / payloadValid / payloadWarning.
//  - Controls which candidates are loadable vs view-only.
//
// This module NEVER writes, hydrates, clears, or migrates anything.

import { supabase } from "../supabase";
import {
  getCurrentProjectCache,
  listProjectCacheVersions,
  MIRROR_MODULE_KEY,
} from "./projectCacheManager";
import { EMERGENCY_MARKER_PREFIX } from "./emergencyBackupStore";

// ─── IDB read helpers (raw, no parse filter) ─────────────────────────────────

const WRITING_DRAFT_DB_NAME = "FilmProductionBinderWritingDrafts";
const WRITING_DRAFT_STORE_NAME = "drafts";
const EMERGENCY_DB_NAME = "FilmProductionBinderEmergencyBackups";
const EMERGENCY_STORE_NAME = "backups";

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

function idbGetRO(db, storeName, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

function idbGetAllRO(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

// ─── Supabase readers ─────────────────────────────────────────────────────────

async function readSupabaseProjectSettings(projectId) {
  if (!projectId) return null;
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("settings")
      .eq("id", projectId)
      .single();
    if (error) throw error;
    return data?.settings && typeof data.settings === "object" ? data.settings : {};
  } catch {
    return null;
  }
}

async function readSupabaseMoodboardData(projectId) {
  if (!projectId) return null;
  try {
    const { data, error } = await supabase
      .from("moodboard_data")
      .select("boards, images, canvas_items, active_board_id, updated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch {
    return null;
  }
}

// ─── Writing Script IDB readers ───────────────────────────────────────────────

// Read a raw IDB record without any payload filtering.
// Returns { record, exists, nodeCount, hasUserCreatedScript, savedAt, rawNodes }
// "record exists with 0 nodes" is different from "record missing entirely".
async function readWritingDraftIdbRaw(key) {
  try {
    const db = await openIdbRO(WRITING_DRAFT_DB_NAME, 1);
    const record = await idbGetRO(db, WRITING_DRAFT_STORE_NAME, key);
    db.close();

    if (!record) return { exists: false, nodeCount: 0, hasUserCreatedScript: false, savedAt: null, rawNodes: null };

    const payload = record.payload;
    const nodes = Array.isArray(payload?.nodes) ? payload.nodes : (Array.isArray(payload) ? payload : []);
    return {
      exists: true,
      nodeCount: nodes.length,
      hasUserCreatedScript: payload?.hasUserCreatedScript === true || nodes.some(n => n?.type === "Scene Heading"),
      savedAt: payload?.savedAt || null,
      rawNodes: nodes,
      projectId: payload?.projectId || null,
    };
  } catch {
    return { exists: false, nodeCount: 0, hasUserCreatedScript: false, savedAt: null, rawNodes: null };
  }
}

// Find all Writing Script IDB records — includes orphan search.
async function findAllWritingDraftRecords(projectId, projectName) {
  const found = [];
  try {
    const db = await openIdbRO(WRITING_DRAFT_DB_NAME, 1);
    const all = await idbGetAllRO(db, WRITING_DRAFT_STORE_NAME);
    db.close();

    const exactKey = `writingScriptDraft:${projectId}`;
    const legacyKey = `scriptWritingDraft:${projectId}`;
    const nameKey = projectName ? `writingScriptDraft:${projectName}` : null;
    const legacyNameKey = projectName ? `scriptWritingDraft:${projectName}` : null;

    for (const rec of all) {
      const payload = rec.payload;
      const nodes = Array.isArray(payload?.nodes) ? payload.nodes : (Array.isArray(payload) ? payload : []);
      const nodeCount = nodes.length;
      const hasContent = payload?.hasUserCreatedScript === true || nodes.some(n => n?.type === "Scene Heading") || nodeCount > 0;

      // Classify match type
      let matchType = "unrelated";
      let confidence = "low";

      if (rec.key === exactKey) {
        matchType = "exactProjectId"; confidence = "high";
      } else if (rec.key === legacyKey) {
        matchType = "legacyProjectId"; confidence = "high";
      } else if (nameKey && rec.key === nameKey) {
        matchType = "exactProjectName"; confidence = "medium";
      } else if (legacyNameKey && rec.key === legacyNameKey) {
        matchType = "legacyProjectName"; confidence = "medium";
      } else if (payload?.projectId === projectId) {
        matchType = "payloadProjectId"; confidence = "high";
      } else if (projectName && payload?.projectId === projectName) {
        matchType = "payloadProjectName"; confidence = "medium";
      } else if (projectName && rec.key.toLowerCase().includes(projectName.toLowerCase())) {
        matchType = "looseName"; confidence = "low";
      } else {
        continue; // skip entirely unrelated records
      }

      found.push({
        key: rec.key,
        matchType,
        confidence,
        nodeCount,
        hasContent,
        hasUserCreatedScript: payload?.hasUserCreatedScript === true,
        savedAt: payload?.savedAt || null,
        payloadProjectId: payload?.projectId || null,
      });
    }
  } catch {}
  return found;
}

// ─── Writing Characters payload validator ─────────────────────────────────────

// Returns { profileCount, isValidShape, shapeWarning, shapeSummary }
function validateWritingCharactersPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { profileCount: 0, isValidShape: false, shapeWarning: "Not an object.", shapeSummary: "n/a" };
  }

  // Expected shape: { version, profiles: { [id]: {...} }, resolution: {}, ... }
  if (raw.profiles && typeof raw.profiles === "object" && !Array.isArray(raw.profiles)) {
    const count = Object.keys(raw.profiles).length;
    return {
      profileCount: count,
      isValidShape: true,
      shapeWarning: null,
      shapeSummary: `{ profiles: ${count} entries, resolution: ${Object.keys(raw.resolution || {}).length} entries }`,
    };
  }

  // Flat shape (legacy or wrong): count non-metadata top-level keys
  const allKeys = Object.keys(raw);
  const metaKeys = new Set(["version", "resolution", "ignoredSuggestions", "sceneSuppresssions", "savedAt"]);
  const profileLikeKeys = allKeys.filter(k => !metaKeys.has(k));
  if (profileLikeKeys.length > 0) {
    return {
      profileCount: profileLikeKeys.length,
      isValidShape: false,
      shapeWarning: `Flat shape (no .profiles key) — ${profileLikeKeys.length} top-level keys. normalizeWritingCharacterProfiles will return empty profiles.`,
      shapeSummary: `{ flat object, keys: ${allKeys.slice(0, 5).join(", ")}${allKeys.length > 5 ? "…" : ""} }`,
    };
  }

  return {
    profileCount: 0,
    isValidShape: false,
    shapeWarning: "Empty or unrecognised shape.",
    shapeSummary: `{ keys: ${allKeys.join(", ") || "none"} }`,
  };
}

// ─── MoodBoard payload validator ──────────────────────────────────────────────

function validateMoodBoardPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { isDefault: true, boardCount: 0, imageCount: 0, canvasItemCount: 0, isMeaningful: false, warning: "No data." };
  }
  const boardCount = Array.isArray(raw.boards) ? raw.boards.length : 0;
  const imageCount = Array.isArray(raw.images) ? raw.images.length : 0;
  const canvasItemCount = Array.isArray(raw.canvas_items || raw.canvasItems) ? (raw.canvas_items || raw.canvasItems).length : 0;

  // One empty default board with no images = default state.
  const isMeaningful = (boardCount > 1) || (imageCount > 0) || (canvasItemCount > 0);
  const isDefault = boardCount <= 1 && imageCount === 0 && canvasItemCount === 0;

  return {
    isDefault,
    boardCount,
    imageCount,
    canvasItemCount,
    isMeaningful,
    warning: isDefault ? "One empty board, no images — likely default/empty state." : null,
  };
}

// ─── Mirror payload validator ─────────────────────────────────────────────────

// Returns rich validation for all modules in a mirror record.
// Checks whether Writing Script marker references an existing IDB record.
async function validateMirrorPayload(mirrorPayload, projectId, idbDraftRecords) {
  if (!mirrorPayload?.keys) {
    return {
      keyCount: 0,
      writingScript: { markerExists: false, idbRecordExists: false, nodeCount: 0, isActualPayload: false, warning: "No mirror keys." },
      moodBoard: { payloadExists: false, isMeaningful: false, isDefault: true, warning: "No mirror keys." },
      writingCharacters: { payloadExists: false, profileCount: 0, isValidShape: false, warning: "No mirror keys." },
    };
  }

  const keys = mirrorPayload.keys;
  const allKeys = Object.keys(keys);

  // Writing Script — look up the marker and whether IDB record actually exists
  const wsMarkerKey = `writingScriptDraft:${projectId}`;
  const wsMarkerRaw = keys[wsMarkerKey];
  let wsResult;
  if (!wsMarkerRaw) {
    wsResult = { markerExists: false, idbRecordExists: false, nodeCount: 0, isActualPayload: false, warning: "No writingScriptDraft marker in mirror." };
  } else {
    try {
      const marker = JSON.parse(wsMarkerRaw);
      if (marker?.storage === "indexedDB" && marker?.indexedDbKey) {
        // Check whether the referenced IDB record actually exists and has nodes.
        // idbDraftRecords entries come from findAllWritingDraftRecords and do NOT have
        // an .exists field — they are truthy objects. Normalize to { exists, nodeCount }
        // before checking, so both paths (prefetched vs. live read) use the same shape.
        const prefetched = idbDraftRecords?.find(r => r.key === marker.indexedDbKey);
        const idbRecord = prefetched
          ? { exists: true, nodeCount: prefetched.nodeCount ?? 0 }
          : await readWritingDraftIdbRaw(marker.indexedDbKey);
        const idbExists = idbRecord?.exists === true;
        const nodeCount = idbRecord?.nodeCount ?? 0;
        const markerNodeCount = marker.nodeCount ?? 0;

        if (!idbExists) {
          wsResult = {
            markerExists: true, idbRecordExists: false, nodeCount: 0, markerNodeCount,
            isActualPayload: false,
            warning: `Marker references IDB key "${marker.indexedDbKey}" but that record is MISSING. ` +
              (markerNodeCount > 0 ? `Marker claimed ${markerNodeCount} nodes — data may be lost.` : ""),
          };
        } else if (nodeCount === 0) {
          wsResult = {
            markerExists: true, idbRecordExists: true, nodeCount: 0, markerNodeCount,
            isActualPayload: false,
            warning: `IDB record exists but has 0 nodes. Marker claimed ${markerNodeCount} nodes.`,
          };
        } else {
          wsResult = {
            markerExists: true, idbRecordExists: true, nodeCount, markerNodeCount,
            isActualPayload: true, warning: null,
          };
        }
      } else {
        // Full payload in localStorage — rare after migration but handle gracefully.
        const nodes = Array.isArray(marker?.nodes) ? marker.nodes : [];
        wsResult = {
          markerExists: true, idbRecordExists: false, nodeCount: nodes.length,
          isActualPayload: nodes.length > 0,
          warning: nodes.length === 0 ? "localStorage marker has no IDB reference and no nodes." : null,
        };
      }
    } catch {
      wsResult = { markerExists: true, idbRecordExists: false, nodeCount: 0, isActualPayload: false, warning: "Marker parse error." };
    }
  }

  // MoodBoard — full payload stored directly in localStorage
  const mbKey = `filmProductionBinder:moodboard:${projectId}`;
  let mbResult;
  if (!keys[mbKey]) {
    mbResult = { payloadExists: false, isMeaningful: false, isDefault: true, boardCount: 0, imageCount: 0, warning: "No MoodBoard key in mirror." };
  } else {
    try {
      const parsed = JSON.parse(keys[mbKey]);
      const validated = validateMoodBoardPayload(parsed);
      mbResult = { payloadExists: true, ...validated };
    } catch {
      mbResult = { payloadExists: true, isMeaningful: false, isDefault: true, boardCount: 0, imageCount: 0, warning: "MoodBoard parse error." };
    }
  }

  // WritingCharacters — full object stored in localStorage
  const wcKey = `writingCharacterProfiles:${projectId}`;
  let wcResult;
  if (!keys[wcKey]) {
    wcResult = { payloadExists: false, profileCount: 0, isValidShape: false, shapeWarning: null, warning: "No writingCharacterProfiles key in mirror." };
  } else {
    try {
      const parsed = JSON.parse(keys[wcKey]);
      const validated = validateWritingCharactersPayload(parsed);
      wcResult = { payloadExists: true, ...validated, warning: validated.shapeWarning };
    } catch {
      wcResult = { payloadExists: true, profileCount: 0, isValidShape: false, warning: "WritingCharacters parse error." };
    }
  }

  return {
    keyCount: allKeys.length,
    keyList: allKeys,
    writingScript: wsResult,
    moodBoard: mbResult,
    writingCharacters: wcResult,
  };
}

// ─── Emergency backup readers ─────────────────────────────────────────────────

async function readEmergencyBackupsForProject(projectId) {
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(EMERGENCY_MARKER_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "");
        if (parsed?.projectId === projectId) results.push({ ...parsed, _source: "localStorageMarker" });
      } catch {}
    }
  } catch {}

  try {
    const db = await openIdbRO(EMERGENCY_DB_NAME, 1);
    const all = await idbGetAllRO(db, EMERGENCY_STORE_NAME);
    db.close();
    for (const rec of all) {
      if (rec.projectId === projectId && !results.find(r => r.id === rec.id)) {
        results.push({ ...rec, _source: "indexedDB" });
      }
    }
  } catch {}

  return results;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

export async function scanProjectRecoverySources(project) {
  const projectId = project?.id || project?.name;
  const projectName = project?.name || projectId;
  const scannedAt = new Date().toISOString();

  if (!projectId) {
    return {
      projectId: null, projectName, scannedAt,
      candidates: [], recommendation: "no_project_id", requiresUserChoice: false, warnings: ["No project ID."],
    };
  }

  const candidates = [];
  const scanWarnings = [];

  // Run all parallel reads first, then do IDB cross-checks
  const [supabaseSettings, supabaseMoodboard, allIdbDraftRecords, emergencyRecords, mirrorRecord, versions] =
    await Promise.all([
      readSupabaseProjectSettings(projectId).catch(() => null),
      readSupabaseMoodboardData(projectId).catch(() => null),
      findAllWritingDraftRecords(projectId, projectName).catch(() => []),
      readEmergencyBackupsForProject(projectId).catch(() => []),
      getCurrentProjectCache(projectId, MIRROR_MODULE_KEY).catch(() => null),
      listProjectCacheVersions(projectId, MIRROR_MODULE_KEY).catch(() => []),
    ]);

  // ── A. Supabase candidate ─────────────────────────────────────────────────
  {
    const wsDraft = supabaseSettings?.writingScriptDraft;
    const wsNodes = Array.isArray(wsDraft?.nodes) ? wsDraft.nodes : (Array.isArray(wsDraft) ? wsDraft : []);
    const wsNodeCount = wsNodes.length;
    const wsHasContent = wsDraft?.hasUserCreatedScript === true || wsNodeCount > 0;

    const wcRaw = supabaseSettings?.writingCharacterProfiles;
    const wcValidation = wcRaw ? validateWritingCharactersPayload(wcRaw) : null;
    const wcProfileCount = wcValidation?.profileCount ?? 0;
    const wcValid = wcValidation?.isValidShape ?? false;

    const mbValidation = validateMoodBoardPayload(
      supabaseMoodboard ? {
        boards: supabaseMoodboard.boards,
        images: supabaseMoodboard.images,
        canvas_items: supabaseMoodboard.canvas_items,
      } : null
    );

    const isEmpty = !wsHasContent && wcProfileCount === 0 && !mbValidation.isMeaningful;
    const loadable = true; // Supabase is always loadable (user explicitly chose it)

    candidates.push({
      id: "supabase",
      label: "Supabase database",
      sourceType: "supabase",
      source: "supabase",
      updatedAt: supabaseMoodboard?.updated_at || wsDraft?.savedAt || null,
      isEmpty,
      loadable,
      confidence: supabaseSettings !== null ? (isEmpty ? "low" : "high") : "error",
      warnings: [
        ...(supabaseSettings === null ? ["Could not read Supabase project settings."] : []),
        ...(isEmpty ? ["Supabase appears empty or default."] : []),
      ],
      validation: {
        writingScript: {
          hasActualPayload: wsHasContent,
          nodeCount: wsNodeCount,
          source: "supabase",
          warning: !wsHasContent ? (supabaseSettings?.writingScriptDraft === undefined ? "No writingScriptDraft key in settings." : "Empty script.") : null,
        },
        writingCharacters: {
          hasActualPayload: wcProfileCount > 0 && wcValid,
          profileCount: wcProfileCount,
          isValidShape: wcValid,
          shapeSummary: wcValidation?.shapeSummary ?? null,
          source: "supabase",
          warning: wcValidation?.shapeWarning ?? null,
        },
        moodBoard: {
          hasActualPayload: mbValidation.isMeaningful,
          boardCount: mbValidation.boardCount,
          imageCount: mbValidation.imageCount,
          isDefault: mbValidation.isDefault,
          source: supabaseMoodboard ? "supabase" : "no_record",
          warning: mbValidation.warning,
        },
      },
      summary: {
        writingScriptNodeCount: wsNodeCount,
        writingScriptHasUserCreatedScript: wsHasContent,
        moodBoardBoardCount: mbValidation.boardCount,
        moodBoardImageCount: mbValidation.imageCount,
        writingCharacterProfileCount: wcProfileCount,
        wcValidShape: wcValid,
        localStorageMirrorKeyCount: null,
      },
    });

    if (supabaseSettings === null) scanWarnings.push("Supabase read failed — may be offline.");
  }

  // ── B. Writing Script IDB exact candidates ────────────────────────────────
  const exactIdbRecords = allIdbDraftRecords.filter(r => r.matchType === "exactProjectId" || r.matchType === "legacyProjectId");
  const orphanIdbRecords = allIdbDraftRecords.filter(r => !["exactProjectId", "legacyProjectId"].includes(r.matchType));

  if (exactIdbRecords.length === 0) {
    // No record found at all
    candidates.push({
      id: "writingDraftIdb",
      label: "Writing Script IndexedDB cache",
      sourceType: "indexedDB",
      source: "FilmProductionBinderWritingDrafts/drafts",
      updatedAt: null,
      isEmpty: true,
      loadable: false,
      confidence: "none",
      warnings: ["No Writing Script IDB record found for this project ID."],
      validation: {
        writingScript: { hasActualPayload: false, nodeCount: 0, source: "none", warning: "Record missing." },
        writingCharacters: null,
        moodBoard: null,
      },
      summary: {
        writingScriptNodeCount: 0, writingScriptHasUserCreatedScript: false,
        moodBoardBoardCount: null, moodBoardImageCount: null,
        writingCharacterProfileCount: null, wcValidShape: null,
        localStorageMirrorKeyCount: null,
      },
    });
  } else {
    for (const rec of exactIdbRecords) {
      const hasPayload = rec.nodeCount > 0 || rec.hasUserCreatedScript;
      candidates.push({
        id: `writingDraftIdb_${rec.key}`,
        label: `Writing Script IndexedDB (${rec.matchType === "legacyProjectId" ? "legacy key" : "current key"})`,
        sourceType: "indexedDB",
        source: `FilmProductionBinderWritingDrafts/drafts/${rec.key}`,
        updatedAt: rec.savedAt,
        isEmpty: !hasPayload,
        loadable: hasPayload,
        confidence: hasPayload ? "high" : "low",
        warnings: [
          ...(rec.nodeCount === 0 && rec.hasUserCreatedScript ? ["IDB record exists but has 0 nodes."] : []),
          ...(!hasPayload ? ["IDB record has no content."] : []),
        ],
        validation: {
          writingScript: {
            hasActualPayload: hasPayload,
            nodeCount: rec.nodeCount,
            hasUserCreatedScript: rec.hasUserCreatedScript,
            savedAt: rec.savedAt,
            idbKey: rec.key,
            source: "indexedDB",
            warning: !hasPayload ? "Record exists but contains no recoverable script content." : null,
          },
          writingCharacters: null,
          moodBoard: null,
        },
        summary: {
          writingScriptNodeCount: rec.nodeCount,
          writingScriptHasUserCreatedScript: rec.hasUserCreatedScript,
          moodBoardBoardCount: null, moodBoardImageCount: null,
          writingCharacterProfileCount: null, wcValidShape: null,
          localStorageMirrorKeyCount: null,
        },
      });
    }
  }

  // ── Orphan IDB candidates (view-only) ─────────────────────────────────────
  for (const rec of orphanIdbRecords) {
    if (!rec.hasContent) continue; // skip empty orphans — not useful
    candidates.push({
      id: `orphanDraft_${rec.key}`,
      label: `Possible orphaned Writing Script draft (${rec.matchType})`,
      sourceType: "orphanDraft",
      source: `FilmProductionBinderWritingDrafts/drafts/${rec.key}`,
      updatedAt: rec.savedAt,
      isEmpty: false,
      loadable: false, // view-only in this sprint
      confidence: rec.confidence,
      warnings: [
        `Key "${rec.key}" matched by ${rec.matchType}. Not automatically loaded — verify manually.`,
        ...(rec.payloadProjectId && rec.payloadProjectId !== projectId ? [`Payload projectId: "${rec.payloadProjectId}" (≠ current project ID)`] : []),
      ],
      validation: {
        writingScript: {
          hasActualPayload: rec.nodeCount > 0,
          nodeCount: rec.nodeCount,
          hasUserCreatedScript: rec.hasUserCreatedScript,
          savedAt: rec.savedAt,
          idbKey: rec.key,
          source: "orphanIdb",
          warning: "Orphan candidate — not loaded automatically.",
        },
        writingCharacters: null,
        moodBoard: null,
      },
      summary: {
        writingScriptNodeCount: rec.nodeCount,
        writingScriptHasUserCreatedScript: rec.hasUserCreatedScript,
        moodBoardBoardCount: null, moodBoardImageCount: null,
        writingCharacterProfileCount: null, wcValidShape: null,
        localStorageMirrorKeyCount: null,
      },
    });
  }

  // ── C. ProjectCache mirror current ───────────────────────────────────────
  if (mirrorRecord) {
    const mirrorValidation = await validateMirrorPayload(mirrorRecord.payload, projectId, allIdbDraftRecords);
    const wsOk = mirrorValidation.writingScript.isActualPayload;
    const mbOk = mirrorValidation.moodBoard.isMeaningful;
    const wcOk = mirrorValidation.writingCharacters.isValidShape && mirrorValidation.writingCharacters.profileCount > 0;
    const hasAnything = wsOk || mbOk || wcOk || mirrorValidation.keyCount > 0;
    const loadable = mirrorValidation.keyCount > 0; // loadable if it has any keys to restore

    candidates.push({
      id: "projectCacheMirrorCurrent",
      label: "ProjectCache localStorage mirror (last clean exit)",
      sourceType: "projectCacheMirror",
      source: "FilmProductionBinderProjectCache/currentProjectCache",
      updatedAt: mirrorRecord.updatedAt || mirrorRecord.payload?.capturedAt || null,
      isEmpty: !hasAnything,
      loadable,
      confidence: hasAnything ? "medium" : "low",
      warnings: [
        ...(!wsOk ? [mirrorValidation.writingScript.warning || "Writing Script not recoverable from this mirror."] : []),
        ...(mirrorValidation.moodBoard.isDefault ? ["MoodBoard is default/empty in this mirror."] : []),
        ...(!wcOk && mirrorValidation.writingCharacters.payloadExists ? [mirrorValidation.writingCharacters.warning || "WritingCharacters shape issue."] : []),
      ].filter(Boolean),
      validation: {
        writingScript: { ...mirrorValidation.writingScript, source: "projectCacheMirror" },
        writingCharacters: { ...mirrorValidation.writingCharacters, source: "projectCacheMirror" },
        moodBoard: { ...mirrorValidation.moodBoard, source: "projectCacheMirror" },
        keyList: mirrorValidation.keyList,
      },
      summary: {
        writingScriptNodeCount: mirrorValidation.writingScript.nodeCount,
        writingScriptHasUserCreatedScript: mirrorValidation.writingScript.isActualPayload,
        moodBoardBoardCount: mirrorValidation.moodBoard.boardCount,
        moodBoardImageCount: mirrorValidation.moodBoard.imageCount,
        writingCharacterProfileCount: mirrorValidation.writingCharacters.profileCount,
        wcValidShape: mirrorValidation.writingCharacters.isValidShape,
        localStorageMirrorKeyCount: mirrorValidation.keyCount,
      },
    });
  } else {
    candidates.push({
      id: "projectCacheMirrorCurrent",
      label: "ProjectCache localStorage mirror (last clean exit)",
      sourceType: "projectCacheMirror",
      source: "FilmProductionBinderProjectCache/currentProjectCache",
      updatedAt: null,
      isEmpty: true,
      loadable: false,
      confidence: "none",
      warnings: ["No localStorage mirror record found."],
      validation: { writingScript: null, writingCharacters: null, moodBoard: null, keyList: [] },
      summary: {
        writingScriptNodeCount: null, writingScriptHasUserCreatedScript: null,
        moodBoardBoardCount: null, moodBoardImageCount: null,
        writingCharacterProfileCount: null, wcValidShape: null,
        localStorageMirrorKeyCount: 0,
      },
    });
  }

  // ── D. ProjectCache versions ──────────────────────────────────────────────
  for (const ver of versions.slice(0, 3)) {
    const mirrorValidation = await validateMirrorPayload(ver.payload, projectId, allIdbDraftRecords);
    const wsOk = mirrorValidation.writingScript.isActualPayload;
    const mbOk = mirrorValidation.moodBoard.isMeaningful;
    const wcOk = mirrorValidation.writingCharacters.isValidShape && mirrorValidation.writingCharacters.profileCount > 0;
    const hasAnything = wsOk || mbOk || wcOk || mirrorValidation.keyCount > 0;
    const loadable = mirrorValidation.keyCount > 0;

    candidates.push({
      id: `projectCacheVersion_${ver.id}`,
      label: `Mirror version — ${ver.reason || "saved"} at ${ver.createdAt ? ver.createdAt.slice(0, 16).replace("T", " ") : "unknown"}`,
      sourceType: "projectCacheVersion",
      source: "FilmProductionBinderProjectCache/projectCacheVersions",
      updatedAt: ver.createdAt,
      isEmpty: !hasAnything,
      loadable,
      confidence: hasAnything ? "medium" : "low",
      warnings: [
        ...(!wsOk ? [mirrorValidation.writingScript.warning || "Writing Script not recoverable from this version."] : []),
        ...(mirrorValidation.moodBoard.isDefault ? ["MoodBoard is default/empty."] : []),
      ].filter(Boolean),
      validation: {
        writingScript: { ...mirrorValidation.writingScript, source: "projectCacheVersion" },
        writingCharacters: { ...mirrorValidation.writingCharacters, source: "projectCacheVersion" },
        moodBoard: { ...mirrorValidation.moodBoard, source: "projectCacheVersion" },
        keyList: mirrorValidation.keyList,
        versionId: ver.id,
      },
      summary: {
        writingScriptNodeCount: mirrorValidation.writingScript.nodeCount,
        writingScriptHasUserCreatedScript: mirrorValidation.writingScript.isActualPayload,
        moodBoardBoardCount: mirrorValidation.moodBoard.boardCount,
        moodBoardImageCount: mirrorValidation.moodBoard.imageCount,
        writingCharacterProfileCount: mirrorValidation.writingCharacters.profileCount,
        wcValidShape: mirrorValidation.writingCharacters.isValidShape,
        localStorageMirrorKeyCount: mirrorValidation.keyCount,
      },
    });
  }

  // ── E. Emergency backups ──────────────────────────────────────────────────
  // Non-pending statuses: "synced", "dismissed-local", "resolved"
  // Only "pending" (or missing status) is unresolved/blocking.
  const RESOLVED_STATUSES = new Set(["synced", "dismissed-local", "resolved"]);

  for (const rec of emergencyRecords) {
    const wsNodeCount = rec.modules?.writingScript?.nodeCount ?? null;
    const isPending = !RESOLVED_STATUSES.has(rec.syncStatus);
    candidates.push({
      id: `emergencyBackup_${rec.id}`,
      // Expose the raw backup ID and syncStatus so AuthWrapper can reference them
      // when recording a recovery decision and resolving backups after clean save.
      _backupId: rec.id,
      _syncStatus: rec.syncStatus ?? "pending",
      label: `Emergency backup — ${rec.reason || "unknown"} at ${rec.createdAt ? rec.createdAt.slice(0, 16).replace("T", " ") : "unknown"}`,
      sourceType: "emergencyBackup",
      source: "FilmProductionBinderEmergencyBackups/backups",
      updatedAt: rec.createdAt,
      isEmpty: false,
      loadable: false, // view-only in this sprint
      confidence: isPending ? "medium" : "low",
      warnings: [
        isPending ? "NOT synced to Supabase — local only." : `Sync status: ${rec.syncStatus}`,
        "Emergency backups are view-only in this sprint. Use Retry Sync from the backup banner.",
      ],
      validation: {
        writingScript: {
          hasActualPayload: wsNodeCount !== null && wsNodeCount > 0,
          nodeCount: wsNodeCount ?? 0,
          source: "emergencyBackup",
          warning: "Full payload not available in emergency record — only metadata is stored here.",
        },
        writingCharacters: null,
        moodBoard: null,
      },
      summary: {
        writingScriptNodeCount: wsNodeCount,
        writingScriptHasUserCreatedScript: wsNodeCount > 0,
        moodBoardBoardCount: null, moodBoardImageCount: null,
        writingCharacterProfileCount: null, wcValidShape: null,
        localStorageMirrorKeyCount: null,
      },
    });
  }

  // ── Recommendation ────────────────────────────────────────────────────────
  const supabaseCand = candidates.find(c => c.id === "supabase");
  const idbCands = candidates.filter(c => c.sourceType === "indexedDB" && c.loadable && !c.isEmpty);
  const mirrorCand = candidates.find(c => c.id === "projectCacheMirrorCurrent");
  const orphans = candidates.filter(c => c.sourceType === "orphanDraft");
  // Only count emergency backups with pending/unresolved status as blocking.
  const emergencies = candidates.filter(c => c.sourceType === "emergencyBackup" && c._syncStatus === "pending");
  const anyVersionWithContent = candidates.filter(c => c.sourceType === "projectCacheVersion" && !c.isEmpty);

  const supabaseEmpty = supabaseCand?.isEmpty !== false;
  const supabaseError = supabaseCand?.confidence === "error";
  const localHasContent = idbCands.length > 0 || (mirrorCand && !mirrorCand.isEmpty) || anyVersionWithContent.length > 0;

  let recommendation;
  let requiresUserChoice = false;

  if (supabaseError) {
    recommendation = "supabase_read_failed";
    requiresUserChoice = localHasContent || orphans.length > 0;
    if (requiresUserChoice) scanWarnings.push("Supabase read failed. Local recovery sources may exist.");
  } else if (supabaseEmpty && localHasContent) {
    recommendation = "supabase_empty_local_has_content";
    requiresUserChoice = true;
    scanWarnings.push("Supabase appears empty but local/cached sources have content.");
  } else if (supabaseEmpty && orphans.length > 0) {
    recommendation = "supabase_empty_orphan_drafts_found";
    requiresUserChoice = true;
    scanWarnings.push("Supabase empty and possible orphaned IDB drafts were found.");
  } else if (emergencies.length > 0 && !supabaseEmpty) {
    recommendation = "pending_emergency_with_supabase_data";
    requiresUserChoice = true;
    scanWarnings.push("Pending emergency backup exists alongside Supabase data — versions may differ.");
  } else if (!supabaseEmpty) {
    recommendation = "supabase_safe";
    requiresUserChoice = false;
  } else {
    recommendation = "all_empty_new_project";
    requiresUserChoice = false;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[projectRecoveryScanner] project=${projectId} | recommendation=${recommendation} | requiresUserChoice=${requiresUserChoice}`,
      candidates.map(c => ({ id: c.id, isEmpty: c.isEmpty, loadable: c.loadable, confidence: c.confidence }))
    );
  }

  return {
    projectId, projectName, scannedAt, candidates,
    recommendation, requiresUserChoice, warnings: scanWarnings,
    orphanDraftsFound: orphans.length,
  };
}

// ─── Source application helpers ───────────────────────────────────────────────

export function applyWritingDraftIdbSource(projectId, idbKey) {
  if (!projectId) return false;
  try {
    const key = idbKey || `writingScriptDraft:${projectId}`;
    const marker = JSON.stringify({ storage: "indexedDB", indexedDbKey: key });
    localStorage.setItem(`writingScriptDraft:${projectId}`, marker);
    return true;
  } catch { return false; }
}

export async function applyProjectCacheMirrorSource(projectId) {
  if (!projectId) return false;
  try {
    const record = await getCurrentProjectCache(projectId, MIRROR_MODULE_KEY);
    if (!record?.payload?.keys) return false;
    let written = 0;
    for (const [key, rawValue] of Object.entries(record.payload.keys)) {
      if (key.startsWith("sb-") || key.startsWith("fpb:emergencyBackup:")) continue;
      try { localStorage.setItem(key, rawValue); written++; } catch {}
    }
    return written > 0;
  } catch { return false; }
}

export async function applyProjectCacheVersionSource(versionId) {
  if (!versionId) return false;
  try {
    const db = await openIdbRO("FilmProductionBinderProjectCache", 1);
    const record = await idbGetRO(db, "projectCacheVersions", versionId);
    db.close();
    if (!record?.payload?.keys) return false;
    let written = 0;
    for (const [key, rawValue] of Object.entries(record.payload.keys)) {
      if (key.startsWith("sb-") || key.startsWith("fpb:emergencyBackup:")) continue;
      try { localStorage.setItem(key, rawValue); written++; } catch {}
    }
    return written > 0;
  } catch { return false; }
}
