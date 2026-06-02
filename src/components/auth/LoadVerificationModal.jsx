import React from "react";

// Known load-time data sources to surface to the user before project open.
// The scan report from scanProjectRecoverySources provides data for these.
const LOAD_CHECKS = [
  { key: "supabase",        label: "Supabase Project Settings" },
  { key: "writingScript",   label: "Writing Script" },
  { key: "writingChars",    label: "Writing Characters" },
  { key: "moodBoard",       label: "MoodBoard" },
  { key: "idb",             label: "IndexedDB / ProjectCache" },
  { key: "lsMarker",        label: "localStorage Marker / Active Mirror" },
  { key: "emergency",       label: "Emergency Backup Sources" },
];

const STATUS_CONFIG = {
  checking: { label: "Checking…",    color: "#1565c0", bg: "#e3f2fd" },
  ok:       { label: "OK",           color: "#2e7d32", bg: "#e8f5e9" },
  empty:    { label: "Empty",        color: "#888",    bg: "#f5f5f5" },
  missing:  { label: "Not found",    color: "#9e9e9e", bg: "#fafafa" },
  conflict: { label: "Conflict",     color: "#e65100", bg: "#fff3e0" },
  stale:    { label: "Stale marker", color: "#795548", bg: "#efebe9" },
  error:    { label: "Error",        color: "#b71c1c", bg: "#ffebee" },
  present:  { label: "Present",      color: "#6a1b9a", bg: "#f3e5f5" },
  absent:   { label: "None found",   color: "#9e9e9e", bg: "#fafafa" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "#888", bg: "#f5f5f5" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "11px",
        fontWeight: "bold",
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// Derive per-check status from scanReport.
// Field names are verified against projectRecoveryScanner.js candidate shape:
//   c.id, c.sourceType, c.isEmpty, c.loadable
//   c.validation.writingScript.hasActualPayload, .nodeCount
//   c.validation.writingCharacters.hasActualPayload, .profileCount, .isValidShape
//   c.validation.moodBoard.hasActualPayload (= isMeaningful), .boardCount, .imageCount
//   c.summary.writingScriptNodeCount, .writingCharacterProfileCount
//   c.summary.moodBoardBoardCount, .moodBoardImageCount
// sourceType values: "supabase" | "indexedDB" | "projectCacheMirror" | "projectCacheVersion" | "emergencyBackup" | "orphanDraft"
function buildCheckStatuses(scanReport, isScanning) {
  if (isScanning || !scanReport) {
    return LOAD_CHECKS.reduce((acc, c) => { acc[c.key] = { status: "checking" }; return acc; }, {});
  }

  const statuses = {};
  const candidates = scanReport.candidates || [];

  // ── Supabase — canonical id is "supabase", sourceType is "supabase"
  const supabaseCand = candidates.find((c) => c.id === "supabase");
  if (supabaseCand) {
    const wsNodeCount = supabaseCand.summary?.writingScriptNodeCount ?? 0;
    const wcProfiles = supabaseCand.summary?.writingCharacterProfileCount ?? 0;
    const mbBoards = supabaseCand.summary?.moodBoardBoardCount ?? 0;
    const mbImages = supabaseCand.summary?.moodBoardImageCount ?? 0;
    statuses.supabase = {
      status: supabaseCand.confidence === "error"
        ? "error"
        : supabaseCand.isEmpty
        ? "empty"
        : "ok",
      detail: supabaseCand.confidence === "error"
        ? "Could not read Supabase"
        : supabaseCand.isEmpty
        ? "No data found in Supabase"
        : `script: ${wsNodeCount} nodes, chars: ${wcProfiles} profiles, moodboard: ${mbBoards}b/${mbImages}i`,
    };
  } else {
    statuses.supabase = { status: "missing" };
  }

  // ── Writing Script — best non-empty candidate across all sourceTypes
  // Uses hasActualPayload (correct field name, not hasContent)
  const wsCands = candidates.filter((c) => c.validation?.writingScript?.hasActualPayload === true);
  if (wsCands.length > 0) {
    const best = wsCands.slice().sort(
      (a, b) => (b.validation.writingScript.nodeCount || 0) - (a.validation.writingScript.nodeCount || 0)
    )[0];
    const bestNodes = best.validation.writingScript.nodeCount ?? best.summary?.writingScriptNodeCount ?? "?";
    statuses.writingScript = {
      status: "ok",
      detail: `${bestNodes} nodes (${wsCands.length} source${wsCands.length > 1 ? "s" : ""})`,
    };
  } else {
    statuses.writingScript = { status: "empty" };
  }

  // ── Writing Characters — uses hasActualPayload and profileCount
  const wcCands = candidates.filter(
    (c) => c.validation?.writingCharacters?.hasActualPayload === true
      || (c.validation?.writingCharacters?.profileCount ?? 0) > 0
  );
  if (wcCands.length > 0) {
    const best = wcCands.slice().sort(
      (a, b) => (b.validation.writingCharacters?.profileCount || 0) - (a.validation.writingCharacters?.profileCount || 0)
    )[0];
    const count = best.validation.writingCharacters?.profileCount ?? best.summary?.writingCharacterProfileCount ?? "?";
    statuses.writingChars = {
      status: "ok",
      detail: `${count} profile(s) (${wcCands.length} source${wcCands.length > 1 ? "s" : ""})`,
    };
  } else {
    statuses.writingChars = { status: "empty" };
  }

  // ── MoodBoard — uses hasActualPayload (which = isMeaningful in the scanner)
  const mbCands = candidates.filter(
    (c) => c.validation?.moodBoard?.hasActualPayload === true
  );
  if (mbCands.length > 0) {
    const best = mbCands[0];
    const boards = best.validation.moodBoard?.boardCount ?? best.summary?.moodBoardBoardCount ?? "?";
    const images = best.validation.moodBoard?.imageCount ?? best.summary?.moodBoardImageCount ?? "?";
    statuses.moodBoard = {
      status: "ok",
      detail: `${boards} board(s), ${images} image(s) (${mbCands.length} source${mbCands.length > 1 ? "s" : ""})`,
    };
  } else {
    statuses.moodBoard = { status: "empty" };
  }

  // ── IndexedDB / ProjectCache — sourceType is "indexedDB", "projectCacheMirror", or "projectCacheVersion"
  const idbSourceTypes = new Set(["indexedDB", "projectCacheMirror", "projectCacheVersion"]);
  const idbCands = candidates.filter((c) => idbSourceTypes.has(c.sourceType) && !c.isEmpty);
  const idbAll = candidates.filter((c) => idbSourceTypes.has(c.sourceType));
  if (idbCands.length > 0) {
    statuses.idb = { status: "ok", detail: `${idbCands.length} source(s) with content (${idbAll.length} total)` };
  } else if (idbAll.length > 0) {
    statuses.idb = { status: "empty", detail: `${idbAll.length} IDB source(s) found but all empty` };
  } else {
    statuses.idb = { status: "missing" };
  }

  // ── localStorage marker / active mirror
  // Uses the projectCacheMirrorCurrent candidate's writingScript validation.
  // markerExists: the mirror snapshot contains a writingScriptDraft key (captured at last clean exit).
  // idbRecordExists: the IDB WritingDrafts record that marker referenced still exists.
  // After a clean exit the active localStorage keys are cleared — mirror being a historical
  // snapshot with a valid IDB backing record is the normal, non-alarming case.
  const mirrorCand = candidates.find((c) => c.id === "projectCacheMirrorCurrent");
  if (mirrorCand && !mirrorCand.isEmpty) {
    const wsv = mirrorCand.validation?.writingScript;
    const keyCount = mirrorCand.summary?.localStorageMirrorKeyCount ?? "?";
    if (wsv?.markerExists && !wsv?.idbRecordExists) {
      // Real issue: mirror has a WS marker but the IDB payload it referenced is gone.
      // Only show Conflict if project also has no other valid data source.
      const hasValidData = !!(supabaseCand && !supabaseCand.isEmpty)
        || wsCands.length > 0
        || idbCands.length > 0;
      if (hasValidData) {
        // IDB record is missing but data is available elsewhere — stale marker, not blocking.
        statuses.lsMarker = {
          status: "stale",
          detail: `Stale marker — IDB draft record missing, but valid data exists in other sources`,
        };
      } else {
        statuses.lsMarker = {
          status: "conflict",
          detail: "Mirror marker references a missing IDB record and no other valid source found",
        };
      }
    } else if (wsv?.markerExists && wsv?.idbRecordExists) {
      // Normal post-exit state: mirror snapshot had WS marker, IDB record still intact.
      statuses.lsMarker = { status: "ok", detail: `Last clean exit: ${keyCount} key(s) mirrored, IDB record intact` };
    } else if (wsv?.markerExists === false || wsv == null) {
      // Mirror exists but no writingScriptDraft key in it — script may never have been saved,
      // or was a new project. Show the mirror key count if available.
      statuses.lsMarker = {
        status: "ok",
        detail: keyCount > 0
          ? `Last clean exit: ${keyCount} key(s) mirrored (no WS marker)`
          : "No active localStorage mirror (normal for new projects)",
      };
    } else {
      statuses.lsMarker = { status: "ok", detail: `Mirror: ${keyCount} key(s)` };
    }
  } else if (mirrorCand && mirrorCand.isEmpty) {
    // mirrorCand found but isEmpty — no mirror record in IDB.
    statuses.lsMarker = { status: "empty", detail: "No previous clean exit mirror found" };
  } else {
    // No mirror candidate at all — scanner returned nothing for this ID.
    statuses.lsMarker = { status: "missing", detail: "No mirror record found" };
  }

  // ── Emergency backups — sourceType is "emergencyBackup"
  // Use _syncStatus (set by scanner) to distinguish pending vs resolved.
  const emergencyCands = candidates.filter((c) => c.sourceType === "emergencyBackup");
  if (emergencyCands.length > 0) {
    const pendingCount = emergencyCands.filter((c) => c._syncStatus === "pending" || !c._syncStatus).length;
    const resolvedCount = emergencyCands.length - pendingCount;
    const detailParts = [`${emergencyCands.length} backup(s)`];
    if (pendingCount > 0) detailParts.push(`${pendingCount} pending`);
    if (resolvedCount > 0) detailParts.push(`${resolvedCount} resolved/synced`);
    statuses.emergency = {
      status: pendingCount > 0 ? "present" : "absent",
      detail: detailParts.join(", "),
      pendingCount,
    };
  } else {
    statuses.emergency = { status: "absent", pendingCount: 0 };
  }

  return statuses;
}

export default function LoadVerificationModal({
  project,           // project object
  scanReport,        // null while scanning, populated when done
  isScanning,        // bool
  requiresUserChoice,// bool — if true, hand off to ProjectRecoveryModal
  onOpenProject,     // () => void — calls doOpenProject after user confirmation
  onChooseRecovery,  // () => void — opens ProjectRecoveryModal
  onCancel,          // () => void — abort, return to project list
}) {
  const checkStatuses = buildCheckStatuses(scanReport, isScanning);

  const hasWarnings = !isScanning && (scanReport?.warnings || []).length > 0;
  const hasEmergency = checkStatuses.emergency?.status === "present";
  const hasConflict = requiresUserChoice;

  // Normal scanning: show a simple loading UI only.
  // The checklist/detail table is only shown after scanning completes AND there is
  // a conflict or emergency that requires the user to make a choice.
  // Normal clean opens auto-dismiss before isScanning becomes false (AuthWrapper).
  if (isScanning) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 109999,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
      }}>
        <div style={{
          backgroundColor: "white", borderRadius: "8px",
          padding: "28px 32px", maxWidth: "320px", width: "calc(100% - 32px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)", textAlign: "center",
        }}>
          <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "12px", color: "#333" }}>
            Loading project…
          </div>
          <div style={{ height: "4px", backgroundColor: "#e3f2fd", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "60%", backgroundColor: "#2196F3",
              borderRadius: "2px", animation: "fpb-load-pi 1.2s infinite ease-in-out",
            }} />
          </div>
          <style>{`@keyframes fpb-load-pi{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 109999,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "0",
          maxWidth: "480px",
          width: "calc(100% - 32px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header — only shown in conflict/emergency post-scan state */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "2px" }}>
            Opening: {project?.name || "Project"}
          </div>
          <div style={{ fontSize: "12px", color: "#888" }}>
            Scan complete — review before opening
          </div>
        </div>

        {/* Checklist — only shown post-scan */}
        <div style={{ overflowY: "auto", flexGrow: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ padding: "7px 10px", fontSize: "11px", color: "#666", textAlign: "left", fontWeight: "bold", borderBottom: "2px solid #e0e0e0" }}>
                  Data Source
                </th>
                <th style={{ padding: "7px 10px", fontSize: "11px", color: "#666", textAlign: "left", fontWeight: "bold", borderBottom: "2px solid #e0e0e0" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {LOAD_CHECKS.map((check) => {
                const { status, detail } = checkStatuses[check.key] || { status: "checking" };
                return (
                  <tr key={check.key}>
                    <td style={{ padding: "7px 10px", fontSize: "12px", color: "#333", borderBottom: "1px solid #f0f0f0" }}>
                      {check.label}
                    </td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #f0f0f0" }}>
                      <StatusBadge status={status} />
                      {detail && (
                        <span style={{ marginLeft: "6px", fontSize: "11px", color: "#666" }}>
                          {detail}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warnings panel */}
        {hasWarnings && (
          <div
            style={{
              padding: "8px 14px",
              backgroundColor: "#fff8e1",
              borderTop: "1px solid #ffe082",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#e65100", marginBottom: "4px" }}>
              Scan warnings:
            </div>
            {(scanReport.warnings || []).map((w, i) => (
              <div key={i} style={{ fontSize: "11px", color: "#bf360c", lineHeight: 1.4 }}>{w}</div>
            ))}
          </div>
        )}

        {/* Emergency backup notice */}
        {!isScanning && hasEmergency && (
          <div
            style={{
              padding: "8px 14px",
              backgroundColor: "#f3e5f5",
              borderTop: "1px solid #ce93d8",
              fontSize: "11px",
              color: "#6a1b9a",
              flexShrink: 0,
            }}
          >
            Emergency backup(s) exist for this project. Use "Choose Recovery Source" to review them.
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e0e0e0",
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button onClick={onCancel} style={cancelBtnStyle}>
            Cancel
          </button>

          {/* Choose Recovery Source — only when relevant: emergency backup present, conflict, or user choice required */}
          {!isScanning && (hasConflict || hasEmergency) && (
            <button onClick={onChooseRecovery} style={chooseRecoveryBtnStyle}>
              {hasConflict ? "Choose Recovery Source" : "Review Backups"}
            </button>
          )}

          {/* Open Project — shown when no conflict requires resolution */}
          {!isScanning && !hasConflict && (
            <button onClick={onOpenProject} style={openBtnStyle}>
              Open Project
            </button>
          )}

          {/* Conflict: user must choose before opening */}
          {!isScanning && hasConflict && (
            <div style={{ fontSize: "11px", color: "#c62828", alignSelf: "center" }}>
              Recovery choice required before opening.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle = {
  padding: "8px 14px",
  borderRadius: "4px",
  border: "1px solid #bbb",
  backgroundColor: "white",
  cursor: "pointer",
  fontSize: "12px",
  color: "#555",
  fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};

const chooseRecoveryBtnStyle = {
  padding: "8px 14px",
  borderRadius: "4px",
  border: "1px solid #6a1b9a",
  backgroundColor: "white",
  color: "#6a1b9a",
  cursor: "pointer",
  fontSize: "12px",
  fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};

const openBtnStyle = {
  padding: "8px 18px",
  borderRadius: "4px",
  border: "none",
  backgroundColor: "#2196F3",
  color: "white",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
  fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};
