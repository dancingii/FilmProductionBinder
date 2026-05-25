import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ── Page geometry (matches PAGE_LAYOUT and DEFAULT_LAYOUT_TUNING) ─────────────
const LETTER_WIDTH_PT   = 612;
const LETTER_HEIGHT_PT  = 792;
const PAGE_MARGIN_LEFT_PT   = 1.4 * 72;  // 100.8pt
const PAGE_MARGIN_TOP_PT    = 1.0 * 72;  // 72pt
const PAGE_MARGIN_RIGHT_PT  = 1.0 * 72;  // 72pt
const PAGE_MARGIN_BOTTOM_PT = 1.0 * 72;  // 72pt
const LINE_HEIGHT_PT = 12;
const FONT_SIZE_PT   = 12;

// Element left offset from body left edge (DEFAULT_LAYOUT_TUNING *LeftIn × 72)
const TYPE_LEFT_PT = {
  "Scene Heading": 0,
  Action:          0,
  Character:       2.62 * 72,  // 188.64
  Parenthetical:   1.74 * 72,  // 125.28
  Dialogue:        1.35 * 72,  // 97.2
  Transition:      4.60 * 72,  // 331.2
  Shot:            0,
};

// Max chars per line (matches CHARS_PER_LINE_BY_TYPE / getTunedCharsPerLine defaults)
const TYPE_MAX_CHARS = {
  "Scene Heading": 61,
  Action:          61,
  Character:       24,
  Parenthetical:   26,
  Dialogue:        36,
  Transition:      18,
  Shot:            61,
};

// Margin lines = Math.round(DEFAULT_LAYOUT_TUNING margin pt / 12)
const TYPE_MARGIN_TOP_LINES = {
  "Scene Heading": 2,  // 22pt
  Action:          0,  // 0pt
  Character:       1,  // 12pt
  Parenthetical:   0,  // 0pt
  Dialogue:        0,  // 0pt
  Transition:      1,  // 12pt
  Shot:            1,  // 12pt
};

const TYPE_MARGIN_BOTTOM_LINES = {
  "Scene Heading": 1,  // 13pt
  Action:          1,  // 12pt
  Character:       0,  // 0pt
  Parenthetical:   0,  // 0pt
  Dialogue:        1,  // 12pt
  Transition:      1,  // 12pt
  Shot:            1,  // 12pt
};

const UPPERCASE_TYPES = new Set(["Scene Heading", "Character", "Transition", "Shot"]);

const VALID_TYPES = new Set([
  "Scene Heading", "Action", "Character", "Dialogue",
  "Parenthetical", "Transition", "Shot",
]);

const normalizeType = (t) => VALID_TYPES.has(t) ? t : "Action";

// ── Line wrapping (identical algorithm to WritingScriptEditor.getWrappedLineSegments) ──
// Returns [{text, start, end}] where start/end are character offsets in original text.
function getWrappedLineSegments(text, maxChars) {
  const source = String(text || "").replace(/ /g, " ");
  if (!source.trim()) return [{ text: source, start: 0, end: source.length }];

  const segments = [];
  const paragraphs = source.split(/(\n+)/);
  let globalOffset = 0;

  for (const part of paragraphs) {
    const partStart = globalOffset;
    globalOffset += part.length;
    if (!part) continue;

    if (/^\n+$/.test(part)) {
      for (let i = 0; i < part.length; i++) {
        segments.push({ text: "\n", start: partStart + i, end: partStart + i + 1 });
      }
      continue;
    }

    const words = [];
    const wordRegex = /\S+/g;
    let m;
    while ((m = wordRegex.exec(part)) !== null) {
      words.push({ text: m[0], start: partStart + m.index, end: partStart + m.index + m[0].length });
    }

    if (!words.length) {
      segments.push({ text: part, start: partStart, end: partStart + part.length });
      continue;
    }

    let lineStart = words[0].start;
    let lineEnd   = words[0].end;
    let lineLen   = words[0].text.length;

    for (let wi = 1; wi < words.length; wi++) {
      const word = words[wi];
      const nextLen = lineLen + 1 + word.text.length;
      if (nextLen <= maxChars) {
        lineEnd = word.end;
        lineLen = nextLen;
      } else {
        segments.push({ text: source.slice(lineStart, lineEnd), start: lineStart, end: lineEnd });
        lineStart = word.start;
        lineEnd   = word.end;
        lineLen   = word.text.length;
      }
    }
    segments.push({ text: source.slice(lineStart, lineEnd), start: lineStart, end: lineEnd });
  }

  return segments.length ? segments : [{ text: source, start: 0, end: source.length }];
}

