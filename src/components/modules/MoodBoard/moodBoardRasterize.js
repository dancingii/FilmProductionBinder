// Shared helper for rasterizing a MoodBoard page to an HTMLCanvasElement.
// Used by both PDF export and share snapshot generation.
// No React, no Supabase, no side effects — pure canvas rendering.

const GRAIN_TILE_SIZE = 512;
const GRAIN_TILE_CACHE = new Map();

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

const CANVAS_BLEND_OPS = new Set([
  "multiply","screen","overlay","darken","lighten",
  "color-dodge","color-burn","hard-light","soft-light",
  "difference","exclusion","hue","saturation","color","luminosity",
]);
function toCanvasBlendMode(mode) {
  if (!mode || mode === "normal") return "source-over";
  return CANVAS_BLEND_OPS.has(mode) ? mode : "source-over";
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

function getPdfObjectFitDrawRect(imageW, imageH, boxW, boxH, objectFit = "contain") {
  const scale = objectFit === "cover"
    ? Math.max(boxW / imageW, boxH / imageH)
    : Math.min(boxW / imageW, boxH / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  return { drawX: (boxW - drawW) / 2, drawY: (boxH - drawH) / 2, drawW, drawH };
}

function getCanvasFontFamily(fontFamily = "Arial") {
  return String(fontFamily)
    .split(",")
    .map(family => family.trim())
    .filter(Boolean)
    .map(family => {
      if (/^['"].*['"]$/.test(family) || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(family)) {
        return family;
      }
      return `'${family.replace(/'/g, "\\'")}'`;
    })
    .join(", ");
}

const TEXT_EXPORT_OFFSET_Y = 25;

export function drawMoodBoardTextItem(ctx, item) {
  if (item.backgroundColor && item.backgroundColor !== "transparent") {
    ctx.fillStyle = item.backgroundColor;
    ctx.fillRect(item.x, item.y, item.width, item.height);
  }

  const textBlur = item.textBlur ?? 0;
  if (textBlur > 0) ctx.filter = `blur(${textBlur}px)`;

  const fontWeight = item.fontWeight || "normal";
  const fontSize = item.fontSize || 16;
  const fontFamily = getCanvasFontFamily(item.fontFamily || "Arial");
  const letterSpacing = item.letterSpacing || 0;
  const padding = 6;
  const maxW = item.width - padding * 2;
  const textAlign = item.textAlign || "left";

  ctx.fillStyle = item.color || "#000000";
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = textAlign;

  const drawTextWithSpacing = (text, x, y) => {
    if (letterSpacing === 0) { ctx.fillText(text, x, y); return; }
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + letterSpacing;
    }
  };

  const rawLines = (item.text || "").split("\n");
  const wrappedLines = [];
  for (const raw of rawLines) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!normalized) { wrappedLines.push(""); continue; }
    const words = normalized.split(" ").filter(w => w.length > 0);
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      const w = ctx.measureText(test).width + (letterSpacing * (test.length - 1));
      if (w > maxW && current) { wrappedLines.push(current); current = word; }
      else { current = test; }
    }
    if (current) wrappedLines.push(current);
  }

  const trueLineHeight = fontSize * (item.lineHeight ?? 1.1);
  const metrics = ctx.measureText("Mg");
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const baselineOffset = ((trueLineHeight - fontSize) / 2) + ascent;
  const textX = textAlign === "center"
    ? item.x + item.width / 2
    : textAlign === "right"
    ? item.x + item.width - padding
    : item.x + padding;

  let ty = item.y + padding + baselineOffset + TEXT_EXPORT_OFFSET_Y;
  for (const line of wrappedLines) {
    drawTextWithSpacing(line, textX, ty);
    ty += trueLineHeight;
    if (ty > item.y + item.height + trueLineHeight) break;
  }

  if (textBlur > 0) ctx.filter = "none";
}

