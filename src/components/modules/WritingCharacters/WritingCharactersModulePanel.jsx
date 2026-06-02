// Standalone Writing Characters module panel.
// Used ONLY by WritingCharacters.jsx (the standalone module).
// NOT imported by WritingScript.jsx — that uses WritingCharactersPanel.jsx.
//
// Contains: card grid, rows view, view toggle, casting candidates, expanded
// profile sections, View Details modal, scene viewer integration.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deriveCharacterKey } from "./writingCharacterExtraction";
import { getWritingCharacterProfilesArray } from "./writingCharactersModel";
import WritingCharacterSuggestionsModal from "./WritingCharacterSuggestionsModal";

// ─── Layout constants (approved values) ───────────────────────────────────────

const ROW_MAX_WIDTH       = 1000;
const LEFT_CARD_WIDTH     = 204;
const LEFT_CARD_IMG_H     = 120;
const LEFT_CARD_PADDING   = 12;
const DETAIL_PADDING      = 16;
const CARD_BORDER_RADIUS  = 9;
const ROW_GAP             = 12;
const SECTION_GAP         = 10;
const CAST_CARD_IMG_H     = 160;
const CAST_GRID_GAP       = 15;
const CTRL_ROW_SPACING    = 16;
const MERGE_DELETE_GAP    = 9;
const CASTING_TOP_MARGIN  = 3;
const NOTES_TOP_MARGIN    = 7;

// ─── Font constants (approved values) ─────────────────────────────────────────

const F_CHAR_NAME     = 15;
const F_ROLE          = 12;
const F_SCENE_COUNT   = 11;
const F_SECTION_LABEL = 13;
const F_BODY          = 12;
const F_CAST_ACTOR    = 15;
const F_IMDB          = 11;
const F_KNOWN_FOR     = 11;
const F_NOTES         = 12;
const F_SECTION_HDR   = 13;
const F_BTN           = 9;

// ─── Display labels (approved values) ─────────────────────────────────────────

const LBL = {
  casting:       "Casting",
  knownFor:      "Known for",
  notes:         "Notes",
  motivation:    "Motivation",
  psychology:    "Psychology",
  biography:     "Biography",
  relationships: "Relationships",
  arc:           "Arc",
  secrets:       "Secrets",
  references:    "References",
  moodboard:     "Moodboard",
  scenes:        "Scenes",
  aliases:       "Aliases",
  role:          "Role",
  merge:         "Merge",
};

// ─── Data ──────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ["", "Protagonist", "Antagonist", "Supporting", "Narrator"];

// Wardrobe and Voice intentionally excluded from expanded sections.
const EXPANDED_PLACEHOLDER_SECTIONS = [
  { key: "motivation",    label: LBL.motivation    },
  { key: "psychology",    label: LBL.psychology    },
  { key: "biography",     label: LBL.biography     },
  { key: "relationships", label: LBL.relationships },
  { key: "arc",           label: LBL.arc           },
  { key: "secrets",       label: LBL.secrets       },
  { key: "references",    label: LBL.references    },
  { key: "moodboard",     label: LBL.moodboard     },
];

// ─── WritingCharactersModulePanel ──────────────────────────────────────────────

