import { parseSceneHeading } from "../utils.js";
import { createSceneId } from "./sceneIdentity";

const VALID_SCRIPT_TYPES = new Set([
  "Scene Heading",
  "Action",
  "Character",
  "Dialogue",
  "Parenthetical",
  "Transition",
  "Shot",
]);

const TITLE_PAGE_TYPES = new Set([
  "Title",
  "Credit",
  "Author",
  "Contact",
  "Copyright",
  "Draft date",
  "More Title",
  null,
]);

const normalizeWhitespace = (value = "") =>
  String(value || "")
    // Non-breaking space \u2192 regular space
    .replace(/\u00a0/g, " ")
    // MacRoman left double quote (\u00d2 = 0xD2), WinAnsi left double (0x93), Unicode left double (U+201C) \u2192 "
    .replace(/[\u00d2\u0093\u201c]/g, '"')
    // MacRoman right double quote (\u00d3 = 0xD3), WinAnsi right double (0x94), Unicode right double (U+201D) \u2192 "
    .replace(/[\u00d3\u0094\u201d]/g, '"')
    // MacRoman left single (\u00d4 = 0xD4), WinAnsi left single (0x91), Unicode left single (U+2018), MacRoman right single (\u00d5 = 0xD5), WinAnsi right single (0x92), Unicode right single (U+2019) \u2192 '
    .replace(/[\u00d4\u00d5\u0091\u0092\u2018\u2019]/g, "'")
    // Collapse runs of spaces/tabs
    .replace(/[ \t]+/g, " ")
    .trim();

const normalizeBlockType = (type) => VALID_SCRIPT_TYPES.has(type) ? type : "Action";

const isSceneHeadingLine = (line = "") => {
  const text = normalizeWhitespace(line).toUpperCase();
  return /^(?:\d+[A-Z]?\s+)?(?:INT|EXT|EST|INT\/EXT|INT\.\/EXT|EXT\/INT|EXT\.\/INT|I\/E)\.?\s+/.test(text);
};

const isTransitionLine = (line = "") => {
  const text = normalizeWhitespace(line).toUpperCase();
  return text === "FADE IN:" || text === "FADE OUT." || text === "FADE OUT:" || text === "THE END" || /(?:CUT|SMASH CUT|DISSOLVE|MATCH CUT|FADE) TO:$/.test(text);
};

const isParentheticalLine = (line = "") => /^\([^)]{1,80}\)$/.test(normalizeWhitespace(line));

const normalizeContinuationMarker = (text = "") =>
  normalizeWhitespace(text).replace(/[‘’]/g, "'").replace(/\s+/g, "").toUpperCase();