function createMoodBoardPdfMaskCanvas(itemW, itemH, selection) {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = Math.max(1, Math.round(itemW));
  maskCanvas.height = Math.max(1, Math.round(itemH));
  const maskCtx = maskCanvas.getContext("2d");
  const selX = selection.selX ?? 0, selY = selection.selY ?? 0;
  const selW = selection.selW ?? 1, selH = selection.selH ?? 1;
  const feather = Math.max(0, selection.selFeather ?? 0);
  const x = selX * itemW, y = selY * itemH;
  const w = selW * itemW, h = selH * itemH;

  maskCtx.fillStyle = "white";
  if (selection.selectionType === "ellipse") {
    const cx = x + w / 2, cy = y + h / 2;
    const rx = Math.max(1, w / 2), ry = Math.max(1, h / 2);
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

  const left = x, right = x + w, top = y, bottom = y + h;
  const safeFeatherX = Math.min(feather, Math.max(0, w / 2));
  const safeFeatherY = Math.min(feather, Math.max(0, h / 2));

  const hGrad = maskCtx.createLinearGradient(left, 0, right, 0);
  hGrad.addColorStop(0, "rgba(255,255,255,0)");
  hGrad.addColorStop(safeFeatherX > 0 ? safeFeatherX / Math.max(1, w) : 0, "white");
  hGrad.addColorStop(safeFeatherX > 0 ? 1 - safeFeatherX / Math.max(1, w) : 1, "white");
  hGrad.addColorStop(1, "rgba(255,255,255,0)");
  maskCtx.fillStyle = hGrad;
  maskCtx.fillRect(left, top, w, h);

  const vMask = document.createElement("canvas");
  vMask.width = maskCanvas.width; vMask.height = maskCanvas.height;
  const vCtx = vMask.getContext("2d");
  const vGrad = vCtx.createLinearGradient(0, top, 0, bottom);
  vGrad.addColorStop(0, "rgba(255,255,255,0)");
  vGrad.addColorStop(safeFeatherY > 0 ? safeFeatherY / Math.max(1, h) : 0, "white");
  vGrad.addColorStop(safeFeatherY > 0 ? 1 - safeFeatherY / Math.max(1, h) : 1, "white");
  vGrad.addColorStop(1, "rgba(255,255,255,0)");
  vCtx.fillStyle = vGrad;
  vCtx.fillRect(left, top, w, h);

  maskCtx.globalCompositeOperation = "destination-in";
  maskCtx.drawImage(vMask, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";
  return maskCanvas;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Pre-load HTMLImageElement objects for all image items.
// Returns {[url]: HTMLImageElement} — missing/broken images are omitted.
export async function preloadImagesForItems(items, imagesArray) {
  const loadedImgMap = {};
  const imageItems = (items || []).filter(item => item.type === "image" && !item.hidden);
  await Promise.all(imageItems.map(item => {
    const imgData = (imagesArray || []).find(img => img.id === item.imageId);
    if (!imgData?.url || loadedImgMap[imgData.url]) return Promise.resolve();
    return new Promise(res => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => { loadedImgMap[imgData.url] = el; res(); };
      el.onerror = () => res();
      el.src = imgData.url;
    });
  }));
  return loadedImgMap;
}

// Render one page to an HTMLCanvasElement.
// items: already filtered to this page, already sorted by zIndex ascending, hidden items excluded.
// loadedImgMap: from preloadImagesForItems.
export async function renderPageToCanvas(page, items, imagesArray, loadedImgMap) {
  const cvs = document.createElement("canvas");
  cvs.width = page.width;
  cvs.height = page.height;
  const ctx = cvs.getContext("2d");

  ctx.fillStyle = page.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);

  for (const item of items) {
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
      const imgData = (imagesArray || []).find(img => img.id === item.imageId);
      const imgEl = imgData ? loadedImgMap[imgData.url] : null;
      if (imgEl) {
        const iw = imgEl.naturalWidth, ih = imgEl.naturalHeight;
        if (iw > 0 && ih > 0) {
          const itemW = item.width, itemH = item.height;
          const sel = getEffectiveSelection(item);
          const hasCropOffset = item.cropRenderW != null && item.cropRenderH != null;
          const cropRenderW = hasCropOffset ? item.cropRenderW : itemW;
          const cropRenderH = hasCropOffset ? item.cropRenderH : itemH;
          const cropRenderOffsetX = hasCropOffset ? (item.cropRenderOffsetX || 0) : 0;
          const cropRenderOffsetY = hasCropOffset ? (item.cropRenderOffsetY || 0) : 0;
          const fitRect = getPdfObjectFitDrawRect(iw, ih, cropRenderW, cropRenderH, item.objectFit || "contain");
          const drawX = cropRenderOffsetX + fitRect.drawX;
          const drawY = cropRenderOffsetY + fitRect.drawY;

          const imageCanvas = document.createElement("canvas");
          imageCanvas.width = Math.max(1, Math.round(itemW));
          imageCanvas.height = Math.max(1, Math.round(itemH));
          const imageCtx = imageCanvas.getContext("2d");
          imageCtx.drawImage(imgEl, drawX, drawY, fitRect.drawW, fitRect.drawH);

          const hasNonTrivialSelection = !!sel && (
            sel.selectionType === "ellipse" ||
            (sel.selFeather ?? 0) > 0 ||
            sel.selX > 0.001 || sel.selY > 0.001 ||
            sel.selW < 0.999 || sel.selH < 0.999
          );
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
        ctx.ellipse(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, item.height / 2, 0, 0, Math.PI * 2);
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
        item.grainSeed || 0, item.grainAmount ?? 0.6, item.grainSaturation ?? 1, item.grainColor || "#2e2e2e"
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

  return cvs;
}
