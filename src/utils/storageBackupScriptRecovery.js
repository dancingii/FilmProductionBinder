// Storage Backup Script Recovery
//
// Parses a FilmProductionBinder Storage Backup JSON object read-only.
// Separates true Writing Script draft payloads from related-but-not-draft entries.
//
// ATTACHABLE: only writingScriptDraft:<id> and scriptWritingDraft:<id> keys
//             with a parsed nodes[] array and nodes.length > 0.
//
// VIEW-ONLY:  scriptBeats, scriptTimelinePositions, writingScriptMoodOverlay,
//             scriptMoodOverlaySettings, writingScriptTargetPageCount,
//             writingScriptEditorPosition, writingScriptCollapsedActs, and
//             any other key containing "script" that is NOT a draft key.
//
// This module is READ-ONLY. It never writes, opens files, or touches storage.

export const BACKUP_RECOVERY_SOURCE = "storageBackup";

// Keys whose values must never be exposed or restored.
const AUTH_KEY_PREFIXES = ["sb-", "supabase.auth", "supabase-auth"];

// Only these two prefixes produce attachable Writing Script draft candidates.
const WRITING_DRAFT_KEY_PREFIXES = ["writingScriptDraft:", "scriptWritingDraft:"];

// Keys that are related script data but are NOT Writing Script draft payloads.
// They get a "view-only" row; they are never attachable.
const RELATED_SCRIPT_KEY_PREFIXES = [
  "scriptBeats:",
  "writingScriptBeats:",
  "scriptBeats",
  "scriptTimelinePositions:",
  "writingScriptTimelinePositions:",
  "scriptMoodOverlaySettings:",
  "scriptMoodOverlaySettings",
  "scriptMoodOverlayEnabled:",
  "scriptMoodOverlayEnabled",
  "writingScriptMoodOverlay:",
  "writingScriptTargetPageCount:",
  "scriptTargetPageCount:",
  "writingScriptEditorPosition:",
  "writingScriptCollapsedActs:",
  "writingScriptTimelineSettings:",
  "writingScriptSidePanelTab:",
  "writingTitlePageSettings:",
  "writingSpellcheckDictionary:",
];

function isAuthKey(key) {
  return AUTH_KEY_PREFIXES.some(p => key.startsWith(p));
}

function isDraftKey(key) {
  return WRITING_DRAFT_KEY_PREFIXES.some(p => key.startsWith(p));
}

function isRelatedScriptKey(key) {
  if (isAuthKey(key) || isDraftKey(key)) return false;
  return RELATED_SCRIPT_KEY_PREFIXES.some(p => key.startsWith(p));
}

function extractProjectIdFromKey(key) {
  for (const p of WRITING_DRAFT_KEY_PREFIXES) {
    if (key.startsWith(p)) return key.slice(p.length) || null;
  }
  return null;
}

// Classify a raw string value into a Writing Script draft payload shape.
// Returns shape descriptor — never exposes script text content.
function classifyDraftValue(raw, sizeBytes) {
  if (!raw) return { shape: "null", isPayload: false, isMarker: false, nodeCount: 0 };

  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { shape: "unparseable", isPayload: false, isMarker: false, nodeCount: 0 };
  }

  // Marker: storage:"indexedDB" pointer
  if (parsed?.storage === "indexedDB") {
    return {
      shape: "marker_indexedDB",
      isPayload: false,
      isMarker: true,
      nodeCount: 0,
      markerNodeCount: parsed?.nodeCount ?? 0,
      markerIndexedDbKey: parsed?.indexedDbKey || null,
      savedAt: parsed?.savedAt || null,
      projectId: parsed?.projectId || null,
      hasUserCreatedScript: parsed?.hasUserCreatedScript ?? false,
    };
  }

  // Full payload: object with nodes array, or bare array
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes
    : Array.isArray(parsed) ? parsed
    : null;

  if (!nodes) {
    return { shape: "unknown", isPayload: false, isMarker: false, nodeCount: 0 };
  }

  const nodeCount = nodes.length;
  const hasSceneHeadings = nodes.some(n => n?.type === "Scene Heading");
  const hasMeaningfulText = nodes.some(n => String(n?.text || "").trim().length > 0);
  const hasUserCreatedScript = parsed?.hasUserCreatedScript === true || hasSceneHeadings || hasMeaningfulText;

  // Element type summary — types and counts ONLY, no text content
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
    shape: `nodes[${nodeCount}]`,
    isPayload: true,
    isMarker: false,
    nodeCount,
    hasUserCreatedScript,
    hasSceneHeadings,
    hasMeaningfulText,
    elementTypeSummary,
    savedAt: parsed?.savedAt || null,
    projectId: parsed?.projectId || null,
    _nodes: nodes,
    sizeBytes: sizeBytes || 0,
  };
}