const isCharacterContinuationMarker = (text = "") =>
  /^\(CONT'?D\.?\)$/.test(normalizeContinuationMarker(text));

const formatCharacterContinuationMarker = (text = "") => {
  const marker = normalizeContinuationMarker(text);
  if (marker === "(CONTD.)" || marker === "(CONT'D.)") return "(CONT'D.)";
  return "(CONT'D)";
};

const stripCharacterContinuationMarker = (text = "") =>
  normalizeWhitespace(text).replace(/\s+\(CONT['’]?D\.?\)$/i, "");

export const normalizeCharacterContinuationMarkers = (scenes = []) =>
  (Array.isArray(scenes) ? scenes : []).map((scene) => {
    const normalizedContent = [];
    const content = Array.isArray(scene?.content) ? scene.content : [];

    content.forEach((block) => {
      const previousBlock = normalizedContent[normalizedContent.length - 1];

      if (
        block?.type === "Parenthetical" &&
        previousBlock?.type === "Character" &&
        isCharacterContinuationMarker(block.text)
      ) {
        previousBlock.text = `${stripCharacterContinuationMarker(previousBlock.text)} ${formatCharacterContinuationMarker(block.text)}`;
        return;
      }

      normalizedContent.push({ ...block });
    });

    return {
      ...scene,
      content: normalizedContent,
    };
  });

const splitDialogueLineByParentheticals = (line = "") => {
  const text = normalizeWhitespace(line);
  if (!text || !/\([^)]{1,80}\)/.test(text)) return [{ type: "Dialogue", text }];

  const parts = [];
  let cursor = 0;
  const parentheticalPattern = /\([^)]{1,80}\)/g;
  let match;

  while ((match = parentheticalPattern.exec(text))) {
    const before = normalizeWhitespace(text.slice(cursor, match.index));
    if (before) parts.push({ type: "Dialogue", text: before });
    parts.push({ type: "Parenthetical", text: normalizeWhitespace(match[0]) });
    cursor = match.index + match[0].length;
  }

  const after = normalizeWhitespace(text.slice(cursor));
  if (after) parts.push({ type: "Dialogue", text: after });
  return parts.length ? parts : [{ type: "Dialogue", text }];
};

// Matches third-person singular action verbs common in screenplay action prose.
// Deliberately excludes ambiguous verbs (looks, sees, hears) to reduce false positives.
const SCREENPLAY_ACTION_VERB_RE = /\b(walks?|turns?|opens?|closes?|stares?|grabs?|moves?|sits?|stands?|exits?|enters?|follows?|pauses?|reaches?|pulls?|pushes?|holds?|drops?|runs?|crosses?|steps?|leans?|watches?|nods?|shakes?|sighs?|glances?|rushes?|slides?|stumbles?|falls?|rises?|puts?|takes?|brings?|carries?)\b/;

const looksLikeActionLine = (line = "") => {
  const text = normalizeWhitespace(line);
  if (!/[a-z]/.test(text)) return false;           // all-caps = character cue or heading, not prose
  if (text.length < 20) return false;               // short lines are likely interjections or dialogue
  if (text.endsWith("?") || text.endsWith("!")) return false; // questions/exclamations are usually dialogue
  return SCREENPLAY_ACTION_VERB_RE.test(text);
};

// Returns true for lines that are probably spoken Dialogue: has lowercase, is not a structural
// element (scene heading, transition, character, parenthetical), and does not look like Action.
// Used only at PDF page-boundary transitions to detect Dialogue → Action structural breaks.
const looksLikeDialogueLine = (line = "") => {
  const text = normalizeWhitespace(line);
  if (!text || !/[a-z]/.test(text)) return false;
  if (isSceneHeadingLine(text) || isTransitionLine(text) || isParentheticalLine(text) || isCharacterLine(text)) return false;
  return !looksLikeActionLine(text);
};

const isCharacterLine = (line = "") => {
  const text = normalizeWhitespace(line);
  if (!text || text.length > 34) return false;
  if (isSceneHeadingLine(text) || isTransitionLine(text) || isParentheticalLine(text)) return false;
  if (/[a-z]/.test(text)) return false;
  if (/[.!?]$/.test(text)) return false;
  return /^[A-Z0-9][A-Z0-9 '\-.()]*$/.test(text);
};

const NUMERIC_PDF_ARTIFACT_PATTERN = /(^|\s)\d{2,5}\.{2,}(?=\s|$)/g;

const stripInlinePdfNumericArtifacts = (line = "") =>
  normalizeWhitespace(line).replace(NUMERIC_PDF_ARTIFACT_PATTERN, " ").replace(/\s{2,}/g, " ").trim();

const isSentenceCompleteLine = (line = "") =>
  /(?:[.!?…](?:[“’”’)]*)|\.\.\.(?:[“’”’)]*))$/.test(normalizeWhitespace(line));

// Broader than looksLikeActionLine: also catches action prose that opens with a spatial or
// manner adverb (e.g. “Further and further away…”) but lacks an explicit action verb.
const looksLikeActionProse = (line = "") => {
  const text = normalizeWhitespace(line);
  if (!/[a-z]/.test(text)) return false;
  if (text.length < 20) return false;
  if (text.endsWith("?") || text.endsWith("!")) return false;
  if (SCREENPLAY_ACTION_VERB_RE.test(text)) return true;
  return /^(?:slowly|quickly|suddenly|quietly|finally|gently|carefully|desperately|frantically|cautiously|hastily|further|closer|farther|deeper|higher|lower)\b/i.test(text);
};

const isStandalonePdfArtifactLine = (line = "") => {
  const text = normalizeWhitespace(line);
  return /^\d+\.?$/.test(text) ||
    /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(text) ||
    /^\d{2,5}\.{2,}$/.test(text) ||
    /^\(MORE\)$/i.test(text);
};

const getNextCleanPdfTextLine = (lines = [], startIndex = 0) => {
  for (let index = startIndex; index < lines.length; index += 1) {
    const text = normalizeWhitespace(lines[index]);
    if (!text || isStandalonePdfArtifactLine(text)) continue;

    const withoutArtifacts = stripInlinePdfNumericArtifacts(text);
    if (withoutArtifacts) return withoutArtifacts;
  }

  return "";
};

const stripPdfArtifacts = (lines = []) => {
  const cleaned = [];
  let skipNextBlank = false;

  lines.forEach((line, index) => {
    const text = normalizeWhitespace(line);

    if (!text) {
      if (!skipNextBlank) cleaned.push("");
      skipNextBlank = false;
      return;
    }

    if (isStandalonePdfArtifactLine(text)) {
      const previousText = cleaned[cleaned.length - 1] || "";
      const nextText = getNextCleanPdfTextLine(lines, index + 1);
      const shouldPreserveParagraphBoundary =
        previousText &&
        nextText &&
        cleaned[cleaned.length - 1] !== "" &&
        isSentenceCompleteLine(previousText) &&
        looksLikeActionProse(nextText) &&
        (looksLikeActionLine(previousText) || looksLikeDialogueLine(previousText));

      if (shouldPreserveParagraphBoundary) {
        cleaned.push("");
      }

      skipNextBlank = true;
      return;
    }

    const withoutArtifacts = stripInlinePdfNumericArtifacts(text);
    if (!withoutArtifacts) {
      skipNextBlank = true;
      return;
    }

    cleaned.push(withoutArtifacts);
    skipNextBlank = withoutArtifacts !== text;
  });

  const firstScriptLineIndex = cleaned.findIndex(line => isSceneHeadingLine(line) || /^FADE IN:?$/i.test(line));
  return (firstScriptLineIndex > 0 ? cleaned.slice(firstScriptLineIndex) : cleaned)
    .filter((line, index, list) => line !== "" || (index > 0 && index < list.length - 1 && list[index - 1] !== ""));
};

const combineWrappedParentheticalLines = (lines = []) => {
  const combined = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || !line.startsWith("(") || isParentheticalLine(line)) {
      combined.push(line);
      continue;
    }

    const parts = [line];
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor] && !isSceneHeadingLine(lines[cursor]) && !isCharacterLine(lines[cursor]) && !isTransitionLine(lines[cursor])) {
      parts.push(lines[cursor]);
      if (/\)/.test(lines[cursor])) break;
      cursor += 1;
    }

    const candidate = normalizeWhitespace(parts.join(" "));
    if (isParentheticalLine(candidate)) {
      combined.push(candidate);
      index = cursor;
    } else {
      combined.push(line);
    }
  }

  return combined;
};