// ── Run support ───────────────────────────────────────────────────────────────
// Converts node.runs [{text, bold, italic, strike, highlight}] to offset-based ranges.
function computeRunRanges(runs) {
  if (!Array.isArray(runs) || !runs.length) return null;
  const ranges = [];
  let offset = 0;
  for (const run of runs) {
    const len = String(run.text || "").length;
    ranges.push({
      start: offset, end: offset + len,
      bold: !!run.bold, italic: !!run.italic,
      strike: !!run.strike, highlight: run.highlight || false,
    });
    offset += len;
  }
  return ranges.some(r => r.bold || r.italic || r.strike || r.highlight) ? ranges : null;
}

function parseHexColor(hex) {
  const h = String(hex || "").trim().replace(/^#/, "");
  if (h.length === 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return { r: 255, g: 255, b: 0 };
}

function pdfFontStyle(bold, italic) {
  if (bold && italic) return "bolditalic";
  if (bold)   return "bold";
  if (italic) return "italic";
  return "normal";
}

// Render one visual line with optional per-run styling.
// lineStart/lineEnd are character offsets into the original (pre-uppercase) node text.
// charWidthPt: advance width per character for Courier (monospace).
function renderLine(pdf, lineText, lineStart, lineEnd, x, y, runRanges, isUppercase, charWidthPt) {
  const display = isUppercase ? lineText.toUpperCase() : lineText;

  if (!runRanges) {
    pdf.setFont("Courier", "normal");
    pdf.text(display, x, y);
    return;
  }

  const overlapping = runRanges.filter(r => r.end > lineStart && r.start < lineEnd);
  if (!overlapping.length) {
    pdf.setFont("Courier", "normal");
    pdf.text(display, x, y);
    return;
  }

  let charX = 0;

  for (const run of overlapping) {
    const rs = Math.max(run.start, lineStart) - lineStart;
    const re = Math.min(run.end,   lineEnd)   - lineStart;

    if (rs > charX) {
      pdf.setFont("Courier", "normal");
      pdf.text(display.slice(charX, rs), x + charX * charWidthPt, y);
      charX = rs;
    }

    const chunk  = display.slice(rs, re);
    const chunkW = chunk.length * charWidthPt;

    if (run.highlight) {
      const col = parseHexColor(run.highlight === true ? "#ffff00" : String(run.highlight));
      pdf.setFillColor(col.r, col.g, col.b);
      pdf.rect(x + rs * charWidthPt, y - LINE_HEIGHT_PT + 1, chunkW, LINE_HEIGHT_PT, "F");
      pdf.setFillColor(0, 0, 0);
    }

    pdf.setFont("Courier", pdfFontStyle(run.bold, run.italic));
    pdf.text(chunk, x + rs * charWidthPt, y);

    if (run.strike) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.5);
      pdf.line(x + rs * charWidthPt, y - 3.5, x + re * charWidthPt, y - 3.5);
    }

    charX = re;
  }

  if (charX < display.length) {
    pdf.setFont("Courier", "normal");
    pdf.text(display.slice(charX), x + charX * charWidthPt, y);
  }
}

