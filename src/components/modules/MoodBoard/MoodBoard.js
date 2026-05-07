import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../supabase";

const GRID_SIZE = 10;
const STORAGE_VERSION = 2;
const STORAGE_KEY_PREFIX = "filmProductionBinder:moodboard:";
const TOOLBAR_RESERVED_HEIGHT = 118;
const LEFT_PANEL_WIDTH = 510;

const CANVAS_PRESETS = [
  { key: "pitch_16x9", label: "Pitch Deck 16:9", width: 1600, height: 900 },
  { key: "pitch_4x3", label: "Pitch Deck 4:3", width: 1400, height: 1050 },
  { key: "poster_vertical", label: "Poster Vertical", width: 1200, height: 1800 },
  { key: "poster_horizontal", label: "Poster Horizontal", width: 1800, height: 1200 },
  { key: "instagram_square", label: "Instagram Square", width: 1080, height: 1080 },
  { key: "instagram_story", label: "Instagram Story", width: 1080, height: 1920 },
  { key: "lookbook", label: "Lookbook Page", width: 1400, height: 1800 },
  { key: "custom", label: "Custom", width: 1600, height: 900 },
];

const FONT_OPTIONS = [
  { name: "Arial", vibe: "Clean sans" },
  { name: "Helvetica", vibe: "Modern neutral" },
  { name: "Futura", vibe: "Geometric" },
  { name: "Century Gothic", vibe: "Rounded modern" },
  { name: "Avenir", vibe: "Soft modern" },
  { name: "Gill Sans", vibe: "Humanist" },
  { name: "Verdana", vibe: "Readable" },
  { name: "Georgia", vibe: "Classic serif" },
  { name: "Times New Roman", vibe: "Traditional" },
  { name: "Palatino", vibe: "Bookish serif" },
  { name: "Didot", vibe: "Fashion editorial" },
  { name: "Bodoni 72", vibe: "High contrast" },
  { name: "Courier New", vibe: "Typewriter" },
  { name: "American Typewriter", vibe: "Analog" },
  { name: "Impact", vibe: "Bold title" },
  { name: "Copperplate", vibe: "Poster title" },
  { name: "Marker Felt", vibe: "Handmade" },
  { name: "Brush Script MT", vibe: "Script" },
];

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function snap(value, grid = GRID_SIZE) {
  return Math.round(value / grid) * grid;
}

function getStorageKey(selectedProject) {
  const projectId = selectedProject?.id || selectedProject?.name || "default-project";
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function getImageRatio(image) {
  if (!image?.width || !image?.height) return 1.5;
  return image.width / image.height;
}

function isLikelyPinterestUrl(url) {
  return /pinterest\.|pin\.it/i.test(url || "");
}

function isLikelyInstagramUrl(url) {
  return /instagram\.com/i.test(url || "");
}

function isLikelyImageUrl(url) {
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url || "");
}

function detectSourceType(url) {
  if (isLikelyPinterestUrl(url)) return "pinterest";
  if (isLikelyInstagramUrl(url)) return "instagram";
  if (isLikelyImageUrl(url)) return "image-url";
  return "link";
}

function getSourceLabel(type) {
  if (type === "pinterest") return "Pinterest";
  if (type === "instagram") return "Instagram";
  if (type === "image-url") return "Image URL";
  if (type === "local") return "Local Upload";
  if (type === "sample") return "Sample";
  return "Link";
}

function getPresetByKey(key) {
  return CANVAS_PRESETS.find((preset) => preset.key === key) || CANVAS_PRESETS[0];
}

function makePage(index = 1, presetKey = "pitch_16x9") {
  const preset = getPresetByKey(presetKey);
  return {
    id: makeId("page"),
    name: `Page ${index}`,
    presetKey,
    width: preset.width,
    height: preset.height,
    backgroundColor: "#ffffff",
  };
}

function makeBoard(index = 1, createdBy = "") {
  const page = makePage(1);
  return {
    id: makeId("board"),
    name: `Mood Board ${index}`,
    createdAt: new Date().toISOString(),
    createdBy,
    pages: [page],
    activePageId: page.id,
  };
}

function getImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 900, height: img.naturalHeight || 600 });
    img.onerror = () => resolve({ width: 900, height: 600 });
    img.src = url;
  });
}

function normalizeImportedState(parsed) {
  const boards = parsed?.boards?.length ? parsed.boards : [makeBoard(1)];
  const migratedBoards = boards.map((board, boardIndex) => {
    if (board.pages?.length) return board;
    const page = makePage(1);
    return {
      ...board,
      pages: [page],
      activePageId: page.id,
      name: board.name || `Mood Board ${boardIndex + 1}`,
    };
  });

  const firstBoard = migratedBoards[0];
  return {
    boards: migratedBoards,
    activeBoardId: parsed?.activeBoardId || firstBoard?.id || null,
    links: parsed?.links || [],
    images: parsed?.images?.length ? parsed.images : [],
    canvasItems: (parsed?.canvasItems || []).map((item) => {
      if (item.pageId) return item;
      const board = migratedBoards.find((b) => b.id === item.boardId) || firstBoard;
      return { ...item, pageId: board?.pages?.[0]?.id || null };
    }),
    zoom: parsed?.zoom || 0.65,
    showGrid: parsed?.showGrid ?? true,
  };
}

function getContrastColor(url) {
  // Returns a promise resolving to "white" or "black" based on image brightness
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 20;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        // Sample bottom strip where the label will appear
        ctx.drawImage(img, 0, img.height * 0.75, img.width, img.height * 0.25, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          brightness += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
        }
        brightness /= (data.length / 4);
        resolve(brightness > 128 ? "#111111" : "#ffffff");
      } catch {
        resolve("#ffffff");
      }
    };
    img.onerror = () => resolve("#ffffff");
    img.src = url;
  });
}