function buildConfidence(projectIdFromKey, projectIdFromEntry, projectIdFromPayload) {
  if (projectIdFromKey && projectIdFromPayload && projectIdFromKey === projectIdFromPayload) return "high";
  if (projectIdFromKey && projectIdFromEntry && projectIdFromKey === projectIdFromEntry) return "high";
  if (projectIdFromKey || projectIdFromPayload || projectIdFromEntry) return "medium";
  return "low";
}

function makeCandidateId(key, index) {
  return `backup_ls_${key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60)}_${index}`;
}

// ─── localStorage draft scanner ───────────────────────────────────────────────

function scanDraftEntries(entries, backupMeta) {
  const candidates = [];
  let index = 0;

  for (const entry of entries) {
    const { key, value, sizeBytes, flags } = entry;
    if (!key) continue;
    if (flags?.auth || isAuthKey(key)) continue;
    if (!isDraftKey(key)) continue;

    const cls = classifyDraftValue(value, sizeBytes);
    if (!cls.isPayload && !cls.isMarker) continue;

    const projectIdFromKey = extractProjectIdFromKey(key);
    const projectIdFromEntry = entry.projectId || null;
    const projectIdFromPayload = cls.projectId || null;

    const warnings = [];
    if (cls.isMarker) warnings.push("marker_only — full payload not in backup");
    if (!cls.isMarker && cls.nodeCount === 0) warnings.push("empty_nodes");
    if (!cls.savedAt && !cls.isMarker) warnings.push("missing_savedAt");
    if (key.startsWith("scriptWritingDraft:")) warnings.push("legacy_key");
    if (
      projectIdFromKey && projectIdFromPayload &&
      projectIdFromKey !== projectIdFromPayload
    ) warnings.push(`projectId_mismatch: key="${projectIdFromKey}" payload="${projectIdFromPayload}"`);

    const confidence = cls.isMarker
      ? "invalid"
      : buildConfidence(projectIdFromKey, projectIdFromEntry, projectIdFromPayload);

    candidates.push({
      candidateId: makeCandidateId(key, index++),
      source: BACKUP_RECOVERY_SOURCE,
      backupGeneratedAt: backupMeta?.generatedAt || null,
      backupCurrentProjectId: backupMeta?.currentProjectId || null,
      backupCurrentProjectName: backupMeta?.currentProjectName || null,
      key,
      projectIdFromKey,
      projectIdFromEntry,
      projectIdFromPayload,
      // Best single projectId for matching — prefer key over payload
      projectId: projectIdFromKey || projectIdFromPayload || projectIdFromEntry || null,
      savedAt: cls.savedAt || null,
      nodeCount: cls.isMarker ? 0 : cls.nodeCount,
      markerNodeCount: cls.isMarker ? (cls.markerNodeCount ?? 0) : null,
      hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
      hasSceneHeadings: cls.hasSceneHeadings ?? false,
      hasMeaningfulText: cls.hasMeaningfulText ?? false,
      elementTypeSummary: cls.elementTypeSummary || null,
      sizeBytes: sizeBytes || 0,
      isLegacyKey: key.startsWith("scriptWritingDraft:"),
      isCurrentKey: key.startsWith("writingScriptDraft:"),
      isDraftKey: true,
      recoverable: cls.isPayload && cls.nodeCount > 0,
      confidence,
      warnings,
      _nodes: cls.isPayload ? cls._nodes : null,
      _isMarker: cls.isMarker,
    });
  }

  return candidates;
}

// ─── localStorage related-data scanner ────────────────────────────────────────

function scanRelatedEntries(entries, backupMeta) {
  const related = [];

  for (const entry of entries) {
    const { key, value, sizeBytes, flags } = entry;
    if (!key) continue;
    if (flags?.auth || isAuthKey(key)) continue;
    if (!isRelatedScriptKey(key)) continue;

    const projectIdFromEntry = entry.projectId || null;

    // Try to extract savedAt without exposing content
    let savedAt = null;
    try {
      if (value && value !== "[hidden-auth-token]") {
        const p = JSON.parse(value);
        savedAt = p?.savedAt || null;
      }
    } catch {}

    related.push({
      key,
      projectId: projectIdFromEntry || null,
      sizeBytes: sizeBytes || 0,
      savedAt,
      isRelated: true,
      isDraftKey: false,
      recoverable: false,
      warning: "Related script data — not a Writing Script draft payload. View-only.",
    });
  }

  return related;
}

