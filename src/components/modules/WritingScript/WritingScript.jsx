// ═══ WritingScript.jsx ════════════════════════════════════════════════════════
// Writing-only implementation. Copied/adapted from the Script.js writing mode.
// Production mutation paths (saveScenesDatabase, setScenes, stripboard, etc.)
// are intentionally absent. Beat Convert to Scene is disabled.
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import nspell from "nspell";
import englishAffUrl from "dictionary-en/index.aff";
import englishDicUrl from "dictionary-en/index.dic";
import { supabase } from "../../../supabase";
import { usePresence } from "../../../hooks/usePresence";
import PresenceIndicator from "../../shared/PresenceIndicator";
import { calculateScenePageStats, LINES_PER_PAGE } from "../../../utils.js";
import { createSceneId } from "../../../utils/sceneIdentity";
import { buildSceneDisplayLabelMap, getSceneDisplayLabel } from "../../../utils/sceneDisplayLabel";
import { parseScriptFile } from "../../../utils/screenplayImport";
import {
  getSceneRowPresentation,
  getSceneMetadataColumns,
  SCENE_METADATA_COLUMN_WIDTHS,
  SCENE_CUSTOM_COLORS,
  APP_TAB_BLUE,
} from "../../../utils/scenePresentation";
import WritingTimeline from "../../../experimental/writingTimeline/WritingTimeline";
import ScriptWritingEditor from "../Script/ScriptWritingEditor";
import {
  documentNodesFromScenes,
  scenesFromDocumentNodes,
  createEmptySceneHeadingNode,
} from "./writingDraftModel";
import {
  loadWritingDraftAsync,
  loadWritingDictionaryWordsAsync,
  loadWritingTitlePageSettingsAsync,
  saveWritingDictionaryWordsAsync,
  saveWritingDraftSafely,
  saveWritingTitlePageSettingsAsync,
} from "./writingDraftPersistence";
import { exportWritingScriptToPdf } from "../../../utils/exportScriptPagesToPdf";
import {
  createScriptShareLink,
  listScriptShareLinks,
  revokeScriptShareLink,
  updateScriptShareLinkLabel,
  updateScriptShareWatermarkSettings,
} from "../../../services/database";

// ─── Constants ────────────────────────────────────────────────────────────────
const ENABLE_WRITING_TIMELINE = true;
const ELEMENT_TYPES = ["Scene Heading", "Action", "Character", "Dialogue", "Parenthetical", "Transition", "Shot"];
const SAVE_STATUS_RED = "#c62828";
const SAVE_STATUS_ERROR_RED = "#b71c1c";
// Writing toolbar menus must portal to document.body and use WRITING_OVERLAY_Z_INDEX so they are always above the script viewer.
const WRITING_OVERLAY_Z_INDEX = 100000;
const WRITING_MOOD_OVERLAY_Z_INDEX = WRITING_OVERLAY_Z_INDEX - 10;
const DEFAULT_MOOD_OVERLAY_SETTINGS = {
  opacity: 0.3,
  activeOpacity: 0.3,
  maxOpacity: 1,
  inactivityDelaySeconds: 10,
  fadeDurationSeconds: 60,
  columnWidth: 220,
  columns: 4,
  refreshSeconds: 0,
  imageFadeDurationSeconds: 1,
  imageGapPx: 8,
  backgroundColor: "#000000",
  imageBorderRadiusPx: 0,
};
const clampNumber = (value, min, max, fallback) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
};
const normalizeMoodOverlayColor = (value, fallback = DEFAULT_MOOD_OVERLAY_SETTINGS.backgroundColor) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.length > 64 ? fallback : raw;
};
const normalizeMoodOverlaySettings = (settings = {}) => {
  const legacyOpacity = Number(settings.opacity);
  const activeOpacitySource = settings.activeOpacity ?? (Number.isFinite(legacyOpacity) ? legacyOpacity : DEFAULT_MOOD_OVERLAY_SETTINGS.activeOpacity);
  const activeOpacity = clampNumber(activeOpacitySource, 0, 1, DEFAULT_MOOD_OVERLAY_SETTINGS.activeOpacity);

  return {
    opacity: activeOpacity,
    activeOpacity,
    maxOpacity: clampNumber(settings.maxOpacity, 0, 1, DEFAULT_MOOD_OVERLAY_SETTINGS.maxOpacity),
    inactivityDelaySeconds: Math.round(clampNumber(settings.inactivityDelaySeconds, 0, 120, DEFAULT_MOOD_OVERLAY_SETTINGS.inactivityDelaySeconds)),
    fadeDurationSeconds: Math.round(clampNumber(settings.fadeDurationSeconds, 1, 300, DEFAULT_MOOD_OVERLAY_SETTINGS.fadeDurationSeconds)),
    columnWidth: clampNumber(settings.columnWidth, 1, 2000, DEFAULT_MOOD_OVERLAY_SETTINGS.columnWidth),
    columns: Math.round(clampNumber(settings.columns, 2, 10, DEFAULT_MOOD_OVERLAY_SETTINGS.columns)),
    refreshSeconds: Math.round(clampNumber(settings.refreshSeconds, 0, 60, DEFAULT_MOOD_OVERLAY_SETTINGS.refreshSeconds)),
    imageFadeDurationSeconds: Math.round(clampNumber(settings.imageFadeDurationSeconds, 0.1, 10, DEFAULT_MOOD_OVERLAY_SETTINGS.imageFadeDurationSeconds) * 10) / 10,
    imageGapPx: Math.round(clampNumber(settings.imageGapPx, 0, 80, DEFAULT_MOOD_OVERLAY_SETTINGS.imageGapPx)),
    backgroundColor: normalizeMoodOverlayColor(settings.backgroundColor),
    imageBorderRadiusPx: Math.round(clampNumber(settings.imageBorderRadiusPx, 0, 80, DEFAULT_MOOD_OVERLAY_SETTINGS.imageBorderRadiusPx)),
  };
};
const getMoodImageCrossfadeKeyframes = (cycleSeconds, imageFadeDurationSeconds) => {
  const safeCycleSeconds = Number(cycleSeconds);
  if (!Number.isFinite(safeCycleSeconds) || safeCycleSeconds <= 0) {
    return { fadeOutStartPercent: 40, fadeInStartPercent: 90 };
  }

  const safeFadeSeconds = clampNumber(imageFadeDurationSeconds, 0.1, 10, DEFAULT_MOOD_OVERLAY_SETTINGS.imageFadeDurationSeconds);
  const fadePercent = Math.min(49.9, Math.max(0.1, (safeFadeSeconds / safeCycleSeconds) * 100));
  return {
    fadeOutStartPercent: Math.max(0, 50 - fadePercent),
    fadeInStartPercent: Math.max(50, 100 - fadePercent),
  };
};

const DEFAULT_TITLE_PAGE_SETTINGS = {
  enabled: false,
  title: "",
  creditLabel: "by",
  writerName: "",
  revisionsLabel: "Revisions by",
  revisionsText: "(Names of Subsequent Writers,\nin Order of Work Performed)",
  currentRevisionsLabel: "Current Revisions by",
  currentRevisionsText: "(Current Writer, date)",
  contactBlock: "",
};

const REFERENCE_TITLE_PAGE_SETTINGS = {
  enabled: true,
  title: "I Am Awake",
  creditLabel: "by",
  writerName: "Josh Chiara",
  revisionsLabel: "Revisions by",
  revisionsText: "(Names of Subsequent Writers,\nin Order of Work Performed)",
  currentRevisionsLabel: "Current Revisions by",
  currentRevisionsText: "(Current Writer, date)",
  contactBlock: "Josh Chiara\n859-816-7297",
};

const normalizeTitlePageSettings = (settings = {}) => ({
  ...DEFAULT_TITLE_PAGE_SETTINGS,
  ...(settings && typeof settings === "object" ? settings : {}),
  enabled: Boolean(settings?.enabled),
});

const DEFAULT_SCRIPT_SHARE_WATERMARK = {
  enabled: true,
  text: "",
  opacity: 0.1,
  fontSizePx: 48,
  rotationDeg: -30,
  recipientNameEnabled: false,
  recipientName: "",
  brandingImageEnabled: false,
  brandingImageUrl: "",
  brandingImageSizePx: 120,
  brandingImageOpacity: 0.12,
};

const normalizeScriptShareWatermarkSettings = (settings = {}) => ({
  ...DEFAULT_SCRIPT_SHARE_WATERMARK,
  ...(settings && typeof settings === "object" ? settings : {}),
  enabled: settings?.enabled !== false,
  text: String(settings?.text ?? DEFAULT_SCRIPT_SHARE_WATERMARK.text).slice(0, 120),
  opacity: clampNumber(settings?.opacity, 0, 1, DEFAULT_SCRIPT_SHARE_WATERMARK.opacity),
  fontSizePx: Math.round(clampNumber(settings?.fontSizePx, 24, 96, DEFAULT_SCRIPT_SHARE_WATERMARK.fontSizePx)),
  rotationDeg: Math.round(clampNumber(settings?.rotationDeg, -60, 60, DEFAULT_SCRIPT_SHARE_WATERMARK.rotationDeg)),
  recipientNameEnabled: settings?.recipientNameEnabled === true,
  recipientName: String(settings?.recipientName ?? "").slice(0, 120),
  brandingImageEnabled: settings?.brandingImageEnabled === true,
  brandingImageUrl: String(settings?.brandingImageUrl ?? "").slice(0, 2048),
  brandingImageSizePx: Math.round(clampNumber(settings?.brandingImageSizePx, 40, 300, DEFAULT_SCRIPT_SHARE_WATERMARK.brandingImageSizePx)),
  brandingImageOpacity: clampNumber(settings?.brandingImageOpacity, 0, 1, DEFAULT_SCRIPT_SHARE_WATERMARK.brandingImageOpacity),
});

const FALLBACK_SPELLCHECK_WORDS = new Set("a able about above across act after again against all almost alone along already also although always am an and another any anyone anything apartment are around as ask at away back bathroom be bed been before behind being below between big bit body both boy but by call came can car close comes continuous could day did do does door down each end enough even ever every exits eye face faucet feel few find first for from front get gets girl give go goes good got had hand hard has have he head hear hears her here him his hold home house how i if in inside into is it its just keep kind know last left let like line little long look looks made make man marie me men might minute more morning much must my near never new next night no not now of off old on once one only open opens or other out over own page place put right room said same saw say scene see seems she should side since small so some something still stop street take takes tell than that the their them then there they thing things think this through time to too toward turn turns two under up us use very walk want was way we well were what when where which while who why will with woman would yes you young".split(" "));

const SPELLCHECK_MISSPELLINGS = {
  recieve: ["receive"],
  recieved: ["received"],
  seperate: ["separate"],
  definately: ["definitely"],
  wierd: ["weird"],
  accomodate: ["accommodate"],
  occured: ["occurred"],
  untill: ["until"],
  becuase: ["because"],
  beleive: ["believe"],
  thier: ["their"],
  teh: ["the"],
  woudl: ["would"],
  shoudl: ["should"],
  continous: ["continuous"],
  restaraunt: ["restaurant"],
};

const BEAT_MENU_COLORS = {
  default: { label: "Default slate", background: "white", border: "#e5e5e5", swatch: "#C9D6DE" },
  red:    { label: "Red",    background: "#FFEBEE", border: "#EF9A9A", swatch: "#EF9A9A" },
  orange: { label: "Orange", background: "#FFF3E0", border: "#FFCC80", swatch: "#FFCC80" },
  yellow: { label: "Yellow", background: "#FFFDE7", border: "#FFE082", swatch: "#FFE082" },
  green:  { label: "Green",  background: "#E8F5E9", border: "#A5D6A7", swatch: "#A5D6A7" },
  blue:   { label: "Blue",   background: "#E3F2FD", border: "#90CAF9", swatch: "#90CAF9" },
  purple: { label: "Purple", background: "#F3E5F5", border: "#CE93D8", swatch: "#CE93D8" },
};

// ─── Beat Sheet Helpers (copied from Script.js lines 361–575) ─────────────────
const BEAT_TITLE_WORD_LIMIT = 10;
const normalizeBeatText = (text = "") => String(text || "").trim().replace(/\s+/g, " ");

const getWritingDraftSaveStatusColor = (status) => {
  if (status === "error") return SAVE_STATUS_ERROR_RED;
  if (status === "local") return "#b26a00";
  if (status === "unsaved") return SAVE_STATUS_RED;
  if (status === "saving") return "#607D8B";
  return APP_TAB_BLUE;
};

const normalizeSpellcheckWord = (word = "") =>
  String(word || "").toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");

const getSpellcheckSuggestions = (word = "") => {
  const normalized = normalizeSpellcheckWord(word);
  if (SPELLCHECK_MISSPELLINGS[normalized]) return SPELLCHECK_MISSPELLINGS[normalized];

  const suggestions = [];
  FALLBACK_SPELLCHECK_WORDS.forEach((candidate) => {
    if (!candidate || candidate[0] !== normalized[0]) return;
    if (Math.abs(candidate.length - normalized.length) > 2) return;
    let mismatches = 0;
    const max = Math.max(candidate.length, normalized.length);
    for (let i = 0; i < max; i += 1) {
      if (candidate[i] !== normalized[i]) mismatches += 1;
    }
    if (mismatches <= 2) suggestions.push(candidate);
  });

  return suggestions.slice(0, 5);
};