const createScene = (headingText, sceneNumber) => {
  const heading = normalizeWhitespace(headingText).toUpperCase();
  return {
    id: createSceneId(),
    heading,
    content: [],
    metadata: {
      ...parseSceneHeading(heading),
      originalSceneNumber: sceneNumber,
      originalScriptOrder: sceneNumber - 1,
    },
    sceneNumber,
    estimatedDuration: "30 min",
    status: "Not Scheduled",
  };
};

const getFdxParagraphText = (paragraphElement) => {
  if (!paragraphElement) return "";

  const textElements = Array.from(paragraphElement.childNodes || [])
    .filter((child) => child?.nodeType === 1 && String(child.localName || child.nodeName || "").toLowerCase() === "text");

  if (textElements.length > 0) {
    return normalizeWhitespace(textElements.map((textElement) => textElement.textContent || "").join(""));
  }

  return normalizeWhitespace(paragraphElement.textContent || "");
};

export const parseFinalDraftXmlToScenes = (text = "") => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const paragraphs = Array.from(xmlDoc.getElementsByTagName("Paragraph"));

  const parsedScenes = [];
  let currentScene = null;
  let sceneNumber = 1;

  paragraphs.forEach((para) => {
    const type = para.getAttribute("Type");
    let content = getFdxParagraphText(para);

    if (!content || TITLE_PAGE_TYPES.has(type)) return;

    const formatting = {};
    const textElements = para.getElementsByTagName("Text");
    if (textElements.length > 0) {
      const style = textElements[0].getAttribute("Style") || "";
      if (style) {
        formatting.bold = style.includes("Bold");
        formatting.italic = style.includes("Italic");
        formatting.underline = style.includes("Underline");
      }
    }

    if (type === "Scene Heading") {
      if (currentScene) {
        parsedScenes.push(currentScene);
        sceneNumber += 1;
      }
      currentScene = createScene(content, sceneNumber);
      return;
    }

    if (!currentScene) return;

    if (type === "Character") content = content.toUpperCase();

    currentScene.content.push({
      type: normalizeBlockType(type),
      text: content,
      formatting: Object.keys(formatting).length > 0 ? formatting : null,
    });
  });

  if (currentScene) parsedScenes.push(currentScene);

  return parsedScenes;
};

