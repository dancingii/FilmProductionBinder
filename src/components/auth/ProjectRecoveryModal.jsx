// ProjectRecoveryModal — project open recovery gate.
//
// Shows validated candidate sources with honest payload availability labels.
// Does NOT write, delete, sync, or restore anything.
// Only allows "Open using selected source" for candidates with loadable: true.

import React, { useState, useEffect } from "react";
import {
  scanWritingScriptRecoverySources,
  attachRecoveredWritingScript,
} from "../../utils/writingScriptRecoveryScanner";

const SOURCE_TYPE_LABELS = {
  supabase: "Supabase database",
  indexedDB: "IndexedDB draft",
  projectCacheMirror: "ProjectCache mirror",
  projectCacheVersion: "ProjectCache version",
  emergencyBackup: "Emergency backup",
  orphanDraft: "Possible orphan draft",
};

const CONFIDENCE_COLORS = {
  high: { bg: "#e8f5e9", color: "#2e7d32", border: "#a5d6a7", label: "High" },
  medium: { bg: "#e3f2fd", color: "#0d47a1", border: "#90caf9", label: "Medium" },
  low: { bg: "#fff8e1", color: "#e65100", border: "#ffe082", label: "Low" },
  none: { bg: "#f5f5f5", color: "#888", border: "#ddd", label: "Not found" },
  error: { bg: "#ffebee", color: "#c62828", border: "#ef9a9a", label: "Error" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso.slice(0, 16).replace("T", " "); }
}

function Badge({ label, bg, color, border }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 5px", borderRadius: "3px", fontSize: "9px",
      fontWeight: "bold", backgroundColor: bg, color, border: `1px solid ${border}`,
      textTransform: "uppercase", letterSpacing: "0.03em", verticalAlign: "middle",
    }}>{label}</span>
  );
}

function PayloadStatus({ label, hasPayload, warning, count, countLabel, validShape }) {
  if (hasPayload === null && count === null) return null;
  const ok = hasPayload === true || (count !== null && count > 0 && validShape !== false);
  const color = ok ? "#2e7d32" : "#888";
  return (
    <span style={{ display: "inline-block", marginRight: "10px", fontSize: "10px", color }}>
      {ok ? "✓" : "○"} {label}:{" "}
      {count !== null ? <strong>{count}</strong> : (hasPayload ? "yes" : "—")}
      {countLabel && count !== null ? ` ${countLabel}` : ""}
      {validShape === false && count > 0 ? <span style={{ color: "#e65100", marginLeft: "3px" }}>⚠ shape</span> : null}
      {warning && !ok ? <span style={{ color: "#e65100", marginLeft: "4px" }} title={warning}>⚠</span> : null}
    </span>
  );
}