const shouldIgnoreSpellcheckWord = (word = "", nodeType = "", dictionaryWords = new Set(), ignoredWords = new Set(), characterWords = new Set()) => {
  const normalized = normalizeSpellcheckWord(word);
  if (!normalized || normalized.length < 3) return true;
  if (dictionaryWords.has(normalized) || ignoredWords.has(normalized) || characterWords.has(normalized)) return true;
  if (/^(int|ext|ie|more|cont'd|contd|est)$/.test(normalized)) return true;
  if (nodeType === "Scene Heading" && /^[A-Z./]+$/.test(String(word || ""))) return true;
  return false;
};

const buildCharacterWordSet = (nodes = []) => {
  const words = new Set();
  nodes.forEach((node) => {
    if (node?.type !== "Character") return;
    String(node.text || "").replace(/\s*\(CONT'?D\.?\)\s*$/i, "").split(/\s+/).forEach((part) => {
      const normalized = normalizeSpellcheckWord(part);
      if (normalized) words.add(normalized);
    });
  });
  return words;
};

const getSentenceContext = (text = "", startOffset = 0, endOffset = startOffset) => {
  const source = String(text || "");
  const safeStart = Math.max(0, Math.min(source.length, startOffset));
  const safeEnd = Math.max(safeStart, Math.min(source.length, endOffset));

  let sentenceStart = 0;
  for (let i = safeStart - 1; i >= 0; i -= 1) {
    const char = source[i];
    const nextChar = source[i + 1] || "";
    if (char === "\n" || ((char === "." || char === "?" || char === "!") && /\s/.test(nextChar))) {
      sentenceStart = i + 1;
      break;
    }
  }

  while (sentenceStart < safeStart && /\s/.test(source[sentenceStart])) {
    sentenceStart += 1;
  }

  let sentenceEnd = source.length;
  for (let i = safeEnd; i < source.length; i += 1) {
    const char = source[i];
    if (char === "\n") {
      sentenceEnd = i;
      break;
    }
    if (char === "." || char === "?" || char === "!") {
      sentenceEnd = i + 1;
      break;
    }
  }

  while (sentenceEnd > safeEnd && /\s/.test(source[sentenceEnd - 1])) {
    sentenceEnd -= 1;
  }

  const before = source.slice(sentenceStart, safeStart);
  const word = source.slice(safeStart, safeEnd);
  const after = source.slice(safeEnd, sentenceEnd);

  return {
    before,
    word,
    after,
    sentence: `${before}${word}${after}`,
  };
};

const buildSpellcheckIssues = (nodes = [], dictionaryWords = new Set(), ignoredWords = new Set(), spellchecker = null) => {
  const issues = [];
  const characterWords = buildCharacterWordSet(nodes);

  nodes.forEach((node, nodeIndex) => {
    const text = String(node?.text || "");
    const regex = /[A-Za-z][A-Za-z']*/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      const normalized = normalizeSpellcheckWord(word);

      if (shouldIgnoreSpellcheckWord(word, node?.type, dictionaryWords, ignoredWords, characterWords)) {
        continue;
      }

      const isCorrect = spellchecker
        ? spellchecker.correct(word) || spellchecker.correct(normalized)
        : FALLBACK_SPELLCHECK_WORDS.has(normalized);

      if (isCorrect) continue;

      const sentenceContext = getSentenceContext(text, match.index, match.index + word.length);
      const dictionarySuggestions = spellchecker ? spellchecker.suggest(word).slice(0, 8) : [];
      issues.push({
        id: `${node.id}:${match.index}:${word}`,
        nodeId: node.id,
        nodeIndex,
        nodeType: node.type,
        word,
        normalized,
        startOffset: match.index,
        endOffset: match.index + word.length,
        context: sentenceContext.sentence,
        contextParts: sentenceContext,
        suggestions: dictionarySuggestions.length ? dictionarySuggestions : getSpellcheckSuggestions(word),
      });
    }
  });

  return issues;
};

const getWritingSceneMetadata = (sceneMetadata = {}, headingMetadata = {}) => {
  const {
    originalSceneNumber,
    importedSceneNumber,
    sourceSceneNumber,
    displayedSceneNumber,
    replacementLetter,
    ...safeSceneMetadata
  } = sceneMetadata || {};
  const {
    originalSceneNumber: headingOriginalSceneNumber,
    importedSceneNumber: headingImportedSceneNumber,
    sourceSceneNumber: headingSourceSceneNumber,
    displayedSceneNumber: headingDisplayedSceneNumber,
    replacementLetter: headingReplacementLetter,
    ...safeHeadingMetadata
  } = headingMetadata || {};

  return {
    ...safeSceneMetadata,
    ...safeHeadingMetadata,
  };
};

const createBeatId = (sourceText, order, type = "beat") => {
  const input = `${type}|${order}|${sourceText || ""}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `${type}-${order}-${Math.abs(hash).toString(36)}`;
};

const stripBeatMarker = (line = "") =>
  normalizeBeatText(line)
    .replace(/^\s*(?:[-*]|•)\s+/, "")
    .replace(/^\d+[\.)]\s+/, "")
    .replace(/^beat\s+\d+\s*[:.)-]\s*/i, "")
    .trim();

const extractOriginalBeatNumber = (line = "") => {
  const text = normalizeBeatText(line);
  const directMatch = text.match(/^(\d+)[\.)]\s+\S+/);
  if (directMatch) return Number(directMatch[1]);
  const beatMatch = text.match(/^beat\s+(\d+)\s*[:.)-]\s*\S+/i);
  if (beatMatch) return Number(beatMatch[1]);
  return null;
};

const isBeatSectionHeader = (block = "") => {
  const text = normalizeBeatText(block);
  if (!text || text.length > 90) return false;
  if (/\bACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V|\d+)\b/i.test(text)) return true;
  if (/\b(PROLOGUE|EPILOGUE|TEASER|TAG|SECTION|PART)\b/i.test(text) && text.length <= 80) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return false;
  if (text.split(/\s+/).length < 2) return false;
  return text === text.toUpperCase();
};

const isActHeading = (block = "") => {
  const text = normalizeBeatText(block);
  if (!text || text.length > 90) return false;
  if (!/^ACT\s+(ONE|TWO|THREE|FOUR|FIVE|I|II|III|IV|V|\d+)\b/i.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return false;
  return text === text.toUpperCase() || /^ACT\s+/i.test(text);
};

const isNumberedBeatTitle = (line = "") => {
  const text = normalizeBeatText(line);
  return /^\d+[\.)]\s+\S+/.test(text) || /^beat\s+\d+\s*[:.)-]\s*\S+/i.test(text);
};

const isBulletBeatTitle = (line = "") => /^(?:[-*]|•)\s+\S+/.test(normalizeBeatText(line));

const isLikelyBeatTitle = (line = "") => {
  const text = normalizeBeatText(line);
  if (!text || text.length > 80) return false;
  if (isNumberedBeatTitle(text) || isBulletBeatTitle(text)) return true;
  if (/[.!?]$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > BEAT_TITLE_WORD_LIMIT) return false;
  const titleCaseWords = words.filter(word => /^[A-Z0-9]/.test(word));
  return titleCaseWords.length >= Math.max(1, Math.ceil(words.length * 0.6));
};

const createAutoBeatTitle = (text = "", order = 1) => {
  const words = normalizeBeatText(text).split(/\s+/).filter(Boolean).slice(0, 6);
  return words.length ? words.join(" ") : `Beat ${order}`;
};

const normalizeOutlineItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item, index) => {
    const type = item?.type === "act" ? "act" : "beat";
    const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1;
    const rawTimelinePosition = item?.timelinePosition;
    const numericTimelinePosition = Number(rawTimelinePosition);
    const hasManualTimelinePositionSource = item?.timelinePositionSource === "manual";
    const hasTimelinePosition =
      rawTimelinePosition !== null &&
      rawTimelinePosition !== undefined &&
      rawTimelinePosition !== "" &&
      Number.isFinite(numericTimelinePosition) &&
      numericTimelinePosition >= 0 &&
      numericTimelinePosition <= 1 &&
      (hasManualTimelinePositionSource || numericTimelinePosition > 0);
    if (type === "act") {
      return {
        id: item.id || createBeatId(item.sourceText || item.title || "", order, "act"),
        type: "act",
        title: String(item.title || "ACT").trim(),
        order,
        sourceText: item.sourceText || item.title || "",
      };
    }
    return {
      id: item.id || createBeatId(item.sourceText || item.title || "", order, "beat"),
      type: "beat",
      title: String(item.title || `Beat ${order}`).trim(),
      description: String(item.description || "").trim(),
      order,
      verified: Boolean(item.verified),
      convertedSceneId: item.convertedSceneId || null,
      originalBeatNumber: Number.isFinite(Number(item.originalBeatNumber)) ? Number(item.originalBeatNumber) : null,
      markerColor: item.markerColor || null,
      timelinePosition: hasTimelinePosition
        ? Math.max(0, Math.min(1, numericTimelinePosition))
        : null,
      timelinePositionSource: hasTimelinePosition ? "manual" : null,
      sourceText: item.sourceText || "",
    };
  });

const parseBeatSheetText = (rawText = "") => {
  const warnings = [];
  const blocks = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  const items = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const lines = block.split("\n").map(normalizeBeatText).filter(Boolean);
    const firstLine = lines[0] || "";

    if (isActHeading(firstLine)) {
      const order = items.length + 1;
      items.push({ id: createBeatId(firstLine, order, "act"), type: "act", title: firstLine, order, sourceText: firstLine });
      if (lines.length > 1) blocks.splice(i + 1, 0, lines.slice(1).join("\n"));
      i += 1;
      continue;
    }

    let title = "", description = "", sourceText = block, originalBeatNumber = null;

    if (isNumberedBeatTitle(firstLine) || isBulletBeatTitle(firstLine)) {
      originalBeatNumber = extractOriginalBeatNumber(firstLine);
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
      if (!description && blocks[i + 1]) {
        const nextFirstLine = blocks[i + 1].split("\n").map(normalizeBeatText).filter(Boolean)[0] || "";
        if (!isBeatSectionHeader(blocks[i + 1]) && !isNumberedBeatTitle(nextFirstLine) && !isBulletBeatTitle(nextFirstLine)) {
          description = blocks[i + 1].trim();
          sourceText = `${block}\n\n${blocks[i + 1].trim()}`;
          i += 1;
        }
      }
    } else if (lines.length === 1 && isLikelyBeatTitle(firstLine) && blocks[i + 1] && !isBeatSectionHeader(blocks[i + 1])) {
      title = stripBeatMarker(firstLine);
      description = blocks[i + 1].trim();
      sourceText = `${block}\n\n${blocks[i + 1].trim()}`;
      i += 1;
    } else if (lines.length > 1 && isLikelyBeatTitle(firstLine)) {
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
    } else if (lines.length > 1 && !/[.!?]$/.test(firstLine) && firstLine.split(/\s+/).filter(Boolean).length <= BEAT_TITLE_WORD_LIMIT) {
      title = stripBeatMarker(firstLine);
      description = lines.slice(1).join("\n\n").trim();
    } else {
      title = createAutoBeatTitle(block, items.length + 1);
      description = block;
      warnings.push(`Auto-generated title for beat ${items.length + 1}.`);
    }

    const order = items.length + 1;
    items.push({
      id: createBeatId(sourceText, order, "beat"),
      type: "beat",
      order,
      title: title || `Beat ${order}`,
      description,
      verified: false,
      convertedSceneId: null,
      originalBeatNumber,
      sourceText,
    });
    i += 1;
  }

  const beats = items.filter(item => item.type === "beat");
  const acts = items.filter(item => item.type === "act");
  if (items.length === 0 && rawText.trim()) warnings.push("No outline items were detected.");
  return { items, beats, acts, warnings };
};

// ─── BeatsList (copied from Script.js lines 577–736; onConvertItem disabled in writing mode) ──
function BeatsList({ beats, onDeleteItem = null, onReorderItem = null, onOpenItem = null, onConvertItem = null, onColorItem = null, collapsedActIds = {}, onToggleAct = null, showMoodOverlay = false }) {
  const orderedItems = normalizeOutlineItems(beats).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  const beatCount = orderedItems.filter(item => item.type === "beat").length;
  const actCount = orderedItems.filter(item => item.type === "act").length;
  const [dragState, setDragState] = useState({ draggedId: null, overId: null, position: "before" });
  const [beatContextMenu, setBeatContextMenu] = useState(null);
  let beatDisplayNumber = 0;

  useEffect(() => {
    if (!beatContextMenu) return;
    const handleEsc = (e) => { if (e.key === "Escape") setBeatContextMenu(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [beatContextMenu]);

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (itemId, position) => {
    if (dragState.overId !== itemId || dragState.position !== position) return undefined;
    return `2px solid ${APP_TAB_BLUE}`;
  };

  return (
    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ width: "492px", border: "2px inset #ccc", backgroundColor: showMoodOverlay ? "rgba(255,255,255,0.15)" : "white", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden", flex: 1 }}>
        <div style={{ padding: "8px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
          <strong>Outline</strong>
          <span style={{ fontSize: "11px", color: "#777" }}>{beatCount} beats{actCount ? `, ${actCount} acts` : ""}</span>
        </div>
        {orderedItems.length === 0 ? (
          <div style={{ padding: "16px", color: "#777", lineHeight: 1.45 }}>No beats imported yet. Use the Import Beats button above to paste and review a beat sheet.</div>
        ) : (
          orderedItems.map((item, index) => {
            const previousAct = orderedItems.slice(0, index).reverse().find(outlineItem => outlineItem.type === "act");
            const isHiddenByCollapsedAct = item.type === "beat" && previousAct && collapsedActIds[previousAct.id];

            if (item.type === "act") {
              const isCollapsed = Boolean(collapsedActIds[item.id]);
              return (
                <div key={item.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); setDragState({ draggedId: item.id, overId: null, position: "before" }); }}
                  onDragOver={(e) => { e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overId === item.id && prev.position === pos ? prev : { ...prev, overId: item.id, position: pos }); }}
                  onDrop={(e) => { e.preventDefault(); const dragged = dragState.draggedId || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedId: null, overId: null, position: "before" }); onReorderItem?.(dragged, item.id, pos); }}
                  onDragEnd={() => setDragState({ draggedId: null, overId: null, position: "before" })}
                  style={{ padding: "10px", borderTop: getDropBorderStyle(item.id, "before"), borderBottom: getDropBorderStyle(item.id, "after") || "1px solid #b0bec5", backgroundColor: showMoodOverlay ? "rgba(207,216,220,0.25)" : (dragState.draggedId === item.id ? "#B0BEC5" : "#CFD8DC"), color: "#263238", fontWeight: "bold", letterSpacing: "0.02em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "8px", cursor: "grab" }}
                >
                  <button type="button" onClick={() => onToggleAct?.(item.id)} style={{ width: "22px", height: "22px", border: "1px solid #90A4AE", borderRadius: "3px", backgroundColor: "white", color: "#455A64", cursor: "pointer", fontSize: "12px", fontWeight: "bold", lineHeight: "18px", padding: 0, flexShrink: 0 }}>
                    {isCollapsed ? ">" : "v"}
                  </button>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                  <button type="button" onClick={() => onDeleteItem?.(item.id)} style={{ width: "22px", height: "22px", border: "1px solid #c62828", borderRadius: "3px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: "bold", lineHeight: "18px", padding: 0 }}>x</button>
                </div>
              );
            }

            const isConverted = item.convertedSceneId;
            beatDisplayNumber += 1;
            if (isHiddenByCollapsedAct) return null;
            const beatColor = BEAT_MENU_COLORS[item.markerColor] || null;

            return (
              <div key={item.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); setDragState({ draggedId: item.id, overId: null, position: "before" }); }}
                onDragOver={(e) => { e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overId === item.id && prev.position === pos ? prev : { ...prev, overId: item.id, position: pos }); }}
                onDrop={(e) => { e.preventDefault(); const dragged = dragState.draggedId || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedId: null, overId: null, position: "before" }); onReorderItem?.(dragged, item.id, pos); }}
                onDragEnd={() => setDragState({ draggedId: null, overId: null, position: "before" })}
                onDoubleClick={() => onOpenItem?.(item.id)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setBeatContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id, title: item.title, isConverted: Boolean(item.convertedSceneId) }); }}
                title="Double-click to edit beat"
                style={{ padding: "10px", borderTop: getDropBorderStyle(item.id, "before"), borderBottom: getDropBorderStyle(item.id, "after") || `1px solid ${beatColor?.border || "#eee"}`, borderLeft: beatColor ? `3px solid ${beatColor.border}` : undefined, backgroundColor: showMoodOverlay ? "transparent" : (dragState.draggedId === item.id ? "#ECEFF1" : beatColor?.background || (isConverted ? "#E8F5E9" : item.verified ? "#F1F8E9" : "white")), cursor: "grab" }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "8px", color: "#777", fontVariantNumeric: "tabular-nums", minWidth: "22px" }}>#{beatDisplayNumber}</span>
                  {item.originalBeatNumber && item.originalBeatNumber !== beatDisplayNumber && (
                    <span style={{ fontSize: "6px", color: "#c62828", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: "bold" }}>{item.originalBeatNumber}</span>
                  )}
                  <strong style={{ flex: 1, minWidth: 0, fontSize: "11px", color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || `Beat ${beatDisplayNumber}`}</strong>
                  {/* Convert to Scene is disabled in Writing mode — onConvertItem is always null here */}
                  <button type="button" disabled style={{ padding: "3px 6px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#f5f5f5", color: "#bbb", cursor: "default", fontSize: "8px", fontWeight: "bold", whiteSpace: "nowrap" }}>
                    {isConverted ? "Converted" : "Convert to Scene"}
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteItem?.(item.id); }} onDoubleClick={(e) => e.stopPropagation()} style={{ width: "20px", height: "20px", border: "1px solid #c62828", borderRadius: "3px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontSize: "10px", fontWeight: "bold", lineHeight: "16px", padding: 0, flexShrink: 0 }}>x</button>
                </div>
                <div style={{ fontSize: "10px", lineHeight: 1.4, color: "#444", whiteSpace: "pre-wrap" }}>{item.description || "No description."}</div>
              </div>
            );
          })
        )}
      </div>
      {beatContextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 2999 }} onClick={() => setBeatContextMenu(null)} />
          <div style={{ position: "fixed", left: beatContextMenu.x, top: beatContextMenu.y, zIndex: 3000, backgroundColor: "white", border: "1px solid #e0e0e0", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", minWidth: "190px", overflow: "hidden", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px" }}>
            <div style={{ padding: "6px 12px 5px", fontSize: "11px", color: "#999", borderBottom: "1px solid #f0f0f0", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
              {beatContextMenu.title || "Untitled Beat"}
            </div>
            <div onClick={() => { setBeatContextMenu(null); onOpenItem?.(beatContextMenu.itemId); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}>Open Details</div>
            {/* Convert to Scene context item disabled in writing mode */}
            <div style={{ padding: "7px 12px", cursor: "not-allowed", color: "#bbb", borderBottom: "1px solid #f5f5f5" }}>
              {beatContextMenu.isConverted ? "Converted" : "Convert to Scene"}
            </div>
            {onColorItem && (
              <>
                <div onClick={() => setBeatContextMenu(prev => ({ ...prev, showColors: !prev.showColors }))} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: beatContextMenu.showColors ? "none" : "1px solid #f5f5f5" }}>Change Color</div>
                {beatContextMenu.showColors && (
                  <div style={{ padding: "4px 0", borderBottom: "1px solid #f5f5f5", backgroundColor: "#fafafa" }}>
                    {Object.entries(BEAT_MENU_COLORS).map(([colorKey, option]) => {
                      const beat = orderedItems.find(outlineItem => outlineItem.id === beatContextMenu.itemId);
                      const selected = (beat?.markerColor || "default") === colorKey;
                      return (
                        <div key={colorKey} onClick={() => { setBeatContextMenu(null); onColorItem(beatContextMenu.itemId, colorKey); }} style={{ padding: "5px 12px 5px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", backgroundColor: selected ? "#eef5ff" : "transparent" }}>
                          <span style={{ width: "11px", height: "11px", borderRadius: "50%", backgroundColor: option.swatch, border: `1px solid ${option.border}`, flexShrink: 0 }} />
                          <span style={{ flex: 1 }}>{option.label}</span>
                          {selected && <span style={{ color: "#607D8B", fontWeight: "bold" }}>Selected</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
		        </>
            )}
            <div onClick={() => { setBeatContextMenu(null); onDeleteItem?.(beatContextMenu.itemId); }} style={{ padding: "7px 12px", cursor: "pointer", color: "#c62828" }}>Delete Beat</div>
          </div>
        </>
      )}
    </div>
  );
}

function WritingTitlePagePreview({ settings, titlePageRef = null, showMoodOverlay = false }) {
  const safeSettings = normalizeTitlePageSettings(settings);
  const centeredLine = {
    textAlign: "center",
    whiteSpace: "pre-line",
    fontFamily: "'Courier Prime', Courier, 'Courier New', monospace",
    fontSize: "12pt",
    lineHeight: "12pt",
  };

  return (
    <div
      ref={titlePageRef}
      data-writing-title-page="true"
      contentEditable={false}
      style={{
        width: "8.5in",
        minHeight: "11in",
        backgroundColor: showMoodOverlay ? "transparent" : "white",
        boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
        border: "1px solid #d8dde3",
        boxSizing: "border-box",
        position: "relative",
        flexShrink: 0,
        marginBottom: "18px",
        color: "#000",
        pointerEvents: "auto",
        userSelect: "text",
      }}
    >
      <div style={{ position: "absolute", inset: "0", fontFamily: "'Courier Prime', Courier, 'Courier New', monospace" }}>
        <div style={{ position: "absolute", top: "2.95in", left: "1in", right: "1in", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.28in" }}>
          {safeSettings.title && <div style={centeredLine}>{safeSettings.title}</div>}
          {safeSettings.creditLabel && <div style={centeredLine}>{safeSettings.creditLabel}</div>}
          {safeSettings.writerName && <div style={centeredLine}>{safeSettings.writerName}</div>}
          {(safeSettings.revisionsLabel || safeSettings.revisionsText) && (
            <div style={{ ...centeredLine, marginTop: "0.35in" }}>
              {safeSettings.revisionsLabel}
              {safeSettings.revisionsLabel && safeSettings.revisionsText ? "\n\n" : ""}
              {safeSettings.revisionsText}
            </div>
          )}
          {(safeSettings.currentRevisionsLabel || safeSettings.currentRevisionsText) && (
            <div style={{ ...centeredLine, marginTop: "0.35in" }}>
              {safeSettings.currentRevisionsLabel}
              {safeSettings.currentRevisionsLabel && safeSettings.currentRevisionsText ? "\n\n" : ""}
              {safeSettings.currentRevisionsText}
            </div>
          )}
        </div>
        {safeSettings.contactBlock && (
          <div style={{ position: "absolute", left: "1.4in", bottom: "1.45in", whiteSpace: "pre-line", fontSize: "12pt", lineHeight: "12pt" }}>
            {safeSettings.contactBlock}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SceneList (copied from Script.js; writing-mode props only) ───────────────
function SceneList({ scenes, currentSceneNumber, sceneRefs, getSceneStatusColor, selectedProject, user, onSceneNumberChange, setCurrentIndex, showMoodOverlay, canCreateScene = false, onCreateFirstScene = null, canDeleteScene = false, onDeleteScene = null, onReorderScene = null, pageStatsBySceneId = null, onSceneColorChange = null, showTitlePage = false, onTitlePageClick = null }) {
  const { otherUsers } = usePresence(selectedProject?.id, user, "script", currentSceneNumber);
  const [dragState, setDragState] = useState({ draggedKey: null, overKey: null, position: "before" });
  const [sceneContextMenu, setSceneContextMenu] = useState(null);
  const listRef = useRef(null);
  const displayLabelMap = useMemo(() => buildSceneDisplayLabelMap(scenes), [scenes]);

	  useEffect(() => {
	    const idx = scenes.findIndex(s => s.sceneNumber === currentSceneNumber);
	    if (idx >= 0 && listRef.current) {
	      const item = listRef.current.children[idx + (showTitlePage ? 1 : 0)];
	      if (item) item.scrollIntoView({ block: "nearest" });
	    }
	  }, [currentSceneNumber, scenes, showTitlePage]);

  useEffect(() => {
    if (!sceneContextMenu) return;
    const close = () => setSceneContextMenu(null);
    const handleKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", handleKey); };
  }, [sceneContextMenu]);

  const getSceneDragKey = (scene, index) =>
    `${scene.id || scene.sceneId || scene.sceneNumber || "scene"}-${index}`;

  const getDropPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  };

  const getDropBorderStyle = (sceneKey, position) => {
    if (dragState.overKey !== sceneKey || dragState.position !== position) return undefined;
    return `2px solid ${APP_TAB_BLUE}`;
  };

  const scrollToScene = (index) => {
    setCurrentIndex(index);
    if (sceneRefs.current[index]) {
      sceneRefs.current[index].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

	  const titlePageRow = showTitlePage ? (
	    <div
	      key="writing-title-page-row"
	      onClick={onTitlePageClick}
	      style={{
	        padding: "8px 10px",
	        cursor: onTitlePageClick ? "pointer" : "default",
	        userSelect: "none",
	        borderBottom: "1px solid #d7dde2",
	        backgroundColor: currentSceneNumber === null ? APP_TAB_BLUE : (showMoodOverlay ? "rgba(232,240,254,0.32)" : "#e8f0fe"),
	        color: currentSceneNumber === null ? "white" : APP_TAB_BLUE,
	        display: "flex",
	        alignItems: "center",
	        justifyContent: "space-between",
	        gap: "8px",
	        fontWeight: "bold",
	      }}
	    >
	      <span>Title Page</span>
	      <span style={{ fontSize: "10px", color: currentSceneNumber === null ? "rgba(255,255,255,0.82)" : "#607D8B", fontWeight: 600 }}>Front Matter</span>
	    </div>
	  ) : null;

	  if (scenes.length === 0) {
	    return (
	      <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
	        <div style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: showMoodOverlay ? "rgba(255,255,255,0.15)" : "white", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden", padding: "18px", boxSizing: "border-box", color: "#555", lineHeight: 1.45 }}>
	          {titlePageRow}
	          <div style={{ fontWeight: "bold", fontSize: "14px", color: "#222", marginBottom: "8px" }}>No scenes yet</div>
	          <div style={{ marginBottom: "14px" }}>Create a starter scene to begin writing.</div>
          {canCreateScene && (
            <button type="button" onClick={onCreateFirstScene} style={{ padding: "8px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              New Script
            </button>
          )}
        </div>
      </div>
    );
  }

	  return (
	    <div style={{ marginLeft: "20px", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
	      <div ref={listRef} style={{ flex: 1, width: "492px", border: "2px inset #ccc", backgroundColor: showMoodOverlay ? "rgba(255,255,255,0.15)" : "white", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "12px", overflowY: "auto", overflowX: "hidden" }}>
	        {titlePageRow}
	        {scenes.map((scene, index) => {
          const sceneKey = getSceneDragKey(scene, index);
          const statusPresentation = getSceneStatusColor(scene.sceneNumber);
          const isCurrent = currentSceneNumber === scene.sceneNumber;
          const displayLabel = getSceneDisplayLabel(scene, displayLabelMap);
          let pageStats = pageStatsBySceneId?.[scene.id] || null;
          if (!pageStats) {
            try { pageStats = calculateScenePageStats(index, scenes, LINES_PER_PAGE); } catch {}
          }
          const rowPresentation = getSceneRowPresentation(scene, { status: statusPresentation.statusLabel, isCurrent, isDragging: dragState.draggedKey === sceneKey, displayLabel });
          const metadataColumns = getSceneMetadataColumns(scene, { displayLabel, pageStats });
          const statColor = rowPresentation.metadataTextColor;
          const sceneHeadingDisplayText = scene.metadata?.writingDraft
            ? String(scene.heading || "").toUpperCase()
            : scene.heading;

          return (
            <PresenceIndicator key={sceneKey} itemId={sceneKey} otherUsers={otherUsers} position="top">
              <div
                draggable={Boolean(onReorderScene)}
                onDragStart={(e) => { if (!onReorderScene) return; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", sceneKey); setDragState({ draggedKey: sceneKey, overKey: null, position: "before" }); }}
                onDragOver={(e) => { if (!onReorderScene) return; e.preventDefault(); const pos = getDropPosition(e); setDragState(prev => prev.overKey === sceneKey && prev.position === pos ? prev : { ...prev, overKey: sceneKey, position: pos }); }}
                onDrop={(e) => { if (!onReorderScene) return; e.preventDefault(); const draggedKey = dragState.draggedKey || e.dataTransfer.getData("text/plain"); const pos = getDropPosition(e); setDragState({ draggedKey: null, overKey: null, position: "before" }); onReorderScene(draggedKey, sceneKey, pos); }}
                onDragEnd={() => setDragState({ draggedKey: null, overKey: null, position: "before" })}
                onClick={() => scrollToScene(index)}
                onContextMenu={(e) => {
                  if (!onSceneColorChange) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setSceneContextMenu({ x: e.clientX, y: e.clientY, sceneIndex: index, currentColor: metadataColumns.customColor.colorKey ?? null });
                }}
                style={{ padding: "3px 8px", cursor: onReorderScene ? "grab" : "pointer", userSelect: "none", borderTop: getDropBorderStyle(sceneKey, "before"), borderBottom: getDropBorderStyle(sceneKey, "after") || "1px solid #f0f0f0", backgroundColor: showMoodOverlay && !isCurrent ? "transparent" : rowPresentation.rowBackgroundColor, color: rowPresentation.rowTextColor, display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "13px" }}>{displayLabel}</strong>
                  {" – "}{sceneHeadingDisplayText}
                </span>
                <span style={{ display: "grid", gridTemplateColumns: `${SCENE_METADATA_COLUMN_WIDTHS.customColor} ${SCENE_METADATA_COLUMN_WIDTHS.pageNumber} ${SCENE_METADATA_COLUMN_WIDTHS.pageLength}`, alignItems: "center", columnGap: "4px", flexShrink: 0 }}>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.customColor, textAlign: "center", lineHeight: 0 }}>
                    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: metadataColumns.customColor.hasCustomColor ? metadataColumns.customColor.swatch : "transparent", border: metadataColumns.customColor.hasCustomColor ? `1px solid ${isCurrent ? "rgba(255,255,255,0.7)" : metadataColumns.customColor.border}` : "1px solid transparent", visibility: metadataColumns.customColor.hasCustomColor ? "visible" : "hidden" }} />
                  </span>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.pageNumber, textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums", fontWeight: isCurrent ? "bold" : 600 }}>
                    {metadataColumns.pageNumber !== null ? `Pg ${metadataColumns.pageNumber}` : ""}
                  </span>
                  <span style={{ width: SCENE_METADATA_COLUMN_WIDTHS.pageLength, textAlign: "right", fontSize: "10px", color: statColor, fontVariantNumeric: "tabular-nums", fontWeight: isCurrent ? "bold" : 600 }}>
                    {metadataColumns.pageLength !== null ? metadataColumns.pageLength : ""}
                  </span>
                </span>
              </div>
            </PresenceIndicator>
          );
        })}
      </div>
      {sceneContextMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 2999 }} onMouseDown={() => setSceneContextMenu(null)} />
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: sceneContextMenu.x, top: sceneContextMenu.y, zIndex: 3000, backgroundColor: "white", border: "1px solid #bbb", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", minWidth: "142px", overflow: "hidden", padding: "4px", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", fontSize: "11px" }}
          >
            {Object.entries({ default: null, ...Object.fromEntries(Object.entries(SCENE_CUSTOM_COLORS).filter(([k]) => k !== "default").map(([k, v]) => [k, k])) }).map(([label, colorKey]) => {
              const color = SCENE_CUSTOM_COLORS[colorKey] || SCENE_CUSTOM_COLORS.default;
              const isSelected = (sceneContextMenu.currentColor ?? null) === (colorKey === "default" ? null : colorKey);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => { onSceneColorChange(sceneContextMenu.sceneIndex, colorKey === "default" ? null : colorKey); setSceneContextMenu(null); }}
                  style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", padding: "5px 7px", border: "none", borderRadius: "3px", backgroundColor: isSelected ? "#ECEFF1" : "transparent", color: "#222", textAlign: "left", fontSize: "11px", fontFamily: "inherit", cursor: "pointer" }}
                >
                  <span aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: color.swatch, border: `1px solid ${color.border}`, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{color.label}</span>
                  {isSelected && <span style={{ color: "#607D8B", fontWeight: "bold" }}>Selected</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const writingDraftSessionCache = new Map();

// ═══ WritingScript ════════════════════════════════════════════════════════════
function WritingScript({ selectedProject = null, user = null, userRole = null, previewMode = null, previewShell = false, onAlert = null }) {
  const isEditorPreview = previewMode === "editor";
  const isViewOnly = userRole === "viewer";

  // ─── State ──────────────────────────────────────────────────────────────────
  const [writingDraftNodes, setWritingDraftNodes] = useState(() => {
    if (!selectedProject) return [];
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    const cached = writingDraftSessionCache.get(projectId);
    return cached ? cached.nodes : [];
  });
  const [writingDraftSaveStatus, setWritingDraftSaveStatus] = useState("saved");
  const [writingScenePageStats, setWritingScenePageStats] = useState({});
  const [writingRenderedPageCount, setWritingRenderedPageCount] = useState(0);
  const [showWritingSceneNumbers, setShowWritingSceneNumbers] = useState(false);
  const [showWritingTimeline, setShowWritingTimeline] = useState(false);
  const [targetPageCount, setTargetPageCount] = useState(90);
  const [showMoodOverlay, setShowMoodOverlay] = useState(false);
  const [moodOverlaySettings, setMoodOverlaySettings] = useState(() => normalizeMoodOverlaySettings());
  const [moodOverlayOpacity, setMoodOverlayOpacity] = useState(() => normalizeMoodOverlaySettings().activeOpacity);
  const [forceMoodOverlayActiveOpacity, setForceMoodOverlayActiveOpacity] = useState(true);
  const [showMoodOverlaySettings, setShowMoodOverlaySettings] = useState(false);
  const [showMoodOverlayDetailSettings, setShowMoodOverlayDetailSettings] = useState(false);
  const [showShareScriptModal, setShowShareScriptModal] = useState(false);
  const [showShareWatermarkSettings, setShowShareWatermarkSettings] = useState(false);
  const [shareWatermarkLinkId, setShareWatermarkLinkId] = useState(null);
  const [scriptShareWatermarkDraft, setScriptShareWatermarkDraft] = useState(() => normalizeScriptShareWatermarkSettings());
  const [scriptShareLinks, setScriptShareLinks] = useState([]);
  const [scriptShareStatus, setScriptShareStatus] = useState("idle");
  const [scriptShareMessage, setScriptShareMessage] = useState("");
  const [titlePageSettings, setTitlePageSettings] = useState(() => normalizeTitlePageSettings());
  const [titlePageSettingsDraft, setTitlePageSettingsDraft] = useState(() => normalizeTitlePageSettings());
  const [showTitlePageSettings, setShowTitlePageSettings] = useState(false);
  const [titlePageSaveStatus, setTitlePageSaveStatus] = useState("saved");
  const [scriptMoodboardImages, setScriptMoodboardImages] = useState([]);
  const [beats, setBeats] = useState([]);
  const [activeSidePanelTab, setActiveSidePanelTab] = useState("scenes");
  const [showBeatsTrack, setShowBeatsTrack] = useState(false);
  const [beatTrackZoom, setBeatTrackZoom] = useState(1);
  const [sceneTimelineZoom, setSceneTimelineZoom] = useState(1);
  const [showBeatImportDialog, setShowBeatImportDialog] = useState(false);
  const [beatImportText, setBeatImportText] = useState("");
  const [beatImportDraft, setBeatImportDraft] = useState(null);
  const [selectedBeatDetailId, setSelectedBeatDetailId] = useState(null);
  const [collapsedActIds, setCollapsedActIds] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSceneNumber, setCurrentSceneNumber] = useState(null);
  const [writingEditorElementType, setWritingEditorElementType] = useState("");
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(false);
  const [showSpellcheckModal, setShowSpellcheckModal] = useState(false);
  const [spellcheckIndex, setSpellcheckIndex] = useState(0);
  const [spellcheckReplacement, setSpellcheckReplacement] = useState("");
  const [spellcheckIgnoredWords, setSpellcheckIgnoredWords] = useState(() => new Set());
  const [spellcheckDictionaryWords, setSpellcheckDictionaryWords] = useState(() => new Set());
  const [userSpellcheckDictionaryWords, setUserSpellcheckDictionaryWords] = useState(() => new Set());
  const [legacyProjectSpellcheckDictionaryWords, setLegacyProjectSpellcheckDictionaryWords] = useState(() => new Set());
  const [spellcheckDictionarySaveStatus, setSpellcheckDictionarySaveStatus] = useState("saved");
  const [spellchecker, setSpellchecker] = useState(null);
  const [spellcheckerReloadKey, setSpellcheckerReloadKey] = useState(0);
  const [spellcheckerStatus, setSpellcheckerStatus] = useState("loading");
  const [spellcheckerError, setSpellcheckerError] = useState("");
  const [spellcheckModalPosition, setSpellcheckModalPosition] = useState(null);
  const [spellcheckModalDrag, setSpellcheckModalDrag] = useState(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [showUserDictionaryPanel, setShowUserDictionaryPanel] = useState(false);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, strike: false, highlight: false });
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [highlightMenuRect, setHighlightMenuRect] = useState(null);
  const highlightColors = [
    { label: "Yellow", value: "#fff59d" },
    { label: "Green", value: "#c8e6c9" },
    { label: "Blue", value: "#bbdefb" },
    { label: "Pink", value: "#f8bbd0" },
  ];
  const normalizeToolbarHighlightColor = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "transparent" || raw === "rgba(0, 0, 0, 0)" || raw === "rgba(0,0,0,0)") return false;
    const compact = raw.replace(/\s+/g, "");
    const knownColors = {
      "#ffff00": "#ffff00",
      "#fff59d": "#fff59d",
      "#c8e6c9": "#c8e6c9",
      "#bbdefb": "#bbdefb",
      "#f8bbd0": "#f8bbd0",
      "rgb(255,255,0)": "#ffff00",
      "rgb(255,245,157)": "#fff59d",
      "rgb(200,230,201)": "#c8e6c9",
      "rgb(187,222,251)": "#bbdefb",
      "rgb(248,187,208)": "#f8bbd0",
    };
    return knownColors[compact] || raw;
  };

  useEffect(() => {
    let cancelled = false;

    const loadSpellchecker = async () => {
      try {
        setSpellcheckerStatus("loading");
        setSpellcheckerError("");
        const [affResponse, dicResponse] = await Promise.all([
          fetch(englishAffUrl),
          fetch(englishDicUrl),
        ]);

        if (!affResponse.ok || !dicResponse.ok) {
          throw new Error("Unable to load bundled English dictionary files.");
        }

        const [aff, dic] = await Promise.all([
          affResponse.text(),
          dicResponse.text(),
        ]);
        const nextSpellchecker = nspell(aff, dic);
        spellcheckDictionaryWords.forEach(word => {
          if (word) nextSpellchecker.add(word);
        });

        if (!cancelled) {
          setSpellchecker(nextSpellchecker);
          setSpellcheckerStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setSpellchecker(null);
          setSpellcheckerStatus("fallback");
          setSpellcheckerError(error?.message || "Unable to initialize English spellcheck dictionary.");
        }
      }
    };

    loadSpellchecker();
    return () => {
      cancelled = true;
    };
  }, [spellcheckerReloadKey]);

  useEffect(() => {
    if (!spellchecker) return;
    spellcheckDictionaryWords.forEach(word => {
      if (word) spellchecker.add(word);
    });
  }, [spellchecker, spellcheckDictionaryWords]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProject) {
      setSpellcheckDictionaryWords(new Set());
      setUserSpellcheckDictionaryWords(new Set());
      setLegacyProjectSpellcheckDictionaryWords(new Set());
      setSpellcheckDictionarySaveStatus("saved");
      return;
    }

    loadWritingDictionaryWordsAsync(selectedProject).then((result) => {
      if (cancelled) return;
      setSpellcheckDictionaryWords(new Set(result.words || []));
      setUserSpellcheckDictionaryWords(new Set(result.userWords || []));
      setLegacyProjectSpellcheckDictionaryWords(new Set(result.projectWords || []));
      setSpellcheckDictionarySaveStatus(result.storage === "localStorage" ? "local" : "saved");
    }).catch(() => {
      if (cancelled) return;
      setSpellcheckDictionaryWords(new Set());
      setUserSpellcheckDictionaryWords(new Set());
      setLegacyProjectSpellcheckDictionaryWords(new Set());
      setSpellcheckDictionarySaveStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const currentFormats = writingEditorRef.current?.getActiveInlineFormats?.();
      const nextFormats = currentFormats
          ? {
              bold: Boolean(currentFormats.bold),
              italic: Boolean(currentFormats.italic),
              underline: Boolean(currentFormats.underline),
              strike: Boolean(currentFormats.strike),
              highlight: normalizeToolbarHighlightColor(currentFormats.highlight),
            }
        : { bold: false, italic: false, underline: false, strike: false, highlight: false };

      setActiveFormats(prev => (
        prev.bold === nextFormats.bold &&
        prev.italic === nextFormats.italic &&
        prev.underline === nextFormats.underline &&
        prev.strike === nextFormats.strike &&
        prev.highlight === nextFormats.highlight
          ? prev
          : nextFormats
      ));
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useEffect(() => {
    if (!showHighlightMenu) return;
    const close = () => setShowHighlightMenu(false);
    const handleKey = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", handleKey);
    };
  }, [showHighlightMenu]);

  useEffect(() => {
    if (!showMoodOverlaySettings && !showMoodOverlayDetailSettings && !showTitlePageSettings && !showShareScriptModal && !showShareWatermarkSettings) return;
    const handleKey = (event) => {
      if (event.key !== "Escape") return;
      if (showShareWatermarkSettings) {
        setShowShareWatermarkSettings(false);
      } else if (showShareScriptModal) {
        setShowShareScriptModal(false);
      } else if (showTitlePageSettings) {
        setShowTitlePageSettings(false);
      } else if (showMoodOverlayDetailSettings) {
        setShowMoodOverlayDetailSettings(false);
      } else if (showMoodOverlaySettings) {
        setShowMoodOverlaySettings(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showMoodOverlaySettings, showMoodOverlayDetailSettings, showTitlePageSettings, showShareScriptModal, showShareWatermarkSettings]);

  const clampSpellcheckModalPosition = useCallback((position, modalRect = null) => {
    const width = modalRect?.width || spellcheckModalRef.current?.offsetWidth || 520;
    const height = modalRect?.height || spellcheckModalRef.current?.offsetHeight || 360;
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);

    return {
      x: Math.min(Math.max(position?.x ?? margin, margin), maxX),
      y: Math.min(Math.max(position?.y ?? margin, margin), maxY),
    };
  }, []);

  useEffect(() => {
    if (!showSpellcheckModal) {
      writingEditorRef.current?.setActiveSpellcheckRange?.(null);
      setSpellcheckModalDrag(null);
      return;
    }

    requestAnimationFrame(() => {
      const rect = spellcheckModalRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSpellcheckModalPosition(prev => clampSpellcheckModalPosition(prev || {
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2,
      }, rect));
    });
  }, [clampSpellcheckModalPosition, showSpellcheckModal]);

  useEffect(() => {
    const handleResize = () => {
      setSpellcheckModalPosition(prev => (prev ? clampSpellcheckModalPosition(prev) : prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampSpellcheckModalPosition]);

  useEffect(() => {
    if (!spellcheckModalDrag) return;

    const handleMove = (event) => {
      setSpellcheckModalPosition(clampSpellcheckModalPosition({
        x: spellcheckModalDrag.originX + (event.clientX - spellcheckModalDrag.startX),
        y: spellcheckModalDrag.originY + (event.clientY - spellcheckModalDrag.startY),
      }));
    };
    const handleUp = () => setSpellcheckModalDrag(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [clampSpellcheckModalPosition, spellcheckModalDrag]);

  const sceneRefs = useRef([]);
  const titlePageRef = useRef(null);
  const writingEditorRef = useRef(null);
  const spellcheckModalRef = useRef(null);
  const writingDraftSaveTimerRef = useRef(null);
  const lastWritingDraftPayloadRef = useRef("");
  const lastWritingDraftSaveErrorPayloadRef = useRef("");
  const lastWritingDraftIndexedDbWarningPayloadRef = useRef("");
  const writingDraftSaveSequenceRef = useRef(0);
  const skipNextBeatPersistRef = useRef(false);
  const skipNextTabPersistRef = useRef(false);
  const skipNextCollapsedActsPersistRef = useRef(false);
  const skipNextTimelineSettingsPersistRef = useRef(false);
  const skipNextMoodOverlayPersistRef = useRef(false);
  const moodOverlayActivityTimeRef = useRef(Date.now());
  const moodOverlayTimerRef = useRef(null);
  const moodOverlayGenerationRef = useRef(0);
  const moodOverlayResetFrameRef = useRef(null);
  const editorScrollRef = useRef(null);
  const writingImportInputRef = useRef(null);
  const editorScrollSaveTimerRef = useRef(null);
  const sceneScrollFrameRef = useRef(null);
  const hasRestoredEditorPositionRef = useRef(false);

  // ─── Storage keys ────────────────────────────────────────────────────────────
  const getProjectStorageKey = useCallback((key) => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `${key}:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getLegacyScriptStorageKey = useCallback((key) => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `${key}:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getBeatsStorageKey = useCallback(() => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `writingScriptBeats:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getLegacyBeatsStorageKey = useCallback(() => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `scriptBeats:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  const getEditorPositionStorageKey = useCallback(() => {
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    return `writingScriptEditorPosition:${projectId}`;
  }, [selectedProject?.id, selectedProject?.name]);

  // ─── Load writing draft ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!selectedProject) {
      setWritingDraftNodes([]);
      setWritingDraftSaveStatus("saved");
      lastWritingDraftPayloadRef.current = "";
      lastWritingDraftSaveErrorPayloadRef.current = "";
      lastWritingDraftIndexedDbWarningPayloadRef.current = "";
      return;
    }

    // If cache exists, writingDraftNodes was already initialized synchronously in useState().
    // Just sync the refs — no state update needed, no DB round-trip.
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    const cached = writingDraftSessionCache.get(projectId);
    if (cached) {
      lastWritingDraftPayloadRef.current = cached.payload;
      lastWritingDraftSaveErrorPayloadRef.current = "";
      lastWritingDraftIndexedDbWarningPayloadRef.current = "";
      setWritingDraftSaveStatus("saved");
      return;
    }

    const loadStartTime = Date.now();
    (async () => {
      try {
        const draft = await loadWritingDraftAsync(selectedProject);
        if (cancelled) return;

        // Don't overwrite user edits that arrived while the DB was loading
        const liveCache = writingDraftSessionCache.get(projectId);
        if (liveCache?.updatedAt > loadStartTime) return;

        const savedNodes = draft.hasUserCreatedScript && Array.isArray(draft.nodes)
          ? draft.nodes
          : [];
        const savedPayload = JSON.stringify(savedNodes);

        if (savedNodes.length) {
          setWritingDraftNodes(savedNodes);
          lastWritingDraftPayloadRef.current = savedPayload;
          lastWritingDraftSaveErrorPayloadRef.current = "";
          lastWritingDraftIndexedDbWarningPayloadRef.current = "";
          setWritingDraftSaveStatus(draft.storage === "database" ? "saved" : "local");
          writingDraftSessionCache.set(projectId, { nodes: savedNodes, payload: savedPayload, updatedAt: loadStartTime });
          return;
        }

        const emptyPayload = JSON.stringify([]);
        setWritingDraftNodes([]);
        lastWritingDraftPayloadRef.current = emptyPayload;
        lastWritingDraftSaveErrorPayloadRef.current = "";
        lastWritingDraftIndexedDbWarningPayloadRef.current = "";
        setWritingDraftSaveStatus("saved");
        writingDraftSessionCache.set(projectId, { nodes: [], payload: emptyPayload, updatedAt: loadStartTime });
      } catch (err) {
        if (cancelled) return;
        console.warn("Could not load writing draft:", err);
        setWritingDraftNodes([]);
        lastWritingDraftPayloadRef.current = JSON.stringify([]);
        lastWritingDraftSaveErrorPayloadRef.current = "";
        lastWritingDraftIndexedDbWarningPayloadRef.current = "";
        setWritingDraftSaveStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
	  }, [selectedProject]);

  const refreshScriptShareLinks = useCallback(async () => {
    if (!selectedProject?.id) {
      setScriptShareLinks([]);
      return [];
    }

    setScriptShareStatus("loading");
    setScriptShareMessage("");
    try {
      const links = await listScriptShareLinks(selectedProject.id);
      setScriptShareLinks(Array.isArray(links) ? links : []);
      setScriptShareStatus("idle");
      return links || [];
    } catch (error) {
      console.error("Could not load script share links:", error);
      setScriptShareStatus("error");
      setScriptShareMessage(error.message || "Could not load share links.");
      return [];
    }
  }, [selectedProject?.id]);

  const openShareScriptModal = useCallback(() => {
    setShowShareScriptModal(true);
    refreshScriptShareLinks();
  }, [refreshScriptShareLinks]);

  const handleCreateScriptShareLink = useCallback(async () => {
    if (!selectedProject?.id) return;
    setScriptShareStatus("saving");
    setScriptShareMessage("");
    try {
      const link = await createScriptShareLink(selectedProject.id);
      setScriptShareLinks(prev => [link, ...prev]);
      setScriptShareStatus("idle");
      setScriptShareMessage("Share link created.");
    } catch (error) {
      console.error("Could not create script share link:", error);
      setScriptShareStatus("error");
      setScriptShareMessage(error.message || "Could not create share link.");
    }
  }, [selectedProject?.id]);

  const handleRevokeScriptShareLink = useCallback(async (linkId) => {
    if (!linkId) return;
    setScriptShareStatus("saving");
    setScriptShareMessage("");
    try {
      const revoked = await revokeScriptShareLink(linkId);
      setScriptShareLinks(prev => prev.map(link => link.id === linkId ? revoked : link));
      setScriptShareStatus("idle");
      setScriptShareMessage("Share link revoked.");
    } catch (error) {
      console.error("Could not revoke script share link:", error);
      setScriptShareStatus("error");
      setScriptShareMessage(error.message || "Could not revoke share link.");
    }
  }, []);

  const copyScriptShareLink = useCallback(async (token) => {
    if (!token) return;
    const shareUrl = `${window.location.origin}/share/script/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setScriptShareMessage("Link copied.");
    } catch (error) {
      console.error("Could not copy script share link:", error);
      setScriptShareMessage(shareUrl);
    }
  }, []);

  const saveScriptShareLinkLabel = useCallback(async (link, nextLabel) => {
    if (!link?.id) return;
    const safeLabel = String(nextLabel || "").trim().slice(0, 160);
    const currentLabel = String(link.label || "").trim();
    if (safeLabel === currentLabel) return;

    setScriptShareStatus("saving");
    setScriptShareMessage("");
    try {
      const updated = await updateScriptShareLinkLabel(link.id, safeLabel);
      setScriptShareLinks(prev => prev.map(existing => existing.id === link.id ? updated : existing));
      setScriptShareStatus("idle");
      setScriptShareMessage(safeLabel ? "Link label saved." : "Link label cleared.");
    } catch (error) {
      console.error("Could not save script share link label:", error);
      setScriptShareStatus("error");
      setScriptShareMessage(error.message || "Could not save link label.");
    }
  }, []);

  const openShareWatermarkSettings = useCallback((link) => {
    const hasSavedSettings = link?.watermark_settings && typeof link.watermark_settings === "object";
    const nextDraft = normalizeScriptShareWatermarkSettings(link?.watermark_settings);
    if (!hasSavedSettings || !String(nextDraft.text || "").trim()) {
      nextDraft.text = String(selectedProject?.name || "").slice(0, 120);
    }
    setScriptShareWatermarkDraft(nextDraft);
    setShareWatermarkLinkId(link?.id || null);
    setShowShareWatermarkSettings(true);
    setScriptShareMessage("");
  }, [selectedProject?.name]);

  const updateShareWatermarkDraft = useCallback((patch) => {
    setScriptShareWatermarkDraft(prev => normalizeScriptShareWatermarkSettings({
      ...prev,
      ...patch,
    }));
  }, []);

  const saveShareWatermarkSettings = useCallback(async (linkId) => {
    if (!linkId) return;
    const safeSettings = normalizeScriptShareWatermarkSettings(scriptShareWatermarkDraft);
    setScriptShareStatus("saving");
    setScriptShareMessage("");
    try {
      const updated = await updateScriptShareWatermarkSettings(linkId, safeSettings);
      setScriptShareLinks(prev => prev.map(link => link.id === linkId ? updated : link));
      setScriptShareStatus("idle");
      setScriptShareMessage("Watermark settings saved.");
      setShowShareWatermarkSettings(false);
      setShareWatermarkLinkId(null);
    } catch (error) {
      console.error("Could not save script share watermark settings:", error);
      setScriptShareStatus("error");
      setScriptShareMessage(error.message || "Could not save watermark settings.");
    }
  }, [scriptShareWatermarkDraft]);

  useEffect(() => () => { clearTimeout(writingDraftSaveTimerRef.current); }, []);

  const saveEditorPositionNow = useCallback(() => {
    if (!selectedProject) return;
    const scrollEl = editorScrollRef.current;
    if (!scrollEl) return;

    try {
      localStorage.setItem(getEditorPositionStorageKey(), JSON.stringify({
        scrollTop: scrollEl.scrollTop || 0,
        updatedAt: new Date().toISOString(),
      }));
    } catch {}
  }, [getEditorPositionStorageKey, selectedProject]);

  const updateCurrentSceneFromEditorScroll = useCallback(() => {
    const scrollEl = editorScrollRef.current;
    const sceneElements = sceneRefs.current || [];
    if (!scrollEl || sceneElements.length === 0) return;

    const containerRect = scrollEl.getBoundingClientRect();
    const activationTop = containerRect.top + 28;
    let activeIndex = -1;
    let firstVisibleIndex = -1;

    sceneElements.forEach((element, index) => {
      if (!element || typeof element.getBoundingClientRect !== "function") return;

      const rect = element.getBoundingClientRect();
      const isVisible = rect.bottom >= containerRect.top && rect.top <= containerRect.bottom;
      if (isVisible && firstVisibleIndex === -1) firstVisibleIndex = index;
      if (rect.top <= activationTop) activeIndex = index;
    });

    const nextIndex = activeIndex >= 0 ? activeIndex : firstVisibleIndex;
    if (nextIndex >= 0) {
      setCurrentIndex(prevIndex => (prevIndex === nextIndex ? prevIndex : nextIndex));
    }
  }, []);

  const scheduleCurrentSceneFromEditorScroll = useCallback(() => {
    if (sceneScrollFrameRef.current) return;

    sceneScrollFrameRef.current = requestAnimationFrame(() => {
      sceneScrollFrameRef.current = null;
      updateCurrentSceneFromEditorScroll();
    });
  }, [updateCurrentSceneFromEditorScroll]);

  const handleEditorScroll = useCallback(() => {
    if (!selectedProject) return;
    scheduleCurrentSceneFromEditorScroll();
    clearTimeout(editorScrollSaveTimerRef.current);
    editorScrollSaveTimerRef.current = setTimeout(saveEditorPositionNow, 150);
  }, [saveEditorPositionNow, scheduleCurrentSceneFromEditorScroll, selectedProject]);

  useEffect(() => {
    hasRestoredEditorPositionRef.current = false;
    clearTimeout(editorScrollSaveTimerRef.current);
    if (sceneScrollFrameRef.current) {
      cancelAnimationFrame(sceneScrollFrameRef.current);
      sceneScrollFrameRef.current = null;
    }
  }, [selectedProject?.id, selectedProject?.name]);

  useEffect(() => {
    if (!selectedProject || hasRestoredEditorPositionRef.current || writingDraftNodes.length === 0) return;
    const scrollEl = editorScrollRef.current;
    if (!scrollEl) return;

    let restoreTimer = null;
    const restoreFrame = requestAnimationFrame(() => {
      restoreTimer = setTimeout(() => {
        try {
          const parsed = JSON.parse(localStorage.getItem(getEditorPositionStorageKey()) || "{}");
          const savedScrollTop = Number(parsed.scrollTop);
          if (!Number.isFinite(savedScrollTop) || savedScrollTop <= 0) {
            hasRestoredEditorPositionRef.current = true;
            return;
          }

          const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
          scrollEl.scrollTop = Math.min(Math.max(0, savedScrollTop), maxScrollTop);
          hasRestoredEditorPositionRef.current = true;
          requestAnimationFrame(updateCurrentSceneFromEditorScroll);
        } catch {
          hasRestoredEditorPositionRef.current = true;
        }
      }, 50);
    });

    return () => {
      cancelAnimationFrame(restoreFrame);
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, [
    getEditorPositionStorageKey,
    selectedProject,
    selectedProject?.id,
    selectedProject?.name,
    updateCurrentSceneFromEditorScroll,
    writingDraftNodes.length,
  ]);

  useEffect(() => {
    return () => {
      clearTimeout(editorScrollSaveTimerRef.current);
      if (sceneScrollFrameRef.current) cancelAnimationFrame(sceneScrollFrameRef.current);
      saveEditorPositionNow();
    };
  }, [saveEditorPositionNow]);

  // ─── Load/save beats ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    try {
      const storageKey = getBeatsStorageKey();
      const legacyStorageKey = getLegacyBeatsStorageKey();

      const parseStoredBeats = (rawValue) => {
        if (!rawValue) return null;
        try {
          const parsed = JSON.parse(rawValue);
          if (!Array.isArray(parsed)) return null;
          const normalizedBeats = normalizeOutlineItems(parsed);
          return {
            normalizedBeats,
            hasBeats: normalizedBeats.length > 0,
          };
        } catch {
          return null;
        }
      };

      const storedBeats = parseStoredBeats(localStorage.getItem(storageKey));
      const legacyBeats = parseStoredBeats(localStorage.getItem(legacyStorageKey));
      const selectedBeats =
        storedBeats?.hasBeats ? storedBeats :
        legacyBeats?.hasBeats ? legacyBeats :
        storedBeats || legacyBeats || { normalizedBeats: [] };

      if (!storedBeats?.hasBeats && legacyBeats?.hasBeats) {
        localStorage.setItem(storageKey, JSON.stringify(legacyBeats.normalizedBeats));
      }

      skipNextBeatPersistRef.current = true;
      setBeats(selectedBeats.normalizedBeats);
    } catch (err) {
      console.warn("Could not load beats:", err);
      skipNextBeatPersistRef.current = true;
      setBeats([]);
    }
  }, [selectedProject?.id, selectedProject?.name, getBeatsStorageKey, getLegacyBeatsStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextBeatPersistRef.current) { skipNextBeatPersistRef.current = false; return; }
    try { localStorage.setItem(getBeatsStorageKey(), JSON.stringify(beats)); } catch (err) { console.warn("Could not persist beats:", err); }
  }, [beats, selectedProject?.id, selectedProject?.name, getBeatsStorageKey]);

  // ─── Load/save active tab ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const storageKey = getProjectStorageKey("writingScriptSidePanelTab");
    const legacyStorageKey = getLegacyScriptStorageKey("scriptSidePanelTab");
    const storedTab = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
    const safeTab = storedTab === "beats" ? "beats" : "scenes";
    if (!localStorage.getItem(storageKey) && storedTab) {
      localStorage.setItem(storageKey, safeTab);
    }
    skipNextTabPersistRef.current = true;
    setActiveSidePanelTab(safeTab);
  }, [selectedProject?.id, selectedProject?.name, getLegacyScriptStorageKey, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextTabPersistRef.current) { skipNextTabPersistRef.current = false; return; }
    localStorage.setItem(getProjectStorageKey("writingScriptSidePanelTab"), activeSidePanelTab === "beats" ? "beats" : "scenes");
  }, [activeSidePanelTab, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Load/save collapsed acts ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    try {
      const storageKey = getProjectStorageKey("writingScriptCollapsedActs");
      const legacyStorageKey = getLegacyScriptStorageKey("scriptCollapsedActs");
      const rawCollapsedActs = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}";
      const stored = JSON.parse(rawCollapsedActs);
      const safeCollapsedActs = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      if (!localStorage.getItem(storageKey) && rawCollapsedActs !== "{}") {
        localStorage.setItem(storageKey, JSON.stringify(safeCollapsedActs));
      }
      skipNextCollapsedActsPersistRef.current = true;
      setCollapsedActIds(safeCollapsedActs);
    } catch (err) {
      skipNextCollapsedActsPersistRef.current = true;
      setCollapsedActIds({});
    }
  }, [selectedProject?.id, selectedProject?.name, getLegacyScriptStorageKey, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextCollapsedActsPersistRef.current) { skipNextCollapsedActsPersistRef.current = false; return; }
    try { localStorage.setItem(getProjectStorageKey("writingScriptCollapsedActs"), JSON.stringify(collapsedActIds)); } catch {}
  }, [collapsedActIds, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Load/save Writing timeline display settings ────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const clampZoom = (value, min, max, fallback) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(getProjectStorageKey("writingScriptTimelineSettings")) || "{}");
      skipNextTimelineSettingsPersistRef.current = true;
      setShowWritingTimeline(typeof parsed.showSceneTrack === "boolean" ? parsed.showSceneTrack : false);
      setShowBeatsTrack(typeof parsed.showBeatsTrack === "boolean" ? parsed.showBeatsTrack : false);
      setShowWritingSceneNumbers(typeof parsed.showWritingSceneNumbers === "boolean" ? parsed.showWritingSceneNumbers : false);
      setBeatTrackZoom(clampZoom(parsed.beatTrackZoom, 1, 3, 1));
      setSceneTimelineZoom(clampZoom(parsed.sceneTimelineZoom, 1, 6, 1));
    } catch {
      skipNextTimelineSettingsPersistRef.current = true;
      setShowWritingTimeline(false);
      setShowBeatsTrack(false);
      setShowWritingSceneNumbers(false);
      setBeatTrackZoom(1);
      setSceneTimelineZoom(1);
    }
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    if (skipNextTimelineSettingsPersistRef.current) { skipNextTimelineSettingsPersistRef.current = false; return; }
    const clampZoom = (value, min, max, fallback) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
    };
    try {
      localStorage.setItem(getProjectStorageKey("writingScriptTimelineSettings"), JSON.stringify({
        showSceneTrack: Boolean(showWritingTimeline),
        showBeatsTrack: Boolean(showBeatsTrack),
        showWritingSceneNumbers: Boolean(showWritingSceneNumbers),
        beatTrackZoom: clampZoom(beatTrackZoom, 1, 3, 1),
        sceneTimelineZoom: clampZoom(sceneTimelineZoom, 1, 6, 1),
      }));
    } catch {}
  }, [
    beatTrackZoom,
    sceneTimelineZoom,
    selectedProject?.id,
    selectedProject?.name,
    showBeatsTrack,
    showWritingSceneNumbers,
    showWritingTimeline,
    getProjectStorageKey,
  ]);

  // ─── Load/save Writing mood overlay settings ────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;

    try {
      const storageKey = getProjectStorageKey("writingScriptMoodOverlay");
      const rawStoredOverlay = localStorage.getItem(storageKey);

      if (rawStoredOverlay) {
        const parsed = JSON.parse(rawStoredOverlay);
        skipNextMoodOverlayPersistRef.current = true;
        setShowMoodOverlay(typeof parsed.visible === "boolean" ? parsed.visible : false);
        setMoodOverlaySettings(normalizeMoodOverlaySettings(parsed.settings));
        return;
      }

      const legacyVisible = localStorage.getItem("scriptMoodOverlayEnabled") === "true";
      let legacySettings = normalizeMoodOverlaySettings();
      try {
        legacySettings = normalizeMoodOverlaySettings(JSON.parse(localStorage.getItem("scriptMoodOverlaySettings") || "{}"));
      } catch {
        legacySettings = normalizeMoodOverlaySettings();
      }

      const migratedOverlay = { visible: legacyVisible, settings: legacySettings };
      localStorage.setItem(storageKey, JSON.stringify(migratedOverlay));
      skipNextMoodOverlayPersistRef.current = true;
      setShowMoodOverlay(migratedOverlay.visible);
      setMoodOverlaySettings(migratedOverlay.settings);
    } catch {
      skipNextMoodOverlayPersistRef.current = true;
      setShowMoodOverlay(false);
      setMoodOverlaySettings(normalizeMoodOverlaySettings());
    }
  }, [selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

	  useEffect(() => {
	    if (!selectedProject) return;
	    if (skipNextMoodOverlayPersistRef.current) { skipNextMoodOverlayPersistRef.current = false; return; }

    const safeSettings = normalizeMoodOverlaySettings(moodOverlaySettings);

    try {
      localStorage.setItem(getProjectStorageKey("writingScriptMoodOverlay"), JSON.stringify({
        visible: Boolean(showMoodOverlay),
        settings: safeSettings,
      }));
    } catch {}
  }, [
    getProjectStorageKey,
    moodOverlaySettings,
    selectedProject,
	    showMoodOverlay,
	  ]);

	  const resetMoodOverlayToActiveOpacity = useCallback((settings = moodOverlaySettings) => {
	    const activeOpacity = normalizeMoodOverlaySettings(settings).activeOpacity;
	    moodOverlayActivityTimeRef.current = Date.now();
	    if (moodOverlayResetFrameRef.current) {
	      cancelAnimationFrame(moodOverlayResetFrameRef.current);
	      moodOverlayResetFrameRef.current = null;
	    }
	    setForceMoodOverlayActiveOpacity(true);
	    setMoodOverlayOpacity(prev => Math.abs(prev - activeOpacity) < 0.001 ? prev : activeOpacity);
	    moodOverlayResetFrameRef.current = requestAnimationFrame(() => {
	      moodOverlayResetFrameRef.current = requestAnimationFrame(() => {
	        moodOverlayResetFrameRef.current = null;
	        setForceMoodOverlayActiveOpacity(false);
	      });
	    });
	  }, [moodOverlaySettings.activeOpacity, moodOverlaySettings.opacity]);

  const registerMoodOverlayActivity = useCallback(() => {
    if (!showMoodOverlay) return;
    resetMoodOverlayToActiveOpacity();
  }, [resetMoodOverlayToActiveOpacity, showMoodOverlay]);

  useLayoutEffect(() => {
    if (!showMoodOverlay) return;
    resetMoodOverlayToActiveOpacity();
  }, [
    moodOverlaySettings.activeOpacity,
    moodOverlaySettings.opacity,
    selectedProject?.id,
    selectedProject?.name,
    resetMoodOverlayToActiveOpacity,
    showMoodOverlay,
  ]);

	  useEffect(() => {
	    const safeSettings = normalizeMoodOverlaySettings(moodOverlaySettings);
	    if (!showMoodOverlay || scriptMoodboardImages.length === 0) {
	      moodOverlayGenerationRef.current += 1;
	      if (moodOverlayResetFrameRef.current) {
	        cancelAnimationFrame(moodOverlayResetFrameRef.current);
	        moodOverlayResetFrameRef.current = null;
	      }
	      if (moodOverlayTimerRef.current) {
	        clearInterval(moodOverlayTimerRef.current);
	        moodOverlayTimerRef.current = null;
	      }
	      setMoodOverlayOpacity(safeSettings.activeOpacity);
	      setForceMoodOverlayActiveOpacity(true);
	      return undefined;
	    }

    const generation = moodOverlayGenerationRef.current;
    moodOverlayActivityTimeRef.current = Date.now();
    setMoodOverlayOpacity(safeSettings.activeOpacity);

    const updateOpacity = () => {
      if (generation !== moodOverlayGenerationRef.current) return;
      const now = Date.now();
      const delayMs = safeSettings.inactivityDelaySeconds * 1000;
      const fadeMs = Math.max(1000, safeSettings.fadeDurationSeconds * 1000);
      const elapsedAfterDelay = now - moodOverlayActivityTimeRef.current - delayMs;
      const progress = Math.min(1, Math.max(0, elapsedAfterDelay / fadeMs));
      const nextOpacity = safeSettings.activeOpacity + ((safeSettings.maxOpacity - safeSettings.activeOpacity) * progress);

      setMoodOverlayOpacity(prev => Math.abs(prev - nextOpacity) < 0.002 ? prev : nextOpacity);
    };

    updateOpacity();
    if (generation !== moodOverlayGenerationRef.current) return undefined;
	    moodOverlayTimerRef.current = setInterval(updateOpacity, 250);
	    return () => {
	      moodOverlayGenerationRef.current += 1;
	      if (moodOverlayResetFrameRef.current) {
	        cancelAnimationFrame(moodOverlayResetFrameRef.current);
	        moodOverlayResetFrameRef.current = null;
	      }
	      if (moodOverlayTimerRef.current) {
	        clearInterval(moodOverlayTimerRef.current);
	        moodOverlayTimerRef.current = null;
      }
    };
  }, [
    moodOverlaySettings.activeOpacity,
    moodOverlaySettings.fadeDurationSeconds,
    moodOverlaySettings.inactivityDelaySeconds,
    moodOverlaySettings.maxOpacity,
    moodOverlaySettings.opacity,
    scriptMoodboardImages.length,
    showMoodOverlay,
  ]);

  useEffect(() => {
    if (!showMoodOverlay) return undefined;

    const handleActivity = () => registerMoodOverlayActivity();
    const activityEvents = ["keydown", "pointerdown", "input", "paste"];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, true);
    });
    document.addEventListener("selectionchange", handleActivity, true);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity, true);
      });
      document.removeEventListener("selectionchange", handleActivity, true);
    };
  }, [registerMoodOverlayActivity, showMoodOverlay]);

	  useEffect(() => {
	    let cancelled = false;
	    if (!selectedProject) {
	      const defaults = normalizeTitlePageSettings();
	      setTitlePageSettings(defaults);
	      setTitlePageSettingsDraft(defaults);
	      setTitlePageSaveStatus("saved");
	      return;
	    }

	    loadWritingTitlePageSettingsAsync(selectedProject).then((result) => {
	      if (cancelled) return;
	      const nextSettings = normalizeTitlePageSettings(result.settings || {});
	      setTitlePageSettings(nextSettings);
	      setTitlePageSettingsDraft(nextSettings);
	      setTitlePageSaveStatus(result.storage === "localStorage" ? "local" : "saved");
	    }).catch((error) => {
	      if (cancelled) return;
	      console.error("Could not load Writing title page settings:", error);
	      const defaults = normalizeTitlePageSettings();
	      setTitlePageSettings(defaults);
	      setTitlePageSettingsDraft(defaults);
	      setTitlePageSaveStatus("error");
	    });

	    return () => {
	      cancelled = true;
	    };
	  }, [selectedProject]);

	  // ─── Load moodboard images for mood overlay ──────────────────────────────────
  useEffect(() => {
    const loadMoodboardImagesForScript = async () => {
      const projectId = selectedProject?.id || selectedProject?.name || "default-project";
      const storageKey = `filmProductionBinder:moodboard:${projectId}`;

      try {
        const localRaw = localStorage.getItem(storageKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          const localImages = Array.isArray(parsed?.images) ? parsed.images.filter(img => img?.url) : [];
          if (localImages.length > 0) {
            setScriptMoodboardImages(localImages);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not load local moodboard images for writing overlay:", err);
      }

      if (!selectedProject?.id) return;

      try {
        const { data, error } = await supabase
          .from("moodboard_data")
          .select("images")
          .eq("project_id", selectedProject.id)
          .maybeSingle();

        if (error) throw error;

        const dbImages = Array.isArray(data?.images) ? data.images.filter(img => img?.url) : [];
        setScriptMoodboardImages(dbImages);
      } catch (err) {
        console.warn("Could not load database moodboard images for writing overlay:", err);
      }
    };

    loadMoodboardImagesForScript();
  }, [selectedProject?.id, selectedProject?.name]);

  // ─── Load/save target page count ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedProject) return;
    const storageKey = getProjectStorageKey("writingScriptTargetPageCount");
    const legacyStorageKey = getLegacyScriptStorageKey("scriptTargetPageCount");
    const stored = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
    const parsed = Number(stored);
    const safeTargetPageCount = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 90;
    if (!localStorage.getItem(storageKey) && stored !== null) {
      localStorage.setItem(storageKey, String(safeTargetPageCount));
    }
    setTargetPageCount(safeTargetPageCount);
  }, [selectedProject?.id, selectedProject?.name, getLegacyScriptStorageKey, getProjectStorageKey]);

  useEffect(() => {
    if (!selectedProject) return;
    const safe = Number(targetPageCount);
    if (!Number.isFinite(safe) || safe < 1) return;
    localStorage.setItem(getProjectStorageKey("writingScriptTargetPageCount"), String(Math.round(safe)));
  }, [targetPageCount, selectedProject?.id, selectedProject?.name, getProjectStorageKey]);

  // ─── Keyboard shortcuts for modals ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedBeatDetailId) return;
    const handler = (e) => { if (e.key === "Escape") setSelectedBeatDetailId(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBeatDetailId]);

  // ─── Derived data ────────────────────────────────────────────────────────────
  const writingDraftScenes = useMemo(() => {
    const headingNodes = writingDraftNodes.filter(node => node?.type === "Scene Heading");
    return scenesFromDocumentNodes(writingDraftNodes).map((scene, index) => {
      const headingNode = headingNodes[index] || {};
      const stableSceneId =
        headingNode.id ||
        headingNode.sceneId ||
        scene.sceneId ||
        scene.id ||
        `writing-scene-${index + 1}`;

      const stats =
        writingScenePageStats[headingNode.id] ||
        writingScenePageStats[headingNode.sceneId] ||
        writingScenePageStats[scene.id] ||
        writingScenePageStats[stableSceneId] ||
        {};

      const explicitTargetPage = Number(headingNode.metadata?.targetPage ?? scene.metadata?.targetPage);
      const hasExplicitTargetPage = Number.isFinite(explicitTargetPage) && explicitTargetPage > 0;
      const statsTimelineStartPage = Number(stats.timelineStartPage);
      const fallbackStartPage = Number.isFinite(statsTimelineStartPage)
        ? Math.max(0, statsTimelineStartPage)
        : Math.max(0, (stats.pageNumber || 1) - 1);
      const timelinePageLength = Number(stats.timelinePageLength);
      const safeSceneMetadata = getWritingSceneMetadata(scene.metadata, headingNode.metadata);

      return {
        ...scene,
        id: stableSceneId,
        sceneId: stableSceneId,
        sceneNumber: index + 1,
        timelineStartPage: hasExplicitTargetPage ? Math.max(0, explicitTargetPage - 1) : fallbackStartPage,
        metadata: {
          ...safeSceneMetadata,
          scriptOrder: index + 1,
          writingDraft: true,
          targetPage: hasExplicitTargetPage ? explicitTargetPage : null,
          writingPageNumber: stats.pageNumber || null,
          writingPageLength: stats.pageLength || null,
          writingTimelinePageLength: Number.isFinite(timelinePageLength) && timelinePageLength > 0 ? timelinePageLength : null,
        },
      };
    });
  }, [writingDraftNodes, writingScenePageStats]);

	  const displaySceneNumber = currentIndex < 0 ? null : (writingDraftScenes[currentIndex]?.sceneNumber || 1);

  const writingWrittenPages = writingRenderedPageCount;
  const writingRemainingPages = Math.max(0, Number(targetPageCount || 90) - writingWrittenPages);
  const writingWrittenPercent = Math.min(100, Number(targetPageCount || 90) > 0 ? (writingWrittenPages / Number(targetPageCount || 90)) * 100 : 0);
  const safeSceneTimelineZoom = Math.min(6, Math.max(1, Number(sceneTimelineZoom) || 1));
  const safeBeatTrackZoom = Math.min(3, Math.max(1, Number(beatTrackZoom) || 1));
  const spellcheckIssues = useMemo(
    () => buildSpellcheckIssues(writingDraftNodes, spellcheckDictionaryWords, spellcheckIgnoredWords, spellchecker),
    [spellcheckDictionaryWords, spellcheckIgnoredWords, spellchecker, writingDraftNodes]
  );
  const currentSpellcheckIssue = spellcheckIndex < spellcheckIssues.length
    ? spellcheckIssues[spellcheckIndex]
    : null;

  useEffect(() => {
    if (!showSpellcheckModal || !currentSpellcheckIssue) {
      writingEditorRef.current?.setActiveSpellcheckRange?.(null);
      return;
    }
    setSpellcheckReplacement(currentSpellcheckIssue.suggestions[0] || currentSpellcheckIssue.word);
    writingEditorRef.current?.setActiveSpellcheckRange?.({
      nodeId: currentSpellcheckIssue.nodeId,
      startOffset: currentSpellcheckIssue.startOffset,
      endOffset: currentSpellcheckIssue.endOffset,
    });
    writingEditorRef.current?.selectTextRange?.({
      nodeId: currentSpellcheckIssue.nodeId,
      startOffset: currentSpellcheckIssue.startOffset,
      endOffset: currentSpellcheckIssue.endOffset,
    });
  }, [currentSpellcheckIssue?.id, showSpellcheckModal]);

  const deactivateSpellcheckWorkflow = useCallback(() => {
    writingEditorRef.current?.clearSpellcheckRange?.();
    writingEditorRef.current?.setActiveSpellcheckRange?.(null);
    setShowSpellcheckModal(false);
    setSpellCheckEnabled(false);
    setSpellcheckIndex(0);
    setSpellcheckReplacement("");
    setSpellcheckModalDrag(null);
  }, []);

  const closeSpellcheckModal = deactivateSpellcheckWorkflow;

  useEffect(() => {
    if (!showSpellcheckModal) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSpellcheckModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [showSpellcheckModal, closeSpellcheckModal]);

  useEffect(() => {
    return () => {
      writingEditorRef.current?.clearSpellcheckRange?.();
      writingEditorRef.current?.setActiveSpellcheckRange?.(null);
    };
  }, []);

  useEffect(() => {
    deactivateSpellcheckWorkflow();
  }, [deactivateSpellcheckWorkflow, selectedProject?.id]);

  const goToNextSpellcheckIssue = useCallback(() => {
    setSpellcheckIndex(prev => (spellcheckIssues.length ? Math.min(prev + 1, spellcheckIssues.length - 1) : 0));
  }, [spellcheckIssues.length]);

  const replaceCurrentSpellcheckIssue = useCallback(() => {
    if (!currentSpellcheckIssue) return;
    writingEditorRef.current?.replaceTextRange?.({
      nodeId: currentSpellcheckIssue.nodeId,
      startOffset: currentSpellcheckIssue.startOffset,
      endOffset: currentSpellcheckIssue.endOffset,
      replacement: spellcheckReplacement,
    });
  }, [currentSpellcheckIssue, spellcheckReplacement]);

  const replaceAllCurrentSpellcheckIssues = useCallback(() => {
    if (!currentSpellcheckIssue || !spellcheckReplacement) return;
    const target = currentSpellcheckIssue.normalized;
    const ranges = spellcheckIssues
      .filter(issue => issue.normalized === target)
      .map(issue => ({
        nodeId: issue.nodeId,
        startOffset: issue.startOffset,
        endOffset: issue.endOffset,
      }));
    writingEditorRef.current?.replaceTextRanges?.(ranges, spellcheckReplacement);
    setSpellcheckIndex(0);
  }, [currentSpellcheckIssue, spellcheckIssues, spellcheckReplacement]);

  const addCurrentSpellcheckWordToDictionary = useCallback(() => {
    if (!currentSpellcheckIssue) return;
    const word = currentSpellcheckIssue.normalized;
    if (word && spellchecker) spellchecker.add(word);
    const nextUserWords = new Set(userSpellcheckDictionaryWords);
    if (word) nextUserWords.add(word);
    const nextEffectiveWords = new Set([...legacyProjectSpellcheckDictionaryWords, ...nextUserWords]);
    setUserSpellcheckDictionaryWords(nextUserWords);
    setSpellcheckDictionaryWords(nextEffectiveWords);
    setSpellcheckDictionarySaveStatus("saving");
    saveWritingDictionaryWordsAsync(selectedProject, Array.from(nextUserWords)).then((result) => {
      setSpellcheckDictionarySaveStatus(result.storage === "database" ? "saved" : "local");
    }).catch((error) => {
      console.error("Could not save Writing spellcheck dictionary:", error);
      setSpellcheckDictionarySaveStatus("error");
    });
  }, [currentSpellcheckIssue, legacyProjectSpellcheckDictionaryWords, selectedProject, spellchecker, userSpellcheckDictionaryWords]);

	  const removeUserDictionaryWord = useCallback((word) => {
    const normalizedWord = normalizeSpellcheckWord(word);
    if (!normalizedWord) return;
    const nextUserWords = new Set(userSpellcheckDictionaryWords);
    nextUserWords.delete(normalizedWord);
    const nextEffectiveWords = new Set([...legacyProjectSpellcheckDictionaryWords, ...nextUserWords]);
    setUserSpellcheckDictionaryWords(nextUserWords);
    setSpellcheckDictionaryWords(nextEffectiveWords);
    setSpellcheckDictionarySaveStatus("saving");
    setSpellcheckerReloadKey(prev => prev + 1);
    saveWritingDictionaryWordsAsync(selectedProject, Array.from(nextUserWords)).then((result) => {
      setSpellcheckDictionarySaveStatus(result.storage === "database" ? "saved" : "local");
    }).catch((error) => {
      console.error("Could not save Writing spellcheck dictionary:", error);
      setSpellcheckDictionarySaveStatus("error");
	    });
	  }, [legacyProjectSpellcheckDictionaryWords, selectedProject, userSpellcheckDictionaryWords]);

	  const openTitlePageSettings = useCallback(() => {
	    setTitlePageSettingsDraft(normalizeTitlePageSettings(titlePageSettings));
	    setShowTitlePageSettings(true);
	  }, [titlePageSettings]);

		  const saveTitlePageSettings = useCallback(() => {
		    const nextSettings = normalizeTitlePageSettings(titlePageSettingsDraft);
		    setTitlePageSettings(nextSettings);
		    setTitlePageSettingsDraft(nextSettings);
	    setTitlePageSaveStatus("saving");
	    saveWritingTitlePageSettingsAsync(selectedProject, nextSettings).then((result) => {
	      setTitlePageSaveStatus(result.storage === "database" ? "saved" : "local");
	      setShowTitlePageSettings(false);
	    }).catch((error) => {
	      console.error("Could not save Writing title page settings:", error);
	      setTitlePageSaveStatus("error");
		    });
		  }, [selectedProject, titlePageSettingsDraft]);

		  const toggleTitlePageEnabled = useCallback((enabled) => {
		    const nextSettings = normalizeTitlePageSettings({
		      ...titlePageSettings,
		      enabled: Boolean(enabled),
		    });
		    setTitlePageSettings(nextSettings);
		    setTitlePageSettingsDraft(prev => normalizeTitlePageSettings({
		      ...prev,
		      enabled: nextSettings.enabled,
		    }));
		    setTitlePageSaveStatus("saving");
		    saveWritingTitlePageSettingsAsync(selectedProject, nextSettings).then((result) => {
		      setTitlePageSaveStatus(result.storage === "database" ? "saved" : "local");
		    }).catch((error) => {
		      console.error("Could not save Writing title page enabled state:", error);
		      setTitlePageSaveStatus("error");
		    });
		  }, [selectedProject, titlePageSettings]);

		  const resetTitlePageSettingsToReference = useCallback(() => {
		    setTitlePageSettingsDraft(prev => normalizeTitlePageSettings({
		      ...REFERENCE_TITLE_PAGE_SETTINGS,
		      enabled: prev.enabled,
		    }));
		  }, []);

	  const updateTitlePageSettingsDraft = useCallback((field, value) => {
	    setTitlePageSettingsDraft(prev => normalizeTitlePageSettings({
	      ...prev,
	      [field]: value,
	    }));
	  }, []);

	  const scrollToTitlePage = useCallback(() => {
	    setCurrentIndex(-1);
	    setCurrentSceneNumber(null);
	    titlePageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	  }, []);

	  const handleExportWritingPdf = useCallback(async () => {
	    const model = writingEditorRef.current?.getPdfExportModel?.();
	    if (!model?.pages?.length) return;
	    setIsPdfExporting(true);
	    try {
	      const projectName = (selectedProject?.name || "Script").replace(/[^a-zA-Z0-9\-]/g, "_");
	      await exportWritingScriptToPdf({
	        ...model,
	        titlePageSettings,
	      }, `${projectName}-WritingScript.pdf`);
	    } finally {
	      setIsPdfExporting(false);
	    }
	  }, [selectedProject, titlePageSettings, writingEditorRef]);

  const saveWritingDraftNow = useCallback(async (safeNodes = []) => {
    return saveWritingDraftSafely(selectedProject, safeNodes);
  }, [selectedProject]);

  // ─── handleWritingDraftNodesChange ──────────────────────────────────────────
  const handleWritingDraftNodesChange = useCallback((nextNodes = []) => {
    const safeNodes = Array.isArray(nextNodes) ? nextNodes : [];
    const payload = JSON.stringify(safeNodes);

    // Keep session cache current so switching back to this module skips DB reload
    const projectId = selectedProject?.id || selectedProject?.name || "default-project";
    writingDraftSessionCache.set(projectId, { nodes: safeNodes, payload, updatedAt: Date.now() });

    if (payload === lastWritingDraftPayloadRef.current) {
      setWritingDraftNodes(prevNodes => (JSON.stringify(prevNodes) === payload ? prevNodes : safeNodes));
      setWritingDraftSaveStatus("saved");
      return;
    }

    setWritingDraftNodes(prevNodes => (JSON.stringify(prevNodes) === payload ? prevNodes : safeNodes));

    setWritingDraftSaveStatus("unsaved");
    clearTimeout(writingDraftSaveTimerRef.current);

    setWritingDraftSaveStatus("saving");
    const saveSequence = writingDraftSaveSequenceRef.current + 1;
    writingDraftSaveSequenceRef.current = saveSequence;

    saveWritingDraftNow(safeNodes).then((result) => {
      if (writingDraftSaveSequenceRef.current !== saveSequence) return;
      lastWritingDraftPayloadRef.current = payload;
      lastWritingDraftSaveErrorPayloadRef.current = "";
      if (result?.storage === "indexedDB" && result?.quotaExceeded) {
        if (lastWritingDraftIndexedDbWarningPayloadRef.current !== payload) {
          console.warn(result?.localOnly
            ? "Writing draft database save failed; saved large draft to IndexedDB local fallback."
            : "Writing draft exceeded localStorage quota; database save succeeded and local cache used IndexedDB.");
          lastWritingDraftIndexedDbWarningPayloadRef.current = payload;
        }
      }
      setWritingDraftSaveStatus(result?.storage === "database" ? "saved" : "local");
    }).catch((err) => {
      if (writingDraftSaveSequenceRef.current !== saveSequence) return;
      if (lastWritingDraftSaveErrorPayloadRef.current !== payload) {
        console.error("Could not save writing draft:", err);
        lastWritingDraftSaveErrorPayloadRef.current = payload;
      }
      setWritingDraftSaveStatus("error");
    });
  }, [saveWritingDraftNow, selectedProject]);

  // ─── handleStartNewScript (writing-only, no DB) ──────────────────────────────
  const handleStartNewScript = () => {
    const headingNode = createEmptySceneHeadingNode();
    const newNodes = [headingNode];
    handleWritingDraftNodesChange(newNodes);
    setCurrentIndex(0);
    setCurrentSceneNumber(1);
  };

  const handleImportScriptFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedScenes = await parseScriptFile(file);
      const importedNodes = documentNodesFromScenes(importedScenes);
      if (!importedNodes.length) {
        throw new Error("No screenplay nodes were created from the imported file.");
      }
      handleWritingDraftNodesChange(importedNodes);
      setCurrentIndex(0);
      setCurrentSceneNumber(1);
      requestAnimationFrame(() => {
        editorScrollRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
      });
    } catch (err) {
      console.error("Writing script import failed:", err);
      if (onAlert) {
        await onAlert("Failed to import script. Please use a Final Draft .fdx file or a selectable-text screenplay PDF.");
      }
    } finally {
      event.target.value = "";
    }
  };

  // ─── Beat handlers ───────────────────────────────────────────────────────────
  const appendOutlineItem = (type) => {
    setBeats(prevBeats => {
      const existingItems = normalizeOutlineItems(prevBeats);
      const order = existingItems.length + 1;
      const itemType = type === "act" ? "act" : "beat";
      const actNumber = existingItems.filter(item => item.type === "act").length + 1;
      const sourceText = `${itemType}-${order}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newItem = itemType === "act"
        ? { id: createBeatId(sourceText, order, "act"), type: "act", title: `ACT ${actNumber}`, order, sourceText: "" }
        : { id: createBeatId(sourceText, order, "beat"), type: "beat", title: `Beat ${order}`, description: "", order, verified: false, convertedSceneId: null, originalBeatNumber: null, markerColor: null, timelinePosition: null, sourceText: "" };
      return [...existingItems, newItem];
    });
    setActiveSidePanelTab("beats");
  };

  const deleteOutlineItem = (itemId) => {
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats)
        .filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index + 1 }))
    );
    setCollapsedActIds(prev => {
      if (!prev?.[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const toggleCollapsedAct = (actId) => {
    setCollapsedActIds(prev => ({ ...prev, [actId]: !prev?.[actId] }));
  };

  const reorderOutlineItem = (draggedId, targetId, position = "before") => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setBeats(prevBeats => {
      const orderedItems = normalizeOutlineItems(prevBeats).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
      const currentIdx = orderedItems.findIndex(item => item.id === draggedId);
      const targetIdx = orderedItems.findIndex(item => item.id === targetId);
      if (currentIdx === -1 || targetIdx === -1) return orderedItems;

      const draggedItem = orderedItems[currentIdx];
      const groupEndIndex = draggedItem.type === "act"
        ? orderedItems.findIndex((item, i) => i > currentIdx && item.type === "act")
        : currentIdx + 1;
      const safeGroupEndIndex = groupEndIndex === -1 ? orderedItems.length : groupEndIndex;
      const movingItems = orderedItems.slice(currentIdx, safeGroupEndIndex);
      const movingIds = new Set(movingItems.map(item => item.id));
      if (movingIds.has(targetId)) return orderedItems;

      const nextItems = [...orderedItems];
      nextItems.splice(currentIdx, movingItems.length);
      const targetIndexAfterRemoval = nextItems.findIndex(item => item.id === targetId);
      if (targetIndexAfterRemoval === -1) return orderedItems;

      const targetItemAfterRemoval = nextItems[targetIndexAfterRemoval];
      const nextTargetActIndex = targetItemAfterRemoval?.type === "act"
        ? nextItems.findIndex((item, i) => i > targetIndexAfterRemoval && item.type === "act")
        : -1;
      const targetGroupEndIndex = nextTargetActIndex === -1 ? nextItems.length : nextTargetActIndex;
      const insertIndex = draggedItem.type === "act" && targetItemAfterRemoval?.type === "act" && position === "after"
        ? targetGroupEndIndex
        : position === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;

      nextItems.splice(insertIndex, 0, ...movingItems);
      return nextItems.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const updateOutlineBeat = (itemId, patch) => {
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats).map(item => {
        if (item.id !== itemId || item.type === "act") return item;
        return {
          ...item,
          title: patch.title !== undefined ? String(patch.title) : item.title,
          description: patch.description !== undefined ? String(patch.description) : item.description,
          verified: patch.verified !== undefined ? Boolean(patch.verified) : Boolean(item.verified),
        };
      })
    );
  };

  const handleBeatMarkerColorChange = (itemId, markerColor) => {
    const nextColor = markerColor && markerColor !== "default" ? markerColor : null;
    setBeats(prevBeats =>
      normalizeOutlineItems(prevBeats).map(item =>
        item.id === itemId && item.type === "beat" ? { ...item, markerColor: nextColor } : item
      )
    );
  };

  const handleBeatTimelineReorder = (itemId, targetInsertionIndex) => {
    setBeats(prevBeats => {
      const orderedItems = normalizeOutlineItems(prevBeats).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
      const beatItems = orderedItems.filter(item => item.type === "beat");
      const currentBeatIndex = beatItems.findIndex(item => item.id === itemId);
      if (currentBeatIndex === -1 || beatItems.length <= 1) return orderedItems;

      const safeTargetInsertionIndex = Math.max(0, Math.min(beatItems.length, Number(targetInsertionIndex) || 0));
      const nextBeatItems = [...beatItems];
      const [movingBeat] = nextBeatItems.splice(currentBeatIndex, 1);
      const adjustedInsertionIndex = Math.max(
        0,
        Math.min(
          nextBeatItems.length,
          currentBeatIndex < safeTargetInsertionIndex
            ? safeTargetInsertionIndex - 1
            : safeTargetInsertionIndex
        )
      );
      nextBeatItems.splice(adjustedInsertionIndex, 0, movingBeat);

      let beatCursor = 0;
      const nextItems = orderedItems.map(item => {
        if (item.type !== "beat") return item;
        const nextBeat = nextBeatItems[beatCursor++];
        return {
          ...nextBeat,
          timelinePosition: null,
          timelinePositionSource: null,
        };
      }).map((item, index) => ({ ...item, order: index + 1 }));

      if (typeof window !== "undefined" && window.__DEBUG_WRITING_BEATS) {
        console.log("[WritingScript beats] timeline reorder", {
          itemId,
          targetInsertionIndex,
          safeTargetInsertionIndex,
          adjustedInsertionIndex,
          before: orderedItems.map(item => ({ id: item.id, title: item.title, type: item.type, order: item.order })),
          after: nextItems.map(item => ({ id: item.id, title: item.title, type: item.type, order: item.order })),
        });
      }

      return nextItems;
    });
  };

  // ─── Beat import handlers ────────────────────────────────────────────────────
  const handleOpenBeatImport = () => {
    setBeatImportText("");
    setBeatImportDraft(null);
    setShowBeatImportDialog(true);
    setActiveSidePanelTab("beats");
  };

  const handleParseBeatImport = () => setBeatImportDraft(parseBeatSheetText(beatImportText));

  const handleCancelBeatImport = () => {
    setShowBeatImportDialog(false);
    setBeatImportText("");
    setBeatImportDraft(null);
  };

  const updateDraftBeat = (beatId, patch) => {
    setBeatImportDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.map(beat =>
        beat.id === beatId ? {
          ...beat,
          ...patch,
          description: patch.type === "beat" && beat.description === undefined ? "" : (patch.description !== undefined ? patch.description : beat.description),
          verified: patch.type === "act" ? false : (patch.verified !== undefined ? patch.verified : Boolean(beat.verified)),
        } : beat
      );
      return { ...prev, items: nextItems, beats: nextItems.filter(item => item.type === "beat"), acts: nextItems.filter(item => item.type === "act") };
    });
  };

  const removeDraftBeat = (itemId) => {
    setBeatImportDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.filter(item => item.id !== itemId).map((item, index) => ({ ...item, order: index + 1 }));
      return { ...prev, items: nextItems, beats: nextItems.filter(item => item.type === "beat"), acts: nextItems.filter(item => item.type === "act") };
    });
  };

  const handleConfirmBeatImport = () => {
    if (!beatImportDraft || !Array.isArray(beatImportDraft.items)) return;
    setBeats(prevBeats => {
      const existingBeats = normalizeOutlineItems(prevBeats);
      const startOrder = existingBeats.length;
      const importedBeats = beatImportDraft.items.map((beat, index) => {
        const order = startOrder + index + 1;
        if (beat.type === "act") {
          return { id: createBeatId(beat.sourceText || beat.title || "", order, "act"), type: "act", order, title: String(beat.title || `Act ${order}`).trim(), sourceText: beat.sourceText || "" };
        }
        return {
          id: createBeatId(beat.sourceText || beat.title || "", order, "beat"),
          type: "beat", order,
          title: String(beat.title || `Beat ${order}`).trim(),
          description: String(beat.description || "").trim(),
          verified: Boolean(beat.verified),
          convertedSceneId: beat.convertedSceneId || null,
          originalBeatNumber: Number.isFinite(Number(beat.originalBeatNumber)) ? Number(beat.originalBeatNumber) : null,
          markerColor: beat.markerColor || null,
          timelinePosition: beat.timelinePosition !== null &&
            beat.timelinePosition !== undefined &&
            beat.timelinePosition !== "" &&
            Number.isFinite(Number(beat.timelinePosition))
            ? Math.max(0, Math.min(1, Number(beat.timelinePosition)))
            : null,
          timelinePositionSource: beat.timelinePositionSource === "manual" ? "manual" : null,
          sourceText: beat.sourceText || "",
        };
      });
      return [...existingBeats, ...importedBeats];
    });
    setShowBeatsTrack(true);
    setActiveSidePanelTab("beats");
    handleCancelBeatImport();
  };

  // ─── Beat detail ─────────────────────────────────────────────────────────────
  const orderedOutlineItemsForDetail = normalizeOutlineItems(beats).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  let detailBeatNumber = 0;
  let detailCurrentAct = "";
  const selectedBeatDetail = orderedOutlineItemsForDetail.reduce((match, item) => {
    if (item.type === "act") { detailCurrentAct = item.title || ""; return match; }
    detailBeatNumber += 1;
    if (item.id !== selectedBeatDetailId) return match;
    return { ...item, beatNumber: detailBeatNumber, currentActTitle: detailCurrentAct, originalBeatNumber: Number.isFinite(Number(item.originalBeatNumber)) ? Number(item.originalBeatNumber) : null };
  }, null);

  const handleDeleteBeatDetail = () => {
    if (!selectedBeatDetail?.id) return;
    deleteOutlineItem(selectedBeatDetail.id);
    setSelectedBeatDetailId(null);
  };

  // ─── Timeline scene move (writing branch from Script.js lines 4350–4462) ────
  const handleTimelineSceneMove = useCallback((sceneIndex, nextStartPage) => {
    const movedScene = writingDraftScenes[sceneIndex];
    if (!movedScene) return;

    const clearTimelineTargetPage = (node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage: null } };
    };

    const sourceNodes = Array.isArray(writingDraftNodes) ? writingDraftNodes : [];
    const headingEntries = sourceNodes.map((node, index) => ({ node, index })).filter(({ node }) => node?.type === "Scene Heading");
    if (headingEntries.length < 1) return;

    const prefixNodes = sourceNodes.slice(0, headingEntries[0].index);
    const sceneBlocks = headingEntries.map((headingEntry, headingIndex) => {
      const nextHeadingEntry = headingEntries[headingIndex + 1];
      return sourceNodes.slice(headingEntry.index, nextHeadingEntry ? nextHeadingEntry.index : sourceNodes.length);
    });

    const timelineItems = writingDraftScenes.map((scene, index) => {
      const pageLength = Number(scene.metadata?.writingTimelinePageLength ?? scene.metadata?.writingPageLength);
      return { index, startPage: Number(scene.timelineStartPage) || 0, pageLength: Number.isFinite(pageLength) && pageLength > 0 ? pageLength : 0.125 };
    });

    const remainingTimelineItems = timelineItems.filter(item => item.index !== sceneIndex).sort((a, b) => a.startPage !== b.startPage ? a.startPage - b.startPage : a.index - b.index);
    let insertSceneIndex = remainingTimelineItems.length;
    for (let i = 0; i < remainingTimelineItems.length; i += 1) {
      const item = remainingTimelineItems[i];
      if (nextStartPage < item.startPage + item.pageLength / 2) { insertSceneIndex = i; break; }
    }

    const nextSceneBlocks = [...sceneBlocks];
    const [movingBlock] = nextSceneBlocks.splice(sceneIndex, 1);
    if (!movingBlock) return;

    const movedHeadingNode = movingBlock.find(node => node?.type === "Scene Heading");
    const movedHeadingId = movedHeadingNode?.id || null;
    const movedSceneId = movedHeadingNode?.sceneId || movedScene.id || null;
    const targetPage = Math.max(1, nextStartPage + 1);

    const movingBlockWithTargetPage = movingBlock.map((node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage } };
    });

    insertSceneIndex = Math.max(0, Math.min(insertSceneIndex, nextSceneBlocks.length));
    nextSceneBlocks.splice(insertSceneIndex, 0, movingBlockWithTargetPage);

    const nextNodes = [...prefixNodes, ...nextSceneBlocks.flat()].map((node) => {
      if (node?.type !== "Scene Heading") return node;
      const isMovedHeading = (movedHeadingId && node.id === movedHeadingId) || (movedSceneId && node.sceneId === movedSceneId);
      return isMovedHeading ? node : clearTimelineTargetPage(node);
    });

    handleWritingDraftNodesChange(nextNodes);
    setCurrentIndex(insertSceneIndex);
    setCurrentSceneNumber(insertSceneIndex + 1);
    requestAnimationFrame(() => { sceneRefs.current[insertSceneIndex]?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, [writingDraftNodes, writingDraftScenes, handleWritingDraftNodesChange, sceneRefs]);

  // ─── Scene color change ──────────────────────────────────────────────────────
  const handleSceneColorChange = useCallback((sceneIndex, colorKey) => {
    const sourceNodes = Array.isArray(writingDraftNodes) ? writingDraftNodes : [];
    const headingEntries = sourceNodes.map((node, idx) => ({ node, idx })).filter(({ node }) => node?.type === "Scene Heading");
    const entry = headingEntries[sceneIndex];
    if (!entry) return;
    const nextNodes = sourceNodes.map((node, idx) => {
      if (idx !== entry.idx) return node;
      return { ...node, metadata: { ...(node.metadata || {}), color: colorKey ?? null } };
    });
    handleWritingDraftNodesChange(nextNodes);
  }, [writingDraftNodes, handleWritingDraftNodesChange]);

  // ─── Scene list reorder (from Script.js lines 4937–5013) ─────────────────────
  const handleWritingSceneListReorder = useCallback((draggedKey, targetKey, position = "before") => {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;

    const getSceneReorderKey = (scene, index) =>
      `${scene?.id || scene?.sceneId || scene?.sceneNumber || "scene"}-${index}`;

    const clearTimelineTargetPage = (node) => {
      if (node?.type !== "Scene Heading") return node;
      return { ...node, metadata: { ...(node.metadata || {}), targetPage: null } };
    };

    const sourceNodes = Array.isArray(writingDraftNodes) ? writingDraftNodes : [];
    const headingEntries = sourceNodes.map((node, index) => ({ node, index })).filter(({ node }) => node?.type === "Scene Heading");
    if (headingEntries.length < 2) return;

    const prefixNodes = sourceNodes.slice(0, headingEntries[0].index);
    const sceneBlocks = headingEntries.map((headingEntry, headingIndex) => {
      const nextHeadingEntry = headingEntries[headingIndex + 1];
      return sourceNodes.slice(headingEntry.index, nextHeadingEntry ? nextHeadingEntry.index : sourceNodes.length);
    });

    const draggedSceneIndex = writingDraftScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(draggedKey));
    const targetSceneIndex = writingDraftScenes.findIndex((scene, index) => getSceneReorderKey(scene, index) === String(targetKey));
    if (draggedSceneIndex < 0 || targetSceneIndex < 0 || draggedSceneIndex === targetSceneIndex) return;

    const nextSceneBlocks = [...sceneBlocks];
    const [movingBlock] = nextSceneBlocks.splice(draggedSceneIndex, 1);
    let insertSceneIndex = targetSceneIndex;
    if (draggedSceneIndex < targetSceneIndex) insertSceneIndex -= 1;
    if (position === "after") insertSceneIndex += 1;
    insertSceneIndex = Math.max(0, Math.min(insertSceneIndex, nextSceneBlocks.length));
    nextSceneBlocks.splice(insertSceneIndex, 0, movingBlock);

    const nextNodes = [...prefixNodes, ...nextSceneBlocks.flat()].map(clearTimelineTargetPage);
    handleWritingDraftNodesChange(nextNodes);
    setCurrentIndex(insertSceneIndex);
    setCurrentSceneNumber(insertSceneIndex + 1);
    requestAnimationFrame(() => { sceneRefs.current[insertSceneIndex]?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, [handleWritingDraftNodesChange, sceneRefs, writingDraftNodes, writingDraftScenes]);

  // ─── Guards ──────────────────────────────────────────────────────────────────
  if (!isEditorPreview && !previewShell) return null;
  if (!isEditorPreview) {
    return <div data-writing-script-shell="preview" style={{ display: "none" }} />;
  }

  const noScript = writingDraftScenes.length === 0;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", boxSizing: "border-box" }}>
      {/* Header bar */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
        <div style={{ flex: "0 0 calc(8.5in + 520px)", width: "calc(8.5in + 520px)", display: "flex", minHeight: "38px", boxSizing: "border-box", overflow: "hidden" }}>
	          <div style={{ flex: "0 0 8.5in", width: "8.5in", minWidth: 0, display: "flex", gap: "8px", alignItems: "center", padding: "5px 12px", boxSizing: "border-box", whiteSpace: "nowrap", overflow: "hidden" }}>
	            <h2 style={{ margin: 0, fontSize: "17px", letterSpacing: "0.08em", fontWeight: "bold" }}>WRITING</h2>

	            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, marginLeft: "auto" }}>
	              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
	                {[
	                  { label: "B", mark: "bold", active: activeFormats.bold, style: { fontWeight: "bold" } },
	                  { label: "I", mark: "italic", active: activeFormats.italic, style: { fontStyle: "italic" } },
	                  { label: "U", mark: "underline", active: activeFormats.underline, style: { textDecoration: "underline" } },
	                  { label: "S", mark: "strike", active: activeFormats.strike, style: { textDecoration: "line-through" } },
	                ].map(({ label, mark, active, style: btnStyle }) => (
	                  <button
	                    key={mark}
	                    type="button"
	                    onMouseDown={(e) => {
	                      e.preventDefault();
	                      writingEditorRef.current?.toggleInlineStyleForSelection?.(mark);
	                    }}
	                    style={{ width: "24px", height: "24px", padding: 0, fontSize: "12px", border: `1px solid ${active ? APP_TAB_BLUE : "#ccc"}`, borderRadius: "4px", backgroundColor: active ? "#e8f0fe" : "#f7f7f7", color: active ? APP_TAB_BLUE : "#333", cursor: "pointer", fontFamily: "serif", ...btnStyle }}
	                  >
	                    {label}
	                  </button>
	                ))}
	              </div>
	              <span
	                title={writingDraftSaveStatus === "local" ? "Writing draft saved locally only; database save failed." : "Writing draft saves to the project database with local cache fallback."}
	                style={{ width: "70px", minWidth: "70px", textAlign: "right", fontSize: "10px", color: getWritingDraftSaveStatusColor(writingDraftSaveStatus), fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", whiteSpace: "nowrap", overflow: "hidden", marginRight: "2px" }}
	              >
	                {writingDraftSaveStatus === "saving" ? "Saving…" : writingDraftSaveStatus === "unsaved" ? "Unsaved" : writingDraftSaveStatus === "error" ? "Save error" : writingDraftSaveStatus === "local" ? "Saved local" : "Saved DB"}
	              </span>
	              <select
	                value={writingEditorElementType}
	                onChange={(e) => setWritingEditorElementType(e.target.value)}
	                disabled={!writingEditorElementType}
	                style={{ width: "132px", padding: "5px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", opacity: writingEditorElementType ? 1 : 0.55, cursor: writingEditorElementType ? "pointer" : "default" }}
	              >
	                <option value="">Element</option>
	                {ELEMENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
	              </select>
	            </div>

	            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto", flexShrink: 0 }}>
	              <div style={{ position: "relative", display: "inline-flex" }}>
	                <button
	                  type="button"
	                  onMouseDown={(e) => {
	                    e.preventDefault();
	                    e.stopPropagation();
	                    const rect = e.currentTarget.getBoundingClientRect();
	                    setHighlightMenuRect({
	                      left: rect.left,
	                      top: rect.bottom + 4,
	                      width: rect.width,
	                    });
	                    setShowHighlightMenu(prev => !prev);
	                  }}
	                  style={{ padding: "3px 8px", minWidth: "74px", fontSize: "11px", border: `1px solid ${activeFormats.highlight ? APP_TAB_BLUE : "#ccc"}`, borderRadius: "4px", backgroundColor: activeFormats.highlight ? "#fffde7" : "#f7f7f7", color: activeFormats.highlight ? APP_TAB_BLUE : "#333", cursor: "pointer", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", whiteSpace: "nowrap" }}
	                >
	                  Highlight
	                </button>
	                {showHighlightMenu && highlightMenuRect && createPortal(
	                  <div
	                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
	                    style={{ position: "fixed", top: highlightMenuRect.top, left: highlightMenuRect.left, zIndex: WRITING_OVERLAY_Z_INDEX, minWidth: Math.max(132, highlightMenuRect.width), padding: "4px", border: "1px solid #bbb", borderRadius: "4px", backgroundColor: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.16)", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}
	                  >
	                    <button
	                      type="button"
	                      onMouseDown={(e) => {
	                        e.preventDefault();
	                        writingEditorRef.current?.clearInlineStyleFromSelection?.("highlight");
	                        setShowHighlightMenu(false);
	                      }}
	                      style={{ display: "block", width: "100%", padding: "5px 7px", border: "none", borderRadius: "3px", backgroundColor: "transparent", color: "#333", textAlign: "left", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
	                    >
	                      Clear Highlight
	                    </button>
	                    {highlightColors.map(color => (
	                      <button
	                        key={color.value}
	                        type="button"
	                        onMouseDown={(e) => {
	                          e.preventDefault();
	                          writingEditorRef.current?.applyInlineStyleToSelection?.({ highlight: color.value });
	                          setShowHighlightMenu(false);
	                        }}
	                        style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", padding: "5px 7px", border: "none", borderRadius: "3px", backgroundColor: activeFormats.highlight === color.value ? "#eceff1" : "transparent", color: "#333", textAlign: "left", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
	                      >
	                        <span aria-hidden="true" style={{ width: "12px", height: "12px", borderRadius: "2px", border: "1px solid #aaa", backgroundColor: color.value }} />
	                        {color.label}
	                      </button>
	                    ))}
	                  </div>
	                , document.body)}
	              </div>
	              <button
	                type="button"
	                onClick={() => {
	                  if (showSpellcheckModal) {
	                    closeSpellcheckModal();
	                    return;
	                  }
	                  setSpellCheckEnabled(true);
	                  setSpellcheckIndex(0);
	                  setShowSpellcheckModal(true);
	                }}
	                title="Open app spellcheck workflow."
	                style={{ padding: "3px 7px", fontSize: "11px", border: `1px solid ${showSpellcheckModal ? APP_TAB_BLUE : "#ccc"}`, borderRadius: "4px", backgroundColor: showSpellcheckModal ? "#e8f0fe" : "#f7f7f7", color: showSpellcheckModal ? APP_TAB_BLUE : "#555", cursor: "pointer", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}
	              >
	                Spellcheck
	              </button>
		            </div>
		          </div>

		          <div style={{ flex: "0 0 520px", width: "520px", minWidth: 0, display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", padding: "5px 0 5px 12px", boxSizing: "border-box" }}>
		            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
		              <button
		                type="button"
		                onClick={handleExportWritingPdf}
		                disabled={isPdfExporting}
		                title="Export Writing Script to PDF"
		                style={{ padding: "3px 7px", fontSize: "11px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", color: "#555", cursor: isPdfExporting ? "default" : "pointer", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", opacity: isPdfExporting ? 0.6 : 1, whiteSpace: "nowrap" }}
		              >
		                {isPdfExporting ? "Exporting…" : "Export PDF"}
		              </button>
		              {!isViewOnly && (
		                <button
		                  type="button"
		                  onClick={openShareScriptModal}
		                  title="Create or manage a public read-only script link"
		                  style={{ padding: "3px 7px", fontSize: "11px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", color: "#555", cursor: "pointer", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", whiteSpace: "nowrap" }}
		                >
		                  Share Script...
		                </button>
		              )}
		            </div>
            <span style={{ fontSize: "11px", color: "#555", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {writingWrittenPages.toFixed(1)} written · {writingRemainingPages.toFixed(1)} remaining · {writingWrittenPercent.toFixed(0)}%
            </span>

            {!isViewOnly && noScript && (
              <>
                <input
                  ref={writingImportInputRef}
                  type="file"
                  accept=".fdx,.pdf,application/pdf"
                  onChange={handleImportScriptFile}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => writingImportInputRef.current?.click()}
                  style={{ padding: "6px 14px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  IMPORT SCRIPT
                </button>
                <button
                  onClick={handleStartNewScript}
                  style={{ padding: "6px 14px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  NEW SCRIPT
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowMoodOverlaySettings(true)}
              style={{ padding: "5px 10px", backgroundColor: "#f7f7f7", color: "#333", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}
            >
              SETTINGS
            </button>
          </div>
        </div>
        <div style={{ flex: 1, backgroundColor: "white" }} />
      </div>

      {/* ── Scene / Beats timeline ────────────────────────────────────────────── */}
	      {ENABLE_WRITING_TIMELINE && (showWritingTimeline || showBeatsTrack) && (
	      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid #eee", backgroundColor: "white" }}>
	        <div style={{ flex: "0 0 calc(8.5in + 520px)", width: "calc(8.5in + 520px)", display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "white", position: "relative" }}>
	          <>
	            {typeof window !== "undefined" && window.__DEBUG_WRITING_BEATS && console.log("[WritingScript beats] render timeline", {
	              beatsLength: beats.length,
	              showBeatsTrack,
              firstBeats: beats.slice(0, 5).map(item => ({
                id: item?.id,
                title: item?.title,
                type: item?.type,
                order: item?.order,
                timelinePosition: item?.timelinePosition,
	                timelinePositionSource: item?.timelinePositionSource,
	              })),
	            })}
	            {showWritingTimeline && (
	              <WritingTimeline
	                scenes={writingDraftScenes}
	                beats={beats}
	                onBeatOpen={setSelectedBeatDetailId}
	                onBeatColorChange={handleBeatMarkerColorChange}
	                onBeatTimelineReorder={!isViewOnly ? handleBeatTimelineReorder : null}
	                showSceneTrack
	                showBeatsTrack={false}
	                beatTrackZoom={beatTrackZoom}
	                sceneTimelineZoom={sceneTimelineZoom}
	                sceneTimelineControls={(
	                  <>
	                    <button
	                      type="button"
	                      onClick={() => setSceneTimelineZoom(Math.max(1, Number((safeSceneTimelineZoom - 0.5).toFixed(2))))}
	                      disabled={safeSceneTimelineZoom <= 1}
	                      style={{ padding: "2px 7px", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: safeSceneTimelineZoom <= 1 ? "#eee" : "#f7f7f7", color: safeSceneTimelineZoom <= 1 ? "#999" : "#333", cursor: safeSceneTimelineZoom <= 1 ? "default" : "pointer", fontSize: "10px", fontWeight: "bold" }}
	                    >
	                      -
	                    </button>
	                    <span style={{ minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{safeSceneTimelineZoom.toFixed(2).replace(/\.00$/, "")}x</span>
	                    <button
	                      type="button"
	                      onClick={() => setSceneTimelineZoom(Math.min(6, Number((safeSceneTimelineZoom + 0.5).toFixed(2))))}
	                      disabled={safeSceneTimelineZoom >= 6}
	                      style={{ padding: "2px 7px", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: safeSceneTimelineZoom >= 6 ? "#eee" : "#f7f7f7", color: safeSceneTimelineZoom >= 6 ? "#999" : "#333", cursor: safeSceneTimelineZoom >= 6 ? "default" : "pointer", fontSize: "10px", fontWeight: "bold" }}
	                    >
	                      +
	                    </button>
	                  </>
	                )}
	                currentSceneNumber={displaySceneNumber}
	                setCurrentIndex={setCurrentIndex}
	                sceneRefs={sceneRefs}
	                targetPages={targetPageCount}
	                onSceneMove={handleTimelineSceneMove}
	                onSceneColorChange={handleSceneColorChange}
	                onSceneOpen={(item) => {
	                  setCurrentIndex(item.index);
	                  sceneRefs.current[item.index]?.scrollIntoView({ behavior: "smooth", block: "start" });
	                }}
	              />
	            )}
	            {showBeatsTrack && (
	              <WritingTimeline
	                scenes={writingDraftScenes}
	                beats={beats}
	                onBeatOpen={setSelectedBeatDetailId}
	                onBeatColorChange={handleBeatMarkerColorChange}
	                onBeatTimelineReorder={!isViewOnly ? handleBeatTimelineReorder : null}
	                showSceneTrack={false}
	                showBeatsTrack
	                beatTrackZoom={beatTrackZoom}
	                sceneTimelineZoom={sceneTimelineZoom}
	                beatsTimelineControls={(
	                  <>
	                    <button
	                      type="button"
	                      onClick={() => setBeatTrackZoom(Math.max(1, Number((safeBeatTrackZoom - 0.25).toFixed(2))))}
	                      disabled={safeBeatTrackZoom <= 1}
	                      style={{ padding: "2px 7px", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: safeBeatTrackZoom <= 1 ? "#eee" : "#f7f7f7", color: safeBeatTrackZoom <= 1 ? "#999" : "#333", cursor: safeBeatTrackZoom <= 1 ? "default" : "pointer", fontSize: "10px", fontWeight: "bold" }}
	                    >
	                      -
	                    </button>
	                    <span style={{ minWidth: "28px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{safeBeatTrackZoom.toFixed(2).replace(/\.00$/, "")}x</span>
	                    <button
	                      type="button"
	                      onClick={() => setBeatTrackZoom(Math.min(3, Number((safeBeatTrackZoom + 0.25).toFixed(2))))}
	                      disabled={safeBeatTrackZoom >= 3}
	                      style={{ padding: "2px 7px", border: "1px solid #ccc", borderRadius: "3px", backgroundColor: safeBeatTrackZoom >= 3 ? "#eee" : "#f7f7f7", color: safeBeatTrackZoom >= 3 ? "#999" : "#333", cursor: safeBeatTrackZoom >= 3 ? "default" : "pointer", fontSize: "10px", fontWeight: "bold" }}
	                    >
	                      +
	                    </button>
	                  </>
	                )}
	                currentSceneNumber={displaySceneNumber}
	                setCurrentIndex={setCurrentIndex}
	                sceneRefs={sceneRefs}
	                targetPages={targetPageCount}
	                onSceneMove={handleTimelineSceneMove}
	                onSceneColorChange={handleSceneColorChange}
	                onSceneOpen={(item) => {
	                  setCurrentIndex(item.index);
	                  sceneRefs.current[item.index]?.scrollIntoView({ behavior: "smooth", block: "start" });
	                }}
	              />
	            )}
	          </>
	        </div>
        <div style={{ flex: 1, backgroundColor: "white" }} />
      </div>
      )}

      {/* ── Beat Import Modal ─────────────────────────────────────────────────── */}
      {showBeatImportDialog && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 22000 }} onClick={handleCancelBeatImport} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "760px", maxWidth: "calc(100vw - 40px)", maxHeight: "82vh", overflow: "hidden", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 22001, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Import Beat Sheet</h2>
                <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>Paste semi-structured beat sheet text, review the parsed beats, then confirm.</div>
              </div>
              <button type="button" onClick={handleCancelBeatImport} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>x</button>
            </div>

            {!beatImportDraft ? (
              <>
                <div style={{ padding: "18px 20px", overflow: "auto" }}>
                  <textarea value={beatImportText} onChange={(e) => setBeatImportText(e.target.value)} placeholder="Paste beat sheet text here..." autoFocus style={{ width: "100%", height: "360px", resize: "vertical", border: "1px solid #ccc", borderRadius: "4px", padding: "10px", boxSizing: "border-box", fontSize: "13px", lineHeight: 1.45, fontFamily: "inherit" }} />
                </div>
                <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={handleCancelBeatImport} style={{ padding: "9px 16px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="button" onClick={handleParseBeatImport} disabled={!beatImportText.trim()} style={{ padding: "9px 18px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: beatImportText.trim() ? "pointer" : "not-allowed", fontWeight: "bold", opacity: beatImportText.trim() ? 1 : 0.5 }}>Parse Beats</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <div style={{ fontSize: "12px", color: "#555" }}>
                    Detected <strong>{beatImportDraft.items.length}</strong> outline item{beatImportDraft.items.length === 1 ? "" : "s"}: <strong>{beatImportDraft.acts.length}</strong> act{beatImportDraft.acts.length === 1 ? "" : "s"} and <strong>{beatImportDraft.beats.length}</strong> beat{beatImportDraft.beats.length === 1 ? "" : "s"}. Import will append after existing outline items.
                  </div>
                  <button type="button" onClick={() => setBeatImportDraft(null)} style={{ padding: "7px 12px", backgroundColor: "#f5f5f5", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Back to Text</button>
                </div>

                {beatImportDraft.warnings.length > 0 && (
                  <div style={{ padding: "10px 20px", backgroundColor: "#FFF8E1", borderBottom: "1px solid #F3E0A1", color: "#665200", fontSize: "12px" }}>
                    {beatImportDraft.warnings.slice(0, 3).join(" ")}
                    {beatImportDraft.warnings.length > 3 ? ` ${beatImportDraft.warnings.length - 3} more warning(s).` : ""}
                  </div>
                )}

                <div style={{ padding: "16px 20px", overflow: "auto", display: "grid", gap: "10px" }}>
                  {(() => {
                    let reviewBeatNumber = 0;
                    return beatImportDraft.items.map((item) => {
                      const isAct = item.type === "act";
                      if (!isAct) reviewBeatNumber += 1;
                      const descriptionRows = Math.max(2, Math.min(10, String(item.description || "").split("\n").length + Math.ceil(String(item.description || "").length / 80)));
                      return (
                        <div key={item.id} style={{ border: isAct ? "1px solid #90A4AE" : "1px solid #ddd", borderRadius: "6px", padding: isAct ? "10px 12px" : "12px", backgroundColor: isAct ? "#ECEFF1" : "#fafafa" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: isAct ? 0 : "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: isAct ? "#455A64" : "#777", minWidth: "82px" }}>{isAct ? "ACT HEADING" : `BEAT #${reviewBeatNumber}`}</span>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777" }}>TYPE</span>
                              <select value={item.type === "act" ? "act" : "beat"} onChange={(e) => updateDraftBeat(item.id, { type: e.target.value, description: e.target.value === "beat" ? (item.description || "") : item.description })} style={{ padding: "6px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", backgroundColor: "white" }}>
                                <option value="act">Act</option>
                                <option value="beat">Beat</option>
                              </select>
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777", width: "34px", textAlign: "left" }}>TITLE</span>
                              <input type="text" value={item.title} onChange={(e) => updateDraftBeat(item.id, { title: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "7px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", fontWeight: isAct ? "bold" : "normal", textTransform: isAct ? "uppercase" : "none" }} />
                            </label>
                            {!isAct && (
                              <button type="button" onClick={() => updateDraftBeat(item.id, { verified: !item.verified })} style={{ width: "28px", height: "28px", border: `1px solid ${item.verified ? "#4CAF50" : "#ccc"}`, borderRadius: "4px", backgroundColor: item.verified ? "#4CAF50" : "white", color: item.verified ? "white" : "#777", cursor: "pointer", fontWeight: "bold" }}>✓</button>
                            )}
                            <button type="button" onClick={() => updateDraftBeat(item.id, { showSourceText: !item.showSourceText })} style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: item.showSourceText ? "#FFF8E1" : "white", color: "#555", cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}>Original</button>
                            <button type="button" onClick={() => removeDraftBeat(item.id)} style={{ width: "28px", height: "28px", border: "1px solid #c62828", borderRadius: "4px", backgroundColor: "#c62828", color: "white", cursor: "pointer", fontWeight: "bold" }}>x</button>
                          </div>
                          {!isAct && (
                            <label style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: "8px", alignItems: "start", margin: 0 }}>
                              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#777", paddingTop: "8px", textAlign: "left" }}>DESCRIPTION</span>
                              <textarea rows={descriptionRows} value={item.description || ""} onChange={(e) => updateDraftBeat(item.id, { description: e.target.value })} style={{ width: "100%", resize: "none", overflow: "hidden", boxSizing: "border-box", padding: "8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", lineHeight: 1.4, fontFamily: "inherit" }} />
                            </label>
                          )}
                          {item.showSourceText && (
                            <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "white", border: "1px dashed #bbb", borderRadius: "4px", color: "#555", fontSize: "11px", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                              {item.sourceText || "No original text captured."}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button type="button" onClick={handleCancelBeatImport} style={{ padding: "9px 16px", backgroundColor: "#e0e0e0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
                  <button type="button" onClick={handleConfirmBeatImport} disabled={beatImportDraft.items.length === 0} style={{ padding: "9px 18px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: beatImportDraft.items.length ? "pointer" : "not-allowed", fontWeight: "bold", opacity: beatImportDraft.items.length ? 1 : 0.5 }}>Confirm Import</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Beat Detail Modal ─────────────────────────────────────────────────── */}
      {selectedBeatDetail && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex: 21900 }} onClick={() => setSelectedBeatDetailId(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "640px", maxWidth: "calc(100vw - 40px)", maxHeight: "82vh", overflow: "hidden", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", zIndex: 21901, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px" }}>Beat Detail</h2>
                <div style={{ fontSize: "12px", color: "#777", marginTop: "4px" }}>
                  Current Beat #{selectedBeatDetail.beatNumber}{selectedBeatDetail.currentActTitle ? ` · ${selectedBeatDetail.currentActTitle}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedBeatDetailId(null)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>x</button>
            </div>

            <div style={{ padding: "18px 20px", overflow: "auto", display: "grid", gap: "14px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "#555" }}>
                <span><strong>Current Beat #:</strong> {selectedBeatDetail.beatNumber}</span>
                <span><strong>Original Imported Beat #:</strong> {selectedBeatDetail.originalBeatNumber || "None"}</span>
              </div>
              <label style={{ display: "grid", gap: "6px", margin: 0 }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>Title</span>
                <input type="text" value={selectedBeatDetail.title || ""} onChange={(e) => updateOutlineBeat(selectedBeatDetail.id, { title: e.target.value })} autoFocus style={{ width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px", fontFamily: "inherit" }} />
              </label>
              <label style={{ display: "grid", gap: "6px", margin: 0 }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#555" }}>Description</span>
                <textarea value={selectedBeatDetail.description || ""} onChange={(e) => updateOutlineBeat(selectedBeatDetail.id, { description: e.target.value })} rows={12} style={{ width: "100%", minHeight: "240px", boxSizing: "border-box", padding: "10px", border: "1px solid #ccc", borderRadius: "4px", resize: "vertical", fontSize: "13px", lineHeight: 1.45, fontFamily: "inherit" }} />
              </label>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <button type="button" onClick={handleDeleteBeatDetail} style={{ padding: "9px 14px", backgroundColor: "#c62828", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Delete Beat</button>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {/* Convert to Scene is DISABLED in writing mode */}
                <button type="button" disabled style={{ padding: "9px 14px", backgroundColor: "#f5f5f5", color: "#bbb", border: "1px solid #ddd", borderRadius: "4px", cursor: "default", fontWeight: "bold" }}>
                  Convert to Scene
                </button>
                <button type="button" onClick={() => updateOutlineBeat(selectedBeatDetail.id, { verified: !selectedBeatDetail.verified })} style={{ padding: "9px 14px", backgroundColor: selectedBeatDetail.verified ? "#4CAF50" : "#f5f5f5", color: selectedBeatDetail.verified ? "white" : "#555", border: selectedBeatDetail.verified ? "none" : "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                  {selectedBeatDetail.verified ? "Verified" : "Mark Verified"}
                </button>
                <button type="button" onClick={() => setSelectedBeatDetailId(null)} style={{ padding: "9px 16px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Close</button>
              </div>
            </div>
          </div>
        </>
      )}

	      {/* ── Settings Modal ────────────────────────────────────────────────────── */}
	      {showMoodOverlaySettings && createPortal(
	        <>
	          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: WRITING_OVERLAY_Z_INDEX }} onClick={() => setShowMoodOverlaySettings(false)} />
	          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", maxWidth: "calc(100vw - 40px)", maxHeight: "86vh", overflowY: "auto", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "22px", zIndex: WRITING_OVERLAY_Z_INDEX + 1, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
	            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
	              <h2 style={{ margin: 0, fontSize: "18px" }}>Writing Settings</h2>
	              <button type="button" onClick={() => setShowMoodOverlaySettings(false)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>×</button>
	            </div>
		            <div style={{ display: "grid", gap: "16px" }}>
		              <div style={{ display: "grid", gap: "10px" }}>
		                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
		                  <input type="checkbox" checked={showWritingTimeline} onChange={(e) => setShowWritingTimeline(e.target.checked)} />
		                  Scene Timeline
		                </label>
		                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
		                  <input type="checkbox" checked={showBeatsTrack} onChange={(e) => setShowBeatsTrack(e.target.checked)} />
		                  Beats Timeline
		                </label>
		                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#333" }}>
		                  <input type="checkbox" checked={showWritingSceneNumbers} onChange={(e) => setShowWritingSceneNumbers(e.target.checked)} />
		                  Scene Numbers
		                </label>
		              </div>

			              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#555" }}>
			                <strong style={{ minWidth: "118px" }}>Target Script Pages:</strong>
			                <input
		                  type="number"
		                  min="1"
	                  value={targetPageCount === "" ? "" : targetPageCount}
	                  onChange={(e) => {
	                    const rawValue = e.target.value;
	                    if (rawValue === "") { setTargetPageCount(""); return; }
	                    const parsedValue = parseInt(rawValue, 10);
	                    if (!Number.isNaN(parsedValue)) setTargetPageCount(parsedValue);
		                  }}
		                  onBlur={() => { if (targetPageCount === "" || Number(targetPageCount) < 1) setTargetPageCount(1); }}
		                  style={{ width: "64px", padding: "5px 7px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", boxSizing: "border-box", fontVariantNumeric: "tabular-nums" }}
			                />
			              </label>

		              <div style={{ display: "grid", gap: "8px" }}>
		                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr", alignItems: "center", gap: "8px" }}>
		                  <input type="checkbox" checked={titlePageSettings.enabled} onChange={(e) => toggleTitlePageEnabled(e.target.checked)} style={{ margin: 0, justifySelf: "start" }} />
		                  <button
		                    type="button"
		                    onClick={openTitlePageSettings}
		                    style={{ padding: "8px 10px", backgroundColor: titlePageSettings.enabled ? "#e8f0fe" : "#f7f7f7", border: `1px solid ${titlePageSettings.enabled ? "#90caf9" : "#ddd"}`, borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", color: titlePageSettings.enabled ? APP_TAB_BLUE : "#333", textAlign: "left" }}
		                  >
		                    Title Page Settings...
		                  </button>
		                </div>
		                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr", alignItems: "center", gap: "8px" }}>
		                  <input type="checkbox" checked={showMoodOverlay} onChange={(e) => setShowMoodOverlay(e.target.checked)} style={{ margin: 0, justifySelf: "start" }} />
		                  <button
		                    type="button"
		                    onClick={() => setShowMoodOverlayDetailSettings(true)}
		                    style={{ padding: "8px 10px", backgroundColor: showMoodOverlay ? "#e8f0fe" : "#f7f7f7", border: `1px solid ${showMoodOverlay ? "#90caf9" : "#ddd"}`, borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", color: showMoodOverlay ? APP_TAB_BLUE : "#333", textAlign: "left" }}
		                  >
		                    Mood Overlay Settings...
		                  </button>
		                </div>
		              </div>
		            </div>
		            <button type="button" onClick={() => setShowMoodOverlaySettings(false)} style={{ width: "100%", marginTop: "18px", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Done</button>
		          </div>
		        </>,
	        document.body
	      )}

	      {showShareScriptModal && createPortal((() => {
	        const activeLinks = scriptShareLinks.filter(link => link?.is_active);
	        const activeLink = activeLinks[0] || null;
	        const activeWatermarkLink = activeLinks.find(link => link?.id === shareWatermarkLinkId) || null;
	        return (
	          <>
	            <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: WRITING_OVERLAY_Z_INDEX }} onClick={() => { setShowShareScriptModal(false); setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} />
	            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "520px", maxWidth: "calc(100vw - 40px)", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "22px", zIndex: WRITING_OVERLAY_Z_INDEX + 1, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
	              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
	                <div>
	                  <h2 style={{ margin: 0, fontSize: "18px" }}>Share Script</h2>
	                  <div style={{ marginTop: "4px", fontSize: "12px", color: "#607D8B" }}>Public read-only link for the Writing script only.</div>
	                </div>
	                <button type="button" onClick={() => { setShowShareScriptModal(false); setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>×</button>
	              </div>

	              <div style={{ display: "grid", gap: "12px", fontSize: "12px", color: "#455A64" }}>
	                {scriptShareStatus === "loading" ? (
	                  <div style={{ padding: "18px", textAlign: "center", border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "#fafafa" }}>Loading share links...</div>
	                ) : activeLink ? (
	                  <div style={{ display: "grid", gap: "10px" }}>
	                    {activeLinks.map((link) => {
	                      const shareUrl = link?.token ? `${window.location.origin}/share/script/${link.token}` : "";
	                      return (
	                        <div key={link.id} style={{ display: "grid", gap: "10px", padding: "12px", border: "1px solid #d7dde2", borderRadius: "6px", backgroundColor: "#fafafa" }}>
	                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
	                            <strong style={{ color: "#263238" }}>Active public link</strong>
	                            <span style={{ color: "#78909C", fontSize: "11px" }}>
	                              {link.created_at ? new Date(link.created_at).toLocaleString() : ""}
	                            </span>
	                          </div>
	                          <label style={{ display: "grid", gap: "4px" }}>
	                            <span style={{ fontWeight: "bold", color: "#455A64" }}>Label</span>
	                            <input
	                              type="text"
	                              defaultValue={link.label || ""}
	                              maxLength={160}
	                              placeholder="Add label"
	                              onBlur={(event) => saveScriptShareLinkLabel(link, event.target.value)}
	                              onKeyDown={(event) => {
	                                if (event.key === "Enter") event.currentTarget.blur();
	                              }}
	                              style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }}
	                            />
	                          </label>
	                          <input
	                            readOnly
	                            value={shareUrl}
	                            onFocus={(event) => event.target.select()}
	                            style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", fontFamily: "'Courier Prime', Courier, monospace", boxSizing: "border-box" }}
	                          />
	                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
	                            <button type="button" onClick={() => openShareWatermarkSettings(link)} style={{ padding: "7px 10px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", color: "#333", cursor: "pointer", fontWeight: "bold" }}>Watermark Settings...</button>
	                            <button type="button" onClick={() => copyScriptShareLink(link.token)} style={{ padding: "7px 10px", border: "1px solid #90caf9", borderRadius: "4px", backgroundColor: "#e8f0fe", color: APP_TAB_BLUE, cursor: "pointer", fontWeight: "bold" }}>Copy Link</button>
	                            <button type="button" disabled={scriptShareStatus === "saving"} onClick={() => handleRevokeScriptShareLink(link.id)} style={{ padding: "7px 10px", border: "1px solid #ffcdd2", borderRadius: "4px", backgroundColor: "#ffebee", color: "#c62828", cursor: scriptShareStatus === "saving" ? "default" : "pointer", fontWeight: "bold", opacity: scriptShareStatus === "saving" ? 0.65 : 1 }}>Revoke Link</button>
	                          </div>
	                        </div>
	                      );
	                    })}
	                  </div>
	                ) : (
	                  <div style={{ display: "grid", gap: "10px", padding: "12px", border: "1px solid #d7dde2", borderRadius: "6px", backgroundColor: "#fafafa" }}>
	                    <div>No active share link exists for this Writing script.</div>
	                    <button type="button" disabled={scriptShareStatus === "saving"} onClick={handleCreateScriptShareLink} style={{ justifySelf: "start", padding: "8px 12px", border: "none", borderRadius: "4px", backgroundColor: APP_TAB_BLUE, color: "white", cursor: scriptShareStatus === "saving" ? "default" : "pointer", fontWeight: "bold", opacity: scriptShareStatus === "saving" ? 0.65 : 1 }}>
	                      {scriptShareStatus === "saving" ? "Creating..." : "Create Share Link"}
	                    </button>
	                  </div>
	                )}

	                {scriptShareMessage && (
	                  <div style={{ color: scriptShareStatus === "error" ? SAVE_STATUS_ERROR_RED : "#607D8B", minHeight: "16px", wordBreak: "break-word" }}>
	                    {scriptShareMessage}
	                  </div>
	                )}
	                <div style={{ color: "#78909C", fontSize: "11px", lineHeight: 1.45 }}>
	                  The public viewer uses a tokenized RPC and does not expose project members, production modules, or full project settings.
	                </div>
	              </div>

	              <button type="button" onClick={() => { setShowShareScriptModal(false); setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} style={{ width: "100%", marginTop: "18px", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Done</button>
	            </div>
	            {showShareWatermarkSettings && activeWatermarkLink && (
	              <>
	                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.18)", zIndex: WRITING_OVERLAY_Z_INDEX + 2 }} onClick={() => { setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} />
	                <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", maxWidth: "calc(100vw - 40px)", maxHeight: "86vh", overflowY: "auto", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "20px", zIndex: WRITING_OVERLAY_Z_INDEX + 3, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
	                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
	                    <div>
	                      <h3 style={{ margin: 0, fontSize: "16px" }}>Watermark Settings</h3>
	                      <div style={{ marginTop: "4px", fontSize: "11px", color: "#607D8B" }}>Applies to this public share link.</div>
	                    </div>
	                    <button type="button" onClick={() => { setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>×</button>
	                  </div>
		                  <div style={{ display: "grid", gap: "12px", fontSize: "12px", color: "#455A64" }}>
		                    {(() => {
		                      const sectionStyle = { display: "grid", gap: "10px", padding: "12px", border: "1px solid #e4e7eb", borderRadius: "8px", backgroundColor: "#fafafa" };
		                      const sectionHeadingStyle = { margin: 0, fontSize: "12px", color: "#333", letterSpacing: "0.02em", textTransform: "uppercase" };
		                      const rowStyle = { display: "grid", gridTemplateColumns: "116px 1fr 64px 28px", alignItems: "center", gap: "10px" };
		                      const numberStyle = { width: "64px", padding: "4px 6px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" };
		                      return (
		                        <>
		                          <section style={sectionStyle}>
		                            <h4 style={sectionHeadingStyle}>Text</h4>
		                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
		                              <input type="checkbox" checked={scriptShareWatermarkDraft.enabled} onChange={(event) => updateShareWatermarkDraft({ enabled: event.target.checked })} />
		                              <strong>Show watermark</strong>
		                            </label>
		                            <label style={{ display: "grid", gap: "4px" }}>
		                              <strong>Watermark text</strong>
		                              <input type="text" value={scriptShareWatermarkDraft.text} maxLength={120} placeholder={selectedProject?.name || "SHARED SCRIPT"} onChange={(event) => updateShareWatermarkDraft({ text: event.target.value })} style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }} />
		                            </label>
		                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
		                              <input type="checkbox" checked={scriptShareWatermarkDraft.recipientNameEnabled} onChange={(event) => updateShareWatermarkDraft({ recipientNameEnabled: event.target.checked })} />
		                              <strong>Include recipient name</strong>
		                            </label>
		                            <label style={{ display: "grid", gap: "4px", opacity: scriptShareWatermarkDraft.recipientNameEnabled ? 1 : 0.55 }}>
		                              <strong>Recipient name</strong>
		                              <input type="text" value={scriptShareWatermarkDraft.recipientName} maxLength={120} disabled={!scriptShareWatermarkDraft.recipientNameEnabled} onChange={(event) => updateShareWatermarkDraft({ recipientName: event.target.value })} style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }} />
		                            </label>
		                          </section>
		                          <section style={sectionStyle}>
		                            <h4 style={sectionHeadingStyle}>Appearance</h4>
		                            <label style={rowStyle}>
		                              <strong>Opacity</strong>
		                              <input type="range" min="0" max="25" step="1" value={Math.min(25, Math.round(scriptShareWatermarkDraft.opacity * 100))} onChange={(event) => updateShareWatermarkDraft({ opacity: clampNumber(event.target.value, 0, 25, 10) / 100 })} />
		                              <input type="number" min="0" max="100" step="1" value={Math.round(scriptShareWatermarkDraft.opacity * 100)} onChange={(event) => updateShareWatermarkDraft({ opacity: clampNumber(event.target.value, 0, 100, 10) / 100 })} style={numberStyle} />
		                              <span>%</span>
		                            </label>
		                            <label style={rowStyle}>
		                              <strong>Size</strong>
		                              <input type="range" min="24" max="96" step="1" value={scriptShareWatermarkDraft.fontSizePx} onChange={(event) => updateShareWatermarkDraft({ fontSizePx: event.target.value })} />
		                              <input type="number" min="24" max="96" step="1" value={scriptShareWatermarkDraft.fontSizePx} onChange={(event) => updateShareWatermarkDraft({ fontSizePx: event.target.value })} style={numberStyle} />
		                              <span>px</span>
		                            </label>
		                            <label style={rowStyle}>
		                              <strong>Rotation</strong>
		                              <input type="range" min="-60" max="60" step="1" value={scriptShareWatermarkDraft.rotationDeg} onChange={(event) => updateShareWatermarkDraft({ rotationDeg: event.target.value })} />
		                              <input type="number" min="-60" max="60" step="1" value={scriptShareWatermarkDraft.rotationDeg} onChange={(event) => updateShareWatermarkDraft({ rotationDeg: event.target.value })} style={numberStyle} />
		                              <span>°</span>
		                            </label>
		                          </section>
		                          <section style={sectionStyle}>
		                            <h4 style={sectionHeadingStyle}>Branding Image</h4>
		                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
		                              <input type="checkbox" checked={scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageEnabled: event.target.checked })} />
		                              <strong>Show branding image</strong>
		                            </label>
		                            <label style={{ display: "grid", gap: "4px", opacity: scriptShareWatermarkDraft.brandingImageEnabled ? 1 : 0.55 }}>
		                              <strong>Image URL</strong>
		                              <input type="url" value={scriptShareWatermarkDraft.brandingImageUrl} disabled={!scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageUrl: event.target.value })} style={{ width: "100%", padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }} />
		                            </label>
		                            <label style={{ ...rowStyle, opacity: scriptShareWatermarkDraft.brandingImageEnabled ? 1 : 0.55 }}>
		                              <strong>Image size</strong>
		                              <input type="range" min="40" max="300" step="1" value={scriptShareWatermarkDraft.brandingImageSizePx} disabled={!scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageSizePx: event.target.value })} />
		                              <input type="number" min="40" max="300" step="1" value={scriptShareWatermarkDraft.brandingImageSizePx} disabled={!scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageSizePx: event.target.value })} style={numberStyle} />
		                              <span>px</span>
		                            </label>
		                            <label style={{ ...rowStyle, opacity: scriptShareWatermarkDraft.brandingImageEnabled ? 1 : 0.55 }}>
		                              <strong>Image opacity</strong>
		                              <input type="range" min="0" max="50" step="1" value={Math.min(50, Math.round(scriptShareWatermarkDraft.brandingImageOpacity * 100))} disabled={!scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageOpacity: clampNumber(event.target.value, 0, 50, 12) / 100 })} />
		                              <input type="number" min="0" max="100" step="1" value={Math.round(scriptShareWatermarkDraft.brandingImageOpacity * 100)} disabled={!scriptShareWatermarkDraft.brandingImageEnabled} onChange={(event) => updateShareWatermarkDraft({ brandingImageOpacity: clampNumber(event.target.value, 0, 100, 12) / 100 })} style={numberStyle} />
		                              <span>%</span>
		                            </label>
		                          </section>
		                        </>
		                      );
		                    })()}
		                  </div>
	                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "16px" }}>
	                    <button type="button" onClick={() => { setShowShareWatermarkSettings(false); setShareWatermarkLinkId(null); }} style={{ padding: "8px 12px", backgroundColor: "#f7f7f7", color: "#333", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
	                    <button type="button" disabled={scriptShareStatus === "saving"} onClick={() => saveShareWatermarkSettings(activeWatermarkLink.id)} style={{ padding: "8px 14px", backgroundColor: APP_TAB_BLUE, color: "white", border: "none", borderRadius: "4px", cursor: scriptShareStatus === "saving" ? "default" : "pointer", fontWeight: "bold", opacity: scriptShareStatus === "saving" ? 0.65 : 1 }}>
	                      {scriptShareStatus === "saving" ? "Saving..." : "Save"}
	                    </button>
	                  </div>
	                </div>
	              </>
	            )}
	          </>
	        );
	      })(), document.body)}

	      {showMoodOverlayDetailSettings && createPortal((() => {
	        const safeMoodSettings = normalizeMoodOverlaySettings(moodOverlaySettings);
	        const activeOpacityPercent = Math.round(safeMoodSettings.activeOpacity * 100);
	        const rowStyle = { display: "grid", gridTemplateColumns: "110px 1fr 64px 28px", alignItems: "center", gap: "10px", fontSize: "12px", color: "#555" };
	        const sectionStyle = { display: "grid", gap: "12px", padding: "12px", border: "1px solid #e4e7eb", borderRadius: "8px", backgroundColor: "#fafafa" };
	        const sectionHeadingStyle = { margin: 0, fontSize: "12px", color: "#333", letterSpacing: "0.02em", textTransform: "uppercase" };
	        const explainerStyle = { fontSize: "11px", color: "#888", lineHeight: 1.45, marginTop: "-2px" };
	        const numberInputStyle = { width: "64px", padding: "4px 6px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" };
	        const setOpacityPercent = (key, value, fallbackPercent, mirrorLegacyOpacity = false) => {
	          const nextOpacity = clampNumber(value, 0, 100, fallbackPercent) / 100;
	          setMoodOverlaySettings(prev => ({
	            ...prev,
	            ...(mirrorLegacyOpacity ? { opacity: nextOpacity } : {}),
	            [key]: nextOpacity,
	          }));
	          if (key === "activeOpacity") setMoodOverlayOpacity(nextOpacity);
	        };
	        const renderRangeNumberControl = ({ label, value, min, max, step = 1, unit = "", onChange }) => (
	          <label style={rowStyle}>
	            <strong>{label}</strong>
	            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
	            <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} style={numberInputStyle} />
	            <span style={{ textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{unit}</span>
	          </label>
	        );

	        return (
	        <>
	          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: WRITING_OVERLAY_Z_INDEX }} onClick={() => setShowMoodOverlayDetailSettings(false)} />
	          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "500px", maxWidth: "calc(100vw - 40px)", backgroundColor: "white", borderRadius: "10px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "22px", zIndex: WRITING_OVERLAY_Z_INDEX + 1, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
	            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
	              <h2 style={{ margin: 0, fontSize: "18px" }}>Mood Overlay Settings</h2>
	              <button type="button" onClick={() => setShowMoodOverlayDetailSettings(false)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>×</button>
	            </div>
	            <div style={{ display: "grid", gap: "14px" }}>
	              <section style={sectionStyle}>
	                <h3 style={sectionHeadingStyle}>Opacity</h3>
	                <label style={rowStyle}>
	                  <strong>Active opacity</strong>
	                  <input type="range" min="0" max="50" step="1" value={Math.min(activeOpacityPercent, 50)} onChange={(e) => setOpacityPercent("activeOpacity", e.target.value, 30, true)} />
	                  <input type="number" min="0" max="100" step="1" value={activeOpacityPercent} onChange={(e) => setOpacityPercent("activeOpacity", e.target.value, 0, true)} style={numberInputStyle} />
	                  <span style={{ textAlign: "left", fontVariantNumeric: "tabular-nums" }}>%</span>
	                </label>
	                <label style={rowStyle}>
	                  <strong>Max opacity</strong>
	                  <input type="range" min="0" max="100" step="1" value={Math.round(safeMoodSettings.maxOpacity * 100)} onChange={(e) => setOpacityPercent("maxOpacity", e.target.value, 100)} />
	                  <input type="number" min="0" max="100" step="1" value={Math.round(safeMoodSettings.maxOpacity * 100)} onChange={(e) => setOpacityPercent("maxOpacity", e.target.value, 100)} style={numberInputStyle} />
	                  <span style={{ textAlign: "left", fontVariantNumeric: "tabular-nums" }}>%</span>
	                </label>
	                <div style={explainerStyle}>Active opacity is the normal working opacity. Max opacity sets the overlay opacity after timeout.</div>
	              </section>

	              <section style={sectionStyle}>
	                <h3 style={sectionHeadingStyle}>Time</h3>
	                {renderRangeNumberControl({
	                  label: "Cycle",
	                  value: safeMoodSettings.refreshSeconds,
	                  min: 0,
	                  max: 60,
	                  step: 5,
	                  unit: "s",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, refreshSeconds: Math.round(clampNumber(value, 0, 60, 0)) })),
	                })}
	                {renderRangeNumberControl({
	                  label: "Image fade",
	                  value: safeMoodSettings.imageFadeDurationSeconds,
	                  min: 0.1,
	                  max: 10,
	                  step: 0.1,
	                  unit: "s",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, imageFadeDurationSeconds: Math.round(clampNumber(value, 0.1, 10, DEFAULT_MOOD_OVERLAY_SETTINGS.imageFadeDurationSeconds) * 10) / 10 })),
	                })}
	                {renderRangeNumberControl({
	                  label: "Fade time",
	                  value: safeMoodSettings.fadeDurationSeconds,
	                  min: 1,
	                  max: 300,
	                  unit: "s",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, fadeDurationSeconds: Math.round(clampNumber(value, 1, 300, 60)) })),
	                })}
	                {renderRangeNumberControl({
	                  label: "Inactivity time",
	                  value: safeMoodSettings.inactivityDelaySeconds,
	                  min: 0,
	                  max: 120,
	                  unit: "s",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, inactivityDelaySeconds: Math.round(clampNumber(value, 0, 120, 10)) })),
	                })}
	                <div style={explainerStyle}>Cycle controls when image transitions begin. Image fade controls only the image-to-image crossfade. Cycle set to 0 means the image order will stay fixed.</div>
	              </section>

	              <section style={sectionStyle}>
	                <h3 style={sectionHeadingStyle}>Visual</h3>
	                {renderRangeNumberControl({
	                  label: "Columns",
	                  value: safeMoodSettings.columns,
	                  min: 2,
	                  max: 10,
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, columns: Math.round(clampNumber(value, 2, 10, 4)) })),
	                })}
	                {renderRangeNumberControl({
	                  label: "Image spacing",
	                  value: safeMoodSettings.imageGapPx,
	                  min: 0,
	                  max: 80,
	                  unit: "px",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, imageGapPx: Math.round(clampNumber(value, 0, 80, 8)) })),
	                })}
	                {renderRangeNumberControl({
	                  label: "Image radius",
	                  value: safeMoodSettings.imageBorderRadiusPx,
	                  min: 0,
	                  max: 80,
	                  unit: "px",
	                  onChange: (value) => setMoodOverlaySettings(prev => ({ ...prev, imageBorderRadiusPx: Math.round(clampNumber(value, 0, 80, 0)) })),
	                })}
	                <label style={{ display: "grid", gridTemplateColumns: "110px 36px 1fr 28px", alignItems: "center", gap: "10px", fontSize: "12px", color: "#555" }}>
	                  <strong>Background</strong>
	                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(safeMoodSettings.backgroundColor || "") ? safeMoodSettings.backgroundColor : "#000000"} onChange={(e) => setMoodOverlaySettings(prev => ({ ...prev, backgroundColor: e.target.value }))} style={{ width: "36px", height: "28px", padding: 0, border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "transparent", boxSizing: "border-box" }} />
	                  <input type="text" value={moodOverlaySettings.backgroundColor ?? "#000000"} onChange={(e) => setMoodOverlaySettings(prev => ({ ...prev, backgroundColor: normalizeMoodOverlayColor(e.target.value, prev.backgroundColor || "#000000") }))} style={{ width: "100%", padding: "4px 6px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "12px", fontFamily: "'Courier Prime', Courier, monospace", boxSizing: "border-box" }} />
	                  <span />
	                </label>
	              </section>
	            </div>
	            <button type="button" onClick={() => setShowMoodOverlayDetailSettings(false)} style={{ width: "100%", marginTop: "18px", padding: "9px", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Done</button>
	          </div>
	        </>
	        );
	      })(), document.body)}

	      {showTitlePageSettings && createPortal(
	        <>
	          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: WRITING_OVERLAY_Z_INDEX }} onClick={() => setShowTitlePageSettings(false)} />
	          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "560px", maxWidth: "calc(100vw - 40px)", maxHeight: "86vh", overflowY: "auto", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", padding: "20px", zIndex: WRITING_OVERLAY_Z_INDEX + 1, fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
	            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
	              <h2 style={{ margin: 0, fontSize: "18px" }}>Title Page Settings</h2>
	              <button type="button" onClick={() => setShowTitlePageSettings(false)} style={{ border: "none", backgroundColor: "#eee", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "bold" }}>x</button>
		            </div>
		            <div style={{ display: "grid", gap: "10px", fontSize: "12px" }}>
		              {[
	                ["title", "Title"],
	                ["creditLabel", "Credit label"],
	                ["writerName", "Writer name"],
	                ["revisionsLabel", "Revisions by label"],
	                ["currentRevisionsLabel", "Current revisions by label"],
	              ].map(([field, label]) => (
	                <label key={field} style={{ display: "grid", gap: "4px" }}>
	                  <span style={{ fontWeight: "bold", color: "#555" }}>{label}</span>
	                  <input
	                    value={titlePageSettingsDraft[field] || ""}
	                    onChange={(event) => updateTitlePageSettingsDraft(field, event.target.value)}
	                    style={{ padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "'Courier Prime', Courier, monospace", fontSize: "12px" }}
	                  />
	                </label>
	              ))}
	              {[
	                ["revisionsText", "Revisions by text"],
	                ["currentRevisionsText", "Current revisions text"],
	                ["contactBlock", "Contact block"],
	              ].map(([field, label]) => (
	                <label key={field} style={{ display: "grid", gap: "4px" }}>
	                  <span style={{ fontWeight: "bold", color: "#555" }}>{label}</span>
	                  <textarea
	                    value={titlePageSettingsDraft[field] || ""}
	                    onChange={(event) => updateTitlePageSettingsDraft(field, event.target.value)}
	                    rows={field === "contactBlock" ? 3 : 2}
	                    style={{ padding: "7px 8px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "'Courier Prime', Courier, monospace", fontSize: "12px", resize: "vertical" }}
	                  />
	                </label>
	              ))}
	              <div style={{ color: titlePageSaveStatus === "error" ? SAVE_STATUS_ERROR_RED : "#607D8B", minHeight: "16px" }}>
	                {titlePageSaveStatus === "saving" ? "Saving..." : titlePageSaveStatus === "local" ? "Saved locally; database save failed." : titlePageSaveStatus === "error" ? "Could not save title page settings." : ""}
	              </div>
	            </div>
	            <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", marginTop: "18px" }}>
	              <button type="button" onClick={resetTitlePageSettingsToReference} style={{ padding: "8px 10px", backgroundColor: "#f7f7f7", color: "#333", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Reset to Reference Defaults</button>
	              <div style={{ display: "flex", gap: "8px" }}>
	                <button type="button" onClick={() => setShowTitlePageSettings(false)} style={{ padding: "8px 12px", backgroundColor: "#f7f7f7", color: "#333", border: "1px solid #ccc", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
	                <button type="button" onClick={saveTitlePageSettings} style={{ padding: "8px 14px", backgroundColor: APP_TAB_BLUE, color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Save</button>
	              </div>
	            </div>
	          </div>
	        </>,
	        document.body
	      )}

        {showMoodOverlay && scriptMoodboardImages.length > 0 && createPortal((() => {
          const baseImages = scriptMoodboardImages.filter(img => img?.url);
          if (!baseImages.length) return null;
          const safeSettings = normalizeMoodOverlaySettings(moodOverlaySettings);
          const imageLimit = 40;
          const makeLayout = (seed) => Array.from({ length: Math.max(imageLimit, baseImages.length) }, (_, i) =>
            baseImages[(i + seed) % baseImages.length]
          );
          const layoutA = makeLayout(0);
          const layoutB = makeLayout(Math.floor(baseImages.length / 2));
          const columns = safeSettings.columns;
          const cycleSeconds = safeSettings.refreshSeconds;
          const useCycle = cycleSeconds > 0;
          const { fadeOutStartPercent, fadeInStartPercent } = getMoodImageCrossfadeKeyframes(cycleSeconds, safeSettings.imageFadeDurationSeconds);
	          const overlayOpacity = Math.min(1, Math.max(0, forceMoodOverlayActiveOpacity ? safeSettings.activeOpacity : moodOverlayOpacity));
          const imageGapPx = safeSettings.imageGapPx;
          const imageBorderRadiusPx = safeSettings.imageBorderRadiusPx;
          const backgroundColor = safeSettings.backgroundColor;
          const layerStyle = {
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            padding: `${imageGapPx}px`,
            boxSizing: "border-box",
          };

          return (
	            <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: WRITING_MOOD_OVERLAY_Z_INDEX, overflow: "hidden", opacity: overlayOpacity, backgroundColor, transition: forceMoodOverlayActiveOpacity ? "none" : "opacity 160ms linear" }}>
              <style>{`
                @keyframes writingMoodFadeA {
                  0%, ${fadeOutStartPercent}% { opacity: 1; }
                  50%, ${fadeInStartPercent}% { opacity: 0; }
                  100% { opacity: 1; }
                }
                @keyframes writingMoodFadeB {
                  0%, ${fadeOutStartPercent}% { opacity: 0; }
                  50%, ${fadeInStartPercent}% { opacity: 1; }
                  100% { opacity: 0; }
                }
                .writing-mood-global-masonry {
                  columns: ${columns};
                  column-gap: ${imageGapPx}px;
                  width: 100%;
                }
                .writing-mood-global-masonry-item {
                  break-inside: avoid;
                  margin-bottom: ${imageGapPx}px;
                  border-radius: ${imageBorderRadiusPx}px;
                  overflow: hidden;
                  border: 2px solid rgba(255,255,255,0.08);
                  background: ${backgroundColor};
                }
                .writing-mood-global-masonry-item img {
                  width: 100%;
                  height: auto;
                  display: block;
                  border-radius: ${imageBorderRadiusPx}px;
                }
              `}</style>
              <div className="writing-mood-layer-a" style={{ ...layerStyle, animation: useCycle ? `writingMoodFadeA ${cycleSeconds}s ease-in-out infinite` : "none" }}>
                <div className="writing-mood-global-masonry">
                  {layoutA.map((img, i) => (
                    <div key={`a-${i}`} className="writing-mood-global-masonry-item">
                      <img src={img.url} alt="" draggable={false} />
                    </div>
                  ))}
                </div>
              </div>
              {useCycle && (
                <div className="writing-mood-layer-b" style={{ ...layerStyle, animation: `writingMoodFadeB ${cycleSeconds}s ease-in-out infinite` }}>
                  <div className="writing-mood-global-masonry">
                    {layoutB.map((img, i) => (
                      <div key={`b-${i}`} className="writing-mood-global-masonry-item">
                        <img src={img.url} alt="" draggable={false} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })(), document.body)}

	      {/* ── Main layout (mirrors Script.js lines 5732–5958) ─────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minWidth: 0, position: "relative", isolation: "isolate", width: "calc(8.5in + 520px)", maxWidth: "calc(8.5in + 520px)", alignSelf: "flex-start", paddingTop: "5px", boxSizing: "border-box" }}>

        {/* Script editor column */}
        <div style={{ width: "8.5in", flex: "0 0 8.5in", minHeight: "auto", display: "flex", flexDirection: "column", border: "none", boxShadow: "none", position: "relative", zIndex: 1, backgroundColor: "transparent", boxSizing: "border-box" }}>
          <div
            ref={editorScrollRef}
            onScroll={handleEditorScroll}
            onBlur={saveEditorPositionNow}
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0", backgroundColor: "transparent", boxSizing: "border-box", fontFamily: "'Courier Prime', Courier, 'Courier New', monospace", fontSize: "12pt", lineHeight: "12pt", position: "relative" }}
	          >
	            <div style={{ position: "relative", zIndex: 1, color: "#000", minHeight: "auto" }}>
	              {titlePageSettings.enabled && (
	                <WritingTitlePagePreview
	                  settings={titlePageSettings}
	                  titlePageRef={titlePageRef}
	                  showMoodOverlay={showMoodOverlay}
	                />
	              )}
	              <ScriptWritingEditor
	                ref={writingEditorRef}
                initialNodes={writingDraftNodes}
                activeElementType={writingEditorElementType}
                onActiveElementTypeChange={setWritingEditorElementType}
                onNodesChange={handleWritingDraftNodesChange}
                sceneRefs={sceneRefs}
                onSceneStatsChange={setWritingScenePageStats}
                onPageCountChange={setWritingRenderedPageCount}
                showSceneNumbers={showWritingSceneNumbers}
                showFloatingElementSelector={false}
                showMoodOverlay={showMoodOverlay}
                spellCheckEnabled={spellCheckEnabled}
              />
            </div>
          </div>
        </div>

        {/* Right panel: Scenes + Beats */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, backgroundColor: showMoodOverlay ? "transparent" : "white", minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{ marginLeft: "20px", width: "492px", display: "flex", flexShrink: 0, gap: "6px", padding: "0 0 5px", boxSizing: "border-box", fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif" }}>
            <button type="button" onClick={() => setActiveSidePanelTab("scenes")} style={{ padding: "6px 12px", border: "1px solid #ccc", borderBottomColor: activeSidePanelTab === "scenes" ? APP_TAB_BLUE : "#ccc", backgroundColor: activeSidePanelTab === "scenes" ? APP_TAB_BLUE : "#f5f5f5", color: activeSidePanelTab === "scenes" ? "white" : "#222", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              Scenes
            </button>
            <button type="button" onClick={() => setActiveSidePanelTab("beats")} style={{ padding: "6px 12px", border: "1px solid #ccc", borderBottomColor: activeSidePanelTab === "beats" ? APP_TAB_BLUE : "#ccc", backgroundColor: activeSidePanelTab === "beats" ? APP_TAB_BLUE : "#f5f5f5", color: activeSidePanelTab === "beats" ? "white" : "#222", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>
              Beats{beats.filter(item => (item.type || "beat") === "beat").length ? ` (${beats.filter(item => (item.type || "beat") === "beat").length})` : ""}
            </button>
            {!isViewOnly && activeSidePanelTab === "beats" && (
              <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                <button type="button" onClick={() => appendOutlineItem("act")} style={{ padding: "6px 8px", backgroundColor: "#607D8B", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Add Act</button>
                <button type="button" onClick={() => appendOutlineItem("beat")} style={{ padding: "6px 8px", backgroundColor: "#6D4C41", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Add Beat</button>
                <button type="button" onClick={handleOpenBeatImport} style={{ padding: "6px 10px", backgroundColor: "#455A64", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "11px" }}>Import Beats</button>
              </div>
            )}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {activeSidePanelTab === "scenes" ? (
              <SceneList
                scenes={writingDraftScenes}
                currentSceneNumber={displaySceneNumber}
                sceneRefs={sceneRefs}
                getSceneStatusColor={() => ({ statusLabel: null })}
                selectedProject={selectedProject}
                user={user}
                onSceneNumberChange={null}
                setCurrentIndex={setCurrentIndex}
                showMoodOverlay={showMoodOverlay}
                canCreateScene={false}
                onCreateFirstScene={null}
                canDeleteScene={false}
                onDeleteScene={null}
	                onReorderScene={handleWritingSceneListReorder}
	                pageStatsBySceneId={writingScenePageStats}
	                onSceneColorChange={handleSceneColorChange}
	                showTitlePage={titlePageSettings.enabled}
	                onTitlePageClick={scrollToTitlePage}
	              />
            ) : (
              <BeatsList
                beats={beats}
                onDeleteItem={deleteOutlineItem}
                onReorderItem={reorderOutlineItem}
                onOpenItem={setSelectedBeatDetailId}
                onConvertItem={null}
                onColorItem={!isViewOnly ? handleBeatMarkerColorChange : null}
                collapsedActIds={collapsedActIds}
                onToggleAct={toggleCollapsedAct}
                showMoodOverlay={showMoodOverlay}
              />
            )}
          </div>
        </div>
      </div>
      {showSpellcheckModal && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: WRITING_OVERLAY_Z_INDEX,
            backgroundColor: "rgba(0,0,0,0.28)",
            fontFamily: "'FPB Century Gothic', 'Century Gothic', 'Futura', 'Arial', sans-serif",
          }}
        >
          <div
            ref={spellcheckModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Writing spellcheck"
            style={{
              position: "fixed",
              left: spellcheckModalPosition?.x ?? "50%",
              top: spellcheckModalPosition?.y ?? "50%",
              transform: spellcheckModalPosition ? "none" : "translate(-50%, -50%)",
              width: "520px",
              maxWidth: "calc(100vw - 32px)",
              backgroundColor: "white",
              border: "1px solid #b0bec5",
              borderRadius: "6px",
              boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
              overflow: "hidden",
            }}
          >
            <div
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                const rect = spellcheckModalRef.current?.getBoundingClientRect();
                setSpellcheckModalDrag({
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: spellcheckModalPosition?.x ?? rect?.left ?? 0,
                  originY: spellcheckModalPosition?.y ?? rect?.top ?? 0,
                });
              }}
              style={{ padding: "10px 12px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", cursor: "move", userSelect: "none" }}
            >
              <strong style={{ fontSize: "13px" }}>Spellcheck</strong>
              <button type="button" onMouseDown={(event) => event.stopPropagation()} onClick={closeSpellcheckModal} style={{ border: "1px solid #ccc", backgroundColor: "#f7f7f7", borderRadius: "4px", padding: "3px 8px", cursor: "pointer" }}>
                Close
              </button>
            </div>
	            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
	              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
	                <div style={{ color: spellcheckerStatus === "ready" ? "#607D8B" : "#b26a00" }}>
	                  {spellcheckerStatus === "ready"
	                    ? "Using the bundled English dictionary for spelling and suggestions."
	                    : spellcheckerStatus === "loading"
	                      ? "Loading bundled English dictionary..."
	                      : `Dictionary failed to initialize; using the small fallback checker. ${spellcheckerError}`}
	                </div>
	                <button
	                  type="button"
	                  onClick={() => setShowUserDictionaryPanel(prev => !prev)}
	                  style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: showUserDictionaryPanel ? "#e8f0fe" : "#f7f7f7", color: showUserDictionaryPanel ? APP_TAB_BLUE : "#333", cursor: "pointer", whiteSpace: "nowrap" }}
	                >
	                  User Dictionary
	                </button>
	              </div>
	              {showUserDictionaryPanel && (
	                <div style={{ border: "1px solid #d7dde2", borderRadius: "4px", backgroundColor: "#fafafa", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
	                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
	                    <strong style={{ fontSize: "12px" }}>User Dictionary</strong>
	                    <span style={{ color: spellcheckDictionarySaveStatus === "error" ? SAVE_STATUS_ERROR_RED : "#607D8B", fontSize: "11px" }}>
	                      {spellcheckDictionarySaveStatus === "saving" ? "Saving..." : spellcheckDictionarySaveStatus === "local" ? "Saved locally" : spellcheckDictionarySaveStatus === "error" ? "Save failed" : "Saved"}
	                    </span>
	                  </div>
	                  {userSpellcheckDictionaryWords.size === 0 ? (
	                    <div style={{ color: "#607D8B" }}>No custom dictionary words yet.</div>
	                  ) : (
	                    <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
	                      {Array.from(userSpellcheckDictionaryWords).sort((a, b) => a.localeCompare(b)).map((word) => (
	                        <div key={word} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 6px", border: "1px solid #eeeeee", borderRadius: "3px", backgroundColor: "white" }}>
	                          <span style={{ fontFamily: "'Courier Prime', Courier, monospace" }}>{word}</span>
	                          <button type="button" onClick={() => removeUserDictionaryWord(word)} style={{ padding: "3px 7px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: "pointer" }}>Remove</button>
	                        </div>
	                      ))}
	                    </div>
	                  )}
	                  {legacyProjectSpellcheckDictionaryWords.size > 0 && (
	                    <div style={{ color: "#607D8B", fontSize: "11px" }}>
	                      Also accepting {legacyProjectSpellcheckDictionaryWords.size} legacy project dictionary word{legacyProjectSpellcheckDictionaryWords.size === 1 ? "" : "s"}.
	                    </div>
	                  )}
	                </div>
	              )}
	              {currentSpellcheckIssue ? (
                <>
                  <div>
                    <div style={{ fontSize: "11px", color: "#607D8B", marginBottom: "3px" }}>Possible misspelling</div>
                    <div style={{ fontSize: "18px", fontWeight: "bold", fontFamily: "'Courier Prime', Courier, monospace" }}>{currentSpellcheckIssue.word}</div>
                  </div>
	                  <div>
	                    <div style={{ fontSize: "11px", color: "#607D8B", marginBottom: "3px" }}>Context</div>
	                    <div style={{ padding: "8px", backgroundColor: "#f7f7f7", border: "1px solid #e0e0e0", borderRadius: "4px", fontFamily: "'Courier Prime', Courier, monospace" }}>
	                      {currentSpellcheckIssue.contextParts ? (
	                        <>
	                          {currentSpellcheckIssue.contextParts.before}
	                          <span style={{ backgroundColor: "#fff59d", borderRadius: "2px", padding: "0 2px", fontWeight: "bold" }}>
	                            {currentSpellcheckIssue.contextParts.word}
	                          </span>
	                          {currentSpellcheckIssue.contextParts.after}
	                        </>
	                      ) : currentSpellcheckIssue.context}
	                    </div>
	                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#607D8B", marginBottom: "3px" }}>Suggestions</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {(currentSpellcheckIssue.suggestions.length ? currentSpellcheckIssue.suggestions : ["No suggestion"]).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          disabled={suggestion === "No suggestion"}
                          onClick={() => setSpellcheckReplacement(suggestion)}
                          style={{ padding: "4px 7px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: suggestion === spellcheckReplacement ? "#e8f0fe" : "#f7f7f7", cursor: suggestion === "No suggestion" ? "default" : "pointer" }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#607D8B" }}>Replacement</span>
                    <input
                      value={spellcheckReplacement}
                      onChange={(event) => setSpellcheckReplacement(event.target.value)}
                      style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: "4px", fontFamily: "'Courier Prime', Courier, monospace" }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button type="button" onClick={replaceCurrentSpellcheckIssue} style={{ padding: "6px 9px", border: "none", borderRadius: "4px", backgroundColor: APP_TAB_BLUE, color: "white", cursor: "pointer" }}>Replace</button>
                    <button type="button" onClick={replaceAllCurrentSpellcheckIssues} style={{ padding: "6px 9px", border: "1px solid #90caf9", borderRadius: "4px", backgroundColor: "#e8f0fe", color: APP_TAB_BLUE, cursor: "pointer" }}>Replace All</button>
                    <button type="button" onClick={() => setSpellcheckIgnoredWords(prev => new Set(prev).add(currentSpellcheckIssue.normalized))} style={{ padding: "6px 9px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: "pointer" }}>Ignore</button>
                    <button type="button" onClick={() => setSpellcheckIgnoredWords(prev => new Set(prev).add(currentSpellcheckIssue.normalized))} style={{ padding: "6px 9px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: "pointer" }}>Ignore All</button>
                    <button type="button" onClick={addCurrentSpellcheckWordToDictionary} style={{ padding: "6px 9px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: "pointer" }}>Add to Dictionary</button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eeeeee", paddingTop: "8px" }}>
                    <span style={{ color: "#607D8B" }}>{spellcheckIndex + 1} of {spellcheckIssues.length}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button type="button" onClick={() => setSpellcheckIndex(prev => Math.max(0, prev - 1))} disabled={spellcheckIndex <= 0} style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: spellcheckIndex <= 0 ? "default" : "pointer" }}>Previous</button>
                      <button type="button" onClick={goToNextSpellcheckIssue} disabled={spellcheckIndex >= spellcheckIssues.length - 1} style={{ padding: "5px 8px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: spellcheckIndex >= spellcheckIssues.length - 1 ? "default" : "pointer" }}>Next</button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: "22px", textAlign: "center", color: "#607D8B" }}>
                  {spellcheckIssues.length > 0 ? (
                    <>
                      <div>Spellcheck complete.</div>
                      <button type="button" onClick={() => setSpellcheckIndex(0)} style={{ marginTop: "10px", padding: "5px 10px", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f7f7f7", cursor: "pointer" }}>Start Over</button>
                    </>
                  ) : (
                    "No possible misspellings found by the built-in checker."
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default WritingScript;