export const parsePlainScreenplayTextToScenes = (rawText = "") => {
  const lines = combineWrappedParentheticalLines(stripPdfArtifacts(String(rawText || "").split(/\r?\n/)));
  const parsedScenes = [];
  let currentScene = null;
  let sceneNumber = 1;
  let previousType = null;
  let pendingActionLines = [];
  let pendingDialogueLines = [];
  let previousWasBoundary = false;

  const ensureScene = () => {
    if (!currentScene) currentScene = createScene("", sceneNumber);
    return currentScene;
  };

  const commitScene = () => {
    commitPendingText();
    if (!currentScene) return;
    if (currentScene.heading || currentScene.content.some(block => normalizeWhitespace(block.text))) {
      parsedScenes.push(currentScene);
      sceneNumber += 1;
    }
    currentScene = null;
    previousType = null;
  };

  const appendBlock = (type, text) => {
    const scene = ensureScene();
    const previousBlock = scene.content[scene.content.length - 1];

    if (type === "Parenthetical" && previousBlock?.type === "Character" && isCharacterContinuationMarker(text)) {
      previousBlock.text = `${stripCharacterContinuationMarker(previousBlock.text)} ${formatCharacterContinuationMarker(text)}`;
      previousType = "Character";
      return;
    }

    scene.content.push({
      type,
      text: type === "Character" ? text.toUpperCase() : text,
    });
    previousType = type;
  };

  const commitPendingAction = () => {
    if (!pendingActionLines.length) return;
    appendBlock("Action", pendingActionLines.join(" "));
    pendingActionLines = [];
  };

  const commitPendingDialogue = () => {
    if (!pendingDialogueLines.length) return;
    appendBlock("Dialogue", pendingDialogueLines.join(" "));
    pendingDialogueLines = [];
  };

  function commitPendingText() {
    commitPendingDialogue();
    commitPendingAction();
  }

  lines.forEach((line) => {
    const text = normalizeWhitespace(line);
    if (!text) {
      commitPendingText();
      previousType = null;
      return;
    }

    if (isSceneHeadingLine(text)) {
      commitScene();
      currentScene = createScene(text, sceneNumber);
      previousType = "Scene Heading";
      return;
    }

    if (isTransitionLine(text)) {
      commitPendingText();
      appendBlock("Transition", text);
      return;
    }

    if (!currentScene) return;

    if (isCharacterLine(text)) {
      commitPendingText();
      appendBlock("Character", text);
      return;
    }

    if (isCharacterContinuationMarker(text) && currentScene?.content?.[currentScene.content.length - 1]?.type === "Character") {
      commitPendingDialogue();
      commitPendingAction();
      appendBlock("Parenthetical", text);
      return;
    }

    if (isParentheticalLine(text) && (previousType === "Character" || previousType === "Dialogue" || previousType === "Parenthetical" || pendingDialogueLines.length > 0)) {
      commitPendingDialogue();
      commitPendingAction();
      appendBlock("Parenthetical", text);
      return;
    }

    if (previousType === "Character" || previousType === "Dialogue" || previousType === "Parenthetical" || pendingDialogueLines.length > 0) {
      if (
        looksLikeActionProse(text) &&
        !isParentheticalLine(text) &&
        pendingDialogueLines.length > 0 &&
        isSentenceCompleteLine(pendingDialogueLines[pendingDialogueLines.length - 1])
      ) {
        commitPendingDialogue();
        previousType = null;
        pendingActionLines.push(text);
        return;
      }

      splitDialogueLineByParentheticals(text).forEach((part) => {
        if (part.type === "Parenthetical") {
          commitPendingDialogue();
          appendBlock("Parenthetical", part.text);
        } else if (part.text) {
          pendingDialogueLines.push(part.text);
        }
      });
      return;
    }

    pendingActionLines.push(text);
  });

  commitScene();
  return parsedScenes;
};

const bytesToLatin1 = (bytes) => {
  let output = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return output;
};

const decodePdfString = (value = "") => {
  if (value.startsWith("<")) {
    const hex = value.slice(1, -1).replace(/\s+/g, "");
    let output = "";
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isFinite(code) && code > 0) output += String.fromCharCode(code);
    }
    return output;
  }

  const input = value.slice(1, -1);
  let output = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = input[++i];
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/[0-7]/.test(next || "")) {
      let octal = next;
      for (let j = 0; j < 2 && /[0-7]/.test(input[i + 1] || ""); j += 1) octal += input[++i];
      output += String.fromCharCode(parseInt(octal, 8));
    } else if (next) {
      output += next;
    }
  }
  return output;
};

const collectTextOperands = (segment = "", { preserveWhitespace = false } = {}) => {
  const parts = [];
  const stringPattern = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g;

  const tjArrays = segment.match(/\[(?:[^\]\\]|\\.)*?\]\s*TJ/g) || [];
  tjArrays.forEach((arraySource) => {
    const strings = arraySource.match(stringPattern) || [];
    strings.forEach(item => parts.push(decodePdfString(item)));
  });

  const directText = segment.match(new RegExp(`${stringPattern.source}\\s*(?:Tj|'|")`, "g")) || [];
  directText.forEach((source) => {
    const match = source.match(stringPattern);
    if (match?.[0]) parts.push(decodePdfString(match[0]));
  });

  if (preserveWhitespace) {
    return parts.join("").replace(/\u00a0/g, " ").replace(/\u00d5/g, "'");
  }

  return normalizeWhitespace(parts.join(""));
};

const collectPositionedTextRuns = (streamText = "") => {
  const runs = [];
  const positionedTextPattern = /BT\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm([\s\S]*?)ET/g;
  let match;

  while ((match = positionedTextPattern.exec(streamText))) {
    const text = collectTextOperands(match[7] || "", { preserveWhitespace: true });
    if (!text) continue;

    runs.push({
      x: Number(match[5]),
      y: Number(match[6]),
      fontSize: Math.abs(Number(match[1])) || 12,
      text,
    });
  }

  return runs;
};

