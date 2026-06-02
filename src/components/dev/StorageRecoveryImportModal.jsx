/**
 * StorageRecoveryImportModal — reusable storage backup import + script recovery UI.
 *
 * Can be opened from ProjectSelector (no project loaded) or from DevBacklogPortal
 * (project open). Does NOT require currentProject. Never calls setSelectedProject.
 * Never deletes localStorage, IndexedDB, or emergency backups.
 * Never restores auth/session keys.
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import {
  scanBackupForScriptCandidates,
  matchCandidatesToProjects,
  buildRecoveryPayload,
} from "../../utils/storageBackupScriptRecovery";
import {
  attachRecoveredWritingScript,
  scanWritingScriptRecoverySources,
} from "../../utils/writingScriptRecoveryScanner";
import {
  resolveProjectIdentityForName,
  collectKnownProjectIdentifiers,
  scoreCandidateAgainstProject,
  fetchSupabaseScriptStatus,
  scanLocalStorageForProject,
} from "../../utils/projectIdentityResolver";

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateBackupFile(parsed) {
  if (!parsed || typeof parsed !== "object") return { valid: false, error: "Not a valid JSON object." };
  if (!parsed.meta || !parsed.meta.tool) return { valid: false, error: "Missing meta.tool — not a FilmProductionBinder backup file." };
  if (parsed.meta.tool !== "FilmProductionBinder Storage Backup") {
    return { valid: false, error: `Unexpected tool identifier: "${parsed.meta.tool}". This file is not a FilmProductionBinder storage backup.` };
  }
  return { valid: true };
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso.slice(0, 16).replace("T", " "); }
}

function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── All-project fetcher (read-only, no hydration) ─────────────────────────────

async function fetchAllProjectsForRecovery() {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) return [];
    const userId = userData.user.id;

    const [ownedResult, memberResult] = await Promise.all([
      supabase.from("projects").select("id, name, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("project_members").select("project_id, role, projects(id, name, created_at, updated_at)").eq("user_id", userId),
    ]);

    const owned = (ownedResult.data || []).map(p => ({ ...p, userRole: "owner" }));
    const membered = (memberResult.data || []).map(m => ({ ...(m.projects || {}), userRole: m.role || "member" })).filter(p => p.id);

    const all = [...owned, ...membered];
    const seen = new Set();
    return all.filter(p => { if (!p.id || seen.has(p.id)) return false; seen.add(p.id); return true; });
  } catch {
    return [];
  }
}

// ── Badge components ──────────────────────────────────────────────────────────

function ConfBadge({ label, bg, color, border }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 5px", borderRadius: "3px", fontSize: "9px",
      fontWeight: "bold", backgroundColor: bg, color, border: `1px solid ${border}`,
      textTransform: "uppercase", letterSpacing: "0.03em", verticalAlign: "middle",
    }}>{label}</span>
  );
}

function KeyTypeBadge({ isCurrentKey, isLegacyKey }) {
  if (isCurrentKey) return <ConfBadge label="current" bg="#e3f2fd" color="#0d47a1" border="#90caf9" />;
  if (isLegacyKey)  return <ConfBadge label="legacy"  bg="#f3f3f3" color="#666"    border="#ddd"    />;
  return null;
}

function MatchBadge({ matchConfidence }) {
  if (matchConfidence === "high")   return <ConfBadge label="matched" bg="#e8f5e9" color="#2e7d32" border="#a5d6a7" />;
  if (matchConfidence === "medium") return <ConfBadge label="matched~" bg="#e3f2fd" color="#0d47a1" border="#90caf9" />;
  return <ConfBadge label="unmatched" bg="#f5f5f5" color="#888" border="#ddd" />;
}

function AgeBadge({ backupSavedAt, supSavedAt }) {
  if (!backupSavedAt || !supSavedAt) return null;
  const bDate = new Date(backupSavedAt);
  const sDate = new Date(supSavedAt);
  if (isNaN(bDate) || isNaN(sDate)) return null;
  if (bDate > sDate) return <ConfBadge label="newer than Supabase" bg="#e8f5e9" color="#2e7d32" border="#a5d6a7" />;
  if (bDate < sDate) return <ConfBadge label="older than Supabase" bg="#fff3e0" color="#e65100" border="#ffcc80" />;
  return <ConfBadge label="same time" bg="#f5f5f5" color="#888" border="#ddd" />;
}

// ── Destination status hook ───────────────────────────────────────────────────

function useDestinationStatus(matchedProject) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const projectId = matchedProject?.id;

  const refresh = useCallback(async () => {
    if (!projectId) { setStatus(null); return; }
    setLoading(true);
    try {
      const result = await scanWritingScriptRecoverySources({ id: projectId, name: matchedProject?.name });
      setStatus(result.backupStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, matchedProject?.name]);

  useEffect(() => { refresh(); }, [refresh]);
  return { status, loading, refresh };
}

// ── Single candidate attach card ──────────────────────────────────────────────

function BackupCandidateCard({ candidate }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachResult, setAttachResult] = useState(null);

  const matched = candidate.matchedProject;
  const { status, loading: statusLoading, refresh: refreshStatus } = useDestinationStatus(matched);

  const supNodeCount = status?.supabaseNodeCount ?? null;
  const idbNodeCount = status?.idbNodeCount ?? null;
  const cacheHasSnapshot = status?.projectCacheHasSnapshot ?? false;
  const lsMarkerPresent = status?.lsMarkerPresent ?? false;

  const destinationNonEmpty = supNodeCount !== null && supNodeCount > 0;
  const canAttach = candidate.recoverable && candidate.isDraftKey && matched && !attaching;

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setAttaching(true);
    setAttachResult(null);
    try {
      if (!Array.isArray(candidate._nodes) || candidate._nodes.length === 0) {
        setAttachResult({ success: false, error: "Candidate has 0 nodes — cannot attach." });
        return;
      }
      const payload = buildRecoveryPayload(candidate, matched);
      const result = await attachRecoveredWritingScript(matched, {
        ...candidate,
        _nodes: payload.nodes,
        sourceType: "storageBackup",
        sourceLocation: `backup:${candidate.key}`,
      });
      setAttachResult(result);
      if (result.success) refreshStatus();
    } catch (err) {
      setAttachResult({ success: false, error: err?.message || "Unknown error" });
    } finally {
      setAttaching(false);
    }
  };

  const cardBg = attachResult?.success ? "#e8f5e9" : attachResult?.success === false ? "#ffebee" : "#fafafa";
  const cardBorder = attachResult?.success ? "#a5d6a7" : attachResult?.success === false ? "#ef9a9a" : "#e0e0e0";

  return (
    <div style={{ border: `1px solid ${cardBorder}`, borderRadius: "6px", padding: "8px 10px", marginBottom: "6px", backgroundColor: cardBg, fontSize: "11px" }}>

      {/* Line 1: key + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "3px" }}>
        <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#333", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {candidate.key}
        </span>
        <KeyTypeBadge isCurrentKey={candidate.isCurrentKey} isLegacyKey={candidate.isLegacyKey} />
        <MatchBadge matchConfidence={candidate.matchConfidence} />
        <AgeBadge backupSavedAt={candidate.savedAt} supSavedAt={null} />
      </div>

      {/* Line 2: project name + ID */}
      {matched ? (
        <div style={{ marginBottom: "3px" }}>
          <strong style={{ fontSize: "11px", color: "#2e7d32" }}>{matched.name || "—"}</strong>
          <span style={{ fontSize: "9px", color: "#aaa", marginLeft: "6px", fontFamily: "monospace" }}>{matched.id?.slice(0, 8)}…</span>
          <span style={{ fontSize: "9px", color: "#888", marginLeft: "6px" }}>({candidate.matchType?.replace(/_/g, " ")})</span>
        </div>
      ) : (
        <div style={{ marginBottom: "3px", fontSize: "10px", color: "#888" }}>
          ○ No matching Supabase project found
        </div>
      )}

      {/* Line 3: payload info */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "10px", color: "#555", marginBottom: "3px" }}>
        <span><strong>{candidate.nodeCount}</strong> nodes</span>
        <span>backup savedAt: {fmtDate(candidate.savedAt)}</span>
        {candidate.elementTypeSummary && <span style={{ color: "#999" }}>{candidate.elementTypeSummary}</span>}
      </div>

      {/* Line 4: destination status */}
      {matched && (
        <div style={{ fontSize: "10px", marginBottom: "3px" }}>
          {statusLoading ? (
            <span style={{ color: "#aaa" }}>Checking destination…</span>
          ) : status ? (
            <span>
              <span style={{ color: supNodeCount > 0 ? "#c62828" : "#888", marginRight: "10px" }}>
                Supabase: {supNodeCount === null ? "error" : supNodeCount === 0 ? "empty" : `${supNodeCount} nodes`}
              </span>
              <span style={{ color: idbNodeCount > 0 ? "#2e7d32" : "#aaa", marginRight: "10px" }}>
                IDB: {idbNodeCount > 0 ? `${idbNodeCount} nodes` : "empty/missing"}
              </span>
              <span style={{ color: cacheHasSnapshot ? "#2e7d32" : "#aaa", marginRight: "10px" }}>
                Cache: {cacheHasSnapshot ? "✓" : "○"}
              </span>
              <span style={{ color: lsMarkerPresent ? "#2e7d32" : "#aaa" }}>
                Marker: {lsMarkerPresent ? "✓" : "○"}
              </span>
            </span>
          ) : (
            <span style={{ color: "#aaa" }}>Status unavailable</span>
          )}
        </div>
      )}

      {/* Warnings */}
      {candidate.warnings.length > 0 && (
        <div style={{ fontSize: "10px", color: "#e65100", marginBottom: "3px" }}>
          ⚠ {candidate.warnings.join(" · ")}
        </div>
      )}

      {/* Attach result */}
      {attachResult && (
        <div style={{
          padding: "5px 8px", borderRadius: "4px", marginTop: "4px",
          backgroundColor: attachResult.success ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${attachResult.success ? "#a5d6a7" : "#ef9a9a"}`,
          fontSize: "10px", color: attachResult.success ? "#2e7d32" : "#c62828",
        }}>
          {attachResult.success
            ? `✓ Attached ${attachResult.nodeCount} nodes. Supabase: ${attachResult.details?.supabase}, IDB: ${attachResult.details?.idb}, Cache: ${attachResult.details?.projectCacheCurrent}, Marker: ${attachResult.details?.lsMarker}`
            : `✗ Attach failed: ${attachResult.error}`}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && matched && (
        <div style={{ marginTop: "6px", padding: "8px 10px", borderRadius: "4px", border: `1px solid ${destinationNonEmpty ? "#ffcc80" : "#ce93d8"}`, backgroundColor: destinationNonEmpty ? "#fff3e0" : "#f3e5f5", fontSize: "10px" }}>
          {destinationNonEmpty && (
            <div style={{ color: "#e65100", fontWeight: "bold", marginBottom: "5px" }}>
              ⚠ Destination <strong>{matched.name}</strong> already has {supNodeCount} nodes in Supabase.
              Continuing will overwrite with {candidate.nodeCount} backup nodes.
            </div>
          )}
          <div style={{ marginBottom: "6px", color: "#333" }}>
            Attach backup script ({candidate.nodeCount} nodes, saved {fmtDate(candidate.savedAt)}) to <strong>{matched.name}</strong> ({matched.id?.slice(0, 8)}…)?
            Saves to Supabase, IDB, ProjectCache snapshot/version, localStorage marker.
            Auth keys are NOT restored. Backup is NOT deleted.
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={handleConfirm} style={{ fontSize: "11px", padding: "3px 10px", cursor: "pointer", border: "1px solid #a5d6a7", borderRadius: "4px", backgroundColor: "#e8f5e9", color: "#2e7d32", fontWeight: "bold" }}>
              Confirm Attach
            </button>
            <button onClick={() => setConfirmOpen(false)} style={{ fontSize: "11px", padding: "3px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attach button */}
      {!confirmOpen && !attachResult?.success && canAttach && (
        <div style={{ marginTop: "5px" }}>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={attaching}
            style={{
              fontSize: "11px", padding: "3px 10px", cursor: attaching ? "default" : "pointer",
              border: `1px solid ${destinationNonEmpty ? "#ffcc80" : "#ce93d8"}`,
              borderRadius: "4px",
              backgroundColor: attaching ? "#f5f5f5" : destinationNonEmpty ? "#fff3e0" : "#f3e5f5",
              color: attaching ? "#aaa" : destinationNonEmpty ? "#e65100" : "#6a1b9a",
              fontWeight: "bold",
            }}
          >
            {attaching ? "Attaching…" : destinationNonEmpty ? "Attach + Overwrite Supabase" : "Attach Backup Script to Project + Backup to Supabase"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sort config ───────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { v: "savedAt_desc", label: "Newest first" },
  { v: "savedAt_asc",  label: "Oldest first" },
  { v: "nodes_desc",   label: "Largest first" },
  { v: "project_az",   label: "Project A–Z" },
  { v: "confidence",   label: "Match confidence" },
  { v: "key_type",     label: "Current key first" },
];

function sortCandidates(candidates, sortBy) {
  return [...candidates].sort((a, b) => {
    if (sortBy === "savedAt_desc") {
      if (!a.savedAt && !b.savedAt) return 0;
      if (!a.savedAt) return 1;
      if (!b.savedAt) return -1;
      return b.savedAt.localeCompare(a.savedAt);
    }
    if (sortBy === "savedAt_asc") {
      if (!a.savedAt && !b.savedAt) return 0;
      if (!a.savedAt) return 1;
      if (!b.savedAt) return -1;
      return a.savedAt.localeCompare(b.savedAt);
    }
    if (sortBy === "nodes_desc") return b.nodeCount - a.nodeCount;
    if (sortBy === "project_az") {
      const na = a.matchedProject?.name || "zzz";
      const nb = b.matchedProject?.name || "zzz";
      return na.localeCompare(nb);
    }
    if (sortBy === "confidence") {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      return (order[a.matchConfidence] ?? 4) - (order[b.matchConfidence] ?? 4);
    }
    if (sortBy === "key_type") {
      return (a.isCurrentKey ? 0 : 1) - (b.isCurrentKey ? 0 : 1);
    }
    return 0;
  });
}

// ── Targeted project recovery ─────────────────────────────────────────────────

// Extract first + last scene heading text from a candidate's node array.
// Returns { first, last } — both may be null.
function extractSceneHeadings(candidate) {
  const nodes = candidate._nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return { first: null, last: null };
  const headings = nodes.filter(n => n?.type === "Scene Heading" && String(n?.text || "").trim());
  if (headings.length === 0) return { first: null, last: null };
  return {
    first: String(headings[0].text || "").trim().slice(0, 120),
    last: headings.length > 1 ? String(headings[headings.length - 1].text || "").trim().slice(0, 120) : null,
  };
}

// Status row helper
function StatusRow({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", gap: "6px", fontSize: "10px", marginBottom: "2px" }}>
      <span style={{ color: "#888", minWidth: "140px", flexShrink: 0 }}>{label}</span>
      <span style={{ color: valueColor || "#333", fontFamily: "monospace", wordBreak: "break-all" }}>{value ?? "—"}</span>
    </div>
  );
}


// Sort targeted candidates — default newest first, missing dates go last.
function sortTargetedCandidates(candidates, sortBy) {
  return [...candidates].sort((a, b) => {
    if (sortBy === "savedAt_desc") {
      if (!a.savedAt && !b.savedAt) return b.nodeCount - a.nodeCount;
      if (!a.savedAt) return 1;
      if (!b.savedAt) return -1;
      const cmp = b.savedAt.localeCompare(a.savedAt);
      return cmp !== 0 ? cmp : b.nodeCount - a.nodeCount;
    }
    if (sortBy === "savedAt_asc") {
      if (!a.savedAt && !b.savedAt) return b.nodeCount - a.nodeCount;
      if (!a.savedAt) return 1;
      if (!b.savedAt) return -1;
      const cmp = a.savedAt.localeCompare(b.savedAt);
      return cmp !== 0 ? cmp : b.nodeCount - a.nodeCount;
    }
    if (sortBy === "nodes_desc") return b.nodeCount - a.nodeCount || (b.savedAt || "").localeCompare(a.savedAt || "");
    if (sortBy === "confidence") {
      const s = b._targetScore - a._targetScore;
      return s !== 0 ? s : (b.savedAt || "").localeCompare(a.savedAt || "");
    }
    if (sortBy === "matched_first") {
      const ta = (a._targetTier === "orphan" || a._targetTier === "none") ? 1 : 0;
      const tb = (b._targetTier === "orphan" || b._targetTier === "none") ? 1 : 0;
      return ta !== tb ? ta - tb : (b.savedAt || "").localeCompare(a.savedAt || "");
    }
    if (sortBy === "orphan_first") {
      const ta = (a._targetTier === "orphan" || a._targetTier === "none") ? 0 : 1;
      const tb = (b._targetTier === "orphan" || b._targetTier === "none") ? 0 : 1;
      return ta !== tb ? ta - tb : (b.savedAt || "").localeCompare(a.savedAt || "");
    }
    return 0;
  });
}

const TARGET_SORT_OPTIONS = [
  { v: "savedAt_desc",  label: "Newest first" },
  { v: "savedAt_asc",   label: "Oldest first" },
  { v: "nodes_desc",    label: "Largest first" },
  { v: "confidence",    label: "Match confidence" },
  { v: "matched_first", label: "UUID matched first" },
  { v: "orphan_first",  label: "Orphan/manual first" },
];

// Script-family: candidates sharing first+last heading get a badge.
function buildFamilyGroups(candidates) {
  const counts = {};
  for (const c of candidates) {
    const h = extractSceneHeadings(c);
    if (h.first || h.last) {
      const k = `${(h.first || "").toLowerCase().trim()}|${(h.last || "").toLowerCase().trim()}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  const familyIds = new Set();
  for (const c of candidates) {
    const h = extractSceneHeadings(c);
    if (h.first || h.last) {
      const k = `${(h.first || "").toLowerCase().trim()}|${(h.last || "").toLowerCase().trim()}`;
      if (counts[k] > 1) familyIds.add(c.candidateId);
    }
  }
  return familyIds;
}

// ── Targeted candidate list row ───────────────────────────────────────────────

function TargetedCandidateRow({ candidate, isSelected, onSelect, isFamilyMember }) {
  const tier = candidate._targetTier;
  const tierColor = tier === "high" ? "#2e7d32" : tier === "medium" ? "#1565c0" : tier === "low" ? "#e65100" : "#888";
  const tierBg    = tier === "high" ? "#e8f5e9" : tier === "medium" ? "#e3f2fd" : tier === "low" ? "#fff3e0" : "#f5f5f5";
  const headings = extractSceneHeadings(candidate);

  return (
    <div
      onClick={onSelect}
      style={{
        border: `1px solid ${isSelected ? "#5c6bc0" : "#e0e0e0"}`,
        borderRadius: "5px",
        padding: "6px 8px",
        marginBottom: "4px",
        backgroundColor: isSelected ? "#e8eaf6" : "#fafafa",
        cursor: "pointer",
        outline: isSelected ? "2px solid #5c6bc0" : "none",
        outlineOffset: "-1px",
        fontSize: "11px",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ padding: "1px 5px", borderRadius: "3px", fontSize: "9px", fontWeight: "bold", backgroundColor: tierBg, color: tierColor, border: `1px solid ${tierColor}30`, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
          {tier}
        </span>
        <span style={{ fontWeight: "bold", color: "#333", whiteSpace: "nowrap", flexShrink: 0 }}>
          {fmtDate(candidate.savedAt)}
        </span>
        <span style={{ color: "#555", whiteSpace: "nowrap", flexShrink: 0 }}>
          <strong>{candidate.nodeCount}</strong> nodes
        </span>
        <KeyTypeBadge isCurrentKey={candidate.isCurrentKey} isLegacyKey={candidate.isLegacyKey} />
        {isFamilyMember && (
          <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", backgroundColor: "#fff8e1", color: "#f57f17", border: "1px solid #ffe082" }}>same family?</span>
        )}
        <span style={{ fontFamily: "monospace", fontSize: "9px", color: "#bbb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {candidate.key}
        </span>
      </div>
      {(headings.first || headings.last) && (
        <div style={{ marginTop: "2px", fontSize: "10px", fontFamily: "monospace", color: "#555" }}>
          {headings.first && <span style={{ color: "#666" }}>▸ {headings.first}</span>}
          {headings.last && headings.last !== headings.first && (
            <span style={{ color: "#aaa", marginLeft: "10px" }}>… {headings.last}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Selected candidate detail + attach panel ─────────────────────────────────

function SelectedCandidateDetail({ candidate, targetProject, supabaseStatus, onAttachSuccess }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachResult, setAttachResult] = useState(null);

  const tier = candidate._targetTier;
  const isOrphan = tier === "orphan" || tier === "none";
  const headings = extractSceneHeadings(candidate);
  const destNodeCount = supabaseStatus?.nodeCount ?? 0;
  const destNonEmpty = destNodeCount > 0;
  const canAttach = candidate.recoverable && targetProject?.id && !attaching && !attachResult?.success;
  const tierColor = tier === "high" ? "#2e7d32" : tier === "medium" ? "#1565c0" : tier === "low" ? "#e65100" : "#888";

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setAttaching(true);
    setAttachResult(null);
    try {
      const nodes = candidate._nodes;
      if (!Array.isArray(nodes) || nodes.length === 0) {
        setAttachResult({ success: false, error: "Candidate has 0 nodes — cannot attach." });
        return;
      }
      const payload = buildRecoveryPayload(candidate, targetProject);
      const result = await attachRecoveredWritingScript(targetProject, {
        ...candidate,
        _nodes: payload.nodes,
        sourceType: "storageBackup",
        sourceLocation: `backup:${candidate.key}`,
      });
      setAttachResult(result);
      if (result.success && onAttachSuccess) onAttachSuccess();
    } catch (err) {
      setAttachResult({ success: false, error: err?.message || "Unknown error" });
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div style={{ border: "2px solid #5c6bc0", borderRadius: "6px", padding: "10px 12px", backgroundColor: "#f8f9ff", fontSize: "11px" }}>
      <div style={{ fontWeight: "bold", color: "#1a237e", fontSize: "11px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Selected Candidate
      </div>

      {/* Candidate identity */}
      <div style={{ marginBottom: "6px", padding: "6px 8px", backgroundColor: "#fff", border: "1px solid #e8eaf6", borderRadius: "4px" }}>
        <StatusRow label="Source key" value={candidate.key} />
        <StatusRow label="UUID from key" value={candidate.projectIdFromKey || "—"} />
        {candidate.projectIdFromPayload && candidate.projectIdFromPayload !== candidate.projectIdFromKey && (
          <StatusRow label="Payload projectId" value={candidate.projectIdFromPayload} />
        )}
        <StatusRow label="backup savedAt" value={fmtDate(candidate.savedAt)} />
        <StatusRow label="Node count" value={`${candidate.nodeCount} nodes`} valueColor="#1565c0" />
        {candidate.elementTypeSummary && <StatusRow label="Element types" value={candidate.elementTypeSummary} />}
        {headings.first && <StatusRow label="First scene" value={headings.first} valueColor="#333" />}
        {headings.last  && <StatusRow label="Last scene"  value={headings.last}  valueColor="#333" />}
        <StatusRow label="Match tier" value={`${tier}${candidate._targetScore > 0 ? ` (score ${candidate._targetScore})` : ""}`} valueColor={tierColor} />
        {candidate._targetReasons?.length > 0 && (
          <StatusRow label="Match reason" value={candidate._targetReasons.join(" · ")} valueColor={tierColor} />
        )}
      </div>

      {/* Destination */}
      {targetProject && (
        <div style={{ marginBottom: "6px", padding: "6px 8px", backgroundColor: "#fff", border: "1px solid #e8eaf6", borderRadius: "4px" }}>
          <div style={{ fontSize: "10px", fontWeight: "bold", color: "#555", marginBottom: "3px" }}>DESTINATION PROJECT</div>
          <StatusRow label="Project name" value={targetProject.name} valueColor="#0d47a1" />
          <StatusRow label="Supabase project.id" value={targetProject.id} />
          <StatusRow
            label="Current Supabase nodes"
            value={supabaseStatus ? `${destNodeCount} nodes${supabaseStatus.savedAt ? ` (saved ${fmtDate(supabaseStatus.savedAt)})` : ""}` : "checking…"}
            valueColor={destNonEmpty ? "#c62828" : "#888"}
          />
        </div>
      )}

      {/* Orphan warning */}
      {isOrphan && (
        <div style={{ marginBottom: "6px", padding: "6px 8px", backgroundColor: "#fff3e0", border: "1px solid #ffcc80", borderRadius: "4px", fontSize: "10px", color: "#e65100" }}>
          <strong>⚠ MANUAL/ORPHAN MATCH</strong> — no UUID link to{" "}
          <strong>{targetProject?.name || "selected project"}</strong>.
          Verify via scene headings above before attaching.
        </div>
      )}

      {/* Attach result */}
      {attachResult && (
        <div style={{ padding: "6px 8px", borderRadius: "4px", marginBottom: "6px", backgroundColor: attachResult.success ? "#e8f5e9" : "#ffebee", border: `1px solid ${attachResult.success ? "#a5d6a7" : "#ef9a9a"}`, fontSize: "10px", color: attachResult.success ? "#2e7d32" : "#c62828" }}>
          {attachResult.success
            ? `✓ Attached ${attachResult.nodeCount} nodes to ${targetProject?.name}. Supabase: ${attachResult.details?.supabase}, IDB: ${attachResult.details?.idb}, Cache: ${attachResult.details?.projectCacheCurrent}, Marker: ${attachResult.details?.lsMarker}. Project was NOT opened.`
            : `✗ Attach failed: ${attachResult.error}`}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && targetProject && (
        <div style={{ padding: "8px 10px", borderRadius: "4px", border: `2px solid ${destNonEmpty ? "#ef9a9a" : "#ce93d8"}`, backgroundColor: destNonEmpty ? "#fff5f5" : "#f3e5f5", fontSize: "10px", marginBottom: "6px" }}>
          {isOrphan && (
            <div style={{ color: "#c62828", fontWeight: "bold", marginBottom: "6px", lineHeight: 1.5 }}>
              ⚠ THIS CANDIDATE DOES NOT UUID-MATCH "{targetProject.name.toUpperCase()}".
            </div>
          )}
          {destNonEmpty && (
            <div style={{ color: "#c62828", fontWeight: "bold", marginBottom: "6px", lineHeight: 1.5 }}>
              ⚠ DESTINATION ALREADY HAS {destNodeCount} NODES IN SUPABASE. THIS WILL OVERWRITE.
              Only continue if this backup is the correct version to replace.
            </div>
          )}
          <div style={{ marginBottom: "8px", color: "#333", lineHeight: 1.6 }}>
            <div>You are attaching to destination project:</div>
            <div style={{ fontFamily: "monospace", marginLeft: "8px", color: "#0d47a1" }}>
              {targetProject.name}<br />{targetProject.id}
            </div>
            <div style={{ marginTop: "4px" }}>Candidate source key:</div>
            <div style={{ fontFamily: "monospace", marginLeft: "8px", color: "#555" }}>{candidate.key}</div>
            <div style={{ marginTop: "4px" }}>Candidate: <strong>{candidate.nodeCount} nodes</strong>, backup saved {fmtDate(candidate.savedAt)}</div>
            {headings.first && <div style={{ marginTop: "2px" }}>First scene: <span style={{ fontFamily: "monospace" }}>{headings.first}</span></div>}
            {headings.last  && <div>Last scene: <span style={{ fontFamily: "monospace" }}>{headings.last}</span></div>}
            <div style={{ marginTop: "4px" }}>Current Supabase: <strong>{destNodeCount} nodes</strong></div>
            <div style={{ marginTop: "6px", color: "#666" }}>
              Saves to Supabase, IndexedDB, ProjectCache, and localStorage marker.
              Does NOT open the project. Does NOT delete the original backup data.
              Auth keys are NOT restored.
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={handleConfirm}
              style={{ fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: `1px solid ${destNonEmpty ? "#ef9a9a" : isOrphan ? "#ffcc80" : "#a5d6a7"}`, borderRadius: "4px", backgroundColor: destNonEmpty ? "#ffebee" : isOrphan ? "#fff3e0" : "#e8f5e9", color: destNonEmpty ? "#c62828" : isOrphan ? "#e65100" : "#2e7d32", fontWeight: "bold" }}
            >
              {destNonEmpty
                ? `Confirm Overwrite + Attach to ${targetProject.name}`
                : `Confirm Attach to ${targetProject.name}`}
            </button>
            <button onClick={() => setConfirmOpen(false)} style={{ fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attach button */}
      {!confirmOpen && !attachResult?.success && canAttach && (
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={attaching}
          style={{ fontSize: "11px", padding: "5px 14px", cursor: attaching ? "default" : "pointer", border: `1px solid ${destNonEmpty ? "#ef9a9a" : isOrphan ? "#ffcc80" : "#ce93d8"}`, borderRadius: "4px", backgroundColor: attaching ? "#f5f5f5" : destNonEmpty ? "#ffebee" : isOrphan ? "#fff3e0" : "#f3e5f5", color: attaching ? "#aaa" : destNonEmpty ? "#c62828" : isOrphan ? "#e65100" : "#6a1b9a", fontWeight: "bold", width: "100%" }}
        >
          {attaching
            ? "Attaching…"
            : `Attach Selected Candidate to ${targetProject?.name || "selected project"} + Backup to Supabase`}
        </button>
      )}
    </div>
  );
}

// ── Targeted Project Recovery panel ───────────────────────────────────────────────────────────────────

function TargetedProjectRecovery({ allProjects, parsed }) {
  const [searchInput, setSearchInput] = useState("I Am Awake");
  const [resolvedProject, setResolvedProject] = useState(null);
  const [resolveMatch, setResolveMatch] = useState(null);
  const [suggestedProjects, setSuggestedProjects] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [idbScanResult, setIdbScanResult] = useState(null);
  const [lsScan, setLsScan] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [backupCandidates, setBackupCandidates] = useState(null);
  const [targetSort, setTargetSort] = useState("savedAt_desc");
  const [orphanFilter, setOrphanFilter] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [manualProjectId, setManualProjectId] = useState(null);
  const [showProjectStatus, setShowProjectStatus] = useState(true);
  const searchRef = useRef(null);

  const resolveProject = useCallback(() => {
    if (!allProjects || allProjects.length === 0) return;
    const match = resolveProjectIdentityForName(allProjects, searchInput.trim());
    if (match) {
      setResolveMatch(match);
      setResolvedProject(match.project);
      setSuggestedProjects([]);
      setManualProjectId(null);
      setSelectedCandidateId(null);
    } else {
      setResolveMatch(null);
      setResolvedProject(null);
      setSelectedCandidateId(null);
      const lower = searchInput.trim().toLowerCase();
      const scored = allProjects
        .map(p => ({
          p,
          score: p.name.toLowerCase().includes(lower) ? 10
            : lower.includes(p.name.toLowerCase()) ? 7
            : p.name.toLowerCase().split(/\s+/).some(w => lower.includes(w)) ? 3 : 0,
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(x => x.p);
      setSuggestedProjects(scored.length > 0 ? scored : allProjects.slice(0, 5));
    }
  }, [allProjects, searchInput]);

  // Live storage scan when project resolves
  useEffect(() => {
    const project = resolvedProject;
    if (!project?.id) {
      setIdentity(null); setSupabaseStatus(null); setIdbScanResult(null); setLsScan(null);
      return;
    }
    setLiveLoading(true);
    setIdentity(null); setSupabaseStatus(null); setIdbScanResult(null); setLsScan(null);
    setLsScan(scanLocalStorageForProject(project.id, project.name));
    Promise.all([
      collectKnownProjectIdentifiers(project),
      fetchSupabaseScriptStatus(project.id),
      scanWritingScriptRecoverySources(project),
    ]).then(([ident, supStatus, idbResult]) => {
      setIdentity(ident);
      setSupabaseStatus(supStatus);
      setIdbScanResult(idbResult);
    }).catch(err => {
      console.warn("[TargetedProjectRecovery] live scan error:", err);
    }).finally(() => setLiveLoading(false));
  }, [resolvedProject]);

  // Score backup candidates when identity or backup changes
  useEffect(() => {
    if (!identity || !parsed) { setBackupCandidates(null); setSelectedCandidateId(null); return; }
    const scanResult = scanBackupForScriptCandidates(parsed);
    if (!scanResult.valid) { setBackupCandidates([]); return; }
    const allDraft = scanResult.draftCandidates.filter(c => !c._isMarker && c.nodeCount > 0);
    const scored = allDraft.map(c => {
      const { score, tier, reasons } = scoreCandidateAgainstProject(c, identity);
      return { ...c, _targetScore: score, _targetTier: tier, _targetReasons: reasons };
    });
    setBackupCandidates(scored);
    setSelectedCandidateId(null);
  }, [identity, parsed]);

  const effectiveProject = manualProjectId
    ? (allProjects?.find(p => p.id === manualProjectId) || resolvedProject)
    : resolvedProject;

  const refreshSupabaseStatus = useCallback(() => {
    if (!effectiveProject?.id) return;
    fetchSupabaseScriptStatus(effectiveProject.id)
      .then(s => setSupabaseStatus(s))
      .catch(() => {});
  }, [effectiveProject?.id]); // eslint-disable-line

  const btnBase   = { padding: "1px 5px", border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer", fontSize: "9px", backgroundColor: "#f5f5f5", color: "#333" };
  const btnActive = { ...btnBase, backgroundColor: "#1a1a2e", color: "white", borderColor: "#1a1a2e" };
  const statusColor = (ok, empty) => ok && !empty ? "#2e7d32" : ok && empty ? "#888" : "#c62828";

  const filteredCandidates = (backupCandidates || []).filter(c => {
    if (orphanFilter === "matched") return c._targetTier !== "orphan" && c._targetTier !== "none";
    if (orphanFilter === "orphan")  return c._targetTier === "orphan"  || c._targetTier === "none";
    return true;
  });
  const sortedCandidates = sortTargetedCandidates(filteredCandidates, targetSort);
  const familyIds   = backupCandidates ? buildFamilyGroups(backupCandidates) : new Set();
  const matchedCount = (backupCandidates || []).filter(c => c._targetTier !== "orphan" && c._targetTier !== "none").length;
  const orphanCount  = (backupCandidates || []).filter(c => c._targetTier === "orphan"  || c._targetTier === "none").length;
  const selectedCandidate = selectedCandidateId ? (backupCandidates || []).find(c => c.candidateId === selectedCandidateId) : null;

  return (
    <div style={{ marginTop: "16px", borderTop: "2px solid #90caf9", paddingTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1565c0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Targeted Project Recovery
        </span>
        <span style={{ fontSize: "10px", color: "#888" }}>read-only scan · no auto-import · explicit attach only</span>
      </div>

      {/* Project name search */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
        <input
          ref={searchRef}
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") resolveProject(); }}
          placeholder="Project name (e.g. I Am Awake)"
          style={{ flex: 1, padding: "5px 8px", border: "1px solid #90caf9", borderRadius: "4px", fontSize: "11px", fontFamily: "inherit" }}
        />
        <button
          onClick={resolveProject}
          disabled={!allProjects || allProjects.length === 0}
          style={{ padding: "5px 12px", fontSize: "11px", cursor: "pointer", border: "1px solid #1565c0", borderRadius: "4px", backgroundColor: "#e3f2fd", color: "#1565c0", fontWeight: "bold" }}
        >
          Find Project
        </button>
      </div>

      {/* No match — suggestions */}
      {!resolvedProject && suggestedProjects.length > 0 && (
        <div style={{ marginBottom: "8px", padding: "8px 10px", border: "1px solid #ffcc80", borderRadius: "6px", backgroundColor: "#fff8e1", fontSize: "11px" }}>
          <div style={{ color: "#e65100", marginBottom: "5px" }}>No exact match for "{searchInput}". Select manually:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "5px" }}>
            {suggestedProjects.map(p => (
              <button key={p.id} onClick={() => { setResolvedProject(p); setResolveMatch({ project: p, matchType: "manual", score: 0 }); setSuggestedProjects([]); }}
                style={{ fontSize: "10px", padding: "3px 8px", cursor: "pointer", border: "1px solid #90caf9", borderRadius: "3px", backgroundColor: "#e3f2fd", color: "#1565c0" }}>
                {p.name}
              </button>
            ))}
          </div>
          <select onChange={e => { const p = allProjects.find(x => x.id === e.target.value); if (p) { setResolvedProject(p); setResolveMatch({ project: p, matchType: "manual", score: 0 }); setSuggestedProjects([]); } }} defaultValue="" style={{ fontSize: "10px", padding: "2px 4px" }}>
            <option value="" disabled>All projects…</option>
            {(allProjects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Resolved project status panel */}
      {resolvedProject && (
        <div style={{ border: "1px solid #90caf9", borderRadius: "6px", backgroundColor: "#f5f9ff", marginBottom: "10px", overflow: "hidden" }}>
          <div
            onClick={() => setShowProjectStatus(v => !v)}
            style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", borderBottom: showProjectStatus ? "1px solid #dce8f8" : "none" }}
          >
            <strong style={{ fontSize: "12px", color: "#0d47a1" }}>{effectiveProject?.name || resolvedProject.name}</strong>
            {resolveMatch && (
              <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "3px", backgroundColor: resolveMatch.matchType === "manual" ? "#fff3e0" : "#e8f5e9", color: resolveMatch.matchType === "manual" ? "#e65100" : "#2e7d32", border: "1px solid", borderColor: resolveMatch.matchType === "manual" ? "#ffcc80" : "#a5d6a7" }}>
                {resolveMatch.matchType === "manual" ? "⚠ MANUAL" : `✓ ${resolveMatch.matchType.replace(/_/g, " ")}`}
              </span>
            )}
            {liveLoading && <span style={{ fontSize: "10px", color: "#1565c0" }}>Scanning…</span>}
            {supabaseStatus?.ok && (
              <span style={{ fontSize: "10px", marginLeft: "auto", color: supabaseStatus.nodeCount > 0 ? "#2e7d32" : "#e65100", whiteSpace: "nowrap" }}>
                Supabase: {supabaseStatus.nodeCount > 0 ? `${supabaseStatus.nodeCount} nodes` : "empty"}
              </span>
            )}
            <span style={{ fontSize: "10px", color: "#aaa", marginLeft: supabaseStatus?.ok ? "8px" : "auto" }}>{showProjectStatus ? "▲" : "▼"}</span>
          </div>
          {showProjectStatus && (
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", color: "#888" }}>Destination:</span>
                <select value={manualProjectId || resolvedProject.id} onChange={e => { const pid = e.target.value; setManualProjectId(pid === resolvedProject.id ? null : pid); }} style={{ fontSize: "10px", padding: "2px 4px", flex: 1 }}>
                  {(allProjects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <StatusRow label="Supabase project.id" value={effectiveProject?.id || resolvedProject.id} />
              <StatusRow label="created_at" value={fmtDate(resolvedProject.created_at)} />
              <StatusRow label="updated_at" value={fmtDate(resolvedProject.updated_at)} />
              {supabaseStatus && (
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #dce8f8" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#555", marginBottom: "3px" }}>SUPABASE WRITING SCRIPT</div>
                  <StatusRow label="Node count" value={supabaseStatus.ok ? `${supabaseStatus.nodeCount} nodes` : `error: ${supabaseStatus.error}`} valueColor={supabaseStatus.ok ? statusColor(true, supabaseStatus.isEmpty) : "#c62828"} />
                  {supabaseStatus.ok && <>
                    <StatusRow label="savedAt" value={fmtDate(supabaseStatus.savedAt)} />
                    <StatusRow label="hasUserCreatedScript" value={String(supabaseStatus.hasUserCreatedScript)} valueColor={supabaseStatus.hasUserCreatedScript ? "#2e7d32" : "#888"} />
                    {supabaseStatus.isMarker && <StatusRow label="Payload shape" value="marker_indexedDB — full payload in IDB only" valueColor="#e65100" />}
                    {supabaseStatus.elementTypeSummary && <StatusRow label="Element types" value={supabaseStatus.elementTypeSummary} />}
                  </>}
                </div>
              )}
              {idbScanResult && !liveLoading && (
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #dce8f8" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold", color: "#555", marginBottom: "3px" }}>INDEXEDDB + LOCALSTORAGE</div>
                  <StatusRow label="IDB WritingDrafts" value={idbScanResult.backupStatus.idbHasPayload ? `${idbScanResult.backupStatus.idbNodeCount} nodes` : "empty / missing"} valueColor={idbScanResult.backupStatus.idbHasPayload ? "#2e7d32" : "#888"} />
                  <StatusRow label="ProjectCache snapshot" value={idbScanResult.backupStatus.projectCacheHasSnapshot ? "present" : "absent"} valueColor={idbScanResult.backupStatus.projectCacheHasSnapshot ? "#2e7d32" : "#888"} />
                  <StatusRow label="LS marker" value={idbScanResult.backupStatus.lsMarkerPresent ? "present" : "absent"} valueColor={idbScanResult.backupStatus.lsMarkerPresent ? "#2e7d32" : "#888"} />
                  {lsScan && lsScan.markerKeys.length > 0 && <StatusRow label="LS marker keys" value={lsScan.markerKeys.join(", ")} valueColor="#1565c0" />}
                </div>
              )}
              <div style={{ marginTop: "6px", padding: "4px 6px", borderRadius: "4px", fontSize: "10px", backgroundColor: supabaseStatus?.nodeCount > 0 ? "#e8f5e9" : "#fff3e0", color: supabaseStatus?.nodeCount > 0 ? "#2e7d32" : "#e65100" }}>
                {supabaseStatus?.nodeCount > 0
                  ? `✓ Script HAS been syncing to Supabase (${supabaseStatus.nodeCount} nodes, saved ${fmtDate(supabaseStatus.savedAt)})`
                  : supabaseStatus?.ok && supabaseStatus.isMarker
                    ? "⚠ Supabase stores a marker — full payload is in IDB only."
                    : supabaseStatus?.ok
                      ? "⚠ Supabase script is empty — script may NOT have synced, or was cleared."
                      : "Status unknown — check sign-in state."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backup candidates */}
      {resolvedProject && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1565c0", marginBottom: "6px" }}>
            Backup Candidates for "{effectiveProject?.name || resolvedProject.name}"
          </div>
          {!parsed && <div style={{ fontSize: "11px", color: "#888" }}>Load a backup file above to scan candidates.</div>}
          {parsed && !backupCandidates && <div style={{ fontSize: "11px", color: "#aaa" }}>Scoring candidates…</div>}
          {backupCandidates && backupCandidates.length === 0 && <div style={{ fontSize: "11px", color: "#888" }}>No recoverable Writing Script draft payloads found in this backup.</div>}

          {backupCandidates && backupCandidates.length > 0 && (
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>

              {/* Left: filter/sort + list */}
              <div style={{ flex: "0 0 auto", width: "min(380px, 52%)" }}>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center", marginBottom: "3px" }}>
                  <span style={{ fontSize: "9px", color: "#888", fontWeight: "bold" }}>FILTER:</span>
                  {[
                    { v: "all",     label: `All (${backupCandidates.length})` },
                    { v: "matched", label: `Matched (${matchedCount})` },
                    { v: "orphan",  label: `Orphan (${orphanCount})` },
                  ].map(o => (
                    <button key={o.v} onClick={() => { setOrphanFilter(o.v); setSelectedCandidateId(null); }} style={orphanFilter === o.v ? btnActive : btnBase}>{o.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "9px", color: "#888", fontWeight: "bold" }}>SORT:</span>
                  {TARGET_SORT_OPTIONS.map(o => (
                    <button key={o.v} onClick={() => setTargetSort(o.v)} style={targetSort === o.v ? btnActive : btnBase}>{o.label}</button>
                  ))}
                </div>
                {orphanFilter === "orphan" && (
                  <div style={{ marginBottom: "5px", padding: "4px 6px", backgroundColor: "#fff3e0", border: "1px solid #ffcc80", borderRadius: "4px", fontSize: "10px", color: "#e65100" }}>
                    ⚠ Orphan = no UUID link. Use scene headings to identify before attaching.
                  </div>
                )}
                <div style={{ maxHeight: "340px", overflowY: "auto", paddingRight: "2px" }}>
                  {sortedCandidates.length === 0 && <div style={{ fontSize: "11px", color: "#888", padding: "8px 0" }}>No candidates match this filter.</div>}
                  {sortedCandidates.map(c => (
                    <TargetedCandidateRow
                      key={c.candidateId}
                      candidate={c}
                      isSelected={selectedCandidateId === c.candidateId}
                      onSelect={() => setSelectedCandidateId(prev => prev === c.candidateId ? null : c.candidateId)}
                      isFamilyMember={familyIds.has(c.candidateId)}
                    />
                  ))}
                </div>
                {!selectedCandidateId && sortedCandidates.length > 0 && (
                  <div style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>← Click a candidate to select it</div>
                )}
              </div>

              {/* Right: selected candidate detail */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {selectedCandidate ? (
                  <SelectedCandidateDetail
                    candidate={selectedCandidate}
                    targetProject={effectiveProject}
                    supabaseStatus={supabaseStatus}
                    onAttachSuccess={refreshSupabaseStatus}
                  />
                ) : (
                  <div style={{ padding: "24px 12px", border: "1px dashed #c5cae9", borderRadius: "6px", fontSize: "11px", color: "#9fa8da", textAlign: "center" }}>
                    Select a candidate from the list to see details and attach options.
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Backup Script Recovery section ───────────────────────────────────────────

function BackupScriptRecoverySection({ parsed, currentProject }) {
  const [scanResult, setScanResult] = useState(null);
  const [allProjects, setAllProjects] = useState(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [matchedCandidates, setMatchedCandidates] = useState(null);
  const [sortBy, setSortBy] = useState("savedAt_desc");
  const [filterMode, setFilterMode] = useState("matched");
  const [showRelated, setShowRelated] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Fetch projects on mount — needed for TargetedProjectRecovery even before backup loads
  useEffect(() => {
    setProjectsLoading(true);
    fetchAllProjectsForRecovery().then(projects => {
      setAllProjects(projects);
      setProjectsLoading(false);
    }).catch(() => {
      setAllProjects([]);
      setProjectsLoading(false);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!parsed) { setScanResult(null); setMatchedCandidates(null); return; }
    const result = scanBackupForScriptCandidates(parsed);
    setScanResult(result);
    if (result.valid && allProjects !== null) {
      const projectList = allProjects.length > 0 ? allProjects : (currentProject ? [currentProject] : []);
      const withMatch = matchCandidatesToProjects(result.recoverableDraftCandidates, projectList);
      setMatchedCandidates(withMatch);
      setShowAll(false);
    }
  }, [parsed, allProjects, currentProject?.id]); // eslint-disable-line

  // Targeted Project Recovery panel — always visible (no backup required)
  const targetedPanel = (
    <TargetedProjectRecovery allProjects={allProjects || []} parsed={parsed} />
  );

  if (!parsed) {
    return (
      <div style={{ marginTop: "16px", borderTop: "2px solid #90caf9", paddingTop: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          {projectsLoading && <span style={{ fontSize: "10px", color: "#1565c0" }}>Fetching Supabase projects…</span>}
          {!projectsLoading && allProjects !== null && (
            <span style={{ fontSize: "10px", color: "#2e7d32" }}>{allProjects.length} Supabase projects</span>
          )}
        </div>
        {targetedPanel}
      </div>
    );
  }

  if (!scanResult?.valid) {
    return (
      <div>
        <div style={{ marginTop: "14px", padding: "8px 10px", backgroundColor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "6px", fontSize: "11px", color: "#c62828" }}>
          Backup script scanner: {scanResult?.error || "invalid backup"}
        </div>
        {targetedPanel}
      </div>
    );
  }

  const {
    recoverableDraftCandidates, markerOnlyCount, emptyDraftCount,
    totalLsEntries, totalDraftEntries, totalRelatedEntries, largestNodeCount, backupMeta,
  } = scanResult;

  const displayCandidates = matchedCandidates || recoverableDraftCandidates.map(c => ({
    ...c, matchedProject: null, matchType: "no_projects", matchConfidence: "none",
  }));

  const matchedCount = displayCandidates.filter(c => c.matchedProject).length;
  const unmatchedCount = displayCandidates.filter(c => !c.matchedProject).length;

  let filtered = displayCandidates;
  if (filterMode === "matched")   filtered = displayCandidates.filter(c => c.matchedProject);
  if (filterMode === "unmatched") filtered = displayCandidates.filter(c => !c.matchedProject);

  const sorted = sortCandidates(filtered, sortBy);
  const shown = showAll ? sorted : sorted.slice(0, 12);

  const btnBase = { padding: "2px 7px", border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer", fontSize: "10px", backgroundColor: "#f5f5f5", color: "#333" };
  const btnActive = { ...btnBase, backgroundColor: "#1a1a2e", color: "white", borderColor: "#1a1a2e" };

  return (
    <div style={{ marginTop: "16px", borderTop: "2px solid #ce93d8", paddingTop: "12px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#6a1b9a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Backup Script Recovery
        </span>
        <span style={{ fontSize: "10px", color: "#888" }}>read-only · no auto-import · selective attach only</span>
        {projectsLoading && <span style={{ fontSize: "10px", color: "#1565c0" }}>Fetching Supabase projects…</span>}
        {!projectsLoading && allProjects !== null && (
          <span style={{ fontSize: "10px", color: "#2e7d32" }}>{allProjects.length} Supabase projects loaded</span>
        )}
      </div>

      <div style={{ padding: "8px 10px", backgroundColor: "#f3e5f5", border: "1px solid #ce93d8", borderRadius: "6px", fontSize: "11px", marginBottom: "8px" }}>
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <span><strong>Backup:</strong> {fmtDate(backupMeta?.generatedAt)}</span>
          {backupMeta?.currentProjectName && <span><strong>Active project:</strong> {backupMeta.currentProjectName}</span>}
          <span><strong>LS entries:</strong> {totalLsEntries}</span>
          <span><strong>Draft entries:</strong> {totalDraftEntries}</span>
          <span style={{ color: "#2e7d32" }}><strong>Recoverable drafts:</strong> {recoverableDraftCandidates.length}</span>
          <span><strong>Markers:</strong> {markerOnlyCount}</span>
          <span><strong>Empty:</strong> {emptyDraftCount}</span>
          <span><strong>Largest:</strong> {largestNodeCount} nodes</span>
          <span style={{ color: "#888" }}>Related (view-only): {totalRelatedEntries}</span>
        </div>
        <div style={{ marginTop: "5px", display: "flex", gap: "12px", fontSize: "10px" }}>
          <span style={{ color: matchedCount > 0 ? "#2e7d32" : "#aaa" }}>✓ Matched: {matchedCount}</span>
          <span style={{ color: unmatchedCount > 0 ? "#888" : "#aaa" }}>○ Unmatched: {unmatchedCount}</span>
          {allProjects?.length === 0 && !projectsLoading && (
            <span style={{ color: "#e65100" }}>⚠ Could not load Supabase project list — check sign-in state</span>
          )}
        </div>
      </div>

      {/* Targeted Project Recovery panel */}
      {targetedPanel}

      {recoverableDraftCandidates.length === 0 && (
        <div style={{ fontSize: "11px", color: "#888", marginBottom: "8px", marginTop: "8px" }}>No recoverable Writing Script draft payloads found in this backup for the general table below.</div>
      )}

      {recoverableDraftCandidates.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>Filter:</span>
            {[
              { v: "matched",   label: `Matched (${matchedCount})` },
              { v: "unmatched", label: `Unmatched (${unmatchedCount})` },
              { v: "all",       label: `All (${displayCandidates.length})` },
            ].map(o => (
              <button key={o.v} onClick={() => { setFilterMode(o.v); setShowAll(false); }} style={filterMode === o.v ? btnActive : btnBase}>{o.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>Sort:</span>
            {SORT_OPTIONS.map(o => (
              <button key={o.v} onClick={() => setSortBy(o.v)} style={sortBy === o.v ? btnActive : btnBase}>{o.label}</button>
            ))}
          </div>

          <div style={{ maxHeight: "480px", overflowY: "auto", paddingRight: "2px" }}>
            {shown.length === 0 && (
              <div style={{ fontSize: "11px", color: "#888", padding: "10px 0" }}>No candidates match the current filter.</div>
            )}
            {shown.map(candidate => (
              <BackupCandidateCard key={candidate.candidateId} candidate={candidate} />
            ))}
          </div>

          {sorted.length > 12 && (
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ ...btnBase, marginTop: "6px", padding: "3px 10px" }}
            >
              {showAll ? "Show fewer" : `Show all ${sorted.length}`}
            </button>
          )}
        </>
      )}

      {totalRelatedEntries > 0 && (
        <div style={{ marginTop: "10px", borderTop: "1px solid #e0e0e0", paddingTop: "8px" }}>
          <button
            onClick={() => setShowRelated(v => !v)}
            style={{ ...btnBase, fontSize: "11px", padding: "3px 10px" }}
          >
            {showRelated ? "Hide" : "Show"} Related Legacy Script Data — View Only ({totalRelatedEntries} entries)
          </button>
          {showRelated && (
            <div style={{ marginTop: "6px", maxHeight: "200px", overflowY: "auto", border: "1px solid #eee", borderRadius: "4px", backgroundColor: "#fafafa" }}>
              <div style={{ padding: "5px 8px", fontSize: "10px", color: "#888", borderBottom: "1px solid #eee" }}>
                These keys (scriptBeats, scriptTimelinePositions, scriptMoodOverlay*, writingScriptCollapsedActs, etc.) are related script data but are NOT Writing Script draft payloads. They are never attachable.
              </div>
              {(scanResult.relatedEntries || []).slice(0, 100).map(e => (
                <div key={e.key} style={{ display: "flex", gap: "8px", padding: "2px 8px", borderBottom: "1px solid #f0f0f0", fontSize: "10px", fontFamily: "monospace", alignItems: "center" }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#555" }}>{e.key}</span>
                  <span style={{ color: "#aaa", whiteSpace: "nowrap" }}>{e.projectId?.slice(0, 8) || "—"}</span>
                  <span style={{ color: "#bbb", whiteSpace: "nowrap" }}>{fmtBytes(e.sizeBytes)}</span>
                  <ConfBadge label="view-only" bg="#f5f5f5" color="#888" border="#ddd" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main exported modal ───────────────────────────────────────────────────────

/**
 * Props:
 *   open          — whether modal is visible
 *   onClose       — called when user closes (no project is opened)
 *   currentProject — optional; the currently open project if any (used only as
 *                    fallback when Supabase project list fails to load)
 *   context       — "projectSelector" | "devBacklog" (cosmetic title only)
 */
function StorageRecoveryImportModal({ open, onClose, currentProject, context }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsed(null);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target.result);
        const { valid, error } = validateBackupFile(p);
        if (!valid) { setParseError(error); return; }
        setParsed(p);
      } catch (err) {
        setParseError(`JSON parse error: ${err.message}`);
      }
    };
    reader.onerror = () => setParseError("File read error.");
    reader.readAsText(f);
  }, []);

  if (!open) return null;

  const isProjectSelector = context === "projectSelector";

  const lsEntries = parsed?.localStorage?.entries || [];
  const ssEntries = parsed?.sessionStorage?.entries || [];
  const idbDbs = parsed?.indexedDB?.databases || [];
  const authHidden = lsEntries.filter(e => e.flags?.auth);
  const draftsStore = idbDbs.flatMap(d => d.stores || []).find(s => s.store === "drafts");
  const projectCacheDb = idbDbs.find(d => d.name === "FilmProductionBinderProjectCache");
  const currentCacheStore = projectCacheDb?.stores?.find(s => s.store === "currentProjectCache");
  const versionsStore = projectCacheDb?.stores?.find(s => s.store === "projectCacheVersions");
  const conflictsStore = projectCacheDb?.stores?.find(s => s.store === "projectCacheConflicts");

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100001, backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(860px, calc(100vw - 48px))", maxHeight: "90vh", backgroundColor: "white",
        border: "1px solid #ccc", borderRadius: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        display: "flex", flexDirection: "column", fontFamily: "'Questrial','Futura','Arial',sans-serif",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid #e0e0e0", backgroundColor: "#1a1a2e",
          color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>Storage Recovery / Script Backup Import</span>
            {isProjectSelector && (
              <span style={{ fontSize: "10px", color: "#aaa", marginLeft: "10px" }}>Project Selector mode — no project will be opened</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>

          {/* Context banner for Project Selector mode */}
          {isProjectSelector && (
            <div style={{ marginBottom: "10px", padding: "8px 10px", backgroundColor: "#e3f2fd", border: "1px solid #90caf9", borderRadius: "6px", fontSize: "11px", color: "#0d47a1", lineHeight: 1.5 }}>
              <strong>Use this before opening a project if scripts may need recovery.</strong>{" "}
              This tool scans a storage backup and can attach recovered Writing Script payloads to Supabase without opening the project.
              No project will be opened or selected.
            </div>
          )}

          {/* Safety notice */}
          <div style={{ marginBottom: "10px", padding: "8px 10px", backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "6px", fontSize: "11px", color: "#555" }}>
            <strong>Read-only preview.</strong> Selective attach only — auth keys are never restored, nothing is deleted, full backup is never blindly imported.
          </div>

          {/* File picker */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>Select backup JSON file:</label>
            <input type="file" accept=".json,application/json" onChange={handleFile} style={{ fontSize: "11px" }} />
          </div>

          {parseError && (
            <div style={{ padding: "8px 10px", backgroundColor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "6px", fontSize: "11px", color: "#c62828", marginBottom: "10px" }}>
              {parseError}
            </div>
          )}

          {parsed && !parseError && (
            <div style={{ marginBottom: "8px", padding: "8px 10px", backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: "6px", fontSize: "11px" }}>
              <div><strong>File:</strong> {file?.name} &nbsp; <strong>Generated:</strong> {parsed.meta.generatedAt}</div>
              {parsed.meta.currentProjectId && <div><strong>Project at backup time:</strong> {parsed.meta.currentProjectName || parsed.meta.currentProjectId}</div>}
              <div>
                <strong>localStorage:</strong> {fmtBytes(parsed.localStorage?.totalBytes || 0)} — {parsed.localStorage?.keyCount || 0} keys &nbsp;
                <strong>sessionStorage:</strong> {ssEntries.length} keys &nbsp;
                <strong>IDB drafts:</strong> {draftsStore ? `${draftsStore.recordCount} records` : "not found"} &nbsp;
                {projectCacheDb && <span><strong>ProjectCache:</strong> {currentCacheStore?.recordCount ?? 0} current, {versionsStore?.recordCount ?? 0} ver, {conflictsStore?.recordCount ?? 0} conflicts</span>}
              </div>
              <div style={{ marginTop: "4px", fontSize: "10px", color: "#888" }}>
                Auth keys ({authHidden.length}): never restored. Blind restore: disabled.
              </div>
            </div>
          )}

          {/* BackupScriptRecoverySection always renders — handles no-backup state internally */}
          <BackupScriptRecoverySection parsed={parsed} currentProject={currentProject} />
        </div>
      </div>
    </div>
  );
}

export default StorageRecoveryImportModal;