export default function WritingCharactersModulePanel({
  profiles,
  extractedNames,
  isViewOnly,
  isProfilesLoading,
  onCreateProfiles,
  onIgnoreSuggestions,
  onUpdateProfile,
  onRescan,
  importTrigger,
  onImportSignalConsumed,
  nodeIndexPageMap,
  allNodes,
  scenes,
  sceneIdToIndex,
  onNavigateToScene,
  onMergeProfiles,
  onDeleteProfile,
  onSuppressSceneTag,
  sceneSuppresssions,
  onSetCharacterTagHighlights,   // kept for API compat
  onClearCharacterTagHighlights,
  hasScript,
}) {
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [pendingSuggestions, setPendingSuggestions]     = useState([]);
  const [viewMode, setViewMode]                         = useState("grid");
  const [detailsProfileId, setDetailsProfileId]         = useState(null);
  useEffect(() => {
    return () => { onClearCharacterTagHighlights?.(); };
  }, [onClearCharacterTagHighlights]);

  // ── Suggestion resolution ─────────────────────────────────────────────────
  // Suppression filters are always active — ignored, merged, resolved names
  // never resurface regardless of trigger source (Rescan or import signal).
  const computeUnresolved = useCallback(() => {
    const existingKeys = new Set();
    const p = profiles?.profiles || {};
    Object.keys(p).forEach((k) => existingKeys.add(k));
    Object.values(p).forEach((prof) => {
      (prof.aliases || []).forEach((a) => existingKeys.add(deriveCharacterKey(String(a).toUpperCase())));
      // Merged source names must stay excluded so they never resurface as suggestions.
      (prof.mergeHistory || []).forEach((h) => {
        if (h.sourceId) existingKeys.add(h.sourceId);
        if (h.sourceCanonicalName) existingKeys.add(deriveCharacterKey(String(h.sourceCanonicalName).toUpperCase()));
      });
    });
    Object.entries(profiles?.resolution || {}).forEach(([srcKey, canonKey]) => {
      existingKeys.add(srcKey); existingKeys.add(canonKey);
    });
    (profiles?.ignoredSuggestions || []).forEach((k) => existingKeys.add(k));
    const unresolved = [];
    extractedNames.forEach((ec) => { if (!existingKeys.has(ec.normalizedKey)) unresolved.push(ec); });
    return unresolved;
  }, [profiles, extractedNames]);

  // ── Rescan: only fires on explicit user click ─────────────────────────────
  // userRequestedScanRef is set true by the Rescan button; the effect consumes
  // and clears it so project load / visibility changes never auto-open the modal.
  const [rescanTrigger, setRescanTrigger] = useState(0);
  const userRequestedScanRef = useRef(false);

  useEffect(() => {
    if (!userRequestedScanRef.current) return;
    userRequestedScanRef.current = false;
    if (isProfilesLoading) return;
    const unresolved = computeUnresolved();
    if (unresolved.length > 0) {
      setPendingSuggestions(unresolved);
      setShowSuggestionsModal(true);
    }
  }, [rescanTrigger, isProfilesLoading, computeUnresolved]);

  // ── Import-complete signal ────────────────────────────────────────────────
  // Fires once after WritingCharacters.jsx detects a new importedAt timestamp
  // (read from the localStorage marker). Parks if profiles still loading.
  const lastConsumedImportTriggerRef = useRef(0);
  const pendingImportTriggerRef = useRef(0);

  useEffect(() => {
    if (importTrigger == null || importTrigger === 0) return;
    if (importTrigger > lastConsumedImportTriggerRef.current) {
      pendingImportTriggerRef.current = importTrigger;
    }
    if (isProfilesLoading || pendingImportTriggerRef.current === 0) return;
    if (pendingImportTriggerRef.current <= lastConsumedImportTriggerRef.current) return;

    lastConsumedImportTriggerRef.current = pendingImportTriggerRef.current;
    pendingImportTriggerRef.current = 0;

    const unresolved = computeUnresolved();
    if (unresolved.length > 0) {
      setPendingSuggestions(unresolved);
      setShowSuggestionsModal(true);
    }
    // Always mark as consumed whether or not the modal opened.
    onImportSignalConsumed?.();
  }, [importTrigger, isProfilesLoading, computeUnresolved, onImportSignalConsumed]);

  // ── Profile list — chronological ──────────────────────────────────────────
  const profileList = getWritingCharacterProfilesArray(profiles);

  const hasProfiles    = profileList.length > 0;
  const detailsProfile = detailsProfileId ? (profiles?.profiles?.[detailsProfileId] ?? null) : null;

  const buildDetailProps = (prof) => {
    const suppressed = new Set(
      Array.isArray(sceneSuppresssions?.[prof.id]) ? sceneSuppresssions[prof.id] : []
    );
    return {
      profile: prof,
      extractedEntry: extractedNames.get(prof.id) || null,
      allProfiles: profileList,
      scenes,
      sceneIdToIndex,
      suppressed,
      isViewOnly,
      onUpdateProfile: (patch) => onUpdateProfile(prof.id, patch),
      onDeleteProfile: () => { onDeleteProfile?.(prof.id); setDetailsProfileId(null); },
      onMergeProfiles,
      onSuppressSceneTag: (sceneId) => onSuppressSceneTag?.(prof.id, sceneId),
      onNavigateToScene: onNavigateToScene
        ? (sceneIndex) => onNavigateToScene(sceneIndex, prof.id)
        : null,
    };
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

      {/* ── Toolbar ── */}
      <div style={{
        flexShrink: 0, padding: "10px 20px", borderBottom: "1px solid #e8e8e8",
        backgroundColor: "white", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
      }}>
        {hasProfiles && (
          <div style={{ display: "flex", gap: 0, border: "1px solid #ddd", borderRadius: "5px", overflow: "hidden", flexShrink: 0 }}>
            <button type="button" onClick={() => setViewMode("grid")} style={{
              fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "none",
              backgroundColor: viewMode === "grid" ? "#1a1a2e" : "#f5f5f5",
              color: viewMode === "grid" ? "white" : "#555",
            }}>Grid</button>
            <button type="button" onClick={() => setViewMode("rows")} style={{
              fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "none", borderLeft: "1px solid #ddd",
              backgroundColor: viewMode === "rows" ? "#1a1a2e" : "#f5f5f5",
              color: viewMode === "rows" ? "white" : "#555",
            }}>Rows</button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {hasScript && !isViewOnly && (
          <button
            type="button"
            onClick={() => { onRescan?.(); userRequestedScanRef.current = true; setRescanTrigger((n) => n + 1); }}
            style={{ fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", backgroundColor: "#f5f5f5", color: "#555", flexShrink: 0 }}
          >
            Rescan Script
          </button>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", boxSizing: "border-box" }}>
        {!hasScript && (
          <div style={{ textAlign: "center", color: "#aaa", fontSize: "14px", marginTop: "60px", lineHeight: 1.7 }}>
            <div style={{ fontSize: "17px", marginBottom: "8px", color: "#bbb" }}>No script yet</div>
            Start or import a Writing script to begin detecting characters.
          </div>
        )}

        {hasScript && !isProfilesLoading && !hasProfiles && extractedNames.size === 0 && (
          <div style={{ textAlign: "center", color: "#aaa", fontSize: "14px", marginTop: "60px", lineHeight: 1.7 }}>
            No characters detected yet.<br />
            Add <strong>Character</strong> lines to your script.
          </div>
        )}

        {hasScript && !isProfilesLoading && !hasProfiles && extractedNames.size > 0 && (
          <div style={{ textAlign: "center", color: "#888", fontSize: "14px", marginTop: "60px", lineHeight: 1.7 }}>
            {extractedNames.size} character{extractedNames.size !== 1 ? "s" : ""} detected in the script.<br />
            Create profiles to get started.
          </div>
        )}

        {isProfilesLoading && (
          <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", marginTop: "60px" }}>Loading characters…</div>
        )}

        {hasScript && hasProfiles && (
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#888" }}>
            Total Characters: {profileList.length}
          </p>
        )}

        {/* Grid view */}
        {hasScript && hasProfiles && viewMode === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
            {profileList.map((prof) => {
              const ec = extractedNames.get(prof.id) || null;
              const suppressed = new Set(Array.isArray(sceneSuppresssions?.[prof.id]) ? sceneSuppresssions[prof.id] : []);
              const rawSceneIds = ec?.sceneIds ? Array.from(ec.sceneIds) : (prof.sceneIds || []);
              const visibleSceneCount = rawSceneIds.filter((sid) => !suppressed.has(sid)).length;
              const mergeCount = (prof.mergeHistory || []).length;
              const candidates = Array.isArray(prof.castingCandidates) ? prof.castingCandidates : [];
              const headshotUrl = candidates[0]?.headshotUrl || prof.avatarUrl || null;
              return (
                <CharacterGridCard
                  key={prof.id}
                  profile={prof}
                  headshotUrl={headshotUrl}
                  visibleSceneCount={visibleSceneCount}
                  mergeCount={mergeCount}
                  onViewDetails={() => setDetailsProfileId(prof.id)}
                />
              );
            })}
          </div>
        )}

        {/* Rows view */}
        {hasScript && hasProfiles && viewMode === "rows" && (
          <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP, maxWidth: ROW_MAX_WIDTH }}>
            {profileList.map((prof) => (
              <CharacterRow key={prof.id} {...buildDetailProps(prof)} />
            ))}
          </div>
        )}
      </div>

      {/* Suggestions modal */}
      {showSuggestionsModal && pendingSuggestions.length > 0 && (
        <WritingCharacterSuggestionsModal
          suggestions={pendingSuggestions}
          onConfirm={(keys) => { setShowSuggestionsModal(false); setPendingSuggestions([]); if (keys.length > 0) onCreateProfiles(keys); }}
          onDismiss={(keys) => { setShowSuggestionsModal(false); setPendingSuggestions([]); onIgnoreSuggestions(keys); }}
          nodeIndexPageMap={nodeIndexPageMap}
          allNodes={allNodes}
        />
      )}



      {/* Details modal — Grid view only */}
      {detailsProfileId && detailsProfile && viewMode === "grid" && (
        <CharacterDetailsModal
          {...buildDetailProps(detailsProfile)}
          onClose={() => setDetailsProfileId(null)}
        />
      )}
    </div>
  );
}

// ─── CharacterGridCard ─────────────────────────────────────────────────────────
// Grid card: avatar/headshot · name · role · scene count. No casting line.

function CharacterGridCard({ profile, headshotUrl, visibleSceneCount, mergeCount, onViewDetails }) {
  return (
    <div style={{
      border: "1px solid #ddd", borderRadius: "8px", backgroundColor: "white",
      display: "flex", flexDirection: "column",
      boxShadow: "0 2px 6px rgba(0,0,0,0.07)", overflow: "hidden",
      fontFamily: "'Questrial','Futura','Arial',sans-serif",
    }}>
      <div style={{ width: "100%", height: "150px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {headshotUrl
          ? <img src={headshotUrl} alt={profile.canonicalName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ fontSize: "48px", color: "#ccc", lineHeight: 1, userSelect: "none" }}>👤</div>
        }
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#1a1a2e", textAlign: "center" }}>{profile.canonicalName}</div>
        {profile.role
          ? <div style={{ fontSize: "12px", color: "#607D8B", textAlign: "center" }}>{profile.role}</div>
          : <div style={{ fontSize: "12px", color: "#ccc", textAlign: "center", fontStyle: "italic" }}>No role set</div>
        }
        <div style={{ fontSize: "12px", color: "#999", textAlign: "center" }}>
          {visibleSceneCount} scene{visibleSceneCount !== 1 ? "s" : ""}
          {mergeCount > 0 && (
            <span style={{ marginLeft: "6px", fontSize: "10px", color: "#9c6e2b", backgroundColor: "#fdf3dc", padding: "1px 5px", borderRadius: "3px" }}>
              {mergeCount} alias{mergeCount !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        <button type="button" onClick={onViewDetails}
          style={{ marginTop: "8px", fontSize: "12px", padding: "7px 0", cursor: "pointer", border: "none", borderRadius: "5px", backgroundColor: "#1a1a2e", color: "white", fontWeight: "bold", width: "100%" }}>
          View Details
        </button>
      </div>
    </div>
  );
}

// ─── CharacterRow ──────────────────────────────────────────────────────────────
// Row view: fixed-width left card + inline detail panel on the right.

function CharacterRow(props) {
  const { profile, extractedEntry, suppressed } = props;
  const [expanded, setExpanded] = useState(false);

  const ec = extractedEntry;
  const rawSceneIds = ec?.sceneIds ? Array.from(ec.sceneIds) : (profile.sceneIds || []);
  const visibleSceneCount = rawSceneIds.filter((sid) => !suppressed.has(sid)).length;
  const mergeCount = (profile.mergeHistory || []).length;
  const candidates = Array.isArray(profile.castingCandidates) ? profile.castingCandidates : [];
  const headshotUrl = candidates[0]?.headshotUrl || profile.avatarUrl || null;

  return (
    <div style={{
      display: "flex", border: "1px solid #e0e0e0", borderRadius: CARD_BORDER_RADIUS,
      backgroundColor: "white", overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      fontFamily: "'Questrial','Futura','Arial',sans-serif",
      alignItems: "stretch",
    }}>
      {/* Left card — fixed width, does not stretch */}
      <div style={{ width: LEFT_CARD_WIDTH, flexShrink: 0, borderRight: "1px solid #e8e8e8", display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
        <div style={{ height: LEFT_CARD_IMG_H, backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {headshotUrl
            ? <img src={headshotUrl} alt={profile.canonicalName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ fontSize: "34px", color: "#ccc", lineHeight: 1, userSelect: "none" }}>👤</div>
          }
        </div>
        <div style={{ padding: LEFT_CARD_PADDING, display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ fontSize: F_CHAR_NAME, fontWeight: "bold", color: "#1a1a2e", wordBreak: "break-word" }}>{profile.canonicalName}</div>
          {profile.role
            ? <div style={{ fontSize: F_ROLE, color: "#607D8B" }}>{profile.role}</div>
            : <div style={{ fontSize: F_ROLE, color: "#ccc", fontStyle: "italic" }}>No role</div>
          }
          <div style={{ fontSize: F_SCENE_COUNT, color: "#999" }}>
            {visibleSceneCount} scene{visibleSceneCount !== 1 ? "s" : ""}
            {mergeCount > 0 && (
              <span style={{ marginLeft: "5px", fontSize: F_SCENE_COUNT - 1, color: "#9c6e2b", backgroundColor: "#fdf3dc", padding: "1px 4px", borderRadius: "3px" }}>
                {mergeCount} alias{mergeCount !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right detail */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <RowDetailPanel
          {...props}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
        />
      </div>
    </div>
  );
}

// ─── RowDetailPanel ────────────────────────────────────────────────────────────
// Right-hand detail panel for the Rows view.

function RowDetailPanel({
  profile, extractedEntry, allProfiles, scenes, sceneIdToIndex,
  suppressed, isViewOnly,
  onUpdateProfile, onDeleteProfile, onMergeProfiles, onSuppressSceneTag,
  onNavigateToScene,
  expanded, onToggleExpand,
}) {
  const [notesValue, setNotesValue]       = useState(profile.notes || "");
  const [mergeOpen, setMergeOpen]         = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeConfirm, setMergeConfirm]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cleanupActive, setCleanupActive] = useState(false);

  useEffect(() => { setNotesValue(profile.notes || ""); }, [profile.notes]);

  const saveNotes = () => { if (notesValue !== (profile.notes || "")) onUpdateProfile({ notes: notesValue }); };

  const rawSceneIds = extractedEntry?.sceneIds
    ? Array.from(extractedEntry.sceneIds) : (profile.sceneIds || []);
  const seenIndices = new Set();
  const sceneCells = rawSceneIds
    .filter((sid) => !suppressed.has(sid))
    .map((sceneId) => {
      const idx = sceneIdToIndex?.[sceneId] ?? -1;
      if (idx < 0 || seenIndices.has(idx)) return null;
      seenIndices.add(idx);
      const scene = Array.isArray(scenes) ? scenes[idx] : null;
      if (!scene) return null;
      const appearance = extractedEntry?.sceneAppearances?.get(sceneId) || null;
      return { sceneId, sceneIndex: idx, sceneNumber: scene.sceneNumber ?? idx + 1, heading: scene.heading || scene.text || "", sources: appearance?.sources || [] };
    })
    .filter(Boolean)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  const mergeTargetOptions = allProfiles.filter((p) => p.id !== profile.id);
  const selectedTarget     = mergeTargetOptions.find((p) => p.id === mergeTargetId);
  const mergeHistory       = profile.mergeHistory || [];

  const handleMergeSubmit = () => {
    if (!mergeTargetId || !onMergeProfiles) return;
    onMergeProfiles(profile.id, mergeTargetId);
  };

  return (
    <div style={{ padding: DETAIL_PADDING, display: "flex", flexDirection: "column", gap: SECTION_GAP, flex: 1 }}>

      {/* Role · Merge · Delete — single row */}
      <div style={{ display: "flex", alignItems: "center", gap: CTRL_ROW_SPACING }}>
        <span style={{ fontSize: F_ROLE, color: "#999", flexShrink: 0 }}>{LBL.role}</span>
        {!isViewOnly ? (
          <select value={profile.role || ""} onChange={(e) => onUpdateProfile({ role: e.target.value })}
            style={{ fontSize: F_ROLE, padding: "3px 6px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "white", cursor: "pointer", color: profile.role ? "#1a1a2e" : "#aaa", width: "120px", flexShrink: 0 }}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r || "— role —"}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: F_ROLE, color: "#555" }}>{profile.role || "—"}</span>
        )}

        <div style={{ flex: 1 }} />

        {!isViewOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: MERGE_DELETE_GAP, flexShrink: 0 }}>
            {mergeTargetOptions.length > 0 && !deleteConfirm && (
              <>
                {!mergeOpen ? (
                  <button type="button" onClick={() => { setMergeOpen(true); setMergeConfirm(false); setMergeTargetId(""); }}
                    style={{ fontSize: F_BTN, padding: "3px 10px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#fafafa", color: "#555" }}>{LBL.merge}</button>
                ) : !mergeConfirm ? (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}
                      style={{ fontSize: F_BTN, padding: "3px 5px", border: "1px solid #ddd", borderRadius: "3px", maxWidth: "140px" }}>
                      <option value="">Into…</option>
                      {mergeTargetOptions.map((p) => <option key={p.id} value={p.id}>{p.canonicalName}</option>)}
                    </select>
                    <button type="button" disabled={!mergeTargetId} onClick={() => mergeTargetId && setMergeConfirm(true)}
                      style={{ fontSize: F_BTN, padding: "3px 7px", cursor: mergeTargetId ? "pointer" : "default", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: mergeTargetId ? "#1a1a2e" : "#e0e0e0", color: mergeTargetId ? "white" : "#aaa" }}>OK</button>
                    <button type="button" onClick={() => { setMergeOpen(false); setMergeTargetId(""); }}
                      style={{ fontSize: F_BTN, padding: "3px 5px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ fontSize: F_BTN, color: "#555", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>Into <strong>{selectedTarget?.canonicalName}</strong>?</span>
                    <button type="button" onClick={handleMergeSubmit}
                      style={{ fontSize: F_BTN, padding: "1px 7px", cursor: "pointer", border: "none", borderRadius: "3px", backgroundColor: "#c62828", color: "white" }}>Yes</button>
                    <button type="button" onClick={() => { setMergeOpen(false); setMergeConfirm(false); setMergeTargetId(""); }}
                      style={{ fontSize: F_BTN, padding: "1px 5px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>No</button>
                  </div>
                )}
              </>
            )}

            {!deleteConfirm ? (
              <button type="button" title="Delete this character profile" onClick={() => setDeleteConfirm(true)}
                style={{ fontSize: F_BTN + 5, lineHeight: 1, padding: "2px 6px", cursor: "pointer", border: "1px solid #f5c0c0", borderRadius: "3px", backgroundColor: "transparent", color: "#c62828" }}>×</button>
            ) : (
              <div style={{ fontSize: F_BTN, color: "#c62828", display: "flex", alignItems: "center", gap: "5px" }}>
                <span>Delete?</span>
                <button type="button" onClick={onDeleteProfile}
                  style={{ fontSize: F_BTN, padding: "2px 8px", cursor: "pointer", border: "none", borderRadius: "3px", backgroundColor: "#c62828", color: "white" }}>Yes</button>
                <button type="button" onClick={() => setDeleteConfirm(false)}
                  style={{ fontSize: F_BTN, padding: "2px 8px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>No</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scene grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "5px", gap: "8px" }}>
          <span style={{ fontSize: F_SECTION_LABEL, color: "#999", fontWeight: 600, flex: 1 }}>
            {LBL.scenes}{cleanupActive && <span style={{ marginLeft: "6px", color: "#e65100", fontWeight: "normal", fontSize: F_BODY - 1 }}>— × removes false tag</span>}
          </span>
          {!isViewOnly && (
            <button type="button" onClick={() => setCleanupActive((v) => !v)}
              style={{ fontSize: F_BTN, padding: "1px 7px", cursor: "pointer", border: `1px solid ${cleanupActive ? "#e65100" : "#ddd"}`, borderRadius: "3px", backgroundColor: cleanupActive ? "#fff3e0" : "#f5f5f5", color: cleanupActive ? "#e65100" : "#555", fontWeight: cleanupActive ? "bold" : "normal" }}>
              {cleanupActive ? "Exit Cleanup" : "Cleanup"}
            </button>
          )}
        </div>
        {cleanupActive && (
          <div style={{ marginBottom: "6px", padding: "4px 7px", backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "4px", fontSize: F_BTN, color: "#795548", lineHeight: 1.4 }}>
            <strong>Cleanup active</strong> — click × on a scene tag to remove false associations. Script text is never changed.
          </div>
        )}
        {sceneCells.length === 0
          ? <div style={{ fontSize: F_BODY, color: "#bbb" }}>No scenes found.</div>
          : <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {sceneCells.map((cell) => (
                <SceneCell key={cell.sceneId} cell={cell} onNavigateToScene={onNavigateToScene} isCleanupActive={cleanupActive} onSuppress={() => onSuppressSceneTag?.(cell.sceneId)} />
              ))}
            </div>
        }
      </div>

      {/* Aliases / merge history */}
      {(mergeHistory.length > 0 || (profile.aliases || []).length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
          <span style={{ fontSize: F_BODY - 1, color: "#bbb", marginRight: "2px" }}>{LBL.aliases}:</span>
          {(profile.aliases || []).map((alias, i) => (
            <span key={i} style={{ fontSize: F_BODY - 1, padding: "1px 6px", backgroundColor: "#f0f0f0", borderRadius: "3px", color: "#555" }}>{alias}</span>
          ))}
          {mergeHistory.map((h, i) => (
            <span key={`mh-${i}`} style={{ fontSize: F_BODY - 1, padding: "1px 6px", backgroundColor: "#fdf3dc", borderRadius: "3px", color: "#9c6e2b" }}>{h.sourceCanonicalName}</span>
          ))}
        </div>
      )}

      {/* Expand / collapse — hidden when onToggleExpand is null (modal uses always-expanded mode) */}
      {onToggleExpand && (
        <button type="button" onClick={onToggleExpand}
          style={{ alignSelf: "flex-start", fontSize: F_BTN, padding: "2px 10px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa", color: "#555" }}>
          {expanded ? "▴ Less" : "▾ More"}
        </button>
      )}

      {/* Expanded sections */}
      {expanded && (
        <ExpandedDetailSections profile={profile} isViewOnly={isViewOnly} onUpdateProfile={onUpdateProfile} />
      )}

      {/* Notes — always at bottom */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: NOTES_TOP_MARGIN, paddingTop: "6px", borderTop: "1px solid #f0f0f0" }}>
        <span style={{ fontSize: F_SECTION_LABEL, color: "#999" }}>{LBL.notes}</span>
        {!isViewOnly ? (
          <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} onBlur={saveNotes}
            placeholder="Character notes…" rows={2}
            style={{ width: "100%", fontSize: F_NOTES, padding: "4px 7px", border: "1px solid #ddd", borderRadius: "4px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5, outline: "none" }} />
        ) : (
          profile.notes
            ? <div style={{ fontSize: F_NOTES, color: "#555", lineHeight: 1.5 }}>{profile.notes}</div>
            : <div style={{ fontSize: F_NOTES, color: "#bbb" }}>—</div>
        )}
      </div>
    </div>
  );
}

// ─── ExpandedDetailSections ────────────────────────────────────────────────────

function ExpandedDetailSections({ profile, isViewOnly, onUpdateProfile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <CastingSection profile={profile} isViewOnly={isViewOnly} onUpdateProfile={onUpdateProfile} />
      {EXPANDED_PLACEHOLDER_SECTIONS.filter((s) => s.key !== "moodboard").map((section) => (
        <PlaceholderSection
          key={section.key}
          sectionKey={section.key}
          label={section.label}
          profile={profile}
          isViewOnly={isViewOnly}
          onUpdateProfile={onUpdateProfile}
        />
      ))}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "10px" }}>
        <div style={{ fontSize: F_SECTION_HDR, color: "#999", fontWeight: 600, marginBottom: "5px" }}>{LBL.moodboard}</div>
        <div style={{ fontSize: F_BODY, color: "#ccc", fontStyle: "italic", padding: "8px 10px", border: "1px dashed #e0e0e0", borderRadius: "4px" }}>
          Moodboard assignment — coming in a future update.
        </div>
      </div>
    </div>
  );
}

// ─── PlaceholderSection ────────────────────────────────────────────────────────

function PlaceholderSection({ sectionKey, label, profile, isViewOnly, onUpdateProfile }) {
  const raw = profile[sectionKey];
  const isArray = Array.isArray(raw);
  const [val, setVal] = useState(isArray ? "" : (raw || ""));

  useEffect(() => {
    if (!isArray) setVal(profile[sectionKey] || "");
  }, [profile, sectionKey, isArray]);

  const save = () => {
    if (!isArray && val !== (profile[sectionKey] || "")) onUpdateProfile({ [sectionKey]: val });
  };

  return (
    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "10px" }}>
      <div style={{ fontSize: F_SECTION_HDR, color: "#999", fontWeight: 600, marginBottom: "5px" }}>{label}</div>
      {isArray ? (
        <div style={{ fontSize: F_BODY, color: "#bbb", fontStyle: "italic" }}>
          {raw.length === 0 ? `No ${label.toLowerCase()} yet.` : raw.join(", ")}
        </div>
      ) : !isViewOnly ? (
        <textarea value={val} onChange={(e) => setVal(e.target.value)} onBlur={save}
          placeholder={`${label}…`} rows={2}
          style={{ width: "100%", fontSize: F_BODY, padding: "4px 7px", border: "1px solid #ddd", borderRadius: "4px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5, outline: "none", color: "#333" }} />
      ) : (
        raw
          ? <div style={{ fontSize: F_BODY, color: "#555", lineHeight: 1.5 }}>{raw}</div>
          : <div style={{ fontSize: F_BODY, color: "#bbb", fontStyle: "italic" }}>—</div>
      )}
    </div>
  );
}

// ─── CastingSection ────────────────────────────────────────────────────────────

function CastingSection({ profile, isViewOnly, onUpdateProfile }) {
  const [castModalState, setCastModalState] = useState(null);
  const candidates = Array.isArray(profile.castingCandidates) ? profile.castingCandidates : [];
  const editingCandidate = castModalState && castModalState !== "add"
    ? candidates.find((c) => c.id === castModalState) ?? null : null;

  const handleSave = (candidate) => {
    const next = editingCandidate
      ? candidates.map((c) => c.id === candidate.id ? candidate : c)
      : [...candidates, candidate];
    onUpdateProfile({ castingCandidates: next });
    setCastModalState(null);
  };

  const handleRemove = (id) => {
    onUpdateProfile({ castingCandidates: candidates.filter((c) => c.id !== id) });
  };

  return (
    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "10px", marginTop: CASTING_TOP_MARGIN }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
        <span style={{ fontSize: F_SECTION_HDR, color: "#999", fontWeight: 600, flex: 1 }}>{LBL.casting}</span>
        {!isViewOnly && (
          <button type="button" onClick={() => setCastModalState("add")}
            style={{ fontSize: F_BTN, padding: "2px 9px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa", color: "#444" }}>
            + Add Cast
          </button>
        )}
      </div>
      {candidates.length === 0 && (
        <div style={{ fontSize: F_BODY, color: "#ccc", fontStyle: "italic" }}>No casting candidates yet.</div>
      )}
      {candidates.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: CAST_GRID_GAP }}>
          {candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} isViewOnly={isViewOnly}
              onEdit={() => setCastModalState(c.id)}
              onRemove={() => handleRemove(c.id)} />
          ))}
        </div>
      )}
      {castModalState !== null && createPortal(
        <CastModal
          mode={editingCandidate ? "edit" : "add"}
          initial={editingCandidate}
          onSave={handleSave}
          onCancel={() => setCastModalState(null)}
        />,
        document.body
      )}
    </div>
  );
}

// ─── CandidateCard ─────────────────────────────────────────────────────────────

function CandidateCard({ candidate, isViewOnly, onEdit, onRemove }) {
  return (
    <div
      onClick={!isViewOnly ? onEdit : undefined}
      title={!isViewOnly ? "Click to edit" : undefined}
      style={{
        border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "#fafafa",
        display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
        cursor: !isViewOnly ? "pointer" : "default",
      }}
      onMouseEnter={(e) => { if (!isViewOnly) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ width: "100%", height: CAST_CARD_IMG_H, backgroundColor: "#e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {candidate.headshotUrl
          ? <img src={candidate.headshotUrl} alt={candidate.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ fontSize: "28px", color: "#ccc", lineHeight: 1, userSelect: "none" }}>👤</div>
        }
      </div>
      <div style={{ padding: "7px 8px 8px", display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
        <div style={{ fontSize: F_CAST_ACTOR, fontWeight: "bold", color: "#1a1a2e", wordBreak: "break-word" }}>{candidate.name}</div>
        {candidate.imdbUrl && (
          <a href={candidate.imdbUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: F_IMDB, color: "#f5a623", textDecoration: "none" }}>IMDb ↗</a>
        )}
        {Array.isArray(candidate.knownFor) && candidate.knownFor.length > 0 && (
          <div style={{ marginTop: "2px" }}>
            <div style={{ fontSize: F_KNOWN_FOR - 2, color: "#bbb", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{LBL.knownFor}</div>
            {candidate.knownFor.map((kf, i) => (
              <div key={i} style={{ fontSize: F_KNOWN_FOR, lineHeight: 1.4 }}>
                {kf.imdbUrl
                  ? <a href={kf.imdbUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#555", textDecoration: "none" }}>{kf.title} ↗</a>
                  : <span style={{ color: "#666" }}>{kf.title}</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>
      {!isViewOnly && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove"
          style={{ position: "absolute", top: "5px", right: "5px", fontSize: "11px", lineHeight: 1, padding: "1px 5px", cursor: "pointer", border: "1px solid #f5c0c0", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.85)", color: "#c62828" }}>×</button>
      )}
    </div>
  );
}

// ─── CastModal ─────────────────────────────────────────────────────────────────
// Add / Edit modal for casting candidates. IMDb auto-population deferred.

function CastModal({ mode, initial, onSave, onCancel }) {
  const isEdit = mode === "edit";
  const [name, setName]               = useState(initial?.name        ?? "");
  const [imdbUrl, setImdbUrl]         = useState(initial?.imdbUrl     ?? "");
  const [headshotUrl, setHeadshotUrl] = useState(initial?.headshotUrl ?? "");
  const [knownFor, setKnownFor]       = useState(
    Array.isArray(initial?.knownFor) && initial.knownFor.length > 0
      ? initial.knownFor : [{ title: "", imdbUrl: "" }]
  );

  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onCancel]);

  const addRow = () => { if (knownFor.length < 6) setKnownFor((p) => [...p, { title: "", imdbUrl: "" }]); };
  const updateRow = (i, field, value) =>
    setKnownFor((p) => p.map((kf, idx) => idx === i ? { ...kf, [field]: value } : kf));
  const removeRow = (i) =>
    setKnownFor((p) => p.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? `cast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      imdbUrl: imdbUrl.trim(),
      headshotUrl: headshotUrl.trim(),
      knownFor: knownFor.filter((kf) => kf.title.trim()),
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100010, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 8px 36px rgba(0,0,0,0.26)", width: "min(480px, calc(100vw - 48px))", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e0e0e0", flexShrink: 0, backgroundColor: "#f8f8fa" }}>
          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#1a1a2e" }}>{isEdit ? "Edit Cast" : "Add Cast"}</div>
          <div style={{ fontSize: "10px", color: "#bbb", marginTop: "3px" }}>
            Manual entry — IMDb auto-fill requires a backend metadata integration. Enter details manually for now.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <CastField label="Actor / Person Name *">
            <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cate Blanchett" style={castInputStyle} />
          </CastField>
          <CastField label="IMDb Profile Link">
            <input type="url" value={imdbUrl} onChange={(e) => setImdbUrl(e.target.value)}
              placeholder="https://www.imdb.com/name/…" style={castInputStyle} />
          </CastField>
          <CastField label="Headshot URL">
            <input type="url" value={headshotUrl} onChange={(e) => setHeadshotUrl(e.target.value)}
              placeholder="https://… (direct image link)" style={castInputStyle} />
            {headshotUrl.trim() && (
              <img src={headshotUrl.trim()} alt="preview"
                onError={(e) => { e.target.style.display = "none"; }}
                style={{ marginTop: "6px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid #eee" }} />
            )}
          </CastField>
          <div>
            <div style={{ fontSize: "11px", color: "#777", marginBottom: "6px", fontWeight: 600 }}>Known For</div>
            {knownFor.map((kf, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                <input type="text" value={kf.title} onChange={(e) => updateRow(i, "title", e.target.value)}
                  placeholder="Title" style={{ ...castInputStyle, flex: 1 }} />
                <input type="url" value={kf.imdbUrl} onChange={(e) => updateRow(i, "imdbUrl", e.target.value)}
                  placeholder="IMDb title link (optional)" style={{ ...castInputStyle, flex: 1 }} />
                <button type="button" onClick={() => removeRow(i)}
                  style={{ fontSize: "12px", padding: "2px 6px", cursor: "pointer", border: "1px solid #f5c0c0", borderRadius: "3px", backgroundColor: "transparent", color: "#c62828", flexShrink: 0 }}>×</button>
              </div>
            ))}
            {knownFor.length < 6 && (
              <button type="button" onClick={addRow}
                style={{ fontSize: "10px", padding: "2px 9px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa", color: "#555" }}>
                + Add title
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "10px 18px", borderTop: "1px solid #e0e0e0", flexShrink: 0, display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel}
            style={{ fontSize: "12px", padding: "5px 14px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", backgroundColor: "#f5f5f5", color: "#555" }}>Cancel</button>
          <button type="button" disabled={!name.trim()} onClick={handleSave}
            style={{ fontSize: "12px", padding: "5px 14px", cursor: name.trim() ? "pointer" : "default", border: "none", borderRadius: "5px", backgroundColor: name.trim() ? "#1a1a2e" : "#e0e0e0", color: name.trim() ? "white" : "#aaa", fontWeight: "bold" }}>
            {isEdit ? "Save Cast" : "Add Cast"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CastField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: "#777", fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}

const castInputStyle = {
  fontSize: "12px", padding: "5px 8px",
  border: "1px solid #ddd", borderRadius: "4px", outline: "none",
  width: "100%", boxSizing: "border-box",
};

// ─── CharacterDetailsModal ─────────────────────────────────────────────────────
// Grid view "View Details" popup.

function CharacterDetailsModal(props) {
  const { profile, onClose } = props;
  const firstAppearance = profile.firstAppearanceSceneHeading || "";
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100000, backgroundColor: "rgba(0,0,0,0.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", boxSizing: "border-box", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 8px 40px rgba(0,0,0,0.26)", width: "min(900px, calc(100vw - 48px))", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e0e0e0", flexShrink: 0, backgroundColor: "#f8f8fa", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "bold", fontSize: "17px", color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.canonicalName}</div>
            {firstAppearance && <div style={{ fontSize: "11px", color: "#999", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>First: {firstAppearance}</div>}
          </div>
          <button type="button" onClick={onClose}
            style={{ fontSize: "11px", padding: "4px 12px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "5px", backgroundColor: "white", color: "#555", flexShrink: 0 }}>Close</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <RowDetailPanel
            {...props}
            expanded={true}
            onToggleExpand={null}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}


// ─── SceneCell ─────────────────────────────────────────────────────────────────

function SceneCell({ cell, onNavigateToScene, isCleanupActive, onSuppress }) {
  const [tooltipRect, setTooltipRect] = useState(null);
  const btnRef = useRef(null);
  const canNavigate = cell.sceneIndex >= 0 && typeof onNavigateToScene === "function";
  const hasOnlyActionSources = cell.sources?.length > 0 && cell.sources.every((s) => s.nodeType === "Action");

  const tooltipLines = [cell.heading].filter(Boolean);
  if (isCleanupActive && cell.sources?.length) {
    const seen = new Set();
    cell.sources.forEach((s) => {
      const key = `${s.nodeType}:${s.matchedName}`;
      if (!seen.has(key)) { seen.add(key); tooltipLines.push(`${s.nodeType === "Action" ? "Action mention" : "Character cue"}: "${s.matchedName}"`); }
    });
  }

  const showTip = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setTooltipRect(r); };
  const hideTip = () => setTooltipRect(null);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "1px" }}>
      <button ref={btnRef} type="button" onMouseEnter={showTip} onMouseLeave={hideTip}
        onClick={() => { if (canNavigate) onNavigateToScene(cell.sceneIndex); }}
        style={{ fontSize: F_BODY - 1, padding: "3px 7px", cursor: canNavigate ? "pointer" : "default", border: "1px solid #ddd", borderRadius: isCleanupActive ? "3px 0 0 3px" : "3px", backgroundColor: isCleanupActive && hasOnlyActionSources ? "#fff8e1" : "#f0f0f0", color: "#555", minWidth: "26px", textAlign: "center" }}>
        {cell.sceneNumber}
      </button>
      {isCleanupActive && (
        <button type="button" title="Remove this scene association (script text unchanged)" onMouseEnter={showTip} onMouseLeave={hideTip}
          onClick={(e) => { e.stopPropagation(); onSuppress?.(); }}
          style={{ fontSize: "9px", padding: "3px 5px", cursor: "pointer", border: "1px solid #f5c0c0", borderLeft: "none", borderRadius: "0 3px 3px 0", backgroundColor: "#fff3f3", color: "#c62828", lineHeight: 1 }}>×</button>
      )}
      {tooltipRect && tooltipLines.length > 0 && createPortal(
        <div style={{ position: "fixed", left: tooltipRect.left + tooltipRect.width / 2, top: tooltipRect.top - 6, transform: "translate(-50%, -100%)", backgroundColor: "rgba(26,26,46,0.92)", color: "white", fontSize: "9px", padding: "4px 7px", borderRadius: "3px", whiteSpace: "nowrap", zIndex: 999999, maxWidth: "280px", pointerEvents: "none", lineHeight: 1.6 }}>
          {tooltipLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>,
        document.body
      )}
    </div>
  );
}