const positionedRunsToLines = (runs = []) => {
  if (!runs.length) return [];

  const sortedRuns = [...runs].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });
  const lineGroups = [];

  sortedRuns.forEach((run) => {
    const line = lineGroups.find(group => Math.abs(group.y - run.y) <= 2);
    if (line) {
      line.runs.push(run);
      line.y = (line.y + run.y) / 2;
    } else {
      lineGroups.push({ y: run.y, runs: [run] });
    }
  });

  const lines = lineGroups
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const orderedRuns = line.runs.sort((a, b) => a.x - b.x);
      let previousRun = null;
      let text = "";

      orderedRuns.forEach((run) => {
        if (previousRun) {
          const estimatedPreviousRight = previousRun.x + (previousRun.text.length * previousRun.fontSize * 0.55);
          const gap = run.x - estimatedPreviousRight;
          if (gap > run.fontSize * 0.75 && !/\s$/.test(text) && !/^\s/.test(run.text)) {
            text += " ";
          }
        }

        text += run.text;
        previousRun = run;
      });

      const averageFontSize = orderedRuns.reduce((sum, run) => sum + run.fontSize, 0) / orderedRuns.length;
      return {
        y: line.y,
        fontSize: averageFontSize || 12,
        text: normalizeWhitespace(text),
      };
    })
    .filter(line => line.text);

  const output = [];
  lines.forEach((line, index) => {
    const previousLine = lines[index - 1];
    if (previousLine) {
      const verticalGap = previousLine.y - line.y;
      const normalLineGap = Math.max(previousLine.fontSize, line.fontSize);
      if (verticalGap > normalLineGap * 1.45) {
        output.push("");
      }
    }
    output.push(line.text);
  });

  return output;
};

const positionedRunsToStructuredLines = (runs = []) => {
  if (!runs.length) return [];

  const sortedRuns = [...runs].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });
  const lineGroups = [];

  sortedRuns.forEach((run) => {
    const line = lineGroups.find(group => Math.abs(group.y - run.y) <= 2);
    if (line) {
      line.runs.push(run);
      line.y = (line.y + run.y) / 2;
    } else {
      lineGroups.push({ y: run.y, runs: [run] });
    }
  });

  const lines = lineGroups
    .sort((a, b) => b.y - a.y)
    .map((group) => {
      const orderedRuns = group.runs.sort((a, b) => a.x - b.x);
      let previousRun = null;
      let text = "";

      orderedRuns.forEach((run) => {
        if (previousRun) {
          const estimatedRight = previousRun.x + (previousRun.text.length * previousRun.fontSize * 0.55);
          const gap = run.x - estimatedRight;
          if (gap > run.fontSize * 0.75 && !/\s$/.test(text) && !/^\s/.test(run.text)) {
            text += " ";
          }
        }
        text += run.text;
        previousRun = run;
      });

      const fontSize = orderedRuns.reduce((sum, r) => sum + r.fontSize, 0) / orderedRuns.length || 12;
      return {
        y: group.y,
        x: orderedRuns[0]?.x ?? 0,
        fontSize,
        text: normalizeWhitespace(text),
      };
    })
    .filter(line => line.text);

  const output = [];
  lines.forEach((line, index) => {
    const prev = lines[index - 1];
    if (prev) {
      const gap = prev.y - line.y;
      const normalGap = Math.max(prev.fontSize, line.fontSize);
      if (gap > normalGap * 1.45) {
        output.push(null);
      }
    }
    output.push({ text: line.text, x: line.x, y: line.y });
  });

  return output;
};