// ── Spacing (mirrors getSpacingBeforeNodeLines in WritingScriptEditor) ─────────
function effectivePrevBottomLines(prevType, currType) {
  if (prevType === "Dialogue"     && currType === "Parenthetical") return 0;
  if (prevType === "Parenthetical")                                return 0;
  if (prevType === "Character"    && currType === "Dialogue")       return 0;
  return TYPE_MARGIN_BOTTOM_LINES[prevType] ?? 1;
}

function effectiveCurrTopLines(currType, prevType) {
  if (currType === "Parenthetical")                                       return 0;
  if (currType === "Dialogue"      && prevType === "Parenthetical")       return 0;
  if (currType === "Scene Heading" && prevType === "Scene Heading")       return 0;
  return TYPE_MARGIN_TOP_LINES[currType] ?? 0;
}

function spacingBeforeLines(node, prevNode) {
  if (!prevNode) return 0;
  const type     = normalizeType(node?.type);
  const prevType = normalizeType(prevNode?.type);

  if (type === "Dialogue" &&
      (prevType === "Character" || prevType === "Parenthetical" || prevType === "Dialogue")) return 0;
  if (type === "Parenthetical" &&
      (prevType === "Character" || prevType === "Dialogue" || prevType === "Parenthetical")) return 0;

  return Math.max(
    effectivePrevBottomLines(prevType, type),
    effectiveCurrTopLines(type, prevType),
  );
}

// ── CONT'D / MORE (mirrors shouldShowDialogueMoreAfterPage / getPageStartDialogueContinuationCharacter) ──
const DIALOGUE_FLOW = new Set(["Character", "Dialogue", "Parenthetical"]);

function dialogueGroupCharBefore(nodes, index) {
  for (let i = index - 1; i >= 0; i--) {
    const t = normalizeType(nodes[i]?.type);
    if (t === "Character") return String(nodes[i]?.text || "").toUpperCase();
    if (!DIALOGUE_FLOW.has(t)) return "";
  }
  return "";
}

function dialogueContinuationCharAt(nodes, index) {
  if (!DIALOGUE_FLOW.has(normalizeType(nodes[index]?.type))) return "";
  return dialogueGroupCharBefore(nodes, index);
}

function shouldShowMoreAfterPage(nodes, pageNodes) {
  const last = pageNodes[pageNodes.length - 1];
  if (!last) return false;
  const lastIdx = last.index;
  const next = nodes[lastIdx + 1];
  if (!DIALOGUE_FLOW.has(normalizeType(last.node?.type))) return false;
  if (!next || !DIALOGUE_FLOW.has(normalizeType(next.type))) return false;
  const cur = dialogueContinuationCharAt(nodes, lastIdx);
  const nxt = dialogueContinuationCharAt(nodes, lastIdx + 1);
  return Boolean(cur && cur === nxt);
}

function contdNameAtPageStart(nodes, pageNodes) {
  const first = pageNodes[0];
  if (!first || first.index <= 0) return "";
  const idx  = first.index;
  const prev = nodes[idx - 1];
  if (!DIALOGUE_FLOW.has(normalizeType(first.node?.type))) return "";
  if (!prev || !DIALOGUE_FLOW.has(normalizeType(prev.type))) return "";
  const cur = dialogueContinuationCharAt(nodes, idx);
  const prv = dialogueContinuationCharAt(nodes, idx - 1);
  return cur && cur === prv ? cur : "";
}

function isTitlePageEnabled(titlePageSettings) {
  return Boolean(titlePageSettings?.enabled);
}

function drawCenteredTextBlock(pdf, text, y, options = {}) {
  const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const lineHeight = options.lineHeight || LINE_HEIGHT_PT;
  pdf.setFont("Courier", options.fontStyle || "normal");
  pdf.setFontSize(options.fontSize || FONT_SIZE_PT);
  lines.forEach((line, index) => {
    pdf.text(line, LETTER_WIDTH_PT / 2, y + index * lineHeight, { align: "center" });
  });
  return y + lines.length * lineHeight;
}

