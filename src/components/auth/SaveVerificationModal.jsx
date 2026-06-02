// SaveVerificationModal — simplified cloud sync freshness exit UI.
//
// The exit gate is now project_sync_status.last_successful_sync_at vs
// lastLocalDirtyAtRef — not per-module flush handler results.
//
// States:
//   waiting  — barrier flush (WS/MB debounce settling)
//   saving   — cloud sync freshness check in progress
//   done     — check complete; allClean drives Return vs Retry/Cancel
//   failed   — unexpected error (emergency backup IDB write failure)
import React from "react";

export default function SaveVerificationModal({
  phase,
  flushResults,   // [localRecoveryResult, supabaseVerResult] on clean exit; [exitDiagnostic] on failure
  barrierResults,
  modalError,
  onRetry,
  onCancel,
  onReturn,
}) {
  if (!phase) return null;

  const isWaiting = phase === "waiting";
  const isSaving  = phase === "saving" || phase === "waiting";
  const isFailed  = phase === "failed";
  const isDone    = phase === "done";

  // Clean exit: localRecovery result is present (only written on clean path)
  // and no exitDiagnostic cloudCurrent===false signal.
  const localRecoveryResult = (flushResults || []).find((r) => r?.key === "localRecovery");
  const exitDiagnostic      = (flushResults || []).find((r) => r?.cloudCurrent !== undefined);
  const allClean = isDone && localRecoveryResult != null && exitDiagnostic == null;

  const barrierHasIssue = Array.isArray(barrierResults) && barrierResults.some(
    (r) => r.timedOut || r.offlineQueued || r.localOnly
  );

  // Diagnostic detail for <details> expander
  const diagLines = [];
  if (exitDiagnostic) {
    if (exitDiagnostic.lastDirty)       diagLines.push(`Last local change: ${exitDiagnostic.lastDirty}`);
    if (exitDiagnostic.effectiveSyncAt) diagLines.push(`Last cloud sync:   ${exitDiagnostic.effectiveSyncAt}`);
    if (exitDiagnostic.barrierFailed)   diagLines.push(`Barrier issue: Writing Script or MoodBoard sync did not settle cleanly.`);
    if (exitDiagnostic.syncError)       diagLines.push(`Sync error: ${exitDiagnostic.syncError}`);
  }
  if (localRecoveryResult?.message) diagLines.push(`Cache: ${localRecoveryResult.message}`);
  if (barrierHasIssue) {
    barrierResults.filter((r) => r.timedOut || r.offlineQueued || r.localOnly).forEach((r) => {
      diagLines.push(`Barrier (${r.label}): ${r.timedOut ? "timed out" : r.offlineQueued ? "offline" : "local only"}`);
    });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px",
        maxWidth: "400px", width: "calc(100% - 32px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e0e0e0" }}>
          {isSaving && (
            <>
              <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "10px", color: "#333" }}>
                {isWaiting ? "Waiting for active sync to settle…" : "Checking cloud sync…"}
              </div>
              <div style={{ height: "4px", backgroundColor: "#e3f2fd", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: "60%",
                  backgroundColor: isWaiting ? "#FF9800" : "#2196F3",
                  borderRadius: "2px",
                  animation: "fpb-pi 1.2s infinite ease-in-out",
                }} />
              </div>
              <style>{`@keyframes fpb-pi{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
            </>
          )}
          {isDone && allClean && (
            <div style={{ fontWeight: "bold", fontSize: "15px", color: "#2e7d32" }}>
              Cloud sync verified. Returning…
            </div>
          )}
          {isDone && !allClean && (
            <div style={{ fontWeight: "bold", fontSize: "15px", color: "#b71c1c" }}>
              Cloud sync could not be verified.
            </div>
          )}
          {isFailed && (
            <div style={{ fontWeight: "bold", fontSize: "15px", color: "#b71c1c" }}>
              Save failed.
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px" }}>
          {isFailed && (
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#555", lineHeight: 1.5 }}>
              {modalError}
            </p>
          )}

          {isDone && allClean && (
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#555", lineHeight: 1.5 }}>
              Your project data has been synced to Supabase. Local cache updated.
              Returning to Project Selector…
            </p>
          )}

          {isDone && !allClean && (
            <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#555", lineHeight: 1.5 }}>
              Supabase sync freshness could not be confirmed. Local project data has been preserved. An emergency backup has been saved locally.
            </p>
          )}

          {/* Diagnostics expander */}
          {diagLines.length > 0 && (
            <details style={{ marginTop: "12px" }}>
              <summary style={{ fontSize: "11px", color: "#999", cursor: "pointer", userSelect: "none" }}>
                ▸ Diagnostics
              </summary>
              <div style={{ marginTop: "6px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px", fontSize: "10px", color: "#555", lineHeight: 1.8, fontFamily: "monospace" }}>
                {diagLines.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </details>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: "12px 24px 16px", borderTop: "1px solid #e0e0e0",
          display: "flex", gap: "8px", justifyContent: "flex-end",
        }}>
          {(isFailed || (isDone && !allClean)) && (
            <>
              <button onClick={onCancel} style={cancelBtnStyle}>Stay in Project</button>
              {!isFailed && <button onClick={onRetry} style={retryBtnStyle}>Retry</button>}
            </>
          )}
          {/* No button on clean exit — commitProjectExit fires automatically */}
        </div>
      </div>
    </div>
  );
}

const cancelBtnStyle = {
  padding: "8px 16px", borderRadius: "4px", border: "1px solid #bbb",
  backgroundColor: "white", cursor: "pointer", fontSize: "12px", color: "#555",
  fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};
const retryBtnStyle = {
  padding: "8px 16px", borderRadius: "4px", border: "none",
  backgroundColor: "#1565c0", color: "white", cursor: "pointer",
  fontSize: "12px", fontWeight: "bold", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};
const returnBtnStyle = {
  padding: "8px 20px", borderRadius: "4px", border: "none",
  backgroundColor: "#2e7d32", color: "white", cursor: "pointer",
  fontSize: "12px", fontWeight: "bold", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
};
