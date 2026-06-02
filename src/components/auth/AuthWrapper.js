import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabase";
import ProjectSelector from "../ProjectSelector";
import WorkflowTabs from "../workspace/WorkflowTabs";
import { evictOversizedDraftCache } from "../../utils/storageQuotaGuard";
import { useModuleFlush } from "../../contexts/ModuleFlushContext";
import { useModuleSyncBarrier } from "../../contexts/ModuleSyncBarrierContext";
import { ProjectModuleSyncProvider } from "../../contexts/ProjectModuleSyncContext";
import {
  writeEmergencyBackup,
  scanEmergencyBackupMarkers,
  retryEmergencyBackupToSupabase,
  markEmergencyBackupResolvedLocally,
} from "../../utils/emergencyBackupStore";
import {
  writeProjectLocalStorageMirrorToIndexedDB,
  createProjectCacheVersion,
  clearProjectLocalStorageMirror,
  hydrateProjectLocalStorageMirrorFromIndexedDB,
  CACHE_VERSION_REASONS,
  MIRROR_MODULE_KEY,
  CACHE_SOURCES,
} from "../../utils/projectCacheManager";
import {
  scanProjectRecoverySources,
  applyWritingDraftIdbSource,
  applyProjectCacheMirrorSource,
  applyProjectCacheVersionSource,
} from "../../utils/projectRecoveryScanner";
import ProjectRecoveryModal from "./ProjectRecoveryModal";
import SaveVerificationModal from "./SaveVerificationModal";
import LoadVerificationModal from "./LoadVerificationModal";
import {
  writeAllModuleSnapshots,
  insertProjectBackupManifest,
  insertProjectLoadAudit,
} from "../../utils/projectSupabaseBackupManager";
// saveVerificationModules.js roster kept for SaveVerificationModal display only.
// No longer used as the clean-exit gate — project_sync_status freshness check is the gate.

// Display Name Editor Component
function DisplayNameEditor({ user }) {
  const [displayName, setDisplayName] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    loadDisplayName();
  }, [user]);

  const loadDisplayName = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setDisplayName(data?.display_name || user.email);
    } catch (error) {
      console.error("Error loading display name:", error);
      setDisplayName(user.email);
    }
  };

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      alert("Display name cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id);

      if (error) throw error;
      setIsEditing(false);
    } catch (error) {
      alert("Error saving display name: " + error.message);
    }
    setLoading(false);
  };

  if (isEditing) {
    return (
      <span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") saveDisplayName();
            if (e.key === "Escape") setIsEditing(false);
          }}
          style={{
            padding: "4px 8px",
            fontSize: "14px",
            border: "1px solid white",
            borderRadius: "3px",
            backgroundColor: "transparent",
            color: "white",
            width: "150px",
          }}
          autoFocus
        />
        <button
          onClick={saveDisplayName}
          disabled={loading}
          style={{
            marginLeft: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Save
        </button>
        <button
          onClick={() => setIsEditing(false)}
          style={{
            marginLeft: "5px",
            padding: "4px 8px",
            fontSize: "12px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      style={{
        cursor: "pointer",
        textDecoration: "underline",
        textDecorationStyle: "dotted",
      }}
      title="Click to edit display name"
    >
      {displayName}
    </span>
  );
}

