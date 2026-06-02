// ─── Writing Characters Module ────────────────────────────────────────────────
// Standalone Writing-only character workspace.
//
// ISOLATION CONTRACT:
//   • Loads committed Writing script nodes from the same persistence layer as
//     WritingScript (loadWritingDraftAsync) — read-only, never writes back.
//   • Loads and saves Writing Character profiles via writingCharactersPersistence
//     into project.settings["writingCharacterProfiles"].
//   • Does NOT read or write Production Characters, Script Breakdown, cast, or
//     any other production table.
//   • Future handoff from Writing Characters → Production Characters must be an
//     explicit manual user action, never automatic.
//
// FUTURE FIELDS (not yet implemented, scaffolded here):
//   avatar/image, moodboard, biography, psychology, relationships,
//   wardrobe, voice, arc, secrets, references.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WritingCharactersPanel from "./WritingCharactersModulePanel";
import WritingSceneViewerModal from "./WritingSceneViewerModal";
import {
  normalizeWritingCharacterProfiles,
  makeEmptyCharacterProfile,
} from "./writingCharactersModel";
import {
  loadWritingCharacterProfilesAsync,
  saveWritingCharacterProfilesAsync,
  getWritingCharactersStorageKey,
} from "./writingCharactersPersistence";
import { extractWritingCharacters } from "./writingCharacterExtraction";
import { loadWritingDraftAsync } from "../WritingScript/writingDraftPersistence";
import { scenesFromDocumentNodes } from "../WritingScript/writingDraftModel";
import { paginateScreenplayNodes } from "../../../utils/screenplayPagination";
export default function WritingCharacters({ selectedProject, userRole, isVisible = true, onProjectDirty, onProjectSynced }) {
  const isViewOnly = userRole === "viewer";

  // ── Load committed Writing nodes (read-only) ───────────────────────────────
  // Initial load on mount. Re-reads localStorage (kept current by WritingScript)
  // each time the module becomes visible, so script edits are reflected immediately
  // without a DB round-trip.
  const [draftNodes, setDraftNodes] = useState([]);
  const [draftLoadStatus, setDraftLoadStatus] = useState("idle");

  const loadDraftNodes = useCallback(() => {
    if (!selectedProject) { setDraftLoadStatus("idle"); return () => {}; }
    let cancelled = false;
    setDraftLoadStatus("loading");
    loadWritingDraftAsync(selectedProject)
      .then((draft) => {
        if (cancelled) return;
        const nodes = draft.hasUserCreatedScript && Array.isArray(draft.nodes) ? draft.nodes : [];
        setDraftNodes(nodes);
        setDraftLoadStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setDraftNodes([]);
        setDraftLoadStatus("error");
      });
    return () => { cancelled = true; };
  }, [selectedProject?.id, selectedProject?.name]);

  // Load on mount / project change.
  useEffect(() => loadDraftNodes(), [loadDraftNodes]);

  // Re-read draft nodes each time the tab becomes visible (picks up script edits).
  // Reads from localStorage — essentially instant, no DB round-trip.
  const prevVisibleRef = useRef(isVisible);
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      loadDraftNodes();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, loadDraftNodes]);

  // ── Derive scenes from committed nodes ────────────────────────────────────
  const draftScenes = useMemo(() => {
    if (!draftNodes.length) return [];
    return scenesFromDocumentNodes(draftNodes).map((scene, index) => ({
      ...scene,
      sceneNumber: index + 1,
    }));
  }, [draftNodes]);

  // ── Load Writing Character profiles (once per project, stays in memory) ───
  const [writingCharacterProfiles, setWritingCharacterProfiles] = useState(
    () => normalizeWritingCharacterProfiles(null)
  );
  const [profilesLoadStatus, setProfilesLoadStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    setProfilesLoadStatus("loading");
    // Reset to empty while loading — saves require explicit user action so this
    // cannot cause a data-loss save-on-mount, but does cause a brief empty flash.
    setWritingCharacterProfiles(normalizeWritingCharacterProfiles(null));
    if (!selectedProject) { setProfilesLoadStatus("idle"); return; }
    if (process.env.NODE_ENV === "development") {
      console.info(`[WritingCharacters load] starting profile load for project ${selectedProject?.id || selectedProject?.name}`);
    }
    loadWritingCharacterProfilesAsync(selectedProject)
      .then(({ data, storage }) => {
        if (cancelled) return;
        const normalized = normalizeWritingCharacterProfiles(data);
        const profileCount = Object.keys(normalized?.profiles || {}).length;
        if (process.env.NODE_ENV === "development") {
          console.info(`[WritingCharacters load] loaded ${profileCount} profile(s) from ${storage}`);
        }
        setWritingCharacterProfiles(normalized);
        setProfilesLoadStatus("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        if (process.env.NODE_ENV === "development") {
          console.warn("[WritingCharacters load] profile load failed:", err?.message);
        }
        setWritingCharacterProfiles(normalizeWritingCharacterProfiles(null));
        setProfilesLoadStatus("error");
      });
    return () => { cancelled = true; };
  }, [selectedProject?.id, selectedProject?.name]);

  // ── Flush-read refs: always hold latest state for the flush handler ───────
  // Declared before import-signal logic so checkImportMarker can read flushProfilesRef.current.
  const flushProfilesRef = useRef(null);
  const flushProfilesLoadStatusRef = useRef("idle");
  // Track the highest profile count seen while loaded, as an empty-overwrite guard.
  const flushPeakProfileCountRef = useRef(0);

  useEffect(() => {
    flushProfilesRef.current = writingCharacterProfiles;
    flushProfilesLoadStatusRef.current = profilesLoadStatus;
    if (profilesLoadStatus === "loaded") {
      const count = Object.keys(writingCharacterProfiles?.profiles || {}).length;
      if (count > flushPeakProfileCountRef.current) {
        flushPeakProfileCountRef.current = count;
      }
    }
  }, [writingCharacterProfiles, profilesLoadStatus]);

  // ── Import-complete signal detection ─────────────────────────────────────
  // WritingScript writes writingScriptImportCompleted:<projectId> to localStorage
  // after a successful script import. This module reads that marker on mount and
  // on each visibility transition, and increments importTrigger if the marker
  // contains an importedAt timestamp that hasn't been consumed yet.
  //
  // The panel's importTrigger effect handles the actual modal opening and calls
  // handleImportSignalConsumed to persist the consumed metadata and clear the marker.
  const [importTrigger, setImportTrigger] = useState(0);

  // pendingImportMarkerRef holds the raw marker payload for the most recently
  // detected unconsumed import, so the panel can hand it back in onImportSignalConsumed.
  const pendingImportMarkerRef = useRef(null);

  const checkImportMarker = useCallback(() => {
    const projectId = selectedProject?.id;
    if (!projectId) return;
    const markerKey = `writingScriptImportCompleted:${projectId}`;
    let marker = null;
    try {
      const raw = localStorage.getItem(markerKey);
      marker = raw ? JSON.parse(raw) : null;
    } catch {}
    if (!marker || marker.source !== "writingScriptImport") return;
    if (!marker.importedAt || !marker.nodeCount || marker.nodeCount <= 0) return;
    if (marker.projectId !== projectId) return;

    // Check against persisted consumed metadata so we don't refire on reload.
    const consumed = flushProfilesRef.current?.consumedScriptImportSignals?.[projectId];
    if (consumed?.lastConsumedImportedAt === marker.importedAt) return;

    // New unconsumed import detected — park the payload and signal the panel.
    pendingImportMarkerRef.current = marker;
    setImportTrigger((n) => n + 1);
  }, [selectedProject?.id]);

  // Check on mount / project change.
  useEffect(() => { checkImportMarker(); }, [checkImportMarker]);
  // Also check on each visibility transition to the module.
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) checkImportMarker();
    // prevVisibleRef is updated in the draftNodes visibility effect.
  }, [isVisible, checkImportMarker]);

  // Called by the panel after it evaluates (and optionally opens) the modal for an import.
  // Reads the marker from pendingImportMarkerRef so the panel doesn't need to know about it.
  const handleImportSignalConsumed = useCallback(() => {
    const projectId = selectedProject?.id;
    const markerPayload = pendingImportMarkerRef.current;
    if (!projectId || !markerPayload?.importedAt) return;
    pendingImportMarkerRef.current = null;
    const markerKey = `writingScriptImportCompleted:${projectId}`;
    const consumedAt = new Date().toISOString();

    // Persist consumed metadata into profiles so it survives page reload.
    setWritingCharacterProfiles((prev) => {
      const next = {
        ...prev,
        consumedScriptImportSignals: {
          ...(prev.consumedScriptImportSignals || {}),
          [projectId]: {
            lastConsumedImportedAt: markerPayload.importedAt,
            lastConsumedNodeCount: markerPayload.nodeCount ?? 0,
            consumedAt,
          },
        },
        savedAt: consumedAt,
      };
      // Fire-and-forget save to persist the consumed marker.
      onProjectDirty?.("writingCharacters");
      saveWritingCharacterProfilesAsync(selectedProject, next).then((result) => {
        if (result?.storage === "database") onProjectSynced?.("writingCharacters");
      }).catch(() => {});
      return next;
    });

    // Remove the localStorage marker only after consumed metadata is staged.
    try { localStorage.removeItem(markerKey); } catch {}
  }, [selectedProject?.id, selectedProject?.name]);

  // Save Verification flush handler for "writingCharacters" has been moved to App.js
  // as an always-mounted proxy handler. It reads from Supabase directly and works
  // regardless of which workflow tab is active. The component-level registration
  // has been removed to avoid double-registration under the same key.

  // ── Derived data ──────────────────────────────────────────────────────────
  const extractedCharacters = useMemo(
    () => extractWritingCharacters(draftNodes, writingCharacterProfiles?.resolution || {}),
    [draftNodes, writingCharacterProfiles]
  );

  const sceneIdToIndex = useMemo(() => {
    const map = {};
    draftScenes.forEach((scene, idx) => {
      if (scene.id) map[scene.id] = idx;
      if (scene.sceneId && scene.sceneId !== scene.id) map[scene.sceneId] = idx;
    });
    let sceneIdx = 0;
    draftNodes.forEach((node) => {
      if (!node || node.type !== "Scene Heading") return;
      if (node.sceneId && !(node.sceneId in map)) map[node.sceneId] = sceneIdx;
      sceneIdx++;
    });
    return map;
  }, [draftScenes, draftNodes]);

  const nodeIndexPageMap = useMemo(() => {
    if (!draftNodes.length) return {};
    const pages = paginateScreenplayNodes(draftNodes);
    const map = {};
    pages.forEach((page, pageIdx) => {
      page.forEach((entry) => {
        if (entry.index != null && !(entry.index in map)) map[entry.index] = pageIdx + 1;
      });
    });
    return map;
  }, [draftNodes]);

  const hasScript = draftNodes.some(n =>
    n?.type === "Scene Heading" || String(n?.text || "").trim().length > 0
  );

  // ── Scene viewer popup ────────────────────────────────────────────────────
  const [sceneViewer, setSceneViewer] = useState(null);

  const handleViewScene = useCallback((sceneIndex, profileId) => {
    const ec = extractedCharacters.get(profileId);
    const prof = writingCharacterProfiles.profiles?.[profileId];
    const characterName = prof?.canonicalName || profileId;
    const sceneIndices = ec?.sceneIds
      ? Array.from(ec.sceneIds)
          .map((sid) => sceneIdToIndex[sid] ?? -1)
          .filter((idx) => idx >= 0)
          .sort((a, b) => a - b)
          .filter((v, i, arr) => arr.indexOf(v) === i)
      : [sceneIndex].filter((idx) => idx >= 0);
    const posIndex = Math.max(0, sceneIndices.indexOf(sceneIndex));
    setSceneViewer({ characterName, sceneIndices, posIndex });
  }, [extractedCharacters, writingCharacterProfiles, sceneIdToIndex]);

  // ── Profile handlers ──────────────────────────────────────────────────────
  const save = useCallback(async (next) => {
    setWritingCharacterProfiles(next);
    onProjectDirty?.("writingCharacters");
    try {
      const result = await saveWritingCharacterProfilesAsync(selectedProject, next);
      if (result?.storage === "database") {
        onProjectSynced?.("writingCharacters");
      }
    } catch {}
  }, [selectedProject, onProjectDirty, onProjectSynced]);

  const handleCreateCharacterProfiles = useCallback(async (normalizedKeys) => {
    const now = new Date().toISOString();
    const newProfiles = { ...writingCharacterProfiles.profiles };
    normalizedKeys.forEach((key) => {
      if (newProfiles[key]) return;
      const ec = extractedCharacters.get(key);
      if (!ec) return;
      newProfiles[key] = makeEmptyCharacterProfile(key, ec.displayName, {
        firstAppearanceSceneId: ec.firstAppearanceSceneId,
        firstAppearanceSceneHeading: ec.firstAppearanceSceneHeading,
        sceneIds: Array.from(ec.sceneIds),
        sceneCount: ec.sceneCount,
        createdAt: now, updatedAt: now,
      });
    });
    const nextIgnored = (writingCharacterProfiles.ignoredSuggestions || []).filter(k => !normalizedKeys.includes(k));
    save({ ...writingCharacterProfiles, profiles: newProfiles, ignoredSuggestions: nextIgnored, savedAt: now });
  }, [writingCharacterProfiles, extractedCharacters, save]);

  const handleIgnoreCharacterSuggestions = useCallback(async (normalizedKeys) => {
    save({
      ...writingCharacterProfiles,
      ignoredSuggestions: Array.from(new Set([...(writingCharacterProfiles.ignoredSuggestions || []), ...normalizedKeys])),
      savedAt: new Date().toISOString(),
    });
  }, [writingCharacterProfiles, save]);

  const handleUpdateCharacterProfile = useCallback(async (normalizedKey, patch) => {
    const existing = writingCharacterProfiles.profiles?.[normalizedKey];
    if (!existing) return;
    save({
      ...writingCharacterProfiles,
      profiles: { ...writingCharacterProfiles.profiles, [normalizedKey]: { ...existing, ...patch, updatedAt: new Date().toISOString() } },
      savedAt: new Date().toISOString(),
    });
  }, [writingCharacterProfiles, save]);

  const handleMergeCharacterProfiles = useCallback(async (sourceId, targetId) => {
    const src = writingCharacterProfiles.profiles?.[sourceId];
    const tgt = writingCharacterProfiles.profiles?.[targetId];
    if (!src || !tgt) return;
    const merged = {
      ...tgt,
      aliases: Array.from(new Set([...(tgt.aliases || []), src.canonicalName, ...(src.aliases || [])])),
      sceneIds: Array.from(new Set([...(tgt.sceneIds || []), ...(src.sceneIds || [])])),
      sceneCount: (tgt.sceneCount || 0) + (src.sceneCount || 0),
      mergeHistory: [...(tgt.mergeHistory || []), { sourceId, sourceCanonicalName: src.canonicalName, mergedAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    };
    const newProfiles = { ...writingCharacterProfiles.profiles, [targetId]: merged };
    delete newProfiles[sourceId];
    save({
      ...writingCharacterProfiles,
      profiles: newProfiles,
      resolution: { ...(writingCharacterProfiles.resolution || {}), [sourceId]: targetId },
      savedAt: new Date().toISOString(),
    });
  }, [writingCharacterProfiles, save]);

  const handleDeleteCharacterProfile = useCallback(async (profileId) => {
    const newProfiles = { ...writingCharacterProfiles.profiles };
    delete newProfiles[profileId];
    save({ ...writingCharacterProfiles, profiles: newProfiles, savedAt: new Date().toISOString() });
  }, [writingCharacterProfiles, save]);

  const handleSuppressSceneTag = useCallback(async (profileId, sceneId) => {
    const existing = writingCharacterProfiles.sceneSuppresssions || {};
    const current = existing[profileId] || [];
    if (current.includes(sceneId)) return;
    save({
      ...writingCharacterProfiles,
      sceneSuppresssions: { ...existing, [profileId]: [...current, sceneId] },
      savedAt: new Date().toISOString(),
    });
  }, [writingCharacterProfiles, save]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", boxSizing: "border-box", backgroundColor: "#f5f5f5", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}>
      {/* Module header */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ display: "flex", minHeight: "38px", alignItems: "center", padding: "5px 12px", gap: "8px", boxSizing: "border-box" }}>
          <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold" }}>CHARACTERS</h2>
          {(profilesLoadStatus === "loading" || draftLoadStatus === "loading") && (
            <span style={{ fontSize: "11px", color: "#bbb", fontWeight: "normal", letterSpacing: 0 }}>Loading…</span>
          )}
        </div>
      </div>

      {/* Main workspace */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        <WritingCharactersPanel
          profiles={writingCharacterProfiles}
          extractedNames={extractedCharacters}
          isViewOnly={isViewOnly}
          isProfilesLoading={
            (profilesLoadStatus === "loading" || draftLoadStatus === "loading") &&
            Object.keys(writingCharacterProfiles?.profiles || {}).length === 0 &&
            draftNodes.length === 0
          }
          onCreateProfiles={handleCreateCharacterProfiles}
          onIgnoreSuggestions={handleIgnoreCharacterSuggestions}
          onUpdateProfile={handleUpdateCharacterProfile}
          onRescan={() => {}}
          importTrigger={importTrigger}
          onImportSignalConsumed={handleImportSignalConsumed}
          onMergeProfiles={handleMergeCharacterProfiles}
          onDeleteProfile={handleDeleteCharacterProfile}
          onSuppressSceneTag={handleSuppressSceneTag}
          sceneSuppresssions={writingCharacterProfiles.sceneSuppresssions || {}}
          allNodes={draftNodes}
          scenes={draftScenes}
          sceneIdToIndex={sceneIdToIndex}
          nodeIndexPageMap={nodeIndexPageMap}
          hasScript={hasScript}
          // Scene clicks open the read-only popup — no live editor dependency.
          onNavigateToScene={handleViewScene}
          // No live editor highlight in standalone mode.
          onSetCharacterTagHighlights={null}
          onClearCharacterTagHighlights={null}
        />
      </div>

      {/* Read-only scene viewer popup */}
      {sceneViewer && (
        <WritingSceneViewerModal
          allNodes={draftNodes}
          characterSceneIndices={sceneViewer.sceneIndices}
          initialSceneIndexPos={sceneViewer.posIndex}
          scenes={draftScenes}
          characterName={sceneViewer.characterName}
          onClose={() => setSceneViewer(null)}
        />
      )}
    </div>
  );
}
