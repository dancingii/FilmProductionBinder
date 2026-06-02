// Compact character panel — used by the Writing Script Characters tab.
// Visual style is deliberately simple: list of collapsed/expanded profile cards.
// This component is NOT used by the standalone Writing Characters module.
// Standalone module UI lives in WritingCharactersModulePanel.jsx.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deriveCharacterKey } from "./writingCharacterExtraction";
import { getWritingCharacterProfilesArray } from "./writingCharactersModel";
import WritingCharacterSuggestionsModal from "./WritingCharacterSuggestionsModal";

const ROLE_OPTIONS = ["", "Protagonist", "Antagonist", "Supporting", "Narrator"];

export default function WritingCharactersPanel({
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
  onMergeProfiles,
  onDeleteProfile,
  onSuppressSceneTag,
  sceneSuppresssions,
  allNodes,
  scenes,
  sceneIdToIndex,
  onNavigateToScene,
  hasScript,
  onSetCharacterTagHighlights,
  onClearCharacterTagHighlights,
  nodeIndexPageMap,
}) {
  const [showModal, setShowModal] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  // rescanTrigger increments only when user clicks "Rescan Script" explicitly.
  // It is the ONLY trigger allowed to open the suggestions modal automatically.
  const [rescanTrigger, setRescanTrigger] = useState(0);
  // userRequestedScan is true only when the user clicked Rescan. The effect checks
  // this flag and clears it after consuming it so normal load/visibility changes
  // never auto-open the modal.
  const userRequestedScanRef = useRef(false);
  // Tracks the last importTrigger value that was evaluated so we only act once
  // per import, not on every subsequent re-render.
  const lastConsumedImportTriggerRef = useRef(0);
  // When an import fires while profiles are still loading, we park the pending
  // trigger value here and evaluate once profiles become ready.
  const pendingImportTriggerRef = useRef(0);
  // True when the currently open modal was triggered by an import (not Rescan).
  // Used to call onImportSignalConsumed after user confirms/dismisses.
  const modalOpenedByImportRef = useRef(false);
  const [sortMode, setSortMode] = useState("chronological");
  const [cleanupProfileId, setCleanupProfileId] = useState(null);

  // Keep a stable ref to the latest clear callback so the unmount effect never
  // re-runs just because the parent re-renders with a new inline function reference.
  // Without this, every setCurrentIndex call in WritingScript creates a new
  // onClearCharacterTagHighlights reference, React re-runs the effect cleanup,
  // and that cleanup call clears the active highlights.
  const clearHighlightsRef = useRef(onClearCharacterTagHighlights);
  useEffect(() => { clearHighlightsRef.current = onClearCharacterTagHighlights; });

  // Clear highlights only on true unmount, not on every prop-reference change.
  useEffect(() => {
    return () => { clearHighlightsRef.current?.(); };
  }, []);

  useEffect(() => {
    // Only open the modal when the user explicitly clicked Rescan Script.
    // Do NOT auto-open on project load, tab switch, or draftNodes reload.
    // userRequestedScanRef is set true just before rescanTrigger increments;
    // we consume it here and clear it so subsequent re-runs are no-ops.
    if (!userRequestedScanRef.current) return;
    userRequestedScanRef.current = false;

    if (isProfilesLoading) return;

    const existingKeys = new Set();
    const p = profiles?.profiles || {};
    Object.keys(p).forEach((k) => existingKeys.add(k));
    Object.values(p).forEach((prof) => {
      // Exclude aliases stored on profiles.
      (prof.aliases || []).forEach((a) => existingKeys.add(deriveCharacterKey(String(a).toUpperCase())));
      // Exclude source names from merge history so merged characters don't resurface.
      (prof.mergeHistory || []).forEach((h) => {
        if (h.sourceId) existingKeys.add(h.sourceId);
        if (h.sourceCanonicalName) existingKeys.add(deriveCharacterKey(String(h.sourceCanonicalName).toUpperCase()));
      });
    });
    // Exclude all resolution source keys (merged-from names).
    Object.entries(profiles?.resolution || {}).forEach(([srcKey, canonKey]) => {
      existingKeys.add(srcKey); existingKeys.add(canonKey);
    });
    // Ignored/suppressed suggestions are always excluded — even on explicit Rescan.
    // A future "Review ignored suggestions" UI can lift this if needed.
    (profiles?.ignoredSuggestions || []).forEach((k) => existingKeys.add(k));

    const unresolved = [];
    extractedNames.forEach((ec) => {
      if (!existingKeys.has(ec.normalizedKey)) unresolved.push(ec);
    });

    if (unresolved.length > 0) {
      setPendingSuggestions(unresolved);
      setShowModal(true);
    } else {
      setShowModal(false);
      setPendingSuggestions([]);
    }
  }, [extractedNames, profiles, rescanTrigger, isProfilesLoading]);

  // Import-complete signal: fires when WritingScript emits a successful import.
  // Parks the trigger if profiles haven't loaded yet; evaluates once they have.
  // Suppression filters stay active — same as Rescan.
  useEffect(() => {
    if (importTrigger == null || importTrigger === 0) return;

    // New import arrived — park it so we can evaluate once profiles are ready.
    if (importTrigger > lastConsumedImportTriggerRef.current) {
      pendingImportTriggerRef.current = importTrigger;
    }

    // Not ready yet — profiles still loading or no pending trigger.
    if (isProfilesLoading || pendingImportTriggerRef.current === 0) return;
    // Already consumed this trigger value.
    if (pendingImportTriggerRef.current <= lastConsumedImportTriggerRef.current) return;

    // Consume.
    lastConsumedImportTriggerRef.current = pendingImportTriggerRef.current;
    pendingImportTriggerRef.current = 0;

    // Build the same exclusion set as the Rescan effect — all filters active.
    const existingKeys = new Set();
    const p = profiles?.profiles || {};
    Object.keys(p).forEach((k) => existingKeys.add(k));
    Object.values(p).forEach((prof) => {
      (prof.aliases || []).forEach((a) => existingKeys.add(deriveCharacterKey(String(a).toUpperCase())));
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
    extractedNames.forEach((ec) => {
      if (!existingKeys.has(ec.normalizedKey)) unresolved.push(ec);
    });

    if (unresolved.length > 0) {
      modalOpenedByImportRef.current = true;
      setPendingSuggestions(unresolved);
      setShowModal(true);
    } else {
      // No modal needed — mark consumed immediately.
      onImportSignalConsumed?.();
    }
  }, [importTrigger, isProfilesLoading, extractedNames, profiles, onImportSignalConsumed]);

  const handleConfirm = (selectedKeys) => {
    setShowModal(false);
    setPendingSuggestions([]);
    if (modalOpenedByImportRef.current) { modalOpenedByImportRef.current = false; onImportSignalConsumed?.(); }
    if (selectedKeys.length > 0) onCreateProfiles(selectedKeys);
  };

  const handleDismiss = (allKeys) => {
    setShowModal(false);
    setPendingSuggestions([]);
    if (modalOpenedByImportRef.current) { modalOpenedByImportRef.current = false; onImportSignalConsumed?.(); }
    onIgnoreSuggestions(allKeys);
  };

  const baseProfileList = getWritingCharacterProfilesArray(profiles);
  const profileList = sortMode === "chronological"
    ? [...baseProfileList].sort((a, b) => {
        const aIdx = extractedNames.get(a.id)?.firstNodeIndex ?? Infinity;
        const bIdx = extractedNames.get(b.id)?.firstNodeIndex ?? Infinity;
        return aIdx - bIdx;
      })
    : baseProfileList;

  const hasProfiles = profileList.length > 0;

  // Build highlight ranges for all unsuppressed scene sources of the given character.
  const buildHighlights = (liveExtractedEntry, suppressedSceneIds) => {
    const allSources = [];
    if (liveExtractedEntry?.sceneAppearances) {
      liveExtractedEntry.sceneAppearances.forEach((appearance, sceneId) => {
        if (!suppressedSceneIds.has(sceneId)) {
          allSources.push(...(appearance.sources || []));
        }
      });
    }
    return allSources;
  };

  const activateCleanup = (profileId, liveExtractedEntry, suppressedSceneIds) => {
    setCleanupProfileId(profileId);
    const sources = buildHighlights(liveExtractedEntry, suppressedSceneIds);
    onSetCharacterTagHighlights?.(sources, allNodes);
  };

  const deactivateCleanup = () => {
    setCleanupProfileId(null);
    onClearCharacterTagHighlights?.();
  };

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: "white",
        fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
        fontSize: "12px", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box",
      }}>
        <div style={{ padding: "8px 10px" }}>

          {/* No script */}
          {!hasScript && (
            <div style={{ color: "#aaa", fontSize: "12px", lineHeight: 1.6, textAlign: "center", marginTop: "32px", padding: "0 16px" }}>
              <div style={{ fontSize: "15px", marginBottom: "6px" }}>No script yet</div>
              Start or import a Writing script to begin detecting characters.
            </div>
          )}

          {hasScript && (
            <>
              {/* Toolbar — sort + rescan */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                {hasProfiles && (
                  <div style={{ display: "flex", gap: "0", border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                    <button type="button" onClick={() => setSortMode("chronological")}
                      style={{ fontSize: "10px", padding: "2px 8px", cursor: "pointer", border: "none", backgroundColor: sortMode === "chronological" ? "#1a1a2e" : "#f5f5f5", color: sortMode === "chronological" ? "white" : "#555" }}>
                      Chronological
                    </button>
                    <button type="button" onClick={() => setSortMode("scenes")}
                      style={{ fontSize: "10px", padding: "2px 8px", cursor: "pointer", border: "none", borderLeft: "1px solid #ddd", backgroundColor: sortMode === "scenes" ? "#1a1a2e" : "#f5f5f5", color: sortMode === "scenes" ? "white" : "#555" }}>
                      By Scenes
                    </button>
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <button type="button"
                  onClick={() => { onRescan(); userRequestedScanRef.current = true; setRescanTrigger((n) => n + 1); }}
                  style={{ fontSize: "11px", padding: "3px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}>
                  Rescan Script
                </button>
              </div>

              {cleanupProfileId && (
                <div style={{ marginBottom: "8px", padding: "5px 8px", backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "4px", fontSize: "10px", color: "#795548", lineHeight: 1.4 }}>
                  <strong>Cleanup active</strong> — tagged sources are highlighted in the script. Click × on a scene tag to remove false associations. Script text is never changed.
                </div>
              )}

              {/* Empty states */}
              {!isProfilesLoading && !hasProfiles && extractedNames.size === 0 && (
                <div style={{ color: "#aaa", fontSize: "12px", lineHeight: 1.6, textAlign: "center", marginTop: "32px", padding: "0 16px" }}>
                  No characters detected yet.<br />
                  Add <strong>Character</strong> lines to your script, then click Rescan Script.
                </div>
              )}
              {!isProfilesLoading && !hasProfiles && extractedNames.size > 0 && (
                <div style={{ color: "#888", fontSize: "12px", lineHeight: 1.6, textAlign: "center", marginTop: "24px", padding: "0 16px" }}>
                  {extractedNames.size} character{extractedNames.size !== 1 ? "s" : ""} detected in the script.<br />
                  Click <strong>Rescan Script</strong> to create profiles.
                </div>
              )}
            </>
          )}

          {/* Profile cards */}
          {hasScript && profileList.map((prof) => {
            const suppressedSceneIds = new Set(
              Array.isArray(sceneSuppresssions?.[prof.id]) ? sceneSuppresssions[prof.id] : []
            );
            const liveExtractedEntry = extractedNames.get(prof.id) || null;
            const isCleanupActive = cleanupProfileId === prof.id;
            return (
              <ProfileCard
                key={prof.id}
                profile={prof}
                isViewOnly={isViewOnly}
                onUpdateProfile={onUpdateProfile}
                liveExtractedEntry={liveExtractedEntry}
                scenes={scenes}
                sceneIdToIndex={sceneIdToIndex}
                onNavigateToScene={onNavigateToScene
                  ? (sceneIndex) => onNavigateToScene(sceneIndex)
                  : null}
                allActiveProfiles={profileList}
                onMergeProfiles={onMergeProfiles}
                onDeleteProfile={onDeleteProfile}
                isCleanupActive={isCleanupActive}
                suppressedSceneIds={suppressedSceneIds}
                onActivateCleanup={() => activateCleanup(prof.id, liveExtractedEntry, suppressedSceneIds)}
                onDeactivateCleanup={deactivateCleanup}
                onSuppressSceneTag={(sceneId) => {
                  onSuppressSceneTag?.(prof.id, sceneId);
                  if (isCleanupActive) {
                    const nextSuppressed = new Set([...suppressedSceneIds, sceneId]);
                    const sources = buildHighlights(liveExtractedEntry, nextSuppressed);
                    onSetCharacterTagHighlights?.(sources, allNodes);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {showModal && pendingSuggestions.length > 0 && (
        <WritingCharacterSuggestionsModal
          suggestions={pendingSuggestions}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
          nodeIndexPageMap={nodeIndexPageMap}
          allNodes={allNodes}
        />
      )}
    </div>
  );
}

// ─── ProfileCard ───────────────────────────────────────────────────────────────
// Collapsed: name + scene count. Expanded: role, scene grid, merge history, notes, actions.

function ProfileCard({
  profile, isViewOnly, onUpdateProfile, liveExtractedEntry,
  scenes, sceneIdToIndex, onNavigateToScene,
  allActiveProfiles, onMergeProfiles, onDeleteProfile,
  isCleanupActive, suppressedSceneIds, onActivateCleanup, onDeactivateCleanup, onSuppressSceneTag,
}) {
  const [expanded, setExpanded] = useState(false);
  const [notesValue, setNotesValue] = useState(profile.notes || "");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => { setNotesValue(profile.notes || ""); }, [profile.notes]);

  const saveNotes = () => {
    if (notesValue !== (profile.notes || "")) onUpdateProfile(profile.id, { notes: notesValue });
  };

  const rawSceneIds = liveExtractedEntry?.sceneIds
    ? Array.from(liveExtractedEntry.sceneIds)
    : (profile.sceneIds || []);

  const seenIndices = new Set();
  const sceneCells = rawSceneIds
    .filter((sceneId) => !suppressedSceneIds.has(sceneId))
    .map((sceneId) => {
      const idx = sceneIdToIndex?.[sceneId] ?? -1;
      if (idx < 0) return null;
      if (seenIndices.has(idx)) return null;
      seenIndices.add(idx);
      const scene = Array.isArray(scenes) ? scenes[idx] : null;
      if (!scene) return null;
      const appearance = liveExtractedEntry?.sceneAppearances?.get(sceneId) || null;
      return {
        sceneId, sceneIndex: idx,
        sceneNumber: scene.sceneNumber ?? idx + 1,
        heading: scene.heading || scene.text || "",
        sources: appearance?.sources || [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  const displayedSceneCount = sceneCells.length;
  const mergeTargetOptions = allActiveProfiles.filter((p) => p.id !== profile.id);
  const selectedTarget = mergeTargetOptions.find((p) => p.id === mergeTargetId);
  const mergeHistory = profile.mergeHistory || [];
  const firstAppearance = profile.firstAppearanceSceneHeading || "";

  const handleMergeSubmit = () => {
    if (!mergeTargetId || !onMergeProfiles) return;
    onMergeProfiles(profile.id, mergeTargetId);
    setMergeOpen(false); setMergeConfirm(false); setMergeTargetId("");
  };

  return (
    <div style={{
      border: `1px solid ${isCleanupActive ? "#ffb74d" : "#e0e0e0"}`,
      borderRadius: "6px", marginBottom: "6px",
      backgroundColor: isCleanupActive ? "#fffdf5" : "white",
      overflow: "visible",
    }}>
      {/* Collapsed header */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 10px", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: "9px", color: "#aaa", flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
        <span style={{ fontWeight: "bold", fontSize: "15px", color: "#1a1a2e", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {profile.canonicalName}
        </span>
        <span style={{ fontSize: "12px", color: "#aaa", flexShrink: 0, whiteSpace: "nowrap" }}>
          {displayedSceneCount} scene{displayedSceneCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>

          {/* Role */}
          {!isViewOnly ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "#555", flexShrink: 0 }}>Role:</span>
              <select value={profile.role || ""} onChange={(e) => onUpdateProfile(profile.id, { role: e.target.value })}
                style={{ fontSize: "12px", padding: "2px 6px", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "white", cursor: "pointer", color: profile.role ? "#1a1a2e" : "#aaa", width: "140px" }}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r || "— role —"}</option>)}
              </select>
            </div>
          ) : profile.role ? (
            <div style={{ fontSize: "12px", color: "#607D8B" }}>{profile.role}</div>
          ) : null}

          {/* Scenes heading + cleanup toggle */}
          <div>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "12px", color: "#888", fontWeight: 600, flex: 1 }}>
                Scenes
                {isCleanupActive && <span style={{ marginLeft: "6px", color: "#e65100", fontWeight: "normal", fontSize: "11px" }}>— × removes false tag</span>}
              </span>
              {!isViewOnly && (
                <button type="button"
                  onClick={() => isCleanupActive ? onDeactivateCleanup() : onActivateCleanup()}
                  style={{
                    fontSize: "10px", padding: "1px 8px", cursor: "pointer",
                    border: `1px solid ${isCleanupActive ? "#e65100" : "#ddd"}`,
                    borderRadius: "3px",
                    backgroundColor: isCleanupActive ? "#fff3e0" : "#f5f5f5",
                    color: isCleanupActive ? "#e65100" : "#555",
                    fontWeight: isCleanupActive ? "bold" : "normal",
                    flexShrink: 0,
                  }}>
                  {isCleanupActive ? "Exit Cleanup" : "Cleanup"}
                </button>
              )}
            </div>

            {sceneCells.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#bbb" }}>No scenes found.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                {sceneCells.map((cell) => (
                  <SceneCell
                    key={cell.sceneId}
                    cell={cell}
                    onNavigateToScene={onNavigateToScene}
                    isCleanupActive={isCleanupActive}
                    onSuppress={() => onSuppressSceneTag?.(cell.sceneId)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* First appearance + merge history */}
          {(firstAppearance || mergeHistory.length > 0) && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px" }}>
              {firstAppearance && (
                <span style={{ color: "#888", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  First: {firstAppearance}
                </span>
              )}
              {mergeHistory.length > 0 && (
                <span style={{ color: "#9c6e2b", flexShrink: 0, textAlign: "right" }}>
                  Merged: {mergeHistory.map((h) => h.sourceCanonicalName).join(", ")}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          {!isViewOnly && (
            <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} onBlur={saveNotes}
              placeholder="Notes…" rows={2}
              style={{ width: "100%", fontSize: "12px", padding: "3px 5px", border: "1px solid #ddd", borderRadius: "4px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.4 }} />
          )}
          {isViewOnly && profile.notes && (
            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.4 }}>{profile.notes}</div>
          )}

          {/* Bottom action row: Merge (left) · × delete (right) */}
          {!isViewOnly && !deleteConfirm && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", borderTop: "1px solid #f0f0f0", paddingTop: "6px" }}>
              {onMergeProfiles && mergeTargetOptions.length > 0 ? (
                <div style={{ flex: 1 }}>
                  {!mergeOpen ? (
                    <button type="button" onClick={() => { setMergeOpen(true); setMergeConfirm(false); setMergeTargetId(""); }}
                      style={{ fontSize: "11px", padding: "2px 8px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#fafafa", color: "#555" }}>Merge</button>
                  ) : !mergeConfirm ? (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}
                        style={{ fontSize: "11px", padding: "2px 4px", border: "1px solid #ddd", borderRadius: "3px", maxWidth: "140px" }}>
                        <option value="">Into…</option>
                        {mergeTargetOptions.map((p) => <option key={p.id} value={p.id}>{p.canonicalName}</option>)}
                      </select>
                      <button type="button" disabled={!mergeTargetId} onClick={() => mergeTargetId && setMergeConfirm(true)}
                        style={{ fontSize: "11px", padding: "2px 6px", cursor: mergeTargetId ? "pointer" : "default", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: mergeTargetId ? "#1a1a2e" : "#e0e0e0", color: mergeTargetId ? "white" : "#aaa" }}>OK</button>
                      <button type="button" onClick={() => { setMergeOpen(false); setMergeTargetId(""); }}
                        style={{ fontSize: "11px", padding: "2px 5px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "#555" }}>
                      Into <strong>{selectedTarget?.canonicalName}</strong>?{" "}
                      <button type="button" onClick={handleMergeSubmit}
                        style={{ fontSize: "11px", padding: "1px 6px", cursor: "pointer", border: "none", borderRadius: "3px", backgroundColor: "#c62828", color: "white" }}>Yes</button>{" "}
                      <button type="button" onClick={() => { setMergeOpen(false); setMergeConfirm(false); setMergeTargetId(""); }}
                        style={{ fontSize: "11px", padding: "1px 5px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>No</button>
                    </div>
                  )}
                </div>
              ) : <div style={{ flex: 1 }} />}

              <button type="button" title="Delete this character profile" onClick={() => setDeleteConfirm(true)}
                style={{ fontSize: "13px", lineHeight: 1, padding: "1px 5px", cursor: "pointer", border: "1px solid #f5c0c0", borderRadius: "3px", backgroundColor: "transparent", color: "#c62828", flexShrink: 0 }}>×</button>
            </div>
          )}

          {/* Delete confirmation */}
          {!isViewOnly && deleteConfirm && (
            <div style={{ fontSize: "11px", color: "#c62828", borderTop: "1px solid #f0f0f0", paddingTop: "6px" }}>
              Delete profile? Script text unchanged.{" "}
              <button type="button" onClick={() => { onDeleteProfile?.(profile.id); setDeleteConfirm(false); }}
                style={{ fontSize: "11px", padding: "1px 7px", cursor: "pointer", border: "none", borderRadius: "3px", backgroundColor: "#c62828", color: "white" }}>Delete</button>{" "}
              <button type="button" onClick={() => setDeleteConfirm(false)}
                style={{ fontSize: "11px", padding: "1px 7px", cursor: "pointer", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#777" }}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
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
      if (!seen.has(key)) {
        seen.add(key);
        tooltipLines.push(`${s.nodeType === "Action" ? "Action mention" : "Character cue"}: "${s.matchedName}"`);
      }
    });
  }

  const showTip = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setTooltipRect(r); };
  const hideTip = () => setTooltipRect(null);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "1px" }}>
      <button ref={btnRef} type="button" onMouseEnter={showTip} onMouseLeave={hideTip}
        onClick={() => { if (canNavigate) onNavigateToScene(cell.sceneIndex); }}
        style={{
          fontSize: "11px", padding: "2px 6px", cursor: canNavigate ? "pointer" : "default",
          border: "1px solid #ddd", borderRadius: isCleanupActive ? "3px 0 0 3px" : "3px",
          backgroundColor: isCleanupActive && hasOnlyActionSources ? "#fff8e1" : "#f0f0f0",
          color: "#555", minWidth: "24px", textAlign: "center",
        }}>
        {cell.sceneNumber}
      </button>

      {isCleanupActive && (
        <button type="button" title="Remove this scene association (script text unchanged)"
          onMouseEnter={showTip} onMouseLeave={hideTip}
          onClick={(e) => { e.stopPropagation(); onSuppress?.(); }}
          style={{ fontSize: "9px", padding: "2px 4px", cursor: "pointer", border: "1px solid #f5c0c0", borderLeft: "none", borderRadius: "0 3px 3px 0", backgroundColor: "#fff3f3", color: "#c62828", lineHeight: 1 }}>×</button>
      )}

      {tooltipRect && tooltipLines.length > 0 && createPortal(
        <div style={{
          position: "fixed",
          left: tooltipRect.left + tooltipRect.width / 2,
          top: tooltipRect.top - 6,
          transform: "translate(-50%, -100%)",
          backgroundColor: "rgba(26,26,46,0.92)", color: "white",
          fontSize: "9px", padding: "4px 7px", borderRadius: "3px",
          whiteSpace: "nowrap", zIndex: 999999, maxWidth: "280px",
          pointerEvents: "none", lineHeight: 1.6,
        }}>
          {tooltipLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>,
        document.body
      )}
    </div>
  );
}