function AuthWrapper({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [modulePermissions, setModulePermissions] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState("writing");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // ─── Save and Return modal state ─────────────────────────────────────────────
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  // phases: "waiting" (barrier settle) | "saving" (flush handlers) | "done" | "failed"
  const [projectsModalPhase, setProjectsModalPhase] = useState("saving");
  const [projectsModalResults, setProjectsModalResults] = useState([]);
  const [projectsModalError, setProjectsModalError] = useState(null);
  const [projectsModalBarrierResults, setProjectsModalBarrierResults] = useState([]); // from awaitAllBarriersIdle
  const isSavingRef = useRef(false); // guard against double-click during active save

  // ─── Emergency backup banner state ───────────────────────────────────────────
  const [pendingEmergencyBackups, setPendingEmergencyBackups] = useState([]);
  const [showEmergencyDetailModal, setShowEmergencyDetailModal] = useState(false);
  // Per-item retry/resolve state: { [projectId]: { retrying, retryError, confirmingResolve } }
  const [emergencyItemState, setEmergencyItemState] = useState({});

  // ─── Project recovery gate state ─────────────────────────────────────────────
  // pendingProjectOpen holds { project, scanReport } while recovery modal is shown.
  // setSelectedProject must not be called until the user chooses a source or cancels.
  const [pendingProjectOpen, setPendingProjectOpen] = useState(null);

  // ─── Load Verification modal state ───────────────────────────────────────────
  // Shown after scan completes (or while scanning), before doOpenProject is called.
  // null = not shown; { project, scanReport, isScanning } = shown
  const [loadVerificationState, setLoadVerificationState] = useState(null);

  // ─── Recovery decision tracking ──────────────────────────────────────────────
  // Stores the user's explicit recovery source choice during project open.
  // Cleared when the project is closed or cancelled. After a clean Save/Return,
  // this is used to resolve emergency backups the user explicitly passed over.
  const recoveryDecisionRef = useRef(null);

  // ─── Project-level cloud sync freshness tracking ──────────────────────────────
  // These refs answer the exit question:
  //   "Has Supabase accepted a write after the latest local project change?"
  //
  // lastLocalDirtyAtRef — ISO timestamp set at the start of every module sync.
  // lastSuccessfulCloudSyncAtRef — ISO timestamp set after a successful Supabase
  //   write + project_sync_status touch. Comes from last_successful_sync_at.
  // lastSyncErrorRef — error info from the last failed sync, if any.
  //
  // All refs reset when selectedProject changes. No re-render on update.
  const lastLocalDirtyAtRef = useRef(null);
  const lastSuccessfulCloudSyncAtRef = useRef(null);
  const lastSyncErrorRef = useRef(null);

  // Reset when project changes. selectedProject from useState above.
  const trackedProjectIdRef = useRef(null);
  useEffect(() => {
    const newId = selectedProject?.id ?? null;
    if (trackedProjectIdRef.current !== newId) {
      trackedProjectIdRef.current = newId;
      lastLocalDirtyAtRef.current = null;
      lastSuccessfulCloudSyncAtRef.current = null;
      lastSyncErrorRef.current = null;
      if (process.env.NODE_ENV === "development" && newId) {
        console.info(`[ProjectSyncTracker] Reset for project ${newId}`);
      }
    }
  }, [selectedProject?.id]);

  // markProjectDirty — called at the start of every module Supabase write.
  const markProjectDirty = useCallback((source) => {
    const now = new Date().toISOString();
    lastLocalDirtyAtRef.current = now;
    if (process.env.NODE_ENV === "development") {
      console.info(`[ProjectSyncTracker] dirty source=${source} at ${now}`);
    }
  }, []);

  // markProjectSynced — called after a successful Supabase write + status touch.
  const markProjectSynced = useCallback((source, timestamp) => {
    const ts = timestamp ?? new Date().toISOString();
    lastSuccessfulCloudSyncAtRef.current = ts;
    lastSyncErrorRef.current = null;
    if (process.env.NODE_ENV === "development") {
      console.info(`[ProjectSyncTracker] synced source=${source} at ${ts}`);
    }
  }, []);

  // touchAndMark — touches project_sync_status then updates the in-memory marker.
  // Fire-and-forget; does not block the caller's sync wrapper.
  //
  // SAFETY: markProjectSynced is called ONLY if the RPC returned a row with a valid
  // last_successful_sync_at. We must NOT fall back to new Date().toISOString() here —
  // a local clock timestamp would falsely imply cloud marker success when the RPC
  // produced no row (e.g., RPC returned data=null for a first-time project), and would
  // cause the exit gate to treat the project as cloud-current when it is not.
  // touchAndMark — touches project_sync_status and returns a Promise that resolves
  // when the RPC completes (success or failure). Callers inside the barrier flush
  // path (wsFlushRecord, mbFlushRecord) await this so the marker is written to
  // Supabase before awaitAllBarriersIdle resolves and the exit gate reads the table.
  //
  // Fire-and-forget callers (normal runtime sync wrappers in App.js) may still call
  // without awaiting — the returned Promise is simply ignored in those cases.
  const touchAndMark = useCallback((source) => {
    const projectId = selectedProject?.id;
    if (!projectId) return Promise.resolve();
    return supabase.rpc("touch_project_sync_status", {
      p_project_id: projectId,
      p_sync_source: source ?? null,
    }).then(({ data, error }) => {
      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[ProjectSyncTracker] touch_project_sync_status failed source=${source}:`, error?.message);
        }
        // Do NOT call markProjectSynced — RPC failed, project_sync_status not updated.
        return;
      }
      const ts = data?.last_successful_sync_at ?? null;
      if (!ts) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[ProjectSyncTracker] touch_project_sync_status returned no timestamp, source=${source} — not marking synced`);
        }
        return;
      }
      markProjectSynced(source, ts);
    });
  }, [selectedProject?.id, markProjectSynced]);

  // ─── Flush registry access ───────────────────────────────────────────────────
  const { registerFlushHandler } = useModuleFlush();

  // ─── Sync barrier access ──────────────────────────────────────────────────────
  const { awaitAllBarriersIdle } = useModuleSyncBarrier();

  // ─── Scan for pending emergency backup markers on startup ────────────────────
  useEffect(() => {
    const markers = scanEmergencyBackupMarkers();
    setPendingEmergencyBackups(markers);
  }, []);

  // ─── Retry-on-reconnect skeleton ─────────────────────────────────────────────
  // TODO (future phase): when browser comes back online and pending emergency
  // backup markers exist, attempt to sync them to Supabase project_backups table.
  // For now this only logs the detection. Do not fake sync success.
  useEffect(() => {
    function handleOnline() {
      const markers = scanEmergencyBackupMarkers();
      if (markers.length > 0 && process.env.NODE_ENV === "development") {
        console.info(
          `[AuthWrapper] Browser online. ${markers.length} pending emergency backup(s) detected. ` +
          "Supabase retry not yet implemented — markers preserved."
        );
      }
      // TODO: call retryPendingBackups() once implemented in emergencyBackupStore.js
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // ─── commitProjectExit must be declared before handleSaveAndReturn ───────────
  const commitProjectExit = useCallback(() => {
    isSavingRef.current = false;
    setShowProjectsModal(false);
    setProjectsModalPhase("saving");
    setProjectsModalResults([]);
    setProjectsModalError(null);
    setProjectsModalBarrierResults([]);
    recoveryDecisionRef.current = null; // decision consumed or abandoned
    setSelectedProject(null);
  }, []);

  // ─── Foundational save verification flush handlers ────────────────────────────
  // Registered here (AuthWrapper) because only AuthWrapper has access to
  // selectedProject, userRole, and Supabase at the shell level.
  // These run during callAllFlushHandlers() inside handleSaveAndReturn.

  // projectMetadata — verifies selected project identity is valid for save paths.
  useEffect(() => {
    return registerFlushHandler("projectMetadata", "Project Metadata", async () => {
      const projectId = selectedProject?.id || null;
      const projectName = selectedProject?.name || null;
      const hasProjectId = Boolean(projectId);
      const hasProjectName = Boolean(projectName);

      const baseMetadata = {
        moduleKey: "projectMetadata",
        projectId,
        projectName,
        userRole: userRole || null,
        hasProjectId,
        hasProjectName,
      };

      if (!hasProjectId) {
        return {
          storage: "blocked",
          localOnly: true,
          blockedEmptySave: true,
          savePhase: "blocked",
          errorMessage: "Project Metadata verification failed: missing project ID.",
          message: "Project Metadata verification failed: missing project ID.",
          ...baseMetadata,
        };
      }

      return {
        storage: "database",
        localOnly: false,
        skipped: false,
        savePhase: "verified",
        message: `Project identity verified: "${projectName}" (${projectId})${userRole ? `, role: ${userRole}` : ""}.`,
        ...baseMetadata,
      };
    });
  }, [registerFlushHandler, selectedProject?.id, selectedProject?.name, userRole]);

  // projectSettings — reads projects.settings from Supabase and verifies shape.
  useEffect(() => {
    return registerFlushHandler("projectSettings", "Project Settings", async () => {
      const projectId = selectedProject?.id || null;

      const baseMetadata = {
        moduleKey: "projectSettings",
        projectId,
      };

      if (!projectId) {
        return {
          storage: "blocked",
          localOnly: true,
          blockedEmptySave: true,
          savePhase: "blocked",
          errorMessage: "Project Settings verification skipped: no project ID.",
          message: "Project Settings verification skipped: no project ID.",
          settingsKeyCount: 0,
          hasWritingCharacterProfiles: false,
          writingCharacterProfileCount: 0,
          hasWritingScriptDraft: false,
          writingScriptNodeCount: 0,
          ...baseMetadata,
        };
      }

      try {
        const { data, error } = await supabase
          .from("projects")
          .select("settings")
          .eq("id", projectId)
          .single();

        if (error) throw error;

        const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
        const settingsKeyCount = Object.keys(settings).length;

        const wcProfiles = settings.writingCharacterProfiles;
        const hasWritingCharacterProfiles = Boolean(wcProfiles && typeof wcProfiles === "object");
        const writingCharacterProfileCount = hasWritingCharacterProfiles
          ? Object.keys(wcProfiles?.profiles || {}).length
          : 0;

        const wsDraft = settings.writingScriptDraft;
        const hasWritingScriptDraft = Boolean(wsDraft && typeof wsDraft === "object");
        const writingScriptNodeCount = hasWritingScriptDraft
          ? (Array.isArray(wsDraft?.nodes) ? wsDraft.nodes.length : 0)
          : 0;

        return {
          storage: "database",
          localOnly: false,
          skipped: false,
          savePhase: "verified",
          settingsKeyCount,
          hasWritingCharacterProfiles,
          writingCharacterProfileCount,
          hasWritingScriptDraft,
          writingScriptNodeCount,
          message: `Settings verified: ${settingsKeyCount} key(s). WC profiles: ${writingCharacterProfileCount}. WS nodes: ${writingScriptNodeCount}.`,
          ...baseMetadata,
        };
      } catch (err) {
        return {
          storage: "local",
          localOnly: true,
          savePhase: "failed",
          settingsKeyCount: 0,
          hasWritingCharacterProfiles: false,
          writingCharacterProfileCount: 0,
          hasWritingScriptDraft: false,
          writingScriptNodeCount: 0,
          errorMessage: `Project Settings read failed: ${err?.message || "unknown error"}`,
          message: `Project Settings read failed: ${err?.message || "unknown error"}`,
          ...baseMetadata,
        };
      }
    });
  }, [registerFlushHandler, selectedProject?.id]);

  // supabaseVerification — spot-checks registered modules in Supabase after flush.
  useEffect(() => {
    return registerFlushHandler("supabaseVerification", "Supabase Backup Verification", async () => {
      const projectId = selectedProject?.id || null;

      const baseMetadata = {
        moduleKey: "supabaseVerification",
        projectId,
      };

      if (!projectId) {
        return {
          storage: "blocked",
          localOnly: true,
          blockedEmptySave: true,
          savePhase: "blocked",
          errorMessage: "Supabase Backup Verification skipped: no project ID.",
          message: "Supabase Backup Verification skipped: no project ID.",
          writingScriptVerified: false,
          moodBoardVerified: false,
          writingCharactersVerified: false,
          settingsVerified: false,
          ...baseMetadata,
        };
      }

      try {
        // Single query: grab projects row (settings) and moodboard row in parallel.
        const [projectRes, moodRes] = await Promise.all([
          supabase.from("projects").select("settings").eq("id", projectId).single(),
          supabase.from("moodboard_data").select("boards, images, canvas_items, links").eq("project_id", projectId).maybeSingle(),
        ]);

        const projectErr = projectRes.error;
        const moodErr = moodRes.error;

        // Settings / Writing Characters
        const settings = (!projectErr && projectRes.data?.settings && typeof projectRes.data.settings === "object")
          ? projectRes.data.settings
          : null;
        const settingsVerified = settings !== null;

        const wcProfiles = settings?.writingCharacterProfiles;
        const writingCharacterProfileCount = wcProfiles?.profiles
          ? Object.keys(wcProfiles.profiles).length
          : 0;
        const writingCharactersVerified = settingsVerified;

        // Writing Script — stored in settings.writingScriptDraft
        const wsDraft = settings?.writingScriptDraft;
        const writingScriptNodeCount = Array.isArray(wsDraft?.nodes) ? wsDraft.nodes.length : 0;
        const writingScriptVerified = settingsVerified;

        // MoodBoard
        const moodRow = !moodErr ? moodRes.data : null;
        const moodBoardVerified = moodRow !== undefined; // null = no row yet (new project), that's ok
        const moodBoardBoardCount = Array.isArray(moodRow?.boards) ? moodRow.boards.length : 0;
        const moodBoardImageCount = Array.isArray(moodRow?.images) ? moodRow.images.length : 0;

        const failedChecks = [];
        if (projectErr) failedChecks.push(`settings read failed: ${projectErr.message}`);
        if (moodErr) failedChecks.push(`moodboard read failed: ${moodErr.message}`);

        if (failedChecks.length > 0) {
          return {
            storage: "local",
            localOnly: true,
            savePhase: "failed",
            writingScriptVerified: false,
            writingScriptNodeCount,
            moodBoardVerified: false,
            moodBoardBoardCount,
            moodBoardImageCount,
            writingCharactersVerified: false,
            writingCharacterProfileCount,
            settingsVerified: false,
            errorMessage: `Supabase verification failed: ${failedChecks.join("; ")}`,
            message: `Supabase verification failed: ${failedChecks.join("; ")}`,
            ...baseMetadata,
          };
        }

        return {
          storage: "database",
          localOnly: false,
          skipped: false,
          savePhase: "verified",
          writingScriptVerified,
          writingScriptNodeCount,
          moodBoardVerified,
          moodBoardBoardCount,
          moodBoardImageCount,
          writingCharactersVerified,
          writingCharacterProfileCount,
          settingsVerified,
          message: `Supabase verified: WS ${writingScriptNodeCount} nodes, MB ${moodBoardBoardCount} board(s)/${moodBoardImageCount} image(s), WC ${writingCharacterProfileCount} profile(s), settings ok.`,
          ...baseMetadata,
        };
      } catch (err) {
        return {
          storage: "local",
          localOnly: true,
          savePhase: "failed",
          writingScriptVerified: false,
          writingScriptNodeCount: 0,
          moodBoardVerified: false,
          moodBoardBoardCount: 0,
          moodBoardImageCount: 0,
          writingCharactersVerified: false,
          writingCharacterProfileCount: 0,
          settingsVerified: false,
          errorMessage: `Supabase verification threw: ${err?.message || "unknown error"}`,
          message: `Supabase verification threw: ${err?.message || "unknown error"}`,
          ...baseMetadata,
        };
      }
    });
  }, [registerFlushHandler, selectedProject?.id]);

  // ─── Core project open — shared by direct open and recovery modal choice ──────
  // applySourceFn: optional async fn to call before setSelectedProject (writes the
  // chosen source markers to localStorage). Null means use existing hydration path.
  const doOpenProject = useCallback(async (project, applySourceFn) => {
    const incomingId = project?.id || project?.name;

    if (applySourceFn) {
      // Recovery modal chose a specific source — apply it instead of plain hydration.
      try {
        const ok = await applySourceFn();
        if (process.env.NODE_ENV === "development") {
          console.info(`[AuthWrapper] Recovery source applied for ${incomingId}: ${ok ? "ok" : "failed (continuing anyway)"}`);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[AuthWrapper] Recovery source apply threw for ${incomingId}:`, err?.message);
        }
      }
    } else {
      // Default path: hydrate localStorage mirror from ProjectCache before mounting.
      if (incomingId) {
        try {
          const hydrateResult = await hydrateProjectLocalStorageMirrorFromIndexedDB(incomingId);
          if (process.env.NODE_ENV === "development") {
            if (hydrateResult) {
              console.info(
                `[AuthWrapper] Project open hydration for ${incomingId}: ` +
                `restored ${hydrateResult.restored}, skipped ${hydrateResult.skipped}`
              );
            } else {
              console.info(`[AuthWrapper] Project open hydration for ${incomingId}: no mirror record found, continuing normally`);
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[AuthWrapper] Project open hydration failed for ${incomingId}:`, err?.message);
          }
        }
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.info(`[AuthWrapper] setSelectedProject called for project ${incomingId}`);
    }
    setSelectedProject(project);
    setUserRole(project.userRole || "owner");
    setModulePermissions(project.modulePermissions || null);
  }, []);

  // ─── Save and Return handler ───────────────────────────────────────────────────
  //
  // Exit gate — not a save engine. The core question:
  //   "Has Supabase accepted a write after the latest local project change?"
  //
  //   Phase 1 — Barrier wait
  //     Wait for pending Writing Script / MoodBoard debounce timers to flush.
  //     This ensures lastSuccessfulCloudSyncAtRef is updated before we compare.
  //
  //   Phase 2 — Cloud sync freshness check
  //     Compare lastSuccessfulCloudSyncAtRef vs lastLocalDirtyAtRef.
  //     Also confirm no syncLocks are active (all immediate-sync modules settled).
  //     Fetch project_sync_status from Supabase as the authoritative check.
  //
  //   Phase 3 — Infrastructure (fire-and-forget, never gates Return)
  //     A. Write IDB localStorage mirror checkpoint.
  //     B. Clear current-project localStorage (ONLY on clean exit).
  //     C. Resolve bypassed emergency backups.
  //
  const handleSaveAndReturn = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setShowProjectsModal(true);
    setProjectsModalPhase("waiting");
    setProjectsModalError(null);
    setProjectsModalResults([]);
    setProjectsModalBarrierResults([]);

    // ── Phase 1: wait for debounced saves (Writing Script, MoodBoard) to flush ─
    let barrierResults = [];
    try {
      barrierResults = await awaitAllBarriersIdle();
      setProjectsModalBarrierResults(barrierResults);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[AuthWrapper] awaitAllBarriersIdle threw:", err?.message);
      }
    }

    setProjectsModalPhase("saving");

    // ── Phase 2: Cloud sync freshness check ───────────────────────────────────
    const projectId = selectedProject?.id || selectedProject?.name;
    const lastDirty = lastLocalDirtyAtRef.current;
    const syncError = lastSyncErrorRef.current;

    // Check barriers for WS/MB offline/timeout.
    const barrierHasOffline = barrierResults.some((r) => r.offlineQueued || r.localOnly);
    const barrierHasTimeout = barrierResults.some((r) => r.timedOut);
    const barrierFailed = barrierHasOffline || barrierHasTimeout;

    // Fetch project_sync_status as the authoritative cloud sync timestamp.
    //
    // SAFETY: If the Supabase read fails, we treat supabaseSyncAt as null rather
    // than falling back to the in-memory lastSynced. lastSynced is only set by
    // touchAndMark after a confirmed RPC response — but if we cannot verify the
    // database record right now, we should not trust a stale in-memory copy to
    // unlock localStorage clearing. The exit will fail safely to the emergency
    // backup path in that case.
    let supabaseSyncAt = null;
    try {
      const { data, error } = await supabase
        .from("project_sync_status")
        .select("last_successful_sync_at")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      supabaseSyncAt = data?.last_successful_sync_at ?? null;
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[AuthWrapper] project_sync_status read failed — treating as no cloud timestamp");
      }
    }

    // Use the Supabase-authoritative timestamp only. In-memory lastSynced is used
    // purely for logging; it does not gate localStorage clearing.
    const effectiveSyncAt = supabaseSyncAt;

    // No local dirty event recorded this session → project was opened but not edited.
    const noDirtyThisSession = !lastDirty;

    // Cloud sync is current if Supabase has a sync record after the last local dirty.
    const cloudCurrent = noDirtyThisSession ||
      (effectiveSyncAt && new Date(effectiveSyncAt).getTime() >= new Date(lastDirty).getTime());

    const isCleanDatabaseSuccess = cloudCurrent && !barrierFailed && !syncError;

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[AuthWrapper] exit check — lastDirty=${lastDirty}, effectiveSyncAt=${effectiveSyncAt}, ` +
        `cloudCurrent=${cloudCurrent}, barrierFailed=${barrierFailed}, ` +
        `syncError=${syncError?.message}, clean=${isCleanDatabaseSuccess}`
      );
    }

    if (!isCleanDatabaseSuccess && selectedProject) {
      const exitDiagnostic = {
        lastDirty,
        effectiveSyncAt,
        cloudCurrent,
        barrierFailed,
        syncError: syncError?.message ?? null,
      };

      const backupId = await writeEmergencyBackup({
        projectId: selectedProject.id || selectedProject.name,
        projectName: selectedProject.name,
        flushResults: [exitDiagnostic],
      });

      if (backupId === null) {
        isSavingRef.current = false;
        setProjectsModalPhase("failed");
        setProjectsModalError(
          "The cloud save did not complete and the local emergency backup could not be written. " +
          "Your work may be unsaved. Click Cancel to stay and retry, or close the browser tab to preserve IndexedDB data."
        );
        return;
      }

      setPendingEmergencyBackups(scanEmergencyBackupMarkers());
      isSavingRef.current = false;
      setProjectsModalPhase("done");
      setProjectsModalResults([exitDiagnostic]);
      return;
    }

    // ── Cloud sync verified — safe to flush localStorage and return ───────────
    const savedByUserId = user?.id ?? null;
    const savedByEmail = user?.email ?? null;
    const timestamp = new Date().toISOString();

    // ── Step A: Write IDB localStorage mirror ─────────────────────────────────
    // Capture the current-project working mirror into IndexedDB before clearing it.
    // This is a cache checkpoint — its failure is informational, not a Return gate.
    let localRecoveryResult = {
      key: "localRecovery",
      label: "Local Recovery / IndexedDB",
      status: "skipped",
      storage: "indexedDB",
      localOnly: false,
      skipped: true,
      errorMessage: null,
      moduleKey: "localRecovery",
      savePhase: "skipped",
      capturedKeyCount: 0,
      currentCacheWritten: false,
      versionCheckpointCreated: false,
      versionId: null,
      reason: CACHE_VERSION_REASONS.SAVE_RETURN,
      message: "No project ID — local recovery skipped.",
      timestamp,
    };

    if (projectId) {
      const { success: mirrorWriteOk, mirrorPayload, keyCount } =
        await writeProjectLocalStorageMirrorToIndexedDB(projectId, CACHE_VERSION_REASONS.SAVE_RETURN);

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[AuthWrapper | System1 exit] IDB mirror write for project ${projectId}: ` +
          `${mirrorWriteOk ? "OK" : "FAILED"}, ${keyCount} key(s) captured`
        );
      }

      if (mirrorWriteOk) {
        // Fire-and-forget version checkpoint — failure must not block the exit.
        createProjectCacheVersion(
          projectId,
          MIRROR_MODULE_KEY,
          mirrorPayload,
          CACHE_VERSION_REASONS.SAVE_RETURN,
          { source: CACHE_SOURCES.LOCALSTORAGE_MIRROR }
        ).then(() => {
          if (process.env.NODE_ENV === "development") {
            console.info(`[AuthWrapper | System1 exit] Mirror version checkpoint created`);
          }
        }).catch(() => {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[AuthWrapper | System1 exit] Mirror version checkpoint failed — current cache is intact`);
          }
        });

        localRecoveryResult = {
          key: "localRecovery",
          label: "Local Recovery / IndexedDB",
          status: "success",
          storage: "indexedDB",
          localOnly: false,
          skipped: false,
          errorMessage: null,
          moduleKey: "localRecovery",
          savePhase: "verified",
          capturedKeyCount: keyCount,
          currentCacheWritten: true,
          versionCheckpointCreated: false,
          versionId: null,
          reason: CACHE_VERSION_REASONS.SAVE_RETURN,
          message: `IDB mirror written: ${keyCount} key(s) captured.`,
          timestamp,
        };
      } else {
        // IDB mirror write failed — informational only. Supabase is still clean.
        // localStorage will still be cleared below (Supabase verified clean).
        // The cache checkpoint was not captured; emergency backup already exists if relevant.
        localRecoveryResult = {
          key: "localRecovery",
          label: "Local Recovery / IndexedDB",
          status: "local",
          storage: "indexedDB",
          localOnly: true,
          skipped: false,
          moduleKey: "localRecovery",
          savePhase: "failed",
          capturedKeyCount: keyCount,
          currentCacheWritten: false,
          versionCheckpointCreated: false,
          versionId: null,
          reason: CACHE_VERSION_REASONS.SAVE_RETURN,
          errorMessage: "IDB mirror write failed — cache checkpoint not captured. Supabase data is verified clean.",
          message: "IDB mirror write failed — cache checkpoint not captured.",
          timestamp,
        };
        if (process.env.NODE_ENV === "development") {
          console.warn(`[AuthWrapper | System1 exit] IDB mirror write failed for project ${projectId} — Supabase clean, continuing with exit`);
        }
      }
    }

    // ── Step B: Clear current-project localStorage working mirror ─────────────
    // Gated ONLY on Supabase DB exit verification (isCleanDatabaseSuccess above).
    // IDB mirror write success/failure does NOT gate this step.
    if (projectId) {
      const { removed } = clearProjectLocalStorageMirror(projectId);
      if (process.env.NODE_ENV === "development") {
        console.info(`[AuthWrapper | System1 exit] Cleared ${removed} project-scoped localStorage key(s) for project ${projectId}`);
      }
    }

    // ── Step C: Backup snapshots + manifest (fire-and-forget infrastructure) ──
    // This is System 2 infrastructure — NOT a gate for Return or localStorage clear.
    const allResultsForSnapshot = [localRecoveryResult];
    const snapshotProjectId = selectedProject?.id ?? null;
    const snapshotProjectName = selectedProject?.name ?? null;

    let supabaseVerResult = {
      key: "supabaseVerification",
      label: "Supabase Backup Verification",
      status: "skipped",
      storage: "database",
      localOnly: false,
      skipped: true,
      errorMessage: null,
      moduleKey: "supabaseVerification",
      savePhase: "skipped",
      message: "No project ID — backup snapshot skipped.",
      timestamp,
    };

    if (snapshotProjectId) {
      try {
        const snapshotResult = await writeAllModuleSnapshots({
          flushResults: allResultsForSnapshot, // infrastructure rows only
          projectId: snapshotProjectId,
          projectName: snapshotProjectName,
          savedByUserId,
          savedByEmail,
          versionReason: "save_return",
        });
        const snapshotSuccesses = snapshotResult.successes;
        const snapshotFailures = snapshotResult.failures;
        const snapshotSkipped = snapshotResult.skippedSnapshots ?? [];

        const overallStatus = snapshotFailures.length > 0 ? "partial" : "complete";
        const modulesMap = {};
        allResultsForSnapshot.forEach((r) => {
          if (r?.key) modulesMap[r.key] = { status: r.status, savePhase: r.savePhase, storage: r.storage };
        });
        snapshotSkipped.forEach(({ moduleKey, reason }) => {
          if (modulesMap[moduleKey]) modulesMap[moduleKey].snapshotSkipped = reason;
          else modulesMap[moduleKey] = { snapshotSkipped: reason };
        });

        let manifestId = null;
        let manifestError = null;
        try {
          const manifestResult = await insertProjectBackupManifest({
            projectId: snapshotProjectId,
            projectName: snapshotProjectName,
            savedByUserId,
            savedByEmail,
            overallStatus,
            complete: snapshotFailures.length === 0,
            modules: modulesMap,
            failedModules: snapshotFailures.map((f) => ({ moduleKey: f.moduleKey, error: f.error })),
            warnings: [
              ...snapshotFailures.map((f) => `Snapshot failed for ${f.moduleKey}: ${f.error}`),
              ...snapshotSkipped.map(({ moduleKey, reason }) => `Snapshot skipped for ${moduleKey}: ${reason}`),
            ],
            warningCount: snapshotFailures.length + snapshotSkipped.length,
            localRecoveryStatus: localRecoveryResult.savePhase ?? null,
            supabaseVerificationStatus: overallStatus,
          });
          manifestId = manifestResult.manifestId;
        } catch (manifestErr) {
          manifestError = manifestErr?.message ?? "unknown";
        }

        const snapshotWriteError = snapshotFailures.length > 0
          ? `Snapshot write failed for: ${snapshotFailures.map((f) => f.moduleKey).join(", ")}`
          : null;

        supabaseVerResult = {
          key: "supabaseVerification",
          label: "Supabase Backup Verification",
          status: snapshotWriteError || manifestError ? "local" : "success",
          storage: "database",
          localOnly: !!(snapshotWriteError || manifestError),
          skipped: false,
          errorMessage: snapshotWriteError ?? manifestError ?? null,
          moduleKey: "supabaseVerification",
          savePhase: snapshotWriteError || manifestError ? "failed" : "verified",
          snapshotsWritten: snapshotSuccesses.length,
          snapshotsSkipped: snapshotSkipped.length,
          manifestInserted: manifestId !== null,
          manifestId,
          snapshotWriteError,
          manifestError,
          writeMode: "latest:upsert, versions:insert, manifest:insert",
          message: snapshotWriteError || manifestError
            ? `Backup infrastructure write partial: ${snapshotWriteError ?? manifestError}. Supabase module data is still verified clean.`
            : `Backup snapshots written: ${snapshotSuccesses.length} module(s). Manifest: ${manifestId ?? "n/a"}.`,
          timestamp,
        };
      } catch (err) {
        supabaseVerResult = {
          key: "supabaseVerification",
          label: "Supabase Backup Verification",
          status: "local",
          storage: "database",
          localOnly: true,
          skipped: false,
          errorMessage: `Backup snapshot write threw: ${err?.message ?? "unknown"}. Supabase module data is still verified clean.`,
          moduleKey: "supabaseVerification",
          savePhase: "failed",
          snapshotsWritten: 0,
          manifestInserted: false,
          message: `Backup snapshot write threw: ${err?.message ?? "unknown"}.`,
          timestamp,
        };
      }
    }

    if (process.env.NODE_ENV === "development" && supabaseVerResult.localOnly) {
      console.warn(`[AuthWrapper | System2 infrastructure] Backup snapshot/manifest write failed — informational only, exit is clean`);
    }

    // ── Step D: Resolve bypassed emergency backups if user chose Supabase on open ─
    // Fire-and-forget — only runs after full System 1 clean exit.
    const decision = recoveryDecisionRef.current;
    if (
      decision &&
      decision.selectedSourceType === "supabase" &&
      decision.projectId === projectId &&
      Array.isArray(decision.unresolvedEmergencyBackupIdsAtChoice) &&
      decision.unresolvedEmergencyBackupIdsAtChoice.length > 0
    ) {
      Promise.all(
        decision.unresolvedEmergencyBackupIdsAtChoice.map((backupId) =>
          markEmergencyBackupResolvedLocally(projectId, backupId).catch(() => {})
        )
      ).then(() => {
        setPendingEmergencyBackups(scanEmergencyBackupMarkers());
        if (process.env.NODE_ENV === "development") {
          console.info(`[AuthWrapper | System2 infrastructure] Resolved bypassed emergency backups for project ${projectId}`);
        }
      });
      recoveryDecisionRef.current = null;
    }

    // ── Step E: Clear any stale exit-attempt emergency backup for this project ──
    // If a previous exit attempt for this project created an emergency backup marker
    // (e.g. a failed first attempt before this successful retry), resolve it now that
    // cloud sync is verified clean. This prevents a stale "local-only backup" warning
    // from persisting in the banner after a successful retry.
    // markEmergencyBackupResolvedLocally only clears the localStorage marker and marks
    // the IDB record as dismissed-local — it does NOT delete recovery data.
    markEmergencyBackupResolvedLocally(projectId).then(() => {
      setPendingEmergencyBackups(scanEmergencyBackupMarkers());
    }).catch(() => {});

    // ── Return to Project Selector automatically on clean exit ────────────────
    // Cloud sync freshness verified. IDB mirror written. localStorage cleared.
    // No user click required — commitProjectExit resets all modal state and
    // returns to the Project Selector immediately.
    commitProjectExit();
  }, [awaitAllBarriersIdle, selectedProject, user, commitProjectExit,
      lastLocalDirtyAtRef, lastSuccessfulCloudSyncAtRef, lastSyncErrorRef]);

  useEffect(() => {
    // Listen for auth changes first so no state change is missed while we await
    // the storage migration below.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Migrate oversized draft cache to IndexedDB first so the Supabase auth
    // token has room to write/read from localStorage, then read the session.
    (async () => {
      await evictOversizedDraftCache();
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });
        if (error) throw error;
        // Save display name if provided
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (data?.user && fullName) {
          await supabase.from("users").update({
            display_name: fullName
          }).eq("id", data.user.id);
        }
      }
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: "18px", color: "#666" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "40px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "400px",
            fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
          }}
        >
          <h2
            style={{ textAlign: "center", marginBottom: "30px", color: "#333" }}
          >
            Film Production Manager
          </h2>

          <form onSubmit={handleAuth}>
          {!isLogin && (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
              </>
            )}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    paddingRight: "45px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: "#ffebee",
                  color: "#c62828",
                  padding: "12px",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                backgroundColor: isLogin ? "#2196F3" : "#f44336",
                color: "white",
                padding: "12px",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                marginBottom: "15px",
              }}
            >
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setFirstName(""); setLastName(""); setError(""); }}
                style={{
                  backgroundColor: "transparent",
                  color: "#2196F3",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  textDecoration: "underline",
                }}
              >
                {isLogin
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const TeamManagementModal = () => {
    const [teamMembers, setTeamMembers] = useState([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("crew");

    useEffect(() => {
      const handleEsc = (e) => {
        if (e.key === "Escape") setShowTeamModal(false);
      };
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }, []);
    const [inviteCustomModules, setInviteCustomModules] = useState([]);
    const [expandedCustomMember, setExpandedCustomMember] = useState(null);
    const [emailSuggestions, setEmailSuggestions] = useState([]);

    const ALL_MODULES_LIST = [
      "Script Breakdown", "Stripboard", "StripboardSchedule", "Calendar", "Day Out of Days",
      "Cast & Crew", "Characters", "Locations", "CallSheet", "ShotList", "ToDoList",
      "Timeline", "Props", "Makeup", "Production Design", "Wardrobe",
      "Cost Report", "Reports", "Budget",
    ];

    const ROLE_LABELS = {
      owner: { label: "Owner", color: "#4CAF50" },
      producer: { label: "Producer", color: "#9C27B0" },
      line_producer: { label: "Line Producer", color: "#673AB7" },
      department_head: { label: "Dept. Head", color: "#1976D2" },
      crew: { label: "Crew", color: "#F57C00" },
      custom: { label: "Custom", color: "#607D8B" },
    };
    const [loading, setLoading] = useState(false);
    const [inviteError, setInviteError] = useState("");

    useEffect(() => {
      if (showTeamModal && selectedProject) {
        loadTeamMembers();
      }
    }, [showTeamModal, selectedProject]);

    const loadTeamMembers = async () => {
      try {
        // Get project members
        const { data: members, error: membersError } = await supabase
          .from("project_members")
          .select("id, user_id, role, module_permissions, created_at")
          .eq("project_id", selectedProject.id);

        if (membersError) throw membersError;

        if (!members || members.length === 0) {
          setTeamMembers([]);
          return;
        }

        // Get user emails for each member
        const memberIds = members.map((m) => m.user_id);
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id, email")
          .in("id", memberIds);

        if (usersError) throw usersError;

        // Combine the data
        const membersWithEmails = members.map((member) => ({
          ...member,
          email: users.find((u) => u.id === member.user_id)?.email || "Unknown",
        }));

        console.log("Team members loaded:", membersWithEmails);
        setTeamMembers(membersWithEmails);
      } catch (error) {
        console.error("Error loading team members:", error);
        setTeamMembers([]);
      }
    };

    const inviteUser = async (e) => {
      e.preventDefault();
      setInviteError("");
      setLoading(true);

      try {
        // Look up user by email
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("email", inviteEmail.toLowerCase().trim())
          .single();

        if (userError || !userData) {
          setInviteError("No user found with that email address");
          setLoading(false);
          return;
        }

        // Check if already a member
        const { data: existingMember } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", selectedProject.id)
          .eq("user_id", userData.id)
          .single();

        if (existingMember) {
          setInviteError("User is already a team member");
          setLoading(false);
          return;
        }

        // Add to project_members
        const { error: insertError } = await supabase
          .from("project_members")
          .insert([
            {
              project_id: selectedProject.id,
              user_id: userData.id,
              role: inviteRole,
              module_permissions: inviteRole === "custom" ? inviteCustomModules : null,
            },
          ]);

        if (insertError) throw insertError;

        setInviteEmail("");
        setInviteRole("crew");
        loadTeamMembers();
        alert(`User invited successfully as ${inviteRole}!`);
      } catch (error) {
        setInviteError(error.message);
      }
      setLoading(false);
    };

    const removeMember = async (memberId) => {
      if (!confirm("Remove this team member?")) return;

      try {
        const { error } = await supabase
          .from("project_members")
          .delete()
          .eq("id", memberId);

        if (error) throw error;
        loadTeamMembers();
      } catch (error) {
        alert("Error removing team member: " + error.message);
      }
    };

    const changeRole = async (memberId, newRole, modulePerms = null) => {
      try {
        const { error } = await supabase
          .from("project_members")
          .update({
            role: newRole,
            module_permissions: newRole === "custom" ? modulePerms : null,
          })
          .eq("id", memberId);

        if (error) throw error;
        loadTeamMembers();
      } catch (error) {
        alert("Error changing role: " + error.message);
      }
    };

    if (!showTeamModal) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10001,
        }}
        onClick={() => setShowTeamModal(false)}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "8px",
            width: "600px",
            maxHeight: "80vh",
            overflow: "auto",
            fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0 }}>Team Management</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Project: <strong>{selectedProject.name}</strong>
          </p>
          {/* Current Team Members */}
          <div style={{ marginBottom: "30px" }}>
            <h3>Team Members</h3>
            <div style={{ fontSize: "14px" }}>
              <div
                style={{
                  backgroundColor: "#f0f0f0",
                  padding: "10px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{user.email}</strong>
                  <span
                    style={{
                      marginLeft: "10px",
                      padding: "2px 8px",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                  >
                    OWNER (YOU)
                  </span>
                </div>
              </div>

              {teamMembers.map((member) => {
                const roleMeta = ROLE_LABELS[member.role] || ROLE_LABELS["crew"];
                const isCustomExpanded = expandedCustomMember === member.id;
                const currentCustomModules = member.module_permissions || [];
                return (
                  <div key={member.id} style={{ backgroundColor: "#f9f9f9", padding: "10px", marginBottom: "5px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* ✕ remove button left-aligned, small */}
                      <button
                        onClick={() => removeMember(member.id)}
                        title="Remove member"
                        style={{ background: "none", border: "none", color: "#f44336", fontSize: "14px", fontWeight: "bold", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                      {/* Name / email */}
                      <strong style={{ flex: 1, fontSize: "13px" }}>{member.email || "Unknown"}</strong>
                      {/* Role dropdown right-justified */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                        <select
                          value={member.role}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setExpandedCustomMember(member.id);
                              changeRole(member.id, "custom", currentCustomModules);
                            } else {
                              setExpandedCustomMember(null);
                              changeRole(member.id, e.target.value);
                            }
                          }}
                          style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", backgroundColor: roleMeta.color, color: "white", border: "none", cursor: "pointer" }}
                        >
                          <option value="owner">Owner</option>
                          <option value="producer">Producer</option>
                          <option value="line_producer">Line Producer</option>
                          <option value="department_head">Dept. Head</option>
                          <option value="crew">Crew</option>
                          <option value="custom">Custom</option>
                        </select>
                        {member.role === "custom" && (
                          <button onClick={() => setExpandedCustomMember(isCustomExpanded ? null : member.id)}
                            style={{ fontSize: "10px", padding: "2px 8px", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", backgroundColor: "white" }}>
                            {isCustomExpanded ? "▲" : "▼"}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Custom module picker */}
                    {member.role === "custom" && isCustomExpanded && (
                      <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Module Access</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                          {ALL_MODULES_LIST.map(mod => {
                            const legacyModule = mod === "Script Breakdown" ? "Script" : null;
                            const checked = currentCustomModules.includes(mod) || (legacyModule && currentCustomModules.includes(legacyModule));
                            return (
                              <label key={mod} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: checked ? "#e3f2fd" : "white", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${checked ? "#90caf9" : "#ddd"}` }}>
                                <input type="checkbox" checked={checked}
                                  onChange={(e) => {
                                    const updated = e.target.checked
                                      ? [...currentCustomModules, mod]
                                      : currentCustomModules.filter(m => m !== mod && m !== legacyModule);
                                    changeRole(member.id, "custom", updated);
                                  }}
                                  style={{ cursor: "pointer" }} />
                                {mod}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {teamMembers.length === 0 && (
                <p style={{ color: "#999", fontStyle: "italic" }}>
                  No team members yet. Invite someone below!
                </p>
              )}
            </div>
          </div>
          {/* Invite Form */}
          <div>
            <h3>Invite New Member</h3>
            <form onSubmit={inviteUser}>
            <div style={{ marginBottom: "15px", position: "relative" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>
                  Email Address
                </label>
                <input
                  type="text"
                  value={inviteEmail}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setInviteEmail(val);
                    if (val.length < 2) { setEmailSuggestions([]); return; }
                    const { data } = await supabase
                      .from("users")
                      .select("id, email, display_name")
                      .ilike("email", `%${val}%`)
                      .limit(6);
                    setEmailSuggestions(data || []);
                  }}
                  required
                  placeholder="Search by email..."
                  style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }}
                />
                {emailSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", backgroundColor: "white", border: "1px solid #ddd", borderRadius: "4px", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                    {emailSuggestions.map(u => (
                      <div key={u.id}
                        onClick={() => { setInviteEmail(u.email); setEmailSuggestions([]); }}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #f0f0f0" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                      >
                        <div style={{ fontWeight: "bold" }}>{u.email}</div>
                        {u.display_name && <div style={{ fontSize: "11px", color: "#888" }}>{u.display_name}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px" }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => { setInviteRole(e.target.value); setInviteCustomModules([]); }}
                  style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px" }}
                >
                  <option value="owner">Owner — Full access</option>
                  <option value="producer">Producer — Full access</option>
                  <option value="line_producer">Line Producer — Full access</option>
                  <option value="department_head">Dept. Head — No budget access</option>
                  <option value="crew">Crew — No budget or cost reports</option>
                  <option value="custom">Custom — Choose modules</option>
                </select>
                {inviteRole === "custom" && (
                  <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "4px", border: "1px solid #ddd" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Select Accessible Modules</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {ALL_MODULES_LIST.map(mod => {
                        const checked = inviteCustomModules.includes(mod);
                        return (
                          <label key={mod} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer", backgroundColor: checked ? "#e3f2fd" : "white", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${checked ? "#90caf9" : "#ddd"}` }}>
                            <input type="checkbox" checked={checked}
                              onChange={(e) => setInviteCustomModules(prev => e.target.checked ? [...prev, mod] : prev.filter(m => m !== mod))}
                              style={{ cursor: "pointer" }} />
                            {mod}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {inviteError && (
                <div
                  style={{
                    backgroundColor: "#ffebee",
                    color: "#c62828",
                    padding: "10px",
                    borderRadius: "4px",
                    marginBottom: "15px",
                    fontSize: "14px",
                  }}
                >
                  {inviteError}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    backgroundColor: "#4CAF50",
                    color: "white",
                    padding: "10px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Inviting..." : "Invite Member"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  style={{
                    backgroundColor: "#999",
                    color: "white",
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          backgroundColor: "#2196F3",
          color: "white",
          padding: "10px 20px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          columnGap: "16px",
          alignItems: "center",
          fontSize: "14px",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ flexShrink: 0 }}>
            Welcome, <DisplayNameEditor user={user} />
          </span>
          {selectedProject && (
            <span
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selectedProject.name}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {selectedProject && (
            <WorkflowTabs
              activeWorkflow={activeWorkflow}
              onWorkflowChange={setActiveWorkflow}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          {selectedProject && (
            <>
              <button
                onClick={handleSaveAndReturn}
                style={{
                  backgroundColor: "transparent",
                  color: "white",
                  border: "1px solid white",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Projects
              </button>
              {(userRole === "owner" || userRole === "producer") && (
                <button
                  onClick={() => setShowTeamModal(true)}
                  style={{
                    backgroundColor: "transparent",
                    color: "white",
                    border: "1px solid white",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Team
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSignOut}
            style={{
              backgroundColor: "transparent",
              color: "white",
              border: "1px solid white",
              padding: "6px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Emergency backup banner — shown when pending local-only backups exist */}
      {pendingEmergencyBackups.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: "44px",
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: "#e65100",
            color: "white",
            padding: "6px 20px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
            boxSizing: "border-box",
          }}
        >
          <span style={{ flexShrink: 0 }}>&#9888;</span>
          <span>
            {pendingEmergencyBackups.length === 1
              ? `"${pendingEmergencyBackups[0].projectName}" has a local-only emergency backup that has not been synced to the database.`
              : `${pendingEmergencyBackups.length} projects have local-only emergency backups that have not been synced to the database.`}
          </span>
          <button
            onClick={() => {
              if (process.env.NODE_ENV === "development") {
                console.info("[AuthWrapper] Emergency backup details:", pendingEmergencyBackups);
              }
              setShowEmergencyDetailModal(true);
            }}
            style={{
              marginLeft: "auto",
              backgroundColor: "rgba(255,255,255,0.15)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.4)",
              padding: "3px 10px",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "11px",
              flexShrink: 0,
            }}
          >
            View details
          </button>
        </div>
      )}

      {/* Emergency backup detail modal */}
      {showEmergencyDetailModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
          }}
          onClick={() => setShowEmergencyDetailModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "28px 32px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: "bold", color: "#bf360c" }}>
              &#9888; Local Emergency Backup(s) Pending
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#555", lineHeight: 1.6 }}>
              These projects have local-only emergency backups in your browser&apos;s IndexedDB.
              Your data is safe locally. Use <strong>Retry Sync</strong> to push the latest
              local draft to Supabase, or <strong>Mark Resolved</strong> only after you have
              manually verified the project data is safe.
            </p>
            <div style={{ marginBottom: "16px" }}>
              {pendingEmergencyBackups.map((m) => {
                const itemS = emergencyItemState[m.projectId] || {};
                return (
                  <div
                    key={m.id || m.projectId}
                    style={{
                      padding: "12px 14px",
                      marginBottom: "10px",
                      borderRadius: "5px",
                      backgroundColor: "#fff8f6",
                      border: "1px solid #ffccbc",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "6px", fontSize: "13px" }}>
                      {m.projectName || m.projectId}
                    </div>
                    <div style={{ color: "#666", lineHeight: 1.8, marginBottom: "8px" }}>
                      <div><span style={{ color: "#888" }}>Project ID:</span> {m.projectId}</div>
                      <div><span style={{ color: "#888" }}>Reason:</span> {m.reason}</div>
                      <div><span style={{ color: "#888" }}>Created:</span> {m.createdAt}</div>
                      <div><span style={{ color: "#888" }}>Sync status:</span> {m.syncStatus}</div>
                      {m.lastRetryAt && (
                        <div><span style={{ color: "#888" }}>Last retry:</span> {m.lastRetryAt}</div>
                      )}
                    </div>

                    {/* Retry error message */}
                    {itemS.retryError && (
                      <div style={{ padding: "6px 8px", backgroundColor: "#ffebee", border: "1px solid #ef9a9a", borderRadius: "4px", fontSize: "11px", color: "#c62828", marginBottom: "8px" }}>
                        {itemS.retryError}
                      </div>
                    )}

                    {/* Confirm-resolve prompt */}
                    {itemS.confirmingResolve ? (
                      <div style={{ padding: "8px 10px", backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "4px", fontSize: "11px", color: "#555", marginBottom: "8px" }}>
                        <div style={{ marginBottom: "6px" }}>
                          <strong>This only clears the local pending warning</strong> after you have
                          verified the project data is safe. It does not sync anything to Supabase.
                          The IndexedDB backup record is kept.
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={async () => {
                              setEmergencyItemState(prev => ({ ...prev, [m.projectId]: { ...prev[m.projectId], confirmingResolve: false, retryError: null } }));
                              await markEmergencyBackupResolvedLocally(m.projectId, m.id);
                              const refreshed = scanEmergencyBackupMarkers();
                              setPendingEmergencyBackups(refreshed);
                              if (refreshed.length === 0) setShowEmergencyDetailModal(false);
                            }}
                            style={{ padding: "4px 12px", borderRadius: "4px", border: "none", backgroundColor: "#e65100", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                          >
                            Yes, clear warning
                          </button>
                          <button
                            onClick={() => setEmergencyItemState(prev => ({ ...prev, [m.projectId]: { ...prev[m.projectId], confirmingResolve: false } }))}
                            style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #bbb", backgroundColor: "white", cursor: "pointer", fontSize: "11px" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          disabled={!!itemS.retrying}
                          onClick={async () => {
                            setEmergencyItemState(prev => ({ ...prev, [m.projectId]: { ...prev[m.projectId], retrying: true, retryError: null } }));
                            const result = await retryEmergencyBackupToSupabase(m.projectId, m.id);
                            if (result.success) {
                              const refreshed = scanEmergencyBackupMarkers();
                              setPendingEmergencyBackups(refreshed);
                              setEmergencyItemState(prev => { const n = { ...prev }; delete n[m.projectId]; return n; });
                              if (refreshed.length === 0) setShowEmergencyDetailModal(false);
                            } else {
                              setEmergencyItemState(prev => ({ ...prev, [m.projectId]: { retrying: false, retryError: result.error || "Retry failed." } }));
                            }
                          }}
                          style={{
                            padding: "5px 12px", borderRadius: "4px", border: "none",
                            backgroundColor: itemS.retrying ? "#bbb" : "#1976d2",
                            color: "white", cursor: itemS.retrying ? "not-allowed" : "pointer",
                            fontSize: "11px", fontWeight: "bold",
                          }}
                        >
                          {itemS.retrying ? "Retrying…" : "Retry Sync"}
                        </button>
                        <button
                          disabled={!!itemS.retrying}
                          onClick={() => setEmergencyItemState(prev => ({ ...prev, [m.projectId]: { ...prev[m.projectId], confirmingResolve: true, retryError: null } }))}
                          style={{
                            padding: "5px 12px", borderRadius: "4px",
                            border: "1px solid #e65100", backgroundColor: "white",
                            color: "#e65100", cursor: itemS.retrying ? "not-allowed" : "pointer",
                            fontSize: "11px",
                          }}
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowEmergencyDetailModal(false)}
                style={{ padding: "8px 20px", borderRadius: "4px", border: "1px solid #bbb", backgroundColor: "white", cursor: "pointer", fontSize: "13px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProject ? (
        <ProjectModuleSyncProvider
          selectedProject={selectedProject}
          onProjectDirty={markProjectDirty}
          onProjectSynced={touchAndMark}
        >
          <TeamManagementModal />
          {React.cloneElement(children, {
            selectedProject,
            userRole,
            modulePermissions,
            user,
            activeWorkflow,
            onProjectDirty: markProjectDirty,
            onProjectSynced: touchAndMark,
          })}
        </ProjectModuleSyncProvider>
      ) : (
        <ProjectSelector
          user={user}
          onProjectSelected={async (project) => {
            const incomingId = project?.id || project?.name;
            if (process.env.NODE_ENV === "development") {
              console.info(`[AuthWrapper] Project selected: ${incomingId} — scanning recovery sources`);
            }

            // Show LoadVerificationModal immediately in scanning state.
            setLoadVerificationState({ project, scanReport: null, isScanning: true });
            let scanReport = null;
            try {
              scanReport = await scanProjectRecoverySources(project);
            } catch (err) {
              if (process.env.NODE_ENV === "development") {
                console.warn("[AuthWrapper] Recovery scan failed:", err?.message);
              }
            }

            if (process.env.NODE_ENV === "development") {
              console.info(
                `[AuthWrapper] Recovery scan result: recommendation=${scanReport?.recommendation}, ` +
                `requiresUserChoice=${scanReport?.requiresUserChoice}`,
                scanReport?.candidates?.map(c => ({ id: c.id, isEmpty: c.isEmpty, confidence: c.confidence }))
              );
            }

            // Scan complete. On a clean scan (no conflict, no pending emergency backup
            // for this project), auto-open without requiring the user to click through
            // the data-source table. Only show the modal when user action is needed.
            const incomingProjectId = project?.id || project?.name;
            const hasConflict = scanReport?.requiresUserChoice === true;
            const hasPendingEmergency = pendingEmergencyBackups.some(
              (m) => (m.projectId === incomingProjectId) && (m.syncStatus === "pending" || !m.syncStatus)
            );

            if (!hasConflict && !hasPendingEmergency && scanReport) {
              // Normal clean open — dismiss modal and open immediately.
              setLoadVerificationState(null);
              await doOpenProject(project, null);
            } else {
              // Conflict or emergency backup present — keep modal open for user choice.
              setLoadVerificationState({ project, scanReport, isScanning: false });
            }

            // Fire-and-forget load audit — diagnostic only, never blocks project open.
            if (project?.id && scanReport) {
              const candidateSummaries = (scanReport.candidates || []).map((c) => ({
                id: c.id,
                sourceType: c.sourceType,
                isEmpty: c.isEmpty,
                confidence: c.confidence,
                hasWritingScript: c.validation?.writingScript?.hasActualPayload ?? null,
                hasWritingCharacters: c.validation?.writingCharacters?.hasActualPayload ?? null,
                hasMoodBoard: c.validation?.moodBoard?.hasActualPayload ?? null,
              }));
              insertProjectLoadAudit({
                projectId: project.id,
                projectName: project.name ?? null,
                checkedByUserId: user?.id ?? null,
                checkedByEmail: user?.email ?? null,
                localStatus: scanReport.localStatus ?? null,
                indexeddbStatus: scanReport.indexeddbStatus ?? null,
                supabaseStatus: scanReport.supabaseStatus ?? null,
                moduleStatuses: { candidates: candidateSummaries },
                warnings: scanReport.warnings ?? [],
                recommendedAction: scanReport.recommendation ?? null,
                requiresUserChoice: scanReport.requiresUserChoice === true,
              }).catch((auditErr) => {
                if (process.env.NODE_ENV === "development") {
                  console.warn("[AuthWrapper] Load audit insert failed (non-fatal):", auditErr?.message);
                }
              });
            }
          }}
        />
      )}

      {/* Load Verification Modal — replaces plain scan spinner; shown while scanning and after scan until user acts */}
      {loadVerificationState && (
        <LoadVerificationModal
          project={loadVerificationState.project}
          scanReport={loadVerificationState.scanReport}
          isScanning={loadVerificationState.isScanning}
          requiresUserChoice={loadVerificationState.scanReport?.requiresUserChoice === true}
          onCancel={() => {
            setLoadVerificationState(null);
          }}
          onChooseRecovery={() => {
            const { project, scanReport } = loadVerificationState;
            setLoadVerificationState(null);
            if (scanReport) {
              setPendingProjectOpen({ project, scanReport });
            }
          }}
          onOpenProject={async () => {
            const { project } = loadVerificationState;
            setLoadVerificationState(null);
            await doOpenProject(project, null);
          }}
        />
      )}

      {/* Project recovery modal — shown when scanner detects conflicting/ambiguous sources */}
      {pendingProjectOpen && (
        <ProjectRecoveryModal
          scanReport={pendingProjectOpen.scanReport}
          project={pendingProjectOpen.project}
          onCancel={() => setPendingProjectOpen(null)}
          onChoose={async ({ candidateId, sourceType, candidate }) => {
            const { project, scanReport } = pendingProjectOpen;
            const projectId = project?.id || project?.name;
            setPendingProjectOpen(null);

            if (process.env.NODE_ENV === "development") {
              console.info(`[AuthWrapper] Recovery modal choice: candidateId=${candidateId}, sourceType=${sourceType}`);
            }

            // Record the recovery decision so a subsequent clean Save/Return can
            // resolve emergency backups the user explicitly passed over.
            const scanCandidates = scanReport?.candidates || [];
            const unresolvedEmergencyIds = scanCandidates
              .filter((c) => c.sourceType === "emergencyBackup" && c._syncStatus === "pending")
              .map((c) => c._backupId)
              .filter(Boolean);
            // Also capture from the raw emergencyRecords if accessible via scanReport.
            // The scanner embeds _backupId on emergency candidates for exactly this purpose.
            recoveryDecisionRef.current = {
              projectId,
              projectName: project?.name || projectId,
              selectedSourceType: sourceType === "supabase" || candidateId === "supabase" ? "supabase" : sourceType,
              selectedSourceId: candidateId,
              selectedAt: new Date().toISOString(),
              unresolvedEmergencyBackupIdsAtChoice: unresolvedEmergencyIds,
              recommendationAtChoice: scanReport?.recommendation ?? null,
            };

            if (process.env.NODE_ENV === "development") {
              console.info(
                `[AuthWrapper] Recovery decision recorded: sourceType=${recoveryDecisionRef.current.selectedSourceType}, ` +
                `unresolvedBackups=${unresolvedEmergencyIds.length}`
              );
            }

            // Build the appropriate applySourceFn based on chosen source type.
            let applySourceFn = null;

            if (sourceType === "supabase" || candidateId === "supabase") {
              // Supabase: skip local hydration entirely — modules load fresh from DB.
              applySourceFn = null;
            } else if (sourceType === "indexedDB") {
              // IDB Writing Script source — pass the exact IDB key from candidate validation.
              const idbKey = candidate?.validation?.writingScript?.idbKey || null;
              applySourceFn = () => applyWritingDraftIdbSource(projectId, idbKey);
            } else if (sourceType === "projectCacheMirror") {
              applySourceFn = () => applyProjectCacheMirrorSource(projectId);
            } else if (sourceType === "projectCacheVersion") {
              const vid = candidate?.validation?.versionId || null;
              if (vid) {
                applySourceFn = () => applyProjectCacheVersionSource(vid);
              } else {
                applySourceFn = null;
              }
            } else {
              // Emergency backup, orphan, or unrecognised — fall back to default hydration.
              applySourceFn = null;
            }

            await doOpenProject(project, applySourceFn);
          }}
        />
      )}

      {/* Save Verification Modal — replaces inline save/return modal */}
      {showProjectsModal && (
        <SaveVerificationModal
          phase={projectsModalPhase}
          flushResults={projectsModalResults}
          barrierResults={projectsModalBarrierResults}
          modalError={projectsModalError}
          onRetry={() => {
            setShowProjectsModal(false);
            setProjectsModalPhase("saving");
            setProjectsModalResults([]);
            setProjectsModalBarrierResults([]);
            setProjectsModalError(null);
            // Small tick to let React close/reopen, then re-run save.
            setTimeout(() => handleSaveAndReturn(), 0);
          }}
          onCancel={() => {
            isSavingRef.current = false;
            setShowProjectsModal(false);
            setProjectsModalPhase("saving");
            setProjectsModalResults([]);
            setProjectsModalBarrierResults([]);
            setProjectsModalError(null);
          }}
          onReturn={commitProjectExit}
        />
      )}
    </div>
  );
}

export default AuthWrapper;