function RollImage({ image, canEdit, isViewOnly, onDragStart, onDragEnd, onDragOver, onDoubleClick, onDelete, onRenameTitle, onLightbox, isDragging, isDragOver }) {
  const [textColor, setTextColor] = useState("#ffffff");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(image.title || "");
  const inputRef = useRef(null);

  useEffect(() => {
    getContrastColor(image.url).then(setTextColor);
  }, [image.url]);

  useEffect(() => {
    if (editing) {
      setDraft(image.title || "");
      setTimeout(() => { inputRef.current?.select(); }, 10);
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== image.title) onRenameTitle(trimmed);
    setEditing(false);
  };

  return (
    <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onDragOver={(e) => { e.preventDefault(); onDragOver?.(); }}
    onDoubleClick={onDoubleClick}
    style={{ breakInside: "avoid", marginBottom: "8px", backgroundColor: "#222", border: isDragOver ? "2px solid #2196F3" : "1px solid #ddd", borderRadius: "4px", overflow: "hidden", cursor: "grab", position: "relative", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s, border 0.1s" }}
    >
      {image.uploading && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
          <div style={{ color: "white", fontSize: "10px", fontWeight: "bold" }}>Saving…</div>
        </div>
      )}
      <img src={image.url} alt={image.title || "Reference"} draggable={false} onClick={(e) => { e.stopPropagation(); onLightbox?.(); }} style={{ width: "100%", height: "auto", display: "block", cursor: "zoom-in" }} />

      {/* Bottom label — always visible over image */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "3px 22px 3px 4px", background: "linear-gradient(transparent, rgba(0,0,0,0.45))", minHeight: "20px", display: "flex", alignItems: "flex-end" }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditing(false); }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", fontSize: "9px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", outline: "1px solid #2196F3", borderRadius: "2px", padding: "1px 3px" }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); if (canEdit && !isViewOnly) setEditing(true); }}
            style={{ fontSize: "9px", color: textColor, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", display: "block", textShadow: textColor === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.8)" : "0 1px 2px rgba(255,255,255,0.6)", cursor: canEdit && !isViewOnly ? "text" : "default" }}>
            {image.title || "Untitled"}
          </span>
        )}
      </div>

      {/* Delete button — bottom right */}
      {canEdit && !isViewOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Remove from Roll"
          style={{ position: "absolute", bottom: "2px", right: "2px", width: "14px", height: "14px", backgroundColor: "#E53935", color: "white", border: "none", borderRadius: "50%", fontSize: "9px", lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", padding: 0, zIndex: 2 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function MoodBoard({ selectedProject, userRole, canEdit = true, isViewOnly = false, user = null, onMoodboardDataChange = null }) {
  const fileInputRef = useRef(null);
  const boardScrollRef = useRef(null);
  const didLoadRef = useRef(false);
  const draggingRollImageRef = useRef(null);
  const pageRefs = useRef({});
  const dragRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const zoomRef = useRef(0.65);
  const gridSizeRef = useRef(GRID_SIZE);

  const [boards, setBoards] = useState([makeBoard(1)]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [links, setLinks] = useState([]);
  const [images, setImages] = useState([]);
  const [canvasItems, setCanvasItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [activeInputTab, setActiveInputTab] = useState("links");
  const [newBoardName, setNewBoardName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualImageTitle, setManualImageTitle] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("Saved locally only. No database writes are happening.");
  const [zoom, setZoom] = useState(0.65);
  const [showGrid, setShowGrid] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [presentPageIndex, setPresentPageIndex] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // { url, title }
  const pageExportRefs = useRef({});
  const [editingTextId, setEditingTextId] = useState(null);
  const [resizingPage, setResizingPage] = useState(null);
  const [gridSize, setGridSize] = useState(GRID_SIZE);
  const [selectionBox, setSelectionBox] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState({ pageId: null, x: [], y: [] });
  const [layerDrag, setLayerDrag] = useState(null);
  const [renamingLayerId, setRenamingLayerId] = useState(null);
  const [renamingLayerDraft, setRenamingLayerDraft] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const userDisplayNameRef = useRef("");
  const [rollDragId, setRollDragId] = useState(null);
  const [rollDragOverId, setRollDragOverId] = useState(null);
  const dbSaveTimerRef = useRef(null);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);

  useEffect(() => {
    onMoodboardDataChange?.({
      images,
      canvasItems,
      boards,
      activeBoardId,
    });
  }, [images, canvasItems, boards, activeBoardId, onMoodboardDataChange]);

  // Stamp createdBy on boards that were loaded before display name was ready
  useEffect(() => {
    if (!userDisplayName || !didLoadRef.current) return;
    setBoards(prev => prev.map(b => b.createdBy ? b : { ...b, createdBy: userDisplayName }));
  }, [userDisplayName]);

  useEffect(() => {
    const fetchName = async () => {
      try {
        // Get auth user directly — don't depend on prop being passed
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (!authUser) return;
        const { data } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", authUser.id)
          .single();
        const name = data?.display_name || authUser.email?.split("@")[0] || "";
        if (name) {
          setUserDisplayName(name);
          userDisplayNameRef.current = name;
        }
      } catch (err) {
        console.error("MoodBoard: failed to fetch display name", err);
      }
    };
    fetchName();
  }, []);

  const storageKey = useMemo(() => getStorageKey(selectedProject), [selectedProject]);

  useEffect(() => {
    didLoadRef.current = false;
    const applyNormalized = (normalized, currentUserName) => {
      // Stamp createdBy on existing boards that predate this feature
      const stamped = normalized.boards.map(b =>
        b.createdBy ? b : { ...b, createdBy: currentUserName || "" }
      );
      setBoards(stamped);
      setActiveBoardId(normalized.activeBoardId);
      setLinks(normalized.links);
      setImages(normalized.images);
      setCanvasItems(normalized.canvasItems);
      setZoom(normalized.zoom);
      setShowGrid(normalized.showGrid);
      setSelectedItemIds([]);
    };

    const loadFromLocal = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
          const board = makeBoard(1, userDisplayNameRef.current || user?.email || "");
          setBoards([board]);
          setActiveBoardId(board.id);
          setLinks([]); setImages([]); setCanvasItems([]); setSelectedItemIds([]);
          setStatusMessage("New moodboard ready.");
          return;
        }
        applyNormalized(normalizeImportedState(JSON.parse(raw)), userDisplayNameRef.current);
        setStatusMessage("Loaded local MoodBoard data.");
      } catch (err) {
        console.error("Failed to load local MoodBoard:", err);
        setStatusMessage("Could not load MoodBoard data.");
      }
    };

    const load = async () => {
      if (!selectedProject?.id) { loadFromLocal(); didLoadRef.current = true; return; }
      try {
        const { data, error } = await supabase
          .from("moodboard_data")
          .select("*")
          .eq("project_id", selectedProject.id)
          .maybeSingle();
          if (!error && data) {
            applyNormalized(normalizeImportedState({
              boards: data.boards, activeBoardId: data.active_board_id,
              links: data.links, images: data.images,
              canvasItems: data.canvas_items, zoom: data.zoom, showGrid: data.show_grid,
            }), userDisplayNameRef.current);
            setStatusMessage("Loaded MoodBoard from database.");
          } else {
            loadFromLocal();
          }
      } catch (err) {
        console.error("MoodBoard DB load error:", err);
        loadFromLocal();
      } finally {
        setTimeout(() => { didLoadRef.current = true; }, 0);
      }
    };

    load();
  }, [storageKey, selectedProject?.id]);

  useEffect(() => {
    if (!didLoadRef.current) return;
    // Always save to localStorage immediately
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        version: STORAGE_VERSION, savedAt: new Date().toISOString(),
        activeBoardId, boards, links, images, canvasItems, zoom, showGrid,
      }));
    } catch (err) {
      console.error("Local save failed:", err);
    }
    // Debounced save to Supabase
    clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(async () => {
      if (!selectedProject?.id) return;
      try {
        const { error } = await supabase.from("moodboard_data").upsert({
          project_id: selectedProject.id,
          active_board_id: activeBoardId,
          boards, links, images,
          canvas_items: canvasItems,
          zoom, show_grid: showGrid,
          updated_at: new Date().toISOString(),
        }, { onConflict: "project_id" });
        if (error) throw error;
      } catch (err) {
        console.error("MoodBoard DB save error:", err);
      }
    }, 2000);
  }, [storageKey, activeBoardId, boards, links, images, canvasItems, zoom, showGrid, selectedProject?.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const tagName = target?.tagName;

      const isEditingTextBox = editingTextId !== null;
      const isTypingInFormControl = tagName === "INPUT" || tagName === "SELECT" || isEditingTextBox;

      if (isTypingInFormControl) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedItemIds.length) {
          event.preventDefault();
          deleteSelectedItems();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemIds, editingTextId]);

  const activeBoard = useMemo(() => {
    if (!boards.length) return null;
    return boards.find((b) => b.id === activeBoardId) || boards[0];
  }, [boards, activeBoardId]);

  const boardPages = activeBoard?.pages || [];
  const activePage = useMemo(() => {
    if (!activeBoard) return null;
    return activeBoard.pages.find((p) => p.id === activeBoard.activePageId) || activeBoard.pages[0] || null;
  }, [activeBoard]);

  const selectedItems = useMemo(() => {
    const ids = new Set(selectedItemIds);
    return canvasItems.filter((item) => ids.has(item.id));
  }, [canvasItems, selectedItemIds]);

  const primarySelectedItem = selectedItems[0] || null;

  const filteredImages = useMemo(() => {
    const q = rollSearch.trim().toLowerCase();
    if (!q) return images;
    return images.filter((image) => [image.title, image.url, image.originalUrl, image.source].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [images, rollSearch]);

  const activeBoardItems = useMemo(() => {
    if (!activeBoard) return [];
    const pageIds = new Set(activeBoard.pages.map((p) => p.id));
    return canvasItems.filter((item) => item.boardId === activeBoard.id && pageIds.has(item.pageId));
  }, [canvasItems, activeBoard]);

  const fitToWidth = useCallback(() => {
    if (!boardPages.length) return;
    const maxWidth = Math.max(...boardPages.map((p) => p.width));
    const container = boardScrollRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth - 72;
    setZoom(parseFloat(Math.max(0.1, Math.min(1, availableWidth / maxWidth)).toFixed(2)));
  }, [boardPages]);

  const updateBoard = useCallback((boardId, updater) => {
    setBoards((prev) => prev.map((board) => (board.id === boardId ? updater(board) : board)));
  }, []);

  const updatePage = useCallback((pageId, patch) => {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      pages: board.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
    }));
  }, [activeBoard, updateBoard]);

  const setActivePage = useCallback((pageId) => {
    if (!activeBoard) return;
    updateBoard(activeBoard.id, (board) => ({ ...board, activePageId: pageId }));
  }, [activeBoard, updateBoard]);

  const addBoard = () => {
    const name = newBoardName.trim() || `Mood Board ${boards.length + 1}`;
    const board = makeBoard(boards.length + 1, userDisplayNameRef.current || userDisplayName || user?.email || "");
    board.name = name;
    setBoards((prev) => [...prev, board]);
    setActiveBoardId(board.id);
    setSelectedItemIds([]);
    setNewBoardName("");
  };

  const duplicateBoard = () => {
    if (!activeBoard) return;
    const pageIdMap = {};
    const newPages = activeBoard.pages.map((page, idx) => {
      const newPageId = makeId("page");
      pageIdMap[page.id] = newPageId;
      return { ...page, id: newPageId, name: page.name || `Page ${idx + 1}` };
    });
    const board = {
      ...activeBoard,
      id: makeId("board"),
      name: `${activeBoard.name} Copy`,
      createdAt: new Date().toISOString(),
      pages: newPages,
      activePageId: pageIdMap[activeBoard.activePageId] || newPages[0]?.id,
    };
    const copiedItems = activeBoardItems.map((item) => ({
      ...item,
      id: makeId(item.type === "text" ? "text" : "canvas_img"),
      boardId: board.id,
      pageId: pageIdMap[item.pageId],
      x: snap(item.x + 40),
      y: snap(item.y + 40),
    }));
    setBoards((prev) => [...prev, board]);
    setCanvasItems((prev) => [...prev, ...copiedItems]);
    setActiveBoardId(board.id);
    setSelectedItemIds([]);
  };

  const renameBoard = (boardId, name) => {
    updateBoard(boardId, (board) => ({ ...board, name }));
  };

  const deleteBoard = (boardId) => {
    if (boards.length <= 1) {
      setStatusMessage("At least one mood board is required.");
      return;
    }
    const remaining = boards.filter((board) => board.id !== boardId);
    setBoards(remaining);
    setCanvasItems((prev) => prev.filter((item) => item.boardId !== boardId));
    setSelectedItemIds([]);
    if (activeBoardId === boardId) setActiveBoardId(remaining[0]?.id || null);
  };

  const addPage = () => {
    if (!activeBoard) return;
    addPageToBoard(activeBoard.id, true);
  };

  const addPageToBoard = (boardId, makeActive = false) => {
    const targetBoard = boards.find((board) => board.id === boardId);
    if (!targetBoard) return;
    const sourcePage = targetBoard.pages[targetBoard.pages.length - 1];
    const page = makePage(targetBoard.pages.length + 1, sourcePage?.presetKey || "pitch_16x9");
    if (sourcePage) {
      page.width = sourcePage.width;
      page.height = sourcePage.height;
      page.presetKey = sourcePage.presetKey;
      page.backgroundColor = sourcePage.backgroundColor;
    }
    updateBoard(boardId, (board) => ({
      ...board,
      pages: [...board.pages, page],
      activePageId: makeActive ? page.id : board.activePageId,
    }));
    if (makeActive) {
      setActiveBoardId(boardId);
      setTimeout(() => pageRefs.current[page.id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  };

  const duplicatePage = (pageId) => {
    if (!activeBoard) return;
    const sourcePage = activeBoard.pages.find((page) => page.id === pageId);
    if (!sourcePage) return;
    const newPage = { ...sourcePage, id: makeId("page"), name: `${sourcePage.name || "Page"} Copy` };
    const pageItems = canvasItems.filter((item) => item.boardId === activeBoard.id && item.pageId === pageId);
    const copiedItems = pageItems.map((item) => ({
      ...item,
      id: makeId(item.type === "text" ? "text" : "canvas_img"),
      pageId: newPage.id,
      x: snap(item.x + 40),
      y: snap(item.y + 40),
    }));
    updateBoard(activeBoard.id, (board) => ({ ...board, pages: [...board.pages, newPage], activePageId: newPage.id }));
    setCanvasItems((prev) => [...prev, ...copiedItems]);
    setSelectedItemIds([]);
    setTimeout(() => pageRefs.current[newPage.id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const deletePage = (pageId) => {
    if (!activeBoard || activeBoard.pages.length <= 1) {
      setStatusMessage("At least one page is required per board.");
      return;
    }
    const remainingPages = activeBoard.pages.filter((page) => page.id !== pageId);
    updateBoard(activeBoard.id, (board) => ({
      ...board,
      pages: remainingPages,
      activePageId: board.activePageId === pageId ? remainingPages[0]?.id : board.activePageId,
    }));
    setCanvasItems((prev) => prev.filter((item) => item.pageId !== pageId));
    setSelectedItemIds([]);
  };

  const addSourceLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const type = detectSourceType(url);
    const link = {
      id: makeId("link"),
      type,
      title: newLinkTitle.trim() || `${getSourceLabel(type)} ${links.length + 1}`,
      url,
      lastCheckedAt: null,
      status: type === "pinterest" ? "saved-for-future-api" : "saved",
      imageCount: 0,
    };
    setLinks((prev) => [...prev, link]);
    setNewLinkUrl("");
    setNewLinkTitle("");
    setStatusMessage(`${getSourceLabel(type)} link saved locally.`);
  };

  const deleteSourceLink = (linkId) => {
    setLinks((prev) => prev.filter((link) => link.id !== linkId));
    setImages((prev) => prev.filter((image) => image.sourceLinkId !== linkId));
    setCanvasItems((prev) => prev.filter((item) => item.sourceLinkId !== linkId));
    setSelectedItemIds([]);
  };

  const addManualImageUrl = async () => {
    const url = manualImageUrl.trim();
    if (!url) return;
    setManualImageUrl("");
    const title = `Image URL ${images.length + 1}`;
    const tempId = makeId("img");

    // Add immediately with original URL so it appears in Roll right away
    setImages(prev => [...prev, {
      id: tempId,
      sourceLinkId: null,
      title,
      url,
      originalUrl: url,
      width: 900,
      height: 600,
      source: "image-url",
      uploading: true,
    }]);

    // Try to download via proxy and store in Supabase
    const { supabaseUrl } = await uploadImageFromUrl(url, title);
    setImages(prev => prev.map(img =>
      img.id === tempId
        ? { ...img, url: supabaseUrl || url, uploading: false }
        : img
    ));
    setStatusMessage(supabaseUrl ? "Image saved to storage." : "Image added (original URL).");
  };

  const addLocalFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = "";
    setStatusMessage(`Uploading ${files.length} image${files.length > 1 ? "s" : ""}...`);

    for (const file of files) {
      const tempId = makeId("img");
      const localUrl = URL.createObjectURL(file);

      // Add immediately with local blob URL
      setImages(prev => [...prev, {
        id: tempId,
        sourceLinkId: null,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url: localUrl,
        originalUrl: localUrl,
        width: 900,
        height: 600,
        source: "upload",
        uploading: true,
      }]);

      try {
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `${selectedProject?.id || "shared"}/${tempId}.${ext}`;
        const { error } = await supabase.storage
          .from("moodboard-images")
          .upload(filename, file, { contentType: file.type, upsert: false });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("moodboard-images")
          .getPublicUrl(filename);

        setImages(prev => prev.map(img =>
          img.id === tempId
            ? { ...img, url: urlData.publicUrl, originalUrl: urlData.publicUrl, uploading: false }
            : img
        ));
      } catch (err) {
        console.error("Upload error:", err);
        // Keep local URL as fallback
        setImages(prev => prev.map(img =>
          img.id === tempId ? { ...img, uploading: false } : img
        ));
      }
    }
    setStatusMessage(`Added ${files.length} image${files.length > 1 ? "s" : ""} to Roll.`);
  };

  const createCanvasImageItem = (image, page, x, y) => {
    const ratio = getImageRatio(image);
    const width = Math.min(320, Math.max(160, Math.round(page.width * 0.18)));
    const height = Math.round(width / ratio);

    const centeredX = x - width / 2;
    const centeredY = y - height / 2;

    const clampedX = Math.max(0, Math.min(snap(centeredX, gridSize), Math.max(0, page.width - width)));
    const clampedY = Math.max(0, Math.min(snap(centeredY, gridSize), Math.max(0, page.height - height)));

    return {
      id: makeId("canvas_img"),
      type: "image",
      boardId: activeBoard.id,
      pageId: page.id,
      imageId: image.id,
      sourceLinkId: image.sourceLinkId || null,
      x: clampedX,
      y: clampedY,
      width,
      height,
      objectFit: "contain",
      opacity: 1,
      locked: false,
      hidden: false,
      rotation: 0,
      _baseWidth: width,
      zIndex: (activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0)) + 1,
      name: image.title || "Image",
    };
  };

  const addImageToCanvas = (image, page = activePage, x = null, y = null) => {
    if (!activeBoard || !page) return;
    const dropX = x ?? page.width / 2;
    const dropY = y ?? page.height / 2;
    const item = createCanvasImageItem(image, page, dropX, dropY);
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
    setActivePage(page.id);
  };

  const addTextToCanvas = () => {
    if (!activeBoard || !activePage) return;
    const item = {
      id: makeId("text"),
      type: "text",
      boardId: activeBoard.id,
      pageId: activePage.id,
      text: "Text",
      x: 160,
      y: 160,
      width: 360,
      height: 100,
      fontFamily: "Futura",
      fontSize: 42,
      fontWeight: "bold",
      color: "#111111",
      backgroundColor: "transparent",
      letterSpacing: 0,
      lineHeight: 1.1,
      textAlign: "left",
      opacity: 1,
      locked: false,
      hidden: false,
      zIndex: (activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0)) + 1,
      name: "Text",
    };
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
  };

  const updateCanvasItem = useCallback((itemId, patch) => {
    setCanvasItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, []);

  const updateSelectedItems = (patch) => {
    const ids = new Set(selectedItemIds);
    setCanvasItems((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, ...patch } : item)));
  };

  const handleSelectItem = (event, itemId) => {
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
    } else {
      setSelectedItemIds([itemId]);
    }
  };

  const deleteImage = (imageId) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const proxyImageToBase64 = async (url) => {
    try {
      const res = await fetch(`/.netlify/functions/image-proxy?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      return data.dataUrl || null;
    } catch { return null; }
  };

  const uploadImageFromUrl = async (originalUrl, title = "") => {
    try {
      setStatusMessage("Downloading image...");
      // Fetch via proxy
      const proxyRes = await fetch(`/.netlify/functions/image-proxy?url=${encodeURIComponent(originalUrl)}`);
      const proxyData = await proxyRes.json();
      if (!proxyData.dataUrl) throw new Error("Proxy returned no data");

      // Convert base64 dataUrl to blob
      const [meta, b64] = proxyData.dataUrl.split(",");
      const mime = meta.match(/:(.*?);/)[1];
      const byteString = atob(b64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime });

      // Upload to Supabase Storage
      const ext = mime.split("/")[1] || "jpg";
      const filename = `${selectedProject?.id || "shared"}/${makeId("img")}.${ext}`;
      const { data: uploadData, error } = await supabase.storage
        .from("moodboard-images")
        .upload(filename, blob, { contentType: mime, upsert: false });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("moodboard-images")
        .getPublicUrl(filename);

      setStatusMessage("Image saved to storage.");
      return { supabaseUrl: urlData.publicUrl, originalUrl };
    } catch (err) {
      console.error("uploadImageFromUrl error:", err);
      setStatusMessage("Could not download image — using original URL.");
      return { supabaseUrl: null, originalUrl };
    }
  };

  const exportBoardToPdf = async () => {
    if (exportingPdf || !activeBoard || boardPages.length === 0) return;
    setExportingPdf(true);
    setStatusMessage("Preparing PDF export...");
    try {
      // Load jsPDF only — no html2canvas needed
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const { jsPDF } = window.jspdf;
      const firstPage = boardPages[0];
      const pdf = new jsPDF({
        orientation: firstPage.width > firstPage.height ? "landscape" : "portrait",
        unit: "px",
        format: [firstPage.width, firstPage.height],
        hotfixes: ["px_scaling"],
      });

      // Load custom fonts into canvas context via FontFace API
      setStatusMessage("Loading fonts...");
      const fontLoadPromises = FONT_OPTIONS.map(async (font) => {
        try {
          const googleName = font.name.replace(/ /g, "+");
          const cssUrl = `https://fonts.googleapis.com/css2?family=${googleName}:wght@400;700;900&display=swap`;
          // Fetch CSS to get actual font file URL
          const cssRes = await fetch(cssUrl);
          const cssText = await cssRes.text();
          const urlMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
          if (!urlMatch) return;
          const ff = new FontFace(font.name, `url(${urlMatch[1]})`);
          await ff.load();
          document.fonts.add(ff);
        } catch {} // silently skip fonts that fail to load
      });
      await Promise.allSettled(fontLoadPromises);
      await document.fonts.ready;

      // Load all images as HTMLImageElement objects upfront
      setStatusMessage("Loading images...");
      const loadedImgMap = {};
      const allImageItems = canvasItems.filter(item =>
        item.boardId === activeBoard.id && item.type === "image" && !item.hidden
      );
      await Promise.all(allImageItems.map(item => {
        const imgData = images.find(img => img.id === item.imageId);
        if (!imgData?.url || loadedImgMap[imgData.url]) return;
        return new Promise(res => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => { loadedImgMap[imgData.url] = el; res(); };
          el.onerror = () => {
            // Retry without crossOrigin for non-CORS sources
            const el2 = new Image();
            el2.onload = () => { loadedImgMap[imgData.url] = el2; res(); };
            el2.onerror = () => res(); // skip if truly broken
            el2.src = imgData.url;
          };
          el.src = imgData.url;
        });
      }));

      // Wait for fonts
      await document.fonts.ready;

      for (let i = 0; i < boardPages.length; i++) {
        const page = boardPages[i];
        setStatusMessage(`Rendering page ${i + 1} of ${boardPages.length}...`);

        // Create canvas at full page dimensions
        const cvs = document.createElement("canvas");
        cvs.width = page.width;
        cvs.height = page.height;
        const ctx = cvs.getContext("2d");

        // Background
        ctx.fillStyle = page.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, page.width, page.height);

        const pageItems = canvasItems
          .filter(item => item.boardId === activeBoard.id && item.pageId === page.id && !item.hidden)
          .sort((a, b) => a.zIndex - b.zIndex);

          for (const item of pageItems) {
            ctx.save();
            ctx.globalAlpha = item.opacity ?? 1;
  
            if (item.rotation) {
              const cx = item.x + item.width / 2;
              const cy = item.y + item.height / 2;
              ctx.translate(cx, cy);
              ctx.rotate((item.rotation * Math.PI) / 180);
              ctx.translate(-cx, -cy);
            }
  
            if (item.type === "image") {
            const imgData = images.find(img => img.id === item.imageId);
            const imgEl = imgData ? loadedImgMap[imgData.url] : null;
            if (imgEl) {
              const objectFit = item.objectFit || "contain";
              const iw = imgEl.naturalWidth;
              const ih = imgEl.naturalHeight;
              const bw = item.width;
              const bh = item.height;
              let sx = 0, sy = 0, sw = iw, sh = ih;
              let dx = item.x, dy = item.y, dw = bw, dh = bh;

              if (objectFit === "cover") {
                const scale = Math.max(bw / iw, bh / ih);
                const scaledW = iw * scale;
                const scaledH = ih * scale;
                sx = (iw - bw / scale) / 2;
                sy = (ih - bh / scale) / 2;
                sw = bw / scale;
                sh = bh / scale;
              } else {
                // contain
                const scale = Math.min(bw / iw, bh / ih);
                dw = iw * scale;
                dh = ih * scale;
                dx = item.x + (bw - dw) / 2;
                dy = item.y + (bh - dh) / 2;
              }

              ctx.beginPath();
              ctx.rect(item.x, item.y, item.width, item.height);
              ctx.clip();
              ctx.drawImage(imgEl, sx, sy, sw, sh, dx, dy, dw, dh);
            }

          } else if (item.type === "text") {
            // Background
            if (item.backgroundColor && item.backgroundColor !== "transparent") {
              ctx.fillStyle = item.backgroundColor;
              ctx.fillRect(item.x, item.y, item.width, item.height);
            }

            // Text — wrap manually to match the DOM layout
            const fontWeight = item.fontWeight || "normal";
            const fontSize = item.fontSize || 16;
            const fontFamily = item.fontFamily || "Arial";
            const lineHeightMult = item.lineHeight ?? 1.1;
            const lineHeight = fontSize * lineHeightMult;
            const letterSpacing = item.letterSpacing || 0;
            const padding = 6;
            const maxW = item.width - padding * 2;

            const textAlign = item.textAlign || "left";
            ctx.fillStyle = item.color || "#000000";
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
            ctx.textBaseline = "alphabetic";
            ctx.textAlign = textAlign;

            // Letter spacing via per-char drawing
            const drawTextWithSpacing = (text, x, y) => {
              if (letterSpacing === 0) {
                ctx.fillText(text, x, y);
                return;
              }
              let cx = x;
              for (const ch of text) {
                ctx.fillText(ch, cx, y);
                cx += ctx.measureText(ch).width + letterSpacing;
              }
            };

            // Word wrap — normalize whitespace to match CSS rendering
            // CSS collapses multiple spaces into one and ignores leading/trailing
            const rawLines = item.text.split("\n");
            const wrappedLines = [];
            for (const raw of rawLines) {
              // Collapse multiple spaces, trim — matches CSS white-space: normal behavior
              const normalized = raw.replace(/\s+/g, " ").trim();
              if (!normalized) { wrappedLines.push(""); continue; }
              const words = normalized.split(" ").filter(w => w.length > 0);
              let current = "";
              for (const word of words) {
                const test = current ? current + " " + word : word;
                const w = ctx.measureText(test).width + (letterSpacing * (test.length - 1));
                if (w > maxW && current) {
                  wrappedLines.push(current);
                  current = word;
                } else {
                  current = test;
                }
              }
              if (current) wrappedLines.push(current);
            }

            const trueLineHeight = fontSize * (item.lineHeight ?? 1.1);
            const baselineOffset = fontSize * 0.8;

            const textX = textAlign === "center"
              ? item.x + item.width / 2
              : textAlign === "right"
              ? item.x + item.width - padding
              : item.x + padding;

            let ty = item.y + padding + baselineOffset;
            for (const line of wrappedLines) {
              drawTextWithSpacing(line, textX, ty);
              ty += trueLineHeight;
              if (ty > item.y + item.height + trueLineHeight) break;
            }
          }

          ctx.restore();
        }

        const dataUrl = cvs.toDataURL("image/png");
        if (i > 0) pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, page.width, page.height);
      }

      pdf.save(`${activeBoard.name || "MoodBoard"}.pdf`);
      setStatusMessage(`Exported ${boardPages.length} page${boardPages.length > 1 ? "s" : ""} to PDF.`);
    } catch (err) {
      console.error("PDF export error:", err);
      setStatusMessage("PDF export failed: " + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  const reorderImages = (dragId, overId) => {
    if (!dragId || !overId || dragId === overId) return;
    setImages(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(img => img.id === dragId);
      const toIdx = arr.findIndex(img => img.id === overId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
  };

  const updateImageTitle = (imageId, title) => {
    setImages((prev) => prev.map((img) => img.id === imageId ? { ...img, title } : img));
  };

  const deleteSelectedItems = () => {
    if (!selectedItemIds.length) return;
    const ids = new Set(selectedItemIds);
    setCanvasItems((prev) => prev.filter((item) => !ids.has(item.id)));
    setSelectedItemIds([]);
  };

  const duplicateSelectedItems = () => {
    if (!selectedItems.length) return;
    const maxZ = activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0);
    const copies = selectedItems.map((item, idx) => ({
      ...item,
      id: makeId(item.type === "text" ? "text" : "canvas_img"),
      x: snap(item.x + 40),
      y: snap(item.y + 40),
      zIndex: maxZ + idx + 1,
    }));
    setCanvasItems((prev) => [...prev, ...copies]);
    setSelectedItemIds(copies.map((item) => item.id));
  };

  const bringForward = () => {
    selectedItems.forEach((item) => updateCanvasItem(item.id, { zIndex: item.zIndex + 1 }));
  };

  const sendBackward = () => {
    selectedItems.forEach((item) => updateCanvasItem(item.id, { zIndex: Math.max(1, item.zIndex - 1) }));
  };

  const GUIDE_THRESHOLD = 6;

  const startDrag = (e, item) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const alreadySelected = selectedItemIds.includes(item.id);
    let dragIds;
    if (e.shiftKey) {
      if (alreadySelected) { setSelectedItemIds(prev => prev.filter(id => id !== item.id)); return; }
      dragIds = [...selectedItemIds, item.id];
      setSelectedItemIds(dragIds);
    } else if (alreadySelected) {
      dragIds = selectedItemIds;
    } else {
      dragIds = [item.id];
      setSelectedItemIds(dragIds);
    }
    const startPositions = {};
    canvasItems.forEach(ci => { if (dragIds.includes(ci.id)) startPositions[ci.id] = { x: ci.x, y: ci.y }; });
    const page = boardPages.find(p => p.id === item.pageId);
    // Snapshot other items for guide calculation (frozen at drag start)
    const otherItems = canvasItems.filter(ci => ci.boardId === activeBoard?.id && ci.pageId === item.pageId && !dragIds.includes(ci.id) && !ci.hidden);
    dragRef.current = { type: "drag", itemIds: dragIds, startPointer: { x: e.clientX, y: e.clientY }, startPositions, page, otherItems, primaryId: dragIds[0], primarySize: { w: item.width, h: item.height }, moved: false };

    const calcGuides = (rawX, rawY, iW, iH, page, others) => {
      const xCandidates = [0, page.width / 2, page.width];
      const yCandidates = [0, page.height / 2, page.height];
      others.forEach(o => { xCandidates.push(o.x, o.x + o.width / 2, o.x + o.width); yCandidates.push(o.y, o.y + o.height / 2, o.y + o.height); });
      const snapPtsX = [rawX, rawX + iW / 2, rawX + iW];
      const snapPtsY = [rawY, rawY + iH / 2, rawY + iH];
      let bestX = null, bestXDist = GUIDE_THRESHOLD, snapOffsetX = 0;
      for (const g of xCandidates) { for (const sp of snapPtsX) { const d = Math.abs(sp - g); if (d < bestXDist) { bestXDist = d; bestX = g; snapOffsetX = g - sp; } } }
      let bestY = null, bestYDist = GUIDE_THRESHOLD, snapOffsetY = 0;
      for (const g of yCandidates) { for (const sp of snapPtsY) { const d = Math.abs(sp - g); if (d < bestYDist) { bestYDist = d; bestY = g; snapOffsetY = g - sp; } } }
      return { activeX: bestX !== null ? [bestX] : [], activeY: bestY !== null ? [bestY] : [], snapOffsetX, snapOffsetY };
    };

    const onMove = (me) => {
      if (!dragRef.current) return;
      dragRef.current.moved = true;
      const { itemIds, startPointer, startPositions, page, otherItems, primaryId, primarySize } = dragRef.current;
      if (!page) return;
      const dx = (me.clientX - startPointer.x) / zoomRef.current;
      const dy = (me.clientY - startPointer.y) / zoomRef.current;
      const g = gridSizeRef.current;
      const primaryStart = startPositions[primaryId];
      let snapX = 0, snapY = 0;
      let guideX = [], guideY = [];
      if (primaryStart && primarySize && itemIds.length === 1) {
        const rawX = primaryStart.x + dx;
        const rawY = primaryStart.y + dy;
        const guides = calcGuides(rawX, rawY, primarySize.w, primarySize.h, page, otherItems);
        snapX = guides.snapOffsetX; snapY = guides.snapOffsetY;
        guideX = guides.activeX; guideY = guides.activeY;
      }
      setAlignmentGuides({ pageId: page.id, x: guideX, y: guideY });
      setCanvasItems(prev => prev.map(ci => {
        if (!itemIds.includes(ci.id)) return ci;
        const s = startPositions[ci.id];
        if (!s) return ci;
        const MIN_VIS = 40;
        const nx = Math.max(MIN_VIS - ci.width, Math.min(snap(s.x + dx + snapX, g), page.width - MIN_VIS));
        const ny = Math.max(MIN_VIS - ci.height, Math.min(snap(s.y + dy + snapY, g), page.height - MIN_VIS));
        return { ...ci, x: nx, y: ny };
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      setAlignmentGuides({ pageId: null, x: [], y: [] });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResize = (e, item, handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const aspectRatio = item.type === "image" ? item.width / item.height : null;
    const minW = item.type === "text" ? 80 : 60;
    const minH = 40;
    const page = boardPages.find(p => p.id === item.pageId);
    dragRef.current = { type: "resize", itemId: item.id, handle, startPointer: { x: e.clientX, y: e.clientY }, startSize: { w: item.width, h: item.height }, startPos: { x: item.x, y: item.y }, page, aspectRatio, minW, minH };
    const onMove = (me) => {
      if (!dragRef.current || dragRef.current.type !== "resize") return;
      const { itemId, handle, startPointer, startSize, startPos, page, aspectRatio, minW, minH } = dragRef.current;
      if (!page) return;
      const dx = (me.clientX - startPointer.x) / zoomRef.current;
      const dy = (me.clientY - startPointer.y) / zoomRef.current;
      let nx = startPos.x, ny = startPos.y, nw = startSize.w, nh = startSize.h;
      if (handle.includes("e")) nw = Math.max(minW, startSize.w + dx);
      if (handle.includes("w")) { nw = Math.max(minW, startSize.w - dx); nx = startPos.x + startSize.w - nw; }
      if (handle.includes("s")) nh = Math.max(minH, startSize.h + dy);
      if (handle.includes("n")) { nh = Math.max(minH, startSize.h - dy); ny = startPos.y + startSize.h - nh; }
      if (aspectRatio) {
        const isCorner = handle.length === 2;
        if (isCorner) { if (Math.abs(dx) >= Math.abs(dy)) { nh = nw / aspectRatio; if (handle.includes("n")) ny = startPos.y + startSize.h - nh; } else { nw = nh * aspectRatio; if (handle.includes("w")) nx = startPos.x + startSize.w - nw; } }
        else if (handle === "e" || handle === "w") { nh = nw / aspectRatio; }
        else { nw = nh * aspectRatio; if (handle === "n") ny = startPos.y + startSize.h - nh; }
      }
      const g = gridSizeRef.current;
      nw = Math.max(minW, snap(nw, g)); nh = Math.max(minH, snap(nh, g));
      nx = Math.max(0, Math.min(snap(nx, g), page.width - nw));
      ny = Math.max(0, Math.min(snap(ny, g), page.height - nh));
      setCanvasItems(prev => prev.map(ci => ci.id === itemId ? { ...ci, x: nx, y: ny, width: nw, height: nh } : ci));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startPageResize = (e, page) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { type: "page-resize", pageId: page.id, startPointer: { x: e.clientX, y: e.clientY }, startSize: { w: page.width, h: page.height }, currentSize: { w: page.width, h: page.height } };
    const onMove = (me) => {
      if (!dragRef.current || dragRef.current.type !== "page-resize") return;
      const { startPointer, startSize } = dragRef.current;
      const dx = (me.clientX - startPointer.x) / zoomRef.current;
      const dy = (me.clientY - startPointer.y) / zoomRef.current;
      const nw = Math.max(480, snap(startSize.w + dx, gridSizeRef.current));
      const nh = Math.max(360, snap(startSize.h + dy, gridSizeRef.current));
      dragRef.current.currentSize = { w: nw, h: nh };
      setResizingPage({ pageId: dragRef.current.pageId, width: nw, height: nh });
    };
    const onUp = () => {
      if (dragRef.current?.type === "page-resize") {
        const { pageId, currentSize } = dragRef.current;
        updatePage(pageId, { width: currentSize.w, height: currentSize.h, presetKey: "custom" });
        setResizingPage(null);
        const container = boardScrollRef.current;
        if (container) setZoom(parseFloat(Math.max(0.1, Math.min(1, (container.clientWidth - 72) / currentSize.w)).toFixed(2)));
      }
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startSelectionBox = (e, page) => {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / zoomRef.current;
    const sy = (e.clientY - rect.top) / zoomRef.current;
    setSelectedItemIds([]);
    setEditingTextId(null);
    selectionBoxRef.current = { startX: sx, startY: sy, pageId: page.id };
    setSelectionBox({ pageId: page.id, x: sx, y: sy, w: 0, h: 0 });
    const onMove = (me) => {
      if (!selectionBoxRef.current) return;
      const { startX, startY } = selectionBoxRef.current;
      const cx = (me.clientX - rect.left) / zoomRef.current;
      const cy = (me.clientY - rect.top) / zoomRef.current;
      setSelectionBox({ pageId: page.id, x: Math.min(startX, cx), y: Math.min(startY, cy), w: Math.abs(cx - startX), h: Math.abs(cy - startY) });
    };
    const onUp = (ue) => {
      if (selectionBoxRef.current) {
        const { startX, startY } = selectionBoxRef.current;
        const cx = (ue.clientX - rect.left) / zoomRef.current;
        const cy = (ue.clientY - rect.top) / zoomRef.current;
        const selX = Math.min(startX, cx), selY = Math.min(startY, cy);
        const selW = Math.abs(cx - startX), selH = Math.abs(cy - startY);
        if (selW > 5 || selH > 5) {
          const hits = canvasItems.filter(ci => ci.boardId === activeBoard.id && ci.pageId === page.id && !ci.hidden && ci.x < selX + selW && ci.x + ci.width > selX && ci.y < selY + selH && ci.y + ci.height > selY);
          setSelectedItemIds(hits.map(ci => ci.id));
        }
      }
      selectionBoxRef.current = null;
      setSelectionBox(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const applyCanvasPreset = (pageId, presetKey) => {
    const preset = getPresetByKey(presetKey);
    updatePage(pageId, { presetKey, width: preset.width, height: preset.height });
  };

  const handlePageDrop = (event, page) => {
    event.preventDefault();
    event.stopPropagation();
    const image = draggingRollImageRef.current;
    if (!image) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / zoom;
    const rawY = (event.clientY - rect.top) / zoom;
    const item = createCanvasImageItem(image, page, rawX, rawY);
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
    setActivePage(page.id);
    draggingRollImageRef.current = null;
  };

  const changeLayerOrder = (itemId, direction) => {
    const item = canvasItems.find((entry) => entry.id === itemId);
    if (!item) return;

    const pageItems = canvasItems
      .filter((entry) => entry.boardId === item.boardId && entry.pageId === item.pageId)
      .sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1));

    const currentIndex = pageItems.findIndex((entry) => entry.id === itemId);
    const targetIndex = direction > 0 ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= pageItems.length) return;

    const reordered = [...pageItems];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    const zMap = {};
    reordered.forEach((entry, index) => {
      zMap[entry.id] = reordered.length - index;
    });

    setCanvasItems((prev) =>
      prev.map((entry) => (zMap[entry.id] ? { ...entry, zIndex: zMap[entry.id] } : entry))
    );
  };

  const toggleLayerVisibility = (itemId) => {
    const item = canvasItems.find((entry) => entry.id === itemId);
    if (!item) return;
    updateCanvasItem(itemId, { hidden: !item.hidden });
  };

  const clearLocalMoodBoard = () => {
    const board = makeBoard(1);
    setBoards([board]);
    setActiveBoardId(board.id);
    setLinks([]);
    setImages([]);
    setCanvasItems([]);
    setSelectedItemIds([]);
    localStorage.removeItem(storageKey);
    setStatusMessage("Local MoodBoard data cleared for this project.");
  };

  const renderLayerName = (item) => {
    if (item.type === "text") return item.text?.trim()?.slice(0, 30) || "Text";
    const image = images.find((img) => img.id === item.imageId);
    return image?.title || item.name || "Image";
  };

  const renderCanvasItem = (item) => {
    if (item.hidden) return null;
    const image = item.type === "image" ? images.find((img) => img.id === item.imageId) : null;
    const isSelected = selectedItemIds.includes(item.id);
    const locked = item.locked || isViewOnly || !canEdit;
    const HANDLE_DIRS = ["nw","n","ne","w","e","sw","s","se"];
    const CURSORS = { nw:"nw-resize",n:"n-resize",ne:"ne-resize",w:"w-resize",e:"e-resize",sw:"sw-resize",s:"s-resize",se:"se-resize" };

    return (
      <div
        key={item.id}
        style={{
          position: "absolute",
          left: item.x,
          top: item.y,
          width: item.width,
          height: item.height,
          zIndex: item.zIndex,
          outline: isSelected ? "2px solid #2196F3" : "none",
          boxShadow: isSelected ? "0 0 0 3px rgba(33,150,243,0.15)" : "none",
          backgroundColor: item.type === "text" ? item.backgroundColor : "transparent",
          opacity: item.opacity ?? 1,
          cursor: locked ? "default" : "move",
          userSelect: "none",
          boxSizing: "border-box",
          transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}
        onPointerDown={(e) => {
          if (e.button === 1) return; // let middle click bubble to scroll container
          e.stopPropagation();
          if (!locked) startDrag(e, item);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!dragRef.current?.moved) handleSelectItem(e, item.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (item.type === "text") setEditingTextId(item.id);
        }}
      >
        {item.type === "image" && image && (
          <img
            src={image.url}
            alt={image.title || "Mood board reference"}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: item.objectFit || "contain", display: "block", userSelect: "none", pointerEvents: "none" }}
          />
        )}
        {item.type === "text" && (
          <>
            {editingTextId === item.id && (
              <style>{`
                @keyframes moodboard-caret-blink {
                  0%, 49% { caret-color: #000000; }
                  50%, 100% { caret-color: #ffffff; }
                }
                .moodboard-text-active {
                  caret-color: #000000;
                  animation: moodboard-caret-blink 1s step-end infinite;
                }
              `}</style>
            )}
            <textarea
              value={item.text}
              readOnly={editingTextId !== item.id}
              disabled={locked}
              className={editingTextId === item.id ? "moodboard-text-active" : undefined}
              onChange={(event) => updateCanvasItem(item.id, { text: event.target.value, name: event.target.value?.slice(0, 24) || "Text" })}
              onClick={(event) => { event.stopPropagation(); }}
              onBlur={() => setEditingTextId(null)}
              tabIndex={editingTextId === item.id ? 0 : -1}
              style={{
                width: "100%", height: "100%", resize: "none", border: "none", outline: "none",
                background: "transparent", color: item.color, fontFamily: item.fontFamily,
                fontSize: item.fontSize, fontWeight: item.fontWeight,
                lineHeight: item.lineHeight ?? 1.1,
                letterSpacing: item.letterSpacing ? `${item.letterSpacing}px` : "normal",
                textAlign: item.textAlign || "left",
                padding: "6px", boxSizing: "border-box", overflow: "hidden",
                pointerEvents: editingTextId === item.id ? "auto" : "none",
                cursor: editingTextId === item.id ? "text" : "default",
                userSelect: editingTextId === item.id ? "text" : "none",
                caretColor: editingTextId === item.id ? undefined : "transparent",
              }}
            />
          </>
        )}

        {isSelected && !locked && HANDLE_DIRS.map(handle => {
          const half = 4;
          const s = {};
          if (handle.includes("n")) s.top = -half; else if (handle.includes("s")) s.bottom = -half; else s.top = `calc(50% - ${half}px)`;
          if (handle.includes("w")) s.left = -half; else if (handle.includes("e")) s.right = -half; else s.left = `calc(50% - ${half}px)`;
          return (
            <div
              key={handle}
              onPointerDown={(e) => startResize(e, item, handle)}
              style={{ position: "absolute", width: 8, height: 8, backgroundColor: "white", border: "1.5px solid #2196F3", borderRadius: "2px", cursor: CURSORS[handle], zIndex: 10, ...s }}
            />
          );
        })}
      </div>
    );
  };

  const renderPage = (page, pageIndex) => {
    const pageItems = canvasItems.filter((item) => item.boardId === activeBoard.id && item.pageId === page.id);
    const isActive = activePage?.id === page.id;
    const currentW = resizingPage?.pageId === page.id ? resizingPage.width : page.width;
    const currentH = resizingPage?.pageId === page.id ? resizingPage.height : page.height;

    return (
      <div key={page.id} ref={(el) => { pageRefs.current[page.id] = el; }} style={{ marginBottom: "56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "#333", position: "relative", zIndex: 20, backgroundColor: "#d9d9d9", padding: "4px 0" }}>
          <button onClick={() => setActivePage(page.id)} style={{ fontWeight: isActive ? "bold" : "normal", padding: "6px 10px", cursor: "pointer" }}>
            {page.name || `Page ${pageIndex + 1}`}
          </button>
          <input value={page.name || ""} onChange={(event) => updatePage(page.id, { name: event.target.value })} disabled={!canEdit || isViewOnly} style={{ width: "130px", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
          <select value={page.presetKey || "custom"} onChange={(event) => applyCanvasPreset(page.id, event.target.value)} style={{ padding: "6px", fontSize: "12px" }}>
            {CANVAS_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
          </select>
          <label style={{ fontSize: "12px" }}>BG <input type="color" value={page.backgroundColor || "#ffffff"} onChange={(event) => updatePage(page.id, { backgroundColor: event.target.value })} /></label>
          <button onClick={() => duplicatePage(page.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "11px" }}>Duplicate Page</button>
          <button onClick={() => deletePage(page.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "11px" }}>Delete Page</button>
          <span style={{ fontSize: "11px", color: "#777" }}>{currentW} × {currentH}</span>
        </div>

        <div style={{ position: "relative", display: "inline-block" }}>
          {resizingPage?.pageId === page.id && (
            <div style={{ position: "absolute", top: -26, left: 0, fontSize: "11px", fontWeight: "bold", color: "#2196F3", backgroundColor: "rgba(255,255,255,0.92)", padding: "2px 7px", borderRadius: "3px", zIndex: 100, pointerEvents: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
              {resizingPage.width} × {resizingPage.height}
            </div>
          )}
          <div
            ref={el => { pageExportRefs.current[page.id] = el; }}
            onPointerDown={(e) => startSelectionBox(e, page)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handlePageDrop(event, page)}
            style={{
              width: currentW, height: currentH, position: "relative",
              backgroundColor: page.backgroundColor || "#ffffff",
              boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
              backgroundImage: showGrid ? `linear-gradient(to right, #ececec 1px, transparent 1px), linear-gradient(to bottom, #ececec 1px, transparent 1px)` : "none",
              backgroundSize: `${gridSize}px ${gridSize}px`,
              overflow: "hidden",
            }}
          >
            {[...pageItems].filter((item) => !item.hidden).sort((a, b) => a.zIndex - b.zIndex).map(renderCanvasItem)}
            {selectionBox?.pageId === page.id && selectionBox.w > 2 && (
              <div style={{ position: "absolute", left: selectionBox.x, top: selectionBox.y, width: selectionBox.w, height: selectionBox.h, border: "1px dashed #2196F3", backgroundColor: "rgba(33,150,243,0.06)", pointerEvents: "none", zIndex: 9999 }} />
            )}
            {alignmentGuides.pageId === page.id && alignmentGuides.x.map((gx, i) => (
              <div key={`gx${i}`} style={{ position: "absolute", left: gx - 0.5, top: 0, width: 1, height: currentH, backgroundColor: "#FF4081", pointerEvents: "none", zIndex: 9998, opacity: 0.7 }} />
            ))}
            {alignmentGuides.pageId === page.id && alignmentGuides.y.map((gy, i) => (
              <div key={`gy${i}`} style={{ position: "absolute", top: gy - 0.5, left: 0, height: 1, width: currentW, backgroundColor: "#FF4081", pointerEvents: "none", zIndex: 9998, opacity: 0.7 }} />
            ))}
          </div>
          {page.presetKey === "custom" && canEdit && !isViewOnly && (
            <div
              onPointerDown={(e) => startPageResize(e, page)}
              title="Drag to resize canvas"
              style={{ position: "absolute", bottom: -6, right: -6, width: 14, height: 14, backgroundColor: "#2196F3", borderRadius: "3px", cursor: "se-resize", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <div style={{ width: 6, height: 6, borderRight: "2px solid white", borderBottom: "2px solid white" }} />
            </div>
          )}
        </div>
      </div>
    );
  };
  return (
    <div style={{ height: "calc(100vh - 44px)", display: "flex", overflow: "hidden", backgroundColor: "#f0f0f0", fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
      <div style={{ width: LEFT_PANEL_WIDTH, flexShrink: 0, backgroundColor: "#f8f8f8", borderRight: "1px solid #ccc", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "white" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>MoodBoard</h2>
          <div style={{ fontSize: "11px", color: "#777", marginTop: "4px" }}>{selectedProject?.name || "Current Project"} · local only</div>
          {isViewOnly && <div style={{ marginTop: "8px", padding: "5px 8px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>VIEW ONLY</div>}
        </div>

        <div style={{ padding: "10px", borderBottom: "1px solid #ddd" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "6px" }}>BOARDS</div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            <input value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder="New board name" disabled={!canEdit || isViewOnly} style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
            <button onClick={addBoard} disabled={!canEdit || isViewOnly} style={{ padding: "6px 9px", cursor: "pointer" }}>+</button>
          </div>
          <div style={{ height: "168px", minHeight: "168px", maxHeight: "168px", overflowY: "auto", border: "1px inset #ddd", backgroundColor: "white" }}>
            {boards.map((board) => {
              const isActive = activeBoard?.id === board.id;
              return (
                <div key={board.id} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px", backgroundColor: isActive ? "#e3f2fd" : "white", borderBottom: "1px solid #eee" }}>
                  <input value={board.name} onChange={(event) => renameBoard(board.id, event.target.value)} onFocus={() => setActiveBoardId(board.id)} disabled={!canEdit || isViewOnly} style={{ flex: 1, border: "none", background: "transparent", fontWeight: isActive ? "bold" : "normal", fontSize: "12px", outline: "none" }} />
                  {(board.createdBy || userDisplayName) && (
                    <span style={{ fontSize: "9px", color: "#aaa", whiteSpace: "nowrap", marginRight: "2px" }}>
                      {(board.createdBy || userDisplayName).includes("@")
                        ? (board.createdBy || userDisplayName).split("@")[0]
                        : (board.createdBy || userDisplayName)}
                    </span>
                  )}
                  <button onClick={() => setActiveBoardId(board.id)} style={{ fontSize: "10px", cursor: "pointer" }}>Open</button>
                  <button onClick={() => addPageToBoard(board.id, true)} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>+ Page</button>
                  <button onClick={() => deleteBoard(board.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <button onClick={duplicateBoard} disabled={!canEdit || isViewOnly} style={{ flex: 1, fontSize: "11px", cursor: "pointer" }}>Duplicate Board</button>
            <button onClick={() => { setPresentMode(true); setPresentPageIndex(0); }} style={{ flex: 1, fontSize: "11px", cursor: "pointer" }}>Present</button>
          </div>
        </div>

        <div style={{ padding: "10px", borderBottom: "1px solid #ddd", height: "220px", minHeight: "220px", maxHeight: "220px", flexShrink: 0, boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: "8px", flexShrink: 0 }}>
            <button onClick={() => setActiveInputTab("links")} style={{ flex: 1, padding: "6px 4px", border: "none", borderBottom: activeInputTab === "links" ? "3px solid #2196F3" : "3px solid transparent", background: "transparent", fontWeight: activeInputTab === "links" ? "bold" : "normal", cursor: "pointer", fontSize: "11px" }}>Links</button>
            <button onClick={() => setActiveInputTab("images")} style={{ flex: 1, padding: "6px 4px", border: "none", borderBottom: activeInputTab === "images" ? "3px solid #2196F3" : "3px solid transparent", background: "transparent", fontWeight: activeInputTab === "images" ? "bold" : "normal", cursor: "pointer", fontSize: "11px" }}>Image URLs</button>
          </div>

          {activeInputTab === "links" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "6px", flexShrink: 0 }}>
                <input value={newLinkUrl} onChange={(event) => setNewLinkUrl(event.target.value)} placeholder="Reference URL" disabled={!canEdit || isViewOnly} style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
                <button onClick={addSourceLink} disabled={!canEdit || isViewOnly} style={{ padding: "6px 9px", cursor: "pointer" }}>Add</button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", border: "1px inset #ddd", backgroundColor: "white" }}>
                {links.length === 0 && <div style={{ padding: "10px", fontSize: "12px", color: "#999" }}>No links yet.</div>}
                {links.map((link) => (
                  <div key={link.id} style={{ padding: "7px", borderBottom: "1px solid #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <strong style={{ fontSize: "12px" }}>{link.title}</strong>
                      <span style={{ fontSize: "10px", color: "#777" }}>{getSourceLabel(link.type)}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.url}</div>
                    <div style={{ marginTop: "5px", display: "flex", gap: "5px" }}>
                      {link.url && <a href={link.url} target="_blank" rel="noreferrer" style={{ fontSize: "10px" }}>Open</a>}
                      <button onClick={() => deleteSourceLink(link.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeInputTab === "images" && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <input value={manualImageUrl} onChange={(event) => setManualImageUrl(event.target.value)} placeholder="Direct image URL (.jpg, .png…)" disabled={!canEdit || isViewOnly} style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
                <button onClick={addManualImageUrl} disabled={!canEdit || isViewOnly} style={{ padding: "6px 9px", cursor: "pointer" }}>Add</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "10px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>ROLL</div>
            <button onClick={() => fileInputRef.current?.click()} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>Upload</button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={addLocalFiles} style={{ display: "none" }} />
          </div>
          <input value={rollSearch} onChange={(event) => setRollSearch(event.target.value)} placeholder="Search roll..." style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginBottom: "8px" }} />
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <div style={{ columns: 3, columnGap: "8px" }}>
              {filteredImages.map((image) => (
                <RollImage
                  key={image.id}
                  image={image}
                  canEdit={canEdit}
                  isViewOnly={isViewOnly}
                  isDragging={rollDragId === image.id}
                  isDragOver={rollDragOverId === image.id && rollDragId !== image.id}
                  onDragStart={() => { draggingRollImageRef.current = image; setRollDragId(image.id); }}
                  onDragEnd={() => {
                    if (rollDragId && rollDragOverId) reorderImages(rollDragId, rollDragOverId);
                    draggingRollImageRef.current = null;
                    setRollDragId(null);
                    setRollDragOverId(null);
                  }}
                  onDragOver={() => { if (rollDragId && rollDragId !== image.id) setRollDragOverId(image.id); }}
                  onDoubleClick={() => addImageToCanvas(image)}
                  onLightbox={() => setLightboxImage({ url: image.url, title: image.title })}
                  onDelete={() => deleteImage(image.id)}
                  onRenameTitle={(title) => updateImageTitle(image.id, title)}
                />
              ))}
            </div>
          </div>
          </div>
      </div>
  
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ flexShrink: 0, backgroundColor: "white", borderBottom: "1px solid #ccc", boxSizing: "border-box", overflow: "visible", position: "relative", zIndex: 50 }}>
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "14px", marginRight: "8px" }}>{activeBoard?.name}</strong>
            <button onClick={addPage} disabled={!canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Add Page</button>
            <button onClick={addTextToCanvas} disabled={!canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Add Text</button>
            <button onClick={duplicateSelectedItems} disabled={!selectedItems.length || !canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Duplicate</button>
            <button onClick={deleteSelectedItems} disabled={!selectedItems.length || !canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Delete</button>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              Snap
              <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} style={{ padding: "3px 5px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "3px" }}>
                <option value={2}>2px</option>
                <option value={5}>5px</option>
                <option value={10}>10px</option>
                <option value={20}>20px</option>
                <option value={40}>40px</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
              Zoom <input type="range" min="0.1" max="1.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "80px" }} /> {Math.round(zoom * 100)}%
            </label>
            <button onClick={fitToWidth} style={{ padding: "6px 10px", cursor: "pointer", fontSize: "12px", backgroundColor: "#f0f0f0", border: "1px solid #ccc", borderRadius: "3px" }}>Fit</button>
            <button onClick={exportBoardToPdf} disabled={exportingPdf} style={{ padding: "6px 10px", cursor: "pointer", fontSize: "12px", backgroundColor: exportingPdf ? "#e0e0e0" : "#E91E63", color: exportingPdf ? "#666" : "white", border: "none", borderRadius: "3px", fontWeight: "bold" }}>
              {exportingPdf ? "Exporting…" : "Export PDF"}
            </button>
            <button onClick={() => setShowLayerPanel(p => !p)} style={{ padding: "6px 10px", cursor: "pointer", fontSize: "12px", backgroundColor: showLayerPanel ? "#e3f2fd" : "#f0f0f0", border: "1px solid #ccc", borderRadius: "3px" }}>Layers</button>
            <div style={{ marginLeft: "auto", fontSize: "11px", color: "#777", maxWidth: "360px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusMessage}</div>
          </div>

          <div style={{ minHeight: "48px", display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", backgroundColor: "#fafafa", borderTop: "1px solid #eee", boxSizing: "border-box", flexWrap: "wrap", position: "relative", visibility: primarySelectedItem ? "visible" : "hidden" }}>
            {primarySelectedItem && (
              <>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>{selectedItems.length > 1 ? `${selectedItems.length} ITEMS` : primarySelectedItem.type.toUpperCase()}</span>
                <label style={{ fontSize: "12px" }}><input type="checkbox" checked={!!primarySelectedItem.locked} onChange={(event) => updateSelectedItems({ locked: event.target.checked })} /> Lock</label>
                <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>Opacity <input type="range" min="0.1" max="1" step="0.05" value={primarySelectedItem.opacity ?? 1} onChange={(event) => updateSelectedItems({ opacity: Number(event.target.value) })} /></label>
                {primarySelectedItem.type === "image" && selectedItems.length === 1 && (
                  <>
                    <select value={primarySelectedItem.objectFit || "contain"} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { objectFit: event.target.value })} style={{ padding: "5px", fontSize: "12px" }}>
                      <option value="contain">Fit Whole Image</option>
                      <option value="cover">Crop / Fill</option>
                    </select>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      Scale
                      <input
                        type="range" min="10" max="300" step="1"
                        value={Math.round(((primarySelectedItem.width / (primarySelectedItem._baseWidth || primarySelectedItem.width)) * 100) || 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value) / 100;
                          const base = primarySelectedItem._baseWidth || primarySelectedItem.width;
                          const ratio = primarySelectedItem.width / primarySelectedItem.height;
                          const newW = Math.round(base * pct);
                          const newH = Math.round(newW / ratio);
                          const cx = primarySelectedItem.x + primarySelectedItem.width / 2;
                          const cy = primarySelectedItem.y + primarySelectedItem.height / 2;
                          updateCanvasItem(primarySelectedItem.id, { width: newW, height: newH, x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), _baseWidth: base });
                        }}
                        style={{ width: "60px" }}
                      />
                      <input type="number" min="10" max="300" step="1"
                        value={Math.round(((primarySelectedItem.width / (primarySelectedItem._baseWidth || primarySelectedItem.width)) * 100) || 100)}
                        onChange={(e) => {
                          const pct = Number(e.target.value) / 100;
                          if (isNaN(pct) || pct <= 0) return;
                          const base = primarySelectedItem._baseWidth || primarySelectedItem.width;
                          const ratio = primarySelectedItem.width / primarySelectedItem.height;
                          const newW = Math.round(base * pct);
                          const newH = Math.round(newW / ratio);
                          const cx = primarySelectedItem.x + primarySelectedItem.width / 2;
                          const cy = primarySelectedItem.y + primarySelectedItem.height / 2;
                          updateCanvasItem(primarySelectedItem.id, { width: newW, height: newH, x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), _baseWidth: base });
                        }}
                        style={{ width: "46px", padding: "2px 4px", fontSize: "11px" }}
                      />%
                    </label>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      Rotate
                      <input
                        type="range" min="-180" max="180" step="1"
                        value={primarySelectedItem.rotation ?? 0}
                        onChange={(e) => updateCanvasItem(primarySelectedItem.id, { rotation: Number(e.target.value) })}
                        style={{ width: "60px" }}
                      />
                      <input type="number" min="-180" max="180" step="1"
                        value={primarySelectedItem.rotation ?? 0}
                        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) updateCanvasItem(primarySelectedItem.id, { rotation: v }); }}
                        style={{ width: "46px", padding: "2px 4px", fontSize: "11px" }}
                      />°
                      <button onClick={() => updateCanvasItem(primarySelectedItem.id, { rotation: 0 })} style={{ fontSize: "11px", padding: "3px 6px" }} title="Reset rotation to 0°">↺</button>
                    </label>
                  </>
                )}
                {primarySelectedItem.type === "text" && selectedItems.length === 1 && (
                  <>
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setShowFontDropdown((prev) => !prev)} style={{ minWidth: "190px", padding: "6px 8px", textAlign: "left", fontFamily: primarySelectedItem.fontFamily }}>{primarySelectedItem.fontFamily}</button>
                      {showFontDropdown && (
                        <div style={{ position: "absolute", top: "34px", left: 0, width: "270px", maxHeight: "320px", overflowY: "auto", backgroundColor: "white", border: "1px solid #ccc", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", zIndex: 9999 }}>
                          {FONT_OPTIONS.map((font) => (
                            <button key={font.name} onClick={() => { updateCanvasItem(primarySelectedItem.id, { fontFamily: font.name }); setShowFontDropdown(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "9px 10px", border: "none", borderBottom: "1px solid #eee", background: primarySelectedItem.fontFamily === font.name ? "#e3f2fd" : "white", cursor: "pointer" }}>
                              <div style={{ fontFamily: font.name, fontSize: "22px", lineHeight: 1.1 }}>{font.name}</div>
                              <div style={{ fontSize: "10px", color: "#777", marginTop: "3px" }}>{font.vibe}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={primarySelectedItem.fontSize}
                      min="8" max="180"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "-") return; // allow clearing while typing
                        const n = Number(val);
                        if (n >= 1) updateCanvasItem(primarySelectedItem.id, { fontSize: n });
                      }}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!n || n < 1) updateCanvasItem(primarySelectedItem.id, { fontSize: 12 });
                      }}
                      style={{ width: "70px", padding: "5px", fontSize: "12px" }}
                    />
                    <select value={primarySelectedItem.fontWeight} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { fontWeight: event.target.value })} style={{ padding: "5px", fontSize: "12px" }}>
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                      <option value="900">Heavy</option>
                    </select>
                    <div style={{ display: "flex", gap: "2px" }}>
                      {[{v:"left",label:"L"},{v:"center",label:"C"},{v:"right",label:"R"}].map(({v,label}) => (
                        <button key={v} onClick={() => updateCanvasItem(primarySelectedItem.id, { textAlign: v })}
                          title={`Align ${v}`}
                          style={{ padding: "4px 8px", fontSize: "12px", fontWeight: "bold", backgroundColor: (primarySelectedItem.textAlign || "left") === v ? "#2196F3" : "#f0f0f0", color: (primarySelectedItem.textAlign || "left") === v ? "white" : "#333", border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }}
                        >{label}</button>
                      ))}
                    </div>
                    <label style={{ fontSize: "12px" }}>Color <input type="color" value={primarySelectedItem.color} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { color: event.target.value })} /></label>
                    <label style={{ fontSize: "12px" }}>BG <input type="color" value={primarySelectedItem.backgroundColor === "transparent" ? "#ffffff" : primarySelectedItem.backgroundColor} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { backgroundColor: event.target.value })} /></label>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      Tracking
                      <input type="range" min="-5" max="30" step="0.5" value={primarySelectedItem.letterSpacing ?? 0} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { letterSpacing: Number(e.target.value) })} style={{ width: "60px" }} />
                      <span style={{ fontSize: "10px", width: "24px" }}>{primarySelectedItem.letterSpacing ?? 0}</span>
                    </label>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      Leading
                      <input type="range" min="0.7" max="3" step="0.05" value={primarySelectedItem.lineHeight ?? 1.1} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { lineHeight: Number(e.target.value) })} style={{ width: "60px" }} />
                      <span style={{ fontSize: "10px", width: "24px" }}>{(primarySelectedItem.lineHeight ?? 1.1).toFixed(2)}</span>
                    </label>
                    <button onClick={() => updateCanvasItem(primarySelectedItem.id, { backgroundColor: "transparent" })} style={{ fontSize: "11px" }}>Clear BG</button>
                  </>
                )}
              </>
            )}
            </div>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div
            ref={boardScrollRef}
            style={{ flex: 1, overflow: "auto", position: "relative", backgroundColor: "#d9d9d9", zIndex: 1 }}
            onPointerDown={(e) => {
              if (e.button !== 1) return;
              e.preventDefault();
              const el = boardScrollRef.current;
              const startX = e.clientX + el.scrollLeft;
              const startY = e.clientY + el.scrollTop;
              const onMove = (me) => { el.scrollLeft = startX - me.clientX; el.scrollTop = startY - me.clientY; };
              const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          >
            {(() => {
              const maxW = boardPages.length ? Math.max(...boardPages.map(p => p.width)) : 1600;
              const scaledW = Math.ceil((maxW + 80) * zoom);
              return (
                <div style={{ width: scaledW, minWidth: "100%" }}>
                  <div style={{ padding: "36px", transform: `scale(${zoom})`, transformOrigin: "top left", width: maxW + 80 }}>
                    {boardPages.map((page, pageIndex) => renderPage(page, pageIndex))}
                  </div>
                </div>
              );
            })()}
          </div>

          {showLayerPanel && (
            <div style={{ width: "260px", flexShrink: 0, borderLeft: "1px solid #ccc", backgroundColor: "#f8f8f8", overflowY: "auto" }}>
              <div style={{ padding: "10px", borderBottom: "1px solid #ddd", backgroundColor: "white", fontWeight: "bold", fontSize: "12px" }}>LAYERS</div>
              {boardPages.map((page, pageIndex) => {
                const pageItems = activeBoardItems.filter((item) => item.pageId === page.id).sort((a, b) => b.zIndex - a.zIndex);
                return (
                  <div key={page.id} style={{ borderBottom: "1px solid #ddd" }}>
                    <button onClick={() => { setActivePage(page.id); pageRefs.current[page.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{ width: "100%", padding: "8px 10px", textAlign: "left", border: "none", backgroundColor: activePage?.id === page.id ? "#e3f2fd" : "#f0f0f0", fontWeight: "bold", cursor: "pointer" }}>{page.name || `Page ${pageIndex + 1}`}</button>
                    {pageItems.length === 0 && <div style={{ padding: "8px 12px", fontSize: "11px", color: "#999" }}>No layers</div>}
                    {pageItems.map((item) => {
                      const selected = selectedItemIds.includes(item.id);
                      const isDragOver = layerDrag?.overItemId === item.id && layerDrag?.itemId !== item.id;
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setLayerDrag({ itemId: item.id, overItemId: null })}
                          onDragOver={(e) => { e.preventDefault(); setLayerDrag(prev => prev ? { ...prev, overItemId: item.id } : null); }}
                          onDragEnd={() => {
                            if (layerDrag?.itemId && layerDrag?.overItemId && layerDrag.itemId !== layerDrag.overItemId) {
                              const a = pageItems.find(i => i.id === layerDrag.itemId);
                              const b = pageItems.find(i => i.id === layerDrag.overItemId);
                              if (a && b) {
                                setCanvasItems(prev => prev.map(ci => {
                                  if (ci.id === a.id) return { ...ci, zIndex: b.zIndex };
                                  if (ci.id === b.id) return { ...ci, zIndex: a.zIndex };
                                  return ci;
                                }));
                              }
                            }
                            setLayerDrag(null);
                          }}
                          onClick={(e) => handleSelectItem(e, item.id)}
                          style={{ padding: "6px 8px", fontSize: "11px", cursor: "grab", backgroundColor: isDragOver ? "#e3f2fd" : selected ? "#bbdefb" : "white", borderTop: isDragOver ? "2px solid #2196F3" : "1px solid #eee", display: "flex", alignItems: "center", gap: "5px", opacity: item.hidden ? 0.5 : 1 }}
                        >
                          {/* Drag handle */}
                          <span style={{ color: "#ccc", cursor: "grab", flexShrink: 0 }}>⠿</span>
                          {/* Type badge */}
                          <span style={{ flexShrink: 0, fontSize: "9px", fontWeight: "bold", backgroundColor: item.type === "text" ? "#E3F2FD" : "#F3E5F5", color: item.type === "text" ? "#1565C0" : "#6A1B9A", padding: "1px 4px", borderRadius: "2px" }}>{item.type === "text" ? "T" : "IMG"}</span>
                          {/* Editable name */}
                          {renamingLayerId === item.id ? (
                            <input
                              autoFocus
                              value={renamingLayerDraft}
                              onChange={(e) => setRenamingLayerDraft(e.target.value)}
                              onBlur={() => {
                                if (renamingLayerDraft.trim()) updateCanvasItem(item.id, { name: renamingLayerDraft.trim() });
                                setRenamingLayerId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { if (renamingLayerDraft.trim()) updateCanvasItem(item.id, { name: renamingLayerDraft.trim() }); setRenamingLayerId(null); }
                                if (e.key === "Escape") setRenamingLayerId(null);
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ flex: 1, fontSize: "11px", border: "none", outline: "1px solid #2196F3", borderRadius: "2px", padding: "1px 3px", minWidth: 0 }}
                            />
                          ) : (
                            <span
                              title="Double-click to rename"
                              onDoubleClick={(e) => { e.stopPropagation(); setRenamingLayerId(item.id); setRenamingLayerDraft(renderLayerName(item)); }}
                              style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}
                            >
                              {renderLayerName(item)}
                            </span>
                          )}
                          {/* Controls */}
                          <span style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(item.id); }}
                              title={item.hidden ? "Show" : "Hide"}
                              style={{ fontSize: "10px", padding: "1px 4px", cursor: "pointer", backgroundColor: item.hidden ? "#ffecb3" : "transparent", border: "1px solid #ddd", borderRadius: "2px" }}
                            >{item.hidden ? "👁" : "👁"}</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateCanvasItem(item.id, { locked: !item.locked }); }}
                              title={item.locked ? "Unlock" : "Lock"}
                              style={{ fontSize: "10px", padding: "1px 4px", cursor: "pointer", backgroundColor: item.locked ? "#ffebee" : "transparent", border: "1px solid #ddd", borderRadius: "2px" }}
                            >{item.locked ? "🔒" : "🔓"}</button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {presentMode && activeBoard && (() => {
        const page = boardPages[presentPageIndex] || boardPages[0];
        if (!page) return null;
        const mainScale = Math.min(
          (window.innerWidth - 80) / page.width,
          (window.innerHeight - 180) / page.height
        );
        const thumbScale = 0.12;
        const pageItems = (pg) => canvasItems.filter(item => item.boardId === activeBoard.id && item.pageId === pg.id && !item.hidden).sort((a, b) => a.zIndex - b.zIndex);

        const renderPageContent = (pg, scale) => (
          <div style={{ width: pg.width, height: pg.height, transform: `scale(${scale})`, transformOrigin: "top left", backgroundColor: pg.backgroundColor || "#fff", position: "relative", overflow: "hidden" }}>
            {pageItems(pg).map(item => {
              const img = item.type === "image" ? images.find(i => i.id === item.imageId) : null;
              return (
                <div key={item.id} style={{ position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, opacity: item.opacity ?? 1, backgroundColor: item.type === "text" ? item.backgroundColor : "transparent", transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, transformOrigin: "center center" }}>
                  {item.type === "image" && img && <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: item.objectFit || "contain" }} />}
                  {item.type === "text" && <div style={{ color: item.color, fontFamily: item.fontFamily, fontSize: item.fontSize, fontWeight: item.fontWeight, lineHeight: item.lineHeight ?? 1.1, letterSpacing: item.letterSpacing ? `${item.letterSpacing}px` : "normal", textAlign: item.textAlign || "left", padding: 6, whiteSpace: "pre-wrap" }}>{item.text}</div>}
                </div>
              );
            })}
          </div>
        );

        return (
          <div
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", flexDirection: "column" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPresentMode(false);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") setPresentPageIndex(p => Math.min(boardPages.length - 1, p + 1));
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") setPresentPageIndex(p => Math.max(0, p - 1));
            }}
            tabIndex={0}
            ref={el => el?.focus()}
          >
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", flexShrink: 0 }}>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "16px" }}>{activeBoard.name}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Page {presentPageIndex + 1} of {boardPages.length} · ← → to navigate · Esc to close</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={exportBoardToPdf} disabled={exportingPdf} style={{ padding: "6px 14px", backgroundColor: "#E91E63", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
                  {exportingPdf ? "Exporting…" : "Export PDF"}
                </button>
                <button onClick={() => setPresentMode(false)} style={{ padding: "6px 14px", backgroundColor: "rgba(255,255,255,0.15)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}>✕ Close</button>
              </div>
            </div>

            {/* Main page view */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 0 }}>
              {/* Prev arrow */}
              {presentPageIndex > 0 && (
                <button onClick={() => setPresentPageIndex(p => p - 1)} style={{ position: "absolute", left: "20px", backgroundColor: "rgba(255,255,255,0.12)", color: "white", border: "none", borderRadius: "50%", width: "48px", height: "48px", fontSize: "22px", cursor: "pointer", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              )}

              <div style={{ boxShadow: "0 12px 60px rgba(0,0,0,0.8)" }}>
                {renderPageContent(page, mainScale)}
              </div>

              {/* Next arrow */}
              {presentPageIndex < boardPages.length - 1 && (
                <button onClick={() => setPresentPageIndex(p => p + 1)} style={{ position: "absolute", right: "20px", backgroundColor: "rgba(255,255,255,0.12)", color: "white", border: "none", borderRadius: "50%", width: "48px", height: "48px", fontSize: "22px", cursor: "pointer", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              )}
            </div>

            {/* Thumbnail strip */}
            {boardPages.length > 1 && (
              <div style={{ flexShrink: 0, display: "flex", gap: "10px", padding: "14px 20px", overflowX: "auto", backgroundColor: "rgba(0,0,0,0.4)", justifyContent: boardPages.length < 8 ? "center" : "flex-start" }}>
                {boardPages.map((pg, idx) => (
                  <div
                    key={pg.id}
                    onClick={() => setPresentPageIndex(idx)}
                    style={{ flexShrink: 0, cursor: "pointer", outline: idx === presentPageIndex ? "3px solid #2196F3" : "2px solid transparent", borderRadius: "3px", overflow: "hidden", opacity: idx === presentPageIndex ? 1 : 0.55, transition: "opacity 0.15s, outline 0.15s", position: "relative" }}
                  >
                    <div style={{ width: pg.width * thumbScale, height: pg.height * thumbScale, overflow: "hidden" }}>
                      {renderPageContent(pg, thumbScale)}
                    </div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", color: "white", fontSize: "9px", textAlign: "center", padding: "2px" }}>{pg.name || `Page ${idx + 1}`}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Roll image lightbox */}
      {lightboxImage && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setLightboxImage(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", maxHeight: "92vh" }}>
            <img src={lightboxImage.url} alt={lightboxImage.title} style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", display: "block", boxShadow: "0 12px 60px rgba(0,0,0,0.8)" }} />
            {lightboxImage.title && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", color: "white", padding: "8px 12px", fontSize: "13px", textAlign: "center" }}>{lightboxImage.title}</div>}
            <button onClick={() => setLightboxImage(null)} style={{ position: "absolute", top: "-14px", right: "-14px", backgroundColor: "#333", color: "white", border: "none", borderRadius: "50%", width: "30px", height: "30px", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MoodBoard;