function drawLeftTextBlock(pdf, text, x, y, options = {}) {
  const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const lineHeight = options.lineHeight || LINE_HEIGHT_PT;
  pdf.setFont("Courier", options.fontStyle || "normal");
  pdf.setFontSize(options.fontSize || FONT_SIZE_PT);
  lines.forEach((line, index) => {
    pdf.text(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawTitlePage(pdf, titlePageSettings = {}) {
  pdf.setFont("Courier", "normal");
  pdf.setFontSize(FONT_SIZE_PT);

  const title = String(titlePageSettings.title || "").trim();
  const creditLabel = String(titlePageSettings.creditLabel || "by").trim();
  const writerName = String(titlePageSettings.writerName || "").trim();
  const revisionsLabel = String(titlePageSettings.revisionsLabel || "Revisions by").trim();
  const revisionsText = String(titlePageSettings.revisionsText || "").trim();
  const currentRevisionsLabel = String(titlePageSettings.currentRevisionsLabel || "Current Revisions by").trim();
  const currentRevisionsText = String(titlePageSettings.currentRevisionsText || "").trim();
  const contactBlock = String(titlePageSettings.contactBlock || "").trim();

  let y = 214;
  if (title) y = drawCenteredTextBlock(pdf, title, y) + 28;
  if (creditLabel) y = drawCenteredTextBlock(pdf, creditLabel, y) + 28;
  if (writerName) y = drawCenteredTextBlock(pdf, writerName, y) + 54;

  if (revisionsLabel) y = drawCenteredTextBlock(pdf, revisionsLabel, y) + 28;
  if (revisionsText) y = drawCenteredTextBlock(pdf, revisionsText, y) + 54;

  if (currentRevisionsLabel) y = drawCenteredTextBlock(pdf, currentRevisionsLabel, y) + 28;
  if (currentRevisionsText) drawCenteredTextBlock(pdf, currentRevisionsText, y);

  if (contactBlock) {
    drawLeftTextBlock(pdf, contactBlock, PAGE_MARGIN_LEFT_PT, LETTER_HEIGHT_PT - 122);
  }
}

// ── Writing script PDF export (jsPDF text-based) ─────────────────────────────
// model: { pages: paginatedPages, nodes } from WritingScriptEditor.getPdfExportModel()
export async function exportWritingScriptToPdf({ pages, nodes, titlePageSettings }, fileName) {
  if (!pages?.length) return;

  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  pdf.setFont("Courier", "normal");
  pdf.setFontSize(FONT_SIZE_PT);
  const charWidthPt = pdf.getStringUnitWidth("M") * FONT_SIZE_PT;
  const includeTitlePage = isTitlePageEnabled(titlePageSettings);

  if (includeTitlePage) {
    drawTitlePage(pdf, titlePageSettings);
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (includeTitlePage || pageIndex > 0) pdf.addPage("letter", "portrait");
    const pageNodes = pages[pageIndex];

    if (pageIndex >= 1) {
      pdf.setFont("Courier", "normal");
      pdf.setFontSize(FONT_SIZE_PT);
      pdf.text(`${pageIndex + 1}.`, LETTER_WIDTH_PT - PAGE_MARGIN_RIGHT_PT, PAGE_MARGIN_TOP_PT);
    }

    let y = PAGE_MARGIN_TOP_PT;

    const contdName = contdNameAtPageStart(nodes, pageNodes);
    let prevNode = null;

    if (contdName) {
      const contdX = PAGE_MARGIN_LEFT_PT + TYPE_LEFT_PT["Character"];
      pdf.setFont("Courier", "normal");
      pdf.setFontSize(FONT_SIZE_PT);
      pdf.text(`${contdName} (CONT'D)`, contdX, y);
      y += LINE_HEIGHT_PT;
      prevNode = { type: "Character" };
    }

    for (let i = 0; i < pageNodes.length; i++) {
      const entry = pageNodes[i];
      const node  = entry.node;
      const type  = normalizeType(node.type);

      if (i > 0) prevNode = pageNodes[i - 1].node;

      y += spacingBeforeLines(node, prevNode) * LINE_HEIGHT_PT;

      const leftX    = PAGE_MARGIN_LEFT_PT + (TYPE_LEFT_PT[type] ?? 0);
      const maxChars = TYPE_MAX_CHARS[type] ?? 61;
      const isUpper  = UPPERCASE_TYPES.has(type);
      const text     = node.text || "";
      const runRanges = computeRunRanges(node.runs || null);

      pdf.setFont("Courier", "normal");
      pdf.setFontSize(FONT_SIZE_PT);

      const segs = getWrappedLineSegments(text, maxChars);

      for (const seg of segs) {
        if (seg.text === "\n") { y += LINE_HEIGHT_PT; continue; }

        if (type === "Transition") {
          const rightX = PAGE_MARGIN_LEFT_PT + TYPE_LEFT_PT["Transition"] + 1.8 * 72;
          pdf.setFont("Courier", "normal");
          pdf.text(seg.text.toUpperCase(), rightX, y, { align: "right" });
        } else {
          renderLine(pdf, seg.text, seg.start, seg.end, leftX, y, runRanges, isUpper, charWidthPt);
        }

        y += LINE_HEIGHT_PT;
      }
    }

    if (shouldShowMoreAfterPage(nodes, pageNodes)) {
      pdf.setFont("Courier", "normal");
      pdf.setFontSize(FONT_SIZE_PT);
      pdf.text("(MORE)", PAGE_MARGIN_LEFT_PT + TYPE_LEFT_PT["Character"], LETTER_HEIGHT_PT - PAGE_MARGIN_BOTTOM_PT);
    }
  }

  pdf.save(fileName);
}

// ── Breakdown script PDF export ───────────────────────────────────────────────
// Clones the container off-screen so the live DOM is never mutated.
function createOffscreenWrapper(widthPx) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    `width:${widthPx}px`,
    "height:auto",
    "overflow:visible",
    "pointer-events:none",
    "z-index:-9999",
  ].join(";");
  document.body.appendChild(wrapper);
  return wrapper;
}

function waitFrames(n = 2) {
  return new Promise(resolve => {
    let count = 0;
    const tick = () => { if (++count >= n) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

export async function exportBreakdownScriptToPdf(containerEl, fileName) {
  if (!containerEl) return;
  window.getSelection()?.removeAllRanges();

  const origWidth = containerEl.offsetWidth || 816;

  const clone = containerEl.cloneNode(true);
  clone.style.overflowY = "visible";
  clone.style.overflowX = "hidden";
  clone.style.height = "auto";
  clone.style.maxHeight = "none";
  clone.style.width = origWidth + "px";

  const wrapper = createOffscreenWrapper(origWidth);
  wrapper.appendChild(clone);

  await waitFrames(2);

  try {
    const fullHeight = clone.scrollHeight || clone.offsetHeight;
    const elWidth = clone.offsetWidth || origWidth;

    const pageHeightCss = Math.round(elWidth * (11 / 8.5));
    const SCALE = 1.5;
    const numPages = Math.ceil(fullHeight / pageHeightCss);

    const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });

    for (let i = 0; i < numPages; i++) {
      if (i > 0) pdf.addPage("letter", "portrait");

      const yOffset = Math.round(i * pageHeightCss);
      const sliceH = Math.min(pageHeightCss, fullHeight - yOffset);

      const canvas = await html2canvas(clone, {
        scale: SCALE,
        x: 0,
        y: yOffset,
        width: elWidth,
        height: sliceH,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const targetW = Math.round(elWidth * SCALE);
      const targetH = Math.round(pageHeightCss * SCALE);

      if (canvas.height < targetH) {
        const padded = document.createElement("canvas");
        padded.width = targetW;
        padded.height = targetH;
        const ctx = padded.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(canvas, 0, 0);
        pdf.addImage(padded.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, LETTER_WIDTH_PT, LETTER_HEIGHT_PT);
      } else {
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, LETTER_WIDTH_PT, LETTER_HEIGHT_PT);
      }
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(wrapper);
  }
}