// ─── IDB backup section scanner ───────────────────────────────────────────────

function scanIdbDraftEntries(idbData, backupMeta) {
  const candidates = [];
  if (!idbData?.databases) return candidates;

  for (const db of idbData.databases) {
    if (db.name !== "FilmProductionBinderWritingDrafts") continue;
    for (const storeEntry of (db.stores || [])) {
      if (storeEntry.store !== "drafts") continue;
      for (const rec of (storeEntry.records || [])) {
        const { key, payload } = rec;
        if (!key || !isDraftKey(key)) continue;

        const cls = classifyDraftValue(payload, JSON.stringify(payload || "").length);
        if (!cls.isPayload || cls.nodeCount === 0) continue;

        const projectIdFromKey = extractProjectIdFromKey(key);
        const projectIdFromPayload = cls.projectId || null;
        const warnings = [];
        if (!cls.savedAt) warnings.push("missing_savedAt");
        if (projectIdFromKey && projectIdFromPayload && projectIdFromKey !== projectIdFromPayload) {
          warnings.push(`projectId_mismatch: key="${projectIdFromKey}" payload="${projectIdFromPayload}"`);
        }

        const confidence = buildConfidence(projectIdFromKey, null, projectIdFromPayload);

        candidates.push({
          candidateId: `backup_idb_${key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60)}`,
          source: BACKUP_RECOVERY_SOURCE,
          backupGeneratedAt: backupMeta?.generatedAt || null,
          backupCurrentProjectId: backupMeta?.currentProjectId || null,
          backupCurrentProjectName: backupMeta?.currentProjectName || null,
          key,
          projectIdFromKey,
          projectIdFromEntry: null,
          projectIdFromPayload,
          projectId: projectIdFromKey || projectIdFromPayload || null,
          savedAt: cls.savedAt || null,
          nodeCount: cls.nodeCount,
          markerNodeCount: null,
          hasUserCreatedScript: cls.hasUserCreatedScript ?? false,
          hasSceneHeadings: cls.hasSceneHeadings ?? false,
          hasMeaningfulText: cls.hasMeaningfulText ?? false,
          elementTypeSummary: cls.elementTypeSummary || null,
          sizeBytes: cls.sizeBytes || 0,
          isLegacyKey: key.startsWith("scriptWritingDraft:"),
          isCurrentKey: key.startsWith("writingScriptDraft:"),
          isDraftKey: true,
          recoverable: true,
          confidence,
          warnings,
          _nodes: cls._nodes,
          _isMarker: false,
          _fromIdbBackup: true,
        });
      }
    }
  }

  return candidates;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Parse a FilmProductionBinder Storage Backup object and return:
 * - draftCandidates: only writingScriptDraft:/scriptWritingDraft: entries
 * - relatedEntries:  other script-related keys (view-only, not attachable)
 * - summary counts
 *
 * READ-ONLY — never writes, never opens files.
 *
 * @param {object} backupObj — parsed backup JSON
 * @returns {{
 *   valid: boolean, error?: string,
 *   backupMeta: object,
 *   draftCandidates: object[],
 *   recoverableDraftCandidates: object[],
 *   relatedEntries: object[],
 *   markerOnlyCount: number, emptyDraftCount: number,
 *   totalLsEntries: number, totalDraftEntries: number,
 *   totalRelatedEntries: number, largestNodeCount: number,
 * }}
 */
export function scanBackupForScriptCandidates(backupObj) {
  if (!backupObj || typeof backupObj !== "object") {
    return { valid: false, error: "Not a valid JSON object.", draftCandidates: [], recoverableDraftCandidates: [], relatedEntries: [] };
  }
  if (!backupObj.meta?.tool) {
    return { valid: false, error: "Missing meta.tool — not a FilmProductionBinder backup.", draftCandidates: [], recoverableDraftCandidates: [], relatedEntries: [] };
  }
  if (backupObj.meta.tool !== "FilmProductionBinder Storage Backup") {
    return { valid: false, error: `Unexpected tool: "${backupObj.meta.tool}"`, draftCandidates: [], recoverableDraftCandidates: [], relatedEntries: [] };
  }

  const backupMeta = backupObj.meta;
  const lsEntries = backupObj?.localStorage?.entries || [];
  const idbData = backupObj?.indexedDB || null;

  const lsDraftCandidates = scanDraftEntries(lsEntries, backupMeta);
  const idbDraftCandidates = scanIdbDraftEntries(idbData, backupMeta);
  const relatedEntries = scanRelatedEntries(lsEntries, backupMeta);

  // Deduplicate: IDB candidates whose key already appears in localStorage draft candidates
  const lsKeys = new Set(lsDraftCandidates.map(c => c.key));
  const dedupedIdb = idbDraftCandidates.filter(c => !lsKeys.has(c.key));

  const draftCandidates = [...lsDraftCandidates, ...dedupedIdb];
  const recoverableDraftCandidates = draftCandidates.filter(c => c.recoverable);
  const markerOnlyCount = draftCandidates.filter(c => c._isMarker).length;
  const emptyDraftCount = draftCandidates.filter(c => !c._isMarker && c.nodeCount === 0).length;
  const totalDraftEntries = lsEntries.filter(e => isDraftKey(e.key) && !isAuthKey(e.key)).length;
  const largestNodeCount = recoverableDraftCandidates.reduce((max, c) => Math.max(max, c.nodeCount), 0);

  return {
    valid: true,
    backupMeta,
    draftCandidates,
    recoverableDraftCandidates,
    relatedEntries,
    markerOnlyCount,
    emptyDraftCount,
    totalLsEntries: lsEntries.length,
    totalDraftEntries,
    totalRelatedEntries: relatedEntries.length,
    largestNodeCount,
  };
}

// ─── Project matching ─────────────────────────────────────────────────────────

/**
 * Match backup draft candidates to Supabase projects by projectId.
 *
 * Match priority:
 *   1. projectIdFromKey === project.id  (high)
 *   2. projectIdFromPayload === project.id  (high)
 *   3. projectIdFromEntry === project.id  (high)
 *   4. project name match  (medium)
 *   5. no match  (none)
 *
 * @param {object[]} candidates
 * @param {object[]} allProjects — [{ id, name, created_at, updated_at, userRole }]
 * @returns {object[]} candidates with matchedProject, matchType, matchConfidence added
 */
export function matchCandidatesToProjects(candidates, allProjects) {
  if (!Array.isArray(allProjects) || allProjects.length === 0) {
    return candidates.map(c => ({
      ...c,
      matchedProject: null,
      matchType: "no_projects",
      matchConfidence: "none",
    }));
  }

  return candidates.map(c => {
    const { projectIdFromKey, projectIdFromEntry, projectIdFromPayload } = c;

    // Priority 1: key projectId matches project.id exactly
    if (projectIdFromKey) {
      const m = allProjects.find(p => p.id === projectIdFromKey);
      if (m) return { ...c, matchedProject: m, matchType: "key_id", matchConfidence: "high" };
    }

    // Priority 2: payload projectId matches project.id
    if (projectIdFromPayload) {
      const m = allProjects.find(p => p.id === projectIdFromPayload);
      if (m) return { ...c, matchedProject: m, matchType: "payload_id", matchConfidence: "high" };
    }

    // Priority 3: entry.projectId matches project.id
    if (projectIdFromEntry) {
      const m = allProjects.find(p => p.id === projectIdFromEntry);
      if (m) return { ...c, matchedProject: m, matchType: "entry_id", matchConfidence: "high" };
    }

    // Priority 4: project name match (any of the above IDs vs project.name)
    const anyId = projectIdFromKey || projectIdFromPayload || projectIdFromEntry;
    if (anyId) {
      const m = allProjects.find(p => p.name && anyId.toLowerCase() === p.name.toLowerCase());
      if (m) return { ...c, matchedProject: m, matchType: "name", matchConfidence: "medium" };
    }

    return { ...c, matchedProject: null, matchType: "no_match", matchConfidence: "none" };
  });
}

// ─── Payload builder ──────────────────────────────────────────────────────────

/**
 * Build a normalized payload ready for attach/migrate.
 * Stamps now as savedAt/recoveredAt. Does not expose text in surface fields.
 *
 * @param {object} candidate
 * @param {object} matchedProject — { id, name }
 * @returns {object} normalized payload
 */
export function buildRecoveryPayload(candidate, matchedProject) {
  const nodes = candidate._nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("buildRecoveryPayload: candidate has no nodes");
  }
  const now = new Date().toISOString();
  return {
    projectId: matchedProject.id,
    savedAt: now,
    hasUserCreatedScript: true,
    nodes,
    recoveredAt: now,
    recoveredFrom: {
      type: BACKUP_RECOVERY_SOURCE,
      backupGeneratedAt: candidate.backupGeneratedAt || null,
      backupKey: candidate.key,
      originalSavedAt: candidate.savedAt || null,
      originalProjectId: candidate.projectIdFromPayload || candidate.projectIdFromKey || null,
    },
  };
}