// Infers the left margin x of action/scene-heading text by clustering x positions.
// Excludes scene headings, transitions, and very short lines (scene numbers, character cues)
// so that centered or right-aligned elements don't pull the minimum leftward.
const inferActionMarginX = (structuredLines) => {
  const xValues = structuredLines
    .filter(line => {
      if (line === null || !line.text) return false;
      if (isSceneHeadingLine(line.text) || isTransitionLine(line.text)) return false;
      if (line.text.length <= 10) return false;
      return true;
    })
    .map(line => line.x);

  if (!xValues.length) return null;

  const BUCKET = 6;
  const buckets = new Map();
  xValues.forEach(x => {
    const key = Math.round(x / BUCKET) * BUCKET;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const threshold = Math.max(2, xValues.length * 0.01);
  const qualifying = [...buckets.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => a[0] - b[0]);

  return qualifying.length > 0 ? qualifying[0][0] : Math.min(...xValues);
};

const inferColumnX = (xValues = []) => {
  const safeValues = xValues.filter(x => Number.isFinite(Number(x))).map(Number);
  if (!safeValues.length) return null;

  const BUCKET = 6;
  const buckets = new Map();
  safeValues.forEach(x => {
    const key = Math.round(x / BUCKET) * BUCKET;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  const [x] = [...buckets.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  })[0];

  return x;
};

const inferScreenplayColumnXs = (structuredLines = [], actionX = null) => {
  const characterXs = [];
  const parentheticalXs = [];
  const dialogueXs = [];
  let inDialogueContext = false;

  structuredLines.forEach((line) => {
    if (line === null) {
      inDialogueContext = false;
      return;
    }

    const text = normalizeWhitespace(line.text);
    if (!text) return;

    if (isSceneHeadingLine(text) || isTransitionLine(text)) {
      inDialogueContext = false;
      return;
    }

    if (isCharacterLine(text)) {
      characterXs.push(line.x);
      inDialogueContext = true;
      return;
    }

    if (isParentheticalLine(text)) {
      parentheticalXs.push(line.x);
      inDialogueContext = true;
      return;
    }

    if (inDialogueContext && !looksLikeActionProse(text)) {
      dialogueXs.push(line.x);
      return;
    }

    if (actionX !== null && Number(line.x) <= actionX + 10) {
      inDialogueContext = false;
    }
  });

  return {
    characterX: inferColumnX(characterXs),
    parentheticalX: inferColumnX(parentheticalXs),
    dialogueX: inferColumnX(dialogueXs),
  };
};

const filterStructuredLines = (structuredLines) => {
  const cleaned = [];
  let skipNextBlank = false;

  for (let i = 0; i < structuredLines.length; i++) {
    const item = structuredLines[i];

    if (item === null) {
      if (!skipNextBlank && cleaned.length > 0 && cleaned[cleaned.length - 1] !== null) {
        cleaned.push(null);
      }
      skipNextBlank = false;
      continue;
    }

    const text = normalizeWhitespace(item.text);

    if (isStandalonePdfArtifactLine(text)) {
      const prevItem = [...cleaned].reverse().find(c => c !== null);
      const prevText = prevItem?.text || "";
      let nextText = "";
      for (let j = i + 1; j < structuredLines.length; j++) {
        const next = structuredLines[j];
        if (next !== null && next.text) { nextText = normalizeWhitespace(next.text); break; }
      }

      if (
        prevText && nextText &&
        cleaned[cleaned.length - 1] !== null &&
        isSentenceCompleteLine(prevText) &&
        looksLikeActionProse(nextText) &&
        (looksLikeActionLine(prevText) || looksLikeDialogueLine(prevText))
      ) {
        cleaned.push(null);
      }
      skipNextBlank = true;
      continue;
    }

    const withoutArtifacts = stripInlinePdfNumericArtifacts(text);
    if (!withoutArtifacts) {
      skipNextBlank = true;
      continue;
    }

    cleaned.push({ ...item, text: withoutArtifacts });
    skipNextBlank = withoutArtifacts !== text;
  }

  const firstScriptIndex = cleaned.findIndex(
    item => item !== null && (isSceneHeadingLine(item.text) || /^FADE IN:?$/i.test(item.text))
  );
  const trimmed = firstScriptIndex > 0 ? cleaned.slice(firstScriptIndex) : cleaned;

  const deduped = [];
  trimmed.forEach((item, idx) => {
    if (item === null) {
      if (deduped.length > 0 && deduped[deduped.length - 1] !== null && idx < trimmed.length - 1) {
        deduped.push(null);
      }
    } else {
      deduped.push(item);
    }
  });

  return deduped;
};

const combineWrappedParentheticalStructuredLines = (structuredLines) => {
  const combined = [];

  for (let i = 0; i < structuredLines.length; i++) {
    const item = structuredLines[i];
    if (item === null || !item.text.startsWith("(") || isParentheticalLine(item.text)) {
      combined.push(item);
      continue;
    }

    const parts = [item.text];
    let cursor = i + 1;
    while (cursor < structuredLines.length) {
      const next = structuredLines[cursor];
      if (next === null || isSceneHeadingLine(next.text) || isCharacterLine(next.text) || isTransitionLine(next.text)) break;
      parts.push(next.text);
      if (/\)/.test(next.text)) break;
      cursor++;
    }

    const candidate = normalizeWhitespace(parts.join(" "));
    if (isParentheticalLine(candidate)) {
      combined.push({ ...item, text: candidate });
      i = cursor;
    } else {
      combined.push(item);
    }
  }

  return combined;
};

const parsePdfScenesFromStructuredLines = (structuredLines) => {
  const filtered = combineWrappedParentheticalStructuredLines(filterStructuredLines(structuredLines));
  const actionX = inferActionMarginX(filtered);
  const columnXs = inferScreenplayColumnXs(filtered, actionX);
  const ACTION_MARGIN_TOLERANCE = 10;
  const DIALOGUE_COLUMN_TOLERANCE = 18;
  const PARENTHETICAL_COLUMN_TOLERANCE = 18;

  const isAtActionMargin = (x) => actionX !== null && x <= actionX + ACTION_MARGIN_TOLERANCE;
  const isNearColumn = (x, columnX, tolerance) =>
    columnX !== null && Number.isFinite(Number(x)) && Math.abs(Number(x) - columnX) <= tolerance;
  const isAtDialogueColumn = (x) =>
    isNearColumn(x, columnXs.dialogueX, DIALOGUE_COLUMN_TOLERANCE);
  const isAtParentheticalColumn = (x) =>
    isNearColumn(x, columnXs.parentheticalX, PARENTHETICAL_COLUMN_TOLERANCE);
  const isStrongActionPosition = (x) =>
    isAtActionMargin(x) && !isAtDialogueColumn(x) && !isAtParentheticalColumn(x);

  const parsedScenes = [];
  let currentScene = null;
  let sceneNumber = 1;
  let previousType = null;
  let pendingActionLines = [];
  let pendingDialogueLines = [];
  let previousWasBoundary = false;

  const ensureScene = () => {
    if (!currentScene) currentScene = createScene("", sceneNumber);
    return currentScene;
  };

  const commitScene = () => {
    commitPendingText();
    if (!currentScene) return;
    if (currentScene.heading || currentScene.content.some(block => normalizeWhitespace(block.text))) {
      parsedScenes.push(currentScene);
      sceneNumber += 1;
    }
    currentScene = null;
    previousType = null;
  };

  const appendBlock = (type, text) => {
    const scene = ensureScene();
    const prevBlock = scene.content[scene.content.length - 1];

    if (type === "Parenthetical" && prevBlock?.type === "Character" && isCharacterContinuationMarker(text)) {
      prevBlock.text = `${stripCharacterContinuationMarker(prevBlock.text)} ${formatCharacterContinuationMarker(text)}`;
      previousType = "Character";
      return;
    }

    scene.content.push({
      type,
      text: type === "Character" ? text.toUpperCase() : text,
    });
    previousType = type;
  };

  const commitPendingAction = () => {
    if (!pendingActionLines.length) return;
    appendBlock("Action", pendingActionLines.join(" "));
    pendingActionLines = [];
  };

  const commitPendingDialogue = () => {
    if (!pendingDialogueLines.length) return;
    appendBlock("Dialogue", pendingDialogueLines.join(" "));
    pendingDialogueLines = [];
  };

  function commitPendingText() {
    commitPendingDialogue();
    commitPendingAction();
  }

  filtered.forEach((item) => {
    if (item === null) {
      commitPendingText();
      previousWasBoundary = true;
      return;
    }

    const text = normalizeWhitespace(item.text);
    const x = item.x;

    if (!text) {
      commitPendingText();
      previousWasBoundary = true;
      return;
    }

    if (isSceneHeadingLine(text)) {
      commitScene();
      currentScene = createScene(text, sceneNumber);
      previousType = "Scene Heading";
      previousWasBoundary = false;
      return;
    }

    if (isTransitionLine(text)) {
      commitPendingText();
      appendBlock("Transition", text);
      previousWasBoundary = false;
      return;
    }

    if (!currentScene) return;

    if (isCharacterLine(text)) {
      commitPendingText();
      appendBlock("Character", text);
      previousWasBoundary = false;
      return;
    }

    if (isCharacterContinuationMarker(text) && currentScene?.content?.[currentScene.content.length - 1]?.type === "Character") {
      commitPendingDialogue();
      commitPendingAction();
      appendBlock("Parenthetical", text);
      previousWasBoundary = false;
      return;
    }

    if (isParentheticalLine(text) && (previousType === "Character" || previousType === "Dialogue" || previousType === "Parenthetical" || pendingDialogueLines.length > 0)) {
      commitPendingDialogue();
      commitPendingAction();
      appendBlock("Parenthetical", text);
      previousWasBoundary = false;
      return;
    }

    // Position helps recover Action after Dialogue, but it cannot override the
    // screenplay structure immediately after Character/Parenthetical cues.
    if (
      isStrongActionPosition(x) &&
      !isParentheticalLine(text) &&
      (previousType === "Dialogue" || pendingDialogueLines.length > 0) &&
      pendingDialogueLines.length > 0 &&
      isSentenceCompleteLine(pendingDialogueLines[pendingDialogueLines.length - 1])
    ) {
      commitPendingDialogue();
      previousType = null;
      pendingActionLines.push(text);
      previousWasBoundary = false;
      return;
    }

    if (pendingActionLines.length > 0 && isAtActionMargin(x)) {
      pendingActionLines.push(text);
      previousWasBoundary = false;
      return;
    }

    // isAtDialogueColumn(x) overrides previousWasBoundary so page-break continuations
    // of Dialogue are not mis-routed to Action when x is still in the dialogue column.
    const hasDialogueContext =
      previousType === "Character" ||
      previousType === "Parenthetical" ||
      pendingDialogueLines.length > 0 ||
      (previousType === "Dialogue" && (!previousWasBoundary || !isStrongActionPosition(x) || isAtDialogueColumn(x)));

    if (hasDialogueContext) {
      if (
        looksLikeActionProse(text) &&
        isStrongActionPosition(x) &&
        !isParentheticalLine(text) &&
        pendingDialogueLines.length > 0 &&
        isSentenceCompleteLine(pendingDialogueLines[pendingDialogueLines.length - 1])
      ) {
        commitPendingDialogue();
        previousType = null;
        pendingActionLines.push(text);
        previousWasBoundary = false;
        return;
      }

      splitDialogueLineByParentheticals(text).forEach((part) => {
        if (part.type === "Parenthetical") {
          commitPendingDialogue();
          appendBlock("Parenthetical", part.text);
        } else if (part.text) {
          pendingDialogueLines.push(part.text);
        }
      });
      previousWasBoundary = false;
      return;
    }

    pendingActionLines.push(text);
    previousWasBoundary = false;
  });

  commitScene();
  return parsedScenes;
};

const extractTextFromPdfContentStream = (streamText = "") => {
  const positionedLines = positionedRunsToLines(collectPositionedTextRuns(streamText));
  if (positionedLines.length) return positionedLines.join("\n");

  const lines = [];
  const textObjects = streamText.match(/BT[\s\S]*?ET/g) || [];

  textObjects.forEach((textObject) => {
    const segments = textObject
      .replace(/\b(?:T\*|Tm|Td|TD)\b/g, "\n")
      .split(/\n+/);

    segments.forEach((segment) => {
      const text = collectTextOperands(segment);
      if (text) lines.push(text);
    });
  });

  return lines.join("\n");
};

const maybeInflateStream = async (streamBytes, dict = "") => {
  if (!/\/FlateDecode\b/.test(dict)) return streamBytes;
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser cannot decompress PDF text streams.");
  }

  const stream = new Response(streamBytes).body.pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const extractTextFromPdfArrayBuffer = async (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytesToLatin1(bytes);
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  const chunks = [];
  let match;

  while ((match = streamRegex.exec(binary))) {
    const dict = match[1] || "";
    const streamStart = match.index + match[0].indexOf(match[2]);
    const streamBytes = bytes.subarray(streamStart, streamStart + match[2].length);

    try {
      const decoded = await maybeInflateStream(streamBytes, dict);
      const text = extractTextFromPdfContentStream(bytesToLatin1(decoded));
      if (text) chunks.push(text);
    } catch (err) {
      if (!/\/FlateDecode\b/.test(dict)) {
        const text = extractTextFromPdfContentStream(match[2]);
        if (text) chunks.push(text);
      }
    }
  }

  return chunks.join("\n");
};

const collectStructuredLinesFromPdfArrayBuffer = async (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  const binary = bytesToLatin1(bytes);
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  const allLines = [];
  let match;

  while ((match = streamRegex.exec(binary))) {
    const dict = match[1] || "";
    const streamStart = match.index + match[0].indexOf(match[2]);
    const streamBytes = bytes.subarray(streamStart, streamStart + match[2].length);

    try {
      const decoded = await maybeInflateStream(streamBytes, dict);
      const runs = collectPositionedTextRuns(bytesToLatin1(decoded));
      if (runs.length) {
        const lines = positionedRunsToStructuredLines(runs);
        if (lines.length) {
          if (allLines.length > 0 && allLines[allLines.length - 1] !== null) {
            allLines.push(null);
          }
          allLines.push(...lines);
        }
      }
    } catch (err) {
      // skip streams that cannot be inflated or contain no positional text
    }
  }

  return allLines;
};

export const parseScriptFile = async (file) => {
  if (!file) return [];
  const fileName = String(file.name || "").toLowerCase();

  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const structuredLines = await collectStructuredLinesFromPdfArrayBuffer(arrayBuffer);

    if (structuredLines.length) {
      const scenes = parsePdfScenesFromStructuredLines(structuredLines);
      if (scenes.length) {
        return normalizeCharacterContinuationMarkers(scenes);
      }
    }

    // Fallback: text-only path when positional data is unavailable.
    const text = await extractTextFromPdfArrayBuffer(arrayBuffer);
    const scenes = parsePlainScreenplayTextToScenes(text);
    if (!scenes.length) {
      throw new Error("No screenplay scenes were found in the PDF text.");
    }
    return normalizeCharacterContinuationMarkers(scenes);
  }

  const text = await file.text();
  const scenes = parseFinalDraftXmlToScenes(text);
  if (!scenes.length) {
    throw new Error("No screenplay scenes were found in the FDX file.");
  }
  return normalizeCharacterContinuationMarkers(scenes);
};