function InspectPanel({ candidate }) {
  const v = candidate.validation;
  const ws = v?.writingScript;
  const wc = v?.writingCharacters;
  const mb = v?.moodBoard;

  return (
    <div style={{
      marginTop: "8px", padding: "8px 10px", backgroundColor: "#f8f8f8",
      border: "1px solid #e0e0e0", borderRadius: "4px", fontSize: "10px", lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#444", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Inspect Details
      </div>

      {/* Writing Script */}
      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "#888" }}>Writing Script: </span>
        {ws ? (
          <>
            {ws.hasActualPayload
              ? <span style={{ color: "#2e7d32" }}>✓ {ws.nodeCount} node(s) — actual payload</span>
              : ws.nodeCount > 0
                ? <span style={{ color: "#e65100" }}>⚠ {ws.nodeCount} node(s) but not confirmed loadable</span>
                : <span style={{ color: "#888" }}>○ no script content</span>
            }
            {ws.idbRecordExists === true && <span style={{ color: "#888", marginLeft: "6px" }}>(IDB record found)</span>}
            {ws.idbRecordExists === false && ws.markerExists && <span style={{ color: "#e65100", marginLeft: "6px" }}>⚠ IDB record MISSING</span>}
            {ws.warning && <div style={{ color: "#e65100", fontSize: "9px", marginTop: "1px" }}>⚠ {ws.warning}</div>}
            {ws.savedAt && <span style={{ color: "#aaa", marginLeft: "8px", fontSize: "9px" }}>saved: {fmtDate(ws.savedAt)}</span>}
            {ws.idbKey && <div style={{ color: "#bbb", fontSize: "9px" }}>key: {ws.idbKey}</div>}
          </>
        ) : <span style={{ color: "#ccc" }}>n/a for this source</span>}
      </div>

      {/* Writing Characters */}
      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "#888" }}>Writing Characters: </span>
        {wc ? (
          <>
            {wc.profileCount > 0 && wc.isValidShape
              ? <span style={{ color: "#2e7d32" }}>✓ {wc.profileCount} profile(s) — valid shape</span>
              : wc.profileCount > 0
                ? <span style={{ color: "#e65100" }}>⚠ {wc.profileCount} item(s) — INVALID shape (won't load correctly)</span>
                : <span style={{ color: "#888" }}>○ no profiles</span>
            }
            {wc.shapeSummary && <div style={{ color: "#bbb", fontSize: "9px" }}>{wc.shapeSummary}</div>}
            {wc.warning && <div style={{ color: "#e65100", fontSize: "9px" }}>⚠ {wc.warning}</div>}
          </>
        ) : <span style={{ color: "#ccc" }}>n/a for this source</span>}
      </div>

      {/* MoodBoard */}
      <div style={{ marginBottom: "4px" }}>
        <span style={{ color: "#888" }}>MoodBoard: </span>
        {mb ? (
          <>
            {mb.isMeaningful
              ? <span style={{ color: "#2e7d32" }}>✓ {mb.boardCount} board(s), {mb.imageCount} image(s)</span>
              : <span style={{ color: "#888" }}>○ default/empty ({mb.boardCount} board, {mb.imageCount} images)</span>
            }
            {mb.warning && <div style={{ color: "#e65100", fontSize: "9px" }}>⚠ {mb.warning}</div>}
          </>
        ) : <span style={{ color: "#ccc" }}>n/a for this source</span>}
      </div>

      {/* Mirror key list */}
      {v?.keyList && v.keyList.length > 0 && (
        <div>
          <span style={{ color: "#888" }}>Mirror keys ({v.keyList.length}): </span>
          <span style={{ color: "#bbb", fontFamily: "monospace", fontSize: "9px" }}>
            {v.keyList.slice(0, 8).join(", ")}{v.keyList.length > 8 ? ` … +${v.keyList.length - 8} more` : ""}
          </span>
        </div>
      )}

      {!candidate.loadable && (
        <div style={{ marginTop: "4px", padding: "4px 6px", backgroundColor: "#fff8e1", border: "1px solid #ffe082", borderRadius: "3px", color: "#e65100", fontSize: "9px" }}>
          View-only — this source cannot be loaded directly in this sprint.
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate, selected, onSelect }) {
  const [showInspect, setShowInspect] = useState(false);
  const conf = CONFIDENCE_COLORS[candidate.confidence] || CONFIDENCE_COLORS.none;
  const s = candidate.summary;

  const wsStatus = candidate.validation?.writingScript;
  const wcStatus = candidate.validation?.writingCharacters;
  const mbStatus = candidate.validation?.moodBoard;

  return (
    <div
      style={{
        marginBottom: "8px",
        border: selected ? "2px solid #1976d2" : "1px solid #ddd",
        borderRadius: "6px",
        backgroundColor: selected ? "#e3f2fd" : "white",
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => candidate.loadable && onSelect(candidate.id)}
        style={{
          padding: "10px 12px",
          cursor: candidate.loadable ? "pointer" : "default",
          opacity: candidate.loadable ? 1 : 0.75,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          {candidate.loadable ? (
            <input
              type="radio"
              checked={selected}
              onChange={() => onSelect(candidate.id)}
              style={{ marginTop: "3px", flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div style={{ width: "13px", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>{candidate.label}</span>
              <Badge label={conf.label} {...conf} />
              <span style={{ fontSize: "10px", color: "#888" }}>{SOURCE_TYPE_LABELS[candidate.sourceType] || candidate.sourceType}</span>
              {candidate.updatedAt && <span style={{ fontSize: "9px", color: "#aaa" }}>{fmtDate(candidate.updatedAt)}</span>}
              {!candidate.loadable && (
                <Badge label="view-only" bg="#f5f5f5" color="#888" border="#ddd" />
              )}
              {candidate.isEmpty && (
                <Badge label="empty" bg="#fff3e0" color="#e65100" border="#ffcc80" />
              )}
            </div>

            {/* Per-module payload status row */}
            <div style={{ display: "flex", flexWrap: "wrap", marginBottom: "3px" }}>
              <PayloadStatus
                label="Script"
                hasPayload={wsStatus?.hasActualPayload ?? null}
                count={s.writingScriptNodeCount}
                countLabel="nodes"
                warning={wsStatus?.warning}
              />
              <PayloadStatus
                label="Characters"
                hasPayload={wcStatus ? (wcStatus.profileCount > 0 && wcStatus.isValidShape) : null}
                count={s.writingCharacterProfileCount}
                countLabel="profiles"
                validShape={wcStatus?.isValidShape ?? null}
                warning={wcStatus?.warning}
              />
              <PayloadStatus
                label="MoodBoard"
                hasPayload={mbStatus?.isMeaningful ?? null}
                count={s.moodBoardBoardCount !== null ? `${s.moodBoardBoardCount}b/${s.moodBoardImageCount ?? 0}i` : null}
                warning={mbStatus?.warning}
              />
              {s.localStorageMirrorKeyCount !== null && (
                <span style={{ fontSize: "10px", color: "#888", marginRight: "10px" }}>
                  Mirror: <strong>{s.localStorageMirrorKeyCount}</strong> keys
                </span>
              )}
            </div>

            {/* Warnings */}
            {candidate.warnings.length > 0 && (
              <div>
                {candidate.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: "10px", color: "#e65100" }}>⚠ {w}</div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowInspect(p => !p); }}
            style={{
              flexShrink: 0, padding: "2px 8px", fontSize: "10px", borderRadius: "3px",
              border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer", color: "#555",
            }}
          >
            {showInspect ? "Hide" : "Inspect"}
          </button>
        </div>
      </div>
      {showInspect && (
        <div style={{ padding: "0 12px 10px 12px" }}>
          <InspectPanel candidate={candidate} />
        </div>
      )}
    </div>
  );
}

// ─── Script payload candidate row ────────────────────────────────────────────

function ScriptCandidateRow({ cand, onAttach, project, onAttachComplete }) {
  const [showDetail, setShowDetail] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [attachConfirm, setAttachConfirm] = useState(false);
  const [attachResult, setAttachResult] = useState(null);

  const confColors = CONFIDENCE_COLORS[cand.confidence] || CONFIDENCE_COLORS.none;
  const isOrphan = !!cand.isOrphan;
  const canAttach = (cand.recoverable || cand.orphanRecoverable) && !attachResult?.success;

  return (
    <div style={{
      padding: "8px 10px", marginBottom: "6px", borderRadius: "5px",
      border: attachResult?.success ? "1px solid #a5d6a7" : "1px solid #ddd",
      backgroundColor: attachResult?.success ? "#e8f5e9" : "white", fontSize: "11px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "2px" }}>
            <Badge label={confColors.label} {...confColors} />
            <span style={{ fontSize: "10px", color: "#555" }}>{cand.sourceType}</span>
            {cand.nodeCount > 0 && (
              <span style={{ fontSize: "10px", color: "#2e7d32", fontWeight: "bold" }}>✓ {cand.nodeCount} nodes</span>
            )}
            {cand.nodeCount === 0 && (
              <span style={{ fontSize: "10px", color: "#888" }}>0 nodes</span>
            )}
            {isOrphan && <Badge label="orphan" bg="#fff3e0" color="#e65100" border="#ffe082" />}
            {!cand.recoverable && !cand.orphanRecoverable && (
              <Badge label="not recoverable" bg="#f5f5f5" color="#888" border="#ddd" />
            )}
          </div>
          <div style={{ color: "#888", fontSize: "9px", fontFamily: "monospace", marginBottom: "2px" }}>
            {cand.sourceLocation}
          </div>
          {(cand.savedAt || cand.createdAt) && (
            <div style={{ color: "#aaa", fontSize: "9px" }}>
              saved: {fmtDate(cand.savedAt || cand.createdAt)}
            </div>
          )}
          {cand.elementTypeSummary && (
            <div style={{ color: "#888", fontSize: "9px" }}>elements: {cand.elementTypeSummary}</div>
          )}
          {cand.warnings?.map((w, i) => (
            <div key={i} style={{ color: "#e65100", fontSize: "9px" }}>⚠ {w}</div>
          ))}
          {attachResult && (
            <div style={{ marginTop: "4px", padding: "4px 6px", borderRadius: "3px",
              backgroundColor: attachResult.success ? "#e8f5e9" : "#ffebee",
              color: attachResult.success ? "#2e7d32" : "#c62828", fontSize: "10px" }}>
              {attachResult.success
                ? `✓ Attached ${attachResult.nodeCount} nodes to Supabase and IndexedDB.`
                : `✗ Attach failed: ${attachResult.error}`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "5px", flexShrink: 0, flexDirection: "column", alignItems: "flex-end" }}>
          <button onClick={() => setShowDetail(p => !p)}
            style={{ padding: "2px 7px", fontSize: "10px", borderRadius: "3px", border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer" }}>
            {showDetail ? "Hide" : "Inspect"}
          </button>
          {canAttach && !attaching && !attachConfirm && (
            <button onClick={() => setAttachConfirm(true)}
              style={{ padding: "2px 7px", fontSize: "10px", borderRadius: "3px", border: "none",
                backgroundColor: "#1565c0", color: "white", cursor: "pointer", fontWeight: "bold" }}>
              Attach to Project
            </button>
          )}
          {attaching && (
            <span style={{ fontSize: "10px", color: "#888" }}>Saving…</span>
          )}
        </div>
      </div>

      {showDetail && (
        <div style={{ marginTop: "6px", padding: "6px 8px", backgroundColor: "#f8f8f8",
          border: "1px solid #e0e0e0", borderRadius: "3px", fontSize: "10px", lineHeight: 1.7 }}>
          <div><span style={{ color: "#888" }}>Key/path:</span> <span style={{ fontFamily: "monospace", fontSize: "9px" }}>{cand.sourceLocation}</span></div>
          <div><span style={{ color: "#888" }}>Payload shape:</span> {cand.payloadShape}</div>
          <div><span style={{ color: "#888" }}>Node count:</span> {cand.nodeCount}</div>
          {cand.elementTypeSummary && <div><span style={{ color: "#888" }}>Element types:</span> {cand.elementTypeSummary}</div>}
          {cand.classification?.projectId && <div><span style={{ color: "#888" }}>Payload projectId:</span> {cand.classification.projectId}</div>}
          {cand.savedAt && <div><span style={{ color: "#888" }}>savedAt:</span> {cand.savedAt}</div>}
          {cand.classification?.isMarker && (
            <div style={{ color: "#e65100" }}>⚠ This is a localStorage marker, not a payload.</div>
          )}
        </div>
      )}

      {attachConfirm && !attaching && (
        <div style={{ marginTop: "8px", padding: "8px 10px", backgroundColor: "#fff8e1",
          border: "1px solid #ffe082", borderRadius: "4px", fontSize: "11px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Confirm: Attach Script to Project + Backup to Supabase</div>
          <div style={{ color: "#555", lineHeight: 1.6, marginBottom: "8px", fontSize: "10px" }}>
            This will attach the selected Writing Script payload ({cand.nodeCount} nodes) to this project,
            save it to Supabase, save it to IndexedDB, create a ProjectCache script snapshot, and update
            the localStorage marker. <strong>It will not delete the original source record.</strong>
            {isOrphan && <span style={{ color: "#e65100" }}> Warning: This is an orphan candidate — verify it belongs to this project before attaching.</span>}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={async () => {
                setAttachConfirm(false);
                setAttaching(true);
                try {
                  const result = await attachRecoveredWritingScript(project, cand);
                  setAttachResult(result);
                  if (result.success && onAttachComplete) onAttachComplete(result);
                } catch (err) {
                  setAttachResult({ success: false, error: err?.message || "Unknown error" });
                } finally {
                  setAttaching(false);
                }
              }}
              style={{ padding: "4px 12px", borderRadius: "3px", border: "none",
                backgroundColor: "#1565c0", color: "white", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>
              Yes, attach and backup
            </button>
            <button onClick={() => setAttachConfirm(false)}
              style={{ padding: "4px 10px", borderRadius: "3px", border: "1px solid #bbb",
                backgroundColor: "white", cursor: "pointer", fontSize: "11px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Script payload status banner ─────────────────────────────────────────────

function ScriptBackupStatusBanner({ backupStatus }) {
  if (!backupStatus) return null;
  const allGood = backupStatus.supabaseHasPayload && backupStatus.idbHasPayload && backupStatus.projectCacheHasSnapshot;
  const allMissing = !backupStatus.supabaseHasPayload && !backupStatus.idbHasPayload && !backupStatus.projectCacheHasSnapshot;

  return (
    <div style={{
      padding: "6px 10px", borderRadius: "4px", marginBottom: "8px", fontSize: "10px",
      backgroundColor: allGood ? "#e8f5e9" : allMissing ? "#ffebee" : "#fff8e1",
      border: `1px solid ${allGood ? "#a5d6a7" : allMissing ? "#ef9a9a" : "#ffe082"}`,
    }}>
      <div style={{ fontWeight: "bold", marginBottom: "2px", color: allGood ? "#2e7d32" : allMissing ? "#c62828" : "#e65100" }}>
        Script Backup Status
      </div>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        {[
          { label: "Supabase", ok: backupStatus.supabaseHasPayload, count: backupStatus.supabaseNodeCount },
          { label: "IDB Drafts", ok: backupStatus.idbHasPayload, count: backupStatus.idbNodeCount },
          { label: "ProjectCache", ok: backupStatus.projectCacheHasSnapshot },
          { label: "LS Marker", ok: backupStatus.lsMarkerValid ?? backupStatus.lsMarkerPresent },
        ].map(({ label, ok, count }) => (
          <span key={label} style={{ color: ok ? "#2e7d32" : "#c62828" }}>
            {ok ? "✓" : "✗"} {label}{count !== undefined ? `: ${count} nodes` : ""}
          </span>
        ))}
        <span style={{ color: "#888" }}>Versions: {backupStatus.projectCacheVersionCount ?? 0}</span>
      </div>
    </div>
  );
}

// ─── Script recovery section ──────────────────────────────────────────────────

function ScriptRecoverySection({ project, onAttachComplete }) {
  const [scriptScan, setScriptScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const result = await scanWritingScriptRecoverySources(project);
      setScriptScan(result);
      // Auto-expand if there's a problem
      if (!result.backupStatus?.supabaseHasPayload || result.recoverableCandidates.length > 1) {
        setExpanded(true);
      }
    } catch (err) {
      setScriptScan({ error: err?.message, candidates: [], recoverableCandidates: [], backupStatus: null });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => { runScan(); }, [project?.id]);

  if (!scriptScan && !scanning) return null;

  return (
    <div style={{ marginTop: "14px", borderTop: "2px solid #e3f2fd", paddingTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1565c0" }}>
          Writing Script Payload Candidates
        </div>
        {!scanning && <button onClick={runScan}
          style={{ padding: "2px 7px", fontSize: "10px", borderRadius: "3px", border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer" }}>
          Rescan
        </button>}
        {!scanning && <button onClick={() => setExpanded(p => !p)}
          style={{ padding: "2px 7px", fontSize: "10px", borderRadius: "3px", border: "1px solid #ccc", backgroundColor: "#f5f5f5", cursor: "pointer" }}>
          {expanded ? "Collapse" : "Expand"}
        </button>}
        {scanning && <span style={{ fontSize: "10px", color: "#888" }}>Scanning…</span>}
      </div>

      {scriptScan?.backupStatus && (
        <ScriptBackupStatusBanner backupStatus={scriptScan.backupStatus} />
      )}
      {scriptScan?.error && (
        <div style={{ fontSize: "10px", color: "#c62828", marginBottom: "6px" }}>⚠ Scan error: {scriptScan.error}</div>
      )}

      {expanded && scriptScan && !scanning && (
        <>
          {scriptScan.recoverableCandidates.length === 0 && scriptScan.orphanCandidates.length === 0 && (
            <div style={{ fontSize: "11px", color: "#888", padding: "6px 0" }}>
              No recoverable script payloads found. Supabase is the only available source.
            </div>
          )}
          {scriptScan.candidates.filter(c => c.recoverable || c.orphanRecoverable).map(c => (
            <ScriptCandidateRow
              key={c.candidateId}
              cand={c}
              project={project}
              onAttachComplete={onAttachComplete}
            />
          ))}
          {/* Show non-recoverable candidates collapsed */}
          {scriptScan.candidates.filter(c => !c.recoverable && !c.orphanRecoverable && c.confidence !== "error").length > 0 && (
            <details style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>
              <summary style={{ cursor: "pointer" }}>
                {scriptScan.candidates.filter(c => !c.recoverable && !c.orphanRecoverable).length} non-recoverable / marker-only sources
              </summary>
              {scriptScan.candidates.filter(c => !c.recoverable && !c.orphanRecoverable).map(c => (
                <div key={c.candidateId} style={{ padding: "3px 6px", fontFamily: "monospace", fontSize: "9px" }}>
                  {c.sourceType}: {c.sourceLocation} — {c.payloadShape} — {c.warnings?.[0] || ""}
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ProjectRecoveryModal({ scanReport, onChoose, onCancel, project }) {
  const [selectedId, setSelectedId] = useState(() => {
    // Default to Supabase if it has content, else first loadable non-empty candidate.
    const sup = scanReport.candidates.find(c => c.id === "supabase");
    if (sup && !sup.isEmpty) return "supabase";
    const first = scanReport.candidates.find(c => c.loadable && !c.isEmpty);
    return first?.id || "supabase";
  });
  const [scriptAttachDone, setScriptAttachDone] = useState(false);

  const selectedCandidate = scanReport.candidates.find(c => c.id === selectedId);
  const canConfirm = selectedCandidate?.loadable === true;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 110000, backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Questrial','Futura','Arial',sans-serif", padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "white", borderRadius: "8px",
          width: "min(680px, calc(100vw - 24px))", maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.28)", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 22px 12px", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "18px", color: "#e65100" }}>&#9888;</span>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "bold" }}>
              Choose Project Recovery Source — {scanReport.projectName}
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "#555", lineHeight: 1.6 }}>
            Multiple or conflicting storage states were detected. Choose which source to load.
            <strong> This modal does not save, delete, or sync anything.</strong>
            {" "}Candidates marked <em>view-only</em> cannot be opened directly — use Inspect to review their content.
          </p>
          {scanReport.warnings.length > 0 && (
            <div style={{ marginTop: "6px" }}>
              {scanReport.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: "11px", color: "#e65100" }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>

        {/* Candidate list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px" }}>
          <div style={{ fontSize: "10px", color: "#888", marginBottom: "8px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Available sources — select a loadable source to open with
          </div>
          {scanReport.candidates.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selectedId === c.id}
              onSelect={setSelectedId}
            />
          ))}
          {scanReport.candidates.length === 0 && (
            <div style={{ fontSize: "12px", color: "#888", padding: "20px 0" }}>
              No candidates found. Use Supabase/database to open normally.
            </div>
          )}

          {project && (
            <ScriptRecoverySection
              project={project}
              onAttachComplete={(result) => {
                setScriptAttachDone(true);
                if (process.env.NODE_ENV === "development") {
                  console.info("[ProjectRecoveryModal] Script attach completed:", result);
                }
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px", borderTop: "1px solid #e0e0e0",
          display: "flex", gap: "8px", justifyContent: "flex-end",
          flexShrink: 0, backgroundColor: "#fafafa", flexWrap: "wrap",
        }}>
          <button
            onClick={onCancel}
            style={{ padding: "7px 16px", borderRadius: "4px", border: "1px solid #bbb", backgroundColor: "white", cursor: "pointer", fontSize: "13px" }}
          >
            Cancel (return to projects)
          </button>
          <button
            onClick={() => onChoose({ candidateId: "supabase", sourceType: "supabase", candidate: scanReport.candidates.find(c => c.id === "supabase") })}
            style={{ padding: "7px 14px", borderRadius: "4px", border: "1px solid #90caf9", backgroundColor: "#e3f2fd", color: "#0d47a1", cursor: "pointer", fontSize: "12px" }}
          >
            Open using Supabase/database
          </button>
          <button
            disabled={!canConfirm}
            title={!canConfirm ? "Selected source is view-only or empty — choose a loadable source." : ""}
            onClick={() => canConfirm && onChoose({ candidateId: selectedId, sourceType: selectedCandidate.sourceType, candidate: selectedCandidate })}
            style={{
              padding: "7px 18px", borderRadius: "4px", border: "none",
              backgroundColor: canConfirm ? "#1976d2" : "#bbb",
              color: "white", cursor: canConfirm ? "pointer" : "not-allowed",
              fontSize: "13px", fontWeight: "bold",
            }}
          >
            Open using selected source
          </button>
        </div>
      </div>
    </div>
  );
}
