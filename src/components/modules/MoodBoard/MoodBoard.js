import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../supabase";
import {
  listMoodboardShareLinks,
  createMoodboardShareLink,
  revokeMoodboardShareLink,
  updateMoodboardShareLinkLabel,
  updateMoodboardShareLinkSnapshots,
} from "../../../services/database";
import { drawMoodBoardTextItem, preloadImagesForItems, renderPageToCanvas } from "./moodBoardRasterize";

const GRID_SIZE = 10;
const STORAGE_VERSION = 2;
const STORAGE_KEY_PREFIX = "filmProductionBinder:moodboard:";
const TOOLBAR_RESERVED_HEIGHT = 118;
const LEFT_PANEL_WIDTH = 357;
const RIGHT_PANEL_WIDTH = 182;
const ROLL_THUMB_DEFAULT_SIZE = 106;
const ROLL_THUMB_MIN_SIZE = 60;
const ROLL_THUMB_MAX_SIZE = 220;
const MIN_VISIBLE_TEXT = 40;
const DEFAULT_LEFT_LAYOUT = {
  boardsH: 248,
  linksH: 220,
  rollExpanded: false,
  rollThumbSize: ROLL_THUMB_DEFAULT_SIZE,
};

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

const BLEND_MODES = [
  { value: "normal",      label: "Normal" },
  { value: "multiply",    label: "Multiply" },
  { value: "screen",      label: "Screen" },
  { value: "overlay",     label: "Overlay" },
  { value: "darken",      label: "Darken" },
  { value: "lighten",     label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn",  label: "Color Burn" },
  { value: "hard-light",  label: "Hard Light" },
  { value: "soft-light",  label: "Soft Light" },
  { value: "difference",  label: "Difference" },
  { value: "exclusion",   label: "Exclusion" },
  { value: "hue",         label: "Hue" },
  { value: "saturation",  label: "Saturation" },
  { value: "color",       label: "Color" },
  { value: "luminosity",  label: "Luminosity" },
  { value: "plus-lighter",label: "Plus Lighter" },
];

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function snap(value, grid = GRID_SIZE) {
  return Math.round(value / grid) * grid;
}

function clamp(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

function clampItemToReachableBounds(item, x, y, page) {
  if (!item || !page) {
    return { x, y };
  }
  const isText = item.type === "text";
  const minX = isText ? MIN_VISIBLE_TEXT - item.width : 0;
  const minY = isText ? MIN_VISIBLE_TEXT - item.height : 0;
  const rawMaxX = isText ? page.width - MIN_VISIBLE_TEXT : Math.max(0, page.width - item.width);
  const rawMaxY = isText ? page.height - MIN_VISIBLE_TEXT : Math.max(0, page.height - item.height);
  const maxX = Math.max(minX, rawMaxX);
  const maxY = Math.max(minY, rawMaxY);
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}

function getStorageKey(selectedProject) {
  const projectId = selectedProject?.id || selectedProject?.name || "default-project";
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function getLeftLayoutStorageKey(selectedProject) {
  return `${getStorageKey(selectedProject)}:left-layout:v1`;
}

function normalizeLeftLayout(raw = {}) {
  return {
    boardsH: Math.round(clamp(raw.boardsH, 80, 440, DEFAULT_LEFT_LAYOUT.boardsH)),
    linksH: Math.round(clamp(raw.linksH, 60, 380, DEFAULT_LEFT_LAYOUT.linksH)),
    rollExpanded: raw.rollExpanded === true,
    rollThumbSize: Math.round(clamp(raw.rollThumbSize, ROLL_THUMB_MIN_SIZE, ROLL_THUMB_MAX_SIZE, DEFAULT_LEFT_LAYOUT.rollThumbSize)),
  };
}

function readLeftLayout(selectedProject) {
  try {
    const raw = localStorage.getItem(getLeftLayoutStorageKey(selectedProject));
    return normalizeLeftLayout(raw ? JSON.parse(raw) : DEFAULT_LEFT_LAYOUT);
  } catch {
    return normalizeLeftLayout(DEFAULT_LEFT_LAYOUT);
  }
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

const CANVAS_BLEND_OPS = new Set([
  "multiply","screen","overlay","darken","lighten",
  "color-dodge","color-burn","hard-light","soft-light",
  "difference","exclusion","hue","saturation","color","luminosity",
]);
function toCanvasBlendMode(mode) {
  if (!mode || mode === "normal") return "source-over";
  return CANVAS_BLEND_OPS.has(mode) ? mode : "source-over";
}

function isStoredImageUrl(url) {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    return parsed.origin === window.location.origin ||
      parsed.hostname === "bjxgrfmrjkkxzkhciitp.supabase.co";
  } catch {
    return false;
  }
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

function getEffectiveSelection(item) {
  if (item.selectionType) {
    return { selectionType: item.selectionType, selX: item.selX ?? 0, selY: item.selY ?? 0, selW: item.selW ?? 1, selH: item.selH ?? 1, selFeather: item.selFeather ?? 0 };
  }
  const cl = item.cropLeft || 0, ct = item.cropTop || 0, cr = item.cropRight || 0, cb = item.cropBottom || 0;
  if (cl + ct + cr + cb > 0.001) {
    return { selectionType: "rect", selX: cl, selY: ct, selW: Math.max(0.05, 1 - cl - cr), selH: Math.max(0.05, 1 - ct - cb), selFeather: item.selFeather ?? item.maskFeather ?? 0 };
  }
  if (item.maskType && item.maskType !== "none") {
    return { selectionType: item.maskType === "ellipse" ? "ellipse" : "rect", selX: 0, selY: 0, selW: 1, selH: 1, selFeather: item.selFeather ?? item.maskFeather ?? 0 };
  }
  return null;
}

const DEBUG_MOODBOARD_PDF_MASKS = false;

function getPdfObjectFitDrawRect(imageW, imageH, boxW, boxH, objectFit = "contain") {
  const scale = objectFit === "cover"
    ? Math.max(boxW / imageW, boxH / imageH)
    : Math.min(boxW / imageW, boxH / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  return {
    drawX: (boxW - drawW) / 2,
    drawY: (boxH - drawH) / 2,
    drawW,
    drawH,
  };
}

function createMoodBoardPdfMaskCanvas(itemW, itemH, selection) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = Math.max(1, Math.round(itemW));
  maskCanvas.height = Math.max(1, Math.round(itemH));
  const maskCtx = maskCanvas.getContext("2d");
  const selX = selection.selX ?? 0;
  const selY = selection.selY ?? 0;
  const selW = selection.selW ?? 1;
  const selH = selection.selH ?? 1;
  const feather = Math.max(0, selection.selFeather ?? 0);
  const x = selX * itemW;
  const y = selY * itemH;
  const w = selW * itemW;
  const h = selH * itemH;

  maskCtx.fillStyle = "white";
  if (selection.selectionType === "ellipse") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = Math.max(1, w / 2);
    const ry = Math.max(1, h / 2);
    maskCtx.save();
    maskCtx.translate(cx, cy);
    maskCtx.scale(rx, ry);
    if (feather > 0) {
      const innerStop = Math.max(0, Math.min(0.995, 1 - feather / Math.max(1, Math.min(rx, ry))));
      const gradient = maskCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, "white");
      gradient.addColorStop(innerStop, "white");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      maskCtx.fillStyle = gradient;
    }
    maskCtx.beginPath();
    maskCtx.arc(0, 0, 1, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
    return maskCanvas;
  }

  if (feather <= 0) {
    maskCtx.fillRect(x, y, w, h);
    return maskCanvas;
  }

  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;
  const safeFeatherX = Math.min(feather, Math.max(0, w / 2));
  const safeFeatherY = Math.min(feather, Math.max(0, h / 2));

  const horizontalGradient = maskCtx.createLinearGradient(left, 0, right, 0);
  horizontalGradient.addColorStop(0, "rgba(255,255,255,0)");
  horizontalGradient.addColorStop(safeFeatherX > 0 ? safeFeatherX / Math.max(1, w) : 0, "white");
  horizontalGradient.addColorStop(safeFeatherX > 0 ? 1 - safeFeatherX / Math.max(1, w) : 1, "white");
  horizontalGradient.addColorStop(1, "rgba(255,255,255,0)");
  maskCtx.fillStyle = horizontalGradient;
  maskCtx.fillRect(left, top, w, h);

  const verticalMask = document.createElement("canvas");
  verticalMask.width = maskCanvas.width;
  verticalMask.height = maskCanvas.height;
  const verticalCtx = verticalMask.getContext("2d");
  const verticalGradient = verticalCtx.createLinearGradient(0, top, 0, bottom);
  verticalGradient.addColorStop(0, "rgba(255,255,255,0)");
  verticalGradient.addColorStop(safeFeatherY > 0 ? safeFeatherY / Math.max(1, h) : 0, "white");
  verticalGradient.addColorStop(safeFeatherY > 0 ? 1 - safeFeatherY / Math.max(1, h) : 1, "white");
  verticalGradient.addColorStop(1, "rgba(255,255,255,0)");
  verticalCtx.fillStyle = verticalGradient;
  verticalCtx.fillRect(left, top, w, h);

  maskCtx.globalCompositeOperation = "destination-in";
  maskCtx.drawImage(verticalMask, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";
  return maskCanvas;
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
    style={{ breakInside: "avoid", marginBottom: "8px", backgroundColor: "#222", border: isDragOver ? "2px solid #2196F3" : "1px solid #ddd", borderRadius: "4px", overflow: "hidden", cursor: "grab", position: "relative", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s, border 0.1s" }}
    >
      {image.uploading && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
          <div style={{ color: "white", fontSize: "10px", fontWeight: "bold" }}>Saving…</div>
        </div>
      )}
      {!isStoredImageUrl(image.url) && !image.uploading && (
        <div
          title="External URL — open lightbox and click Convert to Storage"
          style={{ position: "absolute", top: "3px", left: "3px", width: "8px", height: "8px", backgroundColor: "#FF9800", borderRadius: "50%", zIndex: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        />
      )}
      <img src={image.url} alt={image.title || "Reference"} draggable={false} onDoubleClick={(e) => { e.stopPropagation(); onLightbox?.(); }} style={{ width: "100%", height: "auto", display: "block" }} />

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
            onClick={(e) => { e.stopPropagation(); if (canEdit && !isViewOnly) setEditing(true); }}
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

const MOODBOARD_SESSION_CACHE = new Map();

// Grain tile cache — per-pixel 512×512 noise; size is controlled via CSS background-size scaling
const GRAIN_TILE_CACHE = new Map();
const GRAIN_TILE_SIZE = 512;

function generateGrainTileCanvas(seed, amount, saturation, color) {
  const sat = saturation ?? 1;
  const col = color || "#2e2e2e";
  const key = `${seed}_${amount}_${sat}_${col}`;
  if (GRAIN_TILE_CACHE.has(key)) return GRAIN_TILE_CACHE.get(key);
  const dim = GRAIN_TILE_SIZE;
  const cvs = document.createElement("canvas");
  cvs.width = dim; cvs.height = dim;
  const ctx = cvs.getContext("2d");
  const tmp = document.createElement("canvas"); tmp.width = 1; tmp.height = 1;
  const tctx = tmp.getContext("2d"); tctx.fillStyle = col; tctx.fillRect(0, 0, 1, 1);
  const [cr, cg, cb] = tctx.getImageData(0, 0, 1, 1).data;
  let s = (seed | 0) >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  const imgData = ctx.createImageData(dim, dim);
  const d = imgData.data;
  const maxAlpha = (amount ?? 0.6) * 255;
  // sat=0 → monochrome; sat=1 → ±60 per-channel color noise; sat=3 → ±180
  const colorRange = sat * 60;
  for (let i = 0; i < dim * dim * 4; i += 4) {
    const luma = rand();
    if (colorRange < 0.5) {
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
    } else {
      d[i]   = Math.max(0, Math.min(255, Math.round(cr + (rand() - 0.5) * 2 * colorRange)));
      d[i+1] = Math.max(0, Math.min(255, Math.round(cg + (rand() - 0.5) * 2 * colorRange)));
      d[i+2] = Math.max(0, Math.min(255, Math.round(cb + (rand() - 0.5) * 2 * colorRange)));
    }
    d[i + 3] = Math.round(luma * maxAlpha);
  }
  ctx.putImageData(imgData, 0, 0);
  GRAIN_TILE_CACHE.set(key, cvs);
  return cvs;
}

const GRAIN_DATAURL_CACHE = new Map();
function getGrainDataUrl(seed, amount, saturation, color) {
  const sat = saturation ?? 1;
  const col = color || "#2e2e2e";
  const key = `${seed}_${amount}_${sat}_${col}`;
  if (GRAIN_DATAURL_CACHE.has(key)) return GRAIN_DATAURL_CACHE.get(key);
  const url = generateGrainTileCanvas(seed, amount, saturation, color).toDataURL();
  GRAIN_DATAURL_CACHE.set(key, url);
  return url;
}

const MOODBOARD_TOOLBAR_BTN = {
  padding: "3px 7px",
  fontSize: "10px",
  fontWeight: "bold",
  fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif",
  cursor: "pointer",
  borderRadius: "3px",
  border: "1px solid #ccc",
  backgroundColor: "#f0f0f0",
};

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
  const showGridRef = useRef(true);
  const initialLeftLayout = useMemo(() => readLeftLayout(selectedProject), []);

  const [isLoaded, setIsLoaded] = useState(() => MOODBOARD_SESSION_CACHE.has(getStorageKey(selectedProject)));
  const [boards, setBoards] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.boards : [makeBoard(1)];
  });
  const [activeBoardId, setActiveBoardId] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.activeBoardId : null;
  });
  const [links, setLinks] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.links : [];
  });
  const [images, setImages] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.images : [];
  });
  const [canvasItems, setCanvasItems] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.canvasItems : [];
  });
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [activeInputTab, setActiveInputTab] = useState("links");
  const [newBoardName, setNewBoardName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualImageTitle, setManualImageTitle] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [zoom, setZoom] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.zoom : 0.65;
  });
  const [showGrid, setShowGrid] = useState(() => {
    const c = MOODBOARD_SESSION_CACHE.get(getStorageKey(selectedProject));
    return c ? c.showGrid : true;
  });
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importProjects, setImportProjects] = useState([]);
  const [importLoadingProjects, setImportLoadingProjects] = useState(false);
  const [importSourceId, setImportSourceId] = useState("");
  const [importSourceImages, setImportSourceImages] = useState([]);
  const [importLoadingImages, setImportLoadingImages] = useState(false);
  const [importSelectedIds, setImportSelectedIds] = useState(new Set());
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showTextSpacingDropdown, setShowTextSpacingDropdown] = useState(false);
  const fontDropdownRef = useRef(null);
  const textSpacingRef = useRef(null);
  const [selMode, setSelMode] = useState(null);
  const [selDraft, setSelDraft] = useState(null);
  const [selBounds, setSelBounds] = useState(null);
  const [pendingShapeType, setPendingShapeType] = useState("rect");
  const [showFitSubmenu, setShowFitSubmenu] = useState(false);
  const [showShapeSubmenu, setShowShapeSubmenu] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const selectDropdownRef = useRef(null);
  const selModeRef = useRef(null);
  const [showFitDropdown, setShowFitDropdown] = useState(false);
  const fitDropdownRef = useRef(null);
  const [presentMode, setPresentMode] = useState(false);
  const [presentPageIndex, setPresentPageIndex] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [lightboxImageId, setLightboxImageId] = useState(null);
  const [convertingImageId, setConvertingImageId] = useState(null);
  const pageExportRefs = useRef({});
  const [editingTextId, setEditingTextId] = useState(null);
  const [textEditDraft, setTextEditDraft] = useState(null);
  const textEditRef = useRef({ itemId: null, draft: null });
  const [clipboard, setClipboard] = useState([]);
  const clipboardRef = useRef([]);
  const canvasItemsRef = useRef([]);
  const activePageRef = useRef(null);
  const activeBoardRef = useRef(null);
  const leftLayoutSaveTimerRef = useRef(null);
  const [linksH, setLinksH] = useState(initialLeftLayout.linksH);
  const [boardsH, setBoardsH] = useState(initialLeftLayout.boardsH);
  const [rollExpanded, setRollExpanded] = useState(initialLeftLayout.rollExpanded);
  const [rollThumbSize, setRollThumbSize] = useState(initialLeftLayout.rollThumbSize);
  const [textDragPreview, setTextDragPreview] = useState(null);
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
  const pageDragIdRef = useRef(null);
  const boardPanelDragRef = useRef(null);
  const [boardPanelDragOverPageId, setBoardPanelDragOverPageId] = useState(null);
  const [expandedBoardIds, setExpandedBoardIds] = useState(() => new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [moodboardShareLinks, setMoodboardShareLinks] = useState([]);
  const [shareStatus, setShareStatus] = useState("idle");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSelectedBoardIds, setShareSelectedBoardIds] = useState(new Set());

  const [showSolidDropdown, setShowSolidDropdown] = useState(false);
  const [showEffectsDropdown, setShowEffectsDropdown] = useState(false);
  const solidDropdownRef = useRef(null);
  const effectsDropdownRef = useRef(null);
  const dbSaveTimerRef = useRef(null);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { canvasItemsRef.current = canvasItems; }, [canvasItems]);
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
  const leftLayoutKey = useMemo(() => getLeftLayoutStorageKey(selectedProject), [selectedProject]);

  useEffect(() => {
    const layout = readLeftLayout(selectedProject);
    setBoardsH(layout.boardsH);
    setLinksH(layout.linksH);
    setRollExpanded(layout.rollExpanded);
    setRollThumbSize(layout.rollThumbSize);
  }, [leftLayoutKey]);

  useEffect(() => {
    clearTimeout(leftLayoutSaveTimerRef.current);
    leftLayoutSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(leftLayoutKey, JSON.stringify({
          boardsH,
          linksH,
          rollExpanded,
          rollThumbSize,
        }));
      } catch (err) {
        console.error("MoodBoard left layout save failed:", err);
      }
    }, 150);
    return () => clearTimeout(leftLayoutSaveTimerRef.current);
  }, [leftLayoutKey, boardsH, linksH, rollExpanded, rollThumbSize]);

  useEffect(() => {
    didLoadRef.current = false;

    // If session cache has current data, skip the DB round-trip on remount
    if (MOODBOARD_SESSION_CACHE.has(storageKey)) {
      didLoadRef.current = true;
      setIsLoaded(true);
      return;
    }

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
      if (!selectedProject?.id) { loadFromLocal(); didLoadRef.current = true; setIsLoaded(true); return; }
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
            setTimeout(() => setStatusMessage(prev => prev === "Loaded MoodBoard from database." ? "Saved" : prev), 2500);
          } else {
            loadFromLocal();
          }
      } catch (err) {
        console.error("MoodBoard DB load error:", err);
        loadFromLocal();
      } finally {
        setTimeout(() => { didLoadRef.current = true; setIsLoaded(true); }, 0);
      }
    };

    load();
  }, [storageKey, selectedProject?.id]);

  useEffect(() => {
    if (!didLoadRef.current) return;
    // Keep session cache current so remounting skips DB round-trip
    MOODBOARD_SESSION_CACHE.set(storageKey, { boards, activeBoardId, links, images, canvasItems, zoom, showGrid });
    // Always save to localStorage immediately
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        version: STORAGE_VERSION, savedAt: new Date().toISOString(),
        activeBoardId, boards, links, images, canvasItems, zoom, showGrid,
      }));
    } catch (err) {
      console.error("Local save failed:", err);
    }
    // Signal pending DB save
    if (selectedProject?.id) {
      setStatusMessage("Saving...");
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
        setStatusMessage("Saved");
      } catch (err) {
        console.error("MoodBoard DB save error:", err);
        setStatusMessage("Save failed. Changes stored locally.");
      }
    }, 2000);
  }, [storageKey, activeBoardId, boards, links, images, canvasItems, zoom, showGrid, selectedProject?.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const tagName = target?.tagName;

      const isEditingTextBox = editingTextId !== null;
      const isTypingInFormControl = tagName === "INPUT" || tagName === "SELECT" || isEditingTextBox;

      if (event.key === "Escape" && selMode) {
        setSelMode(null);
        setSelDraft(null);
        setSelBounds(null);
        event.preventDefault();
        return;
      }

      // Copy canvas items — only when not editing text in a text box
      if ((event.metaKey || event.ctrlKey) && event.key === "c" && !isEditingTextBox && selectedItemIds.length > 0) {
        const toCopy = canvasItemsRef.current.filter(ci => selectedItemIds.includes(ci.id));
        clipboardRef.current = toCopy;
        setClipboard(toCopy);
        event.preventDefault();
        return;
      }

      if (isTypingInFormControl) return;

      // Paste canvas items onto active page
      if ((event.metaKey || event.ctrlKey) && event.key === "v" && clipboardRef.current.length > 0) {
        const pg = activePageRef.current;
        const bd = activeBoardRef.current;
        if (!pg || !bd) return;
        const all = canvasItemsRef.current;
        const targetPageId = selectedItemIds.length > 0
          ? (all.find(ci => ci.id === selectedItemIds[0])?.pageId || pg.id)
          : pg.id;
        const maxZ = all.filter(ci => ci.pageId === targetPageId).reduce((m, ci) => Math.max(m, ci.zIndex), 0);
        const copies = clipboardRef.current.map((item, i) => ({
          ...item,
          id: makeId(item.type),
          pageId: targetPageId,
          boardId: bd.id,
          x: item.x + 20,
          y: item.y + 20,
          zIndex: maxZ + i + 1,
        }));
        setCanvasItems(prev => [...prev, ...copies]);
        setSelectedItemIds(copies.map(c => c.id));
        event.preventDefault();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedItemIds.length) {
          event.preventDefault();
          deleteSelectedItems();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemIds, editingTextId, selMode]);

  useEffect(() => {
    if (!lightboxImageId) return;
    const handleLightboxKey = (e) => {
      if (e.key === "Escape") { setLightboxImageId(null); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setLightboxImageId(id => {
          const idx = images.findIndex(img => img.id === id);
          return idx > 0 ? images[idx - 1].id : id;
        });
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setLightboxImageId(id => {
          const idx = images.findIndex(img => img.id === id);
          return idx < images.length - 1 ? images[idx + 1].id : id;
        });
      }
    };
    window.addEventListener("keydown", handleLightboxKey);
    return () => window.removeEventListener("keydown", handleLightboxKey);
  }, [lightboxImageId, images]);

  useEffect(() => { selModeRef.current = selMode; }, [selMode]);

  useEffect(() => {
    if (!showFontDropdown && !showTextSpacingDropdown && !showFitDropdown && !showSelectDropdown && !showSolidDropdown && !showEffectsDropdown) return;
    const handleOutside = (e) => {
      if (showFontDropdown && fontDropdownRef.current && !fontDropdownRef.current.contains(e.target)) {
        setShowFontDropdown(false);
      }
      if (showTextSpacingDropdown && textSpacingRef.current && !textSpacingRef.current.contains(e.target)) {
        setShowTextSpacingDropdown(false);
      }
      if (showFitDropdown && fitDropdownRef.current && !fitDropdownRef.current.contains(e.target)) {
        setShowFitDropdown(false);
      }
      if (showSelectDropdown && !selModeRef.current && selectDropdownRef.current && !selectDropdownRef.current.contains(e.target)) {
        setShowSelectDropdown(false);
      }
      if (showSolidDropdown && solidDropdownRef.current && !solidDropdownRef.current.contains(e.target)) {
        setShowSolidDropdown(false);
      }
      if (showEffectsDropdown && effectsDropdownRef.current && !effectsDropdownRef.current.contains(e.target)) {
        setShowEffectsDropdown(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowFontDropdown(false);
        setShowTextSpacingDropdown(false);
        setShowFitDropdown(false);
        setShowSelectDropdown(false);
        setShowSolidDropdown(false);
        setShowEffectsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showFontDropdown, showTextSpacingDropdown, showFitDropdown, showSelectDropdown, showSolidDropdown, showEffectsDropdown]);

  const activeBoard = useMemo(() => {
    if (!boards.length) return null;
    return boards.find((b) => b.id === activeBoardId) || boards[0];
  }, [boards, activeBoardId]);

  const boardPages = activeBoard?.pages || [];
  const activePage = useMemo(() => {
    if (!activeBoard) return null;
    return activeBoard.pages.find((p) => p.id === activeBoard.activePageId) || activeBoard.pages[0] || null;
  }, [activeBoard]);
  // Sync refs after useMemo declarations to avoid TDZ — these must not be above activePage/activeBoard
  useEffect(() => { activePageRef.current = activePage; }, [activePage]);
  useEffect(() => { activeBoardRef.current = activeBoard; }, [activeBoard]);

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

  const reorderPage = (pageId, targetIndex, boardId) => {
    const targetBoardId = boardId || activeBoard?.id;
    if (!targetBoardId) return;
    updateBoard(targetBoardId, (board) => {
      const pages = [...board.pages];
      const fromIdx = pages.findIndex(p => p.id === pageId);
      if (fromIdx < 0 || fromIdx === targetIndex) return board;
      const [moved] = pages.splice(fromIdx, 1);
      pages.splice(targetIndex, 0, moved);
      return { ...board, pages };
    });
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
    setStatusMessage(`${getSourceLabel(type)} link added.`);
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

    // Add a placeholder so the user sees something is happening
    setImages(prev => [...prev, {
      id: tempId,
      sourceLinkId: null,
      title,
      url: null,
      originalUrl: url,
      width: 900,
      height: 600,
      naturalWidth: null,
      naturalHeight: null,
      source: "image-url",
      uploading: true,
    }]);

    // Fetch and store in Supabase — external URL is NEVER used as the render source
    const { supabaseUrl, errorMsg } = await uploadImageFromUrl(url, title);

    if (!supabaseUrl) {
      // Upload failed — remove placeholder so no broken/external image lives in the Roll
      setImages(prev => prev.filter(img => img.id !== tempId));
      setStatusMessage(errorMsg || "Could not import image — the server may block direct downloads. Upload the file instead.");
      return;
    }

    // Get dimensions from the stored URL (same-origin, safe)
    const dims = await getImageDimensions(supabaseUrl);

    setImages(prev => prev.map(img =>
      img.id === tempId
        ? { ...img, url: supabaseUrl, width: dims.width, height: dims.height, naturalWidth: dims.width, naturalHeight: dims.height, uploading: false }
        : img
    ));
    setStatusMessage("Image added to Roll.");
  };

  const convertImageToStorage = async (imageId) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    // Already stored — nothing to do
    if (isStoredImageUrl(image.url)) return;
    // Prefer the original external URL; fall back to current url
    const externalUrl = image.originalUrl || image.url;
    if (!externalUrl) return;

    setConvertingImageId(imageId);
    setStatusMessage("Converting image to storage…");
    const { supabaseUrl, errorMsg } = await uploadImageFromUrl(externalUrl, image.title);
    if (!supabaseUrl) {
      setConvertingImageId(null);
      setStatusMessage(errorMsg || "Could not convert image. Try re-importing the URL.");
      return;
    }
    const dims = await getImageDimensions(supabaseUrl);
    setImages(prev => prev.map(img =>
      img.id === imageId
        ? {
            ...img,
            url: supabaseUrl,
            originalUrl: img.originalUrl || externalUrl,
            source: "converted-url",
            width: dims.width || img.width,
            height: dims.height || img.height,
            naturalWidth: dims.width || img.naturalWidth,
            naturalHeight: dims.height || img.naturalHeight,
            uploading: false,
          }
        : img
    ));
    setConvertingImageId(null);
    setStatusMessage("Image converted to storage.");
  };

  const addLocalFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = "";
    setStatusMessage(`Uploading ${files.length} image${files.length > 1 ? "s" : ""}...`);

    for (const file of files) {
      const tempId = makeId("img");
      const localUrl = URL.createObjectURL(file);

      // Detect natural dimensions from blob URL before adding to Roll
      const dims = await new Promise(res => {
        const tempImg = new Image();
        tempImg.onload = () => res({ naturalWidth: tempImg.naturalWidth, naturalHeight: tempImg.naturalHeight });
        tempImg.onerror = () => res({ naturalWidth: 0, naturalHeight: 0 });
        tempImg.src = localUrl;
      });

      setImages(prev => [...prev, {
        id: tempId,
        sourceLinkId: null,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url: localUrl,
        originalUrl: localUrl,
        width: dims.naturalWidth || 900,
        height: dims.naturalHeight || 600,
        naturalWidth: dims.naturalWidth || undefined,
        naturalHeight: dims.naturalHeight || undefined,
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
    const natW = image.naturalWidth;
    const natH = image.naturalHeight;
    let width, height;
    if (natW && natH) {
      // Scale down to fit 85% of canvas if needed; never enlarge beyond natural size
      const scale = Math.min(1, (page.width * 0.85) / natW, (page.height * 0.85) / natH);
      width = Math.round(natW * scale);
      height = Math.round(natH * scale);
    } else {
      // Legacy fallback: size relative to canvas
      const ratio = getImageRatio(image);
      width = Math.min(320, Math.max(160, Math.round(page.width * 0.18)));
      height = Math.round(width / ratio);
    }

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
    if (!activeBoard) return;
    const selectedItem = selectedItemIds.length > 0
      ? canvasItems.find(ci => ci.id === selectedItemIds[0])
      : null;
    const targetPage = selectedItem
      ? boardPages.find(p => p.id === selectedItem.pageId)
      : activePage;
    if (!targetPage) return;
    const item = {
      id: makeId("text"),
      type: "text",
      boardId: activeBoard.id,
      pageId: targetPage.id,
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
      textBlur: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      zIndex: (activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0)) + 1,
      name: "Text",
    };
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
  };

  const addSolidToCanvas = (shape) => {
    if (!activeBoard) return;
    const selectedItem = selectedItemIds.length > 0
      ? canvasItems.find(ci => ci.id === selectedItemIds[0])
      : null;
    const targetPage = selectedItem
      ? boardPages.find(p => p.id === selectedItem.pageId)
      : activePage;
    if (!targetPage) return;
    const item = {
      id: makeId("solid"),
      type: "solid",
      boardId: activeBoard.id,
      pageId: targetPage.id,
      solidShape: shape,
      solidColor: "#cccccc",
      cornerRadius: 0,
      x: 200,
      y: 200,
      width: 300,
      height: 200,
      opacity: 1,
      blendMode: "normal",
      locked: false,
      hidden: false,
      zIndex: (activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0)) + 1,
      name: shape === "ellipse" ? "Ellipse" : "Rectangle",
    };
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
  };

  const addGrainLayer = () => {
    if (!activeBoard) return;
    const selectedItem = selectedItemIds.length > 0
      ? canvasItems.find(ci => ci.id === selectedItemIds[0])
      : null;
    const targetPage = selectedItem
      ? boardPages.find(p => p.id === selectedItem.pageId)
      : activePage;
    if (!targetPage) return;
    const item = {
      id: makeId("grain"),
      type: "grain",
      boardId: activeBoard.id,
      pageId: targetPage.id,
      grainAmount: 0.6,
      grainSize: 1,
      grainSoftening: 0,
      grainSaturation: 1,
      grainSeed: Math.floor(Math.random() * 100000),
      grainColor: "#2e2e2e",
      x: 0,
      y: 0,
      width: targetPage.width,
      height: targetPage.height,
      opacity: 0.35,
      blendMode: "normal",
      locked: false,
      hidden: false,
      zIndex: (activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0)) + 1,
      name: "Grain Layer",
    };
    setCanvasItems((prev) => [...prev, item]);
    setSelectedItemIds([item.id]);
  };

  const updateCanvasItem = useCallback((itemId, patch) => {
    setCanvasItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, []);

  const commitTextDraft = useCallback(() => {
    const { itemId, draft } = textEditRef.current;
    if (itemId !== null && draft !== null) {
      setCanvasItems(prev => prev.map(ci =>
        ci.id === itemId ? { ...ci, text: draft, name: draft?.slice(0, 24) || "Text" } : ci
      ));
    }
    textEditRef.current = { itemId: null, draft: null };
    setEditingTextId(null);
    setTextEditDraft(null);
  }, []);

  const updateSelectedItems = (patch) => {
    const ids = new Set(selectedItemIds);
    setCanvasItems((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, ...patch } : item)));
  };

  const handleSelectItem = (event, itemId) => {
    event.stopPropagation();
    if (textEditRef.current.itemId && textEditRef.current.itemId !== itemId) {
      commitTextDraft();
    }
    if (event.shiftKey) {
      setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
    } else {
      if (itemId !== selectedItemIds[0]) setShowSelectDropdown(false);
      setSelectedItemIds([itemId]);
    }
    const item = canvasItems.find(ci => ci.id === itemId);
    if (item?.pageId) setActivePage(item.pageId);
  };

  const deleteImage = (imageId) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const openImportPanel = async () => {
    setShowImportPanel(true);
    setImportSourceId("");
    setImportSourceImages([]);
    setImportSelectedIds(new Set());
    setImportLoadingProjects(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;
      const [{ data: owned }, { data: member }] = await Promise.all([
        supabase.from("projects").select("id, name").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("project_members").select("project_id, projects(id, name)").eq("user_id", userId),
      ]);
      const all = [
        ...(owned || []),
        ...(member || []).map(m => m.projects).filter(Boolean),
      ];
      const seen = new Set();
      const unique = all.filter(p => {
        if (!p?.id || p.id === selectedProject?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setImportProjects(unique);
    } catch (err) {
      console.error("MoodBoard import: failed to load projects", err);
    } finally {
      setImportLoadingProjects(false);
    }
  };

  const loadImportProjectImages = async (projectId) => {
    setImportSourceId(projectId);
    setImportSourceImages([]);
    setImportSelectedIds(new Set());
    if (!projectId) return;
    setImportLoadingImages(true);
    try {
      const { data } = await supabase.from("moodboard_data").select("images").eq("project_id", projectId).maybeSingle();
      setImportSourceImages(Array.isArray(data?.images) ? data.images.filter(img => img?.url) : []);
    } catch (err) {
      console.error("MoodBoard import: failed to load images", err);
    } finally {
      setImportLoadingImages(false);
    }
  };

  const doImportImages = () => {
    const existingUrls = new Set(images.map(img => img.url).filter(Boolean));
    const toImport = importSourceImages.filter(img => importSelectedIds.has(img.id) && !existingUrls.has(img.url));
    if (!toImport.length) {
      setStatusMessage("No new images to import (already in Roll or none selected).");
      return;
    }
    const newImages = toImport.map(img => ({
      ...img,
      id: makeId("img"),
      sourceLinkId: null,
      uploading: false,
    }));
    setImages(prev => [...prev, ...newImages]);
    setStatusMessage(`Imported ${newImages.length} image${newImages.length > 1 ? "s" : ""} to Roll.`);
    setShowImportPanel(false);
    setImportSelectedIds(new Set());
  };

  const proxyImageToBase64 = async (url) => {
    try {
      const res = await fetch(`/.netlify/functions/image-proxy?url=${encodeURIComponent(url)}`);
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) {
        const preview = await res.text();
        console.error(`Image proxy non-JSON (${res.status}, ${ct}): ${preview.slice(0, 120)}`);
        return null;
      }
      const data = await res.json();
      return data.dataUrl || null;
    } catch { return null; }
  };

  const uploadImageFromUrl = async (originalUrl, title = "") => {
    try {
      setStatusMessage("Downloading image...");

      let blob = null;
      let mime = "image/jpeg";

      // Attempt 1: direct browser fetch (succeeds when server sends CORS headers)
      try {
        const directRes = await fetch(originalUrl, { mode: "cors" });
        if (directRes.ok) {
          blob = await directRes.blob();
          mime = blob.type && blob.type !== "application/octet-stream" ? blob.type : "image/jpeg";
        }
      } catch (_) {
        // CORS-blocked or network error — fall through to proxy
      }

      // Attempt 2: server-side proxy (bypasses browser CORS restriction)
      // Requires `netlify dev` locally (npm start alone does not serve functions).
      if (!blob) {
        const proxyRes = await fetch(`/.netlify/functions/image-proxy?url=${encodeURIComponent(originalUrl)}`);
        const proxyContentType = proxyRes.headers.get("content-type") || "";
        if (!proxyRes.ok || !proxyContentType.includes("application/json")) {
          const preview = await proxyRes.text();
          console.error(`Image proxy non-JSON response (status ${proxyRes.status}, type: ${proxyContentType}): ${preview.slice(0, 120)}`);
          throw new Error(
            proxyContentType.includes("text/html") || proxyRes.status === 404
              ? "Image proxy unavailable — run `netlify dev` instead of `npm start` for URL import in local development"
              : `Image proxy returned unexpected response (${proxyRes.status})`
          );
        }
        const proxyData = await proxyRes.json();
        if (!proxyData.dataUrl) throw new Error("Image could not be fetched via proxy");
        const [meta, b64] = proxyData.dataUrl.split(",");
        mime = meta.match(/:(.*?);/)[1];
        const byteString = atob(b64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        blob = new Blob([ab], { type: mime });
      }

      // Upload blob to Supabase Storage
      const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const filename = `${selectedProject?.id || "shared"}/${makeId("img")}.${ext}`;
      const { error } = await supabase.storage
        .from("moodboard-images")
        .upload(filename, blob, { contentType: mime, upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("moodboard-images")
        .getPublicUrl(filename);

      return { supabaseUrl: urlData.publicUrl, originalUrl };
    } catch (err) {
      console.error("uploadImageFromUrl error:", err);
      // Return failure — caller must NOT fall back to the external URL
      return { supabaseUrl: null, originalUrl, errorMsg: "Could not download or store image: " + err.message };
    }
  };

  const openShareModal = async () => {
    setShareMessage("");
    setShareSelectedBoardIds(new Set());
    setShowShareModal(true);
    setShareStatus("loading");
    try {
      const links = await listMoodboardShareLinks(selectedProject.id);
      setMoodboardShareLinks(links);
      setShareStatus("idle");
    } catch {
      setShareStatus("error");
      setShareMessage("Could not load share links.");
    }
  };

  const handleCreateMoodboardShareLink = async () => {
    if (shareSelectedBoardIds.size === 0) {
      setShareMessage("Select at least one board to share.");
      return;
    }
    setShareStatus("saving");
    setShareMessage("");
    try {
      const selectedBoardIdArr = Array.from(shareSelectedBoardIds);

      // Block if any selected board has external (non-storage) images
      const externalCount = canvasItems.filter(item => {
        if (!selectedBoardIdArr.includes(item.boardId)) return false;
        if (item.type !== "image" || item.hidden) return false;
        const imgData = images.find(img => img.id === item.imageId);
        return imgData?.url && !isStoredImageUrl(imgData.url);
      }).length;
      if (externalCount > 0) {
        setShareStatus("error");
        setShareMessage(`Cannot share: ${externalCount} image(s) use external URLs. Convert them to Storage first.`);
        return;
      }

      // Create the link record first to get the token
      const link = await createMoodboardShareLink(selectedProject.id, selectedBoardIdArr);

      // Rasterize each board/page and upload to Supabase Storage
      setShareMessage("Rasterizing boards…");
      const snapshots = [];
      const selectedBoards = boards.filter(b => selectedBoardIdArr.includes(b.id));

      for (const board of selectedBoards) {
        const bPages = board.pages || [];
        const boardItems = canvasItems.filter(item => item.boardId === board.id && !item.hidden);
        const loadedImgMap = await preloadImagesForItems(boardItems, images);

        for (const page of bPages) {
          const pageItems = boardItems.filter(item => item.pageId === page.id);
          const cvs = await renderPageToCanvas(page, pageItems, images, loadedImgMap);

          const blob = await new Promise(res => cvs.toBlob(res, "image/png"));
          const filePath = `${link.token}/${board.id}_${page.id}.png`;
          const { error: uploadErr } = await supabase.storage
            .from("moodboard-share-snapshots")
            .upload(filePath, blob, { contentType: "image/png", upsert: true });
          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from("moodboard-share-snapshots")
            .getPublicUrl(filePath);

          snapshots.push({
            boardId: board.id,
            boardName: board.name || "Board",
            pageId: page.id,
            pageName: page.name || `Page ${bPages.indexOf(page) + 1}`,
            imageUrl: urlData.publicUrl,
            width: page.width,
            height: page.height,
          });
        }
      }

      const updatedLink = await updateMoodboardShareLinkSnapshots(link.id, snapshots);
      setMoodboardShareLinks(prev => [updatedLink, ...prev]);
      setShareStatus("idle");
      setShareSelectedBoardIds(new Set());
      const url = `${window.location.origin}/share/moodboard/${link.token}`;
      try { await navigator.clipboard.writeText(url); setShareMessage("Link created and copied!"); }
      catch { setShareMessage("Link created. Copy the URL above."); }
    } catch (err) {
      setShareStatus("error");
      setShareMessage("Could not create share link: " + (err?.message || "unknown error"));
    }
  };

  const handleRevokeMoodboardShareLink = async (linkId) => {
    setShareStatus("saving");
    try {
      const updated = await revokeMoodboardShareLink(linkId);
      setMoodboardShareLinks(prev => prev.map(l => l.id === linkId ? updated : l));
      setShareStatus("idle");
    } catch {
      setShareStatus("error");
      setShareMessage("Could not revoke link.");
    }
  };

  const handleUpdateMoodboardShareLinkLabel = async (linkId, label) => {
    try {
      const updated = await updateMoodboardShareLinkLabel(linkId, label);
      setMoodboardShareLinks(prev => prev.map(l => l.id === linkId ? updated : l));
    } catch {
      // silent — label update is best-effort
    }
  };

  const exportBoardToPdf = async () => {
    if (exportingPdf || !activeBoard || boardPages.length === 0) return;
    setExportingPdf(true);
    setStatusMessage("Preparing PDF export...");
    try {
      // Load jsPDF only; text item rasterization is handled by the shared MoodBoard renderer.
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
      const PX_TO_PT = 72 / 96;
      const pdf = new jsPDF({
        orientation: firstPage.width > firstPage.height ? "landscape" : "portrait",
        unit: "pt",
        format: [firstPage.width * PX_TO_PT, firstPage.height * PX_TO_PT],
      });

      // Canvas text rendering uses system/document fonts directly — no Google Fonts fetch needed.
      // Fetching and adding fonts via document.fonts.add() mutates global DOM state and
      // causes live app text to reflowing, which is the visible side effect during export.
      await document.fonts.ready;

      // Load all images as HTMLImageElement objects upfront
      setStatusMessage("Loading images...");

      const loadedImgMap = {};
      const allImageItems = canvasItems.filter(item =>
        item.boardId === activeBoard.id && item.type === "image" && !item.hidden
      );

      const externalItems = allImageItems.filter(item => {
        const imgData = images.find(img => img.id === item.imageId);
        return imgData?.url && !isStoredImageUrl(imgData.url);
      });
      if (externalItems.length > 0) {
        setExportingPdf(false);
        setStatusMessage(
          `PDF export blocked: ${externalItems.length} image(s) use external URLs. Open each image in the Roll lightbox and click "Convert to Storage", then export again.`
        );
        return;
      }

      await Promise.all(allImageItems.map(item => {
        const imgData = images.find(img => img.id === item.imageId);
        if (!imgData?.url || loadedImgMap[imgData.url]) return;
        return new Promise(res => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => { loadedImgMap[imgData.url] = el; res(); };
          el.onerror = () => res(); // skip broken images — no no-CORS retry (would taint canvas)
          el.src = imgData.url;
        });
      }));

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
            ctx.globalCompositeOperation = toCanvasBlendMode(item.blendMode);

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
                const iw = imgEl.naturalWidth;
                const ih = imgEl.naturalHeight;
                if (iw > 0 && ih > 0) {
                  const itemW = item.width;
                  const itemH = item.height;
                  const sel = getEffectiveSelection(item);
                  const hasCropOffset = item.cropRenderW != null && item.cropRenderH != null;
                  const cropRenderW = hasCropOffset ? item.cropRenderW : itemW;
                  const cropRenderH = hasCropOffset ? item.cropRenderH : itemH;
                  const cropRenderOffsetX = hasCropOffset ? (item.cropRenderOffsetX || 0) : 0;
                  const cropRenderOffsetY = hasCropOffset ? (item.cropRenderOffsetY || 0) : 0;
                  const fitRect = getPdfObjectFitDrawRect(iw, ih, cropRenderW, cropRenderH, item.objectFit || "contain");
                  const drawX = cropRenderOffsetX + fitRect.drawX;
                  const drawY = cropRenderOffsetY + fitRect.drawY;
                  const drawW = fitRect.drawW;
                  const drawH = fitRect.drawH;

                  const imageCanvas = document.createElement("canvas");
                  imageCanvas.width = Math.max(1, Math.round(itemW));
                  imageCanvas.height = Math.max(1, Math.round(itemH));
                  const imageCtx = imageCanvas.getContext("2d");
                  imageCtx.drawImage(imgEl, drawX, drawY, drawW, drawH);

                  const hasNonTrivialSelection = !!sel && (
                    sel.selectionType === "ellipse" ||
                    (sel.selFeather ?? 0) > 0 ||
                    sel.selX > 0.001 ||
                    sel.selY > 0.001 ||
                    sel.selW < 0.999 ||
                    sel.selH < 0.999
                  );

                  if (DEBUG_MOODBOARD_PDF_MASKS && (
                    sel ||
                    hasCropOffset ||
                    item.maskType ||
                    item.cropLeft ||
                    item.cropRight ||
                    item.cropTop ||
                    item.cropBottom
                  )) {
                    console.log("[MoodBoard PDF mask]", {
                      id: item.id,
                      imageId: item.imageId,
                      pageId: item.pageId,
                      x: item.x,
                      y: item.y,
                      width: item.width,
                      height: item.height,
                      cropRenderW: item.cropRenderW,
                      cropRenderH: item.cropRenderH,
                      cropRenderOffsetX: item.cropRenderOffsetX,
                      cropRenderOffsetY: item.cropRenderOffsetY,
                      selectionType: item.selectionType,
                      selX: item.selX,
                      selY: item.selY,
                      selW: item.selW,
                      selH: item.selH,
                      selFeather: item.selFeather,
                      maskType: item.maskType,
                      maskFeather: item.maskFeather,
                      cropLeft: item.cropLeft,
                      cropRight: item.cropRight,
                      cropTop: item.cropTop,
                      cropBottom: item.cropBottom,
                      effectiveSelection: sel,
                      exportCase: hasCropOffset
                        ? (sel?.selectionType === "ellipse" ? "collapsed cropRender ellipse mask" : hasNonTrivialSelection ? "collapsed cropRender feathered rect mask" : "collapsed cropRender rect/unmasked")
                        : hasNonTrivialSelection
                        ? (sel.selectionType === "ellipse" ? "legacy ellipse mask" : "legacy rect mask")
                        : "unmasked",
                      drawX,
                      drawY,
                      drawW,
                      drawH,
                    });
                  }

                  if (hasNonTrivialSelection) {
                    const maskCanvas = createMoodBoardPdfMaskCanvas(itemW, itemH, sel);
                    imageCtx.globalCompositeOperation = "destination-in";
                    imageCtx.drawImage(maskCanvas, 0, 0);
                    imageCtx.globalCompositeOperation = "source-over";
                  }
                  ctx.drawImage(imageCanvas, item.x, item.y);
                }
              }

          } else if (item.type === "text") {
            await drawMoodBoardTextItem(ctx, item);
          } else if (item.type === "solid") {
            ctx.fillStyle = item.solidColor || "#cccccc";
            if (item.solidShape === "ellipse") {
              ctx.beginPath();
              ctx.ellipse(
                item.x + item.width / 2, item.y + item.height / 2,
                item.width / 2, item.height / 2,
                0, 0, Math.PI * 2
              );
              ctx.fill();
            } else {
              const cr = item.cornerRadius ?? 0;
              if (cr > 0 && typeof ctx.roundRect === "function") {
                ctx.beginPath();
                ctx.roundRect(item.x, item.y, item.width, item.height, [Math.min(cr, Math.min(item.width, item.height) / 2)]);
                ctx.fill();
              } else {
                ctx.fillRect(item.x, item.y, item.width, item.height);
              }
            }
          } else if (item.type === "grain") {
            const tileCanvas = generateGrainTileCanvas(
              item.grainSeed || 0,
              item.grainAmount ?? 0.6,
              item.grainSaturation ?? 1,
              item.grainColor || "#2e2e2e"
            );
            const pattern = ctx.createPattern(tileCanvas, "repeat");
            if (pattern) {
              const grainScale = item.grainSize ?? 1;
              if (grainScale !== 1) {
                try { pattern.setTransform(new DOMMatrix().scale(grainScale)); } catch (_) {}
              }
              const blurPx = (item.grainSoftening ?? 0) * 0.15;
              if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, page.width, page.height);
              ctx.filter = "none";
            }
          }

          ctx.restore();
        }

        const dataUrl = cvs.toDataURL("image/png");
        if (i > 0) pdf.addPage([page.width * PX_TO_PT, page.height * PX_TO_PT], page.width > page.height ? "landscape" : "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, page.width * PX_TO_PT, page.height * PX_TO_PT);
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
    textEditRef.current = { itemId: null, draft: null };
    setEditingTextId(null);
    setTextEditDraft(null);
    const ids = new Set(selectedItemIds);
    setCanvasItems((prev) => prev.filter((item) => !ids.has(item.id)));
    setSelectedItemIds([]);
  };

  const fitImageWidth = () => {
    if (!primarySelectedItem || primarySelectedItem.type !== "image") return;
    const page = boardPages.find(p => p.id === primarySelectedItem.pageId);
    if (!page) return;
    const ratio = primarySelectedItem.width / primarySelectedItem.height;
    const newW = page.width;
    const newH = Math.round(newW / ratio);
    updateCanvasItem(primarySelectedItem.id, {
      width: newW, height: newH,
      x: Math.round(page.width / 2 - newW / 2),
      y: Math.round(page.height / 2 - newH / 2),
      _baseWidth: newW,
    });
  };

  const fitImageHeight = () => {
    if (!primarySelectedItem || primarySelectedItem.type !== "image") return;
    const page = boardPages.find(p => p.id === primarySelectedItem.pageId);
    if (!page) return;
    const ratio = primarySelectedItem.width / primarySelectedItem.height;
    const newH = page.height;
    const newW = Math.round(newH * ratio);
    updateCanvasItem(primarySelectedItem.id, {
      width: newW, height: newH,
      x: Math.round(page.width / 2 - newW / 2),
      y: Math.round(page.height / 2 - newH / 2),
      _baseWidth: newW,
    });
  };

  const fitImageCanvas = () => {
    if (!primarySelectedItem || primarySelectedItem.type !== "image") return;
    const page = boardPages.find(p => p.id === primarySelectedItem.pageId);
    if (!page) return;
    const scale = Math.min(page.width / primarySelectedItem.width, page.height / primarySelectedItem.height);
    const newW = Math.round(primarySelectedItem.width * scale);
    const newH = Math.round(primarySelectedItem.height * scale);
    updateCanvasItem(primarySelectedItem.id, {
      width: newW, height: newH,
      x: Math.round(page.width / 2 - newW / 2),
      y: Math.round(page.height / 2 - newH / 2),
      _baseWidth: newW,
    });
  };

  const duplicateSelectedItems = () => {
    if (!selectedItems.length) return;
    const maxZ = activeBoardItems.reduce((max, i) => Math.max(max, i.zIndex || 1), 0);
    const copies = selectedItems.map((item, idx) => ({
      ...item,
      id: makeId(item.type === "text" ? "text" : item.type === "solid" ? "solid" : item.type === "grain" ? "grain" : "canvas_img"),
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
    const originalZIndices = {};
    canvasItems.forEach(ci => {
      if (dragIds.includes(ci.id)) {
        startPositions[ci.id] = { x: ci.x, y: ci.y };
        originalZIndices[ci.id] = ci.zIndex || 1;
      }
    });
    const page = boardPages.find(p => p.id === item.pageId);
    // Snapshot other items for guide calculation (frozen at drag start)
    const otherItems = canvasItems.filter(ci => ci.boardId === activeBoard?.id && ci.pageId === item.pageId && !dragIds.includes(ci.id) && !ci.hidden);
    const pageRect = pageExportRefs.current[item.pageId]?.getBoundingClientRect();
    const itemLeft = pageRect ? pageRect.left + item.x * zoomRef.current : e.clientX;
    const itemTop = pageRect ? pageRect.top + item.y * zoomRef.current : e.clientY;
    const pointerOffsetX = e.clientX - itemLeft;
    const pointerOffsetY = e.clientY - itemTop;
    const ghostLeft = e.clientX - pointerOffsetX;
    const ghostTop = e.clientY - pointerOffsetY;
    dragRef.current = {
      type: "drag",
      itemIds: dragIds,
      startPointer: { x: e.clientX, y: e.clientY },
      startPositions,
      originalZIndices,
      page,
      otherItems,
      primaryId: item.id,
      primarySize: { w: item.width, h: item.height },
      pointerOffset: { x: pointerOffsetX, y: pointerOffsetY },
      ghostLeft,
      ghostTop,
      textGhostItemId: item.type === "text" ? item.id : null,
      moved: false,
    };

    if (item.type === "text") {
      setTextDragPreview({
        itemId: item.id,
        text: item.text || "",
        clientX: e.clientX,
        clientY: e.clientY,
        ghostLeft,
        ghostTop,
        offsetX: pointerOffsetX,
        offsetY: pointerOffsetY,
        width: item.width * zoomRef.current,
        height: item.height * zoomRef.current,
        fontFamily: item.fontFamily,
        fontSize: (item.fontSize || 18) * zoomRef.current,
        fontWeight: item.fontWeight,
        color: item.color,
        backgroundColor: item.backgroundColor,
        opacity: item.opacity ?? 1,
        lineHeight: item.lineHeight ?? 1.1,
        letterSpacing: item.letterSpacing ? `${item.letterSpacing * zoomRef.current}px` : "normal",
        textAlign: item.textAlign || "left",
        rotation: item.rotation || 0,
      });
    } else {
      setTextDragPreview(null);
    }

    const calcGuides = (rawX, rawY, iW, iH, pg, others) => {
      const xCandidates = [0, pg.width / 2, pg.width];
      const yCandidates = [0, pg.height / 2, pg.height];
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
      if (dragRef.current.textGhostItemId) {
        const nextGhostLeft = me.clientX - (dragRef.current.pointerOffset?.x || 0);
        const nextGhostTop = me.clientY - (dragRef.current.pointerOffset?.y || 0);
        dragRef.current.ghostLeft = nextGhostLeft;
        dragRef.current.ghostTop = nextGhostTop;
        setTextDragPreview(prev => prev ? { ...prev, clientX: me.clientX, clientY: me.clientY, ghostLeft: nextGhostLeft, ghostTop: nextGhostTop } : null);
      } else {
        setTextDragPreview(null);
      }
      const { itemIds, startPointer, startPositions, page: pg, otherItems, primaryId, primarySize } = dragRef.current;
      if (!pg) return;
      const dx = (me.clientX - startPointer.x) / zoomRef.current;
      const dy = (me.clientY - startPointer.y) / zoomRef.current;
      const g = gridSizeRef.current;
      const snapValue = (value) => (showGridRef.current ? snap(value, g) : value);
      const primaryStart = startPositions[primaryId];
      let snapX = 0, snapY = 0;
      let guideX = [], guideY = [];
      if (primaryStart && primarySize && itemIds.length === 1) {
        const rawX = primaryStart.x + dx;
        const rawY = primaryStart.y + dy;
        const guides = calcGuides(rawX, rawY, primarySize.w, primarySize.h, pg, otherItems);
        snapX = guides.snapOffsetX; snapY = guides.snapOffsetY;
        guideX = guides.activeX; guideY = guides.activeY;
      }
      setAlignmentGuides({ pageId: pg.id, x: guideX, y: guideY });
      setCanvasItems(prev => prev.map(ci => {
        if (!itemIds.includes(ci.id)) return ci;
        const s = startPositions[ci.id];
        if (!s) return ci;
        const snappedX = snapValue(s.x + dx + snapX);
        const snappedY = snapValue(s.y + dy + snapY);
        const clamped = ci.type === "text"
          ? clampItemToReachableBounds(ci, snappedX, snappedY, pg)
          : { x: Math.max(MIN_VISIBLE_TEXT - ci.width, Math.min(snappedX, pg.width - MIN_VISIBLE_TEXT)), y: Math.max(MIN_VISIBLE_TEXT - ci.height, Math.min(snappedY, pg.height - MIN_VISIBLE_TEXT)) };
        return { ...ci, x: clamped.x, y: clamped.y };
      }));
    };
    const onUp = (ue) => {
      const drAtUp = dragRef.current;
      if (!drAtUp) {
        setTextDragPreview(null);
        setAlignmentGuides({ pageId: null, x: [], y: [] });
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        return;
      }
      const upClientX = Number.isFinite(ue.clientX) ? ue.clientX : drAtUp.startPointer?.x;
      const upClientY = Number.isFinite(ue.clientY) ? ue.clientY : drAtUp.startPointer?.y;
      let crossPageDropped = false;
      if (drAtUp.textGhostItemId) {
        const finalGhostLeft = upClientX - (drAtUp.pointerOffset?.x || 0);
        const finalGhostTop = upClientY - (drAtUp.pointerOffset?.y || 0);
        drAtUp.ghostLeft = finalGhostLeft;
        drAtUp.ghostTop = finalGhostTop;
        setTextDragPreview(prev => prev ? {
          ...prev,
          clientX: upClientX,
          clientY: upClientY,
          ghostLeft: finalGhostLeft,
          ghostTop: finalGhostTop,
        } : null);
      }
      const getGhostViewportBounds = (dr, primary) => {
        const left = Number.isFinite(dr.ghostLeft) ? dr.ghostLeft : upClientX - (dr.pointerOffset?.x || 0);
        const top = Number.isFinite(dr.ghostTop) ? dr.ghostTop : upClientY - (dr.pointerOffset?.y || 0);
        return {
          left,
          top,
          right: left + (primary?.width || dr.primarySize?.w || 0) * zoomRef.current,
          bottom: top + (primary?.height || dr.primarySize?.h || 0) * zoomRef.current,
        };
      };
      const findTextDestinationPage = (dr, sourcePage, primary) => {
        const candidatePages = boardPages.filter(pg => pg.id !== sourcePage.id);
        const ghostBounds = getGhostViewportBounds(dr, primary);
        for (const pg of candidatePages) {
          const rect = pageExportRefs.current[pg.id]?.getBoundingClientRect();
          if (rect && upClientX >= rect.left && upClientX <= rect.right && upClientY >= rect.top && upClientY <= rect.bottom) {
            return { page: pg, rect, reason: "pointer inside" };
          }
        }
        for (const pg of candidatePages) {
          const rect = pageExportRefs.current[pg.id]?.getBoundingClientRect();
          if (rect && ghostBounds.left >= rect.left && ghostBounds.left <= rect.right && ghostBounds.top >= rect.top && ghostBounds.top <= rect.bottom) {
            return { page: pg, rect, reason: "ghost top-left inside" };
          }
        }
        const minVisibleViewport = MIN_VISIBLE_TEXT * zoomRef.current;
        const reachableGhost = {
          left: ghostBounds.left,
          top: ghostBounds.top,
          right: ghostBounds.left + minVisibleViewport,
          bottom: ghostBounds.top + minVisibleViewport,
        };
        for (const pg of candidatePages) {
          const rect = pageExportRefs.current[pg.id]?.getBoundingClientRect();
          const overlaps = rect && reachableGhost.left < rect.right && reachableGhost.right > rect.left && reachableGhost.top < rect.bottom && reachableGhost.bottom > rect.top;
          if (overlaps) return { page: pg, rect, reason: "reachable overlap fallback" };
        }
        return null;
      };
      const positionDraggedItemsOnPage = (prev, dr, targetPage, targetRect, options = {}) => {
        const primary = prev.find(ci => ci.id === dr.primaryId);
        if (!primary) return prev;
        const g = gridSizeRef.current;
        const snapValue = (value) => (showGridRef.current ? snap(value, g) : value);
        const sortedDragIds = [...dr.itemIds].sort((a, b) => (dr.originalZIndices[a] || 0) - (dr.originalZIndices[b] || 0));
        const ghostBounds = getGhostViewportBounds(dr, primary);
        const unsnappedAnchorX = (ghostBounds.left - targetRect.left) / zoomRef.current;
        const unsnappedAnchorY = (ghostBounds.top - targetRect.top) / zoomRef.current;
        const anchorX = snapValue(unsnappedAnchorX);
        const anchorY = snapValue(unsnappedAnchorY);
        const primStartX = dr.startPositions[dr.primaryId]?.x ?? primary.x;
        const primStartY = dr.startPositions[dr.primaryId]?.y ?? primary.y;
        const destMaxZ = options.restoreOriginalZ
          ? 0
          : prev.filter(ci => ci.pageId === targetPage.id && !dr.itemIds.includes(ci.id)).reduce((m, ci) => Math.max(m, ci.zIndex || 0), 0);
        return prev.map(ci => {
          if (!dr.itemIds.includes(ci.id)) return ci;
          const offX = (dr.startPositions[ci.id]?.x ?? ci.x) - primStartX;
          const offY = (dr.startPositions[ci.id]?.y ?? ci.y) - primStartY;
          const clamped = clampItemToReachableBounds(ci, anchorX + offX, anchorY + offY, targetPage);
          const zOff = sortedDragIds.indexOf(ci.id);
          return {
            ...ci,
            pageId: targetPage.id,
            x: clamped.x,
            y: clamped.y,
            zIndex: options.restoreOriginalZ ? (dr.originalZIndices[ci.id] ?? ci.zIndex) : destMaxZ + 1 + zOff,
          };
        });
      };
      if (drAtUp.moved) {
        const dr = drAtUp;
        const sourcePage = dr.page;
        if (sourcePage) {
          if (dr.textGhostItemId) {
            const primary = canvasItemsRef.current.find(ci => ci.id === dr.primaryId);
            const destination = findTextDestinationPage(dr, sourcePage, primary);
            if (destination) {
              crossPageDropped = true;
              setCanvasItems(prev => positionDraggedItemsOnPage(prev, dr, destination.page, destination.rect));
            }
          } else {
            for (const destPage of boardPages) {
              if (destPage.id === sourcePage.id) continue;
            const pageEl = pageExportRefs.current[destPage.id];
            if (!pageEl) continue;
            const rect = pageEl.getBoundingClientRect();
            const primary = canvasItemsRef.current.find(ci => ci.id === dr.primaryId);
            const ghostBounds = getGhostViewportBounds(dr, primary);
            const isOverDestination = dr.textGhostItemId
              ? ghostBounds.left < rect.right && ghostBounds.right > rect.left && ghostBounds.top < rect.bottom && ghostBounds.bottom > rect.top
              : upClientX >= rect.left && upClientX <= rect.right && upClientY >= rect.top && upClientY <= rect.bottom;
            if (isOverDestination) {
              crossPageDropped = true;
              setCanvasItems(prev => {
                if (dr.textGhostItemId) return positionDraggedItemsOnPage(prev, dr, destPage, rect);
                const primary = prev.find(ci => ci.id === dr.primaryId);
                if (!primary) return prev;
                const g = gridSizeRef.current;
                const snapValue = (value) => (showGridRef.current ? snap(value, g) : value);
                const relX = (upClientX - rect.left) / zoomRef.current;
                const relY = (upClientY - rect.top) / zoomRef.current;
                const anchorX = snapValue(relX - primary.width / 2);
                const anchorY = snapValue(relY - primary.height / 2);
                const primStartX = dr.startPositions[dr.primaryId]?.x ?? primary.x;
                const primStartY = dr.startPositions[dr.primaryId]?.y ?? primary.y;
                const sortedDragIds = [...dr.itemIds].sort((a, b) => (dr.originalZIndices[a] || 0) - (dr.originalZIndices[b] || 0));
                const destMaxZ = prev.filter(ci => ci.pageId === destPage.id && !dr.itemIds.includes(ci.id)).reduce((m, ci) => Math.max(m, ci.zIndex || 0), 0);
                return prev.map(ci => {
                  if (!dr.itemIds.includes(ci.id)) return ci;
                  const offX = (dr.startPositions[ci.id]?.x ?? ci.x) - primStartX;
                  const offY = (dr.startPositions[ci.id]?.y ?? ci.y) - primStartY;
                  const clamped = clampItemToReachableBounds(ci, anchorX + offX, anchorY + offY, destPage);
                  const zOff = sortedDragIds.indexOf(ci.id);
                  return { ...ci, pageId: destPage.id, x: clamped.x, y: clamped.y, zIndex: destMaxZ + 1 + zOff };
                });
              });
              break;
            }
            }
          }
        }
      }
      // Restore original zIndex for same-page drops (undo the temporary elevation)
      if (!crossPageDropped) {
        const dr = drAtUp;
        const sourceRect = dr.textGhostItemId && dr.page?.id ? pageExportRefs.current[dr.page.id]?.getBoundingClientRect() : null;
        setCanvasItems(prev => {
          if (dr.textGhostItemId && sourceRect && dr.page) {
            return positionDraggedItemsOnPage(prev, dr, dr.page, sourceRect, { restoreOriginalZ: true });
          }
          return prev.map(ci => {
            if (dr.itemIds.includes(ci.id) && dr.originalZIndices[ci.id] !== undefined) {
              return { ...ci, zIndex: dr.originalZIndices[ci.id] };
            }
            return ci;
          });
        });
      }
      dragRef.current = null;
      setTextDragPreview(null);
      setAlignmentGuides({ pageId: null, x: [], y: [] });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const startResize = (e, item, handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const aspectRatio = item.type === "image" ? item.width / item.height : null;
    const minW = item.type === "text" ? 80 : 60;
    const minH = 40;
    const page = boardPages.find(p => p.id === item.pageId);
    dragRef.current = { type: "resize", itemId: item.id, handle, startPointer: { x: e.clientX, y: e.clientY }, startSize: { w: item.width, h: item.height }, startPos: { x: item.x, y: item.y }, page, aspectRatio, minW, minH, startCropRenderW: item.cropRenderW ?? null, startCropRenderH: item.cropRenderH ?? null, startCropRenderOffsetX: item.cropRenderOffsetX ?? null, startCropRenderOffsetY: item.cropRenderOffsetY ?? null };
    const onMove = (me) => {
      if (!dragRef.current || dragRef.current.type !== "resize") return;
      const { itemId, handle, startPointer, startSize, startPos, page, aspectRatio, minW, minH, startCropRenderW, startCropRenderH, startCropRenderOffsetX, startCropRenderOffsetY } = dragRef.current;
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
      const cropPatch = startCropRenderW != null ? {
        cropRenderW: startCropRenderW * (nw / startSize.w),
        cropRenderH: startCropRenderH * (nh / startSize.h),
        cropRenderOffsetX: startCropRenderOffsetX * (nw / startSize.w),
        cropRenderOffsetY: startCropRenderOffsetY * (nh / startSize.h),
      } : {};
      setCanvasItems(prev => prev.map(ci => ci.id === itemId ? { ...ci, x: nx, y: ny, width: nw, height: nh, ...cropPatch } : ci));
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
    commitTextDraft();
    setSelMode(null);
    setSelDraft(null);
    setSelBounds(null);
    setShowFontDropdown(false);
    setShowTextSpacingDropdown(false);
    setShowFitDropdown(false);
    setShowSelectDropdown(false);
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
    if (item.type === "solid") return item.name || (item.solidShape === "ellipse" ? "Ellipse" : "Rectangle");
    if (item.type === "grain") return item.name || "Grain Layer";
    const image = images.find((img) => img.id === item.imageId);
    return image?.title || item.name || "Image";
  };

  const renderCanvasItem = (item) => {
    if (item.hidden) return null;
    const image = item.type === "image" ? images.find((img) => img.id === item.imageId) : null;
    const isSelected = selectedItemIds.includes(item.id);
    const isTextDragPreviewSource = textDragPreview?.itemId === item.id;
    const locked = item.locked || isViewOnly || !canEdit;
    const HANDLE_DIRS = ["nw","n","ne","w","e","sw","s","se"];
    const CURSORS = { nw:"nw-resize",n:"n-resize",ne:"ne-resize",w:"w-resize",e:"e-resize",sw:"sw-resize",s:"s-resize",se:"se-resize" };

    return (
      <div
        key={item.id}
        style={{
          position: "absolute",
          left: item.type === "grain" ? 0 : item.x,
          top: item.type === "grain" ? 0 : item.y,
          width: item.type === "grain" ? "100%" : item.width,
          height: item.type === "grain" ? "100%" : item.height,
          zIndex: item.zIndex,
          pointerEvents: item.type === "grain" ? "none" : undefined,
          outline: isSelected ? "2px solid #2196F3" : "none",
          boxShadow: isSelected ? "0 0 0 3px rgba(33,150,243,0.15)" : "none",
          backgroundColor: item.type === "text" ? item.backgroundColor : item.type === "solid" && item.solidShape !== "ellipse" ? item.solidColor : "transparent",
          borderRadius: item.type === "solid" && item.solidShape !== "ellipse" && (item.cornerRadius ?? 0) > 0 ? `${item.cornerRadius}px` : undefined,
          overflow: item.type === "solid" && item.solidShape !== "ellipse" && (item.cornerRadius ?? 0) > 0 ? "hidden" : undefined,
          opacity: isTextDragPreviewSource ? Math.min(item.opacity ?? 1, 0.18) : item.opacity ?? 1,
          mixBlendMode: item.blendMode || "normal",
          cursor: locked || item.type === "grain" ? "default" : "move",
          userSelect: "none",
          boxSizing: "border-box",
          transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
          transformOrigin: "center center",
        }}
        onPointerDown={(e) => {
          if (e.button === 1) return; // let middle click bubble to scroll container
          e.stopPropagation();
          if (item.type === "text" && editingTextId === item.id && e.target.tagName === "TEXTAREA") return;
          if (!locked && item.type !== "grain") startDrag(e, item);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!dragRef.current?.moved) handleSelectItem(e, item.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (item.type === "text") {
            textEditRef.current = { itemId: item.id, draft: item.text || "" };
            setTextEditDraft(item.text || "");
            setEditingTextId(item.id);
          }
        }}
      >
        {item.type === "image" && image && (() => {
          const isSel = selMode === item.id;
          const sel = isSel ? null : getEffectiveSelection(item);

          // When a crop has been applied (collapsed bounds model), the image is absolutely
          // positioned at a negative offset so the correct pixels show through the item box.
          const hasCropOffset = item.cropRenderW != null;
          const imgEl = hasCropOffset ? (
            <img src={image.url} alt={image.title || "Mood board reference"} draggable={false}
              style={{ position: "absolute", left: item.cropRenderOffsetX || 0, top: item.cropRenderOffsetY || 0, width: item.cropRenderW, height: item.cropRenderH, objectFit: item.objectFit || "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
          ) : (
            <img src={image.url} alt={image.title || "Mood board reference"} draggable={false}
              style={{ width: "100%", height: "100%", objectFit: item.objectFit || "contain", display: "block", userSelect: "none", pointerEvents: "none" }} />
          );

          // Clip/mask the image to the selection region.
          // For collapsed-bounds items (hasCropOffset): selX/Y/W/H are always 0/0/1/1 so
          // clip is applied at the edges of the item box (ellipse = 50%50%, feather at edges).
          // For legacy clip-path items: selX/Y/W/H are fractional within the original item box.
          let content;
          if (sel) {
            const { selectionType, selX, selY, selW, selH, selFeather: feather = 0 } = sel;
            let clipStyle = {};
            if (selectionType === "ellipse") {
              const cx = ((selX + selW / 2) * 100).toFixed(3) + "%";
              const cy = ((selY + selH / 2) * 100).toFixed(3) + "%";
              const erx = (selW / 2 * 100).toFixed(3) + "%";
              const ery = (selH / 2 * 100).toFixed(3) + "%";
              if (feather > 0) {
                const grad = `radial-gradient(ellipse ${erx} ${ery} at ${cx} ${cy}, black calc(100% - ${feather}px), transparent 100%)`;
                clipStyle = { WebkitMaskImage: grad, maskImage: grad };
              } else {
                clipStyle = { clipPath: `ellipse(${erx} ${ery} at ${cx} ${cy})` };
              }
            } else {
              const iT = (selY * 100).toFixed(3) + "%";
              const iR = ((1 - selX - selW) * 100).toFixed(3) + "%";
              const iB = ((1 - selY - selH) * 100).toFixed(3) + "%";
              const iL = (selX * 100).toFixed(3) + "%";
              if (feather > 0) {
                const refW = hasCropOffset ? item.width : item.width;
                const refH = hasCropOffset ? item.height : item.height;
                const lS = iL;
                const lE = ((selX + feather / refW) * 100).toFixed(3) + "%";
                const rS = ((selX + selW - feather / refW) * 100).toFixed(3) + "%";
                const rE = ((selX + selW) * 100).toFixed(3) + "%";
                const tS = iT;
                const tE = ((selY + feather / refH) * 100).toFixed(3) + "%";
                const bS = ((selY + selH - feather / refH) * 100).toFixed(3) + "%";
                const bE = ((selY + selH) * 100).toFixed(3) + "%";
                const gH = `linear-gradient(to right, transparent ${lS}, black ${lE}, black ${rS}, transparent ${rE})`;
                const gV = `linear-gradient(to bottom, transparent ${tS}, black ${tE}, black ${bS}, transparent ${bE})`;
                clipStyle = { WebkitMaskImage: `${gH}, ${gV}`, maskImage: `${gH}, ${gV}`, WebkitMaskComposite: "source-in", maskComposite: "intersect" };
              } else {
                clipStyle = { clipPath: `inset(${iT} ${iR} ${iB} ${iL})` };
              }
            }
            content = <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", ...clipStyle }}>{imgEl}</div>;
          } else {
            content = <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>{imgEl}</div>;
          }

          return (
            <>
              {content}
              {isSel && (() => {
                const W = item.width;
                const H = item.height;
                const clampV = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

                const startDrawNew = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const itemRect = e.currentTarget.parentElement.getBoundingClientRect();
                  const nx0 = clampV((e.clientX - itemRect.left) / itemRect.width, 0, 1);
                  const ny0 = clampV((e.clientY - itemRect.top) / itemRect.height, 0, 1);
                  const shapeType = selDraft?.selectionType || pendingShapeType;
                  setSelDraft(prev => ({ selectionType: shapeType, selX: nx0, selY: ny0, selW: 0.001, selH: 0.001, selFeather: prev?.selFeather ?? 0 }));
                  const onMove = (me) => {
                    const nx1 = clampV((me.clientX - itemRect.left) / itemRect.width, 0, 1);
                    const ny1 = clampV((me.clientY - itemRect.top) / itemRect.height, 0, 1);
                    setSelDraft(prev => ({ ...prev, selX: Math.min(nx0, nx1), selY: Math.min(ny0, ny1), selW: Math.max(0.01, Math.abs(nx1 - nx0)), selH: Math.max(0.01, Math.abs(ny1 - ny0)) }));
                  };
                  const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                };

                if (!selDraft) {
                  return <div onPointerDown={startDrawNew} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", cursor: "crosshair", zIndex: 20 }} />;
                }

                const rx = selDraft.selX * W;
                const ry = selDraft.selY * H;
                const rw = selDraft.selW * W;
                const rh = selDraft.selH * H;
                const isEllipse = selDraft.selectionType === "ellipse";
                const OL = "rgba(0,0,0,0.5)";

                const startHandleDrag = (e, corner) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startD = { ...selDraft };
                  const onMove = (me) => {
                    const dx = (me.clientX - startX) / zoomRef.current;
                    const dy = (me.clientY - startY) / zoomRef.current;
                    const next = { ...startD };
                    if (corner === "move") {
                      next.selX = clampV(startD.selX + dx / W, 0, 1 - startD.selW);
                      next.selY = clampV(startD.selY + dy / H, 0, 1 - startD.selH);
                    } else {
                      if (corner.includes("w")) {
                        const newX = clampV(startD.selX + dx / W, 0, startD.selX + startD.selW - 0.05);
                        next.selW = startD.selW - (newX - startD.selX);
                        next.selX = newX;
                      } else if (corner.includes("e")) {
                        next.selW = clampV(startD.selW + dx / W, 0.05, 1 - startD.selX);
                      }
                      if (corner.includes("n")) {
                        const newY = clampV(startD.selY + dy / H, 0, startD.selY + startD.selH - 0.05);
                        next.selH = startD.selH - (newY - startD.selY);
                        next.selY = newY;
                      } else if (corner.includes("s")) {
                        next.selH = clampV(startD.selH + dy / H, 0.05, 1 - startD.selY);
                      }
                    }
                    setSelDraft(next);
                  };
                  const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                };

                const handles = [
                  { id: "nw", x: rx,          y: ry,          cursor: "nw-resize" },
                  { id: "n",  x: rx + rw / 2, y: ry,          cursor: "n-resize" },
                  { id: "ne", x: rx + rw,     y: ry,          cursor: "ne-resize" },
                  { id: "w",  x: rx,          y: ry + rh / 2, cursor: "w-resize" },
                  { id: "e",  x: rx + rw,     y: ry + rh / 2, cursor: "e-resize" },
                  { id: "sw", x: rx,          y: ry + rh,     cursor: "sw-resize" },
                  { id: "s",  x: rx + rw / 2, y: ry + rh,     cursor: "s-resize" },
                  { id: "se", x: rx + rw,     y: ry + rh,     cursor: "se-resize" },
                ];

                const overlayAndBorder = isEllipse ? (
                  <>
                    {/* Ellipse: visual overlay only — no pointer capture so item drag works through it */}
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse ${rw / 2}px ${rh / 2}px at ${rx + rw / 2}px ${ry + rh / 2}px, transparent 99%, ${OL} 100%)`, pointerEvents: "none", zIndex: 20 }} />
                    <div style={{ position: "absolute", left: rx, top: ry, width: rw, height: rh, border: "1.5px solid white", borderRadius: "50%", boxSizing: "border-box", pointerEvents: "none", zIndex: 21 }} />
                  </>
                ) : (
                  <>
                    {/* Rect: dark strips outside marquee intercept clicks for new draw; inside falls through to item drag */}
                    <div onPointerDown={startDrawNew} style={{ position: "absolute", left: 0, top: 0, width: rx, height: H, backgroundColor: OL, cursor: "crosshair", zIndex: 20 }} />
                    <div onPointerDown={startDrawNew} style={{ position: "absolute", left: rx + rw, top: 0, right: 0, height: H, backgroundColor: OL, cursor: "crosshair", zIndex: 20 }} />
                    <div onPointerDown={startDrawNew} style={{ position: "absolute", left: rx, top: 0, width: rw, height: ry, backgroundColor: OL, cursor: "crosshair", zIndex: 20 }} />
                    <div onPointerDown={startDrawNew} style={{ position: "absolute", left: rx, top: ry + rh, width: rw, bottom: 0, backgroundColor: OL, cursor: "crosshair", zIndex: 20 }} />
                    <div style={{ position: "absolute", left: rx, top: ry, width: rw, height: rh, border: "1.5px solid white", boxSizing: "border-box", pointerEvents: "none", zIndex: 21 }} />
                  </>
                );

                return (
                  <>
                    {overlayAndBorder}
                    {handles.map(h => (
                      <div key={h.id} onPointerDown={(e) => startHandleDrag(e, h.id)} style={{ position: "absolute", left: h.x - 4, top: h.y - 4, width: 8, height: 8, backgroundColor: "white", border: "1.5px solid #333", borderRadius: "2px", cursor: h.cursor, zIndex: 23 }} />
                    ))}
                  </>
                );
              })()}
            </>
          );
        })()}
        {item.type === "solid" && item.solidShape === "ellipse" && (
          <div style={{ width: "100%", height: "100%", backgroundColor: item.solidColor || "#cccccc", borderRadius: "50%", pointerEvents: "none" }} />
        )}
        {item.type === "grain" && (() => {
          const dataUrl = getGrainDataUrl(item.grainSeed || 0, item.grainAmount ?? 0.6, item.grainSaturation ?? 1, item.grainColor || "#2e2e2e");
          const bgSize = `${GRAIN_TILE_SIZE * (item.grainSize ?? 1)}px`;
          const blurPx = (item.grainSoftening ?? 0) * 0.15;
          const filter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
          return <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${dataUrl})`, backgroundRepeat: "repeat", backgroundSize: bgSize, filter, pointerEvents: "none" }} />;
        })()}
        {item.type === "text" && isSelected && !locked && (
          <div
            onPointerDown={(e) => { e.stopPropagation(); startDrag(e, item); }}
            title="Drag to move"
            style={{
              position: "absolute", top: -16, left: 0, right: 0, height: "16px",
              cursor: "grab", zIndex: 6, display: "flex", alignItems: "center",
              justifyContent: "center", gap: "3px",
              backgroundColor: "rgba(33,150,243,0.12)",
              borderRadius: "3px 3px 0 0",
            }}
          >
            <span style={{ fontSize: "9px", color: "rgba(33,150,243,0.8)", userSelect: "none", letterSpacing: "2px", lineHeight: 1 }}>⠿⠿</span>
          </div>
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
              value={editingTextId === item.id ? (textEditDraft ?? item.text) : item.text}
              readOnly={editingTextId !== item.id}
              disabled={locked}
              className={editingTextId === item.id ? "moodboard-text-active" : undefined}
              onChange={(e) => {
                if (editingTextId !== item.id) return;
                const v = e.target.value;
                setTextEditDraft(v);
                textEditRef.current.draft = v;
              }}
              onClick={(event) => { event.stopPropagation(); }}
              onBlur={() => commitTextDraft()}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); commitTextDraft(); }
              }}
              tabIndex={editingTextId === item.id ? 0 : -1}
              style={{
                width: "100%", height: "100%", resize: "none", border: "none", outline: "none",
                background: "transparent", color: item.color, fontFamily: item.fontFamily,
                fontSize: item.fontSize, fontWeight: item.fontWeight,
                lineHeight: item.lineHeight ?? 1.1,
                letterSpacing: item.letterSpacing ? `${item.letterSpacing}px` : "normal",
                textAlign: item.textAlign || "left",
                paddingTop: "6px",
                paddingBottom: "6px", paddingLeft: "6px", paddingRight: "6px",
                boxSizing: "border-box", overflow: "hidden",
                filter: (item.textBlur ?? 0) > 0 ? `blur(${item.textBlur}px)` : undefined,
                pointerEvents: editingTextId === item.id ? "auto" : "none",
                cursor: editingTextId === item.id ? "text" : "default",
                userSelect: editingTextId === item.id ? "text" : "none",
                caretColor: editingTextId === item.id ? undefined : "transparent",
              }}
            />
          </>
        )}

        {isSelected && !locked && selMode !== item.id && item.type !== "grain" && HANDLE_DIRS.map(handle => {
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

  // renderPage renders only the canvas surface (no controls header, no outer wrapper).
  // Controls are rendered outside the zoom transform in the main canvas loop below.
  const renderPage = (page, pageIndex) => {
    const pageItems = canvasItems.filter((item) => item.boardId === activeBoard.id && item.pageId === page.id);
    const currentW = resizingPage?.pageId === page.id ? resizingPage.width : page.width;
    const currentH = resizingPage?.pageId === page.id ? resizingPage.height : page.height;

    return (
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
    );
  };
  if (!isLoaded) {
    return (
      <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f0f0f0", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
        <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white", minHeight: "38px" }} />
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          <div style={{ width: LEFT_PANEL_WIDTH, flexShrink: 0, backgroundColor: "#f8f8f8", borderRight: "1px solid #ccc" }} />
          <div style={{ flex: 1, overflow: "hidden", backgroundColor: "#e8e8e8" }} />
          <div style={{ width: RIGHT_PANEL_WIDTH, flexShrink: 0, backgroundColor: "#f5f5f5", borderLeft: "1px solid #ddd" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f0f0f0", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ flex: 1, display: "flex", minHeight: "38px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, display: "flex", gap: "6px", alignItems: "center", padding: "4px 12px", boxSizing: "border-box" }}>
            <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold" }}>MOOD BOARD</h2>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
              <button onClick={exportBoardToPdf} disabled={exportingPdf} style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: exportingPdf ? "#e0e0e0" : "#E91E63", color: exportingPdf ? "#666" : "white", border: "none" }}>
                {exportingPdf ? "EXPORTING…" : "EXPORT PDF"}
              </button>
              <button onClick={() => setShowLayerPanel(p => !p)} style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: showLayerPanel ? "#e3f2fd" : "#f0f0f0" }}>LAYERS</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
      <div style={{ width: LEFT_PANEL_WIDTH, flexShrink: 0, backgroundColor: "#f8f8f8", borderRight: "1px solid #ccc", display: "flex", flexDirection: "column", overflow: "visible", position: "relative", zIndex: rollExpanded ? 30 : 2 }}>
        <div style={{ padding: "12px", borderBottom: "1px solid #ddd", backgroundColor: "white" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>{selectedProject?.name || "Mood Board"}</div>
          <div style={{
            marginTop: "3px", fontSize: "10px", minHeight: "14px",
            color: (statusMessage?.includes("fail") || statusMessage?.includes("Failed"))
              ? "#c62828"
              : statusMessage === "Saved"
              ? "#2e7d32"
              : "#888",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{statusMessage}</div>
          {isViewOnly && <div style={{ marginTop: "8px", padding: "5px 8px", backgroundColor: "#FF9800", color: "white", borderRadius: "4px", fontSize: "11px", fontWeight: "bold" }}>VIEW ONLY</div>}
        </div>

        <div style={{ height: boardsH, minHeight: 80, maxHeight: 440, flexShrink: 0, boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column", padding: "10px", borderBottom: "none" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "6px", flexShrink: 0 }}>BOARDS</div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px", flexShrink: 0 }}>
            <input value={newBoardName} onChange={(event) => setNewBoardName(event.target.value)} placeholder="New board name" disabled={!canEdit || isViewOnly} style={{ flex: 1, padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }} />
            <button onClick={addBoard} disabled={!canEdit || isViewOnly} style={{ padding: "6px 9px", cursor: "pointer" }}>+</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", border: "1px inset #ddd", backgroundColor: "white" }}>
            {boards.map((board) => {
              const isActive = activeBoard?.id === board.id;
              const isExpanded = expandedBoardIds.has(board.id);
              const boardPageList = board.pages || [];
              return (
                <React.Fragment key={board.id}>
                  <div onClick={() => setActiveBoardId(board.id)} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px", backgroundColor: isActive ? "#e3f2fd" : "white", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedBoardIds(prev => {
                        const next = new Set(prev);
                        if (next.has(board.id)) next.delete(board.id); else next.add(board.id);
                        return next;
                      }); }}
                      title={isExpanded ? "Collapse pages" : "Show pages"}
                      style={{ fontSize: "10px", cursor: "pointer", border: "none", background: "transparent", padding: "0 2px", color: "#555", flexShrink: 0 }}
                    >{isExpanded ? "▼" : "▶"}</button>
                    <input value={board.name} onChange={(event) => renameBoard(board.id, event.target.value)} onFocus={() => setActiveBoardId(board.id)} onClick={(e) => e.stopPropagation()} disabled={!canEdit || isViewOnly} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontWeight: isActive ? "bold" : "normal", fontSize: "12px", outline: "none", overflow: "hidden", textOverflow: "ellipsis", cursor: "text" }} />
                    {(board.createdBy || userDisplayName) && (
                      <span style={{ fontSize: "9px", color: "#aaa", whiteSpace: "nowrap", marginRight: "2px", maxWidth: "50px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(board.createdBy || userDisplayName).includes("@")
                          ? (board.createdBy || userDisplayName).split("@")[0]
                          : (board.createdBy || userDisplayName)}
                      </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); addPageToBoard(board.id, true); }} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", padding: "2px 4px" }}>+Pg</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteBoard(board.id); }} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer", flexShrink: 0, padding: "2px 4px" }}>×</button>
                  </div>
                  {isExpanded && boardPageList.map((pg, pgIdx) => {
                    const isActivePg = activePage?.id === pg.id && isActive;
                    const isDragOver = boardPanelDragOverPageId === pg.id;
                    return (
                      <div
                        key={pg.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          boardPanelDragRef.current = { boardId: board.id, pageId: pg.id, fromIndex: pgIdx };
                          setBoardPanelDragOverPageId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (boardPanelDragRef.current?.boardId === board.id && boardPanelDragRef.current?.pageId !== pg.id) {
                            setBoardPanelDragOverPageId(pg.id);
                          }
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          const dr = boardPanelDragRef.current;
                          if (dr && dr.boardId === board.id && dr.pageId !== pg.id) {
                            reorderPage(dr.pageId, pgIdx, board.id);
                          }
                          boardPanelDragRef.current = null;
                          setBoardPanelDragOverPageId(null);
                        }}
                        onDragEnd={() => {
                          boardPanelDragRef.current = null;
                          setBoardPanelDragOverPageId(null);
                        }}
                        onClick={() => { setActiveBoardId(board.id); setActivePage(pg.id); pageRefs.current[pg.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                        style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 5px 3px 22px", backgroundColor: isDragOver ? "#e3f2fd" : isActivePg ? "#bbdefb" : "#f9f9f9", borderBottom: isDragOver ? "2px solid #2196F3" : "1px solid #f0f0f0", cursor: "grab" }}
                      >
                        <span style={{ fontSize: "10px", color: "#aaa", flexShrink: 0 }}>⠿</span>
                        <span style={{ fontSize: "11px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActivePg ? "bold" : "normal", color: "#444" }}>{pg.name || `Page ${pgIdx + 1}`}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexShrink: 0 }}>
            <button onClick={duplicateBoard} disabled={!canEdit || isViewOnly} style={{ flex: 1, minWidth: 0, fontSize: "11px", cursor: "pointer", padding: "4px 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Duplicate Board</button>
            {canEdit && !isViewOnly && (
              <button onClick={openShareModal} style={{ flex: 1, minWidth: 0, fontSize: "11px", cursor: "pointer", padding: "4px 3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Share…</button>
            )}
          </div>
        </div>

        {/* Boards-Links splitter */}
        <div
          style={{ height: "7px", cursor: "ns-resize", backgroundColor: "#e4e4e4", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd" }}
          onPointerDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = boardsH;
            const onMove = (me) => setBoardsH(Math.max(80, Math.min(440, startH + me.clientY - startY)));
            const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <div style={{ width: "24px", height: "2px", backgroundColor: "#bbb", borderRadius: "1px" }} />
        </div>

        <div style={{ padding: "10px", borderBottom: "none", height: linksH, minHeight: 60, flexShrink: 0, boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                {links.map((link) => {
                  return (
                    <div key={link.id} style={{ padding: "7px", borderBottom: "1px solid #eee" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                        <strong style={{ fontSize: "12px" }}>{link.title}</strong>
                        <span style={{ fontSize: "10px", color: "#777" }}>{getSourceLabel(link.type)}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.url}</div>
                      <div style={{ marginTop: "5px", display: "flex", gap: "5px" }}>
                        {link.url && <button onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")} style={{ fontSize: "10px", cursor: "pointer", background: "none", border: "none", color: "#0066cc", textDecoration: "underline", padding: 0 }}>Open</button>}
                        <button onClick={() => deleteSourceLink(link.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
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

        {/* Roll resize handle */}
        <div
          style={{ height: "7px", cursor: "ns-resize", backgroundColor: "#e4e4e4", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd" }}
          onPointerDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = linksH;
            const onMove = (me) => setLinksH(Math.max(60, Math.min(380, startH + me.clientY - startY)));
            const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        >
          <div style={{ width: "24px", height: "2px", backgroundColor: "#bbb", borderRadius: "1px" }} />
        </div>

        <div style={{ padding: "10px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: rollExpanded ? 620 : "auto", maxWidth: rollExpanded ? "calc(100vw - 260px)" : undefined, boxSizing: "border-box", backgroundColor: "#f8f8f8", borderRight: rollExpanded ? "1px solid #ccc" : "none", boxShadow: rollExpanded ? "8px 0 18px rgba(0,0,0,0.16)" : "none", position: "relative", zIndex: rollExpanded ? 5 : "auto", transition: "width 0.15s ease, box-shadow 0.15s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>ROLL</div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button
                onClick={() => setRollExpanded(p => !p)}
                title={rollExpanded ? "Compact Roll" : "Expand Roll horizontally"}
                style={{ fontSize: "10px", cursor: "pointer", backgroundColor: rollExpanded ? "#e3f2fd" : undefined, fontWeight: rollExpanded ? "bold" : "normal" }}
              >{rollExpanded ? "◀ Compact" : "Wide ▶"}</button>
              <label style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: "#555", whiteSpace: "nowrap" }} title="Roll thumbnail size">
                Zoom
                <input
                  type="range"
                  min={ROLL_THUMB_MIN_SIZE}
                  max={ROLL_THUMB_MAX_SIZE}
                  step="1"
                  value={rollThumbSize}
                  onChange={(event) => setRollThumbSize(Number(event.target.value))}
                  style={{ width: "58px" }}
                />
              </label>
              <button onClick={openImportPanel} style={{ fontSize: "10px", cursor: "pointer" }} title="Import images from another project's MoodBoard">Import</button>
              <button onClick={() => fileInputRef.current?.click()} disabled={!canEdit || isViewOnly} style={{ fontSize: "10px", cursor: "pointer" }}>Upload</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={addLocalFiles} style={{ display: "none" }} />
          </div>

          {showImportPanel && (
            <div style={{ marginBottom: "8px", border: "1px solid #ccc", borderRadius: "4px", overflow: "hidden", backgroundColor: "white", flexShrink: 0 }}>
              <div style={{ padding: "5px 8px", backgroundColor: "#f0f0f0", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#555" }}>IMPORT FROM PROJECT</span>
                <button onClick={() => setShowImportPanel(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "13px", color: "#888", lineHeight: 1, padding: "0 2px" }}>×</button>
              </div>
              <div style={{ padding: "6px 8px" }}>
                {importLoadingProjects ? (
                  <div style={{ fontSize: "11px", color: "#888" }}>Loading projects…</div>
                ) : (
                  <select
                    value={importSourceId}
                    onChange={(e) => loadImportProjectImages(e.target.value)}
                    style={{ width: "100%", padding: "4px", fontSize: "11px", border: "1px solid #ccc", borderRadius: "3px" }}
                  >
                    <option value="">— Select a project —</option>
                    {importProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              {importLoadingImages && <div style={{ padding: "4px 8px 8px", fontSize: "11px", color: "#888" }}>Loading images…</div>}
              {!importLoadingImages && importSourceId && importSourceImages.length === 0 && (
                <div style={{ padding: "4px 8px 8px", fontSize: "11px", color: "#888" }}>No images in this project's Roll.</div>
              )}
              {!importLoadingImages && importSourceImages.length > 0 && (
                <>
                  <div style={{ padding: "0 8px 4px", borderTop: "1px solid #eee" }}>
                    <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", padding: "4px 0", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={importSelectedIds.size === importSourceImages.length && importSourceImages.length > 0}
                        onChange={(e) => setImportSelectedIds(e.target.checked ? new Set(importSourceImages.map(img => img.id)) : new Set())}
                      />
                      Select all ({importSourceImages.length})
                    </label>
                    <div style={{ maxHeight: "160px", overflowY: "auto" }}>
                      <div style={{ columns: 3, columnGap: "4px" }}>
                        {importSourceImages.map(img => {
                          const sel = importSelectedIds.has(img.id);
                          return (
                            <div
                              key={img.id}
                              onClick={() => setImportSelectedIds(prev => { const n = new Set(prev); sel ? n.delete(img.id) : n.add(img.id); return n; })}
                              style={{ breakInside: "avoid", marginBottom: "4px", position: "relative", cursor: "pointer" }}
                            >
                              <img src={img.url} alt={img.title || ""} style={{ width: "100%", height: "auto", display: "block", border: sel ? "2px solid #2196F3" : "1px solid #eee", borderRadius: "2px" }} />
                              {sel && <div style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "#2196F3", color: "white", borderRadius: "50%", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "bold" }}>✓</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "4px 8px 8px", display: "flex", gap: "4px" }}>
                    <button
                      onClick={doImportImages}
                      disabled={importSelectedIds.size === 0}
                      style={{ flex: 1, padding: "5px", fontSize: "11px", cursor: importSelectedIds.size ? "pointer" : "not-allowed", backgroundColor: importSelectedIds.size ? "#2196F3" : "#e0e0e0", color: importSelectedIds.size ? "white" : "#999", border: "none", borderRadius: "3px", fontWeight: "bold" }}
                    >
                      {importSelectedIds.size > 0 ? `Import ${importSelectedIds.size}` : "Import"}
                    </button>
                    <button onClick={() => setShowImportPanel(false)} style={{ padding: "5px 10px", fontSize: "11px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: "#f5f5f5" }}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          <input value={rollSearch} onChange={(event) => setRollSearch(event.target.value)} placeholder="Search roll..." style={{ width: "100%", padding: "6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", marginBottom: "8px" }} />
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <div style={{ columnWidth: `${rollThumbSize}px`, columnGap: "8px" }}>
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
                  onLightbox={() => setLightboxImageId(image.id)}
                  onDelete={() => deleteImage(image.id)}
                  onRenameTitle={(title) => updateImageTitle(image.id, title)}
                />
              ))}
            </div>
          </div>
          </div>
      </div>
  
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* Canvas controls row */}
      <div style={{ flexShrink: 0, backgroundColor: "#f8f8f8", borderBottom: "1px solid #e0e0e0", padding: "4px 8px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", boxSizing: "border-box" }}>
        <button onClick={addTextToCanvas} disabled={!canEdit || isViewOnly} style={MOODBOARD_TOOLBAR_BTN}>ADD TEXT</button>
        <div ref={solidDropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setShowSolidDropdown(p => !p); setShowEffectsDropdown(false); }}
            disabled={!canEdit || isViewOnly}
            style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: showSolidDropdown ? "#e3f2fd" : "#f0f0f0" }}
          >SOLID ▾</button>
          {showSolidDropdown && (
            <div style={{ position: "absolute", top: "28px", left: 0, width: "130px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 9999 }}>
              <button onClick={() => { addSolidToCanvas("rect"); setShowSolidDropdown(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "8px 10px", border: "none", borderBottom: "1px solid #eee", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Rectangle</button>
              <button onClick={() => { addSolidToCanvas("ellipse"); setShowSolidDropdown(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "8px 10px", border: "none", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Ellipse</button>
            </div>
          )}
        </div>
        <div ref={effectsDropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setShowEffectsDropdown(p => !p); setShowSolidDropdown(false); }}
            disabled={!canEdit || isViewOnly}
            style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: showEffectsDropdown ? "#e3f2fd" : "#f0f0f0" }}
          >EFFECTS ▾</button>
          {showEffectsDropdown && (
            <div style={{ position: "absolute", top: "28px", left: 0, width: "140px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 9999 }}>
              <button onClick={() => { addGrainLayer(); setShowEffectsDropdown(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "8px 10px", border: "none", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Grain Layer</button>
            </div>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: "bold", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> GRID SNAP
          <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} style={{ padding: "2px 4px", fontSize: "10px", border: "1px solid #ccc", borderRadius: "3px" }}>
            <option value={2}>2px</option>
            <option value={5}>5px</option>
            <option value={10}>10px</option>
            <option value={20}>20px</option>
            <option value={40}>40px</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: "bold", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
          CANVAS ZOOM
          <input type="range" min="0.1" max="1.5" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "70px" }} />
          <span style={{ minWidth: "36px", display: "inline-block", textAlign: "right", fontSize: "10px" }}>{Math.round(zoom * 100)}%</span>
        </label>
        <button onClick={fitToWidth} style={{ ...MOODBOARD_TOOLBAR_BTN }}>FIT</button>
      </div>
      <div style={{ flexShrink: 0, height: "48px", backgroundColor: "white", borderBottom: "1px solid #ccc", boxSizing: "border-box", overflow: "visible", position: "relative", zIndex: 50 }}>
          <div style={{ height: "48px", display: "flex", alignItems: "center", gap: "8px", padding: "0 10px", backgroundColor: "#fafafa", boxSizing: "border-box", overflow: "visible", position: "relative" }}>
            <strong style={{ fontSize: "14px", marginRight: "8px", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeBoard?.name}</strong>
            {primarySelectedItem && (
              <>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>{selectedItems.length > 1 ? `${selectedItems.length} ITEMS` : primarySelectedItem.type.toUpperCase()}</span>
                {primarySelectedItem.type !== "text" && (
                  <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>Opacity <input type="range" min="0.1" max="1" step="0.05" value={primarySelectedItem.opacity ?? 1} onChange={(event) => updateSelectedItems({ opacity: Number(event.target.value) })} style={{ width: "60px" }} /></label>
                )}
                {primarySelectedItem.type === "image" && selectedItems.length === 1 && (
                  <>
                    <div ref={fitDropdownRef} style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowFitDropdown(p => !p)}
                        style={{ ...MOODBOARD_TOOLBAR_BTN, padding: "3px 8px", backgroundColor: showFitDropdown ? "#e3f2fd" : "#f0f0f0" }}
                      >Scale ▾</button>
                      {showFitDropdown && (() => {
                        const scalePct = Math.round(((primarySelectedItem.width / (primarySelectedItem._baseWidth || primarySelectedItem.width)) * 100) || 100);
                        const applyScale = (pct) => {
                          if (isNaN(pct) || pct <= 0) return;
                          const base = primarySelectedItem._baseWidth || primarySelectedItem.width;
                          const ratio = primarySelectedItem.width / primarySelectedItem.height;
                          const newW = Math.round(base * pct / 100);
                          const newH = Math.round(newW / ratio);
                          const cx = primarySelectedItem.x + primarySelectedItem.width / 2;
                          const cy = primarySelectedItem.y + primarySelectedItem.height / 2;
                          updateCanvasItem(primarySelectedItem.id, { width: newW, height: newH, x: Math.round(cx - newW / 2), y: Math.round(cy - newH / 2), _baseWidth: base });
                        };
                        return (
                          <div style={{ position: "absolute", top: "28px", left: 0, width: "190px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 9999, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              <span style={{ fontSize: "11px" }}>Scale</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                <input type="range" min="10" max="500" step="1" value={scalePct} onChange={(e) => applyScale(Number(e.target.value))} style={{ width: "100px", flexShrink: 0 }} />
                                <input type="number" min="10" step="1" value={scalePct}
                                  onChange={(e) => applyScale(Number(e.target.value))}
                                  style={{ width: "36px", padding: "2px 4px", fontSize: "10px", border: "1px solid #ccc", borderRadius: "3px" }}
                                />
                                <span style={{ fontSize: "11px" }}>%</span>
                              </div>
                            </div>
                            <div style={{ height: "1px", backgroundColor: "#eee" }} />
                            <div
                              style={{ position: "relative" }}
                              onMouseEnter={() => setShowFitSubmenu(true)}
                              onMouseLeave={() => setShowFitSubmenu(false)}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", borderRadius: "3px", cursor: "default", backgroundColor: showFitSubmenu ? "#f0f0f0" : "transparent", userSelect: "none" }}>
                                <span style={{ fontSize: "11px" }}>Fit</span>
                                <span style={{ fontSize: "10px", color: "#888" }}>▶</span>
                              </div>
                              {showFitSubmenu && (
                                <div style={{ position: "absolute", left: "calc(100% + 4px)", top: 0, width: "100px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 10000, padding: "4px 0" }}>
                                  <button onClick={() => { fitImageWidth(); setShowFitDropdown(false); setShowFitSubmenu(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: "1px solid #eee", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Fit Width</button>
                                  <button onClick={() => { fitImageHeight(); setShowFitDropdown(false); setShowFitSubmenu(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: "1px solid #eee", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Fit Height</button>
                                  <button onClick={() => { fitImageCanvas(); setShowFitDropdown(false); setShowFitSubmenu(false); }} style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 10px", border: "none", background: "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}>Fit Canvas</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
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
                        style={{ width: "42px", padding: "2px 4px", fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", border: "1px solid #ccc", borderRadius: "3px" }}
                      />°
                      <button onClick={() => updateCanvasItem(primarySelectedItem.id, { rotation: 0 })} style={{ ...MOODBOARD_TOOLBAR_BTN, padding: "3px 6px" }} title="Reset rotation to 0°">↺</button>
                    </label>
                    <div ref={selectDropdownRef} style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowSelectDropdown(p => !p)}
                        style={{ ...MOODBOARD_TOOLBAR_BTN, padding: "3px 6px", backgroundColor: showSelectDropdown ? "#e3f2fd" : (selMode === primarySelectedItem.id ? "#e3f2fd" : (getEffectiveSelection(primarySelectedItem) ? "#fff9c4" : "#f0f0f0")) }}
                      >Mask ▾</button>
                      {showSelectDropdown && (() => {
                        const effSel = getEffectiveSelection(primarySelectedItem);
                        const isEditing = selMode === primarySelectedItem.id;
                        const hasDraft = isEditing && !!selDraft;
                        const activeShape = hasDraft ? (selDraft.selectionType || pendingShapeType) : pendingShapeType;
                        const featherVal = hasDraft ? (selDraft.selFeather ?? 0) : (effSel ? (effSel.selFeather ?? 0) : 0);
                        const setFeather = (v) => {
                          if (hasDraft) setSelDraft(p => ({ ...p, selFeather: v }));
                          else if (effSel) updateCanvasItem(primarySelectedItem.id, { selFeather: v });
                        };
                        const applyMask = () => {
                          if (!selDraft) return;
                          const it = primarySelectedItem;
                          const origX = it.originalX ?? it.x;
                          const origY = it.originalY ?? it.y;
                          const origW = it.originalWidth ?? it.width;
                          const origH = it.originalHeight ?? it.height;
                          const curRenderW = it.cropRenderW ?? it.width;
                          const curRenderH = it.cropRenderH ?? it.height;
                          const curOffX = it.cropRenderOffsetX ?? 0;
                          const curOffY = it.cropRenderOffsetY ?? 0;
                          const newW = Math.max(1, Math.round(selDraft.selW * it.width));
                          const newH = Math.max(1, Math.round(selDraft.selH * it.height));
                          const newX = Math.round(it.x + selDraft.selX * it.width);
                          const newY = Math.round(it.y + selDraft.selY * it.height);
                          updateCanvasItem(it.id, {
                            x: newX, y: newY, width: newW, height: newH,
                            originalX: origX, originalY: origY, originalWidth: origW, originalHeight: origH,
                            cropRenderW: curRenderW, cropRenderH: curRenderH,
                            cropRenderOffsetX: curOffX - selDraft.selX * it.width,
                            cropRenderOffsetY: curOffY - selDraft.selY * it.height,
                            selectionType: selDraft.selectionType,
                            selX: 0, selY: 0, selW: 1, selH: 1,
                            selFeather: selDraft.selFeather ?? 0,
                            cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0,
                            maskType: null, maskFeather: 0,
                          });
                          setSelMode(null);
                          setSelDraft(null);
                          setSelBounds(null);
                        };
                        const resetMask = () => {
                          const it = primarySelectedItem;
                          const patch = {
                            selectionType: null, selX: null, selY: null, selW: null, selH: null, selFeather: null,
                            cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0,
                            maskType: null, maskFeather: 0,
                            cropRenderOffsetX: null, cropRenderOffsetY: null,
                            cropRenderW: null, cropRenderH: null,
                          };
                          if (it.originalX != null) {
                            patch.x = it.originalX;
                            patch.y = it.originalY;
                            patch.width = it.originalWidth;
                            patch.height = it.originalHeight;
                            patch.originalX = null;
                            patch.originalY = null;
                            patch.originalWidth = null;
                            patch.originalHeight = null;
                          }
                          updateCanvasItem(it.id, patch);
                          setSelMode(null);
                          setSelDraft(null);
                          setSelBounds(null);
                        };
                        return (
                          <div style={{ position: "absolute", top: "28px", left: 0, width: "188px", boxSizing: "border-box", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 9999, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "7px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", overflow: "hidden" }}>
                            {/* Shape — hover row reveals submenu, never causes menu resize */}
                            <div
                              style={{ position: "relative" }}
                              onMouseEnter={() => setShowShapeSubmenu(true)}
                              onMouseLeave={() => setShowShapeSubmenu(false)}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px", borderRadius: "3px", cursor: "default", backgroundColor: showShapeSubmenu ? "#f0f0f0" : "transparent", userSelect: "none" }}>
                                <span style={{ fontSize: "11px" }}>Shape</span>
                                <span style={{ fontSize: "10px", color: "#555" }}>{activeShape === "ellipse" ? "Elliptical" : "Rectangular"} ▶</span>
                              </div>
                              {showShapeSubmenu && (
                                <div style={{ position: "absolute", left: "calc(100% + 4px)", top: 0, width: "110px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 10000, padding: "4px 0" }}>
                                  <button
                                    onClick={() => { setPendingShapeType("rect"); if (hasDraft) setSelDraft(p => ({ ...p, selectionType: "rect" })); }}
                                    style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 10px", border: "none", borderBottom: "1px solid #eee", background: activeShape === "rect" ? "#e3f2fd" : "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}
                                  >Rectangular</button>
                                  <button
                                    onClick={() => { setPendingShapeType("ellipse"); if (hasDraft) setSelDraft(p => ({ ...p, selectionType: "ellipse" })); }}
                                    style={{ width: "100%", display: "block", textAlign: "left", padding: "6px 10px", border: "none", background: activeShape === "ellipse" ? "#e3f2fd" : "white", cursor: "pointer", fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif" }}
                                  >Elliptical</button>
                                </div>
                              )}
                            </div>
                            {/* Entry: Draw Mask (no existing mask) — Edit Mask (existing mask, not editing) */}
                            {!isEditing && !effSel && (
                              <button
                                onClick={() => { setSelBounds(null); setSelDraft(null); setSelMode(primarySelectedItem.id); }}
                                style={{ ...MOODBOARD_TOOLBAR_BTN, textAlign: "left" }}
                              >Draw Mask</button>
                            )}
                            {!isEditing && effSel && (
                              <button
                                onClick={() => { setSelBounds(null); setSelDraft(null); setSelMode(primarySelectedItem.id); }}
                                style={{ ...MOODBOARD_TOOLBAR_BTN, textAlign: "left" }}
                              >Edit Mask</button>
                            )}
                            {/* Feather — shown when draft exists OR applied mask exists */}
                            <div style={{ opacity: (hasDraft || (!isEditing && effSel)) ? 1 : 0.35, pointerEvents: (hasDraft || (!isEditing && effSel)) ? "auto" : "none" }}>
                              <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", width: "100%", boxSizing: "border-box" }}>
                                <span style={{ width: "40px", flexShrink: 0 }}>Feather</span>
                                <input type="range" min="0" max="150" step="1"
                                  value={Math.min(150, featherVal)}
                                  onChange={(e) => setFeather(Number(e.target.value))}
                                  style={{ width: "58px", flex: "0 0 58px", minWidth: 0 }}
                                />
                                <input type="number" min="0" step="1"
                                  value={featherVal}
                                  onChange={(e) => { const n = Number(e.target.value); if (!isNaN(n) && n >= 0) setFeather(n); }}
                                  style={{ width: "42px", flex: "0 0 42px", boxSizing: "border-box", padding: "2px 3px", fontSize: "10px", border: "1px solid #ccc", borderRadius: "3px" }}
                                />
                              </label>
                            </div>
                            {/* Reset */}
                            <div style={{ height: "1px", backgroundColor: "#eee", opacity: effSel ? 1 : 0 }} />
                            <button
                              onClick={resetMask}
                              disabled={!effSel}
                              style={{ ...MOODBOARD_TOOLBAR_BTN, textAlign: "left", color: effSel ? "#c62828" : "#ccc", cursor: effSel ? "pointer" : "not-allowed" }}
                            >Reset Mask</button>
                            {/* Apply / Cancel — only when editing, at the bottom */}
                            <div style={{ height: "1px", backgroundColor: "#eee", opacity: isEditing ? 1 : 0 }} />
                            <div style={{ display: "flex", gap: "4px", opacity: isEditing ? 1 : 0.35, pointerEvents: isEditing ? "auto" : "none" }}>
                              <button
                                onClick={applyMask}
                                disabled={!hasDraft}
                                style={{ ...MOODBOARD_TOOLBAR_BTN, flex: 1, backgroundColor: hasDraft ? "#2196F3" : "#e0e0e0", color: hasDraft ? "white" : "#999", border: "none", cursor: hasDraft ? "pointer" : "not-allowed" }}
                              >Apply</button>
                              <button
                                onClick={() => { setSelMode(null); setSelDraft(null); setSelBounds(null); }}
                                style={{ ...MOODBOARD_TOOLBAR_BTN, flex: 1 }}
                              >Cancel</button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
                {primarySelectedItem.type === "solid" && selectedItems.length === 1 && (
                  <>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input type="color" value={primarySelectedItem.solidColor || "#cccccc"} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { solidColor: e.target.value })} style={{ width: "22px", height: "22px", padding: 0, border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }} />
                      Color
                    </label>
                    {primarySelectedItem.solidShape !== "ellipse" && (
                      <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                        Radius
                        <input type="range" min="0" max="200" step="1" value={primarySelectedItem.cornerRadius ?? 0} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { cornerRadius: Number(e.target.value) })} style={{ width: "55px" }} />
                        <span style={{ fontSize: "9px", minWidth: "18px" }}>{primarySelectedItem.cornerRadius ?? 0}</span>
                      </label>
                    )}
                  </>
                )}
                {primarySelectedItem.type === "grain" && selectedItems.length === 1 && (
                  <>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      Amount
                      <input type="range" min="0" max="1" step="0.05" value={primarySelectedItem.grainAmount ?? 0.6} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { grainAmount: Number(e.target.value) })} style={{ width: "60px" }} />
                    </label>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      Size
                      <input type="range" min="1" max="3" step="0.25" value={primarySelectedItem.grainSize ?? 1} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { grainSize: Number(e.target.value) })} style={{ width: "55px" }} />
                    </label>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      Soft
                      <input type="range" min="0" max="10" step="0.5" value={primarySelectedItem.grainSoftening ?? 0} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { grainSoftening: Number(e.target.value) })} style={{ width: "55px" }} />
                    </label>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      Color
                      <input type="range" min="0" max="3" step="0.1" value={primarySelectedItem.grainSaturation ?? 1} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { grainSaturation: Number(e.target.value) })} style={{ width: "55px" }} />
                    </label>
                    <input type="color" value={primarySelectedItem.grainColor || "#2e2e2e"} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { grainColor: e.target.value })} style={{ width: "22px", height: "22px", padding: 0, border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }} title="Grain base color" />
                  </>
                )}
                {primarySelectedItem.type === "text" && selectedItems.length === 1 && (
                  <>
                    <div ref={fontDropdownRef} style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowFontDropdown((prev) => !prev)}
                        style={{ ...MOODBOARD_TOOLBAR_BTN, width: "114px", textAlign: "left", fontFamily: primarySelectedItem.fontFamily, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >{primarySelectedItem.fontFamily}</button>
                      {showFontDropdown && (
                        <div style={{ position: "absolute", top: "28px", left: 0, width: "270px", maxHeight: "320px", overflowY: "auto", backgroundColor: "white", border: "1px solid #ccc", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", zIndex: 9999 }}>
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
                      min="8" max="300"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || val === "-") return;
                        const n = Number(val);
                        if (n >= 1) updateCanvasItem(primarySelectedItem.id, { fontSize: n });
                      }}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (!n || n < 1) updateCanvasItem(primarySelectedItem.id, { fontSize: 12 });
                      }}
                      style={{ ...MOODBOARD_TOOLBAR_BTN, width: "42px", padding: "3px 4px", textAlign: "center" }}
                    />
                    <select
                      value={primarySelectedItem.fontWeight}
                      onChange={(event) => updateCanvasItem(primarySelectedItem.id, { fontWeight: event.target.value })}
                      style={{ ...MOODBOARD_TOOLBAR_BTN, width: "80px" }}
                    >
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                      <option value="900">Heavy</option>
                    </select>
                    <div style={{ display: "flex", gap: "2px" }}>
                      {[{v:"left",label:"L"},{v:"center",label:"C"},{v:"right",label:"R"}].map(({v,label}) => (
                        <button key={v} onClick={() => updateCanvasItem(primarySelectedItem.id, { textAlign: v })}
                          title={`Align ${v}`}
                          style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: (primarySelectedItem.textAlign || "left") === v ? "#2196F3" : "#f0f0f0", color: (primarySelectedItem.textAlign || "left") === v ? "white" : "#333" }}
                        >{label}</button>
                      ))}
                    </div>
                    <label style={{ fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input type="color" value={primarySelectedItem.color} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { color: event.target.value })} style={{ width: "22px", height: "22px", padding: 0, border: "1px solid #ccc", borderRadius: "3px", cursor: "pointer" }} />
                      <span style={{ fontSize: "10px", color: "#666", whiteSpace: "nowrap" }}>Opacity</span>
                      <input type="range" min="0.1" max="1" step="0.05" value={primarySelectedItem.opacity ?? 1} onChange={(event) => updateCanvasItem(primarySelectedItem.id, { opacity: Number(event.target.value) })} style={{ width: "48px" }} />
                    </label>
                    <div ref={textSpacingRef} style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowTextSpacingDropdown((prev) => !prev)}
                        title="Tracking and Leading"
                        style={{ ...MOODBOARD_TOOLBAR_BTN, backgroundColor: showTextSpacingDropdown ? "#e3f2fd" : "#f0f0f0" }}
                      >¶</button>
                      {showTextSpacingDropdown && (
                        <div style={{ position: "absolute", top: "28px", left: 0, minWidth: "200px", backgroundColor: "white", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 9999, padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "52px" }}>Tracking</span>
                            <input type="range" min="-5" max="30" step="0.5" value={primarySelectedItem.letterSpacing ?? 0} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { letterSpacing: Number(e.target.value) })} style={{ width: "80px" }} />
                            <span style={{ fontSize: "10px", width: "28px", textAlign: "right" }}>{primarySelectedItem.letterSpacing ?? 0}</span>
                          </label>
                          <label style={{ fontSize: "11px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "52px" }}>Leading</span>
                            <input type="range" min="0.7" max="3" step="0.05" value={primarySelectedItem.lineHeight ?? 1.1} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { lineHeight: Number(e.target.value) })} style={{ width: "80px" }} />
                            <span style={{ fontSize: "10px", width: "28px", textAlign: "right" }}>{(primarySelectedItem.lineHeight ?? 1.1).toFixed(2)}</span>
                          </label>
                        </div>
                      )}
                    </div>
                    <label style={{ fontSize: "10px", fontFamily: "'Questrial', 'Futura', 'Arial', sans-serif", display: "flex", alignItems: "center", gap: "4px" }}>
                      Blur
                      <input type="range" min="0" max="5" step="0.25" value={primarySelectedItem.textBlur ?? 0} onChange={(e) => updateCanvasItem(primarySelectedItem.id, { textBlur: Number(e.target.value) })} style={{ width: "50px" }} />
                      <input type="number" min="0" max="50" step="0.25" value={primarySelectedItem.textBlur ?? 0} onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v) && v >= 0) updateCanvasItem(primarySelectedItem.id, { textBlur: v }); }} style={{ ...MOODBOARD_TOOLBAR_BTN, width: "38px", padding: "2px 4px", textAlign: "center" }} />
                    </label>
                  </>
                )}
                {canEdit && !isViewOnly && (
                  <>
                    <button onClick={duplicateSelectedItems} style={{ ...MOODBOARD_TOOLBAR_BTN, marginLeft: "6px" }}>DUPLICATE</button>
                    <button onClick={deleteSelectedItems} style={{ ...MOODBOARD_TOOLBAR_BTN, color: "#c62828" }}>DELETE</button>
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
              const scaledContainerW = Math.ceil(maxW * zoom) + 48;
              return (
                <div style={{ width: scaledContainerW, minWidth: "100%", paddingTop: "8px", paddingBottom: "16px" }}>
                  {boardPages.map((page, pageIndex) => {
                    const isActive = activePage?.id === page.id;
                    const currentW = resizingPage?.pageId === page.id ? resizingPage.width : page.width;
                    const currentH = resizingPage?.pageId === page.id ? resizingPage.height : page.height;
                    return (
                      <div key={page.id} ref={el => { pageRefs.current[page.id] = el; }} style={{ marginBottom: "6px" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", color: "#333", backgroundColor: "#d9d9d9", padding: "4px 8px" }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (pageDragIdRef.current && pageDragIdRef.current !== page.id) {
                              reorderPage(pageDragIdRef.current, pageIndex);
                            }
                            pageDragIdRef.current = null;
                          }}
                        >
                          {canEdit && !isViewOnly && (
                            <span
                              draggable
                              onDragStart={() => { pageDragIdRef.current = page.id; }}
                              onDragEnd={() => { pageDragIdRef.current = null; }}
                              title="Drag to reorder page"
                              style={{ cursor: "grab", fontSize: "14px", color: "#888", userSelect: "none", lineHeight: 1, flexShrink: 0 }}
                            >⠿</span>
                          )}
                          <button onClick={() => setActivePage(page.id)} style={{ fontWeight: isActive ? "bold" : "normal", padding: "4px 8px", cursor: "pointer", border: "1px solid #bbb", borderRadius: "3px", backgroundColor: isActive ? "#fff" : "#e8e8e8", fontSize: "12px" }}>
                            {page.name || `Page ${pageIndex + 1}`}
                          </button>
                          <input
                            value={page.name || ""}
                            onChange={(event) => updatePage(page.id, { name: event.target.value })}
                            disabled={!canEdit || isViewOnly}
                            placeholder="Page name"
                            style={{ width: "120px", padding: "4px 6px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "3px" }}
                          />
                          <select value={page.presetKey || "custom"} onChange={(event) => applyCanvasPreset(page.id, event.target.value)} style={{ padding: "4px", fontSize: "12px" }}>
                            {CANVAS_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}
                          </select>
                          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            BG <input type="color" value={page.backgroundColor || "#ffffff"} onChange={(event) => updatePage(page.id, { backgroundColor: event.target.value })} style={{ width: "28px", height: "22px", padding: "0", border: "1px solid #ccc", cursor: "pointer" }} />
                          </label>
                          <button onClick={() => duplicatePage(page.id)} disabled={!canEdit || isViewOnly} style={{ fontSize: "11px", padding: "3px 7px", cursor: "pointer", border: "1px solid #bbb", borderRadius: "3px", backgroundColor: "#e8e8e8" }}>Duplicate</button>
                          <button onClick={() => deletePage(page.id)} disabled={!canEdit || isViewOnly || boardPages.length <= 1} style={{ fontSize: "11px", padding: "3px 7px", cursor: "pointer", border: "1px solid #bbb", borderRadius: "3px", backgroundColor: "#e8e8e8" }}>Delete</button>
                          <span style={{ fontSize: "11px", color: "#666", marginLeft: "4px" }}>{currentW} × {currentH}</span>
                        </div>
                        {/* Canvas sized to exact zoomed dimensions — no padding inside the transform */}
                        <div style={{ position: "relative", height: Math.ceil(currentH * zoom), overflow: "hidden" }}>
                          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: currentW + 8, position: "absolute", top: 0, left: 0 }}>
                            {renderPage(page, pageIndex)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {showLayerPanel && (
            <div style={{ width: RIGHT_PANEL_WIDTH, flexShrink: 0, borderLeft: "1px solid #ccc", backgroundColor: "#f8f8f8", overflowY: "auto" }}>
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
                        <React.Fragment key={item.id}>
                        <div
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
                          <span style={{ flexShrink: 0, fontSize: "9px", fontWeight: "bold", backgroundColor: item.type === "text" ? "#E3F2FD" : item.type === "solid" ? "#E8F5E9" : item.type === "grain" ? "#FFF3E0" : "#F3E5F5", color: item.type === "text" ? "#1565C0" : item.type === "solid" ? "#2E7D32" : item.type === "grain" ? "#E65100" : "#6A1B9A", padding: "1px 4px", borderRadius: "2px" }}>{item.type === "text" ? "T" : item.type === "solid" ? "■" : item.type === "grain" ? "~" : "IMG"}</span>
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
                        {selected && (
                          <div style={{ padding: "3px 8px 4px 22px", backgroundColor: "#f5f5f5", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ fontSize: "10px", color: "#888", flexShrink: 0 }}>Blend</span>
                            <select
                              value={item.blendMode || "normal"}
                              onChange={(e) => { e.stopPropagation(); updateCanvasItem(item.id, { blendMode: e.target.value }); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: "10px", flex: 1, border: "1px solid #ddd", borderRadius: "2px", padding: "1px 2px", backgroundColor: "white", maxWidth: "130px" }}
                            >
                              {BLEND_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </div>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                <div key={item.id} style={{ position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex, opacity: item.opacity ?? 1, mixBlendMode: item.blendMode || "normal", backgroundColor: item.type === "text" ? item.backgroundColor : "transparent", transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, transformOrigin: "center center" }}>
                  {item.type === "image" && img && <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: item.objectFit || "contain" }} />}
                  {item.type === "text" && <div style={{ color: item.color, fontFamily: item.fontFamily, fontSize: item.fontSize, fontWeight: item.fontWeight, lineHeight: item.lineHeight ?? 1.1, letterSpacing: item.letterSpacing ? `${item.letterSpacing}px` : "normal", textAlign: item.textAlign || "left", padding: 6, whiteSpace: "pre-wrap" }}>{item.text}</div>}
                  {item.type === "solid" && (
                    item.solidShape === "ellipse"
                      ? <div style={{ width: "100%", height: "100%", backgroundColor: item.solidColor || "#ccc", borderRadius: "50%" }} />
                      : <div style={{ width: "100%", height: "100%", backgroundColor: item.solidColor || "#ccc" }} />
                  )}
                  {item.type === "grain" && (() => {
                    const dataUrl = getGrainDataUrl(item.grainSeed || 0, item.grainAmount ?? 0.6, item.grainSaturation ?? 1, item.grainColor || "#2e2e2e");
                    const bgSize = `${GRAIN_TILE_SIZE * (item.grainSize ?? 1)}px`;
                    const blurPx = (item.grainSoftening ?? 0) * 0.15;
                    const filter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
                    return <div style={{ width: "100%", height: "100%", backgroundImage: `url(${dataUrl})`, backgroundRepeat: "repeat", backgroundSize: bgSize, filter }} />;
                  })()}
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

      {textDragPreview && Number.isFinite(textDragPreview.ghostLeft) && Number.isFinite(textDragPreview.ghostTop) && createPortal(
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: textDragPreview.ghostLeft,
            top: textDragPreview.ghostTop,
            width: textDragPreview.width,
            height: textDragPreview.height,
            zIndex: 30000,
            pointerEvents: "none",
            userSelect: "none",
            opacity: textDragPreview.opacity,
            backgroundColor: textDragPreview.backgroundColor || "transparent",
            color: textDragPreview.color,
            fontFamily: textDragPreview.fontFamily,
            fontSize: textDragPreview.fontSize,
            fontWeight: textDragPreview.fontWeight,
            lineHeight: textDragPreview.lineHeight,
            letterSpacing: textDragPreview.letterSpacing,
            textAlign: textDragPreview.textAlign,
            padding: `${6 * zoom}px`,
            boxSizing: "border-box",
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            transform: textDragPreview.rotation ? `rotate(${textDragPreview.rotation}deg)` : undefined,
            transformOrigin: "center center",
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.28))",
          }}
        >
          {textDragPreview.text}
        </div>,
        document.body
      )}

      {/* MoodBoard share modal */}
      {showShareModal && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowShareModal(false); setShareMessage(""); } }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
          <div
            style={{
              position: "relative", backgroundColor: "white", borderRadius: "8px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)", padding: "24px", width: "480px", maxWidth: "95vw",
              maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box",
              fontFamily: "'Questrial','Futura','Arial',sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Share Mood Boards</h2>
              <button
                onClick={() => { setShowShareModal(false); setShareMessage(""); }}
                style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold", fontSize: "16px", lineHeight: 1 }}
              >×</button>
            </div>

            {/* Board selector for new link */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#555", marginBottom: "8px" }}>
                Select boards to include in new link:
              </div>
              <div style={{ border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden" }}>
                {boards.map(board => (
                  <label
                    key={board.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 12px", borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer", backgroundColor: shareSelectedBoardIds.has(board.id) ? "#e3f2fd" : "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={shareSelectedBoardIds.has(board.id)}
                      onChange={e => {
                        setShareSelectedBoardIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(board.id); else next.delete(board.id);
                          return next;
                        });
                      }}
                      style={{ accentColor: "#2196F3", width: "15px", height: "15px", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "13px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{board.name}</span>
                    <span style={{ fontSize: "10px", color: "#aaa", whiteSpace: "nowrap" }}>
                      {(board.pages || []).length} page{(board.pages || []).length !== 1 ? "s" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateMoodboardShareLink}
              disabled={shareStatus === "saving" || shareStatus === "loading"}
              style={{
                width: "100%", padding: "9px", marginBottom: "6px",
                backgroundColor: shareStatus === "saving" ? "#e0e0e0" : "#2196F3",
                color: shareStatus === "saving" ? "#999" : "white",
                border: "none", borderRadius: "4px", cursor: shareStatus === "saving" ? "default" : "pointer",
                fontWeight: "bold", fontSize: "13px",
              }}
            >
              {shareStatus === "saving" ? "Creating…" : "Create Share Link"}
            </button>

            {shareMessage && (
              <div style={{ fontSize: "12px", color: shareStatus === "error" ? "#c0392b" : "#2196F3", marginBottom: "14px", textAlign: "center" }}>
                {shareMessage}
              </div>
            )}

            {/* Existing active links */}
            {shareStatus === "loading" && (
              <div style={{ textAlign: "center", color: "#aaa", fontSize: "13px", padding: "16px 0" }}>Loading links…</div>
            )}
            {shareStatus !== "loading" && moodboardShareLinks.filter(l => l?.is_active).length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: "#555", marginBottom: "8px", marginTop: "16px" }}>
                  Active share links
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {moodboardShareLinks.filter(l => l?.is_active).map(link => {
                    const shareUrl = link?.token ? `${window.location.origin}/share/moodboard/${link.token}` : "";
                    const sharedBoardNames = (link.board_ids || []).map(bid => {
                      const b = boards.find(b => b.id === bid);
                      return b ? b.name : bid;
                    }).join(", ");
                    return (
                      <div key={link.id} style={{ border: "1px solid #e0e0e0", borderRadius: "6px", padding: "12px", backgroundColor: "#fafafa" }}>
                        <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                          <input
                            value={link.label ?? ""}
                            placeholder="Label (optional)"
                            onChange={e => setMoodboardShareLinks(prev => prev.map(l => l.id === link.id ? { ...l, label: e.target.value } : l))}
                            onBlur={e => handleUpdateMoodboardShareLinkLabel(link.id, e.target.value)}
                            style={{ flex: 1, fontSize: "12px", padding: "4px 8px", border: "1px solid #ddd", borderRadius: "3px" }}
                          />
                          <button
                            onClick={() => handleRevokeMoodboardShareLink(link.id)}
                            disabled={shareStatus === "saving"}
                            style={{ padding: "4px 10px", fontSize: "11px", backgroundColor: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6cb", borderRadius: "3px", cursor: "pointer" }}
                          >Revoke</button>
                        </div>
                        {sharedBoardNames && (
                          <div style={{ fontSize: "10px", color: "#888", marginBottom: "6px" }}>
                            Boards: {sharedBoardNames}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            readOnly
                            value={shareUrl}
                            onFocus={e => e.target.select()}
                            style={{ flex: 1, fontSize: "11px", padding: "4px 8px", border: "1px solid #ddd", borderRadius: "3px", backgroundColor: "#f5f5f5", color: "#333", overflow: "hidden", textOverflow: "ellipsis" }}
                          />
                          <button
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(shareUrl); setShareMessage("Copied!"); }
                              catch { setShareMessage(shareUrl); }
                            }}
                            style={{ padding: "4px 10px", fontSize: "11px", backgroundColor: "#e3f2fd", color: "#1565C0", border: "1px solid #90CAF9", borderRadius: "3px", cursor: "pointer", whiteSpace: "nowrap" }}
                          >Copy</button>
                        </div>
                        <div style={{ fontSize: "10px", color: "#bbb", marginTop: "5px" }}>
                          Created {new Date(link.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => { setShowShareModal(false); setShareMessage(""); }}
              style={{ width: "100%", marginTop: "18px", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Roll image lightbox */}
      {(() => {
        const lbIdx = lightboxImageId != null ? images.findIndex(img => img.id === lightboxImageId) : -1;
        const lbImage = lbIdx >= 0 ? images[lbIdx] : null;
        if (!lbImage) return null;
        return (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setLightboxImageId(null)}>
            {lbIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxImageId(images[lbIdx - 1].id); }}
                style={{ position: "absolute", left: "150px", backgroundColor: "rgba(255,255,255,0.15)", color: "white", border: "none", borderRadius: "50%", width: "48px", height: "48px", fontSize: "24px", cursor: "pointer", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >‹</button>
            )}
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", maxHeight: "92vh" }}>
              <img src={lbImage.url} alt={lbImage.title} style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", display: "block", boxShadow: "0 12px 60px rgba(0,0,0,0.8)" }} />
              {lbImage.title && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", color: "white", padding: "8px 12px", fontSize: "13px", textAlign: "center" }}>{lbImage.title}</div>}
              <button onClick={() => setLightboxImageId(null)} style={{ position: "absolute", top: "-14px", right: "-14px", backgroundColor: "#333", color: "white", border: "none", borderRadius: "50%", width: "30px", height: "30px", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              {!isStoredImageUrl(lbImage.url) && canEdit && !isViewOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); convertImageToStorage(lbImage.id); }}
                  disabled={convertingImageId === lbImage.id}
                  style={{ position: "absolute", top: "-14px", left: "0", backgroundColor: convertingImageId === lbImage.id ? "#888" : "#FF9800", color: "white", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "11px", fontWeight: "bold", cursor: convertingImageId === lbImage.id ? "not-allowed" : "pointer", whiteSpace: "nowrap", zIndex: 1 }}
                >
                  {convertingImageId === lbImage.id ? "Converting…" : "Convert to Storage"}
                </button>
              )}
              {images.length > 1 && (
                <div style={{ position: "absolute", bottom: "-26px", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: "12px", pointerEvents: "none" }}>
                  {lbIdx + 1} / {images.length} · ← → to navigate
                </div>
              )}
            </div>
            {lbIdx < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxImageId(images[lbIdx + 1].id); }}
                style={{ position: "absolute", right: "20px", backgroundColor: "rgba(255,255,255,0.15)", color: "white", border: "none", borderRadius: "50%", width: "48px", height: "48px", fontSize: "24px", cursor: "pointer", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >›</button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default MoodBoard;
