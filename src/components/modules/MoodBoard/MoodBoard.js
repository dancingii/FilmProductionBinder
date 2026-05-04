import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";

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

const SAMPLE_IMAGES = [
  {
    id: "sample_1",
    sourceLinkId: null,
    title: "Sample Reference 1",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    originalUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    width: 900,
    height: 600,
    source: "sample",
  },
  {
    id: "sample_2",
    sourceLinkId: null,
    title: "Sample Reference 2",
    url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
    originalUrl: "https://images.unsplash.com/photo-1519608487953-e999c86e7455",
    width: 900,
    height: 600,
    source: "sample",
  },
  {
    id: "sample_3",
    sourceLinkId: null,
    title: "Sample Reference 3",
    url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
    originalUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
    width: 900,
    height: 600,
    source: "sample",
  },
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

function makeBoard(index = 1) {
  const page = makePage(1);
  return {
    id: makeId("board"),
    name: `Mood Board ${index}`,
    createdAt: new Date().toISOString(),
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
    images: parsed?.images?.length ? parsed.images : SAMPLE_IMAGES,
    canvasItems: (parsed?.canvasItems || []).map((item) => {
      if (item.pageId) return item;
      const board = migratedBoards.find((b) => b.id === item.boardId) || firstBoard;
      return { ...item, pageId: board?.pages?.[0]?.id || null };
    }),
    zoom: parsed?.zoom || 0.65,
    showGrid: parsed?.showGrid ?? true,
  };
}

function MoodBoard({ selectedProject, userRole, canEdit = true, isViewOnly = false }) {
  const fileInputRef = useRef(null);
  const boardScrollRef = useRef(null);
  const didLoadRef = useRef(false);
  const draggingRollImageRef = useRef(null);
  const pageRefs = useRef({});

  const [boards, setBoards] = useState([makeBoard(1)]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [links, setLinks] = useState([]);
  const [images, setImages] = useState(SAMPLE_IMAGES);
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
  const [editingTextId, setEditingTextId] = useState(null);
  const [resizingPage, setResizingPage] = useState(null);
  const [gridSize, setGridSize] = useState(GRID_SIZE);
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [pinterestLoading, setPinterestLoading] = useState(false);

  const storageKey = useMemo(() => getStorageKey(selectedProject), [selectedProject]);

  useEffect(() => {
    didLoadRef.current = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        const board = makeBoard(1);
        setBoards([board]);
        setActiveBoardId(board.id);
        setLinks([]);
        setImages(SAMPLE_IMAGES);
        setCanvasItems([]);
        setSelectedItemIds([]);
        setStatusMessage("No saved local moodboard yet. Using starter sample images.");
        didLoadRef.current = true;
        return;
      }

      const normalized = normalizeImportedState(JSON.parse(raw));
      setBoards(normalized.boards);
      setActiveBoardId(normalized.activeBoardId);
      setLinks(normalized.links);
      setImages(normalized.images);
      setCanvasItems(normalized.canvasItems);
      setZoom(normalized.zoom);
      setShowGrid(normalized.showGrid);
      setSelectedItemIds([]);
      setStatusMessage("Loaded saved local MoodBoard data.");
    } catch (error) {
      console.error("Failed to load MoodBoard local data:", error);
      setStatusMessage("Could not load local MoodBoard data. Starting clean.");
    } finally {
      setTimeout(() => {
        didLoadRef.current = true;
      }, 0);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!didLoadRef.current) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: STORAGE_VERSION,
          savedAt: new Date().toISOString(),
          activeBoardId,
          boards,
          links,
          images,
          canvasItems,
          zoom,
          showGrid,
        })
      );
    } catch (error) {
      console.error("Failed to save MoodBoard local data:", error);
      setStatusMessage("Local save failed. Browser storage may be full.");
    }
  }, [storageKey, activeBoardId, boards, links, images, canvasItems, zoom, showGrid]);

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
    const board = makeBoard(boards.length + 1);
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
    setStatusMessage("Adding image URL...");
    const dimensions = await getImageDimensions(url);
    const image = {
      id: makeId("img"),
      sourceLinkId: null,
      title: manualImageTitle.trim() || `Image URL ${images.length + 1}`,
      url,
      originalUrl: url,
      width: dimensions.width,
      height: dimensions.height,
      source: "image-url",
    };
    setImages((prev) => [...prev, image]);
    setManualImageUrl("");
    setManualImageTitle("");
    setStatusMessage("Image URL added to Roll.");
  };

  const addLocalFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            id: makeId("img"),
            sourceLinkId: null,
            title: file.name,
            url,
            originalUrl: url,
            width: img.naturalWidth || 900,
            height: img.naturalHeight || 600,
            localOnly: true,
            source: "local",
          },
        ]);
      };
      img.src = url;
    });
    event.target.value = "";
    setStatusMessage("Local upload added. Note: local object URLs are temporary until real storage is added.");
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

  const moveSelectedByDelta = (selectedIds, dx, dy, sourceItemId, nextSourcePosition) => {
    const ids = new Set(selectedIds);
    setCanvasItems((prev) => {
      const sourceBefore = prev.find((item) => item.id === sourceItemId);
      if (!sourceBefore) return prev;
      const computedDx = nextSourcePosition.x - sourceBefore.x;
      const computedDy = nextSourcePosition.y - sourceBefore.y;
      return prev.map((item) => {
        if (!ids.has(item.id)) return item;
        if (item.id === sourceItemId) return { ...item, x: nextSourcePosition.x, y: nextSourcePosition.y };
        return { ...item, x: snap(item.x + computedDx), y: snap(item.y + computedDy) };
      });
    });
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

  const fetchPinterestBoard = async () => {
    const url = pinterestUrl.trim();
    if (!url || !/pinterest\./i.test(url)) {
      setStatusMessage("Please enter a valid Pinterest board URL.");
      return;
    }
    setPinterestLoading(true);
    setStatusMessage("Fetching Pinterest board images…");
    try {
      const res = await fetch(`/.netlify/functions/pinterest-scrape?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok || !data.images?.length) {
        setStatusMessage(data.error || "No images found. Board may be private or blocked.");
        return;
      }
      const newImages = data.images.map((img) => ({
        id: makeId("img"),
        sourceLinkId: null,
        title: img.title || "Pinterest Pin",
        url: img.url,
        originalUrl: img.url,
        width: img.width || 736,
        height: img.height || 552,
        source: "pinterest",
      }));
      setImages((prev) => [...prev, ...newImages]);
      setPinterestUrl("");
      setStatusMessage(`Added ${newImages.length} Pinterest images to the Roll.`);
    } catch (err) {
      setStatusMessage("Pinterest fetch failed: " + err.message);
    } finally {
      setPinterestLoading(false);
    }
  };

  const clearLocalMoodBoard = () => {
    const board = makeBoard(1);
    setBoards([board]);
    setActiveBoardId(board.id);
    setLinks([]);
    setImages(SAMPLE_IMAGES);
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
    const selectedGroupIds = isSelected ? selectedItemIds : [item.id];

    return (
      <Rnd
        key={item.id}
        scale={zoom}
        bounds="parent"
        size={{ width: item.width, height: item.height }}
        position={{ x: item.x, y: item.y }}
        lockAspectRatio={item.type === "image"}
        dragGrid={[gridSize, gridSize]}
        resizeGrid={[gridSize, gridSize]}
        disableDragging={locked}
        enableResizing={!locked}
        minWidth={item.type === "text" ? 80 : 60}
        minHeight={item.type === "text" ? 40 : 40}
        style={{
          zIndex: item.zIndex,
          outline: isSelected ? "2px solid #2196F3" : "1px solid transparent",
          boxShadow: isSelected ? "0 0 0 4px rgba(33, 150, 243, 0.15)" : "none",
          backgroundColor: item.type === "text" ? item.backgroundColor : "transparent",
          opacity: item.opacity ?? 1,
        }}
        onClick={(event) => handleSelectItem(event, item.id)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (item.type === "text") setEditingTextId(item.id);
        }}
        onDragStop={(event, d) => {
          const page = boardPages.find((p) => p.id === item.pageId);
          if (!page) return;
          const next = {
            x: Math.max(0, Math.min(snap(d.x, gridSize), Math.max(0, page.width - item.width))),
            y: Math.max(0, Math.min(snap(d.y, gridSize), Math.max(0, page.height - item.height))),
          };
          if (selectedItemIds.length > 1 && selectedItemIds.includes(item.id)) {
            moveSelectedByDelta(selectedGroupIds, 0, 0, item.id, next);
          } else {
            updateCanvasItem(item.id, next);
          }
        }}
        onResizeStop={(event, direction, ref, delta, position) => {
          const page = boardPages.find((p) => p.id === item.pageId);
          if (!page) return;
          const width = snap(ref.offsetWidth, gridSize);
          const height = snap(ref.offsetHeight, gridSize);
          updateCanvasItem(item.id, {
            width, height,
            x: Math.max(0, Math.min(snap(position.x, gridSize), Math.max(0, page.width - width))),
            y: Math.max(0, Math.min(snap(position.y, gridSize), Math.max(0, page.height - height))),
          });
        }}
      >
        {item.type === "image" && image && (
          <img
            src={image.url}
            alt={image.title || "Mood board reference"}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: item.objectFit || "cover", display: "block", userSelect: "none" }}
          />
        )}
        {item.type === "text" && (
          <textarea
          value={item.text}
          readOnly={editingTextId !== item.id}
          disabled={locked}
          onChange={(event) => updateCanvasItem(item.id, { text: event.target.value, name: event.target.value?.slice(0, 24) || "Text" })}
          onClick={(event) => { event.stopPropagation(); }}
          onBlur={() => setEditingTextId(null)}
          tabIndex={editingTextId === item.id ? 0 : -1}
          style={{
              width: "100%",
              height: "100%",
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              color: item.color,
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              fontWeight: item.fontWeight,
              lineHeight: 1.1,
              padding: "6px",
              boxSizing: "border-box",
              overflow: "hidden",
              pointerEvents: editingTextId === item.id ? "auto" : "none",
              cursor: editingTextId === item.id ? "text" : "default",
              userSelect: editingTextId === item.id ? "text" : "none",
            }}
          />
        )}
      </Rnd>
    );
  };

  const renderPage = (page, pageIndex) => {
    const pageItems = canvasItems.filter((item) => item.boardId === activeBoard.id && item.pageId === page.id);
    const isActive = activePage?.id === page.id;
    return (
      <div key={page.id} ref={(el) => { pageRefs.current[page.id] = el; }} style={{ marginBottom: "56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "#333", position: "relative", zIndex: 20, backgroundColor: "#d9d9d9", padding: "4px 0" }}>
          <button onClick={() => setActivePage(page.id)} style={{ fontWeight: isActive ? "bold" : "normal", padding: "6px 10px", cursor: "pointer" }}>
            {page.name || `Page ${pageIndex + 1}`}
          </button>
          <input
            value={page.name || ""}
            onChange={(event) => updatePage(page.id, { name: event.target.value })}
            disabled={!canEdit || isViewOnly}
            style={{ width: "130px", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
          <select value={page.presetKey || "custom"} onChange={(event) => applyCanvasPreset(page.id, event.target.value)} style={{ padding: "6px", fontSize: "12px" }}>
            {CANVAS_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
          </select>
          <label style={{ fontSize: "12px" }}>BG <input type="color" value={page.backgroundColor || "#ffffff"} onChange={(event) => updatePage(page.id, { backgroundColor: event.target.value })} /></label>
          <button onClick={() => duplicatePage(page.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "11px" }}>Duplicate Page</button>
          <button onClick={() => deletePage(page.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "11px" }}>Delete Page</button>
          <span style={{ fontSize: "11px", color: "#777" }}>{page.width} × {page.height}</span>
        </div>

        <Rnd
          scale={zoom}
          size={{ width: page.width, height: page.height }}
          position={{ x: 0, y: 0 }}
          disableDragging
          enableResizing={page.presetKey === "custom" && canEdit && !isViewOnly}
          minWidth={480}
          minHeight={360}
          resizeGrid={[gridSize, gridSize]}
          onResize={(event, direction, ref) => {
            setResizingPage({ pageId: page.id, width: ref.offsetWidth, height: ref.offsetHeight });
          }}
          onResizeStop={(event, direction, ref) => {
            const newWidth = snap(ref.offsetWidth, gridSize);
            const newHeight = snap(ref.offsetHeight, gridSize);
            updatePage(page.id, { width: newWidth, height: newHeight, presetKey: "custom" });
            setResizingPage(null);
            setTimeout(() => {
              const container = boardScrollRef.current;
              if (!container) return;
              const availableWidth = container.clientWidth - 72;
              setZoom(parseFloat(Math.max(0.1, Math.min(1, availableWidth / newWidth)).toFixed(2)));
            }, 30);
          }}
          style={{ position: "relative", zIndex: 1 }}
        >
          {resizingPage?.pageId === page.id && (
            <div style={{ position: "absolute", top: -26, left: 0, fontSize: "11px", fontWeight: "bold", color: "#2196F3", backgroundColor: "rgba(255,255,255,0.92)", padding: "2px 7px", borderRadius: "3px", zIndex: 100, pointerEvents: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
              {resizingPage.width} × {resizingPage.height}
            </div>
          )}
          <div
            onClick={() => {
              setActivePage(page.id);
              setSelectedItemIds([]);
              setEditingTextId(null);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handlePageDrop(event, page)}
            style={{
              width: resizingPage?.pageId === page.id ? resizingPage.width : page.width,
              height: resizingPage?.pageId === page.id ? resizingPage.height : page.height,
              position: "relative",
              backgroundColor: page.backgroundColor || "#ffffff",
              boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
              backgroundImage: showGrid
                ? `linear-gradient(to right, #ececec 1px, transparent 1px), linear-gradient(to bottom, #ececec 1px, transparent 1px)`
                : "none",
                backgroundSize: `${gridSize}px ${gridSize}px`,
              overflow: "hidden",
            }}
          >
            {[...pageItems].filter((item) => !item.hidden).sort((a, b) => a.zIndex - b.zIndex).map(renderCanvasItem)}
          </div>
        </Rnd>
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
            <button onClick={() => setActiveInputTab("pinterest")} style={{ flex: 1, padding: "6px 4px", border: "none", borderBottom: activeInputTab === "pinterest" ? "3px solid #E60023" : "3px solid transparent", background: "transparent", fontWeight: activeInputTab === "pinterest" ? "bold" : "normal", cursor: "pointer", fontSize: "11px", color: activeInputTab === "pinterest" ? "#E60023" : "inherit" }}>Pinterest</button>
          </div>

          {activeInputTab === "links" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <input value={newLinkTitle} onChange={(event) => setNewLinkTitle(event.target.value)} placeholder="Optional title" disabled={!canEdit || isViewOnly} style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginBottom: "5px", flexShrink: 0 }} />
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
              <input value={manualImageTitle} onChange={(event) => setManualImageTitle(event.target.value)} placeholder="Optional image title" disabled={!canEdit || isViewOnly} style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginBottom: "5px" }} />
              <div style={{ display: "flex", gap: "4px" }}>
                <input value={manualImageUrl} onChange={(event) => setManualImageUrl(event.target.value)} placeholder="Direct image URL (.jpg, .png…)" disabled={!canEdit || isViewOnly} style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
                <button onClick={addManualImageUrl} disabled={!canEdit || isViewOnly} style={{ padding: "6px 9px", cursor: "pointer" }}>Add</button>
              </div>
            </div>
          )}

          {activeInputTab === "pinterest" && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "7px", lineHeight: 1.4 }}>
                Paste a public Pinterest board URL to pull images into your Roll.
              </div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                <input
                  value={pinterestUrl}
                  onChange={(e) => setPinterestUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") fetchPinterestBoard(); }}
                  placeholder="https://pinterest.com/user/board/"
                  disabled={pinterestLoading || !canEdit || isViewOnly}
                  style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #E60023", borderRadius: "4px" }}
                />
                <button
                  onClick={fetchPinterestBoard}
                  disabled={pinterestLoading || !pinterestUrl.trim() || !canEdit || isViewOnly}
                  style={{ padding: "6px 9px", cursor: "pointer", backgroundColor: "#E60023", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", fontSize: "12px" }}
                >
                  {pinterestLoading ? "…" : "Import"}
                </button>
              </div>
              <div style={{ fontSize: "10px", color: "#aaa", lineHeight: 1.4 }}>
                Public boards only. Results depend on Pinterest's page structure and may vary.
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
          <div style={{ flex: 1, overflowY: "auto", columnCount: 3, columnGap: "8px" }}>
            {filteredImages.map((image) => (
              <div key={image.id} draggable onDragStart={() => { draggingRollImageRef.current = image; }} onDragEnd={() => { draggingRollImageRef.current = null; }} onDoubleClick={() => addImageToCanvas(image)} title={image.title || "Reference"} style={{ breakInside: "avoid", marginBottom: "8px", backgroundColor: "white", border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden", cursor: "grab" }}>
                <img src={image.url} alt={image.title || "Reference"} draggable={false} style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ flexShrink: 0, backgroundColor: "white", borderBottom: "1px solid #ccc", boxSizing: "border-box", overflow: "visible", position: "relative", zIndex: 50 }}>
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "14px", marginRight: "8px" }}>{activeBoard?.name}</strong>
            <button onClick={addTextToCanvas} disabled={!canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Add Text</button>
            <button onClick={duplicateSelectedItems} disabled={!selectedItems.length || !canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Duplicate</button>
            <button onClick={deleteSelectedItems} disabled={!selectedItems.length || !canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Delete</button>
            <button onClick={clearLocalMoodBoard} disabled={!canEdit || isViewOnly} style={{ padding: "6px 10px", cursor: "pointer" }}>Clear Local</button>
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
            <div style={{ marginLeft: "auto", fontSize: "11px", color: "#777", maxWidth: "360px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{statusMessage}</div>
          </div>

          <div style={{ minHeight: "48px", display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", backgroundColor: "#fafafa", borderTop: "1px solid #eee", boxSizing: "border-box", flexWrap: "wrap", position: "relative", visibility: primarySelectedItem ? "visible" : "hidden" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>{selectedItems.length > 1 ? `${selectedItems.length} ITEMS` : primarySelectedItem.type.toUpperCase()}</span>
              <label style={{ fontSize: "12px" }}><input type="checkbox" checked={!!primarySelectedItem.locked} onChange={(event) => updateSelectedItems({ locked: event.target.checked })} /> Lock</label>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>Opacity <input type="range" min="0.1" max="1" step="0.05" value={primarySelectedItem.opacity ?? 1} onChange={(event) => updateSelectedItems({ opacity: Number(event.target.value) })} /></label>
              {primarySelectedItem.type === "image" && selectedItems.length === 1 && (
                <select value={primarySelectedItem.objectFit || "contain"} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { objectFit: event.target.value })} style={{ padding: "5px", fontSize: "12px" }}>
                <option value="contain">Fit Whole Image</option>
                <option value="cover">Crop / Fill</option>
              </select>
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
                  <input type="number" value={primarySelectedItem.fontSize} min="8" max="180" onChange={(event) => updateCanvasItem(primarySelectedItem.id, { fontSize: Number(event.target.value) || 12 })} style={{ width: "70px", padding: "5px", fontSize: "12px" }} />
                  <select value={primarySelectedItem.fontWeight} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { fontWeight: event.target.value })} style={{ padding: "5px", fontSize: "12px" }}>
                    <option value="normal">Regular</option>
                    <option value="bold">Bold</option>
                    <option value="900">Heavy</option>
                  </select>
                  <label style={{ fontSize: "12px" }}>Color <input type="color" value={primarySelectedItem.color} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { color: event.target.value })} /></label>
                  <label style={{ fontSize: "12px" }}>BG <input type="color" value={primarySelectedItem.backgroundColor === "transparent" ? "#ffffff" : primarySelectedItem.backgroundColor} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { backgroundColor: event.target.value })} /></label>
                  <button onClick={() => updateCanvasItem(primarySelectedItem.id, { backgroundColor: "transparent" })} style={{ fontSize: "11px" }}>Clear BG</button>
                </>
              )}
            </div>
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div ref={boardScrollRef} style={{ flex: 1, overflow: "auto", position: "relative", backgroundColor: "#d9d9d9", zIndex: 1 }}>
            <div style={{ padding: "36px", transform: `scale(${zoom})`, transformOrigin: "top left", width: activePage ? Math.max(...boardPages.map((page) => page.width)) + 80 : "auto" }}>
              {boardPages.map((page, pageIndex) => renderPage(page, pageIndex))}
            </div>
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
                      return (
                        <div key={item.id} onClick={(event) => handleSelectItem(event, item.id)} style={{ padding: "7px 10px", fontSize: "11px", cursor: "pointer", backgroundColor: selected ? "#bbdefb" : "white", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: item.hidden ? 0.45 : 1 }}>{item.type === "text" ? "T" : "IMG"} · {renderLayerName(item)}</span>
                          <span style={{ color: "#999", display: "flex", gap: "4px", flexShrink: 0 }}>
                            <button onClick={(event) => { event.stopPropagation(); toggleLayerVisibility(item.id); }} title={item.hidden ? "Show" : "Hide"} style={{ fontSize: "10px" }}>{item.hidden ? "Show" : "Hide"}</button>
                            <button onClick={(event) => { event.stopPropagation(); changeLayerOrder(item.id, 1); }} title="Move up" style={{ fontSize: "10px" }}>↑</button>
                            <button onClick={(event) => { event.stopPropagation(); changeLayerOrder(item.id, -1); }} title="Move down" style={{ fontSize: "10px" }}>↓</button>
                            {item.locked ? "🔒" : ""}
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

      {presentMode && activeBoard && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.82)", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px" }}>
          <button onClick={() => setPresentMode(false)} style={{ position: "absolute", top: "18px", right: "22px", padding: "8px 12px", cursor: "pointer" }}>Close</button>
          <div style={{ color: "white", marginBottom: "12px", fontWeight: "bold" }}>{activeBoard.name} · Page {presentPageIndex + 1} of {boardPages.length}</div>
          {(() => {
            const page = boardPages[presentPageIndex] || boardPages[0];
            const scale = Math.min((window.innerWidth - 160) / page.width, (window.innerHeight - 160) / page.height, 0.7);
            const pageItems = canvasItems.filter((item) => item.boardId === activeBoard.id && item.pageId === page.id).sort((a, b) => a.zIndex - b.zIndex);
            return (
              <div style={{ width: page.width, height: page.height, transform: `scale(${scale})`, transformOrigin: "center", backgroundColor: page.backgroundColor, position: "relative", boxShadow: "0 8px 35px rgba(0,0,0,0.6)", overflow: "hidden" }}>
                {pageItems.map((item) => {
                  const image = item.type === "image" ? images.find((img) => img.id === item.imageId) : null;
                  return (
                    <div key={item.id} style={{ position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, opacity: item.opacity ?? 1, backgroundColor: item.type === "text" ? item.backgroundColor : "transparent" }}>
                      {item.type === "image" && image && <img src={image.url} alt="" style={{ width: "100%", height: "100%", objectFit: item.objectFit || "cover" }} />}
                      {item.type === "text" && <div style={{ color: item.color, fontFamily: item.fontFamily, fontSize: item.fontSize, fontWeight: item.fontWeight, lineHeight: 1.1, padding: 6, whiteSpace: "pre-wrap" }}>{item.text}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button onClick={() => setPresentPageIndex((prev) => Math.max(0, prev - 1))} disabled={presentPageIndex === 0} style={{ padding: "8px 14px" }}>Previous</button>
            <button onClick={() => setPresentPageIndex((prev) => Math.min(boardPages.length - 1, prev + 1))} disabled={presentPageIndex >= boardPages.length - 1} style={{ padding: "8px 14px" }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MoodBoard;
