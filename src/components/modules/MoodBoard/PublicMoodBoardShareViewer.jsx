import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../supabase";

function getTokenFromPath() {
  const match = window.location.pathname.match(/^\/share\/moodboard\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ─── BOARDS navigation panel ──────────────────────────────────────────────────
function PublicBoardsPanel({ boards, activeBoardId, activePageId, onSelectBoard, onSelectPage }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set(boards.map(b => b.id)));

  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      for (const board of boards) next.add(board.id);
      return next;
    });
  }, [boards]);

  return (
    <div style={{
      width: 220, flexShrink: 0, height: "100%",
      backgroundColor: "#f7f7f7", borderRight: "1px solid #ddd",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #ddd", flexShrink: 0 }}>
        <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "1px" }}>BOARDS</div>
        <div style={{ fontSize: "10px", color: "#aaa" }}>View only</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {boards.map(board => {
          const isActiveBoard = board.id === activeBoardId;
          const isExpanded = expandedIds.has(board.id);
          const pages = board.pages || [];
          return (
            <React.Fragment key={board.id}>
              <div
                onClick={() => {
                  setExpandedIds(prev => {
                    const next = new Set(prev);
                    next.add(board.id);
                    return next;
                  });
                  onSelectBoard(board.id);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "6px 8px",
                  backgroundColor: isActiveBoard && !activePageId ? "#d7ecff" : isActiveBoard ? "#eef7ff" : "white",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                }}
              >
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(board.id)) next.delete(board.id); else next.add(board.id);
                      return next;
                    });
                  }}
                  style={{ fontSize: "10px", color: "#888", flexShrink: 0 }}
                >
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: isActiveBoard && !activePageId ? "bold" : "normal",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {board.name}
                </span>
              </div>
              {isExpanded && pages.map((pg, pgIdx) => {
                const isActivePg = isActiveBoard && pg.id === activePageId;
                return (
                  <div
                    key={pg.id}
                    onClick={() => onSelectPage(board.id, pg.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      padding: "4px 8px 4px 22px",
                      backgroundColor: isActivePg ? "#bbdefb" : "#f9f9f9",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "#bbb", flexShrink: 0 }}>⠿</span>
                    <span style={{
                      fontSize: "11px", flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontWeight: isActivePg ? "bold" : "normal", color: "#444",
                    }}>
                      {pg.name || `Page ${pgIdx + 1}`}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main public viewer ───────────────────────────────────────────────────────
export default function PublicMoodBoardShareViewer() {
  const [status, setStatus] = useState("loading");
  const [payload, setPayload] = useState(null);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [activePageId, setActivePageId] = useState(null);
  const token = useMemo(() => getTokenFromPath(), []);
  const preloadedImagesRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!token) { setStatus("unavailable"); return; }
      setStatus("loading");
      try {
        const { data, error } = await supabase.rpc("get_shared_moodboard_by_token", { p_token: token });
        if (error) throw error;
        if (cancelled) return;
        if (!data) { setStatus("unavailable"); return; }
        setPayload(data);
        const snapshots = data.shareSnapshots || [];
        if (snapshots.length > 0) {
          setActiveBoardId(snapshots[0].boardId);
          setActivePageId(null);
        }
        setStatus("ready");
      } catch (err) {
        console.error("Could not load shared moodboard:", err);
        if (!cancelled) setStatus("unavailable");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const images = [];
    for (const snap of payload?.shareSnapshots || []) {
      if (snap?.imageUrl) {
        const img = new Image();
        img.src = snap.imageUrl;
        images.push(img);
      }
    }
    preloadedImagesRef.current = images;
  }, [payload]);

  // Derive board list with page lists from flat snapshots array
  const boards = useMemo(() => {
    const snapshots = payload?.shareSnapshots || [];
    const boardMap = new Map();
    for (const snap of snapshots) {
      if (!boardMap.has(snap.boardId)) {
        boardMap.set(snap.boardId, { id: snap.boardId, name: snap.boardName, pages: [] });
      }
      boardMap.get(snap.boardId).pages.push({ id: snap.pageId, name: snap.pageName });
    }
    return Array.from(boardMap.values());
  }, [payload]);

  const activeSnapshots = useMemo(() => {
    if (!activeBoardId) return [];
    const snapshots = payload?.shareSnapshots || [];
    if (activePageId) {
      return snapshots.filter(s => s.boardId === activeBoardId && s.pageId === activePageId);
    }
    return snapshots.filter(s => s.boardId === activeBoardId);
  }, [payload, activeBoardId, activePageId]);

  const handleSelectBoard = useCallback((boardId) => {
    setActiveBoardId(boardId);
    setActivePageId(null);
  }, []);

  const handleSelectPage = useCallback((boardId, pageId) => {
    setActiveBoardId(boardId);
    setActivePageId(pageId);
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'Questrial','Futura','Arial',sans-serif", color: "#607D8B" }}>
        Loading shared mood board…
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f5f7", fontFamily: "'Questrial','Futura','Arial',sans-serif", color: "#455A64", padding: "24px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "420px", padding: "28px", backgroundColor: "white", border: "1px solid #d7dde2", borderRadius: "8px", boxShadow: "0 4px 18px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "20px" }}>This mood board link is unavailable.</h1>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5 }}>The link may have been revoked, expired, or entered incorrectly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f3f5f7", fontFamily: "'Questrial','Futura','Arial',sans-serif" }}>
      {/* Header */}
      <header style={{
        flexShrink: 0, padding: "10px 16px",
        backgroundColor: "white", borderBottom: "1px solid #d7dde2",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "#607D8B", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Shared mood board · view only
          </div>
          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#263238", marginTop: "2px" }}>
            {payload?.projectName || "Shared Mood Board"}
          </div>
        </div>
        {payload?.sharedAt && (
          <div style={{ fontSize: "11px", color: "#78909C", whiteSpace: "nowrap" }}>
            Shared {new Date(payload.sharedAt).toLocaleDateString()}
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <PublicBoardsPanel
          boards={boards}
          activeBoardId={activeBoardId}
          activePageId={activePageId}
          onSelectBoard={handleSelectBoard}
          onSelectPage={handleSelectPage}
        />

        {/* Image display area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: "#e8eaed",
          }}
        >
          {activeSnapshots.length === 0 ? (
            <div style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "14px",
            }}>
              No pages available.
            </div>
          ) : (
            <div style={{
              minHeight: "100%",
              boxSizing: "border-box",
              padding: activePageId ? "28px" : "32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: activePageId ? 0 : "32px",
            }}>
              {activeSnapshots.map(snap => (
                <img
                  key={`${snap.boardId}-${snap.pageId}-${snap.imageUrl}`}
                  src={snap.imageUrl}
                  alt={snap.pageName || "Board page"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: activePageId ? "calc(100vh - 132px)" : "none",
                    width: snap.width ? `min(100%, ${snap.width}px)` : "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
                    borderRadius: "2px",
                    backgroundColor: "white",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
